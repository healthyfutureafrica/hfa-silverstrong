const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Store, hashPassword } = require('../store');
const { createApp } = require('../server');
const Fhir = require('../../hfa-fhir.js');

const config = { origin: 'http://localhost:8080', ready: false, fileEncryptionKey: '7c'.repeat(32) };

async function startServer(store) {
  const server = createApp(config, store, {}).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, body, cookie, method = body === undefined ? 'GET' : 'POST') => fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', 'X-HFA-Request': '1', Origin: config.origin, ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { request, close: () => new Promise(resolve => server.close(resolve)) };
}
const cookieOf = response => response.headers.get('set-cookie').split(';')[0];

const profile = () => ({
  identity: { dateOfBirth: '1990-02-03', gender: 'male', cniNumber: '998877' },
  location: { region: 'littoral', division: 'Wouri', town: 'Douala' },
  medical: {
    bloodGroup: 'B+', genotype: 'AA', conditions: ['hypertension', 'tuberculosis'],
    drugAllergies: [{ name: 'Penicillin', severity: 'anaphylaxis' }], medications: [{ name: 'Amlodipine', dose: '5 mg' }],
    surgeries: [{ procedure: 'Appendectomy', year: 2012 }], familyHistory: ['stroke'], disability: 'none'
  },
  lifestyle: { smoking: 'former', emergencyContact: { name: 'Synthetic Sister', relationship: 'Sister', phone: '+237677000333' } },
  consents: { dataSharing: true, research: false, sms: true, whatsapp: false, ministry: false }
});

test('patients manage consents, see who opened their record, export FHIR and make data-rights requests that admins answer', async () => {
  const store = new Store();
  const app = await startServer(store);
  try {
    const registered = await app.request('/api/auth/register', { name: 'Synthetic Patient Eko', password: 'Synthetic-password-123', role: 'patient', phone: '+237677555111', healthProfile: profile() });
    assert.equal(registered.status, 201);
    const patientCookie = cookieOf(registered);
    const patient = (await registered.json()).user;

    // Consents: optional purposes can be changed and every change is kept; care-team sharing cannot be withdrawn here.
    const consents = await (await app.request('/api/v1/me/consents', undefined, patientCookie)).json();
    assert.equal(consents.data.consents.research, false);
    assert.deepEqual(consents.data.changeable, ['research', 'ministry', 'sms']);
    assert.equal((await app.request('/api/v1/me/consents', { purpose: 'dataSharing', granted: false }, patientCookie)).status, 400);
    const given = await (await app.request('/api/v1/me/consents', { purpose: 'research', granted: true }, patientCookie)).json();
    assert.equal(given.data.consents.research, true);
    await app.request('/api/v1/me/consents', { purpose: 'sms', granted: false }, patientCookie);
    const history = (await (await app.request('/api/v1/me/consents', undefined, patientCookie)).json()).data.history;
    assert.deepEqual(history.map(event => [event.purpose, event.granted]), [['sms', false], ['research', true]]);
    const session = await (await app.request('/api/session', undefined, patientCookie)).json();
    assert.equal(session.user.healthProfile.consents.research, true, 'the encrypted record holds the new choice');

    // A doctor assigned to the patient receives the health profile: that disclosure is logged once an hour.
    const doctor = store.createUser({ name: 'Dr Synthetic Viewer', email: 'viewer@example.invalid', role: 'doctor', profile: { hospital: 'Synthetic Hospital' } }, await hashPassword('Synthetic-doctor-pass'), 'active');
    store.updateUser(patient.id, { assignedDoctor: doctor.id });
    const doctorLogin = await app.request('/api/auth/login', { email: 'viewer@example.invalid', password: 'Synthetic-doctor-pass' });
    const doctorCookie = cookieOf(doctorLogin);
    assert.ok((await doctorLogin.json()).users.find(user => user.id === patient.id).healthProfile);
    await app.request('/api/session', undefined, doctorCookie);
    const log = (await (await app.request('/api/v1/me/access-log', undefined, patientCookie)).json()).data.entries;
    assert.equal(log.filter(entry => entry.action === 'HEALTH_RECORD_VIEW').length, 1);
    assert.equal(log[0].actorName, 'Dr Synthetic Viewer');
    assert.equal(log[0].actorRole, 'doctor');
    assert.equal(log.some(entry => 'ip' in entry), false, 'patients do not see staff IP addresses');
    assert.equal((await app.request('/api/v1/me/fhir', undefined, doctorCookie)).status, 403, 'only the patient exports their record');

    // FHIR R4 export of everything the server holds.
    const exported = await app.request('/api/v1/me/fhir', undefined, patientCookie);
    assert.equal(exported.status, 200);
    assert.match(exported.headers.get('content-type'), /application\/fhir\+json/);
    const bundle = await exported.json();
    assert.deepEqual(Fhir.validate(bundle), []);
    const types = bundle.entry.map(entry => entry.resource.resourceType);
    for (const type of ['Patient', 'AllergyIntolerance', 'Condition', 'MedicationStatement', 'Procedure', 'Observation', 'FamilyMemberHistory', 'Consent']) assert.ok(types.includes(type), type);
    const research = bundle.entry.map(entry => entry.resource).find(resource => resource.resourceType === 'Consent' && resource.provision.purpose?.[0]?.code === 'HRESCH');
    assert.equal(research.provision.type, 'permit');

    // Data-rights requests: one open request per kind, a 30-day deadline, answered by an administrator.
    assert.equal((await app.request('/api/v1/me/privacy-requests', { kind: 'erasure', details: 'short' }, patientCookie)).status, 400);
    const created = await app.request('/api/v1/me/privacy-requests', { kind: 'rectification', details: 'My date of birth is wrong, it should be 1990-03-02.' }, patientCookie);
    assert.equal(created.status, 201);
    const request = (await created.json()).data.request;
    assert.equal(request.status, 'received');
    assert.equal(Math.round((Date.parse(request.dueAt) - Date.parse(request.createdAt)) / 86400000), 30);
    assert.equal((await app.request('/api/v1/me/privacy-requests', { kind: 'rectification', details: 'Another correction to my record.' }, patientCookie)).status, 409);
    assert.equal((await app.request('/api/v1/admin/privacy-requests', undefined, doctorCookie)).status, 403);

    store.createUser({ name: 'Synthetic DPO', email: 'dpo@example.invalid', role: 'admin' }, await hashPassword('Synthetic-admin-pass'), 'active');
    const adminCookie = cookieOf(await app.request('/api/auth/login', { email: 'dpo@example.invalid', password: 'Synthetic-admin-pass' }));
    const queue = (await (await app.request('/api/v1/admin/privacy-requests', undefined, adminCookie)).json()).data.requests;
    assert.equal(queue[0].userName, 'Synthetic Patient Eko');
    assert.equal(queue[0].overdue, false);
    assert.equal((await app.request(`/api/v1/admin/privacy-requests/${request.id}`, { status: 'completed' }, adminCookie, 'PATCH')).status, 400, 'closing needs an explanation');
    const done = await app.request(`/api/v1/admin/privacy-requests/${request.id}`, { status: 'completed', resolution: 'Date of birth corrected after checking your CNI.' }, adminCookie, 'PATCH');
    assert.equal(done.status, 200);
    assert.equal((await done.json()).data.request.resolvedByName, 'Synthetic DPO');
    assert.equal((await app.request(`/api/v1/admin/privacy-requests/${request.id}`, { status: 'refused', resolution: 'Trying to reopen a closed one.' }, adminCookie, 'PATCH')).status, 409);
    const mine = (await (await app.request('/api/v1/me/privacy-requests', undefined, patientCookie)).json()).data.requests;
    assert.equal(mine[0].status, 'completed');
    assert.match(mine[0].resolution, /corrected/);
    const after = (await (await app.request('/api/v1/me/access-log', undefined, patientCookie)).json()).data.entries;
    assert.ok(after.some(entry => entry.action === 'PRIVACY_REQUEST_UPDATED' && entry.actorName === 'Synthetic DPO'));
    assert.ok((await (await app.request('/api/notifications', undefined, patientCookie)).json()).notifications.some(item => /data-protection request/.test(item.message)));
  } finally { await app.close(); store.close(); }
});

test('FHIR bundle uses certain codes only, marks patient-reported data and exports released lab results only', () => {
  const user = { id: 'pat-1', name: 'Synthetic Patient Eko', hfaId: 'HFA-PT-HFA-000001-3', phone: '+237677555111', gender: 'Male', dateOfBirth: '1990-02-03', allergies: 'Penicillin, Aspirin' };
  const bundle = Fhir.patientBundle({
    user, health: profile(), now: '2026-10-24T10:00:00Z', people: { doc1: { name: 'Dr Synthetic', hfaId: 'HFA-DR-HCH-0001-4', specialty: 'Cardiology' } },
    appointments: [{ id: 'apt1', doctorId: 'doc1', date: '2026-10-30', time: '09:30', durationMinutes: 45, status: 'scheduled', serviceName: 'Virtual cardiology', mode: 'video' }],
    labResults: [{ id: 'lr1', testType: 'Malaria RDT', releasedAt: '2026-10-20 10:00:00', uploadedAt: '2026-10-19 08:00:00', specialistDoctorId: 'doc1' }, { id: 'lr2', testType: 'Hidden until released', status: 'pending' }],
    careNotes: [{ id: 'cn1', nurseId: 'doc1', text: 'BP 130/85 — improving.', date: '2026-10-21', time: '09:15 AM' }]
  });
  assert.deepEqual(Fhir.validate(bundle), []);
  const resources = bundle.entry.map(entry => entry.resource);
  const hypertension = resources.find(resource => resource.resourceType === 'Condition' && resource.code.text === 'Hypertension');
  assert.equal(hypertension.code.coding[0].code, 'BA00');
  assert.equal(hypertension.verificationStatus.coding[0].code, 'unconfirmed');
  assert.equal(resources.find(resource => resource.code?.text === 'Tuberculosis').code.coding, undefined, 'no guessed codes');
  assert.equal(resources.find(resource => resource.resourceType === 'AllergyIntolerance').criticality, 'high');
  assert.equal(resources.filter(resource => resource.resourceType === 'DiagnosticReport').length, 1);
  const appointment = resources.find(resource => resource.resourceType === 'Appointment');
  assert.equal(appointment.start, '2026-10-30T09:30:00+01:00');
  assert.equal(appointment.end, '2026-10-30T09:15:00Z');
  const note = resources.find(resource => resource.resourceType === 'DocumentReference');
  assert.equal(Buffer.from(note.content[0].attachment.data, 'base64').toString('utf8'), 'BP 130/85 — improving.');
  assert.equal(note.date, '2026-10-21T09:15:00+01:00');
  assert.equal(resources.filter(resource => resource.resourceType === 'Practitioner').length, 1);
  assert.equal(resources.find(resource => resource.resourceType === 'Patient').identifier[0].value, 'HFA-PT-HFA-000001-3');

  const ghanaBundle = Fhir.patientBundle({
    user: { ...user, countryCode: 'GH' },
    health: { ...profile(), location: { countryCode: 'GH', region: 'Greater Accra Region', division: 'Accra Metropolitan Area', town: 'Accra' } },
    now: '2026-10-24T10:00:00Z'
  });
  assert.equal(ghanaBundle.entry.find(entry => entry.resource.resourceType === 'Patient').resource.address[0].country, 'GH');
});
