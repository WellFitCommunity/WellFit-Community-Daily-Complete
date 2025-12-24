import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigationHistory } from '../../contexts/NavigationHistoryContext';
import { ArrowLeft } from 'lucide-react';

interface SmartBackButtonProps {
  className?: string;
  label?: string;
  fallbackPath?: string;
}

/**
 * Helper to check if user has admin privileges
 * Checks both app_metadata.role (string) and app_metadata.roles (array) for compatibility
 */
const checkIsAdmin = (user: any): boolean => {
  if (!user) return false;

  // Check single role (app_metadata.role)
  const role = user?.app_metadata?.role;
  if (role === 'admin' || role === 'super_admin' || role === 'it_admin') {
    return true;
  }

  // Check roles array for backwards compatibility
  const roles = user?.app_metadata?.roles || [];
  if (Array.isArray(roles) && (roles.includes('admin') || roles.includes('super_admin'))) {
    return true;
  }

  // Check is_admin flag
  if (user?.app_metadata?.is_admin === true) {
    return true;
  }

  return false;
};

/**
 * Smart back button that provides intuitive navigation:
 * 1. Uses NavigationHistoryContext to track in-app navigation
 * 2. Falls back to context-aware parent route if no history
 *
 * This solves the problem where navigate(-1) might take you to login
 * or external pages instead of the previous in-app screen.
 */
const SmartBackButton: React.FC<SmartBackButtonProps> = ({
  className = '',
  label,
  fallbackPath,
}) => {
  const location = useLocation();
  const { user } = useAuth();
  const { goBack, canGoBack, getPreviousRoute } = useNavigationHistory();

  const getDefaultLabel = (): string => {
    if (label) return label;

    const isAdmin = checkIsAdmin(user);
    const path = location.pathname;

    // Check if we have a previous route in history
    const previousRoute = getPreviousRoute();
    if (previousRoute) {
      // Context-aware labels based on where we're going back to
      if (previousRoute.startsWith('/super-admin') || previousRoute.startsWith('/envision')) {
        return 'Back to Envision';
      }
      if (previousRoute.startsWith('/admin') || previousRoute.startsWith('/billing')) {
        return 'Back to Admin';
      }
      if (previousRoute.startsWith('/nurse-')) {
        return 'Back to Nurse Dashboard';
      }
      if (previousRoute.startsWith('/physician-')) {
        return 'Back to Physician Dashboard';
      }
      if (previousRoute === '/dashboard') {
        return 'Back to Dashboard';
      }
      // Generic "Back" for other cases with history
      return 'Back';
    }

    // No history - use current location context for label
    if (path.startsWith('/super-admin') || path.startsWith('/envision')) {
      return 'Back to Envision';
    }

    if (path.startsWith('/admin') || path.startsWith('/billing') || path.startsWith('/it-admin')) {
      return 'Back to Admin';
    }

    if (path.startsWith('/nurse-')) {
      return 'Back to Nurse Dashboard';
    }

    if (path.startsWith('/physician-')) {
      return 'Back to Physician Dashboard';
    }

    return isAdmin ? 'Back to Admin' : 'Back to Dashboard';
  };

  const handleBack = () => {
    goBack(fallbackPath);
  };

  return (
    <button
      onClick={handleBack}
      className={`inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${className}`}
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      {getDefaultLabel()}
    </button>
  );
};

export default SmartBackButton;
