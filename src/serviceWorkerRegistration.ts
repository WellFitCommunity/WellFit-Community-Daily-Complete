// src/serviceWorkerRegistration.ts
// WellFit — bulletproof SW registration with kill switches + watchdog
// Goals:
//  - Never register on previews/unapproved hosts
//  - One-click "panic" kill switch (?nosw=1 or localStorage flag)
//  - HTTPS-only (except localhost)
//  - Auto-unregister watchdog if activation stalls or errors out

type Config = {
  onSuccess?: (reg: ServiceWorkerRegistration) => void;
  onUpdate?: (reg: ServiceWorkerRegistration) => void;
};

// ---------- Configurable switches ----------
const ENV_ENABLE = String(process.env.REACT_APP_ENABLE_SW ?? 'true').toLowerCase() !== 'false';
const PUBLIC_URL = process.env.PUBLIC_URL || '';
const ALLOWED_HOSTS = new Set([
  'wellfitcommunity.live',
  'www.wellfitcommunity.live',
  'localhost',
  '127.0.0.1',
]);

// Preview domains (never register)
const isVercelPreview = /\.vercel\.app$/i.test(window.location.hostname);

// Kill switches (any one disables SW)
const urlParams = new URLSearchParams(window.location.search);
const QS_DISABLE = ['nosw', 'disable_sw', 'sw=off'].some((k) => urlParams.has(k));
const LS_DISABLE = ((): boolean => {
  try { return localStorage.getItem('WF_DISABLE_SW') === '1'; } catch { return false; }
})();

const ENABLED = ENV_ENABLE && !isVercelPreview && !QS_DISABLE && !LS_DISABLE;

// ---------- Utilities ----------
function isHttpsOrLocal(): boolean {
  return window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

async function hardUnregister(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.allSettled(keys.map((k) => caches.delete(k)));
    }
  } catch { /* ignore */ }
}

function sameOriginPublicUrl(): boolean {
  try {
    const u = new URL(PUBLIC_URL, window.location.href);
    return u.origin === window.location.origin;
  } catch { return true; }
}

// Optional: expose a console helper to kill SW instantly
;(window as any).WF = Object.assign((window as any).WF || {}, {
  swKill: async () => { await hardUnregister(); window.location.replace(window.location.pathname); },
  swDisable: () => { try { localStorage.setItem('WF_DISABLE_SW', '1'); } catch {} },
  swEnable: () => { try { localStorage.removeItem('WF_DISABLE_SW'); } catch {} },
});

// ---------- Public API ----------
export async function unregister(): Promise<void> {
  await hardUnregister();
  // Soft reload to escape controlled state
  setTimeout(() => window.location.reload(), 10);
}

/**
 * Safe, guarded registration with a watchdog:
 * - Only HTTPS (except localhost)
 * - Only on ALLOWED_HOSTS
 * - Honors ENV, query param (?nosw=1), and localStorage kill switch
 * - If installation/activation stalls > maxActivateMs, auto-unregister
 */
export function register(config?: Config, maxActivateMs: number = 8000): void {
  if (!('serviceWorker' in navigator)) return;

  // Global guards
  if (!ENABLED) {
    // Hard unregister if previously installed but now disabled
    void hardUnregister();
    return;
  }
  if (!ALLOWED_HOSTS.has(window.location.hostname)) {
    void hardUnregister();
    return;
  }
  if (!isHttpsOrLocal()) {
    // Never register on plain HTTP (except localhost)
    return;
  }
  if (!sameOriginPublicUrl()) return;

  window.addEventListener('load', () => {
    const swUrl = `${PUBLIC_URL}/service-worker.js`;

    navigator.serviceWorker
      .register(swUrl, { updateViaCache: 'none' })
      .then((registration) => {
        // Activation watchdog — if we don't get an active controller in time, nuke it.
        const start = Date.now();
        let done = false;

        const finishOk = () => {
          if (done) return; done = true;
          config?.onSuccess?.(registration);
        };
        const finishUpdate = () => {
          if (done) return; done = true;
          config?.onUpdate?.(registration);
        };
        const failWatchdog = async () => {
          if (done) return; done = true;
          await hardUnregister();
          // No reload here; let the user reload manually or via CTA
          // console.warn('[SW] Watchdog: auto-unregistered due to activation stall');
        };

        // If already controlling, we're good
        if (navigator.serviceWorker.controller) {
          finishOk();
        }

        // Track installing state changes
        registration.onupdatefound = () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.onstatechange = () => {
            if (installing.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                finishUpdate();
              } else {
                finishOk();
              }
            }
            if (installing.state === 'activated') {
              finishOk();
            }
          };
        };

        // Also listen for controllerchange to mark success
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          finishOk();
        });

        // Watchdog timer
        setTimeout(() => {
          if (!done && Date.now() - start >= maxActivateMs) {
            void failWatchdog();
          }
        }, maxActivateMs);
      })
      .catch(async () => {
        // Registration failed — ensure we’re clean
        await hardUnregister();
      });
  });
}
