const { DataTypes } = require('sequelize');

// Sequelize models for migrations/001_payments.sql.
function defineModels(sequelize) {
  const Payment = sequelize.define('Payment', {
    id: { type: DataTypes.UUID, primaryKey: true },
    consultationId: { type: DataTypes.UUID, allowNull: false },
    payerUserId: { type: DataTypes.UUID, allowNull: false },
    provider: { type: DataTypes.STRING(20), allowNull: false },
    amount: { type: DataTypes.DECIMAL(12, 0), allowNull: false },
    currency: { type: DataTypes.CHAR(3), allowNull: false },
    msisdnEnc: { type: DataTypes.BLOB, allowNull: false },
    msisdnHash: { type: DataTypes.CHAR(64), allowNull: false },
    providerReference: { type: DataTypes.UUID, allowNull: false },
    idempotencyKey: { type: DataTypes.STRING(64), allowNull: false },
    status: { type: DataTypes.ENUM('pending', 'successful', 'failed', 'expired'), allowNull: false, defaultValue: 'pending' },
    providerStatus: { type: DataTypes.STRING(30), allowNull: true },
    financialTransactionId: { type: DataTypes.STRING(64), allowNull: true },
    failureReason: { type: DataTypes.STRING(120), allowNull: true },
    pollAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    notFoundCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    nextPollAt: { type: DataTypes.DATE, allowNull: true },
    lastCheckedAt: { type: DataTypes.DATE, allowNull: true },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    completedAt: { type: DataTypes.DATE, allowNull: true }
  }, { tableName: 'payments' });

  const OutboxEvent = sequelize.define('OutboxEvent', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    paymentId: { type: DataTypes.UUID, allowNull: false },
    eventType: { type: DataTypes.STRING(50), allowNull: false },
    payload: { type: DataTypes.JSONB, allowNull: false },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    nextAttemptAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    deliveredAt: { type: DataTypes.DATE, allowNull: true },
    lastError: { type: DataTypes.STRING(200), allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, { tableName: 'payment_outbox', timestamps: false });

  const Callback = sequelize.define('Callback', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    provider: { type: DataTypes.STRING(20), allowNull: false },
    paymentId: { type: DataTypes.UUID, allowNull: true },
    claimedStatus: { type: DataTypes.STRING(30), allowNull: true },
    receivedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, { tableName: 'payment_callbacks', timestamps: false });

  return { Payment, OutboxEvent, Callback };
}

module.exports = { defineModels };
