// =====================================================
// Clinical Output Validator — Post-AI Output Verification
// Detective control: validates AI-generated clinical codes
// against reference data BEFORE they reach human reviewers.
//
// Architecture: Constraints (preventive) + Hooks (detective) + Audit (proof)
//
// Usage in edge functions:
//   import { validateClinicalOutput } from "../_shared/clinicalOutputValidator.ts";
//   const result = await validateClinicalOutput(aiOutput, { source: 'coding-suggest', sb });
//   // result.cleaned = output with invalid codes removed/flagged
//   // result.audit = validation metadata for logging
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "./auditLogger.ts";
import { normalizeICD10 } from "./nlmCodeValidator.ts";
import {
  validateICD10Codes,
  validateLocalCodes,
  validateDRGCode,
  validateRiskScore,
  validateMedications,
} from "./codeValidationHelpers.ts";

const logger = createLogger("clinicalOutputValidator");

// --- Types ---

/** Code systems the validator can check */
export type CodeSystem = "icd10" | "cpt" | "hcpcs" | "drg" | "z-code" | "rxnorm";

/** A single code that was validated */
export interface ValidatedCode {
  code: string;
  system: CodeSystem;
  description: string | null;
  validated: true;
  source: "nlm_api" | "local_cache" | "format_check";
}

/** A single code that failed validation */
export interface RejectedCode {
  code: string;
  system: CodeSystem;
  reason:
    | "code_not_found"
    | "code_inactive"
    | "wrong_fiscal_year"
    | "invalid_format"
    | "allergy_conflict"
    | "out_of_range"
    | "system_mismatch";
  detail: string;
  ai_suggested: true;
  validated: false;
}

/** Audit metadata for every validation run */
export interface ValidationAudit {
  timestamp: string;
  sourceFunction: string;
  codesChecked: number;
  codesRejected: number;
  validationMethod: "nlm_api" | "local_cache" | "both" | "local_only";
  durationMs: number;
  patientId?: string;
}

/** Full validation result */
export interface ValidationResult {
  valid: boolean;
  validatedCodes: ValidatedCode[];
  rejectedCodes: RejectedCode[];
  warnings: string[];
  audit: ValidationAudit;
  /** Output with flagged codes (rejected codes kept but marked) */
  flaggedOutput: FlaggedCodingOutput | null;
}

/** A code entry with validation flag attached */
export interface FlaggedCodeEntry {
  code: string;
  modifiers?: string[];
  rationale?: string;
  principal?: boolean;
  /** true = passed validation, false = flagged for review */
  _validated: boolean;
  /** Reason the code was flagged (null if validated) */
  _flagReason: string | null;
  /** Where validation was checked */
  _validationSource: string | null;
}

/** The AI output with validation flags on every code */
export interface FlaggedCodingOutput {
  cpt?: FlaggedCodeEntry[];
  hcpcs?: FlaggedCodeEntry[];
  icd10?: FlaggedCodeEntry[];
  drg?: FlaggedCodeEntry | null;
  medications?: Array<{ name: string; rxcui?: string; _validated: boolean; _flagReason: string | null }>;
  risk_score?: number;
  _riskScoreValid?: boolean;
  confidence?: number;
  notes?: string;
  _validationSummary: {
    totalCodes: number;
    validCodes: number;
    flaggedCodes: number;
    /** Codes silently removed because humans previously confirmed them as hallucinations */
    suppressedCodes: number;
    validationMethod: string;
    durationMs: number;
  };
}

/** Feedback from biller/coder on a flagged code */
export interface CodeFeedback {
  code: string;
  system: CodeSystem;
  sourceFunction: string;
  /** 'confirm_invalid' = AI was wrong, 'confirm_valid' = validator was wrong (false positive) */
  decision: "confirm_invalid" | "confirm_valid";
  /** Who reviewed it */
  reviewedBy: string;
  /** Optional note from reviewer */
  note?: string;
}

/** Options for validation */
export interface ValidatorOptions {
  /** Which edge function is calling */
  source: string;
  /** Supabase client for local DB lookups */
  sb?: SupabaseClient;
  /** Patient ID for allergy cross-check (optional) */
  patientId?: string;
  /** Skip NLM API calls (local-only mode for testing) */
  localOnly?: boolean;
}

/** Shape of AI coding output (from coding-suggest, ai-billing-suggester) */
export interface CodingOutput {
  cpt?: Array<{ code: string; modifiers?: string[]; rationale?: string }>;
  hcpcs?: Array<{ code: string; modifiers?: string[]; rationale?: string }>;
  icd10?: Array<{ code: string; rationale?: string; principal?: boolean }>;
  drg?: { code: string; description?: string; weight?: number } | null;
  medications?: Array<{ name: string; rxcui?: string }>;
  risk_score?: number;
  confidence?: number;
  notes?: string;
}

// --- Learning Loop: Human Feedback Overrides ---
// Extracted to validationLearningLoop.ts (600-line limit).
// Two behaviors:
//   confirm_valid   → false positive: stop flagging, let through
//   confirm_invalid → confirmed hallucination: silently strip, log, never show again

import {
  loadHumanFeedback,
  suppressKnownHallucinations,
  applyFalsePositiveOverrides,
} from "./validationLearningLoop.ts";

// --- Main Validator ---

/**
 * Validate all clinical codes in an AI output.
 * Checks ICD-10, CPT, HCPCS, DRG, Z-codes, medications, and risk scores.
 * Applies false positive overrides from human feedback (learning loop).
 *
 * @param output - The parsed AI response containing clinical codes
 * @param options - Validation configuration
 * @returns ValidationResult with valid/rejected codes and audit metadata
 */
export async function validateClinicalOutput(
  output: CodingOutput,
  options: ValidatorOptions
): Promise<ValidationResult> {
  const start = performance.now();
  const validatedCodes: ValidatedCode[] = [];
  let rejectedCodes: RejectedCode[] = [];
  const warnings: string[] = [];
  let usedApi = false;
  let usedCache = false;

  // 0. Load human feedback (learning loop)
  const feedback = await loadHumanFeedback(options.sb);

  // 0a. Suppress known hallucinations — codes confirmed invalid by human reviewers
  //     are silently stripped from the output before validation even runs.
  const { cleaned: cleanedOutput, suppressedCount, suppressedCodes } =
    suppressKnownHallucinations(output, feedback.confirmedInvalid);

  // Use cleaned output for all subsequent validation
  const activeOutput = cleanedOutput;

  // 1. Validate ICD-10 codes
  if (activeOutput.icd10?.length) {
    const codes = activeOutput.icd10.map((c) => c.code);
    const icdResults = await validateICD10Codes(codes, options);
    for (const r of icdResults) {
      if (r.validated) {
        validatedCodes.push(r as ValidatedCode);
        if (r.source === "nlm_api") usedApi = true;
        if (r.source === "local_cache") usedCache = true;
      } else {
        rejectedCodes.push(r as RejectedCode);
      }
    }
  }

  // 2. Validate CPT codes
  if (activeOutput.cpt?.length && options.sb) {
    const cptResults = await validateLocalCodes(
      activeOutput.cpt.map((c) => c.code),
      "cpt",
      "code_cpt",
      options.sb
    );
    validatedCodes.push(...cptResults.valid);
    rejectedCodes.push(...cptResults.rejected);
    if (cptResults.valid.length > 0) usedCache = true;
  }

  // 3. Validate HCPCS codes
  if (activeOutput.hcpcs?.length && options.sb) {
    const hcpcsResults = await validateLocalCodes(
      activeOutput.hcpcs.map((c) => c.code),
      "hcpcs",
      "code_hcpcs",
      options.sb
    );
    validatedCodes.push(...hcpcsResults.valid);
    rejectedCodes.push(...hcpcsResults.rejected);
    if (hcpcsResults.valid.length > 0) usedCache = true;
  }

  // 4. Validate DRG code
  if (activeOutput.drg?.code && options.sb) {
    const drgResult = await validateDRGCode(activeOutput.drg.code, options.sb);
    if (drgResult.validated) {
      validatedCodes.push(drgResult as ValidatedCode);
    } else {
      rejectedCodes.push(drgResult as RejectedCode);
    }
    usedCache = true;
  }

  // 5. Validate risk score range
  if (activeOutput.risk_score !== undefined) {
    const scoreResult = validateRiskScore(activeOutput.risk_score);
    if (!scoreResult.valid) {
      rejectedCodes.push({
        code: String(activeOutput.risk_score),
        system: "icd10", // closest system for categorization
        reason: "out_of_range",
        detail: scoreResult.message,
        ai_suggested: true,
        validated: false,
      });
    }
  }

  // 6. Validate medications via RxNorm
  if (activeOutput.medications?.length) {
    const medResults = await validateMedications(activeOutput.medications, options);
    for (const r of medResults) {
      if (r.valid) {
        validatedCodes.push({
          code: r.rxcui ?? r.name,
          system: "rxnorm",
          description: r.normalizedName,
          validated: true,
          source: "nlm_api",
        });
        usedApi = true;
      } else {
        warnings.push(`Medication "${r.name}" not found in RxNorm`);
      }
    }
  }

  // 7. Apply false positive overrides from human feedback
  const overrideResult = applyFalsePositiveOverrides(
    validatedCodes, rejectedCodes, feedback.confirmedValid, warnings
  );
  rejectedCodes = overrideResult.rejected;

  const durationMs = Math.round(performance.now() - start);

  const audit: ValidationAudit = {
    timestamp: new Date().toISOString(),
    sourceFunction: options.source,
    codesChecked: validatedCodes.length + rejectedCodes.length,
    codesRejected: rejectedCodes.length,
    validationMethod: options.localOnly
      ? "local_only"
      : usedApi && usedCache
        ? "both"
        : usedApi
          ? "nlm_api"
          : "local_cache",
    durationMs,
    patientId: options.patientId,
  };

  // Log rejections
  if (rejectedCodes.length > 0) {
    logger.warn("AI codes rejected by validation", {
      sourceFunction: options.source,
      rejectedCount: String(rejectedCodes.length),
      codes: JSON.stringify(rejectedCodes.map((r) => `${r.code} (${r.reason})`)),
    });
  }

  // Build flagged output from cleaned output (suppressed codes already removed)
  const flaggedOutput = buildFlaggedOutput(activeOutput, validatedCodes, rejectedCodes, audit, suppressedCount);

  return {
    valid: rejectedCodes.length === 0,
    validatedCodes,
    rejectedCodes,
    warnings,
    audit,
    flaggedOutput,
  };
}

// --- Flag Behavior (Phase 2-3) ---
// New codes: flagged with `_validated: false`, visible for biller to confirm/reject.
// Confirmed invalid codes: silently stripped (learning loop), never shown again.
// Confirmed valid codes: pass through without flag (learning loop).

/** Build the flagged output: cleaned AI output with validation flags on remaining codes */
function buildFlaggedOutput(
  original: CodingOutput,
  validated: ValidatedCode[],
  rejected: RejectedCode[],
  audit: ValidationAudit,
  suppressedCount: number = 0
): FlaggedCodingOutput {
  const validSet = new Set(validated.map((v) => `${v.system}:${v.code}`));
  const rejectedMap = new Map(rejected.map((r) => [`${r.system}:${r.code}`, r]));

  function flagCodeEntry(
    entry: { code: string; modifiers?: string[]; rationale?: string; principal?: boolean },
    system: CodeSystem
  ): FlaggedCodeEntry {
    const key = `${system}:${normalizeICD10(entry.code)}`;
    const isValid = validSet.has(key);
    const rejection = rejectedMap.get(key);
    return {
      code: entry.code,
      modifiers: entry.modifiers,
      rationale: entry.rationale,
      principal: entry.principal,
      _validated: isValid,
      _flagReason: rejection ? rejection.detail : null,
      _validationSource: isValid
        ? (validated.find((v) => `${v.system}:${v.code}` === key)?.source ?? null)
        : null,
    };
  }

  const riskScoreValid = original.risk_score === undefined ||
    (typeof original.risk_score === "number" && original.risk_score >= 0 && original.risk_score <= 100);

  return {
    cpt: original.cpt?.map((c) => flagCodeEntry(c, "cpt")),
    hcpcs: original.hcpcs?.map((c) => flagCodeEntry(c, "hcpcs")),
    icd10: original.icd10?.map((c) => {
      const norm = normalizeICD10(c.code);
      const sys: CodeSystem = norm.startsWith("Z") ? "z-code" : "icd10";
      return flagCodeEntry(c, sys);
    }),
    drg: original.drg ? flagCodeEntry(original.drg, "drg") : null,
    medications: original.medications?.map((m) => {
      const found = validated.find((v) => v.system === "rxnorm" && (v.code === m.rxcui || v.description === m.name));
      return {
        name: m.name,
        rxcui: m.rxcui,
        _validated: !!found,
        _flagReason: found ? null : `Medication "${m.name}" not found in RxNorm`,
      };
    }),
    risk_score: original.risk_score,
    _riskScoreValid: riskScoreValid,
    confidence: original.confidence,
    notes: original.notes,
    _validationSummary: {
      totalCodes: audit.codesChecked,
      validCodes: audit.codesChecked - audit.codesRejected,
      flaggedCodes: audit.codesRejected,
      suppressedCodes: suppressedCount,
      validationMethod: audit.validationMethod,
      durationMs: audit.durationMs,
    },
  };
}

/**
 * Log validation results to database for dashboard tracking.
 * Inserts to:
 *   1. validation_hook_results — aggregate metrics for dashboard
 *   2. audit_logs — HIPAA audit trail for rejected codes (Tier 2)
 *
 * Fire-and-forget: failures are logged but never block the response.
 *
 * @param result - The validation result from validateClinicalOutput
 * @param sb - Supabase client (service role) for DB inserts
 * @param tenantId - Tenant ID for isolation (optional)
 * @param suppressedCount - Number of codes suppressed by learning loop
 */
export async function logValidationResults(
  result: ValidationResult,
  sb: SupabaseClient,
  tenantId?: string,
  suppressedCount: number = 0
): Promise<void> {
  const { audit, rejectedCodes } = result;

  // 1. Insert to validation_hook_results (aggregate tracking)
  try {
    const { error } = await sb.from("validation_hook_results").insert({
      source_function: audit.sourceFunction,
      patient_id: audit.patientId ?? null,
      tenant_id: tenantId ?? null,
      codes_checked: audit.codesChecked,
      codes_validated: audit.codesChecked - audit.codesRejected,
      codes_rejected: audit.codesRejected,
      codes_suppressed: suppressedCount,
      rejected_details: rejectedCodes.map((r) => ({
        code: r.code,
        system: r.system,
        reason: r.reason,
        detail: r.detail,
      })),
      validation_method: audit.validationMethod,
      response_time_ms: audit.durationMs,
    });

    if (error) {
      logger.error("Failed to log validation results", { error: error.message });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("Failed to log validation results", { error: msg });
  }

  // 2. Insert to audit_logs for each rejected code (HIPAA Tier 2)
  if (rejectedCodes.length > 0) {
    try {
      const { error } = await sb.from("audit_logs").insert({
        event_type: "AI_CODE_VALIDATION_REJECTED",
        event_category: "CLINICAL_AI",
        success: true,
        metadata: {
          source_function: audit.sourceFunction,
          patient_id: audit.patientId ?? null,
          codes_rejected: audit.codesRejected,
          codes_checked: audit.codesChecked,
          rejected_codes: rejectedCodes.map((r) => ({
            code: r.code,
            system: r.system,
            reason: r.reason,
          })),
          validation_method: audit.validationMethod,
          duration_ms: audit.durationMs,
        },
      });

      if (error) {
        logger.error("Failed to log validation audit", { error: error.message });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("Failed to log validation audit", { error: msg });
    }
  }
}

/**
 * Record biller/coder feedback on a flagged code.
 * This creates the learning loop: every human decision on a flagged code
 * feeds back into accuracy metrics.
 *
 * - confirm_invalid: AI hallucinated, validator caught it correctly
 * - confirm_valid: Validator flagged a real code (false positive — reference data gap)
 *
 * @param feedback - The reviewer's decision
 * @param sb - Supabase client for DB insert
 */
export async function recordCodeFeedback(
  feedback: CodeFeedback,
  sb: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await sb.from("validation_feedback").insert({
      code: feedback.code,
      code_system: feedback.system,
      source_function: feedback.sourceFunction,
      decision: feedback.decision,
      reviewed_by: feedback.reviewedBy,
      reviewer_note: feedback.note ?? null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      logger.error("Failed to record validation feedback", {
        code: feedback.code,
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    logger.info("Validation feedback recorded", {
      code: feedback.code,
      decision: feedback.decision,
      reviewedBy: feedback.reviewedBy,
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("Failed to record validation feedback", { error: msg });
    return { success: false, error: msg };
  }
}

// --- FHIR Code System Validation (Phase 2-2) ---
// Extracted to fhirCodeSystemValidator.ts for 600-line limit.
// Re-exported here for backward compatibility.

export {
  validateFhirCodeSystems,
  validateUCUMUnit,
  validateDateConsistency,
} from "./fhirCodeSystemValidator.ts";

export type {
  FhirCodedElement,
  FhirValidationResult,
  FhirValidationError,
} from "./fhirCodeSystemValidator.ts";

// --- Exports ---

export default {
  validateClinicalOutput,
  validateFhirCodeSystems,
  validateUCUMUnit,
  validateDateConsistency,
  recordCodeFeedback,
  logValidationResults,
};
