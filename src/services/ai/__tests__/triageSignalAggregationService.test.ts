/**
 * Tests for Triage Signal Aggregation Service
 *
 * P1-4: Behavioral tests for signal aggregation, conflict detection,
 * and meta-triage resolution.
 *
 * Tracker: docs/trackers/claude-in-claude-triage-tracker.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TriageSignalAggregationService } from '../triageSignalAggregationService';
import { CareEscalationScorerService } from '../careEscalationScorerService';
import { MissedCheckInEscalationService } from '../missedCheckInEscalationService';
import { resultEscalationService } from '../../resultEscalationService';
import type { ServiceResult } from '../../_base';

// Mock supabase
const mockInvoke = vi.fn();
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    })),
  },
}));

// Mock audit logger
vi.mock('../../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock notification service
vi.mock('../../notificationService', () => ({
  getNotificationService: () => ({
    sendNotification: vi.fn(),
  }),
}));

// ============================================================================
// Helpers — assert + narrow without non-null assertions
// ============================================================================

function assertSuccess<T>(result: ServiceResult<T>): T {
  expect(result.success).toBe(true);
  if (!result.success || result.data === null || result.data === undefined) {
    throw new Error('Expected success result with data');
  }
  return result.data;
}

function assertFailure(result: ServiceResult<unknown>, expectedCode: string): void {
  expect(result.success).toBe(false);
  if (result.success) throw new Error('Expected failure result');
  expect(result.error.code).toBe(expectedCode);
}

// ============================================================================
// Test Fixtures — Synthetic data (obviously fake per CLAUDE.md rules)
// ============================================================================

// Test mock boundary — cast to ServiceResult at boundary per CLAUDE.md type cast rules
function createMockCareResponse(overrides?: {
  escalationCategory?: string;
  confidenceLevel?: number;
  overallTrend?: string;
}) {
  return { success: true, error: null, data: {
      assessment: {
        assessmentId: 'assessment-test-001',
        patientId: 'patient-test-alpha',
        assessorId: 'assessor-test-001',
        assessmentDate: '2026-01-01T00:00:00Z',
        context: 'routine_assessment',
        overallEscalationScore: 65,
        confidenceLevel: overrides?.confidenceLevel ?? 80,
        escalationCategory: overrides?.escalationCategory ?? 'monitor',
        urgencyLevel: 'routine',
        clinicalIndicators: [],
        escalationFactors: [
          { factor: 'Elevated BP', category: 'vitals', severity: 'moderate', evidence: 'BP 145/92', weight: 0.6 },
        ],
        protectiveFactors: ['Active caregiver'],
        overallTrend: overrides?.overallTrend ?? 'stable',
        trendConfidence: 70,
        hoursToReassess: 24,
        recommendations: [],
        requiredNotifications: [],
        documentationRequired: [],
        requiresPhysicianReview: false,
        requiresRapidResponse: false,
        reviewReasons: [],
        clinicalSummary: 'Patient stable with elevated BP.',
        handoffPriority: 'medium',
      },
      metadata: {
        generated_at: '2026-01-01T00:00:00Z',
        response_time_ms: 1200,
        model: 'claude-sonnet-4-5-20250929',
      },
  } } as unknown as ServiceResult<never>;
}

function createMockMissedCheckInResponse(overrides?: {
  escalationLevel?: string;
}) {
  return { success: true, error: null, data: {
      escalation: {
        escalationLevel: overrides?.escalationLevel ?? 'low',
        reasoning: 'Test Patient Alpha missed 1 check-in',
        recommendedActions: ['Send reminder'],
        notifyTenant: false,
        notifyCaregiver: false,
        notifyEmergencyContact: false,
        callForWelfareCheck: false,
        message: { subject: 'Missed check-in', body: 'Please check in', urgency: 'routine' },
        riskFactors: ['1 missed check-in'],
        protectiveFactors: ['Regular pattern before this'],
      },
      context: {
        riskLevel: 'low',
        consecutiveMissed: 1,
        hasCaregiver: true,
      },
      metadata: {
        processed_at: '2026-01-01T00:00:00Z',
        trigger_type: 'scheduled_check',
        response_time_ms: 500,
      },
  } } as unknown as ServiceResult<never>;
}

function createMockLabEscalations(overrides?: {
  severity?: string;
  testName?: string;
}) {
  return { success: true, error: null, data: [
    {
      id: 'escalation-test-001',
      rule_id: 'rule-test-001',
      result_id: 'result-test-001',
      result_source: 'lab_results',
      patient_id: 'patient-test-alpha',
      test_name: overrides?.testName ?? 'Potassium',
      test_value: 6.8,
      test_unit: 'mmol/L',
      severity: overrides?.severity ?? 'high',
      route_to_specialty: 'nephrology',
      routed_to_provider_id: null,
      task_id: null,
      escalation_status: 'pending',
      resolved_at: null,
      resolved_by: null,
      resolution_notes: null,
      tenant_id: 'tenant-test-001',
      created_at: '2026-01-01T00:00:00Z',
    },
  ] } as unknown as ServiceResult<never>;
}

// ============================================================================
// Tests
// ============================================================================

describe('TriageSignalAggregationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockReset();
  });

  describe('aggregateSignals', () => {
    it('collects signals from all three sources in parallel', async () => {
      vi.spyOn(CareEscalationScorerService, 'scorePatient')
        .mockResolvedValue(createMockCareResponse());
      vi.spyOn(MissedCheckInEscalationService, 'analyzeAndEscalate')
        .mockResolvedValue(createMockMissedCheckInResponse());
      vi.spyOn(resultEscalationService, 'getActiveEscalations')
        .mockResolvedValue(createMockLabEscalations());

      const result = await TriageSignalAggregationService.aggregateSignals(
        'patient-test-alpha', 'assessor-test-001', 'tenant-test-001'
      );

      const data = assertSuccess(result);
      expect(data.signals).toHaveLength(3);
      expect(data.signals.map(s => s.skill_key)).toEqual([
        'ai-care-escalation-scorer',
        'ai-missed-checkin-escalation',
        'result-escalation',
      ]);
    });

    it('normalizes different escalation enums to unified levels', async () => {
      vi.spyOn(CareEscalationScorerService, 'scorePatient')
        .mockResolvedValue(createMockCareResponse({ escalationCategory: 'escalate' }));
      vi.spyOn(MissedCheckInEscalationService, 'analyzeAndEscalate')
        .mockResolvedValue(createMockMissedCheckInResponse({ escalationLevel: 'high' }));
      vi.spyOn(resultEscalationService, 'getActiveEscalations')
        .mockResolvedValue(createMockLabEscalations({ severity: 'critical' }));

      const result = await TriageSignalAggregationService.aggregateSignals(
        'patient-test-alpha', 'assessor-test-001', 'tenant-test-001'
      );

      const data = assertSuccess(result);
      const levels = data.signals.map(s => s.recommended_level);
      // care "escalate" → "escalate", missed "high" → "escalate", lab "critical" → "emergency"
      expect(levels).toEqual(['escalate', 'escalate', 'emergency']);
    });

    it('detects conflicts when signals disagree by 2+ levels', async () => {
      // Care says "none", but lab says "emergency" → conflict
      vi.spyOn(CareEscalationScorerService, 'scorePatient')
        .mockResolvedValue(createMockCareResponse({ escalationCategory: 'none' }));
      vi.spyOn(MissedCheckInEscalationService, 'analyzeAndEscalate')
        .mockResolvedValue(createMockMissedCheckInResponse({ escalationLevel: 'none' }));
      vi.spyOn(resultEscalationService, 'getActiveEscalations')
        .mockResolvedValue(createMockLabEscalations({ severity: 'critical' }));

      const result = await TriageSignalAggregationService.aggregateSignals(
        'patient-test-alpha', 'assessor-test-001', 'tenant-test-001'
      );

      const data = assertSuccess(result);
      expect(data.has_conflicts).toBe(true);
      expect(data.current_decision).toBe('emergency');
    });

    it('reports no conflict when all signals agree', async () => {
      vi.spyOn(CareEscalationScorerService, 'scorePatient')
        .mockResolvedValue(createMockCareResponse({ escalationCategory: 'monitor' }));
      vi.spyOn(MissedCheckInEscalationService, 'analyzeAndEscalate')
        .mockResolvedValue(createMockMissedCheckInResponse({ escalationLevel: 'low' }));
      vi.spyOn(resultEscalationService, 'getActiveEscalations')
        .mockResolvedValue(createMockLabEscalations({ severity: 'low' }));

      const result = await TriageSignalAggregationService.aggregateSignals(
        'patient-test-alpha', 'assessor-test-001', 'tenant-test-001'
      );

      const data = assertSuccess(result);
      expect(data.has_conflicts).toBe(false);
    });

    it('succeeds with partial signals when one source fails', async () => {
      vi.spyOn(CareEscalationScorerService, 'scorePatient')
        .mockResolvedValue(createMockCareResponse());
      vi.spyOn(MissedCheckInEscalationService, 'analyzeAndEscalate')
        .mockRejectedValue(new Error('Service unavailable'));
      vi.spyOn(resultEscalationService, 'getActiveEscalations')
        .mockResolvedValue(createMockLabEscalations());

      const result = await TriageSignalAggregationService.aggregateSignals(
        'patient-test-alpha', 'assessor-test-001', 'tenant-test-001'
      );

      const data = assertSuccess(result);
      expect(data.signals).toHaveLength(2);
      expect(data.signals.map(s => s.skill_key)).toEqual([
        'ai-care-escalation-scorer',
        'result-escalation',
      ]);
    });

    it('fails when all sources are unavailable', async () => {
      vi.spyOn(CareEscalationScorerService, 'scorePatient')
        .mockRejectedValue(new Error('Service down'));
      vi.spyOn(MissedCheckInEscalationService, 'analyzeAndEscalate')
        .mockRejectedValue(new Error('Service down'));
      vi.spyOn(resultEscalationService, 'getActiveEscalations')
        .mockRejectedValue(new Error('Service down'));

      const result = await TriageSignalAggregationService.aggregateSignals(
        'patient-test-alpha', 'assessor-test-001', 'tenant-test-001'
      );

      assertFailure(result, 'NO_SIGNALS');
    });

    it('handles empty lab escalations without creating a signal', async () => {
      vi.spyOn(CareEscalationScorerService, 'scorePatient')
        .mockResolvedValue(createMockCareResponse());
      vi.spyOn(MissedCheckInEscalationService, 'analyzeAndEscalate')
        .mockResolvedValue(createMockMissedCheckInResponse());
      vi.spyOn(resultEscalationService, 'getActiveEscalations')
        .mockResolvedValue({ success: true, error: null, data: [] } as unknown as ServiceResult<never>);

      const result = await TriageSignalAggregationService.aggregateSignals(
        'patient-test-alpha', 'assessor-test-001', 'tenant-test-001'
      );

      const data = assertSuccess(result);
      expect(data.signals).toHaveLength(2);
    });

    it('maps confidence from care escalation correctly (0-100 to 0-1)', async () => {
      vi.spyOn(CareEscalationScorerService, 'scorePatient')
        .mockResolvedValue(createMockCareResponse({ confidenceLevel: 85 }));
      vi.spyOn(MissedCheckInEscalationService, 'analyzeAndEscalate')
        .mockResolvedValue(createMockMissedCheckInResponse());
      vi.spyOn(resultEscalationService, 'getActiveEscalations')
        .mockResolvedValue({ success: true, error: null, data: [] } as unknown as ServiceResult<never>);

      const result = await TriageSignalAggregationService.aggregateSignals(
        'patient-test-alpha', 'assessor-test-001', 'tenant-test-001'
      );

      const data = assertSuccess(result);
      const careSignal = data.signals.find(s => s.skill_key === 'ai-care-escalation-scorer');
      expect(careSignal).toBeDefined();
      if (careSignal) {
        expect(careSignal.confidence).toBe(0.85);
      }
    });
  });

  describe('resolveConflicts', () => {
    it('skips meta-triage when no conflicts exist', async () => {
      const aggregation = {
        patient_id: 'patient-test-alpha',
        tenant_id: 'tenant-test-001',
        signals: [{
          skill_key: 'ai-care-escalation-scorer',
          recommended_level: 'monitor' as const,
          confidence: 0.8,
          factors: ['Elevated BP'],
          data_source: 'clinical_assessment',
          generated_at: '2026-01-01T00:00:00Z',
        }],
        current_decision: 'monitor' as const,
        has_conflicts: false,
        collected_at: '2026-01-01T00:00:00Z',
      };

      const result = await TriageSignalAggregationService.resolveConflicts(aggregation);

      const data = assertSuccess(result);
      expect(data.conflict_detected).toBe(false);
      expect(data.resolved_level).toBe('monitor');
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('calls meta-triage MCP tool when conflicts exist', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          result: {
            content: [{
              text: JSON.stringify({
                resolved_level: 'escalate',
                confidence: 0.82,
                urgency: 'urgent',
                reasoning: 'Lab results override self-report',
                trust_weights: [
                  { skill_key: 'result-escalation', weight: 0.9, reasoning: 'Objective', data_reliability: 'high' },
                  { skill_key: 'ai-care-escalation-scorer', weight: 0.3, reasoning: 'Contradicted', data_reliability: 'moderate' },
                ],
                conflict_detected: true,
                conflict_summary: 'Lab critical vs clinical none',
                recommended_actions: ['Repeat potassium stat', 'Nephrology consult'],
                requires_review: true,
              }),
            }],
          },
        },
        error: null,
      });

      const aggregation = {
        patient_id: 'patient-test-alpha',
        tenant_id: 'tenant-test-001',
        signals: [
          { skill_key: 'ai-care-escalation-scorer', recommended_level: 'none' as const, confidence: 0.7, factors: ['No acute findings'], data_source: 'clinical_assessment', generated_at: '2026-01-01T00:00:00Z' },
          { skill_key: 'result-escalation', recommended_level: 'emergency' as const, confidence: 0.9, factors: ['Potassium: 6.8 mmol/L (critical)'], data_source: 'lab_results', generated_at: '2026-01-01T00:00:00Z' },
        ],
        current_decision: 'emergency' as const,
        has_conflicts: true,
        collected_at: '2026-01-01T00:00:00Z',
      };

      const result = await TriageSignalAggregationService.resolveConflicts(aggregation);

      const data = assertSuccess(result);
      expect(data.resolved_level).toBe('escalate');
      expect(data.conflict_detected).toBe(true);
      expect(data.requires_review).toBe(true);

      expect(mockInvoke).toHaveBeenCalledWith('mcp-claude-server', expect.objectContaining({
        body: expect.objectContaining({
          method: 'tools/call',
          params: expect.objectContaining({
            name: 'evaluate-escalation-conflict',
          }),
        }),
      }));
    });

    it('returns failure when MCP server call fails', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Edge function timeout' },
      });

      const aggregation = {
        patient_id: 'patient-test-alpha',
        tenant_id: 'tenant-test-001',
        signals: [],
        current_decision: 'emergency' as const,
        has_conflicts: true,
        collected_at: '2026-01-01T00:00:00Z',
      };

      const result = await TriageSignalAggregationService.resolveConflicts(aggregation);

      assertFailure(result, 'META_TRIAGE_FAILED');
    });
  });

  describe('triagePatient (full pipeline)', () => {
    it('aggregates and skips resolution when no conflicts', async () => {
      vi.spyOn(CareEscalationScorerService, 'scorePatient')
        .mockResolvedValue(createMockCareResponse({ escalationCategory: 'monitor' }));
      vi.spyOn(MissedCheckInEscalationService, 'analyzeAndEscalate')
        .mockResolvedValue(createMockMissedCheckInResponse({ escalationLevel: 'low' }));
      vi.spyOn(resultEscalationService, 'getActiveEscalations')
        .mockResolvedValue({ success: true, error: null, data: [] } as unknown as ServiceResult<never>);

      const result = await TriageSignalAggregationService.triagePatient(
        'patient-test-alpha', 'assessor-test-001', 'tenant-test-001'
      );

      const data = assertSuccess(result);
      expect(data.aggregation.has_conflicts).toBe(false);
      expect(data.resolution).toBeNull();
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('aggregates and resolves when conflicts detected', async () => {
      vi.spyOn(CareEscalationScorerService, 'scorePatient')
        .mockResolvedValue(createMockCareResponse({ escalationCategory: 'none' }));
      vi.spyOn(MissedCheckInEscalationService, 'analyzeAndEscalate')
        .mockResolvedValue(createMockMissedCheckInResponse({ escalationLevel: 'none' }));
      vi.spyOn(resultEscalationService, 'getActiveEscalations')
        .mockResolvedValue(createMockLabEscalations({ severity: 'critical' }));

      mockInvoke.mockResolvedValue({
        data: {
          result: {
            content: [{
              text: JSON.stringify({
                resolved_level: 'escalate',
                confidence: 0.85,
                conflict_detected: true,
                reasoning: 'Critical lab values override clinical assessment of none',
                requires_review: true,
              }),
            }],
          },
        },
        error: null,
      });

      const result = await TriageSignalAggregationService.triagePatient(
        'patient-test-alpha', 'assessor-test-001', 'tenant-test-001'
      );

      const data = assertSuccess(result);
      expect(data.aggregation.has_conflicts).toBe(true);
      expect(data.resolution).not.toBeNull();
      if (data.resolution) {
        expect(data.resolution.resolved_level).toBe('escalate');
      }
    });

    it('returns aggregation even when resolution fails', async () => {
      vi.spyOn(CareEscalationScorerService, 'scorePatient')
        .mockResolvedValue(createMockCareResponse({ escalationCategory: 'none' }));
      vi.spyOn(MissedCheckInEscalationService, 'analyzeAndEscalate')
        .mockResolvedValue(createMockMissedCheckInResponse({ escalationLevel: 'emergency' }));
      vi.spyOn(resultEscalationService, 'getActiveEscalations')
        .mockResolvedValue({ success: true, error: null, data: [] } as unknown as ServiceResult<never>);

      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Server error' },
      });

      const result = await TriageSignalAggregationService.triagePatient(
        'patient-test-alpha', 'assessor-test-001', 'tenant-test-001'
      );

      const data = assertSuccess(result);
      expect(data.aggregation.signals).toHaveLength(2);
      expect(data.resolution).toBeNull();
    });
  });
});
