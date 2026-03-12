// =====================================================
// MCP Medical Coding Server — DRG Grouper Handlers
// Chain 6c: AI-Powered MS-DRG Assignment
//
// 3-Pass DRG Grouping:
//   Pass 1: Base DRG from principal diagnosis
//   Pass 2: +CC (complication/comorbidity) upgrade
//   Pass 3: +MCC (major complication) upgrade
//   → Selects HIGHEST valid DRG weight
//
// Uses Claude Sonnet for clinical-grade ICD-10 extraction
// from encounter documentation. Advisory only — never
// auto-assigns codes. All suggestions require human review.
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.39.0";
import type { MCPLogger, DRGGroupingResult } from "./types.ts";
import { SONNET_MODEL, calculateModelCost } from "../_shared/models.ts";
import { withTimeout, MCP_TIMEOUT_CONFIG } from "../_shared/mcpQueryTimeout.ts";
import { buildConstraintBlock } from "../_shared/clinicalGroundingRules.ts";
import { buildSafeDocumentSection } from "../_shared/promptInjectionGuard.ts";
import { DRG_ANALYSIS_TOOL } from "./aiToolSchemas.ts";
import { validateClinicalOutput, logValidationResults } from "../_shared/clinicalOutputValidator.ts";
import type { CodingOutput } from "../_shared/clinicalOutputValidator.ts";

// -------------------------------------------------------
// Database row shapes (system boundary casts)
// -------------------------------------------------------
interface EncounterRow {
  id: string;
  patient_id: string;
  date_of_service: string;
  status: string;
  notes: string | null;
}

interface DiagnosisRow {
  id: string;
  code: string;
  sequence: number;
  description: string | null;
}

interface ProcedureRow {
  id: string;
  code: string;
  description: string | null;
}

interface ClinicalNoteRow {
  id: string;
  type: string;
  content: string;
  created_at: string;
}

/** Structured response from Claude's DRG analysis */
interface DRGAnalysisResponse {
  principal_diagnosis: {
    code: string;
    description: string;
    rationale: string;
  };
  secondary_diagnoses: Array<{
    code: string;
    description: string;
    is_cc: boolean;
    is_mcc: boolean;
    rationale: string;
  }>;
  procedure_codes: Array<{
    code: string;
    code_system: string;
    description: string;
  }>;
  drg_assignment: {
    base_drg: {
      code: string;
      description: string;
      weight: number;
      mdc: string;
      mdc_description: string;
    };
    cc_drg: {
      code: string;
      description: string;
      weight: number;
    } | null;
    mcc_drg: {
      code: string;
      description: string;
      weight: number;
    } | null;
    optimal_drg: {
      code: string;
      description: string;
      weight: number;
      pass_used: string;
    };
  };
  clinical_reasoning: string;
  confidence: number;
  requires_clinical_review: boolean;
  review_reasons: string[];
}

// -------------------------------------------------------
// DRG Grouper Prompt
// -------------------------------------------------------
function buildDRGGrouperPrompt(
  clinicalContext: {
    notes: string;
    existingDiagnoses: string[];
    existingProcedures: string[];
    encounterDate: string;
  }
): string {
  const diagList = clinicalContext.existingDiagnoses.length > 0
    ? clinicalContext.existingDiagnoses.join('\n  - ')
    : 'None pre-assigned';

  const procList = clinicalContext.existingProcedures.length > 0
    ? clinicalContext.existingProcedures.join('\n  - ')
    : 'None documented';

  const safeNotes = buildSafeDocumentSection(clinicalContext.notes, 'Clinical Documentation');

  return `You are a certified medical coding specialist (CCS) performing MS-DRG assignment for an inpatient encounter. Your task is to extract ICD-10 codes from clinical documentation and assign the optimal DRG through 3-pass analysis.

CRITICAL RULES:
1. The PRINCIPAL DIAGNOSIS drives the DRG — this is the condition established after study that caused the admission, NOT the chief complaint.
2. Always select the HIGHEST VALID DRG. If documentation supports a heart attack (I21.x, DRG 280-282) over hypertension (I10, DRG 304-305), the heart attack DRG MUST be selected.
3. CC (Complication/Comorbidity) and MCC (Major CC) codes upgrade the DRG weight — always check for them.
4. Only assign codes supported by clinical documentation. Never fabricate or assume diagnoses.

ENCOUNTER DATE: ${clinicalContext.encounterDate}

EXISTING DIAGNOSES ON RECORD:
  - ${diagList}

EXISTING PROCEDURES ON RECORD:
  - ${procList}

CLINICAL DOCUMENTATION:
${safeNotes.text}

Perform 3-pass DRG analysis:
  Pass 1: Identify principal diagnosis → assign BASE DRG
  Pass 2: Check all secondary diagnoses for CC status → assign CC-DRG if applicable
  Pass 3: Check all secondary diagnoses for MCC status → assign MCC-DRG if applicable
  Final: Select the DRG with the HIGHEST weight from all 3 passes

Use the submit_drg_analysis tool to return your structured result. Include all 3-pass DRG assignments (base, CC, MCC) and select the highest-weight DRG as optimal. Set cc_drg and mcc_drg to null if no CC/MCC codes are supported by documentation.

${buildConstraintBlock(['drg'])}`;
}

// -------------------------------------------------------
// Exported handler factory
// -------------------------------------------------------
export function createDRGGrouperHandlers(
  sb: SupabaseClient,
  logger: MCPLogger
) {
  const timeoutMs = MCP_TIMEOUT_CONFIG?.standard ?? 15_000;

  // =======================================================
  // run_drg_grouper — AI-powered 3-pass DRG assignment
  // =======================================================
  async function handleRunDRGGrouper(args: Record<string, unknown>) {
    const encounterId = args.encounter_id as string;
    const patientId = args.patient_id as string;
    const tenantId = args.tenant_id as string | undefined;
    const providedPrincipal = args.principal_diagnosis as string | undefined;
    const providedAdditional = args.additional_diagnoses as string[] | undefined;
    const providedProcedures = args.procedure_codes as string[] | undefined;

    // --- 1. Gather clinical documentation ---

    // Encounter header
    const { data: encounterData, error: encErr } = await withTimeout(
      sb.from('encounters')
        .select('id, patient_id, date_of_service, status, notes')
        .eq('id', encounterId)
        .single(),
      timeoutMs,
      'Encounter lookup for DRG'
    );

    if (encErr || !encounterData) {
      return {
        error: `Encounter ${encounterId} not found`,
        drg_result: null
      };
    }

    const encounter = encounterData as EncounterRow;

    // Existing diagnoses
    const { data: diagData } = await withTimeout(
      sb.from('encounter_diagnoses')
        .select('id, code, sequence, description')
        .eq('encounter_id', encounterId)
        .order('sequence', { ascending: true }),
      timeoutMs,
      'Encounter diagnoses lookup'
    );

    const existingDiagnoses = (diagData || []) as DiagnosisRow[];

    // Existing procedures
    const { data: procData } = await withTimeout(
      sb.from('encounter_procedures')
        .select('id, code, description')
        .eq('encounter_id', encounterId),
      timeoutMs,
      'Encounter procedures lookup'
    );

    const existingProcedures = (procData || []) as ProcedureRow[];

    // Clinical notes (for AI extraction)
    const { data: noteData } = await withTimeout(
      sb.from('clinical_notes')
        .select('id, type, content, created_at')
        .eq('encounter_id', encounterId)
        .order('created_at', { ascending: false })
        .limit(10),
      timeoutMs,
      'Clinical notes lookup for DRG'
    );

    const notes = (noteData || []) as ClinicalNoteRow[];

    // Build clinical text for AI analysis
    const clinicalText = buildClinicalText(encounter, existingDiagnoses, notes);

    if (clinicalText.trim().length < 20) {
      return {
        error: 'Insufficient clinical documentation for DRG grouping. Add clinical notes or diagnosis codes to the encounter.',
        drg_result: null
      };
    }

    // Merge provided codes with existing ones
    const allDiagnoses = [
      ...(providedPrincipal ? [providedPrincipal] : []),
      ...(providedAdditional || []),
      ...existingDiagnoses.map(d => `${d.code} - ${d.description || ''}`)
    ];

    const allProcedures = [
      ...(providedProcedures || []),
      ...existingProcedures.map(p => `${p.code} - ${p.description || ''}`)
    ];

    // --- 2. Call Claude for DRG analysis ---
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("CLAUDE_API_KEY");
    if (!apiKey) {
      return {
        error: 'AI service not configured (ANTHROPIC_API_KEY missing)',
        drg_result: null
      };
    }

    const anthropic = new Anthropic({ apiKey });

    const prompt = buildDRGGrouperPrompt({
      notes: clinicalText,
      existingDiagnoses: allDiagnoses,
      existingProcedures: allProcedures,
      encounterDate: encounter.date_of_service
    });

    const startTime = Date.now();

    logger.info('DRG_GROUPER_AI_START', {
      encounterId,
      diagnosisCount: allDiagnoses.length,
      procedureCount: allProcedures.length,
      noteCount: notes.length,
      model: SONNET_MODEL
    });

    const aiResponse = await anthropic.messages.create({
      model: SONNET_MODEL,
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
      tools: [DRG_ANALYSIS_TOOL],
      tool_choice: { type: "tool", name: "submit_drg_analysis" }
    });

    const responseTimeMs = Date.now() - startTime;

    // --- 3. Extract structured response from tool use ---
    const toolBlock = aiResponse.content.find(
      (block: { type: string }) => block.type === "tool_use"
    ) as { type: "tool_use"; input: unknown } | undefined;

    let analysis: DRGAnalysisResponse;
    if (toolBlock) {
      analysis = toolBlock.input as unknown as DRGAnalysisResponse;
    } else {
      // Fallback: try parsing text content as JSON
      const textBlock = aiResponse.content.find(
        (block: { type: string }) => block.type === "text"
      ) as { type: "text"; text: string } | undefined;
      const responseText = textBlock?.text ?? "";
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found in AI response");
        analysis = JSON.parse(jsonMatch[0]) as DRGAnalysisResponse;
      } catch (parseErr: unknown) {
        const error = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
        logger.error('DRG_GROUPER_PARSE_FAILED', {
          encounterId,
          error: error.message,
          responseLength: responseText.length
        });
        return {
          error: 'Failed to parse DRG grouping AI response. The clinical documentation may need more detail.',
          drg_result: null
        };
      }
    }

    // --- 4. Extract 3-pass results ---
    const drg = analysis.drg_assignment;
    const optimal = drg.optimal_drg;

    const hasCC = drg.cc_drg !== null && drg.cc_drg.code !== null;
    const hasMCC = drg.mcc_drg !== null && drg.mcc_drg.code !== null;

    const ccCodes = analysis.secondary_diagnoses
      .filter(d => d.is_cc)
      .map(d => d.code);

    const mccCodes = analysis.secondary_diagnoses
      .filter(d => d.is_mcc)
      .map(d => d.code);

    // --- 4b. Clinical Validation Hook ---
    const codingOutput: CodingOutput = {
      icd10: [
        { code: analysis.principal_diagnosis.code, rationale: analysis.principal_diagnosis.description },
        ...analysis.secondary_diagnoses.map(d => ({
          code: d.code, rationale: d.description,
        })),
      ],
      drg: {
        code: optimal.code,
        description: optimal.description,
        weight: optimal.weight,
      },
    };
    const validationResult = await validateClinicalOutput(codingOutput, {
      source: "mcp-drg-grouper",
      sb,
      patientId,
    });

    // Log validation results to DB (fire-and-forget)
    logValidationResults(validationResult, sb, tenantId, 0).catch(() => {});

    let codeValidation: Record<string, unknown> | undefined;
    if (validationResult.rejectedCodes.length > 0) {
      codeValidation = {
        _validationSummary: validationResult.flaggedOutput?._validationSummary ?? null,
        _rejectedCodes: validationResult.rejectedCodes,
      };
    }

    // --- 5. Persist DRG result ---
    const drgResult = {
      tenant_id: tenantId || null,
      patient_id: patientId,
      encounter_id: encounterId,
      principal_diagnosis_code: analysis.principal_diagnosis.code,
      secondary_diagnosis_codes: analysis.secondary_diagnoses.map(d => d.code),
      procedure_codes: analysis.procedure_codes.map(p => p.code),
      drg_code: optimal.code,
      drg_description: optimal.description,
      drg_weight: optimal.weight,
      drg_type: 'ms_drg',
      mdc_code: drg.base_drg.mdc,
      mdc_description: drg.base_drg.mdc_description,
      has_cc: hasCC,
      has_mcc: hasMCC,
      cc_codes: ccCodes,
      mcc_codes: mccCodes,
      base_drg_code: drg.base_drg.code,
      base_drg_weight: drg.base_drg.weight,
      cc_drg_code: drg.cc_drg?.code ?? null,
      cc_drg_weight: drg.cc_drg?.weight ?? null,
      mcc_drg_code: drg.mcc_drg?.code ?? null,
      mcc_drg_weight: drg.mcc_drg?.weight ?? null,
      optimal_drg_code: optimal.code,
      estimated_reimbursement: null, // Calculated by revenue projection tool
      base_rate_used: null,
      grouper_version: 'MS-DRG v43',
      ai_skill_key: 'drg_grouper',
      ai_model_used: SONNET_MODEL,
      ai_confidence: analysis.confidence,
      ai_reasoning: analysis.clinical_reasoning,
      status: 'preliminary'
    };

    const { data: savedResult, error: saveErr } = await withTimeout(
      sb.from('drg_grouping_results')
        .insert(drgResult)
        .select()
        .single(),
      timeoutMs,
      'DRG result save'
    );

    if (saveErr) {
      logger.error('DRG_RESULT_SAVE_FAILED', {
        encounterId,
        error: String(saveErr)
      });
      // Still return the result even if save fails
    }

    // --- 6. Log AI usage ---
    const inputTokens = aiResponse.usage?.input_tokens ?? 0;
    const outputTokens = aiResponse.usage?.output_tokens ?? 0;

    await sb.from('claude_usage_logs').insert({
      user_id: patientId,
      request_id: crypto.randomUUID(),
      model: SONNET_MODEL,
      request_type: 'drg_grouping',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost: calculateModelCost(SONNET_MODEL, inputTokens, outputTokens),
      response_time_ms: responseTimeMs,
      success: true,
      metadata: {
        encounter_id: encounterId,
        drg_code: optimal.code,
        drg_weight: optimal.weight,
        confidence: analysis.confidence,
        pass_used: optimal.pass_used
      }
    }).then(() => { /* fire and forget */ }).catch(() => { /* non-critical */ });

    logger.info('DRG_GROUPER_COMPLETE', {
      encounterId,
      baseDRG: drg.base_drg.code,
      ccDRG: drg.cc_drg?.code ?? 'none',
      mccDRG: drg.mcc_drg?.code ?? 'none',
      optimalDRG: optimal.code,
      optimalWeight: optimal.weight,
      passUsed: optimal.pass_used,
      confidence: analysis.confidence,
      responseTimeMs,
      requiresReview: analysis.requires_clinical_review
    });

    return {
      drg_result: savedResult || drgResult,
      analysis: {
        principal_diagnosis: analysis.principal_diagnosis,
        secondary_diagnoses: analysis.secondary_diagnoses,
        procedure_codes: analysis.procedure_codes,
        three_pass_summary: {
          pass_1_base: {
            drg: drg.base_drg.code,
            weight: drg.base_drg.weight,
            mdc: drg.base_drg.mdc
          },
          pass_2_cc: drg.cc_drg ? {
            drg: drg.cc_drg.code,
            weight: drg.cc_drg.weight,
            cc_codes: ccCodes
          } : null,
          pass_3_mcc: drg.mcc_drg ? {
            drg: drg.mcc_drg.code,
            weight: drg.mcc_drg.weight,
            mcc_codes: mccCodes
          } : null,
          optimal: {
            drg: optimal.code,
            weight: optimal.weight,
            pass_used: optimal.pass_used
          }
        },
        clinical_reasoning: analysis.clinical_reasoning,
        confidence: analysis.confidence,
        requires_clinical_review: analysis.requires_clinical_review,
        review_reasons: analysis.review_reasons
      },
      ai_metadata: {
        model: SONNET_MODEL,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        response_time_ms: responseTimeMs
      },
      ...(codeValidation ? { code_validation: codeValidation } : {}),
      advisory: 'DRG assignment is advisory only. All codes require clinical review and confirmation before billing.'
    };
  }

  // =======================================================
  // get_drg_result — Retrieve existing DRG grouping result
  // =======================================================
  async function handleGetDRGResult(args: Record<string, unknown>) {
    const encounterId = args.encounter_id as string;
    const grouperVersion = args.grouper_version as string | undefined;
    const tenantId = args.tenant_id as string | undefined;

    let query = sb.from('drg_grouping_results')
      .select('*')
      .eq('encounter_id', encounterId);

    if (grouperVersion) {
      query = query.eq('grouper_version', grouperVersion);
    }
    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    query = query.order('created_at', { ascending: false }).limit(1);

    const { data, error } = await withTimeout(query.single(), timeoutMs, 'DRG result lookup');

    if (error) {
      // PGRST116 = no rows found — not an error for this use case
      if (String(error).includes('PGRST116')) {
        return {
          drg_result: null,
          found: false,
          message: `No DRG grouping result found for encounter ${encounterId}`
        };
      }

      logger.error('DRG_RESULT_QUERY_FAILED', {
        encounterId, error: String(error)
      });
      throw error;
    }

    const result = data as DRGGroupingResult;

    logger.info('DRG_RESULT_RETRIEVED', {
      encounterId,
      drgCode: result.drg_code,
      drgWeight: result.drg_weight,
      status: result.status
    });

    return {
      drg_result: result,
      found: true
    };
  }

  return {
    handleRunDRGGrouper,
    handleGetDRGResult
  };
}

/** Build clinical text from encounter data for AI analysis */
function buildClinicalText(
  encounter: EncounterRow,
  diagnoses: DiagnosisRow[],
  notes: ClinicalNoteRow[]
): string {
  const parts: string[] = [];
  if (encounter.notes) parts.push(`ENCOUNTER NOTES:\n${encounter.notes}`);
  if (diagnoses.length > 0) {
    const diagText = diagnoses
      .map(d => `  ${d.sequence}. ${d.code} — ${d.description || 'No description'}`)
      .join('\n');
    parts.push(`ASSIGNED DIAGNOSES:\n${diagText}`);
  }
  for (const noteType of ['assessment', 'plan', 'hpi', 'subjective', 'objective', 'general', 'ros']) {
    const latest = notes.find(n => n.type === noteType);
    if (latest) {
      const content = latest.content.length > 2000
        ? latest.content.substring(0, 2000) + '... [truncated]'
        : latest.content;
      parts.push(`${noteType.toUpperCase()} NOTE:\n${content}`);
    }
  }
  return parts.join('\n\n---\n\n');
}
