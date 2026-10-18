const { DataTypes } = require('sequelize');

// Sequelize models for migrations/001_patient_profile.sql. Columns ending in Enc hold AES-256-GCM
// ciphertext (Buffers); encryption and decryption happen in patientService.js, never in routes.
function defineModels(sequelize) {
  // Fresh objects per column: Sequelize mutates attribute definitions, so they must not be shared.
  const uuidPk = () => ({ type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 });
  const blob = (allowNull = true) => ({ type: DataTypes.BLOB, allowNull });

  const Patient = sequelize.define('Patient', {
    id: uuidPk(),
    authUserId: { type: DataTypes.UUID, allowNull: true },
    hfaNumber: { type: DataTypes.STRING(20), allowNull: false },
    firstNameEnc: blob(false),
    lastNameEnc: blob(false),
    dateOfBirthEnc: blob(),
    birthYear: { type: DataTypes.SMALLINT, allowNull: true },
    sex: { type: DataTypes.ENUM('female', 'male', 'intersex', 'unknown'), allowNull: false, defaultValue: 'unknown' },
    phoneEnc: blob(),
    phoneHash: { type: DataTypes.CHAR(64), allowNull: true },
    nationalIdEnc: blob(),
    nationalIdHash: { type: DataTypes.CHAR(64), allowNull: true },
    addressEnc: blob(),
    regionCode: { type: DataTypes.STRING(10), allowNull: false },
    districtCode: { type: DataTypes.STRING(20), allowNull: false },
    preferredLanguage: { type: DataTypes.CHAR(2), allowNull: false, defaultValue: 'fr' },
    bloodGroup: { type: DataTypes.STRING(3), allowNull: true },
    emergencyContactEnc: blob(),
    registeredBy: { type: DataTypes.UUID, allowNull: false },
    deletedAt: { type: DataTypes.DATE, allowNull: true }
  }, { tableName: 'patients' });

  const Consent = sequelize.define('Consent', {
    id: uuidPk(),
    patientId: { type: DataTypes.UUID, allowNull: false },
    consentType: { type: DataTypes.STRING(40), allowNull: false },
    granted: { type: DataTypes.BOOLEAN, allowNull: false },
    policyVersion: { type: DataTypes.STRING(20), allowNull: false },
    recordedBy: { type: DataTypes.UUID, allowNull: false },
    recordedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, { tableName: 'patient_consents', timestamps: false });

  const Allergy = sequelize.define('Allergy', {
    id: uuidPk(),
    patientId: { type: DataTypes.UUID, allowNull: false },
    category: { type: DataTypes.STRING(20), allowNull: false },
    allergenCode: { type: DataTypes.STRING(40), allowNull: true },
    allergenName: { type: DataTypes.STRING(120), allowNull: false },
    severity: { type: DataTypes.STRING(20), allowNull: false },
    reactionEnc: blob(),
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' },
    verification: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'unconfirmed' },
    recordedBy: { type: DataTypes.UUID, allowNull: false },
    recordedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, { tableName: 'patient_allergies' });

  const ChronicCondition = sequelize.define('ChronicCondition', {
    id: uuidPk(),
    patientId: { type: DataTypes.UUID, allowNull: false },
    icd10Code: { type: DataTypes.STRING(8), allowNull: false },
    name: { type: DataTypes.STRING(160), allowNull: false },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' },
    onsetDate: { type: DataTypes.DATEONLY, allowNull: true },
    notesEnc: blob(),
    recordedBy: { type: DataTypes.UUID, allowNull: false },
    recordedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, { tableName: 'patient_chronic_conditions' });

  const HistoryEntry = sequelize.define('HistoryEntry', {
    id: uuidPk(),
    patientId: { type: DataTypes.UUID, allowNull: false },
    entryType: { type: DataTypes.STRING(30), allowNull: false },
    codeSystem: { type: DataTypes.STRING(20), allowNull: true },
    code: { type: DataTypes.STRING(40), allowNull: true },
    summaryEnc: blob(false),
    occurredOn: { type: DataTypes.DATEONLY, allowNull: true },
    source: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'clinician' },
    recordedBy: { type: DataTypes.UUID, allowNull: false }
  }, { tableName: 'medical_history_entries' });

  const ConsultationRecord = sequelize.define('ConsultationRecord', {
    consultationId: { type: DataTypes.UUID, primaryKey: true },
    patientId: { type: DataTypes.UUID, allowNull: false },
    doctorId: { type: DataTypes.UUID, allowNull: true },
    chwId: { type: DataTypes.UUID, allowNull: true },
    mode: { type: DataTypes.STRING(10), allowNull: false },
    status: { type: DataTypes.STRING(20), allowNull: false },
    scheduledAt: { type: DataTypes.DATE, allowNull: true },
    completedAt: { type: DataTypes.DATE, allowNull: true },
    primaryIcd10: { type: DataTypes.STRING(8), allowNull: true },
    summaryEnc: blob()
  }, { tableName: 'patient_consultation_history', createdAt: false });

  const PrescriptionRecord = sequelize.define('PrescriptionRecord', {
    prescriptionId: { type: DataTypes.UUID, primaryKey: true },
    patientId: { type: DataTypes.UUID, allowNull: false },
    doctorId: { type: DataTypes.UUID, allowNull: false },
    status: { type: DataTypes.STRING(20), allowNull: false },
    issuedAt: { type: DataTypes.DATE, allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    dispensedAt: { type: DataTypes.DATE, allowNull: true },
    itemCount: { type: DataTypes.SMALLINT, allowNull: false },
    medicationsEnc: blob()
  }, { tableName: 'patient_prescription_history', createdAt: false });

  const AccessLog = sequelize.define('AccessLog', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    patientId: { type: DataTypes.UUID, allowNull: false },
    accessedBy: { type: DataTypes.UUID, allowNull: false },
    accessorRole: { type: DataTypes.STRING(20), allowNull: false },
    action: { type: DataTypes.STRING(30), allowNull: false },
    purpose: { type: DataTypes.STRING(120), allowNull: true },
    requestId: { type: DataTypes.UUID, allowNull: true },
    accessedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, { tableName: 'patient_access_log', timestamps: false });

  const Provider = sequelize.define('Provider', {
    id: { type: DataTypes.UUID, primaryKey: true },
    role: { type: DataTypes.STRING(20), allowNull: false },
    fullNameEnc: blob(false),
    licensingBody: { type: DataTypes.STRING(60), allowNull: false },
    licenceNumberEnc: blob(false),
    credentialHash: { type: DataTypes.CHAR(64), allowNull: false },
    specialty: { type: DataTypes.STRING(80), allowNull: true },
    facility: { type: DataTypes.STRING(120), allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending' },
    verifiedBy: { type: DataTypes.UUID, allowNull: true },
    verifiedAt: { type: DataTypes.DATE, allowNull: true }
  }, { tableName: 'providers' });

  for (const Child of [Consent, Allergy, ChronicCondition, HistoryEntry, ConsultationRecord, PrescriptionRecord]) {
    Patient.hasMany(Child, { foreignKey: 'patientId' });
    Child.belongsTo(Patient, { foreignKey: 'patientId' });
  }
  return { Patient, Consent, Allergy, ChronicCondition, HistoryEntry, ConsultationRecord, PrescriptionRecord, AccessLog, Provider };
}

module.exports = { defineModels };
