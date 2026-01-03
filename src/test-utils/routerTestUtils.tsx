// src/test-utils/routerTestUtils.tsx
// React Router test utilities with v7 future flags enabled
// Use these wrappers instead of importing MemoryRouter/BrowserRouter directly

import React from 'react';
import { MemoryRouter, BrowserRouter, HashRouter } from 'react-router-dom';
import type { MemoryRouterProps, BrowserRouterProps, HashRouterProps } from 'react-router-dom';

/**
 * React Router v7 Future Flags
 * These flags enable v7 behavior in v6.30+ to prepare for migration.
 * When upgrading to v7, these become the defaults and can be removed.
 */
export const ROUTER_FUTURE_FLAGS = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} as const;

/**
 * MemoryRouter with v7 future flags enabled
 * Use this in tests instead of importing MemoryRouter directly
 */
export const TestMemoryRouter: React.FC<MemoryRouterProps> = ({
  children,
  ...props
}) => (
  <MemoryRouter future={ROUTER_FUTURE_FLAGS} {...props}>
    {children}
  </MemoryRouter>
);

/**
 * BrowserRouter with v7 future flags enabled
 * Use this in tests instead of importing BrowserRouter directly
 */
export const TestBrowserRouter: React.FC<BrowserRouterProps> = ({
  children,
  ...props
}) => (
  <BrowserRouter future={ROUTER_FUTURE_FLAGS} {...props}>
    {children}
  </BrowserRouter>
);

/**
 * HashRouter with v7 future flags enabled
 * Use this in tests instead of importing HashRouter directly
 */
export const TestHashRouter: React.FC<HashRouterProps> = ({
  children,
  ...props
}) => (
  <HashRouter future={ROUTER_FUTURE_FLAGS} {...props}>
    {children}
  </HashRouter>
);

/**
 * Helper to wrap a component with TestMemoryRouter for testing
 * @example
 * const { getByText } = render(withRouter(<MyComponent />));
 */
export function withRouter(
  ui: React.ReactElement,
  { route = '/', ...routerProps }: { route?: string } & Partial<MemoryRouterProps> = {}
): React.ReactElement {
  return (
    <TestMemoryRouter initialEntries={[route]} {...routerProps}>
      {ui}
    </TestMemoryRouter>
  );
}

// Note: All components and utilities are already exported above via named exports
