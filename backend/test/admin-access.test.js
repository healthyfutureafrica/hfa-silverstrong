const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Store, hashPassword } = require('../store');
const { createApp } = require('../server');

const config = { origin: 'http://localhost:8080', ready: false, fileEncryptionKey: '9a'.repeat(32) };

// A tiny cookie-keeping client, like a browser.
function client(base) {
  const jar = new Map();
  const store = response => {
    for (const line of response.headers.getSetCookie?.() || []) {
      const [pair, ...attributes] = line.split(';');
      const [name, ...rest] = pair.split('=');
      const value = rest.join('=');
      const expired = attributes.some(attribute => /expires=thu, 01 jan 1970/i.test(attribute.trim())) || value === '';
      if (expired) jar.delete(name.trim()); else jar.set(name.trim(), value);
    }
  };
  return {
    jar,
    async call(path, body, method = body === undefined ? 'GET' : 'POST') {
      const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-HFA-Request': '1', Origin: config.origin, Cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; ') }, body: body === undefined ? undefined : JSON.stringify(body) });
      store(response);
      return response;
    }
  };
}

test('Super Admin can preview portals and sign in as staff or pharmacy accounts, never as patients, and everything is audited', async () => {
  const store = new Store();
  const admin = store.createUser({ name: 'Super Admin', email: 'chief@example.invalid', role: 'admin' }, await hashPassword('Synthetic-admin-pass'), 'active');
  const doctor = store.createUser({ name: 'Dr Synthetic', email: 'doc@example.invalid', role: 'doctor', profile: { hospital: 'Synthetic Hospital' } }, 'x', 'active');
  const pharmacy = store.createUser({ name: 'Synthetic Pharmacy', email: 'pharm@example.invalid', role: 'pharmacist', profile: { pharmacyLocation: 'Douala, Littoral' } }, 'x', 'active');
  const patient = store.createUser({ name: 'Synthetic Patient', email: 'pat@example.invalid', role: 'patient' }, await hashPassword('Synthetic-patient-pass'), 'active');
  const otherAdmin = store.createUser({ name: 'Other Admin', email: 'other-admin@example.invalid', role: 'admin' }, 'x', 'active');
  const pending = store.createUser({ name: 'Dr Pending', email: 'pending@example.invalid', role: 'doctor' }, 'x', 'pending_approval');
  const server = createApp(config, store, {}).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const browser = client(base);
    assert.equal((await browser.call('/api/auth/login', { email: 'chief@example.invalid', password: 'Synthetic-admin-pass' })).status, 200);

    // Portal preview is recorded.
    assert.equal((await browser.call('/api/v1/admin/portal-view', { role: 'doctor' })).status, 200);
    assert.equal((await browser.call('/api/v1/admin/portal-view', { role: 'hacker' })).status, 400);

    // Patients, administrators and inactive accounts cannot be entered.
    const refused = await browser.call(`/api/v1/admin/impersonate/${patient.id}`, {});
    assert.equal(refused.status, 403);
    assert.match((await refused.json()).error, /health records/);
    assert.equal((await browser.call(`/api/v1/admin/impersonate/${otherAdmin.id}`, {})).status, 403);
    assert.equal((await browser.call(`/api/v1/admin/impersonate/${pending.id}`, {})).status, 404);

    // Sign in as the doctor.
    const entered = await browser.call(`/api/v1/admin/impersonate/${doctor.id}`, {});
    assert.equal(entered.status, 200);
    const enteredBody = await entered.json();
    assert.equal(enteredBody.user.id, doctor.id);
    assert.equal(enteredBody.impersonatedBy.id, admin.id);
    const session = await (await browser.call('/api/session')).json();
    assert.equal(session.user.id, doctor.id);
    assert.equal(session.impersonatedBy.name, 'Super Admin');

    // While signed in as someone else: no admin powers and no chaining.
    assert.equal((await browser.call(`/api/v1/admin/impersonate/${pharmacy.id}`, {})).status, 403);
    assert.equal((await browser.call('/api/v1/admin/audit')).status, 403);

    // Return to the Super Admin account.
    const back = await browser.call('/api/v1/admin/impersonate/stop', {});
    assert.equal(back.status, 200);
    assert.equal((await back.json()).user.id, admin.id);
    const afterReturn = await (await browser.call('/api/session')).json();
    assert.equal(afterReturn.user.id, admin.id);
    assert.equal(afterReturn.impersonatedBy, undefined);
    assert.equal((await browser.call('/api/v1/admin/impersonate/stop', {})).status, 409);

    // Pharmacy accounts can be entered too; signing out ends both sessions.
    assert.equal((await browser.call(`/api/v1/admin/impersonate/${pharmacy.id}`, {})).status, 200);
    assert.equal((await browser.call('/api/auth/logout', {})).status, 204);
    assert.equal((await browser.call('/api/session')).status, 401);
    assert.equal(store.db.prepare('SELECT COUNT(*) AS total FROM sessions WHERE user_id IN (?,?)').get(admin.id, pharmacy.id).total, 0);

    // Non-admins cannot use any of this.
    const patientBrowser = client(base);
    await patientBrowser.call('/api/auth/login', { email: 'pat@example.invalid', password: 'Synthetic-patient-pass' });
    assert.equal((await patientBrowser.call(`/api/v1/admin/impersonate/${doctor.id}`, {})).status, 403);
    assert.equal((await patientBrowser.call('/api/v1/admin/portal-view', { role: 'doctor' })).status, 403);

    // The audit log has every step, readable by the administrator.
    const actions = store.auditLog().map(entry => `${entry.action}:${entry.targetName || entry.details.portal || ''}`).reverse();
    assert.deepEqual(actions, ['PORTAL_PREVIEW:doctor', 'SIGN_IN_AS_START:Dr Synthetic', 'SIGN_IN_AS_STOP:Dr Synthetic', 'SIGN_IN_AS_START:Synthetic Pharmacy']);
    const adminBrowser = client(base);
    await adminBrowser.call('/api/auth/login', { email: 'chief@example.invalid', password: 'Synthetic-admin-pass' });
    const audit = await (await adminBrowser.call('/api/v1/admin/audit')).json();
    assert.equal(audit.data.entries.length, 4);
    assert.equal(audit.data.entries[0].actorName, 'Super Admin');
  } finally { await new Promise(resolve => server.close(resolve)); store.close(); }
});

test('a sign-in-as session stops working if the administrator is suspended', async () => {
  const store = new Store();
  const admin = store.createUser({ name: 'Super Admin', email: 'chief2@example.invalid', role: 'admin' }, 'x', 'active');
  const doctor = store.createUser({ name: 'Dr Two', email: 'doc2@example.invalid', role: 'doctor' }, 'x', 'active');
  const token = store.createSession(doctor.id, { impersonatorId: admin.id });
  assert.equal(store.sessionDetails(token).impersonator.id, admin.id);
  store.updateUser(admin.id, { status: 'suspended' });
  assert.equal(store.sessionDetails(token), null);
  store.close();
});
