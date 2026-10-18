const request = require('supertest');
const { randomBytes, randomUUID } = require('node:crypto');
const { createLogger } = require('@hfa/shared');
const { createTestDatabase, dropTestDatabase, createTestAuth } = require('@hfa/shared/src/testing');
const { MtnMomoClient } = require('../src/mtnClient');

const DB = 'hfa_payment_test';
const CALLBACK_SECRET = 'cb-secret-0123456789-0123456789-abcdef';
const auth = createTestAuth();
const patient = auth.tokenFor({ role: 'patient' });
const otherPatient = auth.tokenFor({ role: 'patient' });

// A fake MTN MoMo Collections API that records every request.
class FakeMtn {
  constructor() { this.reset(); }
  reset() { this.payments = new Map(); this.requests = []; this.tokenCalls = 0; this.nextRequestToPay = null; this.failNetwork = false; }
  setStatus(reference, changes) { Object.assign(this.payments.get(reference), changes); }
  fetch = async (url, options = {}) => {
    const { pathname } = new URL(url);
    const headers = options.headers || {};
    this.requests.push({ method: options.method || 'GET', pathname, headers, body: options.body ? JSON.parse(options.body) : undefined });
    if (this.failNetwork) throw new TypeError('fetch failed');
    const json = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (pathname === '/collection/token/') { this.tokenCalls++; return json(200, { access_token: `token-${this.tokenCalls}`, token_type: 'access_token', expires_in: 3600 }); }
    if (pathname === '/collection/v1_0/requesttopay' && options.method === 'POST') {
      if (this.nextRequestToPay) { const behaviour = this.nextRequestToPay; this.nextRequestToPay = null; return behaviour(); }
      const body = JSON.parse(options.body);
      this.payments.set(headers['X-Reference-Id'], { status: 'PENDING', amount: body.amount, currency: body.currency, externalId: body.externalId });
      return json(202);
    }
    const match = pathname.match(/^\/collection\/v1_0\/requesttopay\/([0-9a-f-]+)$/);
    if (match) {
      const state = this.payments.get(match[1]);
      return state ? json(200, { ...state, payer: { partyIdType: 'MSISDN', partyId: '237670000000' } }) : json(404, { code: 'RESOURCE_NOT_FOUND' });
    }
    return json(404);
  };
}

const mtn = new FakeMtn();
const consultations = new Map();
const consultationClient = {
  getConsultation: jest.fn(async id => {
    if (!consultations.has(id)) throw Object.assign(new Error('Consultation not found'), { status: 404 });
    return consultations.get(id);
  }),
  markPaid: jest.fn().mockResolvedValue({})
};
let app, sequelize, paymentService, models;

const newConsultation = (overrides = {}) => {
  const id = randomUUID();
  consultations.set(id, { id, patientUserId: patient.id, status: 'awaiting_payment', feeXaf: 9000, ...overrides });
  return id;
};
const pay = (consultationId, { actor = patient, key = randomUUID(), msisdn = '677 12 34 56' } = {}) =>
  request(app).post('/api/v1/payments/mtn-momo').set('Authorization', `Bearer ${actor.token}`).set('Idempotency-Key', key).send({ consultationId, msisdn });
const referenceOf = async paymentId => (await models.Payment.findByPk(paymentId)).providerReference;
const makeDue = paymentId => models.Payment.update({ nextPollAt: new Date(Date.now() - 1000) }, { where: { id: paymentId } });

beforeAll(async () => {
  Object.assign(process.env, {
    DATABASE_URL: await createTestDatabase(DB), AUTH_PUBLIC_KEY_B64: auth.publicKeyB64,
    PAYMENT_DATA_KEY: randomBytes(32).toString('hex'), PAYMENT_BLIND_INDEX_KEY: randomBytes(32).toString('hex'),
    INTERNAL_SERVICE_TOKEN: 'internal-test-token-0123456789', TRUST_PROXY: 'false', LOG_SILENT: 'true',
    MTN_BASE_URL: 'https://mtn.test', MTN_COLLECTION_SUBSCRIPTION_KEY: 'sub-key', MTN_API_USER: 'api-user', MTN_API_KEY: 'api-key',
    MTN_TARGET_ENVIRONMENT: 'mtncameroon', MTN_CURRENCY: 'XAF', MTN_CALLBACK_SECRET: CALLBACK_SECRET, PUBLIC_BASE_URL: 'https://www.healthyfutureafrica.org'
  });
  const { loadConfig } = require('../src/config');
  const { buildApp } = require('../src/app');
  ({ app, sequelize, paymentService, models } = await buildApp({ config: loadConfig(), logger: createLogger('payment-test'), consultationClient, fetchImpl: mtn.fetch }));
});

beforeEach(() => mtn.reset());
afterAll(async () => {
  await sequelize.close();
  await dropTestDatabase(DB);
});

describe('starting a payment', () => {
  test('sends a correct request-to-pay to MTN using the amount from the Consultation Service', async () => {
    const consultationId = newConsultation();
    const response = await pay(consultationId);
    expect(response.status).toBe(202);
    expect(response.body.data.payment).toMatchObject({ consultationId, status: 'pending', amount: 9000, currency: 'XAF', provider: 'mtn_momo' });
    const call = mtn.requests.find(r => r.pathname === '/collection/v1_0/requesttopay');
    expect(call.headers).toMatchObject({
      Authorization: 'Bearer token-1', 'X-Target-Environment': 'mtncameroon', 'Ocp-Apim-Subscription-Key': 'sub-key',
      'X-Callback-Url': `https://www.healthyfutureafrica.org/api/v1/payments/webhooks/mtn/${CALLBACK_SECRET}`,
      'X-Reference-Id': await referenceOf(response.body.data.payment.id)
    });
    expect(call.body).toMatchObject({ amount: '9000', currency: 'XAF', externalId: response.body.data.payment.id, payer: { partyIdType: 'MSISDN', partyId: '237677123456' } });
    const tokenRequest = mtn.requests.find(r => r.pathname === '/collection/token/');
    expect(tokenRequest.headers.Authorization).toBe(`Basic ${Buffer.from('api-user:api-key').toString('base64')}`);
  });

  test('the same Idempotency-Key never charges twice', async () => {
    const consultationId = newConsultation();
    const key = randomUUID();
    const first = await pay(consultationId, { key });
    const second = await pay(consultationId, { key });
    expect(second.status).toBe(200);
    expect(second.body.data).toMatchObject({ replayed: true, payment: { id: first.body.data.payment.id } });
    expect(mtn.requests.filter(r => r.pathname === '/collection/v1_0/requesttopay')).toHaveLength(1);
    expect((await pay(newConsultation(), { key })).status).toBe(409); // key reused for another consultation
  });

  test('validates ownership, consultation state, the phone number and the Idempotency-Key header', async () => {
    expect((await pay(newConsultation(), { actor: otherPatient })).status).toBe(403);
    expect((await pay(newConsultation({ status: 'completed' }))).status).toBe(409);
    expect((await pay(newConsultation(), { msisdn: '699123456' })).status).toBe(400); // not an MTN prefix
    expect((await request(app).post('/api/v1/payments/mtn-momo').set('Authorization', `Bearer ${patient.token}`).send({ consultationId: newConsultation(), msisdn: '677123456' })).status).toBe(400);
    const busy = newConsultation();
    await pay(busy);
    expect((await pay(busy)).status).toBe(409); // a payment is already in progress
  });

  test('a request MTN rejects fails immediately; an uncertain one stays pending', async () => {
    mtn.nextRequestToPay = () => new Response(JSON.stringify({ code: 'PAYER_NOT_FOUND' }), { status: 400 });
    const rejected = await pay(newConsultation());
    expect(rejected.body.data.payment).toMatchObject({ status: 'failed', failureReason: 'provider_rejected_400' });
    mtn.nextRequestToPay = () => { throw new TypeError('socket hang up'); };
    const uncertain = await pay(newConsultation());
    expect(uncertain.body.data.payment.status).toBe('pending');
  });
});

describe('confirming a payment', () => {
  test('polling marks the payment successful and updates the consultation exactly once', async () => {
    const consultationId = newConsultation();
    const paymentId = (await pay(consultationId)).body.data.payment.id;
    await makeDue(paymentId);
    await paymentService.pollDue();
    expect((await models.Payment.findByPk(paymentId)).status).toBe('pending');

    mtn.setStatus(await referenceOf(paymentId), { status: 'SUCCESSFUL', financialTransactionId: '987654321' });
    await makeDue(paymentId);
    await paymentService.pollDue();
    const payment = await models.Payment.findByPk(paymentId);
    expect(payment).toMatchObject({ status: 'successful', financialTransactionId: '987654321' });

    consultationClient.markPaid.mockClear();
    await paymentService.dispatchOutbox();
    await paymentService.dispatchOutbox();
    expect(consultationClient.markPaid).toHaveBeenCalledTimes(1);
    expect(consultationClient.markPaid).toHaveBeenCalledWith(consultationId, expect.objectContaining({ paymentId, amount: 9000, currency: 'XAF', financialTransactionId: '987654321' }));
    await expect(sequelize.query("UPDATE payments SET status = 'failed' WHERE id = :id", { replacements: { id: paymentId } })).rejects.toThrow(/final/);
  });

  test('callbacks are not trusted: the status is re-checked with MTN', async () => {
    const paymentId = (await pay(newConsultation())).body.data.payment.id;
    const callback = body => request(app).put(`/api/v1/payments/webhooks/mtn/${CALLBACK_SECRET}`).send(body);
    expect((await request(app).put('/api/v1/payments/webhooks/mtn/wrong-secret').send({ externalId: paymentId, status: 'SUCCESSFUL' })).status).toBe(404);
    expect((await callback({ externalId: paymentId, status: 'SUCCESSFUL' })).status).toBe(200); // forged claim; MTN still says PENDING
    expect((await models.Payment.findByPk(paymentId)).status).toBe('pending');
    mtn.setStatus(await referenceOf(paymentId), { status: 'SUCCESSFUL', financialTransactionId: '111' });
    await callback({ externalId: paymentId, status: 'SUCCESSFUL' });
    expect((await models.Payment.findByPk(paymentId)).status).toBe('successful');
  });

  test('an amount different from the one requested is never accepted', async () => {
    const paymentId = (await pay(newConsultation())).body.data.payment.id;
    mtn.setStatus(await referenceOf(paymentId), { status: 'SUCCESSFUL', amount: '100' });
    await makeDue(paymentId);
    await paymentService.pollDue();
    expect(await models.Payment.findByPk(paymentId)).toMatchObject({ status: 'failed', failureReason: 'amount_mismatch' });
  });

  test('declined, expired and never-received payments end in a clear final status', async () => {
    const declined = (await pay(newConsultation())).body.data.payment.id;
    mtn.setStatus(await referenceOf(declined), { status: 'FAILED', reason: 'APPROVAL_REJECTED' });
    const viewed = await request(app).get(`/api/v1/payments/${declined}`).set('Authorization', `Bearer ${patient.token}`);
    expect(viewed.body.data.payment).toMatchObject({ status: 'failed', failureReason: 'APPROVAL_REJECTED' });
    expect((await request(app).get(`/api/v1/payments/${declined}`).set('Authorization', `Bearer ${otherPatient.token}`)).status).toBe(403);

    const slow = (await pay(newConsultation())).body.data.payment.id;
    await models.Payment.update({ expiresAt: new Date(Date.now() - 1000), nextPollAt: new Date(Date.now() - 1000) }, { where: { id: slow } });
    await paymentService.pollDue();
    expect((await models.Payment.findByPk(slow)).status).toBe('expired');

    mtn.nextRequestToPay = () => { throw new TypeError('timeout'); };
    const lost = (await pay(newConsultation())).body.data.payment.id;
    mtn.payments.clear();
    for (let attempt = 0; attempt < 4; attempt++) { await makeDue(lost); await paymentService.pollDue(); }
    expect(await models.Payment.findByPk(lost)).toMatchObject({ status: 'failed', failureReason: 'not_received_by_provider' });
  });

  test('outbox deliveries retry when the Consultation Service is down', async () => {
    await paymentService.dispatchOutbox(); // deliver events left by earlier tests first
    const consultationId = newConsultation();
    const paymentId = (await pay(consultationId)).body.data.payment.id;
    await paymentService.finalise(paymentId, 'successful', { financialTransactionId: '222' });
    consultationClient.markPaid.mockReset().mockRejectedValueOnce(new Error('consultation service unavailable')).mockResolvedValue({});
    await paymentService.dispatchOutbox();
    const [[pending]] = await sequelize.query('SELECT attempts, delivered_at, last_error FROM payment_outbox WHERE payment_id = :id', { replacements: { id: paymentId } });
    expect(pending).toMatchObject({ attempts: 1, delivered_at: null, last_error: 'consultation service unavailable' });
    await sequelize.query('UPDATE payment_outbox SET next_attempt_at = now() WHERE payment_id = :id', { replacements: { id: paymentId } });
    await paymentService.dispatchOutbox();
    const [[delivered]] = await sequelize.query('SELECT delivered_at FROM payment_outbox WHERE payment_id = :id', { replacements: { id: paymentId } });
    expect(delivered.delivered_at).not.toBeNull();
  });
});

describe('MTN client', () => {
  test('caches the access token and refreshes it once after a 401', async () => {
    const fake = new FakeMtn();
    let rejectNext = false;
    const fetchImpl = async (url, options) => {
      if (rejectNext && url.includes('/requesttopay/')) { rejectNext = false; return new Response(null, { status: 401 }); }
      return fake.fetch(url, options);
    };
    const client = new MtnMomoClient({ baseUrl: 'https://mtn.test', subscriptionKey: 's', apiUser: 'u', apiKey: 'k', targetEnvironment: 'sandbox', fetchImpl });
    const ref = randomUUID();
    await client.requestToPay({ referenceId: ref, amount: 100, currency: 'EUR', externalId: 'x', msisdn: '46733123450' });
    await client.getStatus(ref);
    expect(fake.tokenCalls).toBe(1);
    rejectNext = true;
    expect((await client.getStatus(ref)).status).toBe('PENDING');
    expect(fake.tokenCalls).toBe(2);
  });
});
