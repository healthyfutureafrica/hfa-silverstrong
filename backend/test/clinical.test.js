const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Store, hashPassword } = require('../store');
const { createApp } = require('../server');

const config = { origin: 'http://localhost:8080', ready: false, fileEncryptionKey: '8b'.repeat(32) };

async function startServer(store) {
  const server = createApp(config, store, {}).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, body, cookie, method = body === undefined ? 'GET' : 'PUT') => fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', 'X-HFA-Request': '1', Origin: config.origin, ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { request, close: () => new Promise(resolve => server.close(resolve)) };
}
const cookieOf = response => response.headers.get('set-cookie').split(';')[0];

test('clinical records are shared between patient and care team on any device, with access decided by the server', async () => {
  const store = new Store();
  const app = await startServer(store);
  try {
    const make = async (role, name, email, profile = {}) => store.createUser({ name, email, role, profile }, await hashPassword('Synthetic-pass-123'), 'active');
    const doctor = await make('doctor', 'Dr Synthetic Shared', 'shared-doc@example.invalid', { hospital: 'Synthetic Shared Hospital' });
    const specialist = await make('doctor', 'Dr Synthetic Specialist', 'spec@example.invalid', { hospital: 'Synthetic Specialist Clinic' });
    const outsider = await make('doctor', 'Dr Synthetic Outsider', 'outsider@example.invalid', { hospital: 'Synthetic Other Hospital' });
    const lab = await make('labtech', 'Synthetic Lab', 'lab@example.invalid', { laboratory: 'Synthetic Lab' });
    await make('admin', 'Synthetic Admin', 'admin-clin@example.invalid');
    const patient = await make('patient', 'Synthetic Patient Ako', 'ako@example.invalid');
    const other = await make('patient', 'Synthetic Patient Bih', 'bih@example.invalid');
    store.updateUser(patient.id, { assignedDoctor: doctor.id });
    const login = async email => cookieOf(await app.request('/api/auth/login', { email, password: 'Synthetic-pass-123' }, undefined, 'POST'));
    const [patientCookie, doctorCookie, specialistCookie, outsiderCookie, labCookie, adminCookie, otherCookie] = await Promise.all(
      ['ako@example.invalid', 'shared-doc@example.invalid', 'spec@example.invalid', 'outsider@example.invalid', 'lab@example.invalid', 'admin-clin@example.invalid', 'bih@example.invalid'].map(login));
    const put = (cookie, collection, id, data, baseVersion = 0) => app.request(`/api/v1/clinical/${collection}/${id}`, { data, baseVersion }, cookie);
    const list = async cookie => (await (await app.request('/api/v1/clinical', undefined, cookie)).json()).data.records;

    // The patient books on their phone; the doctor sees it on another device.
    const appointment = { patientId: patient.id, doctorId: doctor.id, nurseId: '', date: '2026-11-02', time: '09:30', status: 'scheduled', notes: 'Cough for a week', mode: 'video' };
    assert.equal((await put(patientCookie, 'appointments', 'apt-1', appointment)).status, 201);
    assert.equal((await list(doctorCookie)).find(item => item.id === 'apt-1').data.notes, 'Cough for a week');
    // Another patient cannot book in someone else's name or see it.
    assert.equal((await put(otherCookie, 'appointments', 'apt-x', { ...appointment, patientId: patient.id })).status, 403);
    assert.equal((await list(otherCookie)).length, 0);
    // A doctor outside the patient's care cannot read it, nor gain access by naming themselves in a new record.
    assert.equal((await list(outsiderCookie)).length, 0);
    assert.equal((await put(outsiderCookie, 'appointments', 'apt-2', { ...appointment, doctorId: outsider.id })).status, 403);
    assert.equal((await put(outsiderCookie, 'careNotes', 'cn-x', { patientId: patient.id, nurseId: outsider.id, text: 'x' })).status, 403);
    // Administrators see the schedule but not the clinical notes; they cannot read messages.
    const adminView = (await list(adminCookie)).find(item => item.id === 'apt-1');
    assert.equal(adminView.data.date, '2026-11-02');
    assert.equal('notes' in adminView.data, false);

    // Optimistic concurrency: a stale write is refused with the current copy.
    assert.equal((await put(doctorCookie, 'appointments', 'apt-1', { ...appointment, status: 'completed' }, 1)).status, 200);
    const stale = await put(patientCookie, 'appointments', 'apt-1', { ...appointment, notes: 'edited' }, 1);
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).current.data.status, 'completed');
    assert.equal((await put(doctorCookie, 'appointments', 'apt-1', { ...appointment, patientId: other.id }, 2)).status, 403, 'who a record is about never changes');
    // Someone outside the record learns nothing from a write attempt, even a stale one.
    const probe = await put(outsiderCookie, 'appointments', 'apt-1', appointment, 1);
    assert.equal(probe.status, 404);
    // An administrator rescheduling (schedule fields only) never wipes the clinical notes they cannot see.
    assert.equal((await put(adminCookie, 'appointments', 'apt-1', { patientId: patient.id, doctorId: doctor.id, date: '2026-11-04', time: '10:00', status: 'completed' }, 2)).status, 200);
    const afterAdmin = (await list(doctorCookie)).find(item => item.id === 'apt-1');
    assert.equal(afterAdmin.data.date, '2026-11-04');
    assert.equal(afterAdmin.data.notes, 'Cough for a week');

    // Doctor's report: only the doctor writes it in their own name; the patient reads it.
    assert.equal((await put(patientCookie, 'doctorReports', 'dr-1', { patientId: patient.id, doctorId: doctor.id, summary: 'x', plan: 'y' })).status, 403);
    assert.equal((await put(doctorCookie, 'doctorReports', 'dr-1', { patientId: patient.id, doctorId: doctor.id, summary: 'Bronchitis', plan: 'Rest and fluids', appointmentId: 'apt-1' })).status, 201);
    assert.equal((await list(patientCookie)).find(item => item.id === 'dr-1').data.summary, 'Bronchitis');

    // Messages: sent in your own name to someone you may contact; never edited.
    assert.equal((await put(patientCookie, 'messages', 'm-1', { from: patient.id, to: doctor.id, text: 'Thank you doctor' })).status, 201);
    assert.equal((await put(patientCookie, 'messages', 'm-2', { from: doctor.id, to: patient.id, text: 'fake' })).status, 403);
    assert.equal((await put(patientCookie, 'messages', 'm-1', { from: patient.id, to: doctor.id, text: 'changed' }, 1)).status, 403);
    assert.ok((await list(doctorCookie)).some(item => item.id === 'm-1'));
    assert.equal((await list(adminCookie)).some(item => item.collection === 'messages'), false);

    // Lab results: filed by the laboratory, opened and released by the specialist, seen by the patient only once released.
    const result = { patientId: patient.id, labTechId: lab.id, specialistDoctorId: specialist.id, testType: 'Malaria RDT', status: 'pending', fileName: 'rdt.pdf' };
    assert.equal((await put(labCookie, 'labResults', 'lr-1', result)).status, 201);
    assert.equal((await list(patientCookie)).some(item => item.id === 'lr-1'), false, 'not before release');
    assert.equal((await put(labCookie, 'labResults', 'lr-1', { ...result, status: 'released' }, 1)).status, 403, 'only the specialist releases');
    assert.equal((await put(specialistCookie, 'labResults', 'lr-1', { ...result, status: 'released', releasedAt: '2026-11-03' }, 1)).status, 200);
    assert.equal((await list(patientCookie)).find(item => item.id === 'lr-1').data.status, 'released');

    // Incremental sync: only what changed since the last pull.
    const pulled = await (await app.request('/api/v1/clinical', undefined, patientCookie)).json();
    const since = encodeURIComponent(pulled.data.serverTime);
    assert.equal((await (await app.request(`/api/v1/clinical?since=${since}`, undefined, patientCookie)).json()).data.records.length, 0);
    await put(doctorCookie, 'messages', 'm-3', { from: doctor.id, to: patient.id, text: 'Get well soon' });
    assert.deepEqual((await (await app.request(`/api/v1/clinical?since=${since}`, undefined, patientCookie)).json()).data.records.map(item => item.id), ['m-3']);

    // The patient's record export includes server-held clinical records.
    const bundle = await (await app.request('/api/v1/me/fhir', undefined, patientCookie)).json();
    const types = bundle.entry.map(entry => entry.resource.resourceType);
    assert.ok(types.includes('Appointment') && types.includes('DiagnosticReport') && types.includes('DocumentReference'));
    // Every change about the patient is in their access log.
    const log = (await (await app.request('/api/v1/me/access-log', undefined, patientCookie)).json()).data.entries;
    assert.ok(log.some(entry => entry.action === 'CLINICAL_RECORD_CREATED' && entry.actorName === 'Dr Synthetic Shared'));
  } finally { await app.close(); store.close(); }
});
