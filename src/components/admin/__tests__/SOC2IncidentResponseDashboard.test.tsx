/**
 * SOC2IncidentResponseDashboard Tests
 *
 * Tests incident queue display, summary cards, SLA breach alerts,
 * severity/status filters, investigation modal, and resolve workflow.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

/* --- Mocks --- */

const mockGetIncidentResponseQueue = vi.fn();
const mockMarkEventInvestigated = vi.fn();
const mockShowToast = vi.fn();

vi.mock('../../../services/soc2MonitoringService', () => ({
  createSOC2MonitoringService: () => ({
    getIncidentResponseQueue: (...args: unknown[]) => mockGetIncidentResponseQueue(...args),
    markEventInvestigated: (...args: unknown[]) => mockMarkEventInvestigated(...args),
  }),
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({}),
}));

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({
    showToast: mockShowToast,
    ToastContainer: () => null,
  }),
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../BrandingContext', () => ({
  useBranding: () => ({
    branding: { primaryColor: '#000000', logoUrl: '' },
  }),
}));

/* --- Synthetic test data (obviously fake, no realistic PHI) --- */

const mockCriticalOpenIncident = {
  id: 'incident-aaa-111',
  event_type: 'brute_force_login',
  severity: 'CRITICAL' as const,
  timestamp: '2026-01-15T10:30:00Z',
  actor_user_id: 'user-test-alpha',
  actor_ip_address: '10.0.0.99',
  description: 'Synthetic brute force attempt from test network',
  metadata: { attempts: 50, source: 'test-region' },
  requires_investigation: true,
  investigated: false,
  investigated_by: null,
  investigated_at: null,
  resolution: null,
  auto_blocked: true,
  alert_sent: true,
  correlation_id: 'corr-test-001',
  hours_since_event: 2,
  priority_score: 95,
  sla_status: 'SLA_BREACH' as const,
};

const mockHighOpenIncident = {
  id: 'incident-bbb-222',
  event_type: 'unauthorized_phi_access',
  severity: 'HIGH' as const,
  timestamp: '2026-01-15T11:00:00Z',
  actor_user_id: 'user-test-beta',
  actor_ip_address: '10.0.0.100',
  description: 'Synthetic unauthorized PHI access attempt',
  metadata: {},
  requires_investigation: true,
  investigated: false,
  investigated_by: null,
  investigated_at: null,
  resolution: null,
  auto_blocked: false,
  alert_sent: true,
  correlation_id: 'corr-test-002',
  hours_since_event: 0.5,
  priority_score: 80,
  sla_status: 'WITHIN_SLA' as const,
};

const mockMediumResolvedIncident = {
  id: 'incident-ccc-333',
  event_type: 'failed_login_burst',
  severity: 'MEDIUM' as const,
  timestamp: '2026-01-14T08:00:00Z',
  actor_user_id: 'user-test-gamma',
  actor_ip_address: '10.0.0.101',
  description: 'Synthetic failed login burst from test IP',
  metadata: { region: 'test-zone' },
  requires_investigation: false,
  investigated: true,
  investigated_by: 'investigator-test-001',
  investigated_at: '2026-01-14T10:00:00Z',
  resolution: 'Test resolution: confirmed false positive from load testing',
  auto_blocked: false,
  alert_sent: false,
  correlation_id: null,
  hours_since_event: 48,
  priority_score: 40,
  sla_status: 'RESOLVED' as const,
};

const mockLowOpenIncident = {
  id: 'incident-ddd-444',
  event_type: 'password_change_anomaly',
  severity: 'LOW' as const,
  timestamp: '2026-01-15T12:00:00Z',
  actor_user_id: null,
  actor_ip_address: null,
  description: 'Synthetic password change anomaly detection',
  metadata: {},
  requires_investigation: true,
  investigated: false,
  investigated_by: null,
  investigated_at: null,
  resolution: null,
  auto_blocked: false,
  alert_sent: false,
  correlation_id: null,
  hours_since_event: 12,
  priority_score: 20,
  sla_status: 'WITHIN_SLA' as const,
};

const allIncidents = [
  mockCriticalOpenIncident,
  mockHighOpenIncident,
  mockMediumResolvedIncident,
  mockLowOpenIncident,
];

/* --- Helpers --- */

const waitForLoaded = () =>
  waitFor(() => {
    expect(screen.getByText('Incident Response Center')).toBeInTheDocument();
  });

const openModalForFirstInvestigate = async () => {
  const buttons = screen.getAllByText('Investigate');
  fireEvent.click(buttons[0]);
  await waitFor(() => {
    expect(screen.getByText('Incident Details')).toBeInTheDocument();
  });
};

/* --- Test suite --- */

describe('SOC2IncidentResponseDashboard', () => {
  let SOC2IncidentResponseDashboard: React.FC;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    mockGetIncidentResponseQueue.mockResolvedValue(allIncidents);
    const mod = await import('../SOC2IncidentResponseDashboard');
    SOC2IncidentResponseDashboard = mod.SOC2IncidentResponseDashboard;
  });

  // 1. Loading skeleton
  it('shows loading skeleton while fetching incidents', () => {
    mockGetIncidentResponseQueue.mockImplementation(() => new Promise(() => {}));
    const { container } = render(<SOC2IncidentResponseDashboard />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  // 2. Error state
  it('displays error alert when incident queue fails to load', async () => {
    mockGetIncidentResponseQueue.mockRejectedValue(new Error('Connection timeout'));
    render(<SOC2IncidentResponseDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Failed to load incident response queue')).toBeInTheDocument();
    });
  });

  // 3. Summary cards — Critical Open count
  it('displays correct Critical Open count in summary card', async () => {
    render(<SOC2IncidentResponseDashboard />);
    await waitForLoaded();
    const criticalLabel = screen.getByText('Critical Open').closest('div');
    const criticalCard = criticalLabel?.parentElement;
    expect(criticalCard).toHaveTextContent('1');
    expect(criticalCard).toHaveTextContent('1 hour SLA');
  });

  // 4. Summary cards — High Priority Open count
  it('displays correct High Priority Open count in summary card', async () => {
    render(<SOC2IncidentResponseDashboard />);
    await waitForLoaded();
    const highLabel = screen.getByText('High Priority Open').closest('div');
    const highCard = highLabel?.parentElement;
    expect(highCard).toHaveTextContent('1');
    expect(highCard).toHaveTextContent('4 hour SLA');
  });

  // 5. Summary cards — SLA Breaches count
  it('displays correct SLA Breaches count in summary card', async () => {
    render(<SOC2IncidentResponseDashboard />);
    await waitForLoaded();
    const slaLabel = screen.getByText('SLA Breaches').closest('div');
    const slaCard = slaLabel?.parentElement;
    expect(slaCard).toHaveTextContent('1');
    expect(slaCard).toHaveTextContent('Overdue incidents');
  });

  // 6. Summary cards — Total Open count
  it('displays correct Total Open count in summary card', async () => {
    render(<SOC2IncidentResponseDashboard />);
    await waitForLoaded();
    // 3 open (critical, high, low are not investigated)
    const totalLabel = screen.getByText('Total Open').closest('div');
    const totalCard = totalLabel?.parentElement;
    expect(totalCard).toHaveTextContent('3');
    expect(totalCard).toHaveTextContent('Requires investigation');
  });

  // 7. SLA Breach Alert banner when breaches exist
  it('shows SLA Breach Alert banner when SLA breaches exist', async () => {
    render(<SOC2IncidentResponseDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/SLA Breach Alert:/)).toBeInTheDocument();
    });
    expect(screen.getByText(/1 incident\(s\) have exceeded response time SLA/)).toBeInTheDocument();
  });

  // 8. No SLA Breach Alert when no breaches
  it('does not show SLA Breach Alert when no breaches exist', async () => {
    mockGetIncidentResponseQueue.mockResolvedValue([mockHighOpenIncident]);
    render(<SOC2IncidentResponseDashboard />);
    await waitForLoaded();
    expect(screen.queryByText(/SLA Breach Alert/)).not.toBeInTheDocument();
  });

  // 9. Event types with underscores replaced by spaces
  it('displays event types with underscores replaced by spaces in table', async () => {
    render(<SOC2IncidentResponseDashboard />);
    await waitFor(() => {
      expect(screen.getByText('brute force login')).toBeInTheDocument();
    });
    expect(screen.getByText('unauthorized phi access')).toBeInTheDocument();
  });

  // 10. Severity badges
  it('renders severity badges with correct text for each incident', async () => {
    render(<SOC2IncidentResponseDashboard />);
    await waitForLoaded();
    // Default filter is OPEN, so CRITICAL, HIGH, LOW are visible
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('LOW')).toBeInTheDocument();
  });

  // 11. SLA status badges
  it('renders SLA status badges with underscores replaced by spaces', async () => {
    render(<SOC2IncidentResponseDashboard />);
    await waitFor(() => {
      expect(screen.getByText('SLA BREACH')).toBeInTheDocument();
    });
    expect(screen.getAllByText('WITHIN SLA').length).toBeGreaterThanOrEqual(1);
  });

  // 12. AUTO-BLOCKED tag
  it('shows AUTO-BLOCKED tag on auto-blocked incidents', async () => {
    render(<SOC2IncidentResponseDashboard />);
    await waitFor(() => {
      expect(screen.getByText('AUTO-BLOCKED')).toBeInTheDocument();
    });
  });

  // 13. Investigate button for open incidents
  it('shows Investigate button for open (uninvestigated) incidents', async () => {
    render(<SOC2IncidentResponseDashboard />);
    await waitForLoaded();
    expect(screen.getAllByText('Investigate')).toHaveLength(3);
  });

  // 14. View button for resolved incidents
  it('shows View button for resolved incidents', async () => {
    render(<SOC2IncidentResponseDashboard />);
    await waitForLoaded();
    const statusSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(statusSelect, { target: { value: 'ALL' } });
    await waitFor(() => {
      expect(screen.getByText('View')).toBeInTheDocument();
    });
  });

  // 15. Empty state
  it('shows empty state when no incidents match filters', async () => {
    render(<SOC2IncidentResponseDashboard />);
    await waitForLoaded();
    const statusSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(statusSelect, { target: { value: 'RESOLVED' } });
    const severitySelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(severitySelect, { target: { value: 'CRITICAL' } });
    await waitFor(() => {
      expect(screen.getByText('No incidents matching filters')).toBeInTheDocument();
    });
  });

  // 16. Severity filter changes displayed incidents
  it('filters incidents by severity when dropdown changes', async () => {
    render(<SOC2IncidentResponseDashboard />);
    await waitForLoaded();
    const severitySelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(severitySelect, { target: { value: 'CRITICAL' } });
    await waitFor(() => {
      expect(screen.getByText('brute force login')).toBeInTheDocument();
    });
    expect(screen.queryByText('unauthorized phi access')).not.toBeInTheDocument();
    expect(screen.queryByText('password change anomaly')).not.toBeInTheDocument();
  });

  // 17. Status filter defaults to OPEN
  it('defaults status filter to OPEN, hiding resolved incidents', async () => {
    render(<SOC2IncidentResponseDashboard />);
    await waitForLoaded();
    expect(screen.queryByText('failed login burst')).not.toBeInTheDocument();
    expect(screen.getByText('brute force login')).toBeInTheDocument();
  });

  // 18. "Showing X of Y incidents" count
  it('displays correct "Showing X of Y incidents" count', async () => {
    render(<SOC2IncidentResponseDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Showing 3 of 4 incidents')).toBeInTheDocument();
    });
  });

  // 19. Clicking Investigate opens modal
  it('opens incident detail modal when Investigate button is clicked', async () => {
    render(<SOC2IncidentResponseDashboard />);
    await waitForLoaded();
    await openModalForFirstInvestigate();
    // Assertion already in helper — modal title visible
  });

  // 20. Modal shows severity, description, source IP, event type
  it('displays severity, description, source IP, and event type in modal', async () => {
    render(<SOC2IncidentResponseDashboard />);
    await waitForLoaded();
    await openModalForFirstInvestigate();
    // Severity badge in modal + table
    expect(screen.getAllByText('CRITICAL').length).toBeGreaterThanOrEqual(2);
    // Description in table + modal
    expect(
      screen.getAllByText('Synthetic brute force attempt from test network').length
    ).toBeGreaterThanOrEqual(2);
    // Source IP (only in modal)
    expect(screen.getByText('10.0.0.99')).toBeInTheDocument();
    // Event type in table + modal
    expect(screen.getAllByText('brute force login').length).toBeGreaterThanOrEqual(2);
  });

  // 21. Modal resolution textarea and "Mark as Resolved" button
  it('shows resolution textarea and Mark as Resolved button for open incidents', async () => {
    render(<SOC2IncidentResponseDashboard />);
    await waitForLoaded();
    await openModalForFirstInvestigate();
    expect(
      screen.getByPlaceholderText('Describe the investigation findings and resolution...')
    ).toBeInTheDocument();
    expect(screen.getByText('Mark as Resolved')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  // 22. Resolved incident modal shows investigator and resolution
  it('shows investigator and resolution text for resolved incidents', async () => {
    render(<SOC2IncidentResponseDashboard />);
    await waitForLoaded();
    const statusSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(statusSelect, { target: { value: 'ALL' } });
    await waitFor(() => {
      expect(screen.getByText('View')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('View'));
    await waitFor(() => {
      expect(screen.getByText('Incident Details')).toBeInTheDocument();
    });
    expect(screen.getByText(/Investigated by:/)).toBeInTheDocument();
    expect(screen.getByText(/investigator-test-001/)).toBeInTheDocument();
    expect(
      screen.getByText(/Test resolution: confirmed false positive from load testing/)
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText('Describe the investigation findings and resolution...')
    ).not.toBeInTheDocument();
  });

  // 23. Cancel button closes modal
  it('closes modal when Cancel button is clicked', async () => {
    render(<SOC2IncidentResponseDashboard />);
    await waitForLoaded();
    await openModalForFirstInvestigate();
    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => {
      expect(screen.queryByText('Incident Details')).not.toBeInTheDocument();
    });
  });

  // 24. Mark as Resolved calls service and shows success toast
  it('calls markEventInvestigated and shows success toast on resolve', async () => {
    mockMarkEventInvestigated.mockResolvedValue(true);
    render(<SOC2IncidentResponseDashboard />);
    await waitForLoaded();
    await openModalForFirstInvestigate();
    const textarea = screen.getByPlaceholderText(
      'Describe the investigation findings and resolution...'
    );
    fireEvent.change(textarea, {
      target: { value: 'Test resolution: confirmed test environment anomaly' },
    });
    fireEvent.click(screen.getByText('Mark as Resolved'));
    await waitFor(() => {
      expect(mockMarkEventInvestigated).toHaveBeenCalledWith(
        'incident-aaa-111',
        'Test resolution: confirmed test environment anomaly'
      );
    });
    expect(mockShowToast).toHaveBeenCalledWith('success', 'Incident marked as resolved');
  });

  // 25. Additional metadata shown in modal
  it('displays additional metadata JSON in modal when metadata is present', async () => {
    render(<SOC2IncidentResponseDashboard />);
    await waitForLoaded();
    await openModalForFirstInvestigate();
    expect(screen.getByText('Additional Details')).toBeInTheDocument();
    expect(screen.getByText(/"attempts": 50/)).toBeInTheDocument();
    expect(screen.getByText(/"source": "test-region"/)).toBeInTheDocument();
  });

  // 26. Source IP shows N/A when null
  it('shows N/A for source IP when actor_ip_address is null', async () => {
    render(<SOC2IncidentResponseDashboard />);
    await waitForLoaded();
    // Click Investigate on the LOW severity incident (3rd open incident)
    const investigateButtons = screen.getAllByText('Investigate');
    fireEvent.click(investigateButtons[2]);
    await waitFor(() => {
      expect(screen.getByText('Incident Details')).toBeInTheDocument();
    });
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  // 27. Mark as Resolved disabled when textarea is empty
  it('disables Mark as Resolved button when resolution textarea is empty', async () => {
    render(<SOC2IncidentResponseDashboard />);
    await waitForLoaded();
    await openModalForFirstInvestigate();
    expect(screen.getByText('Mark as Resolved')).toBeDisabled();
  });
});
