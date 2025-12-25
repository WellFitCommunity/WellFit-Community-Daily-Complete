/**
 * useBrowserHistoryProtection
 *
 * Prevents browser back button from navigating to auth routes when user is authenticated.
 * This solves the issue where pressing back button takes users to /login from browser history,
 * causing race conditions with session management and stale token errors.
 *
 * How it works:
 * 1. Listens to popstate events (browser back/forward)
 * 2. If navigating to an auth route while authenticated, pushes state back to prevent it
 * 3. Prevents multiple components from racing to handle expired sessions
 */

import { useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../contexts/AuthContext';
import { auditLogger } from '../services/auditLogger';

// Routes that authenticated users should not navigate back to
const AUTH_ROUTES = [
  '/login',
  '/register',
  '/verify-code',
  '/reset-password',
  '/phone-reset',
  '/welcome',
];

// Routes that are acceptable to be on while authenticated (e.g., admin login for 2FA)
const ALLOWED_AUTH_ROUTES = [
  '/admin-login',
  '/envision/login',
  '/envision',
  '/set-caregiver-pin',
  '/change-password',
];

/**
 * Hook that protects against browser back button navigating to auth pages
 * when the user is already authenticated.
 */
export function useBrowserHistoryProtection(): void {
  const session = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  // Track if we're currently handling a popstate to prevent loops
  const isHandlingPopstate = useRef(false);

  // Track the last valid (non-auth) path for fallback
  const lastValidPath = useRef<string | null>(null);

  // Update last valid path when on non-auth routes
  useEffect(() => {
    const currentPath = location.pathname;
    const isAuthRoute = AUTH_ROUTES.some(route =>
      currentPath === route || currentPath.startsWith(route + '/')
    );

    if (!isAuthRoute && session) {
      lastValidPath.current = currentPath;
    }
  }, [location.pathname, session]);

  // Handle popstate (browser back/forward)
  const handlePopstate = useCallback((event: PopStateEvent) => {
    // Prevent handling if we're already in a handler
    if (isHandlingPopstate.current) {
      return;
    }

    // Only act if user is authenticated
    if (!session) {
      return;
    }

    const currentPath = window.location.pathname;

    // Check if we've navigated to an auth route
    const isAuthRoute = AUTH_ROUTES.some(route =>
      currentPath === route || currentPath.startsWith(route + '/')
    );

    // Check if it's an allowed auth route (like admin-login for 2FA)
    const isAllowedRoute = ALLOWED_AUTH_ROUTES.some(route =>
      currentPath === route || currentPath.startsWith(route + '/')
    );

    if (isAuthRoute && !isAllowedRoute) {
      isHandlingPopstate.current = true;

      auditLogger.info('BROWSER_BACK_TO_AUTH_PREVENTED', {
        attemptedPath: currentPath,
        redirectTo: lastValidPath.current || '/dashboard',
        hasSession: true,
      });

      // Determine where to redirect
      const redirectPath = lastValidPath.current || '/dashboard';

      // Use history.pushState to add a new entry, effectively "forward" navigating
      // This prevents the back button from working repeatedly
      window.history.pushState(null, '', redirectPath);

      // Use React Router to update the component tree
      navigate(redirectPath, { replace: true });

      // Reset the flag after a brief delay
      setTimeout(() => {
        isHandlingPopstate.current = false;
      }, 100);
    }
  }, [session, navigate]);

  // Set up popstate listener
  useEffect(() => {
    window.addEventListener('popstate', handlePopstate);

    return () => {
      window.removeEventListener('popstate', handlePopstate);
    };
  }, [handlePopstate]);

  // When user logs in successfully, push state to prevent back navigation
  useEffect(() => {
    if (session && location.pathname !== '/login') {
      // Push a null state to create a new history entry
      // This helps prevent the immediate back button from going to login
      const currentPath = location.pathname;
      if (!AUTH_ROUTES.includes(currentPath)) {
        // Add current path to history to "bury" the login page
        window.history.replaceState({ protected: true }, '', currentPath);
      }
    }
  }, [session, location.pathname]);
}

export default useBrowserHistoryProtection;
