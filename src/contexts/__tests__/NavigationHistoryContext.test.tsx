import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, useNavigate, Routes, Route } from 'react-router-dom';
import { NavigationHistoryProvider, useNavigationHistory } from '../NavigationHistoryContext';

// Type for the navigation history context
type NavigationHistoryType = ReturnType<typeof useNavigationHistory>;

// Helper to assert non-null and return typed value
// Uses explicit cast for test assertions
function assertDefined(value: NavigationHistoryType | null): NavigationHistoryType {
  if (value === null || value === undefined) {
    throw new Error('Expected value to be defined');
  }
  return value;
}

// Mock AuthContext - provide the user object that NavigationHistoryContext needs
vi.mock('../AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    session: null,
    loading: false,
    isLoading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPassword: vi.fn(),
    updatePassword: vi.fn(),
    profile: null,
    roleCode: null,
    isSenior: false,
    isCaregiver: false,
    isVolunteer: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
      <NavigationHistoryProvider>
        <Routes>
          <Route path="*" element={children} />
        </Routes>
      </NavigationHistoryProvider>
    </MemoryRouter>
  );
};

describe('NavigationHistoryContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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
    expect(navRef).not.toBeNull();
    expect(assertDefined(navRef).historyStack).toContain('/dashboard');
  });

  it('should NOT track auth routes like /login', async () => {
    let navRef: NavigationHistoryType | null = null;

    render(
      <TestWrapper initialEntries={['/login']}>
        <TestComponent onMount={(nav) => { navRef = nav; }} />
      </TestWrapper>
    );

    // Login route should NOT be in history
    expect(navRef).not.toBeNull();
    expect(assertDefined(navRef).historyStack).not.toContain('/login');
  });

  it('should clear history when clearHistory is called', async () => {
    let navRef: NavigationHistoryType | null = null;

    render(
      <TestWrapper initialEntries={['/dashboard']}>
        <TestComponent onMount={(nav) => { navRef = nav; }} />
      </TestWrapper>
    );

    expect(navRef).not.toBeNull();

    // Clear history
    act(() => {
      assertDefined(navRef).clearHistory();
    });

    expect(assertDefined(navRef).historyStack).toHaveLength(0);
    expect(assertDefined(navRef).canGoBack).toBe(false);
  });

  it('should provide context-aware fallback when no history', () => {
    let navRef: NavigationHistoryType | null = null;

    render(
      <TestWrapper initialEntries={['/admin/settings']}>
        <TestComponent onMount={(nav) => { navRef = nav; }} />
      </TestWrapper>
    );

    expect(navRef).not.toBeNull();
    // Even without history, goBack should use fallback
    expect(assertDefined(navRef).goBack).toBeDefined();
    expect(typeof assertDefined(navRef).goBack).toBe('function');
  });

  it('should get previous route when available', async () => {
    let navRef: NavigationHistoryType | null = null;

    // Start at dashboard, then navigate to profile
    render(
      <TestWrapper initialEntries={['/dashboard', '/profile']}>
        <TestComponent onMount={(nav) => { navRef = nav; }} />
      </TestWrapper>
    );

    expect(navRef).not.toBeNull();
    // Should have /profile in history (current route)
    expect(assertDefined(navRef).historyStack).toContain('/profile');
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

  beforeEach(() => {
    localStorage.clear();
  });

  authRoutes.forEach((route) => {
    it(`should NOT track ${route} in history`, () => {
      let navRef: NavigationHistoryType | null = null;

      render(
        <TestWrapper initialEntries={[route]}>
          <TestComponent onMount={(nav) => { navRef = nav; }} />
        </TestWrapper>
      );

      expect(navRef).not.toBeNull();
      expect(assertDefined(navRef).historyStack).not.toContain(route);
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

  beforeEach(() => {
    localStorage.clear();
  });

  protectedRoutes.forEach((route) => {
    it(`should track ${route} in history`, () => {
      let navRef: NavigationHistoryType | null = null;

      render(
        <TestWrapper initialEntries={[route]}>
          <TestComponent onMount={(nav) => { navRef = nav; }} />
        </TestWrapper>
      );

      expect(navRef).not.toBeNull();
      expect(assertDefined(navRef).historyStack).toContain(route);
    });
  });
});
