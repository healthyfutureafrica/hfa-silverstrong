const { requireEnv, optionalEnv, intEnv, boolEnv, pemEnv } = require('@hfa/shared');

// All settings come from environment variables (see services/README.md for the full list).
function loadConfig() {
  return {
    port: intEnv('PORT', 4001),
    databaseUrl: requireEnv('DATABASE_URL'),
    databaseSsl: boolEnv('DATABASE_SSL', false),
    privateKey: pemEnv('AUTH_PRIVATE_KEY_B64'),
    publicKey: pemEnv('AUTH_PUBLIC_KEY_B64'),
    issuer: optionalEnv('JWT_ISSUER', 'hfa-auth'),
    audience: optionalEnv('JWT_AUDIENCE', 'hfa-api'),
    accessTtlSeconds: intEnv('ACCESS_TOKEN_TTL_SECONDS', 900), // 15 minutes
    refreshTtlSeconds: intEnv('REFRESH_TOKEN_TTL_SECONDS', 7 * 86400), // idle timeout: 7 days
    sessionMaxSeconds: intEnv('SESSION_MAX_SECONDS', 30 * 86400), // absolute session lifetime: 30 days
    cookieSecure: boolEnv('COOKIE_SECURE', true),
    cookieDomain: optionalEnv('COOKIE_DOMAIN', undefined),
    allowedOrigins: optionalEnv('ALLOWED_ORIGINS', 'https://www.healthyfutureafrica.org,https://healthyfutureafrica.org').split(',').map(origin => origin.trim()),
    internalToken: requireEnv('INTERNAL_SERVICE_TOKEN'),
    scryptCost: intEnv('SCRYPT_COST', 131072), // OWASP: N=2^17, r=8, p=1
    maxFailedLogins: intEnv('MAX_FAILED_LOGINS', 5),
    lockoutSeconds: intEnv('LOCKOUT_SECONDS', 900),
    loginRateLimit: intEnv('LOGIN_RATE_LIMIT', 10), // attempts per IP per 15 minutes
    trustProxy: boolEnv('TRUST_PROXY', true),
    runMigrations: boolEnv('RUN_MIGRATIONS', true)
  };
}

module.exports = { loadConfig };
