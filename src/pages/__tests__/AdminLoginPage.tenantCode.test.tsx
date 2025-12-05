import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminLoginPage from '../AdminLoginPage';

// Mock AuthContext
jest.mock('../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  }),
  useUser: () => null,
}));

// Mock AdminAuthContext
jest.mock('../../contexts/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    isAdminAuthenticated: false,
    verifyPinAndLogin: jest.fn(),
    logoutAdmin: jest.fn(),
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

describe('AdminLoginPage - Tenant Code', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(
      <MemoryRouter>
        <AdminLoginPage />
      </MemoryRouter>
    );
    expect(document.body).toBeInTheDocument();
  });
});
