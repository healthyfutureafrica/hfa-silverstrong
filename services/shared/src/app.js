const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { randomUUID } = require('node:crypto');
const { sendOk } = require('./envelope');
const { notFoundHandler, errorHandler } = require('./errors');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Builds an Express app with the defaults every HFA service needs. `configure(app)` adds the
// service's own routes between the common middleware and the 404/error handlers.
function createServiceApp({ name, logger, configure, jsonLimit = '100kb', trustProxy = false }) {
  const app = express();
  app.disable('x-powered-by');
  // Behind the AWS load balancer / API gateway, trust exactly one proxy hop for client IPs.
  app.set('trust proxy', trustProxy ? 1 : false);
  app.use(helmet());
  app.use((req, res, next) => {
    // Correlate one request across services in the logs.
    const incoming = req.headers['x-request-id'];
    req.id = typeof incoming === 'string' && UUID.test(incoming) ? incoming : randomUUID();
    res.set('X-Request-Id', req.id);
    res.set('Cache-Control', 'no-store'); // API responses may contain health data
    next();
  });
  app.use(express.json({ limit: jsonLimit }));
  app.use(cookieParser());
  app.get('/api/v1/health', (req, res) => sendOk(res, { service: name, status: 'ok' }));
  configure(app);
  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}

module.exports = { createServiceApp };
