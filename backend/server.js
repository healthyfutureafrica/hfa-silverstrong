const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { z } = require('zod');
const { Store, hashPassword, verifyPassword, SESSION_TTL } = require('./store');
const { configuration, validSignature, MetaProvider } = require('./provider');
const { randomUUID } = require('node:crypto');
const { installFileRoutes, filesConfigured, fileMime, saveEncryptedFile, decodeFile } = require('./files');
const { installPharmacyRoutes } = require('./pharmacy');
const { retireDemoAccounts } = require('./retire-demo-accounts');
const { installAvatarRoutes, saveHealthRecord, withHealth } = require('./records');
const { healthProfile, recordWithConsentTimes, REGIONS } = require('./patient-profile');
const { installFacilityRoutes } = require('./facilities');
const { installAdminAccessRoutes, RETURN_COOKIE } = require('./admin-access');
const { installAccountSecurity } = require('./account-security');
const { installPrivacyRoutes } = require('./privacy');
const { installTriageRoutes } = require('./triage');
const { aiConfigured } = require('./triage-ai');
const { WhatsAppTriage } = require('./whatsapp-triage');
const { installAiAssistRoutes } = require('./ai-assist');
const { installClinicalRoutes } = require('./clinical');
const { Payments, installPaymentRoutes, installPaymentWebhook, mtnConfig } = require('./payments');
const { installCallRoutes } = require('./calls');
const { installAccountRecovery } = require('./account-recovery');
const { installNotifyRoutes } = require('./notify');
const { installDoctorPhotoRoutes } = require('./doctor-photos');
const { installHubStats } = require('./hub-stats');
const { installGovernanceRoutes } = require('./governance');
const { passwordProblem } = require('./account-security');

const message = 'HFA SilverStrong: New activity on your account needs your attention. Sign in securely to review it. This is an automated notification. Do not reply.';
const plain = z.string().trim().min(1).max(200).regex(/^[^<>&"\u0000-\u001f]+$/);
const personName=plain.regex(/^[\p{L}\p{M}\p{N} .'-]+$/u);
const contactPhone=z.string().max(40).regex(/^[+0-9\s()-]*$/);
const phone = z.string().regex(/^\+[1-9]\d{7,14}$/);
const MAX_REGISTRATION_DOCUMENT=2*1024*1024;
const uploadedDocument=z.object({fileName:z.string().min(1).max(180).regex(/^[^<>\u0000-\u001f/\\]+$/),content:z.string().min(4).max(Math.ceil(MAX_REGISTRATION_DOCUMENT/3)*4).regex(/^[A-Za-z0-9+/]+={0,2}$/)}).strict();
const registration = z.object({
  name: personName, email: z.string().email().max(254).transform(value => value.toLowerCase()).optional(),
  password: z.string().min(12).max(128).regex(/\S/), role: z.enum(['patient', 'doctor', 'nurse', 'labtech', 'pharmacist']),
  phone: contactPhone.optional(), whatsappNumber: phone.optional(), whatsappNotificationsConsent: z.boolean().optional(),
  specialty: plain.optional(), hospital: plain.optional(), department: plain.optional(), consultationFee: z.number().min(5).max(20).optional(),
  // Professional licence (Ordre National des Médecins / nursing council number), verified by an administrator.
  licenseNo: z.string().trim().max(60).regex(/^[A-Za-z0-9 ./-]*$/).optional(), qualifications: plain.optional(),
  idDocumentType: z.enum(['national_id','passport']).optional(), idDocument: uploadedDocument.optional(),
  preferredLanguage: z.enum(['en','fr']).optional(), healthProfile: healthProfile.optional(), vaccinationDocument: uploadedDocument.optional(),
  hospitalId: z.string().max(100).optional(), hospitalOther: plain.optional(),
  laboratory: plain.optional(), labRegion: z.enum(REGIONS).optional(), labTown: plain.optional()
}).strict().superRefine((input, context) => {
  if (input.role !== 'patient' && (input.hospitalId || input.hospitalOther)) context.addIssue({ code: 'custom', path: ['hospitalId'], message: 'Only patients register under a hospital' });
  // Only patients may register without an email; they then sign in with their primary phone number.
  if (input.role !== 'patient' && !input.email) context.addIssue({ code: 'custom', path: ['email'], message: 'Required' });
  if (input.role === 'patient' && !input.whatsappNumber && !phone.safeParse(input.phone).success) context.addIssue({ code: 'custom', path: ['phone'], message: 'Patient phone number is required in international format, e.g. +237677123456' });
  if (input.role === 'patient' && !input.email && !phone.safeParse(input.phone).success) context.addIssue({ code: 'custom', path: ['phone'], message: 'A phone number in international format is required when no email is given' });
  if (input.role !== 'patient' && (input.healthProfile || input.vaccinationDocument)) context.addIssue({ code: 'custom', path: ['healthProfile'], message: 'Only patients have a health profile' });
  if (input.role === 'pharmacist') context.addIssue({ code: 'custom', path: ['role'], message: 'Pharmacies register with their documents at /api/auth/register/pharmacist' });
});
// Pharmacies must submit every credential document with the application; activation is gated on all of them.
const PHARMACY_FIELDS=['pharmacyName','pharmacyAddress','pharmacyLocation','pharmacyLicense','businessRegistration','minsanteAuthorization','ownerName','ownerIdType','ownerIdNumber'];
const PHARMACY_DOCUMENTS=['pharmacistLicense','businessLicense','minsanteAuthorization','ownerIdentity'];
const pharmacyRegistration=z.object({
  name: personName, email: z.string().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(12).max(128).regex(/\S/), phone: contactPhone.optional(),
  pharmacyName:plain,pharmacyAddress:plain,pharmacyLocation:plain,pharmacyLicense:plain,businessRegistration:plain,minsanteAuthorization:plain,
  ownerName:personName,ownerIdType:z.enum(['national_id','passport']),ownerIdNumber:plain,
  pharmacyRegion:z.enum(REGIONS).optional(),pharmacyTown:plain.optional(),
  documents:z.object(Object.fromEntries(PHARMACY_DOCUMENTS.map(kind=>[kind,uploadedDocument]))).strict()
}).strict();
const resources = ['Account', 'Communications', 'Appointments', 'Medical Records', 'Lab Results', 'Care Notes', 'Care Coordination', 'Billing', 'Home Visits', 'Urgent Care'];
const activity = z.object({ eventId: z.string().min(8).max(100), patientId: z.string().min(1).max(100), resource: z.enum(resources) }).strict();
const patchSchema = z.object({
  name: personName.optional(), phone: contactPhone.optional(), status: z.enum(['active', 'suspended', 'pending_approval', 'rejected']).optional(),
  assignedDoctor: z.string().max(100).nullable().optional(), assignedNurse: z.string().max(100).nullable().optional(),
  consultationFee: z.number().min(5).max(20).optional(),
  pharmacyCredentialReview:z.boolean().optional(),
  idVerificationStatus:z.enum(['verified','rejected']).optional()
}).strict();
// Returns the decoded file, or an error message naming the field.
function decodeDocument(field,document) {
  const bytes=Buffer.from(document.content,'base64'),mime=fileMime(bytes);
  if (!bytes.length||bytes.length>MAX_REGISTRATION_DOCUMENT) return {error:`${field}: File must be between 1 byte and 2 MB`};
  if (!mime) return {error:`${field}: Only PDF, PNG, JPEG and WebP files are accepted`};
  return {bytes,mime,fileName:document.fileName};
}
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
  app.get('/api/config', (request, response) => response.json({ backend: true, providerConfigured: config.ready, fileUploadsConfigured: filesConfigured(config), requireAdminMfa: !!config.requireAdminMfa, aiTriage: aiConfigured(config), paymentsAvailable: app.locals.payments?.available || false }));
  app.get('/api/whatsapp/webhook', (request, response) => {
    if (!config.verifyToken || request.query['hub.mode'] !== 'subscribe' || request.query['hub.verify_token'] !== config.verifyToken || typeof request.query['hub.challenge'] !== 'string') return response.sendStatus(403);
    response.type('text/plain').send(request.query['hub.challenge']);
  });
  app.post('/api/whatsapp/webhook', express.raw({ type: 'application/json', limit: '1mb' }), (request, response) => {
    if (!Buffer.isBuffer(request.body) || !validSignature(request.body, request.headers['x-hub-signature-256'], config.appSecret)) return response.sendStatus(401);
    try { provider.webhook(JSON.parse(request.body.toString('utf8'))); response.sendStatus(200); }
    catch (error) { response.sendStatus(400); }
  });
  // MTN Mobile Money: amounts decided here, results only from MTN. Its callback must come before the origin guard.
  const payments = new Payments(config, store, { mtn: config.mtn || mtnConfig(), client: config.mtnClient || null });
  app.locals.payments = payments;
  installPaymentWebhook(app, payments);
  // Live calls poll for connection messages and have their own per-person limit (backend/calls.js).
  app.use('/api', rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false, skip: request => /^\/v1\/calls\/[^/]+\/signals$/.test(request.path) }));
  const smallJson=express.json({ limit: '32kb' });
  const documentRoutes = ['/api/auth/register', '/api/auth/register/pharmacist', '/api/v1/account/id-document', '/api/v1/doctor-photo'];
  app.use((request, response, next) => documentRoutes.includes(request.path) || /^\/api\/v1\/clinical\/[^/]+\/[^/]+$/.test(request.path) || /^\/api\/v1\/users\/[^/]+\/health-profile$/.test(request.path) ? next() : smallJson(request, response, next));
  app.use('/api', (request, response, next) => {
    response.set('Cache-Control', 'no-store');
    if (['POST', 'PATCH', 'DELETE'].includes(request.method) &&
      (request.headers['x-hfa-request'] !== '1' || (request.headers.origin && request.headers.origin !== config.origin))) return response.status(403).json({ error: 'Invalid request origin' });
    next();
  });

  const authenticated = (request, response, next) => {
    const details = store.sessionDetails(cookieToken(request));
    if (!details) return response.status(401).json({ error: 'Sign in required' });
    request.user = details.user;
    request.impersonator = details.impersonator; // set while a Super Admin is signed in as this account
    next();
  };
  // Administrators need two-step sign-in before admin tools work (REQUIRE_ADMIN_MFA=false turns this off).
  const admin = (request, response, next) => {
    if (request.user.role !== 'admin') return response.status(403).json({ error: 'Administrator required' });
    if (config.requireAdminMfa && !request.user.mfaEnabled) return response.status(403).json({ error: 'Set up two-step sign-in to use admin tools', code: 'mfa_required' });
    next();
  };
  installFileRoutes(app,config,store,authenticated);
  installPharmacyRoutes(app,store,authenticated);
  installAvatarRoutes(app,config,store,authenticated);
  installFacilityRoutes(app,store,authenticated,admin);
  installAdminAccessRoutes(app,config,store,authenticated,admin,{ cookieToken, withHealth });
  installPrivacyRoutes(app,config,store,authenticated,admin);
  installGovernanceRoutes(app,config,store,authenticated,admin);
  installTriageRoutes(app,config,store,authenticated);
  installAiAssistRoutes(app,config,store,authenticated);
  installClinicalRoutes(app,config,store,authenticated);
  installPaymentRoutes(app,config,store,authenticated,payments);
  installCallRoutes(app,config,store,authenticated);
  // Only failed attempts count, so switching between valid accounts is not blocked but guessing is.
  const authLimit = rateLimit({ windowMs: 15 * 60000, limit: 10, skipSuccessfulRequests: true, standardHeaders: 'draft-8', legacyHeaders: false });
  const eventLimit = rateLimit({ windowMs: 60000, limit: 20, keyGenerator: request => request.user.id, standardHeaders: 'draft-8', legacyHeaders: false });
  const startSession = (response, user) => response.cookie('hfa_session', store.createSession(user.id), {
    httpOnly: true, sameSite: 'strict', secure: config.origin.startsWith('https://'), path: '/api', maxAge: SESSION_TTL
  });
  const sessionPayload = user => ({ user: withHealth(config, store, user, [user])[0], users: withHealth(config, store, user, store.visibleUsers(user)), notifications: store.notifications(user.id) });
  const security = installAccountSecurity(app, config, store, authenticated, { authLimit, startSession, sessionPayload, cookieToken });
  installAccountRecovery(app, store, authenticated, admin, { authLimit, passwordProblem });
  installNotifyRoutes(app, config, store, authenticated);
  installDoctorPhotoRoutes(app, config, store, authenticated, admin);
  installHubStats(app, store, authenticated, admin);
  // Replace one's own identity document (CNI or passport) after registration; an administrator then verifies it.
  app.post('/api/v1/account/id-document', authenticated, express.json({ limit: '4mb' }), (request, response) => {
    if (request.impersonator || request.user.role === 'admin') return response.status(403).json({ error: 'Only the account holder can upload their identity document' });
    if (!filesConfigured(config)) return response.status(503).json({ error: 'Encrypted document storage is not configured' });
    const input = z.object({ idDocumentType: z.enum(['national_id','passport']), idDocument: uploadedDocument }).strict().parse(request.body);
    const identity = decodeDocument('idDocument', input.idDocument);
    if (identity.error) return response.status(400).json({ error: identity.error });
    const idDocument = { id: randomUUID(), fileName: identity.fileName, mime: identity.mime, size: identity.bytes.length };
    store.db.exec('BEGIN IMMEDIATE');
    try {
      saveEncryptedFile(config, store, request.user.id, idDocument.id, { fileName: identity.fileName, category: 'registration:identity', notes: '', relatedApptId: '' }, identity.bytes, identity.mime);
      store.updateUser(request.user.id, { profile: { idDocumentType: input.idDocumentType, idDocument, idVerificationStatus: 'pending', idUploadedAt: new Date().toISOString() } });
      store.audit(request.user.id, 'ID_DOCUMENT_UPLOADED', { targetId: request.user.id, ip: request.ip });
      store.db.exec('COMMIT');
    } catch (error) { store.db.exec('ROLLBACK'); throw error; }
    response.status(201).json({ user: store.user(request.user.id) });
  });
  const profile = input => Object.fromEntries(['specialty', 'hospital', 'department', 'consultationFee', 'licenseNo', 'qualifications', 'laboratory', 'labRegion', 'labTown', 'hospitalOther'].filter(key => input[key] !== undefined).map(key => [key, input[key]]));
  // A patient may only register under a hospital that is on the public list (has active clinicians).
  const listedHospital = id => id ? store.listedHospitals().find(hospital => hospital.id === id) : null;

  app.post('/api/auth/register', authLimit, express.json({ limit: '7mb' }), async (request, response) => {
    const input = registration.parse(request.body);
    if (input.role === 'labtech') return response.status(403).json({ error: 'Administrator provisions laboratory staff' });
    if ((input.healthProfile || input.vaccinationDocument) && !filesConfigured(config)) return response.status(503).json({ error: 'Encrypted health record storage is not configured' });
    if (input.hospitalId && !listedHospital(input.hospitalId)) return response.status(400).json({ error: 'hospitalId: Choose a hospital from the list' });
    let vaccination = null;
    if (input.vaccinationDocument) {
      vaccination = decodeDocument('vaccinationDocument', input.vaccinationDocument);
      if (vaccination.error) return response.status(400).json({ error: vaccination.error });
    }
    let identity = null;
    if (input.idDocument) {
      if (!filesConfigured(config)) return response.status(503).json({ error: 'Encrypted document storage is not configured' });
      if (!input.idDocumentType) return response.status(400).json({ error: 'idDocumentType: Required with an identity document' });
      identity = decodeDocument('idDocument', input.idDocument);
      if (identity.error) return response.status(400).json({ error: identity.error });
    }
    const taken = () => (input.email && store.credentials(input.email)) ? 'Email already registered'
      : (input.role === 'patient' && phone.safeParse(input.phone).success && store.credentialsByPhone(input.phone)) ? 'Phone number already registered' : null;
    if (taken()) return response.status(409).json({ error: taken() });
    const passwordHash = await hashPassword(input.password);
    const idDocument = identity && { id: randomUUID(), fileName: identity.fileName, mime: identity.mime, size: identity.bytes.length };
    const vaccinationDocument = vaccination && { id: randomUUID(), fileName: vaccination.fileName, mime: vaccination.mime, size: vaccination.bytes.length };
    const { healthProfile: health, vaccinationDocument: unusedDocument, hospitalId, ...account } = input;
    account.facilityId = hospitalId || undefined;
    store.db.exec('BEGIN IMMEDIATE');
    let user;
    try {
      if (taken()) { const error = taken(); store.db.exec('ROLLBACK'); return response.status(409).json({ error }); }
      user = store.createUser({ ...account, profile: { ...profile(input), ...(input.preferredLanguage ? { preferredLanguage: input.preferredLanguage } : {}),
        ...(idDocument ? { idDocumentType: input.idDocumentType, idDocument, idVerificationStatus: 'pending' } : {}),
        ...(vaccinationDocument ? { vaccinationDocument } : {}), ...(health ? { registrationCompletedAt: new Date().toISOString() } : {}) } }, passwordHash, input.role === 'patient' ? 'active' : 'pending_approval');
      if (idDocument) saveEncryptedFile(config, store, user.id, idDocument.id, { fileName: idDocument.fileName, category: 'registration:identity', notes: '', relatedApptId: '' }, identity.bytes, identity.mime);
      if (vaccinationDocument) saveEncryptedFile(config, store, user.id, vaccinationDocument.id, { fileName: vaccinationDocument.fileName, category: 'Vaccination record', notes: 'Uploaded at registration', relatedApptId: '' }, vaccination.bytes, vaccination.mime);
      if (health) saveHealthRecord(config, store, user.id, recordWithConsentTimes(health));
      store.db.exec('COMMIT');
    } catch (error) { store.db.exec('ROLLBACK'); throw error; }
    if (user.status === 'active') startSession(response, user);
    const [own] = withHealth(config, store, user, [user]);
    response.status(201).json({ user: own, users: user.status === 'active' ? withHealth(config, store, user, store.visibleUsers(user)) : [] });
  });
  // "Complete my profile": a signed-in patient saves or updates the 5-step health profile.
  const healthUpdate = z.object({
    preferredLanguage: z.enum(['en','fr']).optional(), healthProfile, vaccinationDocument: uploadedDocument.optional(),
    idDocumentType: z.enum(['national_id','passport']).optional(), idDocument: uploadedDocument.optional(),
    hospitalId: z.string().max(100).nullable().optional(), hospitalOther: plain.nullable().optional()
  }).strict();
  app.put('/api/v1/users/:id/health-profile', authenticated, express.json({ limit: '7mb' }), (request, response) => {
    if (request.params.id !== request.user.id || request.user.role !== 'patient') return response.status(403).json({ error: 'Only the patient can update this health profile' });
    if (!filesConfigured(config)) return response.status(503).json({ error: 'Encrypted health record storage is not configured' });
    const input = healthUpdate.parse(request.body);
    if (!!input.idDocument !== !!input.idDocumentType) return response.status(400).json({ error: 'idDocumentType: Required with an identity document' });
    if (input.hospitalId && !listedHospital(input.hospitalId)) return response.status(400).json({ error: 'hospitalId: Choose a hospital from the list' });
    const vaccination = input.vaccinationDocument && decodeDocument('vaccinationDocument', input.vaccinationDocument);
    if (vaccination?.error) return response.status(400).json({ error: vaccination.error });
    const identity = input.idDocument && decodeDocument('idDocument', input.idDocument);
    if (identity?.error) return response.status(400).json({ error: identity.error });
    const patch = { ...(input.preferredLanguage ? { preferredLanguage: input.preferredLanguage } : {}), healthProfileUpdatedAt: new Date().toISOString() };
    const userId = request.user.id;
    store.db.exec('BEGIN IMMEDIATE');
    try {
      if (vaccination) {
        patch.vaccinationDocument = { id: randomUUID(), fileName: vaccination.fileName, mime: vaccination.mime, size: vaccination.bytes.length };
        saveEncryptedFile(config, store, userId, patch.vaccinationDocument.id, { fileName: vaccination.fileName, category: 'Vaccination record', notes: 'Uploaded with health profile', relatedApptId: '' }, vaccination.bytes, vaccination.mime);
      }
      if (identity) {
        patch.idDocumentType = input.idDocumentType; patch.idVerificationStatus = 'pending';
        patch.idDocument = { id: randomUUID(), fileName: identity.fileName, mime: identity.mime, size: identity.bytes.length };
        saveEncryptedFile(config, store, userId, patch.idDocument.id, { fileName: identity.fileName, category: 'registration:identity', notes: '', relatedApptId: '' }, identity.bytes, identity.mime);
      }
      saveHealthRecord(config, store, userId, recordWithConsentTimes(input.healthProfile));
      if (input.hospitalId !== undefined) store.setPatientFacility(userId, input.hospitalId || null);
      if (input.hospitalOther !== undefined) patch.hospitalOther = input.hospitalOther || null;
      store.updateUser(userId, { profile: patch });
      store.db.exec('COMMIT');
    } catch (error) { store.db.exec('ROLLBACK'); throw error; }
    const user = store.user(userId);
    response.json({ user: withHealth(config, store, user, [user])[0] });
  });
  app.post('/api/auth/register/pharmacist', authLimit, express.json({ limit: '12mb' }), async (request, response) => {
    if (!filesConfigured(config)) return response.status(503).json({ error: 'Encrypted document storage is not configured; pharmacy registration is unavailable' });
    const input = pharmacyRegistration.parse(request.body);
    const documents = {};
    for (const kind of PHARMACY_DOCUMENTS) {
      documents[kind] = decodeDocument(`documents.${kind}`, input.documents[kind]);
      if (documents[kind].error) return response.status(400).json({ error: documents[kind].error });
    }
    if (store.credentials(input.email)) return response.status(409).json({ error: 'Email already registered' });
    const passwordHash = await hashPassword(input.password);
    const pharmacyDocuments = Object.fromEntries(PHARMACY_DOCUMENTS.map(kind => [kind, { id: randomUUID(), fileName: documents[kind].fileName, mime: documents[kind].mime, size: documents[kind].bytes.length }]));
    store.db.exec('BEGIN IMMEDIATE');
    try {
      if (store.credentials(input.email)) { store.db.exec('ROLLBACK'); return response.status(409).json({ error: 'Email already registered' }); }
      const user = store.createUser({ ...input, role: 'pharmacist', profile: { ...Object.fromEntries(PHARMACY_FIELDS.map(field => [field, input[field]])), ...(input.pharmacyRegion ? { pharmacyRegion: input.pharmacyRegion } : {}), ...(input.pharmacyTown ? { pharmacyTown: input.pharmacyTown } : {}), pharmacyDocuments } }, passwordHash, 'pending_approval');
      for (const kind of PHARMACY_DOCUMENTS) saveEncryptedFile(config, store, user.id, pharmacyDocuments[kind].id, { fileName: documents[kind].fileName, category: 'pharmacy_registration:' + kind, notes: '', relatedApptId: '' }, documents[kind].bytes, documents[kind].mime);
      store.db.exec('COMMIT');
      response.status(201).json({ user, users: [] });
    } catch (error) { store.db.exec('ROLLBACK'); throw error; }
  });
  app.post('/api/auth/login', authLimit, async (request, response) => {
    // "email" carries either an email address or a primary phone number (patients without email).
    const input = z.object({ email: z.string().trim().min(3).max(254), password: z.string().min(1).max(128) }).strict().parse(request.body);
    const credentials = input.email.includes('@') ? store.credentials(input.email) : store.credentialsByPhone(input.email);
    const valid=await verifyPassword(input.password,credentials?.password_hash||`00000000000000000000000000000000:${'0'.repeat(128)}`);
    if (!credentials || !valid) return response.status(401).json({ error: 'Invalid email or password' });
    const user = store.user(credentials.id);
    if (user.status !== 'active') return response.status(403).json({ error: 'Account is not active; administrator review may be required' });
    // Two-step sign-in: no session until the code from the authenticator app is checked (POST /api/auth/mfa).
    const challenge = security.challengeFor(user);
    if (challenge) return response.json({ mfaRequired: true, challenge });
    startSession(response, user);
    response.json(sessionPayload(user));
  });
  app.post('/api/auth/logout', (request, response) => {
    store.logout(cookieToken(request));
    // Signing out while signed in as someone else also ends the administrator's own session.
    const returnCookie = (request.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(RETURN_COOKIE + '='));
    if (returnCookie) store.logout(returnCookie.slice(RETURN_COOKIE.length + 1));
    response.clearCookie(RETURN_COOKIE, { path: '/api' }).clearCookie('hfa_session', { path: '/api' }).sendStatus(204);
  });
  // Lets a visitor's browser ask whether it is signed in without an error response (no session details).
  app.get('/api/session/status', (request, response) => response.json({ signedIn: !!store.sessionDetails(cookieToken(request)) }));
  app.get('/api/session', authenticated, (request, response) => response.json({ user: withHealth(config, store, request.user, [request.user])[0], users: withHealth(config, store, request.user, store.visibleUsers(request.user)), notifications: store.notifications(request.user.id),
    ...(request.impersonator ? { impersonatedBy: { id: request.impersonator.id, name: request.impersonator.name } } : {}) }));
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
    if ((input.email && store.credentials(input.email)) || (!input.email && store.credentialsByPhone(input.phone))) return response.status(409).json({ error: 'Email or phone already registered' });
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
    const updated = store.updateUser(user.id, { ...patch, profile: {...(patch.consultationFee === undefined ? {} : { consultationFee: patch.consultationFee }),...(user.role==='pharmacist'&&patch.status==='active'?{pharmacyValidatedBy:request.user.id,pharmacyValidatedAt:new Date().toISOString()}: {}),...(patch.idVerificationStatus?{idVerificationStatus:patch.idVerificationStatus,idVerifiedBy:request.user.id,idVerifiedAt:new Date().toISOString()}:{})} });
    if (JSON.stringify(updated) !== JSON.stringify(user)) store.audit(request.user.id, 'ACCOUNT_UPDATED_BY_ADMIN', { targetId: user.id, details: { fields: Object.keys(patch) }, ip: request.ip });
    if (user.role === 'patient' && JSON.stringify(updated) !== JSON.stringify(user)) store.activity(request.user, { eventId: require('node:crypto').randomUUID(), patientId: user.id, resource: 'Account' }, config.ready, message);
    response.json({ user: updated });
  });
  app.get('/api/admin/users/:id/documents/:kind', authenticated, admin, (request, response) => {
    const user = store.user(request.params.id), kind = request.params.kind;
    const document = kind === 'identity' ? user?.idDocument : user?.role === 'pharmacist' && PHARMACY_DOCUMENTS.includes(kind) ? user.pharmacyDocuments?.[kind] : null;
    const row = document && filesConfigured(config) && store.db.prepare('SELECT * FROM uploaded_files WHERE owner_id=? AND upload_id=?').get(user.id, document.id);
    if (!row) return response.sendStatus(404);
    const file = decodeFile(config, row);
    store.audit(request.user.id, 'DOCUMENT_VIEWED', { targetId: user.id, details: { kind }, ip: request.ip });
    response.set('Content-Disposition', `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(file.metadata.fileName)}`);
    response.type(row.mime).send(Buffer.from(file.content, 'base64'));
  });
  app.delete('/api/admin/users/:id', authenticated, admin, (request, response) => {
    const user = store.user(request.params.id);
    if (!user || user.role === 'admin') return response.sendStatus(403);
    store.updateUser(user.id, { status: 'deleted' });
    store.db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
    store.audit(request.user.id, 'ACCOUNT_DELETED', { targetId: user.id, details: { role: user.role }, ip: request.ip });
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
  const retired = retireDemoAccounts(store);
  if (retired) console.log(`Retired ${retired} demo account(s) left by an earlier version`);
  const provider = new MetaProvider(config, store);
  // SLY Triage answers people who write to the HFA WhatsApp number (free replies; no separate bot service).
  const whatsappTriage = new WhatsAppTriage(config, store);
  provider.onText = (phone, text) => whatsappTriage.handle(phone, text);
  setInterval(() => whatsappTriage.sweep(), 10 * 60000).unref();
  const app = createApp(config, store, provider);
  const paymentWorker = setInterval(() => app.locals.payments.pollDue().catch(() => console.error('Payment status check failed')), 5000);
  paymentWorker.unref();
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`HFA backend listening on port ${config.port}; WhatsApp delivery ${config.ready ? 'configured' : 'disabled'}`);
  });
  const worker = setInterval(() => provider.deliverNext().catch(() => console.error('WhatsApp worker failed')), 1000);
  worker.unref();
  const shutdown = () => { clearInterval(worker); server.close(() => { store.close(); process.exit(0); }); };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}

if (require.main === module) start().catch(() => { console.error('Backend startup failed; check configuration and database permissions'); process.exitCode = 1; });
module.exports = { createApp, bootstrap };