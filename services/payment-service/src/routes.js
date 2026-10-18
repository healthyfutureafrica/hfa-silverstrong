const express = require('express');
const { z } = require('zod');
const { sendOk, validate, createAuthenticator, requireRole, safeEqual, notFound } = require('@hfa/shared');

function createRoutes({ paymentService, config }) {
  const router = express.Router();
  const authenticate = createAuthenticator({ publicKey: config.publicKey, issuer: config.issuer, audience: config.audience });

  // Start an MTN MoMo payment. The Idempotency-Key header makes retries safe: on a flaky mobile
  // connection the app can resend the same request without risking a second charge.
  router.post('/api/v1/payments/mtn-momo', authenticate, requireRole('patient'),
    validate(z.object({ 'idempotency-key': z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, 'Send an Idempotency-Key header (8-64 letters, digits, - or _)') }).passthrough(), 'headers'),
    validate(z.object({ consultationId: z.string().uuid(), msisdn: z.string().trim().min(8).max(20) }).strict()),
    async (req, res) => {
      const { payment, replayed } = await paymentService.initiate(req.user, { ...req.valid.body, idempotencyKey: req.valid.headers['idempotency-key'] });
      const message = payment.status === 'pending' ? 'Approve the payment request on your phone to complete payment' : `Payment ${payment.status}`;
      sendOk(res, { payment, replayed }, message, replayed ? 200 : 202);
    });

  router.get('/api/v1/payments/:id', authenticate, requireRole('patient', 'admin'), validate(z.object({ id: z.string().uuid() }), 'params'), async (req, res) => {
    sendOk(res, { payment: await paymentService.getPayment(req.user, req.valid.params.id) });
  });

  // MTN callback (X-Callback-Url). The secret path segment keeps random traffic out; the status is
  // still re-checked with MTN before anything changes. Always answer quickly with 200.
  const callback = async (req, res) => {
    if (!safeEqual(req.params.secret, config.mtn.callbackSecret)) throw notFound('Route not found');
    await paymentService.handleCallback(req.body);
    sendOk(res, null, 'Callback received');
  };
  router.post('/api/v1/payments/webhooks/mtn/:secret', callback);
  router.put('/api/v1/payments/webhooks/mtn/:secret', callback);

  return router;
}

module.exports = { createRoutes };
