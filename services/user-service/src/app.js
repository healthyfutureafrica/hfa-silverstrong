const path = require('node:path');
const { createServiceApp, createSequelize, runMigrations, internalRequest } = require('@hfa/shared');
const { defineModels } = require('./models');
const { createPatientService } = require('./patientService');
const { createRoutes } = require('./routes');

// Calls the Auth Service's internal API to activate or suspend provider accounts.
function createAuthClient(config, fetchImpl) {
  return {
    updateAccount: (userId, changes) => internalRequest({
      baseUrl: config.authServiceUrl, path: `/internal/v1/users/${userId}`, method: 'PATCH', body: changes, token: config.internalToken, fetchImpl
    })
  };
}

async function buildApp({ config, logger, authClient, fetchImpl }) {
  const sequelize = createSequelize(config.databaseUrl, { ssl: config.databaseSsl });
  if (config.runMigrations) await runMigrations(sequelize, path.join(__dirname, '..', 'migrations'));
  const models = defineModels(sequelize);
  const patientService = createPatientService({ sequelize, models, config, logger, authClient: authClient || createAuthClient(config, fetchImpl) });
  const app = createServiceApp({
    name: 'user-service', logger, trustProxy: config.trustProxy,
    configure: target => target.use(createRoutes({ patientService, config }))
  });
  return { app, sequelize, models, patientService };
}

module.exports = { buildApp, createAuthClient };
