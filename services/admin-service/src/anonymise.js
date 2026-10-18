const { z } = require('zod');

// The only shape of event the surveillance pipeline accepts. `.strict()` rejects any extra
// field, so a producer cannot accidentally send names, phone numbers or free text.
const consultationCompletedEvent = z.object({
  eventId: z.string().uuid(),
  type: z.literal('consultation.completed'),
  consultationId: z.string().uuid(),               // used by producers for tracing; discarded here
  completedAt: z.string().datetime({ offset: true }),
  diagnosisCodes: z.array(z.string().trim().toUpperCase().regex(/^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$/)).min(1).max(10),
  patient: z.object({
    birthYear: z.number().int().min(1900).max(2100).nullable(),
    sex: z.enum(['female', 'male', 'intersex', 'unknown'])
  }).strict(),
  location: z.object({
    regionCode: z.string().regex(/^CM-[A-Z]{2}$/),
    districtCode: z.string().regex(/^[A-Z0-9-]{2,20}$/)
  }).strict()
}).strict();

const AGE_BANDS = [[0, 4, '0-4'], [5, 14, '5-14'], [15, 24, '15-24'], [25, 49, '25-49'], [50, 64, '50-64'], [65, 200, '65+']];

function ageBand(birthYear, atDate) {
  if (!birthYear) return 'unknown';
  const age = atDate.getUTCFullYear() - birthYear;
  const band = AGE_BANDS.find(([min, max]) => age >= min && age <= max);
  return band ? band[2] : 'unknown';
}

// Reduces an event to the coarse, non-identifying facts that are counted:
//   ICD-10 code -> 3-character category (A09.0 -> A09), birth year -> age band,
//   intersex -> other, consultation id and exact time -> dropped (only the window is kept).
function anonymise(event) {
  const completedAt = new Date(event.completedAt);
  return {
    eventId: event.eventId,
    completedAt,
    regionCode: event.location.regionCode,
    districtCode: event.location.districtCode,
    ageBand: ageBand(event.patient.birthYear, completedAt),
    sex: event.patient.sex === 'intersex' ? 'other' : event.patient.sex,
    categories: [...new Set(event.diagnosisCodes.map(code => code.slice(0, 3)))]
  };
}

module.exports = { consultationCompletedEvent, anonymise, ageBand };
