// src/routes/createAppRouter.tsx
// Data Router configuration for React Router v7 migration
// This replaces the JSX-based HashRouter with createHashRouter

import React, { Suspense } from 'react';
import { createHashRouter } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';

// Auth & Providers
import RequireAuth from '../components/auth/RequireAuth';
import RequireAdminAuth from '../components/auth/RequireAdminAuth';
import RequireSuperAdmin from '../components/auth/RequireSuperAdmin';
import NotFoundPage from '../components/NotFoundPage';

// RootLayout provides the app shell
import { RootLayout } from './RootLayout';

// Route configuration
import { featureFlags } from '../config/featureFlags';
import { RouteConfig, allRoutes } from './routeConfig';
import * as LazyComponents from './lazyComponents';
import {
  SpecialistDashboardWrapper,
  FieldVisitWorkflowWrapper,
  MemoryClinicDashboardWrapper,
  CoordinatedResponseDashboardWrapper,
  ReceivingDashboardWrapper,
} from './RouteRenderer';

import type { StaffRole } from '../types/roles';

// Note: In React Router v7, the v6 future flags are now the defaults
// No additional configuration needed

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE WRAPPERS
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
// ROUTE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

// Map of wrapper components that need special handling
const wrapperComponentMap: Record<string, React.FC> = {
  SpecialistDashboardWrapper,
  FieldVisitWorkflowWrapper,
  MemoryClinicDashboardWrapper,
  CoordinatedResponseDashboardWrapper,
  ReceivingDashboardWrapper,
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
 * Convert a RouteConfig to a RouteObject for the data router
 */
const convertRouteConfig = (route: RouteConfig): RouteObject | null => {
  if (!shouldRenderRoute(route)) return null;

  const Component = getRouteComponent(route.component);
  if (!Component) return null;

  let element = (
    <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
      <Component />
    </Suspense>
  );

  // Apply page wrapper if specified
  if (route.wrapper) {
    element = <PageWrapper type={route.wrapper}>{element}</PageWrapper>;
  }

  // Apply auth wrapping
  element = wrapWithAuth(element, route.auth, route.roles);

  return {
    path: route.path,
    element,
  };
};

/**
 * Build all route objects from configuration
 */
const buildRoutes = (): RouteObject[] => {
  const routes = allRoutes
    .map(convertRouteConfig)
    .filter((route): route is RouteObject => route !== null);

  // Add 404 fallback
  routes.push({
    path: '*',
    element: <NotFoundPage />,
  });

  return routes;
};

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTER CREATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Creates the application router using createHashRouter.
 * This is the data router API that becomes the default in React Router v7.
 *
 * Usage in index.tsx:
 * ```tsx
 * import { createAppRouter } from './routes/createAppRouter';
 * import { RouterProvider } from 'react-router-dom';
 *
 * const router = createAppRouter();
 *
 * root.render(
 *   <RouterProvider router={router} />
 * );
 * ```
 */
export function createAppRouter() {
  const childRoutes = buildRoutes();

  return createHashRouter([
    {
      // Root layout wraps all routes
      element: <RootLayout />,
      errorElement: <NotFoundPage />,
      children: childRoutes,
    },
  ]);
}

export default createAppRouter;
