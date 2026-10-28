const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Store, hashPassword } = require('../store');
const { createApp } = require('../server');
const { seal } = require('../records');

const config = { origin: 'http://localhost:8080', ready: false, fileEncryptionKey: '9c'.repeat(32) };
const PASS = 'Synthetic-pass-123';

async function start(extra = {}) {
  const store = new Store();
  const app = createApp({ ...config, ...extra }, store, {});
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, body, cookie, method = body === undefined ? 'GET' : 'POST') => fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', 'X-HFA-Request': '1', Origin: config.origin, ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const login = async email => { const response = await call('/api/auth/login', { email, password: PASS }); return response.status === 200 ? response.headers.get('set-cookie').split(';')[0] : response.status; };
  const make = async (role, email, extra = {}) => store.createUser({ name: `Synthetic ${role} ${email.slice(0, 3)}`, email, role, ...extra }, await hashPassword(PASS), 'active');
  return { store, call, login, make, earnings: app.locals.earnings, close: async () => { await new Promise(resolve => server.close(resolve)); store.close(); } };
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
    assert.equal((await app.call(`/api/v1/admin/clinicians/${nurse.id}/licence`, {
      status: 'verified', countryCode: 'CM', verificationMethod: 'direct_authority',
      source: 'Synthetic nursing council', sourceReference: 'Synthetic contact record NUR-1', expiresOn: day(700)
    }, adminCookie)).status, 200);
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

test('3,000 FCFA credited per home visit once the report, the patient feedback and the doctor confirmation are in; withdrawal from 10 visits', async () => {
  // A stand-in for the automatic payout service: refuses the first payout (wrong number), pays the second.
  const sent = [];
  const provider = { async send(payout) { sent.push(payout); if (sent.length === 1) throw Object.assign(new Error('Number not registered for mobile money'), { permanent: true }); return { status: 'processing', reference: 'MAV-' + sent.length }; },
    async check({ reference }) { return { status: 'paid', reference }; } };
  const app = await start({ payoutProvider: provider });
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
    assert.equal((await json(await app.call('/api/v1/earnings/account', undefined, nurseCookie))).data.balance, 0, 'nothing credited yet');
    assert.equal((await app.call(`${visit}/report`, { ...report, vitals: { ...report.vitals, respiratoryRate: 18 } }, nurseCookie)).status, 201);
    assert.equal((await app.call(`${visit}/confirm`, { note: 'All data received' }, doctorCookie)).status, 200);
    assert.equal((await app.call(`${visit}/report`, report, nurseCookie)).status, 409, 'no changes after confirmation');

    const accountOf = async cookie => (await json(await app.call('/api/v1/earnings/account', undefined, cookie))).data;
    const withdraw = (body, cookie = nurseCookie) => app.call('/api/v1/earnings/withdrawals', body, cookie);
    let account = await accountOf(nurseCookie);
    assert.deepEqual([account.balance, account.availableCredits, account.minimumCredits, account.canWithdraw, account.unit], [3000, 1, 10, false, 'home_visit']);
    assert.equal(account.credits[0].date, day(0));
    // What each person sees: the administrator follows progress without the clinical report.
    const adminView = (await json(await app.call('/api/v1/home-visits/progress', undefined, adminCookie))).data.visits[0];
    assert.equal(adminView.report, null);
    assert.equal(adminView.payout.status, 'available');
    assert.equal((await json(await app.call('/api/v1/home-visits/progress', undefined, doctorCookie))).data.visits[0].report.vitals.respiratoryRate, 18);
    // Fewer than 10 visits: no withdrawal yet.
    assert.match((await json(await withdraw({ method: 'mobile_money', destination: '677112233' }))).error, /after 10 completed home visits \(1 so far\)/);

    // Nine more completed visits: the account accrues to 30,000 FCFA.
    for (let n = 2; n <= 10; n++) {
      const id = `hv-pay-${n}`, path = `/api/v1/home-visits/${id}`;
      assert.equal((await app.call(`/api/v1/clinical/homeVisits/${id}`, { data: { patientId: patient.id, nurseId: nurse.id, doctorId: doctor.id, visitDate: day(0), visitTime: '23:00', status: 'scheduled', location: 'Home, Bonamoussadi' }, baseVersion: 0 }, patientCookie, 'PUT')).status, 201);
      await app.call(`${path}/report`, report, nurseCookie);
      await app.call(`${path}/feedback`, { rating: 5 }, patientCookie);
      await app.call(`${path}/confirm`, {}, doctorCookie);
    }
    account = await accountOf(nurseCookie);
    assert.deepEqual([account.balance, account.availableCredits, account.canWithdraw], [30000, 10, true]);
    assert.deepEqual(account.withdrawal, { rate: 0.05, fee: 1500, net: 28500 }, 'HFA keeps 5% of a nurse withdrawal');
    // The withdrawal takes the whole balance to the nurse's mobile money number (typed locally, stored as +237…).
    assert.equal((await withdraw({ method: 'mobile_money', destination: '12345' })).status, 400);
    assert.equal((await withdraw({ method: 'mobile_money', destination: '677 11 22 33' }, patientCookie)).status, 403);
    const requested = await withdraw({ method: 'mobile_money', destination: '677 11 22 33' });
    assert.equal(requested.status, 201);
    account = (await json(requested)).data;
    assert.deepEqual([account.balance, account.pending.amount, account.pending.fee, account.pending.net, account.pending.credits, account.pending.destination, account.pending.status], [0, 30000, 1500, 28500, 10, '+237677112233', 'queued']);
    assert.equal((await withdraw({ method: 'mobile_money', destination: '677112233' })).status, 409, 'one request at a time');

    // Nobody pays or declines by hand: the administrator's old actions are gone and the overview is read-only.
    for (const path of ['/api/v1/admin/nurse-withdrawals/x/paid', '/api/v1/admin/nurse-withdrawals/x/decline', '/api/v1/admin/nurse-payouts/x/paid'])
      assert.equal((await app.call(path, { reference: 'x123', note: 'xxxxx' }, adminCookie)).status, 404, path);
    const overview = (await json(await app.call('/api/v1/admin/earnings', undefined, adminCookie))).data;
    assert.deepEqual([overview.waiting, overview.automaticPayouts, overview.platformFee], [28500, true, { doctor: 0.1, nurse: 0.05 }]);
    // The payout service refuses the first payout: the money returns to the account with the reason.
    await app.earnings.processQueue();
    account = await accountOf(nurseCookie);
    assert.deepEqual([account.balance, account.withdrawals[0].status, account.withdrawals[0].reason], [30000, 'failed', 'Number not registered for mobile money']);
    // Asked again, cancelled by the nurse while waiting, asked a third time: paid automatically.
    const again = (await json(await withdraw({ method: 'bank_transfer', destination: 'Afriland First Bank, Ayuk, 10005 00001 01234567890 12' }))).data.pending;
    assert.equal((await app.call(`/api/v1/earnings/withdrawals/${again.id}/cancel`, {}, patientCookie)).status, 403);
    assert.equal((await app.call(`/api/v1/earnings/withdrawals/${again.id}/cancel`, {}, nurseCookie)).status, 200);
    assert.equal((await accountOf(nurseCookie)).balance, 30000, 'cancelled: back in the account');
    await withdraw({ method: 'mobile_money', destination: '677112233' });
    await app.earnings.processQueue(); // sent: processing
    assert.equal((await accountOf(nurseCookie)).pending.status, 'processing');
    assert.equal((await app.call(`/api/v1/earnings/withdrawals/${(await accountOf(nurseCookie)).pending.id}/cancel`, {}, nurseCookie)).status, 409, 'too late to cancel');
    await app.earnings.processQueue(); // confirmed: paid
    account = await accountOf(nurseCookie);
    assert.deepEqual([account.balance, account.totalPaid, account.totalFees, account.totalEarned, account.withdrawals[0].status, account.withdrawals[0].reference], [0, 28500, 1500, 30000, 'paid', 'MAV-2']);
    assert.equal(sent.at(-1).amount, 28500, 'the payout service sends the amount after the fee');
    assert.equal((await json(await app.call('/api/v1/admin/earnings', undefined, adminCookie))).data.feesWithheld, 1500);
    assert.equal(app.store.db.prepare("SELECT COUNT(*) AS n FROM earnings_credits WHERE source='home_visit'").get().n, 10, 'one credit per visit');
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
    assert.equal((await json(await app.call('/api/v1/earnings/account', undefined, nurseCookie))).data.balance, 3000);
    assert.equal((await app.call('/api/v1/admin/home-visits/hv-dc/doctor', { doctorId: replacement.id }, adminCookie)).status, 409, 'no change after confirmation');
  } finally { await app.close(); }
});

test('doctors: each completed consultation the patient paid for credits what they paid; withdrawal after 10 consultations', async () => {
  const app = await start();
  try {
    const doctor = await app.make('doctor', 'earn-doc@example.com', { profile: { consultationFee: 10 } });
    const patient = await app.make('patient', 'earn-pat@example.com', { phone: '+237677000555' });
    app.store.updateUser(patient.id, { assignedDoctor: doctor.id });
    const [doctorCookie, patientCookie] = await Promise.all(['earn-doc', 'earn-pat'].map(name => app.login(`${name}@example.com`)));
    const today = day(0);
    // A consultation record as the doctor's screens leave it (stored directly so the test does not depend on the clock).
    const consult = async (n, status = 'completed') => {
      const data = { id: `apt-earn-${n}`, patientId: patient.id, doctorId: doctor.id, nurseId: '', date: today, time: '09:00', durationMinutes: 30, mode: 'video', status };
      const sealed = seal(config, `clinical:appointments:${data.id}`, Buffer.from(JSON.stringify(data))), now = new Date().toISOString();
      app.store.db.prepare('INSERT INTO clinical_records VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run('appointments', data.id, patient.id, JSON.stringify([patient.id, doctor.id]), 1, sealed.nonce, sealed.encrypted, sealed.tag, now, doctor.id, now, doctor.id);
    };
    // A consultation fee confirmed by mobile money (as recorded by payments.js after MTN confirms).
    let paymentNo = 0;
    const pay = (usd, status = 'successful') => app.store.db.prepare(`INSERT INTO payments (id,payer_id,purpose,target_id,details,amount,currency,usd,provider,provider_reference,idempotency_key,status,created_at,completed_at,expires_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(`pay-${++paymentNo}`, patient.id, 'consultation_fee', doctor.id, '{}', Math.round(usd * 600), 'XAF', usd, 'mtn_momo', `ref-${paymentNo}`, `key-${paymentNo}`, status, new Date().toISOString(), new Date().toISOString(), Date.now());
    const account = async () => (await json(await app.call('/api/v1/earnings/account', undefined, doctorCookie))).data;

    await consult(1);
    assert.equal((await account()).balance, 0, 'completed but not paid: nothing');
    pay(10, 'failed');
    assert.equal((await account()).balance, 0, 'a failed payment pays nothing');
    pay(10);
    let a = await account();
    assert.deepEqual([a.balance, a.availableCredits, a.unit, a.credits[0].patientName], [6000, 1, 'consultation', 'Synthetic patient ear']);
    pay(10);
    assert.equal((await account()).balance, 6000, 'paid but the consultation has not happened yet: nothing more');
    await consult(2, 'scheduled');
    assert.equal((await account()).balance, 6000, 'booked, not completed: nothing more');
    await consult(3);
    assert.equal((await account()).balance, 12000);
    // The doctor raises their fee: what each patient actually paid is what is credited.
    app.store.updateUser(doctor.id, { profile: { consultationFee: 15 } });
    for (let n = 4; n <= 10; n++) { pay(15); await consult(n); }
    a = await account();
    assert.deepEqual([a.availableCredits, a.balance, a.canWithdraw], [9, 12000 + 7 * 9000, false]);
    assert.match((await json(await app.call('/api/v1/earnings/withdrawals', { method: 'mobile_money', destination: '699887766' }, doctorCookie))).error, /after 10 paid consultations \(9 so far\)/);
    pay(15); await consult(11);
    a = await account();
    assert.deepEqual([a.availableCredits, a.balance, a.canWithdraw], [10, 12000 + 8 * 9000, true]);
    const requested = (await json(await app.call('/api/v1/earnings/withdrawals', { method: 'mobile_money', destination: '699887766' }, doctorCookie))).data;
    assert.deepEqual([requested.pending.amount, requested.pending.fee, requested.pending.net, requested.pending.credits, requested.pending.status, requested.automaticPayouts], [84000, 8400, 75600, 10, 'queued', false], 'HFA keeps 10% of a doctor withdrawal');
    // No payout service connected yet: the request waits; nothing pays it by hand.
    await app.earnings.processQueue();
    assert.equal((await account()).pending.status, 'queued');
    assert.equal(app.store.db.prepare("SELECT COUNT(DISTINCT payment_id) AS n FROM earnings_credits WHERE source='consultation'").get().n, 10, 'each payment counted once');
  } finally { await app.close(); }
});
