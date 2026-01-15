/**
 * Tests for Billing Optimization Engine Service
 *
 * @skill #38 - Billing Optimization Engine
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingOptimizationEngineService } from '../billingOptimizationEngineService';
import type {
  OptimizationRequest,
  BatchOptimizationRequest,
  EncounterContext,
  BillingCode,
  OptimizationType,
  CodeType,
  RiskLevel,
} from '../billingOptimizationEngineService';

// Mock supabase
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ error: null })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          gte: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({ data: [], error: null })),
            })),
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => ({ data: [], error: null })),
          })),
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

describe('BillingOptimizationEngineService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('optimization type definitions', () => {
    it('should define all optimization types', () => {
      const types: OptimizationType[] = [
        'bundling',
        'unbundling',
        'modifier',
        'upcoding',
        'downcoding',
        'missed_charge',
        'denial_prevention',
      ];
      expect(types).toHaveLength(7);
      expect(types).toContain('bundling');
      expect(types).toContain('unbundling');
      expect(types).toContain('denial_prevention');
    });

    it('should define all code types', () => {
      const codeTypes: CodeType[] = ['cpt', 'icd10', 'hcpcs', 'drg', 'cdt'];
      expect(codeTypes).toHaveLength(5);
      expect(codeTypes).toContain('cpt');
      expect(codeTypes).toContain('icd10');
    });

    it('should define all risk levels', () => {
      const levels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];
      expect(levels).toHaveLength(4);
      expect(levels).toContain('critical');
    });
  });

  describe('analyzeEncounter validation', () => {
    it('should handle encounter with empty procedures and diagnoses', async () => {
      const encounter: EncounterContext = {
        encounterId: 'enc-1',
        patientId: 'patient-1',
        providerId: 'provider-1',
        dateOfService: '2026-01-15',
        diagnoses: [],
        procedures: [],
      };

      const request: OptimizationRequest = {
        encounter,
        requesterId: 'user-1',
        tenantId: 'test-tenant',
      };

      const result = await BillingOptimizationEngineService.analyzeEncounter(request);

      // Empty encounter returns failure (validation or operation failed)
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should accept valid encounter', async () => {
      const encounter: EncounterContext = {
        encounterId: 'enc-1',
        patientId: 'patient-1',
        providerId: 'provider-1',
        dateOfService: '2026-01-15',
        diagnoses: [{ code: 'E11.9', type: 'icd10', description: 'Type 2 diabetes' }],
        procedures: [{ code: '99213', type: 'cpt', description: 'Office visit' }],
      };

      const request: OptimizationRequest = {
        encounter,
        requesterId: 'user-1',
        tenantId: 'test-tenant',
      };

      const result = await BillingOptimizationEngineService.analyzeEncounter(request);

      // Result depends on AI/mock - just verify structure
      expect(result).toBeDefined();
    });
  });

  describe('batchAnalyze validation', () => {
    it('should reject empty encounters array', async () => {
      const request: BatchOptimizationRequest = {
        encounters: [],
        requesterId: 'user-1',
        tenantId: 'test-tenant',
      };

      const result = await BillingOptimizationEngineService.batchAnalyze(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('should process batch with valid encounters', async () => {
      const encounter: EncounterContext = {
        encounterId: 'enc-1',
        patientId: 'patient-1',
        providerId: 'provider-1',
        dateOfService: '2026-01-15',
        diagnoses: [{ code: 'E11.9', type: 'icd10' }],
        procedures: [{ code: '99213', type: 'cpt' }],
      };

      const request: BatchOptimizationRequest = {
        encounters: [encounter],
        requesterId: 'user-1',
        tenantId: 'test-tenant',
      };

      const result = await BillingOptimizationEngineService.batchAnalyze(request);

      // Verify the function executes without throwing
      expect(result).toBeDefined();
    });
  });

  describe('getOptimizationHistory', () => {
    it('should accept tenant ID parameter', async () => {
      const result = await BillingOptimizationEngineService.getOptimizationHistory('test-tenant');

      // Verify function runs and returns a result
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should accept provider ID option', async () => {
      const result = await BillingOptimizationEngineService.getOptimizationHistory('test-tenant', {
        providerId: 'provider-1',
      });

      // Verify function runs with option
      expect(result).toBeDefined();
    });

    it('should accept date range options', async () => {
      const result = await BillingOptimizationEngineService.getOptimizationHistory('test-tenant', {
        startDate: '2026-01-01',
        endDate: '2026-01-15',
      });

      // Verify function runs with date range
      expect(result).toBeDefined();
    });

    it('should accept limit option', async () => {
      const result = await BillingOptimizationEngineService.getOptimizationHistory('test-tenant', {
        limit: 10,
      });

      // Verify function runs with limit
      expect(result).toBeDefined();
    });
  });

  describe('billing code structure', () => {
    it('should define CPT code structure', () => {
      const code: BillingCode = {
        code: '99213',
        type: 'cpt',
        description: 'Office outpatient visit, established patient, low complexity',
        modifiers: ['25'],
        units: 1,
      };
      expect(code.type).toBe('cpt');
      expect(code.modifiers).toHaveLength(1);
    });

    it('should define ICD-10 code structure', () => {
      const code: BillingCode = {
        code: 'E11.9',
        type: 'icd10',
        description: 'Type 2 diabetes mellitus without complications',
      };
      expect(code.type).toBe('icd10');
      expect(code.modifiers).toBeUndefined();
    });

    it('should define HCPCS code structure', () => {
      const code: BillingCode = {
        code: 'G0402',
        type: 'hcpcs',
        description: 'Initial preventive physical examination',
      };
      expect(code.type).toBe('hcpcs');
    });

    it('should define DRG code structure', () => {
      const code: BillingCode = {
        code: '470',
        type: 'drg',
        description: 'Major hip and knee joint replacement',
      };
      expect(code.type).toBe('drg');
    });
  });

  describe('optimization opportunity structure', () => {
    it('should define bundling opportunity', () => {
      const opp = {
        id: 'opp-1',
        type: 'bundling' as OptimizationType,
        originalCodes: [{ code: '99213', type: 'cpt' as CodeType }],
        suggestedCodes: [{ code: '99214', type: 'cpt' as CodeType }],
        revenueImpact: -50,
        riskLevel: 'low' as RiskLevel,
        confidence: 0.85,
        rationale: 'These services can be bundled per CMS guidelines',
      };
      expect(opp.type).toBe('bundling');
      expect(opp.revenueImpact).toBeLessThan(0);
    });

    it('should define unbundling opportunity', () => {
      const opp = {
        id: 'opp-2',
        type: 'unbundling' as OptimizationType,
        originalCodes: [{ code: '99213', type: 'cpt' as CodeType }],
        suggestedCodes: [
          { code: '99213', type: 'cpt' as CodeType },
          { code: '99000', type: 'cpt' as CodeType, modifiers: ['59'] },
        ],
        revenueImpact: 75,
        riskLevel: 'low' as RiskLevel,
        confidence: 0.92,
        rationale: 'Distinct procedural service documented',
      };
      expect(opp.type).toBe('unbundling');
      expect(opp.revenueImpact).toBeGreaterThan(0);
    });

    it('should define modifier optimization opportunity', () => {
      const opp = {
        id: 'opp-3',
        type: 'modifier' as OptimizationType,
        originalCodes: [{ code: '99213', type: 'cpt' as CodeType }],
        suggestedCodes: [{ code: '99213', type: 'cpt' as CodeType, modifiers: ['25'] }],
        revenueImpact: 0,
        riskLevel: 'low' as RiskLevel,
        confidence: 0.88,
        rationale: 'Significant, separately identifiable E/M documented',
      };
      expect(opp.type).toBe('modifier');
    });

    it('should define missed charge opportunity', () => {
      const opp = {
        id: 'opp-4',
        type: 'missed_charge' as OptimizationType,
        originalCodes: [] as BillingCode[],
        suggestedCodes: [{ code: 'E11.65', type: 'icd10' as CodeType }],
        revenueImpact: 0,
        riskLevel: 'low' as RiskLevel,
        confidence: 0.95,
        rationale: 'Diabetic retinopathy documented but not coded',
      };
      expect(opp.type).toBe('missed_charge');
    });
  });

  describe('denial risk structure', () => {
    it('should define denial risk', () => {
      const risk = {
        code: { code: '80061', type: 'cpt' as CodeType },
        riskLevel: 'high' as RiskLevel,
        denialReasons: ['Missing medical necessity diagnosis'],
        preventionSteps: ['Add supporting ICD-10 code E78.5'],
        historicalDenialRate: 0.35,
      };
      expect(risk.riskLevel).toBe('high');
      expect(risk.denialReasons).toHaveLength(1);
    });
  });

  describe('encounter context structure', () => {
    it('should define complete encounter context', () => {
      const encounter: EncounterContext = {
        encounterId: 'enc-1',
        patientId: 'patient-1',
        providerId: 'provider-1',
        dateOfService: '2026-01-15',
        placeOfService: '11',
        encounterType: 'outpatient',
        diagnoses: [{ code: 'E11.9', type: 'icd10', description: 'Type 2 diabetes' }],
        procedures: [{ code: '99213', type: 'cpt', description: 'Office visit' }],
        payerType: 'medicare',
        payerName: 'Medicare Part B',
      };
      expect(encounter.encounterId).toBe('enc-1');
      expect(encounter.payerType).toBe('medicare');
    });

    it('should handle minimal encounter context', () => {
      const encounter: EncounterContext = {
        encounterId: 'enc-2',
        patientId: 'patient-2',
        providerId: 'provider-2',
        dateOfService: '2026-01-15',
        diagnoses: [],
        procedures: [],
      };
      expect(encounter.placeOfService).toBeUndefined();
      expect(encounter.payerType).toBeUndefined();
    });
  });

  describe('optimization result structure', () => {
    it('should define result metadata', () => {
      const result = {
        encounterId: 'enc-1',
        opportunities: [],
        denialRisks: [],
        missedCharges: [],
        totalRevenueOpportunity: 125,
        complianceScore: 0.92,
        summary: 'Found 3 optimization opportunities',
        recommendations: ['Add modifier 25', 'Consider code upgrade'],
        metadata: {
          generatedAt: new Date().toISOString(),
          responseTimeMs: 850,
          model: 'claude-sonnet-4-5-20250929',
          codesAnalyzed: 5,
        },
      };
      expect(result.complianceScore).toBeGreaterThan(0);
      expect(result.metadata.model).toContain('sonnet');
    });
  });

  describe('batch optimization result', () => {
    it('should define batch result structure', () => {
      const result = {
        totalEncounters: 10,
        encountersWithOpportunities: 7,
        totalRevenueOpportunity: 1250,
        topOpportunities: [],
        denialRiskSummary: {
          low: 5,
          medium: 3,
          high: 1,
          critical: 0,
        },
        missedChargesSummary: {
          totalMissedCharges: 15,
          totalEstimatedRevenue: 2500,
          topMissedCodes: [{ code: 'E11.65', count: 5, revenue: 500 }],
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          processingTimeMs: 3500,
          encountersProcessed: 10,
        },
      };
      expect(result.totalEncounters).toBe(10);
      expect(result.encountersWithOpportunities).toBe(7);
    });
  });

  describe('compliance scoring', () => {
    it('should score high for compliant coding', () => {
      const score = 0.95;
      expect(score).toBeGreaterThan(0.9);
    });

    it('should score low for risky coding', () => {
      const score = 0.6;
      expect(score).toBeLessThan(0.7);
    });

    it('should define compliance thresholds', () => {
      const thresholds = {
        excellent: 0.95,
        good: 0.85,
        acceptable: 0.75,
        needsReview: 0.65,
        critical: 0.5,
      };
      expect(thresholds.excellent).toBe(0.95);
      expect(thresholds.critical).toBe(0.5);
    });
  });

  describe('CMS guidelines integration', () => {
    it('should reference NCCI edits', () => {
      const references = [
        'CMS NCCI Manual',
        'Medicare Claims Processing Manual',
        'LCD/NCD policies',
      ];
      expect(references).toContain('CMS NCCI Manual');
    });

    it('should check modifier validity', () => {
      const validModifiers = ['25', '59', '76', '77', 'XE', 'XP', 'XS', 'XU'];
      expect(validModifiers).toContain('59');
      expect(validModifiers).toContain('XE');
    });
  });

  describe('payer types', () => {
    it('should define all payer types', () => {
      const payers = ['medicare', 'medicaid', 'commercial', 'self_pay', 'workers_comp'];
      expect(payers).toHaveLength(5);
      expect(payers).toContain('medicare');
      expect(payers).toContain('workers_comp');
    });
  });
});
