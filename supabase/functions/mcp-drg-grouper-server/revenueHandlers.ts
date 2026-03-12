// =====================================================
// MCP DRG Grouper Server — Revenue Handlers
// Standalone: estimate_reimbursement + get_payer_rules
//
// These tools calculate expected reimbursement from DRG
// results using payer rules (base rate × weight × wage index).
// No AI calls — pure database lookups and math.
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { MCPLogger, PayerRule, RevenueProjection } from "./types.ts";
import { withTimeout, MCP_TIMEOUT_CONFIG } from "../_shared/mcpQueryTimeout.ts";

export function createRevenueHandlers(
  sb: SupabaseClient,
  logger: MCPLogger
) {
  const timeoutMs = MCP_TIMEOUT_CONFIG?.standard ?? 15_000;

  // =======================================================
  // estimate_reimbursement — DRG weight × base rate × wage index
  // =======================================================
  async function handleEstimateReimbursement(args: Record<string, unknown>) {
    const payerType = args.payer_type as string;
    const fiscalYear = (args.fiscal_year as number) || new Date().getFullYear();
    const stateCode = args.state_code as string | undefined;
    const wageIndexOverride = args.wage_index_override as number | undefined;

    let drgCode = args.drg_code as string | undefined;
    let drgWeight = args.drg_weight as number | undefined;

    // If encounter_id provided, look up DRG result
    if (args.encounter_id && (!drgCode || !drgWeight)) {
      const { data: drgResult } = await withTimeout(
        sb.from('drg_grouping_results')
          .select('drg_code, drg_weight, optimal_drg_code, mcc_drg_weight, cc_drg_weight')
          .eq('encounter_id', args.encounter_id as string)
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
        timeoutMs,
        'DRG result lookup for reimbursement'
      );

      if (drgResult) {
        const typed = drgResult as Record<string, unknown>;
        drgCode = (typed.optimal_drg_code as string) || (typed.drg_code as string);
        drgWeight = typed.drg_weight as number;
      }
    }

    if (!drgWeight) {
      return {
        error: 'No DRG weight available. Provide drg_weight directly or ensure a DRG grouping result exists for the encounter.',
        projection: null
      };
    }

    // Look up payer rules
    let ruleQuery = sb.from('payer_rules')
      .select('*')
      .eq('payer_type', payerType)
      .eq('fiscal_year', fiscalYear)
      .eq('is_active', true);

    if (args.tenant_id) {
      ruleQuery = ruleQuery.eq('tenant_id', args.tenant_id as string);
    }
    if (stateCode) {
      ruleQuery = ruleQuery.eq('state_code', stateCode);
    }

    const { data: ruleRows, error: ruleError } = await withTimeout(
      ruleQuery.limit(1).single(),
      timeoutMs,
      'Payer rule lookup for reimbursement'
    );

    if (ruleError || !ruleRows) {
      return {
        error: `No payer rules found for ${payerType} FY${fiscalYear}${stateCode ? ` ${stateCode}` : ''}`,
        projection: null
      };
    }

    const rule = ruleRows as PayerRule;
    const adjustments: string[] = [];

    // DRG-based (Medicare)
    if (rule.rule_type === 'drg_based' && rule.base_rate_amount) {
      const wageIndex = wageIndexOverride ?? rule.wage_index_factor;
      const operatingPayment = rule.base_rate_amount * drgWeight * wageIndex;
      const capitalPayment = (rule.capital_rate_amount ?? 0) * drgWeight;
      const totalEstimated = operatingPayment + capitalPayment;

      if (wageIndexOverride) {
        adjustments.push(`Wage index override: ${wageIndexOverride}`);
      }
      if (rule.cost_of_living_adjustment !== 1.0) {
        adjustments.push(`COLA: ${rule.cost_of_living_adjustment}`);
      }

      const projection: RevenueProjection = {
        drg_code: drgCode || 'unknown',
        drg_weight: drgWeight,
        base_rate: rule.base_rate_amount,
        wage_index: wageIndex,
        capital_rate: rule.capital_rate_amount ?? 0,
        operating_payment: Math.round(operatingPayment * 100) / 100,
        capital_payment: Math.round(capitalPayment * 100) / 100,
        total_estimated: Math.round(totalEstimated * 100) / 100,
        payer_type: payerType as RevenueProjection['payer_type'],
        adjustments_applied: adjustments
      };

      logger.info('REIMBURSEMENT_ESTIMATED', {
        drgCode, drgWeight,
        totalEstimated: projection.total_estimated,
        payerType
      });

      return {
        projection,
        advisory: 'Reimbursement estimate is advisory. Actual payment depends on payer contract terms, outlier adjustments, and claim adjudication.'
      };
    }

    // Per diem (Medicaid)
    if (rule.rule_type === 'per_diem' && rule.per_diem_rate) {
      const allowable = (rule.allowable_percentage ?? 100) / 100;
      const dailyReimbursement = rule.per_diem_rate * allowable;

      logger.info('REIMBURSEMENT_PER_DIEM', {
        acuityTier: rule.acuity_tier,
        dailyReimbursement,
        payerType
      });

      return {
        projection: {
          acuity_tier: rule.acuity_tier,
          per_diem_rate: rule.per_diem_rate,
          allowable_percentage: rule.allowable_percentage,
          daily_reimbursement: Math.round(dailyReimbursement * 100) / 100,
          max_days: rule.max_days,
          payer_type: payerType,
          carve_out_codes: rule.carve_out_codes,
          adjustments_applied: adjustments
        },
        advisory: 'Per diem reimbursement estimate is advisory. Subject to spell-of-illness limits and carve-out adjustments.'
      };
    }

    return {
      error: `Rule type '${rule.rule_type}' projection not yet supported`,
      projection: null
    };
  }

  // =======================================================
  // get_payer_rules — Read-only payer rate lookup
  // =======================================================
  async function handleGetPayerRules(args: Record<string, unknown>) {
    const payerType = args.payer_type as string;
    const fiscalYear = args.fiscal_year as number;
    const stateCode = args.state_code as string | undefined;
    const ruleType = args.rule_type as string | undefined;
    const isActive = args.is_active !== false;

    let query = sb.from('payer_rules')
      .select('*')
      .eq('payer_type', payerType)
      .eq('fiscal_year', fiscalYear);

    if (args.tenant_id) {
      query = query.eq('tenant_id', args.tenant_id as string);
    }
    if (stateCode) {
      query = query.eq('state_code', stateCode);
    }
    if (ruleType) {
      query = query.eq('rule_type', ruleType);
    }
    if (isActive) {
      query = query.eq('is_active', true);
    }

    query = query.order('acuity_tier', { ascending: true });

    const { data, error } = await withTimeout(query, timeoutMs, 'Payer rules lookup');

    if (error) {
      logger.error('PAYER_RULES_QUERY_FAILED', { payerType, fiscalYear, error: String(error) });
      throw error;
    }

    const rules = (data || []) as PayerRule[];

    logger.info('PAYER_RULES_RETRIEVED', {
      payerType, fiscalYear,
      stateCode: stateCode ?? 'federal',
      ruleCount: rules.length
    });

    return {
      rules,
      count: rules.length,
      query: { payer_type: payerType, fiscal_year: fiscalYear, state_code: stateCode ?? null }
    };
  }

  return {
    handleEstimateReimbursement,
    handleGetPayerRules
  };
}
