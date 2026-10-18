const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const { sendOk, validate, forbidden, unauthorized, createAuthenticator, requireInternalToken, ROLES } = require('@hfa/shared');

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(12, 'Password must be at least 12 characters').max(128);
const client = z.enum(['web', 'mobile']).default('web');

// Web browsers get the refresh token only as an HttpOnly cookie (JavaScript can never read it),
// scoped to /api/v1/auth so it is not sent with any other request. The __Secure- prefix makes
// browsers refuse the cookie unless it is Secure (HTTPS).
function refreshCookie(config) {
  return {
    name: config.cookieSecure ? '__Secure-hfa_rt' : 'hfa_rt',
    options: { httpOnly: true, secure: config.cookieSecure, sameSite: 'strict', path: '/api/v1/auth', ...(config.cookieDomain ? { domain: config.cookieDomain } : {}) }
  };
}

function createRoutes({ authService, config }) {
  const router = express.Router();
  const cookie = refreshCookie(config);
  const authenticate = createAuthenticator({ publicKey: config.publicKey, issuer: config.issuer, audience: config.audience });

  // Per-IP limit on login/registration to slow password guessing (use a Redis store when running
  // several instances so the limit is shared).
  const credentialLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: config.loginRateLimit, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ success: false, data: null, message: 'Too many attempts; please try again later', timestamp: new Date().toISOString() })
  });

  // Cookie-based requests must carry a custom header (which cross-site forms cannot send) and,
  // when the browser sends an Origin, it must be one of ours. Together with SameSite=Strict this
  // blocks cross-site request forgery against the refresh and logout endpoints.
  function csrfGuard(req) {
    if (req.headers['x-hfa-request'] !== '1') throw forbidden('Missing X-HFA-Request header');
    const origin = req.headers.origin;
    if (origin && !config.allowedOrigins.includes(origin)) throw forbidden('Origin not allowed');
  }

  // Mobile apps send the refresh token in the body; web apps rely on the cookie.
  function presentedToken(req) {
    const fromBody = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : null;
    if (fromBody) return { token: fromBody, mode: 'mobile' };
    csrfGuard(req);
    return { token: req.cookies?.[cookie.name] || null, mode: 'web' };
  }

  function respondWithSession(res, session, mode, message, status = 200) {
    const body = { user: session.user, accessToken: session.accessToken, accessTokenExpiresIn: session.accessExpiresIn, refreshTokenExpiresAt: session.refreshExpiresAt };
    if (mode === 'mobile') body.refreshToken = session.refreshToken; // store in Keychain / Keystore
    else res.cookie(cookie.name, session.refreshToken, { ...cookie.options, expires: new Date(session.refreshExpiresAt) });
    return sendOk(res, body, message, status);
  }

  const context = req => ({ ip: req.ip, userAgent: req.headers['user-agent'] });

  router.post('/api/v1/auth/register', credentialLimiter, validate(z.object({ email, password }).strict()), async (req, res) => {
    sendOk(res, { user: await authService.register(req.valid.body) }, 'Account created', 201);
  });

  router.post('/api/v1/auth/login', credentialLimiter, validate(z.object({ email, password: z.string().min(1).max(128), client }).strict()), async (req, res) => {
    const { email: address, password: secret, client: mode } = req.valid.body;
    const session = await authService.login({ email: address, password: secret, clientType: mode, ...context(req) });
    respondWithSession(res, session, mode, 'Signed in');
  });

  router.post('/api/v1/auth/refresh', validate(z.object({ refreshToken: z.string().min(20).max(200).optional() }).strict()), async (req, res) => {
    const { token, mode } = presentedToken(req);
    if (!token) throw unauthorized('No session; please sign in');
    try {
      const session = await authService.rotate(token, context(req));
      respondWithSession(res, session, mode, 'Session refreshed');
    } catch (error) {
      if (mode === 'web') res.clearCookie(cookie.name, cookie.options);
      throw error;
    }
  });

  router.post('/api/v1/auth/logout', validate(z.object({ refreshToken: z.string().min(20).max(200).optional() }).strict()), async (req, res) => {
    const { token, mode } = presentedToken(req);
    await authService.logout(token);
    if (mode === 'web') res.clearCookie(cookie.name, cookie.options);
    sendOk(res, null, 'Signed out');
  });

  router.post('/api/v1/auth/logout-all', authenticate, async (req, res) => {
    await authService.logoutEverywhere(req.user.id);
    res.clearCookie(cookie.name, cookie.options);
    sendOk(res, null, 'Signed out on every device');
  });

  router.get('/api/v1/auth/me', authenticate, async (req, res) => {
    sendOk(res, { user: await authService.getUser(req.user.id) });
  });

  // Other services can fetch the verification key at start-up instead of configuring it.
  router.get('/api/v1/auth/public-key', (req, res) => {
    sendOk(res, { algorithm: 'RS256', issuer: config.issuer, audience: config.audience, publicKey: config.publicKey });
  });

  // ---- Internal routes (not exposed by the public gateway) ----
  const internal = requireInternalToken(config.internalToken);
  const credentialHash = z.string().regex(/^[0-9a-f]{64}$/, 'credentialHash must be a 64-character hex HMAC');

  router.post('/internal/v1/users', internal, validate(z.object({
    email, password, role: z.enum(ROLES), status: z.enum(['active', 'pending']).default('pending'), credentialHash: credentialHash.optional()
  }).strict()), async (req, res) => {
    sendOk(res, { user: await authService.createAccount(req.valid.body) }, 'Account created', 201);
  });

  router.patch('/internal/v1/users/:id', internal, validate(z.object({ id: z.string().uuid() }), 'params'), validate(z.object({
    status: z.enum(['active', 'pending', 'suspended', 'deleted']).optional(), credentialHash: credentialHash.nullable().optional()
  }).strict()), async (req, res) => {
    sendOk(res, { user: await authService.updateAccount(req.valid.params.id, req.valid.body) }, 'Account updated');
  });

  return router;
}

module.exports = { createRoutes, refreshCookie };
