// =====================================================
// MCP DRG Grouper Server — Revenue Optimizer Handlers
// Standalone: flag_revenue_risk (AI) + validate_coding (rules)
//
// flag_revenue_risk: AI validates documentation vs acuity,
//   identifies missing codes, suggests revenue opportunities.
// validate_coding: Rule-based check for commonly missed
//   charges by category. No AI calls.
//
// Advisory only — never auto-files or auto-bills.
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.39.0?target=deno";
import type {
  MCPLogger,
  DailyChargeSnapshot,
  OptimizationSuggestion,
  ChargesByCategory
} from "./types.ts";
import { SONNET_MODEL, calculateModelCost } from "../_shared/models.ts";
import { withTimeout, MCP_TIMEOUT_CONFIG } from "../_shared/mcpQueryTimeout.ts";
import { buildConstraintBlock } from "../_shared/clinicalGroundingRules.ts";
import { buildSafeDocumentSection } from "../_shared/promptInjectionGuard.ts";
import { REVENUE_OPTIMIZATION_TOOL } from "./aiToolSchemas.ts";
import { validateClinicalOutput, logValidationResults } from "../_shared/clinicalOutputValidator.ts";
import type { CodingOutput } from "../_shared/clinicalOutputValidator.ts";

// -------------------------------------------------------
// Database row shapes (system boundary casts)
// -------------------------------------------------------
interface ClinicalNoteRow {
  id: string;
  type: string;
  content: string;
}

interface DiagnosisRow {
  code: string;
  sequence: number;
  description: string | null;
}

// -------------------------------------------------------
// AI structured response for revenue optimization
// -------------------------------------------------------
interface RevenueOptimizationResponse {
  documentation_assessment: {
    acuity_supported: boolean;
    current_acuity: string;
    documented_acuity: string;
    gaps: string[];
  };
  missing_codes: Array<{
    code: string;
    code_system: string;
    description: string;
    rationale: string;
    potential_impact: number;
    confidence: number;
  }>;
  upgrade_opportunities: Array<{
    current_code: string;
    suggested_code: string;
    description: string;
    rationale: string;
    weight_difference: number;
    revenue_impact: number;
    confidence: number;
  }>;
  documentation_gaps: Array<{
    gap_type: string;
    description: string;
    impact: string;
    suggested_action: string;
  }>;
  modifier_suggestions: Array<{
    code: string;
    suggested_modifier: string;
    description: string;
    rationale: string;
  }>;
  summary: string;
  total_potential_uplift: number;
  confidence: number;
  requires_clinical_review: boolean;
}

/** Completeness validation rules (no AI — pure rules) */
interface CompletenessRule {
  category: string;
  check: string;
  description: string;
  expectedMinimum: number;
  severity: 'warning' | 'alert';
  suggestedCode: string | null;
  estimatedImpact: number;
}

const COMPLETENESS_RULES: CompletenessRule[] = [
  { category: 'lab', check: 'has_admission_labs', description: 'Admission labs (CBC, CMP, UA) expected on Day 1', expectedMinimum: 3, severity: 'alert', suggestedCode: '80053', estimatedImpact: 150 },
  { category: 'lab', check: 'has_daily_labs', description: 'Daily labs expected for ICU/step-down patients', expectedMinimum: 1, severity: 'warning', suggestedCode: '85025', estimatedImpact: 50 },
  { category: 'pharmacy', check: 'has_pharmacy_charges', description: 'Medication administration charges expected for inpatients', expectedMinimum: 1, severity: 'warning', suggestedCode: null, estimatedImpact: 75 },
  { category: 'nursing', check: 'has_nursing_assessment', description: 'Nursing assessment/vital signs expected daily', expectedMinimum: 1, severity: 'alert', suggestedCode: '99211', estimatedImpact: 45 },
  { category: 'evaluation', check: 'has_em_code', description: 'E/M service code expected for provider encounters', expectedMinimum: 1, severity: 'alert', suggestedCode: '99232', estimatedImpact: 200 },
  { category: 'procedure', check: 'has_iv_charges', description: 'IV administration charges commonly missed', expectedMinimum: 0, severity: 'warning', suggestedCode: '96360', estimatedImpact: 125 },
  { category: 'imaging', check: 'has_chest_xray_day1', description: 'Chest X-ray expected on admission day for most inpatients', expectedMinimum: 0, severity: 'warning', suggestedCode: '71046', estimatedImpact: 100 }
];

// -------------------------------------------------------
// Revenue optimization prompt builder
// -------------------------------------------------------
function buildOptimizationPrompt(
  snapshot: DailyChargeSnapshot,
  notes: ClinicalNoteRow[],
  diagnoses: DiagnosisRow[]
): string {
  const chargeCategories = snapshot.charges as ChargesByCategory;
  const chargeSummary = Object.entries(chargeCategories)
    .map(([cat, entries]) => {
      const items = entries as Array<{ code: string; description: string; charge_amount: number }>;
      if (items.length === 0) return `  ${cat}: (none)`;
      return `  ${cat} (${items.length} charges):\n` +
        items.map(e => `    - ${e.code}: ${e.description} ($${e.charge_amount})`).join('\n');
    })
    .join('\n');

  const diagSummary = diagnoses.length > 0
    ? diagnoses.map(d => `  ${d.sequence}. ${d.code} — ${d.description || ''}`).join('\n')
    : '  (none on record)';

  const noteSummary = notes.length > 0
    ? notes.map(n => {
        const content = n.content.length > 1500
          ? n.content.substring(0, 1500) + '... [truncated]'
          : n.content;
        return `  [${n.type.toUpperCase()}]: ${content}`;
      }).join('\n\n')
    : '  (no clinical notes for this date)';

  const safeNotes = buildSafeDocumentSection(noteSummary, 'Clinical Documentation');

  return `You are a certified inpatient revenue cycle specialist reviewing a daily charge snapshot for completeness and optimization opportunities.

ENCOUNTER CONTEXT:
  Day of stay: ${snapshot.day_number}
  Service date: ${snapshot.service_date}
  Total charges: $${snapshot.total_charge_amount}
  Charge count: ${snapshot.charge_count}

CURRENT CHARGES BY CATEGORY:
${chargeSummary}

DIAGNOSES ON RECORD:
${diagSummary}

CLINICAL DOCUMENTATION:
${safeNotes.text}

TASK: Review the charges against the clinical documentation and identify:
1. Missing charges that documentation supports but are not captured
2. Code upgrade opportunities (higher-specificity codes supported by documentation)
3. Documentation gaps where better documentation could support higher reimbursement
4. Modifier suggestions for existing charges

COMPLIANCE RULES:
- Only suggest codes supported by clinical documentation
- Never suggest upcoding without documentation support
- All suggestions are advisory — require human review
- Flag any charge that seems unsupported by documentation

Use the submit_revenue_analysis tool to return your structured result.

${buildConstraintBlock(['drg', 'billing'])}`;
}

// -------------------------------------------------------
// Exported handler factory
// -------------------------------------------------------
export function createRevenueOptimizerHandlers(
  sb: SupabaseClient,
  logger: MCPLogger
) {
  const timeoutMs = MCP_TIMEOUT_CONFIG?.standard ?? 15_000;

  // =======================================================
  // flag_revenue_risk — AI-powered revenue risk identification
  // =======================================================
  async function handleFlagRevenueRisk(args: Record<string, unknown>) {
    const encounterId = args.encounter_id as string;
    const serviceDate = args.service_date as string;
    const tenantId = args.tenant_id as string | undefined;

    // 1. Get the daily charge snapshot
    let snapshotQuery = sb.from('daily_charge_snapshots')
      .select('*')
      .eq('encounter_id', encounterId)
      .eq('service_date', serviceDate);

    if (tenantId) {
      snapshotQuery = snapshotQuery.eq('tenant_id', tenantId);
    }

    const { data: snapshotData, error: snapErr } = await withTimeout(
      snapshotQuery.single(),
      timeoutMs,
      'Snapshot lookup for revenue risk'
    );

    if (snapErr || !snapshotData) {
      return {
        error: `No daily charge snapshot found for encounter ${encounterId} on ${serviceDate}. Run charge aggregation first.`,
        optimization: null
      };
    }

    const snapshot = snapshotData as DailyChargeSnapshot;

    // 2. Get clinical notes
    const { data: noteData } = await withTimeout(
      sb.from('clinical_notes')
        .select('id, type, content')
        .eq('encounter_id', encounterId)
        .order('created_at', { ascending: false })
        .limit(10),
      timeoutMs,
      'Clinical notes for revenue risk'
    );

    const notes = (noteData || []) as ClinicalNoteRow[];

    // 3. Get diagnoses
    const { data: diagData } = await withTimeout(
      sb.from('encounter_diagnoses')
        .select('code, sequence, description')
        .eq('encounter_id', encounterId)
        .order('sequence', { ascending: true }),
      timeoutMs,
      'Diagnoses for revenue risk'
    );

    const diagnoses = (diagData || []) as DiagnosisRow[];

    // 4. Call Claude for optimization analysis
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLAUDE_API_KEY");
    if (!apiKey) {
      return { error: 'AI service not configured (ANTHROPIC_API_KEY missing)', optimization: null };
    }

    const anthropic = new Anthropic({ apiKey });
    const prompt = buildOptimizationPrompt(snapshot, notes, diagnoses);
    const startTime = Date.now();

    logger.info('REVENUE_RISK_AI_START', {
      encounterId, serviceDate, chargeCount: snapshot.charge_count, model: SONNET_MODEL
    });

    const aiResponse = await anthropic.messages.create({
      model: SONNET_MODEL,
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
      tools: [REVENUE_OPTIMIZATION_TOOL],
      tool_choice: { type: "tool", name: "submit_revenue_analysis" }
    });

    const responseTimeMs = Date.now() - startTime;

    // 5. Extract structured response
    const toolBlock = aiResponse.content.find(
      (block: { type: string }) => block.type === "tool_use"
    ) as { type: "tool_use"; input: unknown } | undefined;

    let analysis: RevenueOptimizationResponse;
    if (toolBlock) {
      analysis = toolBlock.input as unknown as RevenueOptimizationResponse;
    } else {
      const textBlock = aiResponse.content.find(
        (block: { type: string }) => block.type === "text"
      ) as { type: "text"; text: string } | undefined;
      const responseText = textBlock?.text ?? "";
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found in AI response");
        analysis = JSON.parse(jsonMatch[0]) as RevenueOptimizationResponse;
      } catch (parseErr: unknown) {
        const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
        logger.error('REVENUE_RISK_PARSE_FAILED', { encounterId, error: error.message });
        return { error: 'Failed to parse revenue risk AI response', optimization: null };
      }
    }

    // 6. Convert to OptimizationSuggestion format
    const suggestions: OptimizationSuggestion[] = [
      ...analysis.missing_codes.map(mc => ({
        type: 'missing_charge' as const,
        description: `${mc.description} — ${mc.rationale}`,
        potential_impact_amount: mc.potential_impact,
        suggested_code: mc.code,
        confidence: mc.confidence
      })),
      ...analysis.upgrade_opportunities.map(uo => ({
        type: 'upgrade_opportunity' as const,
        description: `${uo.current_code} → ${uo.suggested_code}: ${uo.description}`,
        potential_impact_amount: uo.revenue_impact,
        suggested_code: uo.suggested_code,
        confidence: uo.confidence
      })),
      ...analysis.documentation_gaps.map(dg => ({
        type: 'documentation_gap' as const,
        description: `${dg.gap_type}: ${dg.description}. Action: ${dg.suggested_action}`,
        potential_impact_amount: null,
        suggested_code: null,
        confidence: 0.7
      })),
      ...analysis.modifier_suggestions.map(ms => ({
        type: 'modifier_suggestion' as const,
        description: `Add modifier ${ms.suggested_modifier} to ${ms.code}: ${ms.description}`,
        potential_impact_amount: null,
        suggested_code: `${ms.code}-${ms.suggested_modifier}`,
        confidence: 0.8
      }))
    ];

    // 6b. Clinical Validation Hook
    const suggestedCodes = [
      ...analysis.missing_codes
        .filter(mc => mc.code_system === 'CPT' || mc.code_system === 'cpt')
        .map(mc => ({ code: mc.code, rationale: mc.description })),
      ...analysis.upgrade_opportunities
        .map(uo => ({ code: uo.suggested_code, rationale: uo.description })),
    ];

    let codeValidation: Record<string, unknown> | undefined;
    if (suggestedCodes.length > 0) {
      const codingOutput: CodingOutput = { cpt: suggestedCodes };
      const validationResult = await validateClinicalOutput(codingOutput, {
        source: "mcp-drg-grouper-revenue-risk",
        sb,
        patientId: snapshot.patient_id,
      });
      logValidationResults(validationResult, sb, tenantId, 0).catch(() => {});

      if (validationResult.rejectedCodes.length > 0) {
        codeValidation = {
          _validationSummary: validationResult.flaggedOutput?._validationSummary ?? null,
          _rejectedCodes: validationResult.rejectedCodes,
        };
      }
    }

    // 7. Update snapshot with suggestions
    await withTimeout(
      sb.from('daily_charge_snapshots')
        .update({
          optimization_suggestions: suggestions,
          documentation_gaps: analysis.documentation_gaps,
          ai_model_used: SONNET_MODEL,
          updated_at: new Date().toISOString()
        })
        .eq('id', snapshot.id),
      timeoutMs,
      'Update snapshot with revenue risk'
    );

    // 8. Log AI usage
    const inputTokens = aiResponse.usage?.input_tokens ?? 0;
    const outputTokens = aiResponse.usage?.output_tokens ?? 0;

    await sb.from('claude_usage_logs').insert({
      user_id: snapshot.patient_id,
      request_id: crypto.randomUUID(),
      model: SONNET_MODEL,
      request_type: 'revenue_risk_analysis',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost: calculateModelCost(SONNET_MODEL, inputTokens, outputTokens),
      response_time_ms: responseTimeMs,
      success: true,
      metadata: {
        encounter_id: encounterId,
        service_date: serviceDate,
        suggestion_count: suggestions.length,
        potential_uplift: analysis.total_potential_uplift
      }
    }).then(() => {}).catch(() => {});

    logger.info('REVENUE_RISK_COMPLETE', {
      encounterId, serviceDate,
      suggestionCount: suggestions.length,
      potentialUplift: analysis.total_potential_uplift,
      responseTimeMs
    });

    return {
      optimization: {
        encounter_id: encounterId,
        service_date: serviceDate,
        documentation_assessment: analysis.documentation_assessment,
        suggestions,
        summary: analysis.summary,
        total_potential_uplift: analysis.total_potential_uplift,
        confidence: analysis.confidence,
        requires_clinical_review: analysis.requires_clinical_review
      },
      ai_metadata: {
        model: SONNET_MODEL,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        response_time_ms: responseTimeMs
      },
      ...(codeValidation ? { code_validation: codeValidation } : {}),
      advisory: 'All revenue risk suggestions are advisory only. Require clinical review and confirmation before billing.'
    };
  }

  // =======================================================
  // validate_coding — Rule-based charge completeness (no AI)
  // =======================================================
  async function handleValidateCoding(args: Record<string, unknown>) {
    const encounterId = args.encounter_id as string;
    const serviceDate = args.service_date as string;
    const tenantId = args.tenant_id as string | undefined;

    let snapshotQuery = sb.from('daily_charge_snapshots')
      .select('*')
      .eq('encounter_id', encounterId)
      .eq('service_date', serviceDate);

    if (tenantId) {
      snapshotQuery = snapshotQuery.eq('tenant_id', tenantId);
    }

    const { data: snapshotData, error: snapErr } = await withTimeout(
      snapshotQuery.single(),
      timeoutMs,
      'Snapshot lookup for validation'
    );

    if (snapErr || !snapshotData) {
      return {
        error: `No daily charge snapshot found for encounter ${encounterId} on ${serviceDate}. Run charge aggregation first.`,
        validation: null
      };
    }

    const snapshot = snapshotData as DailyChargeSnapshot;
    const charges = snapshot.charges as ChargesByCategory;

    // Run completeness rules
    const alerts: Array<{
      rule: string;
      category: string;
      severity: string;
      description: string;
      current_count: number;
      expected_minimum: number;
      suggested_code: string | null;
      estimated_impact: number;
    }> = [];

    let totalMissingImpact = 0;

    for (const rule of COMPLETENESS_RULES) {
      const categoryKey = rule.category as keyof ChargesByCategory;
      const categoryCharges = charges[categoryKey] || [];
      const currentCount = categoryCharges.length;

      if (rule.check === 'has_admission_labs' && snapshot.day_number !== 1) continue;
      if (rule.check === 'has_chest_xray_day1' && snapshot.day_number !== 1) continue;

      if (currentCount < rule.expectedMinimum ||
          (rule.expectedMinimum === 0 && currentCount === 0 && snapshot.day_number === 1)) {
        if (rule.expectedMinimum === 0 && snapshot.day_number !== 1) continue;

        alerts.push({
          rule: rule.check,
          category: rule.category,
          severity: rule.severity,
          description: rule.description,
          current_count: currentCount,
          expected_minimum: rule.expectedMinimum,
          suggested_code: rule.suggestedCode,
          estimated_impact: rule.estimatedImpact
        });
        totalMissingImpact += rule.estimatedImpact;
      }
    }

    // Check for charge-to-diagnosis alignment
    if (snapshot.charge_count > 0 && !snapshot.projected_drg_code) {
      alerts.push({
        rule: 'has_diagnosis_alignment',
        category: 'evaluation',
        severity: 'alert',
        description: 'Charges exist but no DRG grouping has been performed. Run run_drg_grouper to optimize revenue.',
        current_count: 0,
        expected_minimum: 1,
        suggested_code: null,
        estimated_impact: 0
      });
    }

    // Update snapshot with alerts
    await withTimeout(
      sb.from('daily_charge_snapshots')
        .update({
          missing_charge_alerts: alerts,
          updated_at: new Date().toISOString()
        })
        .eq('id', snapshot.id),
      timeoutMs,
      'Update snapshot with validation alerts'
    );

    logger.info('CODING_VALIDATION_COMPLETE', {
      encounterId, serviceDate,
      dayNumber: snapshot.day_number,
      chargeCount: snapshot.charge_count,
      alertCount: alerts.length,
      totalMissingImpact
    });

    return {
      validation: {
        encounter_id: encounterId,
        service_date: serviceDate,
        day_number: snapshot.day_number,
        charge_count: snapshot.charge_count,
        total_charge_amount: snapshot.total_charge_amount,
        alerts,
        alert_count: alerts.length,
        total_missing_impact: totalMissingImpact,
        categories_checked: COMPLETENESS_RULES.map(r => r.category)
          .filter((v, i, a) => a.indexOf(v) === i),
        pass: alerts.length === 0
      },
      advisory: 'Charge validation is advisory. Missing charges should be verified against clinical documentation before adding.'
    };
  }

  return {
    handleFlagRevenueRisk,
    handleValidateCoding
  };
}
