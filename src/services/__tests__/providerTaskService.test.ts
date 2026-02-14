/**
 * Provider Task Service Tests
 *
 * Tests task creation (auto-due + explicit-due), acknowledge, complete,
 * queue fetch, metrics, and error handling.
 *
 * Deletion Test: If the service logic were removed, ALL of these tests would
 * fail because they test actual task lifecycle, not just rendering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted — use inline factory pattern (like encounterProviderService tests)
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
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

import { providerTaskService } from '../providerTaskService';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../auditLogger';

const mockFromFn = supabase.from as ReturnType<typeof vi.fn>;

// ----------------------------------------------------------------
// createTask tests
// ----------------------------------------------------------------

describe('providerTaskService.createTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a task with auto-calculated due_at from escalation config', async () => {
    // Mock escalation config lookup
    const mockMaybeSingle = vi.fn().mockResolvedValueOnce({
      data: { target_minutes: 60 },
      error: null,
    });
    const mockLimit = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
    const mockOrder = vi.fn(() => ({ limit: mockLimit }));
    const mockEqActive = vi.fn(() => ({ order: mockOrder }));
    const mockEqPriority = vi.fn(() => ({ eq: mockEqActive }));
    const mockEqType = vi.fn(() => ({ eq: mockEqPriority }));
    const mockConfigSelect = vi.fn(() => ({ eq: mockEqType }));

    // Mock task insert
    const mockSingle = vi.fn().mockResolvedValueOnce({
      data: {
        id: 'task-new',
        task_type: 'result_review',
        priority: 'stat',
        title: 'Review CBC',
        status: 'pending',
        due_at: new Date(Date.now() + 60 * 60000).toISOString(),
      },
      error: null,
    });
    const mockInsertSelect = vi.fn(() => ({ single: mockSingle }));
    const mockInsertFn = vi.fn(() => ({ select: mockInsertSelect }));

    // First call: escalation config
    mockFromFn.mockReturnValueOnce({ select: mockConfigSelect });
    // Second call: insert
    mockFromFn.mockReturnValueOnce({ insert: mockInsertFn });

    const result = await providerTaskService.createTask({
      task_type: 'result_review',
      priority: 'stat',
      title: 'Review CBC',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('task-new');
      expect(result.data.task_type).toBe('result_review');
    }
    expect(auditLogger.clinical).toHaveBeenCalledWith(
      'PROVIDER_TASK_CREATED',
      true,
      expect.objectContaining({ task_type: 'result_review' })
    );
  });

  it('creates a task with provided due_at (skips config lookup)', async () => {
    const explicitDue = new Date(Date.now() + 120 * 60000).toISOString();

    const mockSingle = vi.fn().mockResolvedValueOnce({
      data: {
        id: 'task-explicit',
        task_type: 'documentation',
        priority: 'routine',
        title: 'Complete notes',
        status: 'pending',
        due_at: explicitDue,
      },
      error: null,
    });
    const mockInsertSelect = vi.fn(() => ({ single: mockSingle }));
    const mockInsertFn = vi.fn(() => ({ select: mockInsertSelect }));

    mockFromFn.mockReturnValueOnce({ insert: mockInsertFn });

    const result = await providerTaskService.createTask({
      task_type: 'documentation',
      priority: 'routine',
      title: 'Complete notes',
      due_at: explicitDue,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('task-explicit');
      expect(result.data.due_at).toBe(explicitDue);
    }
  });

  it('returns failure for missing title', async () => {
    const result = await providerTaskService.createTask({
      task_type: 'general',
      priority: 'routine',
      title: '',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
  });

  it('returns failure on database error', async () => {
    // No config found (returns null)
    const mockMaybeSingle = vi.fn().mockResolvedValueOnce({
      data: null,
      error: null,
    });
    const mockLimit = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
    const mockOrder = vi.fn(() => ({ limit: mockLimit }));
    const mockEqActive = vi.fn(() => ({ order: mockOrder }));
    const mockEqPriority = vi.fn(() => ({ eq: mockEqActive }));
    const mockEqType = vi.fn(() => ({ eq: mockEqPriority }));
    const mockConfigSelect = vi.fn(() => ({ eq: mockEqType }));

    // Insert fails
    const mockSingle = vi.fn().mockResolvedValueOnce({
      data: null,
      error: { message: 'Connection refused' },
    });
    const mockInsertSelect = vi.fn(() => ({ single: mockSingle }));
    const mockInsertFn = vi.fn(() => ({ select: mockInsertSelect }));

    mockFromFn.mockReturnValueOnce({ select: mockConfigSelect });
    mockFromFn.mockReturnValueOnce({ insert: mockInsertFn });

    const result = await providerTaskService.createTask({
      task_type: 'general',
      priority: 'routine',
      title: 'Test task',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('DATABASE_ERROR');
    }
    expect(auditLogger.error).toHaveBeenCalled();
  });
});

// ----------------------------------------------------------------
// acknowledgeTask tests
// ----------------------------------------------------------------

describe('providerTaskService.acknowledgeTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('acknowledges a task successfully', async () => {
    const mockSingle = vi.fn().mockResolvedValueOnce({
      data: {
        id: 'task-1',
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: 'user-123',
      },
      error: null,
    });
    const mockAckSelect = vi.fn(() => ({ single: mockSingle }));
    const mockEq = vi.fn(() => ({ select: mockAckSelect }));
    const mockUpdateFn = vi.fn(() => ({ eq: mockEq }));
    mockFromFn.mockReturnValueOnce({ update: mockUpdateFn });

    const result = await providerTaskService.acknowledgeTask('task-1', 'user-123');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('acknowledged');
    }
    expect(auditLogger.clinical).toHaveBeenCalledWith(
      'PROVIDER_TASK_ACKNOWLEDGED',
      true,
      expect.objectContaining({ task_id: 'task-1' })
    );
  });

  it('returns failure for missing inputs', async () => {
    const result = await providerTaskService.acknowledgeTask('', 'user-123');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
  });
});

// ----------------------------------------------------------------
// completeTask tests
// ----------------------------------------------------------------

describe('providerTaskService.completeTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('completes a task with notes', async () => {
    const mockSingle = vi.fn().mockResolvedValueOnce({
      data: {
        id: 'task-1',
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_by: 'user-123',
        completion_notes: 'All done',
      },
      error: null,
    });
    const mockCompleteSelect = vi.fn(() => ({ single: mockSingle }));
    const mockEq = vi.fn(() => ({ select: mockCompleteSelect }));
    const mockUpdateFn = vi.fn(() => ({ eq: mockEq }));
    mockFromFn.mockReturnValueOnce({ update: mockUpdateFn });

    const result = await providerTaskService.completeTask('task-1', 'user-123', 'All done');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('completed');
      expect(result.data.completion_notes).toBe('All done');
    }
    expect(auditLogger.clinical).toHaveBeenCalledWith(
      'PROVIDER_TASK_COMPLETED',
      true,
      expect.objectContaining({ task_id: 'task-1', has_notes: true })
    );
  });

  it('returns failure for missing inputs', async () => {
    const result = await providerTaskService.completeTask('', 'user-123');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
  });
});

// ----------------------------------------------------------------
// getTaskQueue tests
// ----------------------------------------------------------------

describe('providerTaskService.getTaskQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns enriched task queue', async () => {
    const mockTasks = [
      {
        id: 'task-1',
        task_type: 'result_review',
        priority: 'stat',
        title: 'Review CBC',
        status: 'pending',
        is_overdue: true,
        minutes_past_due: 30,
        patient_first_name: 'John',
        patient_last_name: 'Doe',
        assignee_first_name: 'Alice',
        assignee_last_name: 'Provider',
      },
    ];

    const mockNot = vi.fn().mockResolvedValueOnce({ data: mockTasks, error: null });
    const mockOrder = vi.fn(() => ({ not: mockNot }));
    const mockQueueSelect = vi.fn(() => ({ order: mockOrder }));
    mockFromFn.mockReturnValueOnce({ select: mockQueueSelect });

    const result = await providerTaskService.getTaskQueue();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].task_type).toBe('result_review');
      expect(result.data[0].patient_first_name).toBe('John');
    }
  });

  it('returns failure on database error', async () => {
    const mockNot = vi.fn().mockResolvedValueOnce({
      data: null,
      error: { message: 'View not found' },
    });
    const mockOrder = vi.fn(() => ({ not: mockNot }));
    const mockQueueSelect = vi.fn(() => ({ order: mockOrder }));
    mockFromFn.mockReturnValueOnce({ select: mockQueueSelect });

    const result = await providerTaskService.getTaskQueue();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('DATABASE_ERROR');
    }
  });
});

// ----------------------------------------------------------------
// getTaskMetrics tests
// ----------------------------------------------------------------

describe('providerTaskService.getTaskMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns aggregated metrics', async () => {
    // Mock 4 count queries in sequence
    // 1. total_active
    const mockActiveNot = vi.fn().mockResolvedValueOnce({ count: 5, error: null });
    const mockActiveSelect = vi.fn(() => ({ not: mockActiveNot }));
    // 2. overdue
    const mockOverdueLt = vi.fn().mockResolvedValueOnce({ count: 2, error: null });
    const mockOverdueNot2 = vi.fn(() => ({ lt: mockOverdueLt }));
    const mockOverdueNot1 = vi.fn(() => ({ not: mockOverdueNot2 }));
    const mockOverdueSelect = vi.fn(() => ({ not: mockOverdueNot1 }));
    // 3. escalated
    const mockEscEq = vi.fn().mockResolvedValueOnce({ count: 1, error: null });
    const mockEscSelect = vi.fn(() => ({ eq: mockEscEq }));
    // 4. completed_today
    const mockCompGte = vi.fn().mockResolvedValueOnce({ count: 3, error: null });
    const mockCompEq = vi.fn(() => ({ gte: mockCompGte }));
    const mockCompSelect = vi.fn(() => ({ eq: mockCompEq }));

    mockFromFn
      .mockReturnValueOnce({ select: mockActiveSelect })
      .mockReturnValueOnce({ select: mockOverdueSelect })
      .mockReturnValueOnce({ select: mockEscSelect })
      .mockReturnValueOnce({ select: mockCompSelect });

    const result = await providerTaskService.getTaskMetrics();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.total_active).toBe(5);
      expect(result.data.overdue).toBe(2);
      expect(result.data.escalated).toBe(1);
      expect(result.data.completed_today).toBe(3);
    }
  });
});
