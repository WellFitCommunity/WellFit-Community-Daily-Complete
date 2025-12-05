/**
 * NavigationHistoryContext
 *
 * Tracks in-app navigation to provide reliable "back" functionality.
 * Unlike browser history, this only tracks routes visited within the app
 * after authentication, excluding auth-related pages.
 *
 * This solves the problem where navigate(-1) might go back to login
 * or external pages.
 */

import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

// Routes that should NOT be added to navigation history
const AUTH_ROUTES = [
  '/login',
  '/register',
  '/verify-code',
  '/reset-password',
  '/admin-login',
  '/envision/login',
  '/logout',
  '/welcome',
  '/',
];

// Default fallback routes by role context
const ROLE_FALLBACKS: Record<string, string> = {
  admin: '/admin',
  super_admin: '/super-admin',
  nurse: '/nurse-dashboard',
  physician: '/physician-dashboard',
  caregiver: '/caregiver-dashboard',
  default: '/dashboard',
};

interface NavigationHistoryContextType {
  /** Check if there's a valid previous route in the app to go back to */
  canGoBack: boolean;
  /** Navigate back to the previous in-app route, or fallback based on role */
  goBack: (fallbackPath?: string) => void;
  /** Get the previous route without navigating */
  getPreviousRoute: () => string | null;
  /** Clear navigation history (call on logout) */
  clearHistory: () => void;
  /** Current navigation stack (for debugging) */
  historyStack: string[];
}

const NavigationHistoryContext = createContext<NavigationHistoryContextType | undefined>(undefined);

export const NavigationHistoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Use ref to avoid re-renders on every navigation
  const historyStackRef = useRef<string[]>([]);

  // Track if we're in a back navigation to avoid re-adding the route
  const isNavigatingBackRef = useRef(false);

  // Get user role for fallback determination
  const getUserRole = useCallback((): string => {
    if (!user) return 'default';

    const role = user?.app_metadata?.role;
    if (role === 'admin' || role === 'super_admin' || role === 'it_admin') {
      return role === 'super_admin' ? 'super_admin' : 'admin';
    }

    const roles = user?.app_metadata?.roles || [];
    if (Array.isArray(roles)) {
      if (roles.includes('super_admin')) return 'super_admin';
      if (roles.includes('admin')) return 'admin';
      if (roles.includes('nurse')) return 'nurse';
      if (roles.includes('physician')) return 'physician';
      if (roles.includes('caregiver')) return 'caregiver';
    }

    if (user?.app_metadata?.is_admin) return 'admin';

    return 'default';
  }, [user]);

  // Determine fallback path based on current location and role
  const getFallbackPath = useCallback((currentPath: string): string => {
    const role = getUserRole();

    // Context-aware fallbacks based on current path
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

    // Role-based fallbacks
    return ROLE_FALLBACKS[role] || ROLE_FALLBACKS.default;
  }, [getUserRole]);

  // Add route to history when location changes
  useEffect(() => {
    const currentPath = location.pathname;

    // Skip if navigating back
    if (isNavigatingBackRef.current) {
      isNavigatingBackRef.current = false;
      return;
    }

    // Skip auth routes
    if (AUTH_ROUTES.some(route => currentPath === route || currentPath.startsWith(route + '/'))) {
      return;
    }

    // Skip if same as current top of stack (no duplicate entries for same page)
    const stack = historyStackRef.current;
    if (stack.length > 0 && stack[stack.length - 1] === currentPath) {
      return;
    }

    // Add to stack (limit to 50 entries to prevent memory issues)
    historyStackRef.current = [...stack.slice(-49), currentPath];
  }, [location.pathname]);

  // Clear history on logout or when user changes
  useEffect(() => {
    if (!user) {
      historyStackRef.current = [];
    }
  }, [user]);

  const canGoBack = historyStackRef.current.length > 1;

  const getPreviousRoute = useCallback((): string | null => {
    const stack = historyStackRef.current;
    if (stack.length > 1) {
      return stack[stack.length - 2];
    }
    return null;
  }, []);

  const goBack = useCallback((fallbackPath?: string) => {
    const stack = historyStackRef.current;

    if (stack.length > 1) {
      // Remove current page from stack
      stack.pop();
      // Get previous page
      const previousRoute = stack[stack.length - 1];

      // Mark that we're navigating back (to prevent re-adding route)
      isNavigatingBackRef.current = true;

      // Navigate to previous route
      navigate(previousRoute);
    } else {
      // No history - use fallback
      const currentPath = location.pathname;
      const targetPath = fallbackPath || getFallbackPath(currentPath);

      // Don't navigate if we're already there
      if (currentPath !== targetPath) {
        navigate(targetPath);
      }
    }
  }, [navigate, location.pathname, getFallbackPath]);

  const clearHistory = useCallback(() => {
    historyStackRef.current = [];
  }, []);

  const value: NavigationHistoryContextType = {
    canGoBack,
    goBack,
    getPreviousRoute,
    clearHistory,
    historyStack: historyStackRef.current,
  };

  return (
    <NavigationHistoryContext.Provider value={value}>
      {children}
    </NavigationHistoryContext.Provider>
  );
};

export const useNavigationHistory = (): NavigationHistoryContextType => {
  const context = useContext(NavigationHistoryContext);
  if (!context) {
    throw new Error('useNavigationHistory must be used within a NavigationHistoryProvider');
  }
  return context;
};

export default NavigationHistoryContext;
