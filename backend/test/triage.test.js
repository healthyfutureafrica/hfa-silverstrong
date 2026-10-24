const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Store, hashPassword } = require('../store');
const { createApp } = require('../server');
const { deidentify } = require('../triage-ai');
const Triage = require('../../hfa-triage.js');

const baseConfig = { origin: 'http://localhost:8080', ready: false, fileEncryptionKey: '3e'.repeat(32) };

async function startServer(store, config) {
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
const uuid = () => crypto.randomUUID();

test('rules follow WHO danger signs, raise risk for vulnerable people and only allow self-care for mild low-risk adults', () => {
  const level = answers => Triage.assess(answers).level;
  // WHO IMCI general danger sign in a young child.
  assert.equal(level({ ageGroup: 'child', complaints: ['fever'], dangerSigns: ['unable_to_drink'] }), 'emergency');
  // Any illness in a baby under 2 months.
  assert.equal(level({ ageGroup: 'infant', complaints: ['fever'] }), 'emergency');
  // Pregnancy danger sign.
  assert.equal(level({ ageGroup: 'adult', sex: 'female', maternal: 'pregnant', dangerSigns: ['vaginal_bleeding'] }), 'emergency');
  // Fever needs a malaria test the same day; with sickle cell disease it is an emergency.
  assert.equal(level({ ageGroup: 'adult', complaints: ['fever'], duration: 'days_1_2', severity: 'mild' }), 'urgent');
  assert.equal(level({ ageGroup: 'adult', complaints: ['fever'], conditions: ['sickle_cell'] }), 'emergency');
  assert.equal(level({ ageGroup: 'adult', complaints: ['pain_chest'] }), 'emergency');
  // TB screening for a long cough; default routine for anything not covered.
  const cough = Triage.assess({ ageGroup: 'adult', complaints: ['cough_breathing'], duration: 'weeks', severity: 'mild' });
  assert.equal(cough.level, 'routine');
  assert.ok(cough.reasons.some(reason => reason.rule === 'cough_tb_screen'));
  assert.equal(level({ ageGroup: 'adult', complaints: ['other'] }), 'routine');
  // Self-care only for a healthy adult with a mild, recent, low-risk problem.
  assert.equal(level({ ageGroup: 'adult', complaints: ['headache'], duration: 'hours', severity: 'mild' }), 'self_care');
  assert.equal(level({ ageGroup: 'older_adult', complaints: ['headache'], duration: 'hours', severity: 'mild' }), 'routine');
  assert.equal(level({ ageGroup: 'adult', complaints: ['headache'], duration: 'hours', severity: 'mild', conditions: ['hypertension'] }), 'routine');
  // Unknown codes are ignored, never trusted.
  assert.deepEqual(Triage.normalise({ ageGroup: 'adult', dangerSigns: ['made_up', 'convulsions'] }).dangerSigns, ['convulsions']);
  // AI findings can only add: a "mild" reading never lowers a severe answer or removes a ticked sign.
  const merged = Triage.merge({ ageGroup: 'adult', severity: 'severe', dangerSigns: ['chest_pain'] }, { severity: 'mild', dangerSigns: [], complaints: ['headache'] });
  assert.equal(merged.severity, 'severe');
  assert.deepEqual(merged.dangerSigns, ['chest_pain']);
  // Questions adapt to the person: IMCI signs for children, maternal signs when pregnant.
  assert.ok(Triage.signsFor({ ageGroup: 'child' }).includes('chest_indrawing'));
  assert.ok(Triage.signsFor({ ageGroup: 'adult', maternal: 'pregnant' }).includes('reduced_movement'));
  assert.equal(Triage.signsFor({ ageGroup: 'adult' }).includes('reduced_movement'), false);
  for (const language of ['en', 'fr']) for (const sign of Triage.ALL_SIGNS) assert.notEqual(Triage.label('sign_' + sign, language), 'sign_' + sign);
});

test('identifying details are removed before text could reach an AI service', () => {
  const clean = deidentify('I am Eko Mbah, call me on +237 677 555 111 or eko@example.com, CNI AB123456. Fever since 3 days.', { name: 'Eko Mbah' });
  assert.doesNotMatch(clean, /Eko|Mbah|677|example\.com|AB123456/);
  assert.match(clean, /Fever since 3 days/);
});

test('patient symptom check reaches their clinicians, emergencies alert them, and a clinician confirms or changes the level', async () => {
  const store = new Store();
  // Stand-in for Claude: reads a danger sign the patient did not tick and drafts a summary.
  const calls = [];
  const anthropicClient = { beta: { messages: { parse: async params => {
    calls.push(params);
    return { stop_reason: 'end_turn', model: 'claude-opus-5-5', parsed_output: { complaints: ['fever'], dangerSigns: ['stiff_neck', 'not_a_code'], duration: 'days_1_2', severity: 'severe', clinicianSummary: 'Fever for two days with a stiff neck.', language: 'en' } };
  } } } };
  const app = await startServer(store, { ...baseConfig, aiTriageEnabled: true, anthropicClient });
  try {
    const doctor = store.createUser({ name: 'Dr Synthetic Triage', email: 'triage-doc@example.invalid', role: 'doctor', profile: { hospital: 'Synthetic Triage Hospital' } }, await hashPassword('Synthetic-doctor-pass'), 'active');
    const otherDoctor = store.createUser({ name: 'Dr Elsewhere', email: 'elsewhere@example.invalid', role: 'doctor', profile: { hospital: 'Another Hospital' } }, await hashPassword('Synthetic-doctor-pass'), 'active');
    const registered = await app.request('/api/auth/register', { name: 'Synthetic Patient Ndi', password: 'Synthetic-password-123', role: 'patient', phone: '+237677555222', hospitalId: store.listedHospitals().find(item => item.name === 'Synthetic Triage Hospital').id });
    assert.equal(registered.status, 201);
    const patientCookie = cookieOf(registered);
    const patient = (await registered.json()).user;
    const doctorCookie = cookieOf(await app.request('/api/auth/login', { email: 'triage-doc@example.invalid', password: 'Synthetic-doctor-pass' }));
    const otherCookie = cookieOf(await app.request('/api/auth/login', { email: 'elsewhere@example.invalid', password: 'Synthetic-doctor-pass' }));

    assert.equal((await (await app.request('/api/config')).json()).aiTriage, true);
    // Without AI consent the words are never sent; the rules alone decide.
    const plain = await app.request('/api/v1/triage', { requestId: uuid(), answers: { ageGroup: 'adult', complaints: ['fever'], duration: 'days_1_2', severity: 'mild' }, text: 'Hot body since yesterday', aiConsent: false }, patientCookie);
    assert.equal(plain.status, 201);
    assert.equal((await plain.json()).data.case.level, 'urgent');
    assert.equal(calls.length, 0);

    // With consent, the AI reads a stiff neck in the words: the rules turn that into an emergency.
    const requestId = uuid();
    const body = { requestId, answers: { ageGroup: 'adult', complaints: ['fever'], duration: 'days_1_2', severity: 'moderate' }, text: 'I am Synthetic Patient Ndi, fever for 2 days and my neck is stiff, +237 677 555 222', aiConsent: true };
    const ai = await app.request('/api/v1/triage', body, patientCookie);
    const created = (await ai.json()).data;
    assert.equal(created.case.level, 'emergency');
    assert.equal(created.aiUsed, true);
    assert.ok(created.case.reasons.some(reason => reason.rule === 'sign_stiff_neck'));
    assert.doesNotMatch(JSON.stringify(calls[0].messages), /Ndi|677/, 'name and phone are removed before the AI call');
    assert.equal(calls[0].model, 'claude-opus-5-5');
    assert.equal(calls[0].fallbacks, 'default');
    // Retrying the same request does not create a second case.
    assert.equal((await (await app.request('/api/v1/triage', body, patientCookie)).json()).message, 'Already received');
    assert.equal((await (await app.request('/api/v1/triage/mine', undefined, patientCookie)).json()).data.cases.length, 2);
    assert.equal((await app.request('/api/v1/triage', body, doctorCookie)).status, 403, 'only patients submit');

    // The clinician at the patient's hospital is alerted and sees the full case; a doctor elsewhere sees nothing.
    assert.ok((await (await app.request('/api/notifications', undefined, doctorCookie)).json()).notifications.some(item => /emergency triage/.test(item.message)));
    const queue = (await (await app.request('/api/v1/triage/queue', undefined, doctorCookie)).json()).data.cases;
    assert.equal(queue[0].level, 'emergency', 'emergencies first');
    assert.equal(queue[0].aiSummary, 'Fever for two days with a stiff neck.');
    assert.match(queue[0].rulesSummary, /stiff neck/i);
    assert.equal((await (await app.request('/api/v1/triage/queue', undefined, otherCookie)).json()).data.cases.length, 0);
    assert.equal((await app.request(`/api/v1/triage/${queue[0].id}/review`, { decision: 'confirm', finalLevel: 'emergency' }, otherCookie)).status, 404);

    // Lowering a level needs a reason; the decision is recorded once and the patient is told.
    const emergency = queue[0], urgent = queue[1];
    assert.equal((await app.request(`/api/v1/triage/${emergency.id}/review`, { decision: 'change', finalLevel: 'urgent' }, doctorCookie)).status, 400);
    const confirmed = await app.request(`/api/v1/triage/${emergency.id}/review`, { decision: 'confirm', finalLevel: 'emergency', note: 'Please go to the emergency department now.' }, doctorCookie);
    assert.equal(confirmed.status, 200);
    assert.equal((await app.request(`/api/v1/triage/${emergency.id}/review`, { decision: 'confirm', finalLevel: 'emergency' }, doctorCookie)).status, 409);
    assert.equal((await app.request(`/api/v1/triage/${urgent.id}/review`, { decision: 'change', finalLevel: 'routine', note: 'Malaria test negative this morning at the clinic.' }, doctorCookie)).status, 200);
    const mine = (await (await app.request('/api/v1/triage/mine', undefined, patientCookie)).json()).data.cases;
    const answered = mine.find(item => item.id === emergency.id);
    assert.equal(answered.status, 'confirmed');
    assert.equal(answered.reviewerName, 'Dr Synthetic Triage');
    assert.equal(answered.note, 'Please go to the emergency department now.');
    assert.equal('text' in answered, false, 'patient view does not repeat the AI working');
    const log = (await (await app.request('/api/v1/me/access-log', undefined, patientCookie)).json()).data.entries;
    assert.ok(log.some(entry => entry.action === 'TRIAGE_VIEWED'));
    assert.ok(log.some(entry => entry.action === 'TRIAGE_REVIEWED'));

    // Administrators oversee the queue without seeing symptoms.
    store.createUser({ name: 'Synthetic Admin', email: 'triage-admin@example.invalid', role: 'admin' }, await hashPassword('Synthetic-admin-pass'), 'active');
    const adminCookie = cookieOf(await app.request('/api/auth/login', { email: 'triage-admin@example.invalid', password: 'Synthetic-admin-pass' }));
    const oversight = await (await app.request('/api/v1/triage/queue', undefined, adminCookie)).json();
    assert.equal(oversight.data.oversightOnly, true);
    assert.equal(JSON.stringify(oversight).includes('stiff'), false);
    assert.equal(oversight.data.cases[0].hasClinician, true);
    void patient; void otherDoctor;
  } finally { await app.close(); store.close(); }
});

test('triage still works with the rules alone when the AI fails or refuses', async () => {
  const store = new Store();
  const anthropicClient = { beta: { messages: { parse: async () => { throw Object.assign(new Error('overloaded'), { status: 529 }); } } } };
  const app = await startServer(store, { ...baseConfig, aiTriageEnabled: true, anthropicClient });
  try {
    const registered = await app.request('/api/auth/register', { name: 'Synthetic Patient Abe', password: 'Synthetic-password-123', role: 'patient', phone: '+237677555333' });
    const response = await app.request('/api/v1/triage', { requestId: uuid(), answers: { ageGroup: 'child', complaints: ['diarrhoea_vomiting'] }, text: 'Diarrhoea since morning', aiConsent: true }, cookieOf(registered));
    assert.equal(response.status, 201);
    const data = (await response.json()).data;
    assert.equal(data.aiUsed, false);
    assert.equal(data.case.level, 'urgent');
  } finally { await app.close(); store.close(); }
});
