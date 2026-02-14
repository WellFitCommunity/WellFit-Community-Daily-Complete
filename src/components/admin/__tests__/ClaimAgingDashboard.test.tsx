/**
 * ClaimAgingDashboard tests — validates aging bucket cards, claim rows,
 * filters, history modal, alert banner, loading/empty states.
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

const mockGetAgingClaims = vi.fn();
const mockGetAgingStats = vi.fn();
const mockGetClaimHistory = vi.fn();

vi.mock('../../../services/claimAgingService', () => ({
  claimAgingService: {
    getAgingClaims: (...args: unknown[]) => mockGetAgingClaims(...args),
    getAgingStats: (...args: unknown[]) => mockGetAgingStats(...args),
    getClaimHistory: (...args: unknown[]) => mockGetClaimHistory(...args),
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

import ClaimAgingDashboard from '../ClaimAgingDashboard';

// ============================================================================
// FIXTURES
// ============================================================================

const MOCK_CLAIMS = [
  {
    claim_id: 'claim-1',
    encounter_id: 'enc-1',
    payer_name: 'Aetna',
    status: 'submitted',
    total_charge: 1500.00,
    control_number: 'CTL-001',
    created_at: '2025-12-01T10:00:00Z',
    updated_at: '2025-12-05T10:00:00Z',
    aging_days: 75,
  },
  {
    claim_id: 'claim-2',
    encounter_id: 'enc-2',
    payer_name: 'BlueCross',
    status: 'rejected',
    total_charge: 2500.50,
    control_number: 'CTL-002',
    created_at: '2025-10-01T10:00:00Z',
    updated_at: '2025-10-10T10:00:00Z',
    aging_days: 136,
  },
  {
    claim_id: 'claim-3',
    encounter_id: null,
    payer_name: null,
    status: 'generated',
    total_charge: 800.00,
    control_number: null,
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
    aging_days: 30,
  },
];

const MOCK_STATS = {
  success: true,
  data: {
    bucket_0_30: 1,
    bucket_31_60: 0,
    bucket_61_90: 1,
    bucket_90_plus: 1,
    total_outstanding: 3,
    total_amount: 4800.50,
  },
};

const MOCK_CLAIMS_RESULT = {
  success: true,
  data: MOCK_CLAIMS,
};

const MOCK_EMPTY_RESULT = {
  success: true,
  data: [],
};

const MOCK_EMPTY_STATS = {
  success: true,
  data: {
    bucket_0_30: 0,
    bucket_31_60: 0,
    bucket_61_90: 0,
    bucket_90_plus: 0,
    total_outstanding: 0,
    total_amount: 0,
  },
};

// ============================================================================
// TESTS
// ============================================================================

describe('ClaimAgingDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 4 aging bucket metric cards with correct labels', async () => {
    mockGetAgingClaims.mockResolvedValue(MOCK_CLAIMS_RESULT);
    mockGetAgingStats.mockResolvedValue(MOCK_STATS);

    render(<ClaimAgingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('0-30 Days')).toBeInTheDocument();
    });

    expect(screen.getByText('31-60 Days')).toBeInTheDocument();
    expect(screen.getByText('61-90 Days')).toBeInTheDocument();
    expect(screen.getByText('90+ Days')).toBeInTheDocument();

    // Verify correct color scheme on bucket cards
    const greenCard = screen.getByText('0-30 Days').closest('div');
    expect(greenCard).toHaveClass('bg-green-50');

    const redCard = screen.getByText('90+ Days').closest('div');
    expect(redCard).toHaveClass('bg-red-50');
  });

  it('shows critical alert banner when 90+ day claims exist', async () => {
    mockGetAgingClaims.mockResolvedValue(MOCK_CLAIMS_RESULT);
    mockGetAgingStats.mockResolvedValue(MOCK_STATS);

    render(<ClaimAgingDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/1 claim aging 90\+ days/)).toBeInTheDocument();
    });
  });

  it('does not show alert banner when no 90+ day claims', async () => {
    mockGetAgingClaims.mockResolvedValue(MOCK_CLAIMS_RESULT);
    mockGetAgingStats.mockResolvedValue(MOCK_EMPTY_STATS);

    render(<ClaimAgingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Aging Claims')).toBeInTheDocument();
    });

    expect(screen.queryByText(/aging 90\+ days/)).not.toBeInTheDocument();
  });

  it('displays claim data in table rows with payer, status, and amount', async () => {
    mockGetAgingClaims.mockResolvedValue(MOCK_CLAIMS_RESULT);
    mockGetAgingStats.mockResolvedValue(MOCK_STATS);

    render(<ClaimAgingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Aetna')).toBeInTheDocument();
      expect(screen.getByText('BlueCross')).toBeInTheDocument();
    });

    // Control numbers
    expect(screen.getByText('CTL-001')).toBeInTheDocument();
    expect(screen.getByText('CTL-002')).toBeInTheDocument();

    // Status badges
    expect(screen.getByText('submitted')).toBeInTheDocument();
    expect(screen.getByText('rejected')).toBeInTheDocument();
    expect(screen.getByText('generated')).toBeInTheDocument();

    // Amounts
    expect(screen.getByText('$1,500.00')).toBeInTheDocument();
    expect(screen.getByText('$2,500.50')).toBeInTheDocument();
  });

  it('shows aging badges with correct day counts', async () => {
    mockGetAgingClaims.mockResolvedValue(MOCK_CLAIMS_RESULT);
    mockGetAgingStats.mockResolvedValue(MOCK_STATS);

    render(<ClaimAgingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('75d')).toBeInTheDocument();
      expect(screen.getByText('136d')).toBeInTheDocument();
      expect(screen.getByText('30d')).toBeInTheDocument();
    });
  });

  it('filters claims by status', async () => {
    mockGetAgingClaims.mockResolvedValue(MOCK_CLAIMS_RESULT);
    mockGetAgingStats.mockResolvedValue(MOCK_STATS);

    render(<ClaimAgingDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Aetna')).toBeInTheDocument();
    });

    // Filter to "rejected" only
    const statusSelect = screen.getByLabelText('Filter by status');
    await user.selectOptions(statusSelect, 'rejected');

    // Aetna (submitted) and Unknown (generated) should be hidden
    expect(screen.queryByText('Aetna')).not.toBeInTheDocument();
    expect(screen.getByText('BlueCross')).toBeInTheDocument();
  });

  it('filters claims by payer search', async () => {
    mockGetAgingClaims.mockResolvedValue(MOCK_CLAIMS_RESULT);
    mockGetAgingStats.mockResolvedValue(MOCK_STATS);

    render(<ClaimAgingDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Aetna')).toBeInTheDocument();
    });

    const payerInput = screen.getByLabelText('Search by payer');
    await user.type(payerInput, 'blue');

    expect(screen.queryByText('Aetna')).not.toBeInTheDocument();
    expect(screen.getByText('BlueCross')).toBeInTheDocument();
  });

  it('filters claims by control number search', async () => {
    mockGetAgingClaims.mockResolvedValue(MOCK_CLAIMS_RESULT);
    mockGetAgingStats.mockResolvedValue(MOCK_STATS);

    render(<ClaimAgingDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('CTL-001')).toBeInTheDocument();
    });

    const controlInput = screen.getByLabelText('Search by control number');
    await user.type(controlInput, 'CTL-002');

    expect(screen.queryByText('CTL-001')).not.toBeInTheDocument();
    expect(screen.getByText('CTL-002')).toBeInTheDocument();
  });

  it('opens and closes history modal when History button is clicked', async () => {
    mockGetAgingClaims.mockResolvedValue(MOCK_CLAIMS_RESULT);
    mockGetAgingStats.mockResolvedValue(MOCK_STATS);
    mockGetClaimHistory.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'hist-1',
          from_status: 'generated',
          to_status: 'submitted',
          note: 'Sent to clearinghouse',
          created_at: '2025-12-05T10:00:00Z',
        },
      ],
    });

    render(<ClaimAgingDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Aetna')).toBeInTheDocument();
    });

    // Click first History button
    const historyButtons = screen.getAllByText('History');
    await user.click(historyButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Claim Status History')).toBeInTheDocument();
      expect(screen.getByText('Sent to clearinghouse')).toBeInTheDocument();
    });

    // Close modal
    const closeButton = screen.getByLabelText('Close');
    await user.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText('Claim Status History')).not.toBeInTheDocument();
    });
  });

  it('shows loading state initially', async () => {
    // Never resolve to keep loading state
    mockGetAgingClaims.mockReturnValue(new Promise(() => {}));
    mockGetAgingStats.mockReturnValue(new Promise(() => {}));

    render(<ClaimAgingDashboard />);

    expect(screen.getByText('Loading claim aging data...')).toBeInTheDocument();
  });

  it('shows empty state when no claims exist', async () => {
    mockGetAgingClaims.mockResolvedValue(MOCK_EMPTY_RESULT);
    mockGetAgingStats.mockResolvedValue(MOCK_EMPTY_STATS);

    render(<ClaimAgingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('No aging claims found')).toBeInTheDocument();
      expect(screen.getByText('All claims are resolved or no outstanding claims exist.')).toBeInTheDocument();
    });
  });

  it('shows filter-empty state when filters exclude all claims', async () => {
    mockGetAgingClaims.mockResolvedValue(MOCK_CLAIMS_RESULT);
    mockGetAgingStats.mockResolvedValue(MOCK_STATS);

    render(<ClaimAgingDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Aetna')).toBeInTheDocument();
    });

    // Search for non-existent payer
    const payerInput = screen.getByLabelText('Search by payer');
    await user.type(payerInput, 'NonExistentPayer');

    expect(screen.getByText('No aging claims found')).toBeInTheDocument();
    expect(screen.getByText('No claims match the current filters.')).toBeInTheDocument();
  });

  it('shows error state when service fails', async () => {
    mockGetAgingClaims.mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'DATABASE_ERROR', message: 'Connection failed' },
    });
    mockGetAgingStats.mockResolvedValue(MOCK_EMPTY_STATS);

    render(<ClaimAgingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });
  });

  it('displays total outstanding amount', async () => {
    mockGetAgingClaims.mockResolvedValue(MOCK_CLAIMS_RESULT);
    mockGetAgingStats.mockResolvedValue(MOCK_STATS);

    render(<ClaimAgingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('$4,800.50')).toBeInTheDocument();
      expect(screen.getByText(/3 claims/)).toBeInTheDocument();
    });
  });

  it('shows "Unknown" for claims without a payer name', async () => {
    mockGetAgingClaims.mockResolvedValue(MOCK_CLAIMS_RESULT);
    mockGetAgingStats.mockResolvedValue(MOCK_STATS);

    render(<ClaimAgingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });

  it('refreshes data when Refresh button is clicked', async () => {
    mockGetAgingClaims.mockResolvedValue(MOCK_CLAIMS_RESULT);
    mockGetAgingStats.mockResolvedValue(MOCK_STATS);

    render(<ClaimAgingDashboard />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Aetna')).toBeInTheDocument();
    });

    // Both should have been called once during initial load
    expect(mockGetAgingClaims).toHaveBeenCalledTimes(1);

    // Click refresh
    await user.click(screen.getByText('Refresh'));

    await waitFor(() => {
      expect(mockGetAgingClaims).toHaveBeenCalledTimes(2);
      expect(mockGetAgingStats).toHaveBeenCalledTimes(2);
    });
  });
});
