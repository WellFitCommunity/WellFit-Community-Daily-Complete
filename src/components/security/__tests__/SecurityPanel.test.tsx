/**
 * Tests for SecurityPanel Component
 *
 * Purpose: Security Alert Dashboard for monitoring and responding to security events
 * Tests: Loading state, empty state, alert rendering, filtering, actions
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SecurityPanel } from '../SecurityPanel';

// Mock AuthContext
const mockUseAuth = vi.fn();

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock Supabase client
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

// Mock useRealtimeSubscription hook
const mockUseRealtimeSubscription = vi.fn();

vi.mock('../../../hooks/useRealtimeSubscription', () => ({
  default: (config: { initialFetch: () => Promise<unknown[]> }) => mockUseRealtimeSubscription(config),
}));

// Mock security alerts data
const mockAlerts = [
  {
    id: 'alert-1',
    severity: 'critical' as const,
    category: 'Authentication',
    title: 'Suspicious Login Attempt',
    message: 'Multiple failed login attempts detected',
    created_at: '2024-01-15T10:00:00Z',
    status: 'pending' as const,
    metadata: { ip: '192.168.1.1' },
  },
  {
    id: 'alert-2',
    severity: 'high' as const,
    category: 'Access Control',
    title: 'Unauthorized Access Attempt',
    message: 'User attempted to access restricted resource',
    created_at: '2024-01-15T09:00:00Z',
    status: 'acknowledged' as const,
    acknowledged_at: '2024-01-15T09:30:00Z',
    acknowledged_by: 'admin-123',
  },
  {
    id: 'alert-3',
    severity: 'medium' as const,
    category: 'Data Access',
    title: 'PHI Access Log',
    message: 'Bulk PHI access detected',
    created_at: '2024-01-15T08:00:00Z',
    status: 'resolved' as const,
    resolved_at: '2024-01-15T08:30:00Z',
    resolved_by: 'admin-456',
  },
  {
    id: 'alert-4',
    severity: 'low' as const,
    category: 'System',
    title: 'Configuration Change',
    message: 'Security configuration updated',
    created_at: '2024-01-14T12:00:00Z',
    status: 'pending' as const,
  },
];

describe('SecurityPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: { id: 'test-user-id' },
    });

    // Default: return mock alerts
    mockUseRealtimeSubscription.mockReturnValue({
      data: mockAlerts,
      loading: false,
      refresh: vi.fn(),
    });

    // Setup Supabase chain
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ order: mockOrder });
    mockOrder.mockResolvedValue({ data: mockAlerts, error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ error: null });
  });

  describe('Loading State', () => {
    it('should show loading spinner while loading', () => {
      mockUseRealtimeSubscription.mockReturnValue({
        data: null,
        loading: true,
        refresh: vi.fn(),
      });

      render(<SecurityPanel />);

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should not render content while loading', () => {
      mockUseRealtimeSubscription.mockReturnValue({
        data: null,
        loading: true,
        refresh: vi.fn(),
      });

      render(<SecurityPanel />);

      expect(screen.queryByText('Security Alerts')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no alerts', () => {
      mockUseRealtimeSubscription.mockReturnValue({
        data: [],
        loading: false,
        refresh: vi.fn(),
      });

      render(<SecurityPanel />);

      expect(screen.getByText('No security alerts found')).toBeInTheDocument();
    });
  });

  describe('Header Rendering', () => {
    it('should render page title', () => {
      render(<SecurityPanel />);

      expect(screen.getByText('Security Alerts')).toBeInTheDocument();
    });

    it('should render page description', () => {
      render(<SecurityPanel />);

      expect(screen.getByText('Monitor and respond to security events')).toBeInTheDocument();
    });
  });

  describe('Stats Cards', () => {
    it('should display total alerts count', () => {
      render(<SecurityPanel />);

      // With pending filter active by default, stats should reflect filtered view
      expect(screen.getByText('Total Alerts')).toBeInTheDocument();
    });

    it('should display pending alerts count', () => {
      render(<SecurityPanel />);

      // Find the pending stat card (in the yellow stats section)
      const pendingStatCard = document.querySelector('.bg-yellow-50');
      expect(pendingStatCard).toBeInTheDocument();
    });

    it('should display critical/high alerts count', () => {
      render(<SecurityPanel />);

      // Find the stat card (not the filter button)
      const statCards = document.querySelectorAll('.bg-red-50');
      expect(statCards.length).toBeGreaterThan(0);
    });

    it('should display resolved alerts count', () => {
      render(<SecurityPanel />);

      // Find the resolved stat card (in the green stats section)
      const resolvedStatCard = document.querySelector('.bg-green-50');
      expect(resolvedStatCard).toBeInTheDocument();
    });
  });

  describe('Filter Tabs', () => {
    it('should render all filter buttons', () => {
      render(<SecurityPanel />);

      expect(screen.getByRole('button', { name: /all alerts/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /pending only/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /critical\/high/i })).toBeInTheDocument();
    });

    it('should have pending filter active by default', () => {
      render(<SecurityPanel />);

      const pendingButton = screen.getByRole('button', { name: /pending only/i });
      expect(pendingButton).toHaveClass('bg-yellow-600');
    });

    it('should switch to all alerts filter when clicked', async () => {
      render(<SecurityPanel />);

      const allButton = screen.getByRole('button', { name: /all alerts/i });
      await userEvent.click(allButton);

      expect(allButton).toHaveClass('bg-blue-600');
    });

    it('should switch to critical filter when clicked', async () => {
      render(<SecurityPanel />);

      const criticalButton = screen.getByRole('button', { name: /critical\/high/i });
      await userEvent.click(criticalButton);

      expect(criticalButton).toHaveClass('bg-red-600');
    });
  });

  describe('Alert List Rendering', () => {
    it('should render alerts in the list', () => {
      mockUseRealtimeSubscription.mockReturnValue({
        data: mockAlerts,
        loading: false,
        refresh: vi.fn(),
      });

      render(<SecurityPanel />);

      // Switch to all filter to see all alerts
      fireEvent.click(screen.getByRole('button', { name: /all alerts/i }));

      expect(screen.getByText('Suspicious Login Attempt')).toBeInTheDocument();
    });

    it('should show alert message', async () => {
      render(<SecurityPanel />);

      // Switch to all alerts
      await userEvent.click(screen.getByRole('button', { name: /all alerts/i }));

      expect(screen.getByText('Multiple failed login attempts detected')).toBeInTheDocument();
    });

    it('should show severity badges', async () => {
      render(<SecurityPanel />);

      await userEvent.click(screen.getByRole('button', { name: /all alerts/i }));

      expect(screen.getByText('CRITICAL')).toBeInTheDocument();
      expect(screen.getByText('HIGH')).toBeInTheDocument();
      expect(screen.getByText('MEDIUM')).toBeInTheDocument();
      expect(screen.getByText('LOW')).toBeInTheDocument();
    });

    it('should show status badges', async () => {
      render(<SecurityPanel />);

      await userEvent.click(screen.getByRole('button', { name: /all alerts/i }));

      // Status badges
      expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
      expect(screen.getByText('Acknowledged')).toBeInTheDocument();
      expect(screen.getAllByText('Resolved').length).toBeGreaterThan(0);
    });
  });

  describe('Alert Filtering', () => {
    it('should filter to show only pending alerts by default', () => {
      render(<SecurityPanel />);

      // Should show pending alerts (alert-1 and alert-4)
      expect(screen.getByText('Suspicious Login Attempt')).toBeInTheDocument();
      expect(screen.getByText('Configuration Change')).toBeInTheDocument();

      // Should not show acknowledged/resolved alerts
      expect(screen.queryByText('Unauthorized Access Attempt')).not.toBeInTheDocument();
    });

    it('should show all alerts when all filter selected', async () => {
      render(<SecurityPanel />);

      await userEvent.click(screen.getByRole('button', { name: /all alerts/i }));

      expect(screen.getByText('Suspicious Login Attempt')).toBeInTheDocument();
      expect(screen.getByText('Unauthorized Access Attempt')).toBeInTheDocument();
      expect(screen.getByText('PHI Access Log')).toBeInTheDocument();
      expect(screen.getByText('Configuration Change')).toBeInTheDocument();
    });

    it('should show only critical/high alerts when filter selected', async () => {
      render(<SecurityPanel />);

      await userEvent.click(screen.getByRole('button', { name: /critical\/high/i }));

      expect(screen.getByText('Suspicious Login Attempt')).toBeInTheDocument();
      expect(screen.getByText('Unauthorized Access Attempt')).toBeInTheDocument();

      // Medium and low should be hidden
      expect(screen.queryByText('PHI Access Log')).not.toBeInTheDocument();
      expect(screen.queryByText('Configuration Change')).not.toBeInTheDocument();
    });
  });

  describe('Alert Selection', () => {
    it('should show select prompt when no alert selected', async () => {
      render(<SecurityPanel />);

      expect(screen.getByText('Select an alert to view details')).toBeInTheDocument();
    });

    it('should show alert details when alert clicked', async () => {
      render(<SecurityPanel />);

      // Click on an alert
      const alertCard = screen.getByText('Suspicious Login Attempt').closest('div[class*="cursor-pointer"]');
      fireEvent.click(alertCard!);

      // Should show details panel
      expect(screen.getByText('Alert Details')).toBeInTheDocument();
    });

    it('should highlight selected alert', async () => {
      render(<SecurityPanel />);

      const alertCard = screen.getByText('Suspicious Login Attempt').closest('div[class*="cursor-pointer"]');
      fireEvent.click(alertCard!);

      expect(alertCard).toHaveClass('border-blue-500');
    });

    it('should show metadata in details panel', async () => {
      render(<SecurityPanel />);

      const alertCard = screen.getByText('Suspicious Login Attempt').closest('div[class*="cursor-pointer"]');
      fireEvent.click(alertCard!);

      expect(screen.getByText('Additional Details')).toBeInTheDocument();
    });
  });

  describe('Alert Actions', () => {
    it('should show action buttons for pending alerts', async () => {
      render(<SecurityPanel />);

      const alertCard = screen.getByText('Suspicious Login Attempt').closest('div[class*="cursor-pointer"]');
      fireEvent.click(alertCard!);

      expect(screen.getByRole('button', { name: /acknowledge/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /resolve/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /ignore/i })).toBeInTheDocument();
    });

    it('should not show action buttons for non-pending alerts', async () => {
      render(<SecurityPanel />);

      // Switch to all alerts and select acknowledged alert
      await userEvent.click(screen.getByRole('button', { name: /all alerts/i }));

      const alertCard = screen.getByText('Unauthorized Access Attempt').closest('div[class*="cursor-pointer"]');
      fireEvent.click(alertCard!);

      // Action buttons should not appear for acknowledged alert
      expect(screen.queryByRole('button', { name: /acknowledge/i })).not.toBeInTheDocument();
    });
  });

  describe('Severity Colors', () => {
    it('should apply correct color for critical severity', async () => {
      render(<SecurityPanel />);

      const criticalBadge = screen.getByText('CRITICAL');
      expect(criticalBadge.className).toContain('bg-red');
    });

    it('should apply correct color for high severity', async () => {
      render(<SecurityPanel />);

      await userEvent.click(screen.getByRole('button', { name: /all alerts/i }));

      const highBadge = screen.getByText('HIGH');
      expect(highBadge.className).toContain('bg-orange');
    });

    it('should apply correct color for medium severity', async () => {
      render(<SecurityPanel />);

      await userEvent.click(screen.getByRole('button', { name: /all alerts/i }));

      const mediumBadge = screen.getByText('MEDIUM');
      expect(mediumBadge.className).toContain('bg-yellow');
    });

    it('should apply correct color for low severity', async () => {
      render(<SecurityPanel />);

      const lowBadge = screen.getByText('LOW');
      expect(lowBadge.className).toContain('bg-blue');
    });
  });

  describe('Status Badge Colors', () => {
    it('should apply yellow for pending status', () => {
      render(<SecurityPanel />);

      // Find a Pending badge (there are multiple)
      const pendingBadges = screen.getAllByText('Pending');
      const pendingBadge = pendingBadges.find(
        (el) => el.className.includes('bg-yellow')
      );
      expect(pendingBadge).toBeTruthy();
    });

    it('should apply blue for acknowledged status', async () => {
      render(<SecurityPanel />);

      await userEvent.click(screen.getByRole('button', { name: /all alerts/i }));

      const acknowledgedBadge = screen.getByText('Acknowledged');
      expect(acknowledgedBadge.className).toContain('bg-blue');
    });

    it('should apply green for resolved status', async () => {
      render(<SecurityPanel />);

      await userEvent.click(screen.getByRole('button', { name: /all alerts/i }));

      // Find Resolved badge (not the stat card)
      const resolvedBadges = screen.getAllByText('Resolved');
      const statusBadge = resolvedBadges.find(
        (el) => el.className.includes('bg-green') && el.className.includes('rounded-full')
      );
      expect(statusBadge).toBeTruthy();
    });
  });

  describe('Realtime Subscription', () => {
    it('should configure realtime subscription correctly', () => {
      render(<SecurityPanel />);

      expect(mockUseRealtimeSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          table: 'security_alerts',
          event: '*',
          schema: 'public',
          componentName: 'SecurityPanel',
        })
      );
    });
  });

  describe('Date Formatting', () => {
    it('should format alert creation date', async () => {
      render(<SecurityPanel />);

      const alertCard = screen.getByText('Suspicious Login Attempt').closest('div[class*="cursor-pointer"]');
      fireEvent.click(alertCard!);

      // Should show formatted date
      expect(screen.getByText(/created/i)).toBeInTheDocument();
    });
  });

  describe('Responsive Layout', () => {
    it('should render with grid layout', () => {
      render(<SecurityPanel />);

      const statsGrid = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-4');
      expect(statsGrid).toBeInTheDocument();
    });

    it('should render two-column layout for alerts and details', () => {
      render(<SecurityPanel />);

      const alertsGrid = document.querySelector('.grid.grid-cols-1.lg\\:grid-cols-2');
      expect(alertsGrid).toBeInTheDocument();
    });
  });

  describe('Alert Count Display', () => {
    it('should show alert count in header', async () => {
      render(<SecurityPanel />);

      // Default pending filter shows 2 pending alerts
      expect(screen.getByText(/alerts \(2\)/i)).toBeInTheDocument();
    });

    it('should update count when filter changes', async () => {
      render(<SecurityPanel />);

      await userEvent.click(screen.getByRole('button', { name: /all alerts/i }));

      // All 4 alerts
      expect(screen.getByText(/alerts \(4\)/i)).toBeInTheDocument();
    });
  });
});
