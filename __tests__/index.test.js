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

  test('keeps demo credentials in the admin control center only', () => {
    expect(content).not.toContain('<strong>Demo Credentials</strong>');
    expect(content).toContain('Testing Access');
    expect(content).toContain('Admin-only demo credentials');
    expect(content).toContain("DB.users.filter(u=>['admin','doctor','nurse','patient'].includes(u.role))");
  });
});
