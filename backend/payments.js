// Real payments with MTN Mobile Money (Collections API), inside the main server.
//
// - The server decides every amount from its own records (doctor's fee, subscription price, nurse's home-visit fee,
//   rescheduling fee), never from the browser, and converts USD prices to XAF at the CEMAC display rate.
// - The patient approves the request on their phone; the result is taken only from MTN (status check, callback
//   re-checked), and the amount and currency MTN reports must match what was asked for.
// - Idempotency keys make retries on weak networks safe: the same key never charges twice.
// - A paid subscription becomes active only after MTN confirms the payment.
// - Without MTN credentials nothing is ever marked paid: GET /api/v1/payments/options says payments are unavailable.
const { randomUUID } = require('node:crypto');
const { z } = require('zod');
const { MtnMomoClient, ProviderError } = require('./mtn-momo');
const { seal } = require('./records');
const { filesConfigured } = require('./files');

const USD_TO_XAF = 600; // same fixed CEMAC rate as the prices shown in the app
const SUBSCRIPTION_USD = { basic: 2, premium: 10 };
const RESCHEDULE_USD = 5;
const DEFAULT_HOME_VISIT_USD = 10;
const TIMEOUT_MS = 10 * 60 * 1000; // the payer has 10 minutes to approve on their phone
const POLL_BACKOFF_SECONDS = [5, 10, 20, 30, 60];
const MAX_NOT_FOUND = 4;
const PURPOSES = ['consultation_fee', 'subscription', 'nurse_home_visit', 'appointment_reschedule'];

function mtnConfig(env = process.env) {
  const config = {
    baseUrl: env.MTN_BASE_URL || 'https://sandbox.momodeveloper.mtn.com', subscriptionKey: env.MTN_COLLECTION_SUBSCRIPTION_KEY || '',
    apiUser: env.MTN_API_USER || '', apiKey: env.MTN_API_KEY || '', targetEnvironment: env.MTN_TARGET_ENVIRONMENT || 'sandbox',
    currency: env.MTN_CURRENCY || (env.MTN_TARGET_ENVIRONMENT === 'mtncameroon' ? 'XAF' : 'EUR'), callbackSecret: env.MTN_CALLBACK_SECRET || ''
  };
  config.ready = !!(config.subscriptionKey && config.apiUser && config.apiKey);
  return config;
}

/** Cameroon MTN numbers as 2376XXXXXXXX (prefixes 67x, 68x, 650-654); the sandbox accepts its test numbers. */
function normaliseMsisdn(input, { sandbox }) {
  let digits = String(input || '').replace(/\D/g, '');
  if (digits.length === 9 && digits.startsWith('6')) digits = `237${digits}`;
  if (sandbox) return /^\d{8,15}$/.test(digits) ? digits : null;
  return /^237(67\d{7}|68\d{7}|65[0-4]\d{6})$/.test(digits) ? digits : null;
}

function ensurePaymentTable(store) {
  store.db.exec(`CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY, payer_id TEXT NOT NULL REFERENCES users(id), purpose TEXT NOT NULL, target_id TEXT, details TEXT NOT NULL DEFAULT '{}',
    amount INTEGER NOT NULL, currency TEXT NOT NULL, usd REAL NOT NULL, provider TEXT NOT NULL, provider_reference TEXT NOT NULL UNIQUE,
    idempotency_key TEXT NOT NULL, msisdn_nonce BLOB, msisdn_encrypted BLOB, msisdn_tag BLOB,
    status TEXT NOT NULL, provider_status TEXT, failure_reason TEXT, financial_transaction_id TEXT,
    created_at TEXT NOT NULL, completed_at TEXT, expires_at INTEGER NOT NULL, next_poll_at INTEGER, poll_attempts INTEGER NOT NULL DEFAULT 0, not_found_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(payer_id, idempotency_key)
  );
  CREATE INDEX IF NOT EXISTS payments_pending ON payments(status, next_poll_at);`);
}

class Payments {
  constructor(config, store, { mtn = mtnConfig(), client = null } = {}) {
    this.config = config; this.store = store; this.mtn = mtn;
    this.client = client || (mtn.ready ? new MtnMomoClient({ ...mtn, callbackUrl: mtn.callbackSecret && config.origin.startsWith('https://') ? `${config.origin}/api/v1/payments/webhooks/mtn/${mtn.callbackSecret}` : '' }) : null);
    ensurePaymentTable(store);
  }
  get available() { return !!this.client && filesConfigured(this.config); }
  get sandbox() { return this.mtn.targetEnvironment === 'sandbox'; }

  /** Price in USD decided by the server for this purpose. */
  priceUsd(payer, { purpose, targetId, tier }) {
    if (purpose === 'subscription') { if (!SUBSCRIPTION_USD[tier]) throw Object.assign(new Error('Choose a paid plan'), { status: 400 }); return SUBSCRIPTION_USD[tier]; }
    if (purpose === 'appointment_reschedule') return RESCHEDULE_USD;
    const target = targetId && this.store.user(targetId);
    if (purpose === 'consultation_fee') { if (target?.role !== 'doctor' || !(target.consultationFee > 0)) throw Object.assign(new Error('This doctor has no consultation fee'), { status: 400 }); return target.consultationFee; }
    if (purpose === 'nurse_home_visit') { if (target?.role !== 'nurse' || target.status !== 'active') throw Object.assign(new Error('Choose an active nurse'), { status: 400 }); return Number(target.homeVisitFee) > 0 ? Number(target.homeVisitFee) : DEFAULT_HOME_VISIT_USD; }
    throw Object.assign(new Error('Unknown payment'), { status: 400 });
  }

  summary(row) {
    return row && { id: row.id, purpose: row.purpose, targetId: row.target_id, amount: row.amount, currency: row.currency, usd: row.usd, provider: row.provider,
      status: row.status, failureReason: row.failure_reason, financialTransactionId: row.financial_transaction_id, createdAt: row.created_at, completedAt: row.completed_at, details: JSON.parse(row.details || '{}') };
  }
  row(id) { return this.store.db.prepare('SELECT * FROM payments WHERE id=?').get(id); }

  async initiate(payer, input) {
    const replay = this.store.db.prepare('SELECT * FROM payments WHERE payer_id=? AND idempotency_key=?').get(payer.id, input.idempotencyKey);
    if (replay) {
      if (replay.purpose !== input.purpose || (replay.target_id || null) !== (input.targetId || input.tier || null)) throw Object.assign(new Error('This payment key was already used for a different payment'), { status: 409 });
      return { payment: this.summary(replay), replayed: true };
    }
    const msisdn = normaliseMsisdn(input.msisdn, { sandbox: this.sandbox });
    if (!msisdn) throw Object.assign(new Error('Enter a valid MTN Mobile Money number, for example 6 7X XX XX XX'), { status: 400 });
    const usd = this.priceUsd(payer, input), amount = Math.round(usd * USD_TO_XAF), id = randomUUID(), reference = randomUUID(), now = Date.now();
    const sealed = seal(this.config, `payment-msisdn:${id}`, Buffer.from(msisdn));
    this.store.db.prepare(`INSERT INTO payments (id,payer_id,purpose,target_id,details,amount,currency,usd,provider,provider_reference,idempotency_key,msisdn_nonce,msisdn_encrypted,msisdn_tag,status,created_at,expires_at,next_poll_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, payer.id, input.purpose, input.targetId || input.tier || null, JSON.stringify(input.details || {}), amount, this.mtn.currency, usd, 'mtn_momo', reference,
      input.idempotencyKey, sealed.nonce, sealed.encrypted, sealed.tag, 'pending', new Date(now).toISOString(), now + TIMEOUT_MS, now + POLL_BACKOFF_SECONDS[0] * 1000);
    this.store.audit(payer.id, 'PAYMENT_REQUESTED', { targetId: payer.id, details: { paymentId: id, purpose: input.purpose, amount, currency: this.mtn.currency } });
    try {
      await this.client.requestToPay({ referenceId: reference, amount, currency: this.mtn.currency, externalId: id, msisdn, payerMessage: 'HFA SilverStrong', payeeNote: input.purpose.replace(/_/g, ' ') });
    } catch (error) {
      if (error instanceof ProviderError && !error.retriable) this.finalise(id, 'failed', { failureReason: `provider_rejected_${error.status}` });
      // Otherwise the outcome is unknown (timeout, 5xx): stay pending; status checks will learn the truth.
    }
    return { payment: this.summary(this.row(id)), replayed: false };
  }

  /** Moves a pending payment to its final status exactly once, and applies what it paid for. */
  finalise(id, status, fields = {}) {
    const row = this.row(id);
    if (!row || row.status !== 'pending') return row;
    this.store.db.exec('BEGIN IMMEDIATE');
    try {
      const changed = this.store.db.prepare("UPDATE payments SET status=?,provider_status=?,failure_reason=?,financial_transaction_id=?,completed_at=?,next_poll_at=NULL WHERE id=? AND status='pending'")
        .run(status, fields.providerStatus || null, fields.failureReason || null, fields.financialTransactionId || null, new Date().toISOString(), id).changes;
      if (changed && status === 'successful' && row.purpose === 'subscription') {
        const start = new Date(), renewal = new Date(start); renewal.setMonth(renewal.getMonth() + 1);
        this.store.updateUser(row.payer_id, { profile: { subscription: { tier: row.target_id, status: 'active', startDate: start.toISOString().slice(0, 10), renewalDate: renewal.toISOString().slice(0, 10),
          monthlyVisitsAllowed: row.target_id === 'premium' ? 1 : 0, amount: row.usd, currency: 'USD', paymentId: id, paymentStatus: 'completed' } } });
      }
      if (changed) this.store.audit(row.payer_id, status === 'successful' ? 'PAYMENT_SUCCEEDED' : 'PAYMENT_FAILED', { targetId: row.payer_id, details: { paymentId: id, purpose: row.purpose, reason: fields.failureReason || null } });
      this.store.db.exec('COMMIT');
    } catch (error) { this.store.db.exec('ROLLBACK'); throw error; }
    return this.row(id);
  }

  /** Asks MTN for the authoritative status of a pending payment. */
  async refresh(row) {
    if (row.status !== 'pending' || !this.client) return row;
    let result;
    try { result = await this.client.getStatus(row.provider_reference); }
    catch (error) { this.reschedule(row); return this.row(row.id); }
    if (result.status === 'SUCCESSFUL') {
      if (Number(result.amount) !== Number(row.amount) || result.currency !== row.currency) return this.finalise(row.id, 'failed', { providerStatus: result.status, failureReason: 'amount_mismatch' });
      return this.finalise(row.id, 'successful', { providerStatus: result.status, financialTransactionId: result.financialTransactionId });
    }
    if (['FAILED', 'REJECTED', 'TIMEOUT'].includes(result.status)) return this.finalise(row.id, 'failed', { providerStatus: result.status, failureReason: String(result.reason || result.status).slice(0, 120) });
    if (result.status === 'NOT_FOUND' && row.not_found_count + 1 >= MAX_NOT_FOUND) return this.finalise(row.id, 'failed', { providerStatus: 'NOT_FOUND', failureReason: 'not_received_by_provider' });
    if (Date.now() >= row.expires_at) return this.finalise(row.id, 'expired', { providerStatus: result.status, failureReason: 'payer_did_not_approve_in_time' });
    this.reschedule(row, result.status === 'NOT_FOUND');
    return this.row(row.id);
  }
  reschedule(row, notFound = false) {
    const wait = POLL_BACKOFF_SECONDS[Math.min(row.poll_attempts, POLL_BACKOFF_SECONDS.length - 1)] * 1000;
    this.store.db.prepare('UPDATE payments SET poll_attempts=poll_attempts+1,next_poll_at=?,not_found_count=not_found_count+? WHERE id=?').run(Date.now() + wait, notFound ? 1 : 0, row.id);
  }
  async pollDue() {
    for (const row of this.store.db.prepare("SELECT * FROM payments WHERE status='pending' AND next_poll_at<=? ORDER BY next_poll_at LIMIT 20").all(Date.now())) await this.refresh(row);
  }
  /** MTN callback: never trusted alone; it only triggers a status check. */
  async callback(body) {
    // MTN sends back our payment id as externalId.
    const row = typeof body?.externalId === 'string' ? this.row(body.externalId) : null;
    if (row) await this.refresh(row);
  }
}

/** Routes that must work without the app's request header (MTN calls them): installed before the CSRF guard. */
function installPaymentWebhook(app, payments) {
  const handler = async (request, response) => {
    if (!payments.mtn.callbackSecret || request.params.secret !== payments.mtn.callbackSecret) return response.sendStatus(404);
    try { await payments.callback(request.body); } catch (error) { /* status checks will retry */ }
    response.sendStatus(200);
  };
  const express = require('express');
  app.post('/api/v1/payments/webhooks/mtn/:secret', express.json({ limit: '32kb' }), handler);
  app.put('/api/v1/payments/webhooks/mtn/:secret', express.json({ limit: '32kb' }), handler);
}

function installPaymentRoutes(app, config, store, authenticated, payments) {
  const envelope = (data, message = 'OK') => ({ success: true, data, message, timestamp: new Date().toISOString() });
  const patientOnly = (request, response, next) => request.user.role !== 'patient' || request.impersonator ? response.status(403).json({ error: 'Only the patient can pay' }) : next();

  app.get('/api/v1/payments/options', authenticated, (request, response) => response.json(envelope({
    available: payments.available, provider: payments.available ? 'mtn_momo' : null, currency: payments.mtn.currency, sandbox: payments.sandbox,
    usdToXaf: USD_TO_XAF, prices: { subscription: SUBSCRIPTION_USD, appointmentReschedule: RESCHEDULE_USD }
  })));

  app.post('/api/v1/payments', authenticated, patientOnly, async (request, response) => {
    if (!payments.available) return response.status(503).json({ error: 'Online payment is not available yet. Pay at the health facility.', code: 'payments_unavailable' });
    const input = z.object({
      purpose: z.enum(PURPOSES), targetId: z.string().max(100).optional(), tier: z.enum(['basic', 'premium']).optional(), msisdn: z.string().max(30),
      idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/), details: z.record(z.string(), z.union([z.string().max(200), z.number()])).optional()
    }).strict().parse(request.body);
    try {
      const { payment, replayed } = await payments.initiate(request.user, input);
      response.status(replayed ? 200 : 202).json(envelope({ payment, replayed }, payment.status === 'pending' ? 'Approve the payment request on your phone' : `Payment ${payment.status}`));
    } catch (error) { if (error.status) return response.status(error.status).json({ error: error.message }); throw error; }
  });

  app.get('/api/v1/payments', authenticated, (request, response) =>
    response.json(envelope({ payments: store.db.prepare('SELECT * FROM payments WHERE payer_id=? ORDER BY created_at DESC LIMIT 100').all(request.user.id).map(row => payments.summary(row)) })));

  app.get('/api/v1/payments/:id', authenticated, async (request, response) => {
    let row = payments.row(request.params.id);
    if (!row || (row.payer_id !== request.user.id && request.user.role !== 'admin')) return response.sendStatus(404);
    if (row.status === 'pending') row = await payments.refresh(row);
    response.json(envelope({ payment: payments.summary(row) }));
  });

  // The free plan needs no payment.
  app.post('/api/v1/subscription/free', authenticated, patientOnly, (request, response) => {
    const start = new Date().toISOString().slice(0, 10);
    store.updateUser(request.user.id, { profile: { subscription: { tier: 'free', status: 'active', startDate: start, renewalDate: null, monthlyVisitsAllowed: 0, amount: 0, currency: null, paymentStatus: 'completed' } } });
    response.json(envelope({ user: store.user(request.user.id) }));
  });
}

module.exports = { Payments, installPaymentRoutes, installPaymentWebhook, normaliseMsisdn, mtnConfig, USD_TO_XAF, SUBSCRIPTION_USD, RESCHEDULE_USD };
