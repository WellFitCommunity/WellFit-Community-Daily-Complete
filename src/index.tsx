// src/index.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './index.css';

// Data Router
import { createAppRouter } from './routes/createAppRouter';

// React Query
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';

// Toasts
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Error boundary & Providers
import { RootErrorBoundary } from './ErrorBoundary';
import { register, promptUpdate, UPDATE_EVENT_NAME } from './serviceWorkerRegistration';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { DemoModeProvider } from './contexts/DemoModeContext';

// Environment validation - MUST run before anything else
import { validateOrFail } from './utils/environmentValidator';

// Claude init
import { claudeService } from './services/claudeService';

// Wearable adapters init
import { initializeWearables } from './services/initializeWearables';

// ============================================================================
// STARTUP VALIDATION - Fail fast if critical env vars are missing
// ============================================================================
try {
  validateOrFail();
} catch (error) {
  // In production, this will prevent the app from starting
  // Display error to user instead of broken app
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        background: #fee;
        font-family: system-ui, sans-serif;
        padding: 2rem;
      ">
        <div style="
          max-width: 600px;
          background: white;
          padding: 2rem;
          border-radius: 8px;
          border: 2px solid #c33;
        ">
          <h1 style="color: #c33; margin-top: 0;">⚠️ Configuration Error</h1>
          <p style="color: #333;">
            The application cannot start due to missing security configuration.
          </p>
          <pre style="
            background: #f5f5f5;
            padding: 1rem;
            border-radius: 4px;
            overflow-x: auto;
            font-size: 0.875rem;
          ">${error instanceof Error ? error.message : 'Unknown error'}</pre>
          <p style="color: #666; margin-bottom: 0;">
            Contact your system administrator to resolve this issue.
          </p>
        </div>
      </div>
    `;
  }
  throw error; // Re-throw to prevent further execution
}

// Guardian Agent init
// import { GuardianAgent } from './services/guardian-agent/GuardianAgent'; // Disabled - Node.js modules

function DemoModeBridge({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const id = user?.id ?? null;
  const demoEnabled =
    String(import.meta.env.VITE_DEMO_ENABLED ?? 'false').toLowerCase() === 'true';

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
  .catch((_error) => {
    // Claude AI service initialization failed (limited AI features)
  });

// Initialize wearable adapters
initializeWearables();

// Guardian Agent removed - it's a backend service that requires Node.js
// It should run as a separate Edge Function or backend service, not in the browser
// The browser cannot access file system, child processes, or other Node.js APIs

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}
const root = createRoot(rootElement);

// Create the data router instance
// This must be done outside of the render to avoid recreating on every render
const router = createAppRouter();

root.render(
  <React.StrictMode>
    <LanguageProvider>
      <AuthProvider>
        <AdminAuthProvider>
          <DemoModeBridge>
            <QueryClientProvider client={queryClient}>
              <RootErrorBoundary>
                <RouterProvider router={router} />
                {/* Global toast container */}
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
              </RootErrorBoundary>
              {/* React Query DevTools - Only visible in development */}
              {import.meta.env.MODE === 'development' && (
                <ReactQueryDevtools initialIsOpen={false} />
              )}
            </QueryClientProvider>
          </DemoModeBridge>
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
