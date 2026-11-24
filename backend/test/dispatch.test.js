const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Store } = require('../store');
const { createApp } = require('../server');

const config = { origin: 'http://localhost:8080', ready: false, fileEncryptionKey: '9c'.repeat(32) };
const LIMBE = { lat: 4.0225, lng: 9.1958 };

async function harness() {
  const store = new Store();
  const make = (name, email, role) => store.createUser({ name, email, role }, 'test-password-hash', 'active');
  const patient = make('Synthetic SOS Patient', 'sos-patient@example.invalid', 'patient');
  const admin = make('Synthetic Dispatch Admin', 'sos-admin@example.invalid', 'admin');
  const near = make('Synthetic Crew Near', 'crew-near@example.invalid', 'ambulance');
  const far = make('Synthetic Crew Far', 'crew-far@example.invalid', 'ambulance');
  const renewalDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  store.db.prepare("UPDATE users SET phone='+237670000001', profile=json_set(profile,'$.subscription',json(?)) WHERE id=?").run(JSON.stringify({ status: 'active', tier: 'essential', renewalDate }), patient.id);
  const server = createApp(config, store, {}).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const sessions = Object.fromEntries([['patient', patient], ['admin', admin], ['near', near], ['far', far]].map(([key, user]) => [key, store.createSession(user.id)]));
  const call = async (who, path, body, method) => {
    const response = await fetch(base + path, { method: method || (body === undefined ? 'GET' : 'POST'),
      headers: { 'Content-Type': 'application/json', 'X-HFA-Request': '1', Origin: config.origin, ...(who ? { Cookie: `hfa_session=${sessions[who]}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  };
  return { store, server, call, patient, near, far };
}

async function fleet(call, store, near, far) {
  const unitA = (await call('admin', '/api/v1/admin/ambulance/units', { callSign: 'AMB-LMB-01', kind: 'BLS', operator: 'Synthetic Limbe operator', countryCode: 'CM', crewPhone: '+237690100201', lat: 4.0186, lng: 9.2043 })).body.data.unit;
  const unitB = (await call('admin', '/api/v1/admin/ambulance/units', { callSign: 'AMB-BUE-01', kind: 'ALS', operator: 'Synthetic Buea operator', countryCode: 'CM', crewPhone: '+237690100301', lat: 4.1527, lng: 9.2410 })).body.data.unit;
  assert.equal(unitA.status, 'off_duty');
  assert.equal((await call('admin', `/api/v1/admin/ambulance/units/${unitA.id}/crew`, { userId: near.id })).status, 200);
  assert.equal((await call('admin', `/api/v1/admin/ambulance/units/${unitB.id}/crew`, { userId: far.id })).status, 200);
  assert.equal((await call('near', '/api/v1/crew/position', { lat: 4.0186, lng: 9.2043, duty: 'available' })).body.data.status, 'available');
  assert.equal((await call('far', '/api/v1/crew/position', { lat: 4.1527, lng: 9.2410, duty: 'available' })).body.data.status, 'available');
  return { unitA, unitB };
}

test('SOS goes to the nearest on-duty crew, moves on when declined, and tracks the accepted ambulance', async () => {
  const { store, server, call, patient, near, far } = await harness();
  try {
    await fleet(call, store, near, far);
    assert.match(store.user(near.id).hfaId, /^HFA-AM-\d{4}-\d$/, 'crews get their own HFA number');
    const sent = await call('patient', '/api/v1/sos', { ...LIMBE, accuracy: 25 });
    assert.equal(sent.status, 201);
    assert.equal(sent.body.data.request.status, 'offered');
    assert.equal(sent.body.data.request.unit.callSign, 'AMB-LMB-01');
    assert.equal(sent.body.data.request.unit.crewPhone, null, 'no crew phone until a crew accepts');
    assert.equal(sent.body.data.request.eta, null, 'no ETA until a crew accepts');
    const id = sent.body.data.request.id;
    assert.equal((await call('patient', '/api/v1/sos', LIMBE)).body.data.request.id, id, 'one open request per patient');

    assert.equal((await call('far', '/api/v1/crew/job')).body.data.job, null);
    const offer = (await call('near', '/api/v1/crew/job')).body.data.job;
    assert.equal(offer.status, 'offered');
    assert.equal(offer.patient, null, 'patient details stay hidden until the job is accepted');
    assert.deepEqual(offer.actions, ['accept', 'decline']);

    assert.equal((await call('near', `/api/v1/crew/job/${id}`, { action: 'decline' })).status, 200);
    assert.equal((await call('patient', '/api/v1/sos/mine')).body.data.request.unit.callSign, 'AMB-BUE-01');
    assert.equal((await call('near', `/api/v1/crew/job/${id}`, { action: 'accept' })).status, 404, 'a crew cannot take a job offered to another unit');

    assert.equal((await call('far', `/api/v1/crew/job/${id}`, { action: 'accept' })).body.data.status, 'accepted');
    const tracked = (await call('patient', '/api/v1/sos/mine')).body.data.request;
    assert.equal(tracked.status, 'accepted');
    assert.equal(tracked.unit.crewPhone, '+237690100301');
    assert.ok(tracked.eta.minutes > 0 && tracked.eta.km > 0);

    const job = (await call('far', '/api/v1/crew/job')).body.data.job;
    assert.equal(job.patient.name, 'Synthetic SOS Patient');
    assert.equal(job.patient.phone, '+237670000001');
    const accessLog = (await call('patient', '/api/v1/me/access-log')).body.data.entries;
    assert.ok(accessLog.some(entry => entry.action === 'SOS_SUMMARY_VIEWED'), 'the crew opening the summary is visible to the patient');

    assert.equal((await call('far', `/api/v1/crew/job/${id}`, { action: 'on_scene' })).status, 409, 'steps happen in order');
    for (const action of ['en_route', 'on_scene', 'transporting']) assert.equal((await call('far', `/api/v1/crew/job/${id}`, { action, destination: action === 'transporting' ? 'Synthetic Regional Hospital' : undefined })).status, 200);
    assert.equal((await call('far', `/api/v1/crew/job/${id}`, { action: 'handover' })).body.data.status, 'completed');
    const units = (await call('admin', '/api/v1/admin/ambulance/units')).body.data.units;
    assert.equal(units.find(unit => unit.callSign === 'AMB-BUE-01').status, 'available');
    const console = (await call('admin', '/api/v1/admin/sos')).body.data.requests;
    assert.equal(console[0].status, 'completed');
    assert.equal(console[0].destination, 'Synthetic Regional Hospital');
  } finally { server.close(); store.close(); }
});

test('with no fresh, on-duty ambulance the patient is told at once and admins can assign manually', async () => {
  const { store, server, call, near, far } = await harness();
  try {
    const { unitA } = await fleet(call, store, near, far);
    store.db.prepare('UPDATE ambulance_units SET position_at=?').run(Date.now() - 31 * 60000);  // positions too old to trust
    const sent = (await call('patient', '/api/v1/sos', LIMBE)).body.data.request;
    assert.equal(sent.status, 'no_unit');
    assert.equal(sent.unit, null);
    assert.equal((await call('patient', '/api/v1/sos/mine')).body.data.request.status, 'no_unit');
    const assigned = await call('admin', `/api/v1/admin/sos/${sent.id}/assign`, { unitId: unitA.id });
    assert.equal(assigned.body.data.request.status, 'offered');
    assert.equal((await call('near', '/api/v1/crew/job')).body.data.job.id, sent.id);
  } finally { server.close(); store.close(); }
});

test('an unanswered offer moves to the next nearest ambulance after the timeout', async () => {
  const { store, server, call, near, far } = await harness();
  try {
    await fleet(call, store, near, far);
    const sent = (await call('patient', '/api/v1/sos', LIMBE)).body.data.request;
    assert.equal(sent.unit.callSign, 'AMB-LMB-01');
    store.db.prepare('UPDATE sos_requests SET offered_at=? WHERE id=?').run(Date.now() - 61000, sent.id);
    await new Promise(resolve => setTimeout(resolve, 5600));                                    // watchdog runs every 5 s
    const now = (await call('patient', '/api/v1/sos/mine')).body.data.request;
    assert.equal(now.unit.callSign, 'AMB-BUE-01');
    assert.ok(now.timeline.some(step => /did not answer/.test(step.note)));
  } finally { server.close(); store.close(); }
});

test('a patient without a paid plan can still send an SOS', async () => {
  const { store, server, call, patient, near, far } = await harness();
  try {
    await fleet(call, store, near, far);
    store.db.prepare("UPDATE users SET profile=json_remove(profile,'$.subscription') WHERE id=?").run(patient.id);
    assert.equal((await call('patient', '/api/v1/sos/mine')).status, 200);
    assert.equal((await call('patient', '/api/v1/clinical')).status, 403, 'the rest of the portal still needs a plan');
    assert.equal((await call('patient', '/api/v1/sos', LIMBE)).body.data.request.status, 'offered');
  } finally { server.close(); store.close(); }
});

test('only patients send SOS, only crews act on jobs, and crews cannot self-register', async () => {
  const { store, server, call } = await harness();
  try {
    assert.equal((await call('near', '/api/v1/sos', LIMBE)).status, 403);
    assert.equal((await call('patient', '/api/v1/crew/job')).status, 403);
    assert.equal((await call('patient', '/api/v1/admin/sos')).status, 403);
    const register = await call(null, '/api/auth/register', { name: 'Synthetic Walk-in Crew', email: 'walkin-crew@example.invalid', password: 'Synthetic-password-12345', role: 'ambulance', phone: '+237690000999' });
    assert.equal(register.status, 403);
    assert.match(register.body.error, /Administrator provisions ambulance crews/);
  } finally { server.close(); store.close(); }
});
