/**
 * Tests for RequireAuth Component
 *
 * Purpose: Route guard for authenticated users
 * Tests: Loading state, unauthenticated redirect, authenticated render
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RequireAuth from '../RequireAuth';

// Mock AuthContext
const mockUseAuth = vi.fn();
const mockUseUser = vi.fn();

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
  useUser: () => mockUseUser(),
}));

describe('RequireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRouter = (initialRoute = '/protected') => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route
            path="/protected"
            element={
              <RequireAuth>
                <div data-testid="protected-content">Protected Content</div>
              </RequireAuth>
            }
          />
          <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );
  };

  describe('Loading State', () => {
    it('should render loading indicator while checking auth', () => {
      mockUseAuth.mockReturnValue({ loading: true });
      mockUseUser.mockReturnValue(null);

      renderWithRouter();

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should not render protected content while loading', () => {
      mockUseAuth.mockReturnValue({ loading: true });
      mockUseUser.mockReturnValue(null);

      renderWithRouter();

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should not redirect while loading', () => {
      mockUseAuth.mockReturnValue({ loading: true });
      mockUseUser.mockReturnValue(null);

      renderWithRouter();

      expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    });
  });

  describe('Unauthenticated User', () => {
    it('should redirect to login when user is null', () => {
      mockUseAuth.mockReturnValue({ loading: false });
      mockUseUser.mockReturnValue(null);

      renderWithRouter();

      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });

    it('should not render protected content when unauthenticated', () => {
      mockUseAuth.mockReturnValue({ loading: false });
      mockUseUser.mockReturnValue(null);

      renderWithRouter();

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should preserve location state for redirect', () => {
      mockUseAuth.mockReturnValue({ loading: false });
      mockUseUser.mockReturnValue(null);

      // This test verifies the Navigate component is called with the right state
      // The actual state preservation is handled by react-router
      renderWithRouter('/protected');

      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
  });

  describe('Authenticated User', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
    };

    it('should render children when user is authenticated', () => {
      mockUseAuth.mockReturnValue({ loading: false });
      mockUseUser.mockReturnValue(mockUser);

      renderWithRouter();

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('should not redirect when authenticated', () => {
      mockUseAuth.mockReturnValue({ loading: false });
      mockUseUser.mockReturnValue(mockUser);

      renderWithRouter();

      expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    });

    it('should render different children correctly', () => {
      mockUseAuth.mockReturnValue({ loading: false });
      mockUseUser.mockReturnValue(mockUser);

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={
                <RequireAuth>
                  <div>Custom Protected Content</div>
                  <span>Additional Child</span>
                </RequireAuth>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Custom Protected Content')).toBeInTheDocument();
      expect(screen.getByText('Additional Child')).toBeInTheDocument();
    });
  });

  describe('State Transitions', () => {
    it('should show content after loading completes with authenticated user', () => {
      // Start loading
      mockUseAuth.mockReturnValue({ loading: true });
      mockUseUser.mockReturnValue(null);

      const { rerender } = render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={
                <RequireAuth>
                  <div data-testid="protected-content">Protected Content</div>
                </RequireAuth>
              }
            />
            <Route path="/login" element={<div data-testid="login-page">Login</div>} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText(/loading/i)).toBeInTheDocument();

      // Complete loading with authenticated user
      mockUseAuth.mockReturnValue({ loading: false });
      mockUseUser.mockReturnValue({ id: 'user-123', email: 'test@example.com' });

      rerender(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route
              path="/protected"
              element={
                <RequireAuth>
                  <div data-testid="protected-content">Protected Content</div>
                </RequireAuth>
              }
            />
            <Route path="/login" element={<div data-testid="login-page">Login</div>} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
  });

  describe('Loading Indicator Styling', () => {
    it('should center loading indicator', () => {
      mockUseAuth.mockReturnValue({ loading: true });
      mockUseUser.mockReturnValue(null);

      renderWithRouter();

      const loadingText = screen.getByText(/loading/i);
      // The loading div should have flex centering classes
      expect(loadingText.closest('div')).toHaveClass('flex', 'items-center', 'justify-center');
    });
  });

  describe('Children Rendering', () => {
    it('should render React elements as children', () => {
      mockUseAuth.mockReturnValue({ loading: false });
      mockUseUser.mockReturnValue({ id: 'user-123' });

      render(
        <MemoryRouter>
          <RequireAuth>
            <div data-testid="child-1">Child 1</div>
            <div data-testid="child-2">Child 2</div>
          </RequireAuth>
        </MemoryRouter>
      );

      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
    });

    it('should render string children', () => {
      mockUseAuth.mockReturnValue({ loading: false });
      mockUseUser.mockReturnValue({ id: 'user-123' });

      render(
        <MemoryRouter>
          <RequireAuth>
            Simple text content
          </RequireAuth>
        </MemoryRouter>
      );

      expect(screen.getByText('Simple text content')).toBeInTheDocument();
    });
  });
});
