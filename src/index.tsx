// src/index.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import 'react-toastify/dist/ReactToastify.css';

// ✅ use the canonical client + provider from our lib
import { SessionContextProvider } from './lib/supabaseClient';
import { supabase } from './lib/supabaseClient';

import ErrorBoundary from './ErrorBoundary';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

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

serviceWorkerRegistration.unregister();
