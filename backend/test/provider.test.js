const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { Store } = require('../store');
const { MetaProvider, validSignature } = require('../provider');

const config = { ready: true, token: 'synthetic-token', appSecret: 'synthetic-secret', phoneId: '1234',
  graphVersion: 'v24.0', template: 'patient_activity', language: 'en_US', businessNumber: '+237611111111', loginUrl: 'https://example.invalid' };

function fixture(fetcher) {
  const store = new Store();
  const patient = store.createUser({ role: 'patient', name: 'Test', email: 'test@example.invalid', whatsappNumber: '+237600000000', whatsappNotificationsConsent: true }, 'unused', 'active');
  return { store, patient, provider: new MetaProvider(config, store, fetcher) };
}

test('Meta signatures are validated against exact raw bytes', () => {
  const body = Buffer.from('{"test":1}');
  const signature = `sha256=${createHmac('sha256', config.appSecret).update(body).digest('hex')}`;
  assert.equal(validSignature(body, signature, config.appSecret), true);
  assert.equal(validSignature(Buffer.from('{}'), signature, config.appSecret), false);
  assert.equal(validSignature(body, 'invalid', config.appSecret), false);
});

test('only the registered sender can verify and template delivery excludes clinical content', async () => {
  let sent;
  const { store, patient, provider } = fixture(async (url, options) => {
    sent = { url, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ messages: [{ id: 'wamid-test' }] }) };
  });
  const challenge = provider.verification(patient);
  const text = new URL(challenge.url).searchParams.get('text');
  const webhook = from => ({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: {
    metadata: { phone_number_id: config.phoneId }, messages: [{ id: `inbound-${from}`, from, text: { body: text } }]
  } }] }] });
  provider.webhook(webhook('237699999999'));
  assert.equal(store.user(patient.id).whatsappVerifiedAt, null);
  provider.webhook(webhook('237600000000'));
  assert.ok(store.user(patient.id).whatsappVerifiedAt);
  store.activity(patient, { patientId: patient.id, eventId: 'test-event', resource: 'Medical Records' }, true, 'Generic activity');
  await provider.deliverNext();
  assert.equal(sent.body.to, '237600000000');
  assert.equal(sent.body.type, 'template');
  assert.equal(sent.body.template.name, 'patient_activity');
  assert.equal(sent.body.text, undefined);
  assert.equal(store.db.prepare('SELECT status FROM deliveries').get().status, 'accepted');
  store.close();
});

test('ambiguous transport failure is not automatically retried', async () => {
  const { store, patient, provider } = fixture(async () => { throw new Error('Synthetic timeout'); });
  store.db.prepare('UPDATE users SET whatsapp_verified_at=? WHERE id=?').run(new Date().toISOString(), patient.id);
  store.activity(patient, { patientId: patient.id, eventId: 'test-event', resource: 'Account' }, true, 'Generic activity');
  await provider.deliverNext();
  assert.equal(store.db.prepare('SELECT status FROM deliveries').get().status, 'delivery_unknown');
  store.close();
});

test('STOP revokes consent and prevents pending delivery', async () => {
  let requests=0;
  const { store, patient, provider }=fixture(async()=>{requests++;throw new Error('Must not send');});
  store.db.prepare('UPDATE users SET whatsapp_verified_at=? WHERE id=?').run(new Date().toISOString(),patient.id);
  store.activity(patient,{patientId:patient.id,eventId:'stop-event',resource:'Account'},true,'Generic activity');
  provider.webhook({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{metadata:{phone_number_id:config.phoneId},messages:[{id:'stop-inbound',from:'237600000000',text:{body:'STOP'}}]}}]}]});
  assert.equal(store.user(patient.id).whatsappNotificationsConsent,false);
  await provider.deliverNext();
  assert.equal(requests,0);
  assert.equal(store.db.prepare('SELECT status FROM deliveries').get().status,'blocked_consent');
  store.close();
});

test('rate-limit responses retry but server failures remain uncertain', async () => {
  const { store, patient, provider }=fixture(async()=>({ok:false,status:429,json:async()=>({error:{code:130429}})}));
  store.db.prepare('UPDATE users SET whatsapp_verified_at=? WHERE id=?').run(new Date().toISOString(),patient.id);
  store.activity(patient,{patientId:patient.id,eventId:'retry-event',resource:'Account'},true,'Generic activity');
  await provider.deliverNext();
  assert.equal(store.db.prepare('SELECT status FROM deliveries').get().status,'retry');
  store.db.prepare('UPDATE deliveries SET next_attempt=0').run();
  provider.fetcher=async()=>({ok:false,status:500,json:async()=>({error:{code:1}})});
  await provider.deliverNext();
  assert.equal(store.db.prepare('SELECT status FROM deliveries').get().status,'delivery_unknown');
  store.close();
});

test('delivery callbacks track the original number and do not downgrade read receipts', async () => {
  const { store, patient, provider }=fixture(async()=>({ok:true,json:async()=>({messages:[{id:'receipt-test'}]})}));
  store.db.prepare('UPDATE users SET whatsapp_verified_at=? WHERE id=?').run(new Date().toISOString(),patient.id);
  const job=store.activity(patient,{patientId:patient.id,eventId:'receipt-event',resource:'Account'},true,'Generic activity');
  await provider.deliverNext();
  store.db.prepare('UPDATE users SET whatsapp_number=? WHERE id=?').run('+237699999999',patient.id);
  const update=status=>provider.webhook({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{metadata:{phone_number_id:config.phoneId},statuses:[{id:'receipt-test',biz_opaque_callback_data:job.id,recipient_id:'237600000000',status}]}}]}]});
  update('read'); update('sent');
  assert.equal(store.db.prepare('SELECT status FROM deliveries').get().status,'read');
  store.close();
});