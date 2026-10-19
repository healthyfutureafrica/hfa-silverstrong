const { DatabaseSync } = require('node:sqlite');
const { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const { mkdirSync, chmodSync } = require('node:fs');
const { dirname, join } = require('node:path');
// Shared with the site so both always produce the same number format.
const Numbering = require(join(__dirname, '..', 'hfa-numbering.js'));

const deriveKey = promisify(scrypt);
const digest = value => createHash('sha256').update(value).digest('hex');
// Sessions outlive a 7-day offline period so queued work can sync without signing in again.
const SESSION_TTL = 7 * 86400000;
// Patients may register without an email (many rural patients have none). The NOT NULL UNIQUE email
// column then holds a reserved, undeliverable address derived from the phone; it is never shown.
const PHONE_EMAIL_DOMAIN = '@phone.hfa.invalid';
const phoneEmail = phone => `${String(phone).replace(/[^0-9]/g, '')}${PHONE_EMAIL_DOMAIN}`;
const normalizePhone = value => String(value || '').replace(/[\s()-]/g, '');

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
    // Stakeholder numbering: hospitals register, town codes, one counter per portal + hospital / region + town.
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS facilities (
        id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, name_key TEXT NOT NULL, code TEXT NOT NULL, created_at TEXT NOT NULL,
        UNIQUE(kind, name_key), UNIQUE(kind, code)
      );
      CREATE TABLE IF NOT EXISTS places (
        region TEXT NOT NULL, town_key TEXT NOT NULL, town TEXT NOT NULL, code TEXT NOT NULL, PRIMARY KEY(region, town_key), UNIQUE(region, code)
      );
      CREATE TABLE IF NOT EXISTS hfa_sequences (scope TEXT PRIMARY KEY, last INTEGER NOT NULL);
    `);
    const columns = this.db.prepare('PRAGMA table_info(users)').all().map(column => column.name);
    if (!columns.includes('hfa_number')) this.db.exec('ALTER TABLE users ADD COLUMN hfa_number TEXT');
    if (!columns.includes('facility_id')) this.db.exec('ALTER TABLE users ADD COLUMN facility_id TEXT REFERENCES facilities(id)');
    this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_hfa_number ON users(hfa_number) WHERE hfa_number IS NOT NULL');
    // Super Admin "sign in as": the session records who is acting on the account.
    if (!this.db.prepare('PRAGMA table_info(sessions)').all().some(column => column.name === 'impersonator_id')) this.db.exec('ALTER TABLE sessions ADD COLUMN impersonator_id TEXT');
    // Permanent server-side audit log for administrator access (portal previews, sign in as).
    this.db.exec(`CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL, target_id TEXT, details TEXT NOT NULL DEFAULT '{}',
      ip TEXT, created_at TEXT NOT NULL
    )`);
    this.db.exec('CREATE INDEX IF NOT EXISTS users_facility ON users(facility_id)');
    this.backfillNumbers();
  }

  // ───── Facilities and stakeholder numbers ─────

  /** Finds or registers a hospital by name ("Hôpital Général de Douala" = "Hopital General Douala"). */
  hospital(name) {
    const key = Numbering.nameKey(name);
    if (!key) return null;
    const existing = this.db.prepare("SELECT * FROM facilities WHERE kind='hospital' AND name_key=?").get(key);
    if (existing) return existing;
    const taken = this.db.prepare("SELECT code FROM facilities WHERE kind='hospital'").all().map(row => row.code);
    const row = { id: `fac-${randomUUID()}`, kind: 'hospital', name: String(name).trim().slice(0, 200), name_key: key, code: Numbering.facilityCode(name, taken), created_at: new Date().toISOString() };
    this.db.prepare('INSERT INTO facilities (id,kind,name,name_key,code,created_at) VALUES (?,?,?,?,?,?)').run(row.id, row.kind, row.name, row.name_key, row.code, row.created_at);
    return row;
  }

  facility(id) { return id ? this.db.prepare('SELECT * FROM facilities WHERE id=?').get(id) || null : null; }

  /** Hospitals patients can register under: those with at least one active doctor or nurse. */
  listedHospitals() {
    return this.db.prepare(`SELECT f.id, f.name, f.code FROM facilities f WHERE f.kind='hospital'
      AND EXISTS (SELECT 1 FROM users u WHERE u.facility_id=f.id AND u.role IN ('doctor','nurse') AND u.status='active') ORDER BY f.name`).all();
  }

  /** Stable 3-letter code for a town within a region (DLA, YDE, … or generated). */
  townCode(region, town) {
    const key = Numbering.nameKey(town);
    if (!region || !key) return Numbering.UNKNOWN_TOWN;
    const existing = this.db.prepare('SELECT code FROM places WHERE region=? AND town_key=?').get(region, key);
    if (existing) return existing.code;
    const taken = this.db.prepare('SELECT code FROM places WHERE region=?').all(region).map(row => row.code);
    const code = Numbering.townCode(town, taken);
    this.db.prepare('INSERT INTO places VALUES (?,?,?,?)').run(region, key, String(town).trim().slice(0, 120), code);
    return code;
  }

  /** Issues the user's number once; it never changes afterwards (it is printed and shared). */
  assignNumber(id) {
    const row = this.db.prepare('SELECT id,role,profile,hfa_number,facility_id,assigned_doctor FROM users WHERE id=?').get(id);
    if (!row || row.hfa_number) return row?.hfa_number;
    const profile = JSON.parse(row.profile);
    let facilityId = row.facility_id, parts = {};
    if (row.role === 'doctor' || row.role === 'nurse') {
      const hospital = this.hospital(profile.hospital);
      facilityId = hospital?.id || null;
      parts.facilityCode = hospital?.code;
    } else if (row.role === 'patient') {
      // Registered under the chosen hospital; older accounts take their assigned doctor's hospital.
      if (!facilityId && row.assigned_doctor) facilityId = this.db.prepare('SELECT facility_id FROM users WHERE id=?').get(row.assigned_doctor)?.facility_id || null;
      parts.facilityCode = this.facility(facilityId)?.code;
    } else if (row.role === 'pharmacist' || row.role === 'labtech') {
      const { region, town } = Numbering.locationOf(profile);
      parts.regionCode = Numbering.REGIONS[region];
      parts.townCode = region && town ? this.townCode(region, town) : undefined;
    }
    const scope = Numbering.scope(row.role, parts);
    const { last } = this.db.prepare('INSERT INTO hfa_sequences (scope,last) VALUES (?,1) ON CONFLICT(scope) DO UPDATE SET last=last+1 RETURNING last').get(scope);
    const number = Numbering.format(scope, last);
    this.db.prepare('UPDATE users SET hfa_number=?, facility_id=? WHERE id=?').run(number, facilityId, id);
    return number;
  }

  // Accounts created before numbering get theirs at startup: clinicians first, so their hospitals exist for patients.
  backfillNumbers() {
    const pending = this.db.prepare(`SELECT id FROM users WHERE hfa_number IS NULL
      ORDER BY CASE role WHEN 'doctor' THEN 0 WHEN 'nurse' THEN 0 ELSE 1 END, created_at, id`).all();
    for (const { id } of pending) this.assignNumber(id);
  }

  /** Changes the hospital a patient is registered under. The number stays the same. */
  setPatientFacility(userId, facilityId) {
    this.db.prepare("UPDATE users SET facility_id=? WHERE id=? AND role='patient'").run(facilityId, userId);
  }

  /** Patients registered under a hospital — names and numbers only, no health data. */
  facilityPatients(facilityId) {
    return this.db.prepare("SELECT id,name,hfa_number AS hfaId,status,created_at AS createdAt FROM users WHERE facility_id=? AND role='patient' AND status!='deleted' ORDER BY hfa_number").all(facilityId);
  }

  /** Register of every hospital and every pharmacy/laboratory location, with counts (administrators). */
  facilityRegister() {
    const hospitals = this.db.prepare(`SELECT f.id, f.name, f.code, f.created_at AS createdAt,
        SUM(u.role='doctor') AS doctors, SUM(u.role='nurse') AS nurses, SUM(u.role='patient') AS patients
      FROM facilities f LEFT JOIN users u ON u.facility_id=f.id AND u.status!='deleted' WHERE f.kind='hospital' GROUP BY f.id ORDER BY f.code`).all()
      .map(row => ({ ...row, doctors: row.doctors || 0, nurses: row.nurses || 0, patients: row.patients || 0 }));
    const places = new Map(this.db.prepare('SELECT region,code,town FROM places').all().map(row => [`${Numbering.REGIONS[row.region]}-${row.code}`, { region: row.region, town: row.town }]));
    const locations = new Map();
    for (const row of this.db.prepare("SELECT role,hfa_number FROM users WHERE role IN ('pharmacist','labtech') AND status!='deleted'").all()) {
      const parsed = Numbering.parse(row.hfa_number);
      if (!parsed) continue;
      const key = `${parsed.regionCode}-${parsed.townCode}`;
      const entry = locations.get(key) || { code: key, ...(places.get(key) || { region: null, town: null }), pharmacies: 0, laboratories: 0 };
      if (row.role === 'pharmacist') entry.pharmacies++; else entry.laboratories++;
      locations.set(key, entry);
    }
    const unregistered = this.db.prepare("SELECT COUNT(*) AS total FROM users WHERE role='patient' AND facility_id IS NULL AND status!='deleted'").get().total;
    return { hospitals, locations: [...locations.values()].sort((a, b) => a.code.localeCompare(b.code)), patientsWithoutHospital: unregistered };
  }

  user(id) {
    const row = this.db.prepare('SELECT * FROM users WHERE id=?').get(id);
    if (!row) return null;
    const profile = JSON.parse(row.profile);
    return {
      ...profile, id: row.id, email: row.email.endsWith(PHONE_EMAIL_DOMAIN) ? '' : row.email,
      avatarUrl: profile.avatarKey ? `/api/v1/users/${encodeURIComponent(row.id)}/avatar?v=${encodeURIComponent(profile.avatarUploadedAt || '')}` : null, name: row.name, role: row.role,
      status: row.status, phone: row.phone, whatsappNumber: row.whatsapp_number,
      whatsappNotificationsConsent: !!row.whatsapp_consent, whatsappVerifiedAt: row.whatsapp_verified_at,
      whatsappConsentAt: row.whatsapp_consent_at,
      assignedDoctor: row.assigned_doctor, assignedNurse: row.assigned_nurse,
      createdAt: row.created_at, hfaId: row.hfa_number || `HFA-${row.role.slice(0, 3).toUpperCase()}-${row.id.slice(-8)}`,
      facilityId: row.facility_id || null, ...this.facilityFields(row.facility_id),
      ...(row.role === 'admin' ? { adminRole: 'Super Admin', permissions: ['all'] } : {})
    };
  }

  facilityFields(facilityId) {
    const facility = this.facility(facilityId);
    return facility ? { facilityName: facility.name, facilityCode: facility.code } : { facilityName: null, facilityCode: null };
  }

  credentials(email) {
    return this.db.prepare('SELECT id,password_hash FROM users WHERE email=?').get(email.toLowerCase());
  }

  // Sign-in by primary phone number (E.164, e.g. +237677123456), ignoring spaces and dashes stored earlier.
  credentialsByPhone(phone) {
    const number = normalizePhone(phone);
    if (!/^\+[1-9]\d{7,14}$/.test(number)) return undefined;
    return this.db.prepare("SELECT id,password_hash FROM users WHERE status!='deleted' AND REPLACE(REPLACE(REPLACE(REPLACE(phone,' ',''),'-',''),'(',''),')','')=? ORDER BY created_at LIMIT 1").get(number);
  }

  createUser(input, passwordHash, status) {
    const id = `${input.role.slice(0, 3)}-${randomUUID()}`;
    this.db.prepare(`INSERT INTO users
      (id,email,password_hash,name,role,status,phone,whatsapp_number,whatsapp_consent,profile,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(id, (input.email || phoneEmail(input.phone)).toLowerCase(), passwordHash, input.name, input.role,
      status, input.phone || '', input.whatsappNumber || '', input.whatsappNotificationsConsent ? 1 : 0,
      JSON.stringify(input.profile || {}), new Date().toISOString());
    if (input.whatsappNotificationsConsent) this.db.prepare('UPDATE users SET whatsapp_consent_at=? WHERE id=?').run(new Date().toISOString(),id);
    if (input.role === 'patient' && input.facilityId) this.db.prepare('UPDATE users SET facility_id=? WHERE id=?').run(input.facilityId, id);
    this.assignNumber(id);
    return this.user(id);
  }

  visibleUsers(actor) {
    return this.db.prepare('SELECT id FROM users WHERE status!=?').all('deleted')
      .map(row => this.user(row.id)).filter(user => actor.role === 'admin' || user.id === actor.id ||
        (user.role === 'patient' && (user.assignedDoctor === actor.id || user.assignedNurse === actor.id)) ||
        (user.status === 'active' && ['doctor', 'nurse', 'labtech'].includes(user.role)));
  }

  createSession(userId, { impersonatorId = null, ttl = SESSION_TTL } = {}) {
    const token = randomBytes(32).toString('hex');
    this.db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at,impersonator_id) VALUES (?,?,?,?)').run(digest(token), userId, Date.now() + ttl, impersonatorId);
    return token;
  }

  /** The signed-in user plus, during "sign in as", the administrator acting on the account. */
  sessionDetails(token) {
    if (!token) return null;
    const row = this.db.prepare('SELECT user_id,impersonator_id FROM sessions WHERE token_hash=? AND expires_at>?').get(digest(token), Date.now());
    const user = row && this.user(row.user_id);
    if (user?.status !== 'active') return null;
    const impersonator = row.impersonator_id ? this.user(row.impersonator_id) : null;
    if (row.impersonator_id && (impersonator?.role !== 'admin' || impersonator.status !== 'active')) return null;
    return { user, impersonator };
  }

  audit(actorId, action, { targetId = null, details = {}, ip = null } = {}) {
    this.db.prepare('INSERT INTO audit_log VALUES (?,?,?,?,?,?,?)').run(randomUUID(), actorId, action, targetId, JSON.stringify(details), ip, new Date().toISOString());
  }

  auditLog(limit = 200) {
    return this.db.prepare(`SELECT a.id, a.action, a.target_id AS targetId, a.details, a.ip, a.created_at AS createdAt, actor.name AS actorName, target.name AS targetName, target.role AS targetRole
      FROM audit_log a LEFT JOIN users actor ON actor.id=a.actor_id LEFT JOIN users target ON target.id=a.target_id ORDER BY a.created_at DESC LIMIT ?`).all(limit)
      .map(row => ({ ...row, details: JSON.parse(row.details) }));
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

module.exports = { Store, digest, hashPassword, verifyPassword, SESSION_TTL, normalizePhone, phoneEmail };