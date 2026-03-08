// =====================================================
// Validation Learning Loop — Human Feedback Overrides
// Extracted from clinicalOutputValidator.ts (600-line limit).
//
// Two learning behaviors:
//   confirm_valid   → false positive: stop flagging this code
//   confirm_invalid → confirmed hallucination: silently strip from output
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type {
  CodeSystem,
  ValidatedCode,
  RejectedCode,
  CodingOutput,
} from "./clinicalOutputValidator.ts";
import { createLogger } from "./auditLogger.ts";

const logger = createLogger("validationLearningLoop");

/** Human feedback loaded from validation_feedback table */
export interface HumanFeedbackSets {
  /** Codes confirmed valid by human (false positives — stop flagging) */
  confirmedValid: Set<string>;
  /** Codes confirmed invalid by human (known hallucinations — silently strip) */
  confirmedInvalid: Set<string>;
}

/**
 * Load all human feedback from validation_feedback table.
 *
 * Two learning behaviors:
 *   confirm_valid   → false positive: stop flagging this code, let it through
 *   confirm_invalid → confirmed hallucination: silently strip from output, log, never show again
 */
export async function loadHumanFeedback(
  sb: SupabaseClient | undefined
): Promise<HumanFeedbackSets> {
  const empty: HumanFeedbackSets = { confirmedValid: new Set(), confirmedInvalid: new Set() };
  if (!sb) return empty;

  try {
    const { data } = await sb
      .from("validation_feedback")
      .select("code, code_system, decision");

    if (!data || data.length === 0) return empty;

    const confirmedValid = new Set<string>();
    const confirmedInvalid = new Set<string>();
    for (const row of data as Array<{ code: string; code_system: string; decision: string }>) {
      const key = `${row.code_system}:${row.code}`;
      if (row.decision === "confirm_valid") {
        confirmedValid.add(key);
      } else if (row.decision === "confirm_invalid") {
        confirmedInvalid.add(key);
      }
    }
    return { confirmedValid, confirmedInvalid };
  } catch {
    // Non-critical — if feedback table is unavailable, proceed without overrides
    return empty;
  }
}

/**
 * Strip known hallucinations from AI output BEFORE validation runs.
 * These codes were previously confirmed invalid by a human reviewer.
 * They are silently removed — the user never sees them again.
 * Returns the cleaned output + count of suppressed codes for audit logging.
 */
export function suppressKnownHallucinations(
  output: CodingOutput,
  confirmedInvalid: Set<string>
): { cleaned: CodingOutput; suppressedCount: number; suppressedCodes: string[] } {
  if (confirmedInvalid.size === 0) {
    return { cleaned: output, suppressedCount: 0, suppressedCodes: [] };
  }

  const suppressedCodes: string[] = [];

  const filterCodes = (
    codes: Array<{ code: string; [key: string]: unknown }> | undefined,
    system: CodeSystem
  ) => {
    if (!codes) return codes;
    return codes.filter((c) => {
      const key = `${system}:${c.code}`;
      if (confirmedInvalid.has(key)) {
        suppressedCodes.push(`${system}:${c.code}`);
        return false;
      }
      return true;
    });
  };

  const cleaned: CodingOutput = {
    ...output,
    icd10: filterCodes(output.icd10, "icd10"),
    cpt: filterCodes(output.cpt, "cpt"),
    hcpcs: filterCodes(output.hcpcs, "hcpcs"),
    medications: output.medications, // medications use names, not code keys
  };

  // Check DRG
  if (output.drg?.code && confirmedInvalid.has(`drg:${output.drg.code}`)) {
    suppressedCodes.push(`drg:${output.drg.code}`);
    cleaned.drg = null;
  }

  // Check Z-codes (stored under icd10 but keyed as z-code)
  if (cleaned.icd10) {
    cleaned.icd10 = cleaned.icd10.filter((c) => {
      if (c.code.startsWith("Z") && confirmedInvalid.has(`z-code:${c.code}`)) {
        suppressedCodes.push(`z-code:${c.code}`);
        return false;
      }
      return true;
    });
  }

  if (suppressedCodes.length > 0) {
    logger.info("Known hallucinated codes suppressed by learning loop", {
      suppressedCount: String(suppressedCodes.length),
      codes: JSON.stringify(suppressedCodes),
    });
  }

  return { cleaned, suppressedCount: suppressedCodes.length, suppressedCodes };
}

/**
 * Apply false positive overrides: codes confirmed valid by humans
 * are moved from rejected to validated.
 */
export function applyFalsePositiveOverrides(
  validatedCodes: ValidatedCode[],
  rejectedCodes: RejectedCode[],
  confirmedValid: Set<string>,
  warnings: string[]
): { validated: ValidatedCode[]; rejected: RejectedCode[] } {
  if (confirmedValid.size === 0) {
    return { validated: validatedCodes, rejected: rejectedCodes };
  }

  const stillRejected: RejectedCode[] = [];
  for (const r of rejectedCodes) {
    const key = `${r.system}:${r.code}`;
    if (confirmedValid.has(key)) {
      validatedCodes.push({
        code: r.code,
        system: r.system,
        description: null,
        validated: true,
        source: "format_check",
      });
      warnings.push(
        `Code "${r.code}" (${r.system}) was flagged but overridden by prior human review (false positive learned)`
      );
    } else {
      stillRejected.push(r);
    }
  }

  return { validated: validatedCodes, rejected: stillRejected };
}
