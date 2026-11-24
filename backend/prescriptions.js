// E-prescriptions and lab test orders, stored as clinical records (backend/clinical.js) with extra rules:
//  • Prescriptions: a doctor caring for the patient writes them and sends them to a validated pharmacy. The server
//    re-runs the safety screen (hfa-medsafety.js) against the patient's recorded allergies and medicines; a major
//    finding needs a written override reason. Afterwards only these changes are possible: the pharmacy marks it
//    ready then collected, the patient asks for a refill, the prescriber cancels it while it is still waiting.
//  • Lab orders: a doctor orders a test from a laboratory technician, who marks the sample received and the order
//    completed (linking the uploaded result); the doctor can cancel it before it is completed.
// The server stamps who the record is for (name, HFA number) and which pharmacy or laboratory it went to, so the
// pharmacy or laboratory can read it without being given the patient's account.
const { z } = require('zod');
const MedSafety = require('../hfa-medsafety.js');
const { healthRecord } = require('./records');

const text = (max, min = 1) => z.string().trim().min(min).max(max).regex(/^[^<>"`\u0000-\u001f]+$/, 'remove < > " and ` characters');
const item = z.object({ drug: text(80, 2), dose: text(40), frequency: text(60), duration: text(40), quantity: z.number().int().min(1).max(1000), instructions: text(200).optional() }).strict();

const prescriptionSchema = z.object({
  patientId: z.string().max(100), doctorId: z.string().max(100), pharmacistId: z.string().max(100),
  items: z.array(item).min(1).max(10), notes: text(1000).optional(), overrideReason: text(500, 10).optional(),
  status: z.enum(['sent', 'ready', 'collected', 'cancelled']).optional(), refillRequestedAt: z.string().max(40).nullable().optional()
}).passthrough();
const labOrderSchema = z.object({
  patientId: z.string().max(100), doctorId: z.string().max(100), labTechId: z.string().max(100),
  testType: text(200, 2), priority: z.enum(['routine', 'urgent']), clinicalInfo: text(1000).optional(),
  status: z.enum(['ordered', 'sample_received', 'completed', 'cancelled']).optional(), resultId: z.string().max(100).nullable().optional()
}).passthrough();

const PRESCRIPTION_NEXT = { sent: ['ready', 'cancelled'], ready: ['collected'] };
const LAB_NEXT = { ordered: ['sample_received', 'completed', 'cancelled'], sample_received: ['completed', 'cancelled'] };
const pharmacyReady = user => user?.role === 'pharmacist' && user.status === 'active' && !!user.pharmacyValidatedAt;

/** Returns { data } to store, or { error, status, findings } to refuse. */
function prescriptionRules(config, store, actor, input, current) {
  const now = new Date().toISOString();
  if (!current) {
    const data = prescriptionSchema.parse(input);
    if (actor.role !== 'doctor') return { error: 'Only doctors can write prescriptions', status: 403 };
    const pharmacy = store.user(data.pharmacistId), patient = store.user(data.patientId);
    if (!pharmacyReady(pharmacy)) return { error: 'pharmacistId: Choose a validated pharmacy' };
    let context = { drugAllergies: [], medicines: [] };
    try { context = MedSafety.patientContext(healthRecord(config, store, data.patientId)); } catch (error) { /* no profile yet */ }
    const screen = MedSafety.check(data.items, context);
    const major = screen.findings.filter(finding => finding.level === 'major');
    if (major.length && !data.overrideReason) return { error: 'Major safety warnings: review them and give a reason to prescribe anyway', status: 409, findings: screen.findings };
    return { data: { ...data, status: 'sent', safety: screen.findings, safetyRulesVersion: screen.rulesVersion, overridden: major.length > 0,
      overrideReason: major.length ? data.overrideReason : undefined, refillRequestedAt: null,
      patientName: patient?.name || '', patientHfaId: patient?.hfaId || '', pharmacyName: pharmacy.pharmacyName || pharmacy.name, pharmacyAddress: pharmacy.pharmacyAddress || '',
      doctorName: actor.name, createdAt: now, history: [{ status: 'sent', at: now, by: actor.id }] } };
  }
  const data = { ...input };
  const keep = { ...current };
  if (actor.id === current.pharmacistId) {
    if (!pharmacyReady(actor)) return { error: 'An administrator-validated pharmacist is required', status: 403 };
    if (!(PRESCRIPTION_NEXT[current.status] || []).filter(status => status !== 'cancelled').includes(data.status)) return { error: `A ${current.status} prescription cannot become ${data.status}`, status: 409 };
    return { data: { ...keep, status: data.status, [`${data.status}At`]: now, history: [...(current.history || []), { status: data.status, at: now, by: actor.id }] } };
  }
  if (actor.id === current.patientId) {
    if (data.status !== current.status) return { error: 'Patients cannot change the prescription status', status: 403 };
    if (current.status !== 'collected') return { error: 'A refill can be requested once the medicines are collected', status: 409 };
    if (current.refillRequestedAt) return { error: 'A refill was already requested', status: 409 };
    return { data: { ...keep, refillRequestedAt: now } };
  }
  if (actor.id === current.doctorId) {
    if (data.status === 'cancelled' && current.status === 'sent') return { data: { ...keep, status: 'cancelled', cancelledAt: now, history: [...(current.history || []), { status: 'cancelled', at: now, by: actor.id }] } };
    if (data.refillHandledAt && current.refillRequestedAt && !current.refillHandledAt) return { data: { ...keep, refillHandledAt: now } };
    return { error: 'A prescription cannot be edited; cancel it and write a new one', status: 409 };
  }
  return { error: 'You cannot change this prescription', status: 403 };
}

function labOrderRules(store, actor, input, current) {
  const now = new Date().toISOString();
  if (!current) {
    const data = labOrderSchema.parse(input);
    if (actor.role !== 'doctor') return { error: 'Only doctors can order lab tests', status: 403 };
    const lab = store.user(data.labTechId), patient = store.user(data.patientId);
    if (lab?.role !== 'labtech' || lab.status !== 'active') return { error: 'labTechId: Choose an active laboratory' };
    return { data: { ...data, status: 'ordered', resultId: null, patientName: patient?.name || '', patientHfaId: patient?.hfaId || '',
      doctorName: actor.name, laboratory: lab.laboratory || lab.name, orderedAt: now, history: [{ status: 'ordered', at: now, by: actor.id }] } };
  }
  const data = { ...input };
  if (data.status === current.status) return { error: 'Nothing to change', status: 409 };
  const allowed = actor.id === current.labTechId ? ['sample_received', 'completed'] : actor.id === current.doctorId ? ['cancelled'] : [];
  if (!allowed.includes(data.status) || !(LAB_NEXT[current.status] || []).includes(data.status)) return { error: `You cannot move this order from ${current.status} to ${data.status}`, status: 403 };
  if (data.status === 'completed') {
    const result = data.resultId && store.db.prepare("SELECT patient_id FROM clinical_records WHERE collection='labResults' AND id=?").get(data.resultId);
    if (!result || result.patient_id !== current.patientId) return { error: 'resultId: Upload the result for this patient first' };
  }
  return { data: { ...current, status: data.status, resultId: data.status === 'completed' ? data.resultId : current.resultId, [`${data.status}At`]: now,
    history: [...(current.history || []), { status: data.status, at: now, by: actor.id }] } };
}

function installPrescriptionRoutes(app, store, authenticated) {
  // Validated pharmacies a doctor can send a prescription to: public business details only.
  app.get('/api/v1/pharmacies', authenticated, (request, response) => {
    if (!['doctor', 'admin'].includes(request.user.role)) return response.sendStatus(403);
    const pharmacies = store.db.prepare("SELECT id FROM users WHERE role='pharmacist' AND status='active'").all()
      .map(row => store.user(row.id)).filter(pharmacyReady)
      .map(user => ({ id: user.id, pharmacyName: user.pharmacyName || user.name, pharmacyAddress: user.pharmacyAddress || '', pharmacyLocation: user.pharmacyLocation || '' }));
    response.json({ success: true, data: { pharmacies }, message: 'OK', timestamp: new Date().toISOString() });
  });
}

module.exports = { prescriptionRules, labOrderRules, installPrescriptionRoutes, prescriptionSchema, labOrderSchema };
