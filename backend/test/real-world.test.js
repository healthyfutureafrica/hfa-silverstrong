const { test } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { Store, hashPassword } = require('../store');
const { createApp } = require('../server');

const config = { origin: 'http://localhost:8080', ready: false, fileEncryptionKey: '1e'.repeat(32), requireAdminMfa: false };

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
const cookieOf = response => response.headers.get('set-cookie')?.split(';')[0];

async function people(store, app) {
  const make = async (role, email, profile = {}) => store.createUser({ name: `Synthetic ${role} ${email.split('@')[0]}`, email, role, phone: role === 'patient' ? '+237677999001' : '', profile }, await hashPassword('Synthetic-pass-123'), 'active');
  const admin = await make('admin', 'rw-admin@example.invalid');
  const doctor = await make('doctor', 'rw-doc@example.invalid', { hospital: 'Synthetic RW Hospital' });
  const otherDoctor = await make('doctor', 'rw-other@example.invalid', { hospital: 'Synthetic Other RW Hospital' });
  const patient = await make('patient', 'rw-pat@example.invalid');
  const stranger = await make('patient', 'rw-stranger@example.invalid');
  store.updateUser(patient.id, { assignedDoctor: doctor.id });
  const login = async email => cookieOf(await app.request('/api/auth/login', { email, password: 'Synthetic-pass-123' }));
  return { admin, doctor, otherDoctor, patient, stranger, cookies: Object.fromEntries(await Promise.all(['admin', 'doc', 'other', 'pat', 'stranger'].map(async name => [name, await login(`rw-${name}@example.invalid`)]))) };
}

test('a person who forgot their password gets a one-time code from their clinic and sets a new password', async () => {
  const store = new Store();
  const app = await startServer(store);
  try {
    const { admin, patient, cookies } = await people(store, app);
    // Visitors can ask whether they are signed in without getting an error response.
    assert.deepEqual(await (await app.request('/api/session/status')).json(), { signedIn: false });
    assert.deepEqual(await (await app.request('/api/session/status', undefined, cookies.pat)).json(), { signedIn: true });
    assert.equal((await app.request(`/api/v1/admin/users/${patient.id}/reset-code`, {}, cookies.doc)).status, 403, 'administrators only');
    assert.equal((await app.request(`/api/v1/admin/users/${admin.id}/reset-code`, {}, cookies.admin)).status, 403, 'not for oneself');
    const created = await (await app.request(`/api/v1/admin/users/${patient.id}/reset-code`, {}, cookies.admin)).json();
    const code = created.data.code;
    assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const reset = body => app.request('/api/auth/reset-password', body);
    // Wrong codes count as attempts; a weak password is refused; the right code works once, by phone number too.
    assert.equal((await reset({ email: '+237677999001', code: 'AAAA-AAAA', newPassword: 'New-strong-pass-77' })).status, 400);
    assert.equal((await reset({ email: '+237 677 999 001', code: code.toLowerCase(), newPassword: 'short' })).status, 400);
    assert.equal((await reset({ email: '+237 677 999 001', code: code.replace('-', ' '), newPassword: 'New-strong-pass-77' })).status, 200);
    assert.equal((await reset({ email: 'rw-pat@example.invalid', code, newPassword: 'Another-pass-778' })).status, 400, 'used once');
    assert.equal((await app.request('/api/session', undefined, cookies.pat)).status, 401, 'old sessions are signed out');
    assert.equal((await app.request('/api/auth/login', { email: 'rw-pat@example.invalid', password: 'New-strong-pass-77' })).status, 200);
    const actions = store.db.prepare("SELECT action FROM audit_log WHERE target_id=? AND action LIKE 'PASSWORD_RESET%'").all(patient.id).map(row => row.action);
    assert.deepEqual(actions.sort(), ['PASSWORD_RESET', 'PASSWORD_RESET_CODE_CREATED']);
  } finally { await app.close(); store.close(); }
});

test('notifications reach people who work together, with generic text, once per request', async () => {
  const store = new Store();
  const app = await startServer(store);
  try {
    const { doctor, otherDoctor, patient, stranger, cookies } = await people(store, app);
    const notify = (cookie, to, resource = 'Lab Results', eventId = crypto.randomUUID()) => app.request('/api/v1/notify', { to, resource, eventId }, cookie);
    assert.equal((await notify(cookies.pat, doctor.id, 'Appointments')).status, 201, 'patient to their doctor');
    assert.ok(store.notifications(doctor.id).some(item => item.message.includes('Appointments')));
    assert.equal((await notify(cookies.stranger, doctor.id)).status, 403, 'not to a doctor they have no link with');
    assert.equal((await notify(cookies.pat, stranger.id)).status, 403, 'not patient to patient');
    assert.equal((await notify(cookies.other, doctor.id)).status, 201, 'staff to staff');
    const eventId = crypto.randomUUID();
    await notify(cookies.doc, patient.id, 'Lab Results', eventId);
    await notify(cookies.doc, patient.id, 'Lab Results', eventId);
    const mine = store.notifications(patient.id);
    assert.equal(mine.length, 1, 'retries do not duplicate');
    assert.doesNotMatch(mine[0].message, /malaria|result:/i, 'never clinical content');
    void otherDoctor;
  } finally { await app.close(); store.close(); }
});

test('identity documents are uploaded to the server and verified by an administrator; doctor portraits are shown only once approved', async () => {
  const store = new Store();
  const app = await startServer(store);
  try {
    const { doctor, patient, cookies } = await people(store, app);
    const pdf = Buffer.from('%PDF-1.4 synthetic identity').toString('base64');
    const uploaded = await app.request('/api/v1/account/id-document', { idDocumentType: 'national_id', idDocument: { fileName: 'cni.pdf', content: pdf } }, cookies.doc);
    assert.equal(uploaded.status, 201);
    assert.equal((await uploaded.json()).user.idVerificationStatus, 'pending');
    assert.equal((await app.request(`/api/admin/users/${doctor.id}/documents/identity`, undefined, cookies.admin)).status, 200, 'the administrator can open it');
    const verified = await app.request(`/api/admin/users/${doctor.id}`, { idVerificationStatus: 'verified' }, cookies.admin, 'PATCH');
    assert.equal((await verified.json()).user.idVerificationStatus, 'verified');

    const png = (await sharp({ create: { width: 300, height: 300, channels: 3, background: '#2a8f5c' } }).png().toBuffer()).toString('base64');
    assert.equal((await app.request('/api/v1/doctor-photo', { content: png }, cookies.pat)).status, 403, 'doctors only');
    assert.equal((await app.request('/api/v1/doctor-photo', { content: png }, cookies.doc)).status, 201);
    assert.equal(store.user(doctor.id).doctorPhotoStatus, 'pending');
    assert.equal((await app.request(`/api/v1/users/${doctor.id}/doctor-photo`, undefined, cookies.pat)).status, 404, 'not shown before approval');
    assert.equal((await app.request(`/api/v1/admin/doctor-photos/${doctor.id}`, undefined, cookies.admin)).status, 200);
    assert.equal((await app.request(`/api/v1/admin/doctor-photos/${doctor.id}`, { approve: true }, cookies.admin)).status, 200);
    const shown = await app.request(`/api/v1/users/${doctor.id}/doctor-photo`, undefined, cookies.pat);
    assert.equal(shown.status, 200);
    assert.equal(shown.headers.get('content-type'), 'image/webp');
    // A rejected replacement keeps the approved portrait.
    await app.request('/api/v1/doctor-photo', { content: png }, cookies.doc);
    await app.request(`/api/v1/admin/doctor-photos/${doctor.id}`, { approve: false }, cookies.admin);
    assert.equal((await app.request(`/api/v1/users/${doctor.id}/doctor-photo`, undefined, cookies.pat)).status, 200);
    assert.equal(store.user(doctor.id).doctorPhotoStatus, 'rejected');
    void patient;
  } finally { await app.close(); store.close(); }
});

test('Health Hub statistics are anonymous counts', async () => {
  const store = new Store();
  const app = await startServer(store);
  try {
    const { cookies } = await people(store, app);
    for (const topic of ['malaria', 'malaria', 'diabetes']) assert.equal((await app.request('/api/v1/hub/events', { type: 'view', topic, lang: 'fr' })).status, 204);
    assert.equal((await app.request('/api/v1/hub/events', { type: 'search', topic: 'My name is Ako and I have HIV' })).status, 400, 'no free text is stored');
    const stats = (await (await app.request('/api/v1/admin/hub-stats', undefined, cookies.admin)).json()).data;
    assert.deepEqual(stats.rows.map(row => [row.topic, row.count]), [['malaria', 2], ['diabetes', 1]]);
    assert.equal((await app.request('/api/v1/admin/hub-stats', undefined, cookies.pat)).status, 403);
    const columns = store.db.prepare('PRAGMA table_info(hub_stats)').all().map(column => column.name);
    assert.deepEqual(columns, ['day', 'type', 'topic', 'lang', 'count']);
  } finally { await app.close(); store.close(); }
});
