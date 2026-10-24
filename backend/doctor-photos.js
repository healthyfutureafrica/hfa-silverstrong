// Doctor portraits shown to patients only after an administrator approves them. The doctor submits a photo; it is
// re-encoded (which also removes location data), encrypted, and waits for review. A pending or rejected
// replacement never replaces an approved photo. Every decision is audited.
const { z } = require('zod');
const express = require('express');
const sharp = require('sharp');
const { seal, unseal } = require('./records');
const { fileMime, filesConfigured } = require('./files');

const MAX_BYTES = 2 * 1024 * 1024, OUTPUT = 480;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function installDoctorPhotoRoutes(app, config, store, authenticated, admin) {
  store.db.exec(`CREATE TABLE IF NOT EXISTS doctor_photos (
    user_id TEXT NOT NULL REFERENCES users(id), kind TEXT NOT NULL, nonce BLOB NOT NULL, encrypted BLOB NOT NULL, tag BLOB NOT NULL,
    created_at TEXT NOT NULL, PRIMARY KEY(user_id, kind)
  )`);
  const storage = (request, response, next) => filesConfigured(config) ? next() : response.status(503).json({ error: 'Encrypted storage is not configured' });
  const context = (userId, kind) => `doctor-photo:${userId}:${kind}`;
  const image = (userId, kind) => {
    const row = store.db.prepare('SELECT * FROM doctor_photos WHERE user_id=? AND kind=?').get(userId, kind);
    return row && unseal(config, context(userId, kind), row);
  };
  const ok = (data, message = 'OK') => ({ success: true, data, message, timestamp: new Date().toISOString() });

  app.post('/api/v1/doctor-photo', authenticated, storage, express.json({ limit: '4mb' }), async (request, response) => {
    if (request.user.role !== 'doctor' || request.impersonator) return response.status(403).json({ error: 'Only doctors submit a portrait' });
    const { content } = z.object({ content: z.string().min(4).max(Math.ceil(MAX_BYTES / 3) * 4 + 4).regex(/^[A-Za-z0-9+/]+={0,2}$/) }).strict().parse(request.body);
    const bytes = Buffer.from(content, 'base64');
    if (!bytes.length || bytes.length > MAX_BYTES || !TYPES.includes(fileMime(bytes))) return response.status(400).json({ error: 'Use a JPG, PNG or WebP photo up to 2 MB' });
    let output;
    try { output = await sharp(bytes, { limitInputPixels: 40000000 }).rotate().resize(OUTPUT, OUTPUT, { fit: 'cover', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(); }
    catch (error) { return response.status(422).json({ error: 'The photo could not be read' }); }
    const sealed = seal(config, context(request.user.id, 'pending'), output), now = new Date().toISOString();
    store.db.prepare("INSERT INTO doctor_photos VALUES (?,'pending',?,?,?,?) ON CONFLICT(user_id,kind) DO UPDATE SET nonce=excluded.nonce,encrypted=excluded.encrypted,tag=excluded.tag,created_at=excluded.created_at")
      .run(request.user.id, sealed.nonce, sealed.encrypted, sealed.tag, now);
    store.updateUser(request.user.id, { profile: { doctorPhotoStatus: 'pending', doctorPhotoSubmittedAt: now } });
    store.audit(request.user.id, 'DOCTOR_PHOTO_SUBMITTED', { targetId: request.user.id, ip: request.ip });
    response.status(201).json(ok({ user: store.user(request.user.id) }, 'Sent for review'));
  });

  // Approved portrait, for anyone who can see this doctor.
  app.get('/api/v1/users/:id/doctor-photo', authenticated, storage, (request, response) => {
    const doctor = store.user(request.params.id);
    const visible = doctor?.role === 'doctor' && (doctor.id === request.user.id || store.visibleUsers(request.user).some(user => user.id === doctor.id));
    const bytes = visible && image(doctor.id, 'approved');
    if (!bytes) return response.sendStatus(404);
    response.set('Cache-Control', 'private, max-age=86400').set('X-Content-Type-Options', 'nosniff').type('image/webp').send(bytes);
  });

  app.get('/api/v1/admin/doctor-photos/:id', authenticated, admin, storage, (request, response) => {
    const bytes = image(request.params.id, 'pending');
    if (!bytes) return response.sendStatus(404);
    response.set('Cache-Control', 'no-store').set('X-Content-Type-Options', 'nosniff').type('image/webp').send(bytes);
  });

  app.post('/api/v1/admin/doctor-photos/:id', authenticated, admin, storage, (request, response) => {
    const { approve } = z.object({ approve: z.boolean() }).strict().parse(request.body);
    const doctor = store.user(request.params.id);
    const pending = doctor?.role === 'doctor' && store.db.prepare("SELECT * FROM doctor_photos WHERE user_id=? AND kind='pending'").get(doctor.id);
    if (!pending) return response.sendStatus(404);
    const now = new Date().toISOString();
    store.db.exec('BEGIN IMMEDIATE');
    try {
      if (approve) {
        const sealed = seal(config, context(doctor.id, 'approved'), unseal(config, context(doctor.id, 'pending'), pending));
        store.db.prepare("INSERT INTO doctor_photos VALUES (?,'approved',?,?,?,?) ON CONFLICT(user_id,kind) DO UPDATE SET nonce=excluded.nonce,encrypted=excluded.encrypted,tag=excluded.tag,created_at=excluded.created_at")
          .run(doctor.id, sealed.nonce, sealed.encrypted, sealed.tag, now);
      }
      store.db.prepare("DELETE FROM doctor_photos WHERE user_id=? AND kind='pending'").run(doctor.id);
      store.updateUser(doctor.id, { profile: { doctorPhotoStatus: approve ? 'approved' : 'rejected', ...(approve ? { doctorPhotoApprovedAt: now } : {}), doctorPhotoReviewedBy: request.user.id } });
      store.audit(request.user.id, approve ? 'DOCTOR_PHOTO_APPROVED' : 'DOCTOR_PHOTO_REJECTED', { targetId: doctor.id, ip: request.ip });
      store.db.exec('COMMIT');
    } catch (error) { store.db.exec('ROLLBACK'); throw error; }
    response.json(ok({ user: store.user(doctor.id) }, approve ? 'Approved' : 'Rejected'));
  });
}

module.exports = { installDoctorPhotoRoutes };
