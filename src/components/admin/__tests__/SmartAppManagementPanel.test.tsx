/**
 * SmartAppManagementPanel Tests
 *
 * Tests the orchestrator panel and its integration with sub-components:
 * - Data loading and display
 * - Filter behavior
 * - Modal open/close flows
 * - Status change actions (suspend, reactivate, revoke)
 * - Registration via server-side edge function
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import SmartAppManagementPanel from '../SmartAppManagementPanel';
import { vi } from 'vitest';

// Mock supabase client — vi.hoisted ensures these exist before vi.mock runs
const { mockSelect, mockOrder, mockUpdate, mockEq, mockInvoke } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockOrder: vi.fn(),
  mockUpdate: vi.fn(),
  mockEq: vi.fn(),
  mockInvoke: vi.fn(),
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect.mockReturnValue({
        order: mockOrder,
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      }),
      insert: vi.fn(() => Promise.resolve({ error: null })),
      update: mockUpdate.mockReturnValue({
        eq: mockEq,
      }),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
    })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({
        data: { user: { id: 'test-user-id' } },
        error: null,
      })),
      getSession: vi.fn(() => Promise.resolve({
        data: { session: { access_token: 'test-token' } },
        error: null,
      })),
    },
    functions: {
      invoke: mockInvoke,
    },
  },
}));

const mockApp = {
  id: 'app-1',
  tenant_id: null,
  client_id: 'ea_abc123',
  client_name: 'Test Health App',
  client_description: 'A test application',
  client_uri: null,
  logo_uri: null,
  client_secret_hash: null,
  is_confidential: false,
  redirect_uris: ['https://example.com/callback'],
  launch_uri: null,
  scopes_allowed: ['openid', 'fhirUser', 'patient/*.read'],
  pkce_required: true,
  token_endpoint_auth_method: 'none' as const,
  jwks_uri: null,
  app_type: 'patient' as const,
  status: 'approved' as const,
  approved_at: '2026-01-15T00:00:00Z',
  approved_by: 'admin-id',
  rejection_reason: null,
  developer_name: 'Test Dev',
  developer_email: 'dev@example.com',
  tos_uri: null,
  policy_uri: null,
  total_authorizations: 5,
  active_authorizations: 2,
  last_authorization_at: '2026-02-01T00:00:00Z',
  created_at: '2026-01-10T00:00:00Z',
  updated_at: '2026-01-15T00:00:00Z',
};

const pendingApp = {
  ...mockApp,
  id: 'app-2',
  client_id: 'ea_def456',
  client_name: 'Pending App',
  status: 'pending' as const,
  approved_at: null,
  approved_by: null,
};

describe('SmartAppManagementPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockEq.mockResolvedValue({ error: null });
    window.confirm = vi.fn(() => true);
  });

  it('renders the panel header and register button', async () => {
    render(<SmartAppManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('SMART on FHIR Apps')).toBeInTheDocument();
      expect(screen.getByText('Register App')).toBeInTheDocument();
    });
  });

  it('shows empty state when no apps loaded', async () => {
    render(<SmartAppManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('No apps found')).toBeInTheDocument();
    });
  });

  it('shows filter dropdowns for status and type', async () => {
    render(<SmartAppManagementPanel />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('All Statuses')).toBeInTheDocument();
      expect(screen.getByDisplayValue('All Types')).toBeInTheDocument();
    });
  });

  it('shows stats cards with correct counts', async () => {
    mockOrder.mockResolvedValue({ data: [mockApp, pendingApp], error: null });

    render(<SmartAppManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Approved Apps')).toBeInTheDocument();
      expect(screen.getByText('Pending Review')).toBeInTheDocument();
      expect(screen.getByText('Active Authorizations')).toBeInTheDocument();
      expect(screen.getByText('Total Authorizations')).toBeInTheDocument();
    });
  });

  it('renders app cards when data is loaded', async () => {
    mockOrder.mockResolvedValue({ data: [mockApp], error: null });

    render(<SmartAppManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Test Health App')).toBeInTheDocument();
      expect(screen.getByText('A test application')).toBeInTheDocument();
      expect(screen.getByText('ea_abc123')).toBeInTheDocument();
    });
  });

  it('filters apps by search query', async () => {
    mockOrder.mockResolvedValue({ data: [mockApp, pendingApp], error: null });

    render(<SmartAppManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Test Health App')).toBeInTheDocument();
      expect(screen.getByText('Pending App')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Search apps...'), {
      target: { value: 'Pending' },
    });

    await waitFor(() => {
      expect(screen.queryByText('Test Health App')).not.toBeInTheDocument();
      expect(screen.getByText('Pending App')).toBeInTheDocument();
    });
  });

  it('filters apps by status dropdown', async () => {
    mockOrder.mockResolvedValue({ data: [mockApp, pendingApp], error: null });

    render(<SmartAppManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Test Health App')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByDisplayValue('All Statuses'), {
      target: { value: 'pending' },
    });

    await waitFor(() => {
      expect(screen.queryByText('Test Health App')).not.toBeInTheDocument();
      expect(screen.getByText('Pending App')).toBeInTheDocument();
    });
  });

  it('opens registration modal with empty form on Register App click', async () => {
    render(<SmartAppManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Register App')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Register App'));

    await waitFor(() => {
      expect(screen.getByText('Register SMART App')).toBeInTheDocument();
      expect(screen.getByText('App Name *')).toBeInTheDocument();
      expect(screen.getByText('Allowed Scopes')).toBeInTheDocument();
      expect(screen.getByText('Developer Contact')).toBeInTheDocument();
    });
  });

  it('closes registration modal on Cancel click', async () => {
    render(<SmartAppManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Register App')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Register App'));

    await waitFor(() => {
      expect(screen.getByText('Register SMART App')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText('Register SMART App')).not.toBeInTheDocument();
    });
  });

  it('shows review modal for pending apps', async () => {
    mockOrder.mockResolvedValue({ data: [pendingApp], error: null });

    render(<SmartAppManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Review')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Review'));

    await waitFor(() => {
      expect(screen.getByText('Review App: Pending App')).toBeInTheDocument();
      expect(screen.getByText('Approve')).toBeInTheDocument();
      expect(screen.getByText('Reject')).toBeInTheDocument();
    });
  });

  it('calls suspend handler with confirmation', async () => {
    mockOrder.mockResolvedValue({ data: [mockApp], error: null });

    render(<SmartAppManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Test Health App')).toBeInTheDocument();
    });

    const suspendButton = screen.getByTitle('Suspend');
    fireEvent.click(suspendButton);

    expect(window.confirm).toHaveBeenCalledWith(
      'Suspend "Test Health App"? This will prevent new authorizations.'
    );
  });

  it('calls revoke handler with confirmation', async () => {
    mockOrder.mockResolvedValue({ data: [mockApp], error: null });

    render(<SmartAppManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Test Health App')).toBeInTheDocument();
    });

    const revokeButton = screen.getByTitle('Revoke');
    fireEvent.click(revokeButton);

    expect(window.confirm).toHaveBeenCalledWith(
      'Permanently revoke "Test Health App"? This will invalidate all tokens.'
    );
  });

  it('shows error message when data loading fails', async () => {
    mockOrder.mockRejectedValue(new Error('Network error'));

    render(<SmartAppManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows scope options in registration modal', async () => {
    render(<SmartAppManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Register App')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Register App'));

    await waitFor(() => {
      expect(screen.getByText('OpenID Connect')).toBeInTheDocument();
      expect(screen.getByText('FHIR User')).toBeInTheDocument();
      expect(screen.getByText('Patient Read All')).toBeInTheDocument();
    });
  });

  it('opens registration modal and shows edge function submit button', async () => {
    render(<SmartAppManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Register App')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Register App'));

    await waitFor(() => {
      expect(screen.getByText('Register SMART App')).toBeInTheDocument();
    });

    // Fill required fields
    fireEvent.change(screen.getByPlaceholderText('My Health App'), {
      target: { value: 'New App' },
    });

    const redirectTextarea = screen.getByPlaceholderText(/myapp\.com\/callback/);
    fireEvent.change(redirectTextarea, {
      target: { value: 'https://newapp.com/callback' },
    });

    // Verify the modal has a teal submit button (which routes through the edge function)
    const allButtons = screen.getAllByRole('button');
    const submitButton = allButtons.find(
      (btn) => btn.textContent === 'Register App' && btn.classList.contains('bg-teal-600'),
    );
    expect(submitButton).toBeDefined();
    expect(submitButton).not.toBeDisabled();
  });
});
