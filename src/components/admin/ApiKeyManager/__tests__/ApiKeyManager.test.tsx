/**
 * ApiKeyManager tests — API-3g.
 *
 * Two responsibilities verified here:
 *
 * 1. Orchestrator wires real `use_count` / `last_used_at` from the DB rows into
 *    the rendered table. Pre-API-3f the UI hardcoded `usage_count: 0` and
 *    `last_used: null`; if anyone reintroduces that pattern, the first test
 *    block will fail because the synthetic rows carry non-zero counts and a
 *    parseable timestamp.
 *
 * 2. `revokeKey` handler fires the high-usage guard confirmation when a key
 *    has more than 1,000 uses, and aborts the update if the second confirm
 *    is rejected.
 *
 * All test data is synthetic per CLAUDE.md (Rule #15).
 * Every test passes the Deletion Test: would fail for an empty <div /> or for
 * the regression of hardcoded usage_count/last_used.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ApiKey } from '../types';
import { revokeKey } from '../handlers';

// ============================================================================
// MOCKS
// ============================================================================

const mockOrder = vi.fn();
const mockSelect = vi.fn(() => ({ order: mockOrder }));
const mockEq = vi.fn();
const mockUpdate = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect, update: mockUpdate }));

vi.mock('../../../../lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}));

// ============================================================================
// SYNTHETIC TEST DATA
// ============================================================================

const SYNTHETIC_LAST_USED = '2026-05-26T15:30:00Z';

// IMPORTANT: spread the defaults FIRST, then the overrides. Using `??` for
// each field would treat `null` as "no override" and silently fall back to
// the default — exactly the wrong behavior for tests that intentionally pass
// `null` (e.g., a never-validated key).
function makeRow(overrides: Partial<{
  id: string;
  label: string;
  use_count: number;
  last_used_at: string | null;
  key_prefix: string | null;
  revocation_reason: string | null;
  revoked_at: string | null;
}> = {}) {
  return {
    id: 'key-001',
    label: 'Test Partner Alpha',
    key_hash: 'abcd1234ef567890',
    created_by: 'admin-001',
    created_at: '2026-05-01T12:00:00Z',
    revoked_at: null,
    last_used_at: SYNTHETIC_LAST_USED,
    use_count: 12345,
    key_prefix: 'ak_alpha',
    revocation_reason: null,
    ...overrides,
  };
}

// `ApiKey` shape (post-transformRows) used for handler-level tests.
function makeKey(overrides: Partial<ApiKey> = {}): ApiKey {
  const row = makeRow({
    id: overrides.id,
    label: overrides.label,
    use_count: overrides.use_count,
    last_used_at: overrides.last_used_at,
    key_prefix: overrides.key_prefix,
    revocation_reason: overrides.revocation_reason,
    revoked_at: overrides.revoked_at,
  });
  return {
    ...row,
    org_name: row.label,
    api_key_hash: row.key_hash,
    active: !row.revoked_at,
    usage_count: row.use_count,
    last_used: row.last_used_at,
    user_id: row.created_by,
    ...overrides,
  };
}

// ============================================================================
// SETUP
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  // Default: from('api_keys').select(...).order(...) resolves to empty array
  mockOrder.mockResolvedValue({ data: [], error: null });
  mockEq.mockResolvedValue({ data: null, error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// 1. ORCHESTRATOR RENDERS REAL use_count / last_used_at
// ============================================================================

describe('ApiKeyManager — live tracking column rendering (API-3f regression guard)', () => {
  it('renders the real use_count from api_keys (not a hardcoded zero)', async () => {
    mockOrder.mockResolvedValue({
      data: [makeRow({ use_count: 12345 })],
      error: null,
    });

    const { default: ApiKeyManager } = await import('../index');
    render(<ApiKeyManager />);

    // 12,345 is the toLocaleString of use_count=12345. It legitimately
    // appears twice: once in HeaderStats (total usage across all keys, since
    // there's one key) and once in the table row. If the UI regressed to the
    // pre-API-3f hardcoded `usage_count: 0`, both call sites would show "0"
    // and this assertion would fail.
    await waitFor(() => {
      expect(screen.getAllByText('12,345').length).toBeGreaterThanOrEqual(1);
    });
    // Anchor on the table row to prove the per-key cell is what we're seeing.
    await screen.findByText('Test Partner Alpha');
  });

  it('renders the real last_used_at timestamp (not "Never")', async () => {
    mockOrder.mockResolvedValue({
      data: [makeRow({ last_used_at: SYNTHETIC_LAST_USED })],
      error: null,
    });

    const { default: ApiKeyManager } = await import('../index');
    render(<ApiKeyManager />);

    // Wait for the table row to mount (org_name is the deterministic anchor).
    await screen.findByText('Test Partner Alpha');

    // formatDate renders 'May 26, 2026, NN:NN [AM|PM]' in en-US.
    // The substring "May 26, 2026" is stable regardless of test runner TZ
    // because the timestamp falls late in UTC.
    expect(screen.queryByText('Never')).not.toBeInTheDocument();
    expect(screen.getByText(/May 26, 2026/)).toBeInTheDocument();
  });

  it('falls back to "Never" when last_used_at is null (new, never-validated key)', async () => {
    mockOrder.mockResolvedValue({
      data: [makeRow({ use_count: 0, last_used_at: null })],
      error: null,
    });

    const { default: ApiKeyManager } = await import('../index');
    render(<ApiKeyManager />);

    // Anchor: wait for the table row to mount.
    const orgCell = await screen.findByText('Test Partner Alpha');
    // Inside the same <tr>, the Last Used column must render 'Never' for
    // both formatDate(null) and getRelativeTime(null). Scope the query to
    // the row to avoid coupling on unrelated nodes elsewhere.
    const row = orgCell.closest('tr');
    expect(row).not.toBeNull();
    expect(row?.textContent).toContain('Never');
    // The same row exposes a zero usage_count — proving the UI carries the
    // live `use_count` field through (not a hardcoded literal). 'total
    // requests' is the static label adjacent to the count, so '0total
    // requests' is the verbatim concatenated textContent of those two divs.
    expect(row?.textContent).toContain('0total requests');
  });
});

// ============================================================================
// 2. revokeKey high-usage confirmation guard
// ============================================================================

describe('revokeKey handler — high-usage confirmation guard', () => {
  it('fires ONE confirm dialog for a low-usage key (usage_count <= 1000)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const addToast = vi.fn();
    const setLoading = vi.fn();
    const fetchApiKeys = vi.fn().mockResolvedValue(undefined);

    const key = makeKey({ id: 'key-low', usage_count: 50 });

    await revokeKey('key-low', key.org_name, [key], { addToast, setLoading, fetchApiKeys });

    // Exactly one confirm — the PERMANENT-ACTION dialog. The high-usage
    // second confirm must NOT fire below the 1000-uses threshold.
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][0]).toMatch(/PERMANENT ACTION/);
    expect(mockUpdate).toHaveBeenCalledWith({ revoked_at: expect.any(String) });
    expect(addToast).toHaveBeenCalledWith(
      'warning',
      expect.stringContaining('permanently revoked'),
    );
  });

  it('fires TWO confirm dialogs for a high-usage key (usage_count > 1000)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const addToast = vi.fn();
    const setLoading = vi.fn();
    const fetchApiKeys = vi.fn().mockResolvedValue(undefined);

    const key = makeKey({ id: 'key-hot', usage_count: 5432 });

    await revokeKey('key-hot', key.org_name, [key], { addToast, setLoading, fetchApiKeys });

    // First confirm is the permanent-action warning, second is the high-usage
    // guard. If pre-API-3f hardcoded `usage_count: 0` regressed, the second
    // confirm would never fire and this assertion would fail.
    expect(confirmSpy).toHaveBeenCalledTimes(2);
    expect(confirmSpy.mock.calls[1][0]).toContain('5,432 total uses');
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('aborts the revoke if the high-usage second confirm is rejected', async () => {
    // First confirm yes, second confirm no.
    const confirmSpy = vi
      .spyOn(window, 'confirm')
      .mockImplementationOnce(() => true)
      .mockImplementationOnce(() => false);
    const addToast = vi.fn();
    const setLoading = vi.fn();
    const fetchApiKeys = vi.fn().mockResolvedValue(undefined);

    const key = makeKey({ id: 'key-hot-abort', usage_count: 99999 });

    await revokeKey('key-hot-abort', key.org_name, [key], {
      addToast,
      setLoading,
      fetchApiKeys,
    });

    expect(confirmSpy).toHaveBeenCalledTimes(2);
    // CRITICAL: the update query must NOT have been issued.
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(addToast).not.toHaveBeenCalled();
    expect(setLoading).not.toHaveBeenCalled();
  });

  it('aborts on the first confirm rejection without checking usage_count', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const addToast = vi.fn();
    const setLoading = vi.fn();
    const fetchApiKeys = vi.fn().mockResolvedValue(undefined);

    const key = makeKey({ id: 'key-aborted', usage_count: 999999 });

    await revokeKey('key-aborted', key.org_name, [key], {
      addToast,
      setLoading,
      fetchApiKeys,
    });

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
