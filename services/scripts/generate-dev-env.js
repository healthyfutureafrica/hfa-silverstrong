// Creates services/.env for LOCAL DEVELOPMENT with freshly generated keys. Never use these values
// in production: there, every secret lives in AWS Secrets Manager and is injected into ECS tasks.
//   node scripts/generate-dev-env.js            (refuses to overwrite an existing .env)
//   node scripts/generate-dev-env.js --force
const fs = require('node:fs');
const path = require('node:path');
const { generateKeyPairSync, randomBytes, createHash } = require('node:crypto');

const target = path.join(__dirname, '..', '.env');
if (fs.existsSync(target) && !process.argv.includes('--force')) {
  console.error('.env already exists; pass --force to replace it (existing encrypted data will become unreadable).');
  process.exit(1);
}

const hex = () => randomBytes(32).toString('hex');
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const ministryKey = randomBytes(24).toString('base64url');

const values = {
  POSTGRES_PASSWORD: randomBytes(18).toString('base64url'),
  AUTH_PRIVATE_KEY_B64: Buffer.from(privateKey).toString('base64'),
  AUTH_PUBLIC_KEY_B64: Buffer.from(publicKey).toString('base64'),
  INTERNAL_SERVICE_TOKEN: randomBytes(32).toString('base64url'),
  COOKIE_SECURE: 'false', // local http only; must be true in production
  ALLOWED_ORIGINS: 'http://localhost:8090,https://www.healthyfutureafrica.org',
  USER_DATA_KEY: hex(), USER_BLIND_INDEX_KEY: hex(), CREDENTIAL_HASH_KEY: hex(),
  PRESCRIPTION_TOKEN_KEY: hex(), PRESCRIPTION_CODE_KEY: hex(), PRESCRIPTION_INTEGRITY_KEY: hex(), PHARMACY_DATA_KEY: hex(),
  PAYMENT_DATA_KEY: hex(), PAYMENT_BLIND_INDEX_KEY: hex(),
  MTN_BASE_URL: 'https://sandbox.momodeveloper.mtn.com', MTN_TARGET_ENVIRONMENT: 'sandbox', MTN_CURRENCY: 'EUR',
  MTN_COLLECTION_SUBSCRIPTION_KEY: 'replace-with-sandbox-subscription-key', MTN_API_USER: 'replace-with-sandbox-api-user-uuid', MTN_API_KEY: 'replace-with-sandbox-api-key',
  MTN_CALLBACK_SECRET: randomBytes(32).toString('base64url'),
  PUBLIC_BASE_URL: 'http://localhost:8090',
  MINISTRY_API_KEYS: `minsante-dev:${createHash('sha256').update(ministryKey).digest('hex')}`,
  AUTH_SERVICE_URL: 'http://auth-service:4001', USER_SERVICE_URL: 'http://user-service:4002', CONSULTATION_SERVICE_URL: 'http://consultation-service:4003'
};

fs.writeFileSync(target, `# Generated ${new Date().toISOString()} for local development only.\n${Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n')}\n`, { mode: 0o600 });
console.log(`Wrote ${target}`);
console.log(`Development Ministry API key (shown once): ${ministryKey}`);
