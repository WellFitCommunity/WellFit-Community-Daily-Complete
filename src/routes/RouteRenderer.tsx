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
import { supabase } from '../lib/supabaseClient';
import type { StaffRole } from '../types/roles';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getStringProperty(obj: unknown, key: string): string | undefined {
  if (!isRecord(obj)) return undefined;
  const value = obj[key];
  return typeof value === 'string' ? value : undefined;
}

function getUserIdFromAuthContext(ctx: unknown): string | null {
  if (!isRecord(ctx)) return null;
  const user = ctx.user;
  if (!isRecord(user)) return null;
  const id = user.id;
  return typeof id === 'string' ? id : null;
}

function getProfileFromAuthContext(ctx: unknown): unknown {
  if (!isRecord(ctx)) return null;
  return ctx.profile ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WRAPPER COMPONENTS (for routes that need special handling)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Wrapper for SpecialistDashboard to extract route params
 */
export const SpecialistDashboardWrapper: React.FC = () => {
  const { specialistType } = useParams<{ specialistType: string }>();
  const authContext = useSupabaseClient() as unknown;
  const userId = getUserIdFromAuthContext(authContext);

  if (!specialistType || !userId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Invalid specialist configuration</p>
      </div>
    );
  }

  return (
    <LazyComponents.SpecialistDashboard
      specialistId={userId}
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
 * Wrapper for PatientAvatarPage to extract patient ID from route
 */
export const PatientAvatarPageWrapper: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();

  if (!patientId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">No patient ID provided</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Patient Avatar...</div>}>
      <LazyComponents.PatientAvatarPage patientId={patientId} />
    </Suspense>
  );
};

/**
 * Wrapper for PatientChartNavigator to extract patient ID from route
 */
export const PatientChartNavigatorWrapper: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();

  if (!patientId) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <p className="text-slate-400">No patient ID provided. Please select a patient first.</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen bg-slate-900"><p className="text-slate-400">Loading Patient Chart...</p></div>}>
      <LazyComponents.PatientChartNavigator patientId={patientId} />
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

/**
 * Wrapper for the provider "Start Visit" entry (S3.1b). Reads the appointment id from
 * the route, loads the appointment (patient + encounter type), resolves the patient's
 * display name, then renders TelehealthConsultation keyed to that appointment so the
 * provider joins the SAME pre-created Daily room the senior joins (create-telehealth-room
 * is idempotent on the appointment). The scheduler (TelehealthScheduler) is a 792-line
 * god-file already over the 600-line limit, so this lives as its own dedicated route
 * rather than being bolted onto the scheduler.
 */
export const ProviderTelehealthVisitWrapper: React.FC = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const [state, setState] = React.useState<{
    loading: boolean;
    error: string | null;
    patientId: string | null;
    patientName: string;
    encounterType: 'outpatient' | 'er' | 'urgent-care';
  }>({
    loading: true,
    error: null,
    patientId: null,
    patientName: 'Patient',
    encounterType: 'outpatient',
  });

  React.useEffect(() => {
    if (!appointmentId) {
      setState((prev) => ({ ...prev, loading: false, error: 'No appointment ID provided' }));
      return;
    }

    let active = true;
    const load = async () => {
      try {
        // Provider reads the appointment (tenant-scoped RLS grants provider/admin read).
        const { data: appt, error: apptError } = await supabase
          .from('telehealth_appointments')
          .select('id, patient_id, encounter_type')
          .eq('id', appointmentId)
          .single();

        if (apptError) throw apptError;
        if (!appt) throw new Error('Appointment not found');

        // Resolve the patient's display name (profiles PK is user_id; no full_name column).
        let patientName = 'Patient';
        if (appt.patient_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('user_id', appt.patient_id)
            .maybeSingle();
          if (profile) {
            patientName =
              `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Patient';
          }
        }

        if (!active) return;
        setState({
          loading: false,
          error: null,
          patientId: appt.patient_id,
          patientName,
          encounterType:
            (appt.encounter_type as 'outpatient' | 'er' | 'urgent-care') || 'outpatient',
        });
      } catch (err: unknown) {
        if (!active) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error:
            err instanceof Error ? err.message : 'Failed to load the telehealth appointment',
        }));
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [appointmentId]);

  if (state.loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Loading telehealth visit…</p>
      </div>
    );
  }

  if (state.error || !state.patientId || !appointmentId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-600">{state.error || 'Unable to start this telehealth visit.'}</p>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <p className="text-gray-500">Loading telehealth visit…</p>
        </div>
      }
    >
      <LazyComponents.TelehealthConsultation
        appointmentId={appointmentId}
        patientId={state.patientId}
        patientName={state.patientName}
        encounterType={state.encounterType}
      />
    </Suspense>
  );
};

// GuardianAgentDashboard is now loaded from lazyComponents.tsx

/**
 * Wrapper for ReceivingDashboard to provide facility name from user's tenant
 */
export const ReceivingDashboardWrapper: React.FC = () => {
  const authContext = useSupabaseClient() as unknown;
  const profile = getProfileFromAuthContext(authContext);

  // Use tenant name or facility name from profile
  const facilityName =
    getStringProperty(profile, 'tenant_name') ||
    getStringProperty(profile, 'facility_name') ||
    'Default Facility';

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
  PatientAvatarPageWrapper,
  PatientChartNavigatorWrapper,
  CoordinatedResponseDashboardWrapper,
  ReceivingDashboardWrapper,
  ProviderTelehealthVisitWrapper,
};

type NoPropsComponent = React.ComponentType<Record<string, never>>;

/**
 * Get the component for a route
 */
const getRouteComponent = (componentName: string): NoPropsComponent | null => {
  // Check wrapper components first
  const wrapper = wrapperComponentMap[componentName];
  if (wrapper) return wrapper;

  // Then check lazy components
  const lazyRegistry = LazyComponents as unknown as Record<string, unknown>;
  const maybeComponent = lazyRegistry[componentName];

  if (!maybeComponent) return null;

  // We intentionally accept any valid React component type here (function, memo, ref-as-prop, etc.)
  return maybeComponent as NoPropsComponent;
};

/**
 * Check if a route should be rendered based on feature flags
 */
const shouldRenderRoute = (route: RouteConfig): boolean => {
  if (!route.featureFlag) return true;

  const flags = featureFlags as unknown as Record<string, boolean>;
  return flags[route.featureFlag] === true;
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
