const { test } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { Store } = require('../store');
const { createApp } = require('../server');

const config = { origin: 'http://localhost:8080', ready: false, fileEncryptionKey: '56'.repeat(32) };

async function startServer(store, overrides = {}) {
  const server = createApp({ ...config, ...overrides }, store, {}).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, body, cookie, method = 'POST') => fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', 'X-HFA-Request': '1', Origin: config.origin, ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const upload = (path, blob, cookie, field = 'avatar') => {
    const form = new FormData();
    form.append(field, blob, 'avatar.png');
    return fetch(base + path, { method: 'POST', headers: { 'X-HFA-Request': '1', Origin: config.origin, Cookie: cookie }, body: form });
  };
  return { server, base, request, upload, close: () => new Promise(resolve => server.close(resolve)) };
}

const cookieOf = response => response.headers.get('set-cookie').split(';')[0];

const fullProfile = () => ({
  identity: { dateOfBirth: '1988-04-12', gender: 'female', cniNumber: '112233445' },
  location: { secondaryPhone: '+237699000111', region: 'north_west', division: 'Mezam', town: 'Bamenda', healthDistrict: 'Bamenda', gps: { lat: 5.9631, lng: 10.1591, accuracy: 25, capturedAt: '2026-10-18T08:00:00.000Z' }, settlement: 'urban' },
  medical: {
    bloodGroup: 'O+', genotype: 'AS', conditions: ['hypertension', 'diabetes_type2'],
    drugAllergies: [{ name: 'Penicillin', severity: 'severe' }], foodAllergies: 'Groundnuts',
    medications: [{ name: 'Amlodipine', dose: '5 mg', frequency: 'Once daily', prescriber: 'Dr. Synthetic', since: '2024-01-10' }],
    surgeries: [{ procedure: 'Appendectomy', year: 2010, hospital: 'Synthetic Regional Hospital' }],
    familyHistory: ['hypertension', 'stroke'], disability: 'none'
  },
  lifestyle: {
    smoking: 'never', alcohol: 'occasional', occupation: 'Teacher', sector: 'education', waterSource: 'tap', toilet: 'flush',
    income: '150k_500k', insurance: 'cnps', insuranceNumber: 'CNPS-TEST-1',
    emergencyContact: { name: 'Synthetic Relative', relationship: 'Sister', phone: '+237677000222' }
  },
  consents: { dataSharing: true, research: true, sms: true, whatsapp: true, ministry: false }
});

const patientInput = () => ({
  name: 'Synthetic Patient Ngwa', password: 'Synthetic-password-123', role: 'patient', phone: '+237677123456',
  whatsappNumber: '+237677123456', whatsappNotificationsConsent: true, preferredLanguage: 'fr', healthProfile: fullProfile()
});

test('patients complete the 5-step registration without email, sign in by phone, and health data stays encrypted and private', async () => {
  const store = new Store(), app = await startServer(store);
  try {
    const refused = await app.request('/api/auth/register', { ...patientInput(), healthProfile: { ...fullProfile(), consents: { ...fullProfile().consents, dataSharing: false } } });
    assert.equal(refused.status, 400);
    assert.equal((await app.request('/api/auth/register', { ...patientInput(), phone: undefined, whatsappNumber: undefined })).status, 400);
    assert.equal((await app.request('/api/auth/register', { ...patientInput(), healthProfile: { ...fullProfile(), lifestyle: { ...fullProfile().lifestyle, cigarettesPerDay: 5 } } })).status, 400);
    assert.equal((await app.request('/api/auth/register', { ...patientInput(), healthProfile: { ...fullProfile(), identity: { ...fullProfile().identity, dateOfBirth: '2999-01-01' } } })).status, 400);

    const vaccination = { fileName: 'carnet.pdf', content: Buffer.from('%PDF-1.4 synthetic carnet').toString('base64') };
    const registered = await app.request('/api/auth/register', { ...patientInput(), vaccinationDocument: vaccination });
    assert.equal(registered.status, 201);
    const { user } = await registered.json();
    assert.equal(user.email, '');
    assert.equal(user.preferredLanguage, 'fr');
    assert.equal(user.healthProfile.medical.genotype, 'AS');
    assert.equal(user.healthProfile.consents.dataSharing, true);
    assert.ok(user.healthProfile.consents.recordedAt);
    assert.equal(user.vaccinationDocument.mime, 'application/pdf');
    assert.equal(user.bloodType, undefined, 'health data is not stored in the plain profile');

    // Encrypted at rest: neither the profile column nor the record ciphertext contains the medical data.
    const row = store.db.prepare('SELECT profile FROM users WHERE id=?').get(user.id);
    assert.equal(row.profile.includes('Penicillin'), false);
    const record = store.db.prepare('SELECT encrypted FROM patient_records WHERE user_id=?').get(user.id);
    assert.equal(Buffer.from(record.encrypted).includes(Buffer.from('Penicillin')), false);
    assert.equal(Buffer.from(record.encrypted).includes(Buffer.from('112233445')), false);

    assert.equal((await app.request('/api/auth/register', { ...patientInput(), name: 'Synthetic Duplicate' })).status, 409);

    const byPhone = await app.request('/api/auth/login', { email: '+237 677 123 456', password: 'Synthetic-password-123' });
    assert.equal(byPhone.status, 200);
    const session = await (await app.request('/api/session', undefined, cookieOf(byPhone), 'GET')).json();
    assert.equal(session.user.healthProfile.medical.drugAllergies[0].name, 'Penicillin');
    assert.equal((await app.request('/api/auth/login', { email: '+237677123456', password: 'wrong-password-123' })).status, 401);

    // Clinicians see health data only for patients assigned to them.
    const doctor = store.createUser({ name: 'Synthetic Doctor', email: 'doctor-health@example.invalid', role: 'doctor' }, 'unused', 'active');
    const doctorCookie = `hfa_session=${store.createSession(doctor.id)}`;
    const before = await (await app.request('/api/session', undefined, doctorCookie, 'GET')).json();
    assert.equal(before.users.find(item => item.id === user.id), undefined);
    store.updateUser(user.id, { assignedDoctor: doctor.id });
    const after = await (await app.request('/api/session', undefined, doctorCookie, 'GET')).json();
    assert.equal(after.users.find(item => item.id === user.id).healthProfile.medical.bloodGroup, 'O+');
    const otherPatient = store.createUser({ name: 'Synthetic Other', email: 'other-health@example.invalid', role: 'patient' }, 'unused', 'active');
    const otherView = await (await app.request('/api/session', undefined, `hfa_session=${store.createSession(otherPatient.id)}`, 'GET')).json();
    assert.equal(otherView.users.some(item => item.healthProfile), false);
  } finally { await app.close(); store.close(); }
});

test('health data is refused when encrypted storage is not configured', async () => {
  const store = new Store(), app = await startServer(store, { fileEncryptionKey: '' });
  try {
    assert.equal((await app.request('/api/auth/register', patientInput())).status, 503);
    assert.equal(store.credentialsByPhone('+237677123456'), undefined);
  } finally { await app.close(); store.close(); }
});

test('Nigeria profiles use the country-aware location schema and reject mismatched regions', async () => {
  const store = new Store(), app = await startServer(store);
  const nigeria = patientInput();
  nigeria.countryCode = 'NG';
  nigeria.phone = '+2348030000000';
  nigeria.whatsappNumber = '+2348030000000';
  nigeria.healthProfile = {
    ...fullProfile(),
    lifestyle: { ...fullProfile().lifestyle, insurance: 'public_scheme' },
    location: { countryCode: 'NG', region: 'NG-LA', division: 'Ikeja', town: 'Lagos' }
  };
  try {
    const registered = await app.request('/api/auth/register', nigeria);
    assert.equal(registered.status, 201);
    const { user } = await registered.json();
    assert.equal(user.countryCode, 'NG');
    assert.equal(user.healthProfile.location.countryCode, 'NG');
    assert.equal(user.healthProfile.location.region, 'NG-LA');
    assert.equal(user.healthProfile.location.division, 'Ikeja');
    assert.equal(user.healthProfile.lifestyle.insurance, 'public_scheme');

    const wrongRegion = { ...patientInput(), countryCode: 'NG', healthProfile: {
      ...fullProfile(), location: { countryCode: 'NG', region: 'centre', division: 'Mfoundi', town: 'Yaoundé' }
    } };
    assert.equal((await app.request('/api/auth/register', wrongRegion)).status, 400);
    const wrongCountry = { ...patientInput(), countryCode: 'CM', healthProfile: {
      ...fullProfile(), location: { countryCode: 'NG', region: 'NG-LA', division: 'Ikeja', town: 'Lagos' }
    } };
    assert.equal((await app.request('/api/auth/register', wrongCountry)).status, 400);
  } finally { await app.close(); store.close(); }
});

test('profile pictures are validated, converted to WebP, encrypted, replaced and removed', async () => {
  const store = new Store(), app = await startServer(store);
  try {
    const owner = store.createUser({ name: 'Amina Synthetic', email: 'avatar-owner@example.invalid', role: 'patient' }, 'unused', 'active');
    const other = store.createUser({ name: 'Other Synthetic', email: 'avatar-other@example.invalid', role: 'patient' }, 'unused', 'active');
    const cookie = `hfa_session=${store.createSession(owner.id)}`, otherCookie = `hfa_session=${store.createSession(other.id)}`;
    const png = size => sharp({ create: { width: size, height: size, channels: 3, background: { r: 0, g: 107, b: 63 } } }).png().toBuffer();
    const path = `/api/v1/users/${owner.id}/avatar`;

    const placeholder = await app.request(path, undefined, cookie, 'GET');
    assert.equal(placeholder.status, 200);
    assert.match(placeholder.headers.get('content-type'), /image\/svg\+xml/);
    assert.match(await placeholder.text(), />A<\/text>/);

    assert.equal((await app.upload(path, new Blob([await png(150)], { type: 'image/png' }), cookie)).status, 422);
    assert.equal((await app.upload(path, new Blob(['GIF89a not allowed'], { type: 'image/gif' }), cookie)).status, 415);
    assert.equal((await app.upload(path, new Blob([await png(400)], { type: 'image/png' }), otherCookie)).status, 403);
    assert.equal((await app.upload(path, new Blob([await png(400)], { type: 'image/png' }), cookie, 'photo')).status, 400);
    const noHeader = new FormData(); noHeader.append('avatar', new Blob([await png(400)]), 'a.png');
    assert.equal((await fetch(app.base + path, { method: 'POST', headers: { Cookie: cookie }, body: noHeader })).status, 403, 'CSRF header is required');

    const uploaded = await app.upload(path, new Blob([await png(1200)], { type: 'image/png' }), cookie);
    assert.equal(uploaded.status, 201);
    const body = await uploaded.json();
    assert.equal(body.success, true);
    assert.ok(body.timestamp);
    assert.match(body.data.avatarUrl, new RegExp(`^/api/v1/users/${owner.id}/avatar\\?v=`));
    const firstKey = store.user(owner.id).avatarKey;
    assert.match(firstKey, new RegExp(`^avatars/${owner.id}/[0-9a-f-]{36}\\.webp$`));

    const image = await app.request(path, undefined, cookie, 'GET');
    assert.equal(image.headers.get('content-type'), 'image/webp');
    const meta = await sharp(Buffer.from(await image.arrayBuffer())).metadata();
    assert.equal(meta.format, 'webp');
    assert.equal(meta.width, 800);
    assert.equal(meta.height, 800);
    const stored = store.db.prepare('SELECT encrypted FROM avatars WHERE user_id=?').get(owner.id);
    assert.equal(Buffer.from(stored.encrypted).subarray(0, 4).toString() === 'RIFF', false, 'stored encrypted, not as plain WebP');

    // Users who cannot see this account cannot fetch its photo.
    assert.equal((await app.request(path, undefined, otherCookie, 'GET')).status, 404);

    await app.upload(path, new Blob([await png(300)], { type: 'image/png' }), cookie);
    assert.notEqual(store.user(owner.id).avatarKey, firstKey);
    assert.equal(store.db.prepare('SELECT COUNT(*) AS total FROM avatars WHERE user_id=?').get(owner.id).total, 1, 'old photo replaced');

    assert.equal((await app.request(path, undefined, otherCookie, 'DELETE')).status, 403);
    const removed = await app.request(path, undefined, cookie, 'DELETE');
    assert.equal(removed.status, 200);
    assert.equal((await removed.json()).data.avatarUrl, null);
    assert.equal(store.user(owner.id).avatarUrl, null);
    assert.match((await app.request(path, undefined, cookie, 'GET')).headers.get('content-type'), /svg/);
  } finally { await app.close(); store.close(); }
});

test('existing patients complete their health profile later; nobody else can write it', async () => {
  const store = new Store(), app = await startServer(store);
  try {
    const patient = store.createUser({ name: 'Legacy Patient', email: 'legacy@example.invalid', role: 'patient', whatsappNumber: '+237600000009' }, 'unused', 'active');
    const doctor = store.createUser({ name: 'Synthetic Doctor', email: 'doctor-write@example.invalid', role: 'doctor' }, 'unused', 'active');
    const cookie = `hfa_session=${store.createSession(patient.id)}`, doctorCookie = `hfa_session=${store.createSession(doctor.id)}`;
    const path = `/api/v1/users/${patient.id}/health-profile`;
    const big = { fileName: 'carnet.pdf', content: Buffer.concat([Buffer.from('%PDF-1.4 '), Buffer.alloc(100000, 32)]).toString('base64') };
    assert.equal((await app.request(path, { healthProfile: fullProfile() }, doctorCookie, 'PUT')).status, 403);
    assert.equal((await app.request(path, { healthProfile: { ...fullProfile(), extra: 1 } }, cookie, 'PUT')).status, 400);
    const saved = await app.request(path, { preferredLanguage: 'en', healthProfile: fullProfile(), vaccinationDocument: big }, cookie, 'PUT');
    assert.equal(saved.status, 200, 'documents larger than the 32 kB default JSON limit are accepted here');
    const { user } = await saved.json();
    assert.equal(user.healthProfile.location.division, 'Mezam');
    assert.equal(user.vaccinationDocument.mime, 'application/pdf');
    assert.equal(user.preferredLanguage, 'en');
    const session = await (await app.request('/api/session', undefined, cookie, 'GET')).json();
    assert.equal(session.user.healthProfile.lifestyle.insurance, 'cnps');
  } finally { await app.close(); store.close(); }
});
