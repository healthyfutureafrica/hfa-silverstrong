/**
 * Configuration for the HFA WhatsApp bot.
 *
 * Every setting comes from environment variables (loaded from `.env` by dotenv in development).
 * Required variables are validated once at startup: if any is missing, the process exits with a
 * clear error instead of failing later in the middle of a conversation.
 *
 * This module also exports a small logger that masks every secret value, so tokens and keys can
 * never end up in log output (and from there in CloudWatch).
 */
require('dotenv').config();

/** Variables the bot cannot start without. */
const REQUIRED = [
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_VERIFY_TOKEN',
  'WHATSAPP_APP_SECRET',
  'OPENAI_API_KEY',
  'REDIS_URL',
  'DATABASE_URL',
  'HFA_API_BASE_URL',
  'HFA_API_KEY'
];

/** Variables whose values must never appear in logs. */
const SECRET_NAMES = ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_APP_SECRET', 'OPENAI_API_KEY', 'HFA_API_KEY', 'DATABASE_URL', 'REDIS_URL'];

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

/**
 * Reads and validates all configuration from an environment object.
 *
 * @param {NodeJS.ProcessEnv} env - Usually `process.env`; tests pass their own object.
 * @returns {object} The validated, typed configuration.
 * @throws {Error} When a required variable is missing or a value is invalid.
 */
function loadConfig(env = process.env) {
  const missing = REQUIRED.filter(name => !env[name] || !env[name].trim());
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}. See .env.example.`);
  }

  const port = Number(env.PORT || 4009);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid port number');

  const logLevel = (env.LOG_LEVEL || 'info').toLowerCase();
  if (!(logLevel in LOG_LEVELS)) throw new Error(`LOG_LEVEL must be one of: ${Object.keys(LOG_LEVELS).join(', ')}`);

  const graphApiVersion = env.WHATSAPP_GRAPH_API_VERSION || 'v24.0';
  if (!/^v\d+\.\d+$/.test(graphApiVersion)) throw new Error('WHATSAPP_GRAPH_API_VERSION must look like v24.0');

  let hfaApiBaseUrl;
  try {
    hfaApiBaseUrl = new URL(env.HFA_API_BASE_URL).toString().replace(/\/$/, '');
  } catch (error) {
    throw new Error('HFA_API_BASE_URL must be a full URL, e.g. https://api.healthyfutureafrica.org');
  }

  return {
    nodeEnv: env.NODE_ENV || 'development',
    port,
    logLevel,
    whatsapp: {
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID.trim(),
      accessToken: env.WHATSAPP_ACCESS_TOKEN.trim(),
      verifyToken: env.WHATSAPP_VERIFY_TOKEN.trim(),
      appSecret: env.WHATSAPP_APP_SECRET.trim(),
      graphApiVersion
    },
    openaiApiKey: env.OPENAI_API_KEY.trim(),
    redisUrl: env.REDIS_URL.trim(),
    databaseUrl: env.DATABASE_URL.trim(),
    hfaApi: {
      baseUrl: hfaApiBaseUrl,
      apiKey: env.HFA_API_KEY.trim()
    },
    session: {
      ttlSeconds: 30 * 60 // 30 minutes, reset on every message
    },
    externalCallTimeoutMs: 4000, // keeps the bot within its 5-second response budget
    secretValues: SECRET_NAMES.map(name => env[name]).filter(value => value && value.length >= 4)
  };
}

/**
 * Replaces every known secret value in a string with "***".
 *
 * @param {string} text - Text that may contain secrets.
 * @param {string[]} secretValues - Values to hide.
 * @returns {string} The text with secrets masked.
 */
function maskSecrets(text, secretValues) {
  let masked = String(text);
  for (const secret of secretValues) masked = masked.split(secret).join('***');
  // Also hide anything that looks like a bearer token or an access_token query parameter.
  return masked.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer ***').replace(/(access_token=)[^&\s"]+/g, '$1***');
}

/**
 * Creates a JSON-lines logger. Output goes to stdout/stderr, which PM2 and the CloudWatch agent
 * collect. Never pass message contents or symptoms to the logger — identifiers and metadata only.
 *
 * @param {object} options
 * @param {string} options.level - Minimum level to output (error, warn, info, debug).
 * @param {string[]} options.secretValues - Secret values to mask in every log line.
 * @returns {{error: Function, warn: Function, info: Function, debug: Function}} Logger.
 */
function createLogger({ level, secretValues }) {
  const threshold = LOG_LEVELS[level];
  /**
   * Writes one log line if its level is enabled.
   *
   * @param {string} lineLevel - Level of this line.
   * @param {string} event - Short machine-readable event name.
   * @param {object} [fields] - Extra metadata (no secrets, no health data).
   */
  const write = (lineLevel, event, fields = {}) => {
    if (LOG_LEVELS[lineLevel] > threshold) return;
    const line = maskSecrets(JSON.stringify({ time: new Date().toISOString(), level: lineLevel, service: 'hfa-whatsapp-bot', event, ...fields }), secretValues);
    if (lineLevel === 'error' || lineLevel === 'warn') process.stderr.write(`${line}\n`);
    else process.stdout.write(`${line}\n`);
  };
  return {
    error: (event, fields) => write('error', event, fields),
    warn: (event, fields) => write('warn', event, fields),
    info: (event, fields) => write('info', event, fields),
    debug: (event, fields) => write('debug', event, fields)
  };
}

module.exports = { loadConfig, createLogger, maskSecrets, REQUIRED };
