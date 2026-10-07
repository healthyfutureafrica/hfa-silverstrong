const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Store, hashPassword } = require('../store');
const { createApp } = require('../server');

test('authenticated API blocks forged recipients, roles, origins and unconfigured verification', async () => {
  const store = new Store();
  const config = { origin: 'http://localhost:8080', ready: false, verifyToken: 'synthetic-verification-token', appSecret: 'synthetic-secret' };
  const provider = { webhook() {}, verification() { throw new Error('Must not run without configuration'); } };
  const app = createApp(config, store, provider);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, body, cookie, origin = config.origin) => fetch(base + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-HFA-Request': '1', Origin: origin, ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body)
  });
  try {
    const registered = await request('/api/auth/register', { name: 'Synthetic Patient', email: 'patient@example.invalid', password: 'Synthetic-password-123', role: 'patient', whatsappNumber: '+237600000000', whatsappNotificationsConsent: true });
    assert.equal(registered.status, 201);
    const { user } = await registered.json();
    const cookie = registered.headers.get('set-cookie').split(';')[0];
    assert.match(registered.headers.get('set-cookie'), /HttpOnly/);
    assert.match(registered.headers.get('set-cookie'), /SameSite=Strict/);
    assert.equal(user.password, undefined);
    const event = { eventId: 'synthetic-event-one', patientId: user.id, resource: 'Appointments' };
    assert.equal((await request('/api/activities', event)).status, 401);
    const accepted = await request('/api/activities', event, cookie);
    assert.equal(accepted.status, 202);
    assert.equal((await accepted.json()).status, 'blocked_verification');
    assert.equal((await request('/api/activities', { ...event, patientId: 'forged-recipient' }, cookie)).status, 403);
    assert.equal((await request('/api/activities', { ...event, phone: '+237699999999' }, cookie)).status, 400);
    assert.equal((await request('/api/activities', event, cookie, 'https://attacker.invalid')).status, 403);
    assert.equal((await request('/api/whatsapp/verification', {}, cookie)).status, 503);
    assert.equal((await request('/api/auth/register', { name: 'Forged Admin', email: 'admin@example.invalid', password: 'Synthetic-password-123', role: 'admin' })).status, 400);
    assert.equal((await fetch(base + '/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123')).status, 403);
    assert.equal((await fetch(base + '/api/whatsapp/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
    const doctor = store.createUser({ name: 'Synthetic Doctor', email: 'doctor@example.invalid', role: 'doctor' }, await hashPassword('Synthetic-password-123'), 'active');
    const doctorCookie = `hfa_session=${store.createSession(doctor.id)}`;
    assert.equal((await request('/api/activities', { ...event, eventId: 'doctor-event-unassigned' }, doctorCookie)).status, 403);
    store.updateUser(user.id, { assignedDoctor: doctor.id });
    assert.equal((await request('/api/activities', { ...event, eventId: 'doctor-event-assigned' }, doctorCookie)).status, 202);
  } finally { await new Promise(resolve => server.close(resolve)); store.close(); }
});