// src/routes/RouteRenderer.tsx
// Dynamic route renderer based on route configuration
import React, { Suspense } from 'react';
import { Routes, Route, useParams, useLocation } from 'react-router-dom';

import RequireAuth from '../components/auth/RequireAuth';
import RequireAdminAuth from '../components/auth/RequireAdminAuth';
import RequireSuperAdmin from '../components/auth/RequireSuperAdmin';
import NotFoundPage from '../components/NotFoundPage';

import { featureFlags } from '../config/featureFlags';
import { RouteConfig, allRoutes } from './routeConfig';
import * as LazyComponents from './lazyComponents';
import { useSupabaseClient } from '../contexts/AuthContext';
import type { StaffRole } from '../types/roles';

// ═══════════════════════════════════════════════════════════════════════════════
// WRAPPER COMPONENTS (for routes that need special handling)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Wrapper for SpecialistDashboard to extract route params
 */
export const SpecialistDashboardWrapper: React.FC = () => {
  const { specialistType } = useParams<{ specialistType: string }>();
  const { user } = useSupabaseClient() as any;

  if (!specialistType || !user?.id) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Invalid specialist configuration</p>
      </div>
    );
  }

  return (
    <LazyComponents.SpecialistDashboard
      specialistId={user.id}
      specialistType={specialistType}
    />
  );
};

/**
 * Wrapper for FieldVisitWorkflow to extract route params
 */
export const FieldVisitWorkflowWrapper: React.FC = () => {
  const { visitId } = useParams<{ visitId: string }>();

  if (!visitId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">No visit ID provided</p>
      </div>
    );
  }

  return <LazyComponents.FieldVisitWorkflow visitId={visitId} />;
};

/**
 * Wrapper for MemoryClinicDashboard to extract patient ID from route
 */
export const MemoryClinicDashboardWrapper: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();

  if (!patientId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">No patient ID provided</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Memory Clinic...</div>}>
      <LazyComponents.MemoryClinicDashboard patientId={patientId} />
    </Suspense>
  );
};

/**
 * Wrapper for CoordinatedResponseDashboard to extract handoff context
 */
export const CoordinatedResponseDashboardWrapper: React.FC = () => {
  const { handoffId } = useParams<{ handoffId: string }>();
  const location = useLocation();

  const state = location.state as { chiefComplaint?: string; etaMinutes?: number } | null;
  const chiefComplaint = state?.chiefComplaint || 'Unknown';
  const etaMinutes = state?.etaMinutes || 0;

  if (!handoffId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">No handoff ID provided</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Coordinated Response...</div>}>
      <LazyComponents.CoordinatedResponseDashboard
        handoffId={handoffId}
        chiefComplaint={chiefComplaint}
        etaMinutes={etaMinutes}
      />
    </Suspense>
  );
};

// GuardianAgentDashboard is now loaded from lazyComponents.tsx

/**
 * Wrapper for ReceivingDashboard to provide facility name from user's tenant
 */
export const ReceivingDashboardWrapper: React.FC = () => {
  const { user, profile } = useSupabaseClient() as any;

  // Use tenant name or facility name from profile
  const facilityName = profile?.tenant_name || profile?.facility_name || 'Default Facility';

  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Receiving Dashboard...</div>}>
      <LazyComponents.ReceivingDashboard facilityName={facilityName} />
    </Suspense>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE WRAPPERS (for routes needing special layout)
// ═══════════════════════════════════════════════════════════════════════════════

interface PageWrapperProps {
  children: React.ReactNode;
  type: string;
}

const PageWrapper: React.FC<PageWrapperProps> = ({ children, type }) => {
  const SmartBackButton = LazyComponents.SmartBackButton;

  switch (type) {
    case 'billingWrapper':
      return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
          <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-4">
                <SmartBackButton />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-6">Billing & Claims</h1>
              {children}
            </div>
          </div>
        </Suspense>
      );
    case 'apiKeyWrapper':
      return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
          <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-4">
                <SmartBackButton />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-6">API Key Manager</h1>
              {children}
            </div>
          </div>
        </Suspense>
      );
    case 'darkWrapper':
      return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
          <div className="min-h-screen bg-slate-900">
            {children}
          </div>
        </Suspense>
      );
    default:
      return <>{children}</>;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE RENDERING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

// Map of wrapper components that need special handling
const wrapperComponentMap: Record<string, React.FC> = {
  SpecialistDashboardWrapper,
  FieldVisitWorkflowWrapper,
  MemoryClinicDashboardWrapper,
  CoordinatedResponseDashboardWrapper,
  ReceivingDashboardWrapper,
};

/**
 * Get the component for a route
 */
const getRouteComponent = (componentName: string): React.ComponentType<any> | null => {
  // Check wrapper components first
  if (wrapperComponentMap[componentName]) {
    return wrapperComponentMap[componentName];
  }

  // Then check lazy components
  const Component = (LazyComponents as any)[componentName];
  return Component || null;
};

/**
 * Check if a route should be rendered based on feature flags
 */
const shouldRenderRoute = (route: RouteConfig): boolean => {
  if (!route.featureFlag) return true;
  return (featureFlags as any)[route.featureFlag] === true;
};

/**
 * Wrap component with appropriate auth guards
 */
const wrapWithAuth = (
  element: React.ReactElement,
  auth: RouteConfig['auth'],
  roles?: string[]
): React.ReactElement => {
  switch (auth) {
    case 'none':
      return element;
    case 'user':
      return <RequireAuth>{element}</RequireAuth>;
    case 'admin':
      if (roles && roles.length > 0) {
        return (
          <RequireAuth>
            <RequireAdminAuth allowedRoles={roles as StaffRole[]}>{element}</RequireAdminAuth>
          </RequireAuth>
        );
      }
      return (
        <RequireAuth>
          <RequireAdminAuth>{element}</RequireAdminAuth>
        </RequireAuth>
      );
    case 'superAdmin':
      return <RequireSuperAdmin>{element}</RequireSuperAdmin>;
    default:
      return element;
  }
};

/**
 * Render a single route based on config
 */
const renderRoute = (route: RouteConfig): React.ReactElement | null => {
  if (!shouldRenderRoute(route)) return null;

  const Component = getRouteComponent(route.component);
  if (!Component) {
    // Component not found - skip this route silently
    // This can happen for placeholder routes or when lazy imports fail
    return null;
  }

  let element = <Component />;

  // Apply page wrapper if specified
  if (route.wrapper) {
    element = <PageWrapper type={route.wrapper}>{element}</PageWrapper>;
  }

  // Apply auth wrapping
  element = wrapWithAuth(element, route.auth, route.roles);

  return <Route key={route.path} path={route.path} element={element} />;
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ROUTE RENDERER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Renders all application routes based on configuration
 */
export const RouteRenderer: React.FC = () => {
  return (
    <Routes>
      {allRoutes.map(renderRoute).filter(Boolean)}
      {/* Fallback 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default RouteRenderer;
