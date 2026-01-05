/**
 * Tests for BillingReviewDashboard Component
 *
 * Purpose: Verify billing review dashboard for AI-generated claims
 * Coverage: Rendering, stats, filters, claim list
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BillingReviewDashboard } from '../BillingReviewDashboard';

// Mock AuthContext
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'reviewer-123', email: 'reviewer@test.com' },
  }),
}));

// Mock Supabase - factory must be self-contained
vi.mock('../../../lib/supabaseClient', () => {
  const mockClaimsData = [
    {
      id: 'claim-1',
      claim_number: 'CLM-001',
      service_date: '2024-01-15',
      total_charge: 250,
      expected_reimbursement: 200,
      review_status: 'pending_review',
      ai_confidence_score: 0.95,
      ai_flags: [],
      created_at: '2024-01-15T10:00:00Z',
      encounter_id: 'enc-1',
      encounters: {
        patient_id: 'patient-1',
        encounter_type: 'office_visit',
        chief_complaint: 'Annual checkup',
        provider: { first_name: 'John', last_name: 'Smith' },
      },
    },
    {
      id: 'claim-2',
      claim_number: 'CLM-002',
      service_date: '2024-01-16',
      total_charge: 750,
      expected_reimbursement: 600,
      review_status: 'flagged',
      ai_confidence_score: 0.65,
      ai_flags: [
        { code: 'UPCODING', name: 'Potential Upcoding', severity: 'high', details: {}, flagged_at: '2024-01-16T10:00:00Z' },
      ],
      created_at: '2024-01-16T10:00:00Z',
      encounter_id: 'enc-2',
      encounters: {
        patient_id: 'patient-2',
        encounter_type: 'telehealth',
        chief_complaint: 'Follow-up visit',
        provider: { first_name: 'Jane', last_name: 'Doe' },
      },
    },
  ];

  const mockProfilesData = [
    { user_id: 'patient-1', first_name: 'Alice', last_name: 'Johnson' },
    { user_id: 'patient-2', first_name: 'Bob', last_name: 'Williams' },
  ];

  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: mockProfilesData, error: null }),
            }),
          };
        }
        if (table === 'claim_lines') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ cpt_code: '99213', description: 'Office visit', units: 1, charge_amount: 250, icd10_codes: ['I10'] }],
                error: null,
              }),
            }),
          };
        }
        // Default: claims table
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockClaimsData, error: null }),
            }),
          }),
        };
      }),
      rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    },
  };
});

describe('BillingReviewDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Rendering', () => {
    it('should render dashboard header', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Billing Review Dashboard')).toBeInTheDocument();
        expect(screen.getByText(/Review AI-generated claims/)).toBeInTheDocument();
      });
    });

    it('should display stats cards', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Pending Review')).toBeInTheDocument();
        expect(screen.getByText('Flagged')).toBeInTheDocument();
        expect(screen.getByText('Total Value')).toBeInTheDocument();
        expect(screen.getByText('Expected Revenue')).toBeInTheDocument();
      });
    });

    it('should display filter buttons', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /All Claims/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Flagged Only/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /High Value/i })).toBeInTheDocument();
      });
    });
  });

  describe('Claims List', () => {
    it('should display claims section after load', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(
        () => {
          // Text includes the count: "Claims Awaiting Review (2)"
          expect(screen.getByText(/Claims Awaiting Review/)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should show placeholder when no claim selected', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(
        () => {
          expect(screen.getByText(/Select a claim to review/)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Filters', () => {
    it('should highlight active filter', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        const allButton = screen.getByRole('button', { name: /All Claims/i });
        expect(allButton).toHaveClass('bg-blue-600');
      });
    });

    it('should switch filter when clicked', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Flagged Only/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Flagged Only/i }));

      await waitFor(() => {
        // Flagged filter uses orange color when active
        const flaggedButton = screen.getByRole('button', { name: /Flagged Only/i });
        expect(flaggedButton).toHaveClass('bg-orange-600');
      });
    });
  });

  describe('Stats Calculation', () => {
    it('should calculate total value correctly', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        // 250 + 750 = 1,000
        expect(screen.getByText('$1,000')).toBeInTheDocument();
      });
    });
  });

  describe('Display Elements', () => {
    it('should display claim confidence scores', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/95% confident/)).toBeInTheDocument();
      });
    });

    it('should display AI flags for flagged claims', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Potential Upcoding')).toBeInTheDocument();
      });
    });

    it('should display claim amounts', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        expect(screen.getByText('$250')).toBeInTheDocument();
      });
    });
  });

  describe('Confidence Indicator', () => {
    it('should show green for high confidence (>= 90%)', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        const confidenceText = screen.getByText('95% confident');
        expect(confidenceText.className).toContain('green');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible filter buttons', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        const allButton = screen.getByRole('button', { name: /All Claims/i });
        expect(allButton).toBeInTheDocument();
      });
    });
  });
});
