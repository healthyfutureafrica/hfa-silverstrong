const { ZodError } = require('zod');
const { sendError } = require('./envelope');

// Throw an AppError from any route or service function; the error handler turns it into an
// enveloped response with the right HTTP status. Never put patient data in the message.
class AppError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.details = details;
  }
}

const badRequest = (message, details) => new AppError(400, message, details);
const unauthorized = (message = 'Authentication required') => new AppError(401, message);
const forbidden = (message = 'You do not have permission for this action') => new AppError(403, message);
const notFound = (message = 'Not found') => new AppError(404, message);
const conflict = (message, details) => new AppError(409, message, details);
const unavailable = (message = 'A dependent service is unavailable') => new AppError(503, message);

function notFoundHandler(req, res) {
  sendError(res, 404, 'Route not found');
}

// Express 5 forwards rejected promises from async handlers here automatically.
function errorHandler(logger) {
  // eslint-disable-next-line no-unused-vars
  return (error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error instanceof ZodError) {
      return sendError(res, 400, 'Validation failed', {
        issues: error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message }))
      });
    }
    if (error instanceof AppError) return sendError(res, error.status, error.message, error.details);
    if (error.type === 'entity.too.large') return sendError(res, 413, 'Request body is too large');
    if (error.type === 'entity.parse.failed') return sendError(res, 400, 'Malformed JSON body');
    // Log only metadata: request bodies can contain health data.
    logger.error('unhandled_error', { requestId: req.id, path: req.path, name: error.name, message: error.message });
    return sendError(res, 500, 'Internal server error');
  };
}

module.exports = { AppError, badRequest, unauthorized, forbidden, notFound, conflict, unavailable, notFoundHandler, errorHandler };
