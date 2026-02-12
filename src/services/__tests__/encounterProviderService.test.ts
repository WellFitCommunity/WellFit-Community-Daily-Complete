/**
 * Encounter Provider Assignment Service Tests
 *
 * Tests provider assignment, removal, role changes, and validation logic.
 *
 * Deletion Test: If the service logic were removed, ALL of these tests would
 * fail because they test actual assignment validation, not just rendering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing the service
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          maybeSingle: vi.fn(),
          is: vi.fn(() => ({
            single: vi.fn(),
            maybeSingle: vi.fn(),
            order: vi.fn(),
            neq: vi.fn(),
          })),
          order: vi.fn(),
        })),
        is: vi.fn(() => ({
          order: vi.fn(),
        })),
        order: vi.fn(),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(),
          })),
          is: vi.fn(() => ({
            neq: vi.fn(),
          })),
        })),
      })),
    })),
  },
}));

vi.mock('../auditLogger', () => ({
  auditLogger: {
    clinical: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    info: vi.fn().mockResolvedValue(undefined),
  },
}));

import { encounterProviderService } from '../encounterProviderService';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';
import type { EncounterProviderRole } from '../../types/encounterProvider';

// ----------------------------------------------------------------
// assignProvider tests
// ----------------------------------------------------------------

describe('encounterProviderService.assignProvider', () => {
  const mockRpc = supabase.rpc as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success on valid assignment', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: true,
        assignment_id: 'assign-1',
        encounter_id: 'enc-123',
        provider_id: 'prov-456',
        role: 'attending',
      },
      error: null,
    });

    const result = await encounterProviderService.assignProvider(
      'enc-123',
      'prov-456',
      'attending',
      'user-789'
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.assignment_id).toBe('assign-1');
      expect(result.data.role).toBe('attending');
    }
    expect(auditLogger.clinical).toHaveBeenCalledWith(
      'PROVIDER_ASSIGNED',
      true,
      expect.objectContaining({
        encounter_id: 'enc-123',
        provider_id: 'prov-456',
        role: 'attending',
      })
    );
  });

  it('returns failure for missing inputs', async () => {
    const result = await encounterProviderService.assignProvider('', 'prov-456', 'attending', 'user-789');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
  });

  it('returns failure for invalid role', async () => {
    const result = await encounterProviderService.assignProvider(
      'enc-123',
      'prov-456',
      'invalid_role' as EncounterProviderRole,
      'user-789'
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns failure when encounter is not editable', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: false,
        error: 'Cannot assign provider to signed encounter',
        code: 'ENCOUNTER_NOT_EDITABLE',
      },
      error: null,
    });

    const result = await encounterProviderService.assignProvider(
      'enc-123',
      'prov-456',
      'attending',
      'user-789'
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('IMMUTABILITY_VIOLATION');
    }
  });

  it('returns failure when provider not found', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: false,
        error: 'Provider not found',
        code: 'PROVIDER_NOT_FOUND',
      },
      error: null,
    });

    const result = await encounterProviderService.assignProvider(
      'enc-123',
      'prov-missing',
      'attending',
      'user-789'
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('returns failure when provider already assigned in same role', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: false,
        error: 'Provider already assigned as attending',
        code: 'ALREADY_ASSIGNED',
      },
      error: null,
    });

    const result = await encounterProviderService.assignProvider(
      'enc-123',
      'prov-456',
      'attending',
      'user-789'
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('ALREADY_EXISTS');
    }
  });

  it('passes notes through to RPC', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { success: true, assignment_id: 'assign-2' },
      error: null,
    });

    await encounterProviderService.assignProvider(
      'enc-123',
      'prov-456',
      'referring',
      'user-789',
      'Referred from cardiology'
    );

    expect(mockRpc).toHaveBeenCalledWith('assign_encounter_provider', {
      p_encounter_id: 'enc-123',
      p_provider_id: 'prov-456',
      p_role: 'referring',
      p_is_primary: false,
      p_assigned_by: 'user-789',
      p_notes: 'Referred from cardiology',
    });
  });

  it('sets is_primary true only for attending role', async () => {
    // Test attending
    mockRpc.mockResolvedValueOnce({ data: { success: true }, error: null });
    await encounterProviderService.assignProvider('enc-123', 'prov-1', 'attending', 'user-789');

    expect(mockRpc).toHaveBeenCalledWith('assign_encounter_provider', expect.objectContaining({
      p_is_primary: true,
    }));

    vi.clearAllMocks();

    // Test consulting
    mockRpc.mockResolvedValueOnce({ data: { success: true }, error: null });
    await encounterProviderService.assignProvider('enc-123', 'prov-2', 'consulting', 'user-789');

    expect(mockRpc).toHaveBeenCalledWith('assign_encounter_provider', expect.objectContaining({
      p_is_primary: false,
    }));
  });

  it('logs and returns failure on database error', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Connection refused' },
    });

    const result = await encounterProviderService.assignProvider(
      'enc-123',
      'prov-456',
      'attending',
      'user-789'
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('DATABASE_ERROR');
    }
    expect(auditLogger.error).toHaveBeenCalled();
  });

  it('logs and returns failure on unexpected error', async () => {
    mockRpc.mockRejectedValueOnce(new Error('Network timeout'));

    const result = await encounterProviderService.assignProvider(
      'enc-123',
      'prov-456',
      'attending',
      'user-789'
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNKNOWN_ERROR');
    }
    expect(auditLogger.error).toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------
// removeProvider tests
// ----------------------------------------------------------------

describe('encounterProviderService.removeProvider', () => {
  const mockRpc = supabase.rpc as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success on valid removal', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: true,
        assignment_id: 'assign-1',
        encounter_id: 'enc-123',
        role: 'consulting',
      },
      error: null,
    });

    const result = await encounterProviderService.removeProvider('assign-1', 'user-789', 'No longer needed');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.assignment_id).toBe('assign-1');
    }
    expect(auditLogger.clinical).toHaveBeenCalledWith(
      'PROVIDER_REMOVED',
      true,
      expect.objectContaining({
        assignment_id: 'assign-1',
        removed_by: 'user-789',
        reason: 'No longer needed',
      })
    );
  });

  it('returns failure for missing inputs', async () => {
    const result = await encounterProviderService.removeProvider('', 'user-789');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
  });

  it('returns failure when assignment not found', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: false,
        error: 'Assignment not found or already removed',
        code: 'NOT_FOUND',
      },
      error: null,
    });

    const result = await encounterProviderService.removeProvider('assign-missing', 'user-789');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('returns failure when encounter is not editable', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        success: false,
        error: 'Cannot remove provider from completed encounter',
        code: 'ENCOUNTER_NOT_EDITABLE',
      },
      error: null,
    });

    const result = await encounterProviderService.removeProvider('assign-1', 'user-789');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('IMMUTABILITY_VIOLATION');
    }
  });

  it('handles unexpected errors gracefully', async () => {
    mockRpc.mockRejectedValueOnce(new Error('Connection lost'));

    const result = await encounterProviderService.removeProvider('assign-1', 'user-789');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNKNOWN_ERROR');
    }
    expect(auditLogger.error).toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------
// getEncounterProviders tests
// ----------------------------------------------------------------

describe('encounterProviderService.getEncounterProviders', () => {
  const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns provider list for valid encounter', async () => {
    const mockProviders = [
      {
        id: 'assign-1',
        encounter_id: 'enc-123',
        provider_id: 'prov-1',
        role: 'attending',
        is_primary: true,
        provider: { id: 'prov-1', npi: '1234567890', organization_name: null, taxonomy_code: '207Q00000X', user_id: 'user-1' },
      },
      {
        id: 'assign-2',
        encounter_id: 'enc-123',
        provider_id: 'prov-2',
        role: 'consulting',
        is_primary: false,
        provider: { id: 'prov-2', npi: '0987654321', organization_name: 'Cardiology Associates', taxonomy_code: '207RC0000X', user_id: 'user-2' },
      },
    ];

    const mockOrder = vi.fn().mockResolvedValueOnce({ data: mockProviders, error: null });
    const mockIs = vi.fn(() => ({ order: mockOrder }));
    const mockEq = vi.fn(() => ({ is: mockIs }));
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    mockFrom.mockReturnValueOnce({ select: mockSelect });

    const result = await encounterProviderService.getEncounterProviders('enc-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0].role).toBe('attending');
      expect(result.data[1].role).toBe('consulting');
    }
  });

  it('returns failure for missing encounter ID', async () => {
    const result = await encounterProviderService.getEncounterProviders('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
  });

  it('returns empty array when no providers assigned', async () => {
    const mockOrder = vi.fn().mockResolvedValueOnce({ data: [], error: null });
    const mockIs = vi.fn(() => ({ order: mockOrder }));
    const mockEq = vi.fn(() => ({ is: mockIs }));
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    mockFrom.mockReturnValueOnce({ select: mockSelect });

    const result = await encounterProviderService.getEncounterProviders('enc-empty');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(0);
    }
  });
});

// ----------------------------------------------------------------
// getAttendingProvider tests
// ----------------------------------------------------------------

describe('encounterProviderService.getAttendingProvider', () => {
  const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns attending provider when one exists', async () => {
    const mockProvider = {
      id: 'assign-1',
      encounter_id: 'enc-123',
      provider_id: 'prov-1',
      role: 'attending',
      is_primary: true,
      provider: { id: 'prov-1', npi: '1234567890', organization_name: null, taxonomy_code: '207Q00000X', user_id: 'user-1' },
    };

    const mockMaybeSingle = vi.fn().mockResolvedValueOnce({ data: mockProvider, error: null });
    const mockIs = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
    const mockEqRole = vi.fn(() => ({ is: mockIs }));
    const mockEqId = vi.fn(() => ({ eq: mockEqRole }));
    const mockSelect = vi.fn(() => ({ eq: mockEqId }));
    mockFrom.mockReturnValueOnce({ select: mockSelect });

    const result = await encounterProviderService.getAttendingProvider('enc-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toBeNull();
      expect(result.data?.role).toBe('attending');
      expect(result.data?.is_primary).toBe(true);
    }
  });

  it('returns null when no attending provider assigned', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValueOnce({ data: null, error: null });
    const mockIs = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
    const mockEqRole = vi.fn(() => ({ is: mockIs }));
    const mockEqId = vi.fn(() => ({ eq: mockEqRole }));
    const mockSelect = vi.fn(() => ({ eq: mockEqId }));
    mockFrom.mockReturnValueOnce({ select: mockSelect });

    const result = await encounterProviderService.getAttendingProvider('enc-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });

  it('returns failure for missing encounter ID', async () => {
    const result = await encounterProviderService.getAttendingProvider('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
  });
});

// ----------------------------------------------------------------
// validateProviderAssignment tests
// ----------------------------------------------------------------

describe('encounterProviderService.validateProviderAssignment', () => {
  const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns valid when attending provider exists', async () => {
    const mockProviders = [
      { id: 'assign-1', role: 'attending', removed_at: null },
    ];

    const mockOrder = vi.fn().mockResolvedValueOnce({ data: mockProviders, error: null });
    const mockIs = vi.fn(() => ({ order: mockOrder }));
    const mockEq = vi.fn(() => ({ is: mockIs }));
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    mockFrom.mockReturnValueOnce({ select: mockSelect });

    const result = await encounterProviderService.validateProviderAssignment('enc-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.valid).toBe(true);
      expect(result.data.missing).toHaveLength(0);
    }
  });

  it('returns invalid when no attending provider and no legacy provider_id', async () => {
    // First call: getEncounterProviders returns empty
    const mockOrder = vi.fn().mockResolvedValueOnce({ data: [], error: null });
    const mockIs = vi.fn(() => ({ order: mockOrder }));
    const mockEq = vi.fn(() => ({ is: mockIs }));
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    mockFrom.mockReturnValueOnce({ select: mockSelect });

    // Second call: check legacy provider_id
    const mockSingle = vi.fn().mockResolvedValueOnce({ data: { provider_id: null }, error: null });
    const mockEq2 = vi.fn(() => ({ single: mockSingle }));
    const mockSelect2 = vi.fn(() => ({ eq: mockEq2 }));
    mockFrom.mockReturnValueOnce({ select: mockSelect2 });

    const result = await encounterProviderService.validateProviderAssignment('enc-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.valid).toBe(false);
      expect(result.data.missing).toContain('attending');
    }
  });

  it('returns valid when legacy provider_id exists (no encounter_providers row)', async () => {
    // First call: getEncounterProviders returns empty
    const mockOrder = vi.fn().mockResolvedValueOnce({ data: [], error: null });
    const mockIs = vi.fn(() => ({ order: mockOrder }));
    const mockEq = vi.fn(() => ({ is: mockIs }));
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    mockFrom.mockReturnValueOnce({ select: mockSelect });

    // Second call: legacy provider_id exists
    const mockSingle = vi.fn().mockResolvedValueOnce({ data: { provider_id: 'prov-legacy' }, error: null });
    const mockEq2 = vi.fn(() => ({ single: mockSingle }));
    const mockSelect2 = vi.fn(() => ({ eq: mockEq2 }));
    mockFrom.mockReturnValueOnce({ select: mockSelect2 });

    const result = await encounterProviderService.validateProviderAssignment('enc-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.valid).toBe(true);
      expect(result.data.missing).toHaveLength(0);
    }
  });

  it('returns failure for missing encounter ID', async () => {
    const result = await encounterProviderService.validateProviderAssignment('');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
  });
});


