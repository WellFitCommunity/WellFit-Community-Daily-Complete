/**
 * ClaimResubmissionDashboard tests — validates stat cards, claim rows,
 * alert banner, filter/search, correction & void modal flows, chain modal,
 * empty state, and error handling.
 *
 * Deletion Test: Every test would FAIL if the component were an empty <div />.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

const mockGetRejectedClaims = vi.fn();
const mockGetResubmissionStats = vi.fn();
const mockCreateCorrectedClaim = vi.fn();
const mockVoidRejectedClaim = vi.fn();
const mockGetResubmissionChain = vi.fn();

vi.mock('../../../services/claimResubmissionService', () => ({
  claimResubmissionService: {
    getRejectedClaims: (...args: unknown[]) => mockGetRejectedClaims(...args),
    getResubmissionStats: (...args: unknown[]) => mockGetResubmissionStats(...args),
    createCorrectedClaim: (...args: unknown[]) => mockCreateCorrectedClaim(...args),
    voidRejectedClaim: (...args: unknown[]) => mockVoidRejectedClaim(...args),
    getResubmissionChain: (...args: unknown[]) => mockGetResubmissionChain(...args),
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), clinical: vi.fn(), ai: vi.fn(),
  },
}));

import ClaimResubmissionDashboard from '../ClaimResubmissionDashboard';

// ============================================================================
// FIXTURES
// ============================================================================

const MOCK_CLAIMS = [
  {
    claim_id: 'claim-001',
    encounter_id: 'enc-001',
    payer_name: 'Aetna',
    status: 'rejected',
    total_charge: 1500.00,
    control_number: 'CTL-100',
    created_at: '2026-02-01T12:00:00Z',
    updated_at: '2026-02-10T12:00:00Z',
    aging_days: 14,
    denial: { denial_code: 'CO-4', denial_reason: 'Missing modifier', appeal_deadline: '2026-03-01', appeal_status: 'pending' },
    parent_claim_id: null,
    resubmission_count: 0,
  },
  {
    claim_id: 'claim-002',
    encounter_id: 'enc-002',
    payer_name: 'BlueCross',
    status: 'void',
    total_charge: 2000.00,
    control_number: 'CTL-200',
    created_at: '2026-01-15T12:00:00Z',
    updated_at: '2026-02-05T12:00:00Z',
    aging_days: 31,
    denial: null,
    parent_claim_id: null,
    resubmission_count: 0,
  },
];

const MOCK_STATS = {
  total_rejected: 5,
  total_amount_at_risk: 12500.00,
  avg_days_since_rejection: 21,
  resubmitted_count: 3,
  voided_count: 2,
  past_appeal_deadline: 2,
};

const MOCK_STATS_NO_DEADLINE = {
  ...MOCK_STATS,
  past_appeal_deadline: 0,
};

const MOCK_CHAIN = [
  { claim_id: 'orig-1', control_number: 'CTL-001', status: 'void', resubmission_count: 0, is_current: false, created_at: '2026-01-01T00:00:00Z' },
  { claim_id: 'claim-001', control_number: 'CTL-100', status: 'rejected', resubmission_count: 1, is_current: true, created_at: '2026-02-01T00:00:00Z' },
];

const CLAIMS_SUCCESS = { success: true, data: MOCK_CLAIMS, error: null };
const STATS_SUCCESS = { success: true, data: MOCK_STATS, error: null };
const STATS_NO_DEADLINE = { success: true, data: MOCK_STATS_NO_DEADLINE, error: null };
const EMPTY_CLAIMS = { success: true, data: [], error: null };

// ============================================================================
// TESTS
// ============================================================================

describe('ClaimResubmissionDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner while fetching data', () => {
    mockGetRejectedClaims.mockReturnValue(new Promise(() => {}));
    mockGetResubmissionStats.mockReturnValue(new Promise(() => {}));

    render(<ClaimResubmissionDashboard />);

    expect(screen.getByText('Loading resubmission data...')).toBeInTheDocument();
  });

  it('displays 4 stat cards with correct labels and values', async () => {
    mockGetRejectedClaims.mockResolvedValue(CLAIMS_SUCCESS);
    mockGetResubmissionStats.mockResolvedValue(STATS_SUCCESS);

    render(<ClaimResubmissionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Rejected')).toBeInTheDocument();
    });

    expect(screen.getByText('Amount at Risk')).toBeInTheDocument();
    expect(screen.getByText('Avg Days Since Rejection')).toBeInTheDocument();
    expect(screen.getByText('Resubmitted')).toBeInTheDocument();

    const rejectedCard = screen.getByText('Total Rejected').closest('div');
    expect(rejectedCard).toHaveTextContent('5');
    expect(screen.getByText('$12,500.00')).toBeInTheDocument();
    expect(screen.getByText('21')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows critical alert when past_appeal_deadline > 0', async () => {
    mockGetRejectedClaims.mockResolvedValue(CLAIMS_SUCCESS);
    mockGetResubmissionStats.mockResolvedValue(STATS_SUCCESS);

    render(<ClaimResubmissionDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/2 rejected claims have passed the appeal deadline/)).toBeInTheDocument();
    });
  });

  it('does not show critical alert when past_appeal_deadline is 0', async () => {
    mockGetRejectedClaims.mockResolvedValue(CLAIMS_SUCCESS);
    mockGetResubmissionStats.mockResolvedValue(STATS_NO_DEADLINE);

    render(<ClaimResubmissionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Rejected Claims')).toBeInTheDocument();
    });

    expect(screen.queryByText(/passed the appeal deadline/)).not.toBeInTheDocument();
  });

  it('renders claim rows with payer name, amounts, status, and denial reason', async () => {
    mockGetRejectedClaims.mockResolvedValue(CLAIMS_SUCCESS);
    mockGetResubmissionStats.mockResolvedValue(STATS_SUCCESS);

    render(<ClaimResubmissionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Aetna')).toBeInTheDocument();
    });

    expect(screen.getByText('BlueCross')).toBeInTheDocument();
    expect(screen.getByText('$1,500.00')).toBeInTheDocument();
    expect(screen.getByText('$2,000.00')).toBeInTheDocument();
    expect(screen.getByText('Missing modifier')).toBeInTheDocument();
  });

  it('shows Correct and Void buttons only for rejected claims', async () => {
    mockGetRejectedClaims.mockResolvedValue(CLAIMS_SUCCESS);
    mockGetResubmissionStats.mockResolvedValue(STATS_SUCCESS);

    render(<ClaimResubmissionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Aetna')).toBeInTheDocument();
    });

    // Rejected claim should have Correct + Void + History (3 buttons)
    const correctBtns = screen.getAllByText('Correct');
    expect(correctBtns).toHaveLength(1); // Only claim-001 is rejected

    const voidBtns = screen.getAllByText('Void');
    expect(voidBtns).toHaveLength(1);

    // Both claims should have History
    const historyBtns = screen.getAllByText('History');
    expect(historyBtns).toHaveLength(2);
  });

  it('applies status filter when changed', async () => {
    mockGetRejectedClaims.mockResolvedValue(CLAIMS_SUCCESS);
    mockGetResubmissionStats.mockResolvedValue(STATS_SUCCESS);

    render(<ClaimResubmissionDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Aetna')).toBeInTheDocument();
    });

    const select = screen.getByLabelText('Filter by status');
    await user.selectOptions(select, 'rejected');

    // Should re-fetch with filter
    expect(mockGetRejectedClaims).toHaveBeenCalledWith('rejected', '');
  });

  it('applies search term when typing', async () => {
    mockGetRejectedClaims.mockResolvedValue(CLAIMS_SUCCESS);
    mockGetResubmissionStats.mockResolvedValue(STATS_SUCCESS);

    render(<ClaimResubmissionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Aetna')).toBeInTheDocument();
    });

    const searchInput = screen.getByLabelText('Search claims');
    fireEvent.change(searchInput, { target: { value: 'Blue' } });

    await waitFor(() => {
      expect(mockGetRejectedClaims).toHaveBeenCalledWith('all', 'Blue');
    });
  });

  it('opens correction modal and creates corrected claim', async () => {
    mockGetRejectedClaims.mockResolvedValue(CLAIMS_SUCCESS);
    mockGetResubmissionStats.mockResolvedValue(STATS_SUCCESS);
    mockCreateCorrectedClaim.mockResolvedValue({
      success: true, data: { new_claim_id: 'new-claim-1' }, error: null,
    });

    render(<ClaimResubmissionDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Aetna')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Correct'));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Create corrected claim' })).toBeInTheDocument();
    });

    expect(screen.getByText(/Original Claim:/)).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/Describe what was corrected/);
    await user.type(textarea, 'Updated diagnosis code from E11.9 to E11.65');

    const submitBtn = screen.getByRole('button', { name: /Create Corrected Claim/ });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateCorrectedClaim).toHaveBeenCalledWith({
        original_claim_id: 'claim-001',
        correction_note: 'Updated diagnosis code from E11.9 to E11.65',
      });
    });
  });

  it('disables correction submit when note is too short', async () => {
    mockGetRejectedClaims.mockResolvedValue(CLAIMS_SUCCESS);
    mockGetResubmissionStats.mockResolvedValue(STATS_SUCCESS);

    render(<ClaimResubmissionDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Aetna')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Correct'));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Create corrected claim' })).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/Describe what was corrected/);
    await user.type(textarea, 'short');

    expect(screen.getByText(/more characters needed/)).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: /Create Corrected Claim/ });
    expect(submitBtn).toBeDisabled();
  });

  it('opens void modal and voids claim', async () => {
    mockGetRejectedClaims.mockResolvedValue(CLAIMS_SUCCESS);
    mockGetResubmissionStats.mockResolvedValue(STATS_SUCCESS);
    mockVoidRejectedClaim.mockResolvedValue({
      success: true, data: { voided: true }, error: null,
    });

    render(<ClaimResubmissionDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Aetna')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Void'));

    await waitFor(() => {
      expect(screen.getByText('Void Rejected Claim')).toBeInTheDocument();
    });

    expect(screen.getByText(/This action is permanent/)).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/Explain why this claim cannot be recovered/);
    await user.type(textarea, 'Unrecoverable: wrong patient billing');

    await user.click(screen.getByText('Confirm Void'));

    await waitFor(() => {
      expect(mockVoidRejectedClaim).toHaveBeenCalledWith(
        'claim-001',
        'Unrecoverable: wrong patient billing',
      );
    });
  });

  it('disables void submit when reason is too short', async () => {
    mockGetRejectedClaims.mockResolvedValue(CLAIMS_SUCCESS);
    mockGetResubmissionStats.mockResolvedValue(STATS_SUCCESS);

    render(<ClaimResubmissionDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Aetna')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Void'));

    await waitFor(() => {
      expect(screen.getByText('Void Rejected Claim')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/Explain why/);
    await user.type(textarea, 'short');

    const submitBtn = screen.getByRole('button', { name: /Confirm Void/ });
    expect(submitBtn).toBeDisabled();
  });

  it('opens chain modal showing resubmission history', async () => {
    mockGetRejectedClaims.mockResolvedValue(CLAIMS_SUCCESS);
    mockGetResubmissionStats.mockResolvedValue(STATS_SUCCESS);
    mockGetResubmissionChain.mockResolvedValue({
      success: true, data: MOCK_CHAIN, error: null,
    });

    render(<ClaimResubmissionDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Aetna')).toBeInTheDocument();
    });

    const historyBtns = screen.getAllByText('History');
    await user.click(historyBtns[0]);

    await waitFor(() => {
      expect(screen.getByText('Resubmission History')).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog', { name: 'Resubmission chain' });
    expect(dialog).toHaveTextContent(/CTL-001/);
    expect(dialog).toHaveTextContent(/CTL-100/);
    expect(dialog).toHaveTextContent('Current');
  });

  it('shows empty state when no rejected claims exist', async () => {
    mockGetRejectedClaims.mockResolvedValue(EMPTY_CLAIMS);
    mockGetResubmissionStats.mockResolvedValue(STATS_NO_DEADLINE);

    render(<ClaimResubmissionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('No rejected claims')).toBeInTheDocument();
    });

    expect(screen.getByText('All claims are in good standing.')).toBeInTheDocument();
  });

  it('shows error alert when fetch fails', async () => {
    mockGetRejectedClaims.mockResolvedValue({
      success: false, data: null, error: { code: 'DATABASE_ERROR', message: 'Connection timeout' },
    });
    mockGetResubmissionStats.mockResolvedValue(STATS_SUCCESS);

    render(<ClaimResubmissionDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Connection timeout')).toBeInTheDocument();
    });
  });
});
