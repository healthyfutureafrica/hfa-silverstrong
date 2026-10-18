const { randomUUID } = require('node:crypto');
const { UniqueConstraintError } = require('sequelize');
const { encryptString, hmacHex, badRequest, forbidden, notFound, conflict } = require('@hfa/shared');
const { ProviderError } = require('./mtnClient');

// Poll after 5s, 10s, 20s, 30s, then every 60s until the payment completes or expires.
const POLL_BACKOFF_SECONDS = [5, 10, 20, 30, 60];
const MAX_NOT_FOUND = 4; // MTN never received the request (e.g. it timed out before arriving)

// Normalises Cameroon numbers to 2376XXXXXXXX and checks MTN prefixes (67x, 68x, 650-654).
function normaliseMsisdn(input, { sandbox }) {
  let digits = String(input).replace(/\D/g, '');
  if (digits.length === 9 && digits.startsWith('6')) digits = `237${digits}`;
  if (sandbox) return /^\d{8,15}$/.test(digits) ? digits : null; // MTN sandbox test numbers
  return /^237(67\d{7}|68\d{7}|65[0-4]\d{6})$/.test(digits) ? digits : null;
}

function createPaymentService({ sequelize, models, config, mtn, consultationClient, logger }) {
  const { Payment, OutboxEvent, Callback } = models;
  const sandbox = config.mtn.targetEnvironment === 'sandbox';

  const summary = payment => ({
    id: payment.id, consultationId: payment.consultationId, provider: payment.provider, amount: Number(payment.amount), currency: payment.currency,
    status: payment.status, failureReason: payment.failureReason, financialTransactionId: payment.financialTransactionId,
    createdAt: payment.createdAt, completedAt: payment.completedAt, expiresAt: payment.expiresAt
  });

  const nextPollAt = attempts => new Date(Date.now() + POLL_BACKOFF_SECONDS[Math.min(attempts, POLL_BACKOFF_SECONDS.length - 1)] * 1000);

  async function initiate(actor, { consultationId, msisdn, idempotencyKey }) {
    if (actor.role !== 'patient') throw forbidden('Only patients can pay for consultations');
    const replay = await Payment.findOne({ where: { payerUserId: actor.id, idempotencyKey } });
    if (replay) {
      if (replay.consultationId !== consultationId) throw conflict('This Idempotency-Key was already used for a different payment');
      return { payment: summary(replay), replayed: true };
    }
    const phone = normaliseMsisdn(msisdn, { sandbox });
    if (!phone) throw badRequest('Enter a valid MTN Mobile Money number, e.g. 6 7X XX XX XX');

    // Never trust the client for the amount: the Consultation Service is the source of truth.
    const consultation = await consultationClient.getConsultation(consultationId);
    if (consultation.patientUserId !== actor.id) throw forbidden('This consultation does not belong to you');
    if (consultation.status !== 'awaiting_payment') throw conflict('This consultation is not awaiting payment');
    if (!Number.isInteger(consultation.feeXaf) || consultation.feeXaf <= 0) throw conflict('This consultation has no payable fee');

    const id = randomUUID();
    const payment = await Payment.create({
      id, consultationId, payerUserId: actor.id, provider: 'mtn_momo', amount: consultation.feeXaf, currency: config.mtn.currency,
      msisdnEnc: encryptString(config.dataKey, phone, `payments.msisdn:${id}`), msisdnHash: hmacHex(config.blindIndexKey, phone),
      providerReference: randomUUID(), idempotencyKey, status: 'pending',
      nextPollAt: nextPollAt(0), expiresAt: new Date(Date.now() + config.paymentTimeoutSeconds * 1000)
    }).catch(error => {
      if (error instanceof UniqueConstraintError) throw conflict('A payment for this consultation is already in progress or completed');
      throw error;
    });

    try {
      await mtn.requestToPay({
        referenceId: payment.providerReference, amount: consultation.feeXaf, currency: config.mtn.currency, externalId: payment.id,
        msisdn: phone, payerMessage: 'HFA consultation', payeeNote: `Consultation ${consultationId.slice(0, 8)}`
      });
    } catch (error) {
      if (error instanceof ProviderError && !error.retriable) {
        await finalise(payment.id, 'failed', { failureReason: `provider_rejected_${error.status}` });
        return { payment: summary(await Payment.findByPk(payment.id)), replayed: false };
      }
      // Unknown outcome (timeout / 5xx): keep it pending; polling will learn whether MTN has it.
      logger.warn('mtn_request_uncertain', { paymentId: payment.id, message: error.message });
    }
    logger.info('payment_initiated', { paymentId: payment.id, consultationId });
    return { payment: summary(payment), replayed: false };
  }

  // Moves a payment from pending to a final status exactly once. On success the outbox event for
  // the Consultation Service is written in the same transaction.
  async function finalise(paymentId, status, fields = {}) {
    return sequelize.transaction(async transaction => {
      const payment = await Payment.findByPk(paymentId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!payment || payment.status !== 'pending') return payment;
      await payment.update({ status, completedAt: new Date(), nextPollAt: null, ...fields }, { transaction });
      if (status === 'successful') {
        await OutboxEvent.create({
          paymentId, eventType: 'consultation.payment_succeeded',
          payload: { consultationId: payment.consultationId, paymentId, amount: Number(payment.amount), currency: payment.currency, provider: payment.provider, financialTransactionId: payment.financialTransactionId, paidAt: payment.completedAt.toISOString() }
        }, { transaction });
      }
      logger.info('payment_finalised', { paymentId, status, reason: fields.failureReason || null });
      return payment;
    });
  }

  // Asks MTN for the authoritative status and applies it.
  async function refresh(payment) {
    let result;
    try {
      result = await mtn.getStatus(payment.providerReference);
    } catch (error) {
      await payment.update({ lastCheckedAt: new Date(), nextPollAt: nextPollAt(payment.pollAttempts) });
      return payment;
    }
    if (result.status === 'SUCCESSFUL') {
      // Cross-check what MTN collected against what we asked for.
      if (Number(result.amount) !== Number(payment.amount) || result.currency !== payment.currency) {
        logger.error('payment_amount_mismatch', { paymentId: payment.id });
        return finalise(payment.id, 'failed', { providerStatus: result.status, failureReason: 'amount_mismatch' });
      }
      return finalise(payment.id, 'successful', { providerStatus: result.status, financialTransactionId: result.financialTransactionId });
    }
    if (result.status === 'FAILED' || result.status === 'REJECTED' || result.status === 'TIMEOUT') {
      return finalise(payment.id, 'failed', { providerStatus: result.status, failureReason: (result.reason || result.status).toString().slice(0, 120) });
    }
    if (result.status === 'NOT_FOUND' && payment.notFoundCount + 1 >= MAX_NOT_FOUND) {
      return finalise(payment.id, 'failed', { providerStatus: 'NOT_FOUND', failureReason: 'not_received_by_provider' });
    }
    if (new Date() >= payment.expiresAt) return finalise(payment.id, 'expired', { providerStatus: result.status, failureReason: 'payer_did_not_approve_in_time' });
    await payment.update({
      providerStatus: result.status, lastCheckedAt: new Date(), nextPollAt: nextPollAt(payment.pollAttempts),
      notFoundCount: result.status === 'NOT_FOUND' ? payment.notFoundCount + 1 : payment.notFoundCount
    });
    return payment;
  }

  // Background job: claims due payments with SKIP LOCKED (safe with several workers), leasing
  // them for 60 seconds so no other worker checks the same payment meanwhile.
  async function pollDue(limit = 20) {
    const [rows] = await sequelize.query(`
      UPDATE payments SET next_poll_at = now() + interval '60 seconds', poll_attempts = poll_attempts + 1
      WHERE id IN (SELECT id FROM payments WHERE status = 'pending' AND next_poll_at <= now() ORDER BY next_poll_at LIMIT :limit FOR UPDATE SKIP LOCKED)
      RETURNING id`, { replacements: { limit } });
    for (const { id } of rows) {
      const payment = await Payment.findByPk(id);
      if (payment && payment.status === 'pending') await refresh(payment);
    }
    return rows.length;
  }

  // MTN callbacks are not signed, so their content is never trusted: a callback only triggers an
  // immediate status check against MTN's API.
  async function handleCallback(body) {
    const paymentId = typeof body?.externalId === 'string' && /^[0-9a-f-]{36}$/i.test(body.externalId) ? body.externalId : null;
    await Callback.create({ provider: 'mtn_momo', paymentId, claimedStatus: typeof body?.status === 'string' ? body.status.slice(0, 30) : null });
    if (!paymentId) return;
    const payment = await Payment.findByPk(paymentId);
    if (payment && payment.status === 'pending') await refresh(payment);
  }

  async function getPayment(actor, paymentId) {
    let payment = await Payment.findByPk(paymentId);
    if (!payment) throw notFound('Payment not found');
    if (!(actor.role === 'admin' || payment.payerUserId === actor.id)) throw forbidden();
    // A patient waiting on the payment screen gets a fresh answer, at most every 5 seconds.
    if (payment.status === 'pending' && (!payment.lastCheckedAt || Date.now() - payment.lastCheckedAt.getTime() > 5000)) {
      payment = (await refresh(payment)) || payment;
      payment = await Payment.findByPk(paymentId);
    }
    return summary(payment);
  }

  // Delivers outbox events to the Consultation Service; failed deliveries retry with backoff.
  async function dispatchOutbox(limit = 20) {
    const due = await sequelize.transaction(async transaction => {
      const [rows] = await sequelize.query(`
        UPDATE payment_outbox SET next_attempt_at = now() + interval '60 seconds', attempts = attempts + 1
        WHERE id IN (SELECT id FROM payment_outbox WHERE delivered_at IS NULL AND next_attempt_at <= now() ORDER BY id LIMIT :limit FOR UPDATE SKIP LOCKED)
        RETURNING id, payload, attempts`, { replacements: { limit }, transaction });
      return rows;
    });
    for (const event of due) {
      try {
        await consultationClient.markPaid(event.payload.consultationId, event.payload);
        await OutboxEvent.update({ deliveredAt: new Date(), lastError: null }, { where: { id: event.id } });
      } catch (error) {
        const delay = Math.min(3600, 10 * 2 ** Math.min(event.attempts, 8));
        await OutboxEvent.update({ lastError: String(error.message).slice(0, 200), nextAttemptAt: new Date(Date.now() + delay * 1000) }, { where: { id: event.id } });
        logger.warn('outbox_delivery_failed', { outboxId: event.id, attempts: event.attempts });
      }
    }
    return due.length;
  }

  return { initiate, getPayment, handleCallback, pollDue, dispatchOutbox, refresh, finalise, normaliseMsisdn: input => normaliseMsisdn(input, { sandbox }) };
}

module.exports = { createPaymentService, normaliseMsisdn };
