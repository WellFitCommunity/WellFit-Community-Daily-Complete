import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import GlobalHeader from './GlobalHeader';
import WelcomeHeader from './WelcomeHeader';
import { allRoutes } from '../../routes/routeConfig';

const WELCOME_ROUTES = ['/', '/welcome'];
const AUTH_ROUTES = ['/login', '/register', '/verify', '/admin-login', '/reset-password', '/change-password'];

// Categories that have their own AdminHeader — suppress GlobalHeader on these.
// Derived from routeConfig.ts so new routes are automatically handled.
const OWN_HEADER_CATEGORIES = new Set(['admin', 'superAdmin', 'clinical', 'chw', 'ems', 'workflow']);

// Build the exclusion set once at module load (static route config, no runtime cost per render)
const ENVISION_ATLUS_ROUTES: string[] = allRoutes
  .filter((r) => OWN_HEADER_CATEGORIES.has(r.category))
  .map((r) => r.path.replace(/\/:[^/]+/g, '')) // Strip dynamic segments for prefix matching
  .filter((p, i, arr) => arr.indexOf(p) === i); // Dedupe

// Also suppress on /envision auth routes (not in routeConfig as admin/clinical)
const EXTRA_SUPPRESS = ['/envision'];

export default function AppHeader() {
  const { pathname } = useLocation();

  const headerType = useMemo(() => {
    if (WELCOME_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return 'welcome';
    }

    if (AUTH_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return 'none';
    }

    // Check if this is an admin/clinical/chw/ems route (has its own AdminHeader)
    const isEnvisionAtlus =
      ENVISION_ATLUS_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
      EXTRA_SUPPRESS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

    if (isEnvisionAtlus) return 'none';

    return 'global';
  }, [pathname]);

  if (headerType === 'welcome') return <WelcomeHeader />;
  if (headerType === 'none') return null;

  return <GlobalHeader />;
}
