const { z } = require('zod');
const COUNTRY_DATA = require('../country-data.js');

// Option lists shared with patient-registration.js. Values are stable codes; labels live in the UI.
const REGIONS = ['adamawa', 'centre', 'east', 'far_north', 'littoral', 'north', 'north_west', 'west', 'south', 'south_west'];
const CONDITIONS = ['hypertension', 'diabetes_type1', 'diabetes_type2', 'asthma', 'hiv_aids', 'tuberculosis', 'sickle_cell', 'epilepsy', 'cancer', 'chronic_kidney_disease', 'heart_disease', 'malaria_recurrent', 'mental_health', 'other'];
const FAMILY_HISTORY = ['hypertension', 'diabetes', 'cancer', 'heart_disease', 'stroke', 'mental_health', 'sickle_cell', 'other'];
const SECTORS = ['agriculture', 'mining', 'government', 'healthcare', 'education', 'commerce', 'informal', 'unemployed', 'student', 'other'];

// Free text: trimmed, bounded, no markup or control characters.
const text = (max, min = 0) => z.string().trim().min(min).max(max).regex(/^[^<>\u0000-\u001f]*$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => !Number.isNaN(Date.parse(value)), 'Invalid date');
const pastDate = isoDate.refine(value => value <= new Date().toISOString().slice(0, 10), 'Date cannot be in the future');
const e164 = z.string().regex(/^\+[1-9]\d{7,14}$/);
const currentYear = () => new Date().getFullYear();

const healthProfile = z.object({
  identity: z.object({
    // No one is older than 120: catches 1826 typed for 1926.
    dateOfBirth: pastDate.refine(value => value >= '1900-01-01' && value >= `${currentYear() - 120}-01-01`, 'Check the year of birth'),
    gender: z.enum(['male', 'female', 'undisclosed']),
    cniNumber: text(40, 1).optional()
  }).strict(),
  location: z.object({
    countryCode: z.enum(['CM', 'NG']).default('CM'),
    secondaryPhone: e164.optional(),
    region: text(20, 1),
    division: text(80, 1),
    town: text(120, 1),
    healthDistrict: text(120, 1).optional(),
    gps: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), accuracy: z.number().min(0).max(100000), capturedAt: z.string().datetime() }).strict().optional(),
    settlement: z.enum(['urban', 'peri_urban', 'rural']).optional()
  }).strict(),
  medical: z.object({
    bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown']).optional(),
    genotype: z.enum(['AA', 'AS', 'SS', 'AC', 'SC', 'unknown']).optional(),
    conditions: z.array(z.enum(CONDITIONS)).max(CONDITIONS.length).default([]),
    otherCondition: text(200, 1).optional(),
    drugAllergies: z.array(z.object({ name: text(120, 1), severity: z.enum(['mild', 'moderate', 'severe', 'anaphylaxis']) }).strict()).max(20).default([]),
    foodAllergies: text(500, 1).optional(),
    environmentalAllergies: text(500, 1).optional(),
    medications: z.array(z.object({ name: text(120, 1), dose: text(60, 1).optional(), frequency: text(60, 1).optional(), prescriber: text(120, 1).optional(), since: pastDate.optional() }).strict()).max(30).default([]),
    surgeries: z.array(z.object({ procedure: text(160, 1), year: z.number().int().min(1900).refine(year => year <= currentYear(), 'Year cannot be in the future').optional(), hospital: text(160, 1).optional() }).strict()).max(30).default([]),
    familyHistory: z.array(z.enum(FAMILY_HISTORY)).max(FAMILY_HISTORY.length).default([]),
    familyHistoryOther: text(200, 1).optional(),
    disability: z.enum(['none', 'visual', 'hearing', 'physical', 'cognitive', 'other']).default('none'),
    disabilityOther: text(200, 1).optional()
  }).strict(),
  lifestyle: z.object({
    smoking: z.enum(['never', 'former', 'current']).optional(),
    cigarettesPerDay: z.number().int().min(1).max(200).optional(),
    alcohol: z.enum(['none', 'occasional', 'moderate', 'heavy']).optional(),
    occupation: text(120, 1).optional(),
    sector: z.enum(SECTORS).optional(),
    waterSource: z.enum(['tap', 'well', 'river', 'rainwater', 'vendor']).optional(),
    toilet: z.enum(['flush', 'pit_latrine', 'open_defecation', 'other']).optional(),
    income: z.enum(['lt_50k', '50k_150k', '150k_500k', 'gt_500k']).optional(),
    insurance: z.enum(['none', 'cnps', 'public_scheme', 'private', 'mutual', 'other']).optional(),
    insuranceNumber: text(60, 1).optional(),
    emergencyContact: z.object({ name: text(120, 1).optional(), relationship: text(60, 1).optional(), phone: e164.optional() }).strict().optional()
  }).strict(),
  // Local legal review is required for every country before this consent model is treated as compliant.
  consents: z.object({
    dataSharing: z.literal(true),
    research: z.boolean(),
    sms: z.boolean(),
    whatsapp: z.boolean(),
    ministry: z.boolean()
  }).strict()
}).strict().superRefine((input, context) => {
  if (!COUNTRY_DATA.regionCodes(input.location.countryCode).includes(input.location.region)) {
    context.addIssue({ code: 'custom', path: ['location', 'region'], message: 'Choose a region in the selected country' });
  }
  if (input.lifestyle.smoking !== 'current' && input.lifestyle.cigarettesPerDay !== undefined) context.addIssue({ code: 'custom', path: ['lifestyle', 'cigarettesPerDay'], message: 'Only for current smokers' });
  if (input.medical.conditions.includes('other') && !input.medical.otherCondition) context.addIssue({ code: 'custom', path: ['medical', 'otherCondition'], message: 'Describe the other condition' });
});

/** Adds server-side consent timestamps so the record proves when each choice was made. */
function recordWithConsentTimes(profile, now = new Date().toISOString()) {
  return { ...profile, consents: { ...profile.consents, recordedAt: now, version: '2026.1' } };
}

module.exports = { healthProfile, recordWithConsentTimes, REGIONS, CONDITIONS, FAMILY_HISTORY, SECTORS };
