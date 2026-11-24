// Offline-copy key escrow. Each account's on-device offline copy (offline-session.js) is encrypted with a random
// data key that the device stores only in wrapped form: once with a key derived from the password (for signing in
// without internet) and once with this per-account server secret (to resume a signed-in session without retyping
// the password). The secret never leaves the server except to the signed-in account holder.
//
// Rotating the secret makes every existing device copy impossible to unlock online, and the device erases it the
// next time it connects: used for "revoke offline access" (lost or stolen phone), password reset, password change
// and account deletion. Administrators "signed in as" someone cannot read it.
const { randomBytes } = require('node:crypto');

const envelope = data => ({ success: true, data, message: 'OK', timestamp: new Date().toISOString() });

function ensureColumn(store) {
  const columns = store.db.prepare('PRAGMA table_info(users)').all().map(column => column.name);
  if (!columns.includes('offline_key')) store.db.exec('ALTER TABLE users ADD COLUMN offline_key TEXT');
  if (!columns.includes('offline_revoked_at')) store.db.exec('ALTER TABLE users ADD COLUMN offline_revoked_at TEXT');
}

/** Invalidates every offline copy of this account on every device. */
function rotateOfflineKey(store, userId, { revoked = false } = {}) {
  ensureColumn(store);
  store.db.prepare('UPDATE users SET offline_key=NULL, offline_revoked_at=COALESCE(?, offline_revoked_at) WHERE id=?')
    .run(revoked ? new Date().toISOString() : null, userId);
}

function installOfflineKeyRoutes(app, store, authenticated, admin) {
  ensureColumn(store);

  app.get('/api/v1/me/offline-key', authenticated, (request, response) => {
    if (request.impersonator) return response.status(403).json({ error: 'Only the account holder can unlock their offline copy' });
    if (request.user.role === 'admin') return response.status(403).json({ error: 'Administrator data is never kept offline on a device' });
    let row = store.db.prepare('SELECT offline_key FROM users WHERE id=?').get(request.user.id);
    if (!row?.offline_key) {
      store.db.prepare('UPDATE users SET offline_key=? WHERE id=? AND offline_key IS NULL').run(randomBytes(32).toString('base64'), request.user.id);
      row = store.db.prepare('SELECT offline_key FROM users WHERE id=?').get(request.user.id);
    }
    response.json(envelope({ key: row.offline_key }));
  });

  app.post('/api/v1/admin/users/:id/revoke-offline', authenticated, admin, (request, response) => {
    const user = store.user(request.params.id);
    if (!user || user.role === 'admin') return response.sendStatus(404);
    rotateOfflineKey(store, user.id, { revoked: true });
    store.audit(request.user.id, 'OFFLINE_ACCESS_REVOKED', { targetId: user.id, details: { role: user.role }, ip: request.ip });
    response.json(envelope({ revoked: true }));
  });
}

module.exports = { installOfflineKeyRoutes, rotateOfflineKey };
