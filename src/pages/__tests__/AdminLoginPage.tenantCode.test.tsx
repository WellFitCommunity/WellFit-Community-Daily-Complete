import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminLoginPage from '../AdminLoginPage';

// Mock AuthContext - all values must be defined inline due to jest hoisting
jest.mock('../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: { is_admin: false, role: 'admin', tenant_id: null }, error: null }),
    })),
    functions: {
      invoke: jest.fn().mockResolvedValue({ data: null, error: null }),
    },
  }),
  useUser: () => null,
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    isAdmin: false,
    loading: false,
  }),
}));

// Mock AdminAuthContext
jest.mock('../../contexts/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    isAdminAuthenticated: false,
    verifyPinAndLogin: jest.fn(),
    logoutAdmin: jest.fn(),
    isLoading: false,
    error: null,
  }),
}));

// Mock BrandingContext
jest.mock('../../BrandingContext', () => ({
  useBranding: () => ({
    branding: {
      primaryColor: '#00857a',
      orgName: 'Test Org',
    },
  }),
}));

// Mock pinHashingService
jest.mock('../../services/pinHashingService', () => ({
  hashPinForTransmission: jest.fn().mockResolvedValue('hashed-pin'),
}));

describe('AdminLoginPage - Tenant Code', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', async () => {
    render(
      <MemoryRouter>
        <AdminLoginPage />
      </MemoryRouter>
    );

    // Wait for async operations to complete
    await waitFor(() => {
      expect(document.body).toBeInTheDocument();
    });
  });
});
