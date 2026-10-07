const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Store, hashPassword, verifyPassword } = require('../store');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

test('password hashing and opaque sessions do not expose credentials', async () => {
  const store = new Store();
  const hash = await hashPassword('Synthetic-password-123');
  assert.equal(await verifyPassword('Synthetic-password-123', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
  const user = store.createUser({ name: 'Test Patient', email: 'test@example.invalid', role: 'patient' }, hash, 'active');
  const token = store.createSession(user.id);
  assert.equal(store.session(token).id, user.id);
  assert.equal(store.user(user.id).password_hash, undefined);
  assert.notEqual(store.db.prepare('SELECT token_hash FROM sessions').get().token_hash, token);
  store.logout(token);
  assert.equal(store.session(token), null);
  store.close();
});

test('activity records are authorized, idempotent and blocked before verified consent', () => {
  const store = new Store();
  const patient = store.createUser({ name: 'Test Patient', email: 'patient@example.invalid', role: 'patient', whatsappNumber: '+237600000000', whatsappNotificationsConsent: true }, 'not-used', 'active');
  const other = store.createUser({ name: 'Other Patient', email: 'other@example.invalid', role: 'patient' }, 'not-used', 'active');
  const event = { eventId: 'event-one', patientId: patient.id, resource: 'Appointments' };
  const first = store.activity(patient, event, true, 'Generic account activity. Do not reply.');
  assert.equal(first.status, 'blocked_verification');
  assert.equal(store.activity(patient, event, true, 'Same event').id, first.id);
  assert.equal(store.notifications(patient.id).length, 1);
  assert.throws(() => store.activity(other, event, true, 'Forged activity'), /Forbidden/);
  store.updateUser(patient.id, { status: 'suspended' });
  const token = store.createSession(patient.id);
  assert.equal(store.session(token), null);
  store.close();
});

test('accounts, sessions and queued activity survive a database reopen', () => {
  const directory=mkdtempSync(join(tmpdir(),'hfa-test-'));
  const path=join(directory,'test.sqlite');
  let store=new Store(path);
  try {
    const user=store.createUser({name:'Synthetic Patient',email:'persistent@example.invalid',role:'patient'},'unused','active');
    const token=store.createSession(user.id);
    store.activity(user,{patientId:user.id,eventId:'persistent-event',resource:'Account'},false,'Generic activity');
    store.close();store=new Store(path);
    assert.equal(store.session(token).id,user.id);
    assert.equal(store.notifications(user.id).length,1);
  } finally {store.close();rmSync(directory,{recursive:true,force:true});}
});