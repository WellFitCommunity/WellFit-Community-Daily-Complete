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

  // String messages (legacy)
  if (msg === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (msg === 'CLEAR_CACHE') {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    })());
    return;
  }

  // Object messages (structured)
  if (typeof msg === 'object' && msg !== null) {
    // SYNC_NOW: Client requests immediate sync check
    if (msg.type === 'SYNC_NOW') {
      event.waitUntil(syncPendingData());
      return;
    }

    // SYNC_COMPLETE_ACK: Client acknowledges sync completion
    if (msg.type === 'SYNC_COMPLETE_ACK') {
      // Clear any pending sync notification
      if (self.registration.getNotifications) {
        self.registration.getNotifications({ tag: 'offline-sync-pending' })
          .then(notifications => {
            notifications.forEach(n => n.close());
          })
          .catch(() => {});
      }
      return;
    }

    // SYNC_SPECIALIST_NOW: Client requests immediate specialist sync
    if (msg.type === 'SYNC_SPECIALIST_NOW') {
      event.waitUntil(syncSpecialistData());
      return;
    }

    // SPECIALIST_SYNC_COMPLETE_ACK: Client acknowledges specialist sync completion
    if (msg.type === 'SPECIALIST_SYNC_COMPLETE_ACK') {
      if (self.registration.getNotifications) {
        self.registration.getNotifications({ tag: 'specialist-sync-pending' })
          .then(notifications => {
            notifications.forEach(n => n.close());
          })
          .catch(() => {});
      }
      return;
    }
  }
});

// ---------- Background Sync (for offline data) ----------
// Syncs pending health reports, check-ins, and vitals when connection returns
// Strategy: Delegate to client windows (which have auth context) when available
self.addEventListener('sync', (event) => {
  // WellFit community data (health reports, vitals)
  if (event.tag === 'sync-pending-data' || event.tag === 'sync-pending-reports') {
    event.waitUntil(syncPendingData());
  }
  // Envision Atlus specialist data (visits, assessments, photos, alerts)
  if (event.tag === 'sync-specialist-data') {
    event.waitUntil(syncSpecialistData());
  }
});

async function syncPendingData() {
  // Open IndexedDB to check if there's pending data
  const db = await openOfflineDB();
  if (!db) return;

  try {
    const pendingReports = await getAllPending(db, 'pendingReports');
    const pendingMeasurements = await getAllPending(db, 'measurements');
    const totalPending = pendingReports.length + pendingMeasurements.length;

    if (totalPending === 0) {
      db.close();
      return; // Nothing to sync
    }

    // Find all client windows
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    if (allClients.length > 0) {
      // Delegate sync to client windows - they have Supabase auth context
      // The client's OfflineIndicator will handle the actual sync
      allClients.forEach(client => {
        client.postMessage({
          type: 'SYNC_REQUESTED',
          count: totalPending,
          reports: pendingReports.length,
          measurements: pendingMeasurements.length
        });
      });

      // Client will handle the sync and mark items as synced
      // We don't need to do anything else here
      db.close();
      return;
    }

    // No client windows available - this is a true background sync
    // We can't use Supabase auth, so we'll leave items pending
    // and notify when a client window opens
    db.close();

    // Queue a notification to remind user (if notifications are enabled)
    if (self.registration.showNotification) {
      try {
        await self.registration.showNotification('WellFit Health Data Pending', {
          body: `${totalPending} health report(s) waiting to sync. Open the app to sync.`,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'offline-sync-pending',
          requireInteraction: false,
          silent: true
        });
      } catch {
        // Notifications not permitted - that's okay
      }
    }
  } catch (err) {
    db.close();
    throw err; // Re-throw to trigger retry
  }
}

/**
 * Sync specialist data (Envision Atlus - visits, assessments, photos, alerts)
 * Strategy: Delegate to client windows which have Supabase auth context
 */
async function syncSpecialistData() {
  const db = await openSpecialistDB();
  if (!db) return;

  try {
    const stores = ['visits', 'assessments', 'photos', 'alerts'];
    let totalPending = 0;

    for (const storeName of stores) {
      const pending = await getSpecialistPending(db, storeName);
      totalPending += pending.length;
    }

    if (totalPending === 0) {
      db.close();
      return;
    }

    // Find client windows to delegate sync
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    if (allClients.length > 0) {
      // Delegate to clients with auth context
      allClients.forEach(client => {
        client.postMessage({
          type: 'SPECIALIST_SYNC_REQUESTED',
          count: totalPending
        });
      });
      db.close();
      return;
    }

    // No clients - show notification
    db.close();
    if (self.registration.showNotification) {
      try {
        await self.registration.showNotification('Specialist Data Pending', {
          body: `${totalPending} record(s) waiting to sync. Open the app to sync.`,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'specialist-sync-pending',
          requireInteraction: false,
          silent: true
        });
      } catch {
        // Notifications not permitted
      }
    }
  } catch (err) {
    db.close();
    throw err;
  }
}

// IndexedDB helpers for background sync
// MUST match client-side DB in src/utils/offlineStorage.ts
function openOfflineDB() {
  return new Promise((resolve) => {
    const request = indexedDB.open('WellFitOfflineDB', 3);
    request.onerror = () => resolve(null);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      // Schema must match src/utils/offlineStorage.ts exactly
      if (!db.objectStoreNames.contains('pendingReports')) {
        const store = db.createObjectStore('pendingReports', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains('measurements')) {
        const store = db.createObjectStore('measurements', { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
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

// Specialist (Envision Atlus) IndexedDB helpers
// MUST match client-side DB in src/services/specialist-workflow-engine/OfflineDataSync.ts
function openSpecialistDB() {
  return new Promise((resolve) => {
    const request = indexedDB.open('WellFitSpecialistOffline', 1);
    request.onerror = () => resolve(null);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const stores = ['visits', 'assessments', 'photos', 'alerts'];
      for (const storeName of stores) {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: 'id' });
          store.createIndex('synced', 'synced', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          if (storeName !== 'visits') {
            store.createIndex('visit_id', 'visit_id', { unique: false });
          }
        }
      }
    };
  });
}

function getSpecialistPending(db, storeName) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index('synced');
      // Note: specialist DB uses boolean false, not 0
      const request = index.getAll(IDBKeyRange.only(false));
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

// Service worker loaded - logging disabled for HIPAA compliance
