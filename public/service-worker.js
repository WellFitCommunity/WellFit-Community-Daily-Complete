// public/service-worker.js — Safe, MIME-aware offline SW
// - No guessing hashed filenames
// - Never caches HTML for script/style requests
// - Network-first for navigations, cache-first for static assets

const CACHE_VERSION = 'wellfit-v4-spa-routes';
const SHELL_CACHE = `shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;
const NAV_FALLBACK_URL = '/index.html';

// Only cache stable shell files. (Hashed assets are cached on-demand.)
const SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico'
];

// --- Install: pre-cache shell (best-effort)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_FILES.map(u => new Request(u, { cache: 'reload' }))))
      .catch(() => {}) // don't fail install if one misses
      .then(() => self.skipWaiting())
  );
});

// --- Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => {
        if (!k.includes(CACHE_VERSION)) return caches.delete(k);
      }))
    ).then(() => self.clients.claim())
  );
});

// Utility: detect HTML responses
const isHtml = (resp) => {
  const ct = resp.headers.get('content-type') || '';
  return ct.includes('text/html');
};

// --- Fetch handler
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Handle only http(s) GET
  if (req.method !== 'GET' || !url.protocol.startsWith('http')) return;

  // Ignore third-party domains we don't control (APIs, captchas, etc.)
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('hcaptcha.com') ||
    url.hostname.includes('google') ||
    url.hostname.includes('gstatic.com')
  ) return;

  // 1) Navigations: network-first with index.html fallback
  if (req.mode === 'navigate') {
    // Known SPA routes - serve index.html directly without network request
    const spaRoutes = [
      '/login', '/register', '/verify', '/dashboard', '/admin', '/admin-login',
      '/settings', '/help', '/check-in', '/logout', '/privacy-policy', '/terms',
      '/health-insights', '/health-dashboard', '/questions', '/word-find',
      '/consent-photo', '/consent-privacy', '/self-reporting', '/doctors-view',
      '/community', '/trivia-game', '/smart-callback', '/caregiver-dashboard',
      '/demographics', '/nurse-dashboard', '/billing', '/change-password', '/reset-password'
    ];

    const isSpaRoute = spaRoutes.some(route =>
      url.pathname === route || url.pathname.startsWith(route + '/')
    );

    if (isSpaRoute) {
      // Serve index.html directly for known SPA routes
      event.respondWith(
        caches.match(NAV_FALLBACK_URL).then(cached =>
          cached || fetch(NAV_FALLBACK_URL)
        )
      );
      return;
    }

    // For other navigations, try network first
    event.respondWith(
      fetch(req).catch(async () =>
        (await caches.match(NAV_FALLBACK_URL)) || Response.error()
      )
    );
    return;
  }

  // 2) Static assets (script/style/image/font): cache-first, but NEVER cache HTML
  const dest = req.destination; // 'script' | 'style' | 'image' | 'font' | ...
  if (['script', 'style', 'image', 'font'].includes(dest)) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;

      try {
        const net = await fetch(req);
        if (net.ok && !isHtml(net)) {
          const clone = net.clone();
          const cache = await caches.open(RUNTIME_CACHE);
          await cache.put(req, clone);
        }
        return net;
      } catch {
        // No cache and offline -> generic failure
        return new Response('', { status: 503, statusText: 'Offline' });
      }
    })());
    return;
  }

  // 3) Everything else: try network, fall back to cache if present
  event.respondWith((async () => {
    try {
      return await fetch(req);
    } catch {
      const cached = await caches.match(req);
      return cached || new Response('', { status: 503, statusText: 'Offline' });
    }
  })());
});

// Support messages if you use them
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
    );
  }
});

console.log('[SW] Safe, MIME-aware service worker loaded.');
