// src/serviceWorkerRegistration.ts
// Production kill-switch by default. Flip REACT_APP_ENABLE_SW=true to re-enable later.
// Safe guards: never register on preview domains, and always unregister on prod unless flag is true.

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  /^127(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)){3}$/.test(window.location.hostname)
);

// Feature flag (do NOT enable until your SW is replaced with the safe version I gave you)
const ENABLE_SW = String(process.env.REACT_APP_ENABLE_SW || '').toLowerCase() === 'true';

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
    setTimeout(() => location.reload(), 10);
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
 * REGISTER (safe): In production, we default to UNREGISTER unless REACT_APP_ENABLE_SW=true.
 * In preview (vercel.app) we also UNREGISTER to avoid protected-asset 401s and MIME issues.
 * In localhost, we honor the flag so you can test SW deliberately.
 */
export function register(config?: Config) {
  if (!('serviceWorker' in navigator)) return;

  // Always unregister on preview, or when feature flag is not enabled in prod.
  if (isVercelPreview || (!isLocalhost && !ENABLE_SW)) {
    // console.log('[SW] Disabled (preview or prod without flag) — unregistering');
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
