const fs = require('node:fs');
const path = require('node:path');
const { Sequelize } = require('sequelize');

// One Sequelize instance per service. In AWS each service gets its own RDS PostgreSQL database
// (or schema) and user, so a compromised service cannot read another service's data.
function createSequelize(databaseUrl, { ssl = false, caCertificate } = {}) {
  return new Sequelize(databaseUrl, {
    dialect: 'postgres',
    logging: false,
    define: { underscored: true, timestamps: true },
    pool: { max: 10, min: 0, idle: 10000 },
    // RDS: set DATABASE_SSL=true and provide the RDS CA bundle so the certificate is verified.
    dialectOptions: ssl ? { ssl: { require: true, rejectUnauthorized: true, ca: caCertificate } } : {}
  });
}

// Applies plain-SQL migrations (migrations/NNN_name.sql) in order, exactly once. SQL files keep
// PostgreSQL features (constraints, partial indexes, triggers) explicit and reviewable.
// A transaction-scoped advisory lock stops two starting containers from migrating at once.
async function runMigrations(sequelize, directory) {
  const files = fs.readdirSync(directory).filter(file => /^\d+_[\w-]+\.sql$/.test(file)).sort();
  await sequelize.transaction(async transaction => {
    await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(current_database()))', { transaction });
    await sequelize.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())', { transaction });
    const [rows] = await sequelize.query('SELECT name FROM schema_migrations', { transaction });
    const applied = new Set(rows.map(row => row.name));
    for (const file of files) {
      if (applied.has(file)) continue;
      await sequelize.query(fs.readFileSync(path.join(directory, file), 'utf8'), { transaction });
      await sequelize.query('INSERT INTO schema_migrations (name) VALUES (:file)', { replacements: { file }, transaction });
    }
  });
}

module.exports = { createSequelize, runMigrations };
