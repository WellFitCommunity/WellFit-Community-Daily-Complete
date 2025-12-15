/**
 * Tenant Management Panel - Savings Counter Tests
 *
 * Tests for tenant savings display: stats grid, per-tenant savings
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */
/* eslint-disable testing-library/no-wait-for-multiple-assertions */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import TenantManagementPanel from '../TenantManagementPanel';
import { SuperAdminService } from '../../../services/superAdminService';

// Mock dependencies
vi.mock('../../../services/superAdminService');
vi.mock('../../../services/auditLogger');

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Building2: () => <span data-testid="icon-building">Building2</span>,
  Users: () => <span data-testid="icon-users">Users</span>,
  Activity: () => <span data-testid="icon-activity">Activity</span>,
  AlertCircle: () => <span data-testid="icon-alert">AlertCircle</span>,
  CheckCircle: () => <span data-testid="icon-check">CheckCircle</span>,
  XCircle: () => <span data-testid="icon-x">XCircle</span>,
  Eye: () => <span data-testid="icon-eye">Eye</span>,
  Settings: () => <span data-testid="icon-settings">Settings</span>,
  Edit2: () => <span data-testid="icon-edit">Edit2</span>,
  Hash: () => <span data-testid="icon-hash">Hash</span>,
  Sliders: () => <span data-testid="icon-sliders">Sliders</span>,
  Plus: () => <span data-testid="icon-plus">Plus</span>,
  Heart: () => <span data-testid="icon-heart">Heart</span>,
  Stethoscope: () => <span data-testid="icon-stethoscope">Stethoscope</span>,
  Layers: () => <span data-testid="icon-layers">Layers</span>,
  Filter: () => <span data-testid="icon-filter">Filter</span>,
  Search: () => <span data-testid="icon-search">Search</span>,
  Calendar: () => <span data-testid="icon-calendar">Calendar</span>,
  Shield: () => <span data-testid="icon-shield">Shield</span>,
  DollarSign: () => <span data-testid="icon-dollar">DollarSign</span>,
}));

// Mock EACard components
vi.mock('../../envision-atlus/EACard', () => ({
  EACard: ({ children, className }: any) => <div className={className}>{children}</div>,
  EACardHeader: ({ children, icon, action }: any) => <div>{icon}{children}{action}</div>,
  EACardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
}));

vi.mock('../../envision-atlus/EAButton', () => ({
  EAButton: ({ children, onClick, icon, disabled, loading }: any) => (
    <button onClick={onClick} disabled={disabled || loading}>{icon}{children}</button>
  ),
}));

describe('TenantManagementPanel - Savings Counter', () => {
  const mockTenantsWithSavings = [
    {
      tenantId: 'tenant-1',
      tenantName: 'Methodist Hospital',
      subdomain: 'methodist',
      tenantCode: 'MH-0001',
      licensedProducts: ['wellfit', 'atlus'],
      isActive: true,
      isSuspended: false,
      status: 'active' as const,
      userCount: 150,
      patientCount: 500,
      totalSavings: 125000,
      createdAt: '2025-01-01T00:00:00Z',
    },
    {
      tenantId: 'tenant-2',
      tenantName: 'Vegas Clinic',
      subdomain: 'vegas',
      tenantCode: 'VG-0002',
      licensedProducts: ['wellfit', 'atlus'],
      isActive: true,
      isSuspended: false,
      status: 'active' as const,
      userCount: 75,
      patientCount: 200,
      totalSavings: 54000,
      createdAt: '2025-01-02T00:00:00Z',
    },
    {
      tenantId: 'tenant-3',
      tenantName: 'Miami Care',
      subdomain: 'miami',
      tenantCode: 'MC-9001',
      licensedProducts: ['wellfit'],
      isActive: true,
      isSuspended: false,
      status: 'active' as const,
      userCount: 50,
      patientCount: 150,
      totalSavings: 0,
      createdAt: '2025-01-03T00:00:00Z',
    },
  ];

  const mockSuperAdmin = {
    id: 'super-admin-123',
    userId: 'user-123',
    email: 'admin@envisionvirtualedge.com',
    displayName: 'Test Admin',
    role: 'super_admin' as const,
    permissions: ['tenants.manage'],
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (SuperAdminService.getAllTenants as ReturnType<typeof vi.fn>).mockResolvedValue(mockTenantsWithSavings);
    (SuperAdminService.getCurrentSuperAdmin as ReturnType<typeof vi.fn>).mockResolvedValue(mockSuperAdmin);
  });

  describe('Stats Grid - Total Saved', () => {
    it('should display Total Saved stat card in header', async () => {
      render(<TenantManagementPanel />);

      await waitFor(() => {
        // Look for both possible labels
        const totalSavedElements = screen.queryAllByText(/Total Saved/i);
        expect(totalSavedElements.length).toBeGreaterThan(0);
      });
    });

    it('should display correct total savings across all tenants', async () => {
      render(<TenantManagementPanel />);

      await waitFor(() => {
        // Total: 125000 + 54000 + 0 = 179000
        expect(screen.getByText('$179,000')).toBeInTheDocument();
      });
    });

    it('should display dollar sign icon for total saved', async () => {
      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Methodist Hospital')).toBeInTheDocument();
      });

      // Icon should be present - at least one dollar icon
      const dollarIcons = screen.queryAllByTestId('icon-dollar');
      expect(dollarIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Per-Tenant Savings Display', () => {
    it('should display Total Saved column for each tenant', async () => {
      render(<TenantManagementPanel />);

      await waitFor(() => {
        // Each tenant card should have a "Total Saved" label
        const totalSavedLabels = screen.getAllByText('Total Saved');
        // One in the stats grid + one per tenant (3 tenants)
        expect(totalSavedLabels.length).toBe(4);
      });
    });

    it('should display correct savings for Methodist Hospital', async () => {
      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Methodist Hospital')).toBeInTheDocument();
        expect(screen.getByText('$125,000')).toBeInTheDocument();
      });
    });

    it('should display correct savings for Vegas Clinic', async () => {
      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Vegas Clinic')).toBeInTheDocument();
        expect(screen.getByText('$54,000')).toBeInTheDocument();
      });
    });

    it('should display $0 for tenant with no savings', async () => {
      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Miami Care')).toBeInTheDocument();
        expect(screen.getByText('$0')).toBeInTheDocument();
      });
    });
  });

  describe('Null Safety', () => {
    it('should handle null totalSavings gracefully', async () => {
      const tenantsWithNull = [
        {
          ...mockTenantsWithSavings[0],
          totalSavings: null,
        },
        {
          ...mockTenantsWithSavings[1],
          totalSavings: undefined,
        },
      ];

      (SuperAdminService.getAllTenants as ReturnType<typeof vi.fn>).mockResolvedValue(tenantsWithNull);

      // Should not throw
      expect(() => render(<TenantManagementPanel />)).not.toThrow();

      await waitFor(() => {
        expect(screen.getByText('Methodist Hospital')).toBeInTheDocument();
      });
    });

    it('should display $0 for null savings', async () => {
      const tenantsWithNull = [
        {
          ...mockTenantsWithSavings[0],
          totalSavings: null,
        },
      ];

      (SuperAdminService.getAllTenants as ReturnType<typeof vi.fn>).mockResolvedValue(tenantsWithNull);

      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Methodist Hospital')).toBeInTheDocument();
      });

      // Should show $0 for null savings - check that a $0 exists
      const zeroElements = screen.queryAllByText('$0');
      expect(zeroElements.length).toBeGreaterThan(0);
    });
  });

  describe('Formatting', () => {
    it('should format large numbers with commas', async () => {
      const tenantsWithLargeSavings = [
        {
          ...mockTenantsWithSavings[0],
          totalSavings: 1234567,
        },
      ];

      (SuperAdminService.getAllTenants as ReturnType<typeof vi.fn>).mockResolvedValue(tenantsWithLargeSavings);

      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Methodist Hospital')).toBeInTheDocument();
      });

      // Check for formatted number - may appear multiple times (header + tenant row)
      const formattedNumbers = screen.queryAllByText('$1,234,567');
      expect(formattedNumbers.length).toBeGreaterThan(0);
    });

    it('should display savings in emerald color', async () => {
      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Methodist Hospital')).toBeInTheDocument();
      });

      // Check that savings values have emerald styling
      const savingsElements = screen.getAllByText('$125,000');
      expect(savingsElements[0]).toHaveClass('text-emerald-400');
    });
  });

  describe('Stats Calculation', () => {
    it('should correctly sum savings across all tenants', async () => {
      render(<TenantManagementPanel />);

      await waitFor(() => {
        // Verify the total is calculated correctly
        // 125000 + 54000 + 0 = 179000
        expect(screen.getByText('$179,000')).toBeInTheDocument();
      });
    });

    it('should show updated totals when data changes', async () => {
      // Test that component can render different totals based on data
      const updatedTenants = [
        { ...mockTenantsWithSavings[0], totalSavings: 777777 },
      ];
      (SuperAdminService.getAllTenants as ReturnType<typeof vi.fn>).mockResolvedValue(updatedTenants);

      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Methodist Hospital')).toBeInTheDocument();
      });

      // Verify the new total appears (may appear in header and tenant row)
      const totalElements = screen.queryAllByText('$777,777');
      expect(totalElements.length).toBeGreaterThan(0);
    });
  });

  describe('Empty State', () => {
    it('should display $0 total when no tenants exist', async () => {
      (SuperAdminService.getAllTenants as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      render(<TenantManagementPanel />);

      await waitFor(() => {
        // When no tenants, should show the stat card with $0
        const totalSavedLabels = screen.queryAllByText(/Total Saved/i);
        expect(totalSavedLabels.length).toBeGreaterThan(0);
      });

      // Check for $0 in the stats grid
      const zeroValues = screen.queryAllByText('$0');
      expect(zeroValues.length).toBeGreaterThan(0);
    });

    it('should display $0 total when all tenants have zero savings', async () => {
      const tenantsWithZeroSavings = mockTenantsWithSavings.map((t) => ({
        ...t,
        totalSavings: 0,
      }));

      (SuperAdminService.getAllTenants as ReturnType<typeof vi.fn>).mockResolvedValue(tenantsWithZeroSavings);

      render(<TenantManagementPanel />);

      await waitFor(() => {
        expect(screen.getByText('Methodist Hospital')).toBeInTheDocument();
      });

      // All $0 values should be present
      const zeroValues = screen.queryAllByText('$0');
      expect(zeroValues.length).toBeGreaterThanOrEqual(1);
    });
  });
});
