const { DatabaseSync } = require('node:sqlite');
const { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const { mkdirSync, chmodSync } = require('node:fs');
const { dirname } = require('node:path');

const deriveKey = promisify(scrypt);
const digest = value => createHash('sha256').update(value).digest('hex');

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password, salt, 64, { N: 65536, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  return `${salt}:${key.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [salt, expected] = stored.split(':');
  const key = await deriveKey(password, salt, 64, { N: 65536, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  const expectedKey = Buffer.from(expected, 'hex');
  return expectedKey.length === key.length && timingSafeEqual(expectedKey, key);
}

class Store {
  constructor(path = ':memory:') {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    if (path !== ':memory:') chmodSync(path, 0o600);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
        name TEXT NOT NULL, role TEXT NOT NULL, status TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '', whatsapp_number TEXT NOT NULL DEFAULT '',
        whatsapp_consent INTEGER NOT NULL DEFAULT 0, whatsapp_verified_at TEXT,
        assigned_doctor TEXT, assigned_nurse TEXT, profile TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, patient_id TEXT NOT NULL,
        request_key TEXT NOT NULL UNIQUE, fingerprint TEXT NOT NULL, resource TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, message TEXT NOT NULL, resource TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS deliveries (
        id TEXT PRIMARY KEY, activity_id TEXT NOT NULL UNIQUE, patient_id TEXT NOT NULL,
        status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0,
        provider_id TEXT UNIQUE, error_code TEXT, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS verifications (
        token_hash TEXT PRIMARY KEY, patient_id TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS webhook_events (id TEXT PRIMARY KEY, created_at TEXT NOT NULL);
    `);
    if (!this.db.prepare('PRAGMA table_info(users)').all().some(column=>column.name==='whatsapp_consent_at')) this.db.exec('ALTER TABLE users ADD COLUMN whatsapp_consent_at TEXT');
    if (!this.db.prepare('PRAGMA table_info(deliveries)').all().some(column=>column.name==='recipient_phone')) this.db.exec('ALTER TABLE deliveries ADD COLUMN recipient_phone TEXT');
    this.db.prepare("UPDATE deliveries SET status='delivery_unknown' WHERE status='sending'").run();
  }

  user(id) {
    const row = this.db.prepare('SELECT * FROM users WHERE id=?').get(id);
    if (!row) return null;
    return {
      ...JSON.parse(row.profile), id: row.id, email: row.email, name: row.name, role: row.role,
      status: row.status, phone: row.phone, whatsappNumber: row.whatsapp_number,
      whatsappNotificationsConsent: !!row.whatsapp_consent, whatsappVerifiedAt: row.whatsapp_verified_at,
      whatsappConsentAt: row.whatsapp_consent_at,
      assignedDoctor: row.assigned_doctor, assignedNurse: row.assigned_nurse,
      createdAt: row.created_at, hfaId: `HFA-${row.role.slice(0, 3).toUpperCase()}-${row.id.slice(-8)}`,
      ...(row.role === 'admin' ? { adminRole: 'Super Admin', permissions: ['all'] } : {})
    };
  }

  credentials(email) {
    return this.db.prepare('SELECT id,password_hash FROM users WHERE email=?').get(email.toLowerCase());
  }

  createUser(input, passwordHash, status) {
    const id = `${input.role.slice(0, 3)}-${randomUUID()}`;
    this.db.prepare(`INSERT INTO users
      (id,email,password_hash,name,role,status,phone,whatsapp_number,whatsapp_consent,profile,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(id, input.email.toLowerCase(), passwordHash, input.name, input.role,
      status, input.phone || '', input.whatsappNumber || '', input.whatsappNotificationsConsent ? 1 : 0,
      JSON.stringify(input.profile || {}), new Date().toISOString());
    if (input.whatsappNotificationsConsent) this.db.prepare('UPDATE users SET whatsapp_consent_at=? WHERE id=?').run(new Date().toISOString(),id);
    return this.user(id);
  }

  visibleUsers(actor) {
    return this.db.prepare('SELECT id FROM users WHERE status!=?').all('deleted')
      .map(row => this.user(row.id)).filter(user => actor.role === 'admin' || user.id === actor.id ||
        (user.role === 'patient' && (user.assignedDoctor === actor.id || user.assignedNurse === actor.id)) ||
        (user.status === 'active' && ['doctor', 'nurse', 'labtech'].includes(user.role)));
  }

  createSession(userId) {
    const token = randomBytes(32).toString('hex');
    this.db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(digest(token), userId, Date.now() + 8 * 3600000);
    return token;
  }

  session(token) {
    if (!token) return null;
    const row = this.db.prepare('SELECT user_id FROM sessions WHERE token_hash=? AND expires_at>?').get(digest(token), Date.now());
    const user = row && this.user(row.user_id);
    return user?.status === 'active' ? user : null;
  }

  logout(token) {
    if (token) this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token));
  }

  updateUser(id, patch) {
    const user = this.user(id);
    this.db.prepare(`UPDATE users SET name=?,phone=?,status=?,assigned_doctor=?,assigned_nurse=?,profile=? WHERE id=?`)
      .run(patch.name ?? user.name, patch.phone ?? user.phone, patch.status ?? user.status,
        patch.assignedDoctor === undefined ? user.assignedDoctor : patch.assignedDoctor,
        patch.assignedNurse === undefined ? user.assignedNurse : patch.assignedNurse,
        JSON.stringify({ ...JSON.parse(this.db.prepare('SELECT profile FROM users WHERE id=?').get(id).profile), ...patch.profile }), id);
    return this.user(id);
  }

  canNotify(actor, patient) {
    return patient?.role === 'patient' && patient.status !== 'deleted' &&
      (actor.role === 'admin' || actor.id === patient.id ||
        (actor.role === 'doctor' && patient.assignedDoctor === actor.id) ||
        (actor.role === 'nurse' && patient.assignedNurse === actor.id));
  }

  activity(actor, input, configured, message) {
    const key = `${actor.id}:${input.eventId}`;
    const fingerprint = digest(JSON.stringify([input.patientId, input.resource]));
    const prior = this.db.prepare('SELECT id,fingerprint FROM activities WHERE request_key=?').get(key);
    if (prior) {
      if (prior.fingerprint !== fingerprint) throw new Error('Idempotency conflict');
      return this.db.prepare('SELECT id,status FROM deliveries WHERE activity_id=?').get(prior.id);
    }
    const patient = this.user(input.patientId);
    if (!this.canNotify(actor, patient)) throw new Error('Forbidden recipient');
    const id = randomUUID(), jobId = randomUUID(), now = new Date().toISOString();
    const status = !patient.whatsappNotificationsConsent ? 'blocked_consent' : !patient.whatsappVerifiedAt ?
      'blocked_verification' : !configured ? 'blocked_configuration' : 'queued';
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT INTO activities VALUES (?,?,?,?,?,?,?)').run(id, actor.id, patient.id, key, fingerprint, input.resource, now);
      this.db.prepare('INSERT INTO notifications VALUES (?,?,?,?,?)').run(id, patient.id, message, input.resource, now);
      this.db.prepare('INSERT INTO deliveries (id,activity_id,patient_id,status,updated_at) VALUES (?,?,?,?,?)').run(jobId, id, patient.id, status, now);
      this.db.exec('COMMIT');
      return { id: jobId, status };
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  notifications(userId) {
    return this.db.prepare('SELECT id,user_id AS userId,message,resource,created_at AS createdAt FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(userId);
  }

  close() { this.db.close(); }
}

module.exports = { Store, digest, hashPassword, verifyPassword };