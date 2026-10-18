const { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } = require('node:crypto');

// AES-256-GCM field encryption. Layout of every encrypted value:
//   [1 byte version][12 byte IV][16 byte auth tag][ciphertext]
// GCM authenticates the data, so any tampering makes decryption fail. The optional
// "associated data" (aad) binds a ciphertext to its context, e.g. `patients.first_name:<id>`,
// so an attacker with database access cannot swap encrypted values between rows or columns.
const VERSION = 1;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function assertKey(key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('Encryption key must be a 32-byte Buffer');
}

function encrypt(key, plaintext, aad = '') {
  assertKey(key);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad));
  const body = Buffer.concat([cipher.update(Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(String(plaintext), 'utf8')), cipher.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), body]);
}

function decrypt(key, blob, aad = '') {
  assertKey(key);
  if (!Buffer.isBuffer(blob) || blob.length < 1 + IV_LENGTH + TAG_LENGTH || blob[0] !== VERSION) throw new Error('Unsupported or corrupted ciphertext');
  const iv = blob.subarray(1, 1 + IV_LENGTH);
  const tag = blob.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(blob.subarray(1 + IV_LENGTH + TAG_LENGTH)), decipher.final()]);
}

const encryptString = (key, value, aad) => (value === null || value === undefined ? null : encrypt(key, value, aad));
const decryptString = (key, blob, aad) => (blob === null || blob === undefined ? null : decrypt(key, blob, aad).toString('utf8'));
const encryptJson = (key, value, aad) => encrypt(key, JSON.stringify(value), aad);
const decryptJson = (key, blob, aad) => JSON.parse(decrypt(key, blob, aad).toString('utf8'));

// Keyed hash used as a "blind index": lets us look up an exact value (phone, national ID,
// verification code) without storing it in plain text.
const hmacHex = (key, value) => createHmac('sha256', key).update(String(value)).digest('hex');
const sha256Hex = value => createHash('sha256').update(value).digest('hex');

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

// Stable JSON (sorted keys) so hashes of the same object are always identical.
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value instanceof Date ? value.toISOString() : value);
}

module.exports = { encrypt, decrypt, encryptString, decryptString, encryptJson, decryptJson, hmacHex, sha256Hex, safeEqual, canonicalJson };
