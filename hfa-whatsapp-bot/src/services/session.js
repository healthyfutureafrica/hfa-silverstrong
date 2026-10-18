/**
 * Conversation sessions in Redis (ElastiCache in AWS).
 *
 * Each WhatsApp user has one session stored as JSON under `hfa:wa:session:{phone}`. Every write
 * resets the 30-minute expiry, so a session lives as long as the user keeps chatting. When it
 * expires, the next message starts a new session (returning user greeting + main menu).
 */
const Redis = require('ioredis');

const KEY_PREFIX = 'hfa:wa:session:';

let client = null;

/**
 * Builds the Redis key for a user's session.
 *
 * @param {string} phone - WhatsApp phone number in international format without "+", e.g. 237670000000.
 * @returns {string} The Redis key.
 */
function sessionKey(phone) {
  if (!/^\d{8,15}$/.test(String(phone))) throw new Error('Invalid WhatsApp phone number for session key');
  return `${KEY_PREFIX}${phone}`;
}

/**
 * Connects to Redis. Call once at startup; later calls return the same client.
 *
 * @param {string} redisUrl - Redis connection URL (use rediss:// for ElastiCache with TLS).
 * @param {object} logger - Logger from config.
 * @param {object} [options] - Extra ioredis options (tests can inject a client instead).
 * @param {object} [options.client] - Pre-built Redis-compatible client (for tests).
 * @returns {Promise<object>} The connected Redis client.
 */
async function connect(redisUrl, logger, options = {}) {
  if (client) return client;
  client = options.client || new Redis(redisUrl, {
    lazyConnect: true,
    connectTimeout: 4000,
    commandTimeout: 2000, // never let a slow Redis call break the 5-second response budget
    maxRetriesPerRequest: 2,
    retryStrategy: attempt => Math.min(attempt * 500, 5000)
  });
  if (typeof client.on === 'function') {
    client.on('error', error => logger.error('redis_error', { message: error.message }));
    client.on('reconnecting', () => logger.warn('redis_reconnecting'));
  }
  if (typeof client.connect === 'function' && client.status === 'wait') await client.connect();
  logger.info('redis_connected');
  return client;
}

/**
 * Returns the connected client or throws if connect() was not called.
 *
 * @returns {object} Redis client.
 */
function requireClient() {
  if (!client) throw new Error('Redis is not connected; call session.connect() at startup');
  return client;
}

/**
 * Creates the initial state for a new conversation.
 *
 * @param {string} phone - WhatsApp phone number.
 * @returns {object} A fresh session object.
 */
function newSession(phone) {
  const now = new Date().toISOString();
  return {
    phone,
    current_step: 'start',
    collected_data: {},
    language: null,
    triage_result: null,
    started_at: now,
    updated_at: now
  };
}

/**
 * Reads a user's session.
 *
 * @param {string} phone - WhatsApp phone number.
 * @returns {Promise<object|null>} The session, or null if none exists (new or expired).
 */
async function getSession(phone) {
  const raw = await requireClient().get(sessionKey(phone));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    // Corrupted data: treat as no session so the user simply starts again.
    return null;
  }
}

/**
 * Saves a user's session and resets its 30-minute expiry.
 *
 * @param {string} phone - WhatsApp phone number.
 * @param {object} session - Session state to store.
 * @param {number} [ttlSeconds=1800] - Expiry in seconds.
 * @returns {Promise<object>} The stored session (with updated_at refreshed).
 */
async function setSession(phone, session, ttlSeconds = 1800) {
  const stored = { ...session, updated_at: new Date().toISOString() };
  await requireClient().set(sessionKey(phone), JSON.stringify(stored), 'EX', ttlSeconds);
  return stored;
}

/**
 * Deletes a user's session (e.g. when they type "restart").
 *
 * @param {string} phone - WhatsApp phone number.
 * @returns {Promise<void>}
 */
async function deleteSession(phone) {
  await requireClient().del(sessionKey(phone));
}

/**
 * Records a WhatsApp message id so it is handled only once. Meta retries webhooks it thinks
 * failed, so the same message can arrive more than once.
 *
 * @param {string} messageId - The WhatsApp message id (wamid...).
 * @returns {Promise<boolean>} True the first time this id is seen, false for duplicates.
 */
async function markMessageProcessed(messageId) {
  const result = await requireClient().set(`hfa:wa:msg:${messageId}`, '1', 'EX', 24 * 3600, 'NX');
  return result === 'OK';
}

/**
 * Remembers that a user has talked to the bot before, so an expired session gets the
 * "welcome back" greeting. Only a SHA-256 hash of the phone number is stored, for one year.
 *
 * @param {string} phone - WhatsApp phone number.
 * @returns {Promise<boolean>} True if the user had been seen before this call.
 */
async function markUserSeen(phone) {
  const hash = require('node:crypto').createHash('sha256').update(String(phone)).digest('hex');
  const previous = await requireClient().set(`hfa:wa:seen:${hash}`, '1', 'EX', 365 * 24 * 3600, 'GET');
  return previous !== null;
}

/**
 * Closes the Redis connection (graceful shutdown).
 *
 * @returns {Promise<void>}
 */
async function disconnect() {
  if (!client) return;
  const current = client;
  client = null;
  if (typeof current.quit === 'function') await current.quit();
}

module.exports = { connect, disconnect, getSession, setSession, deleteSession, newSession, markMessageProcessed, markUserSeen, sessionKey, KEY_PREFIX };
