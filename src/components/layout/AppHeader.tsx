import React from 'react';
import { useLocation } from 'react-router-dom';
import GlobalHeader from './GlobalHeader';
import WelcomeHeader from './WelcomeHeader';

// Optional: a slimmer admin header
function AdminHeader() {
  return (
    <header className="w-full bg-gray-900 text-white shadow-md">
      <div className="max-w-7xl mx-auto h-12 px-4 flex items-center justify-between">
        <div className="font-semibold tracking-tight">Admin Console</div>
        <div className="text-xs opacity-80">WellFit • Secure Area</div>
      </div>
    </header>
  );
}

const WELCOME_ROUTES = ['/', '/welcome']; // add others if needed
const ADMIN_PREFIX = '/admin';

export default function AppHeader() {
  const { pathname } = useLocation();

  const isWelcome = WELCOME_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  const isAdmin = pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);

  if (isWelcome) return <WelcomeHeader />;

  // Choose one of these two lines:
  // return isAdmin ? <AdminHeader /> : <GlobalHeader />;   // distinct admin header
  return <GlobalHeader />;                                  // reuse global header everywhere else
}
