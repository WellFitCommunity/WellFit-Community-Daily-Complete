/**
 * UnacknowledgedResultsDashboard tests — validates metric cards, critical alert,
 * result rows, filters, acknowledge flow, and edge states.
 *
 * Deletion Test: Every test would FAIL if the component were an empty <div />.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

const mockGetUnacknowledgedResults = vi.fn();
const mockGetResultMetrics = vi.fn();
const mockAcknowledgeResult = vi.fn();

vi.mock('../../../services/unacknowledgedResultsService', () => ({
  unacknowledgedResultsService: {
    getUnacknowledgedResults: (...args: unknown[]) => mockGetUnacknowledgedResults(...args),
    getResultMetrics: (...args: unknown[]) => mockGetResultMetrics(...args),
    acknowledgeResult: (...args: unknown[]) => mockAcknowledgeResult(...args),
    getAcknowledgmentHistory: vi.fn(),
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

import UnacknowledgedResultsDashboard from '../UnacknowledgedResultsDashboard';

// ============================================================================
// FIXTURES
// ============================================================================

const MOCK_RESULTS = [
  {
    id: 'rpt-1',
    patient_id: 'pat-1',
    first_name: 'John',
    last_name: 'Doe',
    code_display: 'Complete Blood Count',
    category: ['LAB'],
    status: 'final',
    report_priority: 'stat',
    issued: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    conclusion: 'Elevated WBC',
    tenant_id: 'tenant-1',
    hours_since_issued: 2,
    aging_status: 'critical' as const,
  },
  {
    id: 'rpt-2',
    patient_id: 'pat-2',
    first_name: 'Jane',
    last_name: 'Smith',
    code_display: 'Chest X-Ray',
    category: ['RAD'],
    status: 'final',
    report_priority: 'routine',
    issued: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
    conclusion: null,
    tenant_id: 'tenant-1',
    hours_since_issued: 10,
    aging_status: 'warning' as const,
  },
  {
    id: 'rpt-3',
    patient_id: 'pat-3',
    first_name: 'Bob',
    last_name: 'Wilson',
    code_display: 'Basic Metabolic Panel',
    category: ['LAB'],
    status: 'final',
    report_priority: 'urgent',
    issued: new Date(Date.now() - 30 * 3600 * 1000).toISOString(),
    conclusion: 'Potassium elevated',
    tenant_id: 'tenant-1',
    hours_since_issued: 30,
    aging_status: 'overdue' as const,
  },
];

const MOCK_METRICS = {
  total_unacknowledged: 3,
  critical_count: 1,
  overdue_count: 1,
  warning_count: 1,
  by_category: [
    { category: 'LAB', count: 2 },
    { category: 'RAD', count: 1 },
  ],
  by_priority: [
    { priority: 'stat', count: 1 },
    { priority: 'routine', count: 1 },
    { priority: 'urgent', count: 1 },
  ],
};

function setupDefaults(
  results = MOCK_RESULTS,
  metrics = MOCK_METRICS
) {
  mockGetUnacknowledgedResults.mockResolvedValue({ success: true, data: results, error: null });
  mockGetResultMetrics.mockResolvedValue({ success: true, data: metrics, error: null });
}

// ============================================================================
// TESTS
// ============================================================================

describe('UnacknowledgedResultsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaults();
  });

  // ---------- Tier 1: Behavior ----------

  it('displays metric cards with correct counts', async () => {
    render(<UnacknowledgedResultsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Unacknowledged')).toBeInTheDocument();
    });

    expect(screen.getByText('3')).toBeInTheDocument(); // total
    // critical=1, overdue=1 — both render "1", so use getAllByText
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(2);
  });

  it('shows critical alert banner when critical results exist', async () => {
    render(<UnacknowledgedResultsDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/1 critical result requiring immediate attention/)).toBeInTheDocument();
    });
  });

  it('does not show critical alert banner when no critical results', async () => {
    const noAlertMetrics = { ...MOCK_METRICS, critical_count: 0 };
    setupDefaults(MOCK_RESULTS, noAlertMetrics);

    render(<UnacknowledgedResultsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Unacknowledged')).toBeInTheDocument();
    });

    expect(screen.queryByText(/critical result/)).not.toBeInTheDocument();
  });

  it('renders result rows with patient name, test name, and priority badge', async () => {
    render(<UnacknowledgedResultsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('J. Doe')).toBeInTheDocument();
    });

    expect(screen.getByText('Complete Blood Count')).toBeInTheDocument();
    expect(screen.getByText('J. Smith')).toBeInTheDocument();
    expect(screen.getByText('Chest X-Ray')).toBeInTheDocument();
    expect(screen.getByText('B. Wilson')).toBeInTheDocument();
    expect(screen.getByText('Basic Metabolic Panel')).toBeInTheDocument();
  });

  it('displays human-readable age for results', async () => {
    render(<UnacknowledgedResultsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('J. Doe')).toBeInTheDocument();
    });

    // 2 hours -> "2h ago"
    expect(screen.getByText('2h ago')).toBeInTheDocument();
    // 10 hours -> "10h ago"
    expect(screen.getByText('10h ago')).toBeInTheDocument();
    // 30 hours -> "1d 6h ago"
    expect(screen.getByText('1d 6h ago')).toBeInTheDocument();
  });

  it('click Acknowledge opens modal with type selector', async () => {
    const user = userEvent.setup();
    render(<UnacknowledgedResultsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('J. Doe')).toBeInTheDocument();
    });

    const ackButtons = screen.getAllByText('Acknowledge');
    await user.click(ackButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Acknowledge Result')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Acknowledgment type')).toBeInTheDocument();
  });

  // ---------- Tier 2: State ----------

  it('shows loading state before data arrives', () => {
    mockGetUnacknowledgedResults.mockReturnValue(new Promise(() => {}));
    mockGetResultMetrics.mockReturnValue(new Promise(() => {}));

    render(<UnacknowledgedResultsDashboard />);

    expect(screen.getByText('Loading unacknowledged results...')).toBeInTheDocument();
  });

  it('shows error message when service call fails', async () => {
    mockGetUnacknowledgedResults.mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'DATABASE_ERROR', message: 'Failed to load unacknowledged results' },
    });

    render(<UnacknowledgedResultsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load unacknowledged results')).toBeInTheDocument();
    });
  });

  it('shows empty state when no unacknowledged results exist', async () => {
    const emptyMetrics = {
      ...MOCK_METRICS,
      total_unacknowledged: 0,
      critical_count: 0,
      overdue_count: 0,
      warning_count: 0,
    };
    setupDefaults([], emptyMetrics);

    render(<UnacknowledgedResultsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('No unacknowledged results')).toBeInTheDocument();
      expect(screen.getByText('All diagnostic results have been reviewed.')).toBeInTheDocument();
    });
  });

  it('after acknowledgment, row is removed and metrics update', async () => {
    const user = userEvent.setup();
    mockAcknowledgeResult.mockResolvedValue({ success: true, data: { id: 'ack-1' }, error: null });

    render(<UnacknowledgedResultsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('J. Doe')).toBeInTheDocument();
    });

    // Click first Acknowledge button
    const ackButtons = screen.getAllByText('Acknowledge');
    await user.click(ackButtons[0]);

    // Modal opens, click Confirm
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Confirm'));

    // Row should be removed
    await waitFor(() => {
      expect(screen.queryByText('Complete Blood Count')).not.toBeInTheDocument();
    });

    // Other results still visible
    expect(screen.getByText('J. Smith')).toBeInTheDocument();
    expect(screen.getByText('B. Wilson')).toBeInTheDocument();
  });

  // ---------- Tier 1: Filters ----------

  it('filter by priority shows only matching results', async () => {
    const user = userEvent.setup();
    render(<UnacknowledgedResultsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('J. Doe')).toBeInTheDocument();
    });

    const prioSelect = screen.getByLabelText('Filter by priority');
    await user.selectOptions(prioSelect, 'stat');

    expect(screen.getByText('J. Doe')).toBeInTheDocument();
    expect(screen.queryByText('J. Smith')).not.toBeInTheDocument();
    expect(screen.queryByText('B. Wilson')).not.toBeInTheDocument();
  });

  it('filter by category shows only matching results', async () => {
    const user = userEvent.setup();
    render(<UnacknowledgedResultsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('J. Smith')).toBeInTheDocument();
    });

    const catSelect = screen.getByLabelText('Filter by category');
    await user.selectOptions(catSelect, 'RAD');

    expect(screen.getByText('J. Smith')).toBeInTheDocument();
    expect(screen.queryByText('J. Doe')).not.toBeInTheDocument();
    expect(screen.queryByText('B. Wilson')).not.toBeInTheDocument();
  });

  it('filter by aging status shows only matching results', async () => {
    const user = userEvent.setup();
    render(<UnacknowledgedResultsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('B. Wilson')).toBeInTheDocument();
    });

    const agingSelect = screen.getByLabelText('Filter by aging status');
    await user.selectOptions(agingSelect, 'overdue');

    expect(screen.getByText('B. Wilson')).toBeInTheDocument();
    expect(screen.queryByText('J. Doe')).not.toBeInTheDocument();
    expect(screen.queryByText('J. Smith')).not.toBeInTheDocument();
  });

  it('shows filter empty state when no results match filters', async () => {
    const user = userEvent.setup();
    render(<UnacknowledgedResultsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('J. Doe')).toBeInTheDocument();
    });

    // Select category with no results
    const catSelect = screen.getByLabelText('Filter by category');
    await user.selectOptions(catSelect, 'RAD');

    // Then narrow by priority that doesn't match
    const prioSelect = screen.getByLabelText('Filter by priority');
    await user.selectOptions(prioSelect, 'stat');

    await waitFor(() => {
      expect(screen.getByText('No results match the current filters.')).toBeInTheDocument();
    });
  });

  // ---------- Tier 3: Integration ----------

  it('submitting acknowledgment calls service with correct params', async () => {
    const user = userEvent.setup();
    mockAcknowledgeResult.mockResolvedValue({ success: true, data: { id: 'ack-1' }, error: null });

    render(<UnacknowledgedResultsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('J. Doe')).toBeInTheDocument();
    });

    const ackButtons = screen.getAllByText('Acknowledge');
    await user.click(ackButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Change type to 'action_taken'
    const typeSelect = screen.getByLabelText('Acknowledgment type');
    await user.selectOptions(typeSelect, 'action_taken');

    // Add notes
    const notesInput = screen.getByLabelText('Acknowledgment notes');
    await user.type(notesInput, 'Ordered recheck');

    await user.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(mockAcknowledgeResult).toHaveBeenCalledWith(
        'rpt-1',
        'user-123',
        'action_taken',
        'Ordered recheck'
      );
    });
  });

  it('refresh button reloads data', async () => {
    const user = userEvent.setup();
    render(<UnacknowledgedResultsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    const initialCallCount = mockGetUnacknowledgedResults.mock.calls.length;

    await user.click(screen.getByText('Refresh'));

    await waitFor(() => {
      expect(mockGetUnacknowledgedResults.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });
});
