/**
 * BillingSuiteDashboard - Tab navigation and lazy loading tests
 *
 * Tests behavioral outcomes: tab switching renders correct content,
 * sub-tab navigation works, and all 6 main tabs are accessible.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Mock all lazy-loaded billing components to avoid pulling full component trees
vi.mock('../../admin/BillingDashboard', () => ({
  default: () => <div data-testid="billing-dashboard">Billing Dashboard Content</div>,
}));
vi.mock('../../atlas/RevenueDashboard', () => ({
  default: () => <div data-testid="revenue-dashboard">Revenue Dashboard Content</div>,
}));
vi.mock('../../admin/StaffFinancialSavingsTracker', () => ({
  default: () => <div data-testid="savings-tracker">Staff Savings Content</div>,
}));
vi.mock('../../admin/EligibilityVerificationPanel', () => ({
  default: () => <div data-testid="eligibility-panel">Eligibility Content</div>,
}));
vi.mock('../../admin/PriorAuthDashboard', () => ({
  default: () => <div data-testid="prior-auth">Prior Auth Content</div>,
}));
vi.mock('../../atlas/ClaimsSubmissionPanel', () => ({
  default: () => <div data-testid="claims-submission">Claims Submission Content</div>,
}));
vi.mock('../../admin/BillingQueueDashboard', () => ({
  default: () => <div data-testid="billing-queue">Billing Queue Content</div>,
}));
vi.mock('../../admin/SuperbillReviewPanel', () => ({
  default: () => <div data-testid="superbill">Superbill Content</div>,
}));
vi.mock('../../admin/ClaimAgingDashboard', () => ({
  default: () => <div data-testid="claim-aging">Claim Aging Content</div>,
}));
vi.mock('../../admin/ERAPaymentPostingDashboard', () => ({
  default: () => <div data-testid="era-posting">ERA Posting Content</div>,
}));
vi.mock('../../atlas/ClaimsAppealsPanel', () => ({
  default: () => <div data-testid="claims-appeals">Claims Appeals Content</div>,
}));
vi.mock('../../admin/ClaimResubmissionDashboard', () => ({
  default: () => <div data-testid="claim-resubmit">Claim Resubmission Content</div>,
}));
vi.mock('../../admin/UndercodingDetectionDashboard', () => ({
  default: () => <div data-testid="undercoding">Undercoding Content</div>,
}));
vi.mock('../../admin/HCCOpportunityDashboard', () => ({
  default: () => <div data-testid="hcc-flags">HCC Flags Content</div>,
}));
vi.mock('../../admin/DocumentationGapDashboard', () => ({
  default: () => <div data-testid="doc-gaps">Documentation Gaps Content</div>,
}));

// Mock AdminHeader
vi.mock('../../admin/AdminHeader', () => ({
  default: () => <div data-testid="admin-header">Header</div>,
}));

// Mock contexts
vi.mock('../../../contexts/AdminAuthContext', () => ({
  useAdminAuth: () => ({
    adminUser: { id: 'test-admin', email: 'test@test.com' },
    adminRole: 'super_admin',
  }),
}));
vi.mock('../../../BrandingContext', () => ({
  useBranding: () => ({ orgName: 'Test Org', primaryColor: '#00857a' }),
}));

import { BillingSuiteDashboard } from '../BillingSuiteDashboard';

const renderDashboard = () => {
  return render(
    <MemoryRouter>
      <BillingSuiteDashboard />
    </MemoryRouter>
  );
};

describe('BillingSuiteDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Header and Layout', () => {
    it('should render the Billing Suite title', async () => {
      renderDashboard();
      expect(screen.getByText('Billing Suite')).toBeInTheDocument();
    });

    it('should render the revenue cycle description', () => {
      renderDashboard();
      expect(screen.getByText(/revenue cycle management/i)).toBeInTheDocument();
    });

    it('should render the AdminHeader', () => {
      renderDashboard();
      expect(screen.getByTestId('admin-header')).toBeInTheDocument();
    });
  });

  describe('Main Tab Navigation', () => {
    it('should render all 6 main tabs', () => {
      renderDashboard();
      expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /verify/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /claims/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /track/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /appeals/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /intelligence/i })).toBeInTheDocument();
    });

    it('should default to Overview tab as active', () => {
      renderDashboard();
      const overviewTab = screen.getByRole('tab', { name: /overview/i });
      expect(overviewTab).toHaveAttribute('aria-selected', 'true');
    });

    it('should show billing dashboard content on Overview tab', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByTestId('billing-dashboard')).toBeInTheDocument();
      });
    });

    it('should switch to Verify tab and show eligibility content', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('tab', { name: /verify/i }));
      await waitFor(() => {
        expect(screen.getByTestId('eligibility-panel')).toBeInTheDocument();
      });
    });

    it('should switch to Claims tab and show claims submission content', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('tab', { name: /claims/i }));
      await waitFor(() => {
        expect(screen.getByTestId('claims-submission')).toBeInTheDocument();
      });
    });

    it('should switch to Track tab and show claim aging content', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('tab', { name: /track/i }));
      await waitFor(() => {
        expect(screen.getByTestId('claim-aging')).toBeInTheDocument();
      });
    });

    it('should switch to Appeals tab and show appeals content', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('tab', { name: /appeals/i }));
      await waitFor(() => {
        expect(screen.getByTestId('claims-appeals')).toBeInTheDocument();
      });
    });

    it('should switch to Intelligence tab and show undercoding content', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('tab', { name: /intelligence/i }));
      await waitFor(() => {
        expect(screen.getByTestId('undercoding')).toBeInTheDocument();
      });
    });
  });

  describe('Sub-Tab Navigation', () => {
    it('should show Revenue Analytics sub-tab when clicked in Overview', async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText('Revenue Analytics')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Revenue Analytics'));
      await waitFor(() => {
        expect(screen.getByTestId('revenue-dashboard')).toBeInTheDocument();
      });
    });

    it('should show Prior Authorization sub-tab when clicked in Verify', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('tab', { name: /verify/i }));
      await waitFor(() => {
        expect(screen.getByText('Prior Authorization')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Prior Authorization'));
      await waitFor(() => {
        expect(screen.getByTestId('prior-auth')).toBeInTheDocument();
      });
    });

    it('should show Billing Queue sub-tab when clicked in Claims', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('tab', { name: /claims/i }));
      await waitFor(() => {
        expect(screen.getByText('Billing Queue')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Billing Queue'));
      await waitFor(() => {
        expect(screen.getByTestId('billing-queue')).toBeInTheDocument();
      });
    });

    it('should show ERA Payment Posting sub-tab when clicked in Track', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('tab', { name: /track/i }));
      await waitFor(() => {
        expect(screen.getByText('ERA Payment Posting')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('ERA Payment Posting'));
      await waitFor(() => {
        expect(screen.getByTestId('era-posting')).toBeInTheDocument();
      });
    });

    it('should show HCC Opportunity Flags sub-tab in Intelligence', async () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('tab', { name: /intelligence/i }));
      await waitFor(() => {
        expect(screen.getByText('HCC Opportunity Flags')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('HCC Opportunity Flags'));
      await waitFor(() => {
        expect(screen.getByTestId('hcc-flags')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper tab ARIA roles', () => {
      renderDashboard();
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBe(6);
      tabs.forEach(tab => {
        expect(tab).toHaveAttribute('aria-selected');
      });
    });

    it('should have tabpanel role for active content', () => {
      renderDashboard();
      const tabpanel = screen.getByRole('tabpanel');
      expect(tabpanel).toBeInTheDocument();
    });

    it('should have minimum 44px touch targets on sub-tab buttons', async () => {
      renderDashboard();
      await waitFor(() => {
        const subTabButtons = screen.getAllByRole('button');
        subTabButtons.forEach(btn => {
          // min-h-[44px] is applied via className
          expect(btn.className).toContain('min-h-[44px]');
        });
      });
    });
  });
});
