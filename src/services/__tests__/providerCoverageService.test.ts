/**
 * Provider Coverage Service Tests
 *
 * Tests coverage assignment lifecycle (create, cancel, lookup), on-call schedule
 * CRUD, validation guards, metrics aggregation, and error handling.
 *
 * Deletion Test: If the service logic were removed, ALL of these tests would
 * fail because they test actual data flow, not just rendering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
    },
  },
}));

vi.mock('../auditLogger', () => ({
  auditLogger: {
    clinical: vi.fn().mockResolvedValue(undefined),
    error: vi.fn().mockResolvedValue(undefined),
    info: vi.fn().mockResolvedValue(undefined),
  },
}));

import { providerCoverageService } from '../providerCoverageService';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';

const mockFromFn = supabase.from as ReturnType<typeof vi.fn>;
const mockRpcFn = supabase.rpc as ReturnType<typeof vi.fn>;

// ----------------------------------------------------------------
// createCoverageAssignment tests
// ----------------------------------------------------------------

describe('providerCoverageService.createCoverageAssignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates absent_provider != coverage_provider', async () => {
    const result = await providerCoverageService.createCoverageAssignment({
      absent_provider_id: 'prov-1',
      coverage_provider_id: 'prov-1',
      effective_start: '2026-03-01T00:00:00Z',
      effective_end: '2026-03-05T00:00:00Z',
      coverage_reason: 'vacation',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toContain('cannot cover themselves');
    }
  });

  it('validates effective_end > effective_start', async () => {
    const result = await providerCoverageService.createCoverageAssignment({
      absent_provider_id: 'prov-1',
      coverage_provider_id: 'prov-2',
      effective_start: '2026-03-05T00:00:00Z',
      effective_end: '2026-03-01T00:00:00Z',
      coverage_reason: 'pto',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toContain('after effective start');
    }
  });

  it('creates assignment and writes audit record', async () => {
    const mockAssignment = {
      id: 'ca-1',
      absent_provider_id: 'prov-1',
      coverage_provider_id: 'prov-2',
      effective_start: '2026-03-01T00:00:00Z',
      effective_end: '2026-03-05T00:00:00Z',
      coverage_reason: 'vacation',
      coverage_priority: 1,
      status: 'active',
      auto_route_tasks: true,
      tenant_id: 'tenant-1',
    };

    // Mock insert chain for coverage_assignments
    const mockSingle = vi.fn().mockResolvedValueOnce({ data: mockAssignment, error: null });
    const mockInsertSelect = vi.fn(() => ({ single: mockSingle }));
    const mockInsertFn = vi.fn(() => ({ select: mockInsertSelect }));
    mockFromFn.mockReturnValueOnce({ insert: mockInsertFn });

    // Mock insert for audit record
    const mockAuditInsert = vi.fn().mockResolvedValueOnce({ error: null });
    mockFromFn.mockReturnValueOnce({ insert: mockAuditInsert });

    const result = await providerCoverageService.createCoverageAssignment({
      absent_provider_id: 'prov-1',
      coverage_provider_id: 'prov-2',
      effective_start: '2026-03-01T00:00:00Z',
      effective_end: '2026-03-05T00:00:00Z',
      coverage_reason: 'vacation',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('ca-1');
      expect(result.data.coverage_reason).toBe('vacation');
    }

    // Verify audit logger was called
    expect(auditLogger.clinical).toHaveBeenCalledWith(
      'PROVIDER_COVERAGE_CREATED',
      true,
      expect.objectContaining({ assignment_id: 'ca-1', coverage_reason: 'vacation' })
    );

    // Verify audit table insert was called
    expect(mockAuditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        coverage_assignment_id: 'ca-1',
        action: 'created',
        tenant_id: 'tenant-1',
      })
    );
  });

  it('returns failure on database error', async () => {
    const mockSingle = vi.fn().mockResolvedValueOnce({
      data: null,
      error: { message: 'Constraint violation' },
    });
    const mockInsertSelect = vi.fn(() => ({ single: mockSingle }));
    const mockInsertFn = vi.fn(() => ({ select: mockInsertSelect }));
    mockFromFn.mockReturnValueOnce({ insert: mockInsertFn });

    const result = await providerCoverageService.createCoverageAssignment({
      absent_provider_id: 'prov-1',
      coverage_provider_id: 'prov-2',
      effective_start: '2026-03-01T00:00:00Z',
      effective_end: '2026-03-05T00:00:00Z',
      coverage_reason: 'sick',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('DATABASE_ERROR');
    }
    expect(auditLogger.error).toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------
// getCoverageProvider tests
// ----------------------------------------------------------------

describe('providerCoverageService.getCoverageProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns highest-priority active coverage for absent provider', async () => {
    mockRpcFn.mockResolvedValueOnce({
      data: [{
        coverage_provider_id: 'prov-2',
        coverage_priority: 1,
        coverage_reason: 'vacation',
        auto_route_tasks: true,
        assignment_id: 'ca-1',
      }],
      error: null,
    });

    const result = await providerCoverageService.getCoverageProvider('prov-1');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toBeNull();
      expect(result.data?.coverage_provider_id).toBe('prov-2');
      expect(result.data?.coverage_priority).toBe(1);
    }
  });

  it('returns null when no active coverage exists', async () => {
    mockRpcFn.mockResolvedValueOnce({ data: [], error: null });

    const result = await providerCoverageService.getCoverageProvider('prov-no-coverage');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeNull();
    }
  });
});

// ----------------------------------------------------------------
// cancelCoverageAssignment tests
// ----------------------------------------------------------------

describe('providerCoverageService.cancelCoverageAssignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets status to cancelled and logs audit', async () => {
    const mockCancelled = {
      id: 'ca-1',
      status: 'cancelled',
      tenant_id: 'tenant-1',
    };

    const mockSingle = vi.fn().mockResolvedValueOnce({ data: mockCancelled, error: null });
    const mockSelect = vi.fn(() => ({ single: mockSingle }));
    const mockEq = vi.fn(() => ({ select: mockSelect }));
    const mockUpdate = vi.fn(() => ({ eq: mockEq }));
    mockFromFn.mockReturnValueOnce({ update: mockUpdate });

    // Audit insert
    const mockAuditInsert = vi.fn().mockResolvedValueOnce({ error: null });
    mockFromFn.mockReturnValueOnce({ insert: mockAuditInsert });

    const result = await providerCoverageService.cancelCoverageAssignment('ca-1', 'user-123', 'No longer needed');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('cancelled');
    }

    expect(auditLogger.clinical).toHaveBeenCalledWith(
      'PROVIDER_COVERAGE_CANCELLED',
      true,
      expect.objectContaining({ assignment_id: 'ca-1', cancelled_by: 'user-123' })
    );

    expect(mockAuditInsert).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'cancelled', actor_id: 'user-123' })
    );
  });

  it('returns failure for missing inputs', async () => {
    const result = await providerCoverageService.cancelCoverageAssignment('', 'user-123');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
  });
});

// ----------------------------------------------------------------
// getOnCallSchedules tests
// ----------------------------------------------------------------

describe('providerCoverageService.getOnCallSchedules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters by date and returns schedules', async () => {
    const mockSchedules = [
      { id: 's-1', provider_id: 'prov-1', shift_type: 'day', coverage_role: 'primary', schedule_date: '2026-02-14' },
    ];

    // Chain: select('*').eq('schedule_date', ...).eq('is_active', true).order(...)
    const mockOrder = vi.fn().mockResolvedValueOnce({ data: mockSchedules, error: null });
    const mockEqActive = vi.fn(() => ({ order: mockOrder }));
    const mockEqDate = vi.fn(() => ({ eq: mockEqActive }));
    const mockSelect = vi.fn(() => ({ eq: mockEqDate }));
    mockFromFn.mockReturnValueOnce({ select: mockSelect });

    const result = await providerCoverageService.getOnCallSchedules('2026-02-14');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].shift_type).toBe('day');
    }
  });
});

// ----------------------------------------------------------------
// getCoverageMetrics tests
// ----------------------------------------------------------------

describe('providerCoverageService.getCoverageMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aggregates counts correctly', async () => {
    // Active coverages
    const mockActiveGte = vi.fn().mockResolvedValueOnce({ count: 2, error: null });
    const mockActiveLte = vi.fn(() => ({ gte: mockActiveGte }));
    const mockActiveEq = vi.fn(() => ({ lte: mockActiveLte }));
    const mockActiveSelect = vi.fn(() => ({ eq: mockActiveEq }));

    // Upcoming
    const mockUpcomingGt = vi.fn().mockResolvedValueOnce({ count: 3, error: null });
    const mockUpcomingEq = vi.fn(() => ({ gt: mockUpcomingGt }));
    const mockUpcomingSelect = vi.fn(() => ({ eq: mockUpcomingEq }));

    // On-call today
    const mockOnCallActive = vi.fn().mockResolvedValueOnce({ count: 4, error: null });
    const mockOnCallDate = vi.fn(() => ({ eq: mockOnCallActive }));
    const mockOnCallSelect = vi.fn(() => ({ eq: mockOnCallDate }));

    // Absent today
    const mockAbsentGte = vi.fn().mockResolvedValueOnce({ count: 5, error: null });
    const mockAbsentLte = vi.fn(() => ({ gte: mockAbsentGte }));
    const mockAbsentSelect = vi.fn(() => ({ lte: mockAbsentLte }));

    mockFromFn
      .mockReturnValueOnce({ select: mockActiveSelect })
      .mockReturnValueOnce({ select: mockUpcomingSelect })
      .mockReturnValueOnce({ select: mockOnCallSelect })
      .mockReturnValueOnce({ select: mockAbsentSelect });

    const result = await providerCoverageService.getCoverageMetrics();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.active_coverages).toBe(2);
      expect(result.data.upcoming_coverages).toBe(3);
      expect(result.data.on_call_today).toBe(4);
      expect(result.data.providers_absent_today).toBe(5);
      expect(result.data.unassigned_absences).toBe(3); // 5 - 2
    }
  });
});
