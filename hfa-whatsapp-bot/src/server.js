/**
 * HFA WhatsApp bot: Express entry point.
 *
 *   GET  /webhook  Meta verification handshake (hub.mode / hub.verify_token / hub.challenge)
 *   POST /webhook  Incoming WhatsApp events, signed with X-Hub-Signature-256
 *   GET  /health   Health check for the AWS Application Load Balancer
 *
 * Meta expects a 200 response quickly and retries otherwise, so POST /webhook acknowledges first
 * and then processes the messages. Every error is caught: the user gets a polite fallback message
 * and the error is logged (to stdout/stderr, collected by PM2 and the CloudWatch agent).
 */
const crypto = require('node:crypto');
const express = require('express');
const { loadConfig, createLogger } = require('./config');
const { verifyWebhook } = require('./middleware/verifyWebhook');
const sessionStore = require('./services/session');
const { createWhatsAppClient, parseIncoming } = require('./services/whatsapp');
const menu = require('./flows/menu');

/**
 * Compares two strings in constant time.
 *
 * @param {string} a - First value.
 * @param {string} b - Second value.
 * @returns {boolean} True when equal.
 */
function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/**
 * Handles one incoming WhatsApp message end to end: session, routing, replies.
 * Never throws; on failure the user receives the fallback message.
 *
 * @param {object} message - One item from parseIncoming().
 * @param {object} deps
 * @param {object} deps.config - Validated configuration.
 * @param {object} deps.logger - Logger.
 * @param {object} deps.store - Session store (services/session.js).
 * @param {object} deps.whatsapp - WhatsApp client (services/whatsapp.js).
 * @returns {Promise<void>}
 */
async function handleMessage(message, { config, logger, store, whatsapp }) {
  let language = 'en';
  try {
    if (!(await store.markMessageProcessed(message.messageId))) {
      logger.debug('duplicate_message_ignored', { messageId: message.messageId });
      return;
    }

    let session = await store.getSession(message.from);
    let replies;

    if (!session) {
      // New conversation (first contact, or the previous session expired after 30 minutes).
      const returning = await store.markUserSeen(message.from);
      session = store.newSession(message.from);
      session.language = menu.detectLanguage(message.text);
      session.current_step = 'menu';
      const isMenuChoice = /^\s*[1-7]\s*$/.test(message.text || '');
      if (isMenuChoice) {
        // The user already knows the menu (e.g. sends "6" for an emergency): act on it at once.
        ({ session, replies } = menu.handleMenuInput(session, message.text));
      } else {
        replies = [menu.getGreetingText(session.language, returning)];
      }
    } else {
      // Phase 1: every step is handled by the main menu. Later steps add the other flows here.
      ({ session, replies } = menu.handleMenuInput(session, message.text));
    }
    language = session.language || 'en';

    await store.setSession(message.from, session, config.session.ttlSeconds);
    for (const reply of replies) await whatsapp.sendTextMessage(message.from, reply);
    logger.info('message_handled', { messageId: message.messageId, step: session.current_step, language });
  } catch (error) {
    logger.error('message_handling_failed', { messageId: message.messageId, message: error.message });
    await whatsapp.sendTextMessage(message.from, menu.strings(language).errorFallback).catch(() => {});
  }
}

/**
 * Builds the Express application. Dependencies are passed in so tests can use fakes.
 *
 * @param {object} deps
 * @param {object} deps.config - Validated configuration.
 * @param {object} deps.logger - Logger.
 * @param {object} deps.store - Session store.
 * @param {object} deps.whatsapp - WhatsApp client.
 * @param {Function} [deps.isReady] - Returns true when dependencies (Redis) are usable.
 * @returns {import('express').Express} The configured app.
 */
function createApp({ config, logger, store, whatsapp, isReady = () => true }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind the AWS ALB

  // Keep the exact raw bytes: the signature is computed over them, not over re-serialised JSON.
  app.use(express.json({ limit: '1mb', verify: (req, res, buffer) => { req.rawBody = buffer; } }));

  app.get('/health', (req, res) => {
    const ready = isReady();
    res.status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'degraded', service: 'hfa-whatsapp-bot' });
  });

  // Meta calls this once when the webhook URL is saved in the app dashboard.
  app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && typeof token === 'string' && typeof challenge === 'string' && safeEqual(token, config.whatsapp.verifyToken)) {
      logger.info('webhook_verified');
      return res.status(200).type('text/plain').send(challenge);
    }
    logger.warn('webhook_verification_failed', { mode: typeof mode === 'string' ? mode : null });
    return res.sendStatus(403);
  });

  app.post('/webhook', verifyWebhook({ appSecret: config.whatsapp.appSecret, logger }), (req, res) => {
    const messages = parseIncoming(req);
    res.sendStatus(200); // acknowledge immediately so Meta does not retry
    for (const message of messages) {
      handleMessage(message, { config, logger, store, whatsapp }).catch(error => logger.error('unexpected_handler_error', { message: error.message }));
    }
  });

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  // Last-resort error handler (e.g. malformed JSON): log, never leak details.
  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    logger.error('request_failed', { path: req.path, message: error.message });
    res.status(error.type === 'entity.parse.failed' ? 400 : 500).json({ error: 'Request failed' });
  });
  return app;
}

/**
 * Starts the bot: validates configuration, connects to Redis, starts listening.
 *
 * @returns {Promise<import('http').Server>} The HTTP server.
 */
async function start() {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    process.stderr.write(`Configuration error: ${error.message}\n`);
    process.exit(1);
  }
  const logger = createLogger({ level: config.logLevel, secretValues: config.secretValues });
  const redis = await sessionStore.connect(config.redisUrl, logger);
  const whatsapp = createWhatsAppClient({ whatsapp: config.whatsapp, timeoutMs: config.externalCallTimeoutMs, logger });
  const app = createApp({ config, logger, store: sessionStore, whatsapp, isReady: () => redis.status === 'ready' });
  const server = app.listen(config.port, () => logger.info('server_started', { port: config.port, env: config.nodeEnv }));

  process.on('unhandledRejection', reason => logger.error('unhandled_rejection', { message: reason instanceof Error ? reason.message : String(reason) }));
  process.on('uncaughtException', error => {
    // The process may be in an unknown state: log it and let PM2 restart a clean process.
    logger.error('uncaught_exception', { message: error.message });
    process.exit(1);
  });
  const shutdown = signal => {
    logger.info('shutting_down', { signal });
    server.close(() => sessionStore.disconnect().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  return server;
}

if (require.main === module) {
  start().catch(error => {
    process.stderr.write(`Startup failed: ${error.message}\n`);
    process.exit(1);
  });
}

module.exports = { createApp, handleMessage, start };
