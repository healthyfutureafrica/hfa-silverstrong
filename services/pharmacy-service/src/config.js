const { requireEnv, optionalEnv, intEnv, boolEnv, keyEnv, pemEnv } = require('@hfa/shared');

function loadConfig() {
  return {
    port: intEnv('PORT', 4006),
    databaseUrl: requireEnv('DATABASE_URL'),
    databaseSsl: boolEnv('DATABASE_SSL', false),
    publicKey: pemEnv('AUTH_PUBLIC_KEY_B64'),
    issuer: optionalEnv('JWT_ISSUER', 'hfa-auth'),
    audience: optionalEnv('JWT_AUDIENCE', 'hfa-api'),
    // Four separate 256-bit keys, so each can be rotated independently and a leak of one does not
    // compromise the others.
    tokenKey: keyEnv('PRESCRIPTION_TOKEN_KEY'),         // AES-256-GCM key that seals prescription tokens
    codeKey: keyEnv('PRESCRIPTION_CODE_KEY'),           // HMAC key for short codes and patient references
    integrityKey: keyEnv('PRESCRIPTION_INTEGRITY_KEY'), // HMAC key for row integrity MACs
    dataKey: keyEnv('PHARMACY_DATA_KEY'),               // AES-256-GCM key for medication lists at rest
    maxFailedVerifications: intEnv('MAX_FAILED_VERIFICATIONS', 10),
    failureWindowSeconds: intEnv('VERIFICATION_FAILURE_WINDOW_SECONDS', 900),
    verifyRateLimit: intEnv('VERIFY_RATE_LIMIT', 30), // requests per pharmacist per minute
    internalToken: requireEnv('INTERNAL_SERVICE_TOKEN'),
    userServiceUrl: optionalEnv('USER_SERVICE_URL', 'http://user-service:4002'),
    trustProxy: boolEnv('TRUST_PROXY', true),
    runMigrations: boolEnv('RUN_MIGRATIONS', true)
  };
}

module.exports = { loadConfig };
