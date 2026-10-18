// AES-256-GCM encryption for consultations saved on the phone. AsyncStorage itself is NOT
// encrypted (a rooted or lost phone exposes it), so every record is sealed before storage.
// `crypto` is react-native-quick-crypto on the phone and Node's crypto in tests; both expose the
// same createCipheriv / randomBytes API. Stored format (base64): [1 version][12 IV][16 tag][data].

const VERSION = 1;

function createPayloadCipher({ crypto, getKey, Buffer: BufferImpl = global.Buffer }) {
  async function encrypt(value, associatedData) {
    const key = await getKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(BufferImpl.from(associatedData));
    const body = BufferImpl.concat([cipher.update(BufferImpl.from(JSON.stringify(value), 'utf8')), cipher.final()]);
    return BufferImpl.concat([BufferImpl.from([VERSION]), iv, cipher.getAuthTag(), body]).toString('base64');
  }

  async function decrypt(text, associatedData) {
    const key = await getKey();
    const blob = BufferImpl.from(text, 'base64');
    if (blob[0] !== VERSION || blob.length < 29) throw new Error('Unsupported or corrupted record');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, blob.subarray(1, 13));
    decipher.setAAD(BufferImpl.from(associatedData));
    decipher.setAuthTag(blob.subarray(13, 29));
    return JSON.parse(BufferImpl.concat([decipher.update(blob.subarray(29)), decipher.final()]).toString('utf8'));
  }

  return { encrypt, decrypt };
}

module.exports = { createPayloadCipher };
