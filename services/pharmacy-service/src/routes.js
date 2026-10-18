const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const { sendOk, validate, createAuthenticator, requireRole } = require('@hfa/shared');

const text = max => z.string().trim().min(1).max(max).regex(/^[^<>\x00-\x1f]*$/, 'Contains characters that are not allowed');

const itemSchema = z.object({
  drugName: text(120),                         // generic name, e.g. Amoxicillin
  strength: text(40),                          // e.g. 500 mg
  form: z.enum(['tablet', 'capsule', 'syrup', 'suspension', 'injection', 'cream', 'ointment', 'drops', 'inhaler', 'sachet', 'other']),
  dose: text(60),                              // e.g. 1 capsule
  frequency: text(60),                         // e.g. every 8 hours
  durationDays: z.number().int().min(1).max(365),
  quantity: z.number().int().min(1).max(1000),
  instructions: text(300).optional()
}).strict();

// Exactly one of `code` (typed 16-character code) or `token` (scanned QR) must be given.
const credentialInput = z.object({
  code: z.string().trim().max(30).optional(),
  token: z.string().trim().max(2000).optional()
}).strict().refine(value => Boolean(value.code) !== Boolean(value.token), { message: 'Provide either code or token', path: ['code'] });

function createRoutes({ prescriptionService, config }) {
  const router = express.Router();
  const authenticate = createAuthenticator({ publicKey: config.publicKey, issuer: config.issuer, audience: config.audience });
  const uuidParam = validate(z.object({ id: z.string().uuid() }), 'params');

  // Per-pharmacist request limit on verification (the database-backed failure lockout in the
  // service applies across all instances).
  const verifyLimiter = rateLimit({
    windowMs: 60 * 1000, limit: config.verifyRateLimit, keyGenerator: req => req.user.id, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ success: false, data: null, message: 'Too many verification requests; please slow down', timestamp: new Date().toISOString() })
  });

  router.post('/api/v1/prescriptions', authenticate, requireRole('doctor'), validate(z.object({
    patientId: z.string().uuid(),
    consultationId: z.string().uuid().optional(),
    items: z.array(itemSchema).min(1).max(20),
    validDays: z.number().int().min(1).max(90).default(30),
    acknowledgeAllergyWarnings: z.boolean().default(false)
  }).strict()), async (req, res) => {
    sendOk(res, await prescriptionService.issue(req.user, req.valid.body), 'Prescription issued', 201);
  });

  router.post('/api/v1/prescriptions/verify', authenticate, requireRole('pharmacist'), verifyLimiter, validate(credentialInput), async (req, res) => {
    const result = await prescriptionService.verify(req.user, req.valid.body);
    sendOk(res, result, result.valid ? 'Prescription is valid' : 'Prescription is not valid');
  });

  router.post('/api/v1/prescriptions/:id/dispense', authenticate, requireRole('pharmacist'), verifyLimiter, uuidParam, validate(z.object({
    code: z.string().trim().max(30).optional(),
    token: z.string().trim().max(2000).optional(),
    pharmacyId: z.string().trim().regex(/^[A-Za-z0-9-]{2,40}$/).optional()
  }).strict().refine(value => Boolean(value.code) !== Boolean(value.token), { message: 'Provide either code or token', path: ['code'] })), async (req, res) => {
    sendOk(res, await prescriptionService.dispense(req.user, req.valid.params.id, req.valid.body), 'Prescription dispensed');
  });

  router.post('/api/v1/prescriptions/:id/revoke', authenticate, requireRole('doctor', 'admin'), uuidParam, validate(z.object({ reason: text(200) }).strict()), async (req, res) => {
    sendOk(res, await prescriptionService.revoke(req.user, req.valid.params.id, req.valid.body.reason), 'Prescription revoked');
  });

  router.get('/api/v1/prescriptions/:id', authenticate, requireRole('doctor', 'admin'), uuidParam, async (req, res) => {
    sendOk(res, await prescriptionService.get(req.user, req.valid.params.id));
  });

  router.get('/api/v1/prescriptions/:id/audit', authenticate, requireRole('admin'), uuidParam, async (req, res) => {
    sendOk(res, await prescriptionService.auditTrail(req.user, req.valid.params.id));
  });

  return router;
}

module.exports = { createRoutes };
