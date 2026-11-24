// Danger thresholds for vital signs recorded by nurses (adult values, in line with common early-warning scores
// such as NEWS2 and WHO danger signs). They trigger an urgent alert to the doctor in charge; they do not diagnose.
// A clinician must review these thresholds before real patients (same as hfa-triage.js).
const RULES = [
  [v => v.systolic >= 180 || v.diastolic >= 120, 'Blood pressure in the hypertensive-crisis range'],
  [v => v.systolic < 90, 'Low blood pressure (systolic below 90)'],
  [v => v.pulse > 130 || v.pulse < 40, 'Pulse outside the safe range'],
  [v => v.temperatureC >= 39.5, 'High fever (39.5 °C or more)'],
  [v => v.temperatureC < 35, 'Low body temperature (below 35 °C)'],
  [v => v.spo2 !== undefined && v.spo2 < 92, 'Oxygen saturation below 92%'],
  [v => v.respiratoryRate !== undefined && (v.respiratoryRate >= 25 || v.respiratoryRate <= 8), 'Breathing rate outside the safe range'],
  [v => v.glucoseMmol !== undefined && (v.glucoseMmol < 3 || v.glucoseMmol > 20), 'Blood glucose dangerously low or high']
];

/** The danger signs present in a set of vitals (empty when none). */
function vitalDangers(vitals) {
  if (!vitals) return [];
  return RULES.filter(([test]) => { try { return !!test(vitals); } catch (error) { return false; } }).map(([, label]) => label);
}

module.exports = { vitalDangers };
