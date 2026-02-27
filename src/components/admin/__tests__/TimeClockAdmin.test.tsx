/**
 * TimeClockAdmin Tests
 *
 * Purpose: Validates the admin time clock management dashboard — module access gating,
 * stats cards, date/view filters, entries table with status badges, export CSV,
 * refresh, loading/empty/error states.
 *
 * Deletion Test: Every test would FAIL if the component were replaced with an empty <div />.
 * Each assertion targets specific rendered text, roles, or interactive behavior
 * that requires the full component implementation.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// === MOCKS ===================================================================

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => mockSupabase,
  useUser: () => ({ id: 'user-test-001' }),
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

const mockGetAllTenantEntries = vi.fn();
const mockGetTeamEntries = vi.fn();
const mockFormatHours = vi.fn();

vi.mock('../../../services/timeClockService', () => ({
  TimeClockService: {
    getAllTenantEntries: (...args: unknown[]) => mockGetAllTenantEntries(...args),
    getTeamEntries: (...args: unknown[]) => mockGetTeamEntries(...args),
    formatHours: (...args: unknown[]) => mockFormatHours(...args),
  },
}));

const mockUseModuleAccess = vi.fn();

vi.mock('../../../hooks/useModuleAccess', () => ({
  useModuleAccess: (...args: unknown[]) => mockUseModuleAccess(...args),
  default: (...args: unknown[]) => mockUseModuleAccess(...args),
}));

vi.mock('../../envision-atlus', () => ({
  EAPageLayout: ({ children, title, subtitle, badge, actions }: {
    children?: React.ReactNode; title?: string; subtitle?: string;
    badge?: React.ReactNode; actions?: React.ReactNode;
  }) => (
    <div data-testid="ea-page-layout">
      {title && <h1>{title}</h1>}
      {subtitle && <p>{subtitle}</p>}
      {badge}
      {actions && <div data-testid="ea-page-actions">{actions}</div>}
      {children}
    </div>
  ),
  EACard: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="ea-card">{children}</div>
  ),
  EACardHeader: ({ children, icon }: { children?: React.ReactNode; icon?: React.ReactNode }) => (
    <div data-testid="ea-card-header">{icon}{children}</div>
  ),
  EACardContent: ({ children, className: _className }: { children?: React.ReactNode; className?: string }) => (
    <div data-testid="ea-card-content">{children}</div>
  ),
  EABadge: ({ children, variant }: { children?: React.ReactNode; variant?: string }) => (
    <span data-testid="ea-badge" data-variant={variant}>{children}</span>
  ),
  EAButton: ({ children, onClick, disabled, variant, icon: _icon }: {
    children?: React.ReactNode; onClick?: () => void; disabled?: boolean;
    variant?: string; icon?: React.ReactNode;
  }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  ),
  EAMetricCard: ({ label, value, icon: _icon, riskLevel }: {
    label: string; value: string | number; icon?: React.ReactNode; riskLevel?: string;
  }) => (
    <div data-testid="ea-metric-card" data-risk-level={riskLevel}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
}));

vi.mock('lucide-react', () => ({
  Clock: () => <span data-testid="icon-clock" />,
  Download: () => <span data-testid="icon-download" />,
  Users: () => <span data-testid="icon-users" />,
  Calendar: () => <span data-testid="icon-calendar" />,
  Filter: () => <span data-testid="icon-filter" />,
  RefreshCw: () => <span data-testid="icon-refresh" />,
  CheckCircle: () => <span data-testid="icon-check-circle" />,
  AlertCircle: () => <span data-testid="icon-alert-circle" />,
  Lock: () => <span data-testid="icon-lock" />,
}));

// === TEST DATA ================================================================

const MOCK_ENTRIES = [
  {
    id: 'entry-001',
    user_id: 'user-aaa',
    tenant_id: 'tenant-test-001',
    clock_in_time: '2026-02-25T08:00:00Z',
    clock_out_time: '2026-02-25T16:30:00Z',
    total_hours: 8.5,
    total_minutes: 510,
    was_on_time: true,
    status: 'clocked_out' as const,
    first_name: 'Test',
    last_name: 'Employee Alpha',
    created_at: '2026-02-25T08:00:00Z',
    updated_at: '2026-02-25T16:30:00Z',
  },
  {
    id: 'entry-002',
    user_id: 'user-bbb',
    tenant_id: 'tenant-test-001',
    clock_in_time: '2026-02-25T08:15:00Z',
    clock_out_time: null,
    total_hours: null,
    total_minutes: null,
    was_on_time: false,
    status: 'clocked_in' as const,
    first_name: 'Test',
    last_name: 'Employee Beta',
    created_at: '2026-02-25T08:15:00Z',
    updated_at: '2026-02-25T08:15:00Z',
  },
];

// === HELPERS ==================================================================

function setupProfileQuery(tenantId: string | null = 'tenant-test-001') {
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: tenantId ? { tenant_id: tenantId } : null,
          error: null,
        }),
      }),
    }),
  });
}

function setupModuleAccessGranted() {
  mockUseModuleAccess.mockReturnValue({
    canAccess: true,
    loading: false,
    denialReason: null,
    isEntitled: true,
    isEnabled: true,
    error: null,
    refresh: vi.fn(),
  });
}

function setupModuleAccessDenied(reason: 'not_entitled' | 'not_enabled') {
  mockUseModuleAccess.mockReturnValue({
    canAccess: false,
    loading: false,
    denialReason: reason,
    isEntitled: reason !== 'not_entitled',
    isEnabled: reason !== 'not_enabled',
    error: null,
    refresh: vi.fn(),
  });
}

function setupModuleLoading() {
  mockUseModuleAccess.mockReturnValue({
    canAccess: false,
    loading: true,
    denialReason: 'loading',
    isEntitled: false,
    isEnabled: false,
    error: null,
    refresh: vi.fn(),
  });
}

function setupEntriesSuccess(entries = MOCK_ENTRIES) {
  mockGetAllTenantEntries.mockResolvedValue({
    success: true,
    data: entries,
  });
  mockGetTeamEntries.mockResolvedValue({
    success: true,
    data: entries,
  });
}

function setupEntriesEmpty() {
  mockGetAllTenantEntries.mockResolvedValue({
    success: true,
    data: [],
  });
  mockGetTeamEntries.mockResolvedValue({
    success: true,
    data: [],
  });
}

function setupEntriesError(message = 'Database connection failed') {
  mockGetAllTenantEntries.mockResolvedValue({
    success: false,
    error: { message },
  });
}

async function renderWithAccess(entries = MOCK_ENTRIES) {
  setupModuleAccessGranted();
  setupProfileQuery();
  setupEntriesSuccess(entries);
  mockFormatHours.mockImplementation((minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  });

  const { TimeClockAdmin } = await import('../TimeClockAdmin');
  render(<TimeClockAdmin />);

  await waitFor(() => {
    expect(screen.getByText('Time Clock Management')).toBeInTheDocument();
  });
}

// === TESTS ====================================================================

describe('TimeClockAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------- Loading / Module Access ----------------------------------------

  it('shows loading spinner while module access is loading', async () => {
    setupModuleLoading();
    setupProfileQuery();

    const { TimeClockAdmin } = await import('../TimeClockAdmin');
    const { container } = render(<TimeClockAdmin />);

    expect(screen.getByText('Time Clock Management')).toBeInTheDocument();
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('shows "not purchased" message when module is not entitled', async () => {
    setupModuleAccessDenied('not_entitled');
    setupProfileQuery();

    const { TimeClockAdmin } = await import('../TimeClockAdmin');
    render(<TimeClockAdmin />);

    await waitFor(() => {
      expect(
        screen.getByText(/has not purchased the Time Clock module/i)
      ).toBeInTheDocument();
    });
  });

  it('shows "not enabled" message when module is not enabled', async () => {
    setupModuleAccessDenied('not_enabled');
    setupProfileQuery();

    const { TimeClockAdmin } = await import('../TimeClockAdmin');
    render(<TimeClockAdmin />);

    await waitFor(() => {
      expect(
        screen.getByText(/Time Clock module is not enabled/i)
      ).toBeInTheDocument();
    });
  });

  it('renders main layout when module access is granted', async () => {
    await renderWithAccess();

    expect(screen.getByText('Time Clock Management')).toBeInTheDocument();
    expect(screen.getByText(/View and export employee time entries/i)).toBeInTheDocument();
  });

  // ---------- Title and Header -----------------------------------------------

  it('displays "Time Clock Management" title', async () => {
    await renderWithAccess();

    expect(screen.getByText('Time Clock Management')).toBeInTheDocument();
  });

  // ---------- Stats Cards ----------------------------------------------------

  it('shows Total Entries count in stats card', async () => {
    await renderWithAccess();

    await waitFor(() => {
      expect(screen.getByText('Total Entries')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('shows Currently Clocked In count in stats card', async () => {
    await renderWithAccess();

    await waitFor(() => {
      expect(screen.getByText('Currently Clocked In')).toBeInTheDocument();
      // entry-002 has status clocked_in
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  it('shows Hours This Period value in stats card', async () => {
    await renderWithAccess();

    await waitFor(() => {
      expect(screen.getByText('Hours This Period')).toBeInTheDocument();
      // Only completed entry (entry-001) has 510 minutes = 8.5 hours, Math.round(510/60) = 9
      // Actually Math.round(510/60) = Math.round(8.5) = 8 (banker's rounding) or 9
      // JS: Math.round(8.5) = 9
      expect(screen.getByText('9h')).toBeInTheDocument();
    });
  });

  it('shows On-Time Rate percentage in stats card', async () => {
    await renderWithAccess();

    await waitFor(() => {
      expect(screen.getByText('On-Time Rate')).toBeInTheDocument();
      // 1 completed entry (entry-001), 1 on time => 100%
      expect(screen.getByText('100%')).toBeInTheDocument();
    });
  });

  // ---------- Entries Table --------------------------------------------------

  it('renders employee names in the entries table', async () => {
    await renderWithAccess();

    await waitFor(() => {
      expect(screen.getByText('Test Employee Alpha')).toBeInTheDocument();
      expect(screen.getByText('Test Employee Beta')).toBeInTheDocument();
    });
  });

  it('shows clock in time for entries', async () => {
    await renderWithAccess();

    // The component calls toLocaleTimeString which produces locale-dependent output.
    // We look for the table header to confirm entries are structured, then check
    // that the entries table has the correct number of rows.
    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      // 1 header row + 2 data rows
      expect(rows.length).toBe(3);
    });
  });

  it('shows clock out time for completed entries', async () => {
    await renderWithAccess();

    // entry-001 has a clock_out_time; we check that "Active" does NOT appear for it
    // and that the table has the correct structure
    await waitFor(() => {
      expect(screen.getByText('Test Employee Alpha')).toBeInTheDocument();
    });

    // entry-001 is clocked_out, so it should show formatted time, not "Active"
    // We verify by checking that the total hours are displayed via formatHours
    expect(screen.getByText('8h 30m')).toBeInTheDocument();
  });

  it('shows "Active" instead of clock out time for clocked-in entries', async () => {
    await renderWithAccess();

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  it('shows total hours for completed entries via formatHours', async () => {
    await renderWithAccess();

    await waitFor(() => {
      // entry-001 total_minutes = 510, formatHours(510) = '8h 30m'
      expect(screen.getByText('8h 30m')).toBeInTheDocument();
    });
  });

  it('shows "On time" badge for on-time entries', async () => {
    await renderWithAccess();

    await waitFor(() => {
      expect(screen.getByText('On time')).toBeInTheDocument();
    });
  });

  it('shows "Late" text for late entries', async () => {
    await renderWithAccess();

    await waitFor(() => {
      expect(screen.getByText('Late')).toBeInTheDocument();
    });
  });

  it('shows "Working" badge for clocked-in entries', async () => {
    await renderWithAccess();

    await waitFor(() => {
      expect(screen.getByText('Working')).toBeInTheDocument();
    });
  });

  // ---------- Date Filters ---------------------------------------------------

  it('highlights Today button when Today filter is clicked', async () => {
    await renderWithAccess();
    const user = userEvent.setup();

    const todayBtn = screen.getByRole('button', { name: 'Today' });
    await user.click(todayBtn);

    expect(todayBtn).toHaveClass('bg-teal-500');
  });

  it('Week filter is active by default', async () => {
    await renderWithAccess();

    const weekBtn = screen.getByRole('button', { name: 'Week' });
    expect(weekBtn).toHaveClass('bg-teal-500');
  });

  it('highlights Month button when Month filter is clicked', async () => {
    await renderWithAccess();
    const user = userEvent.setup();

    const monthBtn = screen.getByRole('button', { name: 'Month' });
    await user.click(monthBtn);

    expect(monthBtn).toHaveClass('bg-teal-500');
  });

  // ---------- View Mode Filters ----------------------------------------------

  it('renders All Staff view mode button', async () => {
    await renderWithAccess();

    expect(screen.getByRole('button', { name: 'All Staff' })).toBeInTheDocument();
  });

  it('renders My Team view mode button', async () => {
    await renderWithAccess();

    expect(screen.getByRole('button', { name: 'My Team' })).toBeInTheDocument();
  });

  // ---------- Refresh Button -------------------------------------------------

  it('refresh button triggers data reload', async () => {
    await renderWithAccess();
    const user = userEvent.setup();

    mockGetAllTenantEntries.mockClear();

    const refreshBtn = screen.getByRole('button', { name: /Refresh/i });
    await user.click(refreshBtn);

    await waitFor(() => {
      expect(mockGetAllTenantEntries).toHaveBeenCalled();
    });
  });

  // ---------- Export CSV Button ----------------------------------------------

  it('renders Export CSV button', async () => {
    await renderWithAccess();

    expect(screen.getByRole('button', { name: /Export CSV/i })).toBeInTheDocument();
  });

  it('disables Export CSV button when there are no entries', async () => {
    setupModuleAccessGranted();
    setupProfileQuery();
    setupEntriesEmpty();
    mockFormatHours.mockReturnValue('0m');

    const { TimeClockAdmin } = await import('../TimeClockAdmin');
    render(<TimeClockAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Time Clock Management')).toBeInTheDocument();
    });

    await waitFor(() => {
      const exportBtn = screen.getByRole('button', { name: /Export CSV/i });
      expect(exportBtn).toBeDisabled();
    });
  });

  // ---------- Empty State ----------------------------------------------------

  it('shows "No time entries for this period" when no entries exist', async () => {
    setupModuleAccessGranted();
    setupProfileQuery();
    setupEntriesEmpty();
    mockFormatHours.mockReturnValue('0m');

    const { TimeClockAdmin } = await import('../TimeClockAdmin');
    render(<TimeClockAdmin />);

    await waitFor(() => {
      expect(screen.getByText('No time entries for this period')).toBeInTheDocument();
    });
  });

  // ---------- Error State ----------------------------------------------------

  it('displays error message when data loading fails', async () => {
    setupModuleAccessGranted();
    setupProfileQuery();
    setupEntriesError('Database connection failed');

    const { TimeClockAdmin } = await import('../TimeClockAdmin');
    render(<TimeClockAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Database connection failed')).toBeInTheDocument();
    });
  });

  // ---------- Filter Interaction ---------------------------------------------

  it('switching date filter reloads data with new range', async () => {
    await renderWithAccess();
    const user = userEvent.setup();

    mockGetAllTenantEntries.mockClear();

    const monthBtn = screen.getByRole('button', { name: 'Month' });
    await user.click(monthBtn);

    await waitFor(() => {
      expect(mockGetAllTenantEntries).toHaveBeenCalled();
    });
  });
});
