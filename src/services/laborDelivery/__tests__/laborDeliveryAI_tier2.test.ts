/**
 * L&D AI Service Tier 2 Tests
 * Tests: Guideline Compliance, Shift Handoff, SDOH Detection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkGuidelineCompliance,
  generateLDShiftHandoff,
  scanPrenatalNotesForSDOH,
} from '../laborDeliveryAI_tier2';

const mockInvoke = vi.fn();
const mockFrom = vi.fn();

vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock('../../auditLogger', () => ({
  auditLogger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Build a chainable + thenable query mock
// The chain is thenable so `await supabase.from(...).select(...).eq(...)` resolves
function buildChain(data: unknown, error: unknown = null) {
  const resolvedArray = { data: Array.isArray(data) ? data : [], error };
  const resolvedSingle = { data, error };
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn().mockResolvedValue(resolvedArray);
  chain.single = vi.fn().mockResolvedValue(resolvedSingle);
  // Make chain itself thenable (for queries that end without .limit/.single)
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(resolvedArray).then(resolve);
  return chain;
}

describe('laborDeliveryAI_tier2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =====================================================
  // checkGuidelineCompliance
  // =====================================================
  describe('checkGuidelineCompliance', () => {
    it('calls ai-clinical-guideline-matcher with L&D focus conditions', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          recommendations: [],
          adherenceGaps: [],
          preventiveScreenings: [],
          summary: { totalGuidelines: 5, totalRecommendations: 0, criticalGaps: 0, highPriorityGaps: 0, overdueScreenings: 0 },
          confidence: 0.9,
        },
        error: null,
      });

      const result = await checkGuidelineCompliance('p1', 't1');

      expect(mockInvoke).toHaveBeenCalledWith('ai-clinical-guideline-matcher', {
        body: expect.objectContaining({
          patientId: 'p1',
          tenantId: 't1',
          focusConditions: expect.arrayContaining(['pregnancy', 'preeclampsia', 'gestational diabetes']),
          includePreventiveCare: true,
        }),
      });
      expect(result.success).toBe(true);
    });

    it('returns structured compliance data with summary', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          recommendations: [{ category: 'screening', recommendation: 'Order GBS' }],
          adherenceGaps: [{ priority: 'high', description: 'Missing glucose test' }],
          preventiveScreenings: [{ screeningName: 'GBS', status: 'never_done' }],
          summary: { totalGuidelines: 5, totalRecommendations: 1, criticalGaps: 0, highPriorityGaps: 1, overdueScreenings: 0 },
          confidence: 0.87,
        },
        error: null,
      });

      const result = await checkGuidelineCompliance('p1', 't1');

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.recommendations).toHaveLength(1);
        expect(result.data.adherenceGaps).toHaveLength(1);
        expect(result.data.summary.highPriorityGaps).toBe(1);
        expect(result.data.confidence).toBe(0.87);
        expect(result.data.requiresReview).toBe(true);
      }
    });

    it('returns failure when edge function errors', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Guideline service timeout' },
      });

      const result = await checkGuidelineCompliance('p1', 't1');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Guideline service timeout');
    });

    it('returns failure when no data is returned', async () => {
      mockInvoke.mockResolvedValue({ data: null, error: null });

      const result = await checkGuidelineCompliance('p1', 't1');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('No guideline data returned');
    });
  });

  // =====================================================
  // generateLDShiftHandoff
  // =====================================================
  describe('generateLDShiftHandoff', () => {
    it('aggregates L&D data from multiple tables', async () => {
      const laborChain = buildChain([{ stage: 'active_labor', dilation_cm: 6, effacement_percent: 80, station: 0, event_time: '2026-02-16T10:00:00Z', contraction_frequency_per_10min: 4 }]);
      const fetalChain = buildChain([{ fhr_baseline: 145, fhr_category: 'I', variability: 'moderate', deceleration_type: 'none', assessment_time: '2026-02-16T10:30:00Z' }]);
      const medsChain = buildChain([{ medication_name: 'Penicillin G', dose: '5MU', route: 'iv', administered_datetime: '2026-02-16T09:00:00Z', indication: 'gbs_prophylaxis' }]);
      const alertsChain = buildChain([{ alert_type: 'clinical', severity: 'high', message: 'GBS positive', status: 'active' }]);
      const pregnancyChain = buildChain({ gravida: 2, para: 1, edd: '2026-03-15', blood_type: 'A+', risk_factors: ['GBS positive'], current_status: 'active_labor' });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return laborChain;
        if (callCount === 2) return fetalChain;
        if (callCount === 3) return medsChain;
        if (callCount === 4) return alertsChain;
        return pregnancyChain;
      });

      const result = await generateLDShiftHandoff('p1', 't1', 'preg-1');

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.sections.length).toBeGreaterThan(0);
        expect(result.data.patientSummary).toContain('G2P1');
        expect(result.data.urgencyLevel).toBe('urgent');
        expect(result.data.activeAlerts).toHaveLength(1);
      }
    });

    it('handles missing pregnancy data gracefully', async () => {
      const emptyChain = buildChain([]);
      const nullPregnancy = buildChain(null);

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount <= 4) return emptyChain;
        return nullPregnancy;
      });

      const result = await generateLDShiftHandoff('p1', 't1', 'preg-1');

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.patientSummary).toBe('No pregnancy data');
        expect(result.data.urgencyLevel).toBe('routine');
      }
    });

    it('returns failure on exception', async () => {
      mockFrom.mockImplementation(() => { throw new Error('DB connection lost'); });

      const result = await generateLDShiftHandoff('p1', 't1', 'preg-1');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('DB connection lost');
    });
  });

  // =====================================================
  // scanPrenatalNotesForSDOH
  // =====================================================
  describe('scanPrenatalNotesForSDOH', () => {
    it('calls sdoh-passive-detect with correct payload', async () => {
      mockInvoke.mockResolvedValue({
        data: { detections: [] },
        error: null,
      });

      const result = await scanPrenatalNotesForSDOH('p1', 't1', 'Patient needs food assistance', 'visit-42');

      expect(mockInvoke).toHaveBeenCalledWith('sdoh-passive-detect', {
        body: {
          patientId: 'p1',
          tenantId: 't1',
          sourceType: 'self_report_note',
          sourceId: 'visit-42',
          sourceText: 'Patient needs food assistance',
        },
      });
      expect(result.success).toBe(true);
    });

    it('returns structured detections with risk metadata', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          detections: [
            { category: 'food_insecurity', confidenceScore: 0.8, riskLevel: 'high', urgency: 'soon', zCodeMapping: 'Z59.41', aiSummary: 'Food insecurity detected', recommendedActions: [] },
          ],
        },
        error: null,
      });

      const result = await scanPrenatalNotesForSDOH('p1', 't1', 'No groceries', 'v1');

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.totalDetections).toBe(1);
        expect(result.data.hasHighRiskFindings).toBe(true);
        expect(result.data.detections[0].zCodeMapping).toBe('Z59.41');
      }
    });

    it('returns zero detections when nothing found', async () => {
      mockInvoke.mockResolvedValue({
        data: { detections: [] },
        error: null,
      });

      const result = await scanPrenatalNotesForSDOH('p1', 't1', 'Routine visit, no concerns', 'v2');

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.totalDetections).toBe(0);
        expect(result.data.hasHighRiskFindings).toBe(false);
      }
    });

    it('returns failure when edge function errors', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'SDOH service down' },
      });

      const result = await scanPrenatalNotesForSDOH('p1', 't1', 'text', 'v3');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('SDOH service down');
    });
  });
});
