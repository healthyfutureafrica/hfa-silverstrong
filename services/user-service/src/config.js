const { requireEnv, optionalEnv, intEnv, boolEnv, keyEnv, pemEnv } = require('@hfa/shared');

function loadConfig() {
  return {
    port: intEnv('PORT', 4002),
    databaseUrl: requireEnv('DATABASE_URL'),
    databaseSsl: boolEnv('DATABASE_SSL', false),
    publicKey: pemEnv('AUTH_PUBLIC_KEY_B64'),
    issuer: optionalEnv('JWT_ISSUER', 'hfa-auth'),
    audience: optionalEnv('JWT_AUDIENCE', 'hfa-api'),
    dataKey: keyEnv('USER_DATA_KEY'),                 // AES-256 key for patient field encryption
    blindIndexKey: keyEnv('USER_BLIND_INDEX_KEY'),    // HMAC key for phone / national ID lookups
    credentialKey: keyEnv('CREDENTIAL_HASH_KEY'),     // HMAC key for provider credential hashes
    consentPolicyVersion: optionalEnv('CONSENT_POLICY_VERSION', '2026.1'),
    internalToken: requireEnv('INTERNAL_SERVICE_TOKEN'),
    authServiceUrl: optionalEnv('AUTH_SERVICE_URL', 'http://auth-service:4001'),
    trustProxy: boolEnv('TRUST_PROXY', true),
    runMigrations: boolEnv('RUN_MIGRATIONS', true)
  };
}

module.exports = { loadConfig };
