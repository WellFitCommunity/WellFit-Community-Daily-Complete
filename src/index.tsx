// src/index.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import 'react-toastify/dist/ReactToastify.css';

import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { createClient } from '@supabase/supabase-js';

import ErrorBoundary from './ErrorBoundary';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

// ✅ Auth + Admin + Demo
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import { DemoModeProvider } from './contexts/DemoModeContext';

// ✅ Branding (provider for useBranding consumers)
import { BrandingProvider } from './BrandingContext';

// ---- Supabase env (dual-key support) ----
const supabaseUrl =
  process.env.REACT_APP_SB_URL ||
  process.env.REACT_APP_SUPABASE_URL;

const supabaseAnonKey =
  process.env.REACT_APP_SB_PUBLISHABLE_KEY ||
  process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Optional: log a clear message during development
  // console.warn('Missing Supabase env: REACT_APP_SB_URL/REACT_APP_SUPABASE_URL and/or REACT_APP_SB_PUBLISHABLE_KEY/REACT_APP_SUPABASE_ANON_KEY');
}

const supabase = createClient(supabaseUrl as string, supabaseAnonKey as string, {
  auth: { persistSession: true, storageKey: 'wellfit-auth' },
});

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
    <SessionContextProvider supabaseClient={supabase}>
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
    </SessionContextProvider>
  </React.StrictMode>
);

serviceWorkerRegistration.unregister();

