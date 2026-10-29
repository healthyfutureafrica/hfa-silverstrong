const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Store, digest } = require('../store');
const { createApp } = require('../server');

test('patient QR codes authorize one-time POS sales and both profiles retain the complete sale', async () => {
  const store = new Store(), config = { origin: 'http://localhost:8080', ready: false };
  const pharmacy = store.createUser({
    name: 'Synthetic Pharmacy', email: 'pos-pharmacy@example.invalid', role: 'pharmacist',
    profile: { pharmacyValidatedAt: 'test', pharmacyName: 'Test Pharmacy', pharmacyAddress: '1 Test Street' }
  }, 'unused', 'active');
  const patient = store.createUser({
    name: 'Synthetic Patient', email: 'pos-patient@example.invalid', role: 'patient'
  }, 'unused', 'active');
  const server = createApp(config, store, {}).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const pharmacyCookie = `hfa_session=${store.createSession(pharmacy.id)}`;
  const patientCookie = `hfa_session=${store.createSession(patient.id)}`;
  const request = (path, body, cookie, method = 'POST') => fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json', 'X-HFA-Request': '1', Origin: config.origin,
      Cookie: cookie
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  try {
    const firstCode = await request('/api/pharmacy/patient-code', {}, patientCookie);
    assert.equal(firstCode.status, 201);
    const firstQr = await firstCode.json();
    assert.match(firstQr.qr, /^data:image\/png;base64,/);
    assert.ok(Date.parse(firstQr.expiresAt) > Date.now());
    assert.equal((await request('/api/pharmacy/patient-code', {}, pharmacyCookie)).status, 403);

    const item = {
      name: 'Synthetic medicine', strength: '10 mg', unit: 'Box', batch: 'POS-01',
      expiresOn: '2099-12-31', stock: 8, price: 4.25, requiresPrescription: false
    };
    const created = await request('/api/pharmacy/items', item, pharmacyCookie);
    assert.equal(created.status, 201);
    const { id: itemId } = await created.json();

    const patientCode = `HFA-PATIENT:${randomUUID()}`;
    store.db.prepare('INSERT INTO pharmacy_patient_codes (token_digest,patient_id,expires_at) VALUES (?,?,?)')
      .run(digest(patientCode), patient.id, new Date(Date.now() + 5 * 60 * 1000).toISOString());
    const sale = {
      requestId: randomUUID(), patientCode, items: [{ itemId, quantity: 2 }],
      prescriptionReviewed: false
    };
    assert.equal((await request('/api/pharmacy/pos', sale, patientCookie)).status, 403);
    const recorded = await request('/api/pharmacy/pos', sale, pharmacyCookie);
    assert.equal(recorded.status, 201);
    const result = await recorded.json();
    assert.equal(result.status, 'recorded');
    assert.equal(store.db.prepare('SELECT stock FROM pharmacy_items WHERE id=?').get(itemId).stock, 6);
    assert.equal(store.db.prepare("SELECT COUNT(*) AS total FROM audit_log WHERE action='PHARMACY_POS_SALE'").get().total, 1);

    store.db.prepare('DELETE FROM pharmacy_patient_codes WHERE token_digest=?').run(digest(patientCode));
    const replay = await request('/api/pharmacy/pos', sale, pharmacyCookie);
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).id, result.id);
    assert.equal(store.db.prepare('SELECT stock FROM pharmacy_items WHERE id=?').get(itemId).stock, 6);
    assert.equal(store.db.prepare("SELECT COUNT(*) AS total FROM audit_log WHERE action='PHARMACY_POS_SALE'").get().total, 1);
    assert.equal((await request('/api/pharmacy/pos', { ...sale, items: [{ itemId, quantity: 1 }] }, pharmacyCookie)).status, 409);

    const patientView = await (await request('/api/pharmacy', undefined, patientCookie, 'GET')).json();
    const pharmacyView = await (await request('/api/pharmacy', undefined, pharmacyCookie, 'GET')).json();
    assert.equal(patientView.sales.length, 1);
    assert.equal(pharmacyView.sales.length, 1);
    assert.equal(patientView.sales[0].pharmacyName, 'Test Pharmacy');
    assert.equal(pharmacyView.sales[0].patientName, 'Synthetic Patient');
    assert.deepEqual(patientView.sales[0].items[0], {
      itemId, name: item.name, strength: item.strength, unit: item.unit, batch: item.batch,
      expiresOn: item.expiresOn, quantity: 2, unitPrice: 4.25, lineTotal: 8.5,
      requiresPrescription: false, prescriptionReviewed: false
    });
    assert.equal(patientView.sales[0].total, 8.5);
  } finally {
    await new Promise(resolve => server.close(resolve));
    store.close();
  }
});

test('POS rejects expired, reused and cross-pharmacy patient/product codes without changing stock', async () => {
  const store = new Store(), config = { origin: 'http://localhost:8080', ready: false };
  const pharmacy = store.createUser({
    name: 'Synthetic Pharmacy', email: 'pos-owner@example.invalid', role: 'pharmacist',
    profile: { pharmacyValidatedAt: 'test', pharmacyName: 'Owner Pharmacy' }
  }, 'unused', 'active');
  const otherPharmacy = store.createUser({
    name: 'Other Pharmacy', email: 'pos-other@example.invalid', role: 'pharmacist',
    profile: { pharmacyValidatedAt: 'test', pharmacyName: 'Other Pharmacy' }
  }, 'unused', 'active');
  const patient = store.createUser({ name: 'Synthetic Patient', email: 'pos-other-patient@example.invalid', role: 'patient' }, 'unused', 'active');
  const server = createApp(config, store, {}).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const cookie = `hfa_session=${store.createSession(pharmacy.id)}`;
  const otherCookie = `hfa_session=${store.createSession(otherPharmacy.id)}`;
  const patientCookie = `hfa_session=${store.createSession(patient.id)}`;
  const request = (path, body, session, method = 'POST') => fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-HFA-Request': '1', Origin: config.origin, Cookie: session },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  try {
    const item = { name: 'Synthetic stock', strength: '5 mg', unit: 'Box', batch: 'POS-02', expiresOn: '2099-12-31', stock: 3, price: 1, requiresPrescription: false };
    const created = await request('/api/pharmacy/items', item, otherCookie);
    const { id: itemId } = await created.json();
    const token = `HFA-PATIENT:${randomUUID()}`;
    store.db.prepare('INSERT INTO pharmacy_patient_codes (token_digest,patient_id,expires_at) VALUES (?,?,?)')
      .run(digest(token), patient.id, new Date(Date.now() - 1000).toISOString());
    const sale = { requestId: randomUUID(), patientCode: token, items: [{ itemId, quantity: 1 }], prescriptionReviewed: false };
    assert.equal((await request('/api/pharmacy/pos', sale, cookie)).status, 409);

    store.db.prepare('UPDATE pharmacy_patient_codes SET expires_at=? WHERE token_digest=?')
      .run(new Date(Date.now() + 5 * 60 * 1000).toISOString(), digest(token));
    assert.equal((await request('/api/pharmacy/pos', sale, cookie)).status, 409);
    assert.equal(store.db.prepare('SELECT stock FROM pharmacy_items WHERE id=?').get(itemId).stock, 3);

    const ownerToken = `HFA-PATIENT:${randomUUID()}`;
    store.db.prepare('INSERT INTO pharmacy_patient_codes (token_digest,patient_id,expires_at) VALUES (?,?,?)')
      .run(digest(ownerToken), patient.id, new Date(Date.now() + 5 * 60 * 1000).toISOString());
    assert.equal((await request('/api/pharmacy/pos', { ...sale, patientCode: ownerToken, requestId: randomUUID() }, cookie)).status, 409);
    assert.equal(store.db.prepare('SELECT stock FROM pharmacy_items WHERE id=?').get(itemId).stock, 3);
    assert.equal((await request('/api/pharmacy', undefined, patientCookie, 'GET')).status, 200);
  } finally {
    await new Promise(resolve => server.close(resolve));
    store.close();
  }
});

test('POS requires pharmacist review for prescription products and consumes QR only for a successful sale', async () => {
  const store = new Store(), config = { origin: 'http://localhost:8080', ready: false };
  const pharmacy = store.createUser({
    name: 'Synthetic Pharmacy', email: 'pos-rx@example.invalid', role: 'pharmacist',
    profile: { pharmacyValidatedAt: 'test', pharmacyName: 'Rx Pharmacy' }
  }, 'unused', 'active');
  const patient = store.createUser({ name: 'Synthetic Patient', email: 'pos-rx-patient@example.invalid', role: 'patient' }, 'unused', 'active');
  const server = createApp(config, store, {}).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const pharmacyCookie = `hfa_session=${store.createSession(pharmacy.id)}`;
  const patientCookie = `hfa_session=${store.createSession(patient.id)}`;
  const request = (path, body, cookie, method = 'POST') => fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-HFA-Request': '1', Origin: config.origin, Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  try {
    const item = { name: 'Prescription medicine', strength: '10 mg', unit: 'Box', batch: 'RX-01', expiresOn: '2099-12-31', stock: 2, price: 3, requiresPrescription: true };
    const created = await request('/api/pharmacy/items', item, pharmacyCookie);
    const { id: itemId } = await created.json();
    const patientCode = `HFA-PATIENT:${randomUUID()}`;
    store.db.prepare('INSERT INTO pharmacy_patient_codes (token_digest,patient_id,expires_at) VALUES (?,?,?)')
      .run(digest(patientCode), patient.id, new Date(Date.now() + 5 * 60 * 1000).toISOString());
    const sale = { requestId: randomUUID(), patientCode, items: [{ itemId, quantity: 1 }], prescriptionReviewed: false };
    const rejected = await request('/api/pharmacy/pos', sale, pharmacyCookie);
    assert.equal(rejected.status, 409);
    assert.match((await rejected.json()).error, /original prescription/);
    assert.equal(store.db.prepare('SELECT used_at FROM pharmacy_patient_codes WHERE token_digest=?').get(digest(patientCode)).used_at, null);
    assert.equal(store.db.prepare('SELECT stock FROM pharmacy_items WHERE id=?').get(itemId).stock, 2);

    const completed = await request('/api/pharmacy/pos', { ...sale, prescriptionReviewed: true }, pharmacyCookie);
    assert.equal(completed.status, 201);
    assert.equal(store.db.prepare('SELECT used_at FROM pharmacy_patient_codes WHERE token_digest=?').get(digest(patientCode)).used_at !== null, true);
    assert.equal(store.db.prepare('SELECT stock FROM pharmacy_items WHERE id=?').get(itemId).stock, 1);
  } finally {
    await new Promise(resolve => server.close(resolve));
    store.close();
  }
});
