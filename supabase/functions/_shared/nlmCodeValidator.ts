// =====================================================
// NLM Code Validator — Real-Time Clinical Code Validation
// Validates ICD-10-CM codes via NLM Clinical Tables API
// and medication names via NLM RxNorm API.
// Falls back to local database cache when APIs are slow/down.
//
// Part of Clinical Validation Hooks architecture:
//   Constraints (preventive) + Hooks (detective) + Audit (proof)
// =====================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "./auditLogger.ts";

const logger = createLogger("nlmCodeValidator");

// --- Configuration ---

const NLM_ICD10_BASE = "https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search";
const NLM_RXNORM_BASE = "https://rxnav.nlm.nih.gov/REST";
const API_TIMEOUT_MS = 5000;

// --- Types ---

/** Result of validating a single ICD-10 code */
export interface ICD10ValidationResult {
  code: string;
  valid: boolean;
  description: string | null;
  source: "nlm_api" | "local_cache" | "format_check";
  /** True if API was used (even if fallback occurred) */
  apiAttempted: boolean;
}

/** Result of validating a medication name via RxNorm */
export interface RxNormValidationResult {
  name: string;
  valid: boolean;
  rxcui: string | null;
  /** Normalized name from RxNorm */
  normalizedName: string | null;
  source: "rxnorm_api" | "not_found";
}

/** Batch validation result for multiple codes */
export interface BatchValidationResult {
  validated: ICD10ValidationResult[];
  totalChecked: number;
  totalValid: number;
  totalInvalid: number;
  validationMethod: "nlm_api" | "local_cache" | "both";
  durationMs: number;
}

// --- ICD-10 Format Validation ---

/**
 * ICD-10-CM format: letter + 2 digits + optional dot + up to 4 alphanumeric
 * Examples: E11.65, I10, Z87.891, W19XXXA
 * Stored without dots in our database (E1165, I10, Z87891)
 */
const ICD10_PATTERN = /^[A-TV-Z]\d{2}\.?\w{0,4}$/i;

/** Normalize ICD-10 code: uppercase, remove dots */
export function normalizeICD10(code: string): string {
  return code.toUpperCase().replace(/\./g, "");
}

/** Check if a string looks like a valid ICD-10-CM format */
export function isValidICD10Format(code: string): boolean {
  return ICD10_PATTERN.test(code);
}

// --- NLM Clinical Tables API (ICD-10-CM) ---

/**
 * Validate a single ICD-10-CM code against NLM Clinical Tables API.
 * Falls back to local cache if API is slow or unavailable.
 *
 * @param code - ICD-10-CM code (with or without dots)
 * @param sb - Supabase client for local cache fallback
 * @returns Validation result with source attribution
 */
export async function validateICD10Code(
  code: string,
  sb?: SupabaseClient
): Promise<ICD10ValidationResult> {
  const normalized = normalizeICD10(code);

  // Step 1: Format check — reject obviously invalid codes
  if (!isValidICD10Format(code)) {
    return {
      code: normalized,
      valid: false,
      description: null,
      source: "format_check",
      apiAttempted: false,
    };
  }

  // Step 2: Try NLM API first (always current)
  try {
    const apiResult = await queryNLMICD10(code);
    if (apiResult !== null) {
      return {
        code: normalized,
        valid: true,
        description: apiResult.description,
        source: "nlm_api",
        apiAttempted: true,
      };
    }
    // API returned no match — code doesn't exist in ICD-10-CM
    return {
      code: normalized,
      valid: false,
      description: null,
      source: "nlm_api",
      apiAttempted: true,
    };
  } catch (err: unknown) {
    // API failed — fall back to local cache
    logger.warn("NLM ICD-10 API failed, falling back to local cache", {
      code: normalized,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Step 3: Local cache fallback
  if (sb) {
    const cacheResult = await lookupLocalICD10(normalized, sb);
    if (cacheResult !== null) {
      return {
        code: normalized,
        valid: true,
        description: cacheResult.description,
        source: "local_cache",
        apiAttempted: true,
      };
    }
  }

  // API failed AND not in local cache — we can't confirm validity
  // Return invalid with note that API was attempted
  return {
    code: normalized,
    valid: false,
    description: null,
    source: "local_cache",
    apiAttempted: true,
  };
}

/**
 * Validate multiple ICD-10-CM codes in batch.
 * Uses parallel API calls with local cache fallback.
 */
export async function validateICD10Batch(
  codes: string[],
  sb?: SupabaseClient
): Promise<BatchValidationResult> {
  const start = performance.now();
  const uniqueCodes = [...new Set(codes.map(normalizeICD10))];

  // Check local cache first for all codes (fast batch lookup)
  const localResults = new Map<string, { description: string | null }>();
  if (sb) {
    const { data } = await sb
      .from("code_icd10")
      .select("code, description")
      .in("code", uniqueCodes)
      .eq("status", "active");

    if (data) {
      for (const row of data as Array<{ code: string; description: string | null }>) {
        localResults.set(row.code, { description: row.description });
      }
    }
  }

  // For codes not in local cache, try NLM API
  const needsApi = uniqueCodes.filter((c) => !localResults.has(c));
  const apiResults = new Map<string, ICD10ValidationResult>();

  if (needsApi.length > 0) {
    // Batch API calls (parallel, max 10 concurrent)
    const batchSize = 10;
    for (let i = 0; i < needsApi.length; i += batchSize) {
      const batch = needsApi.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((code) => validateICD10Code(code))
      );
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === "fulfilled") {
          apiResults.set(batch[j], result.value);
        }
      }
    }
  }

  // Merge results
  const validated: ICD10ValidationResult[] = uniqueCodes.map((code) => {
    // Local cache hit
    const local = localResults.get(code);
    if (local) {
      return {
        code,
        valid: true,
        description: local.description,
        source: "local_cache" as const,
        apiAttempted: false,
      };
    }
    // API result
    const api = apiResults.get(code);
    if (api) return api;

    // Neither — format check only
    return {
      code,
      valid: isValidICD10Format(code),
      description: null,
      source: "format_check" as const,
      apiAttempted: false,
    };
  });

  const totalValid = validated.filter((r) => r.valid).length;
  const usedApi = validated.some((r) => r.source === "nlm_api");
  const usedCache = validated.some((r) => r.source === "local_cache");

  const durationMs = Math.round(performance.now() - start);

  return {
    validated,
    totalChecked: validated.length,
    totalValid,
    totalInvalid: validated.length - totalValid,
    validationMethod: usedApi && usedCache ? "both" : usedApi ? "nlm_api" : "local_cache",
    durationMs,
  };
}

// --- NLM RxNorm API (Medication Validation) ---

/**
 * Validate a medication name against RxNorm.
 * Returns RxCUI (RxNorm Concept Unique Identifier) if found.
 *
 * @param drugName - Medication name (e.g., "metformin", "lisinopril")
 * @returns Validation result with RxCUI
 */
export async function validateMedication(
  drugName: string
): Promise<RxNormValidationResult> {
  const trimmed = drugName.trim().toLowerCase();

  if (!trimmed || trimmed.length < 2) {
    return {
      name: drugName,
      valid: false,
      rxcui: null,
      normalizedName: null,
      source: "not_found",
    };
  }

  try {
    const result = await queryRxNorm(trimmed);
    if (result) {
      return {
        name: drugName,
        valid: true,
        rxcui: result.rxcui,
        normalizedName: result.name,
        source: "rxnorm_api",
      };
    }

    return {
      name: drugName,
      valid: false,
      rxcui: null,
      normalizedName: null,
      source: "not_found",
    };
  } catch (err: unknown) {
    logger.warn("RxNorm API failed", {
      drugName: trimmed,
      error: err instanceof Error ? err.message : String(err),
    });

    return {
      name: drugName,
      valid: false,
      rxcui: null,
      normalizedName: null,
      source: "not_found",
    };
  }
}

/**
 * Validate multiple medication names in batch.
 */
export async function validateMedicationBatch(
  drugNames: string[]
): Promise<RxNormValidationResult[]> {
  const unique = [...new Set(drugNames.map((n) => n.trim().toLowerCase()))];

  const batchSize = 5; // RxNorm is slower, smaller batches
  const results: RxNormValidationResult[] = [];

  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map((name) => validateMedication(name))
    );
    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        // Should not happen since validateMedication catches errors,
        // but handle defensively
        results.push({
          name: batch[results.length % batch.length],
          valid: false,
          rxcui: null,
          normalizedName: null,
          source: "not_found",
        });
      }
    }
  }

  return results;
}

// --- Internal: API Query Functions ---

interface NLMCodeMatch {
  code: string;
  description: string;
}

/**
 * Query NLM Clinical Tables API for an ICD-10-CM code.
 *
 * API docs: https://clinicaltables.nlm.nih.gov/apidoc/icd10cm/v3/doc.html
 * Response format: [totalCount, codeList, extraFieldsList, descriptionList]
 */
async function queryNLMICD10(code: string): Promise<NLMCodeMatch | null> {
  const normalized = normalizeICD10(code);

  // Use exact code search with sf=code to get precise matches
  const url = `${NLM_ICD10_BASE}?sf=code,name&terms=${encodeURIComponent(normalized)}&maxList=5`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`NLM API returned ${response.status}`);
    }

    // NLM response: [totalCount, codes[], null, [extra_fields[]]]
    // For icd10cm: [count, [code1, code2...], null, [[name1], [name2]...]]
    const data = await response.json() as [number, string[], null, string[][]];
    const [totalCount, codes, , extras] = data;

    if (totalCount === 0 || !codes || codes.length === 0) {
      return null;
    }

    // Find exact match (NLM returns partial matches too)
    for (let i = 0; i < codes.length; i++) {
      const resultCode = normalizeICD10(codes[i]);
      if (resultCode === normalized) {
        return {
          code: resultCode,
          description: extras?.[i]?.[0] ?? codes[i],
        };
      }
    }

    // No exact match found in results
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

interface RxNormMatch {
  rxcui: string;
  name: string;
}

/**
 * Query NLM RxNorm API to validate a drug name.
 *
 * API docs: https://lhncbc.nlm.nih.gov/RxNav/APIs/api-RxNorm.getRxcuiByString.html
 */
async function queryRxNorm(drugName: string): Promise<RxNormMatch | null> {
  const url = `${NLM_RXNORM_BASE}/rxcui.json?name=${encodeURIComponent(drugName)}&search=1`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`RxNorm API returned ${response.status}`);
    }

    const data = await response.json() as {
      idGroup?: {
        rxnormId?: string[];
        name?: string;
      };
    };

    const rxcui = data?.idGroup?.rxnormId?.[0];
    if (!rxcui || rxcui === "0") {
      // Try approximate match
      return await queryRxNormApproximate(drugName);
    }

    return {
      rxcui,
      name: data?.idGroup?.name ?? drugName,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Try approximate match via RxNorm getApproximateMatch API.
 * Catches common misspellings and brand/generic variations.
 */
async function queryRxNormApproximate(
  drugName: string
): Promise<RxNormMatch | null> {
  const url = `${NLM_RXNORM_BASE}/approximateTerm.json?term=${encodeURIComponent(drugName)}&maxEntries=1`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return null;

    const data = await response.json() as {
      approximateGroup?: {
        candidate?: Array<{ rxcui?: string; name?: string; score?: string }>;
      };
    };

    const candidate = data?.approximateGroup?.candidate?.[0];
    if (!candidate?.rxcui) return null;

    // Only accept high-confidence matches (score >= 60)
    const score = parseInt(candidate.score ?? "0", 10);
    if (score < 60) return null;

    return {
      rxcui: candidate.rxcui,
      name: candidate.name ?? drugName,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// --- Internal: Local Cache Lookup ---

interface LocalCodeRow {
  code: string;
  description: string | null;
}

/**
 * Look up an ICD-10 code in the local code_icd10 table.
 */
async function lookupLocalICD10(
  normalizedCode: string,
  sb: SupabaseClient
): Promise<LocalCodeRow | null> {
  const { data, error } = await sb
    .from("code_icd10")
    .select("code, description")
    .eq("code", normalizedCode)
    .eq("status", "active")
    .single();

  if (error || !data) return null;
  return data as LocalCodeRow;
}

// --- Exports ---

export default {
  validateICD10Code,
  validateICD10Batch,
  validateMedication,
  validateMedicationBatch,
  normalizeICD10,
  isValidICD10Format,
};
