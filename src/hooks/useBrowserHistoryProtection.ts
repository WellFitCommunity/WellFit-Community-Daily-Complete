/**
 * useBrowserHistoryProtection
 *
 * Enterprise-grade browser history protection for all users.
 *
 * Problem Solved:
 * In SPAs, the browser's physical back button can navigate to:
 * - Auth routes (login, register) from browser history
 * - Pages visited before the current session
 * - External sites if the user entered via a link
 *
 * This causes:
 * - Race conditions with session management
 * - Stale token errors requiring re-authentication
 * - Disrupted user experience in admin panels
 * - Users exiting the app during registration flow
 *
 * Solution:
 * 1. Intercept popstate events for authenticated users in protected routes
 * 2. Intercept popstate events for registration/login flow (all users)
 * 3. Use in-app NavigationHistoryContext instead of browser history
 * 4. Push protective state entries to prevent browser from leaving the app
 * 5. Provide context-aware fallback navigation based on user role
 *
 * Copyright (c) 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession, useAuth } from '../contexts/AuthContext';
import { useNavigationHistory } from '../contexts/NavigationHistoryContext';
import { auditLogger } from '../services/auditLogger';

// Routes that authenticated users should never navigate back to via browser history
const AUTH_ROUTES = [
  '/login',
  '/register',
  '/verify-code',
  '/reset-password',
  '/phone-reset',
  '/welcome',
  '/',
];

// Routes where back button protection is allowed but handled differently
const ALLOWED_AUTH_ROUTES = [
  '/admin-login',
  '/envision/login',
  '/envision',
  '/set-caregiver-pin',
  '/change-password',
];

// Admin/clinical routes that need enhanced protection
const PROTECTED_ROUTE_PREFIXES = [
  '/admin',
  '/super-admin',
  '/envision',
  '/billing',
  '/it-admin',
  '/nurse-',
  '/physician-',
  '/clinical-',
  '/care-',
];

// Registration flow routes - need back button protection for ALL users (even unauthenticated)
// Maps current route to where back button should go
const REGISTRATION_FLOW_BACK_MAP: Record<string, string> = {
  '/register': '/',           // Register -> Welcome
  '/verify-code': '/register', // Verify -> Register
  '/verify': '/register',      // Verify (alt) -> Register
  '/login': '/',              // Login -> Welcome
  '/reset-password': '/login', // Reset Password -> Login
  '/phone-reset': '/login',    // Phone Reset -> Login
  '/admin-login': '/',        // Admin Login -> Welcome
  '/envision/login': '/',     // Envision Login -> Welcome
  '/envision': '/',           // Envision -> Welcome
};

/**
 * Check if a path is within protected admin/clinical routes
 */
function isProtectedRoute(path: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some(prefix => path.startsWith(prefix));
}

/**
 * Check if a path is part of the registration/login flow
 */
function isRegistrationFlowRoute(path: string): boolean {
  return Object.keys(REGISTRATION_FLOW_BACK_MAP).includes(path);
}

/**
 * Get the back destination for registration flow routes
 */
function getRegistrationFlowBackRoute(path: string): string | null {
  return REGISTRATION_FLOW_BACK_MAP[path] || null;
}

/**
 * Get fallback route based on current location and user role
 */
function getFallbackRoute(currentPath: string, isAdmin: boolean): string {
  if (currentPath.startsWith('/super-admin') || currentPath.startsWith('/envision')) {
    return '/super-admin';
  }
  if (currentPath.startsWith('/admin') || currentPath.startsWith('/billing') || currentPath.startsWith('/it-admin')) {
    return '/admin';
  }
  if (currentPath.startsWith('/nurse-')) {
    return '/nurse-dashboard';
  }
  if (currentPath.startsWith('/physician-')) {
    return '/physician-dashboard';
  }
  if (currentPath.startsWith('/clinical-') || currentPath.startsWith('/care-')) {
    return '/clinical-dashboard';
  }

  // Role-based fallback
  return isAdmin ? '/admin' : '/dashboard';
}

/**
 * Hook that provides enterprise-grade browser history protection.
 *
 * For ALL users:
 * - Protects registration/login flow from exiting to external sites
 *
 * For authenticated users, especially in admin/clinical contexts:
 * - Intercepts browser back button
 * - Uses in-app navigation history instead
 * - Prevents navigation outside the application
 * - Provides audit logging for security compliance
 */
export function useBrowserHistoryProtection(): void {
  const session = useSession();
  const { isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Get navigation history context (if available)
  let navHistory: ReturnType<typeof useNavigationHistory> | null = null;
  try {
    navHistory = useNavigationHistory();
  } catch {
    // NavigationHistoryContext not available - fall back to basic protection
  }

  // Track if we're currently handling a popstate to prevent loops
  const isHandlingPopstate = useRef(false);

  // Track the last valid path for fallback
  const lastValidPath = useRef<string | null>(null);

  // Track if we've pushed our protective state
  const hasProtectiveState = useRef(false);

  // Track if we've pushed registration flow protective state
  const hasRegistrationProtection = useRef(false);

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

  // Push protective state for registration flow (works for ALL users)
  // This ensures back button on /register goes to / instead of external site
  useEffect(() => {
    const currentPath = location.pathname;

    if (isRegistrationFlowRoute(currentPath) && !hasRegistrationProtection.current) {
      // Push a protective state for registration flow
      window.history.pushState(
        { registrationFlow: true, path: currentPath, timestamp: Date.now() },
        '',
        currentPath
      );
      hasRegistrationProtection.current = true;

      auditLogger.debug('REGISTRATION_FLOW_PROTECTION_ENABLED', {
        path: currentPath,
      });
    } else if (!isRegistrationFlowRoute(currentPath)) {
      // Reset when leaving registration flow
      hasRegistrationProtection.current = false;
    }
  }, [location.pathname]);

  // Push protective state when user is authenticated
  // This creates a "barrier" in browser history that prevents accidental exit
  useEffect(() => {
    if (session && !hasProtectiveState.current) {
      const currentPath = location.pathname;

      // Only add protection for non-auth routes
      if (!AUTH_ROUTES.includes(currentPath)) {
        // Push a state marker that we can detect in popstate
        window.history.pushState(
          { protected: true, timestamp: Date.now() },
          '',
          currentPath
        );
        hasProtectiveState.current = true;

        auditLogger.debug('BROWSER_HISTORY_PROTECTION_ENABLED', {
          path: currentPath,
          isAdmin,
        });
      }
    }
  }, [session, location.pathname, isAdmin]);

  // Reset protective state flag on logout
  useEffect(() => {
    if (!session) {
      hasProtectiveState.current = false;
    }
  }, [session]);

  // Handle popstate (browser back/forward button)
  const handlePopstate = useCallback(() => {
    // Prevent handling if we're already in a handler
    if (isHandlingPopstate.current) {
      return;
    }

    const currentPath = window.location.pathname;
    const previousPath = lastValidPath.current || location.pathname;

    // ─────────────────────────────────────────────────────────────────────────
    // REGISTRATION FLOW PROTECTION (works for ALL users, even unauthenticated)
    // ─────────────────────────────────────────────────────────────────────────

    // Check if we WERE on a registration flow route (before back was pressed)
    // The previousPath (from React state) tells us where we were
    const wasOnRegistrationRoute = isRegistrationFlowRoute(previousPath);

    // If we were on a registration route and now we're somewhere unexpected,
    // or if currentPath is empty/external indicator, intercept
    if (wasOnRegistrationRoute) {
      const expectedBackRoute = getRegistrationFlowBackRoute(previousPath);

      // If the browser went somewhere other than our expected back route,
      // or if it looks like we're leaving the app, intercept
      if (expectedBackRoute && currentPath !== expectedBackRoute) {
        isHandlingPopstate.current = true;

        auditLogger.info('REGISTRATION_FLOW_BACK_INTERCEPTED', {
          from: previousPath,
          attemptedPath: currentPath,
          redirectTo: expectedBackRoute,
        });

        // Push state to stay in app
        window.history.pushState(
          { registrationFlow: true, intercepted: true },
          '',
          expectedBackRoute
        );

        // Navigate using React Router
        navigate(expectedBackRoute, { replace: true });

        setTimeout(() => {
          isHandlingPopstate.current = false;
        }, 150);

        return;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AUTHENTICATED USER PROTECTION
    // ─────────────────────────────────────────────────────────────────────────

    // Only continue with authenticated protection if user is logged in
    if (!session) {
      return;
    }

    // Check if we've navigated to an auth route
    const isAuthRoute = AUTH_ROUTES.some(route =>
      currentPath === route || currentPath.startsWith(route + '/')
    );

    // Check if it's an allowed auth route
    const isAllowedRoute = ALLOWED_AUTH_ROUTES.some(route =>
      currentPath === route || currentPath.startsWith(route + '/')
    );

    // Check if we're in a protected context (admin, clinical, etc.)
    const wasInProtectedRoute = isProtectedRoute(previousPath);
    const isNowOutsideProtected = !isProtectedRoute(currentPath);

    // Determine if we need to intercept this navigation
    const shouldIntercept =
      (isAuthRoute && !isAllowedRoute) ||
      (wasInProtectedRoute && isNowOutsideProtected && !isAllowedRoute);

    if (shouldIntercept) {
      isHandlingPopstate.current = true;

      auditLogger.info('BROWSER_BACK_INTERCEPTED', {
        attemptedPath: currentPath,
        previousPath,
        wasInProtectedRoute,
        hasNavHistory: !!navHistory,
      });

      // Use NavigationHistoryContext if available for smart back navigation
      if (navHistory && navHistory.canGoBack) {
        // Let the navigation history handle it properly
        const targetPath = navHistory.getPreviousRoute() || getFallbackRoute(previousPath, isAdmin);

        // Push state to prevent browser from completing its navigation
        window.history.pushState(
          { protected: true, intercepted: true },
          '',
          targetPath
        );

        // Navigate using React Router
        navigate(targetPath, { replace: true });
      } else {
        // No navigation history - use fallback
        const fallbackPath = lastValidPath.current || getFallbackRoute(previousPath, isAdmin);

        // Push state to prevent browser navigation
        window.history.pushState(
          { protected: true, fallback: true },
          '',
          fallbackPath
        );

        // Navigate using React Router
        navigate(fallbackPath, { replace: true });
      }

      // Reset the handling flag after a brief delay
      setTimeout(() => {
        isHandlingPopstate.current = false;
      }, 150);

      return;
    }

    // For non-intercepted navigation within the app, update our last valid path
    if (!isAuthRoute) {
      lastValidPath.current = currentPath;
    }
  }, [session, navigate, location.pathname, navHistory, isAdmin]);

  // Set up popstate listener
  useEffect(() => {
    window.addEventListener('popstate', handlePopstate);

    return () => {
      window.removeEventListener('popstate', handlePopstate);
    };
  }, [handlePopstate]);

  // Handle beforeunload for additional protection
  // This warns users if they try to leave via refresh or close while in protected routes
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Only warn in protected routes with active session
      if (session && isProtectedRoute(location.pathname)) {
        // Modern browsers ignore custom messages, but we need to set returnValue
        event.preventDefault();
        // Chrome requires returnValue to be set
        event.returnValue = '';
        return '';
      }
    };

    // Note: We only add this for admin/clinical routes to avoid annoying regular users
    if (session && isProtectedRoute(location.pathname)) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [session, location.pathname]);
}

export default useBrowserHistoryProtection;
