// HFA ambulance dispatch. A patient's SOS goes to the nearest registered ambulance whose crew is on duty and has
// reported its position recently; the crew must accept within ACCEPT_TIMEOUT_MS or the next nearest unit is offered
// the job. The patient sees each real step (offered → accepted → en route → on scene → transporting → handed over)
// and an ETA only once a crew is moving. When no unit can take the job, the patient is told immediately and keeps
// the country's emergency number and the verified hospital ambulance contacts (facilities.js).
//
// Data minimisation: a crew sees the patient's name, phone, live location and a short emergency summary (blood
// group, genotype, conditions, drug allergies, current medicines) only while the job is theirs; each view is in
// the patient's "Who has opened my record". Notifications carry generic text only.
const { randomUUID } = require('node:crypto');
const { z } = require('zod');
const { healthRecord } = require('./records');

const ACCEPT_TIMEOUT_MS = 60000;
const POSITION_FRESH_MS = 30 * 60000;          // a unit that has not reported for 30 minutes is not offered jobs
const MAX_RADIUS_KM = 60;
const ROAD_FACTOR = 1.4, URBAN_KMH = 30, RURAL_KMH = 50, MOBILISATION_MIN = 2;
const ACTIVE = ['offered', 'accepted', 'en_route', 'on_scene', 'transporting'];
const CREW_STEPS = { accept: 'accepted', en_route: 'en_route', on_scene: 'on_scene', transporting: 'transporting', handover: 'completed' };
const NEXT = { offered: ['accept', 'decline'], accepted: ['en_route'], en_route: ['on_scene'], on_scene: ['transporting', 'handover'], transporting: ['handover'] };

const envelope = data => ({ success: true, data, message: 'OK', timestamp: new Date().toISOString() });
const nowIso = () => new Date().toISOString();
const coordinate = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), accuracy: z.number().min(0).max(100000).optional() }).strict();

function haversineKm(a, b) {
  const toR = degrees => degrees * Math.PI / 180, dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
/** Road-distance estimate and minutes; mobilisation time is added until the crew is moving. */
function estimate(from, to, mobilising) {
  const km = haversineKm(from, to) * ROAD_FACTOR;
  return { km: Math.round(km * 10) / 10, minutes: Math.max(1, Math.round((mobilising ? MOBILISATION_MIN : 0) + km / (km < 15 ? URBAN_KMH : RURAL_KMH) * 60)) };
}

function ensureTables(store) {
  store.db.exec(`
    CREATE TABLE IF NOT EXISTS ambulance_units (
      id TEXT PRIMARY KEY, call_sign TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, operator TEXT NOT NULL,
      country_code TEXT NOT NULL, crew_phone TEXT NOT NULL, facility_id TEXT, status TEXT NOT NULL,
      lat REAL, lng REAL, position_at INTEGER, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ambulance_crew (user_id TEXT PRIMARY KEY, unit_id TEXT NOT NULL REFERENCES ambulance_units(id));
    CREATE TABLE IF NOT EXISTS sos_requests (
      id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, status TEXT NOT NULL, country_code TEXT NOT NULL,
      lat REAL NOT NULL, lng REAL NOT NULL, accuracy REAL, location_at INTEGER NOT NULL,
      unit_id TEXT, offered_at INTEGER, start_km REAL, tried TEXT NOT NULL DEFAULT '[]', timeline TEXT NOT NULL DEFAULT '[]',
      destination TEXT, created_at TEXT NOT NULL, closed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS sos_patient ON sos_requests(patient_id, status);
  `);
}

function installDispatchRoutes(app, config, store, authenticated, admin) {
  ensureTables(store);
  const notify = (userId, message) => store.db.prepare('INSERT INTO notifications VALUES (?,?,?,?,?)').run(randomUUID(), userId, message, 'Urgent Care', nowIso());
  const unit = id => id ? store.db.prepare('SELECT * FROM ambulance_units WHERE id=?').get(id) : null;
  const sosRow = id => store.db.prepare('SELECT * FROM sos_requests WHERE id=?').get(id);
  const crewUnit = userId => store.db.prepare('SELECT u.* FROM ambulance_crew c JOIN ambulance_units u ON u.id=c.unit_id WHERE c.user_id=?').get(userId);
  const crewOf = unitId => store.db.prepare("SELECT c.user_id AS id FROM ambulance_crew c JOIN users u ON u.id=c.user_id WHERE c.unit_id=? AND u.status='active'").all(unitId).map(row => row.id);
  const admins = () => store.db.prepare("SELECT id FROM users WHERE role='admin' AND status='active'").all().map(row => row.id);
  const addStep = (row, status, note = '') => JSON.stringify([...JSON.parse(row.timeline), { at: nowIso(), status, note }].slice(-40));
  const setUnit = (id, status) => store.db.prepare('UPDATE ambulance_units SET status=? WHERE id=?').run(status, id);

  /** Offers the job to the nearest free unit not yet tried; records "no unit" honestly when there is none. */
  function offerNext(row, actorId, note = '') {
    const tried = JSON.parse(row.tried), here = { lat: row.lat, lng: row.lng };
    const fresh = Date.now() - POSITION_FRESH_MS;
    const ranked = store.db.prepare("SELECT * FROM ambulance_units WHERE status='available' AND country_code=? AND lat IS NOT NULL AND position_at>=?").all(row.country_code, fresh)
      .filter(candidate => !tried.includes(candidate.id) && crewOf(candidate.id).length && haversineKm(candidate, here) <= MAX_RADIUS_KM)
      .map(candidate => ({ candidate, ...estimate(candidate, here, true) })).sort((a, b) => a.minutes - b.minutes);
    const best = ranked[0];
    if (!best) {
      store.db.prepare("UPDATE sos_requests SET status='no_unit', unit_id=NULL, offered_at=NULL, timeline=? WHERE id=?").run(addStep(row, 'no_unit', note), row.id);
      admins().forEach(id => notify(id, 'HFA SilverStrong: An SOS request has no available ambulance. Open the SOS console now.'));
      store.audit(actorId, 'SOS_NO_UNIT', { targetId: row.patient_id, details: { requestId: row.id } });
      return;
    }
    setUnit(best.candidate.id, 'offered');
    store.db.prepare("UPDATE sos_requests SET status='offered', unit_id=?, offered_at=?, start_km=?, tried=?, timeline=? WHERE id=?")
      .run(best.candidate.id, Date.now(), best.km, JSON.stringify([...tried, best.candidate.id]), addStep(row, 'offered', `${best.candidate.call_sign} · ${best.km} km${note ? ' · ' + note : ''}`), row.id);
    crewOf(best.candidate.id).forEach(id => notify(id, 'HFA SilverStrong: Emergency job offered to your ambulance. Open the crew app now to accept.'));
    store.audit(actorId, 'SOS_OFFERED', { targetId: row.patient_id, details: { requestId: row.id, unit: best.candidate.call_sign } });
  }

  function release(row) { if (row.unit_id && unit(row.unit_id)?.status !== 'off_duty') setUnit(row.unit_id, 'available'); }

  // Crews that do not answer in time lose the offer; the next nearest unit is asked.
  const watchdog = setInterval(() => {
    try {
    for (const row of store.db.prepare("SELECT * FROM sos_requests WHERE status='offered' AND offered_at<?").all(Date.now() - ACCEPT_TIMEOUT_MS)) {
      const current = unit(row.unit_id);
      if (current) setUnit(current.id, 'available');
      offerNext(row, 'system', `${current?.call_sign || 'unit'} did not answer`);
    }
    } catch (error) { /* store closed or busy: retried on the next tick */ }
  }, 5000);
  watchdog.unref?.();
  app.locals.dispatchWatchdog = watchdog;

  function patientView(row) {
    if (!row) return null;
    const assigned = unit(row.unit_id), moving = ['en_route'].includes(row.status);
    const eta = assigned && assigned.lat !== null && ['accepted', 'en_route'].includes(row.status) ? estimate(assigned, row, row.status === 'accepted') : null;
    return {
      id: row.id, status: row.status, createdAt: row.created_at, timeline: JSON.parse(row.timeline),
      unit: assigned && row.status !== 'no_unit' ? { callSign: assigned.call_sign, kind: assigned.kind, operator: assigned.operator,
        crewPhone: ['accepted', 'en_route', 'on_scene', 'transporting'].includes(row.status) ? assigned.crew_phone : null,
        lat: moving ? assigned.lat : null, lng: moving ? assigned.lng : null } : null,
      eta, startKm: row.start_km, destination: row.destination
    };
  }
  function emergencySummary(patientId) {
    let medical = {};
    try { medical = healthRecord(config, store, patientId)?.medical || {}; } catch (error) { medical = {}; }
    return {
      bloodGroup: medical.bloodGroup || null, genotype: medical.genotype || null,
      conditions: [...(medical.conditions || []), ...(medical.otherCondition ? [medical.otherCondition] : [])],
      drugAllergies: (medical.drugAllergies || []).map(item => `${item.name} (${item.severity})`),
      medicines: (medical.medications || []).map(item => [item.name, item.dose].filter(Boolean).join(' '))
    };
  }

  // ───── Patient ─────
  app.post('/api/v1/sos', authenticated, (request, response) => {
    if (request.user.role !== 'patient' || request.impersonator) return response.status(403).json({ error: 'Only the patient can request an ambulance' });
    const input = coordinate.extend({ countryCode: z.string().length(2).optional() }).strict().parse(request.body);
    const open = store.db.prepare(`SELECT * FROM sos_requests WHERE patient_id=? AND status IN (${ACTIVE.map(() => '?').join(',')})`).get(request.user.id, ...ACTIVE);
    if (open) return response.json(envelope({ request: patientView(open) }));
    const row = { id: `sos-${randomUUID()}`, patient_id: request.user.id, status: 'received', country_code: (input.countryCode || request.user.countryCode || 'CM').toUpperCase(),
      lat: input.lat, lng: input.lng, accuracy: input.accuracy ?? null, location_at: Date.now(), tried: '[]', timeline: JSON.stringify([{ at: nowIso(), status: 'received', note: '' }]), created_at: nowIso() };
    store.db.prepare('INSERT INTO sos_requests (id,patient_id,status,country_code,lat,lng,accuracy,location_at,tried,timeline,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(row.id, row.patient_id, row.status, row.country_code, row.lat, row.lng, row.accuracy, row.location_at, row.tried, row.timeline, row.created_at);
    store.audit(request.user.id, 'SOS_REQUESTED', { targetId: request.user.id, details: { requestId: row.id }, ip: request.ip });
    [request.user.assignedDoctor, request.user.assignedNurse].filter(Boolean).forEach(id => notify(id, 'HFA SilverStrong: One of your patients sent an emergency request. Sign in now.'));
    offerNext(sosRow(row.id), request.user.id);
    response.status(201).json(envelope({ request: patientView(sosRow(row.id)) }));
  });
  app.get('/api/v1/sos/mine', authenticated, (request, response) => {
    const row = store.db.prepare('SELECT * FROM sos_requests WHERE patient_id=? ORDER BY created_at DESC LIMIT 1').get(request.user.id);
    response.json(envelope({ request: row && (ACTIVE.includes(row.status) || row.status === 'no_unit' || Date.now() - Date.parse(row.created_at) < 3600000) ? patientView(row) : null }));
  });
  app.post('/api/v1/sos/:id/location', authenticated, (request, response) => {
    const row = sosRow(request.params.id), input = coordinate.parse(request.body);
    if (!row || row.patient_id !== request.user.id) return response.sendStatus(404);
    if (!ACTIVE.includes(row.status) && row.status !== 'no_unit') return response.status(409).json({ error: 'This request is closed' });
    store.db.prepare('UPDATE sos_requests SET lat=?, lng=?, accuracy=?, location_at=? WHERE id=?').run(input.lat, input.lng, input.accuracy ?? null, Date.now(), row.id);
    response.json(envelope({ updated: true }));
  });
  app.post('/api/v1/sos/:id/cancel', authenticated, (request, response) => {
    const row = sosRow(request.params.id);
    if (!row || row.patient_id !== request.user.id) return response.sendStatus(404);
    if (!ACTIVE.includes(row.status) && row.status !== 'no_unit') return response.status(409).json({ error: 'This request is closed' });
    release(row);
    store.db.prepare("UPDATE sos_requests SET status='cancelled', closed_at=?, timeline=? WHERE id=?").run(nowIso(), addStep(row, 'cancelled', 'by patient'), row.id);
    if (row.unit_id) crewOf(row.unit_id).forEach(id => notify(id, 'HFA SilverStrong: The emergency job was cancelled by the patient.'));
    store.audit(request.user.id, 'SOS_CANCELLED', { targetId: row.patient_id, details: { requestId: row.id }, ip: request.ip });
    response.json(envelope({ request: patientView(sosRow(row.id)) }));
  });

  // ───── Ambulance crew ─────
  const crewOnly = (request, response, next) => request.user.role === 'ambulance' && !request.impersonator ? next() : response.status(403).json({ error: 'Ambulance crew only' });
  app.get('/api/v1/crew/job', authenticated, crewOnly, (request, response) => {
    const mine = crewUnit(request.user.id);
    if (!mine) return response.json(envelope({ unit: null, job: null }));
    const row = store.db.prepare(`SELECT * FROM sos_requests WHERE unit_id=? AND status IN (${ACTIVE.map(() => '?').join(',')}) ORDER BY created_at DESC LIMIT 1`).get(mine.id, ...ACTIVE);
    let job = null;
    if (row) {
      const patient = store.user(row.patient_id), accepted = row.status !== 'offered';
      job = { id: row.id, status: row.status, createdAt: row.created_at, location: { lat: row.lat, lng: row.lng, accuracy: row.accuracy, at: new Date(row.location_at).toISOString() },
        distance: mine.lat !== null ? estimate(mine, row, row.status === 'offered' || row.status === 'accepted') : null,
        offerExpiresAt: row.status === 'offered' ? new Date(row.offered_at + ACCEPT_TIMEOUT_MS).toISOString() : null,
        actions: NEXT[row.status] || [], timeline: JSON.parse(row.timeline),
        // Who and what the crew needs only once they have taken the job.
        patient: accepted ? { name: patient?.name, phone: patient?.phone || patient?.whatsappNumber || '', summary: emergencySummary(row.patient_id) } : null };
      // Shown in the patient's "Who has opened my record", once an hour per crew member (the app polls).
      const recent = store.db.prepare("SELECT 1 FROM audit_log WHERE actor_id=? AND target_id=? AND action='SOS_SUMMARY_VIEWED' AND created_at>? LIMIT 1").get(request.user.id, row.patient_id, new Date(Date.now() - 3600000).toISOString());
      if (accepted && !recent) store.audit(request.user.id, 'SOS_SUMMARY_VIEWED', { targetId: row.patient_id, details: { requestId: row.id, unit: mine.call_sign }, ip: request.ip });
    }
    response.json(envelope({ unit: { id: mine.id, callSign: mine.call_sign, kind: mine.kind, operator: mine.operator, status: mine.status,
      positionAt: mine.position_at ? new Date(mine.position_at).toISOString() : null }, job }));
  });
  app.post('/api/v1/crew/position', authenticated, crewOnly, (request, response) => {
    const mine = crewUnit(request.user.id);
    if (!mine) return response.status(409).json({ error: 'Your account is not linked to an ambulance yet' });
    const input = coordinate.extend({ duty: z.enum(['available', 'off_duty']).optional() }).strict().parse(request.body);
    store.db.prepare('UPDATE ambulance_units SET lat=?, lng=?, position_at=? WHERE id=?').run(input.lat, input.lng, Date.now(), mine.id);
    if (input.duty && ['available', 'off_duty'].includes(mine.status)) setUnit(mine.id, input.duty);
    response.json(envelope({ status: unit(mine.id).status }));
  });
  app.post('/api/v1/crew/job/:id', authenticated, crewOnly, (request, response) => {
    const mine = crewUnit(request.user.id), row = sosRow(request.params.id);
    const input = z.object({ action: z.enum(['accept', 'decline', 'en_route', 'on_scene', 'transporting', 'handover']), destination: z.string().trim().max(160).regex(/^[^<>&"\u0000-\u001f]*$/).optional() }).strict().parse(request.body);
    if (!mine || !row || row.unit_id !== mine.id) return response.sendStatus(404);
    if (!(NEXT[row.status] || []).includes(input.action)) return response.status(409).json({ error: `Cannot ${input.action} a job that is ${row.status}` });
    if (input.action === 'decline') {
      setUnit(mine.id, 'available');
      store.audit(request.user.id, 'SOS_DECLINED', { targetId: row.patient_id, details: { requestId: row.id, unit: mine.call_sign }, ip: request.ip });
      offerNext(sosRow(row.id), request.user.id, `${mine.call_sign} declined`);
      return response.json(envelope({ declined: true }));
    }
    const status = CREW_STEPS[input.action];
    const done = status === 'completed';
    setUnit(mine.id, done ? 'available' : 'busy');
    store.db.prepare('UPDATE sos_requests SET status=?, destination=COALESCE(?, destination), closed_at=?, timeline=? WHERE id=?')
      .run(status, input.destination || null, done ? nowIso() : null, addStep(row, status, [mine.call_sign, input.destination].filter(Boolean).join(' · ')), row.id);
    store.audit(request.user.id, `SOS_${status.toUpperCase()}`, { targetId: row.patient_id, details: { requestId: row.id, unit: mine.call_sign }, ip: request.ip });
    if (['accepted', 'on_scene'].includes(status)) notify(row.patient_id, 'HFA SilverStrong: Update on your emergency request. Open the app to see it.');
    response.json(envelope({ status }));
  });

  // ───── Administrators: fleet register and SOS console ─────
  const unitInput = z.object({
    callSign: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9 ./-]+$/), kind: z.enum(['BLS', 'ALS']), operator: z.string().trim().min(2).max(160).regex(/^[^<>&"\u0000-\u001f]+$/),
    countryCode: z.string().length(2).transform(value => value.toUpperCase()), crewPhone: z.string().regex(/^\+[1-9]\d{7,14}$/),
    facilityId: z.string().max(100).optional(), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180)
  }).strict();
  const adminUnit = row => ({ id: row.id, callSign: row.call_sign, kind: row.kind, operator: row.operator, countryCode: row.country_code, crewPhone: row.crew_phone, status: row.status,
    lat: row.lat, lng: row.lng, positionAt: row.position_at ? new Date(row.position_at).toISOString() : null,
    crew: store.db.prepare('SELECT u.id, u.name, u.status FROM ambulance_crew c JOIN users u ON u.id=c.user_id WHERE c.unit_id=?').all(row.id).map(item => ({ ...item })) });
  app.get('/api/v1/admin/ambulance/units', authenticated, admin, (request, response) =>
    response.json(envelope({ units: store.db.prepare('SELECT * FROM ambulance_units ORDER BY call_sign').all().map(adminUnit) })));
  app.post('/api/v1/admin/ambulance/units', authenticated, admin, (request, response) => {
    const input = unitInput.parse(request.body);
    if (store.db.prepare('SELECT 1 FROM ambulance_units WHERE call_sign=?').get(input.callSign)) return response.status(409).json({ error: 'callSign: This call sign is already registered' });
    const id = `amb-${randomUUID()}`;
    store.db.prepare("INSERT INTO ambulance_units (id,call_sign,kind,operator,country_code,crew_phone,facility_id,status,lat,lng,position_at,created_at) VALUES (?,?,?,?,?,?,?,'off_duty',?,?,NULL,?)")
      .run(id, input.callSign, input.kind, input.operator, input.countryCode, input.crewPhone, input.facilityId || null, input.lat, input.lng, nowIso());
    store.audit(request.user.id, 'AMBULANCE_UNIT_ADDED', { targetId: id, details: { callSign: input.callSign }, ip: request.ip });
    response.status(201).json(envelope({ unit: adminUnit(unit(id)) }));
  });
  app.post('/api/v1/admin/ambulance/units/:id/crew', authenticated, admin, (request, response) => {
    const input = z.object({ userId: z.string().max(100) }).strict().parse(request.body), target = unit(request.params.id), crew = store.user(input.userId);
    if (!target) return response.sendStatus(404);
    if (!crew || crew.role !== 'ambulance') return response.status(400).json({ error: 'userId: Choose an ambulance crew account' });
    store.db.prepare('INSERT INTO ambulance_crew (user_id, unit_id) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET unit_id=excluded.unit_id').run(crew.id, target.id);
    store.audit(request.user.id, 'AMBULANCE_CREW_LINKED', { targetId: crew.id, details: { unit: target.call_sign }, ip: request.ip });
    response.json(envelope({ unit: adminUnit(unit(target.id)) }));
  });
  app.patch('/api/v1/admin/ambulance/units/:id', authenticated, admin, (request, response) => {
    const input = z.object({ status: z.enum(['available', 'off_duty']) }).strict().parse(request.body), target = unit(request.params.id);
    if (!target) return response.sendStatus(404);
    if (['offered', 'busy'].includes(target.status)) return response.status(409).json({ error: 'This ambulance is on a job' });
    setUnit(target.id, input.status);
    store.audit(request.user.id, 'AMBULANCE_UNIT_STATUS', { targetId: target.id, details: { status: input.status }, ip: request.ip });
    response.json(envelope({ unit: adminUnit(unit(target.id)) }));
  });
  app.get('/api/v1/admin/sos', authenticated, admin, (request, response) => {
    const rows = store.db.prepare('SELECT * FROM sos_requests ORDER BY created_at DESC LIMIT 100').all();
    response.json(envelope({ requests: rows.map(row => ({ ...patientView(row), patient: { id: row.patient_id, name: store.user(row.patient_id)?.name, phone: store.user(row.patient_id)?.phone || '' },
      location: { lat: row.lat, lng: row.lng, accuracy: row.accuracy, at: new Date(row.location_at).toISOString() },
      unitId: row.unit_id, open: ACTIVE.includes(row.status) || row.status === 'no_unit' })) }));
  });
  app.post('/api/v1/admin/sos/:id/assign', authenticated, admin, (request, response) => {
    const input = z.object({ unitId: z.string().max(100) }).strict().parse(request.body), row = sosRow(request.params.id), target = unit(input.unitId);
    if (!row || !target) return response.sendStatus(404);
    if (!['offered', 'no_unit', 'received'].includes(row.status)) return response.status(409).json({ error: 'The job has already been accepted' });
    if (target.status !== 'available' || !crewOf(target.id).length) return response.status(409).json({ error: 'Choose an available ambulance with an active crew' });
    if (row.unit_id && row.unit_id !== target.id) setUnit(row.unit_id, 'available');
    setUnit(target.id, 'offered');
    const est = target.lat !== null ? estimate(target, row, true) : { km: null };
    store.db.prepare("UPDATE sos_requests SET status='offered', unit_id=?, offered_at=?, start_km=?, tried=?, timeline=? WHERE id=?")
      .run(target.id, Date.now(), est.km, JSON.stringify([...new Set([...JSON.parse(row.tried), target.id])]), addStep(row, 'offered', `${target.call_sign} · assigned by dispatcher`), row.id);
    crewOf(target.id).forEach(id => notify(id, 'HFA SilverStrong: Emergency job offered to your ambulance. Open the crew app now to accept.'));
    store.audit(request.user.id, 'SOS_MANUAL_ASSIGN', { targetId: row.patient_id, details: { requestId: row.id, unit: target.call_sign }, ip: request.ip });
    response.json(envelope({ request: patientView(sosRow(row.id)) }));
  });
  app.post('/api/v1/admin/sos/:id/close', authenticated, admin, (request, response) => {
    const input = z.object({ note: z.string().trim().min(3).max(300).regex(/^[^<>&"\u0000-\u001f]+$/) }).strict().parse(request.body), row = sosRow(request.params.id);
    if (!row) return response.sendStatus(404);
    release(row);
    store.db.prepare("UPDATE sos_requests SET status='closed', closed_at=?, timeline=? WHERE id=?").run(nowIso(), addStep(row, 'closed', input.note), row.id);
    store.audit(request.user.id, 'SOS_CLOSED', { targetId: row.patient_id, details: { requestId: row.id }, ip: request.ip });
    response.json(envelope({ closed: true }));
  });
}

module.exports = { installDispatchRoutes, haversineKm, estimate, ACCEPT_TIMEOUT_MS, POSITION_FRESH_MS };
