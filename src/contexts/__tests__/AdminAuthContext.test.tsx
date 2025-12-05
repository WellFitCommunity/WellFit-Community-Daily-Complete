import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AdminAuthProvider, useAdminAuth } from '../AdminAuthContext';

// Mock supabaseClient
jest.mock('../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: jest.fn().mockResolvedValue({ data: null, error: null }),
    },
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

// Mock pinHashingService
jest.mock('../../services/pinHashingService', () => ({
  prepareAdminPinForVerification: jest.fn().mockResolvedValue('hashed-pin'),
}));

// Test component to access context
const TestConsumer: React.FC = () => {
  const auth = useAdminAuth();
  return (
    <div>
      <span data-testid="authenticated">{auth.isAdminAuthenticated.toString()}</span>
      <span data-testid="loading">{auth.isLoading.toString()}</span>
      <span data-testid="role">{auth.adminRole || 'none'}</span>
    </div>
  );
};

describe('AdminAuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  it('provides default unauthenticated state', () => {
    render(
      <AdminAuthProvider>
        <TestConsumer />
      </AdminAuthProvider>
    );

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('role')).toHaveTextContent('none');
  });

  it('provides loading state', () => {
    render(
      <AdminAuthProvider>
        <TestConsumer />
      </AdminAuthProvider>
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('throws error when used outside provider', () => {
    expect(() => {
      render(<TestConsumer />);
    }).toThrow();
  });
});
