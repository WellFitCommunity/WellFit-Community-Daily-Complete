/**
 * AI Decision Chain Service Tests
 *
 * Tests causal traceability for AI decisions:
 * - Starting new chains
 * - Adding links to existing chains
 * - Fetching chains and patient-specific chains
 * - Recording human reviews/overrides
 * - Fetching open (pending review) chains
 *
 * Copyright © 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabaseClient
const mockSingle = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockContains = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockFrom = vi.fn();

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// Mock auditLogger
vi.mock('../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    clinical: vi.fn(),
  },
}));

import { aiDecisionChainService } from '../aiDecisionChainService';
import type { StartChainInput, AddLinkInput } from '../../types/aiDecisionChain';

const MOCK_TENANT_ID = '2b902657-6a20-4435-a78a-576f397517ca';
const MOCK_CHAIN_ID = 'chain-aaa-bbb-ccc';
const MOCK_DECISION_ID = 'decision-111-222-333';
const MOCK_PATIENT_ID = 'patient-xxx-yyy-zzz';

function buildChainRow(overrides: Record<string, unknown> = {}) {
  return {
    id: MOCK_DECISION_ID,
    chain_id: MOCK_CHAIN_ID,
    parent_decision_id: null,
    tenant_id: MOCK_TENANT_ID,
    trigger_type: 'system_event',
    trigger_source: 'ai-readmission-predictor',
    context_snapshot: { patient_id: MOCK_PATIENT_ID },
    model_id: 'claude-sonnet-4-5-20250929',
    skill_key: 'readmission_predictor',
    decision_type: 'clinical',
    decision_summary: 'Patient readmission risk scored at 0.82',
    confidence_score: 0.82,
    authority_tier: 1,
    action_taken: 'Alert created for care team',
    outcome: 'success',
    human_override: false,
    override_reason: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: '2026-03-12T09:00:00Z',
    ...overrides,
  };
}

function setupChainedMocks() {
  mockSingle.mockReset();
  mockSelect.mockReset();
  mockInsert.mockReset();
  mockUpdate.mockReset();
  mockEq.mockReset();
  mockContains.mockReset();
  mockOrder.mockReset();
  mockLimit.mockReset();
  mockFrom.mockReset();

  // Build the chain: from() → insert()/update() → select() → single()
  // and: from() → select() → eq()/contains() → order() → limit()
  mockLimit.mockReturnValue({ data: [], error: null });
  mockOrder.mockReturnValue({ limit: mockLimit, data: [], error: null });
  mockContains.mockReturnValue({ order: mockOrder });
  mockEq.mockReturnValue({ order: mockOrder, select: mockSelect, single: mockSingle });
  mockSelect.mockReturnValue({ eq: mockEq, contains: mockContains, order: mockOrder, single: mockSingle });
  mockInsert.mockReturnValue({ select: mockSelect });
  mockUpdate.mockReturnValue({ eq: mockEq, select: mockSelect });
  mockFrom.mockReturnValue({ insert: mockInsert, select: mockSelect, update: mockUpdate });
}

describe('aiDecisionChainService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupChainedMocks();
  });

  describe('startChain', () => {
    it('creates a new chain with correct fields and returns the row', async () => {
      const mockRow = buildChainRow();
      mockSingle.mockResolvedValue({ data: mockRow, error: null });

      const input: StartChainInput = {
        tenant_id: MOCK_TENANT_ID,
        trigger_type: 'system_event',
        trigger_source: 'ai-readmission-predictor',
        context_snapshot: { patient_id: MOCK_PATIENT_ID },
        model_id: 'claude-sonnet-4-5-20250929',
        skill_key: 'readmission_predictor',
        decision_type: 'clinical',
        decision_summary: 'Patient readmission risk scored at 0.82',
        confidence_score: 0.82,
        authority_tier: 1,
        action_taken: 'Alert created for care team',
        outcome: 'success',
      };

      const result = await aiDecisionChainService.startChain(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.chain_id).toBe(MOCK_CHAIN_ID);
        expect(result.data.decision_type).toBe('clinical');
        expect(result.data.confidence_score).toBe(0.82);
      }
      expect(mockFrom).toHaveBeenCalledWith('ai_decision_chain');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: MOCK_TENANT_ID,
          trigger_type: 'system_event',
          skill_key: 'readmission_predictor',
          decision_type: 'clinical',
        })
      );
    });

    it('returns failure on database error', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Insert failed', code: '42P01' },
      });

      const input: StartChainInput = {
        tenant_id: MOCK_TENANT_ID,
        trigger_type: 'system_event',
        trigger_source: 'test',
        context_snapshot: {},
        model_id: 'claude-sonnet-4-5-20250929',
        decision_type: 'operational',
        decision_summary: 'Test decision',
      };

      const result = await aiDecisionChainService.startChain(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('DATABASE_ERROR');
        expect(result.error.message).toBe('Insert failed');
      }
    });

    it('defaults outcome to pending_review when not specified', async () => {
      const mockRow = buildChainRow({ outcome: 'pending_review' });
      mockSingle.mockResolvedValue({ data: mockRow, error: null });

      const input: StartChainInput = {
        tenant_id: MOCK_TENANT_ID,
        trigger_type: 'user_request',
        trigger_source: 'manual-trigger',
        context_snapshot: {},
        model_id: 'claude-sonnet-4-5-20250929',
        decision_type: 'documentation',
        decision_summary: 'Generated patient education materials',
      };

      await aiDecisionChainService.startChain(input);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'pending_review',
          skill_key: null,
          confidence_score: null,
          authority_tier: null,
          action_taken: null,
        })
      );
    });
  });

  describe('addLink', () => {
    it('adds a link with parent_decision_id and inherited chain_id', async () => {
      const parentId = 'parent-decision-aaa';
      const mockRow = buildChainRow({
        parent_decision_id: parentId,
        decision_type: 'escalation',
        trigger_type: 'ai_initiated',
      });
      mockSingle.mockResolvedValue({ data: mockRow, error: null });

      const input: AddLinkInput = {
        chain_id: MOCK_CHAIN_ID,
        parent_decision_id: parentId,
        tenant_id: MOCK_TENANT_ID,
        trigger_type: 'ai_initiated',
        trigger_source: 'readmission risk > 0.8',
        context_snapshot: { patient_id: MOCK_PATIENT_ID },
        model_id: 'claude-sonnet-4-5-20250929',
        skill_key: 'care_plan_generator',
        decision_type: 'escalation',
        decision_summary: 'Generated 30-day follow-up care plan',
        confidence_score: 0.75,
      };

      const result = await aiDecisionChainService.addLink(input);

      expect(result.success).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          chain_id: MOCK_CHAIN_ID,
          parent_decision_id: parentId,
        })
      );
    });
  });

  describe('getChain', () => {
    it('returns all links in a chain ordered by creation time', async () => {
      const rows = [
        buildChainRow({ id: 'link-1', created_at: '2026-03-12T09:00:00Z' }),
        buildChainRow({ id: 'link-2', parent_decision_id: 'link-1', created_at: '2026-03-12T09:01:00Z' }),
      ];
      mockLimit.mockReturnValue({ data: rows, error: null });
      // getChain uses order() without limit(), so mock order to resolve directly
      mockOrder.mockReturnValue({ data: rows, error: null, limit: mockLimit });

      const result = await aiDecisionChainService.getChain(MOCK_CHAIN_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].id).toBe('link-1');
        expect(result.data[1].parent_decision_id).toBe('link-1');
      }
      expect(mockEq).toHaveBeenCalledWith('chain_id', MOCK_CHAIN_ID);
    });
  });

  describe('getChainsByPatient', () => {
    it('queries by context_snapshot containing patient_id', async () => {
      const rows = [buildChainRow()];
      mockLimit.mockReturnValue({ data: rows, error: null });

      const result = await aiDecisionChainService.getChainsByPatient(MOCK_PATIENT_ID);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
      }
      expect(mockContains).toHaveBeenCalledWith('context_snapshot', { patient_id: MOCK_PATIENT_ID });
    });

    it('respects the limit parameter', async () => {
      mockLimit.mockReturnValue({ data: [], error: null });

      await aiDecisionChainService.getChainsByPatient(MOCK_PATIENT_ID, 10);

      expect(mockLimit).toHaveBeenCalledWith(10);
    });
  });

  describe('reviewDecision', () => {
    it('records human override with reason', async () => {
      const reviewerId = 'ba4f20ad-2707-467b-a87f-d46fe9255d2f';
      const mockRow = buildChainRow({
        human_override: true,
        override_reason: 'Patient context not captured in model',
        reviewed_by: reviewerId,
        reviewed_at: '2026-03-12T10:00:00Z',
        outcome: 'overridden',
      });
      mockSingle.mockResolvedValue({ data: mockRow, error: null });

      const result = await aiDecisionChainService.reviewDecision({
        decision_id: MOCK_DECISION_ID,
        reviewed_by: reviewerId,
        human_override: true,
        override_reason: 'Patient context not captured in model',
        outcome: 'overridden',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.human_override).toBe(true);
        expect(result.data.outcome).toBe('overridden');
        expect(result.data.reviewed_by).toBe(reviewerId);
      }
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          human_override: true,
          override_reason: 'Patient context not captured in model',
          outcome: 'overridden',
        })
      );
    });

    it('records approval without override', async () => {
      const reviewerId = 'ba4f20ad-2707-467b-a87f-d46fe9255d2f';
      const mockRow = buildChainRow({
        human_override: false,
        reviewed_by: reviewerId,
        outcome: 'success',
      });
      mockSingle.mockResolvedValue({ data: mockRow, error: null });

      const result = await aiDecisionChainService.reviewDecision({
        decision_id: MOCK_DECISION_ID,
        reviewed_by: reviewerId,
        human_override: false,
        outcome: 'success',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.human_override).toBe(false);
        expect(result.data.outcome).toBe('success');
      }
    });
  });

  describe('getOpenChains', () => {
    it('fetches only pending_review decisions', async () => {
      const rows = [
        buildChainRow({ outcome: 'pending_review' }),
      ];
      mockLimit.mockReturnValue({ data: rows, error: null });

      const result = await aiDecisionChainService.getOpenChains();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].outcome).toBe('pending_review');
      }
      expect(mockEq).toHaveBeenCalledWith('outcome', 'pending_review');
    });
  });
});
