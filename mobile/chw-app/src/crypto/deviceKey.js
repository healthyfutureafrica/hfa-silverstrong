import * as Keychain from 'react-native-keychain';
import { randomBytes } from 'react-native-quick-crypto';
import { Buffer } from 'buffer';

// The 256-bit key that encrypts offline consultations. It is generated on first use and kept in
// the Android Keystore / iOS Keychain, readable only by this app, only on this device, and only
// while the phone is unlocked. It is never sent to the server or written to AsyncStorage.
const SERVICE = 'org.healthyfutureafrica.chw.offline-key';
let cachedKey = null;

export async function getDeviceKey() {
  if (cachedKey) return cachedKey;
  const existing = await Keychain.getGenericPassword({ service: SERVICE });
  if (existing) {
    cachedKey = Buffer.from(existing.password, 'base64');
    return cachedKey;
  }
  const key = Buffer.from(randomBytes(32));
  await Keychain.setGenericPassword('offline-key', key.toString('base64'), {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
  cachedKey = key;
  return key;
}

// Call on sign-out of a CHW so the next user cannot read leftover records.
export async function forgetDeviceKey() {
  cachedKey = null;
  await Keychain.resetGenericPassword({ service: SERVICE });
}
