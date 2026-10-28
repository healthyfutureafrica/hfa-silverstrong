const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Store, hashPassword } = require('../store');
const { createApp } = require('../server');
const COUNTRY_DATA = require('../../country-data');

const config = { origin: 'http://localhost:8080', ready: false, fileEncryptionKey: '9c'.repeat(32), requireAdminMfa: false };

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

test('country readiness stays pending until every current review has an owner and source', async () => {
  const store = new Store();
  const app = await startServer(store);
  try {
    store.createUser({ name: 'Synthetic Country Admin', email: 'country-admin@example.invalid', role: 'admin' }, await hashPassword('Synthetic-pass-123'), 'active');
    store.createUser({ name: 'Synthetic Country Clinician', email: 'country-doctor@example.invalid', role: 'doctor' }, await hashPassword('Synthetic-pass-123'), 'active');
    const adminCookie = cookieOf(await app.request('/api/auth/login', { email: 'country-admin@example.invalid', password: 'Synthetic-pass-123' }));
    const clinicianCookie = cookieOf(await app.request('/api/auth/login', { email: 'country-doctor@example.invalid', password: 'Synthetic-pass-123' }));

    assert.equal((await app.request('/api/v1/admin/country-reviews', undefined, clinicianCookie)).status, 403);
    const initial = await (await app.request('/api/v1/admin/country-reviews', undefined, adminCookie)).json();
    assert.equal(initial.data.countries.length, 54);
    assert.equal(initial.data.countries.every(country => !country.launchReady), true);
    const cameroon = initial.data.countries.find(country => country.countryCode === 'CM');
    assert.equal(cameroon.reviews.length, 6);
    assert.equal(cameroon.reviews.every(review => review.status === 'pending'), true);

    const expiresOn = new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);
    const payload = capability => ({
      status: 'approved', reviewOwner: 'Synthetic qualified review team',
      source: `Synthetic authority source for ${capability}`, sourceReference: `TEST-REF-${capability}`,
      expiresOn, scope: 'internal', note: ''
    });
    const badSource = { ...payload('privacy'), source: '' };
    assert.equal((await app.request('/api/v1/admin/country-reviews/CM/privacy', badSource, adminCookie, 'PUT')).status, 400);
    const invalidDate = { ...payload('privacy'), expiresOn: '2027-02-30' };
    assert.equal((await app.request('/api/v1/admin/country-reviews/CM/privacy', invalidDate, adminCookie, 'PUT')).status, 400);
    assert.equal((await app.request('/api/v1/admin/country-reviews/ZZ/privacy', payload('privacy'), adminCookie, 'PUT')).status, 404);

    for (const capability of initial.data.capabilities.filter(value => value !== 'privacy'))
      assert.equal((await app.request(`/api/v1/admin/country-reviews/CM/${capability}`, payload(capability), adminCookie, 'PUT')).status, 200);
    const rejected = { ...payload('privacy'), status: 'rejected', expiresOn: '', note: 'Authority review not complete' };
    assert.equal((await app.request('/api/v1/admin/country-reviews/CM/privacy', rejected, adminCookie, 'PUT')).status, 200);
    let updated = await (await app.request('/api/v1/admin/country-reviews', undefined, adminCookie)).json();
    assert.equal(updated.data.countries.find(country => country.countryCode === 'CM').launchReady, false);

    const approved = await (await app.request('/api/v1/admin/country-reviews/CM/privacy', payload('privacy'), adminCookie, 'PUT')).json();
    assert.equal(approved.data.country.launchReady, true);
    assert.equal(approved.data.country.reviews.every(review => review.status === 'approved' && review.expiresOn === expiresOn), true);
    const history = await (await app.request('/api/v1/admin/country-reviews/CM/history', undefined, adminCookie)).json();
    assert.equal(history.data.events.length, 7);
    assert.equal(history.data.events[0].actor, 'Synthetic Country Admin');
    assert.equal(history.data.events[0].after.source, 'Synthetic authority source for privacy');
    assert.ok(store.db.prepare("SELECT COUNT(*) AS count FROM audit_log WHERE action LIKE 'COUNTRY_REVIEW_%'").get().count >= 9);
    assert.equal((await app.request('/api/v1/admin/country-reviews/CM/history', undefined, clinicianCookie)).status, 403);
  } finally { await app.close(); store.close(); }
});

test('country readiness expires automatically and never treats other countries as reviewed', async () => {
  const store = new Store();
  const app = await startServer(store);
  try {
    store.createUser({ name: 'Synthetic Expiry Admin', email: 'expiry-admin@example.invalid', role: 'admin' }, await hashPassword('Synthetic-pass-123'), 'active');
    const adminCookie = cookieOf(await app.request('/api/auth/login', { email: 'expiry-admin@example.invalid', password: 'Synthetic-pass-123' }));
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    store.db.prepare(`INSERT INTO country_capability_reviews
      (country_code,capability,status,review_owner,source,source_reference,expires_on,scope,note,reviewed_by,reviewed_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run('NG', 'clinical', 'approved', 'Synthetic team', 'Synthetic source', '', yesterday, 'internal', '', 'admin', new Date().toISOString(), new Date().toISOString());
    const result = await (await app.request('/api/v1/admin/country-reviews', undefined, adminCookie)).json();
    const nigeria = result.data.countries.find(country => country.countryCode === 'NG');
    assert.equal(nigeria.launchReady, false);
    assert.equal(nigeria.reviews.find(review => review.capability === 'clinical').status, 'expired');
    assert.equal(COUNTRY_DATA.all().length, 54);
  } finally { await app.close(); store.close(); }
});
