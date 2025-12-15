// src/serviceWorkerRegistration.ts
// WellFit — bulletproof SW registration with kill switches, watchdog, and update prompt wiring

type Config = {
  onSuccess?: (reg: ServiceWorkerRegistration) => void;
  onUpdate?: (reg: ServiceWorkerRegistration) => void;
};

// ---------- Configurable switches ----------
const ENV_ENABLE =
  String(import.meta.env.VITE_ENABLE_SW ?? 'true').toLowerCase() !== 'false';

const PUBLIC_URL = process.env.PUBLIC_URL || '';

const ALLOWED_HOSTS = new Set<string>([
  // Primary domains
  'wellfitcommunity.live',
  'www.wellfitcommunity.live',
  'thewellfitcommunity.org',
  'www.thewellfitcommunity.org',
  // Additional domains
  'wellfitcommunity.com',
  'www.wellfitcommunity.com',
  'app.thewellfitcommunity.org',
  'app.wellfitcommunity.live',
  // Development
  'localhost',
  '127.0.0.1',
]);

// Never register on Vercel preview domains
const isVercelPreview = /\.vercel\.app$/i.test(window.location.hostname);

// Kill switches (any one disables SW)
const urlParams = new URLSearchParams(window.location.search);
const QS_DISABLE = ['nosw', 'disable_sw', 'sw', 'sw=off'].some((k) => {
  // treat ?nosw, ?disable_sw, or ?sw=off as disable
  if (k.includes('=')) return urlParams.toString().includes(k);
  return urlParams.has(k);
});

const LS_DISABLE = (() => {
  try {
    return localStorage.getItem('WF_DISABLE_SW') === '1';
  } catch {
    return false;
  }
})();

const ENABLED = ENV_ENABLE && !isVercelPreview && !QS_DISABLE && !LS_DISABLE;

// ---------- Event names & helpers ----------
export const UPDATE_EVENT_NAME = 'wf-sw-update-available'; // window event
const UPDATE_EVENT = () => new CustomEvent(UPDATE_EVENT_NAME);

function isHttpsOrLocal(): boolean {
  return (
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
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
  } catch {
    /* ignore */
  }
}

function sameOriginPublicUrl(): boolean {
  try {
    const u = new URL(PUBLIC_URL || '/', window.location.href);
    return u.origin === window.location.origin;
  } catch {
    return true;
  }
}

// Optional: expose console helpers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window as any).WF = Object.assign((window as any).WF || {}, {
  swKill: async () => {
    await hardUnregister();
    window.location.replace(window.location.pathname);
  },
  swDisable: () => {
    try {
      localStorage.setItem('WF_DISABLE_SW', '1');
    } catch {}
  },
  swEnable: () => {
    try {
      localStorage.removeItem('WF_DISABLE_SW');
    } catch {}
  },
});

// ---------- Public API ----------
export async function unregister(): Promise<void> {
  await hardUnregister();
  // Soft reload to escape controlled state
  setTimeout(() => window.location.reload(), 10);
}

/**
 * Safe, guarded registration with a watchdog:
 *  - Only HTTPS (except localhost)
 *  - Only on ALLOWED_HOSTS
 *  - Honors ENV, query (?nosw=1), and localStorage killswitch
 *  - If activation stalls > maxActivateMs, auto-unregister
 *  - Emits `wf-sw-update-available` when a new SW is installed/waiting
 */
export function register(config?: Config, maxActivateMs = 8000): void {
  if (!('serviceWorker' in navigator)) return;

  // Global guards
  if (!ENABLED) {
    void hardUnregister();
    return;
  }
  if (!ALLOWED_HOSTS.has(window.location.hostname)) {
    void hardUnregister();
    return;
  }
  if (!isHttpsOrLocal()) {
    // Never register on plain HTTP (except localhost/127.0.0.1)
    return;
  }
  if (!sameOriginPublicUrl()) return;

  window.addEventListener('load', () => {
    const swUrl = `${PUBLIC_URL}/service-worker.js`;

    navigator.serviceWorker
      .register(swUrl, { updateViaCache: 'none' })
      .then((registration) => {
        // Activation watchdog
        const start = Date.now();
        let done = false;

        const finishOk = () => {
          if (done) return;
          done = true;
          config?.onSuccess?.(registration);
        };

        const notifyUpdate = () => {
          try {
            window.dispatchEvent(UPDATE_EVENT());
          } catch {}
          config?.onUpdate?.(registration);
        };

        const failWatchdog = async () => {
          if (done) return;
          done = true;
          await hardUnregister();
          // leave reload to the UI
        };

        // If already controlling, we’re good
        if (navigator.serviceWorker.controller) {
          finishOk();
        }

        // Track installing/updating states
        registration.onupdatefound = () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.onstatechange = () => {
            switch (installing.state) {
              case 'installed':
                if (navigator.serviceWorker.controller) {
                  // New SW installed and waiting
                  notifyUpdate();
                } else {
                  // First install
                  finishOk();
                }
                break;
              case 'activated':
                finishOk();
                break;
              default:
                break;
            }
          };
        };

        // If controller changes, mark success
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

/**
 * Tell the active/waiting SW to activate immediately, then reload the page.
 * Pair this with a small UI banner that calls promptUpdate() on click.
 */
export function promptUpdate(): void {
  const postSkip = () => {
    try {
      navigator.serviceWorker?.controller?.postMessage('SKIP_WAITING');
    } catch {
      /* ignore */
    }
    // Give it a beat to swap, then reload
    setTimeout(() => window.location.reload(), 300);
  };

  // If a waiting SW exists, ask it to activate; otherwise try to ping the controller
  navigator.serviceWorker?.getRegistration?.().then((reg) => {
    if (reg?.waiting) {
      reg.waiting.postMessage('SKIP_WAITING');
      setTimeout(() => window.location.reload(), 300);
    } else {
      postSkip();
    }
  }).catch(postSkip);
}

/**
 * Tiny helper to wire a default update banner without extra code.
 * Call once in App.tsx:
 *
 *   useEffect(() => wireUpdateBanner(), []);
 *
 * It will append a minimal bottom banner; replace with your own UI when ready.
 */
export function wireUpdateBanner(): void {
  const handler = () => {
    // create a minimal unobtrusive banner
    const bar = document.createElement('div');
    bar.style.position = 'fixed';
    bar.style.left = '50%';
    bar.style.bottom = '16px';
    bar.style.transform = 'translateX(-50%)';
    bar.style.background = '#111';
    bar.style.color = '#fff';
    bar.style.padding = '8px 12px';
    bar.style.borderRadius = '12px';
    bar.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
    bar.style.zIndex = '2147483647';
    bar.style.fontSize = '14px';
    bar.textContent = 'New version ready. ';

    const btn = document.createElement('button');
    btn.textContent = 'Reload';
    btn.style.marginLeft = '8px';
    btn.style.textDecoration = 'underline';
    btn.style.fontWeight = '600';
    btn.onclick = () => {
      promptUpdate();
      if (bar.parentNode) bar.parentNode.removeChild(bar);
    };

    bar.appendChild(btn);
    document.body.appendChild(bar);
  };

  window.addEventListener(UPDATE_EVENT_NAME, handler, { once: true });
}
