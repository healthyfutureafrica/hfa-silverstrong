const { createHmac } = require('node:crypto');
const { encrypt, decrypt, hmacHex, canonicalJson } = require('@hfa/shared');

// Crockford base32: digits and capital letters without I, L, O, U, so codes are easy to read
// aloud and type, and contain no ambiguous characters.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TOKEN_PREFIX = 'HFA1';
const TOKEN_AAD = 'hfa-prescription-token-v1';
const SHORT_CODE_LENGTH = 16; // 80 bits

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(text) {
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const character of text) {
    const index = ALPHABET.indexOf(character);
    if (index === -1) throw new Error('Invalid character in code');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
    value &= (1 << bits) - 1;
  }
  // Leftover padding bits must be zero, so every token has exactly one valid spelling.
  if (value !== 0) throw new Error('Non-canonical code');
  return Buffer.from(bytes);
}

// Creates the two forms of a prescription's verification credential:
//   token     — AES-256-GCM sealed payload (prescription id, prescriber, prescriber credential
//               hash, pseudonymous patient reference, validity window, medication digest),
//               alphanumeric, for a QR code. Only the Pharmacy Service key can open it, and any
//               change makes it fail authentication.
//   shortCode — 16 characters derived from the sealed token by HMAC, for typing at the counter.
//               Only its HMAC (codeDigest) is stored, so a database leak reveals no usable codes.
function createPrescriptionCredential(keys, payload) {
  const sealed = encrypt(keys.tokenKey, canonicalJson(payload), TOKEN_AAD);
  const token = TOKEN_PREFIX + base32Encode(sealed);
  const raw = base32Encode(createHmac('sha256', keys.codeKey).update(sealed).digest()).slice(0, SHORT_CODE_LENGTH);
  return { token, shortCode: raw.match(/.{4}/g).join('-'), codeDigest: shortCodeDigest(keys, raw) };
}

// Opens a token; returns the payload, or null if it is malformed, forged or altered.
function openPrescriptionToken(keys, token) {
  const text = String(token || '').trim().toUpperCase();
  if (!text.startsWith(TOKEN_PREFIX) || text.length > 2000) return null;
  try {
    return JSON.parse(decrypt(keys.tokenKey, base32Decode(text.slice(TOKEN_PREFIX.length)), TOKEN_AAD).toString('utf8'));
  } catch (error) {
    return null;
  }
}

// Accepts what a person might type: lower case, spaces or dashes, O for 0, I or L for 1.
function normaliseShortCode(input) {
  const cleaned = String(input || '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return cleaned.length === SHORT_CODE_LENGTH && [...cleaned].every(character => ALPHABET.includes(character)) ? cleaned : null;
}

const shortCodeDigest = (keys, normalisedCode) => hmacHex(keys.codeKey, `code:${normalisedCode}`);
const patientReference = (keys, patientId) => hmacHex(keys.codeKey, `patient:${patientId}`).slice(0, 32);

module.exports = { createPrescriptionCredential, openPrescriptionToken, normaliseShortCode, shortCodeDigest, patientReference, base32Encode, base32Decode, ALPHABET };
