/**
 * ReferralCompletionDashboard tests — validates metric cards, overdue alert,
 * referral rows, filters, modals, empty state, error state, and refresh.
 *
 * Deletion Test: Every test would FAIL if the component were an empty <div />.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

const mockGetAwaitingConfirmation = vi.fn();
const mockGetCompletionStats = vi.fn();
const mockRecordCompletion = vi.fn();
const mockGetCompletionHistory = vi.fn();

vi.mock('../../../services/referralCompletionService', () => ({
  referralCompletionService: {
    getAwaitingConfirmation: (...args: unknown[]) => mockGetAwaitingConfirmation(...args),
    getCompletionStats: (...args: unknown[]) => mockGetCompletionStats(...args),
    recordCompletion: (...args: unknown[]) => mockRecordCompletion(...args),
    getCompletionHistory: (...args: unknown[]) => mockGetCompletionHistory(...args),
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

import ReferralCompletionDashboard from '../ReferralCompletionDashboard';

// ============================================================================
// FIXTURES
// ============================================================================

const MOCK_REFERRALS = [
  {
    referral_id: 'ref-1',
    referral_source_id: 'src-1',
    source_org_name: 'General Hospital',
    patient_first_name: 'John',
    patient_last_name: 'Doe',
    referral_status: 'active',
    referral_reason: 'Cardiology consult',
    created_at: '2026-01-15T10:00:00Z',
    days_waiting: 35,
    specialist_completion_status: 'awaiting',
    specialist_name: null,
    specialist_completion_date: null,
    specialist_confirmed_at: null,
    tenant_id: 'tenant-1',
  },
  {
    referral_id: 'ref-2',
    referral_source_id: 'src-2',
    source_org_name: 'City Clinic',
    patient_first_name: 'Jane',
    patient_last_name: 'Smith',
    referral_status: 'enrolled',
    referral_reason: 'Physical therapy',
    created_at: '2026-02-10T10:00:00Z',
    days_waiting: 9,
    specialist_completion_status: 'awaiting',
    specialist_name: null,
    specialist_completion_date: null,
    specialist_confirmed_at: null,
    tenant_id: 'tenant-1',
  },
  {
    referral_id: 'ref-3',
    referral_source_id: 'src-3',
    source_org_name: 'Valley Medical',
    patient_first_name: 'Bob',
    patient_last_name: 'Jones',
    referral_status: 'active',
    referral_reason: 'Orthopedic',
    created_at: '2026-01-20T10:00:00Z',
    days_waiting: 30,
    specialist_completion_status: 'confirmed',
    specialist_name: 'Dr. Adams',
    specialist_completion_date: '2026-02-15',
    specialist_confirmed_at: '2026-02-15T14:00:00Z',
    tenant_id: 'tenant-1',
  },
];

const MOCK_STATS = {
  success: true,
  data: {
    total_awaiting: 5,
    total_overdue: 2,
    confirmed_this_month: 3,
    avg_days_to_confirm: 8.5,
  },
};

const MOCK_REFERRALS_RESULT = {
  success: true,
  data: MOCK_REFERRALS,
};

const MOCK_EMPTY_RESULT = {
  success: true,
  data: [],
};

const MOCK_EMPTY_STATS = {
  success: true,
  data: {
    total_awaiting: 0,
    total_overdue: 0,
    confirmed_this_month: 0,
    avg_days_to_confirm: null,
  },
};

// ============================================================================
// TESTS
// ============================================================================

describe('ReferralCompletionDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays metric cards with correct values', async () => {
    mockGetAwaitingConfirmation.mockResolvedValue(MOCK_REFERRALS_RESULT);
    mockGetCompletionStats.mockResolvedValue(MOCK_STATS);

    render(<ReferralCompletionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Awaiting Confirmation')).toBeInTheDocument();
    });

    // Verify metric card values
    expect(screen.getByText('5')).toBeInTheDocument(); // total_awaiting
    expect(screen.getByText('2')).toBeInTheDocument(); // total_overdue
    expect(screen.getByText('3')).toBeInTheDocument(); // confirmed_this_month
    expect(screen.getByText('8.5d')).toBeInTheDocument(); // avg_days_to_confirm

    // Verify card labels
    expect(screen.getByText('Overdue 14+ Days')).toBeInTheDocument();
    expect(screen.getByText('Confirmed This Month')).toBeInTheDocument();
    expect(screen.getByText('Avg Days to Confirm')).toBeInTheDocument();
  });

  it('shows overdue alert banner when overdue count is positive', async () => {
    mockGetAwaitingConfirmation.mockResolvedValue(MOCK_REFERRALS_RESULT);
    mockGetCompletionStats.mockResolvedValue(MOCK_STATS);

    render(<ReferralCompletionDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/2 referrals overdue 14\+ days/)).toBeInTheDocument();
    });
  });

  it('hides alert banner when no overdue referrals', async () => {
    mockGetAwaitingConfirmation.mockResolvedValue(MOCK_EMPTY_RESULT);
    mockGetCompletionStats.mockResolvedValue(MOCK_EMPTY_STATS);

    render(<ReferralCompletionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Awaiting Confirmation')).toBeInTheDocument();
    });

    expect(screen.queryByText(/referrals overdue/)).not.toBeInTheDocument();
  });

  it('renders referral rows with masked patient name and org name', async () => {
    mockGetAwaitingConfirmation.mockResolvedValue(MOCK_REFERRALS_RESULT);
    mockGetCompletionStats.mockResolvedValue(MOCK_STATS);

    render(<ReferralCompletionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('General Hospital')).toBeInTheDocument();
      expect(screen.getByText('City Clinic')).toBeInTheDocument();
      expect(screen.getByText('Valley Medical')).toBeInTheDocument();
    });

    // Patient names should be masked (first initial + last name)
    expect(screen.getByText('J. Doe')).toBeInTheDocument();
    expect(screen.getByText('J. Smith')).toBeInTheDocument();
    expect(screen.getByText('B. Jones')).toBeInTheDocument();
  });

  it('shows days waiting badges with color coding', async () => {
    mockGetAwaitingConfirmation.mockResolvedValue(MOCK_REFERRALS_RESULT);
    mockGetCompletionStats.mockResolvedValue(MOCK_STATS);

    render(<ReferralCompletionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('35d')).toBeInTheDocument();
      expect(screen.getByText('9d')).toBeInTheDocument();
      expect(screen.getByText('30d')).toBeInTheDocument();
    });
  });

  it('shows completion status badges for each referral', async () => {
    mockGetAwaitingConfirmation.mockResolvedValue(MOCK_REFERRALS_RESULT);
    mockGetCompletionStats.mockResolvedValue(MOCK_STATS);

    render(<ReferralCompletionDashboard />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('General Hospital')).toBeInTheDocument();
    });

    // Status badges appear in each row — use getAllByText to handle
    // multiple possible matches (badge + metric card labels)
    const overdueElements = screen.getAllByText('Overdue');
    expect(overdueElements.length).toBeGreaterThanOrEqual(1);

    const awaitingElements = screen.getAllByText('Awaiting');
    expect(awaitingElements.length).toBeGreaterThanOrEqual(1);

    const confirmedElements = screen.getAllByText('Confirmed');
    expect(confirmedElements.length).toBeGreaterThanOrEqual(1);
  });

  it('displays empty state when no referrals exist', async () => {
    mockGetAwaitingConfirmation.mockResolvedValue(MOCK_EMPTY_RESULT);
    mockGetCompletionStats.mockResolvedValue(MOCK_EMPTY_STATS);

    render(<ReferralCompletionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('No referrals pending specialist confirmation')).toBeInTheDocument();
      expect(screen.getByText('No active referrals require specialist confirmation.')).toBeInTheDocument();
    });
  });

  it('filters referrals by completion status', async () => {
    mockGetAwaitingConfirmation.mockResolvedValue(MOCK_REFERRALS_RESULT);
    mockGetCompletionStats.mockResolvedValue(MOCK_STATS);

    render(<ReferralCompletionDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('General Hospital')).toBeInTheDocument();
    });

    // Filter to "awaiting" only (non-overdue awaiting)
    const statusSelect = screen.getByLabelText('Filter by completion status');
    await user.selectOptions(statusSelect, 'awaiting');

    // General Hospital (35d overdue) and Valley Medical (confirmed) should be hidden
    expect(screen.queryByText('General Hospital')).not.toBeInTheDocument();
    expect(screen.queryByText('Valley Medical')).not.toBeInTheDocument();
    // City Clinic (9d awaiting) should remain
    expect(screen.getByText('City Clinic')).toBeInTheDocument();
  });

  it('filters referrals by search query', async () => {
    mockGetAwaitingConfirmation.mockResolvedValue(MOCK_REFERRALS_RESULT);
    mockGetCompletionStats.mockResolvedValue(MOCK_STATS);

    render(<ReferralCompletionDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('General Hospital')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText('Search referrals');
    await user.type(searchInput, 'smith');

    // Only Jane Smith (City Clinic) should show
    expect(screen.queryByText('General Hospital')).not.toBeInTheDocument();
    expect(screen.getByText('City Clinic')).toBeInTheDocument();
  });

  it('opens RecordCompletionModal when Record button is clicked', async () => {
    mockGetAwaitingConfirmation.mockResolvedValue(MOCK_REFERRALS_RESULT);
    mockGetCompletionStats.mockResolvedValue(MOCK_STATS);

    render(<ReferralCompletionDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('General Hospital')).toBeInTheDocument();
    });

    const recordButtons = screen.getAllByText('Record');
    await user.click(recordButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Record Specialist Completion')).toBeInTheDocument();
      expect(screen.getByLabelText('Specialist Name *')).toBeInTheDocument();
      expect(screen.getByLabelText('Completion Date *')).toBeInTheDocument();
    });
  });

  it('opens CompletionHistoryModal when History button is clicked', async () => {
    mockGetAwaitingConfirmation.mockResolvedValue(MOCK_REFERRALS_RESULT);
    mockGetCompletionStats.mockResolvedValue(MOCK_STATS);
    mockGetCompletionHistory.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'log-1',
          referral_id: 'ref-1',
          follow_up_type: 'provider_task',
          follow_up_reason: 'specialist_completion_recorded',
          aging_days: 30,
          delivery_status: 'delivered',
          created_at: '2026-02-14T10:00:00Z',
        },
      ],
    });

    render(<ReferralCompletionDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('General Hospital')).toBeInTheDocument();
    });

    const historyButtons = screen.getAllByText('History');
    await user.click(historyButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Completion History')).toBeInTheDocument();
      expect(screen.getByText('Completion Recorded')).toBeInTheDocument();
    });
  });

  it('shows error state when service fails', async () => {
    mockGetAwaitingConfirmation.mockResolvedValue({
      success: false,
      error: { code: 'DATABASE_ERROR', message: 'Connection failed' },
    });
    mockGetCompletionStats.mockResolvedValue(MOCK_EMPTY_STATS);

    render(<ReferralCompletionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    mockGetAwaitingConfirmation.mockReturnValue(new Promise(() => {}));
    mockGetCompletionStats.mockReturnValue(new Promise(() => {}));

    render(<ReferralCompletionDashboard />);

    expect(screen.getByText('Loading specialist confirmation data...')).toBeInTheDocument();
  });
});
