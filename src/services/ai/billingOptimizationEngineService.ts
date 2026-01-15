/**
 * Billing Optimization Engine Service
 *
 * Frontend service for AI-powered billing code optimization.
 * Advanced revenue cycle optimization including:
 * - Code bundling and unbundling analysis
 * - Modifier optimization
 * - Upcoding/downcoding risk detection
 * - Missed charge capture identification
 * - Denial prevention recommendations
 * - Revenue leakage analysis
 *
 * Uses Claude Sonnet 4.5 for complex clinical-to-billing reasoning.
 *
 * @module billingOptimizationEngineService
 * @skill #38 - Billing Optimization Engine
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base/ServiceResult';
import { auditLogger } from '../auditLogger';

// ============================================================================
// Types
// ============================================================================

export type CodeType = 'cpt' | 'icd10' | 'hcpcs' | 'drg' | 'cdt';
export type OptimizationType =
  | 'bundling'
  | 'unbundling'
  | 'modifier'
  | 'upcoding'
  | 'downcoding'
  | 'missed_charge'
  | 'denial_prevention';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type PayerType = 'medicare' | 'medicaid' | 'commercial' | 'self_pay' | 'workers_comp';

export interface BillingCode {
  code: string;
  type: CodeType;
  description?: string;
  units?: number;
  modifiers?: string[];
  chargeAmount?: number;
}

export interface EncounterContext {
  encounterId: string;
  patientId: string;
  providerId: string;
  dateOfService: string;
  placeOfService?: string;
  encounterType?: string;
  diagnoses: BillingCode[];
  procedures: BillingCode[];
  payerType?: PayerType;
  payerName?: string;
}

export interface OptimizationOpportunity {
  id: string;
  type: OptimizationType;
  originalCodes: BillingCode[];
  suggestedCodes: BillingCode[];
  revenueImpact: number;
  riskLevel: RiskLevel;
  confidence: number;
  rationale: string;
  clinicalJustification?: string;
  complianceNotes?: string;
  references?: string[];
}

export interface DenialRisk {
  code: BillingCode;
  riskLevel: RiskLevel;
  denialReasons: string[];
  preventionSteps: string[];
  historicalDenialRate?: number;
  payerSpecificNotes?: string;
}

export interface MissedCharge {
  suggestedCode: BillingCode;
  rationale: string;
  evidenceSource: string;
  estimatedRevenue: number;
  confidence: number;
}

export interface OptimizationRequest {
  encounter: EncounterContext;
  requesterId: string;
  tenantId?: string;
  optimizationTypes?: OptimizationType[];
  includeDocumentation?: boolean;
}

export interface OptimizationResult {
  encounterId: string;
  opportunities: OptimizationOpportunity[];
  denialRisks: DenialRisk[];
  missedCharges: MissedCharge[];
  totalRevenueOpportunity: number;
  complianceScore: number;
  summary: string;
  recommendations: string[];
  metadata: {
    generatedAt: string;
    responseTimeMs: number;
    model: string;
    codesAnalyzed: number;
  };
}

export interface BatchOptimizationRequest {
  encounters: EncounterContext[];
  requesterId: string;
  tenantId?: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

export interface BatchOptimizationResult {
  totalEncounters: number;
  encountersWithOpportunities: number;
  totalRevenueOpportunity: number;
  topOpportunities: OptimizationOpportunity[];
  denialRiskSummary: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  missedChargesSummary: {
    totalMissedCharges: number;
    totalEstimatedRevenue: number;
    topMissedCodes: Array<{ code: string; count: number; revenue: number }>;
  };
  metadata: {
    generatedAt: string;
    processingTimeMs: number;
    encountersProcessed: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

const COMMON_BUNDLING_PAIRS: Record<string, string[]> = {
  '99213': ['36415', '81003'], // Office visit often bundled with venipuncture, UA
  '99214': ['36415', '81003'],
  '99215': ['36415', '81003'],
  '43239': ['43235'], // EGD with biopsy includes diagnostic EGD
  '45380': ['45378'], // Colonoscopy with biopsy includes diagnostic colonoscopy
};

const HIGH_RISK_MODIFIERS: string[] = ['59', '25', '76', '77', 'XE', 'XS', 'XP', 'XU'];

const MODIFIER_DESCRIPTIONS: Record<string, string> = {
  '25': 'Significant, separately identifiable E/M service',
  '59': 'Distinct procedural service',
  '76': 'Repeat procedure by same physician',
  '77': 'Repeat procedure by different physician',
  'XE': 'Separate encounter',
  'XS': 'Separate structure',
  'XP': 'Separate practitioner',
  'XU': 'Unusual non-overlapping service',
};

// ============================================================================
// Helper Functions
// ============================================================================

function calculateComplianceScore(
  opportunities: OptimizationOpportunity[],
  denialRisks: DenialRisk[]
): number {
  let score = 100;

  // Deduct for high-risk opportunities
  opportunities.forEach((opp) => {
    if (opp.riskLevel === 'high') score -= 10;
    if (opp.riskLevel === 'critical') score -= 20;
  });

  // Deduct for denial risks
  denialRisks.forEach((risk) => {
    if (risk.riskLevel === 'high') score -= 5;
    if (risk.riskLevel === 'critical') score -= 15;
  });

  return Math.max(0, Math.min(100, score));
}

function detectBundlingOpportunities(
  procedures: BillingCode[]
): OptimizationOpportunity[] {
  const opportunities: OptimizationOpportunity[] = [];
  const procedureCodes = procedures.map((p) => p.code);

  for (const [primary, bundled] of Object.entries(COMMON_BUNDLING_PAIRS)) {
    if (procedureCodes.includes(primary)) {
      const bundledFound = bundled.filter((b) => procedureCodes.includes(b));
      if (bundledFound.length > 0) {
        opportunities.push({
          id: crypto.randomUUID(),
          type: 'bundling',
          originalCodes: procedures.filter((p) => [primary, ...bundledFound].includes(p.code)),
          suggestedCodes: procedures.filter((p) => p.code === primary),
          revenueImpact: 0, // Would be calculated from fee schedule
          riskLevel: 'medium',
          confidence: 0.85,
          rationale: `${bundledFound.join(', ')} are typically bundled with ${primary}. Verify if separately billable.`,
          complianceNotes: 'Review documentation to ensure services were distinct and separately identifiable.',
        });
      }
    }
  }

  return opportunities;
}

function analyzeModifierUsage(procedures: BillingCode[]): OptimizationOpportunity[] {
  const opportunities: OptimizationOpportunity[] = [];

  procedures.forEach((proc) => {
    if (proc.modifiers) {
      const highRiskMods = proc.modifiers.filter((m) => HIGH_RISK_MODIFIERS.includes(m));
      if (highRiskMods.length > 0) {
        opportunities.push({
          id: crypto.randomUUID(),
          type: 'modifier',
          originalCodes: [proc],
          suggestedCodes: [proc],
          revenueImpact: 0,
          riskLevel: 'medium',
          confidence: 0.75,
          rationale: `Code ${proc.code} uses high-scrutiny modifier(s): ${highRiskMods.join(', ')}. Ensure documentation supports usage.`,
          complianceNotes: highRiskMods
            .map((m) => `${m}: ${MODIFIER_DESCRIPTIONS[m] || 'Review modifier necessity'}`)
            .join('; '),
        });
      }
    }
  });

  return opportunities;
}

// ============================================================================
// Service
// ============================================================================

export const BillingOptimizationEngineService = {
  /**
   * Analyze a single encounter for billing optimization opportunities
   */
  async analyzeEncounter(
    request: OptimizationRequest
  ): Promise<ServiceResult<OptimizationResult>> {
    const startTime = Date.now();

    try {
      const { encounter, requesterId, tenantId, optimizationTypes, includeDocumentation } = request;

      if (!encounter || !requesterId) {
        return failure('VALIDATION_ERROR', 'Encounter and Requester ID are required');
      }

      // Local quick analysis for immediate feedback
      const localBundling = detectBundlingOpportunities(encounter.procedures);
      const localModifiers = analyzeModifierUsage(encounter.procedures);

      // Call edge function for comprehensive AI analysis
      const { data, error } = await supabase.functions.invoke('ai-billing-optimizer', {
        body: {
          encounter: {
            encounterId: encounter.encounterId,
            patientId: encounter.patientId,
            providerId: encounter.providerId,
            dateOfService: encounter.dateOfService,
            placeOfService: encounter.placeOfService,
            encounterType: encounter.encounterType,
            diagnoses: encounter.diagnoses,
            procedures: encounter.procedures,
            payerType: encounter.payerType,
            payerName: encounter.payerName,
          },
          optimizationTypes: optimizationTypes || [
            'bundling',
            'unbundling',
            'modifier',
            'missed_charge',
            'denial_prevention',
          ],
          includeDocumentation,
          tenantId,
        },
      });

      let opportunities: OptimizationOpportunity[] = [...localBundling, ...localModifiers];
      let denialRisks: DenialRisk[] = [];
      let missedCharges: MissedCharge[] = [];

      if (error) {
        await auditLogger.error(
          'BILLING_OPTIMIZER_EDGE_FUNCTION_ERROR',
          error instanceof Error ? error : new Error(String(error)),
          { encounterId: encounter.encounterId }
        );
        // Continue with local analysis only
      } else if (data) {
        // Merge AI analysis with local analysis
        const aiResult = data as Partial<OptimizationResult>;
        if (aiResult.opportunities) {
          opportunities = [...opportunities, ...aiResult.opportunities];
        }
        if (aiResult.denialRisks) {
          denialRisks = aiResult.denialRisks;
        }
        if (aiResult.missedCharges) {
          missedCharges = aiResult.missedCharges;
        }
      }

      // Deduplicate opportunities
      const uniqueOpportunities = opportunities.filter(
        (opp, index, self) =>
          index ===
          self.findIndex(
            (o) =>
              o.type === opp.type &&
              o.originalCodes.map((c) => c.code).join(',') ===
                opp.originalCodes.map((c) => c.code).join(',')
          )
      );

      const totalRevenueOpportunity = uniqueOpportunities.reduce(
        (sum, opp) => sum + opp.revenueImpact,
        0
      ) + missedCharges.reduce((sum, mc) => sum + mc.estimatedRevenue, 0);

      const complianceScore = calculateComplianceScore(uniqueOpportunities, denialRisks);

      const result: OptimizationResult = {
        encounterId: encounter.encounterId,
        opportunities: uniqueOpportunities,
        denialRisks,
        missedCharges,
        totalRevenueOpportunity,
        complianceScore,
        summary: generateSummary(uniqueOpportunities, denialRisks, missedCharges),
        recommendations: generateRecommendations(uniqueOpportunities, denialRisks),
        metadata: {
          generatedAt: new Date().toISOString(),
          responseTimeMs: Date.now() - startTime,
          model: error ? 'local-only' : 'claude-sonnet-4-5-20250929',
          codesAnalyzed: encounter.procedures.length + encounter.diagnoses.length,
        },
      };

      await auditLogger.info('BILLING_OPTIMIZATION_COMPLETE', {
        encounterId: encounter.encounterId,
        opportunitiesFound: uniqueOpportunities.length,
        totalRevenueOpportunity,
        complianceScore,
        responseTimeMs: result.metadata.responseTimeMs,
      });

      return success(result);
    } catch (err: unknown) {
      await auditLogger.error(
        'BILLING_OPTIMIZATION_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { encounterId: request.encounter.encounterId }
      );

      return failure('OPERATION_FAILED', 'Failed to analyze encounter for billing optimization');
    }
  },

  /**
   * Batch analyze multiple encounters
   */
  async batchAnalyze(
    request: BatchOptimizationRequest
  ): Promise<ServiceResult<BatchOptimizationResult>> {
    const startTime = Date.now();

    try {
      const { encounters, requesterId, tenantId } = request;

      if (!encounters || encounters.length === 0) {
        return failure('VALIDATION_ERROR', 'At least one encounter is required');
      }

      const allOpportunities: OptimizationOpportunity[] = [];
      const denialRiskCounts = { low: 0, medium: 0, high: 0, critical: 0 };
      const missedChargeMap = new Map<string, { count: number; revenue: number }>();
      let totalRevenue = 0;
      let encountersWithOpps = 0;

      // Process encounters in batches of 10
      const batchSize = 10;
      for (let i = 0; i < encounters.length; i += batchSize) {
        const batch = encounters.slice(i, i + batchSize);

        const results = await Promise.all(
          batch.map((encounter) =>
            this.analyzeEncounter({
              encounter,
              requesterId,
              tenantId,
            })
          )
        );

        results.forEach((result) => {
          if (result.success && result.data) {
            const data = result.data;
            if (data.opportunities.length > 0 || data.missedCharges.length > 0) {
              encountersWithOpps++;
            }
            allOpportunities.push(...data.opportunities);
            totalRevenue += data.totalRevenueOpportunity;

            data.denialRisks.forEach((risk) => {
              denialRiskCounts[risk.riskLevel]++;
            });

            data.missedCharges.forEach((mc) => {
              const existing = missedChargeMap.get(mc.suggestedCode.code) || {
                count: 0,
                revenue: 0,
              };
              missedChargeMap.set(mc.suggestedCode.code, {
                count: existing.count + 1,
                revenue: existing.revenue + mc.estimatedRevenue,
              });
            });
          }
        });
      }

      // Sort opportunities by revenue impact
      const topOpportunities = allOpportunities
        .sort((a, b) => b.revenueImpact - a.revenueImpact)
        .slice(0, 20);

      // Convert missed charges map to sorted array
      const topMissedCodes = Array.from(missedChargeMap.entries())
        .map(([code, data]) => ({ code, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      const result: BatchOptimizationResult = {
        totalEncounters: encounters.length,
        encountersWithOpportunities: encountersWithOpps,
        totalRevenueOpportunity: totalRevenue,
        topOpportunities,
        denialRiskSummary: denialRiskCounts,
        missedChargesSummary: {
          totalMissedCharges: Array.from(missedChargeMap.values()).reduce(
            (sum, v) => sum + v.count,
            0
          ),
          totalEstimatedRevenue: Array.from(missedChargeMap.values()).reduce(
            (sum, v) => sum + v.revenue,
            0
          ),
          topMissedCodes,
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          processingTimeMs: Date.now() - startTime,
          encountersProcessed: encounters.length,
        },
      };

      await auditLogger.info('BATCH_BILLING_OPTIMIZATION_COMPLETE', {
        totalEncounters: encounters.length,
        encountersWithOpportunities: encountersWithOpps,
        totalRevenueOpportunity: totalRevenue,
        processingTimeMs: result.metadata.processingTimeMs,
      });

      return success(result);
    } catch (err: unknown) {
      await auditLogger.error(
        'BATCH_BILLING_OPTIMIZATION_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { encounterCount: request.encounters.length }
      );

      return failure('OPERATION_FAILED', 'Failed to batch analyze encounters');
    }
  },

  /**
   * Get optimization history for a provider or tenant
   */
  async getOptimizationHistory(
    tenantId: string,
    options?: {
      providerId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    }
  ): Promise<
    ServiceResult<
      Array<{
        encounterId: string;
        analyzedAt: string;
        opportunitiesFound: number;
        revenueOpportunity: number;
        actionsImplemented: number;
      }>
    >
  > {
    try {
      let query = supabase
        .from('billing_optimization_history')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('analyzed_at', { ascending: false });

      if (options?.providerId) {
        query = query.eq('provider_id', options.providerId);
      }
      if (options?.startDate) {
        query = query.gte('analyzed_at', options.startDate);
      }
      if (options?.endDate) {
        query = query.lte('analyzed_at', options.endDate);
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const history = (data || []).map((row) => ({
        encounterId: row.encounter_id as string,
        analyzedAt: row.analyzed_at as string,
        opportunitiesFound: row.opportunities_found as number,
        revenueOpportunity: row.revenue_opportunity as number,
        actionsImplemented: row.actions_implemented as number,
      }));

      return success(history);
    } catch (err: unknown) {
      await auditLogger.error(
        'BILLING_OPTIMIZATION_HISTORY_ERROR',
        err instanceof Error ? err : new Error(String(err)),
        { tenantId }
      );

      return failure('DATABASE_ERROR', 'Failed to retrieve optimization history');
    }
  },
};

// ============================================================================
// Helper Functions for Results
// ============================================================================

function generateSummary(
  opportunities: OptimizationOpportunity[],
  denialRisks: DenialRisk[],
  missedCharges: MissedCharge[]
): string {
  const parts: string[] = [];

  if (opportunities.length > 0) {
    parts.push(`Found ${opportunities.length} optimization opportunit${opportunities.length === 1 ? 'y' : 'ies'}`);
  }

  if (denialRisks.length > 0) {
    const highRisk = denialRisks.filter((r) => r.riskLevel === 'high' || r.riskLevel === 'critical');
    if (highRisk.length > 0) {
      parts.push(`${highRisk.length} high-risk denial concern${highRisk.length === 1 ? '' : 's'}`);
    }
  }

  if (missedCharges.length > 0) {
    parts.push(`${missedCharges.length} potential missed charge${missedCharges.length === 1 ? '' : 's'}`);
  }

  if (parts.length === 0) {
    return 'No optimization opportunities identified. Coding appears compliant.';
  }

  return parts.join('. ') + '.';
}

function generateRecommendations(
  opportunities: OptimizationOpportunity[],
  denialRisks: DenialRisk[]
): string[] {
  const recommendations: string[] = [];

  // Priority recommendations based on risk level
  const criticalOpps = opportunities.filter((o) => o.riskLevel === 'critical');
  const highOpps = opportunities.filter((o) => o.riskLevel === 'high');

  if (criticalOpps.length > 0) {
    recommendations.push(
      'URGENT: Review critical-risk optimizations before claim submission'
    );
  }

  if (highOpps.length > 0) {
    recommendations.push('Review high-risk modifier usage for compliance');
  }

  const criticalDenials = denialRisks.filter((d) => d.riskLevel === 'critical');
  if (criticalDenials.length > 0) {
    recommendations.push(
      'Address critical denial risks to prevent claim rejection'
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('Continue current coding practices');
    recommendations.push('Monitor payer-specific denial patterns');
  }

  return recommendations;
}

export default BillingOptimizationEngineService;
