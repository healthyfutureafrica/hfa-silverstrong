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
    expect(content).toContain("DB.users.filter(u=>['admin','doctor','nurse','patient'].includes(u.role))");
    expect(content).toContain('${renderDemoCredentials()}');
  });

  test('provisions Chinjie as the Super Admin', () => {
    expect(content).toContain("email:'chinjiesylvestern@gmail.com'");
    expect(content).toContain("adminRole:'Super Admin'");
    expect(content).toContain("permissions:['all']");
  });

  test('uses the HFA logo asset across the app', () => {
    expect(fs.existsSync(path.join(__dirname, '..', 'assets', 'hfa-logo.svg'))).toBe(true);
    expect((content.match(/assets\/hfa-logo\.svg/g) || []).length).toBe(4);
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
});
