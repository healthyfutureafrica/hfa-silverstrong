const { test } = require('node:test');
const assert = require('node:assert/strict');
const { contentProblem, realDate } = require('../clinical-rules');
const { Store } = require('../store');
const { createApp } = require('../server');

// People the records refer to, by role.
const people = { pat: 'patient', doc: 'doctor', doc2: 'doctor', nur: 'nurse', lab: 'labtech', adm: 'admin' };
const store = { user: id => (people[id] ? { id, role: people[id] } : null) };
const day = offset => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const booking = (changes = {}) => ({ patientId: 'pat', doctorId: 'doc', nurseId: '', date: day(3), time: '09:30', durationMinutes: 30, mode: 'video', status: 'scheduled', ...changes });

test('real calendar dates only', () => {
  assert.equal(realDate('2026-02-28'), true);
  assert.equal(realDate('2026-02-31'), false);
  assert.equal(realDate('26-10-2026'), false);
  assert.equal(realDate('2026-13-01'), false);
});

test('appointment mistakes are caught with a message saying what to fix', () => {
  const problem = (data, existing = null) => contentProblem(store, 'appointments', data, existing);
  assert.equal(problem(booking()), null);
  assert.match(problem(booking({ date: day(-3) })), /cannot be in the past/);
  assert.match(problem(booking({ date: '2028-02-30' })), /real date/);
  assert.match(problem(booking({ date: day(900) })), /2 years/);
  assert.match(problem(booking({ time: '25:00' })), /00:00 and 23:59/);
  assert.match(problem(booking({ time: '9.30' })), /00:00 and 23:59/);
  assert.match(problem(booking({ durationMinutes: 300 })), /10 to 180 minutes/, 'an extra zero');
  assert.match(problem(booking({ doctorId: 'nur' })), /choose a doctor/, 'a nurse picked as the doctor');
  assert.match(problem(booking({ nurseId: 'doc' })), /choose a nurse/);
  assert.match(problem(booking({ patientId: 'doc' })), /choose a patient/);
  assert.match(problem(booking({ mode: 'telepathy' })), /choose video/);
  assert.match(problem(booking({ status: 'completed' })), /starts as scheduled/);
  // Completing or keeping an old appointment is fine; moving one into the past is not.
  const old = booking({ date: day(-10) });
  assert.equal(problem({ ...old, status: 'completed' }, old), null);
  assert.match(problem(booking({ date: day(-2) }), booking()), /cannot be in the past/);
});

test('other records: wrong roles, empty text and impossible values are refused', () => {
  const problem = (collection, data) => contentProblem(store, collection, data, null);
  assert.match(problem('messages', { from: 'pat', to: 'doc', text: '   ' }), /empty/);
  assert.match(problem('messages', { from: 'doc', to: 'doc', text: 'hi' }), /yourself/);
  assert.match(problem('careNotes', { patientId: 'pat', nurseId: 'nur', text: '.' }), /at least 3/);
  assert.match(problem('doctorReports', { patientId: 'pat', doctorId: 'doc', summary: 'Malaria', plan: '' }), /treatment plan/);
  assert.match(problem('doctorReports', { patientId: 'pat', doctorId: 'nur', summary: 'Malaria', plan: 'ACT' }), /choose a doctor/);
  assert.match(problem('labResults', { patientId: 'pat', labTechId: 'lab', specialistDoctorId: 'nur', testType: 'RDT', fileData: 'x' }), /specialist doctor/);
  assert.match(problem('labResults', { patientId: 'pat', labTechId: 'lab', specialistDoctorId: 'doc', testType: 'RDT' }), /attach the result file/);
  assert.match(problem('specialistReferrals', { patientId: 'pat', generalistId: 'doc', specialistDoctorId: 'doc', specialty: 'Cardiology', status: 'pending_choice' }), /another doctor/);
  assert.match(problem('homeVisits', { patientId: 'pat', nurseId: 'nur', doctorId: '', visitDate: day(-1 - 1), visitTime: '14:00', status: 'scheduled', location: 'Home, Bonaberi' }), /past/);
  assert.match(problem('homeVisits', { patientId: 'pat', nurseId: 'doc', doctorId: '', visitDate: day(2), visitTime: '14:00', status: 'scheduled' }), /choose a nurse/);
  assert.match(problem('reviews', { patientId: 'pat', providerId: 'doc', rating: 6 }), /1 to 5/);
  assert.match(problem('reviews', { patientId: 'pat', providerId: 'lab', rating: 4 }), /doctor or nurse/);
  assert.match(problem('carePlans', { patientId: 'pat', ownerId: 'doc', title: 'BP control', status: 'active', goals: [{ label: 'x', progress: 150 }] }), /0 and 100/);
  assert.equal(problem('homeVisits', { patientId: 'pat', nurseId: 'nur', doctorId: 'doc', visitDate: day(2), visitTime: '14:00', status: 'scheduled', location: 'Home, Bonaberi' }), null);
});

test('registration refuses names without letters and impossible birth dates', async () => {
  const db = new Store();
  const server = createApp({ origin: 'http://localhost:8080', ready: false, fileEncryptionKey: '7a'.repeat(32) }, db, {}).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const register = body => fetch(`http://127.0.0.1:${server.address().port}/api/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-HFA-Request': '1', Origin: 'http://localhost:8080' }, body: JSON.stringify(body) });
  try {
    const base = { password: 'Synthetic-pass-123', role: 'patient', phone: '+237677300400' };
    assert.equal((await register({ ...base, name: '1' })).status, 400);
    assert.match((await (await register({ ...base, name: '..' })).json()).error, /at least 2 letters/);
    const profile = { identity: { dateOfBirth: '1826-05-05', gender: 'male' }, location: { region: 'centre', division: 'Mfoundi', town: 'Yaoundé' }, medical: {}, lifestyle: {}, consents: { dataSharing: true, research: false, sms: false, whatsapp: false, ministry: false } };
    assert.match((await (await register({ ...base, name: 'Synthetic Elder', healthProfile: profile })).json()).error, /year of birth/);
    assert.equal((await register({ ...base, name: 'Synthetic Elder', healthProfile: { ...profile, identity: { ...profile.identity, dateOfBirth: '1926-05-05' } } })).status, 201);
  } finally { await new Promise(resolve => server.close(resolve)); db.close(); }
});
