/**
 * Tests for NursePanel Component
 *
 * Purpose: Main nurse dashboard with tabbed navigation and patient management
 * Tests: Component exports and basic structure
 *
 * Note: Full rendering tests are deferred due to complex dependency chain.
 * The component requires AdminAuthContext and extensive child component mocking.
 */

import React from 'react';

// Need to mock before import
vi.mock('../../../contexts/AdminAuthContext', () => ({
  useAdminAuth: vi.fn(() => ({
    isAuthenticated: true,
    loading: false,
    user: { id: 'nurse-123' },
  })),
}));

vi.mock('../../auth/RequireAdminAuth', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import NursePanel from '../NursePanel';

describe('NursePanel', () => {
  describe('Module Exports', () => {
    it('should export NursePanel as default', () => {
      expect(NursePanel).toBeDefined();
      expect(typeof NursePanel).toBe('function');
    });

    it('should be a React functional component', () => {
      // Functional components have a name property
      expect(NursePanel.name).toBe('NursePanel');
    });
  });

  describe('Component Definition', () => {
    it('should be a valid React component', () => {
      expect(typeof NursePanel).toBe('function');
    });
  });

  // Note: Full rendering tests require extensive mocking of:
  // - AdminAuthContext
  // - RequireAdminAuth
  // - AuthContext (useAuth, useUser, useSupabaseClient)
  // - Multiple child components (ShiftHandoffDashboard, SmartScribe, etc.)
  // - auditLogger
  // - react-router-dom (navigate)
  //
  // The component structure test shows it's a valid component.
  // Full integration tests are better suited for E2E testing.
});
