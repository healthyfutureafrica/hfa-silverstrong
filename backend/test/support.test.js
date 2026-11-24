const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Store } = require('../store');
const { createApp } = require('../server');
const { vitalDangers } = require('../vital-alerts');

const config = { origin: 'http://localhost:8080', ready: false, fileEncryptionKey: '9c'.repeat(32) };

test('a person opens a support request, HFA answers and resolves it, and nobody else can read it', async () => {
  const store = new Store();
  const make = (name, email, role) => store.createUser({ name, email, role }, 'test-password-hash', 'active');
  const patient = make('Synthetic Support Patient', 'support-patient@example.invalid', 'patient'); // no paid plan
  const other = make('Synthetic Other Patient', 'support-other@example.invalid', 'patient');
  const admin = make('Synthetic Support Admin', 'support-admin@example.invalid', 'admin');
  const server = createApp(config, store, {}).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const sessions = new Map([patient, other, admin].map(user => [user.id, store.createSession(user.id)]));
  const call = async (user, method, path, body) => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-HFA-Request': '1', Origin: config.origin, Cookie: `hfa_session=${sessions.get(user.id)}` }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  };
  try {
    const opened = await call(patient, 'POST', '/api/v1/support', { subject: 'MoMo payment not showing', category: 'billing', priority: 'high', description: 'I paid my Essential plan but the app still asks me to pay.' });
    assert.equal(opened.status, 201, 'patients without a paid plan can still ask for help');
    const id = opened.body.data.ticket.id;
    assert.equal((await call(patient, 'POST', '/api/v1/support', { subject: '<b>x</b>', category: 'billing', priority: 'normal', description: 'markup is refused here' })).status, 400);
    assert.equal((await call(other, 'POST', `/api/v1/support/${id}/reply`, { text: 'not mine' })).status, 404);
    assert.equal((await call(other, 'GET', '/api/v1/support')).body.data.tickets.length, 0);
    const queue = (await call(admin, 'GET', '/api/v1/support')).body.data.tickets;
    assert.equal(queue[0].user.name, 'Synthetic Support Patient');
    assert.equal((await call(admin, 'POST', `/api/v1/support/${id}/reply`, { text: 'Payment found; your plan is active now.' })).body.data.ticket.status, 'answered');
    assert.equal((await call(patient, 'POST', `/api/v1/support/${id}/resolve`)).status, 403);
    assert.equal((await call(admin, 'POST', `/api/v1/support/${id}/resolve`)).body.data.ticket.status, 'resolved');
    const mine = (await call(patient, 'GET', '/api/v1/support')).body.data.tickets[0];
    assert.deepEqual(mine.messages.map(message => message.fromSupport), [false, true]);
    assert.ok(store.notifications(patient.id).some(note => /support/i.test(note.message)));
  } finally { server.close(); store.close(); }
});

test('dangerous vital signs are recognised and normal ones are not', () => {
  assert.deepEqual(vitalDangers({ temperatureC: 36.8, systolic: 132, diastolic: 84, pulse: 72, spo2: 98 }), []);
  assert.ok(vitalDangers({ temperatureC: 36.8, systolic: 185, diastolic: 121, pulse: 72 }).some(sign => /crisis/.test(sign)));
  assert.equal(vitalDangers({ temperatureC: 40, systolic: 85, diastolic: 50, pulse: 140, spo2: 88, respiratoryRate: 30 }).length, 5);
});
