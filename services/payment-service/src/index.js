const { createLogger } = require('@hfa/shared');
const { loadConfig } = require('./config');
const { buildApp } = require('./app');

const logger = createLogger('payment-service');

async function main() {
  const config = loadConfig();
  const { app, sequelize, paymentService } = await buildApp({ config, logger });
  const server = app.listen(config.port, () => logger.info('listening', { port: config.port }));

  // Background work: poll MTN for pending payments and deliver outbox events. Safe to run on
  // every instance because rows are claimed with FOR UPDATE SKIP LOCKED.
  let running = false;
  const worker = setInterval(async () => {
    if (!config.workerEnabled || running) return;
    running = true;
    try {
      await paymentService.pollDue();
      await paymentService.dispatchOutbox();
    } catch (error) {
      logger.error('payment_worker_failed', { message: error.message });
    } finally {
      running = false;
    }
  }, config.workerIntervalMs);

  const shutdown = () => { clearInterval(worker); server.close(() => sequelize.close().finally(() => process.exit(0))); };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch(error => { logger.error('startup_failed', { message: error.message }); process.exit(1); });
