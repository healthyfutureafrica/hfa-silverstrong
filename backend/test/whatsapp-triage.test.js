const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Store, hashPassword } = require('../store');
const { MetaProvider } = require('../provider');
const { WhatsAppTriage, DAILY_REPLY_LIMIT } = require('../whatsapp-triage');
const Triage = require('../../hfa-triage.js');

const config = { origin: 'http://localhost:8080', loginUrl: 'http://localhost:8080', enabled: true, token: 'synthetic-token', phoneId: '1234567890', graphVersion: 'v24.0', fileEncryptionKey: '5d'.repeat(32), ready: false };

function setup() {
  const store = new Store();
  const sent = [];
  const fetcher = async (url, options) => { sent.push({ url, body: JSON.parse(options.body) }); return { ok: true, json: async () => ({ messages: [{ id: 'wamid.synthetic' }] }) }; };
  return { store, sent, bot: new WhatsAppTriage(config, store, fetcher) };
}

test('anyone can check symptoms on WhatsApp with numbered replies, in English or French, using free text replies only', async () => {
  const { store, sent, bot } = setup();
  const phone = '+237699000111';
  const greeting = await bot.handle(phone, 'Hello');
  assert.match(greeting, /I am \*SLY\*/);
  assert.match(greeting, /1\. Baby under 2 months/);
  assert.match(greeting, new RegExp(Triage.EMERGENCY_NUMBER));
  assert.match(await bot.handle(phone, 'adult please'), /did not understand/, 'unclear answers are asked again');
  assert.match(await bot.handle(phone, '4'), /Sex\?/);
  assert.match(await bot.handle(phone, '1'), /Pregnancy\?/);
  assert.match(await bot.handle(phone, '1'), /What is the problem\?/);
  assert.match(await bot.handle(phone, 'Hot body since yesterday and headache'), /noted your words/);
  const signs = await bot.handle(phone, '1, 6');
  assert.match(signs, /0\. None/);
  assert.equal(/Bleeding from the vagina/.test(signs), false, 'pregnancy signs only when pregnant');
  assert.match(await bot.handle(phone, '0'), /How long/, '"0" means none here, not restart');
  assert.match(await bot.handle(phone, '2'), /How bad/);
  const result = await bot.handle(phone, '1');
  assert.match(result, /Result: URGENT/);
  assert.match(result, /malaria test today/);
  assert.match(result, /register or sign in at http:\/\/localhost:8080/, 'unknown numbers are invited to register');
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM triage_cases').get().n, 0, 'nothing is kept about unregistered people');
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM wa_triage_sessions').get().n, 0, 'the conversation is forgotten when finished');
  // Every message is a plain text reply (free inside the 24-hour window), never a paid template.
  assert.ok(sent.length >= 9);
  assert.ok(sent.every(item => item.body.type === 'text' && !item.body.template && item.body.to === '237699000111'));

  // French on request, and from French words.
  assert.match(await bot.handle(phone, 'FR'), /Bonjour, je suis \*SLY\*/);
  assert.match(await bot.handle('+237699000222', 'bonjour, mon enfant est malade'), /Qui est malade/);
});

test('a verified patient’s WhatsApp check reaches their care team, and an emergency sign ends the questions', async () => {
  const { store, bot } = setup();
  const doctor = store.createUser({ name: 'Dr Synthetic WA', email: 'wa-doc@example.invalid', role: 'doctor', profile: { hospital: 'Synthetic WA Hospital' } }, await hashPassword('Synthetic-doctor-pass'), 'active');
  const patient = store.createUser({ name: 'Synthetic WA Patient', email: 'wa-pat@example.invalid', role: 'patient', phone: '+237677000444', whatsappNumber: '+237677000444', whatsappNotificationsConsent: true }, 'x', 'active');
  store.updateUser(patient.id, { assignedDoctor: doctor.id });
  const phone = '+237677000444';
  // Not verified yet: treated like anyone else.
  assert.equal(bot.patientFor(phone), null);
  store.db.prepare('UPDATE users SET whatsapp_verified_at=? WHERE id=?').run(new Date().toISOString(), patient.id);
  assert.equal(bot.patientFor(phone).id, patient.id);

  await bot.handle(phone, 'hi');
  await bot.handle(phone, '2'); // child 2 months to 5 years
  await bot.handle(phone, 'He cannot drink since this morning');
  const signs = await bot.handle(phone, '1');
  const asked = Triage.signsFor({ ageGroup: 'child' });
  const result = await bot.handle(phone, String(asked.indexOf('unable_to_drink') + 1));
  assert.match(result, /Result: EMERGENCY/);
  assert.match(result, /Sent to your HFA care team/);
  assert.match(signs, /Not able to drink or breastfeed/);
  const row = store.db.prepare('SELECT * FROM triage_cases').get();
  assert.equal(row.patient_id, patient.id);
  assert.equal(row.level, 'emergency');
  assert.ok(store.notifications(doctor.id).some(item => /emergency triage/.test(item.message)), 'the doctor is alerted');
});

test('replies stop at the daily cap and webhook messages reach SLY without blocking STOP handling', async () => {
  const { store, sent, bot } = setup();
  for (let index = 0; index < DAILY_REPLY_LIMIT + 5; index++) await bot.handle('+237699000333', 'hello');
  assert.equal(sent.length, DAILY_REPLY_LIMIT);

  const provider = new MetaProvider(config, store, async () => ({ ok: true, json: async () => ({}) }));
  const received = [];
  provider.onText = async (phone, text) => { received.push([phone, text]); };
  const message = (id, body) => ({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: config.phoneId }, messages: [{ id, from: '237699000444', type: 'text', text: { body } }] } }] }] });
  provider.webhook(message('wamid.1', 'Bonjour'));
  provider.webhook(message('wamid.1', 'Bonjour')); // Meta retries are ignored
  provider.webhook(message('wamid.2', 'STOP'));
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(received, [['+237699000444', 'Bonjour']]);
  store.close();
});
