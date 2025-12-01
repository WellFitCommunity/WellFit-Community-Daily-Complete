/**
 * AdminLoginPage - Tenant Code Validation Tests
 *
 * Tests for tenant code PIN authentication logic
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */
/* eslint-disable testing-library/no-wait-for-multiple-assertions, testing-library/no-node-access, testing-library/no-wait-for-side-effects */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AdminLoginPage from '../AdminLoginPage';
import { useAuth, useSupabaseClient } from '../../contexts/AuthContext';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useBranding } from '../../BrandingContext';

// Mock dependencies
jest.mock('../../contexts/AuthContext');
jest.mock('../../contexts/AdminAuthContext');
jest.mock('../../BrandingContext');

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: {} })
}));

describe('AdminLoginPage - Tenant Code Validation', () => {
  // Helper to create chainable mock for super_admin_users query
  const createSuperAdminMock = (returnData: any = null) => ({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: returnData, error: null })
        })
      })
    })
  });

  const mockSupabase = {
    from: jest.fn(),
    auth: {
      getUser: jest.fn()
    }
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@methodist.com'
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useBranding as jest.Mock).mockReturnValue({
      branding: {
        gradient: 'linear-gradient(to right, #3b82f6, #2563eb)'
      }
    });

    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      isAdmin: true
    });

    (useSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

    (useAdminAuth as jest.Mock).mockReturnValue({
      verifyPinAndLogin: jest.fn().mockResolvedValue(true),
      isLoading: false,
      error: null
    });
  });

  describe('Tenant Detection', () => {
    test('should fetch tenant info for tenant user', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    is_admin: true,
                    role: 'admin',
                    tenant_id: 'tenant-123'
                  },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'tenants') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { tenant_code: 'MH-6702' },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'super_admin_users') {
          return createSuperAdminMock(null);
        }
        return createSuperAdminMock(null);
      });

      render(
        <BrowserRouter>
          <AdminLoginPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith('tenants');
      });
    });

    test('should not fetch tenant info for master super admin', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    is_admin: true,
                    role: 'super_admin',
                    tenant_id: null
                  },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'super_admin_users') {
          return createSuperAdminMock(null);
        }
        return createSuperAdminMock(null);
      });

      render(
        <BrowserRouter>
          <AdminLoginPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
      });

      // Should not call tenants table
      expect(mockSupabase.from).not.toHaveBeenCalledWith('tenants');
    });
  });

  describe('UI Adaptation', () => {
    test('should show TenantCode-PIN input for tenant user', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    is_admin: true,
                    role: 'admin',
                    tenant_id: 'tenant-123'
                  },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'tenants') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { tenant_code: 'MH-6702' },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'super_admin_users') {
          return createSuperAdminMock(null);
        }
        return createSuperAdminMock(null);
      });

      render(
        <BrowserRouter>
          <AdminLoginPage />
        </BrowserRouter>
      );

      // The updated AdminLoginPage shows "Enter Admin PIN" label but with tenant badge
      await waitFor(() => {
        expect(screen.getByText('Enter Admin PIN')).toBeInTheDocument();
        // MH-6702 appears in the tenant badge
        expect(screen.getAllByText('MH-6702').length).toBeGreaterThan(0);
      });
    });

    test('should show PIN-only input for master super admin', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    is_admin: true,
                    role: 'super_admin',
                    tenant_id: null
                  },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'super_admin_users') {
          return createSuperAdminMock(null);
        }
        return createSuperAdminMock(null);
      });

      render(
        <BrowserRouter>
          <AdminLoginPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Enter Admin PIN')).toBeInTheDocument();
        expect(screen.queryByText(/Managing Facility/)).not.toBeInTheDocument();
      });
    });

    test('should show placeholder with PIN hint', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    is_admin: true,
                    role: 'admin',
                    tenant_id: 'tenant-123'
                  },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'tenants') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { tenant_code: 'MH-6702' },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'super_admin_users') {
          return createSuperAdminMock(null);
        }
        return createSuperAdminMock(null);
      });

      render(
        <BrowserRouter>
          <AdminLoginPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        // Updated UI uses standard PIN placeholder
        const input = screen.getByPlaceholderText(/Enter PIN/);
        expect(input).toBeInTheDocument();
      });
    });

    test('should show PIN-only input if no tenant code assigned', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    is_admin: true,
                    role: 'admin',
                    tenant_id: 'tenant-123'
                  },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'tenants') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { tenant_code: null },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'super_admin_users') {
          return createSuperAdminMock(null);
        }
        return createSuperAdminMock(null);
      });

      render(
        <BrowserRouter>
          <AdminLoginPage />
        </BrowserRouter>
      );

      // When tenant_code is null, component shows PIN-only input (fallback behavior)
      await waitFor(() => {
        expect(screen.getByLabelText(/Enter Admin PIN/i)).toBeInTheDocument();
        // No tenant badge when no tenant code
        expect(screen.queryByText(/Managing Facility/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Input Validation - Tenant Users', () => {
    beforeEach(() => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    is_admin: true,
                    role: 'admin',
                    tenant_id: 'tenant-123'
                  },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'tenants') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { tenant_code: 'MH-6702' },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'super_admin_users') {
          return createSuperAdminMock(null);
        }
        return createSuperAdminMock(null);
      });
    });

    test('should accept valid PIN format', async () => {
      const mockVerifyPin = jest.fn().mockResolvedValue(true);
      (useAdminAuth as jest.Mock).mockReturnValue({
        verifyPinAndLogin: mockVerifyPin,
        isLoading: false,
        error: null
      });

      render(
        <BrowserRouter>
          <AdminLoginPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Enter Admin PIN')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/Enter PIN/);
      fireEvent.change(input, { target: { value: '1234' } });

      const [,submitBtn] = screen.getAllByText('Unlock Admin Panel');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        // PIN is combined with tenant code automatically
        expect(mockVerifyPin).toHaveBeenCalledWith('MH-6702-1234', expect.any(String));
      });
    });

    test('should reject invalid format', async () => {
      render(
        <BrowserRouter>
          <AdminLoginPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Enter Admin PIN')).toBeInTheDocument();
      });

      // Enter a short PIN (less than 4 digits)
      const input = screen.getByPlaceholderText(/Enter PIN/);
      fireEvent.change(input, { target: { value: '12' } });

      const [,submitBtn] = screen.getAllByText('Unlock Admin Panel');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        // Component uses en-dash (–) in error message, using regex with . wildcard
        expect(screen.getByText(/Enter your 4.8 digit PIN/)).toBeInTheDocument();
      });
    });

    test('should show tenant badge for tenant user', async () => {
      render(
        <BrowserRouter>
          <AdminLoginPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        // Tenant badge shows the facility
        expect(screen.getByText(/Managing Facility/)).toBeInTheDocument();
        expect(screen.getAllByText('MH-6702').length).toBeGreaterThan(0);
      });
    });

    test('should only allow numeric input', async () => {
      render(
        <BrowserRouter>
          <AdminLoginPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Enter Admin PIN')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/Enter PIN/) as HTMLInputElement;
      // Non-numeric chars are stripped by cleanPin
      fireEvent.change(input, { target: { value: 'abc1234def' } });

      await waitFor(() => {
        expect(input.value).toBe('1234');
      });
    });
  });

  describe('Input Validation - Master Super Admin', () => {
    beforeEach(() => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    is_admin: true,
                    role: 'super_admin',
                    tenant_id: null
                  },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'super_admin_users') {
          return createSuperAdminMock(null);
        }
        return createSuperAdminMock(null);
      });
    });

    test('should accept numeric PIN', async () => {
      const mockVerifyPin = jest.fn().mockResolvedValue(true);
      (useAdminAuth as jest.Mock).mockReturnValue({
        verifyPinAndLogin: mockVerifyPin,
        isLoading: false,
        error: null
      });

      render(
        <BrowserRouter>
          <AdminLoginPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Enter Admin PIN')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/Enter PIN/);
      fireEvent.change(input, { target: { value: '1234' } });

      const [,submitBtn] = screen.getAllByText('Unlock Admin Panel');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockVerifyPin).toHaveBeenCalledWith('1234', expect.any(String));
      });
    });

    test('should reject non-numeric PIN', async () => {
      render(
        <BrowserRouter>
          <AdminLoginPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Enter Admin PIN')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/Enter PIN/);
      fireEvent.change(input, { target: { value: 'ABC123' } });

      const [,submitBtn] = screen.getAllByText('Unlock Admin Panel');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        // Component uses en-dash (–) in error message
        expect(screen.getByText(/Enter your 4.8 digit PIN/)).toBeInTheDocument();
      });
    });
  });

  describe('Security', () => {
    test('should handle SQL injection attempts', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    is_admin: true,
                    role: 'admin',
                    tenant_id: 'tenant-123'
                  },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'tenants') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { tenant_code: 'MH-6702' },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'super_admin_users') {
          return createSuperAdminMock(null);
        }
        return createSuperAdminMock(null);
      });

      render(
        <BrowserRouter>
          <AdminLoginPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Enter Admin PIN')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/Enter PIN/) as HTMLInputElement;
      // SQL injection chars are stripped by cleanPin (only digits allowed)
      // Input "'; DROP TABLE tenants; --" becomes empty string after stripping non-digits
      fireEvent.change(input, { target: { value: "'; DROP TABLE tenants; --" } });

      // Verify the malicious input was sanitized to empty
      expect(input.value).toBe('');

      // Submit button should be disabled with empty input
      const [,submitBtn] = screen.getAllByText('Unlock Admin Panel');
      expect(submitBtn).toBeDisabled();
    });

    test('should handle XSS attempts', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: {
                    is_admin: true,
                    role: 'admin',
                    tenant_id: 'tenant-123'
                  },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'tenants') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { tenant_code: 'MH-6702' },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'super_admin_users') {
          return createSuperAdminMock(null);
        }
        return createSuperAdminMock(null);
      });

      render(
        <BrowserRouter>
          <AdminLoginPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Enter Admin PIN')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/Enter PIN/) as HTMLInputElement;
      // XSS chars are stripped by cleanPin (only digits allowed)
      // Input "<script>alert("xss")</script>" becomes empty after stripping non-digits
      fireEvent.change(input, { target: { value: '<script>alert("xss")</script>' } });

      // Verify the malicious input was sanitized to empty
      expect(input.value).toBe('');

      // Submit button should be disabled with empty input
      const [,submitBtn] = screen.getAllByText('Unlock Admin Panel');
      expect(submitBtn).toBeDisabled();
    });
  });
});
