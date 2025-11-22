/**
 * AdminLoginPage - Tenant Code Validation Tests
 *
 * Tests for tenant code PIN authentication logic
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

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
      const mockFrom = jest.fn().mockReturnValue({
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
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return mockFrom();
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
      mockSupabase.from.mockReturnValue({
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
      });

      render(
        <BrowserRouter>
          <AdminLoginPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Enter Tenant Code + PIN')).toBeInTheDocument();
        expect(screen.getByText(/Your tenant code is/)).toBeInTheDocument();
        // MH-6702 appears multiple times on the page - verify at least one exists
        expect(screen.getAllByText('MH-6702').length).toBeGreaterThan(0);
      });
    });

    test('should show PIN-only input for master super admin', async () => {
      mockSupabase.from.mockReturnValue({
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
      });

      render(
        <BrowserRouter>
          <AdminLoginPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Enter Admin PIN')).toBeInTheDocument();
        expect(screen.queryByText(/Your tenant code is/)).not.toBeInTheDocument();
      });
    });

    test('should show placeholder with tenant code', async () => {
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
      });

      render(
        <BrowserRouter>
          <AdminLoginPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        const input = screen.getByPlaceholderText('MH-6702-XXXX');
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
      });

      render(
        <BrowserRouter>
          <AdminLoginPage />
        </BrowserRouter>
      );

      // When tenant_code is null, component shows PIN-only input (fallback behavior)
      await waitFor(() => {
        expect(screen.getByLabelText(/Enter Admin PIN/i)).toBeInTheDocument();
        expect(screen.queryByText(/Enter Tenant Code \+ PIN/i)).not.toBeInTheDocument();
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
      });
    });

    test('should accept valid TenantCode-PIN format', async () => {
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
        expect(screen.getByText('Enter Tenant Code + PIN')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('MH-6702-XXXX');
      fireEvent.change(input, { target: { value: 'MH-6702-1234' } });

      const [,submitBtn] = screen.getAllByText('Unlock Admin Panel');
      fireEvent.click(submitBtn);

      await waitFor(() => {
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
        expect(screen.getByText('Enter Tenant Code + PIN')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('MH-6702-XXXX');
      fireEvent.change(input, { target: { value: 'INVALID' } });

      const [,submitBtn] = screen.getAllByText('Unlock Admin Panel');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Invalid format/)).toBeInTheDocument();
      });
    });

    test('should reject wrong tenant code', async () => {
      render(
        <BrowserRouter>
          <AdminLoginPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Enter Tenant Code + PIN')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('MH-6702-XXXX');
      fireEvent.change(input, { target: { value: 'PH-1234-5678' } }); // Wrong tenant code, valid format

      const [,submitBtn] = screen.getAllByText('Unlock Admin Panel');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Incorrect tenant code/)).toBeInTheDocument();
        expect(screen.getByText(/Use MH-6702/)).toBeInTheDocument();
      });
    });

    test('should auto-uppercase input', async () => {
      render(
        <BrowserRouter>
          <AdminLoginPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Enter Tenant Code + PIN')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('MH-6702-XXXX') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'mh-6702-1234' } });

      await waitFor(() => {
        expect(input.value).toBe('MH-6702-1234');
      });
    });
  });

  describe('Input Validation - Master Super Admin', () => {
    beforeEach(() => {
      mockSupabase.from.mockReturnValue({
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
        expect(screen.getByText(/Enter your 4–8 digit PIN/)).toBeInTheDocument();
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
      });

      render(
        <BrowserRouter>
          <AdminLoginPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Enter Tenant Code + PIN')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('MH-6702-XXXX');
      fireEvent.change(input, { target: { value: "'; DROP TABLE tenants; --" } });

      const [,submitBtn] = screen.getAllByText('Unlock Admin Panel');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Invalid format/)).toBeInTheDocument();
      });
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
      });

      render(
        <BrowserRouter>
          <AdminLoginPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Enter Tenant Code + PIN')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('MH-6702-XXXX');
      fireEvent.change(input, { target: { value: '<script>alert("xss")</script>' } });

      const [,submitBtn] = screen.getAllByText('Unlock Admin Panel');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Invalid format/)).toBeInTheDocument();
      });
    });
  });
});
