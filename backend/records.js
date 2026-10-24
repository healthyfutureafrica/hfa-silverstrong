const { randomBytes, randomUUID, createCipheriv, createDecipheriv } = require('node:crypto');
const Busboy = require('busboy');
const sharp = require('sharp');
const { fileMime, filesConfigured } = require('./files');

// Profile pictures: the client crops and compresses; the server never trusts that and re-validates,
// re-encodes to WebP (which also strips EXIF data such as GPS position) and encrypts at rest.
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const AVATAR_MIN_DIMENSION = 200;
const AVATAR_OUTPUT = 800;
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function ensureRecordTables(store) {
  store.db.exec(`
    CREATE TABLE IF NOT EXISTS patient_records (
      user_id TEXT PRIMARY KEY REFERENCES users(id), nonce BLOB NOT NULL, encrypted BLOB NOT NULL,
      tag BLOB NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS avatars (
      user_id TEXT PRIMARY KEY REFERENCES users(id), avatar_key TEXT NOT NULL, nonce BLOB NOT NULL,
      encrypted BLOB NOT NULL, tag BLOB NOT NULL, size INTEGER NOT NULL, created_at TEXT NOT NULL
    );
  `);
}

// AES-256-GCM with the row identity as additional data, so a ciphertext cannot be moved to another user.
function seal(config, context, bytes) {
  const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', Buffer.from(config.fileEncryptionKey, 'hex'), nonce);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return { nonce, encrypted, tag: cipher.getAuthTag() };
}

function unseal(config, context, row) {
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(config.fileEncryptionKey, 'hex'), row.nonce);
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(row.tag);
  return Buffer.concat([decipher.update(row.encrypted), decipher.final()]);
}

function saveHealthRecord(config, store, userId, record) {
  const sealed = seal(config, `patient-record:${userId}`, Buffer.from(JSON.stringify(record)));
  store.db.prepare('INSERT INTO patient_records VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET nonce=excluded.nonce,encrypted=excluded.encrypted,tag=excluded.tag,updated_at=excluded.updated_at')
    .run(userId, sealed.nonce, sealed.encrypted, sealed.tag, new Date().toISOString());
}

function healthRecord(config, store, userId) {
  if (!filesConfigured(config)) return null;
  const row = store.db.prepare('SELECT * FROM patient_records WHERE user_id=?').get(userId);
  return row ? JSON.parse(unseal(config, `patient-record:${userId}`, row).toString()) : null;
}

// Health data goes only to the patient and to the clinicians assigned to them — never to other users.
function canReadHealth(actor, patient) {
  return patient.role === 'patient' && (actor.id === patient.id || patient.assignedDoctor === actor.id || patient.assignedNurse === actor.id);
}

// Every time a health profile is sent to someone other than the patient, the patient can see it in
// "Who accessed my record" (one entry an hour per viewer, so page reloads do not flood the log).
const RECORD_VIEW_DEDUPE_MS = 60 * 60 * 1000;
function recordHealthView(store, actor, patient) {
  if (actor.id === patient.id) return;
  const since = new Date(Date.now() - RECORD_VIEW_DEDUPE_MS).toISOString();
  const recent = store.db.prepare("SELECT 1 FROM audit_log WHERE actor_id=? AND target_id=? AND action='HEALTH_RECORD_VIEW' AND created_at>? LIMIT 1").get(actor.id, patient.id, since);
  if (!recent) store.audit(actor.id, 'HEALTH_RECORD_VIEW', { targetId: patient.id, details: { role: actor.role } });
}

function withHealth(config, store, actor, users) {
  return users.map(user => {
    if (!canReadHealth(actor, user)) return user;
    const record = healthRecord(config, store, user.id);
    if (!record) return user;
    recordHealthView(store, actor, user);
    return { ...user, healthProfile: record };
  });
}

const envelope = (data, message) => ({ success: true, data, message, timestamp: new Date().toISOString() });
const failure = (response, status, message) => response.status(status).json({ success: false, data: null, message, error: message, timestamp: new Date().toISOString() });

function readAvatarUpload(request) {
  return new Promise((resolve, reject) => {
    let busboy;
    try { busboy = Busboy({ headers: request.headers, limits: { files: 1, fileSize: AVATAR_MAX_BYTES, fields: 0, parts: 1 } }); }
    catch (error) { reject(Object.assign(new Error('Send the photo as multipart/form-data'), { status: 400 })); return; }
    let result = null, tooLarge = false;
    busboy.on('file', (field, stream) => {
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('limit', () => { tooLarge = true; });
      stream.on('end', () => { if (field === 'avatar') result = Buffer.concat(chunks); });
    });
    busboy.on('error', () => reject(Object.assign(new Error('The upload could not be read'), { status: 400 })));
    busboy.on('close', () => {
      if (tooLarge) reject(Object.assign(new Error('The photo is larger than 5 MB'), { status: 413 }));
      else if (!result || !result.length) reject(Object.assign(new Error('Attach the photo in the "avatar" field'), { status: 400 }));
      else resolve(result);
    });
    request.pipe(busboy);
  });
}

// Green circle with a white initial, used whenever a user has no photo.
function placeholderSvg(name) {
  const initial = (String(name || '?').trim()[0] || '?').toUpperCase().replace(/[<>&"']/g, '?');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" rx="128" fill="#006B3F"/><text x="128" y="128" dy=".35em" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="112" font-weight="600" fill="#FFFFFF">${initial}</text></svg>`;
}

function installAvatarRoutes(app, config, store, authenticated) {
  ensureRecordTables(store);
  const ownAccount = (request, response, next) => request.params.id === request.user.id ? next() : failure(response, 403, 'You can only change your own profile picture');
  const storage = (request, response, next) => filesConfigured(config) ? next() : failure(response, 503, 'Encrypted storage is not configured');

  app.post('/api/v1/users/:id/avatar', authenticated, ownAccount, storage, async (request, response) => {
    let bytes;
    try { bytes = await readAvatarUpload(request); }
    catch (error) { return failure(response, error.status || 400, error.message); }
    const mime = fileMime(bytes);
    if (!AVATAR_TYPES.includes(mime)) return failure(response, 415, 'Only JPG, PNG or WebP photos are accepted');
    let output;
    try {
      const image = sharp(bytes, { limitInputPixels: 40000000 }).rotate();
      const { width, height } = await image.metadata();
      if (!width || !height || width < AVATAR_MIN_DIMENSION || height < AVATAR_MIN_DIMENSION) return failure(response, 422, `The photo must be at least ${AVATAR_MIN_DIMENSION}×${AVATAR_MIN_DIMENSION} pixels`);
      output = await image.resize(AVATAR_OUTPUT, AVATAR_OUTPUT, { fit: 'cover', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    } catch (error) { return failure(response, 422, 'The photo could not be read'); }
    const userId = request.user.id, key = `avatars/${userId}/${randomUUID()}.webp`, createdAt = new Date().toISOString();
    const sealed = seal(config, `avatar:${userId}:${key}`, output);
    store.db.exec('BEGIN IMMEDIATE');
    try {
      // One row per user: the previous photo is deleted in the same transaction.
      store.db.prepare('INSERT INTO avatars VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET avatar_key=excluded.avatar_key,nonce=excluded.nonce,encrypted=excluded.encrypted,tag=excluded.tag,size=excluded.size,created_at=excluded.created_at')
        .run(userId, key, sealed.nonce, sealed.encrypted, sealed.tag, output.length, createdAt);
      store.updateUser(userId, { profile: { avatarKey: key, avatarUploadedAt: createdAt } });
      store.db.exec('COMMIT');
    } catch (error) { store.db.exec('ROLLBACK'); throw error; }
    const user = store.user(userId);
    response.status(201).json(envelope({ avatarUrl: user.avatarUrl, user }, 'Profile picture updated'));
  });

  app.get('/api/v1/users/:id/avatar', authenticated, (request, response) => {
    const target = store.user(request.params.id);
    const visible = target && target.status !== 'deleted' && (target.id === request.user.id || store.visibleUsers(request.user).some(user => user.id === target.id));
    if (!visible) return response.sendStatus(404);
    const row = filesConfigured(config) && store.db.prepare('SELECT * FROM avatars WHERE user_id=?').get(target.id);
    response.set('Cache-Control', 'private, max-age=86400');
    response.set('X-Content-Type-Options', 'nosniff');
    if (!row) return response.type('image/svg+xml').send(placeholderSvg(target.name));
    response.type('image/webp').send(unseal(config, `avatar:${target.id}:${row.avatar_key}`, row));
  });

  app.delete('/api/v1/users/:id/avatar', authenticated, ownAccount, (request, response) => {
    store.db.exec('BEGIN IMMEDIATE');
    try {
      store.db.prepare('DELETE FROM avatars WHERE user_id=?').run(request.user.id);
      store.updateUser(request.user.id, { profile: { avatarKey: null, avatarUploadedAt: null } });
      store.db.exec('COMMIT');
    } catch (error) { store.db.exec('ROLLBACK'); throw error; }
    response.json(envelope({ avatarUrl: null, user: store.user(request.user.id) }, 'Profile picture removed'));
  });
}

module.exports = { seal, unseal, installAvatarRoutes, ensureRecordTables, saveHealthRecord, healthRecord, withHealth, canReadHealth, recordHealthView, placeholderSvg, AVATAR_MIN_DIMENSION };
