/**
 * TenantAuditLogs tests — validates loading state, filter controls, table rendering,
 * severity badges, pagination, CSV export, empty state, and error handling.
 *
 * Deletion Test: Every test would FAIL if the component were an empty <div />.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

// Tests set this before render to control what the audit query resolves with.
let auditQueryResult: { data: unknown[] | null; error: unknown; count: number };

// Profile chain: from('profiles').select('tenant_id').eq('user_id', ...).single()
const mockProfileSingle = vi.fn();
const mockProfileEq = vi.fn();
const mockProfileSelect = vi.fn();
const mockFrom = vi.fn();

/** Supabase-style thenable query builder. All chain methods return self;
 *  `await builder` resolves with `auditQueryResult`. */
function buildAuditBuilder() {
  const builder: Record<string, unknown> = {};
  const chain = vi.fn(() => builder);
  builder.eq = chain;
  builder.or = chain;
  builder.gte = chain;
  builder.order = chain;
  builder.range = chain;
  builder.select = vi.fn(() => builder);
  builder.then = (
    onFulfilled?: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(auditQueryResult).then(onFulfilled, onRejected);
  return builder;
}

function wireUpMocks() {
  auditQueryResult = { data: [], error: null, count: 0 };
  mockProfileSingle.mockResolvedValue({ data: { tenant_id: 'tenant-test-001' }, error: null });
  mockProfileEq.mockReturnValue({ single: mockProfileSingle });
  mockProfileSelect.mockReturnValue({ eq: mockProfileEq });
  mockFrom.mockImplementation((table: string) => {
    if (table === 'profiles') return { select: mockProfileSelect };
    if (table === 'audit_logs') return { select: vi.fn(() => buildAuditBuilder()) };
    return { select: vi.fn() };
  });
}

vi.mock('../../../contexts/AuthContext', () => ({
  useSupabaseClient: () => ({ from: mockFrom }),
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

vi.mock('lucide-react', () => ({
  FileText: ({ className }: { className?: string }) => <span data-testid="icon-file-text" className={className} />,
  Download: ({ className }: { className?: string }) => <span data-testid="icon-download" className={className} />,
  Filter: ({ className }: { className?: string }) => <span data-testid="icon-filter" className={className} />,
  Search: ({ className }: { className?: string }) => <span data-testid="icon-search" className={className} />,
  Calendar: ({ className }: { className?: string }) => <span data-testid="icon-calendar" className={className} />,
}));

// ============================================================================
// TEST DATA — Synthetic only, obviously fake
// ============================================================================

const MOCK_AUDIT_LOGS = [
  {
    id: 'log-001', created_at: '2026-01-15T10:30:00Z',
    user_email: 'testuser-alpha@fake.test', action_type: 'VIEW_RECORD',
    action_category: 'PHI_ACCESS', resource_type: 'Patient',
    resource_id: 'patient-abc', severity: 'info',
    message: 'Test Patient Alpha record viewed', ip_address: '10.0.0.1', metadata: null,
  },
  {
    id: 'log-002', created_at: '2026-01-15T11:00:00Z',
    user_email: 'testuser-beta@fake.test', action_type: 'LOGIN_FAILED',
    action_category: 'AUTHENTICATION', resource_type: null,
    resource_id: null, severity: 'critical',
    message: 'Multiple failed login attempts detected', ip_address: '10.0.0.2', metadata: null,
  },
  {
    id: 'log-003', created_at: '2026-01-15T12:00:00Z',
    user_email: null, action_type: 'SYSTEM_BACKUP',
    action_category: 'ADMINISTRATIVE', resource_type: 'Database',
    resource_id: 'backup-xyz', severity: 'warning',
    message: 'Scheduled backup completed with warnings', ip_address: null, metadata: null,
  },
];

async function renderComponent() {
  const { TenantAuditLogs } = await import('../TenantAuditLogs');
  return render(<TenantAuditLogs />);
}

// ============================================================================
// TESTS
// ============================================================================

describe('TenantAuditLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wireUpMocks();
  });

  // 1. Loading state
  it('shows a loading spinner while data is being fetched', async () => {
    mockProfileSingle.mockReturnValue(new Promise(() => {}));
    await renderComponent();
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  // 2. Header and subtitle
  it('displays the "Audit Logs" heading and facility subtitle after loading', async () => {
    await renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Audit Logs')).toBeInTheDocument();
    });
    expect(screen.getByText('Comprehensive activity tracking for your facility')).toBeInTheDocument();
  });

  // 3. Populated table rows
  it('renders audit log rows with timestamp, user, action, category, severity, and message', async () => {
    auditQueryResult = { data: MOCK_AUDIT_LOGS, error: null, count: 3 };
    await renderComponent();

    await waitFor(() => {
      expect(screen.getByText('testuser-alpha@fake.test')).toBeInTheDocument();
    });
    expect(screen.getByText('VIEW_RECORD')).toBeInTheDocument();
    expect(screen.getByText('PHI_ACCESS')).toBeInTheDocument();
    expect(screen.getByText('Test Patient Alpha record viewed')).toBeInTheDocument();
    expect(screen.getByText('testuser-beta@fake.test')).toBeInTheDocument();
    expect(screen.getByText('LOGIN_FAILED')).toBeInTheDocument();
    expect(screen.getByText('Multiple failed login attempts detected')).toBeInTheDocument();
    // Third log has null user_email — displays 'System'
    expect(screen.getByText('System')).toBeInTheDocument();
    expect(screen.getByText('SYSTEM_BACKUP')).toBeInTheDocument();
  });

  // 4. Critical severity badge — red styling
  it('renders critical severity badge with red styling', async () => {
    auditQueryResult = { data: MOCK_AUDIT_LOGS, error: null, count: 3 };
    await renderComponent();
    await waitFor(() => { expect(screen.getByText('critical')).toBeInTheDocument(); });
    const badge = screen.getByText('critical');
    expect(badge.className).toContain('bg-red-100');
    expect(badge.className).toContain('text-red-800');
  });

  // 5. Info severity badge — blue styling (default)
  it('renders info severity badge with blue styling', async () => {
    auditQueryResult = { data: MOCK_AUDIT_LOGS, error: null, count: 3 };
    await renderComponent();
    await waitFor(() => { expect(screen.getByText('info')).toBeInTheDocument(); });
    const badge = screen.getByText('info');
    expect(badge.className).toContain('bg-blue-100');
    expect(badge.className).toContain('text-blue-800');
  });

  // 6. Empty state
  it('shows "No audit logs found for the selected filters" when no logs exist', async () => {
    await renderComponent();
    await waitFor(() => {
      expect(screen.getByText('No audit logs found for the selected filters')).toBeInTheDocument();
    });
  });

  // 7. Search input placeholder
  it('renders a search input with "Search user or message..." placeholder', async () => {
    await renderComponent();
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search user or message...')).toBeInTheDocument();
    });
  });

  // 8. Category filter dropdown options
  it('provides category filter options including PHI_ACCESS, AUTHENTICATION, etc.', async () => {
    await renderComponent();
    await waitFor(() => { expect(screen.getByText('Audit Logs')).toBeInTheDocument(); });
    const select = screen.getByDisplayValue('All Categories');
    const options = within(select as HTMLElement).getAllByRole('option').map((o) => o.textContent);
    expect(options).toContain('All Categories');
    expect(options).toContain('PHI Access');
    expect(options).toContain('Authentication');
    expect(options).toContain('Administrative');
    expect(options).toContain('Data Modification');
    expect(options).toContain('Security Event');
  });

  // 9. Severity filter dropdown options
  it('provides severity filter options: info, warning, error, critical', async () => {
    await renderComponent();
    await waitFor(() => { expect(screen.getByText('Audit Logs')).toBeInTheDocument(); });
    const select = screen.getByDisplayValue('All Severities');
    const options = within(select as HTMLElement).getAllByRole('option').map((o) => o.textContent);
    expect(options).toContain('All Severities');
    expect(options).toContain('Info');
    expect(options).toContain('Warning');
    expect(options).toContain('Error');
    expect(options).toContain('Critical');
  });

  // 10. Date range filter dropdown options
  it('provides date range filter options: Last 24 hours through All time', async () => {
    await renderComponent();
    await waitFor(() => { expect(screen.getByText('Audit Logs')).toBeInTheDocument(); });
    const select = screen.getByDisplayValue('Last 7 days');
    const options = within(select as HTMLElement).getAllByRole('option').map((o) => o.textContent);
    expect(options).toContain('Last 24 hours');
    expect(options).toContain('Last 7 days');
    expect(options).toContain('Last 30 days');
    expect(options).toContain('Last 90 days');
    expect(options).toContain('All time');
  });

  // 11. Export CSV button enabled when logs exist
  it('enables the Export CSV button when audit logs are present', async () => {
    auditQueryResult = { data: MOCK_AUDIT_LOGS, error: null, count: 3 };
    await renderComponent();
    await waitFor(() => {
      expect(screen.getByText('testuser-alpha@fake.test')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /export csv/i })).toBeEnabled();
  });

  // 12. Export CSV button disabled when no logs
  it('disables the Export CSV button when there are no audit logs', async () => {
    await renderComponent();
    await waitFor(() => {
      expect(screen.getByText('No audit logs found for the selected filters')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /export csv/i })).toBeDisabled();
  });

  // 13. Pagination text
  it('displays pagination text "Showing page 1 (3 records)" when logs are present', async () => {
    auditQueryResult = { data: MOCK_AUDIT_LOGS, error: null, count: 3 };
    await renderComponent();
    await waitFor(() => {
      expect(screen.getByText(/Showing page 1/)).toBeInTheDocument();
    });
    expect(screen.getByText(/3 records/)).toBeInTheDocument();
  });

  // 14. Previous button disabled on page 1
  it('disables the Previous button when on page 1', async () => {
    auditQueryResult = { data: MOCK_AUDIT_LOGS, error: null, count: 3 };
    await renderComponent();
    await waitFor(() => { expect(screen.getByText('Previous')).toBeInTheDocument(); });
    expect(screen.getByText('Previous').closest('button')).toBeDisabled();
  });

  // 15. Next button disabled when results < pageSize (50)
  it('disables the Next button when returned logs are fewer than page size', async () => {
    auditQueryResult = { data: MOCK_AUDIT_LOGS, error: null, count: 3 };
    await renderComponent();
    await waitFor(() => { expect(screen.getByText('Next')).toBeInTheDocument(); });
    expect(screen.getByText('Next').closest('button')).toBeDisabled();
  });

  // 16. HIPAA Compliance note
  it('displays the HIPAA Compliance note about 7-year log retention', async () => {
    await renderComponent();
    await waitFor(() => { expect(screen.getByText('HIPAA Compliance')).toBeInTheDocument(); });
    expect(screen.getByText(/Logs are retained for 7 years as required by HIPAA/)).toBeInTheDocument();
  });

  // 17. Profile tenant_id lookup
  it('queries the profiles table for tenant_id before fetching audit logs', async () => {
    await renderComponent();
    await waitFor(() => { expect(mockFrom).toHaveBeenCalledWith('profiles'); });
    expect(mockProfileSelect).toHaveBeenCalledWith('tenant_id');
    expect(mockProfileEq).toHaveBeenCalledWith('user_id', 'user-test-001');
    expect(mockProfileSingle).toHaveBeenCalled();
  });

  // 18. No tenant_id — early return
  it('does not query audit_logs when profile has no tenant_id', async () => {
    mockProfileSingle.mockResolvedValue({ data: { tenant_id: null }, error: null });
    await renderComponent();
    await waitFor(() => {
      expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();
    });
    expect(mockFrom).not.toHaveBeenCalledWith('audit_logs');
  });

  // 19. Error handling
  it('does not crash when the audit_logs query returns an error', async () => {
    const { auditLogger } = await import('../../../services/auditLogger');
    auditQueryResult = { data: null, error: { message: 'Test DB error', code: '42P01' }, count: 0 };
    await renderComponent();
    await waitFor(() => {
      expect(auditLogger.error).toHaveBeenCalledWith(
        'TENANT_AUDIT_LOGS_LOAD_FAILED',
        expect.objectContaining({ message: expect.stringContaining('') }),
        expect.objectContaining({ tenantId: expect.anything() }),
      );
    });
  });

  // 20. Table column headers
  it('renders all six table column headers', async () => {
    await renderComponent();
    await waitFor(() => { expect(screen.getByText('Audit Logs')).toBeInTheDocument(); });
    expect(screen.getByText('Timestamp')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText('Severity')).toBeInTheDocument();
    expect(screen.getByText('Message')).toBeInTheDocument();
  });

  // 21. Warning severity badge — yellow styling
  it('renders warning severity badge with yellow styling', async () => {
    auditQueryResult = { data: MOCK_AUDIT_LOGS, error: null, count: 3 };
    await renderComponent();
    await waitFor(() => { expect(screen.getByText('warning')).toBeInTheDocument(); });
    const badge = screen.getByText('warning');
    expect(badge.className).toContain('bg-yellow-100');
    expect(badge.className).toContain('text-yellow-800');
  });

  // 22. Export CSV triggers blob download
  it('creates a CSV blob and triggers download when Export CSV is clicked', async () => {
    auditQueryResult = { data: MOCK_AUDIT_LOGS, error: null, count: 3 };
    const mockClick = vi.fn();
    const mockCreateObjectURL = vi.fn(() => 'blob:test-url');
    const mockRevokeObjectURL = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        const anchor = origCreate('a');
        anchor.click = mockClick;
        return anchor;
      }
      return origCreate(tag);
    });
    globalThis.URL.createObjectURL = mockCreateObjectURL;
    globalThis.URL.revokeObjectURL = mockRevokeObjectURL;

    const user = userEvent.setup();
    await renderComponent();
    await waitFor(() => {
      expect(screen.getByText('testuser-alpha@fake.test')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /export csv/i }));
    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  // 23. Pagination hidden when no logs
  it('hides pagination controls when there are no audit logs', async () => {
    await renderComponent();
    await waitFor(() => {
      expect(screen.getByText('No audit logs found for the selected filters')).toBeInTheDocument();
    });
    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  // 24. Null resource fields — component still renders correctly
  it('renders log with null resource fields without crashing', async () => {
    auditQueryResult = { data: [MOCK_AUDIT_LOGS[1]], error: null, count: 1 };
    await renderComponent();
    await waitFor(() => {
      expect(screen.getByText('testuser-beta@fake.test')).toBeInTheDocument();
    });
    expect(screen.getByText('LOGIN_FAILED')).toBeInTheDocument();
    expect(screen.getByText('AUTHENTICATION')).toBeInTheDocument();
    expect(screen.getByText('Multiple failed login attempts detected')).toBeInTheDocument();
  });
});
