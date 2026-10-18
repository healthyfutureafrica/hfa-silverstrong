// Runs database migrations and exits (used as a one-off ECS task before a deployment).
const path = require('node:path');
const { createSequelize, runMigrations, requireEnv, boolEnv } = require('@hfa/shared');

const sequelize = createSequelize(requireEnv('DATABASE_URL'), { ssl: boolEnv('DATABASE_SSL', false) });
runMigrations(sequelize, path.join(__dirname, '..', 'migrations'))
  .then(() => { console.log('migrations applied'); return sequelize.close(); })
  .catch(error => { console.error('migration failed:', error.message); process.exit(1); });
