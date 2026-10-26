// Earnings accounts for nurses and doctors. Each completed, paid piece of work is credited; the balance accrues and
// can be withdrawn once it holds MIN_WITHDRAWAL_CREDITS (10) credits.
// - Nurses: 3,000 FCFA per home visit, credited by nurse-workforce.js once the report, the patient's feedback and the
//   doctor's confirmation are in.
// - Doctors: for each completed consultation, what the patient actually paid for it (the doctor's own consultation
//   fee, through a confirmed mobile money payment). A consultation nobody paid for adds nothing and does not count.
//   Payments are matched to completed consultations with the same patient, oldest first; each payment once.
// - Withdrawals are paid automatically by the payout provider (payouts.js, Maviance). Nobody can mark a withdrawal
//   paid or decline it by hand. Until the provider is connected, requests wait in the queue; the owner can cancel a
//   request still waiting. A payout refused by the provider returns the money to the account.
const { randomUUID } = require('node:crypto');
const { z } = require('zod');
const { unseal } = require('./records');
const { filesConfigured } = require('./files');
const { ensureClinicalTable } = require('./clinical');

const MIN_WITHDRAWAL_CREDITS = 10;
const SOURCES = { nurse: 'home_visit', doctor: 'consultation' };

function ensureEarningsTables(store) {
  ensureClinicalTable(store);
  store.db.exec(`
    CREATE TABLE IF NOT EXISTS earnings_credits (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, source TEXT NOT NULL, source_id TEXT NOT NULL, payment_id TEXT UNIQUE,
      amount INTEGER NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL, credited_at TEXT NOT NULL, paid_at TEXT, withdrawal_id TEXT, details TEXT NOT NULL DEFAULT '{}',
      UNIQUE(source, source_id)
    );
    CREATE TABLE IF NOT EXISTS earnings_withdrawals (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, amount INTEGER NOT NULL, credits INTEGER NOT NULL, method TEXT NOT NULL, destination TEXT NOT NULL,
      status TEXT NOT NULL, requested_at TEXT NOT NULL, updated_at TEXT NOT NULL, provider_reference TEXT, failure_reason TEXT, attempts INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS earnings_credits_user ON earnings_credits(user_id, status);`);
  // Accounts kept by the first version (nurses only, paid by hand) carry over.
  const has = name => !!store.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
  if (has('nurse_withdrawals')) {
    const status = { requested: 'queued', paid: 'paid', declined: 'failed' };
    for (const row of store.db.prepare('SELECT * FROM nurse_withdrawals').all())
      store.db.prepare('INSERT OR IGNORE INTO earnings_withdrawals (id,user_id,amount,credits,method,destination,status,requested_at,updated_at,provider_reference,failure_reason) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .run(row.id, row.nurse_id, row.amount, row.visits, row.method, row.destination, status[row.status] || row.status, row.requested_at, row.decided_at || row.requested_at, row.reference, row.note);
    store.db.exec('DROP TABLE nurse_withdrawals');
  }
  if (has('nurse_payouts')) {
    const columns = store.db.prepare('PRAGMA table_info(nurse_payouts)').all().map(column => column.name);
    for (const row of store.db.prepare('SELECT * FROM nurse_payouts').all())
      store.db.prepare('INSERT OR IGNORE INTO earnings_credits (id,user_id,source,source_id,amount,currency,status,credited_at,paid_at,withdrawal_id) VALUES (?,?,?,?,?,?,?,?,?,?)')
        .run(row.id, row.nurse_id, 'home_visit', row.visit_id, row.amount, row.currency, row.status === 'due' ? 'available' : row.status, row.due_at, row.paid_at, columns.includes('withdrawal_id') ? row.withdrawal_id : null);
    store.db.exec('DROP TABLE nurse_payouts');
  }
}

const notify = (store, userId, message) => store.db.prepare('INSERT INTO notifications VALUES (?,?,?,?,?)').run(randomUUID(), userId, message, 'Billing', new Date().toISOString());

/** Adds a credit once per piece of work. Returns true when it was added. */
function credit(store, { userId, source, sourceId, amount, paymentId = null, details = {} }) {
  ensureEarningsTables(store);
  if (!(amount > 0)) return false;
  const added = store.db.prepare('INSERT OR IGNORE INTO earnings_credits (id,user_id,source,source_id,payment_id,amount,currency,status,credited_at,details) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(randomUUID(), userId, source, sourceId, paymentId, Math.round(amount), 'XAF', 'available', new Date().toISOString(), JSON.stringify(details)).changes > 0;
  if (added) {
    store.audit(userId, 'EARNINGS_CREDITED', { targetId: userId, details: { source, sourceId, amount: Math.round(amount), currency: 'XAF' } });
    notify(store, userId, `HFA SilverStrong: ${Math.round(amount).toLocaleString('en-US')} FCFA has been added to your HFA account. Sign in to see your balance.`);
  }
  return added;
}
const creditFor = (store, source, sourceId) => { ensureEarningsTables(store); return store.db.prepare('SELECT * FROM earnings_credits WHERE source=? AND source_id=?').get(source, sourceId) || null; };

/** Credits a doctor's completed consultations that the patient has paid for. */
function syncConsultationCredits(config, store, doctorId) {
  ensureEarningsTables(store);
  if (!store.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='payments'").get() || !filesConfigured(config)) return;
  const today = new Date().toISOString().slice(0, 10);
  const appointments = store.db.prepare("SELECT * FROM clinical_records WHERE collection='appointments' AND people LIKE ?").all(`%"${doctorId}"%`)
    .map(row => JSON.parse(unseal(config, `clinical:appointments:${row.id}`, row).toString()))
    .filter(data => data.doctorId === doctorId && data.status === 'completed' && String(data.date || '') <= today && !creditFor(store, 'consultation', data.id))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  if (!appointments.length) return;
  const payments = store.db.prepare(`SELECT * FROM payments WHERE purpose='consultation_fee' AND target_id=? AND status='successful'
    AND id NOT IN (SELECT payment_id FROM earnings_credits WHERE payment_id IS NOT NULL) ORDER BY completed_at`).all(doctorId);
  for (const appointment of appointments) {
    const forThis = payments.filter(payment => payment.payer_id === appointment.patientId);
    const payment = forThis.find(item => JSON.parse(item.details || '{}').appointmentId === appointment.id) || forThis[0];
    if (!payment) continue;
    payments.splice(payments.indexOf(payment), 1);
    credit(store, { userId: doctorId, source: 'consultation', sourceId: appointment.id, amount: payment.amount, paymentId: payment.id,
      details: { patientId: appointment.patientId, date: appointment.date, feeUsd: payment.usd } });
  }
}

function installEarningsRoutes(app, config, store, authenticated, admin, { provider = null } = {}) {
  ensureEarningsTables(store);
  const ok = (data, message = 'OK') => ({ success: true, data, message, timestamp: new Date().toISOString() });
  const earner = (request, response, next) => SOURCES[request.user.role] ? next() : response.status(403).json({ error: 'For nurses and doctors only' });
  const own = (request, response, next) => request.impersonator ? response.status(403).json({ error: 'Only the account holder can do this' }) : next();
  const nameOf = id => (id && store.user(id)?.name) || null;

  const withdrawalView = row => row && { id: row.id, userId: row.user_id, name: nameOf(row.user_id), role: store.user(row.user_id)?.role || null, amount: row.amount, credits: row.credits, currency: 'XAF',
    method: row.method, destination: row.destination, status: row.status, requestedAt: row.requested_at, updatedAt: row.updated_at, reference: row.provider_reference, reason: row.failure_reason };
  function describe(row) {
    const details = JSON.parse(row.details || '{}');
    if (row.source === 'consultation') return { patientName: nameOf(details.patientId), date: details.date || null };
    const visit = store.db.prepare("SELECT * FROM clinical_records WHERE collection='homeVisits' AND id=?").get(row.source_id);
    const data = visit && filesConfigured(config) ? JSON.parse(unseal(config, `clinical:homeVisits:${visit.id}`, visit).toString()) : null;
    return { patientName: data ? nameOf(data.patientId) : null, date: data?.visitDate || null };
  }
  function account(user) {
    if (user.role === 'doctor') syncConsultationCredits(config, store, user.id);
    const credits = store.db.prepare('SELECT * FROM earnings_credits WHERE user_id=? ORDER BY credited_at DESC').all(user.id);
    const sum = status => credits.filter(row => !status || row.status === status).reduce((total, row) => total + row.amount, 0);
    const available = credits.filter(row => row.status === 'available');
    const withdrawals = store.db.prepare('SELECT * FROM earnings_withdrawals WHERE user_id=? ORDER BY requested_at DESC').all(user.id).map(withdrawalView);
    const open = withdrawals.find(item => ['queued', 'processing'].includes(item.status)) || null;
    return {
      role: user.role, unit: SOURCES[user.role], balance: sum('available'), availableCredits: available.length, minimumCredits: MIN_WITHDRAWAL_CREDITS, currency: 'XAF',
      canWithdraw: available.length >= MIN_WITHDRAWAL_CREDITS && !open, pending: open, automaticPayouts: !!provider,
      totalEarned: sum(), totalPaid: sum('paid'), totalCredits: credits.length, consultationFee: user.role === 'doctor' ? user.consultationFee || null : null,
      credits: credits.map(row => ({ id: row.id, source: row.source, amount: row.amount, status: row.status, creditedAt: row.credited_at, paidAt: row.paid_at, ...describe(row) })),
      withdrawals
    };
  }

  app.get('/api/v1/earnings/account', authenticated, earner, (request, response) => response.set('Cache-Control', 'no-store').json(ok(account(request.user))));
  app.post('/api/v1/earnings/withdrawals', authenticated, own, earner, (request, response) => {
    const input = z.object({ method: z.enum(['mobile_money', 'bank_transfer']), destination: z.string().trim().min(5).max(200).regex(/^[^<>\u0000-\u001f]+$/, 'remove < and > characters') }).strict().parse(request.body);
    let destination = input.destination;
    if (input.method === 'mobile_money') {
      destination = destination.replace(/[\s().-]/g, '');
      if (/^[26]\d{8}$/.test(destination)) destination = '+237' + destination;
      if (!/^\+2376\d{8}$/.test(destination)) return response.status(400).json({ error: 'destination: Enter a Cameroon mobile money number, e.g. +237 6XX XX XX XX' });
    } else if (destination.length < 10) return response.status(400).json({ error: 'destination: Give the bank name, account holder and account number (RIB)' });
    const user = request.user, now = new Date().toISOString(), id = randomUUID();
    if (user.role === 'doctor') syncConsultationCredits(config, store, user.id); // count consultations paid since the last look
    store.db.exec('BEGIN IMMEDIATE');
    try {
      if (store.db.prepare("SELECT 1 FROM earnings_withdrawals WHERE user_id=? AND status IN ('queued','processing')").get(user.id)) { store.db.exec('ROLLBACK'); return response.status(409).json({ error: 'You already have a withdrawal being processed' }); }
      const available = store.db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS total FROM earnings_credits WHERE user_id=? AND status='available'").get(user.id);
      const unit = user.role === 'doctor' ? 'paid consultations' : 'completed home visits';
      if (available.n < MIN_WITHDRAWAL_CREDITS) { store.db.exec('ROLLBACK'); return response.status(409).json({ error: `You can withdraw after ${MIN_WITHDRAWAL_CREDITS} ${unit} (${available.n} so far)` }); }
      store.db.prepare('INSERT INTO earnings_withdrawals (id,user_id,amount,credits,method,destination,status,requested_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').run(id, user.id, available.total, available.n, input.method, destination, 'queued', now, now);
      store.db.prepare("UPDATE earnings_credits SET status='queued', withdrawal_id=? WHERE user_id=? AND status='available'").run(id, user.id);
      store.audit(user.id, 'WITHDRAWAL_REQUESTED', { targetId: user.id, details: { amount: available.total, credits: available.n, method: input.method }, ip: request.ip });
      store.db.exec('COMMIT');
    } catch (error) { store.db.exec('ROLLBACK'); throw error; }
    response.status(201).json(ok(account(store.user(user.id)), 'Withdrawal requested'));
  });
  // The owner can take back a request the payout service has not started.
  app.post('/api/v1/earnings/withdrawals/:id/cancel', authenticated, own, earner, (request, response) => {
    const row = store.db.prepare('SELECT * FROM earnings_withdrawals WHERE id=? AND user_id=?').get(request.params.id, request.user.id);
    if (!row) return response.sendStatus(404);
    if (row.status !== 'queued') return response.status(409).json({ error: 'This withdrawal is already being paid' });
    store.db.exec('BEGIN IMMEDIATE');
    try {
      store.db.prepare("UPDATE earnings_withdrawals SET status='cancelled', updated_at=? WHERE id=? AND status='queued'").run(new Date().toISOString(), row.id);
      store.db.prepare("UPDATE earnings_credits SET status='available', withdrawal_id=NULL WHERE withdrawal_id=?").run(row.id);
      store.audit(request.user.id, 'WITHDRAWAL_CANCELLED', { targetId: request.user.id, details: { amount: row.amount }, ip: request.ip });
      store.db.exec('COMMIT');
    } catch (error) { store.db.exec('ROLLBACK'); throw error; }
    response.json(ok(account(request.user), 'Withdrawal cancelled'));
  });
  // Administrators watch the queue; they cannot pay, decline or change anything.
  app.get('/api/v1/admin/earnings', authenticated, admin, (request, response) => {
    const withdrawals = store.db.prepare("SELECT * FROM earnings_withdrawals ORDER BY CASE status WHEN 'processing' THEN 0 WHEN 'queued' THEN 1 ELSE 2 END, requested_at DESC").all().map(withdrawalView);
    const balances = store.db.prepare("SELECT u.role AS role, COALESCE(SUM(c.amount),0) AS total, COUNT(c.id) AS credits FROM earnings_credits c JOIN users u ON u.id=c.user_id WHERE c.status='available' GROUP BY u.role").all();
    response.json(ok({ withdrawals, waiting: withdrawals.filter(item => ['queued', 'processing'].includes(item.status)).reduce((total, item) => total + item.amount, 0), balances, automaticPayouts: !!provider, currency: 'XAF' }));
  });

  /** Sends queued withdrawals to the payout provider and follows those in progress (run every minute). */
  async function processQueue() {
    if (!provider) return;
    const finish = (row, status, { reference = null, reason = null } = {}) => {
      const now = new Date().toISOString();
      store.db.exec('BEGIN IMMEDIATE');
      try {
        store.db.prepare('UPDATE earnings_withdrawals SET status=?, provider_reference=COALESCE(?,provider_reference), failure_reason=?, updated_at=? WHERE id=?').run(status, reference, reason, now, row.id);
        if (status === 'paid') store.db.prepare("UPDATE earnings_credits SET status='paid', paid_at=? WHERE withdrawal_id=?").run(now, row.id);
        if (status === 'failed') store.db.prepare("UPDATE earnings_credits SET status='available', withdrawal_id=NULL WHERE withdrawal_id=?").run(row.id);
        store.audit(row.user_id, status === 'paid' ? 'WITHDRAWAL_PAID' : status === 'failed' ? 'WITHDRAWAL_FAILED' : 'WITHDRAWAL_PROCESSING', { targetId: row.user_id, details: { amount: row.amount, reference, reason } });
        store.db.exec('COMMIT');
      } catch (error) { store.db.exec('ROLLBACK'); throw error; }
      if (status === 'paid') notify(store, row.user_id, 'HFA SilverStrong: Your withdrawal has been paid. Sign in to see the reference.');
      if (status === 'failed') notify(store, row.user_id, 'HFA SilverStrong: Your withdrawal could not be paid and the amount is back in your account. Sign in to see why.');
    };
    for (const row of store.db.prepare("SELECT * FROM earnings_withdrawals WHERE status IN ('queued','processing') ORDER BY requested_at LIMIT 20").all()) {
      try {
        store.db.prepare('UPDATE earnings_withdrawals SET attempts=attempts+1 WHERE id=?').run(row.id);
        const result = row.status === 'queued'
          ? await provider.send({ id: row.id, amount: row.amount, currency: 'XAF', method: row.method, destination: row.destination, name: nameOf(row.user_id) })
          : await provider.check({ id: row.id, reference: row.provider_reference });
        if (result?.status === 'paid') finish(row, 'paid', { reference: result.reference });
        else if (result?.status === 'failed') finish(row, 'failed', { reason: result.reason || 'refused by the payment service' });
        else if (row.status === 'queued') finish(row, 'processing', { reference: result?.reference });
      } catch (error) {
        if (error.permanent) finish(row, 'failed', { reason: String(error.message || 'refused by the payment service').slice(0, 200) });
        // Otherwise temporary: tried again on the next run.
      }
    }
  }
  return { processQueue, account };
}

module.exports = { installEarningsRoutes, credit, creditFor, syncConsultationCredits, ensureEarningsTables, MIN_WITHDRAWAL_CREDITS };
