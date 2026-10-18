import * as Keychain from 'react-native-keychain';

// CHW session against the Auth Service, using its mobile mode: the refresh token is returned in
// the response body and kept in the Keychain/Keystore (never AsyncStorage); the short-lived access
// token is kept only in memory. Refresh tokens rotate on every use, so each refresh stores the new one.
const BASE_URL = 'https://www.healthyfutureafrica.org';
const SERVICE = 'org.healthyfutureafrica.chw.session';
let accessToken = null;
let currentUserId = null;
let refreshing = null;

async function storeRefreshToken(token) {
  await Keychain.setGenericPassword('refresh', token, { service: SERVICE, accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

async function signIn(email, password) {
  const response = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, client: 'mobile' })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || 'Sign-in failed');
  accessToken = body.data.accessToken;
  currentUserId = body.data.user.id;
  await storeRefreshToken(body.data.refreshToken);
  return body.data.user;
}

// Single-flight: concurrent callers share one refresh, so a rotated token is never reused
// (reuse would be treated as theft and end the session).
function refresh() {
  if (!refreshing) {
    refreshing = (async () => {
      const stored = await Keychain.getGenericPassword({ service: SERVICE });
      if (!stored) return false;
      const response = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: stored.password })
      }).catch(() => null);
      if (!response) return false;
      if (!response.ok) { await signOut(); return false; }
      const body = await response.json();
      accessToken = body.data.accessToken;
      currentUserId = body.data.user.id;
      await storeRefreshToken(body.data.refreshToken);
      return true;
    })().finally(() => { refreshing = null; });
  }
  return refreshing;
}

async function signOut() {
  accessToken = null;
  currentUserId = null;
  await Keychain.resetGenericPassword({ service: SERVICE });
}

export const session = { signIn, refresh, signOut, getAccessToken: async () => accessToken, userId: () => currentUserId };
