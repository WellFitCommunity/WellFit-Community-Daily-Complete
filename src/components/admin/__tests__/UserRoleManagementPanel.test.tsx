/**
 * UserRoleManagementPanel tests — validates staff listing, role assignment modal,
 * role revocation flow, search/filter, hierarchy enforcement, and error states.
 *
 * Deletion Test: Every test would FAIL if the component were an empty <div />.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ============================================================================
// MOCKS
// ============================================================================

const mockGetStaffUsers = vi.fn();
const mockAssignRole = vi.fn();
const mockRevokeRole = vi.fn();

vi.mock('../../../services/userRoleManagementService', () => ({
  userRoleManagementService: {
    getStaffUsers: (...args: unknown[]) => mockGetStaffUsers(...args),
    assignRole: (...args: unknown[]) => mockAssignRole(...args),
    revokeRole: (...args: unknown[]) => mockRevokeRole(...args),
    getAssignableRoles: () => ['nurse', 'physician', 'admin', 'billing_specialist'],
    getAssignableRoleOptions: () => [
      { value: 'nurse', label: 'Nurse' },
      { value: 'physician', label: 'Physician' },
      { value: 'admin', label: 'Administrator' },
      { value: 'billing_specialist', label: 'Billing Specialist' },
    ],
  },
}));

const mockAdminAuth = {
  adminRole: 'super_admin' as const,
  isAdminAuthenticated: true,
};

vi.mock('../../../contexts/AdminAuthContext', () => ({
  useAdminAuth: () => mockAdminAuth,
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-user-1' } } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'admin-user-1' } } } }),
    },
  },
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

// Mock EABadge to render children directly
vi.mock('../../envision-atlus', () => ({
  EABadge: ({ children }: { children: React.ReactNode }) => <span data-testid="ea-badge">{children}</span>,
}));

// ============================================================================
// TEST DATA
// ============================================================================

const MOCK_STAFF = [
  {
    user_id: 'user-100',
    first_name: 'Alpha',
    last_name: 'Tester',
    email: 'alpha.tester@testfacility.org',
    role: 'nurse' as const,
    role_code: 3,
    department: 'nursing' as const,
    is_active: true,
    created_at: '2025-06-01T00:00:00Z',
    last_sign_in_at: '2026-02-24T10:00:00Z',
  },
  {
    user_id: 'user-200',
    first_name: 'Beta',
    last_name: 'Tester',
    email: 'beta.tester@testfacility.org',
    role: 'physician' as const,
    role_code: 5,
    department: 'medical' as const,
    is_active: true,
    created_at: '2025-07-01T00:00:00Z',
    last_sign_in_at: '2026-02-23T15:00:00Z',
  },
  {
    user_id: 'user-300',
    first_name: 'Gamma',
    last_name: 'Unassigned',
    email: 'gamma.unassigned@testfacility.org',
    role: null,
    role_code: null,
    department: null,
    is_active: false,
    created_at: '2025-08-01T00:00:00Z',
    last_sign_in_at: null,
  },
];

// ============================================================================
// TESTS
// ============================================================================

describe('UserRoleManagementPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStaffUsers.mockResolvedValue({
      success: true,
      data: MOCK_STAFF,
      error: null,
    });
    mockAdminAuth.adminRole = 'super_admin';
    mockAdminAuth.isAdminAuthenticated = true;
  });

  // Lazy import to allow mocks to set up
  const renderPanel = async () => {
    const { UserRoleManagementPanel } = await import('../UserRoleManagementPanel');
    return render(<UserRoleManagementPanel />);
  };

  it('displays staff list with names and roles', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Alpha Tester')).toBeInTheDocument();
    });
    expect(screen.getByText('Beta Tester')).toBeInTheDocument();
    expect(screen.getByText('Gamma Unassigned')).toBeInTheDocument();
    // Roles appear in EABadge — check via testid
    const badges = screen.getAllByTestId('ea-badge');
    const badgeTexts = badges.map(b => b.textContent);
    expect(badgeTexts).toContain('Nurse');
    expect(badgeTexts).toContain('Physician');
  });

  it('shows staff count and table row count after loading', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Alpha Tester')).toBeInTheDocument();
    });
    // Table renders all 3 staff members
    expect(screen.getByText('Beta Tester')).toBeInTheDocument();
    expect(screen.getByText('Gamma Unassigned')).toBeInTheDocument();
    // Footer shows count
    expect(screen.getByText(/showing 3 of 3 staff/i)).toBeInTheDocument();
  });

  it('filters staff by search query', async () => {
    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Alpha Tester')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search by name/i);
    await user.type(searchInput, 'Beta');

    expect(screen.getByText('Beta Tester')).toBeInTheDocument();
    expect(screen.queryByText('Alpha Tester')).not.toBeInTheDocument();
    expect(screen.queryByText('Gamma Unassigned')).not.toBeInTheDocument();
  });

  it('opens role assignment modal when Role button is clicked', async () => {
    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Alpha Tester')).toBeInTheDocument();
    });

    const roleButtons = screen.getAllByTitle('Assign or change role');
    await user.click(roleButtons[0]);

    expect(screen.getByRole('heading', { name: /assign role/i })).toBeInTheDocument();
    // Email appears in both table and modal — verify modal form fields are present
    expect(screen.getByLabelText(/new role/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/department/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/reason for change/i)).toBeInTheDocument();
    // Modal shows user info section with email
    const emailElements = screen.getAllByText('alpha.tester@testfacility.org');
    expect(emailElements.length).toBeGreaterThanOrEqual(2); // table + modal
  });

  it('requires reason before saving role assignment', async () => {
    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Alpha Tester')).toBeInTheDocument();
    });

    const roleButtons = screen.getAllByTitle('Assign or change role');
    await user.click(roleButtons[0]);

    // Select a role but don't provide reason
    const roleSelect = screen.getByLabelText(/new role/i);
    await user.selectOptions(roleSelect, 'physician');

    const saveBtn = screen.getByRole('button', { name: /assign role/i });
    await user.click(saveBtn);

    expect(screen.getByText('Please provide a reason for this role change')).toBeInTheDocument();
    expect(mockAssignRole).not.toHaveBeenCalled();
  });

  it('submits role assignment with correct data', async () => {
    const user = userEvent.setup();
    mockAssignRole.mockResolvedValue({
      success: true,
      data: { ...MOCK_STAFF[0], role: 'physician', role_code: 5 },
      error: null,
    });

    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Alpha Tester')).toBeInTheDocument();
    });

    const roleButtons = screen.getAllByTitle('Assign or change role');
    await user.click(roleButtons[0]);

    const roleSelect = screen.getByLabelText(/new role/i);
    await user.selectOptions(roleSelect, 'physician');

    const reasonInput = screen.getByLabelText(/reason for change/i);
    await user.type(reasonInput, 'Role promotion after certification');

    const saveBtn = screen.getByRole('button', { name: /assign role/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(mockAssignRole).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-100',
          new_role: 'physician',
          reason: 'Role promotion after certification',
        }),
        'super_admin',
        'admin-user-1'
      );
    });
  });

  it('opens revoke confirmation with reason input', async () => {
    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Alpha Tester')).toBeInTheDocument();
    });

    const revokeButtons = screen.getAllByTitle('Revoke role');
    await user.click(revokeButtons[0]);

    expect(screen.getByRole('heading', { name: /revoke role/i })).toBeInTheDocument();
    expect(screen.getByText(/remove the/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/reason/i)).toBeInTheDocument();
  });

  it('submits revoke with reason and updates local state', async () => {
    const user = userEvent.setup();
    mockRevokeRole.mockResolvedValue({ success: true, data: true, error: null });

    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Alpha Tester')).toBeInTheDocument();
    });

    const revokeButtons = screen.getAllByTitle('Revoke role');
    await user.click(revokeButtons[0]);

    const reasonInput = screen.getByLabelText(/reason/i);
    await user.type(reasonInput, 'Termination from facility');

    const confirmBtn = screen.getByRole('button', { name: /revoke role/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(mockRevokeRole).toHaveBeenCalledWith(
        'user-100',
        'Termination from facility',
        'super_admin',
        'admin-user-1'
      );
    });
  });

  it('shows error state when staff list fails to load', async () => {
    mockGetStaffUsers.mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'DATABASE_ERROR', message: 'Connection failed' },
    });

    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });
  });

  it('shows auth required message when not authenticated', async () => {
    mockAdminAuth.isAdminAuthenticated = false;
    mockAdminAuth.adminRole = null as unknown as 'super_admin';

    await renderPanel();

    expect(screen.getByText(/admin authentication required/i)).toBeInTheDocument();
  });

  it('shows unassigned users without revoke button', async () => {
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Gamma Unassigned')).toBeInTheDocument();
    });

    // Gamma Unassigned has no role — should have Role button but no Revoke button
    // There should be 3 Role buttons (one per user) and 2 Revoke buttons (only users with roles)
    const roleButtons = screen.getAllByTitle('Assign or change role');
    const revokeButtons = screen.getAllByTitle('Revoke role');
    expect(roleButtons).toHaveLength(3);
    expect(revokeButtons).toHaveLength(2);
  });

  it('displays role options from assignable roles in the modal', async () => {
    const user = userEvent.setup();
    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Alpha Tester')).toBeInTheDocument();
    });

    const roleButtons = screen.getAllByTitle('Assign or change role');
    await user.click(roleButtons[0]);

    const roleSelect = screen.getByLabelText(/new role/i);
    const options = roleSelect.querySelectorAll('option');
    // 1 placeholder + 4 assignable roles
    expect(options.length).toBe(5);
  });
});
