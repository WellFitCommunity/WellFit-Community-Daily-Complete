/**
 * Guardian Approval Service Tests
 *
 * Tests for Guardian Agent review ticket management:
 * - Ticket creation and retrieval
 * - Approval and rejection workflows
 * - Statistics and filtering
 * - Real-time subscriptions
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GuardianApprovalService,
  getGuardianApprovalService,
  resetGuardianApprovalService,
} from '../guardianApprovalService';
import type {
  GuardianReviewTicket,
  TicketListItem,
  CreateTicketParams,
  ApprovalFormData,
  RejectionFormData,
  HealingStepData,
  SandboxTestResults,
  ApplicationResult,
} from '../../types/guardianApproval';

// Mock auditLogger
vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { auditLogger } from '../auditLogger';

// Create mock Supabase client
function createMockSupabase() {
  const mockRpc = vi.fn();
  const mockSingle = vi.fn();
  const mockMaybeSingle = vi.fn();
  const mockLimit = vi.fn();
  const mockOrder = vi.fn();
  const mockOr = vi.fn();
  const mockLte = vi.fn();
  const mockGte = vi.fn();
  const mockIn = vi.fn();
  const mockEq = vi.fn();
  const mockSelect = vi.fn();
  const mockUpdate = vi.fn();
  const mockFrom = vi.fn();
  const mockChannel = vi.fn();
  const mockOn = vi.fn();
  const mockSubscribe = vi.fn();
  const mockRemoveChannel = vi.fn();

  // Chain setup for select queries
  mockSelect.mockReturnValue({
    eq: mockEq,
    in: mockIn,
    gte: mockGte,
    lte: mockLte,
    or: mockOr,
    order: mockOrder,
    limit: mockLimit,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
  });

  mockOrder.mockReturnValue({
    eq: mockEq,
    in: mockIn,
    gte: mockGte,
    lte: mockLte,
    or: mockOr,
    limit: mockLimit,
  });

  mockEq.mockReturnValue({
    eq: mockEq,
    order: mockOrder,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
  });

  mockIn.mockReturnValue({
    in: mockIn,
    gte: mockGte,
    lte: mockLte,
    or: mockOr,
    order: mockOrder,
    limit: mockLimit,
  });

  mockGte.mockReturnValue({
    lte: mockLte,
    or: mockOr,
    limit: mockLimit,
  });

  mockLte.mockReturnValue({
    or: mockOr,
    limit: mockLimit,
  });

  mockOr.mockReturnValue({
    limit: mockLimit,
  });

  mockUpdate.mockReturnValue({
    eq: mockEq,
  });

  mockFrom.mockReturnValue({
    select: mockSelect,
    update: mockUpdate,
  });

  // Channel setup for real-time
  mockOn.mockReturnValue({
    on: mockOn,
    subscribe: mockSubscribe,
  });

  mockChannel.mockReturnValue({
    on: mockOn,
    subscribe: mockSubscribe,
  });

  return {
    rpc: mockRpc,
    from: mockFrom,
    channel: mockChannel,
    removeChannel: mockRemoveChannel,
    _mocks: {
      mockRpc,
      mockFrom,
      mockSelect,
      mockUpdate,
      mockEq,
      mockIn,
      mockGte,
      mockLte,
      mockOr,
      mockOrder,
      mockLimit,
      mockSingle,
      mockMaybeSingle,
      mockChannel,
      mockOn,
      mockSubscribe,
      mockRemoveChannel,
    },
  };
}

// Mock data generators
function createMockHealingStep(order: number, action: string): HealingStepData {
  return {
    id: `step-${order}`,
    order,
    action,
    target: 'component',
    parameters: {},
  };
}

function createMockSandboxResults(passed: boolean): SandboxTestResults {
  return {
    passed,
    tests_run: 5,
    tests_passed: passed ? 5 : 3,
    tests_failed: passed ? 0 : 2,
    execution_time_ms: 1500,
  };
}

function createMockApplicationResult(success: boolean): ApplicationResult {
  return {
    success,
    steps_completed: success ? 2 : 1,
    total_steps: 2,
    execution_time_ms: 2500,
    changes_applied: success ? ['file1.ts', 'file2.ts'] : [],
    error: success ? undefined : 'Application failed',
  };
}

function createMockTicket(overrides?: Partial<GuardianReviewTicket>): GuardianReviewTicket {
  return {
    id: 'ticket-uuid-123',
    security_alert_id: 'alert-uuid-456',
    issue_id: 'ISSUE-001',
    issue_category: 'security_vulnerability',
    issue_severity: 'high',
    issue_description: 'SQL injection vulnerability detected',
    affected_component: 'api/users',
    affected_resources: ['users.ts', 'auth.ts'],
    stack_trace: 'Error at line 42',
    detection_context: { component: 'guardian-scan', filePath: '/src/api/users.ts' },
    action_id: 'ACTION-001',
    healing_strategy: 'auto_patch',
    healing_description: 'Apply security patch to sanitize inputs',
    healing_steps: [
      createMockHealingStep(1, 'sanitize_inputs'),
      createMockHealingStep(2, 'validate_queries'),
    ],
    rollback_plan: [createMockHealingStep(1, 'revert_changes')],
    expected_outcome: 'Vulnerability patched',
    sandbox_tested: true,
    sandbox_test_results: createMockSandboxResults(true),
    sandbox_passed: true,
    status: 'pending',
    reviewed_by: null,
    reviewed_at: null,
    reviewer_name: null,
    review_notes: null,
    review_metadata: {},
    code_reviewed: false,
    impact_understood: false,
    rollback_understood: false,
    applied_at: null,
    applied_by: null,
    application_result: createMockApplicationResult(false),
    application_error: null,
    rolled_back_at: null,
    rolled_back_by: null,
    rollback_reason: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function createMockTicketListItem(overrides?: Partial<TicketListItem>): TicketListItem {
  return {
    id: 'ticket-uuid-123',
    issue_id: 'ISSUE-001',
    issue_category: 'security_vulnerability',
    issue_severity: 'high',
    issue_description: 'SQL injection vulnerability detected',
    affected_component: 'api/users',
    healing_strategy: 'auto_patch',
    healing_description: 'Apply security patch',
    sandbox_passed: true,
    status: 'pending',
    created_at: new Date().toISOString(),
    security_alert_id: 'alert-uuid-456',
    ...overrides,
  };
}

function createMockCreateParams(overrides?: Partial<CreateTicketParams>): CreateTicketParams {
  return {
    issue_id: 'ISSUE-001',
    issue_category: 'security_vulnerability',
    issue_severity: 'high',
    issue_description: 'Vulnerability detected',
    affected_component: 'api/auth',
    action_id: 'ACTION-001',
    healing_strategy: 'auto_patch',
    healing_description: 'Apply security fix',
    healing_steps: [createMockHealingStep(1, 'apply_fix')],
    ...overrides,
  };
}

describe('GuardianApprovalService', () => {
  let service: GuardianApprovalService;
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetGuardianApprovalService();
    mockSupabase = createMockSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new GuardianApprovalService(mockSupabase as any);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // createTicket Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createTicket', () => {
    it('should create a ticket successfully', async () => {
      const ticketId = 'new-ticket-uuid';
      mockSupabase._mocks.mockRpc.mockResolvedValue({
        data: ticketId,
        error: null,
      });

      const params = createMockCreateParams();
      const result = await service.createTicket(params);

      expect(result.success).toBe(true);
      expect(result.data).toBe(ticketId);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_guardian_review_ticket', expect.objectContaining({
        p_issue_id: params.issue_id,
        p_healing_strategy: params.healing_strategy,
      }));
      expect(auditLogger.info).toHaveBeenCalledWith('GUARDIAN_TICKET_CREATED', expect.any(Object));
    });

    it('should handle database error', async () => {
      mockSupabase._mocks.mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });

      const result = await service.createTicket(createMockCreateParams());

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Database connection failed');
      expect(auditLogger.error).toHaveBeenCalled();
    });

    it('should handle exception', async () => {
      mockSupabase._mocks.mockRpc.mockRejectedValue(new Error('Network error'));

      const result = await service.createTicket(createMockCreateParams());

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Network error');
    });

    it('should pass all optional parameters', async () => {
      mockSupabase._mocks.mockRpc.mockResolvedValue({
        data: 'ticket-123',
        error: null,
      });

      const params: CreateTicketParams = {
        issue_id: 'ISSUE-001',
        issue_category: 'performance_degradation',
        issue_severity: 'medium',
        issue_description: 'Slow query detected',
        affected_component: 'database',
        affected_resources: ['queries.ts'],
        stack_trace: 'Stack trace here',
        detection_context: { component: 'database-monitor', filePath: '/src/db/queries.ts' },
        action_id: 'ACTION-002',
        healing_strategy: 'retry_with_backoff',
        healing_description: 'Add database index',
        healing_steps: [createMockHealingStep(1, 'create_index'), createMockHealingStep(2, 'test_query')],
        rollback_plan: [createMockHealingStep(1, 'drop_index')],
        expected_outcome: 'Query time < 100ms',
        sandbox_tested: true,
        sandbox_results: createMockSandboxResults(true),
        sandbox_passed: true,
      };

      await service.createTicket(params);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_guardian_review_ticket', expect.objectContaining({
        p_stack_trace: params.stack_trace,
        p_sandbox_tested: true,
        p_sandbox_passed: true,
      }));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getPendingTickets Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getPendingTickets', () => {
    it('should return pending tickets', async () => {
      const mockTickets = [createMockTicketListItem(), createMockTicketListItem({ id: 'ticket-2' })];
      mockSupabase._mocks.mockRpc.mockResolvedValue({
        data: mockTickets,
        error: null,
      });

      const result = await service.getPendingTickets();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockTickets);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_pending_guardian_tickets');
    });

    it('should return empty array when no tickets', async () => {
      mockSupabase._mocks.mockRpc.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.getPendingTickets();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should handle database error', async () => {
      mockSupabase._mocks.mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      });

      const result = await service.getPendingTickets();

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Query failed');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getTicketById Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getTicketById', () => {
    it('should return ticket by ID', async () => {
      const mockTicket = createMockTicket();
      mockSupabase._mocks.mockSingle.mockResolvedValue({
        data: mockTicket,
        error: null,
      });

      const result = await service.getTicketById('ticket-uuid-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockTicket);
      expect(mockSupabase.from).toHaveBeenCalledWith('guardian_review_tickets');
      expect(mockSupabase._mocks.mockEq).toHaveBeenCalledWith('id', 'ticket-uuid-123');
    });

    it('should handle ticket not found', async () => {
      mockSupabase._mocks.mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Row not found' },
      });

      const result = await service.getTicketById('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Row not found');
    });

    it('should handle exception', async () => {
      mockSupabase._mocks.mockSingle.mockRejectedValue(new Error('Connection lost'));

      const result = await service.getTicketById('ticket-123');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Connection lost');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getTickets Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getTickets', () => {
    it('should return all tickets without filters', async () => {
      const mockTickets = [createMockTicket(), createMockTicket({ id: 'ticket-2' })];
      mockSupabase._mocks.mockLimit.mockResolvedValue({
        data: mockTickets,
        error: null,
      });

      const result = await service.getTickets();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockTickets);
      expect(mockSupabase._mocks.mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockSupabase._mocks.mockLimit).toHaveBeenCalledWith(100);
    });

    it('should apply status filter', async () => {
      mockSupabase._mocks.mockLimit.mockResolvedValue({
        data: [],
        error: null,
      });

      await service.getTickets({ status: ['pending', 'in_review'] });

      expect(mockSupabase._mocks.mockIn).toHaveBeenCalledWith('status', ['pending', 'in_review']);
    });

    it('should apply severity filter', async () => {
      mockSupabase._mocks.mockLimit.mockResolvedValue({
        data: [],
        error: null,
      });

      await service.getTickets({ severity: ['high', 'critical'] });

      expect(mockSupabase._mocks.mockIn).toHaveBeenCalledWith('issue_severity', ['high', 'critical']);
    });

    it('should apply strategy filter', async () => {
      mockSupabase._mocks.mockLimit.mockResolvedValue({
        data: [],
        error: null,
      });

      await service.getTickets({ strategy: ['auto_patch', 'state_rollback'] });

      expect(mockSupabase._mocks.mockIn).toHaveBeenCalledWith('healing_strategy', ['auto_patch', 'state_rollback']);
    });

    it('should apply date range filter', async () => {
      mockSupabase._mocks.mockLimit.mockResolvedValue({
        data: [],
        error: null,
      });

      await service.getTickets({
        date_range: {
          start: '2025-01-01',
          end: '2025-01-31',
        },
      });

      expect(mockSupabase._mocks.mockGte).toHaveBeenCalledWith('created_at', '2025-01-01');
      expect(mockSupabase._mocks.mockLte).toHaveBeenCalledWith('created_at', '2025-01-31');
    });

    it('should apply search filter', async () => {
      mockSupabase._mocks.mockLimit.mockResolvedValue({
        data: [],
        error: null,
      });

      await service.getTickets({ search: 'SQL injection' });

      expect(mockSupabase._mocks.mockOr).toHaveBeenCalledWith(
        expect.stringContaining('SQL injection')
      );
    });

    it('should handle database error', async () => {
      mockSupabase._mocks.mockLimit.mockResolvedValue({
        data: null,
        error: { message: 'Query timeout' },
      });

      const result = await service.getTickets();

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Query timeout');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getTicketStats Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getTicketStats', () => {
    it('should calculate stats correctly', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const mockTickets = [
        { status: 'pending', created_at: todayISO, reviewed_at: null, applied_at: null },
        { status: 'pending', created_at: todayISO, reviewed_at: null, applied_at: null },
        { status: 'in_review', created_at: todayISO, reviewed_at: null, applied_at: null },
        { status: 'approved', created_at: todayISO, reviewed_at: todayISO, applied_at: null },
        { status: 'rejected', created_at: todayISO, reviewed_at: todayISO, applied_at: null },
        { status: 'applied', created_at: todayISO, reviewed_at: todayISO, applied_at: todayISO },
      ];

      mockSupabase._mocks.mockSelect.mockResolvedValue({
        data: mockTickets,
        error: null,
      });

      const result = await service.getTicketStats();

      expect(result.success).toBe(true);
      expect(result.data?.pending_count).toBe(2);
      expect(result.data?.in_review_count).toBe(1);
      expect(result.data?.approved_today).toBe(1);
      expect(result.data?.rejected_today).toBe(1);
      expect(result.data?.applied_today).toBe(1);
    });

    it('should handle empty ticket list', async () => {
      mockSupabase._mocks.mockSelect.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await service.getTicketStats();

      expect(result.success).toBe(true);
      expect(result.data?.pending_count).toBe(0);
      expect(result.data?.in_review_count).toBe(0);
    });

    it('should handle database error', async () => {
      mockSupabase._mocks.mockSelect.mockResolvedValue({
        data: null,
        error: { message: 'Stats query failed' },
      });

      const result = await service.getTicketStats();

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Stats query failed');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // markInReview Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('markInReview', () => {
    it('should mark ticket as in_review', async () => {
      // Create chainable mock: update() -> eq() -> eq() (thenable)
      // Chain: .update().eq('id', ticketId).eq('status', 'pending')
      const thenableResult = {
        then: (resolve: (value: unknown) => void) => {
          resolve({ data: {}, error: null });
          return Promise.resolve({ data: {}, error: null });
        },
      };
      const secondEq = vi.fn().mockReturnValue(thenableResult);
      const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
      mockSupabase._mocks.mockUpdate.mockReturnValue({ eq: firstEq });

      const result = await service.markInReview('ticket-123');

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(mockSupabase._mocks.mockUpdate).toHaveBeenCalledWith({ status: 'in_review' });
      expect(firstEq).toHaveBeenCalledWith('id', 'ticket-123');
      expect(secondEq).toHaveBeenCalledWith('status', 'pending');
    });

    it('should handle database error', async () => {
      // Chain: .update().eq('id', ticketId).eq('status', 'pending')
      const thenableResult = {
        then: (resolve: (value: unknown) => void) => {
          resolve({ data: null, error: { message: 'Update failed' } });
          return Promise.resolve({ data: null, error: { message: 'Update failed' } });
        },
      };
      const secondEq = vi.fn().mockReturnValue(thenableResult);
      const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
      mockSupabase._mocks.mockUpdate.mockReturnValue({ eq: firstEq });

      const result = await service.markInReview('ticket-123');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Update failed');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // approveTicket Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('approveTicket', () => {
    it('should approve ticket successfully', async () => {
      mockSupabase._mocks.mockRpc.mockResolvedValue({
        data: { success: true, ticket_id: 'ticket-123' },
        error: null,
      });

      const formData: ApprovalFormData = {
        code_reviewed: true,
        impact_understood: true,
        rollback_understood: true,
        review_notes: 'Looks good to apply',
      };

      const result = await service.approveTicket('ticket-123', formData);

      expect(result.success).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('approve_guardian_ticket', {
        p_ticket_id: 'ticket-123',
        p_code_reviewed: true,
        p_impact_understood: true,
        p_rollback_understood: true,
        p_review_notes: 'Looks good to apply',
      });
      expect(auditLogger.info).toHaveBeenCalledWith('GUARDIAN_TICKET_APPROVED', expect.any(Object));
    });

    it('should handle approval validation failure', async () => {
      mockSupabase._mocks.mockRpc.mockResolvedValue({
        data: { success: false, error: 'Ticket already processed' },
        error: null,
      });

      const formData: ApprovalFormData = {
        code_reviewed: true,
        impact_understood: true,
        rollback_understood: true,
        review_notes: 'Approved',
      };

      const result = await service.approveTicket('ticket-123', formData);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Ticket already processed');
    });

    it('should handle database error', async () => {
      mockSupabase._mocks.mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC failed' },
      });

      const formData: ApprovalFormData = {
        code_reviewed: true,
        impact_understood: true,
        rollback_understood: true,
        review_notes: 'Approved',
      };

      const result = await service.approveTicket('ticket-123', formData);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('RPC failed');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // rejectTicket Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('rejectTicket', () => {
    it('should reject ticket successfully', async () => {
      mockSupabase._mocks.mockRpc.mockResolvedValue({
        data: { success: true, ticket_id: 'ticket-123' },
        error: null,
      });

      const formData: RejectionFormData = {
        review_notes: 'Fix needs more testing',
      };

      const result = await service.rejectTicket('ticket-123', formData);

      expect(result.success).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('reject_guardian_ticket', {
        p_ticket_id: 'ticket-123',
        p_review_notes: 'Fix needs more testing',
      });
      expect(auditLogger.info).toHaveBeenCalledWith('GUARDIAN_TICKET_REJECTED', expect.any(Object));
    });

    it('should handle rejection validation failure', async () => {
      mockSupabase._mocks.mockRpc.mockResolvedValue({
        data: { success: false, error: 'Cannot reject applied ticket' },
        error: null,
      });

      const result = await service.rejectTicket('ticket-123', { review_notes: 'Rejected' });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Cannot reject applied ticket');
    });

    it('should handle database error', async () => {
      mockSupabase._mocks.mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'Connection refused' },
      });

      const result = await service.rejectTicket('ticket-123', { review_notes: 'Rejected' });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Connection refused');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // markApplied Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('markApplied', () => {
    it('should mark ticket as applied successfully', async () => {
      mockSupabase._mocks.mockRpc.mockResolvedValue({
        data: { success: true, status: 'applied' },
        error: null,
      });

      const result = await service.markApplied('ticket-123', { patched: true });

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('mark_guardian_ticket_applied', {
        p_ticket_id: 'ticket-123',
        p_result: { patched: true },
        p_error: null,
      });
      expect(auditLogger.info).toHaveBeenCalledWith('GUARDIAN_TICKET_APPLIED', expect.any(Object));
    });

    it('should mark ticket as failed with error', async () => {
      mockSupabase._mocks.mockRpc.mockResolvedValue({
        data: { success: true, status: 'failed' },
        error: null,
      });

      const result = await service.markApplied('ticket-123', {}, 'Patch failed to apply');

      expect(result.success).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('mark_guardian_ticket_applied', {
        p_ticket_id: 'ticket-123',
        p_result: {},
        p_error: 'Patch failed to apply',
      });
    });

    it('should handle validation failure', async () => {
      mockSupabase._mocks.mockRpc.mockResolvedValue({
        data: { success: false },
        error: null,
      });

      const result = await service.markApplied('ticket-123', {});

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Failed to mark ticket as applied');
    });

    it('should handle database error', async () => {
      mockSupabase._mocks.mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC timeout' },
      });

      const result = await service.markApplied('ticket-123', {});

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('RPC timeout');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getApprovedTickets Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getApprovedTickets', () => {
    it('should return approved tickets', async () => {
      const mockTickets = [
        createMockTicket({ status: 'approved' }),
        createMockTicket({ id: 'ticket-2', status: 'approved' }),
      ];
      mockSupabase._mocks.mockOrder.mockResolvedValue({
        data: mockTickets,
        error: null,
      });

      const result = await service.getApprovedTickets();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockTickets);
      expect(mockSupabase._mocks.mockEq).toHaveBeenCalledWith('status', 'approved');
      expect(mockSupabase._mocks.mockOrder).toHaveBeenCalledWith('reviewed_at', { ascending: true });
    });

    it('should return empty array when no approved tickets', async () => {
      mockSupabase._mocks.mockOrder.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.getApprovedTickets();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('should handle database error', async () => {
      mockSupabase._mocks.mockOrder.mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      });

      const result = await service.getApprovedTickets();

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Query failed');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getTicketByAlertId Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getTicketByAlertId', () => {
    it('should return ticket by alert ID', async () => {
      const mockTicket = createMockTicket();
      mockSupabase._mocks.mockMaybeSingle.mockResolvedValue({
        data: mockTicket,
        error: null,
      });

      const result = await service.getTicketByAlertId('alert-uuid-456');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockTicket);
      expect(mockSupabase._mocks.mockEq).toHaveBeenCalledWith('security_alert_id', 'alert-uuid-456');
    });

    it('should return null when no ticket found', async () => {
      mockSupabase._mocks.mockMaybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await service.getTicketByAlertId('nonexistent-alert');

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it('should handle database error', async () => {
      mockSupabase._mocks.mockMaybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      });

      const result = await service.getTicketByAlertId('alert-123');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Query failed');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Realtime Subscription Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('subscribeToTickets', () => {
    it('should subscribe to ticket changes', () => {
      const onInsert = vi.fn();
      const onUpdate = vi.fn();

      service.subscribeToTickets(onInsert, onUpdate);

      expect(mockSupabase.channel).toHaveBeenCalledWith('guardian-tickets');
      expect(mockSupabase._mocks.mockOn).toHaveBeenCalledTimes(2);
      expect(mockSupabase._mocks.mockSubscribe).toHaveBeenCalled();
    });

    it('should call onInsert callback for INSERT events', () => {
      const onInsert = vi.fn();
      const onUpdate = vi.fn();
      const mockTicket = createMockTicket();

      // Capture the INSERT callback
      let insertCallback: (payload: { new: GuardianReviewTicket }) => void = () => {};
      mockSupabase._mocks.mockOn.mockImplementation((event, config, callback) => {
        if (config.event === 'INSERT') {
          insertCallback = callback;
        }
        return { on: mockSupabase._mocks.mockOn, subscribe: mockSupabase._mocks.mockSubscribe };
      });

      service.subscribeToTickets(onInsert, onUpdate);

      // Simulate INSERT event
      insertCallback({ new: mockTicket });

      expect(onInsert).toHaveBeenCalledWith(mockTicket);
    });

    it('should call onUpdate callback for UPDATE events', () => {
      const onInsert = vi.fn();
      const onUpdate = vi.fn();
      const mockTicket = createMockTicket({ status: 'approved' });

      // Capture the UPDATE callback
      let updateCallback: (payload: { new: GuardianReviewTicket }) => void = () => {};
      mockSupabase._mocks.mockOn.mockImplementation((event, config, callback) => {
        if (config.event === 'UPDATE') {
          updateCallback = callback;
        }
        return { on: mockSupabase._mocks.mockOn, subscribe: mockSupabase._mocks.mockSubscribe };
      });

      service.subscribeToTickets(onInsert, onUpdate);

      // Simulate UPDATE event
      updateCallback({ new: mockTicket });

      expect(onUpdate).toHaveBeenCalledWith(mockTicket);
    });
  });

  describe('unsubscribeFromTickets', () => {
    it('should remove channel when subscribed', () => {
      const onInsert = vi.fn();
      const onUpdate = vi.fn();

      // Subscribe first
      mockSupabase._mocks.mockSubscribe.mockReturnValue({});
      service.subscribeToTickets(onInsert, onUpdate);

      // Then unsubscribe
      service.unsubscribeFromTickets();

      expect(mockSupabase.removeChannel).toHaveBeenCalled();
    });

    it('should not throw when not subscribed', () => {
      expect(() => service.unsubscribeFromTickets()).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Singleton Factory Tests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getGuardianApprovalService', () => {
    it('should return singleton instance', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const instance1 = getGuardianApprovalService(mockSupabase as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const instance2 = getGuardianApprovalService(mockSupabase as any);

      expect(instance1).toBe(instance2);
    });
  });

  describe('resetGuardianApprovalService', () => {
    it('should reset singleton and unsubscribe', () => {
      // Create and subscribe
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const instance = getGuardianApprovalService(mockSupabase as any);
      instance.subscribeToTickets(vi.fn(), vi.fn());

      // Reset
      resetGuardianApprovalService();

      // New call should create new instance
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newInstance = getGuardianApprovalService(mockSupabase as any);
      expect(newInstance).not.toBe(instance);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Integration Scenarios
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Integration Scenarios', () => {
    it('should handle complete ticket lifecycle', async () => {
      // Step 1: Create ticket
      mockSupabase._mocks.mockRpc.mockResolvedValueOnce({
        data: 'new-ticket-id',
        error: null,
      });

      const createResult = await service.createTicket(createMockCreateParams());
      expect(createResult.success).toBe(true);

      // Step 2: Mark in review - chain: .update().eq('id').eq('status')
      const thenableResult = {
        then: (resolve: (value: unknown) => void) => {
          resolve({ data: {}, error: null });
          return Promise.resolve({ data: {}, error: null });
        },
      };
      const secondEq = vi.fn().mockReturnValue(thenableResult);
      const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
      mockSupabase._mocks.mockUpdate.mockReturnValue({ eq: firstEq });

      const reviewResult = await service.markInReview('new-ticket-id');
      expect(reviewResult.success).toBe(true);

      // Step 3: Approve ticket
      mockSupabase._mocks.mockRpc.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const approveResult = await service.approveTicket('new-ticket-id', {
        code_reviewed: true,
        impact_understood: true,
        rollback_understood: true,
        review_notes: 'Approved for deployment',
      });
      expect(approveResult.success).toBe(true);

      // Step 4: Mark applied
      mockSupabase._mocks.mockRpc.mockResolvedValueOnce({
        data: { success: true, status: 'applied' },
        error: null,
      });

      const applyResult = await service.markApplied('new-ticket-id', { deployed: true });
      expect(applyResult.success).toBe(true);
    });

    it('should handle rejection workflow', async () => {
      // Create and then reject
      mockSupabase._mocks.mockRpc
        .mockResolvedValueOnce({ data: 'ticket-id', error: null })
        .mockResolvedValueOnce({ data: { success: true }, error: null });

      await service.createTicket(createMockCreateParams());
      const result = await service.rejectTicket('ticket-id', {
        review_notes: 'Needs more testing before deployment',
      });

      expect(result.success).toBe(true);
      expect(auditLogger.info).toHaveBeenCalledWith('GUARDIAN_TICKET_REJECTED', expect.any(Object));
    });
  });
});
