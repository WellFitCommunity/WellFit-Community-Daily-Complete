/**
 * Tests for SecurityPanel Component
 *
 * Purpose: Security Alert Dashboard for monitoring and responding to security events
 * Tests: Loading state, empty state, alert rendering, filtering, actions
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

// Mock security alerts data — statuses match the LIVE security_alerts CHECK enum
// (new/investigating/resolved/false_positive/escalated); `message` mirrors the
// aliased `description` column.
const mockAlerts = [
  {
    id: 'alert-1',
    severity: 'critical' as const,
    category: 'Authentication',
    title: 'Suspicious Login Attempt',
    message: 'Multiple failed login attempts detected',
    created_at: '2024-01-15T10:00:00Z',
    last_occurrence_at: '2024-02-01T10:00:00Z',
    occurrence_count: 12287,
    status: 'new' as const,
    metadata: { ip: '192.168.1.1' },
  },
  {
    id: 'alert-2',
    severity: 'high' as const,
    category: 'Access Control',
    title: 'Unauthorized Access Attempt',
    message: 'User attempted to access restricted resource',
    created_at: '2024-01-15T09:00:00Z',
    status: 'investigating' as const,
    assigned_at: '2024-01-15T09:30:00Z',
    assigned_to: 'admin-123',
  },
  {
    id: 'alert-3',
    severity: 'medium' as const,
    category: 'Data Access',
    title: 'PHI Access Log',
    message: 'Bulk PHI access detected',
    created_at: '2024-01-15T08:00:00Z',
    status: 'resolved' as const,
    resolution_time: '2024-01-15T08:30:00Z',
  },
  {
    id: 'alert-4',
    severity: 'low' as const,
    category: 'System',
    title: 'Configuration Change',
    message: 'Security configuration updated',
    created_at: '2024-01-14T12:00:00Z',
    status: 'escalated' as const,
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
    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate });
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
      expect(screen.getByRole('button', { name: /open only/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /critical\/high/i })).toBeInTheDocument();
    });

    it('should have open filter active by default', () => {
      render(<SecurityPanel />);

      const openButton = screen.getByRole('button', { name: /open only/i });
      expect(openButton).toHaveClass('bg-yellow-600');
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

      // Status badges (live enum)
      expect(screen.getAllByText('New').length).toBeGreaterThan(0);
      expect(screen.getByText('Investigating')).toBeInTheDocument();
      expect(screen.getByText('Escalated')).toBeInTheDocument();
      expect(screen.getAllByText('Resolved').length).toBeGreaterThan(0);
    });
  });

  describe('Alert Filtering', () => {
    it('should filter to show only open alerts by default', () => {
      render(<SecurityPanel />);

      // Should show open alerts (new, investigating, escalated)
      expect(screen.getByText('Suspicious Login Attempt')).toBeInTheDocument();
      expect(screen.getByText('Unauthorized Access Attempt')).toBeInTheDocument();
      expect(screen.getByText('Configuration Change')).toBeInTheDocument();

      // Should not show resolved alerts
      expect(screen.queryByText('PHI Access Log')).not.toBeInTheDocument();
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
      if (alertCard) fireEvent.click(alertCard);

      // Should show details panel
      expect(screen.getByText('Alert Details')).toBeInTheDocument();
    });

    it('should highlight selected alert', async () => {
      render(<SecurityPanel />);

      const alertCard = screen.getByText('Suspicious Login Attempt').closest('div[class*="cursor-pointer"]');
      if (alertCard) fireEvent.click(alertCard);

      expect(alertCard).toHaveClass('border-blue-500');
    });

    it('should show metadata in details panel', async () => {
      render(<SecurityPanel />);

      const alertCard = screen.getByText('Suspicious Login Attempt').closest('div[class*="cursor-pointer"]');
      if (alertCard) fireEvent.click(alertCard);

      expect(screen.getByText('Additional Details')).toBeInTheDocument();
    });
  });

  describe('Alert Actions', () => {
    it('should show action buttons for pending alerts', async () => {
      render(<SecurityPanel />);

      const alertCard = screen.getByText('Suspicious Login Attempt').closest('div[class*="cursor-pointer"]');
      if (alertCard) fireEvent.click(alertCard);

      expect(screen.getByRole('button', { name: /acknowledge/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /resolve/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /ignore/i })).toBeInTheDocument();
    });

    it('should not show action buttons for closed alerts', async () => {
      render(<SecurityPanel />);

      // Switch to all alerts and select the resolved alert
      await userEvent.click(screen.getByRole('button', { name: /all alerts/i }));

      const alertCard = screen.getByText('PHI Access Log').closest('div[class*="cursor-pointer"]');
      if (alertCard) fireEvent.click(alertCard);

      // Action buttons should not appear for a resolved alert
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
    it('should apply yellow for new status', () => {
      render(<SecurityPanel />);

      const newBadges = screen.getAllByText('New');
      const newBadge = newBadges.find(
        (el) => el.className.includes('bg-yellow')
      );
      expect(newBadge).toBeTruthy();
    });

    it('should apply blue for investigating status', async () => {
      render(<SecurityPanel />);

      await userEvent.click(screen.getByRole('button', { name: /all alerts/i }));

      const investigatingBadge = screen.getByText('Investigating');
      expect(investigatingBadge.className).toContain('bg-blue');
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
      if (alertCard) fireEvent.click(alertCard);

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

      // Default open filter shows 3 open alerts (new, investigating, escalated)
      expect(screen.getByText(/alerts \(3\)/i)).toBeInTheDocument();
    });

    it('should update count when filter changes', async () => {
      render(<SecurityPanel />);

      await userEvent.click(screen.getByRole('button', { name: /all alerts/i }));

      // All 4 alerts
      expect(screen.getByText(/alerts \(4\)/i)).toBeInTheDocument();
    });
  });

  describe('Occurrence Display (dedup-aware freshness)', () => {
    it('should show last-seen time and occurrence count for recurring alerts', () => {
      render(<SecurityPanel />);

      // alert-1 has occurrence_count 12287 and a last_occurrence_at newer than created_at
      expect(screen.getByText(/12287 occurrences/)).toBeInTheDocument();
      expect(screen.getAllByText(/last seen/i).length).toBeGreaterThan(0);
    });
  });

  describe('Status Updates (live schema columns)', () => {
    it('should write resolved status with resolution_time when Resolve clicked', async () => {
      render(<SecurityPanel />);

      const alertCard = screen.getByText('Suspicious Login Attempt').closest('div[class*="cursor-pointer"]');
      if (alertCard) fireEvent.click(alertCard);

      await userEvent.click(screen.getByRole('button', { name: /resolve/i }));

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'resolved', resolution_time: expect.any(String) })
      );
      expect(mockEq).toHaveBeenCalledWith('id', 'alert-1');
    });

    it('should write investigating status with assignment when Acknowledge clicked', async () => {
      render(<SecurityPanel />);

      const alertCard = screen.getByText('Suspicious Login Attempt').closest('div[class*="cursor-pointer"]');
      if (alertCard) fireEvent.click(alertCard);

      await userEvent.click(screen.getByRole('button', { name: /acknowledge/i }));

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'investigating', assigned_to: 'test-user-id' })
      );
    });

    it('should write false_positive status when Ignore clicked', async () => {
      render(<SecurityPanel />);

      const alertCard = screen.getByText('Suspicious Login Attempt').closest('div[class*="cursor-pointer"]');
      if (alertCard) fireEvent.click(alertCard);

      await userEvent.click(screen.getByRole('button', { name: /ignore/i }));

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'false_positive' })
      );
    });
  });
});
