const { randomBytes, randomUUID } = require('node:crypto');
const { Op, UniqueConstraintError } = require('sequelize');
const { encryptString, decryptString, encryptJson, decryptJson, hmacHex, badRequest, forbidden, notFound, conflict } = require('@hfa/shared');

const REQUIRED_CONSENTS = ['terms_of_service', 'teleconsultation'];
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CLINICIANS = ['doctor', 'chw'];

const randomCode = length => Array.from(randomBytes(length), byte => CROCKFORD[byte % 32]).join('');
const normaliseNationalId = value => String(value).toUpperCase().replace(/[\s-]/g, '');
const maskTail = value => (value ? `${'*'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}` : null);

// Patient profile logic. Encryption/decryption, access control and access logging all happen
// here so routes stay thin and every code path follows the same rules.
function createPatientService({ sequelize, models, config, authClient, logger }) {
  const { Patient, Consent, Allergy, ChronicCondition, HistoryEntry, ConsultationRecord, PrescriptionRecord, AccessLog, Provider } = models;
  const key = config.dataKey;
  // Associated data binds each ciphertext to its table, column and row.
  const seal = (table, column, id, value) => encryptString(key, value, `${table}.${column}:${id}`);
  const open = (table, column, id, blob) => decryptString(key, blob, `${table}.${column}:${id}`);
  const blindIndex = value => (value ? hmacHex(config.blindIndexKey, value) : null);

  async function logAccess(actor, patientId, action, purpose, requestId) {
    if (actor.role === 'patient') return; // patients viewing their own record are not logged
    await AccessLog.create({ patientId, accessedBy: actor.id, accessorRole: actor.role, action, purpose: purpose || null, requestId: requestId || null });
  }

  // Minimum-necessary access: patients see their own record; doctors and CHWs need a care
  // relationship (they registered the patient or have a consultation with them); admins must
  // state a purpose ("break-glass"), which is logged. Pharmacists and labs never get the full
  // profile; they receive only what their service needs.
  async function loadForAccess(actor, patientId, { purpose } = {}) {
    const patient = await Patient.findOne({ where: { id: patientId, deletedAt: null } });
    if (!patient) throw notFound('Patient not found');
    if (actor.role === 'patient') {
      if (patient.authUserId !== actor.id) throw forbidden();
    } else if (CLINICIANS.includes(actor.role)) {
      const related = patient.registeredBy === actor.id || await ConsultationRecord.count({
        where: { patientId, [Op.or]: [{ doctorId: actor.id }, { chwId: actor.id }] }
      });
      if (!related) throw forbidden('No care relationship with this patient');
    } else if (actor.role === 'admin') {
      if (!purpose) throw badRequest('Administrators must give a purpose to open a patient record');
    } else {
      throw forbidden();
    }
    return patient;
  }

  async function createPatient(actor, input, requestId) {
    if (!['patient', ...CLINICIANS].includes(actor.role)) throw forbidden();
    const consentMap = Object.fromEntries(input.consents.map(item => [item.type, item.granted]));
    const missing = REQUIRED_CONSENTS.filter(type => consentMap[type] !== true);
    if (missing.length) throw badRequest('Required consent was not given', { missing });
    if (actor.role === 'patient' && await Patient.findOne({ where: { authUserId: actor.id } })) throw conflict('You already have a patient profile');

    for (let attempt = 0; attempt < 5; attempt++) {
      const id = randomUUID();
      try {
        const patient = await sequelize.transaction(async transaction => {
          const created = await Patient.create({
            id,
            authUserId: actor.role === 'patient' ? actor.id : null,
            hfaNumber: `HFA-PT-${randomCode(8)}`,
            firstNameEnc: seal('patients', 'first_name', id, input.firstName),
            lastNameEnc: seal('patients', 'last_name', id, input.lastName),
            dateOfBirthEnc: seal('patients', 'date_of_birth', id, input.dateOfBirth),
            birthYear: input.dateOfBirth ? Number(input.dateOfBirth.slice(0, 4)) : null,
            sex: input.sex,
            phoneEnc: seal('patients', 'phone', id, input.phone),
            phoneHash: blindIndex(input.phone),
            nationalIdEnc: seal('patients', 'national_id', id, input.nationalId ? normaliseNationalId(input.nationalId) : null),
            nationalIdHash: blindIndex(input.nationalId ? normaliseNationalId(input.nationalId) : null),
            addressEnc: seal('patients', 'address', id, input.address),
            regionCode: input.regionCode,
            districtCode: input.districtCode,
            preferredLanguage: input.preferredLanguage,
            bloodGroup: input.bloodGroup || null,
            emergencyContactEnc: input.emergencyContact ? encryptJson(key, input.emergencyContact, `patients.emergency_contact:${id}`) : null,
            registeredBy: actor.id
          }, { transaction });
          await Consent.bulkCreate(input.consents.map(item => ({
            patientId: id, consentType: item.type, granted: item.granted, policyVersion: config.consentPolicyVersion, recordedBy: actor.id
          })), { transaction });
          return created;
        });
        await logAccess(actor, patient.id, 'create_record', 'registration', requestId);
        logger.info('patient_created', { patientId: patient.id, registeredByRole: actor.role });
        return { id: patient.id, hfaNumber: patient.hfaNumber };
      } catch (error) {
        if (!(error instanceof UniqueConstraintError)) throw error;
        const fields = Object.keys(error.fields || {}).join(',');
        if (fields.includes('phone_hash')) throw conflict('A patient with this phone number already exists');
        if (fields.includes('national_id_hash')) throw conflict('A patient with this national ID already exists');
        if (fields.includes('auth_user_id')) throw conflict('You already have a patient profile');
        // hfa_number collision: try again with a new random number
      }
    }
    throw conflict('Could not allocate a patient number; please retry');
  }

  async function getProfile(actor, patientId, { purpose, requestId } = {}) {
    const patient = await loadForAccess(actor, patientId, { purpose });
    const id = patient.id;
    const [[flags], allergies, conditions, history, consultations, prescriptions, consents] = await Promise.all([
      sequelize.query('SELECT has_allergies, has_drug_allergy, has_life_threatening_allergy, active_chronic_conditions FROM patient_clinical_flags WHERE patient_id = :id', { replacements: { id }, type: sequelize.QueryTypes.SELECT }),
      Allergy.findAll({ where: { patientId: id, status: { [Op.ne]: 'entered_in_error' } }, order: [['recordedAt', 'DESC']] }),
      ChronicCondition.findAll({ where: { patientId: id, status: { [Op.ne]: 'entered_in_error' } }, order: [['recordedAt', 'DESC']] }),
      HistoryEntry.findAll({ where: { patientId: id }, order: [['occurredOn', 'DESC NULLS LAST'], ['createdAt', 'DESC']] }),
      ConsultationRecord.findAll({ where: { patientId: id }, order: [['scheduledAt', 'DESC NULLS LAST']], limit: 50 }),
      PrescriptionRecord.findAll({ where: { patientId: id }, order: [['issuedAt', 'DESC']], limit: 50 }),
      Consent.findAll({ where: { patientId: id }, order: [['recordedAt', 'DESC']] })
    ]);
    await logAccess(actor, id, 'view_profile', purpose, requestId);
    const currentConsents = {};
    for (const consent of consents) if (!(consent.consentType in currentConsents)) currentConsents[consent.consentType] = consent.granted;
    const nationalId = open('patients', 'national_id', id, patient.nationalIdEnc);
    return {
      patient: {
        id, hfaNumber: patient.hfaNumber,
        firstName: open('patients', 'first_name', id, patient.firstNameEnc),
        lastName: open('patients', 'last_name', id, patient.lastNameEnc),
        dateOfBirth: open('patients', 'date_of_birth', id, patient.dateOfBirthEnc),
        birthYear: patient.birthYear, sex: patient.sex,
        phone: open('patients', 'phone', id, patient.phoneEnc),
        nationalId: actor.role === 'patient' ? nationalId : maskTail(nationalId), // clinicians see only the last 4 characters
        address: open('patients', 'address', id, patient.addressEnc),
        regionCode: patient.regionCode, districtCode: patient.districtCode,
        preferredLanguage: patient.preferredLanguage, bloodGroup: patient.bloodGroup,
        emergencyContact: patient.emergencyContactEnc ? decryptJson(key, patient.emergencyContactEnc, `patients.emergency_contact:${id}`) : null
      },
      flags: {
        hasAllergies: flags.has_allergies, hasDrugAllergy: flags.has_drug_allergy,
        hasLifeThreateningAllergy: flags.has_life_threatening_allergy, activeChronicConditions: flags.active_chronic_conditions
      },
      allergies: allergies.map(a => ({
        id: a.id, category: a.category, allergenCode: a.allergenCode, allergenName: a.allergenName, severity: a.severity,
        reaction: open('patient_allergies', 'reaction', a.id, a.reactionEnc), status: a.status, verification: a.verification, recordedAt: a.recordedAt
      })),
      chronicConditions: conditions.map(c => ({
        id: c.id, icd10Code: c.icd10Code, name: c.name, status: c.status, onsetDate: c.onsetDate,
        notes: open('patient_chronic_conditions', 'notes', c.id, c.notesEnc), recordedAt: c.recordedAt
      })),
      medicalHistory: history.map(h => ({
        id: h.id, entryType: h.entryType, codeSystem: h.codeSystem, code: h.code, occurredOn: h.occurredOn, source: h.source,
        summary: open('medical_history_entries', 'summary', h.id, h.summaryEnc)
      })),
      consultations: consultations.map(c => ({
        consultationId: c.consultationId, doctorId: c.doctorId, chwId: c.chwId, mode: c.mode, status: c.status,
        scheduledAt: c.scheduledAt, completedAt: c.completedAt, primaryIcd10: c.primaryIcd10,
        summary: open('patient_consultation_history', 'summary', c.consultationId, c.summaryEnc)
      })),
      prescriptions: prescriptions.map(p => ({
        prescriptionId: p.prescriptionId, doctorId: p.doctorId, status: p.status, issuedAt: p.issuedAt, expiresAt: p.expiresAt,
        dispensedAt: p.dispensedAt, itemCount: p.itemCount,
        medications: p.medicationsEnc ? decryptJson(key, p.medicationsEnc, `patient_prescription_history.medications:${p.prescriptionId}`) : null
      })),
      consents: currentConsents
    };
  }

  async function addAllergy(actor, patientId, input, requestId) {
    if (!['patient', ...CLINICIANS].includes(actor.role)) throw forbidden();
    await loadForAccess(actor, patientId);
    const id = randomUUID();
    // Patient-reported allergies stay unconfirmed until a clinician confirms them.
    const verification = actor.role === 'doctor' ? input.verification : 'unconfirmed';
    const allergy = await Allergy.create({
      id, patientId, category: input.category, allergenCode: input.allergenCode || null, allergenName: input.allergenName,
      severity: input.severity, reactionEnc: seal('patient_allergies', 'reaction', id, input.reaction), verification, recordedBy: actor.id
    });
    await logAccess(actor, patientId, 'add_allergy', null, requestId);
    return { id: allergy.id, verification: allergy.verification };
  }

  async function addCondition(actor, patientId, input, requestId) {
    if (actor.role !== 'doctor') throw forbidden('Only doctors can record chronic conditions');
    await loadForAccess(actor, patientId);
    const id = randomUUID();
    await ChronicCondition.create({
      id, patientId, icd10Code: input.icd10Code, name: input.name, status: input.status, onsetDate: input.onsetDate || null,
      notesEnc: seal('patient_chronic_conditions', 'notes', id, input.notes), recordedBy: actor.id
    });
    await logAccess(actor, patientId, 'add_condition', null, requestId);
    return { id };
  }

  async function addHistoryEntry(actor, patientId, input, requestId) {
    if (!['patient', ...CLINICIANS].includes(actor.role)) throw forbidden();
    await loadForAccess(actor, patientId);
    const id = randomUUID();
    const source = actor.role === 'patient' ? 'patient_reported' : actor.role === 'chw' ? 'chw' : 'clinician';
    await HistoryEntry.create({
      id, patientId, entryType: input.entryType, codeSystem: input.codeSystem || null, code: input.code || null,
      summaryEnc: seal('medical_history_entries', 'summary', id, input.summary), occurredOn: input.occurredOn || null, source, recordedBy: actor.id
    });
    await logAccess(actor, patientId, 'add_history', null, requestId);
    return { id, source };
  }

  // ---- Provider credentials ----
  const credentialHashFor = (licensingBody, licenceNumber) =>
    hmacHex(config.credentialKey, `${licensingBody.trim().toUpperCase()}:${String(licenceNumber).toUpperCase().replace(/\s+/g, '')}`);

  // Admin records a provider's verified credential; the Auth account is activated in the same
  // step so the credential hash appears in the provider's access tokens.
  async function verifyProvider(admin, input) {
    const credentialHash = credentialHashFor(input.licensingBody, input.licenceNumber);
    return sequelize.transaction(async transaction => {
      const values = {
        id: input.userId, role: input.role,
        fullNameEnc: seal('providers', 'full_name', input.userId, input.fullName),
        licensingBody: input.licensingBody.trim().toUpperCase(),
        licenceNumberEnc: seal('providers', 'licence_number', input.userId, input.licenceNumber),
        credentialHash, specialty: input.specialty || null, facility: input.facility || null,
        status: 'verified', verifiedBy: admin.id, verifiedAt: new Date()
      };
      try {
        await Provider.upsert(values, { transaction });
      } catch (error) {
        if (error instanceof UniqueConstraintError) throw conflict('This licence is already registered to another provider');
        throw error;
      }
      await authClient.updateAccount(input.userId, { status: 'active', credentialHash });
      logger.info('provider_verified', { providerId: input.userId, role: input.role, verifiedBy: admin.id });
      return { providerId: input.userId, role: input.role, status: 'verified', credentialHash };
    });
  }

  async function setProviderStatus(admin, providerId, status) {
    return sequelize.transaction(async transaction => {
      const provider = await Provider.findByPk(providerId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!provider) throw notFound('Provider not found');
      await provider.update({ status }, { transaction });
      await authClient.updateAccount(providerId, { status: status === 'verified' ? 'active' : 'suspended' });
      logger.info('provider_status_changed', { providerId, status, changedBy: admin.id });
      return { providerId, status };
    });
  }

  async function getCredential(providerId) {
    const provider = await Provider.findByPk(providerId);
    if (!provider) throw notFound('Provider not found');
    return { providerId: provider.id, role: provider.role, credentialHash: provider.credentialHash, status: provider.status };
  }

  // ---- Internal: read models and safety data for other services ----
  async function upsertConsultation(patientId, consultationId, input) {
    if (!await Patient.count({ where: { id: patientId } })) throw notFound('Patient not found');
    await ConsultationRecord.upsert({
      consultationId, patientId, doctorId: input.doctorId || null, chwId: input.chwId || null, mode: input.mode, status: input.status,
      scheduledAt: input.scheduledAt || null, completedAt: input.completedAt || null, primaryIcd10: input.primaryIcd10 || null,
      summaryEnc: seal('patient_consultation_history', 'summary', consultationId, input.summary)
    });
  }

  async function upsertPrescription(patientId, prescriptionId, input) {
    if (!await Patient.count({ where: { id: patientId } })) throw notFound('Patient not found');
    await PrescriptionRecord.upsert({
      prescriptionId, patientId, doctorId: input.doctorId, status: input.status, issuedAt: input.issuedAt, expiresAt: input.expiresAt,
      dispensedAt: input.dispensedAt || null, itemCount: input.medications.length,
      medicationsEnc: encryptJson(key, input.medications, `patient_prescription_history.medications:${prescriptionId}`)
    });
  }

  async function getSafetyProfile(patientId) {
    const patient = await Patient.findOne({ where: { id: patientId, deletedAt: null } });
    if (!patient) throw notFound('Patient not found');
    const allergies = await Allergy.findAll({ where: { patientId, status: 'active', category: 'drug' } });
    return {
      patientId, hfaNumber: patient.hfaNumber, birthYear: patient.birthYear, sex: patient.sex,
      drugAllergies: allergies.map(a => ({ allergenCode: a.allergenCode, allergenName: a.allergenName, severity: a.severity, verification: a.verification }))
    };
  }

  return { createPatient, getProfile, addAllergy, addCondition, addHistoryEntry, verifyProvider, setProviderStatus, getCredential, upsertConsultation, upsertPrescription, getSafetyProfile };
}

module.exports = { createPatientService };
