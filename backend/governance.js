// Clinical governance registers, kept on the server:
// - Consent register (administrators / Data Protection Officer): every patient's current choices and their history.
//   Consents are personal data, not clinical content.
// - Clinician licence register (administrators): licence numbers sent at registration, verified against the
//   Ordre National des Médecins / nursing council, with an expiry date; expired or soon-expiring licences flagged.
// - Medication safety alerts: a patient's recorded allergies checked against their medicines, doctors' plans and
//   pharmacy orders. Alerts are clinical, so only the patient's own clinicians see and resolve them; administrators
//   see counts only. Every view and decision is audited.
const { z } = require('zod');
const { digest } = require('./store');
const { filesConfigured } = require('./files');
const { healthRecord } = require('./records');
const { patientRecords, careTeam } = require('./clinical');

// Allergy groups and the medicines that belong to them (lowercase words, French and English spellings).
const ALLERGY_GROUPS = {
  penicillin: { label: 'Penicillin', allergy: /penicil|pénicil|amoxi|ampici/i, drugs: ['penicillin', 'pénicilline', 'amoxicillin', 'amoxicilline', 'ampicillin', 'ampicilline', 'augmentin', 'amoxiclav', 'cloxacillin', 'cloxacilline', 'flucloxacillin', 'benzathine', 'extencilline'] },
  cephalosporin: { label: 'Cephalosporin', allergy: /c[ée]pha|ceftri|cefix|cefur/i, drugs: ['ceftriaxone', 'cefixime', 'cefuroxime', 'cefalexin', 'céfalexine', 'cephalexin', 'cefpodoxime'] },
  sulfonamide: { label: 'Sulfonamide (sulfa)', allergy: /sulf|bactrim|cotrimox/i, drugs: ['cotrimoxazole', 'co-trimoxazole', 'bactrim', 'sulfamethoxazole', 'sulfadoxine', 'fansidar', 'sulfadiazine'] },
  nsaid: { label: 'Aspirin / anti-inflammatory (NSAID)', allergy: /aspirin|aspirine|ibuprof|nsaid|ains|diclof|anti-?inflam/i, drugs: ['aspirin', 'aspirine', 'ibuprofen', 'ibuprofène', 'diclofenac', 'diclofénac', 'naproxen', 'ketoprofen', 'kétoprofène', 'indomethacin', 'piroxicam'] },
  quinine: { label: 'Quinine', allergy: /quinin/i, drugs: ['quinine', 'quinimax'] },
  artemisinin: { label: 'Artemisinin', allergy: /artem|art[ée]su|coartem/i, drugs: ['artemether', 'artéméther', 'artesunate', 'artésunate', 'coartem', 'artemisinin', 'artémisinine'] },
  chloroquine: { label: 'Chloroquine', allergy: /chloroquin|nivaquin/i, drugs: ['chloroquine', 'nivaquine', 'hydroxychloroquine'] },
  metronidazole: { label: 'Metronidazole', allergy: /m[ée]tronid|flagyl/i, drugs: ['metronidazole', 'métronidazole', 'flagyl'] },
  codeine: { label: 'Codeine / opioid', allergy: /cod[ée]in|morphin|tramad|opio/i, drugs: ['codeine', 'codéine', 'morphine', 'tramadol'] }
};

/** Allergy groups a patient has, from the 5-step health profile (drug allergies by name). */
function allergyGroups(health) {
  const names = (health?.medical?.drugAllergies || []).map(item => ({ name: item.name, severity: item.severity }));
  const groups = Object.entries(ALLERGY_GROUPS).flatMap(([key, group]) => names.filter(item => group.allergy.test(item.name) || group.drugs.some(drug => item.name.toLowerCase().includes(drug))).map(item => ({ key, ...group, recorded: item.name, severity: item.severity })));
  // Penicillin allergy: cephalosporins can cross-react, so they are flagged for review.
  for (const group of groups.filter(item => item.key === 'penicillin')) if (!groups.some(item => item.key === 'cephalosporin'))
    groups.push({ key: 'cephalosporin', ...ALLERGY_GROUPS.cephalosporin, label: 'Penicillin (possible cross-reaction with cephalosporins)', recorded: group.recorded, severity: 'moderate' });
  return groups;
}
const mentions = (text, drugs) => drugs.find(drug => new RegExp(`(^|[^a-zà-ÿ])${drug.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}([^a-zà-ÿ]|$)`, 'i').test(String(text || '')));

/** Allergy conflicts for one patient, from every place a medicine can appear. */
function alertsFor(config, store, patient) {
  const health = healthRecord(config, store, patient.id);
  const groups = allergyGroups(health);
  if (!groups.length) return [];
  const sources = [
    ...(health.medical.medications || []).map((item, index) => ({ source: 'profile_medication', id: `med${index}`, text: [item.name, item.dose].filter(Boolean).join(' '), date: item.since || null })),
    ...patientRecords(config, store, patient.id).doctorReports.map(item => ({ source: 'doctor_report', id: item.id, text: `${item.summary || ''} ${item.plan || ''}`, date: item.createdAt || item.consultationDate || null })),
    ...store.db.prepare("SELECT o.id, i.name, i.strength, o.created_at FROM pharmacy_orders o JOIN pharmacy_items i ON i.id=o.item_id WHERE o.patient_id=? AND o.status!='cancelled'").all(patient.id)
      .map(row => ({ source: 'pharmacy_order', id: row.id, text: `${row.name} ${row.strength}`, date: row.created_at }))
  ];
  const alerts = [];
  for (const group of groups) for (const item of sources) {
    const drug = mentions(item.text, group.drugs);
    if (!drug) continue;
    const key = digest(`${patient.id}|${group.key}|${item.source}|${item.id}|${drug}`).slice(0, 32);
    alerts.push({ key, patientId: patient.id, allergy: group.label, recorded: group.recorded, drug, source: item.source, sourceId: item.id, date: item.date,
      severity: ['severe', 'anaphylaxis'].includes(group.severity) ? 'critical' : 'review' });
  }
  return alerts;
}

function installGovernanceRoutes(app, config, store, authenticated, admin) {
  store.db.exec(`CREATE TABLE IF NOT EXISTS safety_alert_resolutions (
    alert_key TEXT PRIMARY KEY, patient_id TEXT NOT NULL, resolved_by TEXT NOT NULL, note TEXT NOT NULL, resolved_at TEXT NOT NULL
  )`);
  const ok = (data, message = 'OK') => ({ success: true, data, message, timestamp: new Date().toISOString() });
  const storage = (request, response, next) => filesConfigured(config) ? next() : response.status(503).json({ error: 'Encrypted health record storage is not configured' });
  const patients = () => store.db.prepare("SELECT id FROM users WHERE role='patient' AND status!='deleted'").all().map(row => store.user(row.id));
  const resolution = key => store.db.prepare('SELECT r.*, u.name AS resolver FROM safety_alert_resolutions r LEFT JOIN users u ON u.id=r.resolved_by WHERE alert_key=?').get(key);

  // ───── Consent register ─────
  app.get('/api/v1/admin/consents', authenticated, admin, storage, (request, response) => {
    const history = store.db.prepare("SELECT user_id, COUNT(*) AS changes, MAX(created_at) AS lastChange FROM consent_events GROUP BY user_id").all();
    const byUser = new Map(history.map(row => [row.user_id, row]));
    const rows = patients().map(patient => {
      const consents = healthRecord(config, store, patient.id)?.consents || null;
      return { patientId: patient.id, name: patient.name, hfaId: patient.hfaId, consents: consents && { dataSharing: consents.dataSharing, research: consents.research, sms: consents.sms, ministry: consents.ministry, whatsapp: consents.whatsapp, version: consents.version, recordedAt: consents.recordedAt },
        whatsapp: patient.whatsappNotificationsConsent, changes: byUser.get(patient.id)?.changes || 0, lastChange: byUser.get(patient.id)?.lastChange || null };
    });
    store.audit(request.user.id, 'CONSENT_REGISTER_VIEWED', { details: { patients: rows.length }, ip: request.ip });
    response.json(ok({ patients: rows }));
  });

  // ───── Clinician licence register ─────
  const licenceView = user => {
    const verification = user.licenceVerification || null, expiry = verification?.expiresOn || null;
    const days = expiry ? Math.floor((Date.parse(expiry) - Date.now()) / 86400000) : null;
    return { id: user.id, name: user.name, role: user.role, hfaId: user.hfaId, specialty: user.specialty || user.department || null, hospital: user.facilityName || user.hospital || null, status: user.status,
      licenseNo: user.licenseNo || null, verification, alert: !verification ? 'unverified' : verification.status !== 'verified' ? verification.status : days !== null && days < 0 ? 'expired' : days !== null && days <= 60 ? 'expiring' : null, daysToExpiry: days };
  };
  app.get('/api/v1/admin/clinicians', authenticated, admin, (request, response) => {
    const rows = store.db.prepare("SELECT id FROM users WHERE role IN ('doctor','nurse') AND status!='deleted' ORDER BY name").all().map(row => licenceView(store.user(row.id)));
    response.json(ok({ clinicians: rows }));
  });
  app.post('/api/v1/admin/clinicians/:id/licence', authenticated, admin, (request, response) => {
    const input = z.object({ status: z.enum(['verified', 'rejected']), expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), authority: z.string().trim().max(120).regex(/^[^<>]*$/).optional(), note: z.string().trim().max(500).regex(/^[^<>]*$/).default('') }).strict().parse(request.body);
    const clinician = store.user(request.params.id);
    if (!clinician || !['doctor', 'nurse'].includes(clinician.role)) return response.sendStatus(404);
    if (input.status === 'verified' && !clinician.licenseNo) return response.status(409).json({ error: 'This clinician has no licence number on file' });
    if (input.status === 'verified' && (!input.expiresOn || input.expiresOn <= new Date().toISOString().slice(0, 10))) return response.status(400).json({ error: 'expiresOn: Enter the licence expiry date (in the future)' });
    // Licences are renewed every few years: more than 10 years ahead is almost always a typo (2206 for 2026).
    if (input.expiresOn && (input.expiresOn > `${new Date().getFullYear() + 10}-12-31` || Number.isNaN(Date.parse(input.expiresOn)) || new Date(`${input.expiresOn}T00:00:00Z`).toISOString().slice(0, 10) !== input.expiresOn)) return response.status(400).json({ error: 'expiresOn: check the expiry date (a real date within 10 years)' });
    const verification = { status: input.status, expiresOn: input.expiresOn || null, authority: input.authority || (clinician.role === 'doctor' ? 'Ordre National des Médecins du Cameroun' : 'Nursing council'), note: input.note, by: request.user.id, at: new Date().toISOString() };
    store.updateUser(clinician.id, { profile: { licenceVerification: verification } });
    store.audit(request.user.id, input.status === 'verified' ? 'LICENCE_VERIFIED' : 'LICENCE_REJECTED', { targetId: clinician.id, details: { expiresOn: verification.expiresOn }, ip: request.ip });
    response.json(ok({ clinician: licenceView(store.user(clinician.id)) }));
  });

  // ───── Medication safety alerts ─────
  app.get('/api/v1/safety/alerts', authenticated, storage, (request, response) => {
    const actor = request.user;
    if (actor.role === 'admin') {
      // Oversight without clinical content.
      const all = patients().flatMap(patient => alertsFor(config, store, patient));
      const open = all.filter(alert => !resolution(alert.key));
      return response.json(ok({ oversightOnly: true, open: open.length, critical: open.filter(alert => alert.severity === 'critical').length, resolved: all.length - open.length }));
    }
    if (!['doctor', 'nurse'].includes(actor.role)) return response.status(403).json({ error: 'Clinicians only' });
    const team = careTeam(store, actor);
    const alerts = patients().filter(patient => team.has(patient.id)).flatMap(patient => alertsFor(config, store, patient).map(alert => {
      const done = resolution(alert.key);
      return { ...alert, patientName: patient.name, hfaId: patient.hfaId, resolved: !!done, resolvedBy: done?.resolver || null, resolvedAt: done?.resolved_at || null, note: done?.note || '' };
    })).sort((a, b) => a.resolved - b.resolved || (a.severity === 'critical' ? -1 : 1) - (b.severity === 'critical' ? -1 : 1));
    if (alerts.length) store.audit(actor.id, 'SAFETY_ALERTS_VIEWED', { details: { count: alerts.length }, ip: request.ip });
    response.json(ok({ alerts }));
  });
  app.post('/api/v1/safety/alerts/:key/resolve', authenticated, storage, (request, response) => {
    const actor = request.user;
    if (!['doctor', 'nurse'].includes(actor.role) || request.impersonator) return response.status(403).json({ error: 'Clinicians only' });
    const { note } = z.object({ note: z.string().trim().min(5).max(500).regex(/^[^<>]*$/, 'Remove < and > characters') }).strict().parse(request.body);
    const team = careTeam(store, actor);
    const alert = patients().filter(patient => team.has(patient.id)).flatMap(patient => alertsFor(config, store, patient)).find(item => item.key === request.params.key);
    if (!alert) return response.sendStatus(404);
    store.db.prepare('INSERT INTO safety_alert_resolutions VALUES (?,?,?,?,?) ON CONFLICT(alert_key) DO NOTHING').run(alert.key, alert.patientId, actor.id, note, new Date().toISOString());
    store.audit(actor.id, 'SAFETY_ALERT_RESOLVED', { targetId: alert.patientId, details: { allergy: alert.allergy, drug: alert.drug }, ip: request.ip });
    response.json(ok({ resolved: true }));
  });
}

module.exports = { installGovernanceRoutes, alertsFor, allergyGroups, ALLERGY_GROUPS };
