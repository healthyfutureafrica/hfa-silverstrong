const { DataTypes } = require('sequelize');

// Sequelize models for migrations/001_prescriptions.sql.
function defineModels(sequelize) {
  const Prescription = sequelize.define('Prescription', {
    id: { type: DataTypes.UUID, primaryKey: true },
    patientId: { type: DataTypes.UUID, allowNull: false },
    doctorId: { type: DataTypes.UUID, allowNull: false },
    consultationId: { type: DataTypes.UUID, allowNull: true },
    doctorCredentialHash: { type: DataTypes.CHAR(64), allowNull: false },
    itemsEnc: { type: DataTypes.BLOB, allowNull: false },
    itemsDigest: { type: DataTypes.CHAR(64), allowNull: false },
    itemCount: { type: DataTypes.SMALLINT, allowNull: false },
    codeDigest: { type: DataTypes.CHAR(64), allowNull: false },
    integrityMac: { type: DataTypes.CHAR(64), allowNull: false },
    issuedAt: { type: DataTypes.DATE, allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    status: { type: DataTypes.ENUM('issued', 'dispensed', 'revoked'), allowNull: false, defaultValue: 'issued' },
    dispensedAt: { type: DataTypes.DATE, allowNull: true },
    dispensedBy: { type: DataTypes.UUID, allowNull: true },
    pharmacyId: { type: DataTypes.STRING(40), allowNull: true },
    revokedAt: { type: DataTypes.DATE, allowNull: true },
    revokedBy: { type: DataTypes.UUID, allowNull: true },
    revokeReason: { type: DataTypes.STRING(200), allowNull: true }
  }, { tableName: 'prescriptions' });

  const PrescriptionEvent = sequelize.define('PrescriptionEvent', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    prescriptionId: { type: DataTypes.UUID, allowNull: false },
    sequence: { type: DataTypes.INTEGER, allowNull: false },
    eventType: { type: DataTypes.STRING(30), allowNull: false },
    actorId: { type: DataTypes.UUID, allowNull: false },
    actorRole: { type: DataTypes.STRING(20), allowNull: false },
    details: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    prevHash: { type: DataTypes.CHAR(64), allowNull: false },
    hash: { type: DataTypes.CHAR(64), allowNull: false },
    createdAt: { type: DataTypes.DATE, allowNull: false }
  }, { tableName: 'prescription_events', timestamps: false });

  const VerificationAttempt = sequelize.define('VerificationAttempt', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    actorId: { type: DataTypes.UUID, allowNull: false },
    actorRole: { type: DataTypes.STRING(20), allowNull: false },
    succeeded: { type: DataTypes.BOOLEAN, allowNull: false },
    reason: { type: DataTypes.STRING(40), allowNull: true },
    prescriptionId: { type: DataTypes.UUID, allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, { tableName: 'verification_attempts', timestamps: false });

  return { Prescription, PrescriptionEvent, VerificationAttempt };
}

module.exports = { defineModels };
