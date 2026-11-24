const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Store } = require('../store');
const { createApp } = require('../server');

const config = { origin: 'http://localhost:8080', ready: false, fileEncryptionKey: '9c'.repeat(32) };

async function harness() {
  const store = new Store();
  const patient = store.createUser({ name: 'Synthetic Offline Patient', email: 'offline-patient@example.invalid', role: 'patient' }, 'test-password-hash', 'active');
  const admin = store.createUser({ name: 'Synthetic Offline Admin', email: 'offline-admin@example.invalid', role: 'admin' }, 'test-password-hash', 'active');
  const renewalDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  store.db.prepare("UPDATE users SET profile=json_set(profile,'$.subscription',json(?)) WHERE id=?").run(JSON.stringify({ status: 'active', tier: 'essential', renewalDate }), patient.id);
  const server = createApp(config, store, {}).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, session, method = 'GET') => fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', 'X-HFA-Request': '1', Origin: config.origin, Cookie: `hfa_session=${session}` },
    body: method === 'GET' ? undefined : '{}'
  });
  return { store, server, patient, admin, call };
}

test('the offline-copy secret is stable for its owner and rotated when offline access is revoked', async () => {
  const { store, server, patient, admin, call } = await harness();
  try {
    const session = store.createSession(patient.id);
    const first = await call('/api/v1/me/offline-key', session);
    assert.equal(first.status, 200);
    const key = (await first.json()).data.key;
    assert.equal(Buffer.from(key, 'base64').length, 32);
    assert.equal((await (await call('/api/v1/me/offline-key', session)).json()).data.key, key);

    const adminSession = store.createSession(admin.id);
    assert.equal((await call('/api/v1/me/offline-key', adminSession)).status, 403, 'administrator data is never cached offline');
    assert.equal((await call(`/api/v1/admin/users/${patient.id}/revoke-offline`, session, 'POST')).status, 403);
    assert.equal((await call(`/api/v1/admin/users/${patient.id}/revoke-offline`, adminSession, 'POST')).status, 200);
    const rotated = (await (await call('/api/v1/me/offline-key', session)).json()).data.key;
    assert.notEqual(rotated, key);
    assert.ok(store.auditLog().some(entry => entry.action === 'OFFLINE_ACCESS_REVOKED' && (entry.targetId ?? entry.target_id) === patient.id));
  } finally { server.close(); store.close(); }
});

test('an administrator signed in as someone cannot read their offline-copy secret', async () => {
  const { store, server, patient, admin, call } = await harness();
  try {
    const impersonated = store.createSession(patient.id, { impersonatorId: admin.id });
    assert.equal((await call('/api/v1/me/offline-key', impersonated)).status, 403);
  } finally { server.close(); store.close(); }
});
