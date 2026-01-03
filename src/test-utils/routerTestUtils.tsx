// src/test-utils/routerTestUtils.tsx
// React Router test utilities for React Router v7
// Use these wrappers instead of importing MemoryRouter/BrowserRouter directly

import React from 'react';
import { MemoryRouter, BrowserRouter, HashRouter } from 'react-router-dom';
import type { MemoryRouterProps, BrowserRouterProps, HashRouterProps } from 'react-router-dom';

/**
 * MemoryRouter wrapper for tests
 * In React Router v7, the v6 future flags are now defaults
 */
export const TestMemoryRouter: React.FC<MemoryRouterProps> = ({
  children,
  ...props
}) => (
  <MemoryRouter {...props}>
    {children}
  </MemoryRouter>
);

/**
 * BrowserRouter wrapper for tests
 */
export const TestBrowserRouter: React.FC<BrowserRouterProps> = ({
  children,
  ...props
}) => (
  <BrowserRouter {...props}>
    {children}
  </BrowserRouter>
);

/**
 * HashRouter wrapper for tests
 */
export const TestHashRouter: React.FC<HashRouterProps> = ({
  children,
  ...props
}) => (
  <HashRouter {...props}>
    {children}
  </HashRouter>
);

// Kept for backwards compatibility but no longer used in v7
export const ROUTER_FUTURE_FLAGS = {} as const;

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
