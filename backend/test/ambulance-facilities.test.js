const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Store } = require('../store');
const { createApp } = require('../server');

const config = { origin: 'http://localhost:8080', ready: false, fileEncryptionKey: '9c'.repeat(32) };

test('only current administrator-verified hospital ambulance contacts appear in the public directory', async () => {
  const store = new Store();
  const hospitalClinician = store.createUser({
    name: 'Synthetic Hospital Doctor', email: 'ambulance-doctor@example.invalid', role: 'doctor',
    profile: { hospital: 'Synthetic Ambulance Hospital' }
  }, 'test-password-hash', 'active');
  const admin = store.createUser({
    name: 'Synthetic Directory Admin', email: 'ambulance-admin@example.invalid', role: 'admin'
  }, 'test-password-hash', 'active');
  const server = createApp(config, store, {}).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, body, session, method = body === undefined ? 'GET' : 'PUT') => fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json', 'X-HFA-Request': '1', Origin: config.origin,
      ...(session ? { Cookie: `hfa_session=${session}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const adminSession = store.createSession(admin.id), clinicianSession = store.createSession(hospitalClinician.id);
  const facilityId = hospitalClinician.facilityId;
  const expiresOn = new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);
  const profile = {
    countryCode: 'CM', phone: '+237 676 698 072', sms: '+237 677 000 111',
    latitude: 4.0511, longitude: 9.7679, coverage: 'Synthetic service zone',
    status: 'approved', source: 'Confirmed with hospital dispatcher',
    sourceReference: 'AMB-CONTACT-2026-01', expiresOn
  };
  try {
    const initial = await (await request('/api/v1/facilities/ambulance?countryCode=CM')).json();
    assert.deepEqual(initial.data.providers, []);
    assert.equal((await request(`/api/v1/admin/facilities/${facilityId}/ambulance`, profile, clinicianSession)).status, 403);
    assert.equal((await request(`/api/v1/admin/facilities/${facilityId}/ambulance`, { ...profile, phone: '1515' }, adminSession)).status, 400);
    assert.equal((await request(`/api/v1/admin/facilities/${facilityId}/ambulance`, { ...profile, expiresOn: '2027-02-30' }, adminSession)).status, 400);

    assert.equal((await request(`/api/v1/admin/facilities/${facilityId}/ambulance`, profile, adminSession)).status, 200);
    const directoryResponse = await request('/api/v1/facilities/ambulance?countryCode=CM');
    assert.equal(directoryResponse.headers.get('cache-control'), 'public, max-age=60');
    const { providers } = (await directoryResponse.json()).data;
    assert.equal(providers.length, 1);
    assert.deepEqual(providers[0], {
      id: facilityId, name: 'Synthetic Ambulance Hospital', countryCode: 'CM', phone: '+237676698072',
      sms: '+237677000111', latitude: 4.0511, longitude: 9.7679, coverage: 'Synthetic service zone',
      expiresOn, reviewedAt: providers[0].reviewedAt
    });
    assert.equal(JSON.stringify(providers).includes('AMB-CONTACT-2026-01'), false, 'verification evidence is not public');
    assert.deepEqual((await (await request('/api/v1/facilities/ambulance?countryCode=NG')).json()).data.providers, []);
    assert.equal(store.db.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action='AMBULANCE_PROFILE_UPDATED'").get().count, 1);

    store.db.prepare('UPDATE facilities SET ambulance_expires_on=? WHERE id=?')
      .run(new Date(Date.now() - 86400000).toISOString().slice(0, 10), facilityId);
    assert.deepEqual((await (await request('/api/v1/facilities/ambulance?countryCode=CM')).json()).data.providers, []);
  } finally {
    await new Promise(resolve => server.close(resolve));
    store.close();
  }
});
