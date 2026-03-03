/**
 * Tests for ClearinghouseConfigPanel
 *
 * Tests clearinghouse credential configuration flow:
 * - Provider dropdown with three clearinghouse options
 * - Form field rendering and population from RPC
 * - Client secret visibility toggle
 * - Save configuration via RPC
 * - Test connection via fetch to OAuth endpoint
 * - Error handling for save and test failures
 * - Help text and cost information sections
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClearinghouseConfigPanel } from '../ClearinghouseConfigPanel';

// --- Mocks ---

const mockRpc = vi.fn();
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-test-001' } }),
}));

const mockTestConnection = vi.fn();
const mockGetPayerList = vi.fn();

vi.mock('../../../services/mcp/mcpClearinghouseClient', () => ({
  clearinghouseMCP: {
    testConnection: (...args: unknown[]) => mockTestConnection(...args),
    getPayerList: (...args: unknown[]) => mockGetPayerList(...args),
  },
}));

vi.mock('../../../services/auditLogger', () => ({
  auditLogger: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), clinical: vi.fn(), ai: vi.fn(),
  },
}));

vi.mock('lucide-react', () => ({
  Save: () => <span data-testid="icon-save" />,
  Eye: () => <span data-testid="icon-eye" />,
  EyeOff: () => <span data-testid="icon-eye-off" />,
  CheckCircle: () => <span data-testid="icon-check" />,
  XCircle: () => <span data-testid="icon-x" />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
  Wifi: () => <span data-testid="icon-wifi" />,
}));

// --- Synthetic test data ---

const MOCK_CONFIG = {
  provider: 'waystar',
  api_url: 'https://api.test-clearinghouse.example.com/v1',
  client_id: 'test-client-alpha-001',
  client_secret: 'test-secret-alpha-001',
  submitter_id: 'SUB-TEST-001',
};

const MOCK_CONFIG_AVAILITY = {
  provider: 'availity',
  api_url: 'https://api.availity.example.com/v1',
  client_id: 'test-client-beta-002',
  client_secret: 'test-secret-beta-002',
  submitter_id: 'SUB-TEST-002',
};

// --- Helpers ---

/** Queue the mount-time RPC response. Call BEFORE renderPanel(). */
function mockMountRpc(config?: Record<string, string>) {
  if (config) {
    mockRpc.mockResolvedValueOnce({ data: [config], error: null });
  } else {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
  }
}

function renderPanel() {
  return render(<ClearinghouseConfigPanel />);
}

/** Fill the three required fields so buttons become enabled. */
async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByPlaceholderText('https://api.waystar.com/v1'),
    'https://api.test.example.com'
  );
  await user.type(screen.getByPlaceholderText('abc123-your-org-id'), 'test-id-fill');
  await user.type(screen.getByPlaceholderText('sk_live_xyz789...'), 'test-secret-fill');
}

// --- Tests ---

describe('ClearinghouseConfigPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    // Default mount mock: empty config (no existing credentials)
    mockMountRpc();
    // Default MCP mocks
    mockTestConnection.mockResolvedValue({ success: false, data: { connected: false } });
    mockGetPayerList.mockResolvedValue({ success: true, data: { payers: [], total: 0 } });
  });

  describe('Provider dropdown', () => {
    it('renders dropdown with Waystar, Change Healthcare, and Availity options', () => {
      renderPanel();

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(3);
      expect(options[0]).toHaveTextContent('Waystar');
      expect(options[1]).toHaveTextContent('Change Healthcare');
      expect(options[2]).toHaveTextContent('Availity');
    });

    it('defaults to Waystar when no existing config is loaded', () => {
      renderPanel();

      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('waystar');
    });

    it('updates API URL when provider is changed', async () => {
      renderPanel();
      const user = userEvent.setup();

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'change_healthcare');

      const apiInput = screen.getByPlaceholderText('https://api.waystar.com/v1');
      expect(apiInput).toHaveValue('https://api.changehealthcare.com/');
    });
  });

  describe('Form fields', () => {
    it('renders all four credential input fields with correct labels', () => {
      renderPanel();

      // Use label text that uniquely identifies each field
      expect(screen.getByText('API URL')).toBeInTheDocument();
      expect(screen.getByText('Client ID')).toBeInTheDocument();
      expect(screen.getByText('Client Secret')).toBeInTheDocument();
      // Submitter ID label includes "(NPI or Assigned ID)" — use exact label text
      expect(
        screen.getByText('Submitter ID (NPI or Assigned ID)')
      ).toBeInTheDocument();

      // Verify placeholder text on actual inputs
      expect(screen.getByPlaceholderText('https://api.waystar.com/v1')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('abc123-your-org-id')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('sk_live_xyz789...')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('1234567890')).toBeInTheDocument();
    });

    it('shows empty form fields when no existing config is loaded', () => {
      renderPanel();

      const apiInput = screen.getByPlaceholderText('https://api.waystar.com/v1');
      const clientIdInput = screen.getByPlaceholderText('abc123-your-org-id');
      const secretInput = screen.getByPlaceholderText('sk_live_xyz789...');
      const submitterInput = screen.getByPlaceholderText('1234567890');

      expect(apiInput).toHaveValue('');
      expect(clientIdInput).toHaveValue('');
      expect(secretInput).toHaveValue('');
      expect(submitterInput).toHaveValue('');
    });
  });

  describe('Load existing config', () => {
    it('populates all form fields from RPC result on mount', async () => {
      // Override the default empty mock with a config-loaded mock
      mockRpc.mockReset();
      mockMountRpc(MOCK_CONFIG);

      renderPanel();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('https://api.waystar.com/v1')).toHaveValue(
          'https://api.test-clearinghouse.example.com/v1'
        );
      });

      expect(screen.getByPlaceholderText('abc123-your-org-id')).toHaveValue(
        'test-client-alpha-001'
      );
      expect(screen.getByPlaceholderText('sk_live_xyz789...')).toHaveValue(
        'test-secret-alpha-001'
      );
      expect(screen.getByPlaceholderText('1234567890')).toHaveValue('SUB-TEST-001');
    });

    it('calls get_clearinghouse_credentials RPC on mount', async () => {
      mockRpc.mockReset();
      mockMountRpc(MOCK_CONFIG);

      renderPanel();

      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalledWith('get_clearinghouse_credentials');
      });
    });

    it('sets provider dropdown from loaded config', async () => {
      mockRpc.mockReset();
      mockMountRpc(MOCK_CONFIG_AVAILITY);

      renderPanel();

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toHaveValue('availity');
      });
    });
  });

  describe('Client secret visibility', () => {
    it('masks client secret with password input type by default', () => {
      renderPanel();

      const secretInput = screen.getByPlaceholderText('sk_live_xyz789...');
      expect(secretInput).toHaveAttribute('type', 'password');
    });

    it('toggles secret visibility when eye icon button is clicked', async () => {
      renderPanel();
      const user = userEvent.setup();

      const secretInput = screen.getByPlaceholderText('sk_live_xyz789...');
      expect(secretInput).toHaveAttribute('type', 'password');

      // Click the toggle button (contains the Eye icon when secret is hidden)
      const eyeIcon = screen.getByTestId('icon-eye');
      const toggleBtn = eyeIcon.closest('button');
      expect(toggleBtn).toBeTruthy();
      await user.click(toggleBtn as HTMLElement);

      expect(secretInput).toHaveAttribute('type', 'text');

      // Click again to re-mask (now shows EyeOff icon)
      const eyeOffIcon = screen.getByTestId('icon-eye-off');
      const toggleBtnAgain = eyeOffIcon.closest('button');
      expect(toggleBtnAgain).toBeTruthy();
      await user.click(toggleBtnAgain as HTMLElement);

      expect(secretInput).toHaveAttribute('type', 'password');
    });
  });

  describe('Save configuration', () => {
    it('renders Save Configuration button', () => {
      renderPanel();

      expect(
        screen.getByRole('button', { name: /Save Configuration/i })
      ).toBeInTheDocument();
    });

    it('disables save button when required fields are empty', () => {
      renderPanel();

      const saveBtn = screen.getByRole('button', { name: /Save Configuration/i });
      expect(saveBtn).toBeDisabled();
    });

    it('enables save button when API URL, Client ID, and Client Secret are filled', async () => {
      renderPanel();
      const user = userEvent.setup();

      await fillRequiredFields(user);

      const saveBtn = screen.getByRole('button', { name: /Save Configuration/i });
      expect(saveBtn).toBeEnabled();
    });

    it('shows success message after successful save', async () => {
      renderPanel();
      const user = userEvent.setup();

      await fillRequiredFields(user);

      // Queue the save RPC response (mount RPC already consumed)
      mockRpc.mockResolvedValueOnce({ data: null, error: null });

      const saveBtn = screen.getByRole('button', { name: /Save Configuration/i });
      await user.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByText(/Configuration saved securely/i)).toBeInTheDocument();
      });
    });

    it('calls update_clearinghouse_config RPC with correct parameters on save', async () => {
      renderPanel();
      const user = userEvent.setup();

      await user.type(
        screen.getByPlaceholderText('https://api.waystar.com/v1'),
        'https://api.test.example.com'
      );
      await user.type(screen.getByPlaceholderText('abc123-your-org-id'), 'test-id-epsilon');
      await user.type(screen.getByPlaceholderText('sk_live_xyz789...'), 'test-secret-epsilon');
      await user.type(screen.getByPlaceholderText('1234567890'), 'SUB-TEST-999');

      mockRpc.mockResolvedValueOnce({ data: null, error: null });

      const saveBtn = screen.getByRole('button', { name: /Save Configuration/i });
      await user.click(saveBtn);

      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalledWith('update_clearinghouse_config', {
          p_provider: 'waystar',
          p_api_url: 'https://api.test.example.com',
          p_client_id: 'test-id-epsilon',
          p_client_secret: 'test-secret-epsilon',
          p_submitter_id: 'SUB-TEST-999',
        });
      });
    });

    it('shows error message when save RPC fails', async () => {
      renderPanel();
      const user = userEvent.setup();

      await fillRequiredFields(user);

      // Queue a failure response for the save call
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: new Error('Database error'),
      });

      const saveBtn = screen.getByRole('button', { name: /Save Configuration/i });
      await user.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByText(/Error saving configuration/i)).toBeInTheDocument();
      });
    });
  });

  describe('Test connection', () => {
    it('renders Test Connection button', () => {
      renderPanel();

      expect(
        screen.getByRole('button', { name: /Test Connection/i })
      ).toBeInTheDocument();
    });

    it('enables test button without requiring filled credential fields', () => {
      renderPanel();

      const testBtn = screen.getByRole('button', { name: /Test Connection/i });
      // Button is always enabled (MCP probe works regardless of local fields)
      expect(testBtn).toBeEnabled();
    });

    it('shows success message and Connected status when MCP testConnection returns connected', async () => {
      mockTestConnection.mockResolvedValueOnce({
        success: true,
        data: { success: true, connected: true, provider: 'waystar', tested_at: '2026-03-03T00:00:00Z' },
      });
      mockGetPayerList.mockResolvedValueOnce({
        success: true,
        data: { payers: [{ id: 'p1', name: 'Test Payer Alpha', type: 'commercial', states: ['TX'] }], total: 1 },
      });

      renderPanel();
      const user = userEvent.setup();

      const testBtn = screen.getByRole('button', { name: /Test Connection/i });
      await user.click(testBtn);

      await waitFor(() => {
        expect(screen.getByText(/Clearinghouse connected/i)).toBeInTheDocument();
      });

      expect(mockTestConnection).toHaveBeenCalled();
    });

    it('shows "Clearinghouse not configured" banner when MCP testConnection returns failure', async () => {
      mockTestConnection.mockResolvedValueOnce({
        success: false,
        error: 'CLEARINGHOUSE_API_KEY not set',
      });

      renderPanel();
      const user = userEvent.setup();

      const testBtn = screen.getByRole('button', { name: /Test Connection/i });
      await user.click(testBtn);

      await waitFor(() => {
        expect(screen.getByText(/Clearinghouse not configured/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/CLEARINGHOUSE_API_KEY/)).toBeInTheDocument();
      expect(screen.getByText(/CLEARINGHOUSE_ENDPOINT/)).toBeInTheDocument();
      expect(screen.getByText(/CLEARINGHOUSE_SENDER_ID/)).toBeInTheDocument();
    });

    it('shows "not configured" banner when MCP testConnection throws a network error', async () => {
      mockTestConnection.mockRejectedValueOnce(new Error('Network request failed'));

      renderPanel();
      const user = userEvent.setup();

      const testBtn = screen.getByRole('button', { name: /Test Connection/i });
      await user.click(testBtn);

      await waitFor(() => {
        expect(screen.getByText(/Clearinghouse not configured/i)).toBeInTheDocument();
      });
    });

    it('calls clearinghouseMCP.testConnection when Test Connection button is clicked', async () => {
      renderPanel();
      const user = userEvent.setup();

      const testBtn = screen.getByRole('button', { name: /Test Connection/i });
      await user.click(testBtn);

      await waitFor(() => {
        expect(mockTestConnection).toHaveBeenCalledTimes(1);
      });
    });

    it('shows payer names when connection succeeds and payers are returned', async () => {
      mockTestConnection.mockResolvedValueOnce({
        success: true,
        data: { success: true, connected: true },
      });
      mockGetPayerList.mockResolvedValueOnce({
        success: true,
        data: {
          payers: [
            { id: 'p1', name: 'Medicare', type: 'medicare', states: ['TX'] },
            { id: 'p2', name: 'BlueCross', type: 'commercial', states: ['TX'] },
          ],
          total: 2,
        },
      });

      renderPanel();
      const user = userEvent.setup();

      const testBtn = screen.getByRole('button', { name: /Test Connection/i });
      await user.click(testBtn);

      await waitFor(() => {
        expect(screen.getByText('Medicare')).toBeInTheDocument();
        expect(screen.getByText('BlueCross')).toBeInTheDocument();
      });
    });
  });

  describe('Help text section', () => {
    it('displays provider-specific setup instructions', () => {
      renderPanel();

      expect(screen.getByText('How to Get Your API Credentials:')).toBeInTheDocument();
      expect(screen.getByText(/Contact sales at waystar.com/i)).toBeInTheDocument();
      expect(screen.getByText(/changehealthcare.com\/contact/i)).toBeInTheDocument();
      expect(screen.getByText(/Register at availity.com/i)).toBeInTheDocument();
      expect(screen.getByText(/electronic 837P claim submission/i)).toBeInTheDocument();
    });
  });

  describe('Cost information section', () => {
    it('displays estimated monthly fee information for all three providers', () => {
      renderPanel();

      expect(screen.getByText('Estimated Costs:')).toBeInTheDocument();
      expect(screen.getByText(/\$500-1,200\/month/)).toBeInTheDocument();
      expect(screen.getByText(/\$400-1,000\/month/)).toBeInTheDocument();
      expect(screen.getByText(/FREE.*\$100-300\/month/)).toBeInTheDocument();
    });
  });

  describe('Header', () => {
    it('displays the panel title and description', () => {
      renderPanel();

      expect(screen.getByText('Clearinghouse Configuration')).toBeInTheDocument();
      expect(
        screen.getByText(
          /Configure your clearinghouse connection for automated claim submission/
        )
      ).toBeInTheDocument();
    });
  });

  describe('Documentation links', () => {
    it('shows documentation link matching selected provider', async () => {
      renderPanel();

      // Default is waystar
      expect(screen.getByText('https://developers.waystar.com/')).toBeInTheDocument();

      // Change to availity
      const user = userEvent.setup();
      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'availity');

      expect(screen.getByText('https://developer.availity.com/')).toBeInTheDocument();
    });
  });
});
