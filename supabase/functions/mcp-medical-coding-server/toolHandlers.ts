// =====================================================
// MCP Medical Coding Server — Tool Handlers
// Chain 6: Medical Coding Processor
//
// Session 1: Payer Rules Engine (6a) + Revenue Projection
// Session 2: Charge Aggregation (6b) + DRG Grouper (6c)
// Session 3: Revenue Optimizer (6d) + Charge Validation
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { MCPLogger, PayerRule, RevenueProjection } from "./types.ts";
import { withTimeout, MCP_TIMEOUT_CONFIG } from "../_shared/mcpQueryTimeout.ts";
import { createChargeAggregationHandlers } from "./chargeAggregationHandlers.ts";
import { createDRGGrouperHandlers } from "./drgGrouperHandlers.ts";
import { createRevenueOptimizerHandlers } from "./revenueOptimizerHandlers.ts";

export function createToolHandlers(sb: SupabaseClient, logger: MCPLogger) {
  // Session 2 handler modules
  const chargeHandlers = createChargeAggregationHandlers(sb, logger);
  const drgHandlers = createDRGGrouperHandlers(sb, logger);
  // Session 3 handler module
  const revenueHandlers = createRevenueOptimizerHandlers(sb, logger);

  // =======================================================
  // get_payer_rules — Look up payer rules by type/state/FY
  // =======================================================
  async function handleGetPayerRules(args: Record<string, unknown>) {
    const payerType = args.payer_type as string;
    const fiscalYear = args.fiscal_year as number;
    const stateCode = args.state_code as string | undefined;
    const ruleType = args.rule_type as string | undefined;
    const acuityTier = args.acuity_tier as string | undefined;
    const isActive = args.is_active !== false; // default true

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
    if (acuityTier) {
      query = query.eq('acuity_tier', acuityTier);
    }
    if (isActive) {
      query = query.eq('is_active', true);
    }

    query = query.order('acuity_tier', { ascending: true });

    const timeoutMs = MCP_TIMEOUT_CONFIG?.standard ?? 15_000;
    const { data, error } = await withTimeout(query, timeoutMs, 'Payer rules lookup');

    if (error) {
      logger.error('PAYER_RULES_QUERY_FAILED', { payerType, fiscalYear, error: String(error) });
      throw error;
    }

    const rules = (data || []) as PayerRule[];

    logger.info('PAYER_RULES_RETRIEVED', {
      payerType,
      fiscalYear,
      stateCode: stateCode ?? 'federal',
      ruleCount: rules.length
    });

    return {
      rules,
      count: rules.length,
      query: { payer_type: payerType, fiscal_year: fiscalYear, state_code: stateCode ?? null }
    };
  }

  // =======================================================
  // upsert_payer_rule — Create or update a payer rule
  // =======================================================
  async function handleUpsertPayerRule(args: Record<string, unknown>) {
    const now = new Date().toISOString();

    const ruleData = {
      tenant_id: args.tenant_id as string,
      payer_type: args.payer_type as string,
      state_code: (args.state_code as string) || null,
      fiscal_year: args.fiscal_year as number,
      rule_type: args.rule_type as string,
      acuity_tier: (args.acuity_tier as string) || null,
      base_rate_amount: (args.base_rate_amount as number) ?? null,
      capital_rate_amount: (args.capital_rate_amount as number) ?? null,
      wage_index_factor: (args.wage_index_factor as number) ?? 1.0,
      per_diem_rate: (args.per_diem_rate as number) ?? null,
      allowable_percentage: (args.allowable_percentage as number) ?? null,
      max_days: (args.max_days as number) ?? null,
      outlier_threshold: (args.outlier_threshold as number) ?? null,
      carve_out_codes: args.carve_out_codes ?? [],
      rule_description: (args.rule_description as string) ?? null,
      source_reference: (args.source_reference as string) ?? null,
      effective_date: args.effective_date as string,
      expiration_date: (args.expiration_date as string) ?? null,
      is_active: true,
      updated_at: now
    };

    const timeoutMs = MCP_TIMEOUT_CONFIG?.standard ?? 15_000;
    const { data, error } = await withTimeout(
      sb.from('payer_rules')
        .upsert(ruleData, {
          onConflict: 'tenant_id,payer_type,state_code,fiscal_year,rule_type,acuity_tier'
        })
        .select()
        .single(),
      timeoutMs,
      'Payer rule upsert'
    );

    if (error) {
      logger.error('PAYER_RULE_UPSERT_FAILED', {
        payerType: args.payer_type,
        fiscalYear: args.fiscal_year,
        error: String(error)
      });
      throw error;
    }

    const rule = data as PayerRule;

    logger.info('PAYER_RULE_UPSERTED', {
      ruleId: rule.id,
      payerType: rule.payer_type,
      fiscalYear: rule.fiscal_year,
      ruleType: rule.rule_type,
      acuityTier: rule.acuity_tier
    });

    return {
      rule,
      message: 'Payer rule saved successfully'
    };
  }

  // =======================================================
  // get_revenue_projection — Calculate expected reimbursement
  // DRG weight × base rate × wage index = operating payment
  // DRG weight × capital rate = capital payment
  // =======================================================
  async function handleGetRevenueProjection(args: Record<string, unknown>) {
    const payerType = args.payer_type as string;
    const fiscalYear = (args.fiscal_year as number) || new Date().getFullYear();
    const stateCode = args.state_code as string | undefined;
    const wageIndexOverride = args.wage_index_override as number | undefined;

    let drgCode = args.drg_code as string | undefined;
    let drgWeight = args.drg_weight as number | undefined;

    // If encounter_id provided, look up DRG result
    if (args.encounter_id && (!drgCode || !drgWeight)) {
      const timeoutMs = MCP_TIMEOUT_CONFIG?.standard ?? 15_000;
      const { data: drgResult } = await withTimeout(
        sb.from('drg_grouping_results')
          .select('drg_code, drg_weight, optimal_drg_code, mcc_drg_weight, cc_drg_weight')
          .eq('encounter_id', args.encounter_id as string)
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
        timeoutMs,
        'DRG result lookup'
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

    const timeoutMs = MCP_TIMEOUT_CONFIG?.standard ?? 15_000;
    const { data: ruleRows, error: ruleError } = await withTimeout(
      ruleQuery.limit(1).single(),
      timeoutMs,
      'Payer rule lookup for projection'
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

      logger.info('REVENUE_PROJECTION_CALCULATED', {
        drgCode,
        drgWeight,
        totalEstimated: projection.total_estimated,
        payerType
      });

      return { projection };
    }

    // Per diem (Medicaid)
    if (rule.rule_type === 'per_diem' && rule.per_diem_rate) {
      const allowable = (rule.allowable_percentage ?? 100) / 100;
      const dailyReimbursement = rule.per_diem_rate * allowable;

      logger.info('REVENUE_PROJECTION_PER_DIEM', {
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
        }
      };
    }

    return {
      error: `Rule type '${rule.rule_type}' projection not yet supported`,
      projection: null
    };
  }

  // =======================================================
  // Dispatcher — routes tool name to handler
  // =======================================================
  async function handleToolCall(toolName: string, args: Record<string, unknown>) {
    switch (toolName) {
      case 'get_payer_rules':
        return handleGetPayerRules(args);
      case 'upsert_payer_rule':
        return handleUpsertPayerRule(args);
      case 'get_revenue_projection':
        return handleGetRevenueProjection(args);

      // Session 2 tools (charge aggregation + DRG grouper)
      case 'aggregate_daily_charges':
        return chargeHandlers.handleAggregateDailyCharges(args);
      case 'get_daily_snapshot':
        return chargeHandlers.handleGetDailySnapshot(args);
      case 'save_daily_snapshot':
        return chargeHandlers.handleSaveDailySnapshot(args);
      case 'run_drg_grouper':
        return drgHandlers.handleRunDRGGrouper(args);
      case 'get_drg_result':
        return drgHandlers.handleGetDRGResult(args);

      // Session 3 tools (revenue optimization)
      case 'optimize_daily_revenue':
        return revenueHandlers.handleOptimizeDailyRevenue(args);
      case 'validate_charge_completeness':
        return revenueHandlers.handleValidateChargeCompleteness(args);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  return { handleToolCall };
}
