// src/serviceWorkerRegistration.ts
// Enable offline support for rural healthcare areas with poor connectivity
// Safe guards: never register on preview domains to avoid MIME issues

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  /^127(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)){3}$/.test(window.location.hostname)
);

// Feature flag: Enable by default for production (rural healthcare needs offline support)
// Can be disabled with REACT_APP_ENABLE_SW=false if needed
const ENABLE_SW = String(process.env.REACT_APP_ENABLE_SW || 'true').toLowerCase() !== 'false';

// Treat *.vercel.app as preview; your prod is the custom domain.
const isVercelPreview = /\.vercel\.app$/.test(window.location.hostname);

// Utility: politely unregister any existing worker and purge old caches
async function hardUnregister() {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map(r => r.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    // Tell controlled pages to reload if needed
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage('SKIP_WAITING');
    }
    // Soft reload to escape controlled state
    setTimeout(() => window.location.reload(), 10);
  } catch (e) {
    // no-op
    // console.warn('[SW] Unregister error', e);
  }
}

type Config = {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
};

/**
 * REGISTER (safe): Enable service worker for offline support in rural healthcare areas.
 * - In preview (vercel.app) we UNREGISTER to avoid protected-asset 401s and MIME issues.
 * - In production, SW is ENABLED by default for rural offline support.
 * - Can be disabled with REACT_APP_ENABLE_SW=false if needed.
 */
export function register(config?: Config) {
  if (!('serviceWorker' in navigator)) return;

  // Always unregister on preview domains to avoid MIME issues
  // Can be disabled in production with REACT_APP_ENABLE_SW=false
  if (isVercelPreview || !ENABLE_SW) {
    // console.log('[SW] Disabled by config or running on preview — unregistering');
    void hardUnregister();
    return;
  }

  // From here on, SW is explicitly allowed (localhost or prod with flag)
  const publicUrl = new URL(process.env.PUBLIC_URL || '', window.location.href);
  if (publicUrl.origin !== window.location.origin) return;

  window.addEventListener('load', () => {
    const swUrl = `${process.env.PUBLIC_URL || ''}/service-worker.js`;
    registerValidSW(swUrl, config);
  });
}

function registerValidSW(swUrl: string, config?: Config) {
  navigator.serviceWorker
    .register(swUrl, { updateViaCache: 'none' })
    .then((registration) => {
      // console.log('[SW] Registered');

      registration.onupdatefound = () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.onstatechange = () => {
          if (installing.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // New content available
              config?.onUpdate?.(registration);
            } else {
              // First install complete
              config?.onSuccess?.(registration);
            }
          }
        };
      };
    })
    .catch((error) => {
      // console.error('[SW] Registration failed:', error);
    });
}

export function unregister() {
  if (!('serviceWorker' in navigator)) return;
  void hardUnregister();
}
