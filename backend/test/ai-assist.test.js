const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Store, hashPassword } = require('../store');
const { createApp } = require('../server');
const Surveillance = require('../../hfa-surveillance.js');
const Triage = require('../../hfa-triage.js');
const Evaluation = require('../../hfa-ai-eval.js');

const baseConfig = { origin: 'http://localhost:8080', ready: false, fileEncryptionKey: '6a'.repeat(32) };

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
const profile = division => ({
  identity: { dateOfBirth: '1990-01-01', gender: 'female' }, location: { region: 'littoral', division, town: 'Douala' },
  medical: { drugAllergies: [{ name: 'Penicillin', severity: 'severe' }] }, lifestyle: {},
  consents: { dataSharing: true, research: false, sms: false, whatsapp: false, ministry: true }
});

test('scribe drafts a SOAP note for the clinician, explain helps the patient, and both remove identifying details, respect AI-off and daily caps', async () => {
  const store = new Store();
  const calls = [];
  const anthropicClient = { messages: { parse: async params => {
    calls.push(params);
    if (params.system.includes('SOAP')) return { stop_reason: 'end_turn', parsed_output: {
      subjective: 'Fever for 2 days.', objective: 'Not examined (telehealth).', assessment: 'Suspected malaria.', plan: 'Malaria RDT today.',
      icd11: [{ code: '1F4Z', title: 'Malaria, unspecified' }, { code: 'BA00', title: 'Essential hypertension' }, { code: 'not a code', title: 'x' }],
      safetyFlags: ['Penicillin allergy recorded: avoid amoxicillin.'], missingInformation: ['Malaria test result'] } };
    return { stop_reason: 'end_turn', parsed_output: { explanation: 'Your test shows malaria.', keyPoints: ['Take all tablets'], questionsForDoctor: ['When should I come back?'], seekCareNow: false } };
  } } };
  const app = await startServer(store, { ...baseConfig, aiTriageEnabled: true, aiDailyLimit: 3, anthropicClient });
  try {
    store.createUser({ name: 'Dr Synthetic Scribe', email: 'scribe@example.invalid', role: 'doctor', profile: { hospital: 'Synthetic Scribe Hospital' } }, await hashPassword('Synthetic-doctor-pass'), 'active');
    const registered = await app.request('/api/auth/register', { name: 'Synthetic Patient Mbe', password: 'Synthetic-password-123', role: 'patient', phone: '+237677111000', hospitalId: store.listedHospitals()[0].id, healthProfile: profile('Wouri') });
    const patientCookie = cookieOf(registered);
    const doctorCookie = cookieOf(await app.request('/api/auth/login', { email: 'scribe@example.invalid', password: 'Synthetic-doctor-pass' }));
    const triage = await (await app.request('/api/v1/triage', { requestId: crypto.randomUUID(), answers: { ageGroup: 'adult', complaints: ['fever'], duration: 'days_1_2', severity: 'moderate' }, text: '' }, patientCookie)).json();

    const status = await (await app.request('/api/v1/ai/status', undefined, doctorCookie)).json();
    assert.equal(status.data.model, 'claude-haiku-5-5');
    assert.equal(status.data.dailyLimit, 3);
    assert.equal((await app.request('/api/v1/ai/scribe', { notes: 'fever 2d' }, patientCookie)).status, 403, 'clinicians only');

    const scribe = await app.request('/api/v1/ai/scribe', { notes: 'Synthetic Patient Mbe, fever 2 days, call +237 677 111 000. Plan RDT.', triageCaseId: triage.data.case.id }, doctorCookie);
    assert.equal(scribe.status, 200);
    const draft = (await scribe.json()).data.draft;
    assert.equal(draft.assessment, 'Suspected malaria.');
    assert.deepEqual(draft.icd11.map(item => [item.code, item.verified]), [['1F4Z', false], ['BA00', true]], 'malformed codes dropped, known ones marked');
    assert.match(calls[0].messages[0].content, /Penicillin \(severe\)/, 'the symptom-check summary with allergies is included');
    assert.doesNotMatch(calls[0].messages[0].content, /Mbe|677/, 'name and phone removed');
    assert.equal(calls[0].model, 'claude-haiku-5-5');
    assert.equal(calls[0].output_config.effort, 'low');

    assert.equal((await app.request('/api/v1/ai/explain', { kind: 'lab', text: 'Malaria RDT positive', language: 'fr' }, doctorCookie)).status, 403, 'patients only');
    const explained = await app.request('/api/v1/ai/explain', { kind: 'lab', text: 'Malaria RDT: positive. Start artemether-lumefantrine.', language: 'fr' }, patientCookie);
    assert.equal(explained.status, 200);
    assert.equal((await explained.json()).data.result.questionsForDoctor.length, 1);
    assert.match(calls[1].messages[0].content, /Language: French/);

    // Daily cap (3 per person): the doctor has used 1, so two more pass and the next is refused.
    await app.request('/api/v1/ai/scribe', { notes: 'cough 3 weeks' }, doctorCookie);
    await app.request('/api/v1/ai/scribe', { notes: 'headache' }, doctorCookie);
    const capped = await app.request('/api/v1/ai/scribe', { notes: 'one more' }, doctorCookie);
    assert.equal(capped.status, 429);
    assert.equal((await capped.json()).code, 'ai_limit');

    // Monitoring sees the AI calls and an estimated cost.
    const metrics = (await (await app.request('/api/v1/ai/metrics', undefined, doctorCookie)).json()).data;
    assert.equal(metrics.cases, 1);
    assert.equal(metrics.awaiting, 1);
    assert.equal(metrics.aiCalls30Days, 4);
    assert.ok(metrics.estimatedCostUsd30Days > 0 && metrics.estimatedCostUsd30Days < 0.01);
    assert.equal((await app.request('/api/v1/ai/metrics', undefined, patientCookie)).status, 403);
  } finally { await app.close(); store.close(); }

  // With AI switched off the routes say so clearly, and the app falls back to templates and the glossary.
  const offStore = new Store();
  const off = await startServer(offStore, baseConfig);
  try {
    offStore.createUser({ name: 'Dr Off', email: 'off@example.invalid', role: 'doctor' }, await hashPassword('Synthetic-doctor-pass'), 'active');
    const cookie = cookieOf(await off.request('/api/auth/login', { email: 'off@example.invalid', password: 'Synthetic-doctor-pass' }));
    const response = await off.request('/api/v1/ai/scribe', { notes: 'fever' }, cookie);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'ai_off');
  } finally { await off.close(); offStore.close(); }
});

test('outbreak early warning finds a cholera-like cluster in one division without exposing names', async () => {
  const store = new Store();
  const app = await startServer(store, baseConfig);
  try {
    store.createUser({ name: 'Dr Synthetic Surveillance', email: 'surv@example.invalid', role: 'doctor', profile: { hospital: 'Synthetic Surveillance Hospital' } }, await hashPassword('Synthetic-doctor-pass'), 'active');
    const hospitalId = store.listedHospitals()[0].id;
    for (const [index, division] of ['Wouri', 'Wouri', 'Wouri', 'Moungo'].entries()) {
      const registered = await app.request('/api/auth/register', { name: `Synthetic Person ${'ABCD'[index]}`, password: 'Synthetic-password-123', role: 'patient', phone: `+23767722200${index}`, hospitalId, healthProfile: profile(division) });
      await app.request('/api/v1/triage', { requestId: crypto.randomUUID(), answers: { ageGroup: 'adult', complaints: ['diarrhoea_vomiting'], dangerSigns: ['watery_diarrhoea'] } }, cookieOf(registered));
    }
    const doctorCookie = cookieOf(await app.request('/api/auth/login', { email: 'surv@example.invalid', password: 'Synthetic-doctor-pass' }));
    const response = await app.request('/api/v1/ai/outbreak', undefined, doctorCookie);
    assert.equal(response.status, 200);
    const data = (await response.json()).data;
    const alert = data.signals.find(signal => signal.syndrome === 'awd');
    assert.equal(alert.level, 'alert');
    assert.equal(alert.division, 'Wouri');
    assert.equal(alert.current, 3);
    assert.equal(data.signals.some(signal => signal.syndrome === 'awd' && signal.division === 'Moungo'), false, 'one case is not a cluster');
    assert.equal(JSON.stringify(data).includes('Synthetic Person'), false);
    assert.ok(data.weekly.every(row => row.count === '<3' || row.count >= 3), 'small counts are hidden in the export');
  } finally { await app.close(); store.close(); }
});

test('surveillance statistics and the triage safety evaluation', () => {
  // Poisson tail: P(X >= 1 | 1) = 1 - e^-1.
  assert.ok(Math.abs(Surveillance.poissonTail(1, 1) - (1 - Math.exp(-1))) < 1e-9);
  const now = Date.parse('2026-10-24T12:00:00Z');
  const day = 86400000;
  const fever = (daysAgo, region = 'centre') => ({ date: new Date(now - daysAgo * day).toISOString(), region, division: 'Mfoundi', complaints: ['fever'], dangerSigns: [] });
  // Baseline of 1 fever case a week, then 8 this week: a trend signal. A steady region is not flagged.
  const events = [...[10, 17, 24, 31].map(days => fever(days)), ...Array.from({ length: 8 }, (_, index) => fever(index % 6)), ...[1, 9, 16, 23, 30].map(days => fever(days, 'west'))];
  const { signals } = Surveillance.analyse(events, { now });
  assert.deepEqual(signals.map(signal => [signal.syndrome, signal.region, signal.level]), [['fever', 'centre', 'watch']]);
  assert.match(Surveillance.toCsv(Surveillance.analyse(events, { now }).weekly), /^period,region,syndrome,value\n2026-W/);

  const result = Evaluation.evaluate(Triage);
  assert.equal(result.underTriage.length, 0, `under-triage: ${result.underTriage.map(item => item.id).join(', ')}`);
  assert.equal(result.emergencySensitivity, 1);
  assert.ok(result.total >= 40);
});
