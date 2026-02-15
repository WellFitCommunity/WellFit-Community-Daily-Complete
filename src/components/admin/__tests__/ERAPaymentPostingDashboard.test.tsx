/**
 * ERAPaymentPostingDashboard tests -- validates stat cards, remittance rows,
 * Match & Post flow, empty/error/loading states, posted-today summary.
 *
 * Deletion Test: Every test would FAIL if the component were an empty <div />.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

const mockGetUnpostedRemittances = vi.fn();
const mockGetPaymentStats = vi.fn();
const mockGetMatchableClaims = vi.fn();
const mockPostPayment = vi.fn();

vi.mock('../../../services/eraPaymentPostingService', () => ({
  eraPaymentPostingService: {
    getUnpostedRemittances: (...args: unknown[]) => mockGetUnpostedRemittances(...args),
    getPaymentStats: (...args: unknown[]) => mockGetPaymentStats(...args),
    getMatchableClaims: (...args: unknown[]) => mockGetMatchableClaims(...args),
    postPayment: (...args: unknown[]) => mockPostPayment(...args),
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

import ERAPaymentPostingDashboard from '../ERAPaymentPostingDashboard';

// ============================================================================
// FIXTURES
// ============================================================================

const MOCK_REMITTANCES = [
  {
    remittance_id: 'rem-1',
    payer_name: 'Aetna',
    received_at: '2026-01-20T10:00:00Z',
    total_paid: 5250.00,
    claim_count: 5,
    posted_count: 2,
    unposted_count: 3,
  },
  {
    remittance_id: 'rem-2',
    payer_name: 'BlueCross',
    received_at: '2026-01-18T14:00:00Z',
    total_paid: 12300.50,
    claim_count: 10,
    posted_count: 8,
    unposted_count: 2,
  },
];

const MOCK_STATS = {
  total_posted: 42,
  total_paid_amount: 85000.75,
  total_adjustments: 12500.30,
  total_patient_responsibility: 6200.00,
  unposted_remittances: 2,
  posted_today: 3,
};

const MOCK_MATCHABLE_CLAIMS = [
  {
    claim_id: 'claim-1',
    control_number: 'CTL-100',
    payer_name: 'Aetna',
    total_charge: 1500.00,
    paid_amount: 0,
    adjustment_amount: 0,
    patient_responsibility: 0,
    match_confidence: 0,
  },
  {
    claim_id: 'claim-2',
    control_number: 'CTL-200',
    payer_name: 'BlueCross',
    total_charge: 2750.50,
    paid_amount: 0,
    adjustment_amount: 0,
    patient_responsibility: 0,
    match_confidence: 0,
  },
];

const MOCK_REMITTANCES_SUCCESS = {
  success: true,
  data: MOCK_REMITTANCES,
  error: null,
};

const MOCK_STATS_SUCCESS = {
  success: true,
  data: MOCK_STATS,
  error: null,
};

const MOCK_EMPTY_REMITTANCES = {
  success: true,
  data: [],
  error: null,
};

const MOCK_STATS_NO_TODAY = {
  success: true,
  data: {
    ...MOCK_STATS,
    posted_today: 0,
  },
  error: null,
};

// ============================================================================
// TESTS
// ============================================================================

describe('ERAPaymentPostingDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner while fetching data', () => {
    mockGetUnpostedRemittances.mockReturnValue(new Promise(() => {}));
    mockGetPaymentStats.mockReturnValue(new Promise(() => {}));

    render(<ERAPaymentPostingDashboard />);

    expect(screen.getByText('Loading payment data...')).toBeInTheDocument();
  });

  it('displays 4 stat cards with correct labels and values', async () => {
    mockGetUnpostedRemittances.mockResolvedValue(MOCK_REMITTANCES_SUCCESS);
    mockGetPaymentStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<ERAPaymentPostingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Posted')).toBeInTheDocument();
    });

    expect(screen.getByText('Paid Amount')).toBeInTheDocument();
    expect(screen.getByText('Adjustments')).toBeInTheDocument();
    expect(screen.getByText('Patient Responsibility')).toBeInTheDocument();

    // Verify numeric values in stat cards
    const totalCard = screen.getByText('Total Posted').closest('div');
    expect(totalCard).toHaveTextContent('42');

    // Currency values rendered
    expect(screen.getByText('$85,000.75')).toBeInTheDocument();
    expect(screen.getByText('$12,500.30')).toBeInTheDocument();
    expect(screen.getByText('$6,200.00')).toBeInTheDocument();
  });

  it('shows warning alert for unposted remittances', async () => {
    mockGetUnpostedRemittances.mockResolvedValue(MOCK_REMITTANCES_SUCCESS);
    mockGetPaymentStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<ERAPaymentPostingDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText(/2 remittances with unposted payments need reconciliation/),
      ).toBeInTheDocument();
    });
  });

  it('does not show warning alert when no unposted remittances', async () => {
    mockGetUnpostedRemittances.mockResolvedValue(MOCK_EMPTY_REMITTANCES);
    mockGetPaymentStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<ERAPaymentPostingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Unposted Remittances')).toBeInTheDocument();
    });

    expect(screen.queryByText(/unposted payments need reconciliation/)).not.toBeInTheDocument();
  });

  it('renders remittance rows with payer name, amounts, and counts', async () => {
    mockGetUnpostedRemittances.mockResolvedValue(MOCK_REMITTANCES_SUCCESS);
    mockGetPaymentStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<ERAPaymentPostingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Aetna')).toBeInTheDocument();
    });

    expect(screen.getByText('BlueCross')).toBeInTheDocument();

    // Total paid amounts in rows
    expect(screen.getByText('$5,250.00')).toBeInTheDocument();
    expect(screen.getByText('$12,300.50')).toBeInTheDocument();

    // Claim counts
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('shows Match & Post button on each remittance row', async () => {
    mockGetUnpostedRemittances.mockResolvedValue(MOCK_REMITTANCES_SUCCESS);
    mockGetPaymentStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<ERAPaymentPostingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Aetna')).toBeInTheDocument();
    });

    const matchButtons = screen.getAllByText('Match & Post');
    expect(matchButtons).toHaveLength(2);
  });

  it('opens claim matching modal when Match & Post is clicked', async () => {
    mockGetUnpostedRemittances.mockResolvedValue(MOCK_REMITTANCES_SUCCESS);
    mockGetPaymentStats.mockResolvedValue(MOCK_STATS_SUCCESS);
    mockGetMatchableClaims.mockResolvedValue({
      success: true,
      data: MOCK_MATCHABLE_CLAIMS,
      error: null,
    });

    render(<ERAPaymentPostingDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Aetna')).toBeInTheDocument();
    });

    const matchButtons = screen.getAllByText('Match & Post');
    await user.click(matchButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Select Claim for Payment Posting')).toBeInTheDocument();
    });

    // Claims displayed in modal
    expect(screen.getByText('CTL-100')).toBeInTheDocument();
    expect(screen.getByText('CTL-200')).toBeInTheDocument();
  });

  it('closes claim matching modal when Close is clicked', async () => {
    mockGetUnpostedRemittances.mockResolvedValue(MOCK_REMITTANCES_SUCCESS);
    mockGetPaymentStats.mockResolvedValue(MOCK_STATS_SUCCESS);
    mockGetMatchableClaims.mockResolvedValue({
      success: true,
      data: MOCK_MATCHABLE_CLAIMS,
      error: null,
    });

    render(<ERAPaymentPostingDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Aetna')).toBeInTheDocument();
    });

    const matchButtons = screen.getAllByText('Match & Post');
    await user.click(matchButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Select Claim for Payment Posting')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Close'));

    await waitFor(() => {
      expect(screen.queryByText('Select Claim for Payment Posting')).not.toBeInTheDocument();
    });
  });

  it('calls postPayment when Post is clicked in modal', async () => {
    mockGetUnpostedRemittances.mockResolvedValue(MOCK_REMITTANCES_SUCCESS);
    mockGetPaymentStats.mockResolvedValue(MOCK_STATS_SUCCESS);
    mockGetMatchableClaims.mockResolvedValue({
      success: true,
      data: MOCK_MATCHABLE_CLAIMS,
      error: null,
    });
    mockPostPayment.mockResolvedValue({
      success: true,
      data: { id: 'payment-1' },
      error: null,
    });

    render(<ERAPaymentPostingDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Aetna')).toBeInTheDocument();
    });

    // Open modal
    const matchButtons = screen.getAllByText('Match & Post');
    await user.click(matchButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Select Claim for Payment Posting')).toBeInTheDocument();
    });

    // Click Post on first claim
    const postButtons = screen.getAllByText('Post');
    await user.click(postButtons[0]);

    await waitFor(() => {
      expect(mockPostPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          claim_id: 'claim-1',
          remittance_id: 'rem-1',
          match_method: 'manual',
          match_confidence: 1.0,
        }),
      );
    });
  });

  it('shows empty state when all remittances are posted', async () => {
    mockGetUnpostedRemittances.mockResolvedValue(MOCK_EMPTY_REMITTANCES);
    mockGetPaymentStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<ERAPaymentPostingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('All remittances posted')).toBeInTheDocument();
    });

    expect(screen.getByText('No unreconciled ERA payments remain.')).toBeInTheDocument();
  });

  it('shows error alert when fetch fails', async () => {
    mockGetUnpostedRemittances.mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'DATABASE_ERROR', message: 'Service unavailable' },
    });
    mockGetPaymentStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<ERAPaymentPostingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Service unavailable')).toBeInTheDocument();
    });
  });

  it('shows posted-today summary when payments posted today', async () => {
    mockGetUnpostedRemittances.mockResolvedValue(MOCK_REMITTANCES_SUCCESS);
    mockGetPaymentStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<ERAPaymentPostingDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/payments? posted today/)).toBeInTheDocument();
    });
  });

  it('does not show posted-today summary when count is zero', async () => {
    mockGetUnpostedRemittances.mockResolvedValue(MOCK_REMITTANCES_SUCCESS);
    mockGetPaymentStats.mockResolvedValue(MOCK_STATS_NO_TODAY);

    render(<ERAPaymentPostingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Aetna')).toBeInTheDocument();
    });

    expect(screen.queryByText(/posted today/)).not.toBeInTheDocument();
  });

  it('refreshes data when Refresh button is clicked', async () => {
    mockGetUnpostedRemittances.mockResolvedValue(MOCK_REMITTANCES_SUCCESS);
    mockGetPaymentStats.mockResolvedValue(MOCK_STATS_SUCCESS);

    render(<ERAPaymentPostingDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Aetna')).toBeInTheDocument();
    });

    expect(mockGetUnpostedRemittances).toHaveBeenCalledTimes(1);
    expect(mockGetPaymentStats).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('Refresh'));

    await waitFor(() => {
      expect(mockGetUnpostedRemittances).toHaveBeenCalledTimes(2);
      expect(mockGetPaymentStats).toHaveBeenCalledTimes(2);
    });
  });
});
