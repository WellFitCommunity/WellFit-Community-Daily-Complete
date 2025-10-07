// public/service-worker.js - Offline-First Service Worker for Rural Healthcare

const CACHE_NAME = 'wellfit-offline-v1';
const RUNTIME_CACHE = 'wellfit-runtime-v1';

// Essential files to cache for offline use
const ESSENTIAL_FILES = [
  '/',
  '/index.html',
  '/static/css/main.css',
  '/static/js/main.js',
  '/manifest.json',
  '/favicon.ico'
];

// Install - cache essential files
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing for offline support...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching essential files');
        return cache.addAll(ESSENTIAL_FILES.map(url => new Request(url, { cache: 'reload' })))
          .catch(err => {
            console.warn('[Service Worker] Some files could not be cached:', err);
            // Continue anyway - app will work with partial cache
          });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating offline support...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch - serve from cache when offline, update cache when online
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions and other protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Skip Supabase API calls - we'll handle those separately with IndexedDB
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  // Skip external resources we don't control
  if (url.hostname.includes('hcaptcha.com') ||
      url.hostname.includes('google') ||
      url.hostname.includes('gstatic')) {
    return;
  }

  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        // Return cached version if available
        if (cachedResponse) {
          // Update cache in background if online
          if (navigator.onLine) {
            fetch(request)
              .then(response => {
                if (response && response.status === 200) {
                  caches.open(RUNTIME_CACHE)
                    .then(cache => cache.put(request, response.clone()));
                }
              })
              .catch(() => {
                // Fetch failed, but we have cache - no problem
              });
          }
          return cachedResponse;
        }

        // Not in cache - fetch from network
        return fetch(request)
          .then(response => {
            // Don't cache bad responses
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }

            // Cache successful responses
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE)
              .then(cache => cache.put(request, responseToCache));

            return response;
          })
          .catch(error => {
            console.log('[Service Worker] Fetch failed, offline mode:', error);

            // Return offline page for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('/index.html');
            }

            throw error;
          });
      })
  );
});

// Handle background sync for pending health reports
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-health-reports') {
    event.waitUntil(syncPendingReports());
  }
});

async function syncPendingReports() {
  console.log('[Service Worker] Syncing pending health reports...');

  try {
    // Notify all clients that sync is starting
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_START',
        message: 'Syncing your saved health reports...'
      });
    });

    // The actual sync will be handled by the app's IndexedDB utility
    // We just trigger it here
    return Promise.resolve();
  } catch (error) {
    console.error('[Service Worker] Sync failed:', error);
    throw error;
  }
}

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      })
    );
  }
});

console.log('[Service Worker] Loaded and ready for offline support!');
