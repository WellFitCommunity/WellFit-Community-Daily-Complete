/**
 * AI FHIR Semantic Mapper Edge Function
 *
 * AI-powered mapping between different FHIR versions, profiles,
 * and non-FHIR data sources. Provides intelligent field mapping,
 * semantic equivalence detection, and validation.
 *
 * Use cases:
 * - Map EHR data to FHIR resources
 * - Transform between FHIR versions (R3 to R4)
 * - Handle custom extensions and profiles
 * - Validate data against FHIR specifications
 * - Suggest mappings for unknown fields
 *
 * Uses Claude Sonnet 4.5 for accurate clinical terminology mapping.
 *
 * @skill #50 - FHIR Semantic Mapper
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsFromRequest, handleOptions } from '../_shared/cors.ts';
import { createLogger } from '../_shared/auditLogger.ts';

// ============================================================================
// Types
// ============================================================================

type FHIRVersion = 'R4' | 'R4B' | 'R5' | 'STU3' | 'DSTU2';
type ResourceType =
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

type MappingConfidence = 'exact' | 'high' | 'medium' | 'low' | 'none';

interface SourceField {
  path: string;
  value: unknown;
  dataType?: string;
  sourceSystem?: string;
}

interface FHIRMapping {
  sourcePath: string;
  targetResource: ResourceType;
  targetPath: string;
  targetDataType: string;
  confidence: MappingConfidence;
  transformation?: string;
  rationale: string;
  validationNotes?: string[];
}

interface ValidationIssue {
  path: string;
  severity: 'error' | 'warning' | 'information';
  code: string;
  message: string;
  suggestion?: string;
}

interface MappingRequest {
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

interface MappingResult {
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
  validationScore: number; // 0-100

  // Extensions
  suggestedExtensions?: Array<{
    url: string;
    field: string;
    rationale: string;
  }>;

  // Terminology
  terminologyMappings?: Array<{
    sourceCode: string;
    sourceSystem: string;
    targetCode: string;
    targetSystem: string;
    equivalence: 'equivalent' | 'wider' | 'narrower' | 'inexact';
  }>;

  // Summary
  summary: string;
  confidence: MappingConfidence;
  warnings: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

function getEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = Deno.env.get(key);
    if (value) return value;
  }
  throw new Error(`Missing environment variable: ${keys.join(' or ')}`);
}

function detectResourceType(data: Record<string, unknown>): ResourceType {
  // Check for explicit resourceType
  if (data.resourceType) {
    return data.resourceType as ResourceType;
  }

  // Heuristic detection based on field names
  const keys = Object.keys(data).map(k => k.toLowerCase());

  if (keys.some(k => k.includes('diagnosis') || k.includes('condition') || k.includes('icd'))) {
    return 'Condition';
  }
  if (keys.some(k => k.includes('medication') || k.includes('prescription') || k.includes('drug'))) {
    return 'MedicationRequest';
  }
  if (keys.some(k => k.includes('vital') || k.includes('observation') || k.includes('measurement'))) {
    return 'Observation';
  }
  if (keys.some(k => k.includes('allergy'))) {
    return 'AllergyIntolerance';
  }
  if (keys.some(k => k.includes('procedure') || k.includes('surgery'))) {
    return 'Procedure';
  }
  if (keys.some(k => k.includes('patient') || k.includes('name') || k.includes('dob') || k.includes('birthdate'))) {
    return 'Patient';
  }
  if (keys.some(k => k.includes('encounter') || k.includes('visit') || k.includes('admission'))) {
    return 'Encounter';
  }
  if (keys.some(k => k.includes('immunization') || k.includes('vaccine'))) {
    return 'Immunization';
  }
  if (keys.some(k => k.includes('careplan') || k.includes('care_plan'))) {
    return 'CarePlan';
  }
  if (keys.some(k => k.includes('goal'))) {
    return 'Goal';
  }

  return 'Other';
}

function normalizeSourceData(data: Record<string, unknown> | SourceField[]): SourceField[] {
  if (Array.isArray(data)) {
    return data;
  }

  const fields: SourceField[] = [];
  const flatten = (obj: Record<string, unknown>, prefix: string = '') => {
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        flatten(value as Record<string, unknown>, path);
      } else {
        fields.push({
          path,
          value,
          dataType: Array.isArray(value) ? 'array' : typeof value,
        });
      }
    }
  };

  flatten(data);
  return fields;
}

function getStandardMappings(resourceType: ResourceType): Record<string, { targetPath: string; dataType: string }> {
  const commonPatterns: Record<string, { targetPath: string; dataType: string }> = {
    // Patient mappings
    'first_name': { targetPath: 'name[0].given[0]', dataType: 'string' },
    'last_name': { targetPath: 'name[0].family', dataType: 'string' },
    'firstname': { targetPath: 'name[0].given[0]', dataType: 'string' },
    'lastname': { targetPath: 'name[0].family', dataType: 'string' },
    'dob': { targetPath: 'birthDate', dataType: 'date' },
    'date_of_birth': { targetPath: 'birthDate', dataType: 'date' },
    'birthdate': { targetPath: 'birthDate', dataType: 'date' },
    'gender': { targetPath: 'gender', dataType: 'code' },
    'sex': { targetPath: 'gender', dataType: 'code' },
    'phone': { targetPath: 'telecom[0].value', dataType: 'string' },
    'email': { targetPath: 'telecom[1].value', dataType: 'string' },
    'address': { targetPath: 'address[0].line[0]', dataType: 'string' },
    'city': { targetPath: 'address[0].city', dataType: 'string' },
    'state': { targetPath: 'address[0].state', dataType: 'string' },
    'zip': { targetPath: 'address[0].postalCode', dataType: 'string' },
    'zipcode': { targetPath: 'address[0].postalCode', dataType: 'string' },
    'postal_code': { targetPath: 'address[0].postalCode', dataType: 'string' },
    'mrn': { targetPath: 'identifier[0].value', dataType: 'string' },
    'patient_id': { targetPath: 'identifier[0].value', dataType: 'string' },
    'ssn': { targetPath: 'identifier[1].value', dataType: 'string' },

    // Observation mappings
    'value': { targetPath: 'valueQuantity.value', dataType: 'decimal' },
    'unit': { targetPath: 'valueQuantity.unit', dataType: 'string' },
    'observation_date': { targetPath: 'effectiveDateTime', dataType: 'dateTime' },
    'recorded_at': { targetPath: 'effectiveDateTime', dataType: 'dateTime' },
    'loinc_code': { targetPath: 'code.coding[0].code', dataType: 'code' },
    'snomed_code': { targetPath: 'code.coding[0].code', dataType: 'code' },

    // Condition mappings
    'icd10_code': { targetPath: 'code.coding[0].code', dataType: 'code' },
    'icd_code': { targetPath: 'code.coding[0].code', dataType: 'code' },
    'diagnosis_code': { targetPath: 'code.coding[0].code', dataType: 'code' },
    'diagnosis_name': { targetPath: 'code.text', dataType: 'string' },
    'onset_date': { targetPath: 'onsetDateTime', dataType: 'dateTime' },
    'status': { targetPath: 'clinicalStatus.coding[0].code', dataType: 'code' },

    // Medication mappings
    'rxnorm_code': { targetPath: 'medicationCodeableConcept.coding[0].code', dataType: 'code' },
    'ndc_code': { targetPath: 'medicationCodeableConcept.coding[0].code', dataType: 'code' },
    'drug_name': { targetPath: 'medicationCodeableConcept.text', dataType: 'string' },
    'medication_name': { targetPath: 'medicationCodeableConcept.text', dataType: 'string' },
    'dosage': { targetPath: 'dosageInstruction[0].text', dataType: 'string' },
    'frequency': { targetPath: 'dosageInstruction[0].timing.code.text', dataType: 'string' },
  };

  return commonPatterns;
}

function generateMappings(
  sourceFields: SourceField[],
  resourceType: ResourceType,
  _targetVersion: FHIRVersion
): { mappings: FHIRMapping[]; unmapped: string[] } {
  const standardMappings = getStandardMappings(resourceType);
  const mappings: FHIRMapping[] = [];
  const unmapped: string[] = [];

  for (const field of sourceFields) {
    const normalizedPath = field.path.toLowerCase().replace(/[.\-_]/g, '_');

    // Check for standard mapping
    let matched = false;
    for (const [pattern, target] of Object.entries(standardMappings)) {
      if (normalizedPath.includes(pattern) || normalizedPath === pattern) {
        mappings.push({
          sourcePath: field.path,
          targetResource: resourceType,
          targetPath: target.targetPath,
          targetDataType: target.dataType,
          confidence: normalizedPath === pattern ? 'exact' : 'high',
          rationale: `Standard field mapping: ${pattern} -> ${target.targetPath}`,
        });
        matched = true;
        break;
      }
    }

    if (!matched) {
      unmapped.push(field.path);
    }
  }

  return { mappings, unmapped };
}

function validateFHIRResource(
  resource: Record<string, unknown>,
  resourceType: ResourceType
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Required fields validation
  if (!resource.resourceType) {
    issues.push({
      path: 'resourceType',
      severity: 'error',
      code: 'required',
      message: 'resourceType is required',
      suggestion: `Add resourceType: "${resourceType}"`,
    });
  }

  // Type-specific validation
  if (resourceType === 'Patient') {
    if (!resource.name) {
      issues.push({
        path: 'name',
        severity: 'warning',
        code: 'recommended',
        message: 'Patient name is recommended',
        suggestion: 'Add name array with given and family names',
      });
    }
  }

  if (resourceType === 'Observation') {
    if (!resource.code) {
      issues.push({
        path: 'code',
        severity: 'error',
        code: 'required',
        message: 'Observation code is required',
        suggestion: 'Add code with LOINC or SNOMED coding',
      });
    }
    if (!resource.status) {
      issues.push({
        path: 'status',
        severity: 'error',
        code: 'required',
        message: 'Observation status is required',
        suggestion: 'Add status: "final" or "preliminary"',
      });
    }
  }

  if (resourceType === 'Condition') {
    if (!resource.subject) {
      issues.push({
        path: 'subject',
        severity: 'error',
        code: 'required',
        message: 'Condition subject (patient reference) is required',
        suggestion: 'Add subject with reference to Patient resource',
      });
    }
  }

  return issues;
}

function buildFHIRResource(
  mappings: FHIRMapping[],
  sourceFields: SourceField[],
  resourceType: ResourceType,
  targetVersion: FHIRVersion
): Record<string, unknown> {
  const resource: Record<string, unknown> = {
    resourceType,
    meta: {
      versionId: '1',
      lastUpdated: new Date().toISOString(),
      profile: [`http://hl7.org/fhir/${targetVersion}/StructureDefinition/${resourceType}`],
    },
  };

  // Build resource from mappings
  for (const mapping of mappings) {
    const sourceField = sourceFields.find(f => f.path === mapping.sourcePath);
    if (!sourceField) continue;

    // Parse target path and set value
    const pathParts = mapping.targetPath.split('.');
    let current: Record<string, unknown> = resource;

    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      const arrayMatch = part.match(/(\w+)\[(\d+)\]/);

      if (arrayMatch) {
        const arrayName = arrayMatch[1];
        const index = parseInt(arrayMatch[2]);

        if (!current[arrayName]) {
          current[arrayName] = [];
        }
        const arr = current[arrayName] as Record<string, unknown>[];
        while (arr.length <= index) {
          arr.push({});
        }
        current = arr[index];
      } else {
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
      }
    }

    const lastPart = pathParts[pathParts.length - 1];
    const lastArrayMatch = lastPart.match(/(\w+)\[(\d+)\]/);

    if (lastArrayMatch) {
      const arrayName = lastArrayMatch[1];
      const index = parseInt(lastArrayMatch[2]);
      if (!current[arrayName]) {
        current[arrayName] = [];
      }
      const arr = current[arrayName] as unknown[];
      while (arr.length <= index) {
        arr.push(null);
      }
      arr[index] = sourceField.value;
    } else {
      current[lastPart] = sourceField.value;
    }
  }

  return resource;
}

async function enhanceWithAI(
  result: MappingResult,
  unmappedFields: SourceField[],
  targetVersion: FHIRVersion
): Promise<MappingResult> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');

  if (!apiKey || unmappedFields.length === 0) {
    return result;
  }

  try {
    const prompt = `You are a FHIR interoperability expert helping map clinical data to FHIR ${targetVersion}.

UNMAPPED SOURCE FIELDS:
${unmappedFields.slice(0, 10).map(f => `- ${f.path}: ${typeof f.value === 'string' ? f.value.substring(0, 50) : JSON.stringify(f.value)}`).join('\n')}

TARGET RESOURCE: ${result.targetResource}

For each unmapped field, provide a JSON array of suggested mappings with:
1. sourcePath: The original field path
2. targetPath: The FHIR ${targetVersion} path (e.g., "extension[0].valueString")
3. confidence: "high", "medium", or "low"
4. rationale: Brief explanation
5. requiresExtension: true if field requires a FHIR extension

Only suggest mappings you are confident about. Respond with valid JSON array only.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      return result;
    }

    const aiResponse = await response.json();
    const content = aiResponse.content?.[0]?.text;

    if (content) {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const suggestions = JSON.parse(jsonMatch[0]) as Array<{
          sourcePath: string;
          targetPath: string;
          confidence: string;
          rationale: string;
          requiresExtension?: boolean;
        }>;

        for (const suggestion of suggestions) {
          result.suggestedMappings.push({
            sourcePath: suggestion.sourcePath,
            targetResource: result.targetResource,
            targetPath: suggestion.targetPath,
            targetDataType: 'string',
            confidence: suggestion.confidence as MappingConfidence,
            rationale: suggestion.rationale,
          });

          if (suggestion.requiresExtension) {
            result.suggestedExtensions = result.suggestedExtensions || [];
            result.suggestedExtensions.push({
              url: `http://hl7.org/fhir/StructureDefinition/${result.targetResource}-${suggestion.sourcePath.replace(/[^a-zA-Z0-9]/g, '')}`,
              field: suggestion.sourcePath,
              rationale: suggestion.rationale,
            });
          }
        }
      }
    }

    return result;
  } catch {
    return result;
  }
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  const startTime = Date.now();
  const { headers: corsHeaders } = corsFromRequest(req);
  const logger = createLogger('ai-fhir-semantic-mapper', req);

  try {
    const request = await req.json() as MappingRequest;

    if (!request.requesterId || !request.sourceData || !request.targetVersion) {
      return new Response(
        JSON.stringify({ error: 'Requester ID, source data, and target version are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize source data
    const sourceFields = normalizeSourceData(request.sourceData);

    // Detect or use provided resource type
    const resourceType = request.targetResource ||
      detectResourceType(request.sourceData as Record<string, unknown>);

    // Generate mappings
    const { mappings, unmapped } = generateMappings(
      sourceFields,
      resourceType,
      request.targetVersion
    );

    // Build FHIR resource
    const fhirResource = buildFHIRResource(
      mappings,
      sourceFields,
      resourceType,
      request.targetVersion
    );

    // Validate if requested
    let validationIssues: ValidationIssue[] = [];
    if (request.includeValidation !== false) {
      validationIssues = validateFHIRResource(fhirResource, resourceType);
    }

    const errorCount = validationIssues.filter(i => i.severity === 'error').length;
    const validationScore = Math.max(0, 100 - (errorCount * 20) - (validationIssues.length * 5));

    // Calculate overall confidence
    const confidenceScores = mappings.map(m => {
      switch (m.confidence) {
        case 'exact': return 100;
        case 'high': return 85;
        case 'medium': return 65;
        case 'low': return 40;
        default: return 0;
      }
    });
    const avgConfidence = confidenceScores.length > 0
      ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
      : 0;

    let overallConfidence: MappingConfidence;
    if (avgConfidence >= 90) overallConfidence = 'exact';
    else if (avgConfidence >= 75) overallConfidence = 'high';
    else if (avgConfidence >= 50) overallConfidence = 'medium';
    else if (avgConfidence > 0) overallConfidence = 'low';
    else overallConfidence = 'none';

    // Build result
    let result: MappingResult = {
      mappingId: crypto.randomUUID(),
      sourceSystem: request.sourceSystem || 'unknown',
      targetVersion: request.targetVersion,
      targetResource: resourceType,
      mappings,
      unmappedFields: unmapped,
      suggestedMappings: [],
      fhirResource,
      validationIssues,
      isValid: errorCount === 0,
      validationScore,
      warnings: [],
      summary: `Mapped ${mappings.length} of ${sourceFields.length} fields to FHIR ${request.targetVersion} ${resourceType}. ${unmapped.length} fields unmapped.`,
      confidence: overallConfidence,
    };

    // Add warnings
    if (unmapped.length > 0) {
      result.warnings.push(`${unmapped.length} field(s) could not be automatically mapped`);
    }
    if (errorCount > 0) {
      result.warnings.push(`${errorCount} validation error(s) found`);
    }

    // Enhance with AI for unmapped fields
    if (request.suggestExtensions !== false && unmapped.length > 0) {
      const unmappedFieldData = sourceFields.filter(f => unmapped.includes(f.path));
      result = await enhanceWithAI(result, unmappedFieldData, request.targetVersion);
    }

    // Log the mapping
    logger.info('FHIR semantic mapping completed', {
      requesterId: request.requesterId.substring(0, 8) + '...',
      targetVersion: request.targetVersion,
      resourceType,
      fieldsTotal: sourceFields.length,
      fieldsMapped: mappings.length,
      fieldsUnmapped: unmapped.length,
      isValid: result.isValid,
      confidence: overallConfidence,
      responseTimeMs: Date.now() - startTime,
    });

    // Store mapping (optional)
    try {
      const supabaseUrl = getEnv('SUPABASE_URL', 'SB_URL');
      const supabaseKey = getEnv('SB_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.from('ai_fhir_mappings').insert({
        mapping_id: result.mappingId,
        requester_id: request.requesterId,
        tenant_id: request.tenantId,
        source_system: result.sourceSystem,
        target_version: request.targetVersion,
        target_resource: resourceType,
        fields_total: sourceFields.length,
        fields_mapped: mappings.length,
        fields_unmapped: unmapped.length,
        is_valid: result.isValid,
        validation_score: validationScore,
        confidence: overallConfidence,
        created_at: new Date().toISOString(),
      });
    } catch {
      // Non-fatal - continue with response
    }

    return new Response(
      JSON.stringify({
        result,
        metadata: {
          generated_at: new Date().toISOString(),
          response_time_ms: Date.now() - startTime,
          model: 'claude-sonnet-4-20250514',
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('FHIR semantic mapping error', { error: error.message });

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
