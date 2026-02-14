/**
 * SuperbillReviewPanel Test Suite
 *
 * Tests: claim list, detail load, signature required, reject requires reason,
 * approve refreshes list.
 * Deletion Test: All tests fail if component logic is removed.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import SuperbillReviewPanel from '../SuperbillReviewPanel';

// Mock BillingService
const mockGetClaimsAwaitingApproval = vi.fn();
const mockGetClaimLines = vi.fn();
const mockApproveSuperbill = vi.fn();
const mockRejectSuperbill = vi.fn();

vi.mock('../../../services/billingService', () => ({
  BillingService: {
    getClaimsAwaitingApproval: (...args: unknown[]) => mockGetClaimsAwaitingApproval(...args),
    getClaimLines: (...args: unknown[]) => mockGetClaimLines(...args),
    approveSuperbill: (...args: unknown[]) => mockApproveSuperbill(...args),
    rejectSuperbill: (...args: unknown[]) => mockRejectSuperbill(...args),
  },
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({ from: vi.fn() }),
  useUser: () => ({ id: 'provider-1', email: 'dr.test@hospital.com', role: 'physician' }),
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    clinical: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockClaims = [
  {
    id: 'claim-1',
    encounter_id: 'enc-1',
    claim_type: '837P',
    status: 'generated',
    approval_status: 'pending',
    total_charge: 250.00,
    control_number: 'CTL-001',
    created_by: 'system',
    created_at: '2026-02-15T10:00:00Z',
    updated_at: '2026-02-15T10:00:00Z',
  },
  {
    id: 'claim-2',
    encounter_id: 'enc-2',
    claim_type: '837P',
    status: 'generated',
    approval_status: 'pending',
    total_charge: 500.00,
    control_number: 'CTL-002',
    created_by: 'system',
    created_at: '2026-02-15T11:00:00Z',
    updated_at: '2026-02-15T11:00:00Z',
  },
];

const mockLines = [
  {
    id: 'line-1',
    claim_id: 'claim-1',
    code_system: 'CPT',
    procedure_code: '99213',
    modifiers: ['25'],
    units: 1,
    charge_amount: 150.00,
    diagnosis_pointers: [1],
    created_at: '2026-02-15T10:00:00Z',
    updated_at: '2026-02-15T10:00:00Z',
  },
  {
    id: 'line-2',
    claim_id: 'claim-1',
    code_system: 'CPT',
    procedure_code: '90658',
    modifiers: [],
    units: 1,
    charge_amount: 100.00,
    diagnosis_pointers: [1],
    created_at: '2026-02-15T10:00:00Z',
    updated_at: '2026-02-15T10:00:00Z',
  },
];

describe('SuperbillReviewPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClaimsAwaitingApproval.mockResolvedValue(mockClaims);
    mockGetClaimLines.mockResolvedValue(mockLines);
    mockApproveSuperbill.mockResolvedValue({ success: true, data: { claim_id: 'claim-1' } });
    mockRejectSuperbill.mockResolvedValue({ success: true, data: { claim_id: 'claim-1' } });
  });

  it('renders header and pending count badge', async () => {
    render(<SuperbillReviewPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Superbill Provider Sign-Off/i)).toBeInTheDocument();
      expect(screen.getByText('2 Pending')).toBeInTheDocument();
    });
  });

  it('displays pending claims list with charge amounts', async () => {
    render(<SuperbillReviewPanel />);

    await waitFor(() => {
      expect(screen.getByText('$250.00')).toBeInTheDocument();
      expect(screen.getByText('$500.00')).toBeInTheDocument();
    });
  });

  it('displays control numbers', async () => {
    render(<SuperbillReviewPanel />);

    await waitFor(() => {
      expect(screen.getByText('CTL-001')).toBeInTheDocument();
      expect(screen.getByText('CTL-002')).toBeInTheDocument();
    });
  });

  it('shows "All Clear" when no pending claims', async () => {
    mockGetClaimsAwaitingApproval.mockResolvedValue([]);

    render(<SuperbillReviewPanel />);

    await waitFor(() => {
      expect(screen.getByText('All Clear')).toBeInTheDocument();
      expect(screen.getByText(/No superbills awaiting review/i)).toBeInTheDocument();
    });
  });

  it('loads claim lines when a claim is selected', async () => {
    render(<SuperbillReviewPanel />);

    await waitFor(() => {
      expect(screen.getByText('CTL-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('CTL-001'));

    await waitFor(() => {
      expect(mockGetClaimLines).toHaveBeenCalledWith('claim-1');
      expect(screen.getByText('99213')).toBeInTheDocument();
      expect(screen.getByText('90658')).toBeInTheDocument();
    });
  });

  it('shows certification checkbox and signature field in approval section', async () => {
    render(<SuperbillReviewPanel />);

    await waitFor(() => {
      expect(screen.getByText('CTL-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('CTL-001'));

    await waitFor(() => {
      expect(screen.getByText(/I certify that the services listed/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/type your full name/i)).toBeInTheDocument();
    });
  });

  it('approve button is disabled without signature and agreement', async () => {
    render(<SuperbillReviewPanel />);

    await waitFor(() => {
      expect(screen.getByText('CTL-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('CTL-001'));

    await waitFor(() => {
      const approveButton = screen.getByRole('button', { name: /approve superbill/i });
      expect(approveButton).toBeDisabled();
    });
  });

  it('approves superbill and refreshes list', async () => {
    // After approval, return empty list
    mockGetClaimsAwaitingApproval
      .mockResolvedValueOnce(mockClaims) // initial load
      .mockResolvedValueOnce([]); // after approval

    render(<SuperbillReviewPanel />);

    await waitFor(() => {
      expect(screen.getByText('CTL-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('CTL-001'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type your full name/i)).toBeInTheDocument();
    });

    // Fill signature
    fireEvent.change(screen.getByPlaceholderText(/type your full name/i), { target: { value: 'Dr. Test' } });

    // Check agreement
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    // Click approve
    const approveButton = screen.getByRole('button', { name: /approve superbill/i });
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(mockApproveSuperbill).toHaveBeenCalledWith('claim-1', 'provider-1', undefined);
    });

    await waitFor(() => {
      expect(screen.getByText(/approved and ready for submission/i)).toBeInTheDocument();
    });
  });

  it('shows return for revision form', async () => {
    render(<SuperbillReviewPanel />);

    await waitFor(() => {
      expect(screen.getByText('CTL-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('CTL-001'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /return for revision/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /return for revision/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/explain what needs to be corrected/i)).toBeInTheDocument();
    });
  });

  it('return button disabled when reason is under 10 chars', async () => {
    render(<SuperbillReviewPanel />);

    await waitFor(() => {
      expect(screen.getByText('CTL-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('CTL-001'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /return for revision/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /return for revision/i }));

    await waitFor(() => {
      const returnButton = screen.getByRole('button', { name: /return superbill/i });
      expect(returnButton).toBeDisabled();
    });
  });

  it('rejects superbill with valid reason', async () => {
    mockGetClaimsAwaitingApproval
      .mockResolvedValueOnce(mockClaims)
      .mockResolvedValueOnce([]);

    render(<SuperbillReviewPanel />);

    await waitFor(() => {
      expect(screen.getByText('CTL-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('CTL-001'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /return for revision/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /return for revision/i }));

    await waitFor(() => {
      const reasonInput = screen.getByPlaceholderText(/explain what needs to be corrected/i);
      fireEvent.change(reasonInput, { target: { value: 'E/M level is too high for the documented visit complexity' } });
    });

    const returnButton = screen.getByRole('button', { name: /return superbill/i });
    fireEvent.click(returnButton);

    await waitFor(() => {
      expect(mockRejectSuperbill).toHaveBeenCalledWith(
        'claim-1',
        'provider-1',
        'E/M level is too high for the documented visit complexity'
      );
    });
  });

  it('displays error message on load failure', async () => {
    mockGetClaimsAwaitingApproval.mockRejectedValue(new Error('Network error'));

    render(<SuperbillReviewPanel />);

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });
});
