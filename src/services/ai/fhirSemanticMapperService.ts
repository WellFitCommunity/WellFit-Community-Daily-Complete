/**
 * FHIR Semantic Mapper Service
 *
 * Frontend service for AI-powered FHIR field mapping and transformation.
 * Maps data from various sources to FHIR R4/R5 resources with:
 * - Intelligent field detection and mapping
 * - FHIR version transformation
 * - Validation against FHIR specifications
 * - AI-suggested mappings for unknown fields
 * - Extension recommendations for custom data
 *
 * Uses Claude Sonnet 4.5 for accurate clinical terminology mapping.
 *
 * @module fhirSemanticMapperService
 * @skill #50 - FHIR Semantic Mapper
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base/ServiceResult';
import { auditLogger } from '../auditLogger';

// ============================================================================
// Types
// ============================================================================

export type FHIRVersion = 'R4' | 'R4B' | 'R5' | 'STU3' | 'DSTU2';

export type ResourceType =
  | 'Patient'
  | 'Observation'
  | 'Condition'
  | 'MedicationRequest'
  | 'Procedure'
  | 'Encounter'
  | 'DiagnosticReport'
  | 'AllergyIntolerance'
  | 'Immunization'
  | 'CarePlan'
  | 'Goal'
  | 'ServiceRequest'
  | 'Other';

export type MappingConfidence = 'exact' | 'high' | 'medium' | 'low' | 'none';
export type ValidationSeverity = 'error' | 'warning' | 'information';
export type TerminologyEquivalence = 'equivalent' | 'wider' | 'narrower' | 'inexact';

export interface SourceField {
  path: string;
  value: unknown;
  dataType?: string;
  sourceSystem?: string;
}

export interface FHIRMapping {
  sourcePath: string;
  targetResource: ResourceType;
  targetPath: string;
  targetDataType: string;
  confidence: MappingConfidence;
  transformation?: string;
  rationale: string;
  validationNotes?: string[];
}

export interface ValidationIssue {
  path: string;
  severity: ValidationSeverity;
  code: string;
  message: string;
  suggestion?: string;
}

export interface TerminologyMapping {
  sourceCode: string;
  sourceSystem: string;
  targetCode: string;
  targetSystem: string;
  equivalence: TerminologyEquivalence;
}

export interface SuggestedExtension {
  url: string;
  field: string;
  rationale: string;
}

export interface MappingRequest {
  requesterId: string;
  tenantId?: string;
  sourceData: Record<string, unknown> | SourceField[];
  sourceSystem?: string;
  sourceFormat?: string;
  targetVersion: FHIRVersion;
  targetProfile?: string;
  targetResource?: ResourceType;
  includeValidation?: boolean;
  suggestExtensions?: boolean;
}

export interface MappingResult {
  mappingId: string;
  sourceSystem: string;
  targetVersion: FHIRVersion;
  targetResource: ResourceType;

  // Mappings
  mappings: FHIRMapping[];
  unmappedFields: string[];
  suggestedMappings: FHIRMapping[];

  // Generated FHIR resource
  fhirResource?: Record<string, unknown>;

  // Validation
  validationIssues: ValidationIssue[];
  isValid: boolean;
  validationScore: number;

  // Extensions
  suggestedExtensions?: SuggestedExtension[];

  // Terminology
  terminologyMappings?: TerminologyMapping[];

  // Summary
  summary: string;
  confidence: MappingConfidence;
  warnings: string[];
}

export interface MappingResponse {
  result: MappingResult;
  metadata: {
    generated_at: string;
    response_time_ms: number;
    model: string;
  };
}

export interface MappingHistoryEntry {
  mapping_id: string;
  source_system: string;
  target_version: FHIRVersion;
  target_resource: ResourceType;
  fields_total: number;
  fields_mapped: number;
  is_valid: boolean;
  validation_score: number;
  confidence: MappingConfidence;
  created_at: string;
}

// ============================================================================
// Service
// ============================================================================

export const FHIRSemanticMapperService = {
  /**
   * Map source data to a FHIR resource
   */
  async mapToFHIR(
    request: MappingRequest
  ): Promise<ServiceResult<MappingResponse>> {
    try {
      if (!request.requesterId || !request.sourceData || !request.targetVersion) {
        return failure('VALIDATION_ERROR', 'Requester ID, source data, and target version are required');
      }

      await auditLogger.info('FHIR_MAPPING_STARTED', {
        requesterId: request.requesterId.substring(0, 8) + '...',
        targetVersion: request.targetVersion,
        targetResource: request.targetResource || 'auto-detect',
        sourceSystem: request.sourceSystem || 'unknown',
        category: 'ADMIN',
      });

      const { data, error } = await supabase.functions.invoke('ai-fhir-semantic-mapper', {
        body: request,
      });

      if (error) {
        await auditLogger.error('FHIR_MAPPING_FAILED', error as Error, {
          requesterId: request.requesterId.substring(0, 8) + '...',
          category: 'ADMIN',
        });
        return failure('AI_SERVICE_ERROR', error.message || 'FHIR mapping failed');
      }

      await auditLogger.info('FHIR_MAPPING_COMPLETED', {
        requesterId: request.requesterId.substring(0, 8) + '...',
        mappingId: data.result?.mappingId,
        fieldsMapped: data.result?.mappings?.length || 0,
        fieldsUnmapped: data.result?.unmappedFields?.length || 0,
        isValid: data.result?.isValid,
        confidence: data.result?.confidence,
        category: 'ADMIN',
      });

      return success(data as MappingResponse);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      await auditLogger.error('FHIR_MAPPING_ERROR', error, {
        category: 'ADMIN',
      });
      return failure('UNKNOWN_ERROR', error.message);
    }
  },

  /**
   * Quick mapping for simple data structures
   */
  async quickMap(
    requesterId: string,
    sourceData: Record<string, unknown>,
    targetVersion: FHIRVersion = 'R4'
  ): Promise<ServiceResult<MappingResult>> {
    const result = await this.mapToFHIR({
      requesterId,
      sourceData,
      targetVersion,
      includeValidation: true,
      suggestExtensions: false,
    });

    if (!result.success) {
      return failure(result.error?.code || 'UNKNOWN_ERROR', result.error?.message || 'Quick mapping failed');
    }

    return success(result.data!.result);
  },

  /**
   * Get mapping history for a requester
   */
  async getMappingHistory(
    requesterId: string,
    days: number = 30
  ): Promise<ServiceResult<MappingHistoryEntry[]>> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('ai_fhir_mappings')
        .select('mapping_id, source_system, target_version, target_resource, fields_total, fields_mapped, is_valid, validation_score, confidence, created_at')
        .eq('requester_id', requesterId)
        .gte('created_at', startDate)
        .order('created_at', { ascending: false });

      if (error) {
        return failure('DATABASE_ERROR', error.message);
      }

      return success(data || []);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('UNKNOWN_ERROR', error.message);
    }
  },

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get styling for FHIR version badge
   */
  getVersionStyle(version: FHIRVersion): {
    bg: string;
    text: string;
    label: string;
  } {
    switch (version) {
      case 'R5':
        return { bg: 'bg-purple-100', text: 'text-purple-800', label: 'FHIR R5' };
      case 'R4B':
        return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'FHIR R4B' };
      case 'R4':
        return { bg: 'bg-green-100', text: 'text-green-800', label: 'FHIR R4' };
      case 'STU3':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'FHIR STU3' };
      case 'DSTU2':
        return { bg: 'bg-orange-100', text: 'text-orange-800', label: 'FHIR DSTU2' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Unknown' };
    }
  },

  /**
   * Get styling for resource type badge
   */
  getResourceTypeStyle(resourceType: ResourceType): {
    bg: string;
    text: string;
    icon: string;
  } {
    switch (resourceType) {
      case 'Patient':
        return { bg: 'bg-blue-100', text: 'text-blue-800', icon: '👤' };
      case 'Observation':
        return { bg: 'bg-green-100', text: 'text-green-800', icon: '📊' };
      case 'Condition':
        return { bg: 'bg-red-100', text: 'text-red-800', icon: '🏥' };
      case 'MedicationRequest':
        return { bg: 'bg-purple-100', text: 'text-purple-800', icon: '💊' };
      case 'Procedure':
        return { bg: 'bg-orange-100', text: 'text-orange-800', icon: '🔧' };
      case 'Encounter':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: '📅' };
      case 'DiagnosticReport':
        return { bg: 'bg-indigo-100', text: 'text-indigo-800', icon: '📋' };
      case 'AllergyIntolerance':
        return { bg: 'bg-pink-100', text: 'text-pink-800', icon: '⚠️' };
      case 'Immunization':
        return { bg: 'bg-teal-100', text: 'text-teal-800', icon: '💉' };
      case 'CarePlan':
        return { bg: 'bg-cyan-100', text: 'text-cyan-800', icon: '📝' };
      case 'Goal':
        return { bg: 'bg-lime-100', text: 'text-lime-800', icon: '🎯' };
      case 'ServiceRequest':
        return { bg: 'bg-amber-100', text: 'text-amber-800', icon: '📤' };
      case 'Other':
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800', icon: '📄' };
    }
  },

  /**
   * Get styling for mapping confidence
   */
  getConfidenceStyle(confidence: MappingConfidence): {
    bg: string;
    text: string;
    label: string;
    percentage: number;
  } {
    switch (confidence) {
      case 'exact':
        return { bg: 'bg-green-500', text: 'text-white', label: 'Exact Match', percentage: 100 };
      case 'high':
        return { bg: 'bg-blue-500', text: 'text-white', label: 'High Confidence', percentage: 85 };
      case 'medium':
        return { bg: 'bg-yellow-500', text: 'text-black', label: 'Medium Confidence', percentage: 65 };
      case 'low':
        return { bg: 'bg-orange-500', text: 'text-white', label: 'Low Confidence', percentage: 40 };
      case 'none':
      default:
        return { bg: 'bg-red-500', text: 'text-white', label: 'No Match', percentage: 0 };
    }
  },

  /**
   * Get styling for validation severity
   */
  getValidationSeverityStyle(severity: ValidationSeverity): {
    bg: string;
    text: string;
    icon: string;
  } {
    switch (severity) {
      case 'error':
        return { bg: 'bg-red-100', text: 'text-red-800', icon: '❌' };
      case 'warning':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: '⚠️' };
      case 'information':
      default:
        return { bg: 'bg-blue-100', text: 'text-blue-800', icon: 'ℹ️' };
    }
  },

  /**
   * Get styling for validation score
   */
  getValidationScoreStyle(score: number): {
    bg: string;
    text: string;
    label: string;
  } {
    if (score >= 90) {
      return { bg: 'bg-green-100', text: 'text-green-800', label: 'Excellent' };
    } else if (score >= 75) {
      return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Good' };
    } else if (score >= 50) {
      return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Fair' };
    } else if (score >= 25) {
      return { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Poor' };
    } else {
      return { bg: 'bg-red-100', text: 'text-red-800', label: 'Critical' };
    }
  },

  /**
   * Get styling for terminology equivalence
   */
  getEquivalenceStyle(equivalence: TerminologyEquivalence): {
    bg: string;
    text: string;
    label: string;
  } {
    switch (equivalence) {
      case 'equivalent':
        return { bg: 'bg-green-100', text: 'text-green-800', label: 'Equivalent' };
      case 'wider':
        return { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Wider' };
      case 'narrower':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Narrower' };
      case 'inexact':
      default:
        return { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Inexact' };
    }
  },

  /**
   * Get resource type display name
   */
  getResourceTypeDisplayName(resourceType: ResourceType): string {
    switch (resourceType) {
      case 'Patient':
        return 'Patient Demographics';
      case 'Observation':
        return 'Clinical Observation';
      case 'Condition':
        return 'Diagnosis/Condition';
      case 'MedicationRequest':
        return 'Medication Order';
      case 'Procedure':
        return 'Clinical Procedure';
      case 'Encounter':
        return 'Patient Encounter';
      case 'DiagnosticReport':
        return 'Diagnostic Report';
      case 'AllergyIntolerance':
        return 'Allergy/Intolerance';
      case 'Immunization':
        return 'Immunization Record';
      case 'CarePlan':
        return 'Care Plan';
      case 'Goal':
        return 'Patient Goal';
      case 'ServiceRequest':
        return 'Service Request';
      case 'Other':
      default:
        return 'Generic Resource';
    }
  },

  /**
   * Calculate mapping statistics
   */
  calculateMappingStats(result: MappingResult): {
    totalFields: number;
    mappedFields: number;
    unmappedFields: number;
    suggestedFields: number;
    mappingRate: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
  } {
    const totalFields = result.mappings.length + result.unmappedFields.length;
    const mappedFields = result.mappings.length;
    const unmappedFields = result.unmappedFields.length;
    const suggestedFields = result.suggestedMappings.length;
    const mappingRate = totalFields > 0 ? Math.round((mappedFields / totalFields) * 100) : 0;

    const errorCount = result.validationIssues.filter(i => i.severity === 'error').length;
    const warningCount = result.validationIssues.filter(i => i.severity === 'warning').length;
    const infoCount = result.validationIssues.filter(i => i.severity === 'information').length;

    return {
      totalFields,
      mappedFields,
      unmappedFields,
      suggestedFields,
      mappingRate,
      errorCount,
      warningCount,
      infoCount,
    };
  },

  /**
   * Group mappings by confidence level
   */
  groupMappingsByConfidence(mappings: FHIRMapping[]): Record<MappingConfidence, FHIRMapping[]> {
    return mappings.reduce((groups, mapping) => {
      const confidence = mapping.confidence;
      if (!groups[confidence]) {
        groups[confidence] = [];
      }
      groups[confidence].push(mapping);
      return groups;
    }, {} as Record<MappingConfidence, FHIRMapping[]>);
  },

  /**
   * Group validation issues by path
   */
  groupIssuesByPath(issues: ValidationIssue[]): Record<string, ValidationIssue[]> {
    return issues.reduce((groups, issue) => {
      const path = issue.path;
      if (!groups[path]) {
        groups[path] = [];
      }
      groups[path].push(issue);
      return groups;
    }, {} as Record<string, ValidationIssue[]>);
  },

  /**
   * Get common FHIR code systems
   */
  getCodeSystems(): Array<{ code: string; name: string; url: string }> {
    return [
      { code: 'LOINC', name: 'Logical Observation Identifiers Names and Codes', url: 'http://loinc.org' },
      { code: 'SNOMED', name: 'SNOMED CT', url: 'http://snomed.info/sct' },
      { code: 'ICD10', name: 'ICD-10-CM', url: 'http://hl7.org/fhir/sid/icd-10-cm' },
      { code: 'ICD9', name: 'ICD-9-CM', url: 'http://hl7.org/fhir/sid/icd-9-cm' },
      { code: 'CPT', name: 'Current Procedural Terminology', url: 'http://www.ama-assn.org/go/cpt' },
      { code: 'RXNORM', name: 'RxNorm', url: 'http://www.nlm.nih.gov/research/umls/rxnorm' },
      { code: 'NDC', name: 'National Drug Code', url: 'http://hl7.org/fhir/sid/ndc' },
      { code: 'CVX', name: 'Vaccine Administered', url: 'http://hl7.org/fhir/sid/cvx' },
    ];
  },

  /**
   * Get supported FHIR versions with descriptions
   */
  getSupportedVersions(): Array<{ version: FHIRVersion; name: string; releaseDate: string; status: string }> {
    return [
      { version: 'R5', name: 'FHIR Release 5', releaseDate: '2023-03', status: 'Current' },
      { version: 'R4B', name: 'FHIR Release 4B', releaseDate: '2022-05', status: 'Active' },
      { version: 'R4', name: 'FHIR Release 4', releaseDate: '2019-10', status: 'Normative' },
      { version: 'STU3', name: 'FHIR STU3', releaseDate: '2017-04', status: 'Legacy' },
      { version: 'DSTU2', name: 'FHIR DSTU2', releaseDate: '2015-10', status: 'Legacy' },
    ];
  },

  /**
   * Format FHIR path for display
   */
  formatFHIRPath(path: string): string {
    return path
      .replace(/\[(\d+)\]/g, '[$1]')
      .split('.')
      .map((segment, index) => {
        if (index === 0) return segment;
        return segment;
      })
      .join(' → ');
  },
};

export default FHIRSemanticMapperService;
