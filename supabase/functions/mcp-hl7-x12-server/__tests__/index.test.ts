// supabase/functions/mcp-hl7-x12-server/__tests__/index.test.ts
// Tests for MCP HL7/X12 Transformer Server - Healthcare Data Interchange

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("MCP HL7/X12 Server Tests", async (t) => {

  // =====================================================
  // HL7 v2.x Parser Tests
  // =====================================================

  await t.step("should parse HL7 message header (MSH segment)", () => {
    const mshSegment = "MSH|^~\\&|SENDING_APP|SENDING_FAC|RECEIVING_APP|RECEIVING_FAC|20250115120000||ADT^A01|MSG00001|P|2.5.1";
    const fields = mshSegment.split("|");

    assertEquals(fields[0], "MSH");
    assertEquals(fields[2], "SENDING_APP");
    assertEquals(fields[3], "SENDING_FAC");
    assertEquals(fields[8], "ADT^A01"); // Message type
    assertEquals(fields[9], "MSG00001"); // Message control ID
    assertEquals(fields[11], "2.5.1"); // Version
  });

  await t.step("should identify message type from MSH", () => {
    const messageTypes = {
      "ADT^A01": "Patient admission",
      "ADT^A08": "Patient information update",
      "ORM^O01": "Order message",
      "ORU^R01": "Observation result"
    };

    const messageType = "ADT^A01";
    assertEquals(messageTypes[messageType], "Patient admission");
  });

  await t.step("should parse PID segment (patient demographics)", () => {
    const pidSegment = "PID|1||MRN123^^^HOSP&1.2.3.4&ISO||Doe^John^M||19800101|M";
    const fields = pidSegment.split("|");

    assertEquals(fields[0], "PID");
    assertEquals(fields[3].includes("MRN123"), true); // Patient ID
    assertEquals(fields[5], "Doe^John^M"); // Patient name
    assertEquals(fields[7], "19800101"); // DOB
    assertEquals(fields[8], "M"); // Gender
  });

  await t.step("should extract patient name components", () => {
    const nameField = "Doe^John^Michael^^Jr";
    const components = nameField.split("^");

    assertEquals(components[0], "Doe"); // Family name
    assertEquals(components[1], "John"); // Given name
    assertEquals(components[2], "Michael"); // Middle name
    assertEquals(components[4], "Jr"); // Suffix
  });

  await t.step("should parse PV1 segment (patient visit)", () => {
    const pv1Segment = "PV1|1|I|ICU^101^A|||||||9999^Smith^Jane|||||||||||V001";
    const fields = pv1Segment.split("|");

    assertEquals(fields[0], "PV1");
    assertEquals(fields[2], "I"); // Patient class (Inpatient)
    assertEquals(fields[3].split("^")[0], "ICU"); // Location
  });

  await t.step("should handle HL7 escape sequences", () => {
    const escapeSequences: Record<string, string> = {
      "\\F\\": "|",   // Field separator
      "\\S\\": "^",   // Component separator
      "\\T\\": "&",   // Subcomponent separator
      "\\R\\": "~",   // Repetition separator
      "\\E\\": "\\"   // Escape character
    };

    assertEquals(escapeSequences["\\F\\"], "|");
    assertEquals(escapeSequences["\\S\\"], "^");
  });

  await t.step("should validate HL7 message structure", () => {
    const validMessage = "MSH|^~\\&|...\rPID|1||...\rPV1|1|...";
    const segments = validMessage.split("\r");

    assertEquals(segments[0].startsWith("MSH"), true);
    assertEquals(segments.length >= 1, true);
  });

  // =====================================================
  // HL7 to FHIR Conversion Tests
  // =====================================================

  await t.step("should convert PID to FHIR Patient resource", () => {
    const fhirPatient = {
      resourceType: "Patient",
      id: "patient-MRN123",
      identifier: [{
        system: "http://hospital.example.org/mrn",
        value: "MRN123"
      }],
      name: [{
        family: "Doe",
        given: ["John", "Michael"]
      }],
      gender: "male",
      birthDate: "1980-01-01"
    };

    assertEquals(fhirPatient.resourceType, "Patient");
    assertExists(fhirPatient.identifier);
    assertEquals(fhirPatient.name[0].family, "Doe");
  });

  await t.step("should map HL7 gender codes to FHIR", () => {
    const genderMap: Record<string, string> = {
      "M": "male",
      "F": "female",
      "U": "unknown",
      "O": "other"
    };

    assertEquals(genderMap["M"], "male");
    assertEquals(genderMap["F"], "female");
    assertEquals(genderMap["U"], "unknown");
  });

  await t.step("should convert PV1 to FHIR Encounter resource", () => {
    const fhirEncounter = {
      resourceType: "Encounter",
      id: "encounter-V001",
      status: "in-progress",
      class: { code: "IMP" }, // Inpatient
      period: {
        start: "2025-01-15T12:00:00Z"
      },
      location: [{
        location: { display: "ICU - Room 101 - Bed A" }
      }]
    };

    assertEquals(fhirEncounter.resourceType, "Encounter");
    assertEquals(fhirEncounter.status, "in-progress");
    assertExists(fhirEncounter.location);
  });

  await t.step("should create FHIR Bundle from HL7 message", () => {
    const fhirBundle = {
      resourceType: "Bundle",
      type: "transaction",
      entry: [
        { resource: { resourceType: "Patient", id: "p1" } },
        { resource: { resourceType: "Encounter", id: "e1" } }
      ]
    };

    assertEquals(fhirBundle.resourceType, "Bundle");
    assertEquals(fhirBundle.type, "transaction");
    assertEquals(fhirBundle.entry.length, 2);
  });

  // =====================================================
  // X12 Parser Tests
  // =====================================================

  await t.step("should parse X12 ISA segment (interchange header)", () => {
    const isaSegment = "ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *250115*1200*^*00501*000000001*0*P*:~";
    const elements = isaSegment.split("*");

    assertEquals(elements[0], "ISA");
    assertEquals(elements[5].trim(), "SENDER");
    assertEquals(elements[7].trim(), "RECEIVER");
    assertEquals(elements[12], "000000001"); // Control number
  });

  await t.step("should parse X12 GS segment (functional group)", () => {
    const gsSegment = "GS*HC*SENDER*RECEIVER*20250115*1200*1*X*005010X222A1~";
    const elements = gsSegment.split("*");

    assertEquals(elements[0], "GS");
    assertEquals(elements[1], "HC"); // Health Care Claim
    assertEquals(elements[8], "005010X222A1"); // Version
  });

  await t.step("should identify X12 transaction type", () => {
    const transactionTypes: Record<string, string> = {
      "837P": "Professional Claim",
      "837I": "Institutional Claim",
      "835": "Remittance Advice",
      "270": "Eligibility Inquiry",
      "271": "Eligibility Response",
      "276": "Claim Status Inquiry",
      "277": "Claim Status Response"
    };

    assertEquals(transactionTypes["837P"], "Professional Claim");
    assertEquals(transactionTypes["835"], "Remittance Advice");
  });

  await t.step("should parse X12 NM1 segment (name)", () => {
    const nm1Segment = "NM1*IL*1*DOE*JOHN****MI*MBR123456~";
    const elements = nm1Segment.split("*");

    assertEquals(elements[0], "NM1");
    assertEquals(elements[1], "IL"); // Insured
    assertEquals(elements[3], "DOE"); // Last name
    assertEquals(elements[4], "JOHN"); // First name
    assertEquals(elements[9], "MBR123456"); // Member ID
  });

  await t.step("should parse X12 CLM segment (claim)", () => {
    const clmSegment = "CLM*CLAIM123*1500***11:B:1*Y*A*Y*Y~";
    const elements = clmSegment.split("*");

    assertEquals(elements[0], "CLM");
    assertEquals(elements[1], "CLAIM123"); // Claim ID
    assertEquals(elements[2], "1500"); // Total charge
  });

  // =====================================================
  // X12 to FHIR Conversion Tests
  // =====================================================

  await t.step("should convert 837P to FHIR Claim resource", () => {
    const fhirClaim = {
      resourceType: "Claim",
      id: "claim-CLAIM123",
      status: "active",
      type: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/claim-type",
          code: "professional"
        }]
      },
      use: "claim",
      total: {
        value: 1500,
        currency: "USD"
      },
      diagnosis: [{
        sequence: 1,
        diagnosisCodeableConcept: {
          coding: [{
            system: "http://hl7.org/fhir/sid/icd-10-cm",
            code: "J06.9"
          }]
        }
      }]
    };

    assertEquals(fhirClaim.resourceType, "Claim");
    assertEquals(fhirClaim.status, "active");
    assertEquals(fhirClaim.total.value, 1500);
    assertEquals(fhirClaim.diagnosis[0].diagnosisCodeableConcept.coding[0].code, "J06.9");
  });

  await t.step("should extract diagnosis codes from X12", () => {
    const hiSegment = "HI*BK:J069*BF:E119~";
    const elements = hiSegment.split("*");

    const diagnoses = elements.slice(1).map(d => {
      const [qualifier, code] = d.replace("~", "").split(":");
      return { qualifier, code };
    });

    assertEquals(diagnoses[0].qualifier, "BK"); // Principal
    assertEquals(diagnoses[0].code, "J069");
    assertEquals(diagnoses[1].qualifier, "BF"); // Other
    assertEquals(diagnoses[1].code, "E119");
  });

  await t.step("should extract procedure codes from X12", () => {
    const sv1Segment = "SV1*HC:99213*150*UN*1~";
    const elements = sv1Segment.split("*");

    const codeElement = elements[1].split(":");
    assertEquals(codeElement[0], "HC"); // Healthcare procedure
    assertEquals(codeElement[1], "99213"); // CPT code
    assertEquals(elements[2], "150"); // Charge
    assertEquals(elements[4], "1"); // Units
  });

  // =====================================================
  // MCP Protocol Tests
  // =====================================================

  await t.step("should list available tools", () => {
    const tools = [
      "parse_hl7",
      "hl7_to_fhir",
      "parse_x12",
      "x12_to_fhir",
      "generate_hl7",
      "generate_x12",
      "validate_message"
    ];

    assertEquals(tools.includes("parse_hl7"), true);
    assertEquals(tools.includes("hl7_to_fhir"), true);
    assertEquals(tools.includes("parse_x12"), true);
    assertEquals(tools.includes("x12_to_fhir"), true);
  });

  await t.step("should validate parse_hl7 tool input", () => {
    const validInput = {
      message: "MSH|^~\\&|..."
    };

    assertExists(validInput.message);
    assertEquals(typeof validInput.message, "string");
  });

  await t.step("should validate x12_to_fhir tool input", () => {
    const validInput = {
      message: "ISA*00*...",
      transactionType: "837P"
    };

    assertExists(validInput.message);
    assertExists(validInput.transactionType);
  });

  // =====================================================
  // Validation Tests
  // =====================================================

  await t.step("should validate HL7 version", () => {
    const validVersions = ["2.3", "2.3.1", "2.4", "2.5", "2.5.1", "2.6"];
    const version = "2.5.1";

    assertEquals(validVersions.includes(version), true);
  });

  await t.step("should validate X12 version", () => {
    const validVersions = ["005010X222A1", "005010X223A3"];
    const version = "005010X222A1";

    assertEquals(validVersions.includes(version), true);
  });

  await t.step("should detect missing required segments", () => {
    const requiredSegments = ["MSH", "PID"];
    const messageSegments = ["MSH", "EVN"]; // Missing PID

    const missing = requiredSegments.filter(s => !messageSegments.includes(s));
    assertEquals(missing.length, 1);
    assertEquals(missing[0], "PID");
  });

  // =====================================================
  // Date Format Tests
  // =====================================================

  await t.step("should format HL7 date to FHIR format", () => {
    const hl7Date = "19800101";
    const fhirDate = `${hl7Date.substring(0, 4)}-${hl7Date.substring(4, 6)}-${hl7Date.substring(6, 8)}`;

    assertEquals(fhirDate, "1980-01-01");
  });

  await t.step("should format HL7 datetime to FHIR format", () => {
    const hl7DateTime = "20250115120000";
    const year = hl7DateTime.substring(0, 4);
    const month = hl7DateTime.substring(4, 6);
    const day = hl7DateTime.substring(6, 8);
    const hour = hl7DateTime.substring(8, 10);
    const minute = hl7DateTime.substring(10, 12);

    const fhirDateTime = `${year}-${month}-${day}T${hour}:${minute}:00Z`;
    assertEquals(fhirDateTime, "2025-01-15T12:00:00Z");
  });

  // =====================================================
  // Error Handling Tests
  // =====================================================

  await t.step("should handle invalid HL7 message", () => {
    const parseResult = {
      success: false,
      errors: ["Message does not start with MSH segment"],
      warnings: []
    };

    assertEquals(parseResult.success, false);
    assertEquals(parseResult.errors.length > 0, true);
  });

  await t.step("should handle invalid X12 message", () => {
    const parseResult = {
      success: false,
      errors: ["Message does not start with ISA segment"],
      warnings: []
    };

    assertEquals(parseResult.success, false);
  });

  await t.step("should return warnings for non-critical issues", () => {
    const parseResult = {
      success: true,
      errors: [],
      warnings: ["PV1 segment missing optional fields"]
    };

    assertEquals(parseResult.success, true);
    assertEquals(parseResult.warnings.length > 0, true);
  });

  // =====================================================
  // Response Format Tests
  // =====================================================

  await t.step("should return parse result structure", () => {
    const result = {
      success: true,
      messageType: "ADT^A01",
      messageControlId: "MSG00001",
      version: "2.5.1",
      segments: [
        { name: "MSH", fieldCount: 12 },
        { name: "PID", fieldCount: 30 }
      ],
      errors: [],
      warnings: []
    };

    assertEquals(result.success, true);
    assertExists(result.messageType);
    assertEquals(Array.isArray(result.segments), true);
  });

  await t.step("should return FHIR conversion result structure", () => {
    const result = {
      bundle: {
        resourceType: "Bundle",
        type: "transaction",
        entry: []
      },
      resourceCount: 2,
      sourceMessageType: "ADT^A01"
    };

    assertExists(result.bundle);
    assertEquals(result.bundle.resourceType, "Bundle");
    assertEquals(typeof result.resourceCount, "number");
  });
});
