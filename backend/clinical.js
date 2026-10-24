// Server-held clinical records: appointments, messages, care notes, doctor reports, documents, lab results,
// referrals, home visits, ratings and care plans. One shared record per item, so a booking made on a patient's
// phone reaches the doctor's laptop, and nothing is lost when a device is lost.
//
// - Encrypted at rest (AES-256-GCM, FILE_ENCRYPTION_KEY), with the record identity as additional data.
// - Access is decided here, never by the browser: each collection names its patient field, the author field
//   that must be the signed-in person, and the people taking part. Clinicians also see their patients (assigned,
//   or registered at their hospital). Administrators see appointment schedules only, never clinical content.
// - Optimistic concurrency: every write names the version it changes; a stale write gets 409 and the current copy.
// - Patients see lab results only once released, and every write is in the audit log.
const { z } = require('zod');
const express = require('express');
const { filesConfigured } = require('./files');
const { seal, unseal } = require('./records');

const MAX_RECORD = 6 * 1024 * 1024; // documents and lab results carry their file (5 MB max) as a data URL
const id = z.string().regex(/^[A-Za-z0-9._:-]{1,100}$/);
const userId = id;
const optionalUser = z.union([userId, z.literal(''), z.null()]).optional();
const CLINICIANS = ['doctor', 'nurse'];

// author: the field that must equal the signed-in user when the record is created (null = any participant).
// people: fields naming users who take part. patient: the patient the record is about.
const COLLECTIONS = {
  appointments: { patient: 'patientId', people: ['patientId', 'doctorId', 'nurseId'], author: null, adminReads: true,
    schema: z.object({ patientId: userId, doctorId: userId, nurseId: optionalUser, date: z.string().max(20), time: z.string().max(20), status: z.string().max(40) }).passthrough() },
  messages: { patient: null, people: ['from', 'to'], author: 'from', immutable: true,
    schema: z.object({ from: userId, to: userId, text: z.string().min(1).max(4000) }).passthrough() },
  careNotes: { patient: 'patientId', people: ['nurseId'], author: 'nurseId', clinicianOnly: true,
    schema: z.object({ patientId: userId, nurseId: userId, text: z.string().min(1).max(8000) }).passthrough() },
  doctorReports: { patient: 'patientId', people: ['doctorId'], author: 'doctorId', clinicianOnly: true,
    schema: z.object({ patientId: userId, doctorId: userId, summary: z.string().max(8000), plan: z.string().max(8000) }).passthrough() },
  medicalDocuments: { patient: 'patientId', people: ['uploadedBy'], author: 'uploadedBy',
    schema: z.object({ patientId: userId, uploadedBy: userId, fileName: z.string().max(200) }).passthrough() },
  labResults: { patient: 'patientId', people: ['labTechId', 'specialistDoctorId'], author: 'labTechId', authorRole: 'labtech', releaseField: 'status',
    schema: z.object({ patientId: userId, labTechId: userId, specialistDoctorId: userId, testType: z.string().max(200), status: z.enum(['pending', 'opened', 'released']) }).passthrough() },
  specialistReferrals: { patient: 'patientId', people: ['generalistId', 'specialistDoctorId'], author: 'generalistId', authorRole: 'doctor',
    schema: z.object({ patientId: userId, generalistId: userId, specialistDoctorId: optionalUser, specialty: z.string().max(120), status: z.string().max(40) }).passthrough() },
  homeVisits: { patient: 'patientId', people: ['nurseId', 'doctorId'], author: 'patientId',
    schema: z.object({ patientId: userId, nurseId: userId, doctorId: optionalUser, status: z.string().max(40) }).passthrough() },
  reviews: { patient: 'patientId', people: ['providerId'], author: 'patientId',
    schema: z.object({ patientId: userId, providerId: userId, rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() }).passthrough() },
  carePlans: { patient: 'patientId', people: ['ownerId'], author: 'ownerId', clinicianOnly: true,
    schema: z.object({ patientId: userId, ownerId: userId, title: z.string().max(200), status: z.string().max(40) }).passthrough() }
};

function ensureClinicalTable(store) {
  store.db.exec(`CREATE TABLE IF NOT EXISTS clinical_records (
    collection TEXT NOT NULL, id TEXT NOT NULL, patient_id TEXT, people TEXT NOT NULL, version INTEGER NOT NULL,
    nonce BLOB NOT NULL, encrypted BLOB NOT NULL, tag BLOB NOT NULL,
    created_at TEXT NOT NULL, created_by TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL,
    PRIMARY KEY(collection, id)
  );
  CREATE INDEX IF NOT EXISTS clinical_records_patient ON clinical_records(patient_id, updated_at);
  CREATE INDEX IF NOT EXISTS clinical_records_updated ON clinical_records(updated_at);`);
}

/** The patient a record is about (for messages: whichever side is a patient). */
function patientOf(store, collection, data) {
  const rule = COLLECTIONS[collection];
  if (rule.patient) return data[rule.patient] || null;
  for (const field of rule.people) { const user = data[field] && store.user(data[field]); if (user?.role === 'patient') return user.id; }
  return null;
}
const peopleOf = (collection, data) => [...new Set(COLLECTIONS[collection].people.map(field => data[field]).filter(Boolean))];

/** Patients this clinician cares for: assigned to them, registered at their hospital, or seen in a shared record. */
function careTeam(store, actor) {
  if (!CLINICIANS.includes(actor.role)) return new Set();
  ensureClinicalTable(store);
  const facility = store.db.prepare('SELECT facility_id FROM users WHERE id=?').get(actor.id)?.facility_id;
  const rows = store.db.prepare(`SELECT id FROM users WHERE role='patient' AND status!='deleted' AND (assigned_doctor=? OR assigned_nurse=? OR (facility_id IS NOT NULL AND facility_id=?))`).all(actor.id, actor.id, facility || '');
  const shared = store.db.prepare("SELECT DISTINCT patient_id FROM clinical_records WHERE patient_id IS NOT NULL AND people LIKE ?").all(`%"${actor.id}"%`);
  return new Set([...rows.map(row => row.id), ...shared.map(row => row.patient_id)]);
}

function installClinicalRoutes(app, config, store, authenticated) {
  ensureClinicalTable(store);
  const context = (collection, recordId) => `clinical:${collection}:${recordId}`;
  const open = row => JSON.parse(unseal(config, context(row.collection, row.id), row).toString());
  const storage = (request, response, next) => filesConfigured(config) ? next() : response.status(503).json({ error: 'Encrypted record storage is not configured' });
  const own = (request, response, next) => request.impersonator ? response.status(403).json({ error: 'Clinical records can only be changed from your own account' }) : next();

  const careTeamPatients = actor => careTeam(store, actor);
  const caresFor = (actor, patientId) => !!patientId && careTeamPatients(actor).has(patientId);

  function canRead(actor, collection, row, data, team) {
    const rule = COLLECTIONS[collection], people = JSON.parse(row.people);
    if (actor.role === 'admin') return !!rule.adminReads;
    if (row.patient_id === actor.id) return !(rule.releaseField && data[rule.releaseField] !== 'released'); // results only once released
    if (people.includes(actor.id)) return true;
    return CLINICIANS.includes(actor.role) && collection !== 'messages' && team.has(row.patient_id);
  }
  // Admin view of appointments: schedule only.
  const forActor = (actor, collection, data) => actor.role === 'admin' && collection === 'appointments'
    ? Object.fromEntries(Object.entries(data).filter(([key]) => ['id', 'patientId', 'doctorId', 'nurseId', 'date', 'time', 'durationMinutes', 'mode', 'type', 'serviceCode', 'serviceName', 'status'].includes(key))) : data;
  const view = (actor, row, data) => ({ collection: row.collection, id: row.id, version: row.version, updatedAt: row.updated_at, data: forActor(actor, row.collection, data) });

  app.get('/api/v1/clinical', authenticated, storage, (request, response) => {
    const since = typeof request.query.since === 'string' && !Number.isNaN(Date.parse(request.query.since)) ? request.query.since : '';
    const serverTime = new Date().toISOString();
    const team = careTeamPatients(request.user);
    // Narrow in SQL by the people and patients this user can be related to, then apply the full rule.
    const patients = [...team, request.user.id];
    const rows = store.db.prepare(`SELECT * FROM clinical_records WHERE updated_at>? AND (people LIKE ? OR patient_id IN (${patients.map(() => '?').join(',')})${request.user.role === 'admin' ? " OR collection='appointments'" : ''}) ORDER BY updated_at`)
      .all(since, `%"${request.user.id}"%`, ...patients);
    const records = [];
    for (const row of rows) {
      const data = open(row);
      if (canRead(request.user, row.collection, row, data, team)) records.push(view(request.user, row, data));
    }
    response.json({ success: true, data: { records, serverTime, collections: Object.keys(COLLECTIONS) }, message: 'OK', timestamp: serverTime });
  });

  app.put('/api/v1/clinical/:collection/:id', authenticated, own, storage, express.json({ limit: '8mb' }), (request, response) => {
    const collection = request.params.collection, rule = COLLECTIONS[collection];
    if (!rule || !id.safeParse(request.params.id).success) return response.sendStatus(404);
    const input = z.object({ data: z.record(z.string(), z.unknown()), baseVersion: z.number().int().min(0).default(0) }).strict().parse(request.body);
    let data = { ...rule.schema.parse(input.data), id: request.params.id };
    if (Buffer.byteLength(JSON.stringify(data)) > MAX_RECORD) return response.status(413).json({ error: 'This record is too large' });
    const actor = request.user, existing = store.db.prepare('SELECT * FROM clinical_records WHERE collection=? AND id=?').get(collection, request.params.id);
    const patientId = patientOf(store, collection, data);
    for (const person of peopleOf(collection, data)) if (!store.user(person) || store.user(person).status === 'deleted') return response.status(400).json({ error: 'A person named in this record does not exist' });
    if (patientId && store.user(patientId)?.role !== 'patient') return response.status(400).json({ error: 'The record must be about a patient' });
    const refuse = message => response.status(403).json({ error: message });
    const now = new Date().toISOString();

    if (!existing) {
      if (input.baseVersion !== 0) return response.status(409).json({ error: 'This record no longer exists', current: null });
      if (rule.author && data[rule.author] !== actor.id) return refuse('You can only create this record in your own name');
      if (rule.authorRole && actor.role !== rule.authorRole) return refuse('Your role cannot create this record');
      if (rule.clinicianOnly && !CLINICIANS.includes(actor.role)) return refuse('Only clinicians can create this record');
      // Patients act for themselves. Clinicians act only for patients already in their care (naming yourself in a
      // new record must not open someone's file): a patient adds a new doctor by booking with them. Laboratories
      // receive samples from anyone, so they may file a result for any patient.
      if (actor.role === 'admin') { if (!rule.adminReads) return refuse('Administrators cannot create clinical records'); }
      else if (patientId && patientId !== actor.id && collection !== 'messages' && rule.authorRole !== 'labtech' && !caresFor(actor, patientId)) return refuse('You are not part of this patient’s care');
      else if (actor.role === 'patient' && patientId && patientId !== actor.id) return refuse('You can only create records about yourself');
      if (collection === 'messages' && !store.visibleUsers(actor).some(user => user.id === data.to)) return refuse('You cannot message this person');
    } else {
      const current = open(existing);
      // Checked before anything about the record is returned, so a refused writer learns nothing.
      if (!canRead(actor, collection, existing, current, careTeamPatients(actor))) return response.sendStatus(404);
      if (existing.version !== input.baseVersion) return response.status(409).json({ error: 'Someone else changed this record. The latest version is shown.', current: view(actor, existing, current) });
      // Administrators only see the schedule, so they may only change the schedule; clinical fields are kept.
      if (actor.role === 'admin') data = { ...current, ...forActor(actor, collection, data), id: request.params.id };
      if (rule.immutable) return refuse('This record cannot be changed');
      if (actor.role === 'admin' && collection !== 'appointments') return refuse('Administrators cannot change clinical records');
      // Who the record is about and who wrote it never change.
      for (const field of [rule.patient, rule.author].filter(Boolean)) if (data[field] !== current[field]) return refuse(`${field} cannot be changed`);
      if (rule.releaseField && actor.id === current.patientId) return refuse('Patients cannot change lab results');
      if (rule.releaseField && data.status !== current.status && actor.id !== current.specialistDoctorId) return refuse('Only the specialist can open or release a result');
    }
    const version = (existing?.version || 0) + 1, people = JSON.stringify(peopleOf(collection, data));
    const sealed = seal(config, context(collection, request.params.id), Buffer.from(JSON.stringify(data)));
    if (existing) store.db.prepare('UPDATE clinical_records SET patient_id=?,people=?,version=?,nonce=?,encrypted=?,tag=?,updated_at=?,updated_by=? WHERE collection=? AND id=?')
      .run(patientId, people, version, sealed.nonce, sealed.encrypted, sealed.tag, now, actor.id, collection, request.params.id);
    else store.db.prepare('INSERT INTO clinical_records VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(collection, request.params.id, patientId, people, version, sealed.nonce, sealed.encrypted, sealed.tag, now, actor.id, now, actor.id);
    if (patientId && patientId !== actor.id) store.audit(actor.id, existing ? 'CLINICAL_RECORD_UPDATED' : 'CLINICAL_RECORD_CREATED', { targetId: patientId, details: { collection, id: request.params.id }, ip: request.ip });
    const row = store.db.prepare('SELECT * FROM clinical_records WHERE collection=? AND id=?').get(collection, request.params.id);
    response.status(existing ? 200 : 201).json({ success: true, data: view(actor, row, data), message: 'Saved', timestamp: now });
  });
}

/** Clinical records for one patient, for the FHIR export and data-rights requests. */
function patientRecords(config, store, patientId) {
  ensureClinicalTable(store);
  const out = Object.fromEntries(Object.keys(COLLECTIONS).map(name => [name, []]));
  for (const row of store.db.prepare('SELECT * FROM clinical_records WHERE patient_id=?').all(patientId)) {
    const data = JSON.parse(unseal(config, `clinical:${row.collection}:${row.id}`, row).toString());
    if (COLLECTIONS[row.collection].releaseField && data.status !== 'released') continue;
    out[row.collection].push(data);
  }
  return out;
}

module.exports = { installClinicalRoutes, patientRecords, ensureClinicalTable, careTeam, COLLECTIONS };
