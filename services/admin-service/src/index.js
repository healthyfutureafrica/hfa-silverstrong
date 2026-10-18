const Redis = require('ioredis');
const { hostname } = require('node:os');
const { createLogger } = require('@hfa/shared');
const { loadConfig } = require('./config');
const { buildApp } = require('./app');
const { RedisStreamConsumer } = require('./queue');

const logger = createLogger('admin-service');

async function main() {
  const config = loadConfig();
  const { app, sequelize, aggregator } = await buildApp({ config, logger });
  const server = app.listen(config.port, () => logger.info('listening', { port: config.port }));

  let consumer = null;
  let redis = null;
  if (config.redisUrl) {
    redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
    consumer = new RedisStreamConsumer({
      redis, stream: config.stream, group: config.consumerGroup, consumer: `${hostname()}-${process.pid}`,
      deadLetterStream: config.deadLetterStream, logger
    });
    consumer.start(event => aggregator.processEvent(event)).catch(error => logger.error('surveillance_consumer_stopped', { message: error.message }));
    logger.info('surveillance_consumer_started', { stream: config.stream });
  } else {
    logger.warn('surveillance_consumer_disabled', { reason: 'REDIS_URL not set; only internal HTTP ingestion is available' });
  }
  const prune = setInterval(() => aggregator.pruneProcessedEvents().catch(error => logger.error('prune_failed', { message: error.message })), 86400000);
  prune.unref();

  const shutdown = () => {
    consumer?.stop();
    clearInterval(prune);
    server.close(() => Promise.allSettled([sequelize.close(), redis?.quit()]).finally(() => process.exit(0)));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch(error => { logger.error('startup_failed', { message: error.message }); process.exit(1); });
