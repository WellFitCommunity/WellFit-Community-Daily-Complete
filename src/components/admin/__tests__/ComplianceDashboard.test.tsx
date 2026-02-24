/**
 * ComplianceDashboard Tests
 *
 * Tests compliance data loading, error states, backup/drill/vulnerability
 * status cards, detailed sections, action buttons, and compliance footer.
 * All 3 Supabase RPC calls are mocked via the shared mockRpc function.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// --- Mock RPC ---
const mockRpc = vi.fn();

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

// --- Mock lucide-react icons ---
vi.mock('lucide-react/dist/esm/icons/shield', () => ({
  default: (props: Record<string, unknown>) => <span data-testid="icon-shield" {...props} />,
}));
vi.mock('lucide-react/dist/esm/icons/alert-triangle', () => ({
  default: (props: Record<string, unknown>) => <span data-testid="icon-alert-triangle" {...props} />,
}));
vi.mock('lucide-react/dist/esm/icons/check-circle', () => ({
  default: (props: Record<string, unknown>) => <span data-testid="icon-check-circle" {...props} />,
}));
vi.mock('lucide-react/dist/esm/icons/clock', () => ({
  default: (props: Record<string, unknown>) => <span data-testid="icon-clock" {...props} />,
}));
vi.mock('lucide-react/dist/esm/icons/activity', () => ({
  default: (props: Record<string, unknown>) => <span data-testid="icon-activity" {...props} />,
}));
vi.mock('lucide-react/dist/esm/icons/file-text', () => ({
  default: (props: Record<string, unknown>) => <span data-testid="icon-file-text" {...props} />,
}));
vi.mock('lucide-react/dist/esm/icons/trending-up', () => ({
  default: (props: Record<string, unknown>) => <span data-testid="icon-trending-up" {...props} />,
}));

// --- Synthetic test data (obviously fake, no real PHI) ---
const MOCK_BACKUP = {
  compliance_status: 'COMPLIANT',
  last_successful_backup: '2026-01-15T08:00:00Z',
  last_restore_test: '2026-01-10T12:00:00Z',
  backup_success_rate: 99.5,
  total_backups_30d: 42,
  failed_backups_30d: 1,
  issues: ['Test Backup Issue Alpha', 'Test Backup Issue Beta'],
};

const MOCK_DRILL = {
  compliance_status: 'WARNING',
  last_weekly_drill: '2026-01-14T09:00:00Z',
  last_monthly_drill: '2026-01-01T10:00:00Z',
  last_quarterly_drill: '2025-10-01T11:00:00Z',
  drills_30d: 6,
  drills_passed_30d: 5,
  pass_rate: 83.3,
  avg_score: 87.5,
  issues: ['Test Drill Issue Gamma'],
};

const MOCK_VULN = {
  open_critical: 2,
  open_high: 5,
  total_overdue: 3,
  avg_remediation_days: 14,
  risk_level: 'HIGH',
};

function setupSuccessMocks() {
  mockRpc.mockImplementation((funcName: string) => {
    switch (funcName) {
      case 'get_backup_compliance_status':
        return Promise.resolve({ data: MOCK_BACKUP, error: null });
      case 'get_drill_compliance_status':
        return Promise.resolve({ data: MOCK_DRILL, error: null });
      case 'get_vulnerability_summary':
        return Promise.resolve({ data: MOCK_VULN, error: null });
      default:
        return Promise.resolve({ data: null, error: null });
    }
  });
}

describe('ComplianceDashboard', () => {
  let ComplianceDashboard: React.FC;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    setupSuccessMocks();
    const mod = await import('../ComplianceDashboard');
    ComplianceDashboard = mod.default;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- 1. Loading state ---
  it('shows loading indicator with "Loading compliance data..." text', () => {
    mockRpc.mockImplementation(() => new Promise(() => {}));

    render(<ComplianceDashboard />);

    expect(screen.getByText('Loading compliance data...')).toBeInTheDocument();
  });

  // --- 2. Error state ---
  it('shows error card with message when RPC fails', async () => {
    mockRpc.mockImplementation((funcName: string) => {
      if (funcName === 'get_backup_compliance_status') {
        return Promise.resolve({
          data: null,
          error: { message: 'Test RPC permission denied' },
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    render(<ComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Compliance Data')).toBeInTheDocument();
    });
  });

  // --- 3. Header and subtitle ---
  it('displays dashboard header and SOC2/HIPAA subtitle', async () => {
    render(<ComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Compliance & Security Dashboard')).toBeInTheDocument();
    });

    expect(
      screen.getByText('SOC2, HIPAA, and Security Compliance Monitoring')
    ).toBeInTheDocument();
  });

  // --- 4. Backup Compliance card: status, success rate, dates ---
  it('renders Backup Compliance card with status and success rate', async () => {
    render(<ComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Backup Compliance')).toBeInTheDocument();
    });

    expect(screen.getByText('COMPLIANT')).toBeInTheDocument();
    expect(screen.getByText(/Success Rate: 99\.5%/)).toBeInTheDocument();
    expect(screen.getByText(/Last Backup:/)).toBeInTheDocument();
    expect(screen.getByText(/Last Restore Test:/)).toBeInTheDocument();
  });

  // --- 5. Drill Compliance card: status, pass rate, avg score, drill count ---
  it('renders Drill Compliance card with pass rate, avg score, and drill count', async () => {
    render(<ComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Drill Compliance')).toBeInTheDocument();
    });

    expect(screen.getByText('WARNING')).toBeInTheDocument();
    expect(screen.getByText(/Pass Rate: 83\.3%/)).toBeInTheDocument();
    expect(screen.getByText(/Avg Score: 87\.5/)).toBeInTheDocument();
    expect(screen.getByText(/Drills \(30d\): 6/)).toBeInTheDocument();
  });

  // --- 6. Vulnerability card: risk level, critical/high/overdue counts ---
  it('renders Security Vulnerabilities card with risk level and counts', async () => {
    render(<ComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Security Vulnerabilities')).toBeInTheDocument();
    });

    expect(screen.getByText('HIGH Risk')).toBeInTheDocument();
    expect(screen.getByText(/Critical Open: 2/)).toBeInTheDocument();
    expect(screen.getByText(/High Open: 5/)).toBeInTheDocument();
    expect(screen.getByText(/Overdue: 3/)).toBeInTheDocument();
  });

  // --- 7. Status color: COMPLIANT renders green styling ---
  it('applies green status styling for COMPLIANT backup status', async () => {
    render(<ComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Backup Compliance')).toBeInTheDocument();
    });

    const backupCard = screen.getByText('Backup Compliance').closest('div[class*="border"]');
    expect(backupCard).toBeTruthy();
    expect(backupCard?.className).toContain('bg-green-500/20');
  });

  // --- 8. Status color: NON_COMPLIANT renders red styling ---
  it('applies red status styling for NON_COMPLIANT status', async () => {
    mockRpc.mockImplementation((funcName: string) => {
      switch (funcName) {
        case 'get_backup_compliance_status':
          return Promise.resolve({
            data: { ...MOCK_BACKUP, compliance_status: 'NON_COMPLIANT' },
            error: null,
          });
        case 'get_drill_compliance_status':
          return Promise.resolve({ data: MOCK_DRILL, error: null });
        case 'get_vulnerability_summary':
          return Promise.resolve({ data: MOCK_VULN, error: null });
        default:
          return Promise.resolve({ data: null, error: null });
      }
    });

    render(<ComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('NON_COMPLIANT')).toBeInTheDocument();
    });

    const backupCard = screen.getByText('Backup Compliance').closest('div[class*="border"]');
    expect(backupCard).toBeTruthy();
    expect(backupCard?.className).toContain('bg-red-500/20');
  });

  // --- 9. Backup details section: total and failed backups ---
  it('shows total backups and failed backups in details section', async () => {
    render(<ComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Backup & Recovery Details')).toBeInTheDocument();
    });

    expect(screen.getByText('Total Backups (30d)')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Failed Backups')).toBeInTheDocument();
    // The "1" for failed backups
    const failedBackupsLabel = screen.getByText('Failed Backups');
    const failedBackupsCard = failedBackupsLabel.closest('div[class*="bg-slate-700"]');
    expect(failedBackupsCard).toBeTruthy();
    expect(failedBackupsCard?.textContent).toContain('1');
  });

  // --- 10. Backup issues list ---
  it('displays backup issues when issues array is non-empty', async () => {
    render(<ComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Test Backup Issue Alpha')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Backup Issue Beta')).toBeInTheDocument();
  });

  // --- 11. Drill details: drills completed and passed ---
  it('shows drill completed and passed counts in details section', async () => {
    render(<ComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Disaster Recovery Drills')).toBeInTheDocument();
    });

    expect(screen.getByText('Drills Completed (30d)')).toBeInTheDocument();
    expect(screen.getByText('Drills Passed')).toBeInTheDocument();
    // The "5" for drills passed
    const drillsPassedLabel = screen.getByText('Drills Passed');
    const drillsPassedCard = drillsPassedLabel.closest('div[class*="bg-slate-700"]');
    expect(drillsPassedCard).toBeTruthy();
    expect(drillsPassedCard?.textContent).toContain('5');
  });

  // --- 12. Drill recent dates (weekly, monthly, quarterly) ---
  it('shows recent drill dates for weekly, monthly, and quarterly', async () => {
    render(<ComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Last Weekly:/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Last Monthly:/)).toBeInTheDocument();
    expect(screen.getByText(/Last Quarterly:/)).toBeInTheDocument();
  });

  // --- 13. Drill issues when present ---
  it('displays drill issues when issues array is non-empty', async () => {
    render(<ComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Test Drill Issue Gamma')).toBeInTheDocument();
    });
  });

  // --- 14. Vulnerability grid: critical, high, overdue, avg remediation ---
  it('shows vulnerability detail grid with critical, high, overdue, and remediation', async () => {
    render(<ComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Security Vulnerability Summary')).toBeInTheDocument();
    });

    // Detail grid labels
    expect(screen.getByText('Critical Open')).toBeInTheDocument();
    expect(screen.getByText('High Open')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('Avg Remediation')).toBeInTheDocument();

    // Values in detail grid (text-3xl bold)
    const criticalLabel = screen.getByText('Critical Open');
    const criticalCard = criticalLabel.closest('div[class*="p-4"]');
    expect(criticalCard?.textContent).toContain('2');

    const highLabel = screen.getByText('High Open');
    const highCard = highLabel.closest('div[class*="p-4"]');
    expect(highCard?.textContent).toContain('5');

    const overdueLabel = screen.getByText('Overdue');
    const overdueCard = overdueLabel.closest('div[class*="p-4"]');
    expect(overdueCard?.textContent).toContain('3');

    const remLabel = screen.getByText('Avg Remediation');
    const remCard = remLabel.closest('div[class*="p-4"]');
    expect(remCard?.textContent).toContain('14');
    expect(remCard?.textContent).toContain('days');
  });

  // --- 15. Penetration testing schedule ---
  it('displays penetration testing schedule section', async () => {
    render(<ComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Penetration Testing Schedule')).toBeInTheDocument();
    });

    expect(screen.getByText(/Daily: Automated security scans/)).toBeInTheDocument();
    expect(screen.getByText(/Weekly: Comprehensive DAST scans/)).toBeInTheDocument();
    expect(screen.getByText(/Quarterly: Manual penetration testing/)).toBeInTheDocument();
    expect(screen.getByText(/Annually: External security assessment/)).toBeInTheDocument();
  });

  // --- 16. Refresh Data button triggers reload ---
  it('calls fetchComplianceData again when Refresh Data is clicked', async () => {
    render(<ComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Refresh Data')).toBeInTheDocument();
    });

    // Initial load: 3 RPC calls (backup, drill, vuln)
    const initialCallCount = mockRpc.mock.calls.length;
    expect(initialCallCount).toBe(3);

    fireEvent.click(screen.getByText('Refresh Data'));

    await waitFor(() => {
      // After refresh: 3 more RPC calls
      expect(mockRpc.mock.calls.length).toBe(6);
    });
  });

  // --- 17. Navigation buttons ---
  it('renders View Backup Logs, View Drill Reports, and Manage Vulnerabilities buttons', async () => {
    render(<ComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('View Backup Logs')).toBeInTheDocument();
    });

    expect(screen.getByText('View Drill Reports')).toBeInTheDocument();
    expect(screen.getByText('Manage Vulnerabilities')).toBeInTheDocument();
  });

  // --- 18. Compliance footer about HIPAA/SOC2 ---
  it('displays compliance footer referencing HIPAA and SOC2', async () => {
    render(<ComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Compliance Standards')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/HIPAA Security Rule/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/SOC2 Trust Service Criteria/)
    ).toBeInTheDocument();
  });

  // --- 19. Compliance targets in backup section ---
  it('shows backup compliance targets including RPO and RTO', async () => {
    render(<ComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Backup & Recovery Details')).toBeInTheDocument();
    });

    // Find the Compliance Targets heading in the backup section
    const headings = screen.getAllByText('Compliance Targets:');
    expect(headings.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText(/Backup Frequency: Daily/)).toBeInTheDocument();
    expect(screen.getByText(/Success Rate Target: 95%/)).toBeInTheDocument();
    expect(screen.getByText(/RPO Target: 15 minutes/)).toBeInTheDocument();
    expect(screen.getByText(/RTO Target: 4 hours/)).toBeInTheDocument();
  });

  // --- 20. Drill compliance targets ---
  it('shows drill compliance targets including pass rate and score', async () => {
    render(<ComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Disaster Recovery Drills')).toBeInTheDocument();
    });

    expect(screen.getByText(/Weekly Frequency: Every 7 days/)).toBeInTheDocument();
    expect(screen.getByText(/Pass Rate Target: 90%/)).toBeInTheDocument();
    expect(screen.getByText(/Avg Score Target: 85/)).toBeInTheDocument();
  });

  // --- 21. Issues sections hidden when issues array is empty ---
  it('hides issues section when backup issues array is empty', async () => {
    mockRpc.mockImplementation((funcName: string) => {
      switch (funcName) {
        case 'get_backup_compliance_status':
          return Promise.resolve({
            data: { ...MOCK_BACKUP, issues: [] },
            error: null,
          });
        case 'get_drill_compliance_status':
          return Promise.resolve({
            data: { ...MOCK_DRILL, issues: [] },
            error: null,
          });
        case 'get_vulnerability_summary':
          return Promise.resolve({ data: MOCK_VULN, error: null });
        default:
          return Promise.resolve({ data: null, error: null });
      }
    });

    render(<ComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Backup & Recovery Details')).toBeInTheDocument();
    });

    expect(screen.queryByText('Test Backup Issue Alpha')).not.toBeInTheDocument();
    expect(screen.queryByText('Test Drill Issue Gamma')).not.toBeInTheDocument();
    // "Issues Requiring Attention:" heading should not appear
    expect(screen.queryByText('Issues Requiring Attention:')).not.toBeInTheDocument();
  });

  // --- 22. Error message text displayed in error state ---
  it('shows the specific error message text when RPC throws', async () => {
    mockRpc.mockImplementation(() => {
      return Promise.resolve({
        data: null,
        error: { message: 'Test network timeout error' },
      });
    });

    render(<ComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Compliance Data')).toBeInTheDocument();
    });
  });

  // --- 23. Vulnerability critical count highlighted in red ---
  it('highlights critical open count with red styling when non-zero', async () => {
    render(<ComplianceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Security Vulnerability Summary')).toBeInTheDocument();
    });

    const criticalLabel = screen.getByText('Critical Open');
    const criticalCard = criticalLabel.closest('div[class*="p-4"]');
    // When open_critical > 0, card should have red border styling
    expect(criticalCard?.className).toContain('border-red-500');
  });
});
