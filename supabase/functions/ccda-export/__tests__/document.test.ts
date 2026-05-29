// supabase/functions/ccda-export/__tests__/document.test.ts
//
// Behavioral tests for the decomposed C-CDA generator. Unlike index.test.ts
// (which exercises inline copies of the helpers), these import the REAL
// modules and assert on the actual generated document — they fail if the
// generator logic is removed or regresses (the deletion test).

import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { generateCCDA } from "../document.ts";
import type { CCDAData } from "../types.ts";
import { computeSha256 } from "../../_shared/integrityHash.ts";

function baseData(overrides: Partial<CCDAData> = {}): CCDAData {
  return {
    profile: {
      user_id: "patient-1",
      first_name: "Test",
      last_name: "Alpha",
      dob: "2000-01-01",
      gender: "female",
    },
    medications: [],
    allergies: [],
    conditions: [],
    procedures: [],
    immunizations: [],
    observations: [],
    labResults: [],
    carePlans: [],
    documentId: "patient-1-1700000000000",
    createdAt: "2026-05-29T10:00:00.000Z",
    ...overrides,
  };
}

Deno.test("generateCCDA emits a valid CCD header with patient demographics", () => {
  const xml = generateCCDA(baseData());

  assertStringIncludes(xml, '<?xml version="1.0" encoding="UTF-8"?>');
  // CCD template OID
  assertStringIncludes(xml, "2.16.840.1.113883.10.20.22.1.2");
  // patient name + gender mapped to administrative code
  assertStringIncludes(xml, "<given>Test</given>");
  assertStringIncludes(xml, "<family>Alpha</family>");
  assertStringIncludes(xml, 'administrativeGenderCode code="F"');
  // DOB formatted to HL7 YYYYMMDD
  assertStringIncludes(xml, '<birthTime value="20000101"/>');
});

Deno.test("generateCCDA renders all eight section titles", () => {
  const xml = generateCCDA(baseData());
  for (const title of [
    "Allergies and Intolerances",
    "Medications",
    "Problems",
    "Procedures",
    "Immunizations",
    "Vital Signs",
    "Results",
    "Plan of Care",
  ]) {
    assertStringIncludes(xml, `<title>${title}</title>`);
  }
});

Deno.test("empty sections render their no-data narrative", () => {
  const xml = generateCCDA(baseData());
  assertStringIncludes(xml, "No current medications.");
  assertStringIncludes(xml, "No known problems.");
  assertStringIncludes(xml, "No vital signs documented.");
  assertStringIncludes(xml, "No lab results documented.");
  // Allergies use the explicit "no known allergies" negation entry
  assertStringIncludes(xml, "No known allergies.");
});

Deno.test("medication data is rendered into the Medications table", () => {
  const xml = generateCCDA(baseData({
    medications: [{
      id: "m1", user_id: "patient-1", medication_name: "Metformin",
      dosage: "500mg", frequency: "twice daily", instructions: "with food",
      status: "active",
    }],
  }));
  assertStringIncludes(xml, "Metformin");
  assertStringIncludes(xml, "500mg");
  assertStringIncludes(xml, "twice daily");
});

Deno.test("vital signs use value_quantity_value / value_quantity_unit (live schema)", () => {
  const xml = generateCCDA(baseData({
    observations: [{
      id: "o1", patient_id: "patient-1", code: "8480-6",
      code_display: "Systolic blood pressure",
      value_quantity_value: 120, value_quantity_unit: "mmHg",
      effective_datetime: "2026-05-20T08:00:00Z",
    }],
  }));
  assertStringIncludes(xml, "Systolic blood pressure");
  // The value must actually appear — regression guard for the old
  // value_quantity/value_unit drift that always rendered "0".
  assertStringIncludes(xml, '<value xsi:type="PQ" value="120" unit="mmHg"/>');
  assert(!xml.includes("No vital signs documented."));
});

Deno.test("lab results use result_date (live schema) for the date column", () => {
  const xml = generateCCDA(baseData({
    labResults: [{
      id: "l1", patient_mrn: "patient-1", test_name: "Glucose",
      value: 95, unit: "mg/dL", reference_range: "70-100 mg/dL",
      result_date: "2026-05-15T10:00:00Z",
    }],
  }));
  assertStringIncludes(xml, "Glucose");
  assertStringIncludes(xml, "70-100 mg/dL");
  // result_date present → an effectiveTime with a value is emitted (not nullFlavor)
  assertStringIncludes(xml, '<effectiveTime value="20260515');
  assert(!xml.includes("No lab results documented."));
});

Deno.test("XML special characters in patient data are escaped", () => {
  const xml = generateCCDA(baseData({
    profile: { user_id: "patient-1", first_name: "A&B", last_name: "<X>" },
  }));
  assertStringIncludes(xml, "A&amp;B");
  assertStringIncludes(xml, "&lt;X&gt;");
  assert(!xml.includes("<given>A&B</given>"));
});

Deno.test("ONC integrity: SHA-256 of the document is stable and 64 hex chars", async () => {
  const xml = generateCCDA(baseData());
  const a = await computeSha256(xml);
  const b = await computeSha256(xml);
  assertEquals(a.hex, b.hex);
  assertEquals(a.hex.length, 64);
  assertEquals(a.algorithm, "SHA-256");
  // A different document must produce a different digest.
  const other = await computeSha256(generateCCDA(baseData({ documentId: "different" })));
  assert(other.hex !== a.hex);
});
