// SLY Triage cases. A patient answers the WHO-based questions (and may describe the problem in their own
// words); the rules in hfa-triage.js suggest an urgency level; a nurse or doctor confirms or changes it.
// Case contents are health data: encrypted at rest, shown only to the patient and the clinicians who care
// for them (assigned, or working at the hospital the patient is registered under). Administrators see the
// queue's status, never the symptoms. Every view and decision is in the audit log the patient can read.
const { randomUUID } = require('node:crypto');
const { join } = require('node:path');
const { z } = require('zod');
const Triage = require(join(__dirname, '..', 'hfa-triage.js'));
const { filesConfigured } = require('./files');
const { seal, unseal, healthRecord } = require('./records');
const { readSymptoms, aiConfigured } = require('./triage-ai');

const envelope = (data, message = 'OK') => ({ success: true, data, message, timestamp: new Date().toISOString() });
const freeText = max => z.string().trim().max(max).regex(/^[^<>\u0000-\u0008\u000b\u000c\u000e-\u001f]*$/, 'Remove < and > characters');
const submission = z.object({
  requestId: z.string().uuid(),
  answers: z.object({
    ageGroup: z.enum(Triage.AGE_GROUPS), sex: z.enum(['male', 'female', 'undisclosed']).optional(), maternal: z.enum(Triage.MATERNAL).optional(),
    complaints: z.array(z.enum(Triage.COMPLAINTS)).max(Triage.COMPLAINTS.length).default([]),
    dangerSigns: z.array(z.enum(Triage.ALL_SIGNS)).max(Triage.ALL_SIGNS.length).default([]),
    duration: z.enum(Triage.DURATIONS).optional(), severity: z.enum(Triage.SEVERITIES).optional(),
    forSomeoneElse: z.boolean().optional()
  }).strict(),
  text: freeText(2000).default(''),
  aiConsent: z.boolean().default(false)
}).strict();
const review = z.object({ decision: z.enum(['confirm', 'change']), finalLevel: z.enum(Triage.LEVELS), note: freeText(1000).default('') }).strict();
const CLINICIAN_ALERT = 'HFA SilverStrong: An emergency triage needs your review now. Open the Triage queue.';
const PATIENT_ALERT = 'HFA SilverStrong: A clinician has reviewed your symptom check. Sign in securely to see their answer. This is an automated notification. Do not reply.';

function ensureTriageTable(store) {
  store.db.exec(`CREATE TABLE IF NOT EXISTS triage_cases (
    id TEXT PRIMARY KEY, patient_id TEXT NOT NULL REFERENCES users(id), request_key TEXT NOT NULL UNIQUE,
    level TEXT NOT NULL, final_level TEXT, status TEXT NOT NULL, ai_used INTEGER NOT NULL DEFAULT 0,
    nonce BLOB NOT NULL, encrypted BLOB NOT NULL, tag BLOB NOT NULL,
    created_at TEXT NOT NULL, reviewed_at TEXT, reviewer_id TEXT
  );
  CREATE INDEX IF NOT EXISTS triage_cases_patient ON triage_cases(patient_id, created_at);
  CREATE INDEX IF NOT EXISTS triage_cases_status ON triage_cases(status, created_at);`);
}

/** Clinicians who may see and review this patient's triage. */
function reviewers(store, patient) {
  const facilityId = store.db.prepare('SELECT facility_id FROM users WHERE id=?').get(patient.id)?.facility_id;
  const rows = store.db.prepare(`SELECT id FROM users WHERE status='active' AND role IN ('doctor','nurse') AND (id=? OR id=? OR (facility_id IS NOT NULL AND facility_id=?))`)
    .all(patient.assignedDoctor || '', patient.assignedNurse || '', facilityId || '');
  return rows.map(row => row.id);
}
const canReview = (store, actor, patient) => ['doctor', 'nurse'].includes(actor.role) && reviewers(store, patient).includes(actor.id);

/**
 * Runs the rules (and, with consent, the AI) and stores one encrypted case for the patient. Used by the app
 * and by WhatsApp. Idempotent on requestId. Returns { row, aiUsed, prior }.
 */
async function submitCase(config, store, patient, input, { ip = null, source = 'app' } = {}) {
  ensureTriageTable(store);
  const key = `${patient.id}:${input.requestId}`;
  const prior = store.db.prepare('SELECT * FROM triage_cases WHERE request_key=?').get(key);
  if (prior) return { row: prior, aiUsed: !!prior.ai_used, prior: true };
  const health = healthRecord(config, store, patient.id);
  const countryCode = patient.countryCode || health?.location?.countryCode || 'CM';
  const answers = { ...input.answers, conditions: health?.medical?.conditions || [] };
  // AI costs money per call: skip it when the answers alone already make this an emergency (it can only raise the level).
  const useAi = input.aiConsent && aiConfigured(config) && !!input.text && Triage.assess(answers, countryCode).level !== 'emergency';
  const ai = useAi ? await readSymptoms(config, { text: input.text, answers, user: patient }) : { error: input.aiConsent ? 'not_available' : 'not_used' };
  const result = Triage.assess(Triage.merge(answers, ai.findings), countryCode);
  const payload = {
    answers: result.answers, text: input.text || '', reasons: result.reasons, checkedNegative: result.checkedNegative, rulesVersion: result.rulesVersion,
    rulesSummary: Triage.clinicianSummary(result, { text: input.text, health }), rulesSummaryFr: Triage.clinicianSummary(result, { text: input.text, health, language: 'fr' }), aiConsent: !!input.aiConsent, source,
    ...(ai.findings ? { findings: { complaints: ai.findings.complaints, dangerSigns: ai.findings.dangerSigns, language: ai.findings.language }, aiSummary: ai.findings.clinicianSummary, aiModel: ai.model } : { aiError: ai.error })
  };
  const id = randomUUID(), now = new Date().toISOString(), sealed = seal(config, `triage-case:${id}`, Buffer.from(JSON.stringify(payload)));
  store.db.exec('BEGIN IMMEDIATE');
  try {
    store.db.prepare('INSERT INTO triage_cases (id,patient_id,request_key,level,status,ai_used,nonce,encrypted,tag,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(id, patient.id, key, result.level, 'awaiting_review', ai.findings ? 1 : 0, sealed.nonce, sealed.encrypted, sealed.tag, now);
    if (input.aiConsent) store.db.prepare('INSERT INTO consent_events VALUES (?,?,?,?,?,?,?)').run(randomUUID(), patient.id, 'ai_triage', 1, Triage.RULES_VERSION, 'triage', now);
    store.audit(patient.id, 'TRIAGE_SUBMITTED', { targetId: patient.id, details: { caseId: id, level: result.level, ai: !!ai.findings, source }, ip });
    // Emergencies alert the patient's clinicians at once (in the app; the patient is told to call for help).
    if (result.level === 'emergency') for (const clinicianId of reviewers(store, patient))
      store.db.prepare('INSERT INTO notifications VALUES (?,?,?,?,?)').run(randomUUID(), clinicianId, CLINICIAN_ALERT, 'Urgent Care', now);
    store.db.exec('COMMIT');
  } catch (error) { store.db.exec('ROLLBACK'); throw error; }
  return { row: store.db.prepare('SELECT * FROM triage_cases WHERE id=?').get(id), aiUsed: !!ai.findings, prior: false, result };
}

function installTriageRoutes(app, config, store, authenticated) {
  ensureTriageTable(store);
  const context = id => `triage-case:${id}`;
  const open = row => JSON.parse(unseal(config, context(row.id), row).toString());
  const storage = (request, response, next) => filesConfigured(config) ? next() : response.status(503).json({ error: 'Encrypted health record storage is not configured' });

  const patientView = row => {
    const payload = open(row);
    return {
      id: row.id, level: row.level, finalLevel: row.final_level, status: row.status, createdAt: row.created_at, reviewedAt: row.reviewed_at,
      reasons: payload.reasons, answers: payload.answers, aiUsed: !!row.ai_used, rulesVersion: payload.rulesVersion,
      reviewerName: row.reviewer_id ? store.user(row.reviewer_id)?.name || null : null, note: payload.review?.note || ''
    };
  };
  const clinicianView = row => {
    const payload = open(row), patient = store.user(row.patient_id);
    return {
      ...patientView(row), patientId: row.patient_id, patientName: patient?.name, hfaId: patient?.hfaId, text: payload.text,
      rulesSummary: payload.rulesSummary, rulesSummaryFr: payload.rulesSummaryFr || null, aiSummary: payload.aiSummary || null, aiModel: payload.aiModel || null,
      checkedNegative: payload.checkedNegative, findings: payload.findings || null
    };
  };

  app.post('/api/v1/triage', authenticated, storage, async (request, response) => {
    if (request.user.role !== 'patient' || request.impersonator) return response.status(403).json({ error: 'Only the patient can submit a symptom check' });
    const saved = await submitCase(config, store, request.user, submission.parse(request.body), { ip: request.ip, source: 'app' });
    if (saved.prior) return response.json(envelope({ case: patientView(saved.row) }, 'Already received'));
    response.status(201).json(envelope({ case: patientView(saved.row), aiUsed: saved.aiUsed }, 'Received'));
  });

  app.get('/api/v1/triage/mine', authenticated, storage, (request, response) => {
    if (request.user.role !== 'patient' || request.impersonator) return response.status(403).json({ error: 'Only the patient can see their symptom checks' });
    response.json(envelope({ cases: store.db.prepare('SELECT * FROM triage_cases WHERE patient_id=? ORDER BY created_at DESC LIMIT 50').all(request.user.id).map(patientView) }));
  });

  app.get('/api/v1/triage/queue', authenticated, storage, (request, response) => {
    const rows = store.db.prepare("SELECT * FROM triage_cases WHERE status='awaiting_review' OR created_at>? ORDER BY created_at DESC LIMIT 500")
      .all(new Date(Date.now() - 7 * 86400000).toISOString());
    const sort = list => list.sort((a, b) => (a.status === 'awaiting_review' ? 0 : 1) - (b.status === 'awaiting_review' ? 0 : 1) || Triage.rank(b.level) - Triage.rank(a.level) || a.createdAt.localeCompare(b.createdAt));
    if (request.user.role === 'admin') {
      // Oversight only: no symptoms, answers or summaries.
      return response.json(envelope({ cases: sort(rows.map(row => {
        const patient = store.user(row.patient_id);
        return { id: row.id, level: row.level, finalLevel: row.final_level, status: row.status, createdAt: row.created_at, reviewedAt: row.reviewed_at, patientName: patient?.name, hfaId: patient?.hfaId, hasClinician: patient ? reviewers(store, patient).length > 0 : false };
      })), oversightOnly: true }));
    }
    if (!['doctor', 'nurse'].includes(request.user.role)) return response.status(403).json({ error: 'Clinicians only' });
    const mine = rows.filter(row => { const patient = store.user(row.patient_id); return patient && canReview(store, request.user, patient); });
    for (const row of mine) {
      const seen = store.db.prepare("SELECT 1 FROM audit_log WHERE actor_id=? AND action='TRIAGE_VIEWED' AND json_extract(details,'$.caseId')=? LIMIT 1").get(request.user.id, row.id);
      if (!seen) store.audit(request.user.id, 'TRIAGE_VIEWED', { targetId: row.patient_id, details: { caseId: row.id }, ip: request.ip });
    }
    response.json(envelope({ cases: sort(mine.map(clinicianView)) }));
  });

  app.post('/api/v1/triage/:id/review', authenticated, storage, (request, response) => {
    if (request.impersonator) return response.status(403).json({ error: 'Clinical decisions must be made from your own account' });
    const input = review.parse(request.body);
    const row = store.db.prepare('SELECT * FROM triage_cases WHERE id=?').get(request.params.id);
    const patient = row && store.user(row.patient_id);
    if (!row || !patient || !canReview(store, request.user, patient)) return response.sendStatus(404);
    if (row.status !== 'awaiting_review') return response.status(409).json({ error: 'This case has already been reviewed' });
    if (input.decision === 'confirm' && input.finalLevel !== row.level) return response.status(400).json({ error: 'finalLevel: Confirming keeps the suggested level' });
    if (input.decision === 'change' && input.finalLevel === row.level) return response.status(400).json({ error: 'finalLevel: Choose a different level, or confirm' });
    if (Triage.rank(input.finalLevel) < Triage.rank(row.level) && input.note.length < 10) return response.status(400).json({ error: 'note: Explain why the level is lowered (at least 10 characters)' });
    const payload = open(row), now = new Date().toISOString();
    payload.review = { decision: input.decision, note: input.note, by: request.user.id, role: request.user.role, at: now };
    const sealed = seal(config, context(row.id), Buffer.from(JSON.stringify(payload)));
    store.db.prepare('UPDATE triage_cases SET status=?, final_level=?, reviewed_at=?, reviewer_id=?, nonce=?, encrypted=?, tag=? WHERE id=?')
      .run(input.decision === 'confirm' ? 'confirmed' : 'changed', input.finalLevel, now, request.user.id, sealed.nonce, sealed.encrypted, sealed.tag, row.id);
    store.audit(request.user.id, 'TRIAGE_REVIEWED', { targetId: patient.id, details: { caseId: row.id, from: row.level, to: input.finalLevel, decision: input.decision }, ip: request.ip });
    // Assigned clinicians notify through the usual channel (in-app + consented WhatsApp); hospital colleagues in the app.
    if (store.canNotify(request.user, patient)) store.activity(request.user, { eventId: randomUUID(), patientId: patient.id, resource: 'Urgent Care' }, config.ready, PATIENT_ALERT);
    else store.db.prepare('INSERT INTO notifications VALUES (?,?,?,?,?)').run(randomUUID(), patient.id, PATIENT_ALERT, 'Urgent Care', now);
    response.json(envelope({ case: clinicianView(store.db.prepare('SELECT * FROM triage_cases WHERE id=?').get(row.id)) }, 'Reviewed'));
  });
}

module.exports = { installTriageRoutes, ensureTriageTable, submitCase, reviewers, canReview };
