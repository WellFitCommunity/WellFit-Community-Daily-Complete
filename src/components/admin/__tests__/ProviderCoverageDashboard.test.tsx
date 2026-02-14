/**
 * ProviderCoverageDashboard tests — validates metric cards, alert banner,
 * coverage rows, status/reason filters, cancel flow, on-call schedule tab,
 * and loading/error/empty states.
 *
 * Deletion Test: Every test would FAIL if the component were an empty <div />.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

const mockGetCoverageAssignments = vi.fn();
const mockGetCoverageMetrics = vi.fn();
const mockGetOnCallSchedules = vi.fn();
const mockCancelCoverageAssignment = vi.fn();
const mockDeleteOnCallSchedule = vi.fn();
const mockCreateCoverageAssignment = vi.fn();

vi.mock('../../../services/providerCoverageService', () => ({
  providerCoverageService: {
    getCoverageAssignments: (...args: unknown[]) => mockGetCoverageAssignments(...args),
    getCoverageMetrics: (...args: unknown[]) => mockGetCoverageMetrics(...args),
    getOnCallSchedules: (...args: unknown[]) => mockGetOnCallSchedules(...args),
    cancelCoverageAssignment: (...args: unknown[]) => mockCancelCoverageAssignment(...args),
    deleteOnCallSchedule: (...args: unknown[]) => mockDeleteOnCallSchedule(...args),
    createCoverageAssignment: (...args: unknown[]) => mockCreateCoverageAssignment(...args),
    getCoverageProvider: vi.fn(),
    getAbsentProviders: vi.fn(),
  },
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
    },
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    clinical: vi.fn(),
    ai: vi.fn(),
  },
}));

import ProviderCoverageDashboard from '../ProviderCoverageDashboard';

// ============================================================================
// FIXTURES
// ============================================================================

const MOCK_ASSIGNMENTS = [
  {
    id: 'ca-1',
    absent_provider_id: 'prov-1',
    coverage_provider_id: 'prov-2',
    facility_id: null,
    unit_id: null,
    effective_start: '2026-02-10T00:00:00Z',
    effective_end: '2026-02-20T00:00:00Z',
    coverage_reason: 'vacation',
    coverage_priority: 1,
    status: 'active',
    auto_route_tasks: true,
    notes: null,
    tenant_id: 'tenant-1',
    approved_by: null,
    approved_at: null,
    created_by: 'user-admin',
    created_at: '2026-02-09T00:00:00Z',
    updated_at: '2026-02-09T00:00:00Z',
    absent_first_name: 'Alice',
    absent_last_name: 'Doctor',
    coverage_first_name: 'Bob',
    coverage_last_name: 'Provider',
    computed_status: 'active',
  },
  {
    id: 'ca-2',
    absent_provider_id: 'prov-3',
    coverage_provider_id: 'prov-4',
    facility_id: null,
    unit_id: null,
    effective_start: '2026-03-01T00:00:00Z',
    effective_end: '2026-03-05T00:00:00Z',
    coverage_reason: 'sick',
    coverage_priority: 2,
    status: 'active',
    auto_route_tasks: false,
    notes: 'Covering urgent cases only',
    tenant_id: 'tenant-1',
    approved_by: null,
    approved_at: null,
    created_by: 'user-admin',
    created_at: '2026-02-28T00:00:00Z',
    updated_at: '2026-02-28T00:00:00Z',
    absent_first_name: 'Carol',
    absent_last_name: 'Nurse',
    coverage_first_name: 'Dave',
    coverage_last_name: 'Specialist',
    computed_status: 'upcoming',
  },
  {
    id: 'ca-3',
    absent_provider_id: 'prov-5',
    coverage_provider_id: 'prov-6',
    facility_id: null,
    unit_id: null,
    effective_start: '2026-01-01T00:00:00Z',
    effective_end: '2026-01-05T00:00:00Z',
    coverage_reason: 'pto',
    coverage_priority: 1,
    status: 'completed',
    auto_route_tasks: true,
    notes: null,
    tenant_id: 'tenant-1',
    approved_by: null,
    approved_at: null,
    created_by: 'user-admin',
    created_at: '2025-12-30T00:00:00Z',
    updated_at: '2026-01-06T00:00:00Z',
    absent_first_name: 'Eve',
    absent_last_name: 'Surgeon',
    coverage_first_name: 'Frank',
    coverage_last_name: 'Backup',
    computed_status: 'completed',
  },
];

const MOCK_METRICS = {
  active_coverages: 2,
  upcoming_coverages: 1,
  on_call_today: 3,
  providers_absent_today: 4,
  unassigned_absences: 2,
};

const MOCK_SCHEDULES = [
  {
    id: 's-1',
    provider_id: 'prov-1',
    facility_id: null,
    unit_id: null,
    schedule_date: '2026-02-14',
    shift_start: '07:00',
    shift_end: '19:00',
    shift_type: 'day',
    coverage_role: 'primary',
    is_active: true,
    notes: 'Main on-call',
    tenant_id: 'tenant-1',
    created_by: null,
    created_at: '2026-02-13T00:00:00Z',
    updated_at: '2026-02-13T00:00:00Z',
  },
];

function setupDefaults(
  assignments = MOCK_ASSIGNMENTS,
  metrics = MOCK_METRICS,
  schedules = MOCK_SCHEDULES
) {
  mockGetCoverageAssignments.mockResolvedValue({ success: true, data: assignments, error: null });
  mockGetCoverageMetrics.mockResolvedValue({ success: true, data: metrics, error: null });
  mockGetOnCallSchedules.mockResolvedValue({ success: true, data: schedules, error: null });
}

// ============================================================================
// TESTS
// ============================================================================

describe('ProviderCoverageDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  // ---------- Tier 1: Behavior ----------

  it('displays metric cards with correct counts', async () => {
    render(<ProviderCoverageDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Active Coverages')).toBeInTheDocument();
    });

    // Verify all metric labels are present (some labels like "Upcoming" also appear as status badges)
    expect(screen.getAllByText('Upcoming').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('On-Call Today')).toBeInTheDocument();
    expect(screen.getByText('Absent Today')).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();

    // Verify specific counts for unique metric values
    expect(screen.getByText('4')).toBeInTheDocument(); // providers_absent_today = 4
    // on_call_today = 3
    const threeElements = screen.getAllByText('3');
    expect(threeElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows alert banner when unassigned absences exist', async () => {
    render(<ProviderCoverageDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/2 absent providers without coverage/)).toBeInTheDocument();
    });
  });

  it('does not show alert banner when no unassigned absences', async () => {
    setupDefaults(MOCK_ASSIGNMENTS, { ...MOCK_METRICS, unassigned_absences: 0 });
    render(<ProviderCoverageDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Active Coverages')).toBeInTheDocument();
    });

    expect(screen.queryByText(/absent providers without coverage/)).not.toBeInTheDocument();
  });

  it('displays coverage assignment table with provider names and status badges', async () => {
    render(<ProviderCoverageDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Alice Doctor')).toBeInTheDocument();
    });

    expect(screen.getByText('Bob Provider')).toBeInTheDocument();
    expect(screen.getByText('Carol Nurse')).toBeInTheDocument();
    expect(screen.getByText('Dave Specialist')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('upcoming')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
  });

  it('status filter changes visible rows', async () => {
    const user = userEvent.setup();
    render(<ProviderCoverageDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Alice Doctor')).toBeInTheDocument();
    });

    const statusSelect = screen.getByLabelText('Filter by status');
    await user.selectOptions(statusSelect, 'completed');

    expect(screen.queryByText('Alice Doctor')).not.toBeInTheDocument();
    expect(screen.queryByText('Carol Nurse')).not.toBeInTheDocument();
    expect(screen.getByText('Eve Surgeon')).toBeInTheDocument();
  });

  it('cancel button opens confirmation dialog', async () => {
    const user = userEvent.setup();
    render(<ProviderCoverageDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Alice Doctor')).toBeInTheDocument();
    });

    // Find Cancel buttons within the assignment rows (active and upcoming rows have them)
    const cancelButtons = screen.getAllByRole('button', { name: /Cancel/i });
    // Filter to only the row-level cancel buttons (not filter dropdown)
    const rowCancelButtons = cancelButtons.filter(btn => btn.textContent?.includes('Cancel') && !btn.textContent?.includes('Coverage'));
    expect(rowCancelButtons.length).toBeGreaterThanOrEqual(1);

    await user.click(rowCancelButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Cancel coverage confirmation' })).toBeInTheDocument();
    });
    expect(screen.getByText(/Are you sure you want to cancel/)).toBeInTheDocument();
  });

  it('on-call schedule tab shows schedule entries', async () => {
    const user = userEvent.setup();
    render(<ProviderCoverageDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Active Coverages')).toBeInTheDocument();
    });

    // Switch to on-call tab
    await user.click(screen.getByText('On-Call Schedule'));

    await waitFor(() => {
      expect(screen.getByText('07:00 - 19:00')).toBeInTheDocument();
    });

    expect(screen.getByText('Day')).toBeInTheDocument();
    expect(screen.getByText('primary')).toBeInTheDocument();
    expect(screen.getByText('Main on-call')).toBeInTheDocument();
  });

  it('add coverage button opens modal form', async () => {
    const user = userEvent.setup();
    render(<ProviderCoverageDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Add Coverage')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Add Coverage'));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Add coverage assignment' })).toBeInTheDocument();
      expect(screen.getByLabelText('Absent provider ID')).toBeInTheDocument();
      expect(screen.getByLabelText('Coverage provider ID')).toBeInTheDocument();
      expect(screen.getByLabelText('Coverage reason')).toBeInTheDocument();
    });
  });

  // ---------- Tier 2: State ----------

  it('shows loading state before data arrives', () => {
    mockGetCoverageAssignments.mockReturnValue(new Promise(() => {}));
    mockGetCoverageMetrics.mockReturnValue(new Promise(() => {}));
    mockGetOnCallSchedules.mockReturnValue(new Promise(() => {}));

    render(<ProviderCoverageDashboard />);

    expect(screen.getByText('Loading provider coverage data...')).toBeInTheDocument();
  });

  it('shows error message when service call fails', async () => {
    mockGetCoverageAssignments.mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'DATABASE_ERROR', message: 'Failed to load coverage assignments' },
    });

    render(<ProviderCoverageDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load coverage assignments')).toBeInTheDocument();
    });
  });

  it('shows empty state when no assignments exist', async () => {
    setupDefaults([], { ...MOCK_METRICS, active_coverages: 0, upcoming_coverages: 0, unassigned_absences: 0 });
    render(<ProviderCoverageDashboard />);

    await waitFor(() => {
      expect(screen.getByText('No coverage assignments')).toBeInTheDocument();
      expect(screen.getByText('No coverage assignments have been created.')).toBeInTheDocument();
    });
  });

  it('shows filter empty state when no assignments match filters', async () => {
    const user = userEvent.setup();
    render(<ProviderCoverageDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Alice Doctor')).toBeInTheDocument();
    });

    const statusSelect = screen.getByLabelText('Filter by status');
    await user.selectOptions(statusSelect, 'cancelled');

    await waitFor(() => {
      expect(screen.getByText('No assignments match the current filters.')).toBeInTheDocument();
    });
  });

  // ---------- Tier 3: Integration ----------

  it('refresh button reloads data', async () => {
    const user = userEvent.setup();
    render(<ProviderCoverageDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Alice Doctor')).toBeInTheDocument();
    });

    // There should be a Refresh button in the Coverage Assignments header
    const refreshButtons = screen.getAllByText('Refresh');
    const initialCallCount = mockGetCoverageAssignments.mock.calls.length;

    await user.click(refreshButtons[0]);

    await waitFor(() => {
      expect(mockGetCoverageAssignments.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });
});
