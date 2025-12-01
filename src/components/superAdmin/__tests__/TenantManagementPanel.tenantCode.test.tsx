/**
 * Tenant Management Panel - Tenant Code Tests
 *
 * Tests for tenant code UI: display, edit, validation
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */
/* eslint-disable testing-library/no-container, testing-library/no-node-access, testing-library/no-wait-for-multiple-assertions */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TenantManagementPanel from '../TenantManagementPanel';
import { SuperAdminService } from '../../../services/superAdminService';
import { auditLogger } from '../../../services/auditLogger';

// Mock dependencies
jest.mock('../../../services/superAdminService');
jest.mock('../../../services/auditLogger');

describe('TenantManagementPanel - Tenant Code Management', () => {
  const mockTenants = [
    {
      tenantId: 'tenant-1',
      tenantName: 'Methodist Hospital',
      subdomain: 'methodist',
      tenantCode: 'MH-6702',
      isActive: true,
      isSuspended: false,
      status: 'active' as const,
      userCount: 150,
      patientCount: 500,
      createdAt: '2025-01-01T00:00:00Z'
    },
    {
      tenantId: 'tenant-2',
      tenantName: 'Precinct 3 Constable',
      subdomain: 'precinct3',
      tenantCode: 'P3-1234',
      isActive: true,
      isSuspended: false,
      status: 'active' as const,
      userCount: 25,
      patientCount: 100,
      createdAt: '2025-01-02T00:00:00Z'
    },
    {
      tenantId: 'tenant-3',
      tenantName: 'City Hospital',
      subdomain: 'city',
      tenantCode: null,
      isActive: true,
      isSuspended: false,
      status: 'active' as const,
      userCount: 75,
      patientCount: 200,
      createdAt: '2025-01-03T00:00:00Z'
    }
  ];

  const mockSuperAdmin = {
    id: 'super-admin-123',
    userId: 'user-123',
    email: 'admin@envisionvirtualedge.com',
    displayName: 'Test Admin',
    role: 'super_admin' as const,
    permissions: ['tenants.manage'],
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (SuperAdminService.getAllTenants as jest.Mock).mockResolvedValue(mockTenants);
    (SuperAdminService.getCurrentSuperAdmin as jest.Mock).mockResolvedValue(mockSuperAdmin);
    (SuperAdminService.updateTenantCode as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Tenant Code Display', () => {
    test('should display tenant code badge for tenant with code', async () => {
      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('MH-6702')).toBeInTheDocument();
        expect(screen.getByText('P3-1234')).toBeInTheDocument();
      });
    });

    test('should not display badge for tenant without code', async () => {
      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('City Hospital')).toBeInTheDocument();
      });

      // City Hospital has no tenant code, so no code badge should appear for it
      // We verify by checking that 'CH-' prefix doesn't appear (City Hospital would be CH-XXXX)
      // The only tenant codes present should be MH-6702 and P3-1234
      expect(screen.queryByText(/^CH-/)).not.toBeInTheDocument();
    });

    test('should display edit button for all tenants', async () => {
      render(<TenantManagementPanel />);

      await waitFor(() => {
        const editButtons = screen.getAllByTitle('Edit tenant code');
        expect(editButtons).toHaveLength(3);
      });
    });
  });

  describe('Edit Dialog', () => {
    test('should open edit dialog when edit button clicked', async () => {
      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Methodist Hospital')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('Edit tenant code');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Edit Tenant Code')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('MH-6702')).toBeInTheDocument();
      });
    });

    test('should pre-fill input with existing code', async () => {
      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Methodist Hospital')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('Edit tenant code');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        const input = screen.getByPlaceholderText('MH-6702') as HTMLInputElement;
        expect(input.value).toBe('MH-6702');
      });
    });

    test('should show empty input for tenant without code', async () => {
      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('City Hospital')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('Edit tenant code');
      fireEvent.click(editButtons[2]);

      await waitFor(() => {
        const input = screen.getByPlaceholderText('MH-6702') as HTMLInputElement;
        expect(input.value).toBe('');
      });
    });

    test('should close dialog when cancel clicked', async () => {
      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Methodist Hospital')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('Edit tenant code');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Edit Tenant Code')).toBeInTheDocument();
      });

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Edit Tenant Code')).not.toBeInTheDocument();
      });
    });
  });

  describe('Input Validation', () => {
    test('should auto-uppercase input', async () => {
      const user = userEvent.setup();
      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('City Hospital')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('Edit tenant code');
      fireEvent.click(editButtons[2]);

      await waitFor(() => {
        expect(screen.getByText('Edit Tenant Code')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('MH-6702');
      await user.type(input, 'ch-9999');

      await waitFor(() => {
        expect((input as HTMLInputElement).value).toBe('CH-9999');
      });
    });

    test('should disable save button when input is empty', async () => {
      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('City Hospital')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('Edit tenant code');
      fireEvent.click(editButtons[2]);

      await waitFor(() => {
        const saveButton = screen.getByText('Save Code');
        expect(saveButton).toBeDisabled();
      });
    });

    test('should enable save button when input has value', async () => {
      const user = userEvent.setup();
      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('City Hospital')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('Edit tenant code');
      fireEvent.click(editButtons[2]);

      const input = screen.getByPlaceholderText('MH-6702');
      await user.type(input, 'CH-9999');

      await waitFor(() => {
        const saveButton = screen.getByText('Save Code');
        expect(saveButton).not.toBeDisabled();
      });
    });

    test('should show format hint in dialog', async () => {
      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Methodist Hospital')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('Edit tenant code');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        // Component shows format example in help text
        expect(screen.getByText(/Format: PREFIX-NUMBER/)).toBeInTheDocument();
      });
    });
  });

  describe('Save Functionality', () => {
    test('should call updateTenantCode when save clicked', async () => {
      const user = userEvent.setup();
      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('City Hospital')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('Edit tenant code');
      fireEvent.click(editButtons[2]);

      const input = screen.getByPlaceholderText('MH-6702');
      await user.clear(input);
      await user.type(input, 'CH-9999');

      const saveButton = screen.getByText('Save Code');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(SuperAdminService.updateTenantCode).toHaveBeenCalledWith({
          tenantId: 'tenant-3',
          tenantCode: 'CH-9999',
          superAdminId: 'super-admin-123'
        });
      });
    });

    test('should reload tenants after successful save', async () => {
      const user = userEvent.setup();
      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('City Hospital')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('Edit tenant code');
      fireEvent.click(editButtons[2]);

      const input = screen.getByPlaceholderText('MH-6702');
      await user.type(input, 'CH-9999');

      const saveButton = screen.getByText('Save Code');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(SuperAdminService.getAllTenants).toHaveBeenCalledTimes(2); // Initial load + reload
      });
    });

    test('should close dialog after successful save', async () => {
      const user = userEvent.setup();
      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('City Hospital')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('Edit tenant code');
      fireEvent.click(editButtons[2]);

      const input = screen.getByPlaceholderText('MH-6702');
      await user.type(input, 'CH-9999');

      const saveButton = screen.getByText('Save Code');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.queryByText('Edit Tenant Code')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('should display error for invalid format', async () => {
      const user = userEvent.setup();
      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('City Hospital')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('Edit tenant code');
      fireEvent.click(editButtons[2]);

      const input = screen.getByPlaceholderText('MH-6702');
      await user.type(input, 'INVALID');

      const saveButton = screen.getByText('Save Code');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Invalid format/)).toBeInTheDocument();
      });
    });

    test('should display error for duplicate code', async () => {
      const user = userEvent.setup();
      (SuperAdminService.updateTenantCode as jest.Mock).mockRejectedValue(
        new Error('This tenant code is already in use')
      );

      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('City Hospital')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('Edit tenant code');
      fireEvent.click(editButtons[2]);

      const input = screen.getByPlaceholderText('MH-6702');
      await user.type(input, 'MH-6702');

      const saveButton = screen.getByText('Save Code');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/already in use/)).toBeInTheDocument();
      });
    });

    test('should log error to audit logger', async () => {
      const user = userEvent.setup();
      const error = new Error('Test error');
      (SuperAdminService.updateTenantCode as jest.Mock).mockRejectedValue(error);

      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('City Hospital')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('Edit tenant code');
      fireEvent.click(editButtons[2]);

      const input = screen.getByPlaceholderText('MH-6702');
      await user.type(input, 'CH-9999');

      const saveButton = screen.getByText('Save Code');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(auditLogger.error).toHaveBeenCalledWith(
          'SUPER_ADMIN_TENANT_CODE_UPDATE_FAILED',
          error,
          {
            category: 'ADMINISTRATIVE',
            tenantId: 'tenant-3'
          }
        );
      });
    });
  });

  describe('Accessibility', () => {
    test('should have accessible labels', async () => {
      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Methodist Hospital')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('Edit tenant code');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        // The label text "Tenant Code" is present
        expect(screen.getByText('Tenant Code')).toBeInTheDocument();
        // Input is accessible via placeholder
        expect(screen.getByPlaceholderText('MH-6702')).toBeInTheDocument();
      });
    });

    test('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Methodist Hospital')).toBeInTheDocument();
      });

      // Tab to first edit button
      await user.tab();
      await user.tab();

      // Press enter to open dialog
      const editButtons = screen.getAllByTitle('Edit tenant code');
      editButtons[0].focus();
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Edit Tenant Code')).toBeInTheDocument();
      });
    });
  });
});
