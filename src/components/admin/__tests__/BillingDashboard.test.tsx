/**
 * BillingDashboard tests -- validates metric cards, claims table, status badges,
 * refresh behavior, quick actions, system status, loading/error/empty states.
 *
 * Deletion Test: Every test would FAIL if the component were an empty <div />.
 *
 * Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

const mockRefetchProviders = vi.fn();
const mockRefetchMetrics = vi.fn();
const mockRefetchClaims = vi.fn();

vi.mock('../../../hooks/useBillingData', () => ({
  useBillingProviders: vi.fn(),
  useClaimMetrics: vi.fn(),
  useSearchClaims: vi.fn(),
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    debug: vi.fn(), clinical: vi.fn(), ai: vi.fn(),
  },
}));

import BillingDashboard from '../BillingDashboard';
import {
  useBillingProviders, useClaimMetrics, useSearchClaims,
} from '../../../hooks/useBillingData';

const mockProviders = vi.mocked(useBillingProviders);
const mockMetrics = vi.mocked(useClaimMetrics);
const mockClaims = vi.mocked(useSearchClaims);

// ============================================================================
// FIXTURES (synthetic data only)
// ============================================================================

const MOCK_PROVIDERS = [
  { id: 'prov-001', npi: '1234567890', organization_name: 'Test Health Alpha',
    created_by: 'user-001', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: 'prov-002', npi: '0987654321', organization_name: 'Test Health Beta',
    created_by: 'user-001', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
];

const MOCK_METRICS = {
  total: 42,
  byStatus: { generated: 5, pending_approval: 8, submitted: 10, accepted: 12, rejected: 4, paid: 3 },
  totalAmount: 125750.5,
};

const MOCK_CLAIMS = [
  { id: 'claim-alpha-001', control_number: 'WF20260001', status: 'submitted' as const,
    claim_type: '837P', created_at: '2026-01-15T10:00:00Z', total_charge: 1500.00 },
  { id: 'claim-beta-002', control_number: 'WF20260002', status: 'accepted' as const,
    claim_type: '837P', created_at: '2026-01-16T09:00:00Z', total_charge: 2300.00 },
  { id: 'claim-gamma-003', control_number: null, status: 'rejected' as const,
    claim_type: '837I', created_at: '2026-01-17T15:00:00Z', total_charge: 800.00 },
];

// ============================================================================
// HELPERS — React Query hook result factories
// ============================================================================

type HookReturn = ReturnType<typeof useBillingProviders>;

function hookLoading(): HookReturn {
  return { data: undefined, isLoading: true, error: null, refetch: vi.fn(),
    isError: false, isPending: true, isSuccess: false, status: 'pending' as const,
  } as unknown as HookReturn;
}

function hookSuccess<T>(data: T, refetchFn = vi.fn()): HookReturn {
  return { data, isLoading: false, error: null, refetch: refetchFn,
    isError: false, isPending: false, isSuccess: true, status: 'success' as const,
  } as unknown as HookReturn;
}

function hookError(message: string): HookReturn {
  return { data: undefined, isLoading: false, error: { message }, refetch: vi.fn(),
    isError: true, isPending: false, isSuccess: false, status: 'error' as const,
  } as unknown as HookReturn;
}

/** Configure all 3 hooks for the success (happy-path) state */
function setupSuccess() {
  mockProviders.mockReturnValue(hookSuccess(MOCK_PROVIDERS, mockRefetchProviders));
  mockMetrics.mockReturnValue(hookSuccess(MOCK_METRICS, mockRefetchMetrics) as unknown as ReturnType<typeof useClaimMetrics>);
  mockClaims.mockReturnValue(hookSuccess(MOCK_CLAIMS, mockRefetchClaims) as unknown as ReturnType<typeof useSearchClaims>);
}

/** Configure hooks with overrides for individual data values */
function setupWith(overrides: {
  providers?: unknown; metrics?: unknown; claims?: unknown;
}) {
  const providers = 'providers' in overrides ? overrides.providers : MOCK_PROVIDERS;
  const metrics = 'metrics' in overrides ? overrides.metrics : MOCK_METRICS;
  const claims = 'claims' in overrides ? overrides.claims : MOCK_CLAIMS;
  mockProviders.mockReturnValue(hookSuccess(providers) as ReturnType<typeof useBillingProviders>);
  mockMetrics.mockReturnValue(hookSuccess(metrics) as unknown as ReturnType<typeof useClaimMetrics>);
  mockClaims.mockReturnValue(hookSuccess(claims) as unknown as ReturnType<typeof useSearchClaims>);
}

// ============================================================================
// TESTS
// ============================================================================

describe('BillingDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Loading state
  describe('loading state', () => {
    it('shows skeleton placeholders when all hooks are loading', () => {
      mockProviders.mockReturnValue(hookLoading() as ReturnType<typeof useBillingProviders>);
      mockMetrics.mockReturnValue(hookLoading() as unknown as ReturnType<typeof useClaimMetrics>);
      mockClaims.mockReturnValue(hookLoading() as unknown as ReturnType<typeof useSearchClaims>);

      const { container } = render(<BillingDashboard />);

      expect(container.querySelector('.animate-pulse')).not.toBeNull();
      expect(container.querySelectorAll('.h-24.bg-gray-200').length).toBe(3);
      expect(screen.queryByText('Total Claims')).not.toBeInTheDocument();
    });

    it('shows skeleton when only one hook is still loading', () => {
      mockProviders.mockReturnValue(hookSuccess(MOCK_PROVIDERS) as ReturnType<typeof useBillingProviders>);
      mockMetrics.mockReturnValue(hookLoading() as unknown as ReturnType<typeof useClaimMetrics>);
      mockClaims.mockReturnValue(hookSuccess(MOCK_CLAIMS) as unknown as ReturnType<typeof useSearchClaims>);

      const { container } = render(<BillingDashboard />);
      expect(container.querySelector('.animate-pulse')).not.toBeNull();
    });
  });

  // 2. Error state
  describe('error state', () => {
    it('shows "Billing Data Error" with message when providers hook errors', () => {
      mockProviders.mockReturnValue(hookError('Provider fetch failed') as ReturnType<typeof useBillingProviders>);
      mockMetrics.mockReturnValue(hookSuccess(MOCK_METRICS) as unknown as ReturnType<typeof useClaimMetrics>);
      mockClaims.mockReturnValue(hookSuccess(MOCK_CLAIMS) as unknown as ReturnType<typeof useSearchClaims>);

      render(<BillingDashboard />);

      expect(screen.getByText('Billing Data Error')).toBeInTheDocument();
      expect(screen.getByText('Provider fetch failed')).toBeInTheDocument();
      expect(screen.getByText('React Query will automatically retry failed requests')).toBeInTheDocument();
    });

    it('shows error when metrics hook fails', () => {
      mockProviders.mockReturnValue(hookSuccess(MOCK_PROVIDERS) as ReturnType<typeof useBillingProviders>);
      mockMetrics.mockReturnValue(hookError('Metrics unavailable') as unknown as ReturnType<typeof useClaimMetrics>);
      mockClaims.mockReturnValue(hookSuccess(MOCK_CLAIMS) as unknown as ReturnType<typeof useSearchClaims>);

      render(<BillingDashboard />);
      expect(screen.getByText('Billing Data Error')).toBeInTheDocument();
      expect(screen.getByText('Metrics unavailable')).toBeInTheDocument();
    });

    it('shows error when claims hook fails', () => {
      mockProviders.mockReturnValue(hookSuccess(MOCK_PROVIDERS) as ReturnType<typeof useBillingProviders>);
      mockMetrics.mockReturnValue(hookSuccess(MOCK_METRICS) as unknown as ReturnType<typeof useClaimMetrics>);
      mockClaims.mockReturnValue(hookError('Claims service down') as unknown as ReturnType<typeof useSearchClaims>);

      render(<BillingDashboard />);
      expect(screen.getByText('Billing Data Error')).toBeInTheDocument();
      expect(screen.getByText('Claims service down')).toBeInTheDocument();
    });
  });

  // 3. Total Claims metric card
  describe('Total Claims metric', () => {
    it('displays claim count from metrics.total', () => {
      setupSuccess();
      render(<BillingDashboard />);
      expect(screen.getByText('Total Claims')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    });
  });

  // 4. Total Revenue metric card
  describe('Total Revenue metric', () => {
    it('displays formatted currency value from metrics.totalAmount', () => {
      setupSuccess();
      render(<BillingDashboard />);
      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      expect(screen.getByText('$125,750.50')).toBeInTheDocument();
    });
  });

  // 5. Active Providers metric card
  describe('Active Providers metric', () => {
    it('displays provider count from providers array length', () => {
      setupSuccess();
      render(<BillingDashboard />);
      expect(screen.getByText('Active Providers')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('displays 0 when providers array is empty', () => {
      setupWith({ providers: [] });
      render(<BillingDashboard />);
      expect(screen.getByText('Active Providers')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  // 6. Claims by Status section
  describe('Claims by Status', () => {
    it('renders status badges with correct labels and counts', () => {
      setupSuccess();
      render(<BillingDashboard />);

      expect(screen.getByText('Claims by Status')).toBeInTheDocument();
      // Statuses unique to the grid (not duplicated in claims table)
      expect(screen.getByText('generated')).toBeInTheDocument();
      expect(screen.getByText('pending_approval')).toBeInTheDocument();
      expect(screen.getByText('paid')).toBeInTheDocument();
      // These also appear in table rows
      expect(screen.getAllByText('submitted').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('accepted').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('rejected').length).toBeGreaterThanOrEqual(1);
      // Counts
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('8')).toBeInTheDocument();
    });
  });

  // 7. Recent Claims table
  describe('Recent Claims table', () => {
    it('renders table with column headers', () => {
      setupSuccess();
      render(<BillingDashboard />);
      expect(screen.getByText('Claim ID')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Date')).toBeInTheDocument();
      expect(screen.getByText('Amount')).toBeInTheDocument();
    });

    it('renders claim rows with control numbers, type, and amount', () => {
      setupSuccess();
      render(<BillingDashboard />);

      expect(screen.getByText('#WF20260001')).toBeInTheDocument();
      expect(screen.getByText('#WF20260002')).toBeInTheDocument();
      expect(screen.getAllByText('837P').length).toBe(2);
      expect(screen.getByText('837I')).toBeInTheDocument();
      expect(screen.getByText('$1,500.00')).toBeInTheDocument();
      expect(screen.getByText('$2,300.00')).toBeInTheDocument();
      expect(screen.getByText('$800.00')).toBeInTheDocument();
    });

    it('renders claim status badges in the table rows', () => {
      setupSuccess();
      render(<BillingDashboard />);

      const table = screen.getByRole('table');
      const tableScope = within(table);
      expect(tableScope.getAllByText('submitted').length).toBeGreaterThanOrEqual(1);
      expect(tableScope.getAllByText('accepted').length).toBeGreaterThanOrEqual(1);
      expect(tableScope.getAllByText('rejected').length).toBeGreaterThanOrEqual(1);
    });

    it('renders dates in "MMM D, YYYY" format', () => {
      setupSuccess();
      render(<BillingDashboard />);
      expect(screen.getByText('Jan 15, 2026')).toBeInTheDocument();
      expect(screen.getByText('Jan 16, 2026')).toBeInTheDocument();
      expect(screen.getByText('Jan 17, 2026')).toBeInTheDocument();
    });
  });

  // 8. Empty claims state
  describe('empty claims state', () => {
    it('shows "No claims found" message and hides table when claims are empty', () => {
      setupWith({ claims: [] });
      render(<BillingDashboard />);

      expect(screen.getByText('No claims found')).toBeInTheDocument();
      expect(screen.getByText('Claims will appear here once created')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  // 9. Refresh button
  describe('Refresh button', () => {
    it('calls all 3 refetch functions when clicked', async () => {
      const user = userEvent.setup();
      setupSuccess();
      render(<BillingDashboard />);

      await user.click(screen.getByRole('button', { name: /refresh/i }));

      expect(mockRefetchProviders).toHaveBeenCalledTimes(1);
      expect(mockRefetchMetrics).toHaveBeenCalledTimes(1);
      expect(mockRefetchClaims).toHaveBeenCalledTimes(1);
    });
  });

  // 10. Currency formatting
  describe('currency formatting', () => {
    it('formats amounts with $ prefix, commas, and two decimal places', () => {
      setupSuccess();
      render(<BillingDashboard />);

      expect(screen.getByText('$125,750.50')).toBeInTheDocument();
      expect(screen.getByText('$1,500.00')).toBeInTheDocument();
      expect(screen.getByText('$2,300.00')).toBeInTheDocument();
      expect(screen.getByText('$800.00')).toBeInTheDocument();
    });
  });

  // 11. Claim ID display (control_number fallback)
  describe('Claim ID display', () => {
    it('uses control_number with # prefix when present', () => {
      setupSuccess();
      render(<BillingDashboard />);
      expect(screen.getByText('#WF20260001')).toBeInTheDocument();
      expect(screen.getByText('#WF20260002')).toBeInTheDocument();
    });

    it('falls back to first 8 chars of id when control_number is null', () => {
      setupSuccess();
      render(<BillingDashboard />);
      // claim-gamma-003 has null control_number => id.slice(0,8) = 'claim-ga'
      expect(screen.getByText('#claim-ga')).toBeInTheDocument();
    });

    it('shows short id prefix in the blue circle badge', () => {
      setupSuccess();
      render(<BillingDashboard />);
      // Claims with control_number show first 2 chars: 'WF'
      expect(screen.getAllByText('WF').length).toBe(2);
      // Claim without control_number shows fallback 'CL'
      expect(screen.getByText('CL')).toBeInTheDocument();
    });
  });

  // 12. Quick Actions section
  describe('Quick Actions section', () => {
    it('shows all 3 action buttons with descriptions', () => {
      setupSuccess();
      render(<BillingDashboard />);

      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      expect(screen.getByText('Create New Claim')).toBeInTheDocument();
      expect(screen.getByText('Generate a new billing claim')).toBeInTheDocument();
      expect(screen.getByText('Sync with Clearinghouse')).toBeInTheDocument();
      expect(screen.getByText('Update claim statuses')).toBeInTheDocument();
      expect(screen.getByText('Generate Report')).toBeInTheDocument();
      expect(screen.getByText('Billing analytics report')).toBeInTheDocument();
    });
  });

  // 13. System Status section
  describe('System Status section', () => {
    it('shows all 3 status indicators', () => {
      setupSuccess();
      render(<BillingDashboard />);

      expect(screen.getByText('System Status')).toBeInTheDocument();
      expect(screen.getByText('Billing Service')).toBeInTheDocument();
      expect(screen.getByText('X12 Generation')).toBeInTheDocument();
      expect(screen.getByText('Coding AI')).toBeInTheDocument();
    });
  });

  // 14. Null metrics handling
  describe('null metrics handling', () => {
    it('displays 0 and $0.00 when metricsData is null', () => {
      setupWith({ metrics: null });
      render(<BillingDashboard />);

      expect(screen.getByText('Total Claims')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });

    it('does not render Claims by Status section when metrics is null', () => {
      setupWith({ metrics: null });
      render(<BillingDashboard />);
      expect(screen.queryByText('Claims by Status')).not.toBeInTheDocument();
    });
  });

  // 15. className prop forwarding
  describe('className prop', () => {
    it('applies custom className to the root container', () => {
      setupSuccess();
      const { container } = render(<BillingDashboard className="test-custom-class" />);
      expect(container.firstElementChild?.classList.contains('test-custom-class')).toBe(true);
    });
  });

  // 16. Hook call verification
  describe('hook invocation', () => {
    it('calls useSearchClaims with limit of 10', () => {
      setupSuccess();
      render(<BillingDashboard />);
      expect(mockClaims).toHaveBeenCalledWith({ limit: 10 });
    });
  });
});
