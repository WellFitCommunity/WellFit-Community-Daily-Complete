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

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL as string,
  process.env.REACT_APP_SUPABASE_ANON_KEY as string,
  { auth: { persistSession: true, storageKey: 'wellfit-auth' } }
);

// Bridge passes userId to DemoModeProvider without DemoMode using useAuth itself
function DemoModeBridge({ children }: { children: React.ReactNode }) {
  const { user, userId } = useAuth() as any; // support either shape
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
        <DemoModeBridge>
          <AdminAuthProvider>
            <BrowserRouter>
              <ErrorBoundary>
                <App />
              </ErrorBoundary>
            </BrowserRouter>
          </AdminAuthProvider>
        </DemoModeBridge>
      </AuthProvider>
    </SessionContextProvider>
  </React.StrictMode>
);

serviceWorkerRegistration.unregister();
