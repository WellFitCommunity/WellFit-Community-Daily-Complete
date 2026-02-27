/**
 * ApiKeyManager Tests
 *
 * Tests API key CRUD: stats cards, table with badges, generate key form
 * validation, key generation via edge function, search/filter/sort,
 * toggle/revoke workflow, clipboard copy, export, and auto-refresh.
 *
 * Deletion Test: Every test would FAIL if the component rendered an empty <div />.
 * Synthetic test data only.
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

const mockOrder = vi.fn();
const mockSelectReturn = { order: mockOrder };
const mockSelect = vi.fn(() => mockSelectReturn);

const mockUpdateEq = vi.fn();
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));

const mockFunctionsInvoke = vi.fn();

const mockFrom = vi.fn((_table: string) => ({
  select: mockSelect,
  update: mockUpdate,
}));

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    from: (...args: [string]) => mockFrom(...args),
    functions: {
      invoke: (...args: unknown[]) => mockFunctionsInvoke(...args),
    },
  },
}));

vi.mock('../../ui/skeleton', () => ({
  ApiKeyManagerSkeleton: () => <div data-testid="api-key-skeleton">Loading skeleton...</div>,
}));

const mockSaveAs = vi.fn();
vi.mock('file-saver', () => ({
  saveAs: (...args: unknown[]) => mockSaveAs(...args),
}));

// Import AFTER mocks
import ApiKeyManager from '../ApiKeyManager';

// ============================================================================
// TEST DATA
// ============================================================================

const MOCK_API_KEYS_RAW = [
  {
    id: 'key-001',
    label: 'Test Org Alpha',
    key_hash: 'abc12345def',
    created_by: 'user-001',
    created_at: '2026-02-20T10:00:00Z',
    revoked_at: null,
  },
  {
    id: 'key-002',
    label: 'Test Org Beta',
    key_hash: 'xyz98765uvw',
    created_by: 'user-002',
    created_at: '2026-02-19T10:00:00Z',
    revoked_at: '2026-02-21T10:00:00Z',
  },
  {
    id: 'key-003',
    label: 'Test Org Gamma',
    key_hash: 'ghi45678jkl',
    created_by: 'user-003',
    created_at: '2026-02-18T10:00:00Z',
    revoked_at: null,
  },
];

// ============================================================================
// HELPERS
// ============================================================================

function resolveKeysLoad(data = MOCK_API_KEYS_RAW) {
  mockOrder.mockResolvedValueOnce({ data, error: null });
}

function resolveKeysError(message = 'Database connection failed') {
  mockOrder.mockResolvedValueOnce({ data: null, error: { message } });
}

function resolveKeysEmpty() {
  mockOrder.mockResolvedValueOnce({ data: [], error: null });
}

async function renderLoaded(data = MOCK_API_KEYS_RAW) {
  resolveKeysLoad(data);
  const result = render(<ApiKeyManager />);
  await waitFor(() => {
    expect(screen.queryByTestId('api-key-skeleton')).not.toBeInTheDocument();
  });
  return result;
}

// ============================================================================
// TESTS
// ============================================================================

describe('ApiKeyManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
      configurable: true,
    });

    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    // jsdom doesn't implement scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Loading & Empty States ---

  it('shows skeleton while loading API keys', () => {
    mockOrder.mockReturnValueOnce(new Promise(() => {}));
    render(<ApiKeyManager />);
    expect(screen.getByTestId('api-key-skeleton')).toBeInTheDocument();
  });

  it('shows empty state message when no API keys exist', async () => {
    resolveKeysEmpty();
    render(<ApiKeyManager />);
    await waitFor(() => {
      expect(screen.getByText(/No API keys found/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Generate your first key above!/i)).toBeInTheDocument();
  });

  it('displays error toast when fetch fails', async () => {
    resolveKeysError('Database connection failed');
    render(<ApiKeyManager />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch API keys: Database connection failed/i)).toBeInTheDocument();
    });
  });

  // --- Stats Cards ---

  it('displays correct total, active, and inactive counts', async () => {
    await renderLoaded();

    // Stats cards: each card has a number div and label div inside a bg-colored parent
    const totalCard = screen.getByText('Total Keys').parentElement as HTMLElement;
    expect(totalCard).toHaveTextContent('3');
    expect(totalCard).toHaveTextContent('Total Keys');

    // "Active" appears in stats AND table badges — scope by finding the stats label
    const statsLabels = screen.getAllByText('Active');
    const activeStatsLabel = statsLabels.find(el =>
      el.classList.contains('text-green-800')
    );
    expect(activeStatsLabel?.parentElement).toHaveTextContent('2');

    const inactiveLabels = screen.getAllByText('Inactive');
    const inactiveStatsLabel = inactiveLabels.find(el =>
      el.classList.contains('text-red-800')
    );
    expect(inactiveStatsLabel?.parentElement).toHaveTextContent('1');
  });

  it('displays total usage count', async () => {
    await renderLoaded();
    const usageCard = screen.getByText('Total Usage').parentElement;
    expect(usageCard).toHaveTextContent('0');
  });

  it('displays recently used count', async () => {
    await renderLoaded();
    const recentCard = screen.getByText('Used This Week').parentElement;
    expect(recentCard).toHaveTextContent('0');
  });

  // --- Table Rendering ---

  it('renders API keys in table with organization names', async () => {
    await renderLoaded();
    expect(screen.getByText('Test Org Alpha')).toBeInTheDocument();
    expect(screen.getByText('Test Org Beta')).toBeInTheDocument();
    expect(screen.getByText('Test Org Gamma')).toBeInTheDocument();
  });

  it('shows green Active badge for active keys', async () => {
    await renderLoaded();
    const activeBadges = screen.getAllByText('Active');
    expect(activeBadges.length).toBeGreaterThanOrEqual(2);
    const tableBadge = activeBadges.find(
      el => el.closest('span')?.classList.contains('bg-green-100')
    );
    expect(tableBadge).toBeDefined();
  });

  it('shows red Inactive badge for revoked keys', async () => {
    await renderLoaded();
    const inactiveBadges = screen.getAllByText('Inactive');
    expect(inactiveBadges.length).toBeGreaterThanOrEqual(1);
    const tableBadge = inactiveBadges.find(
      el => el.closest('span')?.classList.contains('bg-red-100')
    );
    expect(tableBadge).toBeDefined();
  });

  it('displays key identifier with masked representation', async () => {
    await renderLoaded();
    expect(screen.getByText('ak_abc12345_••••••••')).toBeInTheDocument();
    expect(screen.getByText('ak_xyz98765_••••••••')).toBeInTheDocument();
  });

  it('displays table footer with key count', async () => {
    await renderLoaded();
    expect(screen.getByText(/Displaying 3 keys/i)).toBeInTheDocument();
  });

  // --- Generate Key Form Validation ---

  it('disables generate button when org name is empty', async () => {
    await renderLoaded();
    const generateButton = screen.getByRole('button', { name: /Generate/i });
    expect(generateButton).toBeDisabled();
  });

  it('validates organization name shorter than 2 characters', async () => {
    await renderLoaded();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const input = screen.getByPlaceholderText('Enter organization name');
    await user.type(input, 'A');

    resolveKeysLoad();
    await user.click(screen.getByRole('button', { name: /Generate/i }));

    await waitFor(() => {
      expect(screen.getByText(/Organization name must be at least 2 characters/i)).toBeInTheDocument();
    });
  });

  it('validates invalid characters in organization name', async () => {
    await renderLoaded();
    const { fireEvent } = await import('@testing-library/react');
    const input = screen.getByPlaceholderText('Enter organization name');
    fireEvent.change(input, { target: { value: 'Test@Org!' } });

    resolveKeysLoad();
    // Use fireEvent.submit on the form to ensure onSubmit fires with fake timers
    const form = input.closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Organization name contains invalid characters/i)).toBeInTheDocument();
    });
  });

  it('validates duplicate organization name', async () => {
    await renderLoaded();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const input = screen.getByPlaceholderText('Enter organization name');
    await user.type(input, 'Test Org Alpha');

    resolveKeysLoad();
    await user.click(screen.getByRole('button', { name: /Generate/i }));

    await waitFor(() => {
      expect(screen.getByText(/An API key already exists for this organization/i)).toBeInTheDocument();
    });
  });

  // --- Key Generation ---

  it('shows generated key and success toast on successful generation', async () => {
    await renderLoaded();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const input = screen.getByPlaceholderText('Enter organization name');
    await user.type(input, 'Test Org Delta');

    mockFunctionsInvoke.mockResolvedValueOnce({
      data: { api_key: 'wf_test_generated_key_12345' },
      error: null,
    });
    resolveKeysLoad();

    await user.click(screen.getByRole('button', { name: /Generate/i }));

    await waitFor(() => {
      expect(screen.getByText('wf_test_generated_key_12345')).toBeInTheDocument();
    });
    expect(screen.getByText(/API Key generated successfully/i)).toBeInTheDocument();
  });

  it('shows error toast when key generation edge function fails', async () => {
    await renderLoaded();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const input = screen.getByPlaceholderText('Enter organization name');
    await user.type(input, 'Test Org Delta');

    mockFunctionsInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'Edge function timeout', context: null },
    });

    await user.click(screen.getByRole('button', { name: /Generate/i }));

    await waitFor(() => {
      expect(screen.getByText(/Error generating API key/i)).toBeInTheDocument();
    });
  });

  it('clears organization name input after successful generation', async () => {
    await renderLoaded();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const input = screen.getByPlaceholderText('Enter organization name') as HTMLInputElement;
    await user.type(input, 'Test Org Delta');

    mockFunctionsInvoke.mockResolvedValueOnce({
      data: { api_key: 'wf_test_key_abc' },
      error: null,
    });
    resolveKeysLoad();

    await user.click(screen.getByRole('button', { name: /Generate/i }));

    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  // --- Search and Filters ---

  it('filters keys by organization name via search', async () => {
    await renderLoaded();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const searchInput = screen.getByPlaceholderText(/Search by organization or key ID/i);
    await user.type(searchInput, 'Alpha');

    expect(screen.getByText('Test Org Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Test Org Beta')).not.toBeInTheDocument();
    expect(screen.queryByText('Test Org Gamma')).not.toBeInTheDocument();
  });

  it('status filter shows only active keys', async () => {
    await renderLoaded();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const filterSelect = screen.getByLabelText('Filter Status');
    await user.selectOptions(filterSelect, 'active');

    expect(screen.getByText('Test Org Alpha')).toBeInTheDocument();
    expect(screen.getByText('Test Org Gamma')).toBeInTheDocument();
    expect(screen.queryByText('Test Org Beta')).not.toBeInTheDocument();
  });

  it('shows no results state with clear filters button', async () => {
    await renderLoaded();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const searchInput = screen.getByPlaceholderText(/Search by organization or key ID/i);
    await user.type(searchInput, 'Nonexistent ZZZ');

    expect(screen.getByText(/No API keys match your current filters/i)).toBeInTheDocument();
    expect(screen.getByText('Clear all filters')).toBeInTheDocument();
  });

  it('clear all filters button resets search and status filter', async () => {
    await renderLoaded();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const searchInput = screen.getByPlaceholderText(/Search by organization or key ID/i);
    await user.type(searchInput, 'Nonexistent ZZZ');

    await user.click(screen.getByText('Clear all filters'));

    expect(screen.getByText('Test Org Alpha')).toBeInTheDocument();
    expect(screen.getByText('Test Org Beta')).toBeInTheDocument();
    expect(screen.getByText('Test Org Gamma')).toBeInTheDocument();
  });

  // --- Sorting ---

  it('sorts by organization name when column header is clicked', async () => {
    await renderLoaded();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const orgHeader = screen.getByTitle('Click to sort by organization');
    await user.click(orgHeader);

    const rows = screen.getAllByRole('row');
    const firstDataRow = rows[1];
    const lastDataRow = rows[rows.length - 1];
    expect(within(firstDataRow).getByText('Test Org Alpha')).toBeInTheDocument();
    expect(within(lastDataRow).getByText('Test Org Gamma')).toBeInTheDocument();
  });

  // --- Toggle Key Status ---

  it('disables an active key and calls supabase update with revoked_at', async () => {
    await renderLoaded();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const disableButtons = screen.getAllByTitle('Disable this API key');
    expect(disableButtons.length).toBe(2);

    mockUpdateEq.mockResolvedValueOnce({ error: null });
    resolveKeysLoad();
    await user.click(disableButtons[0]);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ revoked_at: expect.any(String) })
      );
    });
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'key-001');
  });

  it('shows success toast after toggling key status', async () => {
    await renderLoaded();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const disableButtons = screen.getAllByTitle('Disable this API key');

    mockUpdateEq.mockResolvedValueOnce({ error: null });
    resolveKeysLoad();
    await user.click(disableButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/disabled successfully/i)).toBeInTheDocument();
    });
  });

  // --- Revoke Key ---

  it('shows confirmation dialog when revoke is clicked', async () => {
    await renderLoaded();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const revokeButtons = screen.getAllByTitle('Permanently revoke this API key');

    mockUpdateEq.mockResolvedValueOnce({ error: null });
    resolveKeysLoad();
    await user.click(revokeButtons[0]);

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('Revoke the API key for "Test Org Alpha"')
    );
  });

  it('does not revoke when user cancels confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    await renderLoaded();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const revokeButtons = screen.getAllByTitle('Permanently revoke this API key');
    await user.click(revokeButtons[0]);

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // --- Export ---

  it('export button is disabled when no keys match filters', async () => {
    await renderLoaded();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const searchInput = screen.getByPlaceholderText(/Search by organization or key ID/i);
    await user.type(searchInput, 'Nonexistent ZZZ');

    const exportButton = screen.getByRole('button', { name: /Export Excel/i });
    expect(exportButton).toBeDisabled();
  });

  it('export button is enabled when keys are present', async () => {
    await renderLoaded();
    const exportButton = screen.getByRole('button', { name: /Export Excel/i });
    expect(exportButton).not.toBeDisabled();
  });

  // --- Auto-Refresh ---

  it('auto-refresh toggle starts with inactive state', async () => {
    await renderLoaded();
    expect(screen.getByTitle('Start auto-refresh (30s)')).toBeInTheDocument();
  });

  it('toggles auto-refresh to active state on click', async () => {
    await renderLoaded();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.click(screen.getByTitle('Start auto-refresh (30s)'));

    expect(screen.getByTitle('Stop auto-refresh')).toBeInTheDocument();
  });

  // --- Refresh ---

  it('refresh button triggers data reload', async () => {
    await renderLoaded();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const initialCallCount = mockFrom.mock.calls.length;

    resolveKeysLoad();
    await user.click(screen.getByTitle('Refresh API keys'));

    await waitFor(() => {
      expect(mockFrom.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  // --- Copy to Clipboard ---

  it('copies generated key to clipboard when copy button is clicked', async () => {
    await renderLoaded();
    const { fireEvent } = await import('@testing-library/react');

    // Use fireEvent.change to set input value without advancing timers
    const input = screen.getByPlaceholderText('Enter organization name');
    fireEvent.change(input, { target: { value: 'Test Org Delta' } });

    mockFunctionsInvoke.mockResolvedValueOnce({
      data: { api_key: 'wf_clipboard_test_key' },
      error: null,
    });
    resolveKeysLoad();

    fireEvent.click(screen.getByRole('button', { name: /Generate/i }));
    await waitFor(() => {
      expect(screen.getByText('wf_clipboard_test_key')).toBeInTheDocument();
    });

    // Click copy and flush async microtasks so writeText resolves
    const copyBtn = screen.getByRole('button', { name: /Copy Key/i });
    fireEvent.click(copyBtn);
    await vi.advanceTimersByTimeAsync(0);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('wf_clipboard_test_key');
  });

  // --- Component Structure ---

  it('displays the API Key Manager heading', async () => {
    await renderLoaded();
    expect(screen.getByRole('heading', { name: /API Key Manager/i })).toBeInTheDocument();
  });

  it('displays generate form with organization name input', async () => {
    await renderLoaded();
    expect(screen.getByText('Generate New API Key')).toBeInTheDocument();
    expect(screen.getByLabelText(/Organization Name/i)).toBeInTheDocument();
  });

  it('updates character count as user types', async () => {
    await renderLoaded();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    expect(screen.getByText('0/100')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('Enter organization name');
    await user.type(input, 'Hello');
    expect(screen.getByText('5/100')).toBeInTheDocument();
  });
});
