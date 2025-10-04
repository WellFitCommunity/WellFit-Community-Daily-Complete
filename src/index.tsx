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
import { LanguageProvider } from './contexts/LanguageContext';

// Bridge passes userId to DemoModeProvider without DemoMode importing useAuth directly
import { DemoModeProvider } from './contexts/DemoModeContext';

// Initialize Claude AI service
import { claudeService } from './services/claudeService';

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
claudeService.initialize().then(() => {
  console.log('✅ Claude AI service initialized and ready');
}).catch((error) => {
  console.warn('⚠️ Claude AI service initialization failed (app will continue with limited AI features):', error.message);
});

const root = createRoot(document.getElementById('root')!);

root.render(
  <React.StrictMode>
    <LanguageProvider>
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
    </LanguageProvider>
  </React.StrictMode>
);

// Service worker choice (keep as-is or switch to register() if you need offline)
// Learn more: https://cra.link/PWA
serviceWorkerRegistration.unregister();

