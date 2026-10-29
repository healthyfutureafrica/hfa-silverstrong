const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Store, hashPassword } = require('../store');
const { createApp } = require('../server');
const { iceServers } = require('../calls');
const { submitCase } = require('../triage');
const { randomUUID } = require('node:crypto');

const config = { origin: 'http://localhost:8080', ready: false, fileEncryptionKey: '2d'.repeat(32) };

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
// Appointment times are Cameroon wall-clock time (UTC+1).
const cameroon = offsetMinutes => new Date(Date.now() + 60 * 60000 + offsetMinutes * 60000).toISOString();

test('only the two people of a booked voice or video appointment can connect, and only during its time', async () => {
  const store = new Store();
  const app = await startServer(store);
  try {
    const make = async (role, email) => store.createUser({ name: `Synthetic ${role}`, email, role, profile: { hospital: 'Synthetic Call Hospital' } }, await hashPassword('Synthetic-pass-123'), 'active');
    const doctor = await make('doctor', 'call-doc@example.invalid'), patient = await make('patient', 'call-pat@example.invalid'), other = await make('patient', 'call-other@example.invalid');
    store.updateUser(patient.id, { assignedDoctor: doctor.id });
    const triageCase = await submitCase(config, store, patient, {
      requestId: randomUUID(), answers: { ageGroup: 'adult', complaints: ['other'], dangerSigns: [], duration: 'days_1_2', severity: 'mild' },
      text: 'I have a mild concern and would like advice.', aiConsent: false
    });
    const login = async email => cookieOf(await app.request('/api/auth/login', { email, password: 'Synthetic-pass-123' }));
    const [doctorCookie, patientCookie, otherCookie] = await Promise.all(['call-doc@example.invalid', 'call-pat@example.invalid', 'call-other@example.invalid'].map(login));
    const book = async (id, minutesFromNow, mode = 'video') => {
      const when = cameroon(minutesFromNow);
      return app.request(`/api/v1/clinical/appointments/${id}`, { data: { patientId: patient.id, doctorId: doctor.id, nurseId: '', date: when.slice(0, 10), time: when.slice(11, 16), durationMinutes: 30, mode, status: 'scheduled', triageCaseId: triageCase.row.id }, baseVersion: 0 }, patientCookie, 'PUT');
    };
    assert.equal((await book('apt-now', -5)).status, 201);
    assert.equal((await book('apt-later', 180)).status, 201);
    assert.equal((await book('apt-text', -5, 'text')).status, 201);

    const signal = (cookie, id, body) => app.request(`/api/v1/calls/${id}/signals`, body, cookie);
    const inbox = async (cookie, id, after = 0) => (await (await app.request(`/api/v1/calls/${id}/signals?after=${after}`, undefined, cookie)).json()).data.signals;
    // The doctor offers, the patient answers.
    assert.equal((await signal(doctorCookie, 'apt-now', { to: patient.id, type: 'hello' })).status, 201);
    assert.equal((await signal(doctorCookie, 'apt-now', { to: patient.id, type: 'offer', data: { type: 'offer', sdp: 'v=0 synthetic' } })).status, 201);
    const received = await inbox(patientCookie, 'apt-now');
    assert.deepEqual(received.map(item => item.type), ['hello', 'offer']);
    assert.equal(received[1].data.sdp, 'v=0 synthetic');
    assert.equal((await signal(patientCookie, 'apt-now', { to: doctor.id, type: 'answer', data: { type: 'answer', sdp: 'v=0 answer' } })).status, 201);
    assert.deepEqual((await inbox(doctorCookie, 'apt-now')).map(item => item.type), ['answer']);
    assert.equal((await inbox(patientCookie, 'apt-now', received[1].seq)).length, 0, 'only new signals');

    // Nobody else can join or listen, and signals go only to the other participant.
    assert.equal((await signal(otherCookie, 'apt-now', { to: doctor.id, type: 'hello' })).status, 403);
    assert.equal((await app.request('/api/v1/calls/apt-now/signals', undefined, otherCookie)).status, 403);
    assert.equal((await signal(patientCookie, 'apt-now', { to: other.id, type: 'hello' })).status, 403);
    // Not before the booked time, and never for a text consultation.
    assert.equal((await signal(patientCookie, 'apt-later', { to: doctor.id, type: 'hello' })).status, 403);
    assert.equal((await signal(patientCookie, 'apt-text', { to: doctor.id, type: 'hello' })).status, 403);
    // Joining is in the patient's access log.
    assert.ok(store.db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action='CALL_JOINED' AND actor_id=?").get(doctor.id).n === 1);
    const ice = (await (await app.request('/api/v1/calls/ice', undefined, patientCookie)).json()).data.iceServers;
    assert.match(ice[0].urls[0], /^stun:/);
  } finally { await app.close(); store.close(); }
});

test('a TURN relay is offered only when configured', () => {
  assert.equal(iceServers({}).length, 1);
  const servers = iceServers({ TURN_URLS: 'turn:turn.example.invalid:3478', TURN_USERNAME: 'hfa', TURN_CREDENTIAL: 'secret' });
  assert.deepEqual(servers[1], { urls: ['turn:turn.example.invalid:3478'], username: 'hfa', credential: 'secret' });
});
