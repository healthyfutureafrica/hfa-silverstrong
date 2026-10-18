// Every API response uses the same envelope so web, mobile and Ministry clients can handle
// results uniformly:  { success, data, message, timestamp }

function envelope(success, data, message) {
  return {
    success,
    data: data === undefined ? null : data,
    message: message || (success ? 'OK' : 'Request failed'),
    timestamp: new Date().toISOString()
  };
}

function sendOk(res, data, message = 'OK', status = 200) {
  return res.status(status).json(envelope(true, data, message));
}

function sendError(res, status, message, data = null) {
  return res.status(status).json(envelope(false, data, message));
}

module.exports = { envelope, sendOk, sendError };
