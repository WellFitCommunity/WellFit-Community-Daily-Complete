/* public/service-worker.js — Redirect-safe, MIME-aware offline SW (WellFit)
   Fixes: "redirect mode is not 'follow'" by forcing redirect:'follow' and avoiding caching redirects.
   Strategy:
    - Navigations (HTML): network-first with SPA shell fallback
    - Static assets: cache-first
    - Same-origin GET runtime: network-first
    - Never intercept: non-GET or cross-origin; bypass auth/captcha/Supabase routes
*/

const VERSION = 'wellfit-v5.0.1';
const SHELL_CACHE = `shell-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;
const NAV_SHELL = '/index.html';

// Only cache stable shell files (⚠️ do NOT cache "/" — hosts often redirect it)
const SHELL_FILES = ['/index.html', '/manifest.json', '/favicon.ico'];

// Paths we never intercept/cache (auth flows, callbacks, captcha, etc.)
const BYPASS_PATH_PREFIXES = [
  '/login', '/register', '/verify', '/logout',
  '/auth', '/auth/callback', '/api/auth',
  '/hcaptcha', '/captcha',
  '/api/hcaptcha', '/api/hcaptcha/verify'
];

// ---------- Install: pre-cache shell (best-effort) ----------
self.addEventListener('install', (event) => {
  // Enable navigation preload for faster navigations (best-effort)
  if ('navigationPreload' in self.registration) {
    self.registration.navigationPreload.enable().catch(() => {});
  }
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) =>
        cache.addAll(SHELL_FILES.map(u => new Request(u, { cache: 'reload', redirect: 'follow' })))
      )
      .catch(() => {}) // don't fail install if one misses
      .then(() => self.skipWaiting())
  );
});

// ---------- Activate: purge old caches ----------
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(k => ![SHELL_CACHE, RUNTIME_CACHE].includes(k))
          .map(k => caches.delete(k))
      );
      if (self.registration.navigationPreload) {
        try { await self.registration.navigationPreload.enable(); } catch {}
      }
    } catch (_) {}
    await self.clients.claim();
  })());
});

// ---------- Helpers ----------
const sameOrigin = (url) => {
  try { return new URL(url).origin === self.location.origin; } catch { return false; }
};

const isSPAHtmlNav = (request) =>
  request.mode === 'navigate' ||
  (request.method === 'GET' &&
   (request.headers.get('accept') || '').includes('text/html'));

const shouldBypass = (url) => {
  try {
    const u = new URL(url, self.location.origin);
    return BYPASS_PATH_PREFIXES.some(p => u.pathname === p || u.pathname.startsWith(p + '/'));
  } catch {
    return true; // safest: let browser handle it
  }
};

const isStaticDest = (request) => {
  const d = request.destination;
  if (['style', 'script', 'image', 'font'].includes(d)) return true;
  const p = new URL(request.url).pathname;
  return /\.(?:css|js|mjs|ico|png|jpg|jpeg|gif|webp|svg|woff2?|ttf|eot|map)$/.test(p);
};

const canCache = (response) => {
  if (!response) return false;
  if (response.redirected) return false;        // never cache redirects
  if (!['basic', 'cors'].includes(response.type)) return false; // ignore opaque where possible
  if (response.status !== 200) return false;
  const ct = response.headers.get('content-type') || '';
  return /text\/html|text\/css|application\/javascript|application\/json|image\/|font\//i.test(ct);
};

const isHtml = (response) => {
  if (!response) return false;
  const ct = response.headers.get('content-type') || '';
  return ct.includes('text/html');
};

// Always follow redirects when SW fetches
const fetchFollow = (request, opts = {}) => fetch(request, { redirect: 'follow', ...opts });

// ---------- Fetch ----------
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle same-origin GETs
  if (req.method !== 'GET' || !sameOrigin(req.url)) return;

  // Never intercept explicit bypass routes (auth, captcha, etc.)
  if (shouldBypass(req.url)) return;

  // 1) Navigations (HTML): network-first, SPA shell fallback
  if (isSPAHtmlNav(req)) {
    event.respondWith(handleNavigation(event));
    return;
  }

  // 2) Static assets: cache-first, never cache HTML or redirected responses
  if (isStaticDest(req)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // 3) Other same-origin GETs: network-first with runtime cache
  event.respondWith(networkFirstRuntime(req));
});

// ---------- Strategies ----------
async function handleNavigation(event) {
  // Try navigation preload first (fast path)
  try {
    const preload = await event.preloadResponse;
    if (preload && isHtml(preload)) return preload;
  } catch (_) {}

  try {
    const net = await fetchFollow(event.request, { cache: 'no-store' });
    if (isHtml(net)) return net;

    // If server gives non-HTML (or a redirect we won’t cache), serve shell
    const shell = await caches.match(NAV_SHELL);
    if (shell) return shell;

    // Last resort: fetch shell from network following redirects
    return await fetchFollow(NAV_SHELL, { cache: 'reload' });
  } catch {
    const shell = await caches.match(NAV_SHELL);
    return shell || new Response('', { status: 503, statusText: 'Offline' });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreVary: false, ignoreSearch: false });
  if (cached) return cached;

  try {
    const net = await fetchFollow(request);
    if (canCache(net) && !isHtml(net)) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, net.clone()).catch(() => {});
    }
    return net;
  } catch {
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirstRuntime(request) {
  try {
    const net = await fetchFollow(request);
    if (canCache(net)) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, net.clone()).catch(() => {});
    }
    return net;
  } catch {
    const fallback = await caches.match(request, { ignoreVary: false, ignoreSearch: false });
    if (fallback) return fallback;

    if (isSPAHtmlNav(request)) {
      const shell = await caches.match(NAV_SHELL);
      return shell || new Response('', { status: 503, statusText: 'Offline' });
    }
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

// ---------- Messaging (optional ops) ----------
self.addEventListener('message', (event) => {
  const msg = event.data;
  if (msg === 'SKIP_WAITING') self.skipWaiting();
  if (msg === 'CLEAR_CACHE') {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    })());
  }
});

// ---------- Background Sync (for offline data) ----------
// Syncs pending health reports, check-ins, and vitals when connection returns
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-data') {
    event.waitUntil(syncPendingData());
  }
  if (event.tag === 'sync-pending-reports') {
    event.waitUntil(syncPendingData());
  }
});

async function syncPendingData() {
  // Open IndexedDB to get pending items
  const db = await openOfflineDB();
  if (!db) return;

  try {
    const pendingReports = await getAllPending(db, 'pendingReports');
    const pendingMeasurements = await getAllPending(db, 'measurements');

    // Notify clients that sync is starting
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'SYNC_STARTED', count: pendingReports.length + pendingMeasurements.length });
    });

    let synced = 0;
    let failed = 0;

    // Sync reports
    for (const report of pendingReports) {
      try {
        const response = await fetch('/api/health-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report.data),
          credentials: 'include'
        });
        if (response.ok) {
          await markSynced(db, 'pendingReports', report.id);
          synced++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    // Sync measurements
    for (const measurement of pendingMeasurements) {
      try {
        const response = await fetch('/api/vitals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(measurement.data),
          credentials: 'include'
        });
        if (response.ok) {
          await markSynced(db, 'measurements', measurement.id);
          synced++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    // Notify clients of completion
    clients.forEach(client => {
      client.postMessage({ type: 'SYNC_COMPLETE', synced, failed });
    });

    db.close();
  } catch (err) {
    db.close();
    throw err; // Re-throw to trigger retry
  }
}

// IndexedDB helpers for background sync
function openOfflineDB() {
  return new Promise((resolve) => {
    const request = indexedDB.open('wellfit-offline', 1);
    request.onerror = () => resolve(null);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingReports')) {
        const store = db.createObjectStore('pendingReports', { keyPath: 'id', autoIncrement: true });
        store.createIndex('synced', 'synced', { unique: false });
      }
      if (!db.objectStoreNames.contains('measurements')) {
        const store = db.createObjectStore('measurements', { keyPath: 'id', autoIncrement: true });
        store.createIndex('synced', 'synced', { unique: false });
      }
    };
  });
}

function getAllPending(db, storeName) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index('synced');
      const request = index.getAll(IDBKeyRange.only(false));
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

function markSynced(db, storeName, id) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const record = getReq.result;
        if (record) {
          record.synced = true;
          record.syncedAt = new Date().toISOString();
          store.put(record);
        }
        resolve();
      };
      getReq.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// Service worker loaded - logging disabled for HIPAA compliance
