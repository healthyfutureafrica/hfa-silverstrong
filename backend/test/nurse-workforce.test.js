const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Store, hashPassword } = require('../store');
const { createApp } = require('../server');

const config = { origin: 'http://localhost:8080', ready: false, fileEncryptionKey: '9c'.repeat(32) };
const PASS = 'Synthetic-pass-123';

async function start() {
  const store = new Store();
  const server = createApp(config, store, {}).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, body, cookie, method = body === undefined ? 'GET' : 'POST') => fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', 'X-HFA-Request': '1', Origin: config.origin, ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const login = async email => { const response = await call('/api/auth/login', { email, password: PASS }); return response.status === 200 ? response.headers.get('set-cookie').split(';')[0] : response.status; };
  const make = async (role, email, extra = {}) => store.createUser({ name: `Synthetic ${role} ${email.slice(0, 3)}`, email, role, ...extra }, await hashPassword(PASS), 'active');
  return { store, call, login, make, close: async () => { await new Promise(resolve => server.close(resolve)); store.close(); } };
}
const json = async response => (await response.json());
const day = offset => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const application = { school: 'Synthetic School of Nursing, Buea', graduationYear: 2019,
  supervisor: { name: 'Synthetic Matron Ewane', position: 'Head nurse', institution: 'Synthetic District Hospital', phone: '+237 677 11 22 33', email: 'matron@example.com' } };
const nurseRegistration = { name: 'Synthetic Nurse Ayuk', email: 'ayuk@example.com', password: PASS, role: 'nurse', phone: '+237677445566',
  licenseNo: 'ONIC-2019-0042', qualifications: 'State Registered Nurse (IDE)', hospital: 'Synthetic District Hospital', department: 'General Ward', nurseApplication: application };

test('a nurse works only after an administrator has contacted the supervisor and confirmed every detail', async () => {
  const app = await start();
  try {
    await app.make('admin', 'admin-nw@example.com');
    const adminCookie = await app.login('admin-nw@example.com');
    // Registration needs the supervisor, school, licence and qualifications.
    const { nurseApplication, ...withoutApplication } = nurseRegistration;
    assert.match((await json(await app.call('/api/auth/register', withoutApplication))).error, /supervisor/);
    assert.equal((await app.call('/api/auth/register', { ...nurseRegistration, licenseNo: '' })).status, 400);
    assert.match((await json(await app.call('/api/auth/register', { ...nurseRegistration, nurseApplication: { ...application, supervisor: { ...application.supervisor, phone: '677' } } }))).error, /country code/);
    assert.equal((await app.call('/api/auth/register', { ...nurseRegistration, role: 'doctor', specialty: 'General Medicine' })).status, 400, 'only nurses send a nurse application');
    const registered = await app.call('/api/auth/register', nurseRegistration);
    assert.equal(registered.status, 201);
    const nurse = (await json(registered)).user;
    assert.equal(nurse.status, 'pending_approval');
    assert.equal(JSON.stringify(nurse).includes('Matron'), false, 'the supervisor is not part of the nurse’s profile');
    assert.equal(await app.login('ayuk@example.com'), 403, 'cannot work before validation');
    assert.ok(app.store.notifications(app.store.credentials('admin-nw@example.com').id).length >= 1, 'administrators are told');

    // Approving directly is refused: the checklist decides.
    assert.equal((await app.call(`/api/admin/users/${nurse.id}`, { status: 'active' }, adminCookie, 'PATCH')).status, 409);
    const path = `/api/v1/admin/nurse-verifications/${nurse.id}`;
    const view = await json(await app.call(path, undefined, adminCookie));
    assert.equal(view.data.application.supervisor.phone, '+237677112233', 'phone stored in international format');
    assert.equal(view.data.ready, false);
    assert.deepEqual(Object.values(view.data.checks).map(item => item.status), ['pending', 'pending', 'pending', 'pending', 'pending', 'pending']);
    // The supervisor item needs a recorded contact in which the supervisor vouched for the nurse.
    assert.equal((await app.call(`${path}/checks/supervisor`, { status: 'confirmed' }, adminCookie)).status, 409);
    assert.equal((await app.call(`${path}/contacts`, { method: 'phone', outcome: 'confirmed' }, adminCookie)).status, 400, 'what the supervisor said is recorded');
    assert.equal((await app.call(`${path}/contacts`, { method: 'phone', outcome: 'not_reached' }, adminCookie)).status, 201);
    assert.equal((await app.call(`${path}/checks/supervisor`, { status: 'confirmed' }, adminCookie)).status, 409, 'not reached is not a confirmation');
    assert.equal((await app.call(`${path}/contacts`, { method: 'phone', outcome: 'confirmed', note: 'Matron confirmed Ayuk works on her ward since 2020' }, adminCookie)).status, 201);
    for (const item of ['supervisor', 'identity', 'qualifications', 'employment']) assert.equal((await app.call(`${path}/checks/${item}`, { status: 'confirmed', note: 'Checked' }, adminCookie)).status, 200, item);
    assert.equal((await app.call(`${path}/checks/education`, { status: 'problem' }, adminCookie)).status, 400, 'a problem says what is wrong');
    assert.equal((await app.call(`${path}/checks/education`, { status: 'problem', note: 'School has no record yet' }, adminCookie)).status, 200);
    assert.match((await json(await app.call(`${path}/validate`, {}, adminCookie))).error, /education, licence|licence, education|education|licence/);
    // The licence item comes from the licence register (with an expiry date).
    assert.equal((await app.call(`${path}/checks/licence`, { status: 'confirmed' }, adminCookie)).status, 400);
    assert.equal((await app.call(`/api/v1/admin/clinicians/${nurse.id}/licence`, { status: 'verified', expiresOn: day(700) }, adminCookie)).status, 200);
    assert.equal((await app.call(`${path}/checks/education`, { status: 'confirmed', note: 'Registrar confirmed the 2019 diploma' }, adminCookie)).status, 200);
    const validated = await app.call(`${path}/validate`, {}, adminCookie);
    assert.equal(validated.status, 200);
    assert.ok((await json(validated)).data.validatedAt);
    assert.equal(typeof await app.login('ayuk@example.com'), 'string', 'the nurse can now sign in and work');
    assert.equal((await app.call(`${path}/checks/identity`, { status: 'problem', note: 'late change' }, adminCookie)).status, 409, 'the record is closed after validation');
    // Other people never see the supervisor's contact details.
    await app.make('patient', 'pat-nw@example.com', { phone: '+237677000111' });
    const patientCookie = await app.login('pat-nw@example.com');
    assert.equal((await app.call(path, undefined, patientCookie)).status, 403);
    assert.equal(JSON.stringify(await json(await app.call('/api/session', undefined, patientCookie))).includes('Matron'), false);
    const actions = app.store.auditLog().map(entry => entry.action);
    for (const action of ['NURSE_SUPERVISOR_CONTACTED', 'NURSE_CHECK_RECORDED', 'NURSE_VALIDATED']) assert.ok(actions.includes(action), action);
    // Nurses added by an administrator go through the same validation.
    const added = await json(await app.call('/api/admin/users', { ...nurseRegistration, email: 'added@example.com' }, adminCookie));
    assert.equal(added.user.status, 'pending_approval');
  } finally { await app.close(); }
});

test('weekly timetable: required, kept current, and home visits must fit it', async () => {
  const app = await start();
  try {
    const nurse = await app.make('nurse', 'tt-nurse@example.com');
    const patient = await app.make('patient', 'tt-pat@example.com', { phone: '+237677000222' });
    const doctor = await app.make('doctor', 'tt-doc@example.com');
    app.store.updateUser(patient.id, { assignedNurse: nurse.id });
    const [nurseCookie, patientCookie] = [await app.login('tt-nurse@example.com'), await app.login('tt-pat@example.com')];
    const date = day(2), weekday = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(`${date}T00:00:00Z`).getUTCDay()];
    const book = (id, time, doctorId = doctor.id) => app.call(`/api/v1/clinical/homeVisits/${id}`, { data: { patientId: patient.id, nurseId: nurse.id, doctorId, visitDate: date, visitTime: time, status: 'scheduled', location: 'Home, Molyko' }, baseVersion: 0 }, patientCookie, 'PUT');

    assert.equal((await json(await app.call('/api/v1/nurse/availability', undefined, nurseCookie))).data.status, 'missing');
    assert.match((await json(await book('hv-0', '10:00'))).error, /not published a weekly timetable/);
    const put = slots => app.call('/api/v1/nurse/availability', { slots }, nurseCookie, 'PUT');
    assert.match((await json(await put({ [weekday]: [{ start: '08:00', end: '12:00' }, { start: '11:00', end: '14:00' }] }))).error, /overlap/);
    assert.equal((await put({ [weekday]: [{ start: '12:00', end: '08:00' }] })).status, 400);
    assert.equal((await put({ [weekday]: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '17:00' }] })).status, 200);
    assert.equal((await json(await app.call('/api/v1/nurse/availability', undefined, nurseCookie))).data.status, 'current');
    assert.match((await json(await book('hv-1', '13:00'))).error, /not available then.*08:00–12:00, 14:00–17:00/);
    assert.match((await json(await book('hv-2', '09:30', ''))).error, /doctor in charge/, 'every visit has a doctor in charge');
    assert.equal((await book('hv-2', '09:30')).status, 201);
    // Not confirmed for over a week: out of date, not bookable, until the nurse confirms or updates it.
    app.store.db.prepare('UPDATE nurse_availability SET confirmed_at=? WHERE nurse_id=?').run(new Date(Date.now() - 8 * 86400000).toISOString(), nurse.id);
    assert.equal((await json(await app.call('/api/v1/nurse/availability', undefined, nurseCookie))).data.status, 'overdue');
    assert.match((await json(await book('hv-3', '15:00'))).error, /out of date/);
    assert.equal((await app.call('/api/v1/nurse/availability/confirm', {}, nurseCookie)).status, 200);
    assert.equal((await book('hv-3', '15:00')).status, 201);
    // Patients see working hours for booking; only nurses keep a timetable.
    assert.equal((await json(await app.call('/api/v1/nurses/availability', undefined, patientCookie))).data.nurses[0].slots[weekday].length, 2);
    assert.equal((await app.call('/api/v1/nurse/availability', { slots: {} }, patientCookie, 'PUT')).status, 403);
  } finally { await app.close(); }
});

test('3,000 FCFA per home visit once the report is filed, the patient has given feedback and the doctor confirms', async () => {
  const app = await start();
  try {
    const nurse = await app.make('nurse', 'pay-nurse@example.com');
    const other = await app.make('nurse', 'other-nurse@example.com');
    const doctor = await app.make('doctor', 'pay-doc@example.com');
    const patient = await app.make('patient', 'pay-pat@example.com', { phone: '+237677000333' });
    await app.make('admin', 'pay-admin@example.com');
    app.store.updateUser(patient.id, { assignedNurse: nurse.id, assignedDoctor: doctor.id });
    const [nurseCookie, otherCookie, doctorCookie, patientCookie, adminCookie] = await Promise.all(['pay-nurse', 'other-nurse', 'pay-doc', 'pay-pat', 'pay-admin'].map(name => app.login(`${name}@example.com`)));
    const all = Object.fromEntries(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(name => [name, [{ start: '00:00', end: '23:59' }]]));
    await app.call('/api/v1/nurse/availability', { slots: all }, nurseCookie, 'PUT');
    assert.equal((await app.call('/api/v1/clinical/homeVisits/hv-pay', { data: { patientId: patient.id, nurseId: nurse.id, doctorId: doctor.id, visitDate: day(0), visitTime: '23:00', status: 'scheduled', location: 'Home, Bonamoussadi' }, baseVersion: 0 }, patientCookie, 'PUT')).status, 201);
    const visit = '/api/v1/home-visits/hv-pay';
    const report = { vitals: { temperatureC: 37.8, systolic: 132, diastolic: 84, pulse: 88, spo2: 97 }, observations: 'Wound on left leg healing, no pus, mild redness.', careGiven: 'Dressing changed, BP checked.', recommendations: 'Review in 3 days.' };

    // Steps out of order are refused, and only the right person can take each step.
    assert.equal((await app.call(`${visit}/feedback`, { rating: 5 }, patientCookie)).status, 409);
    assert.equal((await app.call(`${visit}/confirm`, {}, doctorCookie)).status, 409);
    assert.equal((await app.call(`${visit}/report`, report, otherCookie)).status, 404, 'another nurse cannot file it');
    assert.equal((await app.call(`${visit}/report`, report, patientCookie)).status, 403);
    assert.match((await json(await app.call(`${visit}/report`, { ...report, vitals: { ...report.vitals, systolic: 70, diastolic: 90 } }, nurseCookie))).error, /systolic/);
    assert.equal((await app.call(`${visit}/report`, { ...report, vitals: { ...report.vitals, temperatureC: 378 } }, nurseCookie)).status, 400, 'a missing decimal point');
    assert.equal((await app.call(`${visit}/report`, { ...report, observations: 'ok' }, nurseCookie)).status, 400);
    assert.equal((await app.call(`${visit}/report`, report, nurseCookie)).status, 201);
    // The shared visit record is now completed on every device.
    const records = (await json(await app.call('/api/v1/clinical', undefined, patientCookie))).data.records;
    assert.equal(records.find(item => item.id === 'hv-pay').data.status, 'completed');
    assert.equal(app.store.db.prepare('SELECT report_encrypted FROM home_visit_steps').get().report_encrypted.includes(Buffer.from('Wound')), false, 'report stored encrypted');

    assert.equal((await app.call(`${visit}/confirm`, {}, nurseCookie)).status, 403, 'the nurse cannot confirm her own visit');
    assert.equal((await app.call(`${visit}/feedback`, { rating: 6 }, patientCookie)).status, 400);
    assert.equal((await app.call(`${visit}/feedback`, { rating: 5, comment: 'Very kind and careful' }, patientCookie)).status, 201);
    assert.equal((await app.call(`${visit}/feedback`, { rating: 1 }, patientCookie)).status, 409, 'feedback is given once');
    // The doctor asks for more; the nurse completes the report; then the doctor confirms.
    assert.equal((await app.call(`${visit}/return`, { note: 'Add the respiratory rate please' }, doctorCookie)).status, 200);
    assert.equal((await app.call(`${visit}/confirm`, {}, doctorCookie)).status, 409);
    assert.equal((await json(await app.call('/api/v1/nurse/earnings', undefined, nurseCookie))).data.payouts.length, 0, 'nothing due yet');
    assert.equal((await app.call(`${visit}/report`, { ...report, vitals: { ...report.vitals, respiratoryRate: 18 } }, nurseCookie)).status, 201);
    assert.equal((await app.call(`${visit}/confirm`, { note: 'All data received' }, doctorCookie)).status, 200);
    assert.equal((await app.call(`${visit}/report`, report, nurseCookie)).status, 409, 'no changes after confirmation');

    const earnings = (await json(await app.call('/api/v1/nurse/earnings', undefined, nurseCookie))).data;
    assert.equal(earnings.due, 3000);
    assert.equal(earnings.payouts[0].currency, 'XAF');
    // What each person sees: the administrator follows progress without the clinical report.
    const adminView = (await json(await app.call('/api/v1/home-visits/progress', undefined, adminCookie))).data.visits[0];
    assert.equal(adminView.report, null);
    assert.equal(adminView.payout.status, 'due');
    assert.equal((await json(await app.call('/api/v1/home-visits/progress', undefined, doctorCookie))).data.visits[0].report.vitals.respiratoryRate, 18);
    // The administrator pays (outside the app) and records it.
    const payout = (await json(await app.call('/api/v1/admin/nurse-payouts', undefined, adminCookie))).data.payouts[0];
    assert.equal((await app.call(`/api/v1/admin/nurse-payouts/${payout.id}/paid`, { method: 'mobile_money', reference: '' }, adminCookie)).status, 400);
    assert.equal((await app.call(`/api/v1/admin/nurse-payouts/${payout.id}/paid`, { method: 'mobile_money', reference: 'MP261026.1201.A12345' }, adminCookie)).status, 200);
    assert.equal((await app.call(`/api/v1/admin/nurse-payouts/${payout.id}/paid`, { method: 'mobile_money', reference: 'again' }, adminCookie)).status, 409);
    assert.equal((await app.call(`/api/v1/admin/nurse-payouts/${payout.id}/paid`, { method: 'cash', reference: 'x123' }, nurseCookie)).status, 403);
    const after = (await json(await app.call('/api/v1/nurse/earnings', undefined, nurseCookie))).data;
    assert.deepEqual([after.due, after.paid], [0, 3000]);
    assert.equal(app.store.db.prepare('SELECT COUNT(*) AS n FROM nurse_payouts').get().n, 1, 'one payment per visit');
  } finally { await app.close(); }
});

test('a visit whose doctor has left gets a new doctor in charge, so the nurse can still be confirmed and paid', async () => {
  const app = await start();
  try {
    const nurse = await app.make('nurse', 'dc-nurse@example.com');
    const leaving = await app.make('doctor', 'dc-leaving@example.com');
    const replacement = await app.make('doctor', 'dc-new@example.com');
    const patient = await app.make('patient', 'dc-pat@example.com', { phone: '+237677000444' });
    const admin = await app.make('admin', 'dc-admin@example.com');
    app.store.updateUser(patient.id, { assignedNurse: nurse.id });
    const [nurseCookie, patientCookie, adminCookie, newCookie] = await Promise.all(['dc-nurse', 'dc-pat', 'dc-admin', 'dc-new'].map(name => app.login(`${name}@example.com`)));
    const all = Object.fromEntries(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(name => [name, [{ start: '00:00', end: '23:59' }]]));
    await app.call('/api/v1/nurse/availability', { slots: all }, nurseCookie, 'PUT');
    assert.equal((await app.call('/api/v1/clinical/homeVisits/hv-dc', { data: { patientId: patient.id, nurseId: nurse.id, doctorId: leaving.id, visitDate: day(0), visitTime: '23:00', status: 'scheduled', location: 'Home, Akwa' }, baseVersion: 0 }, patientCookie, 'PUT')).status, 201);
    // The doctor leaves; the patient has no assigned doctor.
    app.store.updateUser(leaving.id, { status: 'suspended' });
    const report = { vitals: { temperatureC: 36.9, systolic: 120, diastolic: 80, pulse: 72 }, observations: 'Patient comfortable, eating well.', careGiven: 'Medicines reviewed.' };
    const before = app.store.notifications(admin.id).length;
    assert.equal((await app.call('/api/v1/home-visits/hv-dc/report', report, nurseCookie)).status, 201);
    assert.ok(app.store.notifications(admin.id).length > before, 'administrators are asked to assign a doctor');
    const view = (await json(await app.call('/api/v1/home-visits/progress', undefined, adminCookie))).data.visits[0];
    assert.equal(view.doctorId, null);
    assert.equal((await app.call('/api/v1/admin/home-visits/hv-dc/doctor', { doctorId: leaving.id }, adminCookie)).status, 400, 'only an active doctor');
    assert.equal((await app.call('/api/v1/admin/home-visits/hv-dc/doctor', { doctorId: replacement.id }, nurseCookie)).status, 403);
    assert.equal((await app.call('/api/v1/admin/home-visits/hv-dc/doctor', { doctorId: replacement.id }, adminCookie)).status, 200);
    // The new doctor sees the visit and confirms; the patient's feedback completes it.
    const seen = (await json(await app.call('/api/v1/home-visits/progress', undefined, newCookie))).data.visits;
    assert.equal(seen[0]?.doctorName, 'Synthetic doctor dc-');
    assert.equal((await app.call('/api/v1/home-visits/hv-dc/feedback', { rating: 4 }, patientCookie)).status, 201);
    assert.equal((await app.call('/api/v1/home-visits/hv-dc/confirm', {}, newCookie)).status, 200);
    assert.equal((await json(await app.call('/api/v1/nurse/earnings', undefined, nurseCookie))).data.due, 3000);
    assert.equal((await app.call('/api/v1/admin/home-visits/hv-dc/doctor', { doctorId: replacement.id }, adminCookie)).status, 409, 'no change after confirmation');
  } finally { await app.close(); }
});
