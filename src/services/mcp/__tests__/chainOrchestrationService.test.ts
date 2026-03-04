/**
 * Chain Orchestration Service — Behavioral Tests
 *
 * Tests the browser-side service that manages chain pipelines
 * via the mcp-chain-orchestrator edge function.
 *
 * Tier 1-3 tests: behavior, state, and integration.
 */

import { chainOrchestrationService } from '../chainOrchestrationService';
import { supabase } from '../../../lib/supabaseClient';

// Mock the supabase client
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(),
  },
}));

const mockInvoke = vi.mocked(supabase.functions.invoke);

// Helper to build a chainable query mock
function createQueryMock(resolveWith: { data: unknown; error: unknown }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const terminal = { then: (fn: (v: unknown) => unknown) => Promise.resolve(fn(resolveWith)) };
  const proxy = new Proxy(chain, {
    get: (_target, prop) => {
      if (prop === 'then') return terminal.then;
      if (!chain[prop as string]) {
        chain[prop as string] = vi.fn().mockReturnValue(proxy);
      }
      return chain[prop as string];
    },
  });
  return proxy;
}

// ============================================================
// Test data
// ============================================================

const MOCK_CHAIN_RUN = {
  id: 'run-001',
  chain_definition_id: 'def-001',
  chain_key: 'medical_coding_revenue',
  status: 'running',
  current_step_order: 1,
  input_params: { patient_id: 'patient-abc', encounter_id: 'enc-123' },
  output: null,
  started_by: 'user-123',
  tenant_id: 'tenant-001',
  error_message: null,
  error_step_key: null,
  started_at: '2026-03-04T10:00:00Z',
  completed_at: null,
  created_at: '2026-03-04T10:00:00Z',
};

const MOCK_STEP_RESULTS = [
  {
    id: 'step-001',
    chain_run_id: 'run-001',
    step_definition_id: 'stepdef-001',
    step_order: 1,
    step_key: 'aggregate_charges',
    mcp_server: 'mcp-medical-coding-server',
    tool_name: 'aggregate_daily_charges',
    status: 'completed',
    output_data: { charges: { lab: [], imaging: [] }, total_charge_amount: 2500 },
    error_message: null,
    execution_time_ms: 450,
  },
  {
    id: 'step-002',
    chain_run_id: 'run-001',
    step_definition_id: 'stepdef-002',
    step_order: 2,
    step_key: 'save_snapshot',
    mcp_server: 'mcp-medical-coding-server',
    tool_name: 'save_daily_snapshot',
    status: 'completed',
    output_data: { snapshot_id: 'snap-001' },
    error_message: null,
    execution_time_ms: 120,
  },
  {
    id: 'step-003',
    chain_run_id: 'run-001',
    step_definition_id: 'stepdef-003',
    step_order: 3,
    step_key: 'drg_grouper',
    mcp_server: 'mcp-medical-coding-server',
    tool_name: 'run_drg_grouper',
    status: 'awaiting_approval',
    output_data: { drg_code: '470', drg_weight: 1.7613 },
    error_message: null,
    execution_time_ms: 3200,
  },
];

const MOCK_CHAIN_DEFINITIONS = [
  {
    id: 'def-001',
    chain_key: 'medical_coding_revenue',
    display_name: 'Medical Coding → Revenue Pipeline',
    description: 'End-to-end inpatient revenue pipeline',
    version: 1,
    is_active: true,
  },
  {
    id: 'def-002',
    chain_key: 'claims_pipeline',
    display_name: 'Claims Submission Pipeline',
    description: 'End-to-end claim submission',
    version: 1,
    is_active: true,
  },
];

// ============================================================
// Tests
// ============================================================

describe('chainOrchestrationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations explicitly (vi.clearAllMocks does not reset mockImplementation)
    mockInvoke.mockReset();
    vi.mocked(supabase.from).mockReset();
  });

  // ========================================================
  // Tier 2: State — startChain
  // ========================================================
  describe('startChain', () => {
    it('returns a running chain run on successful start', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { run: MOCK_CHAIN_RUN },
        error: null,
      });

      const result = await chainOrchestrationService.startChain(
        'medical_coding_revenue',
        { patient_id: 'patient-abc', encounter_id: 'enc-123' }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.run.chain_key).toBe('medical_coding_revenue');
        expect(result.data.run.status).toBe('running');
        expect(result.data.run.id).toBe('run-001');
      }

      expect(mockInvoke).toHaveBeenCalledWith('mcp-chain-orchestrator', {
        body: {
          action: 'start',
          chain_key: 'medical_coding_revenue',
          input_params: { patient_id: 'patient-abc', encounter_id: 'enc-123' },
        },
      });
    });

    it('returns a chain paused at approval gate when DRG step requires physician approval', async () => {
      const pausedRun = { ...MOCK_CHAIN_RUN, status: 'awaiting_approval', current_step_order: 3 };
      mockInvoke.mockResolvedValueOnce({
        data: { run: pausedRun },
        error: null,
      });

      const result = await chainOrchestrationService.startChain(
        'medical_coding_revenue',
        { patient_id: 'patient-abc', encounter_id: 'enc-123' }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.run.status).toBe('awaiting_approval');
        expect(result.data.run.current_step_order).toBe(3);
      }
    });

    it('returns failure for empty chain_key', async () => {
      const result = await chainOrchestrationService.startChain('', {});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });

    it('returns failure when edge function returns error', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { error: 'Chain not found or inactive: nonexistent_chain' },
        error: null,
      });

      const result = await chainOrchestrationService.startChain('nonexistent_chain', {});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('CHAIN_EXECUTION_FAILED');
        expect(result.error.message).toContain('nonexistent_chain');
      }
    });

    it('returns failure when network error occurs', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'Edge Function returned a non-2xx status code' },
      });

      const result = await chainOrchestrationService.startChain(
        'medical_coding_revenue',
        {}
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('CHAIN_EXECUTION_FAILED');
      }
    });
  });

  // ========================================================
  // Tier 2: State — getChainStatus
  // ========================================================
  describe('getChainStatus', () => {
    it('returns run and step results for a paused chain', async () => {
      const pausedRun = { ...MOCK_CHAIN_RUN, status: 'awaiting_approval', current_step_order: 3 };
      mockInvoke.mockResolvedValueOnce({
        data: { run: pausedRun, steps: MOCK_STEP_RESULTS },
        error: null,
      });

      const result = await chainOrchestrationService.getChainStatus('run-001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.run.status).toBe('awaiting_approval');
        expect(result.data.steps).toHaveLength(3);
        expect(result.data.steps[0].status).toBe('completed');
        expect(result.data.steps[2].status).toBe('awaiting_approval');
        expect(result.data.steps[2].output_data).toEqual({
          drg_code: '470',
          drg_weight: 1.7613,
        });
      }
    });

    it('returns failure for empty chain_run_id', async () => {
      const result = await chainOrchestrationService.getChainStatus('');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });
  });

  // ========================================================
  // Tier 1: Behavior — approveStep
  // ========================================================
  describe('approveStep', () => {
    it('approves a DRG grouper step and returns updated step result', async () => {
      const approvedStep = {
        ...MOCK_STEP_RESULTS[2],
        status: 'approved',
        approved_by: 'physician-456',
        approval_notes: 'DRG 470 confirmed',
      };
      mockInvoke.mockResolvedValueOnce({
        data: { step: approvedStep },
        error: null,
      });

      const result = await chainOrchestrationService.approveStep(
        'run-001',
        'step-003',
        'approved',
        'DRG 470 confirmed'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.step.status).toBe('approved');
        expect(result.data.step.approval_notes).toBe('DRG 470 confirmed');
      }

      expect(mockInvoke).toHaveBeenCalledWith('mcp-chain-orchestrator', {
        body: {
          action: 'approve',
          chain_run_id: 'run-001',
          step_result_id: 'step-003',
          decision: 'approved',
          notes: 'DRG 470 confirmed',
        },
      });
    });

    it('rejects a step and returns rejected status', async () => {
      const rejectedStep = {
        ...MOCK_STEP_RESULTS[2],
        status: 'rejected',
        approved_by: 'physician-456',
        approval_notes: 'Incorrect principal diagnosis',
      };
      mockInvoke.mockResolvedValueOnce({
        data: { step: rejectedStep },
        error: null,
      });

      const result = await chainOrchestrationService.approveStep(
        'run-001',
        'step-003',
        'rejected',
        'Incorrect principal diagnosis'
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.step.status).toBe('rejected');
      }
    });

    it('returns failure for missing required parameters', async () => {
      const result = await chainOrchestrationService.approveStep('', 'step-003', 'approved');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_INPUT');
      }
    });
  });

  // ========================================================
  // Tier 2: State — resumeChain
  // ========================================================
  describe('resumeChain', () => {
    it('resumes a chain after approval and returns running state', async () => {
      const resumedRun = { ...MOCK_CHAIN_RUN, status: 'running', current_step_order: 4 };
      mockInvoke.mockResolvedValueOnce({
        data: { run: resumedRun },
        error: null,
      });

      const result = await chainOrchestrationService.resumeChain('run-001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.run.status).toBe('running');
        expect(result.data.run.current_step_order).toBe(4);
      }

      expect(mockInvoke).toHaveBeenCalledWith('mcp-chain-orchestrator', {
        body: { action: 'resume', chain_run_id: 'run-001' },
      });
    });

    it('returns completed chain when remaining steps finish after resume', async () => {
      const completedRun = {
        ...MOCK_CHAIN_RUN,
        status: 'completed',
        current_step_order: 6,
        completed_at: '2026-03-04T10:05:00Z',
        output: { total_estimated: 14322.50 },
      };
      mockInvoke.mockResolvedValueOnce({
        data: { run: completedRun },
        error: null,
      });

      const result = await chainOrchestrationService.resumeChain('run-001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.run.status).toBe('completed');
        expect(result.data.run.output).toEqual({ total_estimated: 14322.50 });
      }
    });

    it('returns failure when chain is not resumable', async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { error: 'Chain run run-001 is not resumable (status: completed)' },
        error: null,
      });

      const result = await chainOrchestrationService.resumeChain('run-001');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('not resumable');
      }
    });
  });

  // ========================================================
  // Tier 1: Behavior — cancelChain
  // ========================================================
  describe('cancelChain', () => {
    it('cancels a running chain and returns cancelled status', async () => {
      const cancelledRun = {
        ...MOCK_CHAIN_RUN,
        status: 'cancelled',
        completed_at: '2026-03-04T10:02:00Z',
      };
      mockInvoke.mockResolvedValueOnce({
        data: { run: cancelledRun },
        error: null,
      });

      const result = await chainOrchestrationService.cancelChain('run-001');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.run.status).toBe('cancelled');
      }

      expect(mockInvoke).toHaveBeenCalledWith('mcp-chain-orchestrator', {
        body: { action: 'cancel', chain_run_id: 'run-001' },
      });
    });

    it('returns failure for empty chain_run_id', async () => {
      const result = await chainOrchestrationService.cancelChain('');
      expect(result.success).toBe(false);
    });
  });

  // ========================================================
  // Tier 3: Integration — listChains (direct DB read)
  // ========================================================
  describe('listChains', () => {
    it('returns active chain definitions from database', async () => {
      const mockQuery = createQueryMock({
        data: MOCK_CHAIN_DEFINITIONS,
        error: null,
      });
      vi.mocked(supabase.from).mockReturnValue(mockQuery as unknown as ReturnType<typeof supabase.from>);

      const result = await chainOrchestrationService.listChains();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].chain_key).toBe('medical_coding_revenue');
        expect(result.data[1].chain_key).toBe('claims_pipeline');
      }

      expect(supabase.from).toHaveBeenCalledWith('chain_definitions');
    });

    it('returns failure when database query fails', async () => {
      const mockQuery = createQueryMock({
        data: null,
        error: { message: 'relation "chain_definitions" does not exist' },
      });
      vi.mocked(supabase.from).mockReturnValue(mockQuery as unknown as ReturnType<typeof supabase.from>);

      const result = await chainOrchestrationService.listChains();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
      }
    });
  });

  // ========================================================
  // Tier 3: Integration — listChainRuns (direct DB read with filters)
  // ========================================================
  describe('listChainRuns', () => {
    it('returns chain runs filtered by chain_key and status', async () => {
      const mockRuns = [MOCK_CHAIN_RUN];
      const mockQuery = createQueryMock({ data: mockRuns, error: null });
      vi.mocked(supabase.from).mockReturnValue(mockQuery as unknown as ReturnType<typeof supabase.from>);

      const result = await chainOrchestrationService.listChainRuns({
        chain_key: 'medical_coding_revenue',
        status: 'running',
        limit: 10,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].chain_key).toBe('medical_coding_revenue');
      }
    });

    it('returns empty array when no runs match filters', async () => {
      const mockQuery = createQueryMock({ data: [], error: null });
      vi.mocked(supabase.from).mockReturnValue(mockQuery as unknown as ReturnType<typeof supabase.from>);

      const result = await chainOrchestrationService.listChainRuns({
        status: 'timed_out',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(0);
      }
    });
  });

  // ========================================================
  // Tier 4: Edge Cases
  // ========================================================
  describe('edge cases', () => {
    it('handles unexpected exception from supabase.functions.invoke', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Network timeout'));

      const result = await chainOrchestrationService.startChain(
        'medical_coding_revenue',
        {}
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('CHAIN_EXECUTION_FAILED');
        expect(result.error.message).toBe('Network timeout');
      }
    });

    it('handles null response from orchestrator', async () => {
      mockInvoke.mockResolvedValueOnce({ data: null, error: null });

      const result = await chainOrchestrationService.startChain(
        'medical_coding_revenue',
        {}
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('No response');
      }
    });
  });
});
