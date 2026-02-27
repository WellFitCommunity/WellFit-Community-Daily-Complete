/**
 * TenantConfigHistory Tests
 *
 * Tests config change audit trail display: stats cards, change table,
 * filters, pagination, detail modal, export, and error/empty states.
 *
 * Deletion Test: Every test would FAIL if the component rendered an empty <div />.
 * Synthetic test data only.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

const mockGetChangeHistory = vi.fn();
const mockGetChangeStats = vi.fn();
const mockSearchChanges = vi.fn();
const mockExportChangeHistory = vi.fn();

vi.mock('../../../services/tenantConfigAuditService', () => ({
  tenantConfigAuditService: {
    getChangeHistory: (...args: unknown[]) => mockGetChangeHistory(...args),
    getChangeStats: (...args: unknown[]) => mockGetChangeStats(...args),
    searchChanges: (...args: unknown[]) => mockSearchChanges(...args),
    exportChangeHistory: (...args: unknown[]) => mockExportChangeHistory(...args),
  },
  // Re-export types (empty — only used for TS)
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-test-001' } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: vi.fn().mockResolvedValue({ data: { tenant_id: 'tenant-test-001' } }),
        }),
      }),
    }),
  },
}));

vi.mock('../../envision-atlus/EACard', () => ({
  EACard: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="ea-card" className={className}>{children}</div>
  ),
  EACardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="ea-card-header">{children}</div>
  ),
  EACardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="ea-card-content" className={className}>{children}</div>
  ),
}));

// Import AFTER mocks
import { TenantConfigHistory } from '../TenantConfigHistory';

// ============================================================================
// TEST DATA
// ============================================================================

const MOCK_CHANGES = [
  {
    id: 'change-001',
    tenantId: 'tenant-test-001',
    configTable: 'tenant_module_config',
    fieldName: 'is_enabled',
    action: 'UPDATE' as const,
    oldValue: false,
    newValue: true,
    changedByUserId: 'user-test-001',
    changedByName: 'Test Admin Alpha',
    changedByRole: 'admin',
    changedAt: '2026-02-25T10:00:00Z',
    changeSource: 'admin_panel',
    reason: 'Enable new module',
    approvalTicket: 'TICKET-001',
  },
  {
    id: 'change-002',
    tenantId: 'tenant-test-001',
    configTable: 'admin_settings',
    fieldName: 'session_timeout',
    action: 'INSERT' as const,
    oldValue: null,
    newValue: 30,
    changedByUserId: 'user-test-002',
    changedByName: 'Test Admin Beta',
    changedByRole: 'super_admin',
    changedAt: '2026-02-24T14:00:00Z',
    changeSource: 'api',
    reason: null,
    approvalTicket: null,
  },
  {
    id: 'change-003',
    tenantId: 'tenant-test-001',
    configTable: 'tenants',
    fieldName: 'name',
    action: 'DELETE' as const,
    oldValue: 'Old Name',
    newValue: null,
    changedByUserId: null,
    changedByName: null,
    changedByRole: null,
    changedAt: '2026-02-23T09:00:00Z',
    changeSource: 'system',
    reason: null,
    approvalTicket: null,
  },
];

const MOCK_STATS = {
  totalChanges: 42,
  changesByTable: { tenant_module_config: 20, admin_settings: 15, tenants: 7 },
  changesByUser: [
    { name: 'Test Admin Alpha', count: 30 },
    { name: 'Test Admin Beta', count: 12 },
  ],
  changesByAction: { INSERT: 10, UPDATE: 25, DELETE: 7 },
  changesByDay: [{ date: '2026-02-25', count: 5 }],
};

// ============================================================================
// HELPERS
// ============================================================================

function setupHappyPath() {
  mockGetChangeHistory.mockResolvedValue({
    success: true,
    data: { changes: MOCK_CHANGES, total: MOCK_CHANGES.length },
  });
  mockGetChangeStats.mockResolvedValue({
    success: true,
    data: MOCK_STATS,
  });
  mockSearchChanges.mockResolvedValue({
    success: true,
    data: [MOCK_CHANGES[0]],
  });
  mockExportChangeHistory.mockResolvedValue({
    success: true,
    data: 'csv-content-here',
  });
}

function setupEmptyState() {
  mockGetChangeHistory.mockResolvedValue({
    success: true,
    data: { changes: [], total: 0 },
  });
  mockGetChangeStats.mockResolvedValue({
    success: true,
    data: { ...MOCK_STATS, totalChanges: 0 },
  });
}

function setupError() {
  mockGetChangeHistory.mockResolvedValue({
    success: false,
    error: { message: 'Database connection failed' },
  });
  mockGetChangeStats.mockResolvedValue({
    success: true,
    data: MOCK_STATS,
  });
}

function renderComponent() {
  return render(<TenantConfigHistory tenantId="tenant-test-001" />);
}

// ============================================================================
// TESTS
// ============================================================================

describe('TenantConfigHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  // --- Loading ---

  it('shows loading spinner initially', () => {
    // Make the promise hang
    mockGetChangeHistory.mockReturnValue(new Promise(() => {}));
    mockGetChangeStats.mockReturnValue(new Promise(() => {}));
    renderComponent();
    // The spinner has animate-spin class
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  // --- Header ---

  it('displays "Configuration History" title', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Configuration History')).toBeInTheDocument();
    });
  });

  it('displays subtitle text', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Track all changes to tenant configuration')).toBeInTheDocument();
    });
  });

  // --- Stats Cards ---

  it('displays total changes count in stats', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });
    expect(screen.getByText('Total Changes (30d)')).toBeInTheDocument();
  });

  it('displays action breakdown counts (inserts, updates, deletes)', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument(); // Inserts
    });
    expect(screen.getByText('25')).toBeInTheDocument(); // Updates
    expect(screen.getByText('7')).toBeInTheDocument(); // Deletes
  });

  it('displays unique users count', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument(); // 2 users in MOCK_STATS
    });
    expect(screen.getByText('Unique Users')).toBeInTheDocument();
  });

  it('displays tables modified count', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument(); // 3 tables
    });
    expect(screen.getByText('Tables Modified')).toBeInTheDocument();
  });

  // --- Change Table ---

  it('renders change rows with table name and field', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getAllByText('tenant_module_config').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText('is_enabled')).toBeInTheDocument();
    expect(screen.getAllByText('admin_settings').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('session_timeout')).toBeInTheDocument();
  });

  it('renders UPDATE action badge', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('UPDATE')).toBeInTheDocument();
    });
  });

  it('renders INSERT action badge', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('INSERT')).toBeInTheDocument();
    });
  });

  it('renders DELETE action badge', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('DELETE')).toBeInTheDocument();
    });
  });

  it('shows changed by name and role', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Test Admin Alpha')).toBeInTheDocument();
    });
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('Test Admin Beta')).toBeInTheDocument();
    expect(screen.getByText('super_admin')).toBeInTheDocument();
  });

  it('shows "System" when changed by name is null', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('System')).toBeInTheDocument();
    });
  });

  it('shows total count in header', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText(`(${MOCK_CHANGES.length} total)`)).toBeInTheDocument();
    });
  });

  // --- Detail Modal ---

  it('"View Details" button opens modal with change details', async () => {
    const user = userEvent.setup();
    renderComponent();
    await waitFor(() => {
      expect(screen.getAllByText('View Details')).toHaveLength(MOCK_CHANGES.length);
    });

    // Click first View Details
    await user.click(screen.getAllByText('View Details')[0]);

    // Modal should show "Change Details" heading
    expect(screen.getByText('Change Details')).toBeInTheDocument();
    // Shows the field info
    expect(screen.getByText('Previous Value')).toBeInTheDocument();
    expect(screen.getByText('New Value')).toBeInTheDocument();
  });

  it('modal shows reason when present', async () => {
    const user = userEvent.setup();
    renderComponent();
    await waitFor(() => {
      expect(screen.getAllByText('View Details').length).toBeGreaterThan(0);
    });

    // First change has reason
    await user.click(screen.getAllByText('View Details')[0]);
    expect(screen.getByText('Enable new module')).toBeInTheDocument();
  });

  it('modal shows approval ticket when present', async () => {
    const user = userEvent.setup();
    renderComponent();
    await waitFor(() => {
      expect(screen.getAllByText('View Details').length).toBeGreaterThan(0);
    });

    await user.click(screen.getAllByText('View Details')[0]);
    expect(screen.getByText('TICKET-001')).toBeInTheDocument();
  });

  it('modal close button dismisses modal', async () => {
    const user = userEvent.setup();
    renderComponent();
    await waitFor(() => {
      expect(screen.getAllByText('View Details').length).toBeGreaterThan(0);
    });

    await user.click(screen.getAllByText('View Details')[0]);
    expect(screen.getByText('Change Details')).toBeInTheDocument();

    // Click Close button
    await user.click(screen.getByText('Close'));
    expect(screen.queryByText('Change Details')).not.toBeInTheDocument();
  });

  // --- Filters ---

  it('search button triggers search', async () => {
    const user = userEvent.setup();
    renderComponent();
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search changes...')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Search changes...'), 'module');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(mockSearchChanges).toHaveBeenCalledWith('module', 'tenant-test-001');
  });

  it('search on Enter triggers search', async () => {
    const user = userEvent.setup();
    renderComponent();
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search changes...')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Search changes...'), 'timeout{Enter}');
    expect(mockSearchChanges).toHaveBeenCalled();
  });

  it('action filter dropdown filters by action type', async () => {
    const user = userEvent.setup();
    renderComponent();
    await waitFor(() => {
      expect(screen.getByDisplayValue('All Actions')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByDisplayValue('All Actions'), 'UPDATE');

    // Should have called getChangeHistory with action filter
    await waitFor(() => {
      const lastCall = mockGetChangeHistory.mock.calls[mockGetChangeHistory.mock.calls.length - 1];
      expect(lastCall[0].action).toBe('UPDATE');
    });
  });

  // --- Export ---

  it('Export CSV button triggers export', async () => {
    const user = userEvent.setup();
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Export CSV')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export CSV'));
    expect(mockExportChangeHistory).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-test-001' }),
      'csv'
    );
  });

  it('Export JSON button triggers export', async () => {
    const user = userEvent.setup();
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Export JSON')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Export JSON'));
    expect(mockExportChangeHistory).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-test-001' }),
      'json'
    );
  });

  // --- Empty State ---

  it('shows "No configuration changes found" when empty', async () => {
    setupEmptyState();
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('No configuration changes found')).toBeInTheDocument();
    });
  });

  // --- Error State ---

  it('displays error message when data load fails', async () => {
    setupError();
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Database connection failed')).toBeInTheDocument();
    });
  });
});
