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
 * Smart back button that provides intuitive navigation:
 * 1. First tries browser history (go back to where you came from)
 * 2. Falls back to context-aware parent route if no history
 *
 * Loop prevention: Detects if going back would cause a redirect loop
 * (e.g., admin on /dashboard would redirect back to /admin)
 */
const SmartBackButton: React.FC<SmartBackButtonProps> = ({
  className = '',
  label,
  fallbackPath,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Get smart fallback based on current location and user role
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

  // Check if a path would cause a redirect loop for this user
  const wouldCauseLoop = (targetPath: string): boolean => {
    const isAdmin = checkIsAdmin(user);

    // Admin going to /dashboard would redirect back to /admin (loop)
    if (isAdmin && targetPath === '/dashboard') {
      return true;
    }

    // Non-admin going to /admin would be unauthorized (not a loop, but bad)
    if (!isAdmin && targetPath === '/admin') {
      return true;
    }

    return false;
  };

  const handleBack = () => {
    // Check if we have explicit "from" state passed during navigation
    const fromState = (location.state as any)?.from;
    if (fromState && !wouldCauseLoop(fromState)) {
      navigate(fromState);
      return;
    }

    // Try browser history if we have meaningful history
    // (more than 2 entries means we navigated within the app)
    if (window.history.length > 2) {
      // Use navigate(-1) which is the React Router way
      navigate(-1);
      return;
    }

    // Fallback to smart context-aware navigation
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
