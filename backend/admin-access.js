// Super Admin access to other portals:
// - portal preview: recorded here, the screens switch in the browser (no other account is used);
// - "sign in as": staff and pharmacy accounts only. Patient and administrator accounts can never be
//   entered, so patients' health records stay private. Every start and stop goes to the audit log.
const { z } = require('zod');
const { SESSION_TTL } = require('./store');

const RETURN_COOKIE = 'hfa_admin_return';
const IMPERSONATION_TTL = 60 * 60 * 1000; // one hour
const ENTERABLE_ROLES = ['doctor', 'nurse', 'pharmacist', 'labtech'];
const PORTALS = ['admin', 'doctor', 'nurse', 'patient', 'pharmacist', 'labtech'];

function readCookie(request, name) {
  const cookie = (request.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(name + '='));
  return cookie ? cookie.slice(name.length + 1) : null;
}

function installAdminAccessRoutes(app, config, store, authenticated, admin, { cookieToken, withHealth }) {
  const secure = config.origin.startsWith('https://');
  const cookieOptions = maxAge => ({ httpOnly: true, sameSite: 'strict', secure, path: '/api', maxAge });
  const sessionPayload = user => ({ user: withHealth(config, store, user, [user])[0], users: withHealth(config, store, user, store.visibleUsers(user)), notifications: store.notifications(user.id) });
  const notWhileActingAsSomeoneElse = (request, response, next) => request.impersonator ? response.status(403).json({ error: 'Return to your own account first' }) : next();

  app.post('/api/v1/admin/portal-view', authenticated, notWhileActingAsSomeoneElse, admin, (request, response) => {
    const { role } = z.object({ role: z.enum(PORTALS) }).strict().parse(request.body);
    store.audit(request.user.id, 'PORTAL_PREVIEW', { details: { portal: role }, ip: request.ip });
    response.json({ success: true, data: { portal: role }, message: 'Portal preview recorded', timestamp: new Date().toISOString() });
  });

  // 'stop' is declared before ':id' so Express never reads it as an account id.
  app.post('/api/v1/admin/impersonate/stop', authenticated, (request, response) => {
    if (!request.impersonator) return response.status(409).json({ error: 'You are not signed in as another account' });
    const returnToken = readCookie(request, RETURN_COOKIE);
    const adminUser = store.session(returnToken);
    store.logout(cookieToken(request));
    store.audit(request.impersonator.id, 'SIGN_IN_AS_STOP', { targetId: request.user.id, details: { role: request.user.role }, ip: request.ip });
    response.clearCookie(RETURN_COOKIE, { path: '/api' });
    if (!adminUser || adminUser.id !== request.impersonator.id) {
      response.clearCookie('hfa_session', { path: '/api' });
      return response.status(401).json({ error: 'Your administrator session ended. Sign in again.' });
    }
    response.cookie('hfa_session', returnToken, cookieOptions(SESSION_TTL));
    response.json(sessionPayload(adminUser));
  });

  app.post('/api/v1/admin/impersonate/:id', authenticated, notWhileActingAsSomeoneElse, admin, (request, response) => {
    const target = store.user(request.params.id);
    if (!target || target.status !== 'active') return response.status(404).json({ error: 'Account not found or not active' });
    if (!ENTERABLE_ROLES.includes(target.role)) return response.status(403).json({ error: target.role === 'patient' ? 'Patient accounts cannot be entered, to protect their health records' : 'This account cannot be entered' });
    const token = store.createSession(target.id, { impersonatorId: request.user.id, ttl: IMPERSONATION_TTL });
    store.audit(request.user.id, 'SIGN_IN_AS_START', { targetId: target.id, details: { role: target.role }, ip: request.ip });
    response.cookie(RETURN_COOKIE, cookieToken(request), cookieOptions(IMPERSONATION_TTL));
    response.cookie('hfa_session', token, cookieOptions(IMPERSONATION_TTL));
    response.json({ ...sessionPayload(target), impersonatedBy: { id: request.user.id, name: request.user.name } });
  });

  app.get('/api/v1/admin/audit', authenticated, notWhileActingAsSomeoneElse, admin, (request, response) =>
    response.json({ success: true, data: { entries: store.auditLog() }, message: 'OK', timestamp: new Date().toISOString() }));
}

module.exports = { installAdminAccessRoutes, RETURN_COOKIE, ENTERABLE_ROLES };
