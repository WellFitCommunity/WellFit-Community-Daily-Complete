/**
 * UserProvisioningPanel tests — validates invite form, pending registrations table,
 * validation rules, success state with credentials, tab switching, and error handling.
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

const mockInviteUser = vi.fn();
const mockGetPendingRegistrations = vi.fn();
const mockDeletePendingRegistration = vi.fn();
const mockGetRoles = vi.fn();

vi.mock('../../../services/userProvisioningService', () => ({
  userProvisioningService: {
    inviteUser: (...args: unknown[]) => mockInviteUser(...args),
    getPendingRegistrations: (...args: unknown[]) => mockGetPendingRegistrations(...args),
    deletePendingRegistration: (...args: unknown[]) => mockDeletePendingRegistration(...args),
    getRoles: (...args: unknown[]) => mockGetRoles(...args),
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

const MOCK_ROLES = [
  { code: 1, slug: 'admin', label: 'Administrator', level: 'elevated' },
  { code: 3, slug: 'staff', label: 'Clinical Staff (Nurse)', level: 'elevated' },
  { code: 4, slug: 'senior', label: 'Patient / Senior', level: 'public' },
  { code: 5, slug: 'volunteer', label: 'Volunteer', level: 'public' },
];

const MOCK_PENDING = [
  {
    id: 'pending-001',
    phone: '+15550100',
    email: 'alpha.pending@testfacility.org',
    first_name: 'Alpha',
    last_name: 'Pending',
    role_code: 3,
    role_slug: 'staff',
    hcaptcha_verified: true,
    verification_code_sent: true,
    created_at: '2026-02-24T10:00:00Z',
    expires_at: '2026-12-31T23:59:59Z',
  },
  {
    id: 'pending-002',
    phone: null,
    email: 'beta.pending@testfacility.org',
    first_name: 'Beta',
    last_name: 'Pending',
    role_code: null,
    role_slug: null,
    hcaptcha_verified: false,
    verification_code_sent: false,
    created_at: '2026-02-23T08:00:00Z',
    expires_at: '2025-01-01T00:00:00Z', // expired
  },
];

const MOCK_INVITE_RESULT = {
  success: true,
  user_id: 'new-user-abc',
  role_code: 3,
  role_slug: 'staff',
  delivery: 'none',
  temporary_password: 'TempPass123!xyz',
  info: 'User created with manual credential delivery',
};

// ============================================================================
// TESTS
// ============================================================================

describe('UserProvisioningPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRoles.mockReturnValue(MOCK_ROLES);
    mockGetPendingRegistrations.mockResolvedValue({
      success: true,
      data: MOCK_PENDING,
      error: null,
    });
    mockAdminAuth.adminRole = 'super_admin';
    mockAdminAuth.isAdminAuthenticated = true;
  });

  const renderPanel = async () => {
    const { UserProvisioningPanel } = await import('../UserProvisioningPanel');
    return render(<UserProvisioningPanel />);
  };

  it('shows invite form with role dropdown and delivery options', async () => {
    await renderPanel();

    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/initial role/i)).toBeInTheDocument();
    // Delivery option buttons — use getAllByText since "Email" also appears as a label
    expect(screen.getByText('SMS')).toBeInTheDocument();
    expect(screen.getByText('Manual (copy credentials)')).toBeInTheDocument();
    // Credential delivery section exists
    expect(screen.getByText('Credential Delivery')).toBeInTheDocument();
  });

  it('validates that first name and last name are required', async () => {
    const user = userEvent.setup();
    await renderPanel();

    const submitBtn = screen.getByRole('button', { name: /create user/i });
    await user.click(submitBtn);

    expect(screen.getByText('First name and last name are required')).toBeInTheDocument();
    expect(mockInviteUser).not.toHaveBeenCalled();
  });

  it('validates that email or phone is required', async () => {
    const user = userEvent.setup();
    await renderPanel();

    await user.type(screen.getByLabelText(/first name/i), 'Test');
    await user.type(screen.getByLabelText(/last name/i), 'User');
    await user.selectOptions(screen.getByLabelText(/initial role/i), '3');

    const submitBtn = screen.getByRole('button', { name: /create user/i });
    await user.click(submitBtn);

    expect(screen.getByText('Either email or phone number is required')).toBeInTheDocument();
    expect(mockInviteUser).not.toHaveBeenCalled();
  });

  it('validates role selection is required', async () => {
    const user = userEvent.setup();
    await renderPanel();

    await user.type(screen.getByLabelText(/first name/i), 'Test');
    await user.type(screen.getByLabelText(/last name/i), 'User');
    await user.type(screen.getByLabelText(/email/i), 'test@testfacility.org');

    const submitBtn = screen.getByRole('button', { name: /create user/i });
    await user.click(submitBtn);

    expect(screen.getByText('Please select a role')).toBeInTheDocument();
    expect(mockInviteUser).not.toHaveBeenCalled();
  });

  it('submits invite with correct data', async () => {
    const user = userEvent.setup();
    mockInviteUser.mockResolvedValue({
      success: true,
      data: MOCK_INVITE_RESULT,
      error: null,
    });

    await renderPanel();

    await user.type(screen.getByLabelText(/first name/i), 'Test');
    await user.type(screen.getByLabelText(/last name/i), 'Nurse');
    await user.type(screen.getByLabelText(/email/i), 'test.nurse@testfacility.org');
    await user.selectOptions(screen.getByLabelText(/initial role/i), '3');

    const submitBtn = screen.getByRole('button', { name: /create user/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockInviteUser).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: 'Test',
          last_name: 'Nurse',
          email: 'test.nurse@testfacility.org',
          role_code: 3,
          delivery: 'none',
        })
      );
    });
  });

  it('shows success state with temporary password after invite', async () => {
    const user = userEvent.setup();
    mockInviteUser.mockResolvedValue({
      success: true,
      data: MOCK_INVITE_RESULT,
      error: null,
    });

    await renderPanel();

    await user.type(screen.getByLabelText(/first name/i), 'Test');
    await user.type(screen.getByLabelText(/last name/i), 'Nurse');
    await user.type(screen.getByLabelText(/email/i), 'test.nurse@testfacility.org');
    await user.selectOptions(screen.getByLabelText(/initial role/i), '3');

    const submitBtn = screen.getByRole('button', { name: /create user/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('User Created Successfully')).toBeInTheDocument();
    });
    expect(screen.getByText(/temporary password/i)).toBeInTheDocument();
    expect(screen.getByText('Invite Another User')).toBeInTheDocument();
  });

  it('shows error when invite fails', async () => {
    const user = userEvent.setup();
    mockInviteUser.mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'OPERATION_FAILED', message: 'Email already registered' },
    });

    await renderPanel();

    await user.type(screen.getByLabelText(/first name/i), 'Test');
    await user.type(screen.getByLabelText(/last name/i), 'User');
    await user.type(screen.getByLabelText(/email/i), 'existing@testfacility.org');
    await user.selectOptions(screen.getByLabelText(/initial role/i), '3');

    const submitBtn = screen.getByRole('button', { name: /create user/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Email already registered')).toBeInTheDocument();
    });
  });

  it('switches to pending tab and loads registrations', async () => {
    const user = userEvent.setup();
    await renderPanel();

    const pendingTab = screen.getByRole('button', { name: /pending registrations/i });
    await user.click(pendingTab);

    await waitFor(() => {
      expect(mockGetPendingRegistrations).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('Alpha Pending')).toBeInTheDocument();
    });
    expect(screen.getByText('Beta Pending')).toBeInTheDocument();
  });

  it('shows expired badge for expired pending registrations', async () => {
    const user = userEvent.setup();
    await renderPanel();

    const pendingTab = screen.getByRole('button', { name: /pending registrations/i });
    await user.click(pendingTab);

    await waitFor(() => {
      expect(screen.getByText('Beta Pending')).toBeInTheDocument();
    });

    // Beta has expired date — should show Expired badge
    const badges = screen.getAllByTestId('ea-badge');
    const badgeTexts = badges.map(b => b.textContent);
    expect(badgeTexts).toContain('Expired');
  });

  it('deletes a pending registration after confirmation', async () => {
    const user = userEvent.setup();
    mockDeletePendingRegistration.mockResolvedValue({
      success: true,
      data: true,
      error: null,
    });

    await renderPanel();

    const pendingTab = screen.getByRole('button', { name: /pending registrations/i });
    await user.click(pendingTab);

    await waitFor(() => {
      expect(screen.getByText('Alpha Pending')).toBeInTheDocument();
    });

    // Click delete button for first pending registration
    const deleteButtons = screen.getAllByTitle('Delete pending registration');
    await user.click(deleteButtons[0]);

    // Confirm deletion
    const confirmBtn = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(mockDeletePendingRegistration).toHaveBeenCalledWith('pending-001');
    });
  });

  it('shows auth required message when not authenticated', async () => {
    mockAdminAuth.isAdminAuthenticated = false;
    mockAdminAuth.adminRole = null as unknown as 'super_admin';

    await renderPanel();

    expect(screen.getByText(/admin authentication required/i)).toBeInTheDocument();
  });

  it('shows role options grouped by elevated and public levels', async () => {
    await renderPanel();

    const roleSelect = screen.getByLabelText(/initial role/i);
    const optgroups = roleSelect.querySelectorAll('optgroup');
    expect(optgroups).toHaveLength(2);
    expect(optgroups[0].getAttribute('label')).toBe('Elevated Roles');
    expect(optgroups[1].getAttribute('label')).toBe('Public Roles');
  });

  it('resets form when Invite Another User is clicked', async () => {
    const user = userEvent.setup();
    mockInviteUser.mockResolvedValue({
      success: true,
      data: MOCK_INVITE_RESULT,
      error: null,
    });

    await renderPanel();

    await user.type(screen.getByLabelText(/first name/i), 'Test');
    await user.type(screen.getByLabelText(/last name/i), 'Nurse');
    await user.type(screen.getByLabelText(/email/i), 'test.nurse@testfacility.org');
    await user.selectOptions(screen.getByLabelText(/initial role/i), '3');
    await user.click(screen.getByRole('button', { name: /create user/i }));

    await waitFor(() => {
      expect(screen.getByText('User Created Successfully')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Invite Another User'));

    // Form should be back with empty fields
    expect(screen.getByLabelText(/first name/i)).toHaveValue('');
    expect(screen.getByLabelText(/last name/i)).toHaveValue('');
    expect(screen.getByLabelText(/email/i)).toHaveValue('');
  });
});
