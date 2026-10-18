const { DataTypes } = require('sequelize');
const { ROLES } = require('@hfa/shared');

// Sequelize models mapping the tables created by migrations/001_auth.sql.
function defineModels(sequelize) {
  const User = sequelize.define('User', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    email: {
      type: DataTypes.STRING(254),
      allowNull: false,
      set(value) { this.setDataValue('email', String(value).trim().toLowerCase()); }
    },
    passwordHash: { type: DataTypes.STRING(255), allowNull: false },
    role: { type: DataTypes.ENUM(...ROLES), allowNull: false },
    status: { type: DataTypes.ENUM('active', 'pending', 'suspended', 'deleted'), allowNull: false, defaultValue: 'active' },
    credentialHash: { type: DataTypes.CHAR(64), allowNull: true },
    failedLoginCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lockedUntil: { type: DataTypes.DATE, allowNull: true },
    passwordChangedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, { tableName: 'auth_users' });

  const RefreshToken = sequelize.define('RefreshToken', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    userId: { type: DataTypes.UUID, allowNull: false },
    familyId: { type: DataTypes.UUID, allowNull: false },
    tokenHash: { type: DataTypes.CHAR(64), allowNull: false },
    clientType: { type: DataTypes.STRING(10), allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    familyExpiresAt: { type: DataTypes.DATE, allowNull: false },
    usedAt: { type: DataTypes.DATE, allowNull: true },
    revokedAt: { type: DataTypes.DATE, allowNull: true },
    revokedReason: { type: DataTypes.STRING(40), allowNull: true },
    replacedById: { type: DataTypes.UUID, allowNull: true },
    createdIp: { type: DataTypes.STRING(64), allowNull: true },
    userAgent: { type: DataTypes.STRING(255), allowNull: true }
  }, { tableName: 'auth_refresh_tokens' });

  User.hasMany(RefreshToken, { foreignKey: 'userId' });
  RefreshToken.belongsTo(User, { foreignKey: 'userId' });
  return { User, RefreshToken };
}

module.exports = { defineModels };
