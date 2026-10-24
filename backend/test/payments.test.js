const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Store, hashPassword } = require('../store');
const { createApp } = require('../server');
const { normaliseMsisdn } = require('../payments');

const base = { origin: 'http://localhost:8080', ready: false, fileEncryptionKey: '4f'.repeat(32) };
const secret = 'c'.repeat(40);

async function startServer(store, config) {
  const app = createApp(config, store, {});
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const request = (path, body, cookie, method = body === undefined ? 'GET' : 'POST', headers = { 'X-HFA-Request': '1', Origin: config.origin }) => fetch(url + path, {
    method, headers: { 'Content-Type': 'application/json', ...headers, ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { app, request, close: () => new Promise(resolve => server.close(resolve)) };
}
const cookieOf = response => response.headers.get('set-cookie').split(';')[0];

test('MTN numbers are checked before any request is sent', () => {
  assert.equal(normaliseMsisdn('6 77 12 34 56', { sandbox: false }), '237677123456');
  assert.equal(normaliseMsisdn('+237 650 12 34 56', { sandbox: false }), '237650123456');
  assert.equal(normaliseMsisdn('699123456', { sandbox: false }), null, 'Orange numbers are not MTN');
  assert.equal(normaliseMsisdn('46733123450', { sandbox: true }), '46733123450', 'sandbox test numbers');
});

test('without MTN credentials nothing is ever charged or marked paid', async () => {
  const store = new Store();
  const app = await startServer(store, base);
  try {
    const patient = cookieOf(await app.request('/api/auth/register', { name: 'Synthetic Patient Una', password: 'Synthetic-password-123', role: 'patient', phone: '+237677000555' }));
    assert.equal((await (await app.request('/api/config')).json()).paymentsAvailable, false);
    assert.equal((await (await app.request('/api/v1/payments/options', undefined, patient)).json()).data.available, false);
    const refused = await app.request('/api/v1/payments', { purpose: 'appointment_reschedule', msisdn: '677000555', idempotencyKey: 'key-00000001' }, patient);
    assert.equal(refused.status, 503);
    assert.equal((await refused.json()).code, 'payments_unavailable');
  } finally { await app.close(); store.close(); }
});

test('patients pay with MTN MoMo for server-priced items; results come only from MTN and paid plans activate only after success', async () => {
  const store = new Store();
  const requests = [], statuses = new Map();
  const mtnClient = {
    requestToPay: async params => { requests.push(params); statuses.set(params.referenceId, { status: 'PENDING' }); },
    getStatus: async reference => statuses.get(reference) || { status: 'NOT_FOUND' }
  };
  const config = { ...base, mtn: { ready: true, currency: 'XAF', targetEnvironment: 'mtncameroon', callbackSecret: secret }, mtnClient };
  const app = await startServer(store, config);
  try {
    store.createUser({ name: 'Dr Synthetic Fee', email: 'fee-doc@example.invalid', role: 'doctor', profile: { consultationFee: 15 } }, await hashPassword('Synthetic-doctor-pass'), 'active');
    const doctor = store.user(store.credentials('fee-doc@example.invalid').id);
    const patientResponse = await app.request('/api/auth/register', { name: 'Synthetic Patient Payer', password: 'Synthetic-password-123', role: 'patient', phone: '+237677000666' });
    const patient = cookieOf(patientResponse), patientId = (await patientResponse.json()).user.id;
    const doctorCookie = cookieOf(await app.request('/api/auth/login', { email: 'fee-doc@example.invalid', password: 'Synthetic-doctor-pass' }));
    assert.equal((await (await app.request('/api/config')).json()).paymentsAvailable, true);

    // The server sets the amount from the doctor's profile (USD 15 = XAF 9,000); the browser cannot change it.
    const pay = body => app.request('/api/v1/payments', body, patient);
    assert.equal((await pay({ purpose: 'consultation_fee', targetId: doctor.id, msisdn: '699000666', idempotencyKey: 'key-orange-1' })).status, 400, 'not an MTN number');
    assert.equal((await app.request('/api/v1/payments', { purpose: 'consultation_fee', targetId: doctor.id, msisdn: '677000666', idempotencyKey: 'key-doctor-1' }, doctorCookie)).status, 403, 'only patients pay');
    const started = await pay({ purpose: 'consultation_fee', targetId: doctor.id, msisdn: '6 77 00 06 66', idempotencyKey: 'key-consult-1', amount: 1 });
    assert.equal(started.status, 400, 'an amount sent by the browser is refused');
    const accepted = await pay({ purpose: 'consultation_fee', targetId: doctor.id, msisdn: '6 77 00 06 66', idempotencyKey: 'key-consult-1' });
    assert.equal(accepted.status, 202);
    const payment = (await accepted.json()).data.payment;
    assert.deepEqual([payment.amount, payment.currency, payment.status], [9000, 'XAF', 'pending']);
    assert.equal(requests[0].msisdn, '237677000666');
    assert.equal(requests[0].amount, 9000);
    // Retrying with the same key never charges twice.
    assert.equal((await pay({ purpose: 'consultation_fee', targetId: doctor.id, msisdn: '677000666', idempotencyKey: 'key-consult-1' })).status, 200);
    assert.equal(requests.length, 1);
    // Still pending until MTN says otherwise; then successful.
    assert.equal((await (await app.request(`/api/v1/payments/${payment.id}`, undefined, patient)).json()).data.payment.status, 'pending');
    statuses.set(requests[0].referenceId, { status: 'SUCCESSFUL', amount: '9000', currency: 'XAF', financialTransactionId: 'mtn-tx-1' });
    const done = (await (await app.request(`/api/v1/payments/${payment.id}`, undefined, patient)).json()).data.payment;
    assert.equal(done.status, 'successful');
    assert.equal(done.financialTransactionId, 'mtn-tx-1');
    assert.equal((await app.request(`/api/v1/payments/${payment.id}`, undefined, doctorCookie)).status, 404, 'payments are private');

    // A reported amount that differs from what was asked fails the payment.
    const odd = (await (await pay({ purpose: 'appointment_reschedule', msisdn: '677000666', idempotencyKey: 'key-resched-1' })).json()).data.payment;
    assert.equal(odd.amount, 3000);
    statuses.set(requests[1].referenceId, { status: 'SUCCESSFUL', amount: '300', currency: 'XAF' });
    assert.equal((await (await app.request(`/api/v1/payments/${odd.id}`, undefined, patient)).json()).data.payment.failureReason, 'amount_mismatch');

    // Premium plan: active only after MTN confirms, here through the callback (which is re-checked with MTN).
    const plan = (await (await pay({ purpose: 'subscription', tier: 'premium', msisdn: '677000666', idempotencyKey: 'key-premium-1' })).json()).data.payment;
    assert.equal(plan.amount, 6000);
    assert.equal(store.user(patientId).subscription, undefined, 'not active before payment');
    assert.equal((await app.request(`/api/v1/payments/webhooks/mtn/wrong`, { externalId: plan.id }, undefined, 'POST', {})).status, 404);
    await app.request(`/api/v1/payments/webhooks/mtn/${secret}`, { externalId: plan.id, status: 'SUCCESSFUL' }, undefined, 'POST', {});
    assert.equal(store.user(patientId).subscription, undefined, 'a callback alone is not trusted');
    statuses.set(requests[2].referenceId, { status: 'SUCCESSFUL', amount: '6000', currency: 'XAF' });
    await app.request(`/api/v1/payments/webhooks/mtn/${secret}`, { externalId: plan.id, status: 'SUCCESSFUL' }, undefined, 'POST', {});
    assert.deepEqual([store.user(patientId).subscription.tier, store.user(patientId).subscription.status], ['premium', 'active']);
    // The worker settles pending payments in the background.
    const visit = (await (await pay({ purpose: 'nurse_home_visit', targetId: doctor.id, msisdn: '677000666', idempotencyKey: 'key-visit-1' })).json());
    assert.match(visit.error, /active nurse/);
    const list = (await (await app.request('/api/v1/payments', undefined, patient)).json()).data.payments;
    assert.equal(list.length, 3);
    const log = store.db.prepare("SELECT action FROM audit_log WHERE action LIKE 'PAYMENT_%'").all().map(row => row.action);
    assert.ok(log.includes('PAYMENT_REQUESTED') && log.includes('PAYMENT_SUCCEEDED') && log.includes('PAYMENT_FAILED'));
    // Free plan without payment.
    const free = await app.request('/api/v1/subscription/free', {}, patient);
    assert.equal((await free.json()).data.user.subscription.tier, 'free');
  } finally { await app.close(); store.close(); }
});
