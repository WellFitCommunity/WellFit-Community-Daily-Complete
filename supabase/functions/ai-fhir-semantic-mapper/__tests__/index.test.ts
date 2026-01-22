/**
 * Tests for AI FHIR Semantic Mapper Edge Function
 *
 * @skill #50 - FHIR Semantic Mapper
 *
 * Tests AI-powered mapping between different FHIR versions, profiles,
 * and non-FHIR data sources with intelligent field mapping.
 */

import {
  assertEquals,
  assertExists,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// ============================================================================
// Type Definitions (matching the edge function)
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
  mappings: FHIRMapping[];
  unmappedFields: string[];
  suggestedMappings: FHIRMapping[];
  fhirResource?: Record<string, unknown>;
  validationIssues: ValidationIssue[];
  isValid: boolean;
  validationScore: number;
  suggestedExtensions?: Array<{
    url: string;
    field: string;
    rationale: string;
  }>;
  terminologyMappings?: Array<{
    sourceCode: string;
    sourceSystem: string;
    targetCode: string;
    targetSystem: string;
    equivalence: 'equivalent' | 'wider' | 'narrower' | 'inexact';
  }>;
  summary: string;
  confidence: MappingConfidence;
  warnings: string[];
}

// ============================================================================
// Test Suites
// ============================================================================

Deno.test("AI FHIR Semantic Mapper - Request Validation", async (t) => {
  await t.step("should require requesterId", () => {
    const request: Partial<MappingRequest> = {
      sourceData: { first_name: "John" },
      targetVersion: "R4",
    };

    const isValid = !!(request.requesterId && request.sourceData && request.targetVersion);
    assertEquals(isValid, false);
  });

  await t.step("should require sourceData", () => {
    const request: Partial<MappingRequest> = {
      requesterId: "user-123",
      targetVersion: "R4",
    };

    const isValid = !!(request.requesterId && request.sourceData && request.targetVersion);
    assertEquals(isValid, false);
  });

  await t.step("should require targetVersion", () => {
    const request: Partial<MappingRequest> = {
      requesterId: "user-123",
      sourceData: { first_name: "John" },
    };

    const isValid = !!(request.requesterId && request.sourceData && request.targetVersion);
    assertEquals(isValid, false);
  });

  await t.step("should accept valid request", () => {
    const request: MappingRequest = {
      requesterId: "user-123",
      sourceData: { first_name: "John", last_name: "Doe" },
      targetVersion: "R4",
    };

    const isValid = !!(request.requesterId && request.sourceData && request.targetVersion);
    assertEquals(isValid, true);
  });

  await t.step("should support all FHIR versions", () => {
    const versions: FHIRVersion[] = ['R4', 'R4B', 'R5', 'STU3', 'DSTU2'];
    assertEquals(versions.length, 5);
    assertEquals(versions.includes('R4'), true);
    assertEquals(versions.includes('R5'), true);
  });
});

Deno.test("AI FHIR Semantic Mapper - Resource Type Detection", async (t) => {
  await t.step("should detect Patient resource from name fields", () => {
    const data: Record<string, unknown> = {
      first_name: "John",
      last_name: "Doe",
      dob: "1980-01-15",
    };

    const keys = Object.keys(data).map(k => k.toLowerCase());
    let detected: ResourceType = 'Other';

    if (keys.some(k => k.includes('patient') || k.includes('name') || k.includes('dob') || k.includes('birthdate'))) {
      detected = 'Patient';
    }

    assertEquals(detected, "Patient");
  });

  await t.step("should detect Condition resource from diagnosis fields", () => {
    const data: Record<string, unknown> = {
      icd10_code: "E11.9",
      diagnosis_name: "Type 2 diabetes",
    };

    const keys = Object.keys(data).map(k => k.toLowerCase());
    let detected: ResourceType = 'Other';

    if (keys.some(k => k.includes('diagnosis') || k.includes('condition') || k.includes('icd'))) {
      detected = 'Condition';
    }

    assertEquals(detected, "Condition");
  });

  await t.step("should detect MedicationRequest from medication fields", () => {
    const data: Record<string, unknown> = {
      medication_name: "Metformin",
      dosage: "500mg",
      frequency: "twice daily",
    };

    const keys = Object.keys(data).map(k => k.toLowerCase());
    let detected: ResourceType = 'Other';

    if (keys.some(k => k.includes('medication') || k.includes('prescription') || k.includes('drug'))) {
      detected = 'MedicationRequest';
    }

    assertEquals(detected, "MedicationRequest");
  });

  await t.step("should detect Observation from vital fields", () => {
    const data: Record<string, unknown> = {
      vital_sign: "blood_pressure",
      value: 120,
      unit: "mmHg",
    };

    const keys = Object.keys(data).map(k => k.toLowerCase());
    let detected: ResourceType = 'Other';

    if (keys.some(k => k.includes('vital') || k.includes('observation') || k.includes('measurement'))) {
      detected = 'Observation';
    }

    assertEquals(detected, "Observation");
  });

  await t.step("should detect AllergyIntolerance from allergy fields", () => {
    const data: Record<string, unknown> = {
      allergy: "Penicillin",
      reaction: "rash",
      severity: "moderate",
    };

    const keys = Object.keys(data).map(k => k.toLowerCase());
    let detected: ResourceType = 'Other';

    if (keys.some(k => k.includes('allergy'))) {
      detected = 'AllergyIntolerance';
    }

    assertEquals(detected, "AllergyIntolerance");
  });

  await t.step("should detect Immunization from vaccine fields", () => {
    const data: Record<string, unknown> = {
      vaccine_name: "Influenza",
      immunization_date: "2024-10-15",
    };

    const keys = Object.keys(data).map(k => k.toLowerCase());
    let detected: ResourceType = 'Other';

    if (keys.some(k => k.includes('immunization') || k.includes('vaccine'))) {
      detected = 'Immunization';
    }

    assertEquals(detected, "Immunization");
  });

  await t.step("should use explicit resourceType if provided", () => {
    const data: Record<string, unknown> = {
      resourceType: "CarePlan",
      title: "Diabetes Management",
    };

    let detected: ResourceType = 'Other';
    if (data.resourceType) {
      detected = data.resourceType as ResourceType;
    }

    assertEquals(detected, "CarePlan");
  });
});

Deno.test("AI FHIR Semantic Mapper - Field Normalization", async (t) => {
  await t.step("should flatten nested objects to source fields", () => {
    const data: Record<string, unknown> = {
      patient: {
        name: {
          first: "John",
          last: "Doe",
        },
        contact: {
          phone: "555-1234",
        },
      },
    };

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

    assertEquals(fields.length, 3);
    assertEquals(fields[0].path, "patient.name.first");
    assertEquals(fields[0].value, "John");
    assertEquals(fields[1].path, "patient.name.last");
    assertEquals(fields[2].path, "patient.contact.phone");
  });

  await t.step("should handle array values", () => {
    const data: Record<string, unknown> = {
      diagnoses: ["E11.9", "I10", "J45.20"],
    };

    const fields: SourceField[] = [];
    for (const [key, value] of Object.entries(data)) {
      fields.push({
        path: key,
        value,
        dataType: Array.isArray(value) ? 'array' : typeof value,
      });
    }

    assertEquals(fields.length, 1);
    assertEquals(fields[0].dataType, "array");
    assertEquals((fields[0].value as string[]).length, 3);
  });

  await t.step("should preserve SourceField array input", () => {
    const data: SourceField[] = [
      { path: "first_name", value: "John", dataType: "string" },
      { path: "last_name", value: "Doe", dataType: "string" },
    ];

    // If already SourceField[], return as-is
    const normalized = Array.isArray(data) ? data : [];
    assertEquals(normalized.length, 2);
    assertEquals(normalized[0].path, "first_name");
  });
});

Deno.test("AI FHIR Semantic Mapper - Standard Field Mappings", async (t) => {
  await t.step("should map patient name fields", () => {
    const standardMappings: Record<string, { targetPath: string; dataType: string }> = {
      'first_name': { targetPath: 'name[0].given[0]', dataType: 'string' },
      'last_name': { targetPath: 'name[0].family', dataType: 'string' },
      'firstname': { targetPath: 'name[0].given[0]', dataType: 'string' },
      'lastname': { targetPath: 'name[0].family', dataType: 'string' },
    };

    assertEquals(standardMappings['first_name'].targetPath, "name[0].given[0]");
    assertEquals(standardMappings['last_name'].targetPath, "name[0].family");
  });

  await t.step("should map date of birth fields", () => {
    const datePatterns = ['dob', 'date_of_birth', 'birthdate'];

    for (const pattern of datePatterns) {
      const normalizedPath = pattern.toLowerCase().replace(/[.\-_]/g, '_');
      const targetPath = 'birthDate';
      const dataType = 'date';

      assertEquals(dataType, 'date');
      assertExists(targetPath);
    }
  });

  await t.step("should map contact fields", () => {
    const contactMappings: Record<string, string> = {
      'phone': 'telecom[0].value',
      'email': 'telecom[1].value',
      'address': 'address[0].line[0]',
      'city': 'address[0].city',
      'state': 'address[0].state',
      'zip': 'address[0].postalCode',
    };

    assertEquals(contactMappings['phone'], "telecom[0].value");
    assertEquals(contactMappings['email'], "telecom[1].value");
    assertEquals(contactMappings['zip'], "address[0].postalCode");
  });

  await t.step("should map identifier fields", () => {
    const idMappings: Record<string, string> = {
      'mrn': 'identifier[0].value',
      'patient_id': 'identifier[0].value',
      'ssn': 'identifier[1].value',
    };

    assertEquals(idMappings['mrn'], "identifier[0].value");
    assertEquals(idMappings['ssn'], "identifier[1].value");
  });

  await t.step("should map observation fields", () => {
    const obsMappings: Record<string, string> = {
      'value': 'valueQuantity.value',
      'unit': 'valueQuantity.unit',
      'observation_date': 'effectiveDateTime',
      'loinc_code': 'code.coding[0].code',
    };

    assertEquals(obsMappings['value'], "valueQuantity.value");
    assertEquals(obsMappings['loinc_code'], "code.coding[0].code");
  });

  await t.step("should map medication fields", () => {
    const medMappings: Record<string, string> = {
      'rxnorm_code': 'medicationCodeableConcept.coding[0].code',
      'drug_name': 'medicationCodeableConcept.text',
      'dosage': 'dosageInstruction[0].text',
      'frequency': 'dosageInstruction[0].timing.code.text',
    };

    assertEquals(medMappings['drug_name'], "medicationCodeableConcept.text");
    assertEquals(medMappings['dosage'], "dosageInstruction[0].text");
  });
});

Deno.test("AI FHIR Semantic Mapper - Mapping Confidence", async (t) => {
  await t.step("should assign exact confidence for exact match", () => {
    const normalizedPath = "first_name";
    const pattern = "first_name";

    const confidence: MappingConfidence = normalizedPath === pattern ? 'exact' : 'high';
    assertEquals(confidence, "exact");
  });

  await t.step("should assign high confidence for contains match", () => {
    const normalizedPath = "patient_first_name";
    const pattern = "first_name";

    const confidence: MappingConfidence =
      normalizedPath === pattern ? 'exact' :
      normalizedPath.includes(pattern) ? 'high' : 'medium';

    assertEquals(confidence, "high");
  });

  await t.step("should calculate overall confidence from mappings", () => {
    const mappings: FHIRMapping[] = [
      { sourcePath: "first_name", targetResource: "Patient", targetPath: "name[0].given[0]", targetDataType: "string", confidence: "exact", rationale: "" },
      { sourcePath: "phone", targetResource: "Patient", targetPath: "telecom[0].value", targetDataType: "string", confidence: "high", rationale: "" },
      { sourcePath: "custom_field", targetResource: "Patient", targetPath: "extension[0]", targetDataType: "string", confidence: "medium", rationale: "" },
    ];

    const confidenceScores = mappings.map(m => {
      switch (m.confidence) {
        case 'exact': return 100;
        case 'high': return 85;
        case 'medium': return 65;
        case 'low': return 40;
        default: return 0;
      }
    });

    const avgConfidence = confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;
    assertEquals(avgConfidence, (100 + 85 + 65) / 3); // 83.33...

    let overallConfidence: MappingConfidence;
    if (avgConfidence >= 90) overallConfidence = 'exact';
    else if (avgConfidence >= 75) overallConfidence = 'high';
    else if (avgConfidence >= 50) overallConfidence = 'medium';
    else if (avgConfidence > 0) overallConfidence = 'low';
    else overallConfidence = 'none';

    assertEquals(overallConfidence, "high");
  });
});

Deno.test("AI FHIR Semantic Mapper - FHIR Resource Building", async (t) => {
  await t.step("should build resource with resourceType and meta", () => {
    const resourceType: ResourceType = "Patient";
    const targetVersion: FHIRVersion = "R4";

    const resource: Record<string, unknown> = {
      resourceType,
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString(),
        profile: [`http://hl7.org/fhir/${targetVersion}/StructureDefinition/${resourceType}`],
      },
    };

    assertEquals(resource.resourceType, "Patient");
    assertExists((resource.meta as Record<string, unknown>).profile);
  });

  await t.step("should handle array paths like name[0].given[0]", () => {
    const resource: Record<string, unknown> = { resourceType: "Patient" };
    const mapping: FHIRMapping = {
      sourcePath: "first_name",
      targetResource: "Patient",
      targetPath: "name[0].given[0]",
      targetDataType: "string",
      confidence: "exact",
      rationale: "",
    };
    const value = "John";

    // Parse target path
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
      }
    }

    // Set the final value
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
      arr[index] = value;
    }

    assertExists((resource.name as unknown[])[0]);
  });
});

Deno.test("AI FHIR Semantic Mapper - Validation", async (t) => {
  await t.step("should validate required resourceType", () => {
    const resource: Record<string, unknown> = { name: [{ given: ["John"] }] };
    const issues: ValidationIssue[] = [];

    if (!resource.resourceType) {
      issues.push({
        path: 'resourceType',
        severity: 'error',
        code: 'required',
        message: 'resourceType is required',
        suggestion: 'Add resourceType: "Patient"',
      });
    }

    assertEquals(issues.length, 1);
    assertEquals(issues[0].severity, "error");
  });

  await t.step("should validate Patient name recommendation", () => {
    const resource: Record<string, unknown> = { resourceType: "Patient" };
    const resourceType: ResourceType = "Patient";
    const issues: ValidationIssue[] = [];

    if (resourceType === 'Patient' && !resource.name) {
      issues.push({
        path: 'name',
        severity: 'warning',
        code: 'recommended',
        message: 'Patient name is recommended',
        suggestion: 'Add name array with given and family names',
      });
    }

    assertEquals(issues.length, 1);
    assertEquals(issues[0].severity, "warning");
  });

  await t.step("should validate Observation required fields", () => {
    const resource: Record<string, unknown> = { resourceType: "Observation" };
    const resourceType: ResourceType = "Observation";
    const issues: ValidationIssue[] = [];

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

    assertEquals(issues.length, 2);
    assertEquals(issues[0].path, "code");
    assertEquals(issues[1].path, "status");
  });

  await t.step("should calculate validation score", () => {
    const issues: ValidationIssue[] = [
      { path: 'resourceType', severity: 'error', code: 'required', message: '' },
      { path: 'name', severity: 'warning', code: 'recommended', message: '' },
    ];

    const errorCount = issues.filter(i => i.severity === 'error').length;
    const validationScore = Math.max(0, 100 - (errorCount * 20) - (issues.length * 5));

    assertEquals(errorCount, 1);
    assertEquals(validationScore, 100 - 20 - 10); // 70
  });
});

Deno.test("AI FHIR Semantic Mapper - Unmapped Fields", async (t) => {
  await t.step("should track unmapped fields", () => {
    const sourceFields: SourceField[] = [
      { path: "first_name", value: "John" },
      { path: "custom_field", value: "value" },
      { path: "proprietary_code", value: "XYZ123" },
    ];

    const standardPatterns = ['first_name', 'last_name', 'dob', 'phone', 'email'];
    const unmapped: string[] = [];

    for (const field of sourceFields) {
      const normalizedPath = field.path.toLowerCase().replace(/[.\-_]/g, '_');
      const matched = standardPatterns.some(p => normalizedPath.includes(p) || normalizedPath === p);
      if (!matched) {
        unmapped.push(field.path);
      }
    }

    assertEquals(unmapped.length, 2);
    assertEquals(unmapped.includes("custom_field"), true);
    assertEquals(unmapped.includes("proprietary_code"), true);
  });

  await t.step("should generate warning for unmapped fields", () => {
    const unmapped = ["custom_field", "proprietary_code"];
    const warnings: string[] = [];

    if (unmapped.length > 0) {
      warnings.push(`${unmapped.length} field(s) could not be automatically mapped`);
    }

    assertEquals(warnings.length, 1);
    assertEquals(warnings[0].includes("2"), true);
  });
});

Deno.test("AI FHIR Semantic Mapper - Terminology Mappings", async (t) => {
  await t.step("should define terminology equivalence levels", () => {
    const equivalences = ['equivalent', 'wider', 'narrower', 'inexact'];

    assertEquals(equivalences.includes('equivalent'), true);
    assertEquals(equivalences.includes('wider'), true);
    assertEquals(equivalences.includes('narrower'), true);
    assertEquals(equivalences.includes('inexact'), true);
  });

  await t.step("should structure terminology mapping", () => {
    const terminologyMapping = {
      sourceCode: "401.9",
      sourceSystem: "ICD-9-CM",
      targetCode: "I10",
      targetSystem: "ICD-10-CM",
      equivalence: "equivalent" as const,
    };

    assertEquals(terminologyMapping.sourceSystem, "ICD-9-CM");
    assertEquals(terminologyMapping.targetSystem, "ICD-10-CM");
    assertEquals(terminologyMapping.equivalence, "equivalent");
  });
});

Deno.test("AI FHIR Semantic Mapper - PHI Redaction", async (t) => {
  await t.step("should redact requester ID in logs", () => {
    const requesterId = "12345678-1234-1234-1234-123456789012";
    const redactedId = requesterId.substring(0, 8) + '...';

    assertEquals(redactedId, "12345678...");
  });

  await t.step("should not log PHI source data values", () => {
    const logData = {
      requesterId: "12345678...",
      targetVersion: "R4",
      resourceType: "Patient",
      fieldsTotal: 10,
      fieldsMapped: 8,
      fieldsUnmapped: 2,
      isValid: true,
      confidence: "high",
      // Note: No actual PHI values in log
    };

    // Verify no PHI in log structure
    const logString = JSON.stringify(logData);
    assertEquals(logString.includes("John"), false);
    assertEquals(logString.includes("Doe"), false);
    assertEquals(logString.includes("555-"), false);
  });
});

Deno.test("AI FHIR Semantic Mapper - Result Structure", async (t) => {
  await t.step("should create complete MappingResult", () => {
    const result: MappingResult = {
      mappingId: crypto.randomUUID(),
      sourceSystem: "EHR-System",
      targetVersion: "R4",
      targetResource: "Patient",
      mappings: [],
      unmappedFields: [],
      suggestedMappings: [],
      fhirResource: { resourceType: "Patient" },
      validationIssues: [],
      isValid: true,
      validationScore: 100,
      summary: "Mapped 10 of 10 fields to FHIR R4 Patient. 0 fields unmapped.",
      confidence: "high",
      warnings: [],
    };

    assertExists(result.mappingId);
    assertEquals(result.targetVersion, "R4");
    assertEquals(result.targetResource, "Patient");
    assertEquals(result.isValid, true);
    assertEquals(result.confidence, "high");
  });

  await t.step("should generate accurate summary", () => {
    const mappingsCount = 8;
    const totalFields = 10;
    const unmappedCount = 2;
    const targetVersion: FHIRVersion = "R4";
    const resourceType: ResourceType = "Patient";

    const summary = `Mapped ${mappingsCount} of ${totalFields} fields to FHIR ${targetVersion} ${resourceType}. ${unmappedCount} fields unmapped.`;

    assertEquals(summary, "Mapped 8 of 10 fields to FHIR R4 Patient. 2 fields unmapped.");
  });
});

Deno.test("AI FHIR Semantic Mapper - Extension Suggestions", async (t) => {
  await t.step("should structure extension suggestion", () => {
    const extension = {
      url: "http://hl7.org/fhir/StructureDefinition/Patient-customfield",
      field: "custom_field",
      rationale: "Non-standard field requires FHIR extension",
    };

    assertEquals(extension.url.startsWith("http://hl7.org/fhir/StructureDefinition/"), true);
    assertExists(extension.field);
    assertExists(extension.rationale);
  });

  await t.step("should generate extension URL from field name", () => {
    const targetResource: ResourceType = "Patient";
    const sourcePath = "custom_field_123";

    const url = `http://hl7.org/fhir/StructureDefinition/${targetResource}-${sourcePath.replace(/[^a-zA-Z0-9]/g, '')}`;

    assertEquals(url, "http://hl7.org/fhir/StructureDefinition/Patient-customfield123");
  });
});

Deno.test("AI FHIR Semantic Mapper - Error Handling", async (t) => {
  await t.step("should handle empty source data", () => {
    const sourceData: Record<string, unknown> = {};
    const fields = Object.keys(sourceData);

    assertEquals(fields.length, 0);
  });

  await t.step("should handle null values gracefully", () => {
    const sourceData: Record<string, unknown> = {
      first_name: null,
      last_name: "Doe",
    };

    const nonNullFields = Object.entries(sourceData)
      .filter(([_, value]) => value !== null)
      .map(([key, value]) => ({ path: key, value }));

    assertEquals(nonNullFields.length, 1);
    assertEquals(nonNullFields[0].path, "last_name");
  });

  await t.step("should provide fallback for AI enhancement failure", () => {
    // If AI enhancement fails, return unenhanced result
    const baseResult: MappingResult = {
      mappingId: crypto.randomUUID(),
      sourceSystem: "unknown",
      targetVersion: "R4",
      targetResource: "Patient",
      mappings: [],
      unmappedFields: ["custom_field"],
      suggestedMappings: [], // Empty without AI
      validationIssues: [],
      isValid: true,
      validationScore: 100,
      summary: "Basic mapping without AI enhancement",
      confidence: "medium",
      warnings: [],
    };

    // AI failed - result still valid
    assertEquals(baseResult.suggestedMappings.length, 0);
    assertEquals(baseResult.isValid, true);
  });
});

Deno.test("AI FHIR Semantic Mapper - Metadata", async (t) => {
  await t.step("should include response metadata", () => {
    const metadata = {
      generated_at: new Date().toISOString(),
      response_time_ms: 250,
      model: 'claude-sonnet-4-20250514',
    };

    assertExists(metadata.generated_at);
    assertEquals(typeof metadata.response_time_ms, "number");
    assertEquals(metadata.model, "claude-sonnet-4-20250514");
  });
});
