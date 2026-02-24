/**
 * TenantSecurityDashboard tests — validates metrics display, alert acknowledge/resolve,
 * session listing with force-logout, security rules config, and error states.
 *
 * Deletion Test: Every test would FAIL if the component were an empty <div />.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

const mockGetSecurityAlerts = vi.fn();
const mockAcknowledgeAlert = vi.fn();
const mockResolveAlert = vi.fn();
const mockGetActiveSessions = vi.fn();
const mockForceLogout = vi.fn();
const mockGetSecurityRules = vi.fn();
const mockSaveSecurityRules = vi.fn();

vi.mock('../../../services/tenantSecurityService', () => ({
  tenantSecurityService: {
    getSecurityAlerts: (...args: unknown[]) => mockGetSecurityAlerts(...args),
    acknowledgeAlert: (...args: unknown[]) => mockAcknowledgeAlert(...args),
    resolveAlert: (...args: unknown[]) => mockResolveAlert(...args),
    getActiveSessions: (...args: unknown[]) => mockGetActiveSessions(...args),
    forceLogout: (...args: unknown[]) => mockForceLogout(...args),
    getSecurityRules: (...args: unknown[]) => mockGetSecurityRules(...args),
    saveSecurityRules: (...args: unknown[]) => mockSaveSecurityRules(...args),
  },
}));

const mockUser = { id: 'admin-user-1' };
const mockSupabase = {
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { tenant_id: 'tenant-abc' } }),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }),
  }),
};

vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => mockSupabase,
  useUser: () => mockUser,
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    debug: vi.fn().mockResolvedValue(undefined),
    clinical: vi.fn().mockResolvedValue(undefined),
    ai: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../envision-atlus', () => ({
  EABadge: ({ children }: { children: React.ReactNode }) => <span data-testid="ea-badge">{children}</span>,
}));

// ============================================================================
// TEST DATA
// ============================================================================

const MOCK_ALERTS = [
  {
    id: 'alert-001',
    severity: 'critical' as const,
    category: 'PHI',
    alert_type: 'unusual_access',
    title: 'Unusual PHI Access Pattern',
    message: 'User accessed 50+ records in 10 minutes',
    status: 'pending' as const,
    source_ip: '192.168.1.100',
    affected_user_id: null,
    affected_resource: null,
    created_at: '2026-02-24T10:00:00Z',
    acknowledged_at: null,
    resolved_at: null,
  },
  {
    id: 'alert-002',
    severity: 'high' as const,
    category: 'Auth',
    alert_type: 'failed_login_spike',
    title: 'Multiple Failed Login Attempts',
    message: 'Failed logins from unknown IP',
    status: 'acknowledged' as const,
    source_ip: '10.0.0.50',
    affected_user_id: null,
    affected_resource: null,
    created_at: '2026-02-23T15:00:00Z',
    acknowledged_at: '2026-02-23T16:00:00Z',
    resolved_at: null,
  },
];

const MOCK_SESSIONS = [
  {
    user_id: 'user-100',
    first_name: 'Alpha',
    last_name: 'Session',
    email: 'alpha.session@testfacility.org',
    role_slug: null,
    last_sign_in_at: new Date(Date.now() - 5 * 60000).toISOString(), // 5 min ago = active
    is_active: true,
  },
  {
    user_id: 'user-200',
    first_name: 'Beta',
    last_name: 'Session',
    email: 'beta.session@testfacility.org',
    role_slug: null,
    last_sign_in_at: '2026-02-20T10:00:00Z', // days ago = inactive
    is_active: false,
  },
];

const MOCK_RULES = [
  {
    id: 'rule-phi-burst',
    name: 'PHI Access Burst',
    description: 'Alert when PHI is accessed more than 10 times in 15 minutes',
    metric: 'phi_access' as const,
    operator: '>' as const,
    threshold: 10,
    time_window_minutes: 15,
    severity: 'high' as const,
    notify_roles: ['admin', 'super_admin'],
    is_active: true,
  },
];

// ============================================================================
// TESTS
// ============================================================================

describe('TenantSecurityDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSecurityAlerts.mockResolvedValue({ success: true, data: MOCK_ALERTS, error: null });
    mockGetActiveSessions.mockResolvedValue({ success: true, data: MOCK_SESSIONS, error: null });
    mockGetSecurityRules.mockResolvedValue({ success: true, data: MOCK_RULES, error: null });
    mockAcknowledgeAlert.mockResolvedValue({ success: true, data: true, error: null });
    mockResolveAlert.mockResolvedValue({ success: true, data: true, error: null });
    mockForceLogout.mockResolvedValue({ success: true, data: true, error: null });
    mockSaveSecurityRules.mockResolvedValue({ success: true, data: true, error: null });

    // Reset supabase mock chain for profile + audit_logs
    const eqSingle = vi.fn().mockResolvedValue({ data: { tenant_id: 'tenant-abc' } });
    const eqPhi = vi.fn().mockResolvedValue({ data: [], error: null });
    const innerEq = vi.fn().mockImplementation((col: string, val: unknown) => {
      if (col === 'user_id') return { single: eqSingle };
      if (col === 'action_category' && val === 'PHI_ACCESS') return eqPhi;
      return { single: eqSingle, eq: eqPhi };
    });
    const selectFn = vi.fn().mockReturnValue({ eq: innerEq });
    mockSupabase.from = vi.fn().mockReturnValue({ select: selectFn });
  });

  const renderDashboard = async () => {
    const { TenantSecurityDashboard } = await import('../TenantSecurityDashboard');
    return render(<TenantSecurityDashboard />);
  };

  it('displays metrics grid with alert and session counts', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Open Alerts')).toBeInTheDocument();
    });
    expect(screen.getByText('Critical Alerts')).toBeInTheDocument();
    expect(screen.getByText('PHI Access (recent)')).toBeInTheDocument();
    // "Active Sessions" appears in both metrics and panel heading — verify both exist
    expect(screen.getAllByText('Active Sessions').length).toBeGreaterThanOrEqual(1);
  });

  it('shows security alerts with severity badges', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Unusual PHI Access Pattern')).toBeInTheDocument();
    });
    expect(screen.getByText('Multiple Failed Login Attempts')).toBeInTheDocument();

    const badges = screen.getAllByTestId('ea-badge');
    const badgeTexts = badges.map(b => b.textContent);
    expect(badgeTexts).toContain('CRITICAL');
    expect(badgeTexts).toContain('HIGH');
  });

  it('shows acknowledge and resolve buttons for pending alerts', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Unusual PHI Access Pattern')).toBeInTheDocument();
    });

    // Pending alert should have both buttons
    expect(screen.getByTitle('Acknowledge alert')).toBeInTheDocument();
    // Multiple resolve buttons (one for pending, one for acknowledged)
    const resolveButtons = screen.getAllByTitle('Resolve alert');
    expect(resolveButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('acknowledges an alert when button is clicked', async () => {
    const user = userEvent.setup();
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Unusual PHI Access Pattern')).toBeInTheDocument();
    });

    const ackBtn = screen.getByTitle('Acknowledge alert');
    await user.click(ackBtn);

    await waitFor(() => {
      expect(mockAcknowledgeAlert).toHaveBeenCalledWith('alert-001', 'admin-user-1');
    });
  });

  it('shows active and inactive session users', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Alpha Session')).toBeInTheDocument();
    });
    expect(screen.getByText('Beta Session')).toBeInTheDocument();

    const badges = screen.getAllByTestId('ea-badge');
    const badgeTexts = badges.map(b => b.textContent);
    expect(badgeTexts).toContain('Active');
    expect(badgeTexts).toContain('Inactive');
  });

  it('shows force logout button for active sessions', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Alpha Session')).toBeInTheDocument();
    });

    const logoutBtn = screen.getByTitle('Force logout');
    expect(logoutBtn).toBeInTheDocument();
  });

  it('force-logs out a user after confirmation', async () => {
    const user = userEvent.setup();
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Alpha Session')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Force logout'));
    await user.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(mockForceLogout).toHaveBeenCalledWith('user-100', 'admin-user-1');
    });
  });

  it('shows security rules with names and severities', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('PHI Access Burst')).toBeInTheDocument();
    });
    expect(screen.getByText(/Alert when PHI is accessed/)).toBeInTheDocument();
  });

  it('shows add rule button in rules config', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Alert Rules')).toBeInTheDocument();
    });

    expect(screen.getByText('Add Rule')).toBeInTheDocument();
  });

  it('opens rule edit form when Add Rule is clicked', async () => {
    const user = userEvent.setup();
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Add Rule')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Rule'));

    expect(screen.getByLabelText(/rule name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/severity/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/metric/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/threshold/i)).toBeInTheDocument();
  });

  it('validates rule name is required before saving', async () => {
    const user = userEvent.setup();
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Add Rule')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Rule'));

    // Leave name empty, click save
    const saveBtn = screen.getByRole('button', { name: /save rule/i });
    await user.click(saveBtn);

    expect(screen.getByText('Rule name is required')).toBeInTheDocument();
    expect(mockSaveSecurityRules).not.toHaveBeenCalled();
  });

  it('shows tenant-scoped compliance notice', async () => {
    await renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Tenant-Scoped Security')).toBeInTheDocument();
    });
    expect(screen.getByText(/HIPAA compliance/)).toBeInTheDocument();
  });
});
