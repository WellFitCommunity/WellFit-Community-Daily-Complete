/**
 * MCP Input Validator — Declarative argument validation for MCP tool calls (P2-1)
 *
 * Provides type-safe validators for common healthcare data types:
 * UUID, NPI, medical codes (CPT/ICD-10/HCPCS), dates, strings, arrays, enums.
 *
 * Usage:
 * ```typescript
 * const errors = validateToolArgs(toolArgs, {
 *   patient_id: { type: 'uuid', required: true },
 *   npi: { type: 'npi' },
 *   service_codes: { type: 'array', maxItems: 50, required: true },
 *   date_of_service: { type: 'date' },
 * });
 * if (errors.length > 0) return validationErrorResponse(errors, id, corsHeaders);
 * ```
 *
 * @module mcpInputValidator
 */

// =====================================================
// Regex patterns for healthcare data validation
// =====================================================

/** UUID v4 format: 8-4-4-4-12 hex chars */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** NPI: exactly 10 digits */
const NPI_REGEX = /^\d{10}$/;

/** CPT code: 5 digits (Category I) or 4 digits + letter (Category II/III) */
const CPT_REGEX = /^\d{4}[0-9A-Z]$/;

/** HCPCS Level II: 1 letter + 4 digits */
const HCPCS_REGEX = /^[A-Z]\d{4}$/;

/** ICD-10: letter + 2 digits, optional dot + up to 4 more chars */
const ICD10_REGEX = /^[A-Z]\d{2}(\.\d{1,4})?$/i;

/** ISO 8601 date: YYYY-MM-DD */
const DATE_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

/** ISO 8601 datetime: YYYY-MM-DDTHH:mm:ss with optional timezone */
const DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/;

/** US state code: 2 uppercase letters */
const STATE_REGEX = /^[A-Z]{2}$/;

/** US ZIP code: 5 digits, optional +4 */
const ZIP_REGEX = /^\d{5}(-\d{4})?$/;

// =====================================================
// Individual validators (return error string or null)
// =====================================================

export function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

export function isValidNPI(value: unknown): value is string {
  if (typeof value !== 'string' || !NPI_REGEX.test(value)) return false;
  // Luhn check (NPI uses Luhn algorithm with prefix 80840)
  const digits = ('80840' + value).split('').map(Number);
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits[i];
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

export function isValidCPT(value: unknown): value is string {
  return typeof value === 'string' && CPT_REGEX.test(value);
}

export function isValidHCPCS(value: unknown): value is string {
  return typeof value === 'string' && HCPCS_REGEX.test(value);
}

export function isValidICD10(value: unknown): value is string {
  return typeof value === 'string' && ICD10_REGEX.test(value);
}

export function isValidMedicalCode(value: unknown, system?: 'cpt' | 'hcpcs' | 'icd10'): value is string {
  if (typeof value !== 'string') return false;
  if (system === 'cpt') return CPT_REGEX.test(value);
  if (system === 'hcpcs') return HCPCS_REGEX.test(value);
  if (system === 'icd10') return ICD10_REGEX.test(value);
  // Accept any recognized medical code format
  return CPT_REGEX.test(value) || HCPCS_REGEX.test(value) || ICD10_REGEX.test(value);
}

export function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return DATE_REGEX.test(value) || DATETIME_REGEX.test(value);
}

export function isValidStateCode(value: unknown): value is string {
  return typeof value === 'string' && STATE_REGEX.test(value);
}

export function isValidZipCode(value: unknown): value is string {
  return typeof value === 'string' && ZIP_REGEX.test(value);
}

// =====================================================
// Declarative schema types
// =====================================================

interface BaseFieldSchema {
  required?: boolean;
  /** Custom error message suffix (appended to field name) */
  label?: string;
}

interface UUIDField extends BaseFieldSchema { type: 'uuid' }
interface NPIField extends BaseFieldSchema { type: 'npi' }
interface DateField extends BaseFieldSchema { type: 'date' }
interface StateField extends BaseFieldSchema { type: 'state' }
interface ZipField extends BaseFieldSchema { type: 'zip' }

interface StringField extends BaseFieldSchema {
  type: 'string';
  maxLength?: number;
  minLength?: number;
}

interface NumberField extends BaseFieldSchema {
  type: 'number';
  min?: number;
  max?: number;
  integer?: boolean;
}

interface EnumField extends BaseFieldSchema {
  type: 'enum';
  values: readonly string[];
}

interface ArrayField extends BaseFieldSchema {
  type: 'array';
  maxItems?: number;
  minItems?: number;
  /** Element type for per-element validation */
  itemType?: 'uuid' | 'npi' | 'medical_code' | 'string';
  /** For medical_code itemType: specific code system */
  codeSystem?: 'cpt' | 'hcpcs' | 'icd10';
}

interface MedicalCodeField extends BaseFieldSchema {
  type: 'medical_code';
  codeSystem?: 'cpt' | 'hcpcs' | 'icd10';
}

interface ObjectField extends BaseFieldSchema {
  type: 'object';
  /** Max JSON stringified size in bytes */
  maxSize?: number;
}

interface BooleanField extends BaseFieldSchema { type: 'boolean' }

export type FieldSchema =
  | UUIDField
  | NPIField
  | DateField
  | StateField
  | ZipField
  | StringField
  | NumberField
  | EnumField
  | ArrayField
  | MedicalCodeField
  | ObjectField
  | BooleanField;

export type ToolValidationSchema = Record<string, FieldSchema>;

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

// =====================================================
// Schema-driven validation
// =====================================================

/**
 * Validate MCP tool arguments against a declarative schema.
 * Returns an array of validation errors (empty = valid).
 */
export function validateToolArgs(
  args: Record<string, unknown> | undefined | null,
  schema: ToolValidationSchema
): ValidationError[] {
  const errors: ValidationError[] = [];
  const safeArgs = args || {};

  for (const [field, spec] of Object.entries(schema)) {
    const value = safeArgs[field];
    const label = spec.label || field;

    // Required check
    if (spec.required && (value === undefined || value === null || value === '')) {
      errors.push({ field, message: `${label} is required` });
      continue;
    }

    // Skip optional missing values
    if (value === undefined || value === null) continue;

    // Type-specific validation
    switch (spec.type) {
      case 'uuid':
        if (!isValidUUID(value)) {
          errors.push({ field, message: `${label} must be a valid UUID`, value });
        }
        break;

      case 'npi':
        if (!isValidNPI(value)) {
          errors.push({ field, message: `${label} must be a valid 10-digit NPI`, value });
        }
        break;

      case 'date':
        if (!isValidDate(value)) {
          errors.push({ field, message: `${label} must be a valid date (YYYY-MM-DD or ISO 8601)`, value });
        }
        break;

      case 'state':
        if (!isValidStateCode(value)) {
          errors.push({ field, message: `${label} must be a 2-letter US state code`, value });
        }
        break;

      case 'zip':
        if (!isValidZipCode(value)) {
          errors.push({ field, message: `${label} must be a valid ZIP code`, value });
        }
        break;

      case 'string': {
        if (typeof value !== 'string') {
          errors.push({ field, message: `${label} must be a string`, value });
          break;
        }
        if (spec.maxLength && value.length > spec.maxLength) {
          errors.push({ field, message: `${label} exceeds max length of ${spec.maxLength}`, value: `(${value.length} chars)` });
        }
        if (spec.minLength && value.length < spec.minLength) {
          errors.push({ field, message: `${label} must be at least ${spec.minLength} characters` });
        }
        break;
      }

      case 'number': {
        const num = typeof value === 'number' ? value : Number(value);
        if (isNaN(num)) {
          errors.push({ field, message: `${label} must be a number`, value });
          break;
        }
        if (spec.integer && !Number.isInteger(num)) {
          errors.push({ field, message: `${label} must be an integer`, value });
        }
        if (spec.min !== undefined && num < spec.min) {
          errors.push({ field, message: `${label} must be >= ${spec.min}`, value });
        }
        if (spec.max !== undefined && num > spec.max) {
          errors.push({ field, message: `${label} must be <= ${spec.max}`, value });
        }
        break;
      }

      case 'enum':
        if (typeof value !== 'string' || !spec.values.includes(value)) {
          errors.push({
            field,
            message: `${label} must be one of: ${spec.values.join(', ')}`,
            value
          });
        }
        break;

      case 'array': {
        if (!Array.isArray(value)) {
          errors.push({ field, message: `${label} must be an array`, value });
          break;
        }
        if (spec.maxItems && value.length > spec.maxItems) {
          errors.push({ field, message: `${label} exceeds max ${spec.maxItems} items (got ${value.length})` });
        }
        if (spec.minItems && value.length < spec.minItems) {
          errors.push({ field, message: `${label} requires at least ${spec.minItems} items (got ${value.length})` });
        }
        // Per-element validation
        if (spec.itemType && value.length > 0) {
          for (let i = 0; i < value.length; i++) {
            const item = value[i];
            if (spec.itemType === 'uuid' && !isValidUUID(item)) {
              errors.push({ field: `${field}[${i}]`, message: `${label}[${i}] must be a valid UUID`, value: item });
            } else if (spec.itemType === 'npi' && !isValidNPI(item)) {
              errors.push({ field: `${field}[${i}]`, message: `${label}[${i}] must be a valid NPI`, value: item });
            } else if (spec.itemType === 'medical_code' && !isValidMedicalCode(item, spec.codeSystem)) {
              errors.push({ field: `${field}[${i}]`, message: `${label}[${i}] must be a valid medical code`, value: item });
            } else if (spec.itemType === 'string' && typeof item !== 'string') {
              errors.push({ field: `${field}[${i}]`, message: `${label}[${i}] must be a string`, value: item });
            }
          }
        }
        break;
      }

      case 'medical_code':
        if (!isValidMedicalCode(value, spec.codeSystem)) {
          const systemLabel = spec.codeSystem ? ` (${spec.codeSystem.toUpperCase()})` : '';
          errors.push({ field, message: `${label} must be a valid medical code${systemLabel}`, value });
        }
        break;

      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          errors.push({ field, message: `${label} must be an object`, value });
          break;
        }
        if (spec.maxSize) {
          const size = JSON.stringify(value).length;
          if (size > spec.maxSize) {
            errors.push({ field, message: `${label} exceeds max size of ${spec.maxSize} bytes (got ${size})` });
          }
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push({ field, message: `${label} must be a boolean`, value });
        }
        break;
    }
  }

  return errors;
}

// =====================================================
// Response helpers
// =====================================================

/**
 * Create a JSON-RPC validation error response for MCP servers.
 */
export function validationErrorResponse(
  errors: ValidationError[],
  id: unknown,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: {
        code: -32602,
        message: "Invalid tool arguments",
        data: { validation_errors: errors.map(e => ({ field: e.field, message: e.message })) }
      },
      id
    }),
    {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    }
  );
}

/**
 * Per-tool validation schema registry. Servers define schemas per tool name
 * and call `validateForTool()` to look up and validate in one step.
 */
export type ToolSchemaRegistry = Record<string, ToolValidationSchema>;

/**
 * Validate args for a specific tool using a schema registry.
 * Returns errors array (empty = valid). Returns null if no schema is registered
 * for the tool (opt-in validation — tools without schemas pass through).
 */
export function validateForTool(
  toolName: string,
  args: Record<string, unknown> | undefined | null,
  registry: ToolSchemaRegistry
): ValidationError[] | null {
  const schema = registry[toolName];
  if (!schema) return null; // No schema = no validation (opt-in)
  return validateToolArgs(args, schema);
}
