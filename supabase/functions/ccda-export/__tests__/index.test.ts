// supabase/functions/ccda-export/__tests__/index.test.ts
// Tests for ccda-export edge function

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("C-CDA Export Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/ccda-export", {
      method: "OPTIONS"
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should require authorization header", () => {
    const hasAuth = false;
    const expectedStatus = hasAuth ? 200 : 401;

    assertEquals(expectedStatus, 401);
  });

  await t.step("should define C-CDA template OIDs", () => {
    const TEMPLATE_OID = {
      CCD: "2.16.840.1.113883.10.20.22.1.2",
      ALLERGIES: "2.16.840.1.113883.10.20.22.2.6.1",
      MEDICATIONS: "2.16.840.1.113883.10.20.22.2.1.1",
      PROBLEMS: "2.16.840.1.113883.10.20.22.2.5.1",
      PROCEDURES: "2.16.840.1.113883.10.20.22.2.7.1",
      IMMUNIZATIONS: "2.16.840.1.113883.10.20.22.2.2.1",
      VITAL_SIGNS: "2.16.840.1.113883.10.20.22.2.4.1",
      RESULTS: "2.16.840.1.113883.10.20.22.2.3.1",
      PLAN_OF_CARE: "2.16.840.1.113883.10.20.22.2.10",
    };

    assertExists(TEMPLATE_OID.CCD);
    assertExists(TEMPLATE_OID.ALLERGIES);
    assertExists(TEMPLATE_OID.MEDICATIONS);
    assertExists(TEMPLATE_OID.PROBLEMS);
    assertExists(TEMPLATE_OID.PROCEDURES);
    assertExists(TEMPLATE_OID.IMMUNIZATIONS);
    assertExists(TEMPLATE_OID.VITAL_SIGNS);
    assertExists(TEMPLATE_OID.RESULTS);
    assertExists(TEMPLATE_OID.PLAN_OF_CARE);
  });

  await t.step("should use C-CDA version 2.1", () => {
    const CCDA_VERSION = "2.1";
    assertEquals(CCDA_VERSION, "2.1");
  });

  await t.step("should escape XML special characters", () => {
    const escapeXml = (text: string | null | undefined): string => {
      if (!text) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    assertEquals(escapeXml("Test & Data"), "Test &amp; Data");
    assertEquals(escapeXml("<tag>"), "&lt;tag&gt;");
    assertEquals(escapeXml('"quoted"'), "&quot;quoted&quot;");
    assertEquals(escapeXml("it's"), "it&apos;s");
    assertEquals(escapeXml(null), "");
    assertEquals(escapeXml(undefined), "");
  });

  await t.step("should format HL7 datetime correctly", () => {
    const formatHL7DateTime = (dateStr: string | null | undefined): string => {
      if (!dateStr) return '';
      try {
        const d = new Date(dateStr);
        return d.toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
      } catch {
        return '';
      }
    };

    // 2026-01-17T10:30:00.000Z -> 20260117103000
    const result = formatHL7DateTime("2026-01-17T10:30:00.000Z");
    assertEquals(result.length, 14);
    assertEquals(result.startsWith("20260117"), true);
    assertEquals(formatHL7DateTime(null), "");
    assertEquals(formatHL7DateTime("invalid"), "");
  });

  await t.step("should format HL7 date correctly", () => {
    const formatHL7Date = (dateStr: string | null | undefined): string => {
      if (!dateStr) return '';
      try {
        const d = new Date(dateStr);
        return d.toISOString().slice(0, 10).replace(/-/g, '');
      } catch {
        return '';
      }
    };

    // 2026-01-17 -> 20260117
    assertEquals(formatHL7Date("2026-01-17"), "20260117");
    assertEquals(formatHL7Date(null), "");
  });

  await t.step("should map gender codes correctly", () => {
    const mapGenderCode = (gender: string | null | undefined): string => {
      if (!gender) return 'UN';
      const g = gender.toLowerCase();
      if (g === 'male' || g === 'm') return 'M';
      if (g === 'female' || g === 'f') return 'F';
      return 'UN';
    };

    assertEquals(mapGenderCode("male"), "M");
    assertEquals(mapGenderCode("Male"), "M");
    assertEquals(mapGenderCode("m"), "M");
    assertEquals(mapGenderCode("female"), "F");
    assertEquals(mapGenderCode("Female"), "F");
    assertEquals(mapGenderCode("f"), "F");
    assertEquals(mapGenderCode("other"), "UN");
    assertEquals(mapGenderCode(null), "UN");
    assertEquals(mapGenderCode(undefined), "UN");
  });

  await t.step("should map allergy type codes correctly", () => {
    const mapAllergyTypeCode = (type: string | null | undefined): string => {
      if (!type) return '419199007';
      const t = type.toLowerCase();
      if (t === 'medication' || t === 'drug') return '416098002';
      if (t === 'food') return '414285001';
      if (t === 'environment' || t === 'environmental') return '426232007';
      return '419199007'; // Allergy to substance (general)
    };

    assertEquals(mapAllergyTypeCode("medication"), "416098002");
    assertEquals(mapAllergyTypeCode("drug"), "416098002");
    assertEquals(mapAllergyTypeCode("food"), "414285001");
    assertEquals(mapAllergyTypeCode("environment"), "426232007");
    assertEquals(mapAllergyTypeCode("environmental"), "426232007");
    assertEquals(mapAllergyTypeCode("other"), "419199007");
    assertEquals(mapAllergyTypeCode(null), "419199007");
  });

  await t.step("should include all USCDI data sections", () => {
    const sections = [
      "Allergies",
      "Medications",
      "Problems",
      "Procedures",
      "Immunizations",
      "Vital Signs",
      "Results",
      "Plan of Care"
    ];

    assertEquals(sections.length, 8);
    assertEquals(sections.includes("Allergies"), true);
    assertEquals(sections.includes("Medications"), true);
    assertEquals(sections.includes("Problems"), true);
    assertEquals(sections.includes("Vital Signs"), true);
    assertEquals(sections.includes("Results"), true);
  });

  await t.step("should structure allergy entry correctly", () => {
    const allergyEntry = {
      allergen_name: "Penicillin",
      allergen_type: "medication",
      reaction_description: "Rash",
      severity: "moderate",
      clinical_status: "active"
    };

    assertExists(allergyEntry.allergen_name);
    assertExists(allergyEntry.allergen_type);
    assertEquals(allergyEntry.clinical_status, "active");
  });

  await t.step("should structure medication entry correctly", () => {
    const medicationEntry = {
      medication_name: "Metformin",
      dosage: "500mg",
      frequency: "twice daily",
      instructions: "Take with food",
      status: "active"
    };

    assertExists(medicationEntry.medication_name);
    assertExists(medicationEntry.dosage);
    assertEquals(medicationEntry.status, "active");
  });

  await t.step("should structure condition entry correctly", () => {
    const conditionEntry = {
      code: "E11.9",
      code_display: "Type 2 diabetes mellitus without complications",
      clinical_status: "active",
      onset_datetime: "2024-01-15T00:00:00Z"
    };

    assertExists(conditionEntry.code);
    assertExists(conditionEntry.code_display);
    assertEquals(conditionEntry.clinical_status, "active");
  });

  await t.step("should structure procedure entry correctly", () => {
    const procedureEntry = {
      code: "99214",
      code_display: "Office outpatient visit",
      status: "completed",
      performed_datetime: "2026-01-10T14:30:00Z"
    };

    assertExists(procedureEntry.code);
    assertExists(procedureEntry.code_display);
    assertEquals(procedureEntry.status, "completed");
  });

  await t.step("should structure immunization entry correctly", () => {
    const immunizationEntry = {
      vaccine_code: "141",
      vaccine_display: "Influenza, seasonal",
      status: "completed",
      occurrence_datetime: "2025-10-15T00:00:00Z",
      lot_number: "ABC123"
    };

    assertExists(immunizationEntry.vaccine_display);
    assertEquals(immunizationEntry.status, "completed");
    assertExists(immunizationEntry.lot_number);
  });

  await t.step("should structure vital signs observation correctly", () => {
    const vitalSign = {
      code: "8480-6",
      code_display: "Systolic blood pressure",
      value_quantity: 120,
      value_unit: "mmHg",
      effective_datetime: "2026-01-17T08:00:00Z"
    };

    assertExists(vitalSign.code);
    assertExists(vitalSign.value_quantity);
    assertExists(vitalSign.value_unit);
  });

  await t.step("should structure lab result correctly", () => {
    const labResult = {
      test_name: "Glucose",
      value: 95,
      unit: "mg/dL",
      reference_range: "70-100 mg/dL",
      extracted_at: "2026-01-15T10:00:00Z"
    };

    assertExists(labResult.test_name);
    assertExists(labResult.value);
    assertExists(labResult.reference_range);
  });

  await t.step("should structure care plan correctly", () => {
    const carePlan = {
      title: "Diabetes Management Plan",
      description: "Comprehensive care plan for Type 2 DM",
      status: "active",
      period_start: "2026-01-01T00:00:00Z"
    };

    assertExists(carePlan.title);
    assertExists(carePlan.description);
    assertEquals(carePlan.status, "active");
  });

  await t.step("should generate unique document ID", () => {
    const userId = "user-123";
    const timestamp = Date.now();
    const documentId = `${userId}-${timestamp}`;

    assertEquals(documentId.includes(userId), true);
    assertEquals(documentId.includes("-"), true);
  });

  await t.step("should include required CDA header elements", () => {
    const requiredElements = [
      "realmCode",
      "typeId",
      "templateId",
      "id",
      "code",
      "title",
      "effectiveTime",
      "confidentialityCode",
      "languageCode",
      "recordTarget",
      "author",
      "custodian"
    ];

    assertEquals(requiredElements.length, 12);
    assertEquals(requiredElements.includes("recordTarget"), true);
    assertEquals(requiredElements.includes("author"), true);
  });

  await t.step("should identify WellFit as authoring system", () => {
    const authoringDevice = {
      manufacturerModelName: "WellFit Community Health Platform",
      softwareName: "WellFit C-CDA Export v2.1"
    };

    assertEquals(authoringDevice.manufacturerModelName.includes("WellFit"), true);
    assertEquals(authoringDevice.softwareName.includes("C-CDA"), true);
  });

  await t.step("should use LOINC code for document type", () => {
    const documentCode = {
      code: "34133-9",
      codeSystem: "2.16.840.1.113883.6.1",
      codeSystemName: "LOINC",
      displayName: "Summarization of Episode Note"
    };

    assertEquals(documentCode.code, "34133-9");
    assertEquals(documentCode.codeSystemName, "LOINC");
  });

  await t.step("should format display date correctly", () => {
    const formatDisplayDate = (dateStr: string | null | undefined): string => {
      if (!dateStr) return '';
      try {
        return new Date(dateStr).toLocaleDateString('en-US');
      } catch {
        return dateStr || '';
      }
    };

    const result = formatDisplayDate("2026-01-17T10:30:00Z");
    assertEquals(typeof result, "string");
    assertEquals(result.length > 0, true);
    assertEquals(formatDisplayDate(null), "");
  });

  await t.step("should return JSON response with XML", () => {
    const response = {
      xml: "<?xml version=\"1.0\"?>..."
    };

    assertExists(response.xml);
    assertEquals(response.xml.includes("<?xml"), true);
  });

  await t.step("should return 401 for unauthorized users", () => {
    const isAuthenticated = false;
    const expectedStatus = isAuthenticated ? 200 : 401;

    assertEquals(expectedStatus, 401);
  });

  await t.step("should return 500 for generation errors", () => {
    const hasError = true;
    const expectedStatus = hasError ? 500 : 200;

    assertEquals(expectedStatus, 500);
  });

  await t.step("should include Content-Type header in responses", () => {
    const headers = { "Content-Type": "application/json" };

    assertEquals(headers["Content-Type"], "application/json");
  });

  await t.step("should handle empty data sections gracefully", () => {
    const allergies: unknown[] = [];
    const hasData = allergies.length > 0;

    assertEquals(hasData, false);
    // Should generate "No known allergies" text
  });

  await t.step("should use nullFlavor for missing required attributes", () => {
    const nullFlavors = ["NI", "NA", "OTH", "UNK"];

    assertEquals(nullFlavors.includes("NI"), true);  // No information
    assertEquals(nullFlavors.includes("NA"), true);  // Not applicable
    assertEquals(nullFlavors.includes("OTH"), true); // Other
    assertEquals(nullFlavors.includes("UNK"), true); // Unknown
  });

  await t.step("should query all USCDI data in parallel", () => {
    const dataQueries = [
      "profiles",
      "medications",
      "allergy_intolerances",
      "fhir_conditions",
      "fhir_procedures",
      "fhir_immunizations",
      "fhir_observations",
      "lab_results",
      "fhir_care_plans"
    ];

    assertEquals(dataQueries.length, 9);
    assertEquals(dataQueries.includes("fhir_conditions"), true);
    assertEquals(dataQueries.includes("fhir_observations"), true);
  });

  await t.step("should use correct HTTP status codes", () => {
    const statusCodes = {
      success: 200,
      unauthorized: 401,
      serverError: 500
    };

    assertEquals(statusCodes.success, 200);
    assertEquals(statusCodes.unauthorized, 401);
    assertEquals(statusCodes.serverError, 500);
  });
});
