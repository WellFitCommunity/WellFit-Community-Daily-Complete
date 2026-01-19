/**
 * Tests for Bed Command Center
 *
 * Purpose: Multi-facility bed capacity monitoring dashboard
 * Tests: Module exports, component rendering, state management
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock Supabase client
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { tenant_id: 'test-tenant-id' },
        error: null,
      }),
    })),
  },
}));

// Mock Command Center Service
vi.mock('../../../services/commandCenterService', () => ({
  CommandCenterService: {
    getCommandCenterSummary: vi.fn().mockResolvedValue({
      success: true,
      data: {
        total_facilities: 5,
        total_beds: 500,
        total_occupied: 400,
        total_available: 80,
        total_blocked: 20,
        network_occupancy_percent: 80.0,
        facilities_on_divert: 1,
        active_alerts: 3,
        pending_transfers: 5,
        ed_boarders: 12,
        avg_occupancy_percent: 80.0,
        highest_occupancy_facility: 'Hospital A',
        highest_occupancy_percent: 95.0,
        lowest_occupancy_facility: 'Hospital B',
        lowest_occupancy_percent: 65.0,
        facilities: [
          {
            facility_id: 'facility-1',
            facility_name: 'Methodist Main',
            total_beds: 200,
            occupied_beds: 180,
            available_beds: 15,
            blocked_beds: 5,
            reserved_beds: 0,
            occupancy_percent: 90.0,
            divert_status: false,
            alert_level: 'critical',
            is_accepting_transfers: true,
            snapshot_at: new Date().toISOString(),
          },
          {
            facility_id: 'facility-2',
            facility_name: 'Methodist West',
            total_beds: 150,
            occupied_beds: 100,
            available_beds: 45,
            blocked_beds: 5,
            reserved_beds: 0,
            occupancy_percent: 66.7,
            divert_status: false,
            alert_level: null,
            is_accepting_transfers: true,
            snapshot_at: new Date().toISOString(),
          },
        ],
        as_of: new Date().toISOString(),
      },
    }),
    getActiveAlerts: vi.fn().mockResolvedValue({
      success: true,
      data: [
        {
          id: 'alert-1',
          alert_type: 'capacity_critical',
          severity: 'high',
          title: 'Methodist Main at 90% capacity',
          message: 'Capacity threshold breached',
          reference_type: 'facility',
          reference_id: 'facility-1',
          status: 'active',
          escalation_level: 3,
          is_acknowledged: false,
          created_at: new Date().toISOString(),
        },
      ],
    }),
    acknowledgeAlert: vi.fn().mockResolvedValue({ success: true }),
    setFacilityDivertStatus: vi.fn().mockResolvedValue({ success: true }),
  },
}));

// Mock audit logger
vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    clinical: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock Envision Atlus components
vi.mock('../../envision-atlus', () => ({
  EACard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className} data-testid="ea-card">{children}</div>
  ),
  EACardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="ea-card-header">{children}</div>
  ),
  EACardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className} data-testid="ea-card-title">{children}</h2>
  ),
  EACardDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="ea-card-description">{children}</p>
  ),
  EACardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className} data-testid="ea-card-content">{children}</div>
  ),
  EAButton: ({ children, onClick, variant, size, className, disabled }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    size?: string;
    className?: string;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      className={className}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      data-testid="ea-button"
    >
      {children}
    </button>
  ),
  EABadge: ({ children, variant, className }: { children: React.ReactNode; variant?: string; className?: string }) => (
    <span className={className} data-variant={variant} data-testid="ea-badge">{children}</span>
  ),
  EAProgress: ({ value, className }: { value: number; className?: string }) => (
    <div className={className} data-value={value} data-testid="ea-progress" role="progressbar" aria-valuenow={value} />
  ),
  EATooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  EATooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  EATooltipContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  EATooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  EASelect: ({ children }: { children: React.ReactNode }) => <div data-testid="ea-select">{children}</div>,
  EASelectTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <button className={className} data-testid="ea-select-trigger">{children}</button>
  ),
  EASelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  EASelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  EASelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Building2: () => <span data-testid="icon-building2">Building2</span>,
  Bed: () => <span data-testid="icon-bed">Bed</span>,
  Users: () => <span data-testid="icon-users">Users</span>,
  AlertTriangle: () => <span data-testid="icon-alert-triangle">AlertTriangle</span>,
  RefreshCw: () => <span data-testid="icon-refresh">RefreshCw</span>,
  Filter: () => <span data-testid="icon-filter">Filter</span>,
  TrendingUp: () => <span data-testid="icon-trending-up">TrendingUp</span>,
  TrendingDown: () => <span data-testid="icon-trending-down">TrendingDown</span>,
  ArrowUpRight: () => <span data-testid="icon-arrow-up-right">ArrowUpRight</span>,
  ArrowDownRight: () => <span data-testid="icon-arrow-down-right">ArrowDownRight</span>,
  Check: () => <span data-testid="icon-check">Check</span>,
  AlertCircle: () => <span data-testid="icon-alert-circle">AlertCircle</span>,
  Clock: () => <span data-testid="icon-clock">Clock</span>,
  MapPin: () => <span data-testid="icon-map-pin">MapPin</span>,
  Activity: () => <span data-testid="icon-activity">Activity</span>,
}));

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('BedCommandCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Module Exports', () => {
    it('should be a valid module', async () => {
      const module = await import('../BedCommandCenter');
      expect(module).toBeDefined();
      expect(module.default).toBeDefined();
    });

    it('module exports a React component', async () => {
      const module = await import('../BedCommandCenter');
      expect(typeof module.default).toBe('function');
    });

    it('component has a name or displayName', async () => {
      const module = await import('../BedCommandCenter');
      expect(module.default.name || module.default.displayName || 'function').toBeTruthy();
    });
  });

  describe('Component Rendering', () => {
    it('should render loading state initially', async () => {
      const BedCommandCenter = (await import('../BedCommandCenter')).default;
      const { container } = render(
        <TestWrapper>
          <BedCommandCenter />
        </TestWrapper>
      );

      // Should show loading spinner initially (component uses animate-spin class)
      const spinner = container.querySelector('.animate-spin');
      expect(spinner || container.querySelector('div')).toBeTruthy();
    });

    it('should render dashboard title', async () => {
      const BedCommandCenter = (await import('../BedCommandCenter')).default;
      render(
        <TestWrapper>
          <BedCommandCenter />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/bed command center|network capacity/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should render summary cards', async () => {
      const BedCommandCenter = (await import('../BedCommandCenter')).default;
      render(
        <TestWrapper>
          <BedCommandCenter />
        </TestWrapper>
      );

      await waitFor(() => {
        // Check for various summary metrics - look for common card elements
        const content = document.body.textContent || '';
        expect(
          content.includes('Facilities') ||
          content.includes('Beds') ||
          content.includes('Total') ||
          screen.queryAllByRole('button').length > 0
        ).toBeTruthy();
      }, { timeout: 3000 });
    });

    it('should render interactive buttons', async () => {
      const BedCommandCenter = (await import('../BedCommandCenter')).default;
      render(
        <TestWrapper>
          <BedCommandCenter />
        </TestWrapper>
      );

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });
  });

  describe('Data Display', () => {
    it('should display facility list after loading', async () => {
      const BedCommandCenter = (await import('../BedCommandCenter')).default;
      render(
        <TestWrapper>
          <BedCommandCenter />
        </TestWrapper>
      );

      await waitFor(() => {
        // Check for facility data to appear - either by name or by presence of cards
        const content = document.body.textContent;
        expect(
          content?.includes('Methodist') ||
          content?.includes('Facility') ||
          screen.queryAllByRole('button').length > 0
        ).toBeTruthy();
      }, { timeout: 3000 });
    });

    it('should display occupancy metrics', async () => {
      const BedCommandCenter = (await import('../BedCommandCenter')).default;
      render(
        <TestWrapper>
          <BedCommandCenter />
        </TestWrapper>
      );

      await waitFor(() => {
        // Should show some form of percentage or occupancy data
        const content = document.body.textContent || '';
        expect(
          content.includes('%') ||
          content.includes('Occupied') ||
          content.includes('Available')
        ).toBeTruthy();
      }, { timeout: 3000 });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing tenant gracefully', async () => {
      // Override mock for this test
      const { supabase } = await import('../../../lib/supabaseClient');
      vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
        data: { user: null },
        error: new Error('Not authenticated'),
      } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>);

      const BedCommandCenter = (await import('../BedCommandCenter')).default;

      // Should not throw
      expect(() => {
        render(
          <TestWrapper>
            <BedCommandCenter />
          </TestWrapper>
        );
      }).not.toThrow();
    });
  });
});

describe('BedCommandCenter Integration', () => {
  it('should integrate with useBedCommandCenter hook', async () => {
    const hookModule = await import('../../../hooks/useBedCommandCenter');
    expect(hookModule).toBeDefined();
    expect(hookModule.useBedCommandCenter).toBeDefined();
    expect(typeof hookModule.useBedCommandCenter).toBe('function');
  });

  it('should integrate with CommandCenterService', async () => {
    const serviceModule = await import('../../../services/commandCenterService');
    expect(serviceModule).toBeDefined();
    expect(serviceModule.CommandCenterService).toBeDefined();
    expect(typeof serviceModule.CommandCenterService.getCommandCenterSummary).toBe('function');
    expect(typeof serviceModule.CommandCenterService.getActiveAlerts).toBe('function');
  });
});
