/**
 * CQL Execution Engine Wrapper
 *
 * ONC Criteria: 170.315(c)(1) — CQL-based eCQM evaluation
 *
 * Wraps `cql-execution` and `cql-exec-fhir` with dynamic imports
 * for graceful degradation when packages are not available.
 *
 * Design: CQL-first with hand-coded fallback.
 * - If ELM library + packages available → CQL evaluation
 * - Otherwise → existing JavaScript evaluators (measureEvaluators.ts)
 */

import { auditLogger } from '../../auditLogger';
import { ServiceResult, success, failure } from '../../_base';
import type { PatientMeasureResult } from './types';
import type {
  ElmLibrary,
  CqlExecutionParams,
  CqlExecutionResult,
  CqlPatientResult,
} from './cqlEngine.types';

// =============================================================================
// CQL AVAILABILITY CHECK
// =============================================================================

let cqlAvailable: boolean | null = null;

/**
 * Check if CQL execution packages can be loaded.
 * Caches the result after first call.
 */
export async function isCqlAvailable(): Promise<boolean> {
  if (cqlAvailable !== null) return cqlAvailable;
  try {
    await import('cql-execution');
    await import('cql-exec-fhir');
    cqlAvailable = true;
  } catch (_err: unknown) {
    cqlAvailable = false;
    await auditLogger.warn('CQL_PACKAGES_NOT_AVAILABLE', {
      message: 'cql-execution or cql-exec-fhir not installed; using hand-coded evaluators',
    });
  }
  return cqlAvailable;
}

// =============================================================================
// CQL EXECUTION
// =============================================================================

/**
 * Execute a CQL ELM library against a patient FHIR bundle.
 *
 * Uses dynamic imports at the system boundary (approved per CLAUDE.md).
 */
export async function executeCql(
  params: CqlExecutionParams
): Promise<ServiceResult<CqlExecutionResult>> {
  try {
    const available = await isCqlAvailable();
    if (!available) {
      return failure('CQL_NOT_AVAILABLE', 'CQL execution packages not installed');
    }

    // Dynamic imports — system boundary, cast allowed per CLAUDE.md
    const cqlExecution = await import('cql-execution') as unknown as {
      Library: new (elm: unknown, repository?: unknown) => { source: { library: { identifier: { id: string; version: string } } } };
      Repository: new () => { resolve: (path: string, version: string) => unknown };
      CodeService: new (valueSetMap: unknown) => unknown;
      Executor: new (library: unknown, codeService: unknown, parameters?: unknown) => {
        exec: (patientSource: unknown) => { patientResults: Record<string, Record<string, unknown>> };
      };
    };

    const cqlFhir = await import('cql-exec-fhir') as unknown as {
      PatientSource: { FHIRv401: new () => { loadBundles: (bundles: unknown[]) => void } };
    };

    // Build code service from value set map
    const codeService = new cqlExecution.CodeService(params.valueSetMap || {});

    // Build library
    const library = new cqlExecution.Library(params.elmLibrary);

    // Build patient source
    const patientSource = new cqlFhir.PatientSource.FHIRv401();
    patientSource.loadBundles([params.patientBundle]);

    // Build executor
    const executor = new cqlExecution.Executor(library, codeService, params.parameters);

    // Execute
    const rawResults = executor.exec(patientSource);

    // Map results
    const patientResults: CqlPatientResult[] = Object.entries(rawResults.patientResults).map(
      ([patientId, statements]) => ({
        patientId,
        statementResults: statements as Record<string, unknown>,
      })
    );

    const libId = params.elmLibrary.library.identifier;

    return success({
      patientResults,
      libraryId: libId.id,
      libraryVersion: libId.version,
    });
  } catch (err: unknown) {
    await auditLogger.error(
      'CQL_EXECUTION_FAILED',
      err instanceof Error ? err : new Error(String(err)),
      { libraryId: params.elmLibrary?.library?.identifier?.id }
    );
    return failure('CQL_EXECUTION_ERROR', 'CQL execution failed');
  }
}

// =============================================================================
// RESULT MAPPING
// =============================================================================

/**
 * Map CQL patient result to existing PatientMeasureResult type.
 *
 * Expects standard eCQM population statement names:
 *   Initial Population, Denominator, Denominator Exclusion,
 *   Denominator Exception, Numerator, Numerator Exclusion
 */
export function cqlResultToMeasureResult(
  measureId: string,
  patientId: string,
  cqlResult: CqlPatientResult
): PatientMeasureResult {
  const s = cqlResult.statementResults;

  return {
    measureId,
    patientId,
    initialPopulation: Boolean(s['Initial Population']),
    denominator: Boolean(s['Denominator']),
    denominatorExclusion: Boolean(s['Denominator Exclusion']),
    denominatorException: Boolean(s['Denominator Exception']),
    numerator: Boolean(s['Numerator']),
    numeratorExclusion: Boolean(s['Numerator Exclusion']),
    dataElementsUsed: { source: 'cql', statementNames: Object.keys(s) },
  };
}

// =============================================================================
// ELM LIBRARY LOADING
// =============================================================================

/**
 * Load an ELM library from Supabase storage (cql-libraries bucket).
 * Returns null if not found — caller falls back to hand-coded evaluators.
 */
export async function loadElmLibrary(
  measureId: string
): Promise<ElmLibrary | null> {
  try {
    const { supabase } = await import('../../../lib/supabaseClient');
    const { data, error } = await supabase.storage
      .from('cql-libraries')
      .download(`${measureId}.json`);

    if (error || !data) return null;

    const text = await data.text();
    const parsed: unknown = JSON.parse(text);

    // Basic shape validation
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'library' in parsed
    ) {
      return parsed as ElmLibrary;
    }

    return null;
  } catch (_err: unknown) {
    return null;
  }
}
