/**
 * StaffFinancialSavingsTracker Tests
 *
 * Purpose: Validates the Staff Financial Savings Tracker dashboard — summary cards,
 * position table, staff list with expand/collapse, filtering, export, and error states.
 *
 * Deletion Test: Every test would FAIL if the component were an empty <div />.
 * Each assertion targets specific rendered text, roles, or interactive behavior
 * that requires the full component implementation.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// === MOCKS ===================================================================
const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockSupabase = { from: mockFrom, rpc: mockRpc };

vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => mockSupabase,
  useAuth: () => ({ user: { id: 'user-test-001' } }),
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn().mockResolvedValue(undefined),
    warn: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    debug: vi.fn().mockResolvedValue(undefined),
    clinical: vi.fn().mockResolvedValue(undefined),
    ai: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../envision-atlus', () => ({
  EACard: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="ea-card">{children}</div>
  ),
  EACardHeader: ({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) => (
    <div data-testid="ea-card-header">{icon}{children}</div>
  ),
  EACardContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="ea-card-content">{children}</div>
  ),
  EAButton: ({ children, onClick, variant, icon }: {
    children: React.ReactNode; onClick?: () => void; variant?: string; icon?: React.ReactNode;
  }) => (
    <button onClick={onClick} data-variant={variant}>{icon}{children}</button>
  ),
  EAAlert: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <div role="alert" data-variant={variant}>{children}</div>
  ),
  EATabs: ({ children, onValueChange }: {
    children: React.ReactNode; value?: string; onValueChange?: (v: string) => void; defaultValue?: string;
  }) => (
    <div data-testid="ea-tabs">
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<{ onValueChange?: (v: string) => void }>, { onValueChange })
          : child
      )}
    </div>
  ),
  EATabsList: ({ children, onValueChange }: {
    children: React.ReactNode; onValueChange?: (v: string) => void; className?: string;
  }) => (
    <div data-testid="ea-tabs-list" role="tablist">
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<{ onValueChange?: (v: string) => void }>, { onValueChange })
          : child
      )}
    </div>
  ),
  EATabsTrigger: ({ children, value, onValueChange }: {
    children: React.ReactNode; value: string; onValueChange?: (v: string) => void;
  }) => (
    <button role="tab" data-value={value} onClick={() => onValueChange?.(value)}>{children}</button>
  ),
  EATabsContent: ({ children, value }: {
    children: React.ReactNode; value: string; className?: string;
  }) => <div data-testid={`ea-tab-content-${value}`}>{children}</div>,
}));

vi.mock('lucide-react', () => ({
  RefreshCw: () => <span data-testid="icon-refresh" />,
  DollarSign: () => <span data-testid="icon-dollar" />,
  Users: () => <span data-testid="icon-users" />,
  TrendingUp: () => <span data-testid="icon-trending" />,
  Download: () => <span data-testid="icon-download" />,
  Filter: () => <span data-testid="icon-filter" />,
  Award: () => <span data-testid="icon-award" />,
  Briefcase: () => <span data-testid="icon-briefcase" />,
  ChevronDown: () => <span data-testid="icon-chevron-down" />,
  ChevronUp: () => <span data-testid="icon-chevron-up" />,
  CheckCircle: () => <span data-testid="icon-check" />,
  Clock: () => <span data-testid="icon-clock" />,
}));

// === MOCK DATA — Synthetic (obviously fake, no real PHI) =====================
const MOCK_STAFF_SAVINGS = [
  {
    staff_user_id: 'staff-alpha-001',
    staff_name: 'Test Staff Alpha',
    position_type: 'nurse',
    department: 'Cardiology',
    total_savings_events: 15,
    total_amount_saved: 45000.5,
    verified_amount: 38000.0,
    savings_by_category: {
      prevented_readmission: 25000, early_intervention: 15000, care_coordination: 5000.5,
    },
  },
  {
    staff_user_id: 'staff-beta-002',
    staff_name: 'Test Staff Beta',
    position_type: 'care_coordinator',
    department: 'Primary Care',
    total_savings_events: 8,
    total_amount_saved: 22000.0,
    verified_amount: 18000.0,
    savings_by_category: { discharge_planning: 12000, sdoh_intervention: 10000 },
  },
];

const MOCK_POSITION_SAVINGS = [
  { position_type: 'nurse', staff_count: 5, total_events: 45, total_saved: 125000, avg_per_staff: 25000, verified_total: 100000 },
  { position_type: 'care_coordinator', staff_count: 3, total_events: 20, total_saved: 60000, avg_per_staff: 20000, verified_total: 50000 },
];

// === HELPERS ==================================================================
function setupMocks(
  staffData: typeof MOCK_STAFF_SAVINGS | [] = MOCK_STAFF_SAVINGS,
  positionData: typeof MOCK_POSITION_SAVINGS | [] = MOCK_POSITION_SAVINGS
) {
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { tenant_id: 'tenant-test-001' }, error: null }),
      }),
    }),
  });
  let rpcCallCount = 0;
  mockRpc.mockImplementation(() => {
    rpcCallCount++;
    if (rpcCallCount % 2 === 1) return Promise.resolve({ data: staffData, error: null });
    return Promise.resolve({ data: positionData, error: null });
  });
}

function setupErrorMocks() {
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { tenant_id: 'tenant-test-001' }, error: null }),
      }),
    }),
  });
  mockRpc.mockRejectedValue(new Error('Database unavailable'));
}

async function renderAndWait() {
  const StaffFinancialSavingsTracker = (await import('../StaffFinancialSavingsTracker')).default;
  const result = render(<StaffFinancialSavingsTracker />);
  await waitFor(() => {
    expect(screen.queryByText('Staff Financial Savings')).toBeInTheDocument();
  });
  return result;
}

// === TESTS ===================================================================
describe('StaffFinancialSavingsTracker', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // -- Loading state ----------------------------------------------------------
  describe('Loading state', () => {
    it('shows skeleton pulse animation while data is loading', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { tenant_id: 'tenant-test-001' }, error: null }),
          }),
        }),
      });
      mockRpc.mockReturnValue(new Promise(() => {})); // never resolves

      const StaffFinancialSavingsTracker = (await import('../StaffFinancialSavingsTracker')).default;
      const { container } = render(<StaffFinancialSavingsTracker />);
      const pulseElement = container.querySelector('.animate-pulse');
      expect(pulseElement).toBeInTheDocument();
    });
  });

  // -- Summary cards ----------------------------------------------------------
  describe('Summary cards', () => {
    it('displays Total Saved amount formatted as currency', async () => {
      setupMocks();
      await renderAndWait();
      // 45000.50 + 22000.00 = 67000.50
      expect(screen.getByText(/67,000\.50/)).toBeInTheDocument();
    });

    it('displays Staff Contributing count', async () => {
      setupMocks();
      await renderAndWait();
      const staffHeader = screen.getByText('Staff Contributing');
      const card = staffHeader.closest('[data-testid="ea-card"]');
      expect(card).toBeInTheDocument();
      expect(within(card as HTMLElement).getByText('2')).toBeInTheDocument();
    });

    it('displays Savings Events total', async () => {
      setupMocks();
      await renderAndWait();
      // 15 + 8 = 23 total events
      const eventsHeader = screen.getByText('Savings Events');
      const card = eventsHeader.closest('[data-testid="ea-card"]');
      expect(card).toBeInTheDocument();
      expect(within(card as HTMLElement).getByText('23')).toBeInTheDocument();
    });

    it('displays Avg Per Staff calculated correctly', async () => {
      setupMocks();
      await renderAndWait();
      // 67000.50 / 2 = 33500.25 => displayed as $33,500 (maximumFractionDigits: 0)
      expect(screen.getByText(/33,500/)).toBeInTheDocument();
    });
  });

  // -- Position tab -----------------------------------------------------------
  describe('Position tab', () => {
    it('shows position table with human-readable position labels', async () => {
      setupMocks();
      await renderAndWait();
      const positionTab = screen.getByTestId('ea-tab-content-position');
      expect(within(positionTab).getByText('Nurse (RN)')).toBeInTheDocument();
      expect(within(positionTab).getByText('Care Coordinator')).toBeInTheDocument();
    });

    it('shows total saved amounts per position', async () => {
      setupMocks();
      await renderAndWait();
      const positionTab = screen.getByTestId('ea-tab-content-position');
      expect(within(positionTab).getByText(/125,000\.00/)).toBeInTheDocument();
      expect(within(positionTab).getByText(/60,000\.00/)).toBeInTheDocument();
    });
  });

  // -- Staff tab --------------------------------------------------------------
  describe('Staff tab', () => {
    it('shows staff names and position labels', async () => {
      setupMocks();
      await renderAndWait();
      const staffTab = screen.getByTestId('ea-tab-content-staff');
      expect(within(staffTab).getByText('Test Staff Alpha')).toBeInTheDocument();
      expect(within(staffTab).getByText('Test Staff Beta')).toBeInTheDocument();
      expect(within(staffTab).getByText(/Nurse \(RN\)/)).toBeInTheDocument();
      expect(within(staffTab).getByText(/Care Coordinator/)).toBeInTheDocument();
    });

    it('shows staff savings amounts and event counts', async () => {
      setupMocks();
      await renderAndWait();
      const staffTab = screen.getByTestId('ea-tab-content-staff');
      expect(within(staffTab).getByText('15')).toBeInTheDocument();
      expect(within(staffTab).getByText(/45,000\.50/)).toBeInTheDocument();
      expect(within(staffTab).getByText('8')).toBeInTheDocument();
      expect(within(staffTab).getByText(/22,000\.00/)).toBeInTheDocument();
    });
  });

  // -- Staff expand/collapse --------------------------------------------------
  describe('Staff expand/collapse', () => {
    it('expands staff row to show savings by category on click', async () => {
      setupMocks();
      await renderAndWait();
      const user = userEvent.setup();

      const staffTab = screen.getByTestId('ea-tab-content-staff');
      const alphaRow = within(staffTab).getByText('Test Staff Alpha');
      const clickableRow = alphaRow.closest('.cursor-pointer');
      expect(clickableRow).toBeInTheDocument();
      await user.click(clickableRow as HTMLElement);

      await waitFor(() => {
        expect(screen.getByText('Savings by Category')).toBeInTheDocument();
      });
      expect(screen.getByText('Prevented Readmission')).toBeInTheDocument();
      expect(screen.getByText('Early Intervention')).toBeInTheDocument();
      expect(screen.getByText('Care Coordination')).toBeInTheDocument();
      // Category amounts may partially match other values on screen (e.g. $25,000 in $125,000),
      // so use getAllByText to confirm the category amounts are rendered somewhere
      const amounts25k = screen.getAllByText(/25,000\.00/);
      expect(amounts25k.length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText(/15,000\.00/).length).toBeGreaterThanOrEqual(1);
      // $5,000.50 substring matches $45,000.50, so verify multiple matches exist
      expect(screen.getAllByText(/5,000\.50/).length).toBeGreaterThanOrEqual(2);
    });

    it('collapses expanded staff row on second click', async () => {
      setupMocks();
      await renderAndWait();
      const user = userEvent.setup();

      const staffTab = screen.getByTestId('ea-tab-content-staff');
      const alphaRow = within(staffTab).getByText('Test Staff Alpha');
      const clickableRow = alphaRow.closest('.cursor-pointer') as HTMLElement;

      await user.click(clickableRow);
      await waitFor(() => {
        expect(screen.getByText('Savings by Category')).toBeInTheDocument();
      });

      await user.click(clickableRow);
      await waitFor(() => {
        expect(screen.queryByText('Savings by Category')).not.toBeInTheDocument();
      });
    });
  });

  // -- Empty state ------------------------------------------------------------
  describe('Empty state', () => {
    it('shows "No savings data available" when no data returned', async () => {
      setupMocks([], []);
      await renderAndWait();
      const emptyMessages = screen.getAllByText('No savings data available for the selected filters');
      expect(emptyMessages.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -- Error state ------------------------------------------------------------
  describe('Error state', () => {
    it('shows EAAlert with critical variant when data load fails', async () => {
      setupErrorMocks();
      await renderAndWait();
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveAttribute('data-variant', 'critical');
      expect(within(alert).getByText('Failed to load savings data. Please try again.')).toBeInTheDocument();
    });
  });

  // -- Filters ----------------------------------------------------------------
  describe('Filters', () => {
    it('shows position dropdown with all position type options', async () => {
      setupMocks();
      await renderAndWait();
      const positionSelect = screen.getByDisplayValue('All Positions');
      expect(positionSelect).toBeInTheDocument();
      expect(positionSelect.tagName).toBe('SELECT');
      const options = within(positionSelect as HTMLElement).getAllByRole('option');
      const optionTexts = options.map((o) => o.textContent);
      expect(optionTexts).toContain('All Positions');
      expect(optionTexts).toContain('Nurse (RN)');
      expect(optionTexts).toContain('Care Coordinator');
      expect(optionTexts).toContain('Physician (MD/DO)');
      expect(optionTexts).toContain('Social Worker');
      expect(optionTexts).toContain('Billing Specialist');
    });

    it('shows start and end date inputs with values', async () => {
      setupMocks();
      await renderAndWait();
      expect(screen.getByText('From:')).toBeInTheDocument();
      expect(screen.getByText('To:')).toBeInTheDocument();
      const dateInputs = screen.getAllByDisplayValue(/^\d{4}-\d{2}-\d{2}$/);
      expect(dateInputs.length).toBe(2);
    });
  });

  // -- Header actions ---------------------------------------------------------
  describe('Header actions', () => {
    it('renders Export CSV button in header', async () => {
      setupMocks();
      await renderAndWait();
      const exportBtn = screen.getByText('Export CSV');
      expect(exportBtn).toBeInTheDocument();
      expect(exportBtn.closest('button')).toBeInTheDocument();
    });

    it('renders Refresh button in header', async () => {
      setupMocks();
      await renderAndWait();
      const refreshBtn = screen.getByText('Refresh');
      expect(refreshBtn).toBeInTheDocument();
      expect(refreshBtn.closest('button')).toBeInTheDocument();
    });

    it('calls loadData when Refresh button is clicked', async () => {
      setupMocks();
      await renderAndWait();
      const user = userEvent.setup();
      const initialRpcCount = mockRpc.mock.calls.length;
      const refreshBtn = screen.getByText('Refresh');
      await user.click(refreshBtn.closest('button') as HTMLElement);
      await waitFor(() => {
        expect(mockRpc.mock.calls.length).toBeGreaterThan(initialRpcCount);
      });
    });
  });

  // -- Tab switching ----------------------------------------------------------
  describe('Tab switching', () => {
    it('renders both By Position and By Individual Staff tab triggers', async () => {
      setupMocks();
      await renderAndWait();
      const tabs = screen.getAllByRole('tab');
      const tabValues = tabs.map((t) => t.getAttribute('data-value'));
      expect(tabValues).toContain('position');
      expect(tabValues).toContain('staff');
    });
  });

  // -- Department display -----------------------------------------------------
  describe('Staff department display', () => {
    it('shows department name alongside position for staff members', async () => {
      setupMocks();
      await renderAndWait();
      const staffTab = screen.getByTestId('ea-tab-content-staff');
      expect(within(staffTab).getByText(/Cardiology/)).toBeInTheDocument();
      expect(within(staffTab).getByText(/Primary Care/)).toBeInTheDocument();
    });
  });

  // -- Verified amounts -------------------------------------------------------
  describe('Verified amounts', () => {
    it('shows verified totals in the position table', async () => {
      setupMocks();
      await renderAndWait();
      const positionTab = screen.getByTestId('ea-tab-content-position');
      expect(within(positionTab).getByText(/100,000/)).toBeInTheDocument();
      expect(within(positionTab).getByText(/50,000/)).toBeInTheDocument();
    });

    it('shows verified amounts per staff member', async () => {
      setupMocks();
      await renderAndWait();
      const staffTab = screen.getByTestId('ea-tab-content-staff');
      expect(within(staffTab).getByText(/38,000/)).toBeInTheDocument();
      expect(within(staffTab).getByText(/18,000/)).toBeInTheDocument();
    });
  });
});
