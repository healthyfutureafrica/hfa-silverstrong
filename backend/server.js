const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const { Store, hashPassword, verifyPassword } = require('./store');
const { configuration, validSignature, MetaProvider } = require('./provider');
const { randomUUID } = require('node:crypto');
const { installFileRoutes, filesConfigured, fileMime, saveEncryptedFile, decodeFile } = require('./files');
const { installPharmacyRoutes } = require('./pharmacy');

const message = 'HFA SilverStrong: New activity on your account needs your attention. Sign in securely to review it. This is an automated notification. Do not reply.';
const plain = z.string().trim().min(1).max(200).regex(/^[^<>&"\u0000-\u001f]+$/);
const personName=plain.regex(/^[\p{L}\p{M}\p{N} .'-]+$/u);
const contactPhone=z.string().max(40).regex(/^[+0-9\s()-]*$/);
const phone = z.string().regex(/^\+[1-9]\d{7,14}$/);
const registration = z.object({
  name: personName, email: z.string().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(12).max(128).regex(/\S/), role: z.enum(['patient', 'doctor', 'nurse', 'labtech', 'pharmacist']),
  phone: contactPhone.optional(), whatsappNumber: phone.optional(), whatsappNotificationsConsent: z.boolean().optional(),
  specialty: plain.optional(), hospital: plain.optional(), department: plain.optional(), consultationFee: z.number().min(5).max(20).optional(),
}).strict().superRefine((input, context) => {
  if (input.role === 'patient' && !input.whatsappNumber) context.addIssue({ code: 'custom', message: 'Patient WhatsApp number is required' });
  if (input.role === 'pharmacist') context.addIssue({ code: 'custom', path: ['role'], message: 'Pharmacies register with their documents at /api/auth/register/pharmacist' });
});
// Pharmacies must submit every credential document with the application; activation is gated on all of them.
const PHARMACY_FIELDS=['pharmacyName','pharmacyAddress','pharmacyLocation','pharmacyLicense','businessRegistration','minsanteAuthorization','ownerName','ownerIdType','ownerIdNumber'];
const PHARMACY_DOCUMENTS=['pharmacistLicense','businessLicense','minsanteAuthorization','ownerIdentity'];
const MAX_PHARMACY_DOCUMENT=2*1024*1024;
const pharmacyDocument=z.object({fileName:z.string().min(1).max(180).regex(/^[^<>\u0000-\u001f/\\]+$/),content:z.string().min(4).max(Math.ceil(MAX_PHARMACY_DOCUMENT/3)*4).regex(/^[A-Za-z0-9+/]+={0,2}$/)}).strict();
const pharmacyRegistration=z.object({
  name: personName, email: z.string().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(12).max(128).regex(/\S/), phone: contactPhone.optional(),
  pharmacyName:plain,pharmacyAddress:plain,pharmacyLocation:plain,pharmacyLicense:plain,businessRegistration:plain,minsanteAuthorization:plain,
  ownerName:personName,ownerIdType:z.enum(['national_id','passport']),ownerIdNumber:plain,
  documents:z.object(Object.fromEntries(PHARMACY_DOCUMENTS.map(kind=>[kind,pharmacyDocument]))).strict()
}).strict();
const resources = ['Account', 'Communications', 'Appointments', 'Medical Records', 'Lab Results', 'Care Notes', 'Care Coordination', 'Billing', 'Home Visits', 'Urgent Care'];
const activity = z.object({ eventId: z.string().min(8).max(100), patientId: z.string().min(1).max(100), resource: z.enum(resources) }).strict();
const patchSchema = z.object({
  name: personName.optional(), phone: contactPhone.optional(), status: z.enum(['active', 'suspended', 'pending_approval', 'rejected']).optional(),
  assignedDoctor: z.string().max(100).nullable().optional(), assignedNurse: z.string().max(100).nullable().optional(),
  consultationFee: z.number().min(5).max(20).optional(),
  pharmacyCredentialReview:z.boolean().optional()
}).strict();
const pharmacyComplete=user=>PHARMACY_FIELDS.every(field=>user[field])&&PHARMACY_DOCUMENTS.every(kind=>user.pharmacyDocuments?.[kind]?.id);

function cookieToken(request) {
  const cookie = (request.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith('hfa_session='));
  return cookie ? cookie.slice('hfa_session='.length) : null;
}

async function bootstrap(config, store) {
  if (!config.adminEmail && !config.adminPassword) return;
  if (!config.adminEmail || config.adminPassword.trim().length < 16) throw new Error('Bootstrap administrator requires an email and a password of at least 16 characters');
  const existing = store.credentials(config.adminEmail);
  if (existing) {
    if (store.user(existing.id).role !== 'admin') throw new Error('Bootstrap identity is not an administrator');
    return;
  }
  store.createUser({ name: 'Platform Administrator', email: config.adminEmail, role: 'admin' }, await hashPassword(config.adminPassword), 'active');
}

function createApp(config, store, provider) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
  app.use(helmet());
  app.get('/api/healthz', (request, response) => response.json({ status: 'ok' }));
  app.get('/api/config', (request, response) => response.json({ backend: true, providerConfigured: config.ready, fileUploadsConfigured: filesConfigured(config) }));
  app.get('/api/whatsapp/webhook', (request, response) => {
    if (!config.verifyToken || request.query['hub.mode'] !== 'subscribe' || request.query['hub.verify_token'] !== config.verifyToken || typeof request.query['hub.challenge'] !== 'string') return response.sendStatus(403);
    response.type('text/plain').send(request.query['hub.challenge']);
  });
  app.post('/api/whatsapp/webhook', express.raw({ type: 'application/json', limit: '1mb' }), (request, response) => {
    if (!Buffer.isBuffer(request.body) || !validSignature(request.body, request.headers['x-hub-signature-256'], config.appSecret)) return response.sendStatus(401);
    try { provider.webhook(JSON.parse(request.body.toString('utf8'))); response.sendStatus(200); }
    catch (error) { response.sendStatus(400); }
  });
  app.use('/api', rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));
  const smallJson=express.json({ limit: '32kb' });
  app.use((request, response, next) => request.path === '/api/auth/register/pharmacist' ? next() : smallJson(request, response, next));
  app.use('/api', (request, response, next) => {
    response.set('Cache-Control', 'no-store');
    if (['POST', 'PATCH', 'DELETE'].includes(request.method) &&
      (request.headers['x-hfa-request'] !== '1' || (request.headers.origin && request.headers.origin !== config.origin))) return response.status(403).json({ error: 'Invalid request origin' });
    next();
  });

  const authenticated = (request, response, next) => {
    request.user = store.session(cookieToken(request));
    if (!request.user) return response.status(401).json({ error: 'Sign in required' });
    next();
  };
  const admin = (request, response, next) => request.user.role === 'admin' ? next() : response.status(403).json({ error: 'Administrator required' });
  installFileRoutes(app,config,store,authenticated);
  installPharmacyRoutes(app,store,authenticated);
  const authLimit = rateLimit({ windowMs: 15 * 60000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });
  const eventLimit = rateLimit({ windowMs: 60000, limit: 20, keyGenerator: request => request.user.id, standardHeaders: 'draft-8', legacyHeaders: false });
  const startSession = (response, user) => response.cookie('hfa_session', store.createSession(user.id), {
    httpOnly: true, sameSite: 'strict', secure: config.origin.startsWith('https://'), path: '/api', maxAge: 8 * 3600000
  });
  const profile = input => Object.fromEntries(['specialty', 'hospital', 'department', 'consultationFee'].filter(key => input[key] !== undefined).map(key => [key, input[key]]));

  app.post('/api/auth/register', authLimit, async (request, response) => {
    const input = registration.parse(request.body);
    if (input.role === 'labtech') return response.status(403).json({ error: 'Administrator provisions laboratory staff' });
    if (store.credentials(input.email)) return response.status(409).json({ error: 'Email already registered' });
    const user = store.createUser({ ...input, profile: profile(input) }, await hashPassword(input.password), input.role === 'patient' ? 'active' : 'pending_approval');
    if (user.status === 'active') startSession(response, user);
    response.status(201).json({ user, users: user.status === 'active' ? store.visibleUsers(user) : [] });
  });
  app.post('/api/auth/register/pharmacist', authLimit, express.json({ limit: '12mb' }), async (request, response) => {
    if (!filesConfigured(config)) return response.status(503).json({ error: 'Encrypted document storage is not configured; pharmacy registration is unavailable' });
    const input = pharmacyRegistration.parse(request.body);
    const documents = {};
    for (const kind of PHARMACY_DOCUMENTS) {
      const bytes = Buffer.from(input.documents[kind].content, 'base64'), mime = fileMime(bytes);
      if (!bytes.length || bytes.length > MAX_PHARMACY_DOCUMENT) return response.status(400).json({ error: `documents.${kind}: File must be between 1 byte and 2 MB` });
      if (!mime) return response.status(400).json({ error: `documents.${kind}: Only PDF, PNG, JPEG and WebP files are accepted` });
      documents[kind] = { bytes, mime, fileName: input.documents[kind].fileName };
    }
    if (store.credentials(input.email)) return response.status(409).json({ error: 'Email already registered' });
    const passwordHash = await hashPassword(input.password);
    const pharmacyDocuments = Object.fromEntries(PHARMACY_DOCUMENTS.map(kind => [kind, { id: randomUUID(), fileName: documents[kind].fileName, mime: documents[kind].mime, size: documents[kind].bytes.length }]));
    store.db.exec('BEGIN IMMEDIATE');
    try {
      if (store.credentials(input.email)) { store.db.exec('ROLLBACK'); return response.status(409).json({ error: 'Email already registered' }); }
      const user = store.createUser({ ...input, role: 'pharmacist', profile: { ...Object.fromEntries(PHARMACY_FIELDS.map(field => [field, input[field]])), pharmacyDocuments } }, passwordHash, 'pending_approval');
      for (const kind of PHARMACY_DOCUMENTS) saveEncryptedFile(config, store, user.id, pharmacyDocuments[kind].id, { fileName: documents[kind].fileName, category: 'pharmacy_registration:' + kind, notes: '', relatedApptId: '' }, documents[kind].bytes, documents[kind].mime);
      store.db.exec('COMMIT');
      response.status(201).json({ user, users: [] });
    } catch (error) { store.db.exec('ROLLBACK'); throw error; }
  });
  app.post('/api/auth/login', authLimit, async (request, response) => {
    const input = z.object({ email: z.string().email(), password: z.string().min(1).max(128) }).strict().parse(request.body);
    const credentials = store.credentials(input.email);
    const valid=await verifyPassword(input.password,credentials?.password_hash||`00000000000000000000000000000000:${'0'.repeat(128)}`);
    if (!credentials || !valid) return response.status(401).json({ error: 'Invalid email or password' });
    const user = store.user(credentials.id);
    if (user.status !== 'active') return response.status(403).json({ error: 'Account is not active; administrator review may be required' });
    startSession(response, user);
    response.json({ user, users: store.visibleUsers(user), notifications: store.notifications(user.id) });
  });
  app.post('/api/auth/logout', (request, response) => {
    store.logout(cookieToken(request)); response.clearCookie('hfa_session', { path: '/api' }).sendStatus(204);
  });
  app.get('/api/session', authenticated, (request, response) => response.json({ user: request.user, users: store.visibleUsers(request.user), notifications: store.notifications(request.user.id) }));
  app.get('/api/notifications', authenticated, (request, response) => response.json({ notifications: store.notifications(request.user.id) }));
  app.post('/api/activities', authenticated, eventLimit, (request, response) => {
    const input = activity.parse(request.body);
    if (!store.canNotify(request.user, store.user(input.patientId))) return response.status(403).json({ error: 'You cannot create activity for this patient' });
    try { response.status(202).json(store.activity(request.user, input, config.ready, message)); }
    catch (error) { response.status(409).json({ error: 'Activity idempotency conflict' }); }
  });
  app.get('/api/deliveries/:id', authenticated, (request, response) => {
    const job = store.db.prepare('SELECT deliveries.*,activities.actor_id FROM deliveries JOIN activities ON activities.id=deliveries.activity_id WHERE deliveries.id=?').get(request.params.id);
    if (!job || (request.user.role !== 'admin' && job.patient_id !== request.user.id && job.actor_id !== request.user.id)) return response.sendStatus(404);
    response.json({ id: job.id, status: job.status, errorCode: job.error_code });
  });
  app.get('/api/whatsapp/status', authenticated, (request, response) => response.json({
    configured: config.ready, number: request.user.whatsappNumber, consent: request.user.whatsappNotificationsConsent, verifiedAt: request.user.whatsappVerifiedAt
  }));
  app.post('/api/whatsapp/preferences', authenticated, (request, response) => {
    if (request.user.role !== 'patient') return response.sendStatus(403);
    const input = z.object({ number: phone, consent: z.boolean() }).strict().parse(request.body);
    store.db.prepare('UPDATE users SET whatsapp_number=?,whatsapp_consent=?,whatsapp_consent_at=?,whatsapp_verified_at=CASE WHEN whatsapp_number=? THEN whatsapp_verified_at ELSE NULL END WHERE id=?')
      .run(input.number, input.consent ? 1 : 0,new Date().toISOString(), input.number, request.user.id);
    if (!input.consent) store.db.prepare("UPDATE deliveries SET status='blocked_consent' WHERE patient_id=? AND status IN ('queued','retry','blocked_configuration')").run(request.user.id);
    if (input.number!==request.user.whatsappNumber||input.consent!==request.user.whatsappNotificationsConsent) store.activity(request.user,{eventId:require('node:crypto').randomUUID(),patientId:request.user.id,resource:'Account'},config.ready,message);
    response.json({ user: store.user(request.user.id) });
  });
  app.post('/api/whatsapp/verification', authenticated, authLimit, (request, response) => {
    if (request.user.role !== 'patient') return response.sendStatus(403);
    if (!config.ready) return response.status(503).json({ error: 'WhatsApp provider credentials are not configured' });
    if (!request.user.whatsappNotificationsConsent) return response.status(409).json({ error: 'Opt in to WhatsApp notifications before verification' });
    response.json(provider.verification(request.user));
  });
  app.post('/api/admin/users', authenticated, admin, async (request, response) => {
    const input = registration.parse(request.body);
    if (store.credentials(input.email)) return response.status(409).json({ error: 'Email already registered' });
    const user = store.createUser({ ...input, profile: profile(input) }, await hashPassword(input.password), 'active');
    response.status(201).json({ user });
  });
  app.patch('/api/admin/users/:id', authenticated, admin, (request, response) => {
    const user = store.user(request.params.id);
    if (!user || user.role === 'admin') return response.status(403).json({ error: 'This account cannot be changed through this endpoint' });
    const patch = patchSchema.parse(request.body);
    if (user.role==='pharmacist' && patch.status==='active' && patch.pharmacyCredentialReview!==true) return response.status(409).json({error:'Confirm original pharmacy credentials were reviewed before activation'});
    if (user.role==='pharmacist' && patch.status==='active' && !pharmacyComplete(user)) return response.status(409).json({error:'Pharmacy credentials or registration documents are incomplete'});
    for (const [key, role] of [['assignedDoctor', 'doctor'], ['assignedNurse', 'nurse']]) {
      if (patch[key] && (store.user(patch[key])?.role !== role || store.user(patch[key]).status !== 'active')) return response.status(400).json({ error: 'Invalid provider assignment' });
    }
    const updated = store.updateUser(user.id, { ...patch, profile: {...(patch.consultationFee === undefined ? {} : { consultationFee: patch.consultationFee }),...(user.role==='pharmacist'&&patch.status==='active'?{pharmacyValidatedBy:request.user.id,pharmacyValidatedAt:new Date().toISOString()}: {})} });
    if (user.role === 'patient' && JSON.stringify(updated) !== JSON.stringify(user)) store.activity(request.user, { eventId: require('node:crypto').randomUUID(), patientId: user.id, resource: 'Account' }, config.ready, message);
    response.json({ user: updated });
  });
  app.get('/api/admin/users/:id/documents/:kind', authenticated, admin, (request, response) => {
    const user = store.user(request.params.id), document = user?.role === 'pharmacist' && PHARMACY_DOCUMENTS.includes(request.params.kind) ? user.pharmacyDocuments?.[request.params.kind] : null;
    const row = document && filesConfigured(config) && store.db.prepare('SELECT * FROM uploaded_files WHERE owner_id=? AND upload_id=?').get(user.id, document.id);
    if (!row) return response.sendStatus(404);
    const file = decodeFile(config, row);
    response.set('Content-Disposition', `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(file.metadata.fileName)}`);
    response.type(row.mime).send(Buffer.from(file.content, 'base64'));
  });
  app.delete('/api/admin/users/:id', authenticated, admin, (request, response) => {
    const user = store.user(request.params.id);
    if (!user || user.role === 'admin') return response.sendStatus(403);
    store.updateUser(user.id, { status: 'deleted' });
    store.db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
    response.sendStatus(204);
  });
  app.use((request, response) => response.sendStatus(404));
  app.use((error, request, response, next) => {
    if (error instanceof z.ZodError) return response.status(400).json({ error: error.issues.map(issue => `${issue.path.join('.') || 'Request'}: ${issue.message}`).join('; ') });
    if (error.type === 'entity.too.large' || error instanceof SyntaxError) return response.status(400).json({ error: 'Invalid request body' });
    response.status(500).json({ error: 'Backend request failed' });
  });
  return app;
}

async function start() {
  const config = configuration(), store = new Store(config.database);
  await bootstrap(config, store);
  const provider = new MetaProvider(config, store);
  const server = createApp(config, store, provider).listen(config.port, '0.0.0.0', () => {
    console.log(`HFA backend listening on port ${config.port}; WhatsApp delivery ${config.ready ? 'configured' : 'disabled'}`);
  });
  const worker = setInterval(() => provider.deliverNext().catch(() => console.error('WhatsApp worker failed')), 1000);
  worker.unref();
  const shutdown = () => { clearInterval(worker); server.close(() => { store.close(); process.exit(0); }); };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}

if (require.main === module) start().catch(() => { console.error('Backend startup failed; check configuration and database permissions'); process.exitCode = 1; });
module.exports = { createApp, bootstrap };