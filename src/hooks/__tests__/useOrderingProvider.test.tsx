/**
 * Tests for useOrderingProvider — verify each branch of the ordering-provider
 * resolution that gates the CPOE forms.
 *
 * Behavioral: every test would fail if the hook returned a static empty
 * object — the assertions touch the dynamic shape it emits.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOrderingProvider } from '../useOrderingProvider';

const mockMaybeSingleProfile = vi.fn();
const mockMaybeSinglePractitioner = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-123', email: 'doc@example.com' },
    supabase: {
      from: (table: string) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: mockMaybeSingleProfile }),
            }),
          };
        }
        if (table === 'fhir_practitioners') {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: mockMaybeSinglePractitioner }),
            }),
          };
        }
        throw new Error('Unexpected table: ' + table);
      },
    },
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockMaybeSingleProfile.mockReset();
  mockMaybeSinglePractitioner.mockReset();
});

describe('useOrderingProvider', () => {
  it('resolves tenant + display name + practitioner_id for a fully provisioned provider', async () => {
    mockMaybeSingleProfile.mockResolvedValue({
      data: { tenant_id: 'tenant-1', first_name: 'Riley', last_name: 'Chen' },
      error: null,
    });
    mockMaybeSinglePractitioner.mockResolvedValue({
      data: { id: 'practitioner-77' },
      error: null,
    });

    const { result } = renderHook(() => useOrderingProvider());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.tenant_id).toBe('tenant-1');
    expect(result.current.user_id).toBe('user-123');
    expect(result.current.display_name).toBe('Riley Chen');
    expect(result.current.practitioner_id).toBe('practitioner-77');
  });

  it('returns practitioner_id=null when the user has no fhir_practitioners row', async () => {
    mockMaybeSingleProfile.mockResolvedValue({
      data: { tenant_id: 'tenant-1', first_name: 'Sam', last_name: 'Lee' },
      error: null,
    });
    mockMaybeSinglePractitioner.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useOrderingProvider());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.practitioner_id).toBeNull();
    // Tenant + user still resolved — the form should still be able to submit.
    expect(result.current.tenant_id).toBe('tenant-1');
    expect(result.current.error).toBeNull();
  });

  it('returns error when the profile has no tenant_id (blocks the form)', async () => {
    mockMaybeSingleProfile.mockResolvedValue({
      data: { tenant_id: null, first_name: 'Sam', last_name: 'Lee' },
      error: null,
    });
    mockMaybeSinglePractitioner.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useOrderingProvider());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.tenant_id).toBeNull();
    expect(result.current.error).toMatch(/not assigned to a tenant/i);
  });

  it('falls back to email when the profile has no first/last name', async () => {
    mockMaybeSingleProfile.mockResolvedValue({
      data: { tenant_id: 'tenant-1', first_name: null, last_name: null },
      error: null,
    });
    mockMaybeSinglePractitioner.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useOrderingProvider());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.display_name).toBe('doc@example.com');
  });

  it('returns error when the profile lookup itself errors out', async () => {
    mockMaybeSingleProfile.mockResolvedValue({
      data: null,
      error: { message: 'permission denied' },
    });
    mockMaybeSinglePractitioner.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useOrderingProvider());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.tenant_id).toBeNull();
    expect(result.current.error).toMatch(/could not load your profile/i);
  });
});
