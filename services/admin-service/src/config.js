const { requireEnv, optionalEnv, intEnv, boolEnv, pemEnv } = require('@hfa/shared');

// MINISTRY_API_KEYS lists clients as "clientId:sha256hex" separated by commas, e.g.
//   MINISTRY_API_KEYS=minsante-dlmep:4f1c...,delegation-littoral:9a0b...
// Generate a key with `openssl rand -base64 32`, give it to the client over a secure channel, and
// store only its hash: `printf '%s' "$KEY" | sha256sum`.
function parseMinistryClients(value) {
  if (!value) return [];
  return value.split(',').map(entry => entry.trim()).filter(Boolean).map(entry => {
    const [id, keyHash] = entry.split(':');
    if (!/^[a-z0-9-]{3,60}$/.test(id || '') || !/^[0-9a-f]{64}$/.test(keyHash || '')) throw new Error('MINISTRY_API_KEYS entries must look like client-id:<64 hex sha256>');
    return { id, keyHash };
  });
}

function loadConfig() {
  return {
    port: intEnv('PORT', 4008),
    databaseUrl: requireEnv('DATABASE_URL'),
    databaseSsl: boolEnv('DATABASE_SSL', false),
    publicKey: pemEnv('AUTH_PUBLIC_KEY_B64'),
    issuer: optionalEnv('JWT_ISSUER', 'hfa-auth'),
    audience: optionalEnv('JWT_AUDIENCE', 'hfa-api'),
    internalToken: requireEnv('INTERNAL_SERVICE_TOKEN'),
    ministryClients: parseMinistryClients(optionalEnv('MINISTRY_API_KEYS', '')),
    smallCellThreshold: intEnv('SMALL_CELL_THRESHOLD', 5),
    timezone: optionalEnv('SURVEILLANCE_TIMEZONE', 'Africa/Douala'),
    streamThrottleSeconds: intEnv('SURVEILLANCE_STREAM_THROTTLE_SECONDS', 10),
    redisUrl: optionalEnv('REDIS_URL', undefined),
    stream: optionalEnv('SURVEILLANCE_STREAM', 'consultations.completed'),
    deadLetterStream: optionalEnv('SURVEILLANCE_DEAD_LETTER_STREAM', 'consultations.completed.dead-letter'),
    consumerGroup: optionalEnv('SURVEILLANCE_CONSUMER_GROUP', 'admin-surveillance'),
    trustProxy: boolEnv('TRUST_PROXY', true),
    runMigrations: boolEnv('RUN_MIGRATIONS', true)
  };
}

module.exports = { loadConfig, parseMinistryClients };
