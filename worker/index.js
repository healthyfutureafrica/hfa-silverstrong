// Cloudflare edge script for the public website (runs before the static files in dist/).
// - Every visitor ends up on https://www.healthyfutureafrica.org: plain http:// and the
//   *.workers.dev address are redirected, so browsers never show "Not secure".
// - Adds the same security headers the HFA server sends (nginx.conf), including HSTS so browsers
//   always use HTTPS for this domain after the first visit.
const CANONICAL_HOST = 'www.healthyfutureafrica.org';
const OWN_HOSTS = new Set([CANONICAL_HOST, 'healthyfutureafrica.org']);

const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin'
};

export function redirectTarget(requestUrl) {
  const url = new URL(requestUrl);
  const ownHost = OWN_HOSTS.has(url.hostname);
  if (url.protocol === 'https:' && ownHost) return null;
  // Local development (wrangler dev) is left alone.
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return null;
  const target = new URL(url.pathname + url.search, `https://${ownHost ? url.hostname : CANONICAL_HOST}`);
  return target.toString();
}

export function withSecurityHeaders(response) {
  const secured = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) secured.headers.set(name, value);
  return secured;
}

export default {
  async fetch(request, env) {
    const target = redirectTarget(request.url);
    if (target) return Response.redirect(target, 301);
    return withSecurityHeaders(await env.ASSETS.fetch(request));
  }
};
