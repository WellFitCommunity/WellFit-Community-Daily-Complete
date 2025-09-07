// src/index.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import 'react-toastify/dist/ReactToastify.css';

import './serviceWorkerRegistration'; // if you need side effects, otherwise keep the import below
import ErrorBoundary from './ErrorBoundary';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

// ✅ Our single Supabase client lives here (used by contexts/components when needed)
import { supabase } from './lib/supabaseClient';

// ✅ Auth + Admin + Demo
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import { DemoModeProvider } from './contexts/DemoModeContext';

// ✅ Branding
import { BrandingProvider } from './BrandingContext';

// Bridge passes userId to DemoModeProvider without DemoMode importing useAuth directly
function DemoModeBridge({ children }: { children: React.ReactNode }) {
  const { user, userId } = useAuth() as any;
  const id = (user?.id ?? userId ?? null) as string | null;
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
    {/* ⛔ Removed SessionContextProvider — we are not using auth-helpers */}
    <AuthProvider>
      <BrandingProvider>
        <DemoModeBridge>
          <AdminAuthProvider>
            <BrowserRouter>
              <ErrorBoundary>
                <App />
              </ErrorBoundary>
            </BrowserRouter>
          </AdminAuthProvider>
        </DemoModeBridge>
      </BrandingProvider>
    </AuthProvider>
  </React.StrictMode>
);

// Service worker choice
serviceWorkerRegistration.unregister();
