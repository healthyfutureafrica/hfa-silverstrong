// Nurses working with HFA:
// 1. Validation before a nurse can work. At registration a nurse names a supervisor and gives their nursing school,
//    qualifications and licence number. An administrator contacts the supervisor, checks every item (identity,
//    licence with its expiry, qualifications, education, workplace, supervisor) and only then validates the
//    account. Supervisor contact details are a third party's personal data: only administrators see them.
// 2. Pay per home visit: VISIT_PAY_XAF (3,000 FCFA) is credited to the nurse's account once (a) the nurse has
//    filed the visit report, (b) the patient has given feedback and (c) the doctor in charge has confirmed receiving
//    all the data. Each step is recorded here by the person concerned, never by the nurse on someone else's behalf.
//    The credit goes to the nurse's earnings account (earnings.js), withdrawn by automatic payout from 10 visits.
// 3. Weekly availability: each nurse keeps a weekly timetable and confirms or updates it at least every 7 days.
//    Until it is current the nurse cannot be booked for home visits, and bookings must fit the timetable.
const { randomUUID } = require('node:crypto');
const { z } = require('zod');
const { seal, unseal } = require('./records');
const { filesConfigured } = require('./files');
const { ensureClinicalTable } = require('./clinical');
const { credit, creditFor } = require('./earnings');

const VISIT_PAY_XAF = 3000;
const TIMETABLE_DAYS = 7;
const CHECKS = ['identity', 'licence', 'qualifications', 'education', 'employment', 'supervisor'];
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']; // index = Date#getUTCDay()
const DAY = 86400000;

const text = (max, min = 1) => z.string().trim().min(min).max(max).regex(/^[^<>\u0000-\u0008\u000b\u000c\u000e-\u001f]*$/, 'remove < and > characters');
const personName = text(120, 2).regex(/^[\p{L}\p{M}\p{N} .'-]+$/u, 'letters only').refine(value => /\p{L}/u.test(value), 'Enter the full name');
const e164 = z.string().trim().transform(value => value.replace(/[\s().-]/g, '')).pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, 'Enter the phone number with the country code, e.g. +237677123456'));
/** What a nurse adds at registration (checked by the registration schema in server.js). */
const nurseApplication = z.object({
  school: text(160, 3), graduationYear: z.number().int().min(1960).max(new Date().getFullYear()),
  supervisor: z.object({ name: personName, position: text(120, 2), institution: text(160, 3), phone: e164, email: z.string().trim().toLowerCase().email().max(254).optional() }).strict()
}).strict();

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const slot = z.object({ start: z.string().regex(TIME), end: z.string().regex(TIME) }).strict().refine(value => value.start < value.end, 'A time slot must end after it starts');
const timetable = z.object(Object.fromEntries(DAYS.map(day => [day, z.array(slot).max(6).default([])]))).strict()
  .refine(week => Object.values(week).every(slots => [...slots].sort((a, b) => a.start.localeCompare(b.start)).every((item, index, all) => !index || all[index - 1].end <= item.start)), 'Time slots on the same day must not overlap');
const number = (min, max) => z.number().finite().min(min).max(max);
const visitReport = z.object({
  vitals: z.object({
    temperatureC: number(30, 45), systolic: number(50, 260).int(), diastolic: number(30, 160).int(), pulse: number(20, 250).int(),
    respiratoryRate: number(5, 80).int().optional(), spo2: number(50, 100).int().optional(), weightKg: number(0.5, 400).optional(), glucoseMmol: number(1, 40).optional()
  }).strict().refine(value => value.systolic > value.diastolic, 'The systolic pressure must be higher than the diastolic'),
  observations: z.string().trim().min(10, 'Describe what you found (at least 10 characters)').max(4000),
  careGiven: z.string().trim().min(3, 'Describe the care given').max(4000),
  recommendations: z.string().trim().max(4000).default('')
}).strict();

function ensureTables(store) {
  ensureClinicalTable(store);
  store.db.exec(`
    CREATE TABLE IF NOT EXISTS nurse_verifications (
      nurse_id TEXT PRIMARY KEY, application TEXT NOT NULL, checks TEXT NOT NULL DEFAULT '{}', contacts TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, validated_at TEXT, validated_by TEXT
    );
    CREATE TABLE IF NOT EXISTS nurse_availability (
      nurse_id TEXT PRIMARY KEY, slots TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL, confirmed_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS home_visit_steps (
      visit_id TEXT PRIMARY KEY, nurse_id TEXT NOT NULL, patient_id TEXT NOT NULL,
      report_nonce BLOB, report_encrypted BLOB, report_tag BLOB, report_at TEXT, returned_at TEXT, returned_note TEXT,
      feedback_rating INTEGER, feedback_comment TEXT, feedback_at TEXT, confirmed_by TEXT, confirmed_at TEXT, confirm_note TEXT
    );`);
  // A doctor in charge set by an administrator (visits booked without one, or whose doctor has left).
  if (!store.db.prepare('PRAGMA table_info(home_visit_steps)').all().some(column => column.name === 'doctor_id')) store.db.exec('ALTER TABLE home_visit_steps ADD COLUMN doctor_id TEXT');
}
const activeDoctor = (store, id) => { const user = id && store.user(id); return user?.role === 'doctor' && user.status === 'active' ? id : null; };

const notify = (store, userId, resource, message) => {
  if (userId) store.db.prepare('INSERT INTO notifications VALUES (?,?,?,?,?)').run(randomUUID(), userId, message, resource, new Date().toISOString());
};

/** Saves a nurse's application at registration (inside the registration transaction). */
function recordApplication(store, nurseId, application) {
  ensureTables(store);
  const now = new Date().toISOString();
  store.db.prepare('INSERT INTO nurse_verifications (nurse_id,application,created_at,updated_at) VALUES (?,?,?,?)').run(nurseId, JSON.stringify(application), now, now);
  for (const row of store.db.prepare("SELECT id FROM users WHERE role='admin' AND status='active'").all())
    notify(store, row.id, 'Account', 'HFA SilverStrong: A nurse has registered. Contact their supervisor and check their details in Pending approvals.');
}

// ───── Timetable ─────
function availabilityOf(store, nurseId) {
  const row = store.db.prepare('SELECT * FROM nurse_availability WHERE nurse_id=?').get(nurseId);
  if (!row) return { nurseId, slots: null, note: '', updatedAt: null, confirmedAt: null, dueAt: null, status: 'missing' };
  const dueAt = new Date(Date.parse(row.confirmed_at) + TIMETABLE_DAYS * DAY).toISOString();
  return { nurseId, slots: JSON.parse(row.slots), note: row.note, updatedAt: row.updated_at, confirmedAt: row.confirmed_at, dueAt, status: Date.now() > Date.parse(dueAt) ? 'overdue' : 'current' };
}
const toMinutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

/**
 * A home visit booked or moved must fall in the nurse's current timetable. Called by the clinical record route.
 * Returns an error message or null.
 */
function visitScheduleProblem(store, data, existing) {
  if (!data.nurseId || ['cancelled', 'missed'].includes(data.status)) return null;
  // Every visit has a doctor in charge from the start: they confirm the visit data before the nurse is paid.
  if (!existing && !data.doctorId) return 'doctorId: choose the doctor in charge of this home visit';
  if (data.doctorId && data.doctorId !== existing?.doctorId && !activeDoctor(store, data.doctorId)) return 'doctorId: choose an active doctor';
  const moved = !existing || ['nurseId', 'visitDate', 'visitTime'].some(field => data[field] !== existing[field]);
  if (!moved) return null;
  ensureTables(store);
  const availability = availabilityOf(store, data.nurseId);
  if (availability.status === 'missing') return 'nurseId: this nurse has not published a weekly timetable yet; choose another nurse';
  if (availability.status === 'overdue') return 'nurseId: this nurse’s weekly timetable is out of date; choose another nurse';
  const day = DAYS[new Date(`${data.visitDate}T00:00:00Z`).getUTCDay()];
  const minute = toMinutes(String(data.visitTime || '00:00'));
  const slots = availability.slots[day] || [];
  if (!slots.some(item => toMinutes(item.start) <= minute && minute < toMinutes(item.end)))
    return `visitTime: the nurse is not available then. Available on that day: ${slots.length ? slots.map(item => `${item.start}–${item.end}`).join(', ') : 'not working'}`;
  return null;
}

function installNurseWorkforceRoutes(app, config, store, authenticated, admin) {
  ensureTables(store);
  const ok = (data, message = 'OK') => ({ success: true, data, message, timestamp: new Date().toISOString() });
  const storage = (request, response, next) => filesConfigured(config) ? next() : response.status(503).json({ error: 'Encrypted record storage is not configured' });
  const own = (request, response, next) => request.impersonator ? response.status(403).json({ error: 'Only the account holder can do this' }) : next();
  const nurseOnly = (request, response, next) => request.user.role === 'nurse' ? next() : response.status(403).json({ error: 'For nurses only' });
  const today = () => new Date().toISOString().slice(0, 10);
  const nameOf = id => (id && store.user(id)?.name) || null;

  // ───── 1. Validation ─────
  const verificationRow = nurseId => store.db.prepare('SELECT * FROM nurse_verifications WHERE nurse_id=?').get(nurseId);
  /** The checklist, with the licence item taken from the licence register (one place for licence decisions). */
  function checklist(nurse, row) {
    const saved = JSON.parse(row?.checks || '{}');
    const licence = nurse.licenceVerification;
    const completeLicenceReview = !!(licence?.countryCode && licence?.verificationMethod && licence?.source && licence?.sourceReference && licence?.by && licence?.at && licence?.expiresOn);
    const licenceStatus = !licence ? 'pending' : licence.status !== 'verified' || !completeLicenceReview ? 'problem' : licence.expiresOn <= today() ? 'problem' : 'confirmed';
    return Object.fromEntries(CHECKS.map(item => [item, item === 'licence'
      ? { status: licenceStatus, note: licence?.note || (licence?.expiresOn ? `Valid until ${licence.expiresOn}` : ''), expiresOn: licence?.expiresOn || null, by: nameOf(licence?.by), at: licence?.at || null }
      : { status: saved[item]?.status || 'pending', note: saved[item]?.note || '', by: nameOf(saved[item]?.by), at: saved[item]?.at || null }]));
  }
  function verificationView(nurse) {
    const row = verificationRow(nurse.id);
    const checks = checklist(nurse, row), contacts = JSON.parse(row?.contacts || '[]').map(item => ({ ...item, by: nameOf(item.by) }));
    return {
      nurse: { id: nurse.id, name: nurse.name, email: nurse.email, phone: nurse.phone, status: nurse.status, hfaId: nurse.hfaId, createdAt: nurse.createdAt,
        licenseNo: nurse.licenseNo || null, qualifications: nurse.qualifications || null, hospital: nurse.hospital || null, department: nurse.department || null, specialty: nurse.specialty || null,
        idDocument: nurse.idDocument ? { fileName: nurse.idDocument.fileName, type: nurse.idDocumentType } : null },
      application: row ? JSON.parse(row.application) : null, checks, contacts,
      ready: !!row && CHECKS.every(item => checks[item].status === 'confirmed'),
      validatedAt: row?.validated_at || null, validatedBy: nameOf(row?.validated_by),
      // Nurses active before this process existed keep working; they have no application on file.
      legacy: !row && nurse.status === 'active',
      availability: availabilityOf(store, nurse.id)
    };
  }
  const findNurse = (request, response) => {
    const nurse = store.user(request.params.id);
    if (!nurse || nurse.role !== 'nurse' || nurse.status === 'deleted') { response.sendStatus(404); return null; }
    return nurse;
  };

  app.get('/api/v1/admin/nurse-verifications', authenticated, admin, (request, response) => {
    const nurses = store.db.prepare("SELECT id FROM users WHERE role='nurse' AND status!='deleted' ORDER BY created_at DESC").all().map(row => store.user(row.id));
    response.json(ok({ nurses: nurses.map(nurse => { const view = verificationView(nurse); return { ...view.nurse, confirmed: CHECKS.filter(item => view.checks[item].status === 'confirmed').length, total: CHECKS.length, problems: CHECKS.filter(item => view.checks[item].status === 'problem').length, ready: view.ready, validatedAt: view.validatedAt, legacy: view.legacy, timetable: view.availability.status }; }) }));
  });
  app.get('/api/v1/admin/nurse-verifications/:id', authenticated, admin, (request, response) => {
    const nurse = findNurse(request, response); if (!nurse) return;
    store.audit(request.user.id, 'NURSE_VERIFICATION_VIEWED', { targetId: nurse.id, ip: request.ip });
    response.set('Cache-Control', 'no-store').json(ok(verificationView(nurse)));
  });
  const editable = (nurse, response) => {
    const row = verificationRow(nurse.id);
    if (!row) { response.status(409).json({ error: 'This nurse has no application on file' }); return null; }
    if (row.validated_at) { response.status(409).json({ error: 'This nurse has already been validated' }); return null; }
    return row;
  };
  app.post('/api/v1/admin/nurse-verifications/:id/checks/:item', authenticated, admin, (request, response) => {
    const nurse = findNurse(request, response); if (!nurse) return;
    const item = request.params.item;
    if (!CHECKS.includes(item)) return response.sendStatus(404);
    if (item === 'licence') return response.status(400).json({ error: 'Record the licence (with its expiry date) in the licence register' });
    const input = z.object({ status: z.enum(['confirmed', 'problem']), note: text(1000, 0).default('') }).strict().parse(request.body);
    const row = editable(nurse, response); if (!row) return;
    if (input.status === 'problem' && input.note.length < 5) return response.status(400).json({ error: 'note: Say what is wrong (at least 5 characters)' });
    // The supervisor item is confirmed only after the supervisor has been reached and vouched for the nurse.
    if (item === 'supervisor' && input.status === 'confirmed' && !JSON.parse(row.contacts).some(contact => contact.outcome === 'confirmed'))
      return response.status(409).json({ error: 'Record a call or message in which the supervisor confirmed the nurse first' });
    const checks = JSON.parse(row.checks);
    checks[item] = { status: input.status, note: input.note, by: request.user.id, at: new Date().toISOString() };
    store.db.prepare('UPDATE nurse_verifications SET checks=?, updated_at=? WHERE nurse_id=?').run(JSON.stringify(checks), new Date().toISOString(), nurse.id);
    if (item === 'identity' && nurse.idDocument) store.updateUser(nurse.id, { profile: { idVerificationStatus: input.status === 'confirmed' ? 'verified' : 'rejected', idVerifiedBy: request.user.id, idVerifiedAt: new Date().toISOString() } });
    store.audit(request.user.id, 'NURSE_CHECK_RECORDED', { targetId: nurse.id, details: { item, status: input.status }, ip: request.ip });
    response.json(ok(verificationView(store.user(nurse.id))));
  });
  app.post('/api/v1/admin/nurse-verifications/:id/contacts', authenticated, admin, (request, response) => {
    const nurse = findNurse(request, response); if (!nurse) return;
    const input = z.object({ method: z.enum(['phone', 'email', 'whatsapp', 'in_person']), outcome: z.enum(['confirmed', 'not_reached', 'declined']), note: text(1000, 0).default('') }).strict().parse(request.body);
    const row = editable(nurse, response); if (!row) return;
    if (input.outcome !== 'not_reached' && input.note.length < 5) return response.status(400).json({ error: 'note: Write what the supervisor said (at least 5 characters)' });
    const contacts = JSON.parse(row.contacts);
    contacts.push({ ...input, by: request.user.id, at: new Date().toISOString() });
    const checks = JSON.parse(row.checks);
    // A supervisor who does not vouch for the nurse is a problem until someone confirms otherwise.
    if (input.outcome === 'declined') checks.supervisor = { status: 'problem', note: input.note, by: request.user.id, at: new Date().toISOString() };
    store.db.prepare('UPDATE nurse_verifications SET contacts=?, checks=?, updated_at=? WHERE nurse_id=?').run(JSON.stringify(contacts), JSON.stringify(checks), new Date().toISOString(), nurse.id);
    store.audit(request.user.id, 'NURSE_SUPERVISOR_CONTACTED', { targetId: nurse.id, details: { method: input.method, outcome: input.outcome }, ip: request.ip });
    response.status(201).json(ok(verificationView(store.user(nurse.id))));
  });
  app.post('/api/v1/admin/nurse-verifications/:id/validate', authenticated, admin, (request, response) => {
    const nurse = findNurse(request, response); if (!nurse) return;
    const row = editable(nurse, response); if (!row) return;
    const view = verificationView(nurse);
    if (!view.ready) return response.status(409).json({ error: `Confirm every check first: ${CHECKS.filter(item => view.checks[item].status !== 'confirmed').join(', ')}` });
    const now = new Date().toISOString();
    store.db.exec('BEGIN IMMEDIATE');
    try {
      store.db.prepare('UPDATE nurse_verifications SET validated_at=?, validated_by=?, updated_at=? WHERE nurse_id=?').run(now, request.user.id, now, nurse.id);
      store.updateUser(nurse.id, { status: 'active', profile: { nurseValidatedAt: now, nurseValidatedBy: request.user.id } });
      store.audit(request.user.id, 'NURSE_VALIDATED', { targetId: nurse.id, ip: request.ip });
      store.db.exec('COMMIT');
    } catch (error) { store.db.exec('ROLLBACK'); throw error; }
    notify(store, nurse.id, 'Account', 'HFA SilverStrong: Your nurse account has been validated. Sign in and publish your weekly timetable.');
    response.json(ok(verificationView(store.user(nurse.id)), 'Nurse validated'));
  });
  /** For the account route: activating a nurse goes through validation (reactivating after suspension does not). */
  const activationBlocked = (nurse, patch) => nurse.role === 'nurse' && patch.status === 'active' && nurse.status !== 'active' && nurse.status !== 'suspended' && !verificationRow(nurse.id)?.validated_at;

  // ───── 3. Weekly timetable ─────
  app.get('/api/v1/nurse/availability', authenticated, nurseOnly, (request, response) => response.json(ok(availabilityOf(store, request.user.id))));
  app.put('/api/v1/nurse/availability', authenticated, own, nurseOnly, (request, response) => {
    const input = z.object({ slots: timetable, note: text(300, 0).default('') }).strict().parse(request.body);
    const now = new Date().toISOString();
    store.db.prepare(`INSERT INTO nurse_availability (nurse_id,slots,note,updated_at,confirmed_at) VALUES (?,?,?,?,?)
      ON CONFLICT(nurse_id) DO UPDATE SET slots=excluded.slots, note=excluded.note, updated_at=excluded.updated_at, confirmed_at=excluded.confirmed_at`).run(request.user.id, JSON.stringify(input.slots), input.note, now, now);
    store.audit(request.user.id, 'NURSE_TIMETABLE_UPDATED', { targetId: request.user.id, ip: request.ip });
    response.json(ok(availabilityOf(store, request.user.id), 'Timetable saved'));
  });
  app.post('/api/v1/nurse/availability/confirm', authenticated, own, nurseOnly, (request, response) => {
    if (!store.db.prepare('SELECT 1 FROM nurse_availability WHERE nurse_id=?').get(request.user.id)) return response.status(409).json({ error: 'Publish your timetable first' });
    store.db.prepare('UPDATE nurse_availability SET confirmed_at=? WHERE nurse_id=?').run(new Date().toISOString(), request.user.id);
    store.audit(request.user.id, 'NURSE_TIMETABLE_CONFIRMED', { targetId: request.user.id, ip: request.ip });
    response.json(ok(availabilityOf(store, request.user.id), 'Timetable confirmed'));
  });
  // Every active nurse's timetable, for booking home visits (working hours only, nothing personal).
  app.get('/api/v1/nurses/availability', authenticated, (request, response) => {
    const nurses = store.db.prepare("SELECT id FROM users WHERE role='nurse' AND status='active'").all();
    response.json(ok({ nurses: nurses.map(row => availabilityOf(store, row.id)) }));
  });

  // ───── 2. Home visits: report, feedback, doctor confirmation, pay ─────
  const visitOf = visitId => {
    const row = store.db.prepare("SELECT * FROM clinical_records WHERE collection='homeVisits' AND id=?").get(visitId);
    return row ? { row, data: JSON.parse(unseal(config, `clinical:homeVisits:${row.id}`, row).toString()) } : null;
  };
  // The doctor an administrator assigned, else the visit's doctor, else the patient's assigned doctor (active only).
  const doctorInCharge = visit => activeDoctor(store, stepsOf(visit.id)?.doctor_id) || activeDoctor(store, visit.doctorId) || activeDoctor(store, store.user(visit.patientId)?.assignedDoctor);
  const tellAdmins = message => { for (const row of store.db.prepare("SELECT id FROM users WHERE role='admin' AND status='active'").all()) notify(store, row.id, 'Home Visits', message); };
  const stepsOf = visitId => store.db.prepare('SELECT * FROM home_visit_steps WHERE visit_id=?').get(visitId);
  const reportOf = steps => steps?.report_encrypted ? JSON.parse(unseal(config, `homevisit-report:${steps.visit_id}`, { nonce: steps.report_nonce, encrypted: steps.report_encrypted, tag: steps.report_tag }).toString()) : null;
  const payoutView = visitId => { const row = creditFor(store, 'home_visit', visitId); return row && { amount: row.amount, currency: row.currency, status: row.status, creditedAt: row.credited_at, paidAt: row.paid_at }; };

  /** What each person sees about a visit: clinicians and the patient see the report; administrators see progress only. */
  function progressView(actor, visit, steps) {
    const doctorId = doctorInCharge(visit), clinical = actor.role !== 'admin';
    return {
      visitId: visit.id, visitDate: visit.visitDate, visitTime: visit.visitTime, status: visit.status,
      patientId: visit.patientId, patientName: nameOf(visit.patientId), nurseId: visit.nurseId, nurseName: nameOf(visit.nurseId), doctorId, doctorName: nameOf(doctorId),
      reportAt: steps?.report_at || null, report: clinical ? reportOf(steps) : null, returnedAt: steps?.returned_at || null, returnedNote: steps?.returned_note || null,
      feedback: steps?.feedback_at ? { rating: steps.feedback_rating, comment: actor.role === 'admin' ? null : steps.feedback_comment, at: steps.feedback_at } : null,
      confirmedAt: steps?.confirmed_at || null, confirmedBy: nameOf(steps?.confirmed_by), confirmNote: clinical ? steps?.confirm_note || null : null,
      payout: payoutView(visit.id),
      waitingFor: !steps?.report_at || steps.returned_at ? 'report' : !steps.feedback_at || !steps.confirmed_at ? [!steps.feedback_at && 'feedback', !steps.confirmed_at && 'doctor'].filter(Boolean).join('+') : null
    };
  }
  /** The person's role in the visit, or null. */
  const roleIn = (actor, visit) => actor.id === visit.nurseId ? 'nurse' : actor.id === visit.patientId ? 'patient' : actor.id === doctorInCharge(visit) ? 'doctor' : actor.role === 'admin' ? 'admin' : null;
  function loadVisit(request, response, roles) {
    const visit = visitOf(request.params.id);
    const role = visit && roleIn(request.user, visit.data);
    if (!visit || !role) { response.sendStatus(404); return null; }
    if (roles && !roles.includes(role)) { response.status(403).json({ error: `Only the ${roles.join(' or ')} of this visit can do this` }); return null; }
    if (visit.data.status === 'cancelled') { response.status(409).json({ error: 'This visit was cancelled' }); return null; }
    return visit;
  }
  function ensureSteps(visit) {
    if (!stepsOf(visit.id)) store.db.prepare('INSERT INTO home_visit_steps (visit_id,nurse_id,patient_id) VALUES (?,?,?)').run(visit.id, visit.nurseId, visit.patientId);
    return stepsOf(visit.id);
  }
  /** Marks the shared visit record completed (new version, so every device gets it on the next sync). */
  function markCompleted(visit, row, actorId) {
    if (visit.status === 'completed') return;
    const data = { ...visit, status: 'completed', completedAt: new Date().toISOString() }, now = new Date().toISOString();
    const sealed = seal(config, `clinical:homeVisits:${row.id}`, Buffer.from(JSON.stringify(data)));
    store.db.prepare('UPDATE clinical_records SET version=version+1,nonce=?,encrypted=?,tag=?,updated_at=?,updated_by=? WHERE collection=? AND id=?').run(sealed.nonce, sealed.encrypted, sealed.tag, now, actorId, 'homeVisits', row.id);
  }
  /** All three steps done: the nurse's pay for this visit becomes due (once). */
  function settle(visit) {
    const steps = stepsOf(visit.id);
    if (!steps?.report_at || steps.returned_at || !steps.feedback_at || !steps.confirmed_at) return;
    credit(store, { userId: visit.nurseId, source: 'home_visit', sourceId: visit.id, amount: VISIT_PAY_XAF, details: { patientId: visit.patientId, date: visit.visitDate } });
  }

  app.get('/api/v1/home-visits/progress', authenticated, storage, (request, response) => {
    const actor = request.user;
    const rows = store.db.prepare(`SELECT * FROM clinical_records WHERE collection='homeVisits'${actor.role === 'admin' ? '' : ' AND (people LIKE ? OR patient_id=? OR patient_id IN (SELECT id FROM users WHERE assigned_doctor=?) OR id IN (SELECT visit_id FROM home_visit_steps WHERE doctor_id=?))'} ORDER BY updated_at DESC`)
      .all(...(actor.role === 'admin' ? [] : [`%"${actor.id}"%`, actor.id, actor.id, actor.id]));
    const visits = [];
    for (const row of rows) {
      const data = JSON.parse(unseal(config, `clinical:homeVisits:${row.id}`, row).toString());
      if (roleIn(actor, data) && data.status !== 'cancelled') visits.push(progressView(actor, data, stepsOf(row.id)));
    }
    response.json(ok({ visits, payPerVisit: { amount: VISIT_PAY_XAF, currency: 'XAF' } }));
  });

  // An administrator names the doctor in charge when a visit has none (or its doctor is no longer active).
  app.post('/api/v1/admin/home-visits/:id/doctor', authenticated, admin, storage, (request, response) => {
    const { doctorId } = z.object({ doctorId: z.string().min(1).max(100) }).strict().parse(request.body);
    const visit = visitOf(request.params.id);
    if (!visit || visit.data.status === 'cancelled') return response.sendStatus(404);
    if (!activeDoctor(store, doctorId)) return response.status(400).json({ error: 'doctorId: choose an active doctor' });
    const steps = ensureSteps(visit.data);
    if (steps.confirmed_at) return response.status(409).json({ error: 'This visit has already been confirmed by its doctor' });
    store.db.prepare('UPDATE home_visit_steps SET doctor_id=? WHERE visit_id=?').run(doctorId, visit.data.id);
    store.audit(request.user.id, 'HOME_VISIT_DOCTOR_ASSIGNED', { targetId: visit.data.patientId, details: { visitId: visit.data.id, doctorId }, ip: request.ip });
    notify(store, doctorId, 'Home Visits', 'HFA SilverStrong: You are the doctor in charge of a home visit. Sign in to review it.');
    response.json(ok(progressView(request.user, visit.data, stepsOf(visit.data.id)), 'Doctor in charge assigned'));
  });

  app.post('/api/v1/home-visits/:id/report', authenticated, own, storage, (request, response) => {
    const visit = loadVisit(request, response, ['nurse']); if (!visit) return;
    const input = visitReport.parse(request.body);
    if (visit.data.visitDate > today()) return response.status(409).json({ error: 'The visit report is filed on or after the visit date' });
    const steps = ensureSteps(visit.data);
    if (steps.confirmed_at) return response.status(409).json({ error: 'The doctor has already confirmed this visit; the report cannot change' });
    const report = { ...input, filedAt: new Date().toISOString() };
    const sealed = seal(config, `homevisit-report:${visit.data.id}`, Buffer.from(JSON.stringify(report)));
    store.db.exec('BEGIN IMMEDIATE');
    try {
      store.db.prepare('UPDATE home_visit_steps SET report_nonce=?,report_encrypted=?,report_tag=?,report_at=?,returned_at=NULL,returned_note=NULL WHERE visit_id=?').run(sealed.nonce, sealed.encrypted, sealed.tag, report.filedAt, visit.data.id);
      markCompleted(visit.data, visit.row, request.user.id);
      store.audit(request.user.id, steps.report_at ? 'HOME_VISIT_REPORT_UPDATED' : 'HOME_VISIT_REPORT_FILED', { targetId: visit.data.patientId, details: { visitId: visit.data.id }, ip: request.ip });
      store.db.exec('COMMIT');
    } catch (error) { store.db.exec('ROLLBACK'); throw error; }
    if (!steps.feedback_at) notify(store, visit.data.patientId, 'Home Visits', 'HFA SilverStrong: New activity on your account needs your attention. Sign in securely to review it. This is an automated notification. Do not reply.');
    const doctorId = doctorInCharge(visit.data);
    if (doctorId) notify(store, doctorId, 'Home Visits', 'HFA SilverStrong: A home visit report is waiting for your confirmation. Sign in to review it.');
    else tellAdmins('HFA SilverStrong: A home visit report has no doctor in charge. Sign in and assign one under Home visits.');
    settle(visit.data);
    response.status(201).json(ok(progressView(request.user, visitOf(visit.data.id).data, stepsOf(visit.data.id)), 'Report filed'));
  });

  app.post('/api/v1/home-visits/:id/feedback', authenticated, own, storage, (request, response) => {
    const visit = loadVisit(request, response, ['patient']); if (!visit) return;
    const input = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(1000).regex(/^[^<>]*$/, 'remove < and > characters').default('') }).strict().parse(request.body);
    const steps = stepsOf(visit.data.id);
    if (!steps?.report_at) return response.status(409).json({ error: 'You can give feedback once the nurse has filed the visit report' });
    if (steps.feedback_at) return response.status(409).json({ error: 'Feedback for this visit has already been given' });
    store.db.prepare('UPDATE home_visit_steps SET feedback_rating=?,feedback_comment=?,feedback_at=? WHERE visit_id=?').run(input.rating, input.comment, new Date().toISOString(), visit.data.id);
    store.audit(request.user.id, 'HOME_VISIT_FEEDBACK_GIVEN', { targetId: visit.data.nurseId, details: { visitId: visit.data.id, rating: input.rating }, ip: request.ip });
    settle(visit.data);
    response.status(201).json(ok(progressView(request.user, visit.data, stepsOf(visit.data.id)), 'Thank you for your feedback'));
  });

  app.post('/api/v1/home-visits/:id/confirm', authenticated, own, storage, (request, response) => {
    const visit = loadVisit(request, response, ['doctor']); if (!visit) return;
    const input = z.object({ note: z.string().trim().max(1000).regex(/^[^<>]*$/, 'remove < and > characters').default('') }).strict().parse(request.body);
    const steps = stepsOf(visit.data.id);
    if (!steps?.report_at) return response.status(409).json({ error: 'The nurse has not filed the visit report yet' });
    if (steps.returned_at) return response.status(409).json({ error: 'You asked the nurse for more information; wait for the updated report' });
    if (steps.confirmed_at) return response.status(409).json({ error: 'Already confirmed' });
    store.db.prepare('UPDATE home_visit_steps SET confirmed_by=?,confirmed_at=?,confirm_note=? WHERE visit_id=?').run(request.user.id, new Date().toISOString(), input.note, visit.data.id);
    store.audit(request.user.id, 'HOME_VISIT_DATA_CONFIRMED', { targetId: visit.data.patientId, details: { visitId: visit.data.id }, ip: request.ip });
    settle(visit.data);
    response.json(ok(progressView(request.user, visit.data, stepsOf(visit.data.id)), 'Confirmed'));
  });

  app.post('/api/v1/home-visits/:id/return', authenticated, own, storage, (request, response) => {
    const visit = loadVisit(request, response, ['doctor']); if (!visit) return;
    const input = z.object({ note: z.string().trim().min(5, 'Say what is missing (at least 5 characters)').max(1000).regex(/^[^<>]*$/, 'remove < and > characters') }).strict().parse(request.body);
    const steps = stepsOf(visit.data.id);
    if (!steps?.report_at) return response.status(409).json({ error: 'The nurse has not filed the visit report yet' });
    if (steps.confirmed_at) return response.status(409).json({ error: 'Already confirmed' });
    store.db.prepare('UPDATE home_visit_steps SET returned_at=?,returned_note=? WHERE visit_id=?').run(new Date().toISOString(), input.note, visit.data.id);
    store.audit(request.user.id, 'HOME_VISIT_REPORT_RETURNED', { targetId: visit.data.patientId, details: { visitId: visit.data.id }, ip: request.ip });
    notify(store, visit.data.nurseId, 'Home Visits', 'HFA SilverStrong: The doctor needs more information in a home visit report. Sign in to complete it.');
    response.json(ok(progressView(request.user, visit.data, stepsOf(visit.data.id)), 'Sent back to the nurse'));
  });

  return { activationBlocked };
}

module.exports = { installNurseWorkforceRoutes, recordApplication, visitScheduleProblem, nurseApplication, availabilityOf, VISIT_PAY_XAF, CHECKS };
