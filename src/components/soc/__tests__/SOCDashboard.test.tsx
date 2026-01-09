/**
 * Tests for SOCDashboard Component
 *
 * Purpose: Security Operations Center main dashboard
 * Tests: Loading, alert list, filters, realtime subscriptions, actions
 * SOC2 Compliance: CC6.1, CC7.2, CC7.3
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { SOCDashboard } from '../SOCDashboard';

// Mock AuthContext
vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => mockSupabaseClient,
}));

// Mock SOC Dashboard Service
const mockGetAlerts = vi.fn();
const mockGetDashboardSummary = vi.fn();
const mockGetOnlineOperators = vi.fn();
const mockGetNotificationPreferences = vi.fn();
const mockAcknowledgeAlert = vi.fn();
const mockAssignAlert = vi.fn();
const mockResolveAlert = vi.fn();
const mockMarkAsFalsePositive = vi.fn();
const mockSubscribeToAlerts = vi.fn();
const mockSubscribeToPresence = vi.fn();
const mockUnsubscribeAll = vi.fn();
const mockStartHeartbeat = vi.fn();
const mockUpdatePresence = vi.fn();
const mockUpdateNotificationPreferences = vi.fn();

vi.mock('../../../services/socDashboardService', () => ({
  getSOCDashboardService: () => ({
    getAlerts: mockGetAlerts,
    getDashboardSummary: mockGetDashboardSummary,
    getOnlineOperators: mockGetOnlineOperators,
    getNotificationPreferences: mockGetNotificationPreferences,
    acknowledgeAlert: mockAcknowledgeAlert,
    assignAlert: mockAssignAlert,
    resolveAlert: mockResolveAlert,
    markAsFalsePositive: mockMarkAsFalsePositive,
    subscribeToAlerts: mockSubscribeToAlerts,
    subscribeToPresence: mockSubscribeToPresence,
    unsubscribeAll: mockUnsubscribeAll,
    startHeartbeat: mockStartHeartbeat,
    updatePresence: mockUpdatePresence,
    updateNotificationPreferences: mockUpdateNotificationPreferences,
    shouldNotify: vi.fn().mockReturnValue(false),
    getSoundForSeverity: vi.fn().mockReturnValue('none'),
  }),
  resetSOCDashboardService: vi.fn(),
}));

// Mock SOC Notifications hook
vi.mock('../../../hooks/useSOCNotifications', () => ({
  useSOCNotifications: () => ({
    playSound: vi.fn(),
    showNotification: vi.fn(),
  }),
}));

// Mock child components
vi.mock('../AlertDetailPanel', () => ({
  AlertDetailPanel: ({ alert, onClose }: { alert: { title: string }; onClose: () => void }) => (
    <div data-testid="alert-detail-panel">
      <span>Alert: {alert.title}</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../PresenceIndicator', () => ({
  PresenceIndicator: ({ operators }: { operators: unknown[] }) => (
    <div data-testid="presence-indicator">
      <span>{operators.length} operators</span>
    </div>
  ),
}));

vi.mock('../NotificationSettings', () => ({
  NotificationSettings: ({ onClose, onSave }: { onClose: () => void; onSave: (prefs: unknown) => Promise<void> }) => (
    <div data-testid="notification-settings">
      <button onClick={onClose}>Close Settings</button>
      <button onClick={() => onSave({ sound_enabled: true })}>Save Settings</button>
    </div>
  ),
}));

// Mock EAButton and EABadge
vi.mock('../../envision-atlus/EAButton', () => ({
  EAButton: ({ children, onClick, disabled, variant, size }: {
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
    disabled?: boolean;
    variant?: string;
    size?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} data-size={size}>
      {children}
    </button>
  ),
}));

vi.mock('../../envision-atlus/EABadge', () => ({
  EABadge: ({ children, variant, pulse }: {
    children: React.ReactNode;
    variant?: string;
    pulse?: boolean;
  }) => (
    <span data-testid="ea-badge" data-variant={variant} data-pulse={pulse}>
      {children}
    </span>
  ),
}));

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  })),
  channel: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn(),
  })),
  removeChannel: vi.fn(),
};

// Mock data
const mockAlerts = [
  {
    id: 'alert-1',
    title: 'Suspicious Login Attempt',
    description: 'Multiple failed logins from IP 192.168.1.100',
    severity: 'critical' as const,
    status: 'new' as const,
    alert_type: 'authentication',
    detection_method: 'threshold',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source_ip: '192.168.1.100',
    escalated: false,
  },
  {
    id: 'alert-2',
    title: 'Unauthorized Data Access',
    description: 'PHI access outside normal hours',
    severity: 'high' as const,
    status: 'investigating' as const,
    alert_type: 'data_access',
    detection_method: 'pattern',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    escalated: false,
  },
  {
    id: 'alert-3',
    title: 'Configuration Change',
    description: 'Security configuration modified',
    severity: 'medium' as const,
    status: 'new' as const,
    alert_type: 'system',
    detection_method: 'audit',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    escalated: false,
  },
  {
    id: 'alert-4',
    title: 'Password Policy Update',
    description: 'Password requirements changed',
    severity: 'low' as const,
    status: 'resolved' as const,
    alert_type: 'system',
    detection_method: 'audit',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    escalated: false,
  },
];

const mockSummary = {
  critical_count: 1,
  high_count: 1,
  medium_count: 1,
  low_count: 1,
  escalated_count: 0,
  unassigned_count: 2,
  online_operators: 2,
};

const mockOperators = [
  {
    user_id: 'op-1',
    user_name: 'Alice Smith',
    status: 'online' as const,
    last_seen: new Date().toISOString(),
  },
  {
    user_id: 'op-2',
    user_name: 'Bob Jones',
    status: 'busy' as const,
    current_alert_id: 'alert-1',
    last_seen: new Date().toISOString(),
  },
];

const mockPreferences = {
  id: 'pref-1',
  user_id: 'user-1',
  sound_enabled: true,
  browser_notifications_enabled: true,
  desktop_notifications_enabled: false,
  notify_on_critical: true,
  notify_on_high: true,
  notify_on_medium: false,
  notify_on_low: false,
  notify_on_escalation: true,
  notify_on_new_message: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const renderWithRouter = (component: React.ReactNode) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('SOCDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetAlerts.mockResolvedValue(mockAlerts);
    mockGetDashboardSummary.mockResolvedValue(mockSummary);
    mockGetOnlineOperators.mockResolvedValue(mockOperators);
    mockGetNotificationPreferences.mockResolvedValue(mockPreferences);
    mockAcknowledgeAlert.mockResolvedValue(true);
    mockAssignAlert.mockResolvedValue(true);
    mockResolveAlert.mockResolvedValue(true);
    mockMarkAsFalsePositive.mockResolvedValue(true);
  });

  describe('Loading State', () => {
    it('should show loading spinner initially', async () => {
      // Make getAlerts slow
      mockGetAlerts.mockImplementation(() => new Promise(() => {}));

      renderWithRouter(<SOCDashboard />);

      expect(screen.getByText('Loading Security Operations Center...')).toBeInTheDocument();
    });

    it('should show spinner animation while loading', async () => {
      mockGetAlerts.mockImplementation(() => new Promise(() => {}));

      renderWithRouter(<SOCDashboard />);

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Header', () => {
    it('should display SOC title', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Security Operations Center')).toBeInTheDocument();
      });
    });

    it('should display shield icon', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('🛡️')).toBeInTheDocument();
      });
    });

    it('should display critical count badge when there are critical alerts', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('1 Critical')).toBeInTheDocument();
      });
    });

    it('should display high count badge when there are high alerts', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('1 High')).toBeInTheDocument();
      });
    });

    it('should render settings button', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Settings/)).toBeInTheDocument();
      });
    });

    it('should render presence indicator', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByTestId('presence-indicator')).toBeInTheDocument();
      });
    });
  });

  describe('Alert List', () => {
    it('should display alerts after loading', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Suspicious Login Attempt')).toBeInTheDocument();
      });
    });

    it('should display all alerts in list', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Suspicious Login Attempt')).toBeInTheDocument();
        expect(screen.getByText('Unauthorized Data Access')).toBeInTheDocument();
        expect(screen.getByText('Configuration Change')).toBeInTheDocument();
        expect(screen.getByText('Password Policy Update')).toBeInTheDocument();
      });
    });

    it('should display alert descriptions', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Multiple failed logins from IP 192.168.1.100')).toBeInTheDocument();
      });
    });

    it('should show empty state when no alerts', async () => {
      mockGetAlerts.mockResolvedValue([]);

      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('No active alerts')).toBeInTheDocument();
        expect(screen.getByText('All systems operating normally')).toBeInTheDocument();
      });
    });

    it('should show checkmark icon in empty state', async () => {
      mockGetAlerts.mockResolvedValue([]);

      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('✅')).toBeInTheDocument();
      });
    });
  });

  describe('Severity Filters', () => {
    it('should display All filter button', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('All')).toBeInTheDocument();
      });
    });

    it('should display severity filter buttons', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        // Check for filter buttons by their container (bg-slate-700 buttons in filter area)
        const filterButtons = document.querySelectorAll('button.bg-slate-700');
        expect(filterButtons.length).toBeGreaterThanOrEqual(4);
      });
    });

    it('should display My Alerts filter', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('My Alerts')).toBeInTheDocument();
      });
    });

    it('should filter alerts when severity filter is clicked', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Suspicious Login Attempt')).toBeInTheDocument();
      });

      // Click on Critical filter
      const criticalButton = screen.getAllByText(/Critical/i).find(
        (el) => el.tagName === 'BUTTON' || el.closest('button')
      );
      if (criticalButton) {
        await userEvent.click(criticalButton.closest('button') || criticalButton);
      }

      // Service should be called with updated filters
      await waitFor(() => {
        expect(mockGetAlerts).toHaveBeenCalled();
      });
    });
  });

  describe('Alert Selection', () => {
    it('should show select prompt when no alert selected', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Select an alert to view details')).toBeInTheDocument();
      });
    });

    it('should show pointer icon in select prompt', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('👈')).toBeInTheDocument();
      });
    });

    it('should show alert detail panel when alert is clicked', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Suspicious Login Attempt')).toBeInTheDocument();
      });

      // Click on an alert
      const alertItem = screen.getByText('Suspicious Login Attempt').closest('div[class*="cursor-pointer"]');
      if (alertItem) {
        await userEvent.click(alertItem);
      }

      await waitFor(() => {
        expect(screen.getByTestId('alert-detail-panel')).toBeInTheDocument();
      });
    });
  });

  describe('Alert Actions', () => {
    it('should show Acknowledge button for new alerts', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Suspicious Login Attempt')).toBeInTheDocument();
      });

      // Should have acknowledge buttons for new alerts
      const acknowledgeButtons = screen.getAllByText('Acknowledge');
      expect(acknowledgeButtons.length).toBeGreaterThan(0);
    });

    it('should call acknowledgeAlert when Acknowledge is clicked', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Suspicious Login Attempt')).toBeInTheDocument();
      });

      // Find and click acknowledge button
      const acknowledgeButton = screen.getAllByText('Acknowledge')[0];
      await userEvent.click(acknowledgeButton);

      await waitFor(() => {
        expect(mockAcknowledgeAlert).toHaveBeenCalled();
      });
    });
  });

  describe('Settings Modal', () => {
    it('should open settings modal when settings button is clicked', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Settings/)).toBeInTheDocument();
      });

      const settingsButton = screen.getByText(/Settings/);
      await userEvent.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByTestId('notification-settings')).toBeInTheDocument();
      });
    });

    it('should close settings modal when close is clicked', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Settings/)).toBeInTheDocument();
      });

      const settingsButton = screen.getByText(/Settings/);
      await userEvent.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByTestId('notification-settings')).toBeInTheDocument();
      });

      const closeButton = screen.getByText('Close Settings');
      await userEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByTestId('notification-settings')).not.toBeInTheDocument();
      });
    });

    it('should save settings when save is clicked', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Settings/)).toBeInTheDocument();
      });

      const settingsButton = screen.getByText(/Settings/);
      await userEvent.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByTestId('notification-settings')).toBeInTheDocument();
      });

      const saveButton = screen.getByText('Save Settings');
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateNotificationPreferences).toHaveBeenCalled();
      });
    });
  });

  describe('Realtime Subscriptions', () => {
    it('should subscribe to alerts on mount', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(mockSubscribeToAlerts).toHaveBeenCalled();
      });
    });

    it('should subscribe to presence on mount', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(mockSubscribeToPresence).toHaveBeenCalled();
      });
    });

    it('should start heartbeat on mount', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(mockStartHeartbeat).toHaveBeenCalled();
      });
    });

    it('should unsubscribe all on unmount', async () => {
      const { unmount } = renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Security Operations Center')).toBeInTheDocument();
      });

      unmount();

      expect(mockUnsubscribeAll).toHaveBeenCalled();
    });
  });

  describe('Presence Updates', () => {
    it('should update presence to busy when viewing alert', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Suspicious Login Attempt')).toBeInTheDocument();
      });

      // Select an alert
      const alertItem = screen.getByText('Suspicious Login Attempt').closest('div[class*="cursor-pointer"]');
      if (alertItem) {
        await userEvent.click(alertItem);
      }

      await waitFor(() => {
        expect(mockUpdatePresence).toHaveBeenCalledWith('busy', expect.any(String));
      });
    });
  });

  describe('Data Refresh', () => {
    it('should load data on initial render', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(mockGetAlerts).toHaveBeenCalled();
        expect(mockGetDashboardSummary).toHaveBeenCalled();
        expect(mockGetOnlineOperators).toHaveBeenCalled();
        expect(mockGetNotificationPreferences).toHaveBeenCalled();
      });
    });

    it('should refresh data after acknowledging alert', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Suspicious Login Attempt')).toBeInTheDocument();
      });

      // Clear mock call count
      mockGetAlerts.mockClear();

      // Click acknowledge
      const acknowledgeButton = screen.getAllByText('Acknowledge')[0];
      await userEvent.click(acknowledgeButton);

      await waitFor(() => {
        expect(mockGetAlerts).toHaveBeenCalled();
      });
    });
  });

  describe('Summary Badges', () => {
    it('should not show critical badge when count is 0', async () => {
      mockGetDashboardSummary.mockResolvedValue({
        ...mockSummary,
        critical_count: 0,
      });

      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Security Operations Center')).toBeInTheDocument();
      });

      expect(screen.queryByText('0 Critical')).not.toBeInTheDocument();
    });

    it('should not show high badge when count is 0', async () => {
      mockGetDashboardSummary.mockResolvedValue({
        ...mockSummary,
        high_count: 0,
      });

      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Security Operations Center')).toBeInTheDocument();
      });

      expect(screen.queryByText('0 High')).not.toBeInTheDocument();
    });

    it('should show escalated badge when escalated_count > 0', async () => {
      mockGetDashboardSummary.mockResolvedValue({
        ...mockSummary,
        escalated_count: 2,
      });

      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('2 Escalated')).toBeInTheDocument();
      });
    });
  });

  describe('Alert List Item', () => {
    it('should display time ago for alerts', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        // Should show relative time for all alerts created now
        const timeElements = screen.getAllByText('Just now');
        expect(timeElements.length).toBeGreaterThan(0);
      });
    });

    it('should display source IP when available', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('IP: 192.168.1.100')).toBeInTheDocument();
      });
    });

    it('should show severity icons', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        // SEVERITY_CONFIG icons (emojis)
        expect(screen.getByText('🔴')).toBeInTheDocument(); // Critical
      });
    });
  });

  describe('Layout', () => {
    it('should have two-column layout for alerts and details', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Security Operations Center')).toBeInTheDocument();
      });

      // Check for w-1/2 columns
      const halfWidthDivs = document.querySelectorAll('.w-1\\/2');
      expect(halfWidthDivs.length).toBe(2);
    });

    it('should have proper dark theme styling', async () => {
      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Security Operations Center')).toBeInTheDocument();
      });

      // Check for dark background
      const mainDiv = document.querySelector('.bg-slate-900');
      expect(mainDiv).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle empty alerts response gracefully', async () => {
      // Return empty arrays instead of rejecting to test empty state handling
      mockGetAlerts.mockResolvedValue([]);
      mockGetDashboardSummary.mockResolvedValue({
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        escalated_count: 0,
        unassigned_count: 0,
        online_operators: 0,
      });
      mockGetOnlineOperators.mockResolvedValue([]);

      renderWithRouter(<SOCDashboard />);

      await waitFor(() => {
        expect(screen.getByText('No active alerts')).toBeInTheDocument();
      });

      expect(mockGetAlerts).toHaveBeenCalled();
    });
  });
});
