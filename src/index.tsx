import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

// ✅ Supabase auth context
import { SessionContextProvider } from '@supabase/auth-helpers-react';
import { supabase } from './lib/supabaseClient';

// ✅ Corrected ErrorBoundary import
import ErrorBoundary from './components/ErrorBoundary'; // ✅ matches your actual file location

// ✅ Get the root element safely
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

// ✅ Create the root and render
const root = ReactDOM.createRoot(rootElement);
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

// ✅ Unregister the service worker to prevent white screen issues
serviceWorkerRegistration.register();
