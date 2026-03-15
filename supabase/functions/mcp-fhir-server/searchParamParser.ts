// =====================================================
// MCP FHIR Server - FHIR R4 Search Parameter Parser
// Purpose: Parse FHIR R4-compliant search parameter formats
// Spec: https://hl7.org/fhir/R4/search.html
// =====================================================

/**
 * Parsed code parameter with optional system and code components.
 */
export interface ParsedCodeParam {
  system?: string;
  code?: string;
}

/**
 * Supported FHIR date search prefixes.
 * eq = equal, ne = not equal, lt = less than, le = less than or equal,
 * gt = greater than, ge = greater than or equal,
 * sa = starts after, eb = ends before
 */
const DATE_PREFIXES = ["eq", "ne", "lt", "le", "gt", "ge", "sa", "eb"] as const;
export type DatePrefix = typeof DATE_PREFIXES[number];

/**
 * Parsed date parameter with prefix operator and date value.
 */
export interface ParsedDateParam {
  prefix: DatePrefix;
  value: string;
}

/**
 * Parses a FHIR R4 code search parameter value.
 *
 * FHIR code parameters follow the token search format:
 *   "system|code" -> { system: "system", code: "code" }
 *   "code"        -> { code: "code" }
 *   "|code"       -> { system: "", code: "code" } (explicit empty system)
 *   "system|"     -> { system: "system" }          (any code in system)
 *
 * @param value - The raw code parameter string
 * @returns Parsed system and/or code components
 */
export function parseCodeParam(value: string): ParsedCodeParam {
  if (!value || value.trim().length === 0) {
    return {};
  }

  const trimmed = value.trim();
  const pipeIndex = trimmed.indexOf("|");

  // No pipe: treat entire value as a code
  if (pipeIndex === -1) {
    return { code: trimmed };
  }

  const system = trimmed.substring(0, pipeIndex);
  const code = trimmed.substring(pipeIndex + 1);

  const result: ParsedCodeParam = {};

  // system| -> system only (any code in that system)
  // |code -> explicit empty system match
  // system|code -> both
  if (system.length > 0) {
    result.system = system;
  } else {
    // "|code" means explicit empty system — set system to "" to distinguish
    // from "no system specified"
    result.system = "";
  }

  if (code.length > 0) {
    result.code = code;
  }

  return result;
}

/**
 * Parses a FHIR R4 date search parameter with prefix operator.
 *
 * FHIR date parameters can include a two-character prefix:
 *   "gt2026-01-01" -> { prefix: "gt", value: "2026-01-01" }
 *   "2026-01-01"   -> { prefix: "eq", value: "2026-01-01" }
 *   "le2026-03-15T12:00:00Z" -> { prefix: "le", value: "2026-03-15T12:00:00Z" }
 *
 * @param value - The raw date parameter string
 * @returns Parsed prefix and date value
 */
export function parseDatePrefix(value: string): ParsedDateParam {
  if (!value || value.trim().length === 0) {
    return { prefix: "eq", value: "" };
  }

  const trimmed = value.trim();

  // Check if the first two characters are a known prefix
  if (trimmed.length > 2) {
    const possiblePrefix = trimmed.substring(0, 2) as DatePrefix;
    if (DATE_PREFIXES.includes(possiblePrefix)) {
      return {
        prefix: possiblePrefix,
        value: trimmed.substring(2),
      };
    }
  }

  // No prefix: default to "eq"
  return { prefix: "eq", value: trimmed };
}

/**
 * Parses comma-separated values for FHIR OR searches.
 *
 * FHIR allows multiple values separated by commas to mean OR:
 *   "code1,code2,code3" -> ["code1", "code2", "code3"]
 *   "single" -> ["single"]
 *   "" -> []
 *
 * Each value is trimmed of whitespace.
 *
 * @param value - The raw comma-separated parameter string
 * @returns Array of individual values
 */
export function parseMultiValue(value: string): string[] {
  if (!value || value.trim().length === 0) {
    return [];
  }

  return value
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}
