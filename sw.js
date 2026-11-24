// HFA SilverStrong service worker — keeps the app shell available offline so patients can open their
// encrypted records, the Vital Health Card and the SLY Symptom Checker without internet.
// Security rules: only the static app shell and fonts are cached — never API calls, never patient data
// (that lives encrypted in IndexedDB), never error or redirected responses. Bump CACHE to force an update.
const CACHE = 'hfa-shell-v2';
const SHELL = ['./', './index.html', './assets/hfa-logo.svg', './manifest.webmanifest'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const cacheable = res => res && res.status === 200 && !res.redirected && (res.type === 'basic' || res.type === 'cors')
  && !/no-store/i.test(res.headers.get('Cache-Control') || '');

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin && url.pathname.includes('/api/')) return;           // live data is never cached

  // Pages: network first so security fixes arrive, cached copy when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => { if (cacheable(res)) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); } return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Static assets and fonts: cache first, refreshed in the background.
  if ((sameOrigin && /\.(svg|png|webmanifest|css|js|woff2?)$/i.test(url.pathname)) || FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(req).then(cached => {
        const network = fetch(req).then(res => {
          if (cacheable(res)) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
  }
});
