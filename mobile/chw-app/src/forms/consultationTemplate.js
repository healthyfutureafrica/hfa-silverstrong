// Structured CHW field-consultation template, validation and triage.
//
// Triage follows WHO IMCI general danger signs for children and common adult red flags. The
// thresholds below are configuration, not code: they must be reviewed and signed off by the
// HFA clinical lead before field use, and can be adjusted here without touching the screens.

const DANGER_SIGNS = {
  child: [
    { id: 'unable_to_drink', label: 'Unable to drink or breastfeed' },
    { id: 'vomits_everything', label: 'Vomits everything' },
    { id: 'convulsions', label: 'Convulsions now or during this illness' },
    { id: 'lethargic_unconscious', label: 'Lethargic or unconscious' },
    { id: 'chest_indrawing', label: 'Chest indrawing' }
  ],
  adult: [
    { id: 'chest_pain', label: 'Chest pain' },
    { id: 'severe_breathing_difficulty', label: 'Severe difficulty breathing' },
    { id: 'severe_bleeding', label: 'Severe bleeding' },
    { id: 'confusion_unconscious', label: 'Confusion or unconsciousness' },
    { id: 'pregnancy_bleeding_or_fits', label: 'Pregnant with bleeding, severe headache or fits' }
  ]
};

const SYMPTOMS = [
  { id: 'fever', label: 'Fever' }, { id: 'cough', label: 'Cough' }, { id: 'diarrhoea', label: 'Diarrhoea' },
  { id: 'vomiting', label: 'Vomiting' }, { id: 'headache', label: 'Headache' }, { id: 'rash', label: 'Rash' },
  { id: 'abdominal_pain', label: 'Abdominal pain' }, { id: 'body_pain', label: 'Body or joint pain' }
];

const THRESHOLDS = {
  spo2Emergency: 90, spo2Urgent: 94,
  temperatureHigh: 39.5, temperatureFever: 37.5, temperatureLow: 35.5,
  systolicLow: 90, systolicVeryHigh: 180,
  muacSevere: 115, muacModerate: 125, // mm, children 6-59 months
  // Fast breathing by age (breaths per minute, IMCI)
  respiratoryRateFast: ageMonths => (ageMonths < 2 ? 60 : ageMonths < 12 ? 50 : ageMonths < 60 ? 40 : 30)
};

const LIMITS = {
  temperatureC: [30, 45], pulse: [20, 250], respiratoryRate: [5, 120], spo2: [50, 100],
  systolic: [50, 260], diastolic: [30, 160], weightKg: [0.5, 300], muacMm: [50, 300]
};

function emptyConsultation() {
  return {
    patient: { patientId: null, fullName: '', ageYears: '', ageMonths: '', sex: 'unknown', village: '', districtCode: '', phone: '' },
    vitals: { temperatureC: '', pulse: '', respiratoryRate: '', spo2: '', systolic: '', diastolic: '', weightKg: '', muacMm: '' },
    symptoms: {}, dangerSigns: {}, durationDays: '', notes: '', consentGiven: false, escalationRequested: false
  };
}

const toNumber = value => (value === '' || value === null || value === undefined ? null : Number(value));

function ageInMonths(patient) {
  const years = toNumber(patient.ageYears) || 0;
  const months = toNumber(patient.ageMonths) || 0;
  return years * 12 + months;
}

// Returns { valid, errors: { 'path': 'message' } }.
function validateConsultation(form) {
  const errors = {};
  const patient = form.patient;
  if (!patient.patientId && patient.fullName.trim().length < 2) errors['patient.fullName'] = 'Enter the patient name or select a registered patient';
  const years = toNumber(patient.ageYears);
  const months = toNumber(patient.ageMonths);
  if (years === null && months === null) errors['patient.ageYears'] = 'Enter the age';
  if (years !== null && (!Number.isInteger(years) || years < 0 || years > 120)) errors['patient.ageYears'] = 'Age must be 0-120 years';
  if (months !== null && (!Number.isInteger(months) || months < 0 || months > 11)) errors['patient.ageMonths'] = 'Months must be 0-11';
  if (!/^[A-Z0-9-]{2,20}$/.test(patient.districtCode)) errors['patient.districtCode'] = 'Select the health district';
  if (patient.phone && !/^\+?[0-9 ]{8,16}$/.test(patient.phone)) errors['patient.phone'] = 'Phone number looks wrong';
  for (const [field, [min, max]] of Object.entries(LIMITS)) {
    const value = toNumber(form.vitals[field]);
    if (value !== null && (Number.isNaN(value) || value < min || value > max)) errors[`vitals.${field}`] = `Must be between ${min} and ${max}`;
  }
  if (!form.consentGiven) errors.consentGiven = 'The patient (or caregiver) must agree before the consultation is recorded';
  if (form.notes.length > 2000) errors.notes = 'Notes are too long (2000 characters max)';
  return { valid: Object.keys(errors).length === 0, errors };
}

// Classifies the case: emergency (refer / call doctor now), urgent (doctor today), routine.
function triage(form) {
  const reasons = [];
  let level = 'routine';
  const raise = (to, reason) => { reasons.push(reason); if (to === 'emergency' || (to === 'urgent' && level === 'routine')) level = to; };
  const months = ageInMonths(form.patient);
  const isChild = months < 60;
  const signs = DANGER_SIGNS[isChild ? 'child' : 'adult'];
  for (const sign of signs) if (form.dangerSigns[sign.id]) raise('emergency', sign.label);
  const v = Object.fromEntries(Object.keys(LIMITS).map(key => [key, toNumber(form.vitals[key])]));
  if (v.spo2 !== null && v.spo2 < THRESHOLDS.spo2Emergency) raise('emergency', `Oxygen saturation ${v.spo2}%`);
  else if (v.spo2 !== null && v.spo2 < THRESHOLDS.spo2Urgent) raise('urgent', `Oxygen saturation ${v.spo2}%`);
  if (v.temperatureC !== null && v.temperatureC >= THRESHOLDS.temperatureHigh) raise(isChild ? 'emergency' : 'urgent', `Temperature ${v.temperatureC} °C`);
  else if (v.temperatureC !== null && v.temperatureC >= THRESHOLDS.temperatureFever) raise('urgent', `Fever ${v.temperatureC} °C`);
  if (v.temperatureC !== null && v.temperatureC < THRESHOLDS.temperatureLow) raise('emergency', `Low temperature ${v.temperatureC} °C`);
  if (v.systolic !== null && v.systolic < THRESHOLDS.systolicLow) raise('emergency', `Low blood pressure ${v.systolic} mmHg`);
  if (v.systolic !== null && v.systolic >= THRESHOLDS.systolicVeryHigh) raise('urgent', `Very high blood pressure ${v.systolic} mmHg`);
  if (v.respiratoryRate !== null && v.respiratoryRate >= THRESHOLDS.respiratoryRateFast(months)) raise('urgent', `Fast breathing ${v.respiratoryRate}/min`);
  if (months >= 6 && months < 60 && v.muacMm !== null) {
    if (v.muacMm < THRESHOLDS.muacSevere) raise('emergency', `MUAC ${v.muacMm} mm (severe acute malnutrition)`);
    else if (v.muacMm < THRESHOLDS.muacModerate) raise('urgent', `MUAC ${v.muacMm} mm (moderate acute malnutrition)`);
  }
  if (form.symptoms.fever && (toNumber(form.durationDays) || 0) >= 7) raise('urgent', 'Fever for 7 days or more');
  return { level, reasons };
}

// The payload sent to the server (and encrypted on the device while waiting).
function buildPayload(form, { chwId, recordedAt = new Date().toISOString(), location = null }) {
  return {
    recordedAt, chwId, location,
    patient: { ...form.patient, ageYears: toNumber(form.patient.ageYears), ageMonths: toNumber(form.patient.ageMonths) },
    vitals: Object.fromEntries(Object.entries(form.vitals).map(([key, value]) => [key, toNumber(value)])),
    symptoms: Object.keys(form.symptoms).filter(key => form.symptoms[key]),
    dangerSigns: Object.keys(form.dangerSigns).filter(key => form.dangerSigns[key]),
    durationDays: toNumber(form.durationDays),
    notes: form.notes.trim(),
    consentGiven: form.consentGiven,
    escalationRequested: form.escalationRequested,
    triage: triage(form)
  };
}

module.exports = { DANGER_SIGNS, SYMPTOMS, THRESHOLDS, emptyConsultation, validateConsultation, triage, buildPayload, ageInMonths };
