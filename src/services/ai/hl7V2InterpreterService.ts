/**
 * HL7 v2 Message Interpreter Service
 *
 * Intelligent parsing and interpretation of ambiguous HL7 v2 messages,
 * handling non-standard implementations and legacy system variations.
 *
 * Features:
 * - Parse complex HL7 v2.x messages
 * - Identify and resolve ambiguous fields
 * - Map to standard FHIR resources
 * - Handle legacy system quirks
 * - Validate message structure
 * - Suggest corrections for malformed messages
 *
 * @module hl7V2InterpreterService
 */

import { supabase } from '../../lib/supabaseClient';
import { ServiceResult, success, failure } from '../_base';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type HL7MessageType = 'ADT' | 'ORM' | 'ORU' | 'MDM' | 'SIU' | 'DFT' | 'BAR' | 'RDE' | 'VXU' | 'ACK' | 'OTHER';
export type HL7Version = '2.1' | '2.2' | '2.3' | '2.3.1' | '2.4' | '2.5' | '2.5.1' | '2.6' | '2.7' | '2.8';

export interface HL7Segment {
  segmentId: string;
  fields: Array<{
    position: number;
    name: string;
    value: string;
    components?: string[];
    dataType: string;
    required: boolean;
    interpretation?: string;
  }>;
  rawText: string;
  valid: boolean;
  issues?: string[];
}

export interface AmbiguityDetection {
  segmentId: string;
  fieldPosition: number;
  fieldName: string;
  ambiguityType: 'multiple_meanings' | 'non_standard' | 'missing_context' | 'deprecated' | 'encoding_issue';
  description: string;
  possibleInterpretations: Array<{
    interpretation: string;
    confidence: number;
    reasoning: string;
  }>;
  recommendedInterpretation: string;
  confidence: number;
}

export interface FHIRMapping {
  resourceType: string;
  resourceId: string;
  mappedFields: Array<{
    hl7Segment: string;
    hl7Field: string;
    fhirPath: string;
    value: unknown;
    mappingConfidence: number;
  }>;
  unmappedFields: Array<{
    hl7Segment: string;
    hl7Field: string;
    reason: string;
  }>;
  resource: Record<string, unknown>;
}

export interface HL7InterpretationResult {
  messageControlId: string;
  messageType: HL7MessageType;
  triggerEvent: string;
  version: HL7Version;
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  messageTimestamp: string;
  segments: HL7Segment[];
  ambiguities: AmbiguityDetection[];
  structureValid: boolean;
  structureIssues: string[];
  contentWarnings: string[];
  fhirMappings: FHIRMapping[];
  suggestions: Array<{
    type: 'correction' | 'enhancement' | 'warning';
    segment: string;
    field?: string;
    suggestion: string;
    reason: string;
  }>;
  summary: string;
  clinicalContext: string;
  confidenceScore: number;
}

export interface HL7InterpretRequest {
  message: string;
  sourceSystem?: string;
  knownQuirks?: string[];
  mapToFHIR?: boolean;
  fhirVersion?: 'R4' | 'R5';
  resolveAmbiguities?: boolean;
  tenantId?: string;
}

export interface HL7InterpretResponse {
  result: HL7InterpretationResult;
  metadata: {
    generatedAt: string;
    model: string;
    responseTimeMs: number;
    messageSize: number;
    segmentCount: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Class
// ─────────────────────────────────────────────────────────────────────────────

export class HL7V2InterpreterService {
  /**
   * Interpret an HL7 v2 message
   */
  static async interpretMessage(
    request: HL7InterpretRequest
  ): Promise<ServiceResult<HL7InterpretResponse>> {
    try {
      if (!request.message?.trim()) {
        return failure('INVALID_INPUT', 'HL7 message is required');
      }

      // Basic validation - check for MSH segment
      if (!request.message.startsWith('MSH')) {
        return failure('INVALID_MESSAGE', 'Message must start with MSH segment');
      }

      const { data, error } = await supabase.functions.invoke('ai-hl7-v2-interpreter', {
        body: {
          message: request.message,
          sourceSystem: request.sourceSystem,
          knownQuirks: request.knownQuirks,
          mapToFHIR: request.mapToFHIR ?? true,
          fhirVersion: request.fhirVersion || 'R4',
          resolveAmbiguities: request.resolveAmbiguities ?? true,
          tenantId: request.tenantId,
        },
      });

      if (error) throw error;

      return success(data as HL7InterpretResponse);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('INTERPRETATION_FAILED', error.message, error);
    }
  }

  /**
   * Save interpretation to database
   */
  static async saveInterpretation(
    request: HL7InterpretRequest,
    response: HL7InterpretResponse
  ): Promise<ServiceResult<{ id: string }>> {
    try {
      const interpretationId = crypto.randomUUID();

      const { data, error } = await supabase
        .from('ai_hl7_interpretations')
        .insert({
          interpretation_id: interpretationId,
          message_control_id: response.result.messageControlId,
          message_type: response.result.messageType,
          trigger_event: response.result.triggerEvent,
          original_message: request.message,
          parsed_segments: response.result.segments,
          ambiguities_detected: response.result.ambiguities,
          ai_interpretations: response.result.suggestions,
          confidence_score: response.result.confidenceScore,
          fhir_mapping: response.result.fhirMappings,
          result: response.result,
          source_system: request.sourceSystem,
          tenant_id: request.tenantId,
        })
        .select('id')
        .single();

      if (error) throw error;

      return success({ id: data.id });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('SAVE_FAILED', error.message, error);
    }
  }

  /**
   * Validate HL7 message structure
   */
  static async validateStructure(
    message: string,
    _version?: HL7Version
  ): Promise<ServiceResult<{ valid: boolean; issues: string[] }>> {
    try {
      const result = await this.interpretMessage({
        message,
        mapToFHIR: false,
        resolveAmbiguities: false,
      });

      if (!result.success || !result.data) {
        return failure('VALIDATION_FAILED', result.error?.message || 'Unknown error');
      }

      return success({
        valid: result.data.result.structureValid,
        issues: result.data.result.structureIssues,
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('VALIDATION_FAILED', error.message, error);
    }
  }

  /**
   * Extract patient from HL7 message
   */
  static async extractPatient(
    message: string
  ): Promise<ServiceResult<FHIRMapping | null>> {
    try {
      const result = await this.interpretMessage({
        message,
        mapToFHIR: true,
        fhirVersion: 'R4',
      });

      if (!result.success || !result.data) {
        return failure('EXTRACTION_FAILED', result.error?.message || 'Unknown error');
      }

      const patientMapping = result.data.result.fhirMappings.find(
        (m) => m.resourceType === 'Patient'
      );

      return success(patientMapping || null);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('EXTRACTION_FAILED', error.message, error);
    }
  }

  /**
   * Get common parsing patterns for a source system
   */
  static async getSourceSystemPatterns(
    sourceSystem: string,
    tenantId: string
  ): Promise<ServiceResult<Array<{ pattern: string; frequency: number }>>> {
    try {
      const { data, error } = await supabase
        .from('ai_hl7_interpretations')
        .select('ambiguities_detected')
        .eq('tenant_id', tenantId)
        .eq('source_system', sourceSystem)
        .limit(100);

      if (error) throw error;

      // Aggregate ambiguity patterns
      const patterns: Record<string, number> = {};
      for (const row of data || []) {
        const ambiguities = row.ambiguities_detected as AmbiguityDetection[];
        for (const amb of ambiguities) {
          const key = `${amb.segmentId}:${amb.fieldPosition}:${amb.ambiguityType}`;
          patterns[key] = (patterns[key] || 0) + 1;
        }
      }

      const result = Object.entries(patterns)
        .map(([pattern, frequency]) => ({ pattern, frequency }))
        .sort((a, b) => b.frequency - a.frequency);

      return success(result);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return failure('FETCH_FAILED', error.message, error);
    }
  }

  /**
   * Quick parse MSH segment
   */
  static parseMSHQuick(message: string): {
    messageType?: string;
    triggerEvent?: string;
    messageControlId?: string;
    version?: string;
    sendingApp?: string;
    sendingFacility?: string;
  } {
    const lines = message.split(/[\r\n]+/);
    const mshLine = lines.find((l) => l.startsWith('MSH'));
    if (!mshLine) return {};

    const fieldSeparator = mshLine.charAt(3);
    const fields = mshLine.split(fieldSeparator);

    return {
      sendingApp: fields[2],
      sendingFacility: fields[3],
      messageType: fields[8]?.split('^')[0],
      triggerEvent: fields[8]?.split('^')[1],
      messageControlId: fields[9],
      version: fields[11],
    };
  }
}

export default HL7V2InterpreterService;
