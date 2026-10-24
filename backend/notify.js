// In-app notifications between people who work together: a patient and their care team (assigned, same hospital,
// or sharing a record such as an appointment, referral or lab result), and staff with each other. The text is
// always generic ("new activity, sign in"), never clinical. Patients' notifications also go to WhatsApp when they
// opted in (through the existing delivery queue). Each request id is used once.
const { randomUUID } = require('node:crypto');
const { z } = require('zod');
const { rateLimit } = require('express-rate-limit');
const { ensureClinicalTable } = require('./clinical');

const RESOURCES = ['Account', 'Communications', 'Appointments', 'Medical Records', 'Lab Results', 'Care Notes', 'Care Coordination', 'Billing', 'Home Visits', 'Urgent Care'];
const STAFF = ['doctor', 'nurse', 'labtech', 'admin', 'pharmacist'];
const PATIENT_MESSAGE = 'HFA SilverStrong: New activity on your account needs your attention. Sign in securely to review it. This is an automated notification. Do not reply.';
const staffMessage = resource => `HFA SilverStrong: New activity in ${resource}. Sign in to review it.`;

function installNotifyRoutes(app, config, store, authenticated) {
  ensureClinicalTable(store);
  store.db.exec('CREATE TABLE IF NOT EXISTS notify_requests (request_key TEXT PRIMARY KEY, created_at TEXT NOT NULL)');
  const limit = rateLimit({ windowMs: 60000, limit: 30, keyGenerator: request => request.user.id, standardHeaders: 'draft-8', legacyHeaders: false });

  const shareRecord = (a, b) => !!store.db.prepare(`SELECT 1 FROM clinical_records WHERE (people LIKE ? OR patient_id=?) AND (people LIKE ? OR patient_id=?) LIMIT 1`).get(`%"${a}"%`, a, `%"${b}"%`, b);
  const sameHospital = (a, b) => { const row = store.db.prepare('SELECT a.facility_id AS fa, b.facility_id AS fb FROM users a, users b WHERE a.id=? AND b.id=?').get(a, b); return !!row?.fa && row.fa === row.fb; };
  function related(actor, target) {
    if (actor.role === 'admin') return true;
    if (target.role === 'patient' && actor.role === 'patient') return false;
    if (target.role === 'patient' || actor.role === 'patient') {
      const [patient, other] = target.role === 'patient' ? [target, actor] : [actor, target];
      return patient.assignedDoctor === other.id || patient.assignedNurse === other.id || sameHospital(patient.id, other.id) || shareRecord(patient.id, other.id);
    }
    return STAFF.includes(actor.role) && STAFF.includes(target.role);
  }

  app.post('/api/v1/notify', authenticated, limit, (request, response) => {
    const input = z.object({ to: z.string().max(100), resource: z.string().max(60), eventId: z.string().min(8).max(100) }).strict().parse(request.body);
    const target = store.user(input.to), actor = request.user;
    if (!target || target.status !== 'active' || target.id === actor.id || !related(actor, target)) return response.status(403).json({ error: 'You cannot notify this person' });
    const key = `${actor.id}:${input.eventId}`;
    if (store.db.prepare('SELECT 1 FROM notify_requests WHERE request_key=?').get(key)) return response.json({ success: true, data: { replayed: true }, message: 'OK', timestamp: new Date().toISOString() });
    const resource = RESOURCES.includes(input.resource) ? input.resource : 'Account', now = new Date().toISOString();
    store.db.prepare('INSERT INTO notify_requests VALUES (?,?)').run(key, now);
    let sent = false;
    if (target.role === 'patient' && store.canNotify(actor, target)) { try { store.activity(actor, { eventId: `n:${input.eventId}`, patientId: target.id, resource }, config.ready, PATIENT_MESSAGE); sent = true; } catch (error) { sent = false; } }
    if (!sent) store.db.prepare('INSERT INTO notifications VALUES (?,?,?,?,?)').run(randomUUID(), target.id, target.role === 'patient' ? PATIENT_MESSAGE : staffMessage(resource), resource, now);
    response.status(201).json({ success: true, data: { sent: true }, message: 'Notified', timestamp: now });
  });
}

module.exports = { installNotifyRoutes, RESOURCES };
