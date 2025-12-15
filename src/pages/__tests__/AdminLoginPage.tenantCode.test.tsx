import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminLoginPage from '../AdminLoginPage';

// Mock AuthContext - all values must be defined inline due to jest hoisting
vi.mock('../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: { is_admin: false, role: 'admin', tenant_id: null }, error: null }),
    })),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
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
vi.mock('../../contexts/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    isAdminAuthenticated: false,
    verifyPinAndLogin: vi.fn(),
    logoutAdmin: vi.fn(),
    isLoading: false,
    error: null,
  }),
}));

// Mock BrandingContext
vi.mock('../../BrandingContext', () => ({
  useBranding: () => ({
    branding: {
      primaryColor: '#00857a',
      orgName: 'Test Org',
    },
  }),
}));

// Mock pinHashingService
vi.mock('../../services/pinHashingService', () => ({
  hashPinForTransmission: vi.fn().mockResolvedValue('hashed-pin'),
}));

describe('AdminLoginPage - Tenant Code', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
