const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Store } = require('../store');
const { createApp } = require('../server');
const { saveHealthRecord } = require('../records');

const config = { origin: 'http://localhost:8080', ready: false, fileEncryptionKey: '9c'.repeat(32) };

async function harness() {
  const store = new Store();
  const make = (name, email, role) => store.createUser({ name, email, role }, 'test-password-hash', 'active');
  const doctor = make('Synthetic Prescriber', 'rx-doctor@example.invalid', 'doctor');
  const stranger = make('Synthetic Other Doctor', 'rx-stranger@example.invalid', 'doctor');
  const patient = make('Synthetic Rx Patient', 'rx-patient@example.invalid', 'patient');
  const pharmacy = make('Synthetic Pharmacist', 'rx-pharmacy@example.invalid', 'pharmacist');
  const unvalidated = make('Synthetic New Pharmacist', 'rx-new-pharmacy@example.invalid', 'pharmacist');
  const lab = make('Synthetic Lab Tech', 'rx-lab@example.invalid', 'labtech');
  const renewalDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  store.db.prepare("UPDATE users SET assigned_doctor=?, profile=json_set(profile,'$.subscription',json(?)) WHERE id=?").run(doctor.id, JSON.stringify({ status: 'active', tier: 'standard', renewalDate }), patient.id);
  store.db.prepare("UPDATE users SET profile=json_set(profile,'$.pharmacyValidatedAt',?,'$.pharmacyName','Synthetic Limbe Pharmacy') WHERE id=?").run(new Date().toISOString(), pharmacy.id);
  for (const user of [doctor, stranger]) store.db.prepare("UPDATE users SET profile=json_set(profile,'$.onboardingRequired',json('false')) WHERE id=?").run(user.id);
  const server = createApp(config, store, {}).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  saveHealthRecord(config, store, patient.id, { medical: { drugAllergies: [{ name: 'Penicillin', severity: 'severe' }], medications: [{ name: 'Warfarin', dose: '5 mg' }] } });
  const base = `http://127.0.0.1:${server.address().port}`;
  const sessions = new Map([doctor, stranger, patient, pharmacy, unvalidated, lab].map(user => [user.id, store.createSession(user.id)]));
  const call = async (user, method, path, body) => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-HFA-Request': '1', Origin: config.origin, Cookie: `hfa_session=${sessions.get(user.id)}` }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  };
  const put = (user, collection, id, data, baseVersion = 0) => call(user, 'PUT', `/api/v1/clinical/${collection}/${id}`, { data, baseVersion });
  const records = async (user, collection) => (await call(user, 'GET', '/api/v1/clinical')).body.data.records.filter(record => record.collection === collection);
  return { store, server, doctor, stranger, patient, pharmacy, unvalidated, lab, call, put, records };
}

test('a prescription is screened on the server, sent to the pharmacy and tracked to collection and refill', async () => {
  const h = await harness();
  const { doctor, patient, pharmacy, put, records, call } = h;
  try {
    const onboarding = (await call(doctor, 'GET', '/api/v1/pharmacies'));
    if (onboarding.status === 403) assert.fail('doctor could not list pharmacies: ' + JSON.stringify(onboarding.body));
    assert.deepEqual(onboarding.body.data.pharmacies.map(item => item.pharmacyName), ['Synthetic Limbe Pharmacy'], 'only validated pharmacies are listed');

    const prescription = { patientId: patient.id, doctorId: doctor.id, pharmacistId: pharmacy.id, items: [{ drug: 'Amoxicillin', dose: '500 mg', frequency: 'Three times daily', duration: '7 days', quantity: 21 }] };
    const blocked = await put(doctor, 'prescriptions', 'rx-test-1', prescription);
    assert.equal(blocked.status, 409, 'penicillin allergy blocks amoxicillin without a reason');
    assert.ok(blocked.body.findings.some(finding => finding.level === 'major' && finding.kind === 'allergy'));

    const safe = await put(doctor, 'prescriptions', 'rx-test-1', { ...prescription, items: [{ drug: 'Paracetamol', dose: '500 mg', frequency: 'Every 6 hours', duration: '5 days', quantity: 20 }], status: 'collected', safety: [] });
    assert.equal(safe.status, 201);
    assert.equal(safe.body.data.data.status, 'sent', 'the server sets the starting status');
    assert.deepEqual(safe.body.data.data.safety, [], 'the server computes the safety findings');
    assert.equal(safe.body.data.data.patientName, 'Synthetic Rx Patient');
    assert.equal(safe.body.data.data.pharmacyName, 'Synthetic Limbe Pharmacy');

    const override = await put(doctor, 'prescriptions', 'rx-test-2', { ...prescription, items: [{ drug: 'Ibuprofen', dose: '400 mg', frequency: 'Twice daily', duration: '3 days', quantity: 6 }], overrideReason: 'Short course, INR checked today, gastro-protection given' });
    assert.equal(override.status, 201);
    assert.equal(override.body.data.data.overridden, true, 'warfarin + ibuprofen is recorded as an overridden major warning');

    const seen = await records(pharmacy, 'prescriptions');
    assert.deepEqual(seen.map(record => record.id).sort(), ['rx-test-1', 'rx-test-2'], 'the pharmacy sees prescriptions sent to it');
    const rx = seen.find(record => record.id === 'rx-test-1');
    assert.equal((await put(patient, 'prescriptions', 'rx-test-1', { ...rx.data }, rx.version)).status, 409, 'no refill before collection');
    const ready = await put(pharmacy, 'prescriptions', 'rx-test-1', { ...rx.data, status: 'ready' }, rx.version);
    assert.equal(ready.body.data.data.status, 'ready');
    assert.equal((await put(pharmacy, 'prescriptions', 'rx-test-1', { ...ready.body.data.data, status: 'sent' }, ready.body.data.version)).status, 409, 'status only moves forward');
    const collected = await put(pharmacy, 'prescriptions', 'rx-test-1', { ...ready.body.data.data, status: 'collected', items: [{ drug: 'Morphine', dose: '10 mg', frequency: 'x', duration: 'x', quantity: 99 }] }, ready.body.data.version);
    assert.equal(collected.body.data.data.items[0].drug, 'Paracetamol', 'the pharmacy cannot change what was prescribed');
    assert.equal((await put(patient, 'prescriptions', 'rx-test-1', { ...collected.body.data.data, status: 'sent' }, collected.body.data.version)).status, 403);
    const refill = await put(patient, 'prescriptions', 'rx-test-1', { ...collected.body.data.data }, collected.body.data.version);
    assert.ok(refill.body.data.data.refillRequestedAt);
  } finally { h.server.close(); h.store.close(); }
});

test('only the patient’s doctors prescribe, and only to validated pharmacies', async () => {
  const h = await harness();
  const { doctor, stranger, patient, pharmacy, unvalidated, put } = h;
  try {
    const items = [{ drug: 'Paracetamol', dose: '500 mg', frequency: 'Every 6 hours', duration: '5 days', quantity: 20 }];
    assert.equal((await put(stranger, 'prescriptions', 'rx-x', { patientId: patient.id, doctorId: stranger.id, pharmacistId: pharmacy.id, items })).status, 403);
    assert.equal((await put(patient, 'prescriptions', 'rx-y', { patientId: patient.id, doctorId: doctor.id, pharmacistId: pharmacy.id, items })).status, 403);
    assert.equal((await put(doctor, 'prescriptions', 'rx-z', { patientId: patient.id, doctorId: doctor.id, pharmacistId: unvalidated.id, items })).status, 400);
  } finally { h.server.close(); h.store.close(); }
});

test('a lab order reaches the laboratory and is completed only with a result for that patient', async () => {
  const h = await harness();
  const { doctor, patient, lab, put, records } = h;
  try {
    const order = await put(doctor, 'labOrders', 'lo-test-1', { patientId: patient.id, doctorId: doctor.id, labTechId: lab.id, testType: 'Full blood count', priority: 'urgent', clinicalInfo: 'Fatigue, query anaemia' });
    assert.equal(order.status, 201);
    assert.equal(order.body.data.data.status, 'ordered');
    const worklist = await records(lab, 'labOrders');
    assert.equal(worklist.length, 1);
    assert.equal(worklist[0].data.patientName, 'Synthetic Rx Patient');
    const early = await put(lab, 'labOrders', 'lo-test-1', { ...worklist[0].data, status: 'completed', resultId: 'nope' }, worklist[0].version);
    assert.equal(early.status, 400);
    const received = await put(lab, 'labOrders', 'lo-test-1', { ...worklist[0].data, status: 'sample_received' }, worklist[0].version);
    assert.equal(received.body.data.data.status, 'sample_received');
    const result = await put(lab, 'labResults', 'lr-test-1', { patientId: patient.id, labTechId: lab.id, specialistDoctorId: doctor.id, testType: 'Full blood count', status: 'pending', fileName: 'fbc.pdf', fileData: 'data:application/pdf;base64,JVBERi0xLjQK' });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    const done = await put(lab, 'labOrders', 'lo-test-1', { ...received.body.data.data, status: 'completed', resultId: 'lr-test-1' }, received.body.data.version);
    assert.equal(done.body.data.data.status, 'completed');
    assert.equal((await put(doctor, 'labOrders', 'lo-test-1', { ...done.body.data.data, status: 'cancelled' }, done.body.data.version)).status, 403, 'a completed order cannot be cancelled');

    // Uploading a result that names the order completes it in one step.
    await put(doctor, 'labOrders', 'lo-test-2', { patientId: patient.id, doctorId: doctor.id, labTechId: lab.id, testType: 'Malaria RDT', priority: 'routine' });
    await put(lab, 'labResults', 'lr-test-2', { patientId: patient.id, labTechId: lab.id, specialistDoctorId: doctor.id, testType: 'Malaria RDT', status: 'pending', orderId: 'lo-test-2', fileName: 'rdt.pdf', fileData: 'data:application/pdf;base64,JVBERi0xLjQK' });
    const linked = (await records(doctor, 'labOrders')).find(record => record.id === 'lo-test-2');
    assert.equal(linked.data.status, 'completed');
    assert.equal(linked.data.resultId, 'lr-test-2');
  } finally { h.server.close(); h.store.close(); }
});
