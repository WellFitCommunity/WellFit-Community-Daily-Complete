// src/index.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import 'react-toastify/dist/ReactToastify.css';

import ErrorBoundary from './ErrorBoundary';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

// ✅ Providers
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
// ❌ Do not import BrandingProvider here because App.tsx already provides BrandingContext
// import { BrandingProvider } from './BrandingContext';

// Bridge passes userId to DemoModeProvider without DemoMode importing useAuth directly
import { DemoModeProvider } from './contexts/DemoModeContext';

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

const root = createRoot(document.getElementById('root')!);

root.render(
  <React.StrictMode>
    <AuthProvider>
      <AdminAuthProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <DemoModeBridge>
              <App />
            </DemoModeBridge>
          </ErrorBoundary>
        </BrowserRouter>
      </AdminAuthProvider>
    </AuthProvider>
  </React.StrictMode>
);

// Service worker choice (keep as-is or switch to register() if you need offline)
// Learn more: https://cra.link/PWA
serviceWorkerRegistration.unregister();

