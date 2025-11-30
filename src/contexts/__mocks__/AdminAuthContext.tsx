/**
 * AdminAuthContext Mock for Jest Tests
 *
 * Provides consistent mock implementations for AdminAuthContext exports.
 */
import React from 'react';

// Re-export types for convenience
export type AdminRole = string;

// Default mock access scopes
export const mockAccessScopes = {
  canViewNurse: true,
  canViewPhysician: true,
  canViewAdmin: true,
  canSupervise: true,
  canManageDepartment: true,
};

// Mock admin auth context value
export const mockAdminAuthContextValue = {
  isAdminAuthenticated: false,
  adminRole: null as string | null,
  accessScopes: mockAccessScopes,
  isLoading: false,
  error: null as string | null,
  verifyPinAndLogin: jest.fn().mockResolvedValue(true),
  logoutAdmin: jest.fn(),
  hasAccess: jest.fn().mockReturnValue(true),
  canViewNurse: true,
  canViewPhysician: true,
  canViewAdmin: true,
  canSupervise: true,
  canManageDepartment: true,
  invokeAdminFunction: jest.fn().mockResolvedValue({ data: null, error: null }),
};

// AdminAuthProvider mock - just renders children
export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

// Hook mock
export const useAdminAuth = jest.fn(() => mockAdminAuthContextValue);

// Helper to reset all mocks
export const resetAdminAuthMocks = () => {
  useAdminAuth.mockReturnValue(mockAdminAuthContextValue);
};

// Helper to simulate authenticated admin
export const mockAuthenticatedAdmin = (role: string = 'admin') => {
  useAdminAuth.mockReturnValue({
    ...mockAdminAuthContextValue,
    isAdminAuthenticated: true,
    adminRole: role,
  });
};

// Helper to simulate unauthenticated state
export const mockUnauthenticatedAdmin = () => {
  useAdminAuth.mockReturnValue({
    ...mockAdminAuthContextValue,
    isAdminAuthenticated: false,
    adminRole: null,
  });
};
