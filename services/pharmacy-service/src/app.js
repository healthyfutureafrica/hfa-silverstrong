const path = require('node:path');
const { createServiceApp, createSequelize, runMigrations, internalRequest } = require('@hfa/shared');
const { defineModels } = require('./models');
const { createPrescriptionService } = require('./prescriptionService');
const { createRoutes } = require('./routes');

// Internal calls to the User Service: provider credentials, patient safety data, history sync.
function createUserClient(config, fetchImpl) {
  const call = (requestPath, method = 'GET', body) => internalRequest({ baseUrl: config.userServiceUrl, path: requestPath, method, body, token: config.internalToken, fetchImpl });
  return {
    getCredential: providerId => call(`/internal/v1/providers/${providerId}/credential`),
    getSafetyProfile: patientId => call(`/internal/v1/patients/${patientId}/safety-profile`),
    syncPrescription: (patientId, prescriptionId, summary) => call(`/internal/v1/patients/${patientId}/prescriptions/${prescriptionId}`, 'PUT', summary)
  };
}

async function buildApp({ config, logger, userClient, fetchImpl }) {
  const sequelize = createSequelize(config.databaseUrl, { ssl: config.databaseSsl });
  if (config.runMigrations) await runMigrations(sequelize, path.join(__dirname, '..', 'migrations'));
  const models = defineModels(sequelize);
  const prescriptionService = createPrescriptionService({ sequelize, models, config, logger, userClient: userClient || createUserClient(config, fetchImpl) });
  const app = createServiceApp({
    name: 'pharmacy-service', logger, trustProxy: config.trustProxy,
    configure: target => target.use(createRoutes({ prescriptionService, config }))
  });
  return { app, sequelize, models, prescriptionService };
}

module.exports = { buildApp, createUserClient };
