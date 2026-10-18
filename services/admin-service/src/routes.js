const express = require('express');
const { z } = require('zod');
const { sendOk, validate, createAuthenticator, requireInternalToken, sha256Hex, safeEqual, unauthorized, forbidden, sendError } = require('@hfa/shared');
const { GROUP_COLUMNS } = require('./reporting');

const queryDate = z.string().refine(value => !Number.isNaN(Date.parse(value)), 'Use an ISO date, e.g. 2026-10-01 or 2026-10-01T00:00:00Z');

const aggregatesQuery = z.object({
  window: z.enum(['hour', 'day', 'week']).default('day'),
  from: queryDate,
  to: queryDate,
  regionCode: z.string().regex(/^CM-[A-Z]{2}$/).optional(),
  districtCode: z.string().regex(/^[A-Z0-9-]{2,20}$/).optional(),
  icd10: z.string().toUpperCase().regex(/^[A-Z][0-9]{2}$/, 'Use a 3-character ICD-10 category, e.g. A09').optional(),
  groupBy: z.string().default('region,district,icd10')
    .transform(value => [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))])
    .refine(values => values.length > 0 && values.every(value => value in GROUP_COLUMNS), `groupBy may contain: ${Object.keys(GROUP_COLUMNS).join(', ')}`)
}).strict();

function createRoutes({ aggregator, reporting, sequelize, config }) {
  const router = express.Router();
  const authenticateJwt = createAuthenticator({ publicKey: config.publicKey, issuer: config.issuer, audience: config.audience });

  // Ministry and Regional Delegation systems use API keys ("Authorization: ApiKey <key>");
  // only SHA-256 hashes of the keys are configured. HFA admins use their normal access token.
  function ministryOrAdmin(req, res, next) {
    const header = req.headers.authorization || '';
    if (header.startsWith('ApiKey ')) {
      const presented = sha256Hex(header.slice(7).trim());
      const client = config.ministryClients.find(entry => safeEqual(entry.keyHash, presented));
      if (!client) return next(unauthorized('Invalid API key'));
      req.client = { type: 'ministry', id: client.id };
      return next();
    }
    return authenticateJwt(req, res, error => {
      if (error) return next(error);
      if (req.user.role !== 'admin') return next(forbidden());
      req.client = { type: 'admin', id: req.user.id };
      return next();
    });
  }

  async function auditMinistry(req, endpoint, query, rowCount) {
    if (req.client.type !== 'ministry') return;
    await sequelize.query('INSERT INTO ministry_access_log (client_id, endpoint, query, row_count) VALUES (:clientId, :endpoint, CAST(:query AS jsonb), :rowCount)', {
      replacements: { clientId: req.client.id, endpoint, query: JSON.stringify(query), rowCount }
    });
  }

  router.get('/api/v1/surveillance/aggregates', ministryOrAdmin, validate(aggregatesQuery, 'query'), async (req, res) => {
    const result = await reporting.aggregates(req.valid.query);
    await auditMinistry(req, 'aggregates', req.valid.query, result.rows.length);
    sendOk(res, result);
  });

  router.get('/api/v1/surveillance/summary', ministryOrAdmin, validate(z.object({ hours: z.coerce.number().int().min(1).max(168).default(24) }).strict(), 'query'), async (req, res) => {
    const result = await reporting.summary(req.valid.query.hours);
    await auditMinistry(req, 'summary', req.valid.query, result.rows.length);
    sendOk(res, result);
  });

  // Live dashboard: Server-Sent Events that only say "new data is available" (at most every
  // few seconds). Per-consultation details are never pushed, because in a small district a
  // single diagnosis with a timestamp could identify a patient; dashboards re-query the
  // suppressed aggregates instead.
  router.get('/api/v1/surveillance/stream', ministryOrAdmin, (req, res) => {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    res.write(`event: ready\ndata: ${JSON.stringify({ throttleSeconds: config.streamThrottleSeconds })}\n\n`);
    let pending = false;
    let timer = null;
    const onUpdate = () => {
      if (pending) return;
      pending = true;
      timer = setTimeout(() => { pending = false; res.write(`event: refresh\ndata: ${JSON.stringify({ updatedAt: new Date().toISOString() })}\n\n`); }, config.streamThrottleSeconds * 1000);
    };
    const keepAlive = setInterval(() => res.write(': keep-alive\n\n'), 25000);
    aggregator.updates.on('update', onUpdate);
    req.on('close', () => { clearTimeout(timer); clearInterval(keepAlive); aggregator.updates.off('update', onUpdate); });
  });

  // Internal HTTP ingestion (alternative to the Redis stream, e.g. for back-filling).
  router.post('/internal/v1/surveillance/events', requireInternalToken(config.internalToken), async (req, res) => {
    const result = await aggregator.processEvent(req.body);
    if (result.status === 'invalid') return sendError(res, 400, 'Event rejected', { issues: result.issues });
    return sendOk(res, result, result.status === 'duplicate' ? 'Event already processed' : 'Event counted', result.status === 'duplicate' ? 200 : 201);
  });

  return router;
}

module.exports = { createRoutes };
