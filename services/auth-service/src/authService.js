const jwt = require('jsonwebtoken');
const { randomBytes, randomUUID } = require('node:crypto');
const { Op } = require('sequelize');
const { sha256Hex, unauthorized, forbidden, conflict, notFound, AppError } = require('@hfa/shared');
const { hashPassword, verifyPassword, needsRehash } = require('./passwords');

const INVALID_LOGIN = 'Invalid email or password';

// Business logic for logins and sessions, kept separate from HTTP so it is easy to test and reuse.
function createAuthService({ sequelize, models, config, logger }) {
  const { User, RefreshToken } = models;
  let dummyHash; // used to spend the same time on unknown emails (prevents account enumeration)

  const publicUser = user => ({ id: user.id, email: user.email, role: user.role, status: user.status });

  function signAccessToken(user, sessionId) {
    return jwt.sign(
      { typ: 'access', role: user.role, sid: sessionId, ...(user.credentialHash ? { chash: user.credentialHash } : {}) },
      config.privateKey,
      { algorithm: 'RS256', expiresIn: config.accessTtlSeconds, issuer: config.issuer, audience: config.audience, subject: user.id, jwtid: randomUUID() }
    );
  }

  // Creates a refresh-token row and returns the raw token (shown to the client exactly once).
  async function createRefreshToken({ user, familyId, familyExpiresAt, clientType, ip, userAgent, transaction }) {
    const raw = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Math.min(Date.now() + config.refreshTtlSeconds * 1000, familyExpiresAt.getTime()));
    const record = await RefreshToken.create({
      userId: user.id, familyId, familyExpiresAt, expiresAt, clientType,
      tokenHash: sha256Hex(raw), createdIp: ip ? String(ip).slice(0, 64) : null, userAgent: userAgent ? String(userAgent).slice(0, 255) : null
    }, { transaction });
    return { raw, record };
  }

  async function startSession(user, context, transaction) {
    const familyId = randomUUID();
    const familyExpiresAt = new Date(Date.now() + config.sessionMaxSeconds * 1000);
    const { raw, record } = await createRefreshToken({ user, familyId, familyExpiresAt, transaction, ...context });
    return { user: publicUser(user), accessToken: signAccessToken(user, familyId), accessExpiresIn: config.accessTtlSeconds, refreshToken: raw, refreshExpiresAt: record.expiresAt };
  }

  async function register({ email, password }) {
    if (await User.findOne({ where: { email: email.toLowerCase() } })) throw conflict('An account with this email already exists');
    const user = await User.create({ email, passwordHash: await hashPassword(password, config.scryptCost), role: 'patient', status: 'active' });
    logger.info('user_registered', { userId: user.id, role: user.role });
    return publicUser(user);
  }

  async function login({ email, password, clientType, ip, userAgent }) {
    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    if (!user) {
      dummyHash = dummyHash || await hashPassword(randomBytes(16).toString('hex'), config.scryptCost);
      await verifyPassword(password, dummyHash);
      throw unauthorized(INVALID_LOGIN);
    }
    // While locked, do not even check the password, and keep the same generic message.
    if (user.lockedUntil && user.lockedUntil > new Date()) throw unauthorized(INVALID_LOGIN);
    if (!await verifyPassword(password, user.passwordHash)) {
      const failures = user.failedLoginCount + 1;
      const locked = failures >= config.maxFailedLogins;
      await user.update({ failedLoginCount: locked ? 0 : failures, lockedUntil: locked ? new Date(Date.now() + config.lockoutSeconds * 1000) : user.lockedUntil });
      if (locked) logger.warn('account_locked', { userId: user.id });
      throw unauthorized(INVALID_LOGIN);
    }
    if (user.status !== 'active') throw forbidden('This account is not active');
    const changes = { failedLoginCount: 0, lockedUntil: null };
    if (needsRehash(user.passwordHash, config.scryptCost)) changes.passwordHash = await hashPassword(password, config.scryptCost);
    await user.update(changes);
    const session = await startSession(user, { clientType, ip, userAgent });
    logger.info('login_succeeded', { userId: user.id, clientType });
    return session;
  }

  async function revokeFamily(familyId, reason, transaction) {
    await RefreshToken.update({ revokedAt: new Date(), revokedReason: reason }, { where: { familyId, revokedAt: null }, transaction });
  }

  // Refresh-token rotation. The presented token is locked, checked, marked used and replaced in
  // one transaction. Presenting a token that was already used or revoked means it was copied:
  // the whole family (every token from that login) is revoked and the user must sign in again.
  async function rotate(rawToken, { ip, userAgent }) {
    const outcome = await sequelize.transaction(async transaction => {
      const current = await RefreshToken.findOne({ where: { tokenHash: sha256Hex(rawToken) }, transaction, lock: transaction.LOCK.UPDATE });
      if (!current) return { error: 'invalid' };
      if (current.usedAt || current.revokedAt) {
        await revokeFamily(current.familyId, 'reuse_detected', transaction);
        return { error: 'reuse', userId: current.userId, familyId: current.familyId };
      }
      const now = new Date();
      if (current.expiresAt <= now || current.familyExpiresAt <= now) {
        await revokeFamily(current.familyId, 'expired', transaction);
        return { error: 'expired' };
      }
      const user = await User.findByPk(current.userId, { transaction });
      if (!user || user.status !== 'active') {
        await revokeFamily(current.familyId, 'account_inactive', transaction);
        return { error: 'inactive' };
      }
      const { raw, record } = await createRefreshToken({ user, familyId: current.familyId, familyExpiresAt: current.familyExpiresAt, clientType: current.clientType, ip, userAgent, transaction });
      await current.update({ usedAt: now, replacedById: record.id }, { transaction });
      return { user, raw, record, clientType: current.clientType };
    });
    if (outcome.error === 'reuse') logger.warn('refresh_token_reuse_detected', { userId: outcome.userId, familyId: outcome.familyId });
    if (outcome.error) throw unauthorized('Session expired or invalid; please sign in again');
    return {
      user: publicUser(outcome.user),
      accessToken: signAccessToken(outcome.user, outcome.record.familyId),
      accessExpiresIn: config.accessTtlSeconds,
      refreshToken: outcome.raw,
      refreshExpiresAt: outcome.record.expiresAt,
      clientType: outcome.clientType
    };
  }

  async function logout(rawToken) {
    if (!rawToken) return;
    const current = await RefreshToken.findOne({ where: { tokenHash: sha256Hex(rawToken) } });
    if (current) await revokeFamily(current.familyId, 'logout');
  }

  async function logoutEverywhere(userId, reason = 'logout_all') {
    await RefreshToken.update({ revokedAt: new Date(), revokedReason: reason }, { where: { userId, revokedAt: null } });
  }

  async function getUser(userId) {
    const user = await User.findByPk(userId);
    if (!user) throw notFound('User not found');
    return publicUser(user);
  }

  // Internal: provider accounts are created by the Admin Service, never by self-registration.
  async function createAccount({ email, password, role, status, credentialHash }) {
    if (await User.findOne({ where: { email: email.toLowerCase() } })) throw conflict('An account with this email already exists');
    const user = await User.create({ email, role, status, credentialHash: credentialHash || null, passwordHash: await hashPassword(password, config.scryptCost) });
    return { ...publicUser(user), credentialHash: user.credentialHash };
  }

  // Internal: called when a provider is verified, suspended or deactivated. Any status other
  // than active ends every session immediately.
  async function updateAccount(userId, { status, credentialHash }) {
    const user = await User.findByPk(userId);
    if (!user) throw notFound('User not found');
    const changes = {};
    if (status !== undefined) changes.status = status;
    if (credentialHash !== undefined) changes.credentialHash = credentialHash;
    if (!Object.keys(changes).length) throw new AppError(400, 'Nothing to update');
    await user.update(changes);
    if (user.status !== 'active') await logoutEverywhere(user.id, 'account_inactive');
    return { ...publicUser(user), credentialHash: user.credentialHash };
  }

  async function deleteExpiredTokens() {
    return RefreshToken.destroy({ where: { familyExpiresAt: { [Op.lt]: new Date(Date.now() - 86400000) } } });
  }

  return { register, login, rotate, logout, logoutEverywhere, getUser, createAccount, updateAccount, deleteExpiredTokens };
}

module.exports = { createAuthService };
