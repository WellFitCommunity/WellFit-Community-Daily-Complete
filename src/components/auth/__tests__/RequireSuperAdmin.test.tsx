/**
 * Tests for RequireSuperAdmin Component
 *
 * Purpose: Route guard for super-admin only routes
 * Supports both Supabase auth and Envision standalone auth
 * Tests: Loading states, auth methods, unauthorized redirect, authorized render
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RequireSuperAdmin from '../RequireSuperAdmin';

// Mock AuthContext
const mockUseAuth = vi.fn();
const mockUseUser = vi.fn();

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
  useUser: () => mockUseUser(),
}));

// Mock SuperAdminService
const mockIsSuperAdmin = vi.fn();

vi.mock('../../../services/superAdminService', () => ({
  SuperAdminService: {
    isSuperAdmin: () => mockIsSuperAdmin(),
  },
}));

// Mock auditLogger
const mockAuditLoggerSecurity = vi.fn();
const mockAuditLoggerError = vi.fn();

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    security: (...args: unknown[]) => mockAuditLoggerSecurity(...args),
    error: (...args: unknown[]) => mockAuditLoggerError(...args),
  },
}));

describe('RequireSuperAdmin', () => {
  // Store original localStorage
  const _originalLocalStorage = window.localStorage;

  beforeEach(() => {
    vi.clearAllMocks();

    // Clear localStorage
    localStorage.clear();

    // Default mock values
    mockUseAuth.mockReturnValue({ loading: false });
    mockUseUser.mockReturnValue(null);
    mockIsSuperAdmin.mockResolvedValue(false);
  });

  afterEach(() => {
    localStorage.clear();
  });

  const renderWithRouter = (initialRoute = '/super-admin') => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route
            path="/super-admin"
            element={
              <RequireSuperAdmin>
                <div data-testid="super-admin-content">Super Admin Content</div>
              </RequireSuperAdmin>
            }
          />
          <Route
            path="/envision"
            element={<div data-testid="envision-login">Envision Login</div>}
          />
          <Route
            path="/unauthorized"
            element={<div data-testid="unauthorized-page">Unauthorized</div>}
          />
        </Routes>
      </MemoryRouter>
    );
  };

  describe('Loading States', () => {
    it('should show loading indicator while auth is loading', () => {
      mockUseAuth.mockReturnValue({ loading: true });

      renderWithRouter();

      expect(screen.getByText(/verifying super admin access/i)).toBeInTheDocument();
    });

    it('should show spinner animation while loading', () => {
      mockUseAuth.mockReturnValue({ loading: true });

      renderWithRouter();

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should show loading while checking super admin status', async () => {
      mockUseAuth.mockReturnValue({ loading: false });
      mockUseUser.mockReturnValue({ id: 'user-123' });
      mockIsSuperAdmin.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(true), 100))
      );

      renderWithRouter();

      // Should show loading while checking
      expect(screen.getByText(/verifying super admin access/i)).toBeInTheDocument();
    });

    it('should not render content while loading', () => {
      mockUseAuth.mockReturnValue({ loading: true });

      renderWithRouter();

      expect(screen.queryByTestId('super-admin-content')).not.toBeInTheDocument();
    });
  });

  describe('Envision Session Authentication', () => {
    it('should allow access with valid Envision session', async () => {
      mockUseAuth.mockReturnValue({ loading: false });
      mockUseUser.mockReturnValue(null);

      // Set Envision session in localStorage
      localStorage.setItem('envision_session', JSON.stringify({ token: 'test-token' }));
      localStorage.setItem('envision_user', JSON.stringify({ id: 'envision-user' }));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('super-admin-content')).toBeInTheDocument();
      });
    });

    it('should bypass Supabase check when Envision session exists', async () => {
      mockUseAuth.mockReturnValue({ loading: false });
      mockUseUser.mockReturnValue(null);

      localStorage.setItem('envision_session', 'valid-session');
      localStorage.setItem('envision_user', JSON.stringify({ id: 'envision-user' }));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('super-admin-content')).toBeInTheDocument();
      });

      // SuperAdminService should not be called for Envision users
      expect(mockIsSuperAdmin).not.toHaveBeenCalled();
    });

    it('should require both session and user for Envision auth', async () => {
      mockUseAuth.mockReturnValue({ loading: false });
      mockUseUser.mockReturnValue(null);

      // Only session, no user
      localStorage.setItem('envision_session', 'valid-session');

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('envision-login')).toBeInTheDocument();
      });
    });
  });

  describe('Supabase Authentication', () => {
    it('should redirect to envision login when no user and no Envision session', async () => {
      mockUseAuth.mockReturnValue({ loading: false });
      mockUseUser.mockReturnValue(null);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('envision-login')).toBeInTheDocument();
      });
    });

    it('should check super admin status for Supabase users', async () => {
      mockUseAuth.mockReturnValue({ loading: false });
      mockUseUser.mockReturnValue({ id: 'user-123' });
      mockIsSuperAdmin.mockResolvedValue(true);

      renderWithRouter();

      await waitFor(() => {
        expect(mockIsSuperAdmin).toHaveBeenCalled();
      });
    });

    it('should allow access when user is super admin', async () => {
      mockUseAuth.mockReturnValue({ loading: false });
      mockUseUser.mockReturnValue({ id: 'user-123' });
      mockIsSuperAdmin.mockResolvedValue(true);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('super-admin-content')).toBeInTheDocument();
      });
    });

    it('should redirect to unauthorized when user is not super admin', async () => {
      mockUseAuth.mockReturnValue({ loading: false });
      mockUseUser.mockReturnValue({ id: 'user-123' });
      mockIsSuperAdmin.mockResolvedValue(false);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument();
      });
    });
  });

  describe('Audit Logging', () => {
    it('should log unauthorized access attempt', async () => {
      mockUseAuth.mockReturnValue({ loading: false });
      mockUseUser.mockReturnValue({ id: 'user-456' });
      mockIsSuperAdmin.mockResolvedValue(false);

      renderWithRouter('/super-admin');

      await waitFor(() => {
        expect(mockAuditLoggerSecurity).toHaveBeenCalledWith(
          'SUPER_ADMIN_ROUTE_ACCESS_DENIED',
          'high',
          expect.objectContaining({
            userId: 'user-456',
            attemptedPath: '/super-admin',
          })
        );
      });
    });

    it('should not log for authorized users', async () => {
      mockUseAuth.mockReturnValue({ loading: false });
      mockUseUser.mockReturnValue({ id: 'user-123' });
      mockIsSuperAdmin.mockResolvedValue(true);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('super-admin-content')).toBeInTheDocument();
      });

      expect(mockAuditLoggerSecurity).not.toHaveBeenCalled();
    });

    it('should log errors during super admin check', async () => {
      mockUseAuth.mockReturnValue({ loading: false });
      mockUseUser.mockReturnValue({ id: 'user-123' });
      mockIsSuperAdmin.mockRejectedValue(new Error('Service error'));

      renderWithRouter();

      await waitFor(() => {
        expect(mockAuditLoggerError).toHaveBeenCalledWith(
          'SUPER_ADMIN_CHECK_FAILED',
          expect.any(Error),
          expect.objectContaining({
            userId: 'user-123',
            category: 'SECURITY_EVENT',
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should redirect to unauthorized on service error', async () => {
      mockUseAuth.mockReturnValue({ loading: false });
      mockUseUser.mockReturnValue({ id: 'user-123' });
      mockIsSuperAdmin.mockRejectedValue(new Error('Network error'));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument();
      });
    });

    it('should handle non-Error exceptions', async () => {
      mockUseAuth.mockReturnValue({ loading: false });
      mockUseUser.mockReturnValue({ id: 'user-123' });
      mockIsSuperAdmin.mockRejectedValue('String error');

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument();
      });
    });
  });

  describe('Children Rendering', () => {
    it('should render React elements as children', async () => {
      mockUseAuth.mockReturnValue({ loading: false });
      mockUseUser.mockReturnValue({ id: 'user-123' });
      mockIsSuperAdmin.mockResolvedValue(true);

      render(
        <MemoryRouter>
          <RequireSuperAdmin>
            <div data-testid="child-1">Child 1</div>
            <div data-testid="child-2">Child 2</div>
          </RequireSuperAdmin>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('child-1')).toBeInTheDocument();
        expect(screen.getByTestId('child-2')).toBeInTheDocument();
      });
    });
  });

  describe('Loading Indicator Styling', () => {
    it('should center loading indicator', () => {
      mockUseAuth.mockReturnValue({ loading: true });

      renderWithRouter();

      const container = screen.getByText(/verifying super admin access/i).closest('div');
      expect(container?.parentElement).toHaveClass('flex');
      expect(container?.parentElement).toHaveClass('items-center');
      expect(container?.parentElement).toHaveClass('justify-center');
    });

    it('should have teal spinner color for super admin', () => {
      mockUseAuth.mockReturnValue({ loading: true });

      renderWithRouter();

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toHaveClass('border-teal-600');
    });
  });

  describe('Mixed Authentication Scenarios', () => {
    it('should prioritize Envision session over Supabase user', async () => {
      mockUseAuth.mockReturnValue({ loading: false });
      mockUseUser.mockReturnValue({ id: 'supabase-user' });

      // Both Envision and Supabase user exist
      localStorage.setItem('envision_session', 'valid-session');
      localStorage.setItem('envision_user', JSON.stringify({ id: 'envision-user' }));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('super-admin-content')).toBeInTheDocument();
      });

      // Should not check Supabase super admin status
      expect(mockIsSuperAdmin).not.toHaveBeenCalled();
    });

    it('should fall back to Supabase when Envision session incomplete', async () => {
      mockUseAuth.mockReturnValue({ loading: false });
      mockUseUser.mockReturnValue({ id: 'supabase-user' });
      mockIsSuperAdmin.mockResolvedValue(true);

      // Only Envision session key, missing user
      localStorage.setItem('envision_session', 'valid-session');

      renderWithRouter();

      await waitFor(() => {
        expect(mockIsSuperAdmin).toHaveBeenCalled();
        expect(screen.getByTestId('super-admin-content')).toBeInTheDocument();
      });
    });
  });

  describe('Effect Dependencies', () => {
    it('should re-check when user changes', async () => {
      mockUseAuth.mockReturnValue({ loading: false });
      mockUseUser.mockReturnValue({ id: 'user-1' });
      mockIsSuperAdmin.mockResolvedValue(true);

      const { rerender } = render(
        <MemoryRouter initialEntries={['/super-admin']}>
          <Routes>
            <Route
              path="/super-admin"
              element={
                <RequireSuperAdmin>
                  <div data-testid="super-admin-content">Content</div>
                </RequireSuperAdmin>
              }
            />
            <Route path="/unauthorized" element={<div>Unauthorized</div>} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('super-admin-content')).toBeInTheDocument();
      });

      // User changes
      mockUseUser.mockReturnValue({ id: 'user-2' });
      mockIsSuperAdmin.mockResolvedValue(false);

      rerender(
        <MemoryRouter initialEntries={['/super-admin']}>
          <Routes>
            <Route
              path="/super-admin"
              element={
                <RequireSuperAdmin>
                  <div data-testid="super-admin-content">Content</div>
                </RequireSuperAdmin>
              }
            />
            <Route path="/unauthorized" element={<div data-testid="unauth">Unauthorized</div>} />
          </Routes>
        </MemoryRouter>
      );

      // Should have called isSuperAdmin again for new user
      await waitFor(() => {
        expect(mockIsSuperAdmin).toHaveBeenCalledTimes(2);
      });
    });
  });
});
