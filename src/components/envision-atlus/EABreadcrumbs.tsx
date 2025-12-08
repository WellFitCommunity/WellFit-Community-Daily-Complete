/**
 * EABreadcrumbs
 *
 * ATLUS Enhancement: Unity - Visual navigation trail for context awareness
 *
 * Provides a breadcrumb trail showing the user's navigation path,
 * helping them understand where they are in the application hierarchy.
 *
 * Features:
 * - Automatic breadcrumb generation from current route
 * - Click to navigate back to any point
 * - Shows current patient context when available
 * - Compact mode for space-constrained layouts
 *
 * Copyright 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { ChevronRight, Home, User } from 'lucide-react';
import { usePatientContextSafe } from '../../contexts/PatientContext';

// Route name mappings for human-readable breadcrumbs
const ROUTE_NAMES: Record<string, string> = {
  '': 'Home',
  'admin': 'Admin Dashboard',
  'admin-login': 'Admin Login',
  'super-admin': 'Super Admin',
  'envision': 'Envision Portal',
  'nurse-dashboard': 'Nurse Dashboard',
  'physician-dashboard': 'Physician Dashboard',
  'shift-handoff': 'Shift Handoff',
  'bed-management': 'Bed Management',
  'neuro-suite': 'NeuroSuite',
  'care-coordination': 'Care Coordination',
  'mental-health': 'Mental Health',
  'physical-therapy': 'Physical Therapy',
  'questionnaire-analytics': 'Questionnaires',
  'referrals': 'Referrals',
  'clinical-alerts': 'Clinical Alerts',
  'er-dashboard': 'ER Dashboard',
  'frequent-flyers': 'Frequent Flyers',
  'transfer-logs': 'Transfer Logs',
  'discharged-patients': 'Discharged',
  'ai-revenue': 'AI Revenue',
  'healthcare-algorithms': 'AI Algorithms',
  'chw': 'CHW',
  'dashboard': 'Dashboard',
  'settings': 'Settings',
  'profile': 'Profile',
  'reports': 'Reports',
  'analytics': 'Analytics',
  'billing': 'Billing',
  'claims': 'Claims',
  'patients': 'Patients',
  'enroll-senior': 'Enroll Senior',
  'bulk-enroll': 'Bulk Enrollment',
  'bulk-export': 'Bulk Export',
  'photo-approval': 'Photo Approval',
  'api-keys': 'API Keys',
  'ai-accuracy': 'AI Accuracy',
  'memory-clinic': 'Memory Clinic',
};

// Routes that shouldn't show in breadcrumbs (auth pages, etc.)
const HIDDEN_ROUTES = ['login', 'register', 'verify-code', 'reset-password', 'logout', 'welcome'];

interface BreadcrumbItem {
  label: string;
  path: string;
  isCurrentPage: boolean;
}

interface EABreadcrumbsProps {
  /** Override automatic breadcrumbs with custom items */
  items?: BreadcrumbItem[];
  /** Show home icon at start */
  showHomeIcon?: boolean;
  /** Show current patient in breadcrumbs */
  showPatient?: boolean;
  /** Compact mode - smaller text, less padding */
  compact?: boolean;
  /** Custom class name */
  className?: string;
  /** Maximum items to show (older items collapsed) */
  maxItems?: number;
}

/**
 * Get human-readable name for a route segment
 */
const getRouteName = (segment: string): string => {
  // Check direct mapping
  if (ROUTE_NAMES[segment]) {
    return ROUTE_NAMES[segment];
  }

  // Handle dynamic segments (IDs, etc.)
  if (segment.match(/^[0-9a-f-]{36}$/i)) {
    return 'Details';
  }

  // Convert kebab-case to Title Case
  return segment
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Generate breadcrumb items from current path
 */
const generateBreadcrumbs = (pathname: string): BreadcrumbItem[] => {
  const segments = pathname.split('/').filter(Boolean);

  // Filter out hidden routes
  const visibleSegments = segments.filter(seg => !HIDDEN_ROUTES.includes(seg));

  if (visibleSegments.length === 0) {
    return [];
  }

  const items: BreadcrumbItem[] = [];
  let currentPath = '';

  visibleSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLastSegment = index === visibleSegments.length - 1;

    items.push({
      label: getRouteName(segment),
      path: currentPath,
      isCurrentPage: isLastSegment,
    });
  });

  return items;
};

export const EABreadcrumbs: React.FC<EABreadcrumbsProps> = ({
  items,
  showHomeIcon = true,
  showPatient = true,
  compact = false,
  className = '',
  maxItems = 5,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const patientContext = usePatientContextSafe();

  // Use provided items or generate from current path
  const breadcrumbItems = items || generateBreadcrumbs(location.pathname);

  // Collapse middle items if too many
  const displayItems = breadcrumbItems.length > maxItems
    ? [
        ...breadcrumbItems.slice(0, 1),
        { label: '...', path: '', isCurrentPage: false },
        ...breadcrumbItems.slice(-2),
      ]
    : breadcrumbItems;

  // Don't render if no items
  if (displayItems.length === 0 && !patientContext?.hasPatient) {
    return null;
  }

  const textSize = compact ? 'text-xs' : 'text-sm';
  const iconSize = compact ? 'w-3 h-3' : 'w-4 h-4';
  const spacing = compact ? 'gap-1' : 'gap-2';
  const padding = compact ? 'py-1' : 'py-2';

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center ${spacing} ${textSize} ${padding} ${className}`}
    >
      {/* Home icon */}
      {showHomeIcon && (
        <>
          <Link
            to="/admin"
            className="text-slate-400 hover:text-teal-400 transition-colors"
            title="Go to dashboard"
          >
            <Home className={iconSize} />
          </Link>
          {(displayItems.length > 0 || patientContext?.hasPatient) && (
            <ChevronRight className={`${iconSize} text-slate-600`} />
          )}
        </>
      )}

      {/* Patient context indicator */}
      {showPatient && patientContext?.hasPatient && (
        <>
          <div className="flex items-center gap-1 px-2 py-0.5 bg-teal-500/20 border border-teal-500/30 rounded text-teal-300">
            <User className={iconSize} />
            <span className="font-medium truncate max-w-[150px]">
              {patientContext.getPatientDisplayName()}
            </span>
          </div>
          {displayItems.length > 0 && (
            <ChevronRight className={`${iconSize} text-slate-600`} />
          )}
        </>
      )}

      {/* Breadcrumb items */}
      {displayItems.map((item, index) => (
        <React.Fragment key={item.path || `ellipsis-${index}`}>
          {index > 0 && (
            <ChevronRight className={`${iconSize} text-slate-600 flex-shrink-0`} />
          )}

          {item.path && !item.isCurrentPage ? (
            <button
              onClick={() => navigate(item.path)}
              className="text-slate-400 hover:text-teal-400 transition-colors truncate max-w-[120px]"
              title={item.label}
            >
              {item.label}
            </button>
          ) : item.label === '...' ? (
            <span className="text-slate-500">{item.label}</span>
          ) : (
            <span
              className="text-white font-medium truncate max-w-[150px]"
              aria-current="page"
              title={item.label}
            >
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default EABreadcrumbs;
