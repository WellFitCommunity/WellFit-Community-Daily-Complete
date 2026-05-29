// FHIR R4 Bundle conversion for the fhir_resources export type.
// Converts profiles + self_reports rows into a FHIR R4 collection Bundle.

import type { ExportRecord, FHIRBundleEntry } from "./types.ts";

export function convertToFHIRBundle(data: ExportRecord[], tenantId: string): object {
  const bundleId = `bundle-${tenantId}-${Date.now()}`;
  const entries: FHIRBundleEntry[] = [];

  for (const record of data) {
    // Detect if this is a profile record or a self_report record
    if (record.first_name || record.last_name) {
      // Profile → FHIR Patient
      entries.push({
        fullUrl: `Patient/${record.user_id || record.id}`,
        resource: {
          resourceType: "Patient",
          id: record.user_id || record.id,
          identifier: [
            {
              system: "http://wellfitcommunity.org/patient-id",
              value: record.user_id || record.id,
            },
          ],
          name: [
            {
              use: "official",
              family: record.last_name || "",
              given: [record.first_name || ""],
            },
          ],
          telecom: [
            record.phone && {
              system: "phone",
              value: record.phone,
              use: "mobile",
            },
            record.email && {
              system: "email",
              value: record.email,
              use: "home",
            },
          ].filter(Boolean),
          birthDate: record.dob || undefined,
          address: record.address
            ? [
                {
                  use: "home",
                  text: record.address,
                },
              ]
            : undefined,
        },
      });
    }

    // Mood Observation
    if (record.mood) {
      entries.push({
        fullUrl: `Observation/mood-${record.id}`,
        resource: {
          resourceType: "Observation",
          id: `mood-${record.id}`,
          status: "final",
          category: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/observation-category",
                  code: "survey",
                  display: "Survey",
                },
              ],
            },
          ],
          code: {
            coding: [
              {
                system: "http://wellfitcommunity.org/fhir/codes",
                code: "mood-assessment",
                display: "Mood Assessment",
              },
            ],
          },
          subject: { reference: `Patient/${record.user_id}` },
          effectiveDateTime: record.created_at,
          valueString: record.mood,
        },
      });
    }

    // Blood Pressure Observation
    if (record.bp_systolic && record.bp_diastolic) {
      entries.push({
        fullUrl: `Observation/bp-${record.id}`,
        resource: {
          resourceType: "Observation",
          id: `bp-${record.id}`,
          status: "final",
          category: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/observation-category",
                  code: "vital-signs",
                  display: "Vital Signs",
                },
              ],
            },
          ],
          code: {
            coding: [
              {
                system: "http://loinc.org",
                code: "85354-9",
                display: "Blood pressure panel",
              },
            ],
          },
          subject: { reference: `Patient/${record.user_id}` },
          effectiveDateTime: record.created_at,
          component: [
            {
              code: {
                coding: [{ system: "http://loinc.org", code: "8480-6", display: "Systolic BP" }],
              },
              valueQuantity: {
                value: record.bp_systolic,
                unit: "mmHg",
                system: "http://unitsofmeasure.org",
                code: "mm[Hg]",
              },
            },
            {
              code: {
                coding: [{ system: "http://loinc.org", code: "8462-4", display: "Diastolic BP" }],
              },
              valueQuantity: {
                value: record.bp_diastolic,
                unit: "mmHg",
                system: "http://unitsofmeasure.org",
                code: "mm[Hg]",
              },
            },
          ],
        },
      });
    }

    // Blood Oxygen (SpO2) Observation
    if (record.blood_oxygen || record.spo2) {
      entries.push({
        fullUrl: `Observation/spo2-${record.id}`,
        resource: {
          resourceType: "Observation",
          id: `spo2-${record.id}`,
          status: "final",
          category: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/observation-category",
                  code: "vital-signs",
                  display: "Vital Signs",
                },
              ],
            },
          ],
          code: {
            coding: [{ system: "http://loinc.org", code: "2708-6", display: "Oxygen saturation" }],
          },
          subject: { reference: `Patient/${record.user_id}` },
          effectiveDateTime: record.created_at,
          valueQuantity: {
            value: record.blood_oxygen || record.spo2,
            unit: "%",
            system: "http://unitsofmeasure.org",
            code: "%",
          },
        },
      });
    }

    // Blood Sugar Observation
    if (record.blood_sugar) {
      entries.push({
        fullUrl: `Observation/glucose-${record.id}`,
        resource: {
          resourceType: "Observation",
          id: `glucose-${record.id}`,
          status: "final",
          category: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/observation-category",
                  code: "vital-signs",
                  display: "Vital Signs",
                },
              ],
            },
          ],
          code: {
            coding: [{ system: "http://loinc.org", code: "33747-0", display: "Glucose" }],
          },
          subject: { reference: `Patient/${record.user_id}` },
          effectiveDateTime: record.created_at,
          valueQuantity: {
            value: record.blood_sugar,
            unit: "mg/dL",
            system: "http://unitsofmeasure.org",
            code: "mg/dL",
          },
        },
      });
    }

    // Weight Observation
    if (record.weight) {
      entries.push({
        fullUrl: `Observation/weight-${record.id}`,
        resource: {
          resourceType: "Observation",
          id: `weight-${record.id}`,
          status: "final",
          category: [
            {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/observation-category",
                  code: "vital-signs",
                  display: "Vital Signs",
                },
              ],
            },
          ],
          code: {
            coding: [{ system: "http://loinc.org", code: "29463-7", display: "Body Weight" }],
          },
          subject: { reference: `Patient/${record.user_id}` },
          effectiveDateTime: record.created_at,
          valueQuantity: {
            value: record.weight,
            unit: "lb",
            system: "http://unitsofmeasure.org",
            code: "[lb_av]",
          },
        },
      });
    }
  }

  return {
    resourceType: "Bundle",
    id: bundleId,
    type: "collection",
    timestamp: new Date().toISOString(),
    total: entries.length,
    entry: entries,
  };
}
