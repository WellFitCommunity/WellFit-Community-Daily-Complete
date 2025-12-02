import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
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
 * Smart back button that routes users to contextually appropriate pages
 * - Admins/Super Admins → /admin
 * - Seniors/Regular Users → /dashboard
 * - Falls back to browser history or specified fallback path
 *
 * IMPORTANT: Does NOT use window.history.back() to avoid navigation loops.
 * Always uses explicit route navigation based on context.
 */
const SmartBackButton: React.FC<SmartBackButtonProps> = ({
  className = '',
  label,
  fallbackPath,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const handleBack = () => {
    // Determine smart fallback based on user role and current location
    const getSmartFallback = (): string => {
      if (fallbackPath) return fallbackPath;

      const isAdmin = checkIsAdmin(user);
      const path = location.pathname;

      // Envision/Super Admin pages → back to Envision dashboard
      if (path.startsWith('/super-admin') || path.startsWith('/envision')) {
        return '/super-admin';
      }

      // Admin sub-pages → back to admin panel
      if (path.startsWith('/admin/') || path === '/admin-settings' || path === '/admin-questions') {
        return '/admin';
      }

      // Billing pages → back to admin
      if (path.startsWith('/billing')) {
        return '/admin';
      }

      // IT Admin pages → back to admin
      if (path.startsWith('/it-admin')) {
        return '/admin';
      }

      // Nurse/Physician dashboards → back to their respective dashboards
      if (path.startsWith('/nurse-')) {
        return '/nurse-dashboard';
      }
      if (path.startsWith('/physician-')) {
        return '/physician-dashboard';
      }

      // Senior-facing pages should go back to dashboard
      if (['/health-insights', '/questions', '/check-in', '/self-reporting', '/profile', '/settings', '/memory-lane'].some(
        p => path.startsWith(p)
      )) {
        return '/dashboard';
      }

      // Default: admins go to admin, others go to dashboard
      return isAdmin ? '/admin' : '/dashboard';
    };

    // Always use explicit navigation to avoid loops
    // Do NOT use window.history.back() as it can cause infinite loops
    navigate(getSmartFallback());
  };

  const getDefaultLabel = (): string => {
    if (label) return label;

    const isAdmin = checkIsAdmin(user);
    const path = location.pathname;

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

  return (
    <button
      onClick={handleBack}
      className={`inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${className}`}
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      {getDefaultLabel()}
    </button>
  );
};

export default SmartBackButton;
