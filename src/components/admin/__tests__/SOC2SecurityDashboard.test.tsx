/**
 * SOC2SecurityDashboard Tests
 *
 * Tests loading state, error state, all 8 metric cards, critical alert banner,
 * recent security events table with severity/status badges, refresh button,
 * and empty event list.
 *
 * Deletion Test: Every test would FAIL if the component rendered an empty <div />.
 * Synthetic test data only: obviously fake names, IDs, and IPs.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SecurityMetrics, SecurityEvent } from '../../../services/soc2MonitoringService';

// ============================================================================
// MOCKS
// ============================================================================

const mockGetSecurityMetrics = vi.fn();
const mockGetSecurityEvents = vi.fn();

vi.mock('../../../services/soc2MonitoringService', () => ({
  createSOC2MonitoringService: () => ({
    getSecurityMetrics: (...args: unknown[]) => mockGetSecurityMetrics(...args),
    getSecurityEvents: (...args: unknown[]) => mockGetSecurityEvents(...args),
  }),
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({}),
}));

vi.mock('../../../BrandingContext', () => ({
  useBranding: () => ({
    branding: { primaryColor: '#0000ff', appName: 'Test SOC2' },
  }),
}));

// ============================================================================
// SYNTHETIC TEST DATA
// ============================================================================

const MOCK_METRICS: SecurityMetrics = {
  security_events_24h: 142,
  critical_events_24h: 3,
  high_events_24h: 12,
  medium_events_24h: 47,
  low_events_24h: 80,
  failed_logins_24h: 28,
  failed_logins_1h: 4,
  unauthorized_access_24h: 7,
  auto_blocked_24h: 15,
  open_investigations: 2,
  audit_events_24h: 500,
  failed_operations_24h: 9,
  phi_access_24h: 89,
  last_updated: '2026-01-15T10:00:00Z',
};

const MOCK_METRICS_NO_CRITICAL: SecurityMetrics = {
  ...MOCK_METRICS,
  critical_events_24h: 0,
};

function makeMockEvent(overrides: Partial<SecurityEvent> = {}): SecurityEvent {
  return {
    id: 'evt-test-001',
    event_type: 'brute_force_attempt',
    severity: 'HIGH',
    actor_user_id: 'user-test-alpha',
    actor_ip_address: '10.0.0.99',
    actor_user_agent: 'TestAgent/1.0',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(), // 5 min ago
    description: 'Test brute force attempt from synthetic IP',
    metadata: {},
    auto_blocked: false,
    requires_investigation: false,
    investigated: false,
    investigated_by: null,
    investigated_at: null,
    resolution: null,
    related_audit_log_id: null,
    correlation_id: null,
    alert_sent: false,
    alert_sent_at: null,
    alert_recipients: null,
    ...overrides,
  };
}

const MOCK_EVENTS: SecurityEvent[] = [
  makeMockEvent({
    id: 'evt-test-001',
    event_type: 'brute_force_attempt',
    severity: 'CRITICAL',
    actor_ip_address: '10.0.0.99',
    description: 'Repeated failed login from synthetic source',
    auto_blocked: true,
  }),
  makeMockEvent({
    id: 'evt-test-002',
    event_type: 'unauthorized_phi_access',
    severity: 'HIGH',
    actor_ip_address: '192.168.0.50',
    description: 'PHI access without valid role',
    requires_investigation: true,
    investigated: false,
  }),
  makeMockEvent({
    id: 'evt-test-003',
    event_type: 'session_hijack_detected',
    severity: 'MEDIUM',
    actor_ip_address: null,
    description: 'Session token reuse from different IP',
    investigated: true,
    resolution: 'False positive confirmed',
  }),
  makeMockEvent({
    id: 'evt-test-004',
    event_type: 'rate_limit_exceeded',
    severity: 'LOW',
    actor_ip_address: '172.16.0.1',
    description: 'API rate limit exceeded for test endpoint',
  }),
];

// ============================================================================
// HELPERS
// ============================================================================

function setupSuccessMocks(
  metricsOverride?: SecurityMetrics,
  eventsOverride?: SecurityEvent[]
) {
  mockGetSecurityMetrics.mockResolvedValue(metricsOverride ?? MOCK_METRICS);
  mockGetSecurityEvents.mockResolvedValue(eventsOverride ?? MOCK_EVENTS);
}

async function renderDashboard() {
  const mod = await import('../SOC2SecurityDashboard');
  const Component = mod.SOC2SecurityDashboard;
  return render(<Component />);
}

// ============================================================================
// TESTS
// ============================================================================

describe('SOC2SecurityDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    setupSuccessMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. Loading state
  // --------------------------------------------------------------------------
  it('shows loading skeleton with animate-pulse while data loads', async () => {
    mockGetSecurityMetrics.mockImplementation(() => new Promise(() => {}));
    mockGetSecurityEvents.mockImplementation(() => new Promise(() => {}));

    const { container } = await renderDashboard();

    const pulsingEl = container.querySelector('.animate-pulse');
    expect(pulsingEl).toBeInTheDocument();
    // Loading skeleton has placeholder blocks
    const placeholders = container.querySelectorAll('.bg-gray-200');
    expect(placeholders.length).toBeGreaterThanOrEqual(4);
  });

  // --------------------------------------------------------------------------
  // 2. Error state
  // --------------------------------------------------------------------------
  it('displays error alert when data loading fails', async () => {
    mockGetSecurityMetrics.mockRejectedValue(new Error('Network timeout'));
    mockGetSecurityEvents.mockRejectedValue(new Error('Network timeout'));

    await renderDashboard();

    await waitFor(() => {
      expect(
        screen.getByText('Failed to load security monitoring data')
      ).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 3. All 8 metric cards with correct values
  // --------------------------------------------------------------------------
  it('renders all 8 metric cards with correct values from service data', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Critical Events')).toBeInTheDocument();
    });

    // Card titles
    expect(screen.getByText('High Severity')).toBeInTheDocument();
    expect(screen.getByText('Failed Logins')).toBeInTheDocument();
    expect(screen.getByText('Open Investigations')).toBeInTheDocument();
    expect(screen.getByText('Total Security Events')).toBeInTheDocument();
    expect(screen.getByText('Unauthorized Access')).toBeInTheDocument();
    expect(screen.getByText('Auto-Blocked')).toBeInTheDocument();
    expect(screen.getByText('PHI Access')).toBeInTheDocument();

    // Card values — each metric value rendered as bold text
    expect(screen.getByText('3')).toBeInTheDocument();    // critical_events_24h
    expect(screen.getByText('12')).toBeInTheDocument();   // high_events_24h
    expect(screen.getByText('28')).toBeInTheDocument();   // failed_logins_24h
    expect(screen.getByText('2')).toBeInTheDocument();    // open_investigations
    expect(screen.getByText('142')).toBeInTheDocument();  // security_events_24h
    expect(screen.getByText('7')).toBeInTheDocument();    // unauthorized_access_24h
    expect(screen.getByText('15')).toBeInTheDocument();   // auto_blocked_24h
    expect(screen.getByText('89')).toBeInTheDocument();   // phi_access_24h
  });

  // --------------------------------------------------------------------------
  // 4. Critical events card has red border highlight when > 0
  // --------------------------------------------------------------------------
  it('highlights Critical Events card with red border when critical_events_24h > 0', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Critical Events')).toBeInTheDocument();
    });

    // The Critical Events card title is inside a CardHeader inside a Card
    const criticalTitle = screen.getByText('Critical Events');
    // Walk up to the Card element (the one with border class)
    const cardHeader = criticalTitle.closest('[class*="flex flex-col"]');
    const card = cardHeader?.parentElement;
    expect(card).toBeTruthy();
    expect(card?.className).toContain('border-red-500');
    expect(card?.className).toContain('border-2');
  });

  // --------------------------------------------------------------------------
  // 5. Recent Security Events table with event rows
  // --------------------------------------------------------------------------
  it('renders Recent Security Events table with all event rows', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Recent Security Events')).toBeInTheDocument();
    });

    // Table column headers
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('Severity')).toBeInTheDocument();
    expect(screen.getByText('Event Type')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByText('IP Address')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();

    // All 4 event descriptions present
    expect(screen.getByText('Repeated failed login from synthetic source')).toBeInTheDocument();
    expect(screen.getByText('PHI access without valid role')).toBeInTheDocument();
    expect(screen.getByText('Session token reuse from different IP')).toBeInTheDocument();
    expect(screen.getByText('API rate limit exceeded for test endpoint')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 6. Severity badges (CRITICAL, HIGH, MEDIUM, LOW)
  // --------------------------------------------------------------------------
  it('shows correct severity badges for each event row', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Recent Security Events')).toBeInTheDocument();
    });

    // Each severity text appears as a badge in the table
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('MEDIUM')).toBeInTheDocument();
    expect(screen.getByText('LOW')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 7. Event type formatting (underscores replaced with spaces)
  // --------------------------------------------------------------------------
  it('formats event types by replacing underscores with spaces', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('brute force attempt')).toBeInTheDocument();
    });

    expect(screen.getByText('unauthorized phi access')).toBeInTheDocument();
    expect(screen.getByText('session hijack detected')).toBeInTheDocument();
    expect(screen.getByText('rate limit exceeded')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 8. BLOCKED status badge for auto_blocked events
  // --------------------------------------------------------------------------
  it('shows BLOCKED badge for auto-blocked events', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('BLOCKED')).toBeInTheDocument();
    });

    const blockedBadge = screen.getByText('BLOCKED');
    expect(blockedBadge.className).toContain('bg-red-100');
    expect(blockedBadge.className).toContain('text-red-800');
  });

  // --------------------------------------------------------------------------
  // 9. RESOLVED status badge for investigated events
  // --------------------------------------------------------------------------
  it('shows RESOLVED badge for investigated events', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('RESOLVED')).toBeInTheDocument();
    });

    const resolvedBadge = screen.getByText('RESOLVED');
    expect(resolvedBadge.className).toContain('bg-green-100');
    expect(resolvedBadge.className).toContain('text-green-800');
  });

  // --------------------------------------------------------------------------
  // 10. INVESTIGATING status badge for requires_investigation && !investigated
  // --------------------------------------------------------------------------
  it('shows INVESTIGATING badge for events requiring investigation that are not yet investigated', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('INVESTIGATING')).toBeInTheDocument();
    });

    const investigatingBadge = screen.getByText('INVESTIGATING');
    expect(investigatingBadge.className).toContain('bg-yellow-100');
    expect(investigatingBadge.className).toContain('text-yellow-800');
  });

  // --------------------------------------------------------------------------
  // 11. IP address display (value or "N/A")
  // --------------------------------------------------------------------------
  it('displays IP addresses for events and N/A when IP is null', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('10.0.0.99')).toBeInTheDocument();
    });

    expect(screen.getByText('192.168.0.50')).toBeInTheDocument();
    expect(screen.getByText('172.16.0.1')).toBeInTheDocument();
    // evt-test-003 has null IP
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 12. Empty events shows "No security events recorded"
  // --------------------------------------------------------------------------
  it('shows empty state message when there are no security events', async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetSecurityMetrics.mockResolvedValue(MOCK_METRICS);
    mockGetSecurityEvents.mockResolvedValue([]);

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('No security events recorded')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // 13. Critical alert banner when critical_events_24h > 0
  // --------------------------------------------------------------------------
  it('shows critical alert banner when critical_events_24h is greater than 0', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Critical Alert:/)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/3 critical security event\(s\) detected/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Immediate investigation required/)
    ).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 14. No critical alert banner when critical_events_24h === 0
  // --------------------------------------------------------------------------
  it('does not show critical alert banner when critical_events_24h is 0', async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetSecurityMetrics.mockResolvedValue(MOCK_METRICS_NO_CRITICAL);
    mockGetSecurityEvents.mockResolvedValue(MOCK_EVENTS);

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Critical Events')).toBeInTheDocument();
    });

    // The critical count should show 0
    const criticalTitle = screen.getByText('Critical Events');
    const cardHeader = criticalTitle.closest('[class*="flex flex-col"]');
    const cardContent = cardHeader?.parentElement;
    expect(cardContent).toBeTruthy();
    if (cardContent) {
      expect(within(cardContent).getByText('0')).toBeInTheDocument();
    }

    // No critical alert banner
    expect(screen.queryByText(/Critical Alert:/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Immediate investigation required/)
    ).not.toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 15. Refresh button triggers data reload
  // --------------------------------------------------------------------------
  it('reloads data when Refresh button is clicked', async () => {
    const user = userEvent.setup();
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    const initialMetricsCalls = mockGetSecurityMetrics.mock.calls.length;
    const initialEventsCalls = mockGetSecurityEvents.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(mockGetSecurityMetrics.mock.calls.length).toBeGreaterThan(initialMetricsCalls);
      expect(mockGetSecurityEvents.mock.calls.length).toBeGreaterThan(initialEventsCalls);
    });
  });

  // --------------------------------------------------------------------------
  // 16. Header shows "Security Operations Center"
  // --------------------------------------------------------------------------
  it('displays "Security Operations Center" heading and last updated time', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(
        screen.getByText('Security Operations Center')
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/Real-time security monitoring/)).toBeInTheDocument();
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 17. Failed logins card shows hourly breakdown
  // --------------------------------------------------------------------------
  it('shows failed logins card with hourly breakdown in subtitle', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Failed Logins')).toBeInTheDocument();
    });

    // The card shows failed_logins_1h in last hour text
    expect(screen.getByText('4 in last hour')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // 18. Metric card subtitles display correct context
  // --------------------------------------------------------------------------
  it('shows correct subtitle context for each metric card', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Critical Events')).toBeInTheDocument();
    });

    // Various subtitle texts
    expect(screen.getByText('Requires attention')).toBeInTheDocument();
    expect(screen.getByText('Access control violations')).toBeInTheDocument();
    expect(screen.getByText('Threats prevented')).toBeInTheDocument();
    expect(screen.getByText('Protected data accessed')).toBeInTheDocument();
    // "Last 24 hours" appears on multiple cards
    expect(screen.getAllByText('Last 24 hours').length).toBeGreaterThanOrEqual(3);
  });

  // --------------------------------------------------------------------------
  // 19. Critical Events card has no red border when count is 0
  // --------------------------------------------------------------------------
  it('does not highlight Critical Events card when critical_events_24h is 0', async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetSecurityMetrics.mockResolvedValue(MOCK_METRICS_NO_CRITICAL);
    mockGetSecurityEvents.mockResolvedValue(MOCK_EVENTS);

    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Critical Events')).toBeInTheDocument();
    });

    const criticalTitle = screen.getByText('Critical Events');
    const cardHeader = criticalTitle.closest('[class*="flex flex-col"]');
    const card = cardHeader?.parentElement;
    expect(card).toBeTruthy();
    // When critical_events_24h === 0, the Card gets className '' (empty)
    expect(card?.className).not.toContain('border-red-500');
  });

  // --------------------------------------------------------------------------
  // 20. Error state still shows after loading completes
  // --------------------------------------------------------------------------
  it('shows error alert alongside the header when loading fails but loading state clears', async () => {
    mockGetSecurityMetrics.mockRejectedValue(new Error('Service unavailable'));
    mockGetSecurityEvents.mockRejectedValue(new Error('Service unavailable'));

    await renderDashboard();

    await waitFor(() => {
      expect(
        screen.getByText('Failed to load security monitoring data')
      ).toBeInTheDocument();
    });

    // Header should still render (error state is not a loading state)
    expect(screen.getByText('Security Operations Center')).toBeInTheDocument();
    // Refresh button should be available to retry
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });
});
