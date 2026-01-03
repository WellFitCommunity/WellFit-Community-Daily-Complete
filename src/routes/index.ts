// src/routes/index.ts
// Central export for all route-related modules

export { AppProviders } from './AppProviders';
export { RouteRenderer } from './RouteRenderer';
export { RootLayout } from './RootLayout';
export { createAppRouter, ROUTER_FUTURE_CONFIG } from './createAppRouter';
export * from './routeConfig';
export * from './lazyComponents';

// Re-export wrapper components for direct use if needed
export {
  SpecialistDashboardWrapper,
  FieldVisitWorkflowWrapper,
  MemoryClinicDashboardWrapper,
  CoordinatedResponseDashboardWrapper,
} from './RouteRenderer';
