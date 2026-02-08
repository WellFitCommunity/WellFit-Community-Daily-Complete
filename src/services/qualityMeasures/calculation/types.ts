/**
 * Quality Measures Calculation Types
 *
 * ONC Criteria: 170.315(c)(1), (c)(2), (c)(3)
 * Shared types for eCQM calculation modules.
 */

export interface MeasureDefinition {
  id: string;
  measure_id: string;
  cms_id: string;
  version: string;
  title: string;
  description: string;
  measure_type: string;
  measure_scoring: string;
  initial_population_description: string;
  denominator_description: string;
  numerator_description: string;
  reporting_year: number;
  applicable_settings: string[];
  clinical_focus: string;
  is_active: boolean;
}

export interface PatientMeasureResult {
  measureId: string;
  patientId: string;
  initialPopulation: boolean;
  denominator: boolean;
  denominatorExclusion: boolean;
  denominatorException: boolean;
  numerator: boolean;
  numeratorExclusion: boolean;
  measureObservation?: number;
  dataElementsUsed: Record<string, unknown>;
}

export interface AggregateResult {
  measureId: string;
  initialPopulationCount: number;
  denominatorCount: number;
  denominatorExclusionCount: number;
  denominatorExceptionCount: number;
  numeratorCount: number;
  numeratorExclusionCount: number;
  performanceRate: number | null;
  patientCount: number;
}

export interface CalculationOptions {
  tenantId: string;
  measureIds: string[];
  reportingPeriodStart: Date;
  reportingPeriodEnd: Date;
  patientIds?: string[];
}

export interface CalculationJob {
  id: string;
  tenantId: string;
  measureIds: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  progressPercentage: number;
  patientsProcessed: number;
  patientsTotal: number;
  resultSummary?: AggregateResult[];
  errorMessage?: string;
}

export interface PatientResultRow {
  initial_population: boolean;
  denominator: boolean;
  denominator_exclusion: boolean;
  denominator_exception: boolean;
  numerator: boolean;
  numerator_exclusion: boolean;
  measure_observation?: number;
}

export interface AggregateResultRow {
  measure_id: string;
  initial_population_count: number;
  denominator_count: number;
  denominator_exclusion_count: number;
  denominator_exception_count: number;
  numerator_count: number;
  numerator_exclusion_count: number;
  performance_rate: number | null;
  patient_count: number;
}

export interface PatientMeasureData {
  patient: {
    id: string;
    date_of_birth: string;
    gender: string;
    tenant_id: string;
    age: number;
  };
  encounters: Array<{
    id: string;
    encounter_date: string;
    encounter_type: string;
    primary_diagnosis: string;
  }>;
  conditions: Array<{
    id: string;
    code: string;
    code_system: string;
    onset_date: string;
    status: string;
  }>;
  observations: Array<{
    id: string;
    code: string;
    value: number;
    unit: string;
    effective_date: string;
  }>;
  medications: Array<{
    id: string;
    medication_code: string;
    status: string;
    authored_on: string;
  }>;
  procedures: Array<{
    id: string;
    code: string;
    performed_date: string;
    status: string;
  }>;
}
