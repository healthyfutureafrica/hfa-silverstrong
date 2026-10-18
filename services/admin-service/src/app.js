const path = require('node:path');
const { createServiceApp, createSequelize, runMigrations } = require('@hfa/shared');
const { createAggregator } = require('./aggregator');
const { createReporting } = require('./reporting');
const { createRoutes } = require('./routes');

async function buildApp({ config, logger }) {
  const sequelize = createSequelize(config.databaseUrl, { ssl: config.databaseSsl });
  if (config.runMigrations) await runMigrations(sequelize, path.join(__dirname, '..', 'migrations'));
  const aggregator = createAggregator({ sequelize, config, logger });
  const reporting = createReporting({ sequelize, config });
  const app = createServiceApp({
    name: 'admin-service', logger, trustProxy: config.trustProxy,
    configure: target => target.use(createRoutes({ aggregator, reporting, sequelize, config }))
  });
  return { app, sequelize, aggregator, reporting };
}

module.exports = { buildApp };
