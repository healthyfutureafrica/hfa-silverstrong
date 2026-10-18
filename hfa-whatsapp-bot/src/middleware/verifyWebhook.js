/**
 * Meta webhook signature verification.
 *
 * Meta signs every webhook POST with the app secret: the `X-Hub-Signature-256` header contains
 * `sha256=<HMAC-SHA256 of the raw request body>`. Checking it proves the request really came from
 * Meta and was not modified. The HMAC must be computed over the exact raw bytes received, which is
 * why server.js keeps `req.rawBody` when parsing JSON.
 */
const crypto = require('node:crypto');

/**
 * Checks whether a signature header matches the raw body.
 *
 * @param {Buffer} rawBody - Exact bytes of the request body.
 * @param {string|undefined} signatureHeader - Value of the X-Hub-Signature-256 header.
 * @param {string} appSecret - The Meta app secret.
 * @returns {boolean} True only when the signature is present and valid.
 */
function isValidSignature(rawBody, signatureHeader, appSecret) {
  if (!Buffer.isBuffer(rawBody) || typeof signatureHeader !== 'string' || !signatureHeader.startsWith('sha256=')) return false;
  const received = signatureHeader.slice('sha256='.length);
  if (!/^[0-9a-f]{64}$/i.test(received)) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  // timingSafeEqual prevents attackers from guessing the signature byte by byte.
  return crypto.timingSafeEqual(Buffer.from(received.toLowerCase(), 'hex'), Buffer.from(expected, 'hex'));
}

/**
 * Creates Express middleware that rejects webhook POSTs without a valid Meta signature.
 *
 * @param {object} options
 * @param {string} options.appSecret - The Meta app secret (WHATSAPP_APP_SECRET).
 * @param {object} options.logger - Logger from config.
 * @returns {import('express').RequestHandler} Middleware.
 */
function verifyWebhook({ appSecret, logger }) {
  return function verifyWebhookSignature(req, res, next) {
    if (!isValidSignature(req.rawBody, req.get('X-Hub-Signature-256'), appSecret)) {
      logger.warn('webhook_signature_rejected', { ip: req.ip });
      return res.sendStatus(401);
    }
    return next();
  };
}

module.exports = { verifyWebhook, isValidSignature };
