/**
 * ReferralAgingDashboard tests — validates aging bucket cards, referral rows,
 * filters, manual send action, history modal, and empty state.
 *
 * Deletion Test: Every test would FAIL if the component were an empty <div />.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

const mockGetAgingReferrals = vi.fn();
const mockGetAgingStats = vi.fn();
const mockTriggerManualFollowUp = vi.fn();
const mockGetFollowUpHistory = vi.fn();

vi.mock('../../../services/referralFollowUpService', () => ({
  referralFollowUpService: {
    getAgingReferrals: (...args: unknown[]) => mockGetAgingReferrals(...args),
    getAgingStats: (...args: unknown[]) => mockGetAgingStats(...args),
    triggerManualFollowUp: (...args: unknown[]) => mockTriggerManualFollowUp(...args),
    getFollowUpHistory: (...args: unknown[]) => mockGetFollowUpHistory(...args),
    getAgingConfig: vi.fn(),
    updateAgingConfig: vi.fn(),
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

import ReferralAgingDashboard from '../ReferralAgingDashboard';

// ============================================================================
// FIXTURES
// ============================================================================

const MOCK_REFERRALS = [
  {
    referral_id: 'ref-1',
    referral_source_id: 'src-1',
    source_org_name: 'General Hospital',
    patient_phone: '+15551234567',
    patient_email: 'john@example.com',
    patient_first_name: 'John',
    patient_last_name: 'Doe',
    referral_status: 'pending',
    aging_days: 15,
    last_follow_up_at: '2026-02-10T10:00:00Z',
    follow_up_count: 2,
    tenant_id: 'tenant-1',
  },
  {
    referral_id: 'ref-2',
    referral_source_id: 'src-2',
    source_org_name: 'City Clinic',
    patient_phone: '+15559876543',
    patient_email: null,
    patient_first_name: 'Jane',
    patient_last_name: 'Smith',
    referral_status: 'invited',
    aging_days: 5,
    last_follow_up_at: null,
    follow_up_count: 0,
    tenant_id: 'tenant-1',
  },
];

const MOCK_STATS = {
  success: true,
  data: {
    bucket_0_3: 2,
    bucket_3_7: 3,
    bucket_7_14: 1,
    bucket_14_plus: 2,
    status_pending: 4,
    status_invited: 3,
    status_enrolled: 1,
    total_aging: 8,
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
    bucket_0_3: 0,
    bucket_3_7: 0,
    bucket_7_14: 0,
    bucket_14_plus: 0,
    status_pending: 0,
    status_invited: 0,
    status_enrolled: 0,
    total_aging: 0,
  },
};

// ============================================================================
// TESTS
// ============================================================================

describe('ReferralAgingDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays aging bucket metric cards with correct color scheme', async () => {
    mockGetAgingReferrals.mockResolvedValue(MOCK_REFERRALS_RESULT);
    mockGetAgingStats.mockResolvedValue(MOCK_STATS);

    render(<ReferralAgingDashboard />);

    // Wait for data to load — "0-3 Days" only appears in the metric card (not in filter dropdown)
    await waitFor(() => {
      expect(screen.getByText('0-3 Days')).toBeInTheDocument();
    });

    // Verify metric cards with correct color scheme
    const greenCard = screen.getByText('0-3 Days').closest('div');
    expect(greenCard).toHaveClass('bg-green-50');

    // "14+ Days" only appears in metric card (filter uses "14+")
    const redCard = screen.getByText('14+ Days').closest('div');
    expect(redCard).toHaveClass('bg-red-50');

    // Verify the aging table header rendered (proves we're past loading)
    expect(screen.getByText('Aging Referrals')).toBeInTheDocument();
  });

  it('shows critical alert banner when 14+ day referrals exist', async () => {
    mockGetAgingReferrals.mockResolvedValue(MOCK_REFERRALS_RESULT);
    mockGetAgingStats.mockResolvedValue(MOCK_STATS);

    render(<ReferralAgingDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/2 referrals aging 14\+ days/)).toBeInTheDocument();
    });
  });

  it('renders referral rows with org name and masked phone', async () => {
    mockGetAgingReferrals.mockResolvedValue(MOCK_REFERRALS_RESULT);
    mockGetAgingStats.mockResolvedValue(MOCK_STATS);

    render(<ReferralAgingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('General Hospital')).toBeInTheDocument();
      expect(screen.getByText('City Clinic')).toBeInTheDocument();
    });

    // Phone should be masked
    expect(screen.getByText('***-***-4567')).toBeInTheDocument();
    expect(screen.getByText('***-***-6543')).toBeInTheDocument();
  });

  it('shows aging days with badges', async () => {
    mockGetAgingReferrals.mockResolvedValue(MOCK_REFERRALS_RESULT);
    mockGetAgingStats.mockResolvedValue(MOCK_STATS);

    render(<ReferralAgingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('15d')).toBeInTheDocument();
      expect(screen.getByText('5d')).toBeInTheDocument();
    });
  });

  it('displays empty state when no aging referrals', async () => {
    mockGetAgingReferrals.mockResolvedValue(MOCK_EMPTY_RESULT);
    mockGetAgingStats.mockResolvedValue(MOCK_EMPTY_STATS);

    render(<ReferralAgingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('All referrals are current')).toBeInTheDocument();
      expect(screen.getByText('No aging referrals require follow-up.')).toBeInTheDocument();
    });
  });

  it('filters referrals by status', async () => {
    mockGetAgingReferrals.mockResolvedValue(MOCK_REFERRALS_RESULT);
    mockGetAgingStats.mockResolvedValue(MOCK_STATS);

    render(<ReferralAgingDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('General Hospital')).toBeInTheDocument();
    });

    // Filter to "invited" only
    const statusSelect = screen.getByLabelText('Filter by status');
    await user.selectOptions(statusSelect, 'invited');

    // General Hospital (pending) should be hidden
    expect(screen.queryByText('General Hospital')).not.toBeInTheDocument();
    expect(screen.getByText('City Clinic')).toBeInTheDocument();
  });

  it('filters referrals by aging bucket', async () => {
    mockGetAgingReferrals.mockResolvedValue(MOCK_REFERRALS_RESULT);
    mockGetAgingStats.mockResolvedValue(MOCK_STATS);

    render(<ReferralAgingDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('General Hospital')).toBeInTheDocument();
    });

    // Filter to "14+" bucket
    const agingSelect = screen.getByLabelText('Filter by aging bucket');
    await user.selectOptions(agingSelect, '14+');

    // Only 15-day referral should show
    expect(screen.getByText('General Hospital')).toBeInTheDocument();
    expect(screen.queryByText('City Clinic')).not.toBeInTheDocument();
  });

  it('opens history modal when History button is clicked', async () => {
    mockGetAgingReferrals.mockResolvedValue(MOCK_REFERRALS_RESULT);
    mockGetAgingStats.mockResolvedValue(MOCK_STATS);
    mockGetFollowUpHistory.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'log-1',
          referral_id: 'ref-1',
          follow_up_type: 'sms',
          follow_up_reason: 'pending_no_response',
          aging_days: 7,
          delivery_status: 'sent',
          created_at: '2026-02-10T10:00:00Z',
        },
      ],
    });

    render(<ReferralAgingDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('General Hospital')).toBeInTheDocument();
    });

    // Click first History button
    const historyButtons = screen.getAllByText('History');
    await user.click(historyButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Follow-Up History')).toBeInTheDocument();
      expect(screen.getByText(/sms — sent/)).toBeInTheDocument();
    });
  });

  it('shows error state when service fails', async () => {
    mockGetAgingReferrals.mockResolvedValue({
      success: false,
      error: { code: 'DATABASE_ERROR', message: 'Connection failed' },
    });
    mockGetAgingStats.mockResolvedValue(MOCK_EMPTY_STATS);

    render(<ReferralAgingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });
  });

  it('calls triggerManualFollowUp when Send button is clicked', async () => {
    mockGetAgingReferrals.mockResolvedValue(MOCK_REFERRALS_RESULT);
    mockGetAgingStats.mockResolvedValue(MOCK_STATS);
    mockTriggerManualFollowUp.mockResolvedValue({
      success: true,
      data: { id: 'log-new', follow_up_type: 'sms' },
    });

    render(<ReferralAgingDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('General Hospital')).toBeInTheDocument();
    });

    const sendButtons = screen.getAllByText('Send');
    await user.click(sendButtons[0]);

    await waitFor(() => {
      expect(mockTriggerManualFollowUp).toHaveBeenCalledWith('ref-1', 'sms', 'tenant-1');
    });
  });
});
