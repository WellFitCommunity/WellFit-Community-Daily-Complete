// =====================================================
// FHIR Code System Validator
// Validates FHIR-specific rules: code system URI matching,
// required value set bindings, UCUM units, date consistency.
// Extracted from clinicalOutputValidator.ts (600-line limit).
// =====================================================

import type { CodeSystem } from "./clinicalOutputValidator.ts";

// --- Types ---

/** FHIR coded element to validate */
export interface FhirCodedElement {
  code: string;
  system?: string;
  display?: string;
}

/** FHIR validation result */
export interface FhirValidationResult {
  valid: boolean;
  errors: FhirValidationError[];
  warnings: string[];
}

export interface FhirValidationError {
  field: string;
  code: string;
  system: string;
  reason: string;
}

// --- Constants ---

/** Known FHIR code system URIs and their expected code formats */
const FHIR_CODE_SYSTEM_MAP: Record<string, { pattern: RegExp; system: CodeSystem }> = {
  "http://hl7.org/fhir/sid/icd-10-cm": { pattern: /^[A-TV-Z]\d{2}\.?\w{0,4}$/i, system: "icd10" },
  "http://www.ama-assn.org/go/cpt": { pattern: /^\d{5}$/, system: "cpt" },
  "https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets": { pattern: /^[A-V]\d{4}$/, system: "hcpcs" },
  "http://www.nlm.nih.gov/research/umls/rxnorm": { pattern: /^\d+$/, system: "rxnorm" },
  "http://snomed.info/sct": { pattern: /^\d{6,18}$/, system: "icd10" },
  "http://loinc.org": { pattern: /^\d{1,5}-\d$/, system: "icd10" },
};

/** FHIR required value sets for common fields */
const FHIR_REQUIRED_VALUE_SETS: Record<string, string[]> = {
  "Condition.clinicalStatus": ["active", "recurrence", "relapse", "inactive", "remission", "resolved"],
  "Condition.verificationStatus": ["unconfirmed", "provisional", "differential", "confirmed", "refuted", "entered-in-error"],
  "AllergyIntolerance.clinicalStatus": ["active", "inactive", "resolved"],
  "AllergyIntolerance.verificationStatus": ["unconfirmed", "confirmed", "refuted", "entered-in-error"],
  "MedicationRequest.status": ["active", "on-hold", "cancelled", "completed", "entered-in-error", "stopped", "draft", "unknown"],
  "Observation.status": ["registered", "preliminary", "final", "amended", "corrected", "cancelled", "entered-in-error", "unknown"],
};

// --- Validators ---

/**
 * Validate FHIR-specific code system rules.
 * Checks that code format matches the declared system URI,
 * and that required value set bindings are respected.
 */
export function validateFhirCodeSystems(
  elements: Array<{ field: string; coding: FhirCodedElement }>
): FhirValidationResult {
  const errors: FhirValidationError[] = [];
  const warnings: string[] = [];

  for (const { field, coding } of elements) {
    const { code, system, display } = coding;

    // Check 1: Code system URI known and code format matches
    if (system) {
      const systemDef = FHIR_CODE_SYSTEM_MAP[system];
      if (systemDef) {
        if (!systemDef.pattern.test(code)) {
          errors.push({
            field,
            code,
            system,
            reason: `Code "${code}" does not match expected format for system ${system}`,
          });
        }
      }
      if (!systemDef && !system.startsWith("http://terminology.hl7.org/")) {
        warnings.push(`Unknown code system URI: ${system} for field ${field}`);
      }
    }

    // Check 2: Required value set bindings
    const valueSet = FHIR_REQUIRED_VALUE_SETS[field];
    if (valueSet && !valueSet.includes(code)) {
      errors.push({
        field,
        code,
        system: system ?? "unknown",
        reason: `Value "${code}" not in required value set for ${field}. Valid values: ${valueSet.join(", ")}`,
      });
    }

    // Check 3: Display text present (warning, not error)
    if (!display) {
      warnings.push(`Missing display text for ${field} code "${code}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate UCUM unit format for FHIR Quantity values.
 */
export function validateUCUMUnit(unit: string): boolean {
  const COMMON_UCUM: Set<string> = new Set([
    "kg", "g", "mg", "ug", "ng",
    "L", "dL", "mL", "uL",
    "m", "cm", "mm",
    "mmHg", "mm[Hg]",
    "kg/m2",
    "cel", "Cel", "[degF]",
    "%",
    "/min", "min", "h", "d", "wk", "mo", "a",
    "mmol/L", "mg/dL", "g/dL", "mEq/L", "U/L", "IU/L",
    "10*3/uL", "10*6/uL", "10*9/L",
    "fL", "pg",
    "{score}", "{beats}/min",
    "1",
  ]);

  return COMMON_UCUM.has(unit);
}

/**
 * Validate date consistency in FHIR resources.
 * End date must not precede start date.
 */
export function validateDateConsistency(
  startDate: string,
  endDate: string,
  fieldName: string
): FhirValidationError | null {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return {
      field: fieldName,
      code: "date",
      system: "date",
      reason: `Invalid date format in ${fieldName}`,
    };
  }

  if (end < start) {
    return {
      field: fieldName,
      code: "date",
      system: "date",
      reason: `End date (${endDate}) precedes start date (${startDate}) in ${fieldName}`,
    };
  }

  return null;
}

export default {
  validateFhirCodeSystems,
  validateUCUMUnit,
  validateDateConsistency,
};
