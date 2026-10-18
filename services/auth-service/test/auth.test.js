const request = require('supertest');
const jwt = require('jsonwebtoken');
const { generateKeyPairSync } = require('node:crypto');
const { createLogger } = require('@hfa/shared');
const { createTestDatabase, dropTestDatabase } = require('@hfa/shared/src/testing');

const DB = 'hfa_auth_test';
const ORIGIN = 'https://www.healthyfutureafrica.org';
let app, sequelize, models, publicKey;

beforeAll(async () => {
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  publicKey = keys.publicKey;
  Object.assign(process.env, {
    DATABASE_URL: await createTestDatabase(DB),
    AUTH_PRIVATE_KEY_B64: Buffer.from(keys.privateKey).toString('base64'),
    AUTH_PUBLIC_KEY_B64: Buffer.from(keys.publicKey).toString('base64'),
    INTERNAL_SERVICE_TOKEN: 'internal-test-token-0123456789',
    SCRYPT_COST: '1024', LOGIN_RATE_LIMIT: '1000', COOKIE_SECURE: 'true', TRUST_PROXY: 'false', LOG_SILENT: 'true'
  });
  const { loadConfig } = require('../src/config');
  const { buildApp } = require('../src/app');
  ({ app, sequelize, models } = await buildApp({ config: loadConfig(), logger: createLogger('auth-test') }));
});

afterAll(async () => {
  await sequelize.close();
  await dropTestDatabase(DB);
});

const refreshCookieFrom = response => (response.headers['set-cookie'] || []).find(line => line.startsWith('__Secure-hfa_rt='));
const cookieValue = line => line.split(';')[0];
const register = (email, password = 'Correct-horse-battery-1') => request(app).post('/api/v1/auth/register').send({ email, password });
const webLogin = (email, password = 'Correct-horse-battery-1') => request(app).post('/api/v1/auth/login').send({ email, password });
const webRefresh = cookie => request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).set('X-HFA-Request', '1').set('Origin', ORIGIN).send({});

describe('registration and login', () => {
  test('registers patients with the standard envelope and validates input', async () => {
    const created = await register('Patient.One@Example.invalid');
    expect(created.status).toBe(201);
    expect(created.body).toEqual({ success: true, data: { user: expect.objectContaining({ email: 'patient.one@example.invalid', role: 'patient', status: 'active' }) }, message: 'Account created', timestamp: expect.any(String) });
    expect((await register('patient.one@example.invalid')).status).toBe(409);
    const weak = await register('weak@example.invalid', 'short');
    expect(weak.status).toBe(400);
    expect(weak.body.data.issues[0].path).toBe('password');
    expect((await request(app).post('/api/v1/auth/register').send({ email: 'x@example.invalid', password: 'Correct-horse-battery-1', role: 'admin' })).status).toBe(400);
  });

  test('web login returns a short-lived access token and an HttpOnly, Secure, SameSite=Strict refresh cookie', async () => {
    const response = await webLogin('patient.one@example.invalid');
    expect(response.status).toBe(200);
    expect(response.body.data.refreshToken).toBeUndefined();
    const claims = jwt.verify(response.body.data.accessToken, publicKey, { algorithms: ['RS256'], issuer: 'hfa-auth', audience: 'hfa-api' });
    expect(claims).toMatchObject({ typ: 'access', role: 'patient' });
    expect(claims.exp - claims.iat).toBe(900);
    const cookie = refreshCookieFrom(response);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    const stored = await models.RefreshToken.findAll();
    expect(stored.some(row => cookieValue(cookie).includes(row.tokenHash))).toBe(false); // only hashes stored
  });

  test('wrong passwords and unknown emails get the same message, and accounts lock after repeated failures', async () => {
    await register('locked@example.invalid');
    const unknown = await webLogin('nobody@example.invalid');
    const wrong = await webLogin('locked@example.invalid', 'Wrong-password-000');
    expect([unknown.status, wrong.status]).toEqual([401, 401]);
    expect(unknown.body.message).toBe(wrong.body.message);
    for (let attempt = 0; attempt < 4; attempt++) await webLogin('locked@example.invalid', 'Wrong-password-000');
    expect((await webLogin('locked@example.invalid')).status).toBe(401); // correct password, but locked
    await models.User.update({ lockedUntil: new Date(Date.now() - 1000) }, { where: { email: 'locked@example.invalid' } });
    expect((await webLogin('locked@example.invalid')).status).toBe(200);
  });
});

describe('refresh token rotation', () => {
  test('cookie refresh requires the CSRF header and an allowed origin', async () => {
    const cookie = cookieValue(refreshCookieFrom(await webLogin('patient.one@example.invalid')));
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).send({})).status).toBe(403);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).set('X-HFA-Request', '1').set('Origin', 'https://evil.example').send({})).status).toBe(403);
    expect((await webRefresh(cookie)).status).toBe(200);
  });

  test('each refresh issues a new token; reusing an old one revokes the whole session', async () => {
    const first = cookieValue(refreshCookieFrom(await webLogin('patient.one@example.invalid')));
    const rotated = await webRefresh(first);
    expect(rotated.status).toBe(200);
    const second = cookieValue(refreshCookieFrom(rotated));
    expect(second).not.toBe(first);
    expect(jwt.verify(rotated.body.data.accessToken, publicKey).typ).toBe('access');

    const replay = await webRefresh(first); // attacker replays the stolen, already-used token
    expect(replay.status).toBe(401);
    expect(refreshCookieFrom(replay) || (replay.headers['set-cookie'] || []).join()).toMatch(/hfa_rt=;/);
    expect((await webRefresh(second)).status).toBe(401); // the legitimate latest token is dead too
    const family = await models.RefreshToken.findAll({ where: { revokedReason: 'reuse_detected' } });
    expect(family.length).toBeGreaterThanOrEqual(2);
  });

  test('mobile clients receive the refresh token in the body instead of a cookie', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ email: 'patient.one@example.invalid', password: 'Correct-horse-battery-1', client: 'mobile' });
    expect(login.headers['set-cookie']).toBeUndefined();
    const token = login.body.data.refreshToken;
    expect(token).toEqual(expect.any(String));
    const refreshed = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: token });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.refreshToken).not.toBe(token);
    expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: token })).status).toBe(401);
  });

  test('sessions end at their absolute lifetime even if refreshed regularly', async () => {
    const cookie = cookieValue(refreshCookieFrom(await webLogin('patient.one@example.invalid')));
    await sequelize.query("UPDATE auth_refresh_tokens SET family_expires_at = now() - interval '1 second', expires_at = now() - interval '1 second' WHERE revoked_at IS NULL AND used_at IS NULL");
    expect((await webRefresh(cookie)).status).toBe(401);
  });
});

describe('logout and account changes', () => {
  test('logout revokes the session and logout-all ends every session', async () => {
    const one = cookieValue(refreshCookieFrom(await webLogin('patient.one@example.invalid')));
    const logout = await request(app).post('/api/v1/auth/logout').set('Cookie', one).set('X-HFA-Request', '1').send({});
    expect(logout.status).toBe(200);
    expect((await webRefresh(one)).status).toBe(401);

    const a = await webLogin('patient.one@example.invalid');
    const b = await webLogin('patient.one@example.invalid');
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${a.body.data.accessToken}`);
    expect(me.body.data.user.email).toBe('patient.one@example.invalid');
    expect((await request(app).post('/api/v1/auth/logout-all').set('Authorization', `Bearer ${a.body.data.accessToken}`)).status).toBe(200);
    expect((await webRefresh(cookieValue(refreshCookieFrom(a)))).status).toBe(401);
    expect((await webRefresh(cookieValue(refreshCookieFrom(b)))).status).toBe(401);
  });

  test('internal provisioning puts the credential hash in tokens; suspension ends sessions', async () => {
    const hash = 'a'.repeat(64);
    const body = { email: 'doctor@example.invalid', password: 'Correct-horse-battery-1', role: 'doctor', status: 'active', credentialHash: hash };
    expect((await request(app).post('/internal/v1/users').send(body)).status).toBe(403);
    const created = await request(app).post('/internal/v1/users').set('X-Internal-Token', process.env.INTERNAL_SERVICE_TOKEN).send(body);
    expect(created.status).toBe(201);
    const login = await webLogin('doctor@example.invalid');
    expect(jwt.verify(login.body.data.accessToken, publicKey).chash).toBe(hash);
    const suspend = await request(app).patch(`/internal/v1/users/${created.body.data.user.id}`).set('X-Internal-Token', process.env.INTERNAL_SERVICE_TOKEN).send({ status: 'suspended' });
    expect(suspend.body.data.user.status).toBe('suspended');
    expect((await webRefresh(cookieValue(refreshCookieFrom(login)))).status).toBe(401);
    expect((await webLogin('doctor@example.invalid')).status).toBe(403);
  });
});
