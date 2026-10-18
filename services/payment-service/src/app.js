const path = require('node:path');
const { createServiceApp, createSequelize, runMigrations, internalRequest } = require('@hfa/shared');
const { defineModels } = require('./models');
const { MtnMomoClient } = require('./mtnClient');
const { createPaymentService } = require('./paymentService');
const { createRoutes } = require('./routes');

// Internal calls to the Consultation Service. Its contract:
//   GET   /internal/v1/consultations/:id          -> { id, patientUserId, status, feeXaf }
//   PATCH /internal/v1/consultations/:id/payment  -> idempotent: marks the consultation paid
function createConsultationClient(config, fetchImpl) {
  return {
    getConsultation: id => internalRequest({ baseUrl: config.consultationServiceUrl, path: `/internal/v1/consultations/${id}`, token: config.internalToken, fetchImpl }),
    markPaid: (id, payment) => internalRequest({ baseUrl: config.consultationServiceUrl, path: `/internal/v1/consultations/${id}/payment`, method: 'PATCH', body: { status: 'paid', ...payment }, token: config.internalToken, fetchImpl })
  };
}

async function buildApp({ config, logger, consultationClient, fetchImpl }) {
  const sequelize = createSequelize(config.databaseUrl, { ssl: config.databaseSsl });
  if (config.runMigrations) await runMigrations(sequelize, path.join(__dirname, '..', 'migrations'));
  const models = defineModels(sequelize);
  const mtn = new MtnMomoClient({ ...config.mtn, fetchImpl });
  const paymentService = createPaymentService({ sequelize, models, config, logger, mtn, consultationClient: consultationClient || createConsultationClient(config, fetchImpl) });
  const app = createServiceApp({
    name: 'payment-service', logger, trustProxy: config.trustProxy,
    configure: target => target.use(createRoutes({ paymentService, config }))
  });
  return { app, sequelize, models, paymentService, mtn };
}

module.exports = { buildApp, createConsultationClient };
