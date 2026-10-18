const request = require('supertest');
const { z } = require('zod');
const { generateKeyPairSync, randomBytes } = require('node:crypto');
const jwt = require('jsonwebtoken');
const shared = require('../src');

describe('AES-256-GCM field encryption', () => {
  const key = randomBytes(32);

  test('round-trips text and rejects tampering or the wrong context', () => {
    const blob = shared.encrypt(key, 'Synthetic name', 'patients.first_name:1');
    expect(blob.includes(Buffer.from('Synthetic name'))).toBe(false);
    expect(shared.decrypt(key, blob, 'patients.first_name:1').toString()).toBe('Synthetic name');
    expect(() => shared.decrypt(key, blob, 'patients.first_name:2')).toThrow();
    const tampered = Buffer.from(blob); tampered[tampered.length - 1] ^= 1;
    expect(() => shared.decrypt(key, tampered, 'patients.first_name:1')).toThrow();
    expect(() => shared.decrypt(randomBytes(32), blob, 'patients.first_name:1')).toThrow();
  });

  test('uses a fresh IV every time and supports JSON', () => {
    expect(shared.encrypt(key, 'same').equals(shared.encrypt(key, 'same'))).toBe(false);
    expect(shared.decryptJson(key, shared.encryptJson(key, { a: [1, 2] }))).toEqual({ a: [1, 2] });
  });

  test('canonical JSON is independent of key order', () => {
    expect(shared.canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(shared.canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
  });
});

describe('service app defaults', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const authenticate = shared.createAuthenticator({ publicKey, issuer: 'hfa-auth', audience: 'hfa-api' });
  const logger = shared.createLogger('test', { log() {}, error() {} });
  const app = shared.createServiceApp({
    name: 'test-service',
    logger,
    configure(app) {
      app.post('/api/v1/echo', shared.validate(z.object({ count: z.number().int().min(1) }).strict()), (req, res) => shared.sendOk(res, req.valid.body));
      app.get('/api/v1/doctor-only', authenticate, shared.requireRole('doctor'), (req, res) => shared.sendOk(res, { id: req.user.id }));
      app.get('/api/v1/boom', () => { throw new Error('secret detail'); });
    }
  });
  const token = (claims, options = {}) => jwt.sign({ typ: 'access', ...claims }, privateKey, { algorithm: 'RS256', issuer: 'hfa-auth', audience: 'hfa-api', subject: 'user-1', expiresIn: 60, ...options });

  test('every response uses the envelope', async () => {
    const health = await request(app).get('/api/v1/health');
    expect(health.body).toEqual({ success: true, data: { service: 'test-service', status: 'ok' }, message: 'OK', timestamp: expect.any(String) });
    const missing = await request(app).get('/nope');
    expect(missing.status).toBe(404);
    expect(missing.body).toMatchObject({ success: false, data: null, message: 'Route not found' });
  });

  test('validation errors are 400 with issues, unexpected errors hide details', async () => {
    const invalid = await request(app).post('/api/v1/echo').send({ count: 0 });
    expect(invalid.status).toBe(400);
    expect(invalid.body.data.issues[0].path).toBe('count');
    const malformed = await request(app).post('/api/v1/echo').set('Content-Type', 'application/json').send('{bad');
    expect(malformed.status).toBe(400);
    const boom = await request(app).get('/api/v1/boom');
    expect(boom.status).toBe(500);
    expect(JSON.stringify(boom.body)).not.toContain('secret detail');
  });

  test('access tokens are verified with the public key and role checks apply', async () => {
    expect((await request(app).get('/api/v1/doctor-only')).status).toBe(401);
    expect((await request(app).get('/api/v1/doctor-only').set('Authorization', `Bearer ${token({ role: 'patient' })}`)).status).toBe(403);
    const ok = await request(app).get('/api/v1/doctor-only').set('Authorization', `Bearer ${token({ role: 'doctor' })}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.id).toBe('user-1');
    expect((await request(app).get('/api/v1/doctor-only').set('Authorization', `Bearer ${token({ role: 'doctor', typ: 'refresh' })}`)).status).toBe(401);
    expect((await request(app).get('/api/v1/doctor-only').set('Authorization', `Bearer ${token({ role: 'doctor' }, { expiresIn: -10 })}`)).status).toBe(401);
    const forged = jwt.sign({ typ: 'access', role: 'doctor' }, 'guessed-secret', { algorithm: 'HS256', issuer: 'hfa-auth', audience: 'hfa-api', subject: 'x' });
    expect((await request(app).get('/api/v1/doctor-only').set('Authorization', `Bearer ${forged}`)).status).toBe(401);
  });
});
