const request = require('supertest');
const { randomBytes, randomUUID } = require('node:crypto');
const { createLogger, unavailable } = require('@hfa/shared');
const { createTestDatabase, dropTestDatabase, createTestAuth } = require('@hfa/shared/src/testing');

const DB = 'hfa_user_test';
const auth = createTestAuth();
const authClient = { updateAccount: jest.fn().mockResolvedValue({}) };
let app, sequelize;

const patientBody = overrides => ({
  firstName: 'Synthetic', lastName: 'Patient', dateOfBirth: '1990-04-12', sex: 'female', phone: '+237650000001',
  nationalId: 'CM 1234 5678', address: '12 Rue Test, Douala', regionCode: 'CM-LT', districtCode: 'DLA-BONASSAMA',
  preferredLanguage: 'fr', bloodGroup: 'O+', emergencyContact: { name: 'Synthetic Contact', phone: '+237650000002', relationship: 'sister' },
  consents: [{ type: 'terms_of_service', granted: true }, { type: 'teleconsultation', granted: true }],
  ...overrides
});
const as = (actor, method, path) => request(app)[method](path).set('Authorization', `Bearer ${actor.token}`);
const internal = (method, path) => request(app)[method](path).set('X-Internal-Token', process.env.INTERNAL_SERVICE_TOKEN);

beforeAll(async () => {
  Object.assign(process.env, {
    DATABASE_URL: await createTestDatabase(DB), AUTH_PUBLIC_KEY_B64: auth.publicKeyB64,
    USER_DATA_KEY: randomBytes(32).toString('hex'), USER_BLIND_INDEX_KEY: randomBytes(32).toString('hex'), CREDENTIAL_HASH_KEY: randomBytes(32).toString('hex'),
    INTERNAL_SERVICE_TOKEN: 'internal-test-token-0123456789', TRUST_PROXY: 'false', LOG_SILENT: 'true'
  });
  const { loadConfig } = require('../src/config');
  const { buildApp } = require('../src/app');
  ({ app, sequelize } = await buildApp({ config: loadConfig(), logger: createLogger('user-test'), authClient }));
});

afterAll(async () => {
  await sequelize.close();
  await dropTestDatabase(DB);
});

describe('patient profile', () => {
  const patient = auth.tokenFor({ role: 'patient' });
  const otherPatient = auth.tokenFor({ role: 'patient' });
  const doctor = auth.tokenFor({ role: 'doctor' });
  const unrelatedDoctor = auth.tokenFor({ role: 'doctor' });
  const admin = auth.tokenFor({ role: 'admin' });
  let patientId;

  test('a patient creates their profile; identifiers are encrypted at rest', async () => {
    const missingConsent = await as(patient, 'post', '/api/v1/patients').send(patientBody({ consents: [{ type: 'terms_of_service', granted: true }] }));
    expect(missingConsent.status).toBe(400);
    expect(missingConsent.body.data.missing).toEqual(['teleconsultation']);
    expect((await as(patient, 'post', '/api/v1/patients').send(patientBody({ regionCode: 'Littoral' }))).status).toBe(400);

    const created = await as(patient, 'post', '/api/v1/patients').send(patientBody());
    expect(created.status).toBe(201);
    expect(created.body.data.hfaNumber).toMatch(/^HFA-PT-[0-9A-Z]{8}$/);
    patientId = created.body.data.id;

    const [[row]] = await sequelize.query('SELECT * FROM patients WHERE id = :id', { replacements: { id: patientId } });
    const raw = JSON.stringify(row) + Buffer.concat([row.first_name_enc, row.phone_enc, row.national_id_enc]).toString('latin1');
    for (const secret of ['Synthetic', '+237650000001', 'CM12345678', 'Rue Test']) expect(raw).not.toContain(secret);
    expect(row.birth_year).toBe(1990);

    expect((await as(patient, 'post', '/api/v1/patients').send(patientBody({ phone: '+237650000009' }))).status).toBe(409);
    const duplicatePhone = await as(otherPatient, 'post', '/api/v1/patients').send(patientBody());
    expect(duplicatePhone.status).toBe(409);
    expect(duplicatePhone.body.message).toMatch(/phone/);
  });

  test('patients read their own full profile; other patients and unrelated clinicians cannot', async () => {
    const own = await as(patient, 'get', `/api/v1/patients/${patientId}/profile`);
    expect(own.status).toBe(200);
    expect(own.body.data.patient).toMatchObject({ firstName: 'Synthetic', lastName: 'Patient', phone: '+237650000001', nationalId: 'CM12345678', bloodGroup: 'O+' });
    expect(own.body.data.patient.emergencyContact.relationship).toBe('sister');
    expect(own.body.data.consents).toEqual({ terms_of_service: true, teleconsultation: true });
    expect((await as(otherPatient, 'get', `/api/v1/patients/${patientId}/profile`)).status).toBe(403);
    expect((await as(unrelatedDoctor, 'get', `/api/v1/patients/${patientId}/profile`)).status).toBe(403);
    expect((await as(auth.tokenFor({ role: 'pharmacist' }), 'get', `/api/v1/patients/${patientId}/profile`)).status).toBe(403);
  });

  test('a doctor with a consultation can read the profile; every clinician access is logged', async () => {
    const consultationId = randomUUID();
    expect((await request(app).put(`/internal/v1/patients/${patientId}/consultations/${consultationId}`).send({ mode: 'video', status: 'scheduled' })).status).toBe(403);
    const upsert = await internal('put', `/internal/v1/patients/${patientId}/consultations/${consultationId}`).send({
      doctorId: doctor.id, mode: 'video', status: 'completed', scheduledAt: '2026-10-01T09:00:00.000Z', completedAt: '2026-10-01T09:20:00.000Z', primaryIcd10: 'J06.9', summary: 'Synthetic consultation summary'
    });
    expect(upsert.status).toBe(200);
    const view = await as(doctor, 'get', `/api/v1/patients/${patientId}/profile`);
    expect(view.status).toBe(200);
    expect(view.body.data.patient.nationalId).toBe('******5678');
    expect(view.body.data.consultations[0]).toMatchObject({ consultationId, primaryIcd10: 'J06.9', summary: 'Synthetic consultation summary' });
    const [logs] = await sequelize.query('SELECT accessor_role, action FROM patient_access_log WHERE patient_id = :id', { replacements: { id: patientId } });
    expect(logs).toContainEqual({ accessor_role: 'doctor', action: 'view_profile' });
  });

  test('admins must state a purpose, which is logged', async () => {
    expect((await as(admin, 'get', `/api/v1/patients/${patientId}/profile`)).status).toBe(400);
    expect((await as(admin, 'get', `/api/v1/patients/${patientId}/profile?purpose=Complaint%20investigation%20%2342`)).status).toBe(200);
    const [[log]] = await sequelize.query("SELECT purpose FROM patient_access_log WHERE accessor_role = 'admin'");
    expect(log.purpose).toBe('Complaint investigation #42');
  });

  test('CHWs can register patients without a login and keep access to them', async () => {
    const chw = auth.tokenFor({ role: 'chw' });
    const created = await as(chw, 'post', '/api/v1/patients').send(patientBody({ phone: '+237650000003', nationalId: undefined }));
    expect(created.status).toBe(201);
    expect((await as(chw, 'get', `/api/v1/patients/${created.body.data.id}/profile`)).status).toBe(200);
  });
});

describe('clinical records and safety flags', () => {
  const patient = auth.tokenFor({ role: 'patient' });
  const doctor = auth.tokenFor({ role: 'doctor' });
  let patientId;

  beforeAll(async () => {
    patientId = (await as(patient, 'post', '/api/v1/patients').send(patientBody({ phone: '+237650000010', nationalId: undefined }))).body.data.id;
    await internal('put', `/internal/v1/patients/${patientId}/consultations/${randomUUID()}`).send({ doctorId: doctor.id, mode: 'voice', status: 'completed' });
  });

  test('patient-reported allergies stay unconfirmed; doctors can confirm', async () => {
    const reported = await as(patient, 'post', `/api/v1/patients/${patientId}/allergies`).send({ category: 'drug', allergenName: 'Penicillin', allergenCode: '7980', severity: 'severe', reaction: 'Rash', verification: 'confirmed' });
    expect(reported.status).toBe(201);
    expect(reported.body.data.verification).toBe('unconfirmed');
    const confirmed = await as(doctor, 'post', `/api/v1/patients/${patientId}/allergies`).send({ category: 'drug', allergenName: 'Sulfonamides', severity: 'life_threatening', verification: 'confirmed' });
    expect(confirmed.body.data.verification).toBe('confirmed');
  });

  test('only doctors record chronic conditions, with valid ICD-10 codes', async () => {
    expect((await as(patient, 'post', `/api/v1/patients/${patientId}/conditions`).send({ icd10Code: 'I10', name: 'Hypertension' })).status).toBe(403);
    expect((await as(doctor, 'post', `/api/v1/patients/${patientId}/conditions`).send({ icd10Code: 'hypertension', name: 'Hypertension' })).status).toBe(400);
    expect((await as(doctor, 'post', `/api/v1/patients/${patientId}/conditions`).send({ icd10Code: 'i10', name: 'Essential hypertension', onsetDate: '2020-01-15', notes: 'Synthetic note' })).status).toBe(201);
    expect((await as(doctor, 'post', `/api/v1/patients/${patientId}/conditions`).send({ icd10Code: 'E11.9', name: 'Type 2 diabetes' })).status).toBe(201);
  });

  test('history entries record their source; code and code system go together', async () => {
    expect((await as(patient, 'post', `/api/v1/patients/${patientId}/history`).send({ entryType: 'immunisation', code: '03', summary: 'MMR' })).status).toBe(400);
    const added = await as(patient, 'post', `/api/v1/patients/${patientId}/history`).send({ entryType: 'immunisation', codeSystem: 'CVX', code: '03', summary: 'MMR vaccine', occurredOn: '1991-06-01' });
    expect(added.body.data.source).toBe('patient_reported');
  });

  test('the profile shows decrypted records, safety flags and prescription history', async () => {
    const prescriptionId = randomUUID();
    await internal('put', `/internal/v1/patients/${patientId}/prescriptions/${prescriptionId}`).send({
      doctorId: doctor.id, status: 'issued', issuedAt: '2026-10-02T10:00:00.000Z', expiresAt: '2026-11-01T10:00:00.000Z', medications: ['Amlodipine 5 mg', 'Metformin 500 mg']
    });
    const profile = (await as(doctor, 'get', `/api/v1/patients/${patientId}/profile`)).body.data;
    expect(profile.flags).toEqual({ hasAllergies: true, hasDrugAllergy: true, hasLifeThreateningAllergy: true, activeChronicConditions: ['E11.9', 'I10'] });
    expect(profile.allergies.map(a => a.allergenName).sort()).toEqual(['Penicillin', 'Sulfonamides']);
    expect(profile.chronicConditions.find(c => c.icd10Code === 'I10').notes).toBe('Synthetic note');
    expect(profile.medicalHistory[0]).toMatchObject({ summary: 'MMR vaccine', codeSystem: 'CVX' });
    expect(profile.prescriptions[0]).toMatchObject({ prescriptionId, itemCount: 2, medications: ['Amlodipine 5 mg', 'Metformin 500 mg'] });
    const safety = await internal('get', `/internal/v1/patients/${patientId}/safety-profile`);
    expect(safety.body.data.drugAllergies).toHaveLength(2);
  });
});

describe('provider credentials', () => {
  const admin = auth.tokenFor({ role: 'admin' });
  const doctorId = randomUUID();

  test('admins verify a credential; the Auth account is activated with the credential hash', async () => {
    const body = { userId: doctorId, role: 'doctor', fullName: 'Dr Synthetic', licensingBody: 'onmc', licenceNumber: 'CM-MED 2021 0041', specialty: 'General Medicine' };
    expect((await as(auth.tokenFor({ role: 'doctor' }), 'post', '/api/v1/providers').send(body)).status).toBe(403);
    const verified = await as(admin, 'post', '/api/v1/providers').send(body);
    expect(verified.status).toBe(201);
    const hash = verified.body.data.credentialHash;
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(authClient.updateAccount).toHaveBeenLastCalledWith(doctorId, { status: 'active', credentialHash: hash });
    const credential = await internal('get', `/internal/v1/providers/${doctorId}/credential`);
    expect(credential.body.data).toEqual({ providerId: doctorId, role: 'doctor', credentialHash: hash, status: 'verified' });
    expect((await as(admin, 'post', '/api/v1/providers').send({ ...body, userId: randomUUID(), licenceNumber: 'cm-med20210041' })).status).toBe(409);
  });

  test('suspending a provider suspends their account; a failed Auth call changes nothing', async () => {
    const suspended = await as(admin, 'patch', `/api/v1/providers/${doctorId}/status`).send({ status: 'suspended' });
    expect(suspended.body.data.status).toBe('suspended');
    expect(authClient.updateAccount).toHaveBeenLastCalledWith(doctorId, { status: 'suspended' });
    authClient.updateAccount.mockRejectedValueOnce(unavailable());
    expect((await as(admin, 'patch', `/api/v1/providers/${doctorId}/status`).send({ status: 'verified' })).status).toBe(503);
    expect((await internal('get', `/internal/v1/providers/${doctorId}/credential`)).body.data.status).toBe('suspended');
  });
});
