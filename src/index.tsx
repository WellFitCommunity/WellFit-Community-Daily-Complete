import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

// ✅ Supabase auth context
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { supabase } from './lib/supabaseClient';

// ✅ Corrected ErrorBoundary import
import ErrorBoundary from './ErrorBoundary';

// ✅ Register Firebase Messaging Service Worker (must be before ReactDOM.createRoot)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .then((registration) => {
        console.log('Firebase Messaging SW registered:', registration.scope);
      })
      .catch((err) => {
        console.warn('Service Worker registration failed:', err);
      });
  });
}

// ✅ Get the root element safely
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

// ✅ Create the root and render
const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <SessionContextProvider supabaseClient={supabase}>
      <BrowserRouter>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </BrowserRouter>
    </SessionContextProvider>
  </React.StrictMode>
);

// ✅ Register (not unregister) service worker for PWA features (including push)
serviceWorkerRegistration.register();
