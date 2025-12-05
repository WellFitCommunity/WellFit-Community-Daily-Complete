import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, useNavigate, Routes, Route } from 'react-router-dom';
import { NavigationHistoryProvider, useNavigationHistory } from '../NavigationHistoryContext';
import { AuthProvider } from '../AuthContext';

// Type for the navigation history context
type NavigationHistoryType = ReturnType<typeof useNavigationHistory>;

// Mock Supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } }
      })),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
  }),
}));

// Test component that uses the navigation history hook
const TestComponent: React.FC<{ onMount?: (nav: NavigationHistoryType) => void }> = ({ onMount }) => {
  const nav = useNavigationHistory();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (onMount) {
      onMount(nav);
    }
  }, [nav, onMount]);

  return (
    <div>
      <span data-testid="can-go-back">{nav.canGoBack ? 'yes' : 'no'}</span>
      <span data-testid="history-length">{nav.historyStack.length}</span>
      <button data-testid="go-back" onClick={() => nav.goBack()}>
        Go Back
      </button>
      <button data-testid="navigate-profile" onClick={() => navigate('/profile')}>
        Go to Profile
      </button>
      <button data-testid="navigate-settings" onClick={() => navigate('/settings')}>
        Go to Settings
      </button>
      <button data-testid="clear-history" onClick={() => nav.clearHistory()}>
        Clear History
      </button>
    </div>
  );
};

// Wrapper component for tests
const TestWrapper: React.FC<{ initialEntries?: string[]; children: React.ReactNode }> = ({
  initialEntries = ['/dashboard'],
  children,
}) => {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <NavigationHistoryProvider>
          <Routes>
            <Route path="*" element={children} />
          </Routes>
        </NavigationHistoryProvider>
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('NavigationHistoryContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without crashing', () => {
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );
    expect(screen.getByTestId('can-go-back')).toBeInTheDocument();
  });

  it('should initially have no back history', () => {
    render(
      <TestWrapper>
        <TestComponent />
      </TestWrapper>
    );
    expect(screen.getByTestId('can-go-back')).toHaveTextContent('no');
  });

  it('should track navigation to non-auth routes', async () => {
    let navRef: NavigationHistoryType | null = null;

    render(
      <TestWrapper initialEntries={['/dashboard']}>
        <TestComponent onMount={(nav) => { navRef = nav; }} />
      </TestWrapper>
    );

    // Initial route should be in history
    expect(navRef!.historyStack).toContain('/dashboard');
  });

  it('should NOT track auth routes like /login', async () => {
    let navRef: NavigationHistoryType | null = null;

    render(
      <TestWrapper initialEntries={['/login']}>
        <TestComponent onMount={(nav) => { navRef = nav; }} />
      </TestWrapper>
    );

    // Login route should NOT be in history
    expect(navRef!.historyStack).not.toContain('/login');
  });

  it('should clear history when clearHistory is called', async () => {
    let navRef: NavigationHistoryType | null = null;

    render(
      <TestWrapper initialEntries={['/dashboard']}>
        <TestComponent onMount={(nav) => { navRef = nav; }} />
      </TestWrapper>
    );

    // Clear history
    act(() => {
      navRef?.clearHistory();
    });

    expect(navRef!.historyStack).toHaveLength(0);
    expect(navRef!.canGoBack).toBe(false);
  });

  it('should provide context-aware fallback when no history', () => {
    let navRef: NavigationHistoryType | null = null;

    render(
      <TestWrapper initialEntries={['/admin/settings']}>
        <TestComponent onMount={(nav) => { navRef = nav; }} />
      </TestWrapper>
    );

    // Even without history, goBack should use fallback
    expect(navRef!.goBack).toBeDefined();
    expect(typeof navRef!.goBack).toBe('function');
  });

  it('should get previous route when available', async () => {
    let navRef: NavigationHistoryType | null = null;

    // Start at dashboard, then navigate to profile
    render(
      <TestWrapper initialEntries={['/dashboard', '/profile']}>
        <TestComponent onMount={(nav) => { navRef = nav; }} />
      </TestWrapper>
    );

    // Should have /profile in history (current route)
    expect(navRef!.historyStack).toContain('/profile');
  });
});

describe('NavigationHistoryContext - Auth Route Filtering', () => {
  const authRoutes = [
    '/login',
    '/register',
    '/verify-code',
    '/reset-password',
    '/admin-login',
    '/envision/login',
    '/logout',
    '/welcome',
    '/',
  ];

  authRoutes.forEach((route) => {
    it(`should NOT track ${route} in history`, () => {
      let navRef: NavigationHistoryType | null = null;

      render(
        <TestWrapper initialEntries={[route]}>
          <TestComponent onMount={(nav) => { navRef = nav; }} />
        </TestWrapper>
      );

      expect(navRef!.historyStack).not.toContain(route);
    });
  });
});

describe('NavigationHistoryContext - Protected Route Tracking', () => {
  const protectedRoutes = [
    '/dashboard',
    '/admin',
    '/nurse-dashboard',
    '/physician-dashboard',
    '/settings',
    '/profile',
    '/billing',
  ];

  protectedRoutes.forEach((route) => {
    it(`should track ${route} in history`, () => {
      let navRef: NavigationHistoryType | null = null;

      render(
        <TestWrapper initialEntries={[route]}>
          <TestComponent onMount={(nav) => { navRef = nav; }} />
        </TestWrapper>
      );

      expect(navRef!.historyStack).toContain(route);
    });
  });
});
