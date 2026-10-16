const VERSION = 'ezbo-v2.0.0';
const SHELL = [
  '/',
  '/manifest.webmanifest?v=20261016',
  '/icon-192.png?v=20261016',
  '/icon-512.png?v=20261016',
  '/icon-maskable-512.png?v=20261016',
  '/apple-touch-icon.png?v=20261016',
  '/branding/favicon/default-favicon.png?v=20261016',
  '/branding/logos/default-dark-logo.png?v=20261016',
  '/branding/logos/default-light-logo.png?v=20261016'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Never cache API / auth / streaming routes
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/settings') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/checkout') ||
    url.pathname.startsWith('/login') ||
    url.pathname.includes('/stream') ||
    url.pathname.includes('__data.json')
  ) return;

  // Network-First for manifest, branding logos, icons, and favicons so new assets show immediately
  if (
    url.pathname.includes('manifest') ||
    url.pathname.includes('/branding/') ||
    url.pathname.includes('icon-') ||
    url.pathname.includes('favicon')
  ) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy).catch(() => {}));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (req.mode === 'navigate' || /\.(png|svg|webmanifest|css|js|woff2?)$/i.test(url.pathname))) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy).catch(() => {}));
        }
        return res;
      })
      .catch(() => caches.match(req).then((m) => m || caches.match('/')))
  );
});
