const { requireEnv, optionalEnv, intEnv, boolEnv, keyEnv, pemEnv } = require('@hfa/shared');

function loadConfig() {
  const callbackSecret = requireEnv('MTN_CALLBACK_SECRET');
  if (callbackSecret.length < 32) throw new Error('MTN_CALLBACK_SECRET must be at least 32 characters');
  const publicBaseUrl = optionalEnv('PUBLIC_BASE_URL', 'https://www.healthyfutureafrica.org');
  return {
    port: intEnv('PORT', 4005),
    databaseUrl: requireEnv('DATABASE_URL'),
    databaseSsl: boolEnv('DATABASE_SSL', false),
    publicKey: pemEnv('AUTH_PUBLIC_KEY_B64'),
    issuer: optionalEnv('JWT_ISSUER', 'hfa-auth'),
    audience: optionalEnv('JWT_AUDIENCE', 'hfa-api'),
    dataKey: keyEnv('PAYMENT_DATA_KEY'),          // AES-256-GCM key for payer phone numbers
    blindIndexKey: keyEnv('PAYMENT_BLIND_INDEX_KEY'),
    paymentTimeoutSeconds: intEnv('PAYMENT_TIMEOUT_SECONDS', 600),
    workerEnabled: boolEnv('PAYMENT_WORKER_ENABLED', true),
    workerIntervalMs: intEnv('PAYMENT_WORKER_INTERVAL_MS', 5000),
    internalToken: requireEnv('INTERNAL_SERVICE_TOKEN'),
    consultationServiceUrl: optionalEnv('CONSULTATION_SERVICE_URL', 'http://consultation-service:4003'),
    trustProxy: boolEnv('TRUST_PROXY', true),
    runMigrations: boolEnv('RUN_MIGRATIONS', true),
    mtn: {
      baseUrl: optionalEnv('MTN_BASE_URL', 'https://sandbox.momodeveloper.mtn.com'),
      subscriptionKey: requireEnv('MTN_COLLECTION_SUBSCRIPTION_KEY'),
      apiUser: requireEnv('MTN_API_USER'),
      apiKey: requireEnv('MTN_API_KEY'),
      targetEnvironment: optionalEnv('MTN_TARGET_ENVIRONMENT', 'sandbox'), // 'mtncameroon' in production
      currency: optionalEnv('MTN_CURRENCY', 'EUR'),                        // 'XAF' in production
      callbackSecret,
      callbackUrl: `${publicBaseUrl}/api/v1/payments/webhooks/mtn/${callbackSecret}`
    }
  };
}

module.exports = { loadConfig };
