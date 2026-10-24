// Forgotten passwords, without email or SMS costs: the person calls or visits their clinic, an administrator
// checks who they are (CNI, phone number on file) and creates a one-time reset code; the person enters it with a
// new password on the sign-in screen. Codes are stored only as a hash, expire after 30 minutes, allow 5 attempts,
// and every step is audited. Resetting signs the account out everywhere.
const { randomInt } = require('node:crypto');
const { z } = require('zod');
const { hashPassword, digest } = require('./store');

const CODE_MS = 30 * 60000, MAX_ATTEMPTS = 5;
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L: easy to read over the phone
const newCode = () => Array.from({ length: 8 }, (_, index) => (index === 4 ? '-' : '') + ALPHABET[randomInt(ALPHABET.length)]).join('');
const clean = code => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function installAccountRecovery(app, store, authenticated, admin, { authLimit, passwordProblem }) {
  store.db.exec(`CREATE TABLE IF NOT EXISTS password_resets (
    user_id TEXT PRIMARY KEY REFERENCES users(id), code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL, created_at TEXT NOT NULL
  )`);

  app.post('/api/v1/admin/users/:id/reset-code', authenticated, admin, (request, response) => {
    if (request.impersonator) return response.status(403).json({ error: 'Return to your own account first' });
    const target = store.user(request.params.id);
    if (!target || target.status === 'deleted') return response.sendStatus(404);
    if (target.id === request.user.id) return response.status(403).json({ error: 'Change your own password from Account security' });
    if (target.role === 'admin') return response.status(403).json({ error: 'Administrator passwords cannot be reset this way' });
    const code = newCode();
    store.db.prepare('INSERT INTO password_resets VALUES (?,?,?,0,?,?) ON CONFLICT(user_id) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0,created_by=excluded.created_by,created_at=excluded.created_at')
      .run(target.id, digest(clean(code)), Date.now() + CODE_MS, request.user.id, new Date().toISOString());
    store.audit(request.user.id, 'PASSWORD_RESET_CODE_CREATED', { targetId: target.id, ip: request.ip });
    response.json({ success: true, data: { code, expiresInMinutes: CODE_MS / 60000 }, message: 'Give this code to the person after checking who they are', timestamp: new Date().toISOString() });
  });

  // "email" carries an email address or the primary phone number, as at sign-in.
  app.post('/api/auth/reset-password', authLimit, async (request, response) => {
    const input = z.object({ email: z.string().trim().min(3).max(254), code: z.string().max(20), newPassword: z.string().min(1).max(128) }).strict().parse(request.body);
    const found = input.email.includes('@') ? store.credentials(input.email) : store.credentialsByPhone(input.email);
    const refuse = () => response.status(400).json({ error: 'This reset code is not valid or has expired. Ask your clinic for a new one.' });
    const row = found && store.db.prepare('SELECT * FROM password_resets WHERE user_id=?').get(found.id);
    if (!row || row.expires_at < Date.now() || row.attempts >= MAX_ATTEMPTS) return refuse();
    if (row.code_hash !== digest(clean(input.code))) {
      store.db.prepare('UPDATE password_resets SET attempts=attempts+1 WHERE user_id=?').run(found.id);
      return refuse();
    }
    const user = store.user(found.id);
    const problem = passwordProblem(input.newPassword, user);
    if (problem) return response.status(400).json({ error: problem });
    const hash = await hashPassword(input.newPassword);
    store.db.exec('BEGIN IMMEDIATE');
    try {
      store.db.prepare('UPDATE users SET password_hash=?, password_changed_at=? WHERE id=?').run(hash, new Date().toISOString(), user.id);
      store.db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
      store.db.prepare('DELETE FROM password_resets WHERE user_id=?').run(user.id);
      store.audit(user.id, 'PASSWORD_RESET', { targetId: user.id, details: { codeCreatedBy: row.created_by }, ip: request.ip });
      store.db.exec('COMMIT');
    } catch (error) { store.db.exec('ROLLBACK'); throw error; }
    response.json({ success: true, data: { reset: true }, message: 'Password changed. Sign in with your new password.', timestamp: new Date().toISOString() });
  });
}

module.exports = { installAccountRecovery, newCode, CODE_MS, MAX_ATTEMPTS };
