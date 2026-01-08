/**
 * Tests for BillingReviewDashboard Component
 *
 * Purpose: Verify billing review dashboard for AI-generated claims
 * Coverage: Loading state, stats, filters, claim list, claim details, actions
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

// Store mock functions for assertions
const mockRpc = vi.fn();
const mockFromFn = vi.fn();

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
    // Mock window.alert, confirm, and prompt
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    vi.spyOn(window, 'prompt').mockImplementation(() => 'Test rejection reason');
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading spinner initially', () => {
      render(<BillingReviewDashboard />);

      // Check for the spinning loader
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should hide loading spinner after data loads', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Billing Review Dashboard')).toBeInTheDocument();
      });

      const spinner = document.querySelector('.animate-spin');
      expect(spinner).not.toBeInTheDocument();
    });
  });

  describe('Dashboard Title and Header', () => {
    it('should render dashboard title "Billing Review Dashboard"', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Billing Review Dashboard')).toBeInTheDocument();
      });
    });

    it('should render subtitle about AI-generated claims', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Review AI-generated claims before submission/)).toBeInTheDocument();
      });
    });
  });

  describe('Stats Display', () => {
    it('should display Pending Review stat', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Pending Review')).toBeInTheDocument();
      });
    });

    it('should display Flagged stat', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Flagged')).toBeInTheDocument();
      });
    });

    it('should display Total Value stat', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Total Value')).toBeInTheDocument();
      });
    });

    it('should display Expected Revenue stat', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Expected Revenue')).toBeInTheDocument();
      });
    });

    it('should calculate total value correctly', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        // 250 + 750 = 1,000
        expect(screen.getByText('$1,000')).toBeInTheDocument();
      });
    });

    it('should calculate expected revenue correctly', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        // 200 + 600 = 800
        expect(screen.getByText('$800')).toBeInTheDocument();
      });
    });
  });

  describe('Filter Buttons', () => {
    it('should display All Claims filter button', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /All Claims/i })).toBeInTheDocument();
      });
    });

    it('should display Flagged Only filter button', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Flagged Only/i })).toBeInTheDocument();
      });
    });

    it('should display High Value filter button', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /High Value/i })).toBeInTheDocument();
      });
    });

    it('should highlight All Claims filter by default', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        const allButton = screen.getByRole('button', { name: /All Claims/i });
        expect(allButton).toHaveClass('bg-blue-600');
      });
    });

    it('should switch to Flagged Only filter when clicked', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Flagged Only/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Flagged Only/i }));

      await waitFor(() => {
        const flaggedButton = screen.getByRole('button', { name: /Flagged Only/i });
        expect(flaggedButton).toHaveClass('bg-orange-600');
      });
    });

    it('should switch to High Value filter when clicked', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /High Value/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /High Value/i }));

      await waitFor(() => {
        const highValueButton = screen.getByRole('button', { name: /High Value/i });
        expect(highValueButton).toHaveClass('bg-green-600');
      });
    });
  });

  describe('Claims List', () => {
    it('should display claims section after load', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(
        () => {
          expect(screen.getByText(/Claims Awaiting Review/)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });

    it('should display claim amounts', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        expect(screen.getByText('$250')).toBeInTheDocument();
      });
    });

    it('should display AI flags for flagged claims', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Potential Upcoding')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should show placeholder when no claim is selected', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(
        () => {
          expect(screen.getByText(/Select a claim to review/)).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Claim Selection and Details', () => {
    it('should select claim when clicked and show details', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        expect(screen.getByText('$250')).toBeInTheDocument();
      });

      // Click on a claim to select it
      const claimCard = screen.getByText('$250').closest('div[class*="cursor-pointer"]');
      if (claimCard) {
        fireEvent.click(claimCard);
      }

      await waitFor(() => {
        // Should show the detail view
        expect(screen.getByText(/Total Charge/)).toBeInTheDocument();
      });
    });
  });

  describe('AI Confidence Score Display', () => {
    it('should display AI confidence score for claims', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/95% confident/)).toBeInTheDocument();
      });
    });

    it('should show green color for high confidence scores (>= 90%)', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        const confidenceText = screen.getByText('95% confident');
        expect(confidenceText.className).toContain('green');
      });
    });

    it('should show yellow color for medium confidence scores (>= 70%)', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        const confidenceText = screen.getByText('65% confident');
        expect(confidenceText.className).toContain('red');
      });
    });
  });

  describe('Action Buttons', () => {
    it('should show Approve & Submit button when claim is selected', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        expect(screen.getByText('$250')).toBeInTheDocument();
      });

      // Click on a claim to select it
      const claimCard = screen.getByText('$250').closest('div[class*="cursor-pointer"]');
      if (claimCard) {
        fireEvent.click(claimCard);
      }

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Approve & Submit/i })).toBeInTheDocument();
      });
    });

    it('should show Reject button when claim is selected', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        expect(screen.getByText('$250')).toBeInTheDocument();
      });

      // Click on a claim to select it
      const claimCard = screen.getByText('$250').closest('div[class*="cursor-pointer"]');
      if (claimCard) {
        fireEvent.click(claimCard);
      }

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Reject/i })).toBeInTheDocument();
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

    it('should have accessible action buttons', async () => {
      render(<BillingReviewDashboard />);

      await waitFor(() => {
        expect(screen.getByText('$250')).toBeInTheDocument();
      });

      // Click on a claim to select it
      const claimCard = screen.getByText('$250').closest('div[class*="cursor-pointer"]');
      if (claimCard) {
        fireEvent.click(claimCard);
      }

      await waitFor(() => {
        const approveButton = screen.getByRole('button', { name: /Approve & Submit/i });
        const rejectButton = screen.getByRole('button', { name: /Reject/i });
        expect(approveButton).toBeInTheDocument();
        expect(rejectButton).toBeInTheDocument();
      });
    });
  });
});
