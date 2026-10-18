const request = require('supertest');
const { randomBytes, randomUUID } = require('node:crypto');
const { createLogger } = require('@hfa/shared');
const { createTestDatabase, dropTestDatabase, createTestAuth } = require('@hfa/shared/src/testing');
const code = require('../src/prescriptionCode');

const DB = 'hfa_pharmacy_test';
const auth = createTestAuth();
const credentialHash = 'c'.repeat(64);
const doctor = auth.tokenFor({ role: 'doctor', credentialHash });
const otherDoctor = auth.tokenFor({ role: 'doctor', credentialHash: 'd'.repeat(64) });
const pharmacist = auth.tokenFor({ role: 'pharmacist' });
const admin = auth.tokenFor({ role: 'admin' });
const patientId = randomUUID();
const allergicPatientId = randomUUID();
const credentials = new Map([[doctor.id, { credentialHash, status: 'verified' }], [otherDoctor.id, { credentialHash: 'd'.repeat(64), status: 'verified' }]]);
const userClient = {
  getCredential: jest.fn(async id => {
    if (!credentials.has(id)) throw Object.assign(new Error('not found'), { status: 404 });
    return { providerId: id, role: 'doctor', ...credentials.get(id) };
  }),
  getSafetyProfile: jest.fn(async id => ({
    patientId: id, hfaNumber: 'HFA-PT-TEST0001', birthYear: 1985, sex: 'male',
    drugAllergies: id === allergicPatientId ? [{ allergenName: 'Penicillin', severity: 'severe', verification: 'confirmed' }] : []
  })),
  syncPrescription: jest.fn().mockResolvedValue(null)
};
let app, sequelize;

const amoxicillin = { drugName: 'Amoxicillin', strength: '500 mg', form: 'capsule', dose: '1 capsule', frequency: 'every 8 hours', durationDays: 7, quantity: 21 };
const paracetamol = { drugName: 'Paracetamol', strength: '500 mg', form: 'tablet', dose: '2 tablets', frequency: 'every 6 hours if needed', durationDays: 3, quantity: 24 };
const as = (actor, method, path) => request(app)[method](path).set('Authorization', `Bearer ${actor.token}`);
const issue = (body, actor = doctor) => as(actor, 'post', '/api/v1/prescriptions').send({ patientId, items: [amoxicillin, paracetamol], ...body });

beforeAll(async () => {
  Object.assign(process.env, {
    DATABASE_URL: await createTestDatabase(DB), AUTH_PUBLIC_KEY_B64: auth.publicKeyB64,
    PRESCRIPTION_TOKEN_KEY: randomBytes(32).toString('hex'), PRESCRIPTION_CODE_KEY: randomBytes(32).toString('hex'),
    PRESCRIPTION_INTEGRITY_KEY: randomBytes(32).toString('hex'), PHARMACY_DATA_KEY: randomBytes(32).toString('hex'),
    INTERNAL_SERVICE_TOKEN: 'internal-test-token-0123456789', VERIFY_RATE_LIMIT: '1000', TRUST_PROXY: 'false', LOG_SILENT: 'true'
  });
  const { loadConfig } = require('../src/config');
  const { buildApp } = require('../src/app');
  ({ app, sequelize } = await buildApp({ config: loadConfig(), logger: createLogger('pharmacy-test'), userClient }));
});

afterAll(async () => {
  await sequelize.close();
  await dropTestDatabase(DB);
});

describe('prescription code primitives', () => {
  const keys = { tokenKey: randomBytes(32), codeKey: randomBytes(32) };

  test('base32 round-trips and codes use only unambiguous characters', () => {
    const bytes = randomBytes(57);
    expect(code.base32Decode(code.base32Encode(bytes)).equals(bytes)).toBe(true);
    const { token, shortCode } = code.createPrescriptionCredential(keys, { v: 1, rx: 'x' });
    expect(token).toMatch(/^HFA1[0-9A-HJKMNP-TV-Z]+$/);
    expect(shortCode).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){3}[0-9A-HJKMNP-TV-Z]{4}$/);
  });

  test('tokens open only when untouched and sealed with the right key', () => {
    const { token } = code.createPrescriptionCredential(keys, { v: 1, rx: 'abc' });
    expect(code.openPrescriptionToken(keys, token)).toEqual({ v: 1, rx: 'abc' });
    const last = token.slice(-1);
    expect(code.openPrescriptionToken(keys, token.slice(0, -1) + (last === '0' ? '1' : '0'))).toBeNull();
    expect(code.openPrescriptionToken({ ...keys, tokenKey: randomBytes(32) }, token)).toBeNull();
    expect(code.openPrescriptionToken(keys, 'garbage')).toBeNull();
  });

  test('typed codes are normalised (case, dashes, O/0, I/L/1)', () => {
    expect(code.normaliseShortCode('abcd-efgh-jkmn-pqrs')).toBe('ABCDEFGHJKMNPQRS');
    expect(code.normaliseShortCode('O0IL 1111 2222 3333')).toBe('0011111122223333');
    expect(code.normaliseShortCode('too-short')).toBeNull();
  });
});

describe('issuing', () => {
  test('only doctors with a verified, matching credential can prescribe', async () => {
    expect((await issue({}, pharmacist)).status).toBe(403);
    expect((await issue({}, auth.tokenFor({ role: 'doctor' }))).status).toBe(403); // no credential hash in token
    expect((await issue({}, auth.tokenFor({ role: 'doctor', credentialHash: 'e'.repeat(64) }))).status).toBe(403); // unknown to User Service
    expect((await issue({ items: [] })).status).toBe(400);
    expect((await issue({ validDays: 365 })).status).toBe(400);
  });

  test('recorded drug allergies block the prescription until acknowledged', async () => {
    const blocked = await issue({ patientId: allergicPatientId, items: [{ ...amoxicillin, drugName: 'Penicillin V' }] });
    expect(blocked.status).toBe(409);
    expect(blocked.body.data.allergyWarnings[0]).toMatchObject({ drugName: 'Penicillin V', allergenName: 'Penicillin' });
    const acknowledged = await issue({ patientId: allergicPatientId, items: [{ ...amoxicillin, drugName: 'Penicillin V' }], acknowledgeAllergyWarnings: true });
    expect(acknowledged.status).toBe(201);
  });

  test('a prescription returns a code and token; neither the code nor the medicines are stored in clear', async () => {
    const issued = await issue({});
    expect(issued.status).toBe(201);
    const { prescriptionId, verificationCode, token } = issued.body.data;
    expect(verificationCode).toMatch(/^(\w{4}-){3}\w{4}$/);
    const [[row]] = await sequelize.query('SELECT * FROM prescriptions WHERE id = :id', { replacements: { id: prescriptionId } });
    const stored = JSON.stringify(row) + row.items_enc.toString('latin1');
    expect(stored).not.toContain(verificationCode.replace(/-/g, ''));
    expect(stored).not.toContain('Amoxicillin');
    expect(row.doctor_credential_hash).toBe(credentialHash);
    expect(userClient.syncPrescription).toHaveBeenLastCalledWith(patientId, prescriptionId, expect.objectContaining({ status: 'issued', medications: ['Amoxicillin 500 mg', 'Paracetamol 500 mg'] }));
    expect(token.length).toBeLessThan(1200); // fits comfortably in a QR code
  });
});

describe('verification and dispensing', () => {
  let rx;
  beforeAll(async () => { rx = (await issue({})).body.data; });

  test('pharmacists verify by typed code or scanned token and see what they need to dispense', async () => {
    expect((await as(doctor, 'post', '/api/v1/prescriptions/verify').send({ code: rx.verificationCode })).status).toBe(403);
    const typed = await as(pharmacist, 'post', '/api/v1/prescriptions/verify').send({ code: rx.verificationCode.toLowerCase().replace(/-/g, ' ') });
    expect(typed.status).toBe(200);
    expect(typed.body.data).toMatchObject({ valid: true, reasons: [] });
    expect(typed.body.data.prescription.items.map(item => item.drugName)).toEqual(['Amoxicillin', 'Paracetamol']);
    expect(typed.body.data.prescription.patient).toEqual({ hfaNumber: 'HFA-PT-TEST0001', birthYear: 1985, sex: 'male', drugAllergies: [] });
    const scanned = await as(pharmacist, 'post', '/api/v1/prescriptions/verify').send({ token: rx.token });
    expect(scanned.body.data.valid).toBe(true);
    expect((await as(pharmacist, 'post', '/api/v1/prescriptions/verify').send({ code: rx.verificationCode, token: rx.token })).status).toBe(400);
  });

  test('forged tokens and unknown codes are rejected', async () => {
    const forged = await as(pharmacist, 'post', '/api/v1/prescriptions/verify').send({ token: `${rx.token.slice(0, -4)}AAAA` });
    expect(forged.body.data).toMatchObject({ valid: false, reasons: ['invalid_token'], prescription: null });
    const unknown = await as(pharmacist, 'post', '/api/v1/prescriptions/verify').send({ code: '0000-0000-0000-0000' });
    expect(unknown.body.data).toMatchObject({ valid: false, reasons: ['not_found'] });
  });

  test('dispensing needs the matching code and happens exactly once, even when requests race', async () => {
    const other = (await issue({})).body.data;
    expect((await as(pharmacist, 'post', `/api/v1/prescriptions/${rx.prescriptionId}/dispense`).send({ code: other.verificationCode })).status).toBe(400);
    const attempts = await Promise.all([1, 2, 3].map(() => as(pharmacist, 'post', `/api/v1/prescriptions/${rx.prescriptionId}/dispense`).send({ code: rx.verificationCode, pharmacyId: 'PH-DLA-001' })));
    expect(attempts.map(response => response.status).sort()).toEqual([200, 409, 409]);
    const again = await as(pharmacist, 'post', '/api/v1/prescriptions/verify').send({ code: rx.verificationCode });
    expect(again.body.data).toMatchObject({ valid: false, reasons: ['already_dispensed'] });
    expect(userClient.syncPrescription).toHaveBeenLastCalledWith(patientId, rx.prescriptionId, expect.objectContaining({ status: 'dispensed' }));
  });

  test('revocation: only the prescriber or an admin, and revoked prescriptions fail verification', async () => {
    const target = (await issue({})).body.data;
    expect((await as(otherDoctor, 'post', `/api/v1/prescriptions/${target.prescriptionId}/revoke`).send({ reason: 'test' })).status).toBe(403);
    expect((await as(doctor, 'post', `/api/v1/prescriptions/${target.prescriptionId}/revoke`).send({ reason: 'Dose error' })).status).toBe(200);
    const result = await as(pharmacist, 'post', '/api/v1/prescriptions/verify').send({ code: target.verificationCode });
    expect(result.body.data.reasons).toEqual(['revoked']);
    expect((await as(pharmacist, 'post', `/api/v1/prescriptions/${target.prescriptionId}/dispense`).send({ code: target.verificationCode })).status).toBe(409);
  });

  test('expired prescriptions and suspended prescribers fail verification', async () => {
    const target = (await issue({ validDays: 1 })).body.data;
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'hrtime', 'performance'], now: Date.now() + 2 * 86400000 });
    try {
      const laterPharmacist = auth.tokenFor({ role: 'pharmacist' }); // signed in two days from now
      const expired = await as(laterPharmacist, 'post', '/api/v1/prescriptions/verify').send({ code: target.verificationCode });
      expect(expired.body.data.reasons).toContain('expired');
    } finally {
      jest.useRealTimers();
    }
    const another = (await issue({})).body.data;
    credentials.set(doctor.id, { credentialHash, status: 'suspended' });
    try {
      const suspended = await as(pharmacist, 'post', '/api/v1/prescriptions/verify').send({ code: another.verificationCode });
      expect(suspended.body.data).toMatchObject({ valid: false, reasons: ['prescriber_credential_invalid'] });
    } finally {
      credentials.set(doctor.id, { credentialHash, status: 'verified' });
    }
  });
});

describe('immutability, tamper detection and audit', () => {
  let rx;
  beforeAll(async () => { rx = (await issue({})).body.data; });

  test('the database refuses to change clinical content or delete prescriptions and audit events', async () => {
    await expect(sequelize.query('UPDATE prescriptions SET item_count = 1 WHERE id = :id', { replacements: { id: rx.prescriptionId } })).rejects.toThrow(/immutable/);
    await expect(sequelize.query('DELETE FROM prescriptions WHERE id = :id', { replacements: { id: rx.prescriptionId } })).rejects.toThrow(/cannot be deleted/);
    await expect(sequelize.query("UPDATE prescription_events SET details = '{}' WHERE prescription_id = :id", { replacements: { id: rx.prescriptionId } })).rejects.toThrow(/append-only/);
    await expect(sequelize.query('DELETE FROM verification_attempts')).rejects.toThrow(/append-only/);
  });

  test('an audited admin view proves the chain; tampering by a superuser is detected', async () => {
    await as(pharmacist, 'post', '/api/v1/prescriptions/verify').send({ code: rx.verificationCode });
    const clean = await as(admin, 'get', `/api/v1/prescriptions/${rx.prescriptionId}/audit`);
    expect(clean.body.data).toMatchObject({ integrityValid: true, chain: { valid: true } });
    expect(clean.body.data.events.map(event => event.eventType)).toEqual(['issued', 'verified']);

    // Simulate an attacker with database superuser rights bypassing the triggers.
    await sequelize.query('ALTER TABLE prescriptions DISABLE TRIGGER prescriptions_immutable');
    await sequelize.query("UPDATE prescriptions SET expires_at = expires_at + interval '365 days' WHERE id = :id", { replacements: { id: rx.prescriptionId } });
    await sequelize.query('ALTER TABLE prescriptions ENABLE TRIGGER prescriptions_immutable');
    await sequelize.query('ALTER TABLE prescription_events DISABLE TRIGGER prescription_events_append_only');
    await sequelize.query(`UPDATE prescription_events SET details = '{"valid":true,"reasons":[],"note":"edited"}' WHERE prescription_id = :id AND sequence = 2`, { replacements: { id: rx.prescriptionId } });
    await sequelize.query('ALTER TABLE prescription_events ENABLE TRIGGER prescription_events_append_only');

    const tampered = await as(admin, 'get', `/api/v1/prescriptions/${rx.prescriptionId}/audit`);
    expect(tampered.body.data).toMatchObject({ integrityValid: false, chain: { valid: false, brokenAtSequence: 2 } });
    const verify = await as(pharmacist, 'post', '/api/v1/prescriptions/verify').send({ code: rx.verificationCode });
    expect(verify.body.data.reasons).toContain('integrity_check_failed');
  });

  test('repeated wrong codes lock the pharmacist out', async () => {
    const guesser = auth.tokenFor({ role: 'pharmacist' });
    for (let attempt = 0; attempt < 10; attempt++) {
      await as(guesser, 'post', '/api/v1/prescriptions/verify').send({ code: `${String(attempt).padStart(4, '0')}-0000-0000-0000` });
    }
    expect((await as(guesser, 'post', '/api/v1/prescriptions/verify').send({ code: rx.verificationCode })).status).toBe(429);
  });
});
