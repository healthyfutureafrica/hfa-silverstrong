const express = require('express');
const { z } = require('zod');
const { sendOk, validate, createAuthenticator, requireRole, requireInternalToken } = require('@hfa/shared');

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').refine(value => !Number.isNaN(Date.parse(value)) && new Date(value) <= new Date(), 'Must be a real date, not in the future');
const phone = z.string().trim().regex(/^\+[1-9]\d{7,14}$/, 'Use international format, e.g. +237650000000');
const text = max => z.string().trim().min(1).max(max).regex(/^[^<>\x00-\x1f]*$/, 'Contains characters that are not allowed');
const icd10 = z.string().trim().toUpperCase().regex(/^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$/, 'Use an ICD-10 code, e.g. E11 or I10');
const uuidParam = name => validate(z.object({ [name]: z.string().uuid() }).passthrough(), 'params');

const createPatientSchema = z.object({
  firstName: text(80), lastName: text(80),
  dateOfBirth: isoDate.optional(),
  sex: z.enum(['female', 'male', 'intersex', 'unknown']).default('unknown'),
  phone: phone.optional(),
  nationalId: z.string().trim().regex(/^[A-Za-z0-9 -]{4,30}$/).optional(),
  address: text(300).optional(),
  regionCode: z.string().trim().regex(/^CM-[A-Z]{2}$/, 'Use a Cameroon region code, e.g. CM-LT'),
  districtCode: z.string().trim().regex(/^[A-Z0-9-]{2,20}$/),
  preferredLanguage: z.enum(['en', 'fr']).default('fr'),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
  emergencyContact: z.object({ name: text(120), phone, relationship: text(40).optional() }).strict().optional(),
  consents: z.array(z.object({
    type: z.enum(['terms_of_service', 'teleconsultation', 'session_recording', 'data_sharing_research', 'sms_notifications']),
    granted: z.boolean()
  }).strict()).min(1)
}).strict();

const allergySchema = z.object({
  category: z.enum(['drug', 'food', 'environmental', 'other']),
  allergenCode: z.string().trim().regex(/^[A-Za-z0-9.-]{1,40}$/).optional(),
  allergenName: text(120),
  severity: z.enum(['mild', 'moderate', 'severe', 'life_threatening']),
  reaction: text(500).optional(),
  verification: z.enum(['unconfirmed', 'confirmed', 'refuted']).default('unconfirmed')
}).strict();

const conditionSchema = z.object({
  icd10Code: icd10, name: text(160),
  status: z.enum(['active', 'remission', 'resolved']).default('active'),
  onsetDate: isoDate.optional(), notes: text(2000).optional()
}).strict();

const historySchema = z.object({
  entryType: z.enum(['past_illness', 'surgery', 'hospitalisation', 'immunisation', 'family_history', 'social_history', 'obstetric', 'medication_history']),
  codeSystem: z.enum(['ICD-10', 'SNOMED-CT', 'CVX', 'RxNorm', 'LOCAL']).optional(),
  code: z.string().trim().regex(/^[A-Za-z0-9.-]{1,40}$/).optional(),
  summary: text(2000), occurredOn: isoDate.optional()
}).strict().refine(value => Boolean(value.code) === Boolean(value.codeSystem), { message: 'code and codeSystem must be given together', path: ['code'] });

function createRoutes({ patientService, config }) {
  const router = express.Router();
  const authenticate = createAuthenticator({ publicKey: config.publicKey, issuer: config.issuer, audience: config.audience });

  router.post('/api/v1/patients', authenticate, requireRole('patient', 'chw', 'doctor'), validate(createPatientSchema), async (req, res) => {
    sendOk(res, await patientService.createPatient(req.user, req.valid.body, req.id), 'Patient profile created', 201);
  });

  router.get('/api/v1/patients/:patientId/profile', authenticate, uuidParam('patientId'),
    validate(z.object({ purpose: text(120).optional() }).strict(), 'query'), async (req, res) => {
      sendOk(res, await patientService.getProfile(req.user, req.valid.params.patientId, { purpose: req.valid.query.purpose, requestId: req.id }));
    });

  router.post('/api/v1/patients/:patientId/allergies', authenticate, uuidParam('patientId'), validate(allergySchema), async (req, res) => {
    sendOk(res, await patientService.addAllergy(req.user, req.valid.params.patientId, req.valid.body, req.id), 'Allergy recorded', 201);
  });

  router.post('/api/v1/patients/:patientId/conditions', authenticate, uuidParam('patientId'), validate(conditionSchema), async (req, res) => {
    sendOk(res, await patientService.addCondition(req.user, req.valid.params.patientId, req.valid.body, req.id), 'Chronic condition recorded', 201);
  });

  router.post('/api/v1/patients/:patientId/history', authenticate, uuidParam('patientId'), validate(historySchema), async (req, res) => {
    sendOk(res, await patientService.addHistoryEntry(req.user, req.valid.params.patientId, req.valid.body, req.id), 'History entry recorded', 201);
  });

  router.post('/api/v1/providers', authenticate, requireRole('admin'), validate(z.object({
    userId: z.string().uuid(), role: z.enum(['doctor', 'pharmacist', 'lab', 'chw']), fullName: text(160),
    licensingBody: z.string().trim().regex(/^[A-Za-z]{2,20}$/, 'Use the licensing body acronym, e.g. ONMC'),
    licenceNumber: z.string().trim().regex(/^[A-Za-z0-9/ -]{3,40}$/),
    specialty: text(80).optional(), facility: text(120).optional()
  }).strict()), async (req, res) => {
    sendOk(res, await patientService.verifyProvider(req.user, req.valid.body), 'Provider verified', 201);
  });

  router.patch('/api/v1/providers/:providerId/status', authenticate, requireRole('admin'), uuidParam('providerId'),
    validate(z.object({ status: z.enum(['verified', 'suspended', 'revoked']) }).strict()), async (req, res) => {
      sendOk(res, await patientService.setProviderStatus(req.user, req.valid.params.providerId, req.valid.body.status), 'Provider status updated');
    });

  // ---- Internal routes ----
  const internal = requireInternalToken(config.internalToken);
  router.get('/internal/v1/providers/:providerId/credential', internal, uuidParam('providerId'), async (req, res) => {
    sendOk(res, await patientService.getCredential(req.valid.params.providerId));
  });
  router.get('/internal/v1/patients/:patientId/safety-profile', internal, uuidParam('patientId'), async (req, res) => {
    sendOk(res, await patientService.getSafetyProfile(req.valid.params.patientId));
  });
  router.put('/internal/v1/patients/:patientId/consultations/:consultationId', internal, uuidParam('patientId'), uuidParam('consultationId'), validate(z.object({
    doctorId: z.string().uuid().optional(), chwId: z.string().uuid().optional(),
    mode: z.enum(['video', 'voice', 'chat', 'field']),
    status: z.enum(['scheduled', 'awaiting_payment', 'in_progress', 'completed', 'cancelled', 'no_show']),
    scheduledAt: z.string().datetime().optional(), completedAt: z.string().datetime().optional(),
    primaryIcd10: icd10.optional(), summary: text(2000).optional()
  }).strict()), async (req, res) => {
    await patientService.upsertConsultation(req.valid.params.patientId, req.valid.params.consultationId, req.valid.body);
    sendOk(res, null, 'Consultation history updated');
  });
  router.put('/internal/v1/patients/:patientId/prescriptions/:prescriptionId', internal, uuidParam('patientId'), uuidParam('prescriptionId'), validate(z.object({
    doctorId: z.string().uuid(), status: z.enum(['issued', 'dispensed', 'revoked', 'expired']),
    issuedAt: z.string().datetime(), expiresAt: z.string().datetime(), dispensedAt: z.string().datetime().optional(),
    medications: z.array(text(160)).min(1).max(20)
  }).strict()), async (req, res) => {
    await patientService.upsertPrescription(req.valid.params.patientId, req.valid.params.prescriptionId, req.valid.body);
    sendOk(res, null, 'Prescription history updated');
  });

  return router;
}

module.exports = { createRoutes };
