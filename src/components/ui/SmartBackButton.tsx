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
 * Smart back button that routes users to contextually appropriate pages
 * - Admins/Super Admins → /admin
 * - Seniors/Regular Users → /dashboard
 * - Falls back to browser history or specified fallback path
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
    // Determine smart fallback based on user role
    const getSmartFallback = (): string => {
      if (fallbackPath) return fallbackPath;

      // Check if user has admin role
      const roles = user?.app_metadata?.roles || [];
      const isAdmin = roles.includes('admin') || roles.includes('super_admin');

      // Determine fallback based on current location and role
      if (location.pathname.startsWith('/admin')) {
        return isAdmin ? '/admin' : '/dashboard';
      }

      if (location.pathname.startsWith('/billing')) {
        return '/admin';
      }

      // Senior-facing pages should go back to dashboard
      if (['/health-insights', '/questions', '/check-in', '/self-reporting'].some(
        path => location.pathname.startsWith(path)
      )) {
        return '/dashboard';
      }

      // Default fallback
      return isAdmin ? '/admin' : '/dashboard';
    };

    // Try browser history first, fallback to smart navigation
    if (window.history.length > 2) {
      window.history.back();
    } else {
      navigate(getSmartFallback());
    }
  };

  const getDefaultLabel = (): string => {
    if (label) return label;

    const roles = user?.app_metadata?.roles || [];
    const isAdmin = roles.includes('admin') || roles.includes('super_admin');

    if (location.pathname.startsWith('/admin')) {
      return 'Back to Admin';
    }

    if (location.pathname.startsWith('/billing')) {
      return 'Back to Admin';
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
