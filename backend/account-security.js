// Account security: change password and two-step sign-in (TOTP, RFC 6238) with recovery codes.
// Administrators must have two-step sign-in before admin tools work (see requireAdminMfa in server.js).
const { createHmac, randomBytes, randomInt, createCipheriv, createDecipheriv, timingSafeEqual } = require('node:crypto');
const { z } = require('zod');
const QRCode = require('qrcode');
const { digest, hashPassword, verifyPassword } = require('./store');
const { filesConfigured } = require('./files');
const { maskEmail } = require('./mailer');

const ISSUER = 'HFA SilverStrong';
const STEP_SECONDS = 30;
const CHALLENGE_TTL = 5 * 60 * 1000;
const MAX_CHALLENGE_ATTEMPTS = 5;
const RECOVERY_CODES = 8;
// Backup codes by email (Super Admin, when the phone is unavailable).
const EMAIL_CODE_TTL = 10 * 60 * 1000;
const EMAIL_RESEND_WAIT = 60 * 1000;
const MAX_EMAIL_SENDS = 3;
// Passwords people (and attackers) try first; compared after lower-casing and removing digits and symbols.
const COMMON = ['password', 'passw', 'motdepasse', 'admin', 'administrator', 'superadmin', 'welcome', 'bienvenue', 'qwerty', 'azerty', 'letmein',
  'hfa', 'silverstrong', 'healthyfutureafrica', 'cameroon', 'cameroun', 'doctor', 'nurse', 'patient', 'pharmacist', 'iloveyou', 'abc', 'test', 'changeme'];

// ───── TOTP ─────
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(buffer) {
  let bits = 0, value = 0, output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { output += BASE32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}
function base32Decode(text) {
  let bits = 0, value = 0; const bytes = [];
  for (const char of text.replace(/=+$/, '').toUpperCase()) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error('Invalid base32');
    value = (value << 5) | index; bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(bytes);
}
function totp(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const code = ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
  return code;
}
/** Returns the matching time step (allowing one step of clock drift) or null. */
function matchTotp(secret, code, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return null;
  const current = Math.floor(now / 1000 / STEP_SECONDS);
  for (const step of [current, current - 1, current + 1]) {
    const expected = Buffer.from(totp(secret, step)), given = Buffer.from(code);
    if (timingSafeEqual(expected, given)) return step;
  }
  return null;
}

// ───── secret storage (AES-256-GCM, bound to the user id) ─────
function sealSecret(config, userId, secret) {
  const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', Buffer.from(config.fileEncryptionKey, 'hex'), nonce);
  cipher.setAAD(Buffer.from(`mfa:${userId}`));
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [nonce, cipher.getAuthTag(), encrypted].map(part => part.toString('base64')).join('.');
}
function openSecret(config, userId, sealed) {
  const [nonce, tag, encrypted] = sealed.split('.').map(part => Buffer.from(part, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(config.fileEncryptionKey, 'hex'), nonce);
  decipher.setAAD(Buffer.from(`mfa:${userId}`));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function ensureTables(store) {
  const columns = store.db.prepare('PRAGMA table_info(users)').all().map(column => column.name);
  for (const [name, type] of [['mfa_secret', 'TEXT'], ['mfa_pending_secret', 'TEXT'], ['mfa_enabled_at', 'TEXT'], ['mfa_last_step', 'INTEGER'], ['mfa_recovery', "TEXT NOT NULL DEFAULT '[]'"], ['password_changed_at', 'TEXT']]) {
    if (!columns.includes(name)) store.db.exec(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
  }
  store.db.exec(`CREATE TABLE IF NOT EXISTS mfa_challenges (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0
  )`);
  const challengeColumns = store.db.prepare('PRAGMA table_info(mfa_challenges)').all().map(column => column.name);
  for (const [name, type] of [['email_code_hash', 'TEXT'], ['email_code_expires', 'INTEGER'], ['email_sends', 'INTEGER NOT NULL DEFAULT 0'], ['email_sent_at', 'INTEGER']]) {
    if (!challengeColumns.includes(name)) store.db.exec(`ALTER TABLE mfa_challenges ADD COLUMN ${name} ${type}`);
  }
}

/** Checks the strength of a new password. Returns an error message or null. */
function passwordProblem(password, user) {
  if (typeof password !== 'string' || password.length < 12) return 'Use at least 12 characters';
  if (password.length > 128) return 'Use at most 128 characters';
  if (new Set(password).size < 6) return 'Use a less repetitive password';
  const core = password.toLowerCase().replace(/[^a-z]/g, '');
  if (!core || COMMON.some(word => core === word || core.replace(word, '').length < 4)) return 'This password is too common or easy to guess. Try three or four unrelated words.';
  const emailName = String(user.email || '').split('@')[0].toLowerCase().replace(/[^a-z]/g, '');
  if (emailName.length >= 4 && core.includes(emailName)) return 'Do not use your email address in your password';
  const nameParts = String(user.name || '').toLowerCase().split(/[^a-z]+/).filter(part => part.length >= 4);
  if (nameParts.some(part => core.includes(part))) return 'Do not use your name in your password';
  return null;
}

function installAccountSecurity(app, config, store, authenticated, { authLimit, startSession, sessionPayload, cookieToken, mailer }) {
  ensureTables(store);
  // Only the Super Admin (every server administrator) may receive sign-in codes by email, and only with a real address.
  const emailBackupFor = user => mailer && user?.role === 'admin' && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(user.email || '') && !/\.invalid$/i.test(user.email) ? maskEmail(user.email) : null;
  const mfaRow = id => store.db.prepare('SELECT mfa_secret,mfa_pending_secret,mfa_enabled_at,mfa_last_step,mfa_recovery FROM users WHERE id=?').get(id);
  const notForSomeoneElse = (request, response, next) => request.impersonator ? response.status(403).json({ error: 'Only the account owner can change sign-in settings' }) : next();
  const storageReady = (request, response, next) => filesConfigured(config) ? next() : response.status(503).json({ error: 'Encrypted storage is not configured' });

  // Change password: current password required; other devices are signed out.
  app.post('/api/v1/account/password', authLimit, authenticated, notForSomeoneElse, async (request, response) => {
    const input = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(1).max(128) }).strict().parse(request.body);
    const row = store.db.prepare('SELECT password_hash FROM users WHERE id=?').get(request.user.id);
    if (!(await verifyPassword(input.currentPassword, row.password_hash))) return response.status(401).json({ error: 'Your current password is not correct' });
    if (input.newPassword === input.currentPassword) return response.status(400).json({ error: 'Choose a password different from your current one' });
    const problem = passwordProblem(input.newPassword, request.user);
    if (problem) return response.status(400).json({ error: problem });
    const hash = await hashPassword(input.newPassword);
    const currentToken = digest(cookieToken(request) || '');
    store.db.exec('BEGIN IMMEDIATE');
    try {
      store.db.prepare('UPDATE users SET password_hash=?, password_changed_at=? WHERE id=?').run(hash, new Date().toISOString(), request.user.id);
      store.db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash!=?').run(request.user.id, currentToken);
      store.db.prepare('DELETE FROM mfa_challenges WHERE user_id=?').run(request.user.id);
      store.audit(request.user.id, 'PASSWORD_CHANGED', { targetId: request.user.id, ip: request.ip });
      store.db.exec('COMMIT');
    } catch (error) { store.db.exec('ROLLBACK'); throw error; }
    response.json({ success: true, data: { user: store.user(request.user.id) }, message: 'Password changed', timestamp: new Date().toISOString() });
  });

  // Two-step sign-in, step 1: a new secret (pending until confirmed with a code).
  app.post('/api/v1/account/mfa/setup', authenticated, notForSomeoneElse, storageReady, async (request, response) => {
    if (mfaRow(request.user.id).mfa_enabled_at) return response.status(409).json({ error: 'Two-step sign-in is already on' });
    const secret = base32Encode(randomBytes(20));
    store.db.prepare('UPDATE users SET mfa_pending_secret=? WHERE id=?').run(sealSecret(config, request.user.id, secret), request.user.id);
    const label = `${ISSUER}:${request.user.email || request.user.phone || request.user.hfaId}`;
    const uri = `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
    const qrSvg = await QRCode.toString(uri, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
    response.set('Cache-Control', 'no-store').json({ secret: secret.match(/.{1,4}/g).join(' '), qrSvg });
  });

  // Step 2: confirm with a code from the app; recovery codes are shown once.
  app.post('/api/v1/account/mfa/enable', authLimit, authenticated, notForSomeoneElse, storageReady, (request, response) => {
    const { code } = z.object({ code: z.string().trim().max(10) }).strict().parse(request.body);
    const row = mfaRow(request.user.id);
    if (!row.mfa_pending_secret) return response.status(409).json({ error: 'Start the setup again' });
    const secret = openSecret(config, request.user.id, row.mfa_pending_secret);
    const step = matchTotp(secret, code.replace(/\s/g, ''));
    if (step === null) return response.status(400).json({ error: 'That code is not correct. Check the time on your phone and try the newest code.' });
    const codes = Array.from({ length: RECOVERY_CODES }, () => randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g).join('-'));
    store.db.prepare('UPDATE users SET mfa_secret=?, mfa_pending_secret=NULL, mfa_enabled_at=?, mfa_last_step=?, mfa_recovery=? WHERE id=?')
      .run(row.mfa_pending_secret, new Date().toISOString(), step, JSON.stringify(codes.map(value => digest(value))), request.user.id);
    store.audit(request.user.id, 'MFA_ENABLED', { targetId: request.user.id, ip: request.ip });
    response.json({ recoveryCodes: codes, user: store.user(request.user.id) });
  });

  // Turning it off needs the password and a current code; administrators cannot turn it off.
  app.post('/api/v1/account/mfa/disable', authLimit, authenticated, notForSomeoneElse, storageReady, async (request, response) => {
    if (request.user.role === 'admin' && config.requireAdminMfa) return response.status(403).json({ error: 'Administrators must keep two-step sign-in on' });
    const input = z.object({ password: z.string().min(1).max(128), code: z.string().trim().max(20) }).strict().parse(request.body);
    const row = mfaRow(request.user.id), credentials = store.db.prepare('SELECT password_hash FROM users WHERE id=?').get(request.user.id);
    if (!row.mfa_secret) return response.status(409).json({ error: 'Two-step sign-in is already off' });
    if (!(await verifyPassword(input.password, credentials.password_hash))) return response.status(401).json({ error: 'Your current password is not correct' });
    if (matchTotp(openSecret(config, request.user.id, row.mfa_secret), input.code.replace(/\s/g, '')) === null) return response.status(400).json({ error: 'That code is not correct' });
    store.db.prepare("UPDATE users SET mfa_secret=NULL, mfa_pending_secret=NULL, mfa_enabled_at=NULL, mfa_last_step=NULL, mfa_recovery='[]' WHERE id=?").run(request.user.id);
    store.audit(request.user.id, 'MFA_DISABLED', { targetId: request.user.id, ip: request.ip });
    response.json({ user: store.user(request.user.id) });
  });

  // Whether backup codes by email are ready for this account (shown on the Account security page).
  app.get('/api/v1/account/mfa/email-backup', authenticated, (request, response) => {
    response.json({ eligible: request.user.role === 'admin', sentTo: emailBackupFor(request.user), configured: !!mailer });
  });

  // Sign-in step 2, backup: a one-time code sent to the Super Admin's email when the phone is unavailable.
  // The password has already been checked (the challenge exists); at most 3 emails per sign-in, a minute apart.
  app.post('/api/auth/mfa/email', authLimit, async (request, response) => {
    const { challenge } = z.object({ challenge: z.string().min(20).max(200) }).strict().parse(request.body);
    const tokenHash = digest(challenge), now = Date.now();
    const pending = store.db.prepare('SELECT * FROM mfa_challenges WHERE token_hash=? AND expires_at>?').get(tokenHash, now);
    if (!pending) return response.status(401).json({ error: 'This sign-in has expired. Enter your password again.' });
    const user = store.user(pending.user_id);
    if (!user || user.status !== 'active' || !mfaRow(user.id)?.mfa_secret) return response.status(401).json({ error: 'Sign in again' });
    if (!emailBackupFor(user)) return response.status(403).json({ error: 'Codes by email are not available for this account' });
    if (pending.attempts >= MAX_CHALLENGE_ATTEMPTS || pending.email_sends >= MAX_EMAIL_SENDS) return response.status(429).json({ error: 'Too many codes sent. Enter your password again later.' });
    if (pending.email_sent_at && now - pending.email_sent_at < EMAIL_RESEND_WAIT) return response.status(429).json({ error: 'A code was just sent. Wait a minute before asking for another.', retryAfter: Math.ceil((EMAIL_RESEND_WAIT - (now - pending.email_sent_at)) / 1000) });
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    // A new code replaces the previous one; the sign-in stays open long enough to read the email.
    store.db.prepare('UPDATE mfa_challenges SET email_code_hash=?, email_code_expires=?, email_sends=email_sends+1, email_sent_at=?, expires_at=MAX(expires_at, ?) WHERE token_hash=?')
      .run(digest(`${tokenHash}:${code}`), now + EMAIL_CODE_TTL, now, now + EMAIL_CODE_TTL, tokenHash);
    try {
      await mailer.send({
        to: user.email, subject: `${code} is your HFA SilverStrong sign-in code`,
        text: `Your HFA SilverStrong sign-in code is ${code}\n\nIt works once, for 10 minutes. Somebody entered your password to sign in; if this was not you, change your password now.\n\nVotre code de connexion HFA SilverStrong est ${code}\n\nIl est valable une fois, pendant 10 minutes. Quelqu’un a saisi votre mot de passe pour se connecter ; si ce n’est pas vous, changez votre mot de passe maintenant.`
      });
    } catch (error) {
      store.audit(user.id, 'MFA_EMAIL_CODE_FAILED', { targetId: user.id, ip: request.ip });
      return response.status(502).json({ error: 'The email could not be sent. Use your authenticator app or a recovery code.' });
    }
    store.audit(user.id, 'MFA_EMAIL_CODE_SENT', { targetId: user.id, ip: request.ip });
    response.json({ sentTo: maskEmail(user.email), expiresIn: EMAIL_CODE_TTL / 1000 });
  });

  // Sign-in step 2: the code (or a one-time recovery code) for a pending challenge.
  app.post('/api/auth/mfa', authLimit, (request, response) => {
    const { challenge, code } = z.object({ challenge: z.string().min(20).max(200), code: z.string().trim().min(6).max(20) }).strict().parse(request.body);
    const tokenHash = digest(challenge);
    const pending = store.db.prepare('SELECT * FROM mfa_challenges WHERE token_hash=? AND expires_at>?').get(tokenHash, Date.now());
    if (!pending) return response.status(401).json({ error: 'This sign-in has expired. Enter your password again.' });
    if (pending.attempts >= MAX_CHALLENGE_ATTEMPTS) { store.db.prepare('DELETE FROM mfa_challenges WHERE token_hash=?').run(tokenHash); return response.status(429).json({ error: 'Too many wrong codes. Enter your password again.' }); }
    const user = store.user(pending.user_id), row = mfaRow(pending.user_id);
    if (!user || user.status !== 'active' || !row.mfa_secret) return response.status(401).json({ error: 'Sign in again' });
    const cleaned = code.replace(/\s/g, '').toUpperCase();
    let ok = false;
    if (/^\d{6}$/.test(cleaned)) {
      const step = matchTotp(openSecret(config, user.id, row.mfa_secret), cleaned);
      // A code can be used only once (replay protection).
      if (step !== null && step > (row.mfa_last_step ?? -1)) { ok = true; store.db.prepare('UPDATE users SET mfa_last_step=? WHERE id=?').run(step, user.id); }
      // Otherwise, the code sent by email for this sign-in (valid once, 10 minutes).
      else if (pending.email_code_hash && pending.email_code_expires > Date.now() && timingSafeEqual(Buffer.from(pending.email_code_hash), Buffer.from(digest(`${tokenHash}:${cleaned}`)))) {
        ok = true; store.audit(user.id, 'MFA_EMAIL_CODE_USED', { targetId: user.id, ip: request.ip });
      }
    } else {
      const formatted = cleaned.replace(/-/g, '').match(/.{1,5}/g)?.join('-') || '';
      const hashes = JSON.parse(row.mfa_recovery || '[]'), index = hashes.indexOf(digest(formatted));
      if (index >= 0) { ok = true; hashes.splice(index, 1); store.db.prepare('UPDATE users SET mfa_recovery=? WHERE id=?').run(JSON.stringify(hashes), user.id); store.audit(user.id, 'MFA_RECOVERY_CODE_USED', { targetId: user.id, details: { remaining: hashes.length }, ip: request.ip }); }
    }
    if (!ok) {
      store.db.prepare('UPDATE mfa_challenges SET attempts=attempts+1 WHERE token_hash=?').run(tokenHash);
      return response.status(401).json({ error: 'That code is not correct' });
    }
    store.db.prepare('DELETE FROM mfa_challenges WHERE token_hash=?').run(tokenHash);
    startSession(response, user);
    response.json(sessionPayload(user));
  });

  return {
    /** Called by the password sign-in: users with two-step sign-in get a challenge instead of a session. */
    challengeFor(user) {
      if (!mfaRow(user.id)?.mfa_secret) return null;
      const token = randomBytes(32).toString('hex');
      store.db.prepare('DELETE FROM mfa_challenges WHERE user_id=? OR expires_at<?').run(user.id, Date.now());
      store.db.prepare('INSERT INTO mfa_challenges (token_hash,user_id,expires_at) VALUES (?,?,?)').run(digest(token), user.id, Date.now() + CHALLENGE_TTL);
      return token;
    },
    mfaEnabled: userId => !!mfaRow(userId)?.mfa_enabled_at,
    /** The masked address a backup code can be sent to, or null. */
    emailBackupFor
  };
}

module.exports = { installAccountSecurity, passwordProblem, totp, matchTotp, base32Encode, base32Decode, STEP_SECONDS };
