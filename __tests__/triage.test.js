const fs = require('fs');
const path = require('path');
const Triage = require('../hfa-triage.js');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

describe('SLY Triage', () => {
  test('the app loads the rules and screens, caches them offline and publishes them', () => {
    const page = read('index.html');
    for (const file of ['hfa-triage.js', 'triage-assistant.js']) {
      expect(page).toContain(`<script src="${file}"></script>`);
      expect(read('service-worker.js')).toContain(`'${file}'`);
      expect(read('scripts/build-static.js')).toContain(`'${file}'`);
      expect(read('Dockerfile')).toContain(file);
    }
    expect(read('backend/Dockerfile')).toContain('hfa-triage.js');
    expect(read('backend/Dockerfile')).toContain('country-data.js');
    expect(page).toContain("page==='triage' && r==='patient'");
  });

  test('patients no longer choose their own urgency: the old form is replaced', () => {
    const screens = read('triage-assistant.js');
    expect(screens).toContain("window.showTriage = () =>");
    expect(screens).not.toMatch(/id="triage-level"/);
  });

  test('emergency contact advice uses the selected country profile and never guesses a number', () => {
    const answers = { ageGroup: 'adult', complaints: ['pain_chest'], dangerSigns: ['chest_pain'] };
    const cameroon = Triage.assess(answers, 'CM');
    const nigeria = Triage.assess(answers, 'NG');
    const unknown = Triage.assess(answers, null);
    expect(cameroon.emergencyNumber).toBe('1515');
    expect(nigeria.emergencyNumber).toBeNull();
    expect(unknown.emergencyNumber).toBeNull();
    expect(Triage.emergencyAdvice(nigeria, 'en')).toMatch(/local emergency services/);
    expect(Triage.emergencyAdvice(nigeria, 'en')).not.toContain('1515');
    expect(Triage.emergencyAdvice(cameroon, 'en')).toContain('1515');
  });

  test('every question and answer is translated into French', () => {
    const keys = [
      ...Triage.AGE_GROUPS.map(value => 'age_' + value), ...Triage.MATERNAL.map(value => 'maternal_' + value),
      ...Triage.COMPLAINTS.map(value => 'c_' + value), ...Triage.DURATIONS.map(value => 'd_' + value),
      ...Triage.SEVERITIES.map(value => 's_' + value), ...Triage.ALL_SIGNS.map(value => 'sign_' + value),
      ...Triage.LEVELS.map(value => 'level_' + value), ...Triage.LEVELS.map(value => 'advice_' + value)
    ];
    for (const key of keys) {
      expect(Triage.label(key, 'fr')).not.toBe(key);
      expect(Triage.label(key, 'fr')).not.toBe(Triage.label(key, 'en'));
    }
  });

  test('every rule that can fire has an explanation the patient can read', () => {
    const cases = [
      { ageGroup: 'infant', complaints: ['fever'] }, { ageGroup: 'adult', complaints: ['fever'], conditions: ['sickle_cell'] },
      { ageGroup: 'adult', complaints: ['pain_chest'] }, { ageGroup: 'child', complaints: ['diarrhoea_vomiting'] },
      { ageGroup: 'adult', complaints: ['diarrhoea_vomiting'], conditions: ['diabetes_type2'] }, { ageGroup: 'adult', maternal: 'pregnant', complaints: ['headache'] },
      { ageGroup: 'older_adult', complaints: ['cough_breathing'] }, { ageGroup: 'adult', complaints: ['injury'], severity: 'severe' },
      { ageGroup: 'adult', complaints: ['pain_abdomen'], severity: 'moderate' }, { ageGroup: 'adult', complaints: ['cough_breathing'], duration: 'weeks' },
      { ageGroup: 'adult', complaints: ['mental_health'] }, { ageGroup: 'adult', complaints: ['headache'], duration: 'hours', severity: 'mild' },
      { ageGroup: 'adult', complaints: ['other'] }, { ageGroup: 'adult', dangerSigns: Triage.signsFor({ ageGroup: 'adult', maternal: 'pregnant' }) }
    ];
    for (const input of cases) for (const reason of Triage.assess(input).reasons) {
      for (const language of ['en', 'fr']) expect(Triage.reasonText(reason, language)).not.toMatch(/^r_|sign_/);
    }
  });

  test('the clinician summary lists answers, negatives, health profile and the rules version', () => {
    const result = Triage.assess({ ageGroup: 'adult', complaints: ['fever'], duration: 'days_3_7', severity: 'moderate' });
    const summary = Triage.clinicianSummary(result, { text: 'Hot body', health: { medical: { drugAllergies: [{ name: 'Penicillin', severity: 'severe' }], conditions: ['hypertension'], medications: [{ name: 'Amlodipine', dose: '5 mg' }] } } });
    expect(summary).toMatch(/None of the \d+ danger signs/);
    expect(summary).toContain('Penicillin (severe)');
    expect(summary).toContain('Amlodipine 5 mg');
    expect(summary).toContain(Triage.RULES_VERSION);
    expect(summary).toContain('Hot body');
  });
});
