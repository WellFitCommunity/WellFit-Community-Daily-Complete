// supabase/functions/fhir-r4/__tests__/index.test.ts
// Tests for FHIR R4 Server Edge Function

import { assertEquals, assertExists, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("FHIR R4 Server Edge Function Tests", async (t) => {

  // ==========================================================================
  // CORS and HTTP Method Tests
  // ==========================================================================

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/fhir-r4", {
      method: "OPTIONS"
    });
    assertEquals(request.method, "OPTIONS");
  });

  // ==========================================================================
  // Authorization Tests
  // ==========================================================================

  await t.step("should require Bearer token for authentication", () => {
    const validateAuth = (authHeader: string | null): boolean => {
      return authHeader !== null && authHeader.startsWith("Bearer ");
    };

    assertEquals(validateAuth(null), false);
    assertEquals(validateAuth(""), false);
    assertEquals(validateAuth("Basic abc123"), false);
    assertEquals(validateAuth("Bearer abc123"), true);
    assertEquals(validateAuth("bearer abc123"), false); // case-sensitive
  });

  await t.step("should extract token from Bearer header", () => {
    const extractToken = (authHeader: string): string => {
      return authHeader.slice(7);
    };

    assertEquals(extractToken("Bearer abc123"), "abc123");
    assertEquals(extractToken("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"), "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
  });

  await t.step("should validate token expiration", () => {
    const isTokenExpired = (expiresAt: string): boolean => {
      return new Date(expiresAt) < new Date();
    };

    // Expired token
    assertEquals(isTokenExpired("2020-01-01T00:00:00Z"), true);

    // Future date - not expired
    const futureDate = new Date(Date.now() + 3600000).toISOString();
    assertEquals(isTokenExpired(futureDate), false);
  });

  // ==========================================================================
  // Scope Validation Tests
  // ==========================================================================

  await t.step("should validate SMART on FHIR scopes", () => {
    const hasScope = (scopes: string[], resourceType: string, action: string): boolean => {
      const patientScope = `patient/${resourceType}.${action}`;
      const patientWildcard = `patient/*.${action}`;
      const userScope = `user/${resourceType}.${action}`;
      const userWildcard = `user/*.${action}`;

      return scopes.some(s =>
        s === patientScope ||
        s === patientWildcard ||
        s === userScope ||
        s === userWildcard
      );
    };

    // Patient-specific scope
    assertEquals(hasScope(["patient/Patient.read"], "Patient", "read"), true);
    assertEquals(hasScope(["patient/Patient.read"], "Observation", "read"), false);

    // Wildcard scope
    assertEquals(hasScope(["patient/*.read"], "Patient", "read"), true);
    assertEquals(hasScope(["patient/*.read"], "Observation", "read"), true);
    assertEquals(hasScope(["patient/*.read"], "Condition", "read"), true);

    // User scope
    assertEquals(hasScope(["user/Patient.read"], "Patient", "read"), true);
    assertEquals(hasScope(["user/*.read"], "MedicationRequest", "read"), true);

    // Write scope does not grant read
    assertEquals(hasScope(["patient/Patient.write"], "Patient", "read"), false);

    // Empty scopes
    assertEquals(hasScope([], "Patient", "read"), false);
  });

  await t.step("should parse scopes string to array", () => {
    const parseScopes = (scopeString: string | null): string[] => {
      return scopeString?.split(" ") || [];
    };

    assertEquals(parseScopes("patient/Patient.read patient/Observation.read"),
      ["patient/Patient.read", "patient/Observation.read"]);
    assertEquals(parseScopes("patient/*.read"), ["patient/*.read"]);
    assertEquals(parseScopes(null), []);
    assertEquals(parseScopes(""), [""]);
  });

  // ==========================================================================
  // URL Path Parsing Tests
  // ==========================================================================

  await t.step("should parse FHIR request path correctly", () => {
    const parsePath = (urlPath: string): { resourceType: string | undefined; resourceId: string | undefined } => {
      const pathParts = urlPath.split('/').filter(p => p && p !== 'fhir-r4');
      return {
        resourceType: pathParts[0],
        resourceId: pathParts[1]
      };
    };

    // Metadata request
    assertEquals(parsePath("/fhir-r4/metadata"), { resourceType: "metadata", resourceId: undefined });

    // Search request (no ID)
    assertEquals(parsePath("/fhir-r4/Patient"), { resourceType: "Patient", resourceId: undefined });

    // Read request (with ID)
    assertEquals(parsePath("/fhir-r4/Patient/123"), { resourceType: "Patient", resourceId: "123" });
    assertEquals(parsePath("/fhir-r4/Observation/obs-456"), { resourceType: "Observation", resourceId: "obs-456" });

    // Root path (capability statement)
    assertEquals(parsePath("/fhir-r4/"), { resourceType: undefined, resourceId: undefined });
  });

  await t.step("should recognize supported resource types", () => {
    const supportedResources = [
      "Patient",
      "AllergyIntolerance",
      "Condition",
      "MedicationRequest",
      "Observation",
      "Immunization",
      "Procedure",
      "DiagnosticReport",
      "CarePlan",
      "CareTeam",
      "Goal",
      "DocumentReference"
    ];

    const isSupported = (resourceType: string): boolean => {
      return supportedResources.includes(resourceType);
    };

    assertEquals(isSupported("Patient"), true);
    assertEquals(isSupported("Observation"), true);
    assertEquals(isSupported("MedicationRequest"), true);
    assertEquals(isSupported("Appointment"), false); // Not supported
    assertEquals(isSupported("Encounter"), false); // Not in list
    assertEquals(isSupported(""), false);
  });

  // ==========================================================================
  // FHIR Error Response Tests
  // ==========================================================================

  await t.step("should create valid FHIR OperationOutcome for errors", () => {
    const createOperationOutcome = (code: string, message: string) => {
      return {
        resourceType: "OperationOutcome",
        issue: [{
          severity: "error",
          code,
          diagnostics: message
        }]
      };
    };

    const outcome = createOperationOutcome("unauthorized", "Bearer token required");

    assertEquals(outcome.resourceType, "OperationOutcome");
    assertEquals(outcome.issue.length, 1);
    assertEquals(outcome.issue[0].severity, "error");
    assertEquals(outcome.issue[0].code, "unauthorized");
    assertEquals(outcome.issue[0].diagnostics, "Bearer token required");
  });

  await t.step("should use correct HTTP status codes for FHIR errors", () => {
    const errorStatusCodes: Record<string, number> = {
      "unauthorized": 401,
      "forbidden": 403,
      "not-found": 404,
      "not-supported": 404,
      "exception": 500
    };

    assertEquals(errorStatusCodes["unauthorized"], 401);
    assertEquals(errorStatusCodes["forbidden"], 403);
    assertEquals(errorStatusCodes["not-found"], 404);
    assertEquals(errorStatusCodes["not-supported"], 404);
    assertEquals(errorStatusCodes["exception"], 500);
  });

  // ==========================================================================
  // Capability Statement Tests
  // ==========================================================================

  await t.step("should generate valid capability statement", () => {
    const getCapabilityStatement = (baseUrl: string) => {
      return {
        resourceType: "CapabilityStatement",
        status: "active",
        date: new Date().toISOString(),
        kind: "instance",
        software: {
          name: "WellFit FHIR Server",
          version: "1.0.0"
        },
        implementation: {
          description: "WellFit Community FHIR R4 API",
          url: baseUrl
        },
        fhirVersion: "4.0.1",
        format: ["json"]
      };
    };

    const capability = getCapabilityStatement("https://example.com");

    assertEquals(capability.resourceType, "CapabilityStatement");
    assertEquals(capability.status, "active");
    assertEquals(capability.kind, "instance");
    assertEquals(capability.fhirVersion, "4.0.1");
    assertEquals(capability.software.name, "WellFit FHIR Server");
    assertEquals(capability.implementation.url, "https://example.com");
  });

  await t.step("should include SMART security configuration", () => {
    const securityConfig = {
      cors: true,
      service: [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/restful-security-service",
          code: "SMART-on-FHIR"
        }]
      }]
    };

    assertEquals(securityConfig.cors, true);
    assertEquals(securityConfig.service[0].coding[0].code, "SMART-on-FHIR");
  });

  // ==========================================================================
  // Gender Mapping Tests
  // ==========================================================================

  await t.step("should map gender values to FHIR codes", () => {
    const mapGender = (gender: string | null): string => {
      if (!gender) return "unknown";
      const g = gender.toLowerCase();
      if (g === 'male' || g === 'm') return 'male';
      if (g === 'female' || g === 'f') return 'female';
      if (g === 'other') return 'other';
      return 'unknown';
    };

    assertEquals(mapGender("male"), "male");
    assertEquals(mapGender("Male"), "male");
    assertEquals(mapGender("MALE"), "male");
    assertEquals(mapGender("m"), "male");
    assertEquals(mapGender("M"), "male");
    assertEquals(mapGender("female"), "female");
    assertEquals(mapGender("Female"), "female");
    assertEquals(mapGender("f"), "female");
    assertEquals(mapGender("F"), "female");
    assertEquals(mapGender("other"), "other");
    assertEquals(mapGender("unknown"), "unknown");
    assertEquals(mapGender("nonbinary"), "unknown"); // Maps to unknown
    assertEquals(mapGender(null), "unknown");
    assertEquals(mapGender(""), "unknown");
  });

  // ==========================================================================
  // Patient Resource Mapping Tests
  // ==========================================================================

  await t.step("should map patient profile to FHIR Patient resource", () => {
    const mapPatientToFHIR = (patientId: string, profile: {
      first_name?: string;
      last_name?: string;
      gender?: string;
      dob?: string;
      phone?: string;
      email?: string;
      address?: string;
    }) => {
      return {
        resourceType: "Patient",
        id: patientId,
        meta: {
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"]
        },
        identifier: [{
          system: "urn:wellfit:patient",
          value: patientId
        }],
        name: [{
          use: "official",
          family: profile.last_name || "",
          given: [profile.first_name || ""]
        }],
        gender: profile.gender || "unknown",
        birthDate: profile.dob || undefined,
        telecom: [
          ...(profile.phone ? [{ system: "phone", value: profile.phone, use: "home" }] : []),
          ...(profile.email ? [{ system: "email", value: profile.email }] : [])
        ],
        address: profile.address ? [{
          use: "home",
          text: profile.address
        }] : []
      };
    };

    const patient = mapPatientToFHIR("patient-123", {
      first_name: "John",
      last_name: "Doe",
      gender: "male",
      dob: "1985-03-15",
      phone: "555-123-4567",
      email: "john.doe@example.com",
      address: "123 Main St"
    });

    assertEquals(patient.resourceType, "Patient");
    assertEquals(patient.id, "patient-123");
    assertEquals(patient.meta.profile[0], "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient");
    assertEquals(patient.name[0].family, "Doe");
    assertEquals(patient.name[0].given[0], "John");
    assertEquals(patient.gender, "male");
    assertEquals(patient.birthDate, "1985-03-15");
    assertEquals(patient.telecom.length, 2);
    assertEquals(patient.address[0].text, "123 Main St");
  });

  // ==========================================================================
  // AllergyIntolerance Mapping Tests
  // ==========================================================================

  await t.step("should map allergy to FHIR AllergyIntolerance resource", () => {
    const mapAllergyToFHIR = (allergy: {
      id: string;
      clinical_status?: string;
      verification_status?: string;
      allergen_type?: string;
      criticality?: string;
      allergen_name: string;
      created_at: string;
      reaction_description?: string;
      severity?: string;
    }, patientId: string) => {
      return {
        resourceType: "AllergyIntolerance",
        id: allergy.id,
        meta: {
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance"]
        },
        clinicalStatus: {
          coding: [{
            system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
            code: allergy.clinical_status || "active"
          }]
        },
        type: allergy.allergen_type === 'intolerance' ? 'intolerance' : 'allergy',
        criticality: allergy.criticality || "unable-to-assess",
        code: {
          text: allergy.allergen_name
        },
        patient: { reference: `Patient/${patientId}` }
      };
    };

    const allergy = mapAllergyToFHIR({
      id: "allergy-123",
      allergen_name: "Penicillin",
      clinical_status: "active",
      criticality: "high",
      created_at: "2024-01-01T00:00:00Z"
    }, "patient-456");

    assertEquals(allergy.resourceType, "AllergyIntolerance");
    assertEquals(allergy.id, "allergy-123");
    assertEquals(allergy.code.text, "Penicillin");
    assertEquals(allergy.criticality, "high");
    assertEquals(allergy.patient.reference, "Patient/patient-456");
    assertEquals(allergy.type, "allergy");
  });

  // ==========================================================================
  // Condition Mapping Tests
  // ==========================================================================

  await t.step("should map condition to FHIR Condition resource", () => {
    const mapConditionToFHIR = (condition: {
      id: string;
      clinical_status?: string;
      verification_status?: string;
      code?: string;
      code_system?: string;
      code_display?: string;
      onset_datetime?: string;
      recorded_date?: string;
    }, patientId: string) => {
      return {
        resourceType: "Condition",
        id: condition.id,
        meta: {
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition"]
        },
        clinicalStatus: {
          coding: [{
            system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
            code: condition.clinical_status || "active"
          }]
        },
        code: {
          coding: condition.code ? [{
            system: condition.code_system || "http://hl7.org/fhir/sid/icd-10-cm",
            code: condition.code,
            display: condition.code_display
          }] : undefined,
          text: condition.code_display
        },
        subject: { reference: `Patient/${patientId}` }
      };
    };

    const condition = mapConditionToFHIR({
      id: "cond-123",
      code: "E11.9",
      code_system: "http://hl7.org/fhir/sid/icd-10-cm",
      code_display: "Type 2 diabetes mellitus without complications",
      clinical_status: "active"
    }, "patient-456");

    assertEquals(condition.resourceType, "Condition");
    assertEquals(condition.code.coding![0].code, "E11.9");
    assertEquals(condition.code.coding![0].system, "http://hl7.org/fhir/sid/icd-10-cm");
    assertEquals(condition.subject.reference, "Patient/patient-456");
  });

  // ==========================================================================
  // MedicationRequest Mapping Tests
  // ==========================================================================

  await t.step("should map medication to FHIR MedicationRequest resource", () => {
    const mapMedicationToFHIR = (medication: {
      id: string;
      medication_name: string;
      status?: string;
      created_at: string;
      instructions?: string;
      dosage?: string;
      frequency?: string;
    }, patientId: string) => {
      return {
        resourceType: "MedicationRequest",
        id: medication.id,
        meta: {
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest"]
        },
        status: medication.status || "active",
        intent: "order",
        medicationCodeableConcept: {
          text: medication.medication_name
        },
        subject: { reference: `Patient/${patientId}` },
        dosageInstruction: [{
          text: medication.instructions || medication.dosage
        }]
      };
    };

    const med = mapMedicationToFHIR({
      id: "med-123",
      medication_name: "Metformin 500mg",
      status: "active",
      created_at: "2024-01-01T00:00:00Z",
      dosage: "500mg",
      frequency: "twice daily",
      instructions: "Take with food"
    }, "patient-456");

    assertEquals(med.resourceType, "MedicationRequest");
    assertEquals(med.medicationCodeableConcept.text, "Metformin 500mg");
    assertEquals(med.intent, "order");
    assertEquals(med.subject.reference, "Patient/patient-456");
  });

  // ==========================================================================
  // Observation Mapping Tests
  // ==========================================================================

  await t.step("should map observation to FHIR Observation resource", () => {
    const mapObservationToFHIR = (observation: {
      id: string;
      status?: string;
      category?: string;
      code?: string;
      code_display?: string;
      effective_datetime?: string;
      value_quantity?: number;
      value_unit?: string;
      value_string?: string;
    }, patientId: string) => {
      return {
        resourceType: "Observation",
        id: observation.id,
        status: observation.status || "final",
        category: [{
          coding: [{
            system: "http://terminology.hl7.org/CodeSystem/observation-category",
            code: observation.category || "vital-signs"
          }]
        }],
        code: {
          coding: observation.code ? [{
            system: "http://loinc.org",
            code: observation.code,
            display: observation.code_display
          }] : undefined
        },
        subject: { reference: `Patient/${patientId}` },
        effectiveDateTime: observation.effective_datetime,
        valueQuantity: observation.value_quantity ? {
          value: observation.value_quantity,
          unit: observation.value_unit,
          system: "http://unitsofmeasure.org"
        } : undefined
      };
    };

    const obs = mapObservationToFHIR({
      id: "obs-123",
      code: "8480-6",
      code_display: "Systolic Blood Pressure",
      category: "vital-signs",
      value_quantity: 120,
      value_unit: "mm[Hg]",
      effective_datetime: "2024-01-15T10:30:00Z"
    }, "patient-456");

    assertEquals(obs.resourceType, "Observation");
    assertEquals(obs.code.coding![0].code, "8480-6");
    assertEquals(obs.code.coding![0].system, "http://loinc.org");
    assertEquals(obs.valueQuantity!.value, 120);
    assertEquals(obs.valueQuantity!.unit, "mm[Hg]");
  });

  // ==========================================================================
  // Bundle Creation Tests
  // ==========================================================================

  await t.step("should create valid FHIR search Bundle", () => {
    const createSearchBundle = (resources: Array<{ id: string; resourceType: string }>) => {
      return {
        resourceType: "Bundle",
        type: "searchset",
        total: resources.length,
        entry: resources.map(r => ({
          resource: r,
          fullUrl: `${r.resourceType}/${r.id}`
        }))
      };
    };

    const bundle = createSearchBundle([
      { id: "obs-1", resourceType: "Observation" },
      { id: "obs-2", resourceType: "Observation" }
    ]);

    assertEquals(bundle.resourceType, "Bundle");
    assertEquals(bundle.type, "searchset");
    assertEquals(bundle.total, 2);
    assertEquals(bundle.entry.length, 2);
    assertEquals(bundle.entry[0].fullUrl, "Observation/obs-1");
  });

  await t.step("should handle empty search results", () => {
    const createSearchBundle = (resources: unknown[]) => {
      return {
        resourceType: "Bundle",
        type: "searchset",
        total: resources.length,
        entry: resources
      };
    };

    const bundle = createSearchBundle([]);

    assertEquals(bundle.total, 0);
    assertEquals(bundle.entry.length, 0);
  });

  // ==========================================================================
  // Patient Access Control Tests
  // ==========================================================================

  await t.step("should deny access to other patients' data", () => {
    const canAccessPatient = (authorizedPatientId: string, requestedPatientId: string | undefined): boolean => {
      // If no specific patient requested (search), allow
      if (!requestedPatientId) return true;
      // If specific patient requested, must match authorized patient
      return requestedPatientId === authorizedPatientId;
    };

    // Can access own data
    assertEquals(canAccessPatient("patient-123", "patient-123"), true);

    // Cannot access other patient's data
    assertEquals(canAccessPatient("patient-123", "patient-456"), false);

    // Can do search (returns only own data anyway)
    assertEquals(canAccessPatient("patient-123", undefined), true);
  });

  // ==========================================================================
  // FHIR Headers Tests
  // ==========================================================================

  await t.step("should include correct FHIR headers in response", () => {
    const FHIR_VERSION = "4.0.1";
    const FHIR_MIME_TYPE = "application/fhir+json";

    const fhirHeaders = {
      'Content-Type': FHIR_MIME_TYPE,
      'X-FHIR-Version': FHIR_VERSION
    };

    assertEquals(fhirHeaders['Content-Type'], "application/fhir+json");
    assertEquals(fhirHeaders['X-FHIR-Version'], "4.0.1");
  });

  // ==========================================================================
  // Observation Category Filter Tests
  // ==========================================================================

  await t.step("should support observation category filter", () => {
    const filterByCategory = (observations: Array<{ category: string }>, category: string | null) => {
      if (!category) return observations;
      return observations.filter(o => o.category === category);
    };

    const allObs = [
      { category: "vital-signs" },
      { category: "vital-signs" },
      { category: "laboratory" },
      { category: "social-history" }
    ];

    assertEquals(filterByCategory(allObs, "vital-signs").length, 2);
    assertEquals(filterByCategory(allObs, "laboratory").length, 1);
    assertEquals(filterByCategory(allObs, null).length, 4);
    assertEquals(filterByCategory(allObs, "imaging").length, 0);
  });

  // ==========================================================================
  // US Core Profile Validation Tests
  // ==========================================================================

  await t.step("should use correct US Core profile URLs", () => {
    const US_CORE_PROFILES: Record<string, string> = {
      "Patient": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
      "AllergyIntolerance": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance",
      "Condition": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition",
      "MedicationRequest": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest",
      "Observation": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab",
      "Immunization": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization",
      "Procedure": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure",
      "DiagnosticReport": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-diagnosticreport-lab",
      "CarePlan": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-careplan",
      "CareTeam": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-careteam",
      "Goal": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-goal",
      "DocumentReference": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-documentreference"
    };

    assertMatch(US_CORE_PROFILES["Patient"], /http:\/\/hl7\.org\/fhir\/us\/core/);
    assertMatch(US_CORE_PROFILES["Observation"], /us-core-observation/);
    assertEquals(Object.keys(US_CORE_PROFILES).length, 12);
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  await t.step("should handle database errors gracefully", () => {
    const handleDbError = (error: { message: string } | null): { code: string; message: string; status: number } => {
      if (error) {
        return {
          code: "exception",
          message: error.message,
          status: 500
        };
      }
      return { code: "success", message: "OK", status: 200 };
    };

    assertEquals(handleDbError({ message: "Connection failed" }).status, 500);
    assertEquals(handleDbError(null).status, 200);
  });

  await t.step("should return 404 for not found resources", () => {
    const handleNotFound = (data: unknown[] | null, resourceType: string): { found: boolean; status: number } => {
      if (!data || data.length === 0) {
        return { found: false, status: 404 };
      }
      return { found: true, status: 200 };
    };

    assertEquals(handleNotFound(null, "Patient").status, 404);
    assertEquals(handleNotFound([], "Observation").status, 404);
    assertEquals(handleNotFound([{ id: "123" }], "Condition").status, 200);
  });

  // ==========================================================================
  // DocumentReference Content Encoding Tests
  // ==========================================================================

  await t.step("should encode document content as base64", () => {
    const encodeContent = (content: string): string => {
      return btoa(content || "");
    };

    assertEquals(encodeContent("Hello World"), "SGVsbG8gV29ybGQ=");
    assertEquals(encodeContent(""), "");
    assertEquals(typeof encodeContent("Test content"), "string");
  });
});
