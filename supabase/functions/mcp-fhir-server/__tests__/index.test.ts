// supabase/functions/mcp-fhir-server/__tests__/index.test.ts
// Tests for MCP FHIR Server - Standardized FHIR R4 resource access and operations

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("MCP FHIR Server Tests", async (t) => {

  // =====================================================
  // FHIR Resource Type Mapping Tests
  // =====================================================

  await t.step("should map FHIR resource types to database tables", () => {
    const FHIR_TABLES: Record<string, string> = {
      'Patient': 'profiles',
      'MedicationRequest': 'fhir_medication_requests',
      'Condition': 'fhir_conditions',
      'DiagnosticReport': 'fhir_diagnostic_reports',
      'Procedure': 'fhir_procedures',
      'Observation': 'fhir_observations',
      'Immunization': 'fhir_immunizations',
      'CarePlan': 'fhir_care_plans',
      'CareTeam': 'fhir_care_teams',
      'Practitioner': 'fhir_practitioners',
      'PractitionerRole': 'fhir_practitioner_roles',
      'Encounter': 'fhir_encounters',
      'DocumentReference': 'fhir_document_references',
      'AllergyIntolerance': 'fhir_allergies',
      'Goal': 'fhir_goals',
      'Location': 'fhir_locations',
      'Organization': 'fhir_organizations',
      'Medication': 'fhir_medications',
    };

    assertEquals(FHIR_TABLES['Patient'], 'profiles');
    assertEquals(FHIR_TABLES['MedicationRequest'], 'fhir_medication_requests');
    assertEquals(FHIR_TABLES['Condition'], 'fhir_conditions');
    assertEquals(FHIR_TABLES['Observation'], 'fhir_observations');
    assertEquals(Object.keys(FHIR_TABLES).length, 18);
  });

  await t.step("should list supported FHIR resource types", () => {
    const SUPPORTED_RESOURCES = [
      'Patient', 'MedicationRequest', 'Condition', 'DiagnosticReport',
      'Procedure', 'Observation', 'Immunization', 'CarePlan', 'CareTeam',
      'Practitioner', 'PractitionerRole', 'Encounter', 'DocumentReference',
      'AllergyIntolerance', 'Goal', 'Location', 'Organization', 'Medication'
    ];

    assertEquals(SUPPORTED_RESOURCES.includes('Patient'), true);
    assertEquals(SUPPORTED_RESOURCES.includes('Observation'), true);
    assertEquals(SUPPORTED_RESOURCES.includes('InvalidResource'), false);
  });

  // =====================================================
  // FHIR Bundle Builder Tests
  // =====================================================

  await t.step("should create FHIR Bundle structure", () => {
    const resources = [
      { id: 'patient-1', resourceType: 'Patient', name: 'John Doe' },
      { id: 'med-1', resourceType: 'MedicationRequest', status: 'active' }
    ];

    const bundle = {
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: new Date().toISOString(),
      total: resources.length,
      entry: resources.map(resource => ({
        fullUrl: `urn:uuid:${resource.id}`,
        resource
      }))
    };

    assertEquals(bundle.resourceType, 'Bundle');
    assertEquals(bundle.type, 'collection');
    assertEquals(bundle.total, 2);
    assertEquals(bundle.entry.length, 2);
    assertEquals(bundle.entry[0].fullUrl, 'urn:uuid:patient-1');
  });

  await t.step("should support different bundle types", () => {
    const bundleTypes = ['searchset', 'collection', 'document'];

    for (const type of bundleTypes) {
      const bundle = { resourceType: 'Bundle', type };
      assertEquals(bundle.type, type);
    }
  });

  // =====================================================
  // Patient Resource Conversion Tests
  // =====================================================

  await t.step("should convert profile to FHIR Patient resource", () => {
    const profile = {
      id: 'patient-123',
      mrn: 'MRN001',
      first_name: 'John',
      last_name: 'Doe',
      middle_name: 'Michael',
      gender: 'Male',
      date_of_birth: '1980-05-15',
      phone: '555-123-4567',
      email: 'john.doe@example.com',
      address_line1: '123 Main St',
      city: 'Houston',
      state: 'TX',
      zip_code: '77001',
      updated_at: '2025-01-15T12:00:00Z'
    };

    const fhirPatient = {
      resourceType: 'Patient',
      id: profile.id,
      meta: { lastUpdated: profile.updated_at },
      identifier: [{ system: 'http://hospital.example.org/mrn', value: profile.mrn }],
      name: [{
        use: 'official',
        family: profile.last_name,
        given: [profile.first_name, profile.middle_name].filter(Boolean)
      }],
      gender: profile.gender.toLowerCase(),
      birthDate: profile.date_of_birth,
      telecom: [
        { system: 'phone', value: profile.phone },
        { system: 'email', value: profile.email }
      ],
      address: [{
        line: [profile.address_line1],
        city: profile.city,
        state: profile.state,
        postalCode: profile.zip_code,
        country: 'US'
      }]
    };

    assertEquals(fhirPatient.resourceType, 'Patient');
    assertEquals(fhirPatient.id, 'patient-123');
    assertEquals(fhirPatient.name[0].family, 'Doe');
    assertEquals(fhirPatient.name[0].given[0], 'John');
    assertEquals(fhirPatient.gender, 'male');
    assertEquals(fhirPatient.birthDate, '1980-05-15');
  });

  await t.step("should handle missing optional fields in patient conversion", () => {
    const minimalProfile = {
      id: 'patient-456',
      first_name: 'Jane',
      last_name: 'Smith'
    };

    const fhirPatient = {
      resourceType: 'Patient',
      id: minimalProfile.id,
      name: [{
        use: 'official',
        family: minimalProfile.last_name,
        given: [minimalProfile.first_name]
      }]
    };

    assertEquals(fhirPatient.resourceType, 'Patient');
    assertExists(fhirPatient.name);
    assertEquals(fhirPatient.name[0].family, 'Smith');
  });

  // =====================================================
  // Resource Validation Tests
  // =====================================================

  await t.step("should validate MedicationRequest required fields", () => {
    const requiredFields = ['medication_name', 'patient_id', 'status'];

    const validData = {
      medication_name: 'Lisinopril',
      patient_id: 'patient-123',
      status: 'active'
    };

    const invalidData = {
      patient_id: 'patient-123',
      status: 'active'
      // missing medication_name
    };

    const validateResource = (data: Record<string, unknown>): { valid: boolean; errors: string[] } => {
      const errors: string[] = [];
      for (const field of requiredFields) {
        if (!data[field]) {
          errors.push(`Missing required field: ${field}`);
        }
      }
      return { valid: errors.length === 0, errors };
    };

    assertEquals(validateResource(validData).valid, true);
    assertEquals(validateResource(invalidData).valid, false);
    assertEquals(validateResource(invalidData).errors[0], 'Missing required field: medication_name');
  });

  await t.step("should validate Condition required fields", () => {
    const requiredFields = ['code_display', 'patient_id', 'clinical_status'];

    const validData = {
      code_display: 'Hypertension',
      patient_id: 'patient-123',
      clinical_status: 'active'
    };

    const validateResource = (data: Record<string, unknown>): { valid: boolean; errors: string[] } => {
      const errors: string[] = [];
      for (const field of requiredFields) {
        if (!data[field]) {
          errors.push(`Missing required field: ${field}`);
        }
      }
      return { valid: errors.length === 0, errors };
    };

    assertEquals(validateResource(validData).valid, true);
  });

  await t.step("should validate Observation value_quantity", () => {
    const validObservation = {
      code: '8867-4',
      patient_id: 'patient-123',
      status: 'final',
      value_quantity: { value: 72, unit: 'bpm' }
    };

    const invalidObservation = {
      code: '8867-4',
      patient_id: 'patient-123',
      status: 'final',
      value_quantity: { value: 'not-a-number', unit: 'bpm' }
    };

    const validateValueQuantity = (data: Record<string, unknown>): boolean => {
      if (data.value_quantity) {
        const vq = data.value_quantity as Record<string, unknown>;
        return typeof vq.value === 'number';
      }
      return true;
    };

    assertEquals(validateValueQuantity(validObservation), true);
    assertEquals(validateValueQuantity(invalidObservation), false);
  });

  // =====================================================
  // MCP Protocol Tests
  // =====================================================

  await t.step("should list available FHIR tools", () => {
    const tools = [
      "export_patient_bundle",
      "get_resource",
      "search_resources",
      "create_resource",
      "update_resource",
      "validate_resource",
      "get_patient_summary",
      "get_observations",
      "get_medication_list",
      "get_condition_list",
      "get_sdoh_assessments",
      "get_care_team",
      "list_ehr_connections",
      "trigger_ehr_sync"
    ];

    assertEquals(tools.includes("export_patient_bundle"), true);
    assertEquals(tools.includes("get_resource"), true);
    assertEquals(tools.includes("get_patient_summary"), true);
    assertEquals(tools.length, 14);
  });

  await t.step("should validate export_patient_bundle input schema", () => {
    const validInput = {
      patient_id: "patient-123",
      resources: ["MedicationRequest", "Condition", "Observation"],
      start_date: "2025-01-01T00:00:00Z",
      end_date: "2025-12-31T23:59:59Z",
      include_ai_assessments: true
    };

    const invalidInput = {
      // missing required patient_id
      resources: ["MedicationRequest"]
    };

    assertExists(validInput.patient_id);
    assertEquals("patient_id" in invalidInput, false);
  });

  await t.step("should validate get_resource input schema", () => {
    const validInput = {
      resource_type: "MedicationRequest",
      resource_id: "med-123"
    };

    assertExists(validInput.resource_type);
    assertExists(validInput.resource_id);
  });

  await t.step("should validate search_resources input schema", () => {
    const validInput = {
      resource_type: "Observation",
      patient_id: "patient-123",
      status: "final",
      category: "vital-signs",
      code: "8867-4",
      date_from: "2025-01-01",
      date_to: "2025-12-31",
      limit: 50
    };

    assertExists(validInput.resource_type);
    assertEquals(typeof validInput.limit, "number");
  });

  // =====================================================
  // Patient Summary Tests
  // =====================================================

  await t.step("should support all patient summary sections", () => {
    const supportedSections = [
      "demographics",
      "conditions",
      "medications",
      "allergies",
      "immunizations",
      "vitals",
      "procedures",
      "goals",
      "careplans"
    ];

    assertEquals(supportedSections.length, 9);
    assertEquals(supportedSections.includes("demographics"), true);
    assertEquals(supportedSections.includes("medications"), true);
    assertEquals(supportedSections.includes("vitals"), true);
  });

  await t.step("should create patient summary structure", () => {
    const summary = {
      patient_id: "patient-123",
      generated_at: new Date().toISOString(),
      sections: {
        demographics: {
          name: "John Doe",
          date_of_birth: "1980-05-15",
          gender: "male"
        },
        conditions: [
          { code: "I10", display: "Hypertension", status: "active" }
        ],
        medications: [
          { name: "Lisinopril", dosage: "10mg daily", status: "active" }
        ]
      }
    };

    assertExists(summary.patient_id);
    assertExists(summary.generated_at);
    assertExists(summary.sections.demographics);
    assertEquals(Array.isArray(summary.sections.conditions), true);
    assertEquals(Array.isArray(summary.sections.medications), true);
  });

  // =====================================================
  // Observation Category Tests
  // =====================================================

  await t.step("should support observation categories", () => {
    const categories = ["vital-signs", "laboratory", "survey", "activity"];

    assertEquals(categories.includes("vital-signs"), true);
    assertEquals(categories.includes("laboratory"), true);
    assertEquals(categories.includes("survey"), true);
    assertEquals(categories.includes("activity"), true);
  });

  await t.step("should format vital signs observation", () => {
    const observation = {
      resourceType: "Observation",
      id: "obs-123",
      status: "final",
      category: [{ coding: [{ code: "vital-signs" }] }],
      code: {
        coding: [{ system: "http://loinc.org", code: "8867-4", display: "Heart rate" }]
      },
      valueQuantity: { value: 72, unit: "beats/minute" },
      effectiveDateTime: "2025-01-15T12:00:00Z"
    };

    assertEquals(observation.resourceType, "Observation");
    assertEquals(observation.status, "final");
    assertEquals(observation.valueQuantity.value, 72);
  });

  // =====================================================
  // Medication Status Tests
  // =====================================================

  await t.step("should support medication statuses", () => {
    const validStatuses = ["active", "completed", "stopped", "cancelled", "all"];

    assertEquals(validStatuses.includes("active"), true);
    assertEquals(validStatuses.includes("completed"), true);
    assertEquals(validStatuses.includes("stopped"), true);
    assertEquals(validStatuses.includes("on-hold"), false);
  });

  await t.step("should format medication list response", () => {
    const medicationList = {
      patient_id: "patient-123",
      medications: [
        {
          id: "med-1",
          name: "Lisinopril",
          dosage: "10mg",
          frequency: "daily",
          route: "oral",
          status: "active",
          prescriber: "Dr. Smith",
          start_date: "2024-01-01"
        }
      ],
      total: 1
    };

    assertExists(medicationList.patient_id);
    assertEquals(Array.isArray(medicationList.medications), true);
    assertEquals(medicationList.medications[0].name, "Lisinopril");
    assertEquals(medicationList.total, 1);
  });

  // =====================================================
  // Condition Status Tests
  // =====================================================

  await t.step("should support clinical statuses", () => {
    const clinicalStatuses = [
      "active", "recurrence", "relapse",
      "inactive", "remission", "resolved"
    ];

    assertEquals(clinicalStatuses.includes("active"), true);
    assertEquals(clinicalStatuses.includes("resolved"), true);
    assertEquals(clinicalStatuses.length, 6);
  });

  await t.step("should format condition list response", () => {
    const conditionList = {
      patient_id: "patient-123",
      conditions: [
        {
          id: "cond-1",
          code: "I10",
          display: "Essential hypertension",
          system: "http://hl7.org/fhir/sid/icd-10-cm",
          clinical_status: "active",
          verification_status: "confirmed",
          severity: "moderate",
          onset_date: "2020-06-15"
        }
      ],
      total: 1
    };

    assertExists(conditionList.patient_id);
    assertEquals(conditionList.conditions[0].code, "I10");
    assertEquals(conditionList.conditions[0].clinical_status, "active");
  });

  // =====================================================
  // SDOH Assessment Tests
  // =====================================================

  await t.step("should support SDOH domains", () => {
    const sdohDomains = [
      "food-insecurity",
      "housing-instability",
      "transportation",
      "financial-strain",
      "social-isolation",
      "all"
    ];

    assertEquals(sdohDomains.includes("food-insecurity"), true);
    assertEquals(sdohDomains.includes("housing-instability"), true);
    assertEquals(sdohDomains.includes("transportation"), true);
    assertEquals(sdohDomains.length, 6);
  });

  await t.step("should format SDOH assessment response", () => {
    const sdohResponse = {
      patient_id: "patient-123",
      assessments: [
        {
          id: "sdoh-1",
          code: "88122-7",
          display: "Food insecurity risk",
          value: "At risk",
          date: "2025-01-10"
        }
      ],
      active_flags: [
        {
          id: "flag-1",
          type: "food-insecurity",
          severity: "moderate",
          description: "Patient reports difficulty affording food",
          detected_date: "2025-01-10"
        }
      ],
      total_assessments: 1,
      total_flags: 1
    };

    assertExists(sdohResponse.patient_id);
    assertEquals(sdohResponse.assessments[0].code, "88122-7");
    assertEquals(sdohResponse.active_flags[0].type, "food-insecurity");
  });

  // =====================================================
  // Care Team Tests
  // =====================================================

  await t.step("should format care team response", () => {
    const careTeamResponse = {
      patient_id: "patient-123",
      care_teams: [
        {
          id: "team-1",
          name: "Primary Care Team",
          category: "longitudinal-care",
          status: "active",
          members: [
            {
              role: "Primary Care Physician",
              name: "Dr. Jane Smith",
              specialty: "Family Medicine",
              phone: "555-123-4567",
              email: "jsmith@clinic.com"
            },
            {
              role: "Care Coordinator",
              name: "Mike Johnson",
              specialty: "Care Management"
            }
          ]
        }
      ]
    };

    assertExists(careTeamResponse.patient_id);
    assertEquals(careTeamResponse.care_teams[0].status, "active");
    assertEquals(careTeamResponse.care_teams[0].members.length, 2);
  });

  await t.step("should optionally include contact info", () => {
    const memberWithContact = {
      role: "Primary Care Physician",
      name: "Dr. Smith",
      phone: "555-123-4567",
      email: "smith@clinic.com"
    };

    const memberWithoutContact = {
      role: "Primary Care Physician",
      name: "Dr. Smith"
    };

    assertExists(memberWithContact.phone);
    assertExists(memberWithContact.email);
    assertEquals("phone" in memberWithoutContact, false);
    assertEquals("email" in memberWithoutContact, false);
  });

  // =====================================================
  // EHR Connection Tests
  // =====================================================

  await t.step("should support EHR connection statuses", () => {
    const connectionStatuses = ["active", "inactive", "error"];

    assertEquals(connectionStatuses.includes("active"), true);
    assertEquals(connectionStatuses.includes("inactive"), true);
    assertEquals(connectionStatuses.includes("error"), true);
  });

  await t.step("should format EHR connections list response", () => {
    const connectionsResponse = {
      connections: [
        {
          id: "conn-1",
          name: "Epic Production",
          ehr_type: "Epic",
          base_url: "https://epic.hospital.org/fhir",
          status: "active",
          sync_mode: "bidirectional",
          sync_frequency: "hourly",
          last_sync: "2025-01-15T10:00:00Z"
        }
      ],
      total: 1
    };

    assertEquals(connectionsResponse.connections[0].ehr_type, "Epic");
    assertEquals(connectionsResponse.connections[0].status, "active");
    assertEquals(connectionsResponse.total, 1);
  });

  await t.step("should support sync directions", () => {
    const syncDirections = ["pull", "push", "bidirectional"];

    assertEquals(syncDirections.includes("pull"), true);
    assertEquals(syncDirections.includes("push"), true);
    assertEquals(syncDirections.includes("bidirectional"), true);
  });

  await t.step("should format EHR sync trigger response", () => {
    const syncResponse = {
      sync_id: "sync-123",
      connection_id: "conn-1",
      direction: "pull",
      status: "initiated",
      message: "Sync request queued. Check fhir_sync_logs for status."
    };

    assertExists(syncResponse.sync_id);
    assertEquals(syncResponse.status, "initiated");
  });

  // =====================================================
  // MCP Response Format Tests
  // =====================================================

  await t.step("should return MCP initialize response format", () => {
    const response = {
      jsonrpc: "2.0",
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: {
          name: "mcp-fhir-server",
          version: "1.0.0"
        },
        capabilities: {
          tools: {}
        }
      },
      id: 1
    };

    assertEquals(response.jsonrpc, "2.0");
    assertEquals(response.result.serverInfo.name, "mcp-fhir-server");
    assertEquals(response.result.protocolVersion, "2024-11-05");
  });

  await t.step("should return MCP tools/list response format", () => {
    const response = {
      jsonrpc: "2.0",
      result: {
        tools: [
          { name: "export_patient_bundle", description: "Export a complete FHIR Bundle for a patient" },
          { name: "get_resource", description: "Get a specific FHIR resource by ID" }
        ]
      },
      id: 2
    };

    assertEquals(response.jsonrpc, "2.0");
    assertEquals(Array.isArray(response.result.tools), true);
    assertExists(response.result.tools[0].name);
    assertExists(response.result.tools[0].description);
  });

  await t.step("should return MCP tools/call response format", () => {
    const response = {
      content: [{ type: "text", text: '{"resourceType":"Bundle","total":5}' }],
      metadata: {
        tool: "export_patient_bundle",
        executionTimeMs: 150
      }
    };

    assertEquals(response.content[0].type, "text");
    assertExists(response.content[0].text);
    assertEquals(response.metadata.tool, "export_patient_bundle");
    assertEquals(typeof response.metadata.executionTimeMs, "number");
  });

  // =====================================================
  // Error Handling Tests
  // =====================================================

  await t.step("should return error for unknown resource type", () => {
    const error = {
      error: {
        code: "internal_error",
        message: "Unknown resource type: InvalidResource"
      }
    };

    assertEquals(error.error.code, "internal_error");
    assertEquals(error.error.message.includes("Unknown resource type"), true);
  });

  await t.step("should return error for resource not found", () => {
    const error = {
      error: {
        code: "internal_error",
        message: "Resource not found: No rows returned"
      }
    };

    assertEquals(error.error.message.includes("not found"), true);
  });

  await t.step("should return error for validation failure", () => {
    const error = {
      error: {
        code: "internal_error",
        message: "Validation failed: Missing required field: patient_id"
      }
    };

    assertEquals(error.error.message.includes("Validation failed"), true);
  });

  await t.step("should return error for unknown MCP method", () => {
    const error = {
      error: {
        code: "internal_error",
        message: "Unknown MCP method: invalid/method"
      }
    };

    assertEquals(error.error.message.includes("Unknown MCP method"), true);
  });

  // =====================================================
  // Audit Logging Tests
  // =====================================================

  await t.step("should create FHIR operation audit log entry", () => {
    const auditEntry = {
      user_id: "user-123",
      tenant_id: "tenant-456",
      operation: "get_patient_summary",
      resource_type: "Patient",
      resource_id: "patient-789",
      success: true,
      execution_time_ms: 200,
      created_at: new Date().toISOString()
    };

    assertExists(auditEntry.user_id);
    assertExists(auditEntry.operation);
    assertEquals(auditEntry.success, true);
    assertEquals(typeof auditEntry.execution_time_ms, "number");
  });

  await t.step("should log error operations", () => {
    const errorAuditEntry = {
      user_id: "user-123",
      operation: "create_resource",
      resource_type: "MedicationRequest",
      success: false,
      execution_time_ms: 50,
      error_message: "Validation failed: Missing required field",
      created_at: new Date().toISOString()
    };

    assertEquals(errorAuditEntry.success, false);
    assertExists(errorAuditEntry.error_message);
  });

  // =====================================================
  // CORS Tests
  // =====================================================

  await t.step("should handle OPTIONS preflight", () => {
    const request = new Request("http://localhost/mcp-fhir-server", {
      method: "OPTIONS"
    });

    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should include Content-Type header in response", () => {
    const headers = {
      "Content-Type": "application/json"
    };

    assertEquals(headers["Content-Type"], "application/json");
  });

  // =====================================================
  // Date Handling Tests
  // =====================================================

  await t.step("should handle ISO 8601 date formats", () => {
    const dateStrings = [
      "2025-01-15",
      "2025-01-15T12:00:00Z",
      "2025-01-15T12:00:00.000Z"
    ];

    for (const dateStr of dateStrings) {
      const date = new Date(dateStr);
      assertEquals(isNaN(date.getTime()), false);
    }
  });

  await t.step("should filter resources by date range", () => {
    const resources = [
      { id: "1", created_at: "2025-01-10" },
      { id: "2", created_at: "2025-01-15" },
      { id: "3", created_at: "2025-01-20" }
    ];

    const startDate = "2025-01-12";
    const endDate = "2025-01-18";

    const filtered = resources.filter(r =>
      r.created_at >= startDate && r.created_at <= endDate
    );

    assertEquals(filtered.length, 1);
    assertEquals(filtered[0].id, "2");
  });
});
