const { forbidden, unavailable, AppError } = require('./errors');
const { safeEqual } = require('./crypto');

// Internal (service-to-service) routes live under /internal/v1 and are never routed by the
// public gateway. As defence in depth they also require a shared internal token; in AWS the
// services additionally sit in private subnets reachable only from each other.
function requireInternalToken(expectedToken) {
  return (req, res, next) => {
    const presented = req.headers['x-internal-token'];
    if (!presented || !safeEqual(presented, expectedToken)) return next(forbidden('Internal access only'));
    return next();
  };
}

// Calls another service's internal API and unwraps the response envelope.
async function internalRequest({ baseUrl, path, method = 'GET', body, token, timeoutMs = 5000, fetchImpl = fetch }) {
  let response;
  try {
    response = await fetchImpl(new URL(path, baseUrl), {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': token },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    throw unavailable();
  }
  const payload = await response.json().catch(() => null);
  if (response.ok && payload?.success) return payload.data;
  if (response.status >= 500 || !payload) throw unavailable();
  throw new AppError(response.status, payload.message || 'Request to internal service failed');
}

module.exports = { requireInternalToken, internalRequest };
