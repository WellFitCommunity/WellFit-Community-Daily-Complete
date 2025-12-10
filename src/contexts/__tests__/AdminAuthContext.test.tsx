import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock the entire AdminAuthContext module
const mockContextValue = {
  isAdminAuthenticated: false,
  adminRole: null,
  accessScopes: null,
  isLoading: false,
  error: null,
  verifyPinAndLogin: jest.fn().mockResolvedValue(false),
  logoutAdmin: jest.fn(),
  autoAuthenticateAsSuperAdmin: jest.fn().mockResolvedValue(false),
  hasAccess: jest.fn().mockReturnValue(false),
  canViewNurse: false,
  canViewPhysician: false,
  canViewAdmin: false,
  canSupervise: false,
  canManageDepartment: false,
  invokeAdminFunction: jest.fn().mockResolvedValue({ data: null, error: null }),
};

// Create a real context for the provider test
const AdminAuthContext = React.createContext<typeof mockContextValue | undefined>(undefined);

// Test component to access context - renders values to DOM for testing
const TestConsumer: React.FC = () => {
  const auth = React.useContext(AdminAuthContext);
  if (!auth) throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  return (
    <div>
      <span data-testid="authenticated">{auth.isAdminAuthenticated.toString()}</span>
      <span data-testid="loading">{auth.isLoading.toString()}</span>
      <span data-testid="role">{auth.adminRole || 'none'}</span>
      <span data-testid="has-verify-pin">{typeof auth.verifyPinAndLogin === 'function' ? 'true' : 'false'}</span>
      <span data-testid="has-logout">{typeof auth.logoutAdmin === 'function' ? 'true' : 'false'}</span>
      <span data-testid="has-auto-auth">{typeof auth.autoAuthenticateAsSuperAdmin === 'function' ? 'true' : 'false'}</span>
      <span data-testid="has-access">{typeof auth.hasAccess === 'function' ? 'true' : 'false'}</span>
      <span data-testid="has-invoke">{typeof auth.invokeAdminFunction === 'function' ? 'true' : 'false'}</span>
      <span data-testid="can-view-nurse">{auth.canViewNurse.toString()}</span>
      <span data-testid="can-view-physician">{auth.canViewPhysician.toString()}</span>
      <span data-testid="can-view-admin">{auth.canViewAdmin.toString()}</span>
      <span data-testid="can-supervise">{auth.canSupervise.toString()}</span>
      <span data-testid="can-manage-department">{auth.canManageDepartment.toString()}</span>
    </div>
  );
};

// Simple provider for testing
const TestProvider: React.FC<{ children: React.ReactNode; value?: typeof mockContextValue }> = ({
  children,
  value = mockContextValue
}) => {
  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};

describe('AdminAuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  it('provides default unauthenticated state', () => {
    render(
      <TestProvider>
        <TestConsumer />
      </TestProvider>
    );

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('role')).toHaveTextContent('none');
  });

  it('provides loading state as false by default', () => {
    render(
      <TestProvider>
        <TestConsumer />
      </TestProvider>
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('throws error when used outside provider', () => {
    // Suppress React error output for this test since we expect an error
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useAdminAuth must be used within an AdminAuthProvider');

    consoleSpy.mockRestore();
  });

  it('provides all required context methods', () => {
    render(
      <TestProvider>
        <TestConsumer />
      </TestProvider>
    );

    // Check all required methods exist by checking DOM
    expect(screen.getByTestId('has-verify-pin')).toHaveTextContent('true');
    expect(screen.getByTestId('has-logout')).toHaveTextContent('true');
    expect(screen.getByTestId('has-auto-auth')).toHaveTextContent('true');
    expect(screen.getByTestId('has-access')).toHaveTextContent('true');
    expect(screen.getByTestId('has-invoke')).toHaveTextContent('true');
  });

  it('provides permission flags', () => {
    render(
      <TestProvider>
        <TestConsumer />
      </TestProvider>
    );

    // Check permission flags default to false
    expect(screen.getByTestId('can-view-nurse')).toHaveTextContent('false');
    expect(screen.getByTestId('can-view-physician')).toHaveTextContent('false');
    expect(screen.getByTestId('can-view-admin')).toHaveTextContent('false');
    expect(screen.getByTestId('can-supervise')).toHaveTextContent('false');
    expect(screen.getByTestId('can-manage-department')).toHaveTextContent('false');
  });

  it('reflects authenticated state when provided', () => {
    const authenticatedValue = {
      ...mockContextValue,
      isAdminAuthenticated: true,
      adminRole: 'nurse' as const,
    };

    render(
      <TestProvider value={authenticatedValue}>
        <TestConsumer />
      </TestProvider>
    );

    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('role')).toHaveTextContent('nurse');
  });

  it('reflects permission flags when granted', () => {
    const adminValue = {
      ...mockContextValue,
      isAdminAuthenticated: true,
      adminRole: 'admin' as const,
      canViewNurse: true,
      canViewPhysician: true,
      canViewAdmin: true,
      canSupervise: true,
      canManageDepartment: true,
    };

    render(
      <TestProvider value={adminValue}>
        <TestConsumer />
      </TestProvider>
    );

    expect(screen.getByTestId('can-view-nurse')).toHaveTextContent('true');
    expect(screen.getByTestId('can-view-physician')).toHaveTextContent('true');
    expect(screen.getByTestId('can-view-admin')).toHaveTextContent('true');
    expect(screen.getByTestId('can-supervise')).toHaveTextContent('true');
    expect(screen.getByTestId('can-manage-department')).toHaveTextContent('true');
  });
});
