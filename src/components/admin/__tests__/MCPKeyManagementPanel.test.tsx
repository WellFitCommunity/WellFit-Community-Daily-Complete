/**
 * MCPKeyManagementPanel Tests
 *
 * Tests key listing, creation flow, revocation, rotation,
 * and expiry alert rendering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MCPKeyManagementPanel from '../MCPKeyManagementPanel';
import { mcpKeyManagementService } from '../../../services/mcpKeyManagementService';

// Mock the service
vi.mock('../../../services/mcpKeyManagementService', () => ({
  mcpKeyManagementService: {
    listKeys: vi.fn(),
    createKey: vi.fn(),
    revokeKey: vi.fn(),
    rotateKey: vi.fn(),
    getKeyAuditLog: vi.fn(),
    getExpiringKeys: vi.fn(),
  },
}));

const mockListKeys = vi.mocked(mcpKeyManagementService.listKeys);
const mockCreateKey = vi.mocked(mcpKeyManagementService.createKey);
const mockRevokeKey = vi.mocked(mcpKeyManagementService.revokeKey);
const mockRotateKey = vi.mocked(mcpKeyManagementService.rotateKey);

// Test fixtures — obviously fake data per CLAUDE.md
const mockActiveKey = {
  id: 'key-aaa-111',
  key_prefix: 'mcp_test1234',
  name: 'Test CI Pipeline Key',
  description: 'Used for automated testing',
  scopes: ['mcp:admin', 'mcp:fhir'],
  created_by: 'user-123',
  tenant_id: 'tenant-abc',
  created_at: '2026-01-15T00:00:00Z',
  expires_at: '2027-01-15T00:00:00Z',
  revoked_at: null,
  revoked_by: null,
  revocation_reason: null,
  last_used_at: '2026-02-20T10:00:00Z',
  use_count: 42,
  status: 'active' as const,
};

const mockExpiringKey = {
  ...mockActiveKey,
  id: 'key-bbb-222',
  key_prefix: 'mcp_expiring1',
  name: 'Expiring Integration Key',
  expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days
  status: 'expiring_soon' as const,
};

const mockRevokedKey = {
  ...mockActiveKey,
  id: 'key-ccc-333',
  key_prefix: 'mcp_revoked1',
  name: 'Old Revoked Key',
  revoked_at: '2026-02-01T00:00:00Z',
  revoked_by: 'user-123',
  revocation_reason: 'Replaced',
  status: 'revoked' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockListKeys.mockResolvedValue({
    success: true,
    data: [mockActiveKey, mockExpiringKey, mockRevokedKey],
    error: null,
  });
});

describe('MCPKeyManagementPanel', () => {
  it('displays all keys with correct status badges', async () => {
    render(<MCPKeyManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Test CI Pipeline Key')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Expiring Integration Key').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Old Revoked Key')).toBeInTheDocument();

    // Status badges
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getAllByText('Expiring Soon').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Revoked')).toBeInTheDocument();
  });

  it('shows key count summary in header', async () => {
    render(<MCPKeyManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('1 active')).toBeInTheDocument();
    });
    expect(screen.getByText('1 expiring')).toBeInTheDocument();
    expect(screen.getByText('3 total')).toBeInTheDocument();
  });

  it('shows expiry alert banner for keys expiring soon', async () => {
    render(<MCPKeyManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Key Expiry Alerts')).toBeInTheDocument();
    });

    const alert = screen.getByText('Key Expiry Alerts').closest('div');
    expect(alert).toBeInTheDocument();
    if (alert) {
      expect(within(alert).getByText(/Expiring Integration Key/)).toBeInTheDocument();
    }
  });

  it('shows empty state when no keys exist', async () => {
    mockListKeys.mockResolvedValue({ success: true, data: [], error: null });

    render(<MCPKeyManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('No MCP keys found')).toBeInTheDocument();
    });
    expect(screen.getByText(/Create a key to enable/)).toBeInTheDocument();
  });

  it('shows loading state then resolves', async () => {
    render(<MCPKeyManagementPanel />);

    expect(screen.getByText('Loading keys...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Loading keys...')).not.toBeInTheDocument();
    });
  });

  it('shows error when key listing fails', async () => {
    mockListKeys.mockResolvedValue({
      success: false,
      data: null,
      error: { code: 'FORBIDDEN', message: 'Only super_admin can view keys' },
    });

    render(<MCPKeyManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Only super_admin can view keys')).toBeInTheDocument();
    });
  });

  it('opens create form and submits successfully', async () => {
    const user = userEvent.setup();

    mockCreateKey.mockResolvedValue({
      success: true,
      data: {
        key_id: 'new-key-id',
        raw_key: 'mcp_abc123def456ghi789jkl012mno345pq',
        key_prefix: 'mcp_abc123de',
      },
      error: null,
    });

    render(<MCPKeyManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Test CI Pipeline Key')).toBeInTheDocument();
    });

    // Click create
    await user.click(screen.getByRole('button', { name: 'Create Key' }));
    expect(screen.getByText('Create New MCP Key')).toBeInTheDocument();

    // Fill form
    const nameInput = screen.getByPlaceholderText('e.g. Claude Desktop Integration');
    await user.type(nameInput, 'New Test Key Alpha');

    // Select a scope
    await user.click(screen.getByRole('button', { name: 'mcp:admin' }));

    // Submit
    const submitButton = screen.getByRole('button', { name: 'Create Key' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockCreateKey).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New Test Key Alpha',
        scopes: ['mcp:admin'],
      }));
    });

    // Shows raw key
    await waitFor(() => {
      expect(screen.getByText('Key Created Successfully')).toBeInTheDocument();
    });
    expect(screen.getByText('mcp_abc123def456ghi789jkl012mno345pq')).toBeInTheDocument();
  });

  it('shows revoke confirmation before revoking', async () => {
    const user = userEvent.setup();

    mockRevokeKey.mockResolvedValue({ success: true, data: true, error: null });

    render(<MCPKeyManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Test CI Pipeline Key')).toBeInTheDocument();
    });

    // Find the revoke button for the active key row
    const revokeButtons = screen.getAllByRole('button', { name: 'Revoke' });
    await user.click(revokeButtons[0]);

    // Confirmation dialog appears
    expect(screen.getByText(/Are you sure you want to revoke/)).toBeInTheDocument();

    // Confirm
    await user.click(screen.getByRole('button', { name: 'Confirm Revoke' }));

    await waitFor(() => {
      expect(mockRevokeKey).toHaveBeenCalledWith(
        mockActiveKey.id,
        'Manually revoked by admin'
      );
    });
  });

  it('handles key rotation creating new key and revoking old', async () => {
    const user = userEvent.setup();

    mockRotateKey.mockResolvedValue({
      success: true,
      data: {
        key_id: 'rotated-key-id',
        raw_key: 'mcp_rotated_new_key_value_here_12345',
        key_prefix: 'mcp_rotated_',
      },
      error: null,
    });

    render(<MCPKeyManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Test CI Pipeline Key')).toBeInTheDocument();
    });

    // Click rotate on the active key
    const rotateButtons = screen.getAllByRole('button', { name: 'Rotate' });
    await user.click(rotateButtons[0]);

    await waitFor(() => {
      expect(mockRotateKey).toHaveBeenCalledWith(mockActiveKey.id, mockActiveKey);
    });

    // Shows new raw key
    await waitFor(() => {
      expect(screen.getByText('Key Created Successfully')).toBeInTheDocument();
    });
    expect(screen.getByText('mcp_rotated_new_key_value_here_12345')).toBeInTheDocument();
  });

  it('does not show action buttons for revoked keys', async () => {
    mockListKeys.mockResolvedValue({
      success: true,
      data: [mockRevokedKey],
      error: null,
    });

    render(<MCPKeyManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Old Revoked Key')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Rotate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
  });

  it('displays scopes as individual badges', async () => {
    render(<MCPKeyManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Test CI Pipeline Key')).toBeInTheDocument();
    });

    // Scopes rendered without mcp: prefix
    expect(screen.getAllByText('admin').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('fhir').length).toBeGreaterThanOrEqual(1);
  });

  it('shows use count and last used date', async () => {
    render(<MCPKeyManagementPanel />);

    // Wait for keys to load
    await waitFor(() => {
      expect(screen.getByText('Test CI Pipeline Key')).toBeInTheDocument();
    });

    // use_count is rendered in its own div (all mock keys inherit 42)
    const useCounts = screen.getAllByText('42 uses');
    expect(useCounts.length).toBeGreaterThanOrEqual(1);
  });

  it('cancel button hides create form', async () => {
    const user = userEvent.setup();

    render(<MCPKeyManagementPanel />);

    await waitFor(() => {
      expect(screen.getByText('Test CI Pipeline Key')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Create Key' }));
    expect(screen.getByText('Create New MCP Key')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Create New MCP Key')).not.toBeInTheDocument();
  });
});
