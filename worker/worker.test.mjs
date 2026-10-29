import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { redirectTarget } from './index.js';

const assets = { fetch: async () => new Response('<html>ok</html>', { status: 200, headers: { 'Content-Type': 'text/html' } }) };

test('every address ends up on https://www.healthyfutureafrica.org', () => {
  assert.equal(redirectTarget('https://www.healthyfutureafrica.org/'), null);
  assert.equal(redirectTarget('https://healthyfutureafrica.org/?refresh'), null, 'the bare domain is also secure');
  assert.equal(redirectTarget('http://www.healthyfutureafrica.org/index.html?x=1'), 'https://www.healthyfutureafrica.org/index.html?x=1');
  assert.equal(redirectTarget('http://healthyfutureafrica.org/'), 'https://healthyfutureafrica.org/');
  assert.equal(redirectTarget('http://hfa-silverstrong.healthyfutureafrica.workers.dev/assets/hfa-logo.svg'), 'https://www.healthyfutureafrica.org/assets/hfa-logo.svg');
  assert.equal(redirectTarget('https://hfa-silverstrong.healthyfutureafrica.workers.dev/'), 'https://www.healthyfutureafrica.org/');
  assert.equal(redirectTarget('http://localhost:8787/'), null, 'local development is not redirected');
});

test('redirects are permanent and pages carry the security headers', async () => {
  const redirect = await worker.fetch(new Request('http://hfa-silverstrong.healthyfutureafrica.workers.dev/'), { ASSETS: assets });
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get('Location'), 'https://www.healthyfutureafrica.org/');
  const page = await worker.fetch(new Request('https://www.healthyfutureafrica.org/'), { ASSETS: assets });
  assert.equal(page.status, 200);
  assert.equal(await page.text(), '<html>ok</html>');
  assert.match(page.headers.get('Strict-Transport-Security'), /max-age=31536000/);
  assert.match(page.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
  assert.equal(page.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(page.headers.get('Content-Type'), 'text/html', 'original headers are kept');
});

test('the static website reports that no backend is configured without returning an API 404', async () => {
  const config = await worker.fetch(new Request('https://www.healthyfutureafrica.org/api/config'), { ASSETS: assets });
  assert.equal(config.status, 200);
  assert.deepEqual(await config.json(), { backend: false });
  assert.equal(config.headers.get('Cache-Control'), 'no-store');

  const login = await worker.fetch(new Request('https://www.healthyfutureafrica.org/api/auth/login', { method: 'POST' }), { ASSETS: assets });
  assert.equal(login.status, 503);
  assert.deepEqual(await login.json(), { error: 'The HFA account service is not connected to this public website.' });
  assert.ok(login.headers.get('Strict-Transport-Security'));
});

test('missing static files still return 404', async () => {
  const missing = await worker.fetch(new Request('https://www.healthyfutureafrica.org/missing.js'), { ASSETS: { fetch: async () => new Response('Not found', { status: 404 }) } });
  assert.equal(missing.status, 404);
  assert.ok(missing.headers.get('Strict-Transport-Security'));
});
