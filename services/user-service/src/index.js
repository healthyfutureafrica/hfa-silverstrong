const { createLogger } = require('@hfa/shared');
const { loadConfig } = require('./config');
const { buildApp } = require('./app');

const logger = createLogger('user-service');

async function main() {
  const config = loadConfig();
  const { app, sequelize } = await buildApp({ config, logger });
  const server = app.listen(config.port, () => logger.info('listening', { port: config.port }));
  const shutdown = () => server.close(() => sequelize.close().finally(() => process.exit(0)));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch(error => { logger.error('startup_failed', { message: error.message }); process.exit(1); });
