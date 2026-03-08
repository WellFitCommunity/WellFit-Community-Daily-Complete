// =====================================================
// Code Validation Helpers — Internal validators for each code system
// Extracted from clinicalOutputValidator.ts (600-line limit).
// Not intended for direct import by edge functions.
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  validateICD10Code,
  validateMedication,
  normalizeICD10,
  isValidICD10Format,
} from "./nlmCodeValidator.ts";
import type { RxNormValidationResult } from "./nlmCodeValidator.ts";
import type {
  CodeSystem,
  ValidatedCode,
  RejectedCode,
  ValidatorOptions,
} from "./clinicalOutputValidator.ts";

/** Validate ICD-10 codes (with Z-code detection) */
export async function validateICD10Codes(
  codes: string[],
  options: ValidatorOptions
): Promise<Array<ValidatedCode | RejectedCode>> {
  const results: Array<ValidatedCode | RejectedCode> = [];

  for (const code of codes) {
    const normalized = normalizeICD10(code);

    if (!isValidICD10Format(code)) {
      results.push({
        code: normalized,
        system: "icd10",
        reason: "invalid_format",
        detail: `"${code}" does not match ICD-10-CM format (letter + 2+ digits)`,
        ai_suggested: true,
        validated: false,
      });
      continue;
    }

    const isZCode = normalized.startsWith("Z");
    const system: CodeSystem = isZCode ? "z-code" : "icd10";

    if (options.localOnly) {
      if (options.sb) {
        const { data } = await options.sb
          .from("code_icd10")
          .select("code, description")
          .eq("code", normalized)
          .eq("status", "active")
          .single();

        if (data) {
          const row = data as { code: string; description: string | null };
          results.push({
            code: normalized, system,
            description: row.description, validated: true, source: "local_cache",
          });
        } else {
          results.push({
            code: normalized, system,
            reason: "code_not_found",
            detail: `"${normalized}" not found in local ICD-10 cache (API skipped)`,
            ai_suggested: true, validated: false,
          });
        }
      }
      continue;
    }

    const apiResult = await validateICD10Code(code, options.sb);
    if (apiResult.valid) {
      results.push({
        code: normalized, system,
        description: apiResult.description,
        validated: true, source: apiResult.source,
      });
    } else {
      results.push({
        code: normalized, system,
        reason: apiResult.source === "format_check" ? "invalid_format" : "code_not_found",
        detail: `"${normalized}" not found in ICD-10-CM (source: ${apiResult.source})`,
        ai_suggested: true, validated: false,
      });
    }
  }

  return results;
}

/** Validate codes against a local DB table (CPT, HCPCS) */
export async function validateLocalCodes(
  codes: string[],
  system: CodeSystem,
  tableName: string,
  sb: SupabaseClient
): Promise<{ valid: ValidatedCode[]; rejected: RejectedCode[] }> {
  const valid: ValidatedCode[] = [];
  const rejected: RejectedCode[] = [];
  const uniqueCodes = [...new Set(codes)];

  const { data } = await sb
    .from(tableName)
    .select("code, short_description, description")
    .in("code", uniqueCodes)
    .eq("status", "active");

  const found = new Set<string>();
  if (data) {
    for (const row of data as Array<{ code: string; short_description?: string; description?: string }>) {
      found.add(row.code);
      valid.push({
        code: row.code, system,
        description: row.short_description ?? row.description ?? null,
        validated: true, source: "local_cache",
      });
    }
  }

  for (const code of uniqueCodes) {
    if (!found.has(code)) {
      rejected.push({
        code, system,
        reason: "code_not_found",
        detail: `"${code}" not found in ${tableName} table`,
        ai_suggested: true, validated: false,
      });
    }
  }

  return { valid, rejected };
}

/** Validate a DRG code against ms_drg_reference */
export async function validateDRGCode(
  code: string,
  sb: SupabaseClient
): Promise<ValidatedCode | RejectedCode> {
  const padded = code.padStart(3, "0");

  const { data } = await sb
    .from("ms_drg_reference")
    .select("drg_code, description, relative_weight")
    .eq("drg_code", padded)
    .eq("status", "active")
    .single();

  if (data) {
    const row = data as { drg_code: string; description: string; relative_weight: number };
    return {
      code: row.drg_code, system: "drg",
      description: `${row.description} (weight: ${row.relative_weight})`,
      validated: true, source: "local_cache",
    };
  }

  return {
    code: padded, system: "drg",
    reason: "code_not_found",
    detail: `DRG "${padded}" not found in ms_drg_reference table`,
    ai_suggested: true, validated: false,
  };
}

/** Validate risk score is within acceptable range */
export function validateRiskScore(score: number): { valid: boolean; message: string } {
  if (typeof score !== "number" || isNaN(score)) {
    return { valid: false, message: "Risk score is not a valid number" };
  }
  if (score < 0 || score > 100) {
    return { valid: false, message: `Risk score ${score} is out of range (must be 0-100)` };
  }
  return { valid: true, message: "OK" };
}

/** Validate medication names via RxNorm */
export async function validateMedications(
  medications: Array<{ name: string; rxcui?: string }>,
  options: ValidatorOptions
): Promise<RxNormValidationResult[]> {
  if (options.localOnly) return [];

  const results: RxNormValidationResult[] = [];
  for (const med of medications) {
    const result = await validateMedication(med.name);
    results.push(result);
  }
  return results;
}
