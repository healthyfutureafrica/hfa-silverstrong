const fs = require('fs');
const path = require('path');

describe('index.html sanity checks', () => {
  const indexPath = path.join(__dirname, '..', 'index.html');
  let content;

  beforeAll(() => {
    content = fs.readFileSync(indexPath, 'utf8');
  });

  test('file exists and is not empty', () => {
    expect(content).toBeTruthy();
    expect(content.length).toBeGreaterThan(0);
  });

  test('has a closing </html> element', () => {
    expect(content.toLowerCase()).toContain('</html>');
  });

  test('has a title tag', () => {
    expect(content.toLowerCase()).toMatch(/<title>.*<\/title>/);
  });

  test('includes the patient provider rating section', () => {
    expect(content).toContain('Rate Your Care Team');
    expect(content).toContain('function renderProviderRatings');
    expect(content).toContain('function saveRating');
    expect(content).toContain('name="provider-rating"');
  });

  test('includes expanded doctor specialties', () => {
    expect(content).toContain('<option>Physiotherapy</option>');
    expect(content).toContain('<option>Psychiatry</option>');
    expect(content).toContain('<option>Clinical Psychology</option>');
    expect(content).toContain("const SPECIALTIES = [");
    expect(content).toContain("'Mental Health'");
    expect(content).toContain('id="rsp" required');
  });

  test('includes nursing specialties across nurse onboarding and profiles', () => {
    expect(content).toContain('id="rns"');
    expect(content).toContain('Psychiatric and Mental Health Nursing');
    expect(content).toContain('const NURSE_SPECIALTIES = [');
    expect(content).toContain('id="au-ns"');
    expect(content).toContain("specialty:$('rns').value");
    expect(content).toContain('id="rns" required');
    expect(content).toContain("Please select your medical specialty.");
    expect(content).toContain("Please select your nursing specialty.");
  });

  test('includes standards-aware virtual care data', () => {
    expect(content).toContain("system:'ICD-10-CM'");
    expect(content).toContain("system:'LOINC'");
    expect(content).toContain("system:'RxNorm'");
    expect(content).toContain('const VIRTUAL_SERVICES = [');
    expect(content).toContain("code:'MENTAL-VIRTUAL'");
    expect(content).toContain("code:'PHYSIO-VIRTUAL'");
    expect(content).toContain("encounterClass:'VR'");
    expect(content).toContain('function showBookApt(serviceCode=');
  });

  test('includes patient safety and longitudinal care workflows', () => {
    expect(content).toContain('function showTriage');
    expect(content).toContain('function submitTriage');
    expect(content).toContain('triageCases: []');
    expect(content).toContain('function renderCarePlan');
    expect(content).toContain('carePlans: [');
    expect(content).toContain('Call your local emergency number');
  });

  test('includes multi-admin governance controls', () => {
    expect(content).toContain("id:'adm2',role:'admin'");
    expect(content).toContain("id:'mgr-a',l:'Administrators'");
    expect(content).toContain('function renderAdminControl');
    expect(content).toContain('function renderIntegrations');
    expect(content).toContain('function renderTriageQueue');
    expect(content).toContain('function renderSafety');
    expect(content).toContain("role==='admin'?{adminRole:");
  });

  test('keeps demo credentials inside the admin portal only', () => {
    expect(content).not.toContain('<strong>Demo Credentials</strong>');
    expect(content).toContain('Testing Access');
    expect(content).toContain('Admin-only demo credentials');
    expect(content).toContain("DB.users.filter(u=>['admin','doctor','nurse','patient','pharmacist','lab','ambulance'].includes(u.role)&&u.password)");
    expect(content).toContain('${renderDemoCredentials()}');
  });

  test('provisions Chinjie as the Super Admin', () => {
    expect(content).toContain("email:'chinjiesylvestern@gmail.com'");
    expect(content).toContain("adminRole:'Super Admin'");
    expect(content).toContain("permissions:['all']");
  });

  test('uses the HFA logo asset across the app', () => {
    expect(fs.existsSync(path.join(__dirname, '..', 'assets', 'hfa-logo.svg'))).toBe(true);
    expect((content.match(/assets\/hfa-logo\.svg/g) || []).length).toBe(5);
    expect(content).toContain('alt="HFA SilverStrong logo"');
  });

  test('provides a public non-admin demo entry point', () => {
    expect(content).toContain('onclick="startDemo(\'patient\')"');
    expect(content).toContain("function startDemo(role='patient')");
    expect(content).toContain("user.role===role&&user.status==='active'");
  });

  test('includes bilingual legal privacy and confidentiality pages', () => {
    expect(content).toContain('function renderCompliance');
    expect(content).toContain('function renderPrivacy');
    expect(content).toContain('function renderConfidentiality');
    expect(content).toContain('Cameroon Law No. 2010/012');
    expect(content).toContain('GDPR-Aligned Architecture');
    expect(content).toContain('ANTIC Registration');
    expect(content).toContain('Right to Rectification');
    expect(content).toContain('Medical Records');
    expect(content).toContain('10 yr');
    expect(content).toContain('Medical secrecy is a professional and criminal obligation under Cameroon law');
    expect(content).toContain("log('INCIDENT_REPORT'");
    expect(content).toContain("log('CONFIDENTIALITY_PLEDGE'");
    expect(content).toContain("incident_report_action:'Signalement d\\'incident'");
    expect(content).toContain("confidentiality_pledge_action:'Engagement de confidentialité'");
  });

  test('keeps Compliance Centre out of patient navigation', () => {
    expect(content).toContain("{s:()=>t('legal_privacy'),items:[{id:'privacy',l:()=>t('privacy_nav'),i:'file'},{id:'confidentiality',l:()=>t('confidentiality_nav'),i:'clip'}]}");
    expect(content).toContain("{id:'compliance',l:()=>t('compliance_nav'),i:'shield'}");
  });

  test('starts at language choice and lets users choose again', () => {
    expect(content).toContain("LANG_RETURN_SCREEN = 'land'");
    expect(content).toContain('function openLangPicker');
    expect(content).toContain('function restoreAfterLanguageChoice');
    expect(content).toContain("show('lang-pick')");
    expect(content).toContain('id="lnd-lang"');
    expect(content).toContain('id="auth-lang-btn"');
    expect(content).toContain('id="fh-lang"');
    expect(content).toContain('id="slb-pick"');
  });

  // ── Walkthrough parity: every capability shown in the HFA Portal Walkthrough video ──
  test('adds Pharmacist and Laboratory portals with HFA IDs and registration', () => {
    expect(content).toContain("pharmacist:'PH', lab:'LB', ambulance:'AM'");
    expect(content).toContain('HFA-(DR|NS|PT|AD|PH|LB|AM)');
    expect(content).toContain('NAV.pharmacist = [');
    expect(content).toContain('NAV.lab = [');
    expect(content).toContain("setRole('pharmacist')");
    expect(content).toContain("setRole('lab')");
    expect(content).toContain('function markRxReady');
    expect(content).toContain('function submitLabResults');
    expect(content).toContain("'mgr-ph'");
    expect(content).toContain("'mgr-lb'");
  });

  test('supports e-prescribing with interaction and allergy screening', () => {
    expect(content).toContain('function showPrescription');
    expect(content).toContain('function checkPrescription');
    expect(content).toContain('const RX_INTERACTIONS = [');
    expect(content).toContain('const RX_ALLERGY_CLASSES = [');
    expect(content).toContain('Submit Prescription → Pharmacy');
    expect(content).toContain("issues.some(i=>i.sev==='major') && !$('rx-ovr').checked");
  });

  test('supports lab orders, flagged results, clinical notes and care-plan updates', () => {
    expect(content).toContain('const LAB_TESTS = {');
    expect(content).toContain('function labFlag');
    expect(content).toContain('function showLabReview');
    expect(content).toContain('Update Care Plan & Release');
    expect(content).toContain("loinc:'58410-2'");
  });

  test('lets nurses record vital signs that sync to the record and alert the doctor', () => {
    expect(content).toContain('function showVitals');
    expect(content).toContain('function assessVitals');
    expect(content).toContain('Save & Sync to Record');
    expect(content).toContain("['8480-6','Systolic blood pressure'");
    expect(content).toContain('function nurseTodayHTML');
    expect(content).toContain('function flagFollowUp');
  });

  test('gives patients a Vital Health Card, SOS alert, quick tiles and next-appointment join', () => {
    expect(content).toContain('function vitalCardHTML');
    expect(content).toContain('Genotype');
    expect(content).toContain('function showSOS');
    expect(content).toContain('function sendSOS');
    expect(content).toContain("const EMERGENCY_NUMBER = '119'");
    expect(content).toContain('navigator.geolocation.getCurrentPosition');
    expect(content).toContain('function patientHubHTML');
    expect(content).toContain('function joinAppointment');
    expect(content).toContain('function renderEmergencies');
  });

  test('offers the public SLY Symptom Checker with danger-sign triage', () => {
    expect(content).toContain('id="sly-pub"');
    expect(content).toContain('onclick="goSly()"');
    expect(content).toContain('const SLY_SYMPTOMS = [');
    expect(content).toContain('const SLY_GENERAL_DANGER = [');
    expect(content).toContain('No danger signs detected');
    expect(content).toContain('function slyResult');
  });

  test('works offline for 7 days with a service worker and local store', () => {
    expect(content).toContain('<link rel="manifest" href="manifest.webmanifest">');
    expect(content).toContain("navigator.serviceWorker.register('sw.js')");
    expect(content).toContain('const OFFLINE_DAYS = 7;');
    expect(content).toContain('function persistDB');
    expect(content).toContain('async function restoreDB');
    expect(fs.existsSync(path.join(__dirname, '..', 'sw.js'))).toBe(true);
    expect(fs.existsSync(path.join(__dirname, '..', 'manifest.webmanifest'))).toBe(true);
  });

  test('shows admin platform KPIs, support tickets and contact details', () => {
    expect(content).toContain('function adminKpiHTML');
    expect(content).toContain('Pending support tickets');
    expect(content).toContain('function renderSupport');
    expect(content).toContain('function verifyProvider');
    expect(content).toContain('csn@healthyfutureafrica.org');
    expect(content).toContain('Join as Clinician');
  });

  test('adds in-call chat, notes and Vital Health Card to video consultations', () => {
    expect(content).toContain("onclick=\"togVcPanel('chat')\"");
    expect(content).toContain("onclick=\"togVcPanel('notes')\"");
    expect(content).toContain("onclick=\"togVcPanel('card')\"");
    expect(content).toContain('function saveVcNotes');
  });

  test('prices plans in XAF: Essential 1,000, Basic 3,000, Premium 10,000', () => {
    expect(content).toContain('const PLAN_PRICES_XAF = {free: 0, essential: 1000, basic: 3000, premium: 10000};');
    expect(content).toContain("subscription_tier_essential:'Essential (XAF 1,000/month)'");
    expect(content).toContain("subscription_tier_basic:'Basic (XAF 3,000/month)'");
    expect(content).toContain("subscription_tier_premium:'Premium (XAF 10,000/month)'");
    expect(content).toContain(".currency('XAF')");
    expect(content).not.toContain('const tierPrices = {free: 0, basic: 2, premium: 10}');
  });

  test('keeps every price in XAF, including doctor consultation fees', () => {
    expect(content).not.toContain("currency('USD')");
    expect(content).not.toContain('Consultation Fee (USD)');
    expect(content).not.toMatch(/USD \$\{/);
    expect(content).toContain('Consultation Fee (XAF)');
    expect(content).toContain('${fmtXAF(myDoc.consultationFee)}');
    expect(content).toContain("consultationFee:9000,feeCurrency:'XAF'");
  });

  test('dispatches the nearest ambulance with live tracking, crew app and escalation', () => {
    expect(content).toContain('const DispatchConfig = {');
    expect(content).toContain('function rankUnits');
    expect(content).toContain('function assignUnit');
    expect(content).toContain('function sosTrackerHTML');
    expect(content).toContain('function renderCrewDash');
    expect(content).toContain('function renderFleet');
    expect(content).toContain('function flushSosOutbox');
    expect(content).toContain('acceptTimeoutSec: 60');
    expect(content).toContain("ambulance:'AM'");
    expect(content).toContain('navigator.geolocation.watchPosition');
    expect(fs.existsSync(path.join(__dirname, '..', 'docs', 'ambulance-integration.md'))).toBe(true);
  });

  test('secures offline data: encryption, opt-in vault, expiry, wipe, lock, hashing', () => {
    expect(content).toContain("{name:'AES-GCM', length:256}");
    expect(content).toContain('const PBKDF2_ITERATIONS = 600000;');
    expect(content).toContain('const VAULT_MAX_FAILED_UNLOCKS = 5;');
    expect(content).toContain('function createVault');
    expect(content).toContain('function openVault');
    expect(content).toContain('function purgeVaults');
    expect(content).toContain('function lockSession');
    expect(content).toContain('function hashPassword');
    expect(content).toContain("if (user.role === 'admin') return false;");
    expect(content).toContain('id="l-offline"');
    expect(content).toContain('offlineRevokedAt');
    expect(content).not.toContain('localStorage.setItem(OFFLINE_KEY');
    expect(content).not.toMatch(/password:pass,phone/);
  });

  test('ships security headers and a hardened service worker', () => {
    expect(content).toContain('http-equiv="Content-Security-Policy"');
    expect(content).toContain("connect-src 'self'");
    expect(content).toContain("object-src 'none'");
    const conf = fs.readFileSync(path.join(__dirname, '..', 'nginx', 'default.conf'), 'utf8');
    expect(conf).toContain("frame-ancestors 'none'");
    expect(conf).toContain('X-Content-Type-Options');
    const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
    expect(sw).toContain("url.pathname.includes('/api/')");
    expect(sw).toContain('const cacheable');
  });

  test('escapes user-entered text before rendering it', () => {
    expect(content).toContain('<div class="mb2">${esc(m.text)}</div>');
    expect(content).toContain('<div class="cnb">${esc(n.text)}</div>');
    expect(content).toContain('const safeDocUrl');
  });
});
