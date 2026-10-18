const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const Numbering = require('../../hfa-numbering.js');
const { Store } = require('../store');
const { createApp } = require('../server');

const config = { origin: 'http://localhost:8080', ready: false, fileEncryptionKey: '78'.repeat(32) };

test('numbers carry the portal and hospital or region/town, with a check digit', () => {
  assert.equal(Numbering.format('DR-HCH', 1), 'HFA-DR-HCH-0001-7');
  assert.equal(Numbering.format('PT-HCH', 12), 'HFA-PT-HCH-000012-' + Numbering.checkDigit('PT-HCH-000012'));
  assert.equal(Numbering.isValid('HFA-PH-LT-DLA-0001-2'), true);
  assert.equal(Numbering.isValid('HFA-PH-LT-DLA-0001-3'), false, 'wrong check digit');
  for (const typo of ['HFA-PH-LT-DLB-0001-2', 'HFA-PH-LT-DLA-0002-2', 'HFA-PH-LT-OLA-0001-2', 'HFA-PH-SW-DLA-0001-2']) assert.equal(Numbering.isValid(typo), false, 'single mistyped character detected: ' + typo);
  assert.deepEqual(Numbering.parse('HFA-LB-NW-BDA-0007-' + Numbering.checkDigit('LB-NW-BDA-0007')), { portal: 'LB', facilityCode: null, regionCode: 'NW', townCode: 'BDA', sequence: 7 });
  assert.equal(Numbering.facilityCode('Hôpital Général de Douala'), 'HGD');
  assert.equal(Numbering.facilityCode('Hôpital Général de Douala', ['HGD']), 'HG2');
  assert.equal(Numbering.nameKey('Hôpital Général de Douala'), Numbering.nameKey('HOPITAL GENERAL DOUALA'));
});

test('each stakeholder gets the right number automatically, and numbers never change', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hfa-numbers-')), path = join(directory, 'hfa.sqlite');
  try {
    let store = new Store(path);
    const doctor = store.createUser({ name: 'Dr Synthetic', email: 'd@example.invalid', role: 'doctor', profile: { hospital: 'Hôpital Général de Douala' } }, 'x', 'active');
    const doctor2 = store.createUser({ name: 'Dr Second', email: 'd2@example.invalid', role: 'doctor', profile: { hospital: 'hopital general douala' } }, 'x', 'active');
    const nurse = store.createUser({ name: 'Nurse Synthetic', email: 'n@example.invalid', role: 'nurse', profile: { hospital: 'Hôpital Laquintinie' } }, 'x', 'active');
    const patient = store.createUser({ name: 'Patient One', email: 'p@example.invalid', role: 'patient', facilityId: doctor.facilityId }, 'x', 'active');
    const loose = store.createUser({ name: 'Patient Two', email: 'p2@example.invalid', role: 'patient' }, 'x', 'active');
    const pharmacy = store.createUser({ name: 'Pharm', email: 'ph@example.invalid', role: 'pharmacist', profile: { pharmacyLocation: 'Bamenda, North West, Cameroon' } }, 'x', 'pending_approval');
    const pharmacy2 = store.createUser({ name: 'Pharm Two', email: 'ph2@example.invalid', role: 'pharmacist', profile: { pharmacyRegion: 'north_west', pharmacyTown: 'Bambui' } }, 'x', 'pending_approval');
    const lab = store.createUser({ name: 'Lab', email: 'lab@example.invalid', role: 'labtech', profile: { labRegion: 'littoral', labTown: 'Douala' } }, 'x', 'active');
    const admin = store.createUser({ name: 'Admin', email: 'a@example.invalid', role: 'admin' }, 'x', 'active');

    assert.match(doctor.hfaId, /^HFA-DR-HGD-0001-\d$/);
    assert.match(doctor2.hfaId, /^HFA-DR-HGD-0002-\d$/, 'same hospital despite spelling differences');
    assert.equal(doctor2.facilityId, doctor.facilityId);
    assert.match(nurse.hfaId, /^HFA-NS-HLA-0001-\d$/);
    assert.match(patient.hfaId, /^HFA-PT-HGD-000001-\d$/);
    assert.equal(patient.facilityName, 'Hôpital Général de Douala');
    assert.match(loose.hfaId, /^HFA-PT-HFA-000001-\d$/, 'not registered with a hospital yet');
    assert.match(pharmacy.hfaId, /^HFA-PH-NW-BDA-0001-\d$/);
    assert.match(pharmacy2.hfaId, /^HFA-PH-NW-BMB-0001-\d$/);
    assert.match(lab.hfaId, /^HFA-LB-LT-DLA-0001-\d$/);
    assert.match(admin.hfaId, /^HFA-AD-0001-\d$/);
    for (const user of [doctor, doctor2, nurse, patient, loose, pharmacy, pharmacy2, lab, admin]) assert.equal(Numbering.isValid(user.hfaId), true, user.hfaId);

    // The hospital link can change; the number does not.
    store.setPatientFacility(loose.id, nurse.facilityId);
    assert.equal(store.user(loose.id).hfaId, loose.hfaId);
    assert.equal(store.user(loose.id).facilityCode, 'HLA');

    // Accounts that existed before numbering are numbered on the next start, clinicians first.
    store.db.prepare('UPDATE users SET hfa_number=NULL, facility_id=NULL').run();
    store.db.prepare('DELETE FROM hfa_sequences').run();
    store.db.prepare('UPDATE users SET assigned_doctor=? WHERE id=?').run(doctor.id, loose.id);
    store.close();
    store = new Store(path);
    assert.match(store.user(loose.id).hfaId, /^HFA-PT-HGD-\d{6}-\d$/, 'older patient takes the assigned doctor\'s hospital');
    assert.match(store.user(doctor.id).hfaId, /^HFA-DR-HGD-000[12]-\d$/);
    const numbers = store.db.prepare('SELECT hfa_number FROM users').all().map(row => row.hfa_number);
    assert.equal(new Set(numbers).size, numbers.length, 'all numbers unique');
    store.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('patients register under a listed hospital, and only that hospital\'s clinicians see the list', async () => {
  const store = new Store();
  const server = createApp(config, store, {}).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, body, cookie, method = body === undefined ? 'GET' : 'POST') => fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-HFA-Request': '1', Origin: config.origin, ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  try {
    const doctor = store.createUser({ name: 'Dr Listed', email: 'listed@example.invalid', role: 'doctor', profile: { hospital: 'Bamenda Regional Hospital' } }, 'x', 'active');
    const pendingDoctor = store.createUser({ name: 'Dr Pending', email: 'pending@example.invalid', role: 'doctor', profile: { hospital: 'Unverified Clinic' } }, 'x', 'pending_approval');
    const otherDoctor = store.createUser({ name: 'Dr Other', email: 'other@example.invalid', role: 'doctor', profile: { hospital: 'Another Hospital' } }, 'x', 'active');
    const { data } = await (await request('/api/v1/facilities')).json();
    assert.deepEqual(data.hospitals.map(hospital => hospital.name).sort(), ['Another Hospital', 'Bamenda Regional Hospital'], 'hospitals without an active clinician are not listed');
    assert.equal(data.hospitals.some(hospital => hospital.id === pendingDoctor.facilityId), false);

    const patient = { name: 'Synthetic Patient', password: 'Synthetic-password-123', role: 'patient', phone: '+237677555111', whatsappNumber: '+237677555111' };
    assert.equal((await request('/api/auth/register', { ...patient, hospitalId: pendingDoctor.facilityId })).status, 400);
    const registered = await request('/api/auth/register', { ...patient, hospitalId: doctor.facilityId });
    assert.equal(registered.status, 201);
    const { user } = await registered.json();
    assert.match(user.hfaId, /^HFA-PT-BRH-000001-\d$/);
    assert.equal(user.facilityName, 'Bamenda Regional Hospital');

    const list = await (await request('/api/v1/facilities/mine/patients', undefined, `hfa_session=${store.createSession(doctor.id)}`)).json();
    assert.equal(list.data.facility.code, 'BRH');
    assert.deepEqual(list.data.patients.map(item => item.hfaId), [user.hfaId]);
    assert.deepEqual(Object.keys(list.data.patients[0]).sort(), ['createdAt', 'hfaId', 'id', 'name', 'status'], 'names and numbers only');
    const other = await (await request('/api/v1/facilities/mine/patients', undefined, `hfa_session=${store.createSession(otherDoctor.id)}`)).json();
    assert.equal(other.data.patients.length, 0);
    assert.equal((await request('/api/v1/facilities/mine/patients', undefined, `hfa_session=${store.createSession(user.id)}`)).status, 403);

    const admin = store.createUser({ name: 'Admin', email: 'admin-fac@example.invalid', role: 'admin' }, 'x', 'active');
    const register = await (await request('/api/v1/admin/facilities', undefined, `hfa_session=${store.createSession(admin.id)}`)).json();
    assert.equal(register.data.hospitals.find(hospital => hospital.code === 'BRH').patients, 1);
    assert.equal((await request('/api/v1/admin/facilities', undefined, `hfa_session=${store.createSession(doctor.id)}`)).status, 403);
    assert.equal((await request('/api/auth/register', { name: 'Dr Wrong', email: 'wrong@example.invalid', password: 'Synthetic-password-123', role: 'doctor', hospitalId: doctor.facilityId })).status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); store.close(); }
});
