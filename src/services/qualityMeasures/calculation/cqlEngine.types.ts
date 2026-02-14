/**
 * CQL Execution Engine — Type Definitions
 *
 * ONC Criteria: 170.315(c)(1) — CQL-based eCQM evaluation
 * Defines types for the CQL execution layer (cql-execution + cql-exec-fhir).
 */

/**
 * ELM (Expression Logical Model) library — compiled CQL.
 * This is the JSON output of the CQL-to-ELM translator.
 */
export interface ElmLibrary {
  library: {
    identifier: { id: string; version: string };
    schemaIdentifier?: { id: string; version: string };
    usings?: { def: Array<{ localIdentifier: string; uri: string; version?: string }> };
    includes?: { def: Array<{ localIdentifier: string; path: string; version: string }> };
    valueSets?: { def: Array<{ id: string; name: string }> };
    codes?: { def: Array<{ id: string; name: string; display: string }> };
    statements: {
      def: Array<{
        name: string;
        context: string;
        expression: Record<string, unknown>;
      }>;
    };
  };
}

/**
 * FHIR Patient bundle for CQL execution
 */
export interface CqlPatientBundle {
  resourceType: 'Bundle';
  type: 'collection';
  entry: Array<{
    resource: Record<string, unknown>;
  }>;
}

/**
 * Value set map for CQL code resolution
 */
export type CqlValueSetMap = Record<string, Record<string, Array<{ code: string; system: string; version?: string }>>>;

/**
 * Parameters for CQL execution
 */
export interface CqlExecutionParams {
  elmLibrary: ElmLibrary;
  patientBundle: CqlPatientBundle;
  valueSetMap?: CqlValueSetMap;
  parameters?: Record<string, unknown>;
}

/**
 * Result for a single patient from CQL execution
 */
export interface CqlPatientResult {
  patientId: string;
  statementResults: Record<string, unknown>;
}

/**
 * Full result of CQL execution
 */
export interface CqlExecutionResult {
  patientResults: CqlPatientResult[];
  libraryId: string;
  libraryVersion: string;
}
