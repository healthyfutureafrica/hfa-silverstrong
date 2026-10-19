const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Store, hashPassword } = require('../store');
const { createApp } = require('../server');
const { totp, passwordProblem, STEP_SECONDS } = require('../account-security');

const baseConfig = { origin: 'http://localhost:8080', ready: false, fileEncryptionKey: '7b'.repeat(32) };

function client(base) {
  const jar = new Map();
  return {
    async call(path, body, method = body === undefined ? 'GET' : 'POST') {
      const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-HFA-Request': '1', Origin: baseConfig.origin, Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') }, body: body === undefined ? undefined : JSON.stringify(body) });
      for (const line of response.headers.getSetCookie?.() || []) {
        const [pair, ...attributes] = line.split(';'); const [name, ...rest] = pair.split('='); const value = rest.join('=');
        if (!value || attributes.some(a => /expires=thu, 01 jan 1970/i.test(a.trim()))) jar.delete(name.trim()); else jar.set(name.trim(), value);
      }
      return response;
    }
  };
}
async function start(config) {
  const store = new Store();
  const server = createApp({ ...baseConfig, ...config }, store, {}).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  return { store, base: `http://127.0.0.1:${server.address().port}`, close: async () => { await new Promise(resolve => server.close(resolve)); store.close(); } };
}
const codeFor = (secret, offsetSteps = 0) => totp(secret.replace(/\s/g, ''), Math.floor(Date.now() / 1000 / STEP_SECONDS) + offsetSteps);

test('password rules refuse weak and personal passwords', () => {
  const user = { email: 'chinjiesylvestern@gmail.com', name: 'Chinjie Sylvester Nkeh' };
  for (const weak of ['short1!', 'superadmin@123', 'Password1234!', 'aaaaaaaaaaaa1', 'chinjiesylvestern99!', 'Sylvester#2026x']) assert.ok(passwordProblem(weak, user), weak);
  assert.equal(passwordProblem('mango river lantern 47', user), null);
});

test('changing a password needs the current one, enforces strength and signs out other devices', async () => {
  const app = await start({});
  try {
    const user = app.store.createUser({ name: 'Synthetic Nurse', email: 'nurse-pw@example.invalid', role: 'nurse' }, await hashPassword('Old-synthetic-pass-1'), 'active');
    const laptop = client(app.base), phone = client(app.base);
    for (const device of [laptop, phone]) assert.equal((await device.call('/api/auth/login', { email: 'nurse-pw@example.invalid', password: 'Old-synthetic-pass-1' })).status, 200);
    assert.equal((await laptop.call('/api/v1/account/password', { currentPassword: 'wrong-password', newPassword: 'mango river lantern 47' })).status, 401);
    assert.equal((await laptop.call('/api/v1/account/password', { currentPassword: 'Old-synthetic-pass-1', newPassword: 'password12345' })).status, 400);
    const changed = await laptop.call('/api/v1/account/password', { currentPassword: 'Old-synthetic-pass-1', newPassword: 'mango river lantern 47' });
    assert.equal(changed.status, 200);
    assert.equal((await laptop.call('/api/session')).status, 200, 'this device stays signed in');
    assert.equal((await phone.call('/api/session')).status, 401, 'other devices are signed out');
    assert.equal((await client(app.base).call('/api/auth/login', { email: 'nurse-pw@example.invalid', password: 'Old-synthetic-pass-1' })).status, 401);
    assert.equal((await client(app.base).call('/api/auth/login', { email: 'nurse-pw@example.invalid', password: 'mango river lantern 47' })).status, 200);
    assert.equal(app.store.auditLog().find(entry => entry.action === 'PASSWORD_CHANGED').targetName, user.name);
  } finally { await app.close(); }
});

test('two-step sign-in: setup, sign-in with a code, no code reuse, recovery codes, and admin tools require it', async () => {
  const app = await start({ requireAdminMfa: true });
  try {
    app.store.createUser({ name: 'Chief Admin', email: 'chief-mfa@example.invalid', role: 'admin' }, await hashPassword('Synthetic-admin-pass-9'), 'active');
    const doctor = app.store.createUser({ name: 'Dr Synthetic', email: 'doc-mfa@example.invalid', role: 'doctor' }, 'x', 'active');
    const browser = client(app.base);
    assert.equal((await browser.call('/api/auth/login', { email: 'chief-mfa@example.invalid', password: 'Synthetic-admin-pass-9' })).status, 200);
    // Admin tools are locked until two-step sign-in is on.
    const locked = await browser.call('/api/v1/admin/audit');
    assert.equal(locked.status, 403);
    assert.equal((await locked.json()).code, 'mfa_required');
    assert.equal((await browser.call(`/api/v1/admin/impersonate/${doctor.id}`, {})).status, 403);

    const setup = await (await browser.call('/api/v1/account/mfa/setup', {})).json();
    assert.match(setup.qrSvg, /^<svg/);
    assert.equal(setup.secret.replace(/\s/g, '').length, 32);
    assert.equal((await browser.call('/api/v1/account/mfa/enable', { code: '000000' })).status, 400);
    const enabled = await browser.call('/api/v1/account/mfa/enable', { code: codeFor(setup.secret) });
    assert.equal(enabled.status, 200);
    const { recoveryCodes, user } = await enabled.json();
    assert.equal(recoveryCodes.length, 8);
    assert.equal(user.mfaEnabled, true);
    const stored = app.store.db.prepare('SELECT mfa_secret,mfa_recovery FROM users WHERE email=?').get('chief-mfa@example.invalid');
    assert.equal(stored.mfa_secret.includes(setup.secret.replace(/\s/g, '')), false, 'secret stored encrypted');
    assert.equal(stored.mfa_recovery.includes(recoveryCodes[0]), false, 'recovery codes stored hashed');
    assert.equal((await browser.call('/api/v1/admin/audit')).status, 200, 'admin tools unlocked');
    assert.equal((await browser.call('/api/v1/account/mfa/disable', { password: 'Synthetic-admin-pass-9', code: codeFor(setup.secret) })).status, 403, 'admins keep it on');

    // Signing in now needs the code.
    const fresh = client(app.base);
    const first = await (await fresh.call('/api/auth/login', { email: 'chief-mfa@example.invalid', password: 'Synthetic-admin-pass-9' })).json();
    assert.equal(first.mfaRequired, true);
    assert.equal(first.user, undefined, 'no account data before the code');
    assert.equal((await fresh.call('/api/session')).status, 401, 'no session before the code');
    assert.equal((await fresh.call('/api/auth/mfa', { challenge: first.challenge, code: '123456' })).status, 401);
    const nextCode = codeFor(setup.secret, 1); // the code used to enable was the current step; use the next one
    const signedIn = await fresh.call('/api/auth/mfa', { challenge: first.challenge, code: nextCode });
    assert.equal(signedIn.status, 200);
    assert.equal((await signedIn.json()).user.email, 'chief-mfa@example.invalid');
    // The same code cannot be used twice.
    const again = await (await client(app.base).call('/api/auth/login', { email: 'chief-mfa@example.invalid', password: 'Synthetic-admin-pass-9' })).json();
    assert.equal((await client(app.base).call('/api/auth/mfa', { challenge: again.challenge, code: nextCode })).status, 401);
    // A recovery code works once.
    const viaRecovery = client(app.base);
    const third = await (await viaRecovery.call('/api/auth/login', { email: 'chief-mfa@example.invalid', password: 'Synthetic-admin-pass-9' })).json();
    assert.equal((await viaRecovery.call('/api/auth/mfa', { challenge: third.challenge, code: recoveryCodes[0].toLowerCase() })).status, 200);
    const fourth = await (await client(app.base).call('/api/auth/login', { email: 'chief-mfa@example.invalid', password: 'Synthetic-admin-pass-9' })).json();
    assert.equal((await client(app.base).call('/api/auth/mfa', { challenge: fourth.challenge, code: recoveryCodes[0] })).status, 401);
    // Too many wrong codes ends the challenge.
    const guesser = client(app.base);
    const fifth = await (await guesser.call('/api/auth/login', { email: 'chief-mfa@example.invalid', password: 'Synthetic-admin-pass-9' })).json();
    for (let attempt = 0; attempt < 5; attempt++) await guesser.call('/api/auth/mfa', { challenge: fifth.challenge, code: String(100000 + attempt) });
    assert.equal((await guesser.call('/api/auth/mfa', { challenge: fifth.challenge, code: codeFor(setup.secret, 1) })).status, 429);
    assert.deepEqual(app.store.auditLog().map(entry => entry.action).filter(action => action.startsWith('MFA')).sort(), ['MFA_ENABLED', 'MFA_RECOVERY_CODE_USED']);
  } finally { await app.close(); }
});
