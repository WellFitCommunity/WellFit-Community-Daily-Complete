/**
 * DisasterRecoveryDashboard Tests
 *
 * Tests loading state, title, compliance banner, backup verification section,
 * drill section, compliance targets, action buttons, history toggles,
 * error state, warning status, issues list, and refresh button.
 *
 * Deletion Test: Every test would FAIL if the component rendered an empty <div />.
 * Synthetic test data only: obviously fake drill/backup IDs and scenarios.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock EA design system components
vi.mock('../../envision-atlus', () => ({
  EACard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="ea-card" className={className}>{children}</div>
  ),
  EACardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="ea-card-header" className={className}>{children}</div>
  ),
  EACardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="ea-card-content" className={className}>{children}</div>
  ),
  EAButton: ({ children, onClick, disabled, variant }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: string }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant}>{children}</button>
  ),
  EAAlert: ({ children, onDismiss, dismissible, variant }: { children: React.ReactNode; onDismiss?: () => void; dismissible?: boolean; variant?: string }) => (
    <div role="alert" data-variant={variant}>
      {children}
      {dismissible && onDismiss && <button onClick={onDismiss} aria-label="Dismiss">x</button>}
    </div>
  ),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Shield: ({ className }: { className?: string }) => <span data-testid="shield-icon" className={className}>Shield</span>,
  Database: ({ className }: { className?: string }) => <span data-testid="database-icon" className={className}>Database</span>,
  AlertTriangle: ({ className }: { className?: string }) => <span data-testid="alert-triangle-icon" className={className}>AlertTriangle</span>,
  CheckCircle: ({ className }: { className?: string }) => <span data-testid="check-circle-icon" className={className}>CheckCircle</span>,
  XCircle: ({ className }: { className?: string }) => <span data-testid="x-circle-icon" className={className}>XCircle</span>,
  RefreshCw: ({ className }: { className?: string }) => <span data-testid="refresh-icon" className={className}>RefreshCw</span>,
  Calendar: ({ className }: { className?: string }) => <span data-testid="calendar-icon" className={className}>Calendar</span>,
  Play: ({ className }: { className?: string }) => <span data-testid="play-icon" className={className}>Play</span>,
  FileText: ({ className }: { className?: string }) => <span data-testid="file-text-icon" className={className}>FileText</span>,
  TrendingUp: ({ className }: { className?: string }) => <span data-testid="trending-up-icon" className={className}>TrendingUp</span>,
  AlertOctagon: ({ className }: { className?: string }) => <span data-testid="alert-octagon-icon" className={className}>AlertOctagon</span>,
  ChevronDown: ({ className }: { className?: string }) => <span data-testid="chevron-down-icon" className={className}>ChevronDown</span>,
  ChevronUp: ({ className }: { className?: string }) => <span data-testid="chevron-up-icon" className={className}>ChevronUp</span>,
  Target: ({ className }: { className?: string }) => <span data-testid="target-icon" className={className}>Target</span>,
}));

// ============================================================================
// SUPABASE MOCK — chainable
// ============================================================================

interface BackupComplianceData {
  compliance_status: string;
  last_successful_backup: string | null;
  last_restore_test: string | null;
  backup_success_rate: number;
  total_backups_30d: number;
  failed_backups_30d: number;
  issues: string[];
  targets: {
    backup_frequency: string;
    restore_test_frequency: string;
    success_rate_target: string;
    rpo_target: string;
    rto_target: string;
  };
}

interface DrillComplianceData {
  compliance_status: string;
  last_weekly_drill: string | null;
  last_monthly_drill: string | null;
  last_quarterly_drill: string | null;
  drills_30d: number;
  drills_passed_30d: number;
  pass_rate: number;
  avg_score: number | null;
  issues: string[];
  targets: {
    weekly_frequency: string;
    monthly_frequency: string;
    quarterly_frequency: string;
    pass_rate_target: string;
    avg_score_target: string;
  };
}

interface DrillRecord {
  id: string;
  drill_name: string;
  drill_type: string;
  drill_scenario: string;
  scheduled_start: string;
  actual_start: string | null;
  actual_end: string | null;
  status: string;
  drill_passed: boolean | null;
  overall_score: number | null;
  rto_met: boolean | null;
  rpo_met: boolean | null;
}

interface BackupRecord {
  id: string;
  backup_type: string;
  backup_timestamp: string;
  verification_status: string;
  restore_tested: boolean;
  restore_status: string | null;
  data_integrity_check_passed: boolean | null;
}

let mockRpcResults: Record<string, { data: unknown; error: unknown }> = {};
let mockFromResults: Record<string, { data: unknown; error: unknown }> = {};

const mockSupabaseRpc = vi.fn((name: string) => {
  const result = mockRpcResults[name] ?? { data: null, error: null };
  return Promise.resolve(result);
});

const mockSupabaseFrom = vi.fn((table: string) => {
  const result = mockFromResults[table] ?? { data: [], error: null };
  return {
    select: vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
});

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockSupabaseRpc(args[0] as string, ...args.slice(1)),
    from: (...args: unknown[]) => mockSupabaseFrom(args[0] as string),
  },
}));

// ============================================================================
// SYNTHETIC TEST DATA
// ============================================================================

const makeBackupCompliance = (overrides: Partial<BackupComplianceData> = {}): BackupComplianceData => ({
  compliance_status: 'COMPLIANT',
  last_successful_backup: '2026-02-25T06:00:00Z',
  last_restore_test: '2026-02-20T10:00:00Z',
  backup_success_rate: 98.5,
  total_backups_30d: 60,
  failed_backups_30d: 1,
  issues: [],
  targets: {
    backup_frequency: 'Every 12 hours',
    restore_test_frequency: 'Weekly',
    success_rate_target: '95%',
    rpo_target: '15 minutes',
    rto_target: '4 hours',
  },
  ...overrides,
});

const makeDrillCompliance = (overrides: Partial<DrillComplianceData> = {}): DrillComplianceData => ({
  compliance_status: 'COMPLIANT',
  last_weekly_drill: '2026-02-24T10:00:00Z',
  last_monthly_drill: '2026-02-01T10:00:00Z',
  last_quarterly_drill: '2026-01-15T10:00:00Z',
  drills_30d: 12,
  drills_passed_30d: 11,
  pass_rate: 95.0,
  avg_score: 88.5,
  issues: [],
  targets: {
    weekly_frequency: 'Weekly',
    monthly_frequency: 'Monthly',
    quarterly_frequency: 'Quarterly',
    pass_rate_target: '90%',
    avg_score_target: '80',
  },
  ...overrides,
});

const makeDrillHistory = (): DrillRecord[] => [
  {
    id: 'drill-test-001',
    drill_name: 'Test Failover Drill Alpha',
    drill_type: 'weekly_automated',
    drill_scenario: 'database_loss',
    scheduled_start: '2026-02-24T10:00:00Z',
    actual_start: '2026-02-24T10:05:00Z',
    actual_end: '2026-02-24T10:20:00Z',
    status: 'completed',
    drill_passed: true,
    overall_score: 92,
    rto_met: true,
    rpo_met: true,
  },
  {
    id: 'drill-test-002',
    drill_name: 'Test Network Drill Beta',
    drill_type: 'monthly_simulation',
    drill_scenario: 'infrastructure_failure',
    scheduled_start: '2026-02-17T10:00:00Z',
    actual_start: '2026-02-17T10:10:00Z',
    actual_end: '2026-02-17T10:32:00Z',
    status: 'completed',
    drill_passed: false,
    overall_score: 65,
    rto_met: false,
    rpo_met: true,
  },
];

const makeBackupHistory = (): BackupRecord[] => [
  {
    id: 'bk-test-001',
    backup_type: 'database',
    backup_timestamp: '2026-02-25T06:00:00Z',
    verification_status: 'success',
    restore_tested: true,
    restore_status: 'success',
    data_integrity_check_passed: true,
  },
  {
    id: 'bk-test-002',
    backup_type: 'database',
    backup_timestamp: '2026-02-24T06:00:00Z',
    verification_status: 'success',
    restore_tested: false,
    restore_status: null,
    data_integrity_check_passed: true,
  },
];

// ============================================================================
// HELPERS
// ============================================================================

function setupDefaultMocks() {
  mockRpcResults = {
    get_backup_compliance_status: { data: makeBackupCompliance(), error: null },
    get_drill_compliance_status: { data: makeDrillCompliance(), error: null },
    verify_database_backup: { data: { status: 'success' }, error: null },
    test_backup_restore: { data: { status: 'success' }, error: null },
  };
  mockFromResults = {
    disaster_recovery_drills: { data: makeDrillHistory(), error: null },
    backup_verification_logs: { data: makeBackupHistory(), error: null },
  };

  // Re-wire mock implementations after vi.clearAllMocks()
  mockSupabaseRpc.mockImplementation((name: string) => {
    const result = mockRpcResults[name] ?? { data: null, error: null };
    return Promise.resolve(result);
  });
  mockSupabaseFrom.mockImplementation((table: string) => {
    const result = mockFromResults[table] ?? { data: [], error: null };
    return {
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(result),
        }),
      }),
    };
  });
}

async function renderAndWaitForLoad() {
  const { DisasterRecoveryDashboard } = await import('../DisasterRecoveryDashboard');
  render(<DisasterRecoveryDashboard />);
  await waitFor(() => {
    expect(screen.getByText('Disaster Recovery Dashboard')).toBeInTheDocument();
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe('DisasterRecoveryDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  // --------------------------------------------------------------------------
  // Loading state
  // --------------------------------------------------------------------------

  it('shows loading spinner with "Loading disaster recovery status..."', async () => {
    // Make RPC hang so loading state persists
    mockSupabaseRpc.mockReturnValue(new Promise(() => {}));

    const { DisasterRecoveryDashboard } = await import('../DisasterRecoveryDashboard');
    render(<DisasterRecoveryDashboard />);

    expect(screen.getByText('Loading disaster recovery status...')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // Title
  // --------------------------------------------------------------------------

  it('displays "Disaster Recovery Dashboard" heading after load', async () => {
    await renderAndWaitForLoad();

    expect(screen.getByText('Disaster Recovery Dashboard')).toBeInTheDocument();
    expect(screen.getByText(/monitor backup verification/i)).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // Overall compliance banner
  // --------------------------------------------------------------------------

  it('shows "Compliant" status in overall banner when both statuses are compliant', async () => {
    await renderAndWaitForLoad();

    // "Compliant" appears in banner + backup badge + drill badge = 3 occurrences
    const compliantLabels = screen.getAllByText('Compliant');
    expect(compliantLabels.length).toBe(3);
    expect(screen.getByText(/overall dr compliance/i)).toBeInTheDocument();
  });

  it('shows "Warning" status when backup compliance is WARNING', async () => {
    mockRpcResults.get_backup_compliance_status = {
      data: makeBackupCompliance({ compliance_status: 'WARNING' }),
      error: null,
    };

    await renderAndWaitForLoad();

    // Both the backup badge and overall status should show Warning
    const warningLabels = screen.getAllByText('Warning');
    expect(warningLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Non-Compliant" status when drill compliance is NON_COMPLIANT', async () => {
    mockRpcResults.get_drill_compliance_status = {
      data: makeDrillCompliance({ compliance_status: 'NON_COMPLIANT' }),
      error: null,
    };

    await renderAndWaitForLoad();

    const nonCompliantLabels = screen.getAllByText('Non-Compliant');
    expect(nonCompliantLabels.length).toBeGreaterThanOrEqual(1);
  });

  // --------------------------------------------------------------------------
  // Backup Verification section
  // --------------------------------------------------------------------------

  it('displays backup success rate', async () => {
    await renderAndWaitForLoad();

    expect(screen.getByText('Success Rate (30d)')).toBeInTheDocument();
    expect(screen.getByText('98.5%')).toBeInTheDocument();
  });

  it('displays total verifications count in 30 days', async () => {
    await renderAndWaitForLoad();

    expect(screen.getByText('Total Verifications')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
  });

  it('displays failed backup count', async () => {
    await renderAndWaitForLoad();

    expect(screen.getByText('1 failed')).toBeInTheDocument();
  });

  it('displays last successful backup timestamp', async () => {
    await renderAndWaitForLoad();

    expect(screen.getByText('Last Successful Backup:')).toBeInTheDocument();
    // The date is rendered via toLocaleString(), just check label exists
  });

  it('displays last restore test timestamp', async () => {
    await renderAndWaitForLoad();

    expect(screen.getByText('Last Restore Test:')).toBeInTheDocument();
  });

  it('displays success rate target', async () => {
    await renderAndWaitForLoad();

    expect(screen.getByText('Target: 95%')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // Drill section
  // --------------------------------------------------------------------------

  it('displays drill pass rate', async () => {
    await renderAndWaitForLoad();

    expect(screen.getByText('Pass Rate (30d)')).toBeInTheDocument();
    // "95%" appears both in drill section (95%) and targets section (95% Backup Success)
    const ninetyFiveLabels = screen.getAllByText('95%');
    expect(ninetyFiveLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('displays drill average score', async () => {
    await renderAndWaitForLoad();

    expect(screen.getByText('Avg Score')).toBeInTheDocument();
    expect(screen.getByText('88.5')).toBeInTheDocument();
  });

  it('displays last weekly drill date', async () => {
    await renderAndWaitForLoad();

    expect(screen.getByText('Last Weekly:')).toBeInTheDocument();
    // Date rendered via toLocaleDateString()
  });

  it('displays last monthly drill date', async () => {
    await renderAndWaitForLoad();

    expect(screen.getByText('Last Monthly:')).toBeInTheDocument();
  });

  it('displays last quarterly drill date', async () => {
    await renderAndWaitForLoad();

    expect(screen.getByText('Last Quarterly:')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // Compliance Targets
  // --------------------------------------------------------------------------

  it('displays RPO target of 15 min', async () => {
    await renderAndWaitForLoad();

    expect(screen.getByText('15 min')).toBeInTheDocument();
    expect(screen.getByText('RPO Target')).toBeInTheDocument();
  });

  it('displays RTO target of 4 hrs', async () => {
    await renderAndWaitForLoad();

    expect(screen.getByText('4 hrs')).toBeInTheDocument();
    expect(screen.getByText('RTO Target')).toBeInTheDocument();
  });

  it('displays 95% backup success target', async () => {
    await renderAndWaitForLoad();

    // The compliance targets section shows "95%" as Backup Success
    const targetLabels = screen.getAllByText('95%');
    expect(targetLabels.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Backup Success')).toBeInTheDocument();
  });

  it('displays 90% drill pass rate target', async () => {
    await renderAndWaitForLoad();

    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('Drill Pass Rate')).toBeInTheDocument();
  });

  it('displays weekly drill frequency target', async () => {
    await renderAndWaitForLoad();

    expect(screen.getByText('Drill Frequency')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // Action buttons
  // --------------------------------------------------------------------------

  it('calls verify_database_backup RPC when "Verify Now" is clicked', async () => {
    const user = userEvent.setup();
    await renderAndWaitForLoad();

    const verifyButton = screen.getByRole('button', { name: /verify now/i });
    await user.click(verifyButton);

    await waitFor(() => {
      expect(mockSupabaseRpc).toHaveBeenCalledWith('verify_database_backup');
    });
  });

  it('calls test_backup_restore RPC when "Restore Test" is clicked', async () => {
    const user = userEvent.setup();
    await renderAndWaitForLoad();

    const restoreButton = screen.getByRole('button', { name: /restore test/i });
    await user.click(restoreButton);

    await waitFor(() => {
      expect(mockSupabaseRpc).toHaveBeenCalledWith('test_backup_restore', { p_backup_type: 'database' });
    });
  });

  // --------------------------------------------------------------------------
  // History toggles
  // --------------------------------------------------------------------------

  it('shows backup history table when "Show Recent History" is clicked', async () => {
    const user = userEvent.setup();
    await renderAndWaitForLoad();

    const showHistoryButton = screen.getByText(/show recent history/i);
    await user.click(showHistoryButton);

    // Backup history table renders verification_status badges and backup_type
    await waitFor(() => {
      const successLabels = screen.getAllByText('success');
      // bk-test-001: verification_status=success + restore_status=success, bk-test-002: verification_status=success
      expect(successLabels.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('hides backup history table when "Hide Recent History" is clicked', async () => {
    const user = userEvent.setup();
    await renderAndWaitForLoad();

    // Show first
    const showButton = screen.getByText(/show recent history/i);
    await user.click(showButton);

    await waitFor(() => {
      const successLabels = screen.getAllByText('success');
      expect(successLabels.length).toBeGreaterThanOrEqual(2);
    });

    // Hide
    const hideButton = screen.getByText(/hide recent history/i);
    await user.click(hideButton);

    await waitFor(() => {
      // All "success" text from the backup history table should be gone
      expect(screen.queryByText('success')).not.toBeInTheDocument();
    });
  });

  it('shows drill history table when "Show Recent Drills" is clicked', async () => {
    const user = userEvent.setup();
    await renderAndWaitForLoad();

    const showDrillsButton = screen.getByRole('button', { name: /show recent drills/i });
    await user.click(showDrillsButton);

    await waitFor(() => {
      expect(screen.getByText('Weekly Automated')).toBeInTheDocument();
      expect(screen.getByText('Monthly Simulation')).toBeInTheDocument();
    });
  });

  it('shows drill scenario labels in drill history', async () => {
    const user = userEvent.setup();
    await renderAndWaitForLoad();

    const showDrillsButton = screen.getByRole('button', { name: /show recent drills/i });
    await user.click(showDrillsButton);

    await waitFor(() => {
      expect(screen.getByText('Database Loss')).toBeInTheDocument();
      expect(screen.getByText('Infrastructure Failure')).toBeInTheDocument();
    });
  });

  it('shows pass/fail results with scores in drill history', async () => {
    const user = userEvent.setup();
    await renderAndWaitForLoad();

    const showDrillsButton = screen.getByRole('button', { name: /show recent drills/i });
    await user.click(showDrillsButton);

    await waitFor(() => {
      expect(screen.getByText(/Passed/)).toBeInTheDocument();
      expect(screen.getByText(/Failed/)).toBeInTheDocument();
      expect(screen.getByText(/92%/)).toBeInTheDocument();
      expect(screen.getByText(/65%/)).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Error state
  // --------------------------------------------------------------------------

  it('displays error alert when data fetch fails', async () => {
    mockSupabaseRpc.mockRejectedValue(new Error('Test network failure'));

    const { DisasterRecoveryDashboard } = await import('../DisasterRecoveryDashboard');
    render(<DisasterRecoveryDashboard />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to load disaster recovery status')).toBeInTheDocument();
    });
  });

  it('dismisses error alert when dismiss button is clicked', async () => {
    mockSupabaseRpc.mockRejectedValue(new Error('Test network failure'));

    const user = userEvent.setup();
    const { DisasterRecoveryDashboard } = await import('../DisasterRecoveryDashboard');
    render(<DisasterRecoveryDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load disaster recovery status')).toBeInTheDocument();
    });

    const dismissButton = screen.getByLabelText('Dismiss');
    await user.click(dismissButton);

    await waitFor(() => {
      expect(screen.queryByText('Failed to load disaster recovery status')).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Issues display
  // --------------------------------------------------------------------------

  it('displays backup issues when present', async () => {
    mockRpcResults.get_backup_compliance_status = {
      data: makeBackupCompliance({
        compliance_status: 'WARNING',
        issues: ['Test: Restore test overdue by 3 days'],
      }),
      error: null,
    };

    await renderAndWaitForLoad();

    expect(screen.getByText('Test: Restore test overdue by 3 days')).toBeInTheDocument();
  });

  it('displays drill issues when present', async () => {
    mockRpcResults.get_drill_compliance_status = {
      data: makeDrillCompliance({
        compliance_status: 'WARNING',
        issues: ['Test: Weekly drill overdue'],
      }),
      error: null,
    };

    await renderAndWaitForLoad();

    expect(screen.getByText('Test: Weekly drill overdue')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // Refresh button
  // --------------------------------------------------------------------------

  it('refreshes data when Refresh button is clicked', async () => {
    const user = userEvent.setup();
    await renderAndWaitForLoad();

    // Clear and re-setup mocks to track the refresh call
    mockSupabaseRpc.mockClear();
    mockSupabaseFrom.mockClear();
    setupDefaultMocks();

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await user.click(refreshButton);

    await waitFor(() => {
      expect(mockSupabaseRpc).toHaveBeenCalledWith('get_backup_compliance_status');
      expect(mockSupabaseRpc).toHaveBeenCalledWith('get_drill_compliance_status');
    });
  });

  // --------------------------------------------------------------------------
  // "Never" display for null dates
  // --------------------------------------------------------------------------

  it('shows "Never" when last successful backup is null', async () => {
    mockRpcResults.get_backup_compliance_status = {
      data: makeBackupCompliance({ last_successful_backup: null }),
      error: null,
    };

    await renderAndWaitForLoad();

    const neverLabels = screen.getAllByText('Never');
    expect(neverLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Never" for drill dates that are null', async () => {
    mockRpcResults.get_drill_compliance_status = {
      data: makeDrillCompliance({
        last_weekly_drill: null,
        last_monthly_drill: null,
        last_quarterly_drill: null,
      }),
      error: null,
    };

    await renderAndWaitForLoad();

    const neverLabels = screen.getAllByText('Never');
    expect(neverLabels.length).toBeGreaterThanOrEqual(3);
  });
});
