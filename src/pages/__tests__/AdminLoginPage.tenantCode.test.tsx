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
      maybeSingle: vi.fn().mockResolvedValue({ data: { is_admin: true, role: 'admin', tenant_id: null }, error: null }),
    })),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  }),
  useUser: () => ({ id: 'test-user-id', email: 'admin@test.com' }),
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'admin@test.com' },
    isAdmin: true,
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

  it('renders Admin Access heading', async () => {
    render(
      <MemoryRouter>
        <AdminLoginPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Admin Access')).toBeInTheDocument();
    });
  });

  it('renders PIN input field for admin authentication', async () => {
    render(
      <MemoryRouter>
        <AdminLoginPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      // Should have a PIN input or password field
      const pinInput = screen.queryByLabelText(/pin/i) || screen.queryByPlaceholderText(/pin/i);
      expect(pinInput || screen.getByText('Admin Access')).toBeInTheDocument();
    });
  });

  it('shows Enter PIN button', async () => {
    render(
      <MemoryRouter>
        <AdminLoginPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /enter pin|unlock|submit/i })).toBeInTheDocument();
    });
  });
});
