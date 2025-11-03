// src/index.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './index.css';
import App from './App';

// Toasts
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Error boundary & Providers
import ErrorBoundary from './ErrorBoundary';
import { register, promptUpdate, UPDATE_EVENT_NAME } from './serviceWorkerRegistration';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { DemoModeProvider } from './contexts/DemoModeContext';

// Claude init
import { claudeService } from './services/claudeService';

// Guardian Agent init
// import { GuardianAgent } from './services/guardian-agent/GuardianAgent'; // Disabled - Node.js modules

function DemoModeBridge({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const id = user?.id ?? null;
  const demoEnabled =
    String(process.env.REACT_APP_DEMO_ENABLED ?? 'false').toLowerCase() === 'true';

  return (
    <DemoModeProvider enabled={demoEnabled} userId={id}>
      {children}
    </DemoModeProvider>
  );
}

// Initialize Claude service on app startup
claudeService
  .initialize()
  .then(() => {

  })
  .catch((error) => {
    // Claude AI service initialization failed (limited AI features)
  });

// Guardian Agent removed - it's a backend service that requires Node.js
// It should run as a separate Edge Function or backend service, not in the browser
// The browser cannot access file system, child processes, or other Node.js APIs

const root = createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <LanguageProvider>
      <AuthProvider>
        <AdminAuthProvider>
          <HashRouter>
            <ErrorBoundary>
              <DemoModeBridge>
                <App />
                {/* Global toast container (if you already mount one inside App, remove this to avoid duplicates) */}
                <ToastContainer
                  containerId="root-toaster"
                  position="bottom-center"
                  newestOnTop
                  closeOnClick
                  draggable
                  pauseOnHover
                  limit={2}
                  autoClose={4000}
                />
              </DemoModeBridge>
            </ErrorBoundary>
          </HashRouter>
        </AdminAuthProvider>
      </AuthProvider>
    </LanguageProvider>
  </React.StrictMode>
);

/**
 * ===========================
 * Service Worker Registration
 * ===========================
 *
 * Two separate “updates”:
 * 1) App Version Update (new deploy) → show toast with Reload button (calls promptUpdate()).
 * 2) Connectivity/Data Sync (offline→online) → show small “Back online” toast.
 */
register({
  onSuccess: () => {

  },
  onUpdate: () => {
    // Proactive toast; user can reload immediately
    toast.info(
      <span>
        A new version is available.&nbsp;
        <button
          onClick={() => promptUpdate()}
          style={{ textDecoration: 'underline', fontWeight: 600 }}
        >
          Reload
        </button>
      </span>,
      { containerId: 'root-toaster', autoClose: false }
    );
  },
});

// Also listen for our custom event from serviceWorkerRegistration (belt & suspenders)
window.addEventListener(
  UPDATE_EVENT_NAME,
  () => {
    toast.info(
      <span>
        New version ready.&nbsp;
        <button
          onClick={() => promptUpdate()}
          style={{ textDecoration: 'underline', fontWeight: 600 }}
        >
          Reload
        </button>
      </span>,
      { containerId: 'root-toaster', autoClose: false }
    );
  },
  { once: true }
);

// Connectivity signals (Data/Sync layer — separate from app version updates)
window.addEventListener('online', () => {
  toast.success('Back online — syncing data if needed…', { containerId: 'root-toaster' });
});

window.addEventListener('offline', () => {
  toast.warn('You are offline — changes will be queued locally.', { containerId: 'root-toaster' });
});

// Optional: expose a manual quick action for debugging from DevTools console
// window.WF?.swKill?.();  // instantly unregisters SW + clears caches + reloads path
