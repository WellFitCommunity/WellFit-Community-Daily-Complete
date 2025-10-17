/**
 * FHIR Search Parameters API
 * Implements FHIR R4 search specification
 * US Core compliant search parameters
 */

import { supabase } from '../lib/supabaseClient';
import type {
  MedicationRequest,
  Condition,
  DiagnosticReport,
  Procedure,
} from '../types/fhir';

// ============================================================================
// SEARCH PARAMETER TYPES
// ============================================================================

export interface FHIRSearchParams {
  // Common search parameters (all resources)
  _id?: string;
  _lastUpdated?: string;
  _count?: number;
  _sort?: string;
  _include?: string[];
  _revinclude?: string[];

  // Patient reference (all clinical resources)
  patient?: string;
  subject?: string;

  // Resource-specific parameters will be added dynamically
  [key: string]: any;
}

export interface FHIRSearchResult<T = any> {
  resourceType: 'Bundle';
  type: 'searchset';
  total: number;
  entry: Array<{
    fullUrl?: string;
    resource: T;
    search?: {
      mode: 'match' | 'include';
    };
  }>;
}

// ============================================================================
// SEARCH BUILDER
// ============================================================================

class FHIRSearchBuilder<T = any> {
  public query: any;
  private table: string;
  private params: FHIRSearchParams;

  constructor(table: string, params: FHIRSearchParams) {
    this.table = table;
    this.params = params;
    this.query = supabase.from(table).select('*');
  }

  /**
   * Apply patient filter
   */
  filterByPatient(): this {
    const patientId = this.params.patient || this.params.subject;
    if (patientId) {
      this.query = this.query.eq('patient_id', patientId);
    }
    return this;
  }

  /**
   * Apply ID filter
   */
  filterById(): this {
    if (this.params._id) {
      this.query = this.query.eq('id', this.params._id);
    }
    return this;
  }

  /**
   * Apply date filters
   */
  filterByDate(dateField: string): this {
    if (this.params.date) {
      const dateParam = this.params.date;

      // Support FHIR date search prefixes: eq, ne, lt, le, gt, ge, sa, eb
      if (dateParam.startsWith('eq')) {
        this.query = this.query.eq(dateField, dateParam.substring(2));
      } else if (dateParam.startsWith('lt')) {
        this.query = this.query.lt(dateField, dateParam.substring(2));
      } else if (dateParam.startsWith('le')) {
        this.query = this.query.lte(dateField, dateParam.substring(2));
      } else if (dateParam.startsWith('gt')) {
        this.query = this.query.gt(dateField, dateParam.substring(2));
      } else if (dateParam.startsWith('ge')) {
        this.query = this.query.gte(dateField, dateParam.substring(2));
      } else {
        // Default to exact match
        this.query = this.query.eq(dateField, dateParam);
      }
    }
    return this;
  }

  /**
   * Apply code filter
   */
  filterByCode(): this {
    if (this.params.code) {
      this.query = this.query.eq('code', this.params.code);
    }
    return this;
  }

  /**
   * Apply status filter
   */
  filterByStatus(): this {
    if (this.params.status) {
      this.query = this.query.eq('status', this.params.status);
    }
    return this;
  }

  /**
   * Apply category filter (for resources with array categories)
   */
  filterByCategory(): this {
    if (this.params.category) {
      this.query = this.query.contains('category', [this.params.category]);
    }
    return this;
  }

  /**
   * Apply encounter filter
   */
  filterByEncounter(): this {
    if (this.params.encounter) {
      this.query = this.query.eq('encounter_id', this.params.encounter);
    }
    return this;
  }

  /**
   * Apply clinical status filter
   */
  filterByClinicalStatus(): this {
    if (this.params['clinical-status']) {
      this.query = this.query.eq('clinical_status', this.params['clinical-status']);
    }
    return this;
  }

  /**
   * Apply verification status filter
   */
  filterByVerificationStatus(): this {
    if (this.params['verification-status']) {
      this.query = this.query.eq('verification_status', this.params['verification-status']);
    }
    return this;
  }

  /**
   * Apply sorting
   */
  applySort(defaultSort: string = 'created_at', defaultOrder: 'asc' | 'desc' = 'desc'): this {
    const sortParam = this.params._sort || defaultSort;
    const ascending = sortParam.startsWith('-') ? false : true;
    const sortField = sortParam.replace(/^-/, '');

    this.query = this.query.order(sortField, { ascending });
    return this;
  }

  /**
   * Apply pagination
   */
  applyPagination(): this {
    const count = this.params._count || 20;
    this.query = this.query.limit(count);
    return this;
  }

  /**
   * Execute search and return FHIR Bundle
   */
  async execute(): Promise<FHIRSearchResult<T>> {
    try {
      const { data, error } = await this.query;

      if (error) throw error;

      const bundle: FHIRSearchResult<T> = {
        resourceType: 'Bundle',
        type: 'searchset',
        total: data?.length || 0,
        entry: (data || []).map((resource: T) => ({
          fullUrl: this.getFullUrl(resource),
          resource,
          search: {
            mode: 'match' as const,
          },
        })),
      };

      return bundle;
    } catch (error) {
      console.error('FHIR search error:', error);
      return {
        resourceType: 'Bundle',
        type: 'searchset',
        total: 0,
        entry: [],
      };
    }
  }

  private getFullUrl(resource: any): string {
    const resourceType = this.getResourceType();
    return `${resourceType}/${resource.id}`;
  }

  private getResourceType(): string {
    const typeMap: Record<string, string> = {
      fhir_medication_requests: 'MedicationRequest',
      fhir_conditions: 'Condition',
      fhir_diagnostic_reports: 'DiagnosticReport',
      fhir_procedures: 'Procedure',
      allergy_intolerances: 'AllergyIntolerance',
    };
    return typeMap[this.table] || 'Unknown';
  }
}

// ============================================================================
// RESOURCE-SPECIFIC SEARCH IMPLEMENTATIONS
// ============================================================================

/**
 * Search MedicationRequest resources
 * US Core search parameters: patient, status, intent, authoredon
 */
export async function searchMedicationRequests(
  params: FHIRSearchParams
): Promise<FHIRSearchResult<MedicationRequest>> {
  const builder = new FHIRSearchBuilder<MedicationRequest>('fhir_medication_requests', params);

  builder
    .filterByPatient()
    .filterById()
    .filterByStatus()
    .filterByEncounter();

  // MedicationRequest-specific filters
  if (params.intent) {
    builder.query = builder.query.eq('intent', params.intent);
  }
  if (params.authoredon) {
    builder.filterByDate('authored_on');
  }
  if (params.medication) {
    builder.query = builder.query.eq('medication_code', params.medication);
  }

  return builder.applySort('authored_on').applyPagination().execute();
}

/**
 * Search Condition resources
 * US Core search parameters: patient, category, clinical-status, code, onset-date
 */
export async function searchConditions(
  params: FHIRSearchParams
): Promise<FHIRSearchResult<Condition>> {
  const builder = new FHIRSearchBuilder<Condition>('fhir_conditions', params);

  builder
    .filterByPatient()
    .filterById()
    .filterByCategory()
    .filterByClinicalStatus()
    .filterByVerificationStatus()
    .filterByCode()
    .filterByEncounter();

  // Condition-specific filters
  if (params['onset-date']) {
    params.date = params['onset-date'];
    builder.filterByDate('onset_datetime');
  }
  if (params['recorded-date']) {
    params.date = params['recorded-date'];
    builder.filterByDate('recorded_date');
  }

  return builder.applySort('recorded_date').applyPagination().execute();
}

/**
 * Search DiagnosticReport resources
 * US Core search parameters: patient, category, code, date, status
 */
export async function searchDiagnosticReports(
  params: FHIRSearchParams
): Promise<FHIRSearchResult<DiagnosticReport>> {
  const builder = new FHIRSearchBuilder<DiagnosticReport>('fhir_diagnostic_reports', params);

  builder
    .filterByPatient()
    .filterById()
    .filterByCategory()
    .filterByStatus()
    .filterByCode()
    .filterByEncounter();

  // DiagnosticReport-specific filters
  if (params.date) {
    builder.filterByDate('issued');
  }
  if (params.issued) {
    params.date = params.issued;
    builder.filterByDate('issued');
  }

  return builder.applySort('issued').applyPagination().execute();
}

/**
 * Search Procedure resources
 * US Core search parameters: patient, date, code, status
 */
export async function searchProcedures(
  params: FHIRSearchParams
): Promise<FHIRSearchResult<Procedure>> {
  const builder = new FHIRSearchBuilder<Procedure>('fhir_procedures', params);

  builder
    .filterByPatient()
    .filterById()
    .filterByStatus()
    .filterByCode()
    .filterByEncounter();

  // Procedure-specific filters
  if (params.date) {
    builder.filterByDate('performed_datetime');
  }
  if (params.performed) {
    params.date = params.performed;
    builder.filterByDate('performed_datetime');
  }

  return builder.applySort('performed_datetime').applyPagination().execute();
}

/**
 * Search AllergyIntolerance resources
 * US Core search parameters: patient, clinical-status
 */
export async function searchAllergyIntolerances(
  params: FHIRSearchParams
): Promise<FHIRSearchResult> {
  const builder = new FHIRSearchBuilder('allergy_intolerances', params);

  builder
    .filterByPatient()
    .filterById()
    .filterByClinicalStatus();

  // AllergyIntolerance-specific filters
  if (params.criticality) {
    builder.query = builder.query.eq('criticality', params.criticality);
  }
  if (params.type) {
    builder.query = builder.query.eq('allergen_type', params.type);
  }

  return builder.applySort('recorded_date').applyPagination().execute();
}

// ============================================================================
// UNIFIED SEARCH API
// ============================================================================

export const FHIRSearchAPI = {
  MedicationRequest: searchMedicationRequests,
  Condition: searchConditions,
  DiagnosticReport: searchDiagnosticReports,
  Procedure: searchProcedures,
  AllergyIntolerance: searchAllergyIntolerances,

  /**
   * Generic search function that routes to appropriate resource search
   */
  search: async (resourceType: string, params: FHIRSearchParams): Promise<FHIRSearchResult> => {
    switch (resourceType) {
      case 'MedicationRequest':
        return searchMedicationRequests(params);
      case 'Condition':
        return searchConditions(params);
      case 'DiagnosticReport':
        return searchDiagnosticReports(params);
      case 'Procedure':
        return searchProcedures(params);
      case 'AllergyIntolerance':
        return searchAllergyIntolerances(params);
      default:
        return {
          resourceType: 'Bundle',
          type: 'searchset',
          total: 0,
          entry: [],
        };
    }
  },
};

export default FHIRSearchAPI;
