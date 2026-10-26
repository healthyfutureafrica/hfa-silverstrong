// Content checks for clinical records, written for the mistakes people really make: a date typed in the wrong
// format or in the past, a duration with an extra zero, the wrong person picked from a list (a nurse in the
// "doctor" field), an empty note saved by accident. The server applies these whatever the screen allowed; each
// message says what to correct. Returns null when the record is fine.
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = 86400000;

/** A real calendar date (rejects 2026-02-31) in YYYY-MM-DD. */
function realDate(value) {
  if (typeof value !== 'string' || !DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (days) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);
// Appointment times are Cameroon wall-clock time (UTC+1).
const cameroonNow = (minutes = 0) => new Date(Date.now() + (60 + minutes) * 60000).toISOString(); // tolerance for slow typing and clocks
const meaningful = (value, min = 2) => typeof value === 'string' && value.replace(/\s+/g, ' ').trim().length >= min && /[\p{L}\p{N}]/u.test(value);

const APPOINTMENT_STATUS = ['scheduled', 'completed', 'cancelled', 'missed', 'no_show'];
const MODES = ['video', 'voice', 'text', 'in_person'];
const REFERRAL_STATUS = ['pending_choice', 'specialist_chosen', 'accepted', 'declined', 'completed', 'cancelled'];
const VISIT_STATUS = ['scheduled', 'completed', 'cancelled', 'missed'];

/**
 * @param store the server store (to check who people are)
 * @param collection record type, data the full new record, existing the current stored record (null when creating)
 */
function contentProblem(store, collection, data, existing) {
  const creating = !existing;
  // A date must be in the future when a booking is made or moved; completing an old one is fine.
  const moved = (...fields) => creating || fields.some(field => data[field] !== existing?.[field]);
  const role = id => (id ? store.user(id)?.role : null);
  const mustBe = (field, roles, label) => data[field] && !roles.includes(role(data[field])) ? `${field}: choose a ${label}` : null;
  const futureDate = (field, label) => {
    if (!realDate(data[field])) return `${field}: enter a real date (YYYY-MM-DD)`;
    if (moved(field) && data[field] < addDays(-1)) return `${field}: ${label} cannot be in the past`;
    if (data[field] > addDays(730)) return `${field}: ${label} is more than 2 years away; check the year`;
    return null;
  };
  const optionalDate = field => data[field] !== undefined && data[field] !== null && data[field] !== '' && !realDate(String(data[field]).slice(0, 10)) ? `${field}: enter a real date` : null;
  const time = field => !TIME.test(String(data[field] || '')) ? `${field}: enter a time between 00:00 and 23:59` : null;

  switch (collection) {
    case 'appointments':
      return mustBe('patientId', ['patient'], 'patient') || mustBe('doctorId', ['doctor'], 'doctor') || mustBe('nurseId', ['nurse'], 'nurse')
        || futureDate('date', 'an appointment') || time('time')
        || (data.durationMinutes !== undefined && !(Number.isInteger(Number(data.durationMinutes)) && Number(data.durationMinutes) >= 10 && Number(data.durationMinutes) <= 180) ? 'durationMinutes: a consultation lasts 10 to 180 minutes' : null)
        || (data.mode !== undefined && !MODES.includes(data.mode) ? `mode: choose ${MODES.join(', ')}` : null)
        || (!APPOINTMENT_STATUS.includes(data.status) ? `status: unknown appointment status` : null)
        || (creating && data.status !== 'scheduled' ? 'status: a new appointment starts as scheduled' : null)
        || (moved('date', 'time') && data.date === cameroonNow().slice(0, 10) && TIME.test(data.time) && data.time < cameroonNow(-15).slice(11, 16) ? 'time: this time today has already passed' : null);
    case 'messages':
      return !meaningful(data.text, 1) ? 'text: the message is empty' : data.from === data.to ? 'to: you cannot message yourself' : null;
    case 'careNotes':
      return mustBe('nurseId', ['nurse', 'doctor'], 'nurse') || mustBe('patientId', ['patient'], 'patient') || (!meaningful(data.text, 3) ? 'text: write the care note (at least 3 characters)' : null) || optionalDate('date');
    case 'doctorReports':
      return mustBe('doctorId', ['doctor'], 'doctor') || mustBe('patientId', ['patient'], 'patient')
        || (!meaningful(data.summary, 3) ? 'summary: write the diagnosis or summary (at least 3 characters)' : null)
        || (!meaningful(data.plan, 3) ? 'plan: write the treatment plan (at least 3 characters)' : null);
    case 'medicalDocuments':
      return mustBe('patientId', ['patient'], 'patient') || (!meaningful(data.fileName, 1) ? 'fileName: the file has no name' : null)
        || (creating && !data.fileData ? 'fileData: attach the file' : null);
    case 'labResults':
      return mustBe('patientId', ['patient'], 'patient') || mustBe('labTechId', ['labtech'], 'laboratory') || mustBe('specialistDoctorId', ['doctor'], 'specialist doctor')
        || (!meaningful(data.testType, 2) ? 'testType: name the test (for example Malaria RDT)' : null)
        || (creating && !data.fileData ? 'fileData: attach the result file' : null);
    case 'specialistReferrals':
      return mustBe('patientId', ['patient'], 'patient') || mustBe('generalistId', ['doctor'], 'doctor') || mustBe('specialistDoctorId', ['doctor'], 'specialist doctor')
        || (data.specialistDoctorId && data.specialistDoctorId === data.generalistId ? 'specialistDoctorId: refer to another doctor' : null)
        || (!meaningful(data.specialty, 2) ? 'specialty: choose the specialty' : null)
        || (!REFERRAL_STATUS.includes(data.status) ? 'status: unknown referral status' : null);
    case 'homeVisits':
      return mustBe('patientId', ['patient'], 'patient') || mustBe('nurseId', ['nurse'], 'nurse') || mustBe('doctorId', ['doctor'], 'doctor')
        || futureDate('visitDate', 'a home visit') || time('visitTime')
        || (!VISIT_STATUS.includes(data.status) ? 'status: unknown visit status' : null)
        || (data.location !== undefined && !meaningful(data.location, 3) ? 'location: write where the visit takes place' : null);
    case 'reviews':
      return mustBe('providerId', ['doctor', 'nurse'], 'doctor or nurse') || (!Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5 ? 'rating: choose 1 to 5 stars' : null);
    case 'carePlans':
      return mustBe('ownerId', ['doctor', 'nurse'], 'doctor or nurse') || (!meaningful(data.title, 3) ? 'title: name the care plan' : null)
        || (Array.isArray(data.goals) && data.goals.some(goal => !(Number(goal?.progress) >= 0 && Number(goal?.progress) <= 100)) ? 'goals: progress must be between 0 and 100' : null)
        || optionalDate('nextReview');
    default:
      return null;
  }
}

module.exports = { contentProblem, realDate, APPOINTMENT_STATUS, MODES };
