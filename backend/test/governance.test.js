const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Store, hashPassword } = require('../store');
const { createApp } = require('../server');

const config = { origin: 'http://localhost:8080', ready: false, fileEncryptionKey: '9c'.repeat(32), requireAdminMfa: false };

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
  identity: { dateOfBirth: '1985-05-05', gender: 'female' }, location: { region: 'centre', division: 'Mfoundi', town: 'Yaoundé' },
  medical: { drugAllergies: [{ name: 'Penicillin', severity: 'anaphylaxis' }], medications: [{ name: 'Amoxicillin', dose: '500 mg' }, { name: 'Paracetamol' }] },
  lifestyle: {}, consents: { dataSharing: true, research: true, sms: false, whatsapp: false, ministry: true }
});

test('consent register, licence register and medication safety alerts are real, server-held and properly restricted', async () => {
  const store = new Store();
  const app = await startServer(store);
  try {
    store.createUser({ name: 'Synthetic Governance Admin', email: 'gov-admin@example.invalid', role: 'admin' }, await hashPassword('Synthetic-pass-123'), 'active');
    const adminCookie = cookieOf(await app.request('/api/auth/login', { email: 'gov-admin@example.invalid', password: 'Synthetic-pass-123' }));
    // A doctor registers with a licence number: it now reaches the server.
    const registration = await app.request('/api/auth/register', { name: 'Dr Synthetic Licence', email: 'licence-doc@example.invalid', password: 'Synthetic-pass-123', role: 'doctor', specialty: 'General Medicine', hospital: 'Synthetic Governance Hospital', consultationFee: 10, licenseNo: 'CM-MED-2026-0001' });
    const doctor = (await registration.json()).user;
    assert.equal(store.user(doctor.id).licenseNo, 'CM-MED-2026-0001');
    store.updateUser(doctor.id, { status: 'active' });
    const doctorCookie = cookieOf(await app.request('/api/auth/login', { email: 'licence-doc@example.invalid', password: 'Synthetic-pass-123' }));
    store.createUser({ name: 'Dr Synthetic Elsewhere', email: 'gov-other@example.invalid', role: 'doctor', profile: { hospital: 'Another Governance Hospital' } }, await hashPassword('Synthetic-pass-123'), 'active');
    const otherCookie = cookieOf(await app.request('/api/auth/login', { email: 'gov-other@example.invalid', password: 'Synthetic-pass-123' }));

    // Licence register: unverified until an administrator checks it and records the expiry.
    let clinicians = (await (await app.request('/api/v1/admin/clinicians', undefined, adminCookie)).json()).data.clinicians;
    assert.equal(clinicians.find(item => item.id === doctor.id).alert, 'unverified');
    assert.equal((await app.request(`/api/v1/admin/clinicians/${doctor.id}/licence`, { status: 'verified' }, adminCookie)).status, 400, 'expiry required');
    const soon = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const verified = await (await app.request(`/api/v1/admin/clinicians/${doctor.id}/licence`, { status: 'verified', expiresOn: soon }, adminCookie)).json();
    assert.equal(verified.data.clinician.verification.status, 'verified');
    assert.equal(verified.data.clinician.alert, 'expiring', 'expires within 60 days');
    assert.equal((await app.request(`/api/v1/admin/clinicians/${doctor.id}/licence`, { status: 'verified', expiresOn: soon }, doctorCookie)).status, 403);

    // A patient at the doctor's hospital, allergic to penicillin, taking amoxicillin.
    const patientResponse = await app.request('/api/auth/register', { name: 'Synthetic Patient Allergy', password: 'Synthetic-pass-123', role: 'patient', phone: '+237677888001', hospitalId: store.listedHospitals().find(item => item.name === 'Synthetic Governance Hospital').id, healthProfile: profile() });
    const patient = (await patientResponse.json()).user;
    // The doctor's plan adds a cephalosporin (possible cross-reaction).
    await app.request(`/api/v1/clinical/doctorReports/dr-gov`, { data: { patientId: patient.id, doctorId: doctor.id, summary: 'Chest infection', plan: 'Start ceftriaxone 1 g daily' }, baseVersion: 0 }, doctorCookie, 'PUT');

    const alerts = (await (await app.request('/api/v1/safety/alerts', undefined, doctorCookie)).json()).data.alerts;
    assert.deepEqual(alerts.map(alert => [alert.drug, alert.severity, alert.source]).sort(), [['amoxicillin', 'critical', 'profile_medication'], ['ceftriaxone', 'review', 'doctor_report']]);
    assert.equal(alerts.some(alert => alert.drug === 'paracetamol'), false);
    assert.equal((await (await app.request('/api/v1/safety/alerts', undefined, otherCookie)).json()).data.alerts.length, 0, 'only the patient’s clinicians');
    const oversight = (await (await app.request('/api/v1/safety/alerts', undefined, adminCookie)).json()).data;
    assert.deepEqual([oversight.oversightOnly, oversight.open, oversight.critical], [true, 2, 1]);
    assert.equal(JSON.stringify(oversight).includes('amoxicillin'), false, 'administrators see counts only');
    const critical = alerts.find(alert => alert.severity === 'critical');
    assert.equal((await app.request(`/api/v1/safety/alerts/${critical.key}/resolve`, { note: 'ok' }, doctorCookie)).status, 400, 'a reason is needed');
    assert.equal((await app.request(`/api/v1/safety/alerts/${critical.key}/resolve`, { note: 'Stopped amoxicillin, switched to azithromycin.' }, otherCookie)).status, 404);
    assert.equal((await app.request(`/api/v1/safety/alerts/${critical.key}/resolve`, { note: 'Stopped amoxicillin, switched to azithromycin.' }, doctorCookie)).status, 200);
    const after = (await (await app.request('/api/v1/safety/alerts', undefined, doctorCookie)).json()).data.alerts.find(alert => alert.key === critical.key);
    assert.equal(after.resolved, true);
    assert.equal(after.resolvedBy, 'Dr Synthetic Licence');

    // Consent register: each patient's real choices.
    const consents = (await (await app.request('/api/v1/admin/consents', undefined, adminCookie)).json()).data.patients;
    const row = consents.find(item => item.patientId === patient.id);
    assert.deepEqual([row.consents.dataSharing, row.consents.research, row.consents.sms, row.consents.ministry], [true, true, false, true]);
    assert.equal((await app.request('/api/v1/admin/consents', undefined, doctorCookie)).status, 403);
    assert.ok(store.db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action IN ('CONSENT_REGISTER_VIEWED','LICENCE_VERIFIED','SAFETY_ALERT_RESOLVED')").get().n >= 3);
  } finally { await app.close(); store.close(); }
});
