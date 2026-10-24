// Patient data rights (Cameroon Law No. 2024/017; aligned with GDPR Art. 15-21 and the HIPAA right of access):
// - consent choices a patient can change at any time, with a permanent history;
// - "who opened my record": every disclosure of the health profile to someone else is in the audit log;
// - data-rights requests (rectification, erasure, restriction, objection...) answered within 30 days;
// - the whole server-held record as an HL7 FHIR R4 bundle.
const { randomUUID } = require('node:crypto');
const { join } = require('node:path');
const { z } = require('zod');
const { filesConfigured, decodeFile, ensureFileTable } = require('./files');
const { healthRecord, saveHealthRecord } = require('./records');
const Fhir = require(join(__dirname, '..', 'hfa-fhir.js'));

const CONSENT_VERSION = '2026.1';
// Optional purposes. Sharing with the care team is required to hold an account; withdrawing it is an erasure request.
const CHANGEABLE_CONSENTS = ['research', 'ministry', 'sms'];
const REQUEST_KINDS = ['access', 'rectification', 'erasure', 'restriction', 'objection', 'portability'];
const RESPONSE_DAYS = 30;
// Audit actions a person sees in "who accessed my record" (never their own sign-ins or IP addresses).
const ACCESS_ACTIONS = ['HEALTH_RECORD_VIEW', 'DOCUMENT_VIEWED', 'ACCOUNT_UPDATED_BY_ADMIN', 'ACCOUNT_DELETED', 'SIGN_IN_AS_START', 'SIGN_IN_AS_STOP', 'PRIVACY_REQUEST_UPDATED', 'TRIAGE_VIEWED', 'TRIAGE_REVIEWED'];

const envelope = (data, message = 'OK') => ({ success: true, data, message, timestamp: new Date().toISOString() });
const details = z.string().trim().max(2000).regex(/^[^<>\u0000-\u0008\u000b\u000c\u000e-\u001f]*$/, 'Remove < and > characters');

function ensurePrivacyTables(store) {
  store.db.exec(`
    CREATE TABLE IF NOT EXISTS consent_events (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), purpose TEXT NOT NULL, granted INTEGER NOT NULL,
      version TEXT NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS consent_events_user ON consent_events(user_id, created_at);
    CREATE TABLE IF NOT EXISTS privacy_requests (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, details TEXT NOT NULL,
      status TEXT NOT NULL, created_at TEXT NOT NULL, due_at TEXT NOT NULL,
      resolved_at TEXT, resolved_by TEXT, resolution TEXT
    );
    CREATE INDEX IF NOT EXISTS privacy_requests_user ON privacy_requests(user_id, created_at);
    CREATE INDEX IF NOT EXISTS audit_log_target ON audit_log(target_id, created_at);
  `);
}

function consentHistory(store, userId) {
  return store.db.prepare('SELECT purpose, granted, version, source, created_at AS createdAt FROM consent_events WHERE user_id=? ORDER BY created_at DESC, rowid DESC').all(userId)
    .map(row => ({ ...row, granted: !!row.granted }));
}

function requestRow(row) {
  return row && {
    id: row.id, userId: row.user_id, kind: row.kind, details: row.details, status: row.status, createdAt: row.created_at, dueAt: row.due_at,
    resolvedAt: row.resolved_at, resolution: row.resolution, overdue: !['completed', 'refused'].includes(row.status) && row.due_at < new Date().toISOString(),
    ...(row.user_name !== undefined ? { userName: row.user_name, userRole: row.user_role, hfaId: row.hfa_number, resolvedByName: row.resolver_name } : {})
  };
}

function accessLog(store, userId) {
  return store.db.prepare(`SELECT a.id, a.action, a.created_at AS createdAt, a.details, actor.name AS actorName, actor.role AS actorRole
    FROM audit_log a LEFT JOIN users actor ON actor.id=a.actor_id
    WHERE a.target_id=? AND a.actor_id!=? AND a.action IN (${ACCESS_ACTIONS.map(() => '?').join(',')}) ORDER BY a.created_at DESC LIMIT 200`)
    .all(userId, userId, ...ACCESS_ACTIONS)
    .map(row => { const parsed = JSON.parse(row.details || '{}'); return { id: row.id, action: row.action, createdAt: row.createdAt, actorName: row.actorName || 'HFA', actorRole: row.actorRole || 'admin', ...(parsed.kind ? { kind: parsed.kind } : {}) }; });
}

function serverFiles(config, store, userId) {
  if (!filesConfigured(config)) return [];
  ensureFileTable(store);
  return store.db.prepare('SELECT * FROM uploaded_files WHERE owner_id=? ORDER BY created_at DESC').all(userId).map(row => {
    const { metadata } = decodeFile(config, row);
    return { id: row.upload_id, fileName: metadata.fileName, category: String(metadata.category || '').replace(/^registration:identity$/, 'Identity document'), notes: metadata.notes, mime: row.mime, size: row.size, createdAt: row.created_at, url: `/api/files/${encodeURIComponent(row.upload_id)}` };
  });
}

function installPrivacyRoutes(app, config, store, authenticated, admin) {
  ensurePrivacyTables(store);
  // Requests about one's own data must come from the person, never from an administrator signed in as them.
  const ownAccount = (request, response, next) => request.impersonator ? response.status(403).json({ error: 'Only the account holder can do this' }) : next();

  app.get('/api/v1/me/consents', authenticated, (request, response) => {
    const record = request.user.role === 'patient' ? healthRecord(config, store, request.user.id) : null;
    response.json(envelope({ consents: record?.consents || null, changeable: CHANGEABLE_CONSENTS, history: consentHistory(store, request.user.id), whatsapp: { consent: request.user.whatsappNotificationsConsent, at: request.user.whatsappConsentAt } }));
  });

  app.post('/api/v1/me/consents', authenticated, ownAccount, (request, response) => {
    if (request.user.role !== 'patient') return response.status(403).json({ error: 'Only patients have health-data consents' });
    if (!filesConfigured(config)) return response.status(503).json({ error: 'Encrypted health record storage is not configured' });
    const input = z.object({ purpose: z.enum(CHANGEABLE_CONSENTS), granted: z.boolean() }).strict().parse(request.body);
    const record = healthRecord(config, store, request.user.id);
    if (!record) return response.status(409).json({ error: 'Complete your health profile first' });
    const now = new Date().toISOString();
    store.db.exec('BEGIN IMMEDIATE');
    try {
      saveHealthRecord(config, store, request.user.id, { ...record, consents: { ...record.consents, [input.purpose]: input.granted, recordedAt: now, version: CONSENT_VERSION } });
      store.db.prepare('INSERT INTO consent_events VALUES (?,?,?,?,?,?,?)').run(randomUUID(), request.user.id, input.purpose, input.granted ? 1 : 0, CONSENT_VERSION, 'privacy_centre', now);
      store.audit(request.user.id, input.granted ? 'CONSENT_GIVEN' : 'CONSENT_WITHDRAWN', { targetId: request.user.id, details: { purpose: input.purpose }, ip: request.ip });
      store.db.exec('COMMIT');
    } catch (error) { store.db.exec('ROLLBACK'); throw error; }
    response.json(envelope({ consents: healthRecord(config, store, request.user.id).consents, history: consentHistory(store, request.user.id) }, input.granted ? 'Consent given' : 'Consent withdrawn'));
  });

  app.get('/api/v1/me/access-log', authenticated, ownAccount, (request, response) => response.json(envelope({ entries: accessLog(store, request.user.id) })));

  app.get('/api/v1/me/fhir', authenticated, ownAccount, (request, response) => {
    if (request.user.role !== 'patient') return response.status(403).json({ error: 'Only patients have a health record to export' });
    const user = request.user;
    const bundle = Fhir.patientBundle({ user, health: healthRecord(config, store, user.id), consentHistory: consentHistory(store, user.id), files: serverFiles(config, store, user.id) });
    store.audit(user.id, 'RECORD_EXPORTED', { targetId: user.id, details: { format: 'FHIR R4', resources: bundle.entry.length }, ip: request.ip });
    response.set('Content-Disposition', `attachment; filename="hfa-health-record-${user.hfaId || user.id}.json"`);
    response.type('application/fhir+json').send(JSON.stringify(bundle, null, 2));
  });

  app.get('/api/v1/me/privacy-requests', authenticated, ownAccount, (request, response) =>
    response.json(envelope({ requests: store.db.prepare('SELECT * FROM privacy_requests WHERE user_id=? ORDER BY created_at DESC').all(request.user.id).map(requestRow) })));

  app.post('/api/v1/me/privacy-requests', authenticated, ownAccount, (request, response) => {
    const input = z.object({ kind: z.enum(REQUEST_KINDS), details }).strict().parse(request.body);
    if (['rectification', 'erasure', 'restriction', 'objection'].includes(input.kind) && input.details.length < 10) return response.status(400).json({ error: 'details: Tell us what you want changed (at least 10 characters)' });
    const open = store.db.prepare("SELECT id FROM privacy_requests WHERE user_id=? AND kind=? AND status IN ('received','in_progress')").get(request.user.id, input.kind);
    if (open) return response.status(409).json({ error: 'You already have an open request of this kind' });
    const now = new Date(), id = randomUUID();
    const due = new Date(now.getTime() + RESPONSE_DAYS * 86400000).toISOString();
    store.db.prepare('INSERT INTO privacy_requests (id,user_id,kind,details,status,created_at,due_at) VALUES (?,?,?,?,?,?,?)').run(id, request.user.id, input.kind, input.details, 'received', now.toISOString(), due);
    store.audit(request.user.id, 'PRIVACY_REQUEST_SUBMITTED', { targetId: request.user.id, details: { kind: input.kind, requestId: id }, ip: request.ip });
    response.status(201).json(envelope({ request: requestRow(store.db.prepare('SELECT * FROM privacy_requests WHERE id=?').get(id)) }, 'Request received'));
  });

  const adminRows = where => store.db.prepare(`SELECT r.*, u.name AS user_name, u.role AS user_role, u.hfa_number, resolver.name AS resolver_name
    FROM privacy_requests r JOIN users u ON u.id=r.user_id LEFT JOIN users resolver ON resolver.id=r.resolved_by ${where} ORDER BY
    CASE WHEN r.status IN ('received','in_progress') THEN 0 ELSE 1 END, r.due_at`);

  app.get('/api/v1/admin/privacy-requests', authenticated, admin, (request, response) =>
    response.json(envelope({ requests: adminRows('').all().map(requestRow), responseDays: RESPONSE_DAYS })));

  app.patch('/api/v1/admin/privacy-requests/:id', authenticated, admin, (request, response) => {
    const input = z.object({ status: z.enum(['in_progress', 'completed', 'refused']), resolution: details.optional() }).strict().parse(request.body);
    const row = store.db.prepare('SELECT * FROM privacy_requests WHERE id=?').get(request.params.id);
    if (!row) return response.sendStatus(404);
    if (['completed', 'refused'].includes(row.status)) return response.status(409).json({ error: 'This request is already closed' });
    if (input.status !== 'in_progress' && (input.resolution || '').length < 10) return response.status(400).json({ error: 'resolution: Explain the outcome to the person (at least 10 characters)' });
    const closed = input.status !== 'in_progress', now = new Date().toISOString();
    store.db.prepare('UPDATE privacy_requests SET status=?, resolution=COALESCE(?,resolution), resolved_at=?, resolved_by=? WHERE id=?')
      .run(input.status, input.resolution || null, closed ? now : null, closed ? request.user.id : null, row.id);
    store.audit(request.user.id, 'PRIVACY_REQUEST_UPDATED', { targetId: row.user_id, details: { kind: row.kind, status: input.status, requestId: row.id }, ip: request.ip });
    const person = store.user(row.user_id);
    if (person?.role === 'patient') store.activity(request.user, { eventId: randomUUID(), patientId: person.id, resource: 'Account' }, config.ready,
      'HFA SilverStrong: There is an update to your data-protection request. Sign in securely to review it. This is an automated notification. Do not reply.');
    response.json(envelope({ request: requestRow(adminRows('WHERE r.id=?').get(row.id)) }, 'Request updated'));
  });
}

module.exports = { installPrivacyRoutes, consentHistory, accessLog, CHANGEABLE_CONSENTS, REQUEST_KINDS, RESPONSE_DAYS, ACCESS_ACTIONS };
