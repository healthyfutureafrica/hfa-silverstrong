const { createServiceApp, createSequelize, runMigrations } = require('@hfa/shared');
const path = require('node:path');
const { defineModels } = require('./models');
const { createAuthService } = require('./authService');
const { createRoutes } = require('./routes');

// Wires configuration, database, business logic and routes together. Used by index.js and tests.
async function buildApp({ config, logger }) {
  const sequelize = createSequelize(config.databaseUrl, { ssl: config.databaseSsl });
  if (config.runMigrations) await runMigrations(sequelize, path.join(__dirname, '..', 'migrations'));
  const models = defineModels(sequelize);
  const authService = createAuthService({ sequelize, models, config, logger });
  const app = createServiceApp({
    name: 'auth-service', logger, trustProxy: config.trustProxy,
    configure: target => target.use(createRoutes({ authService, config }))
  });
  return { app, sequelize, models, authService };
}

module.exports = { buildApp };
