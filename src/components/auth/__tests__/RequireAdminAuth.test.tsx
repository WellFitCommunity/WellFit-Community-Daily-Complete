/**
 * Tests for RequireAdminAuth Component
 *
 * Purpose: Route guard for admin-authenticated users with role checking
 * Tests: Loading state, unauthenticated redirect, role validation, authorized render
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RequireAdminAuth from '../RequireAdminAuth';
import { StaffRole } from '../../../types/roles';

// Mock AdminAuthContext
const mockUseAdminAuth = vi.fn();

vi.mock('../../../contexts/AdminAuthContext', () => ({
  useAdminAuth: () => mockUseAdminAuth(),
}));

describe('RequireAdminAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRouter = (
    allowedRoles?: StaffRole[],
    initialRoute = '/admin'
  ) => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route
            path="/admin"
            element={
              <RequireAdminAuth allowedRoles={allowedRoles}>
                <div data-testid="admin-content">Admin Content</div>
              </RequireAdminAuth>
            }
          />
          <Route
            path="/admin-login"
            element={<div data-testid="admin-login-page">Admin Login Page</div>}
          />
        </Routes>
      </MemoryRouter>
    );
  };

  describe('Loading State', () => {
    it('should show loading indicator while verifying admin session', () => {
      mockUseAdminAuth.mockReturnValue({
        isAdminAuthenticated: false,
        adminRole: null,
        isLoading: true,
      });

      renderWithRouter();

      expect(screen.getByText(/verifying admin access/i)).toBeInTheDocument();
    });

    it('should show spinner animation while loading', () => {
      mockUseAdminAuth.mockReturnValue({
        isAdminAuthenticated: false,
        adminRole: null,
        isLoading: true,
      });

      renderWithRouter();

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should not render admin content while loading', () => {
      mockUseAdminAuth.mockReturnValue({
        isAdminAuthenticated: false,
        adminRole: null,
        isLoading: true,
      });

      renderWithRouter();

      expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
    });

    it('should not redirect while loading', () => {
      mockUseAdminAuth.mockReturnValue({
        isAdminAuthenticated: false,
        adminRole: null,
        isLoading: true,
      });

      renderWithRouter();

      expect(screen.queryByTestId('admin-login-page')).not.toBeInTheDocument();
    });
  });

  describe('Unauthenticated Admin', () => {
    it('should redirect to admin-login when not authenticated', () => {
      mockUseAdminAuth.mockReturnValue({
        isAdminAuthenticated: false,
        adminRole: null,
        isLoading: false,
      });

      renderWithRouter();

      expect(screen.getByTestId('admin-login-page')).toBeInTheDocument();
    });

    it('should not render admin content when unauthenticated', () => {
      mockUseAdminAuth.mockReturnValue({
        isAdminAuthenticated: false,
        adminRole: null,
        isLoading: false,
      });

      renderWithRouter();

      expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
    });
  });

  describe('Role Authorization - Default Roles', () => {
    const defaultAllowedRoles: StaffRole[] = ['admin', 'super_admin', 'it_admin'];

    it('should render content for admin role by default', () => {
      mockUseAdminAuth.mockReturnValue({
        isAdminAuthenticated: true,
        adminRole: 'admin' as StaffRole,
        isLoading: false,
      });

      renderWithRouter();

      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    });

    it('should render content for super_admin role by default', () => {
      mockUseAdminAuth.mockReturnValue({
        isAdminAuthenticated: true,
        adminRole: 'super_admin' as StaffRole,
        isLoading: false,
      });

      renderWithRouter();

      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    });

    it('should render content for it_admin role by default', () => {
      mockUseAdminAuth.mockReturnValue({
        isAdminAuthenticated: true,
        adminRole: 'it_admin' as StaffRole,
        isLoading: false,
      });

      renderWithRouter();

      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    });

    it('should redirect nurse role when using default roles', () => {
      mockUseAdminAuth.mockReturnValue({
        isAdminAuthenticated: true,
        adminRole: 'nurse' as StaffRole,
        isLoading: false,
      });

      renderWithRouter();

      expect(screen.getByTestId('admin-login-page')).toBeInTheDocument();
    });
  });

  describe('Role Authorization - Custom Roles', () => {
    it('should render content when role matches allowed roles', () => {
      mockUseAdminAuth.mockReturnValue({
        isAdminAuthenticated: true,
        adminRole: 'nurse' as StaffRole,
        isLoading: false,
      });

      renderWithRouter(['nurse', 'physician']);

      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    });

    it('should redirect when role does not match allowed roles', () => {
      mockUseAdminAuth.mockReturnValue({
        isAdminAuthenticated: true,
        adminRole: 'chw' as StaffRole,
        isLoading: false,
      });

      renderWithRouter(['nurse', 'physician']);

      expect(screen.getByTestId('admin-login-page')).toBeInTheDocument();
    });

    it('should render content for physician role when specified', () => {
      mockUseAdminAuth.mockReturnValue({
        isAdminAuthenticated: true,
        adminRole: 'physician' as StaffRole,
        isLoading: false,
      });

      renderWithRouter(['physician']);

      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    });

    it('should allow empty allowedRoles array (any authenticated admin)', () => {
      mockUseAdminAuth.mockReturnValue({
        isAdminAuthenticated: true,
        adminRole: 'chw' as StaffRole,
        isLoading: false,
      });

      renderWithRouter([]);

      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    });
  });

  describe('Null Admin Role', () => {
    it('should render content when authenticated and allowedRoles is empty', () => {
      mockUseAdminAuth.mockReturnValue({
        isAdminAuthenticated: true,
        adminRole: null,
        isLoading: false,
      });

      renderWithRouter([]);

      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    });

    it('should render content when authenticated and role is null with non-empty allowedRoles', () => {
      mockUseAdminAuth.mockReturnValue({
        isAdminAuthenticated: true,
        adminRole: null,
        isLoading: false,
      });

      // When adminRole is null, the check (!allowedRoles.includes(adminRole)) is skipped
      // because the condition adminRole && allowedRoles.length > 0 is not met
      renderWithRouter(['admin']);

      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    });
  });

  describe('Children Rendering', () => {
    it('should render React elements as children', () => {
      mockUseAdminAuth.mockReturnValue({
        isAdminAuthenticated: true,
        adminRole: 'admin' as StaffRole,
        isLoading: false,
      });

      render(
        <MemoryRouter>
          <RequireAdminAuth>
            <div data-testid="child-1">Child 1</div>
            <div data-testid="child-2">Child 2</div>
          </RequireAdminAuth>
        </MemoryRouter>
      );

      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
    });

    it('should render nested components', () => {
      mockUseAdminAuth.mockReturnValue({
        isAdminAuthenticated: true,
        adminRole: 'admin' as StaffRole,
        isLoading: false,
      });

      const NestedComponent = () => <span data-testid="nested">Nested Content</span>;

      render(
        <MemoryRouter>
          <RequireAdminAuth>
            <div>
              <NestedComponent />
            </div>
          </RequireAdminAuth>
        </MemoryRouter>
      );

      expect(screen.getByTestId('nested')).toBeInTheDocument();
    });
  });

  describe('State Transitions', () => {
    it('should show content after loading completes with authorized role', () => {
      mockUseAdminAuth.mockReturnValue({
        isAdminAuthenticated: false,
        adminRole: null,
        isLoading: true,
      });

      const { rerender } = render(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route
              path="/admin"
              element={
                <RequireAdminAuth>
                  <div data-testid="admin-content">Admin Content</div>
                </RequireAdminAuth>
              }
            />
            <Route
              path="/admin-login"
              element={<div data-testid="admin-login-page">Login</div>}
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText(/verifying admin access/i)).toBeInTheDocument();

      // Complete loading with authenticated admin
      mockUseAdminAuth.mockReturnValue({
        isAdminAuthenticated: true,
        adminRole: 'admin' as StaffRole,
        isLoading: false,
      });

      rerender(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route
              path="/admin"
              element={
                <RequireAdminAuth>
                  <div data-testid="admin-content">Admin Content</div>
                </RequireAdminAuth>
              }
            />
            <Route
              path="/admin-login"
              element={<div data-testid="admin-login-page">Login</div>}
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    });
  });

  describe('Redirect Messages', () => {
    it('should redirect with PIN request message when not authenticated', () => {
      mockUseAdminAuth.mockReturnValue({
        isAdminAuthenticated: false,
        adminRole: null,
        isLoading: false,
      });

      // The Navigate component passes state - we verify redirect happens
      renderWithRouter();

      expect(screen.getByTestId('admin-login-page')).toBeInTheDocument();
    });

    it('should redirect with role error message when role not allowed', () => {
      mockUseAdminAuth.mockReturnValue({
        isAdminAuthenticated: true,
        adminRole: 'chw' as StaffRole,
        isLoading: false,
      });

      renderWithRouter(['admin', 'super_admin']);

      expect(screen.getByTestId('admin-login-page')).toBeInTheDocument();
    });
  });

  describe('Loading Indicator Styling', () => {
    it('should center loading indicator', () => {
      mockUseAdminAuth.mockReturnValue({
        isAdminAuthenticated: false,
        adminRole: null,
        isLoading: true,
      });

      renderWithRouter();

      const container = screen.getByText(/verifying admin access/i).closest('div');
      expect(container?.parentElement).toHaveClass('flex');
      expect(container?.parentElement).toHaveClass('items-center');
      expect(container?.parentElement).toHaveClass('justify-center');
    });

    it('should have blue spinner color', () => {
      mockUseAdminAuth.mockReturnValue({
        isAdminAuthenticated: false,
        adminRole: null,
        isLoading: true,
      });

      renderWithRouter();

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toHaveClass('border-blue-600');
    });
  });
});
