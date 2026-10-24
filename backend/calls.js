// Real voice and video consultations (WebRTC). Audio and video travel directly and encrypted between the two
// devices (DTLS-SRTP); this server only passes the short connection messages ("signals") between the patient and
// the clinician of a booked appointment, during its time window, and then forgets them.
// - Only participants of a scheduled voice or video appointment can signal, only to each other, and only from
//   15 minutes before the start to 15 minutes after the end (appointment times are Cameroon wall-clock time).
// - ICE servers: a free public STUN server by default; set TURN_URLS / TURN_USERNAME / TURN_CREDENTIAL to add a
//   relay for networks where a direct connection is impossible.
const { z } = require('zod');
const { rateLimit } = require('express-rate-limit');
const { unseal } = require('./records');
const { ensureClinicalTable } = require('./clinical');

const WINDOW_MS = 15 * 60000;
const KEEP_MS = 2 * 60 * 60000;
const TYPES = ['hello', 'offer', 'answer', 'candidate', 'bye'];
const CAMEROON_OFFSET = process.env.CALL_TIMEZONE_OFFSET || '+01:00';

function iceServers(env = process.env) {
  const servers = [{ urls: (env.STUN_URLS || 'stun:stun.l.google.com:19302').split(',').map(url => url.trim()).filter(Boolean) }];
  if (env.TURN_URLS && env.TURN_USERNAME && env.TURN_CREDENTIAL) servers.push({ urls: env.TURN_URLS.split(',').map(url => url.trim()), username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL });
  return servers;
}

function ensureSignalTable(store) {
  store.db.exec(`CREATE TABLE IF NOT EXISTS call_signals (
    seq INTEGER PRIMARY KEY AUTOINCREMENT, appointment_id TEXT NOT NULL, from_id TEXT NOT NULL, to_id TEXT NOT NULL,
    type TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS call_signals_inbox ON call_signals(appointment_id, to_id, seq);`);
}

function installCallRoutes(app, config, store, authenticated) {
  ensureClinicalTable(store); ensureSignalTable(store);
  const limit = rateLimit({ windowMs: 60000, limit: 400, keyGenerator: request => request.user.id, standardHeaders: 'draft-8', legacyHeaders: false });

  /** The appointment if this user may call in it now, with the people they may signal. */
  function callable(user, appointmentId) {
    const row = store.db.prepare("SELECT * FROM clinical_records WHERE collection='appointments' AND id=?").get(appointmentId);
    if (!row) return null;
    const appointment = JSON.parse(unseal(config, `clinical:appointments:${row.id}`, row).toString());
    const people = [appointment.patientId, appointment.doctorId, appointment.nurseId].filter(Boolean);
    if (!people.includes(user.id) || appointment.status !== 'scheduled' || !['video', 'voice'].includes(appointment.mode)) return null;
    const start = Date.parse(`${appointment.date}T${String(appointment.time).padStart(5, '0')}:00${CAMEROON_OFFSET}`);
    const end = start + (Number(appointment.durationMinutes) || 30) * 60000;
    if (!start || Date.now() < start - WINDOW_MS || Date.now() > end + WINDOW_MS) return null;
    return { appointment, others: people.filter(id => id !== user.id) };
  }

  app.get('/api/v1/calls/ice', authenticated, (request, response) => response.json({ success: true, data: { iceServers: iceServers() }, message: 'OK', timestamp: new Date().toISOString() }));

  app.post('/api/v1/calls/:id/signals', authenticated, limit, (request, response) => {
    if (request.impersonator) return response.status(403).json({ error: 'Consultations happen from your own account' });
    const call = callable(request.user, request.params.id);
    if (!call) return response.status(403).json({ error: 'You can join this call only during the booked appointment time', code: 'call_not_allowed' });
    const input = z.object({ to: z.string().max(100), type: z.enum(TYPES), data: z.unknown().optional() }).strict().parse(request.body);
    if (!call.others.includes(input.to)) return response.status(403).json({ error: 'You can only call the other participant of this appointment' });
    const payload = JSON.stringify(input.data ?? null);
    if (payload.length > 20000) return response.status(413).json({ error: 'Signal too large' });
    const now = Date.now();
    store.db.prepare('DELETE FROM call_signals WHERE created_at<?').run(now - KEEP_MS);
    store.db.prepare('INSERT INTO call_signals (appointment_id,from_id,to_id,type,payload,created_at) VALUES (?,?,?,?,?,?)').run(request.params.id, request.user.id, input.to, input.type, payload, now);
    if (input.type === 'hello') {
      const seen = store.db.prepare("SELECT 1 FROM audit_log WHERE actor_id=? AND action='CALL_JOINED' AND json_extract(details,'$.appointmentId')=? LIMIT 1").get(request.user.id, request.params.id);
      if (!seen) store.audit(request.user.id, 'CALL_JOINED', { targetId: call.appointment.patientId, details: { appointmentId: request.params.id, mode: call.appointment.mode }, ip: request.ip });
    }
    response.status(201).json({ success: true, data: { ok: true }, message: 'Sent', timestamp: new Date().toISOString() });
  });

  app.get('/api/v1/calls/:id/signals', authenticated, limit, (request, response) => {
    const call = callable(request.user, request.params.id);
    if (!call) return response.status(403).json({ error: 'You can join this call only during the booked appointment time', code: 'call_not_allowed' });
    const after = Math.max(0, Number(request.query.after) || 0);
    const rows = store.db.prepare('SELECT seq,from_id AS "from",type,payload FROM call_signals WHERE appointment_id=? AND to_id=? AND seq>? ORDER BY seq LIMIT 100').all(request.params.id, request.user.id, after);
    response.json({ success: true, data: { signals: rows.map(row => ({ seq: row.seq, from: row.from, type: row.type, data: JSON.parse(row.payload) })), mode: call.appointment.mode }, message: 'OK', timestamp: new Date().toISOString() });
  });
}

module.exports = { installCallRoutes, iceServers };
