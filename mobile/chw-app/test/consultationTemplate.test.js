const { emptyConsultation, validateConsultation, triage, buildPayload } = require('../src/forms/consultationTemplate');

const form = (changes = {}) => {
  const base = emptyConsultation();
  return {
    ...base, consentGiven: true, ...changes,
    patient: { ...base.patient, fullName: 'Synthetic Patient', ageYears: '30', districtCode: 'DLA-NYLON', ...(changes.patient || {}) },
    vitals: { ...base.vitals, ...(changes.vitals || {}) },
    dangerSigns: changes.dangerSigns || {}, symptoms: changes.symptoms || {}
  };
};

describe('validation', () => {
  test('requires identity, age, district and consent; checks vital-sign ranges', () => {
    expect(validateConsultation(form()).valid).toBe(true);
    const { errors } = validateConsultation({ ...emptyConsultation() });
    expect(Object.keys(errors).sort()).toEqual(['consentGiven', 'patient.ageYears', 'patient.districtCode', 'patient.fullName']);
    expect(validateConsultation(form({ vitals: { temperatureC: '50' } })).errors['vitals.temperatureC']).toMatch(/between 30 and 45/);
    expect(validateConsultation(form({ patient: { ageYears: '', ageMonths: '14' } })).errors['patient.ageMonths']).toBeDefined();
  });
});

describe('triage', () => {
  test('routine when nothing is concerning', () => {
    expect(triage(form({ vitals: { temperatureC: '36.8', spo2: '98' } }))).toEqual({ level: 'routine', reasons: [] });
  });

  test('child general danger signs and severe malnutrition are emergencies', () => {
    const child = { patient: { ageYears: '1', ageMonths: '6' } };
    expect(triage(form({ ...child, dangerSigns: { convulsions: true } })).level).toBe('emergency');
    expect(triage(form({ ...child, vitals: { muacMm: '110' } }))).toEqual({ level: 'emergency', reasons: ['MUAC 110 mm (severe acute malnutrition)'] });
    expect(triage(form({ ...child, vitals: { muacMm: '120' } })).level).toBe('urgent');
  });

  test('uses age-specific fast-breathing thresholds', () => {
    expect(triage(form({ patient: { ageYears: '0', ageMonths: '6' }, vitals: { respiratoryRate: '52' } })).level).toBe('urgent'); // >= 50 under 12 months
    expect(triage(form({ patient: { ageYears: '3' }, vitals: { respiratoryRate: '38' } })).level).toBe('routine');        // < 40 for 1-5 years
  });

  test('low oxygen, low blood pressure and adult red flags escalate', () => {
    expect(triage(form({ vitals: { spo2: '88' } })).level).toBe('emergency');
    expect(triage(form({ vitals: { spo2: '93' } })).level).toBe('urgent');
    expect(triage(form({ vitals: { systolic: '85' } })).level).toBe('emergency');
    expect(triage(form({ dangerSigns: { chest_pain: true } })).reasons).toContain('Chest pain');
    expect(triage(form({ symptoms: { fever: true }, durationDays: '8' })).reasons).toContain('Fever for 7 days or more');
  });
});

test('builds a clean payload with numbers, selected items and the triage result', () => {
  const payload = buildPayload(form({ vitals: { temperatureC: '38.2' }, symptoms: { fever: true, cough: false } }), { chwId: 'chw-1', recordedAt: '2026-10-18T10:00:00.000Z' });
  expect(payload).toMatchObject({ chwId: 'chw-1', symptoms: ['fever'], vitals: { temperatureC: 38.2, spo2: null }, patient: { ageYears: 30 }, triage: { level: 'urgent' } });
});
