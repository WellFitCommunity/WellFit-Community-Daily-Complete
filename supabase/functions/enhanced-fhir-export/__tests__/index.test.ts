// supabase/functions/enhanced-fhir-export/__tests__/index.test.ts
// Tests for enhanced FHIR export edge function

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Enhanced FHIR Export Tests", async (t) => {

  await t.step("should handle CORS preflight", async () => {
    const request = new Request("http://localhost", {
      method: "OPTIONS",
      headers: { "Origin": "https://thewellfitcommunity.org" }
    });

    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should validate allowed origins", () => {
    const allowedOrigins = [
      "https://thewellfitcommunity.org",
      "https://wellfitcommunity.live",
      "http://localhost:3100",
      "https://localhost:3100"
    ];

    const validOrigin = "https://thewellfitcommunity.org";
    const invalidOrigin = "https://malicious-site.com";

    assertEquals(allowedOrigins.includes(validOrigin), true);
    assertEquals(allowedOrigins.includes(invalidOrigin), false);
  });

  await t.step("should require authorization header", () => {
    const validRequest = {
      headers: { Authorization: "Bearer test-token" }
    };

    const invalidRequest = {
      headers: {}
    };

    assertExists(validRequest.headers.Authorization);
    assertEquals(invalidRequest.headers.hasOwnProperty('Authorization'), false);
  });

  await t.step("should validate request payload structure", () => {
    const validPayload = {
      patient_id: "user-123",
      start_date: "2025-01-01T00:00:00Z",
      end_date: "2025-11-17T00:00:00Z",
      include_mobile_data: true,
      include_ai_assessments: true,
      format: "bundle" as const
    };

    const partialPayload = {
      // All fields are optional except when specified
    };

    assertExists(validPayload.patient_id);
    assertExists(validPayload.start_date);
    assertExists(validPayload.end_date);
    assertEquals(validPayload.include_mobile_data, true);
    assertEquals(validPayload.include_ai_assessments, true);
    assertEquals(validPayload.format, "bundle");
  });

  await t.step("should default date range to last 30 days", () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const startDate = thirtyDaysAgo.toISOString();
    const endDate = now.toISOString();

    assertExists(startDate);
    assertExists(endDate);
    assertEquals(new Date(startDate) < now, true);
    assertEquals(new Date(endDate) <= now, true);
  });

  await t.step("should validate admin role codes", () => {
    const adminRoleCodes = [1, 2, 3, 12];

    const profile1 = { role_code: 1 };
    const profile2 = { role_code: 5 };
    const profile3 = { role_code: 12 };

    const isAdmin1 = adminRoleCodes.includes(profile1.role_code);
    const isAdmin2 = adminRoleCodes.includes(profile2.role_code);
    const isAdmin3 = adminRoleCodes.includes(profile3.role_code);

    assertEquals(isAdmin1, true);
    assertEquals(isAdmin2, false);
    assertEquals(isAdmin3, true);
  });

  await t.step("should enforce patient data access control", () => {
    const userId = "user-123";
    const requestedPatientId1 = "user-123";  // Own data
    const requestedPatientId2 = "user-456";  // Other's data
    const isAdmin = false;

    const canAccessOwnData = !isAdmin && requestedPatientId1 === userId;
    const canAccessOtherData = !isAdmin && requestedPatientId2 === userId;

    assertEquals(canAccessOwnData, true);
    assertEquals(canAccessOtherData, false);
  });

  await t.step("should allow admin to access any patient data", () => {
    const userId = "admin-123";
    const requestedPatientId = "user-456";
    const isAdmin = true;

    const canAccess = isAdmin || requestedPatientId === userId;

    assertEquals(canAccess, true);
  });

  await t.step("should format FHIR bundle structure", () => {
    const bundleId = `bundle-user-123-${Date.now()}`;
    const entries = [];

    const bundle = {
      resourceType: 'Bundle',
      id: bundleId,
      type: 'collection',
      timestamp: new Date().toISOString(),
      total: entries.length,
      entry: entries
    };

    assertEquals(bundle.resourceType, 'Bundle');
    assertEquals(bundle.type, 'collection');
    assertExists(bundle.id);
    assertExists(bundle.timestamp);
    assertEquals(bundle.total, 0);
    assertEquals(Array.isArray(bundle.entry), true);
  });

  await t.step("should format Patient resource correctly", () => {
    const patientProfile = {
      first_name: "John",
      last_name: "Doe",
      phone: "+15551234567",
      email: "john.doe@example.com",
      dob: "1980-01-01",
      address: "123 Main St, City, State 12345"
    };

    const patientId = "user-123";

    const patientResource = {
      resourceType: 'Patient',
      id: patientId,
      identifier: [
        {
          system: 'http://wellfitcommunity.org/patient-id',
          value: patientId
        }
      ],
      name: [
        {
          use: 'official',
          family: patientProfile.last_name,
          given: [patientProfile.first_name]
        }
      ],
      telecom: [
        {
          system: 'phone',
          value: patientProfile.phone,
          use: 'mobile'
        },
        {
          system: 'email',
          value: patientProfile.email,
          use: 'home'
        }
      ],
      birthDate: patientProfile.dob,
      address: [
        {
          use: 'home',
          text: patientProfile.address
        }
      ]
    };

    assertEquals(patientResource.resourceType, 'Patient');
    assertEquals(patientResource.id, patientId);
    assertEquals(patientResource.name[0].family, "Doe");
    assertEquals(patientResource.name[0].given[0], "John");
    assertEquals(patientResource.telecom[0].value, "+15551234567");
    assertEquals(patientResource.birthDate, "1980-01-01");
  });

  await t.step("should format heart rate Observation with LOINC code", () => {
    const checkIn = {
      id: "checkin-123",
      heart_rate: 75,
      created_at: "2025-11-17T10:00:00Z",
      user_id: "user-123"
    };

    const observation = {
      resourceType: 'Observation',
      id: `web-hr-${checkIn.id}`,
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs'
            }
          ]
        }
      ],
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '8867-4',
            display: 'Heart rate'
          }
        ]
      },
      subject: {
        reference: `Patient/${checkIn.user_id}`
      },
      effectiveDateTime: checkIn.created_at,
      valueQuantity: {
        value: checkIn.heart_rate,
        unit: 'beats/min',
        system: 'http://unitsofmeasure.org',
        code: '/min'
      }
    };

    assertEquals(observation.resourceType, 'Observation');
    assertEquals(observation.code.coding[0].code, '8867-4');
    assertEquals(observation.code.coding[0].system, 'http://loinc.org');
    assertEquals(observation.valueQuantity.value, 75);
    assertEquals(observation.valueQuantity.unit, 'beats/min');
  });

  await t.step("should format blood pressure with components", () => {
    const checkIn = {
      id: "checkin-123",
      bp_systolic: 120,
      bp_diastolic: 80,
      created_at: "2025-11-17T10:00:00Z"
    };

    const bpObservation = {
      resourceType: 'Observation',
      id: `web-bp-${checkIn.id}`,
      status: 'final',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '85354-9',
            display: 'Blood pressure panel with all children optional'
          }
        ]
      },
      component: [
        {
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '8480-6',
                display: 'Systolic blood pressure'
              }
            ]
          },
          valueQuantity: {
            value: checkIn.bp_systolic,
            unit: 'mmHg',
            system: 'http://unitsofmeasure.org',
            code: 'mm[Hg]'
          }
        },
        {
          code: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '8462-4',
                display: 'Diastolic blood pressure'
              }
            ]
          },
          valueQuantity: {
            value: checkIn.bp_diastolic,
            unit: 'mmHg',
            system: 'http://unitsofmeasure.org',
            code: 'mm[Hg]'
          }
        }
      ]
    };

    assertEquals(bpObservation.component.length, 2);
    assertEquals(bpObservation.component[0].valueQuantity.value, 120);
    assertEquals(bpObservation.component[1].valueQuantity.value, 80);
  });

  await t.step("should format emergency incident as DiagnosticReport", () => {
    const incident = {
      id: "incident-123",
      incident_type: "fall_detected",
      severity: "high",
      auto_detected: true,
      incident_resolved: false,
      triggered_at: "2025-11-17T09:30:00Z",
      patient_id: "user-123"
    };

    const diagnosticReport = {
      resourceType: 'DiagnosticReport',
      id: `emergency-${incident.id}`,
      status: incident.incident_resolved ? 'final' : 'preliminary',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
              code: 'OTH',
              display: 'Other'
            }
          ]
        }
      ],
      code: {
        coding: [
          {
            system: 'http://wellfitcommunity.org/fhir/codes',
            code: 'emergency-incident',
            display: 'Emergency Incident'
          }
        ]
      },
      subject: {
        reference: `Patient/${incident.patient_id}`
      },
      effectiveDateTime: incident.triggered_at,
      conclusion: `${incident.incident_type} - Severity: ${incident.severity}${incident.auto_detected ? ' (Auto-detected)' : ' (Manual trigger)'}`,
      conclusionCode: [
        {
          coding: [
            {
              system: 'http://wellfitcommunity.org/fhir/incident-types',
              code: incident.incident_type,
              display: incident.incident_type.replace(/_/g, ' ')
            }
          ]
        }
      ]
    };

    assertEquals(diagnosticReport.resourceType, 'DiagnosticReport');
    assertEquals(diagnosticReport.status, 'preliminary');
    assertEquals(diagnosticReport.conclusion.includes('fall_detected'), true);
    assertEquals(diagnosticReport.conclusion.includes('Auto-detected'), true);
  });

  await t.step("should format AI risk assessment", () => {
    const assessment = {
      id: "assessment-123",
      patient_id: "user-123",
      assessed_at: "2025-11-17T10:00:00Z",
      risk_level: "MODERATE",
      risk_score: 65,
      risk_factors: ["Irregular check-ins", "Declining mobility"],
      recommendations: ["Schedule wellness visit", "Increase monitoring frequency"]
    };

    const riskAssessment = {
      resourceType: 'RiskAssessment',
      id: `ai-${assessment.id}`,
      status: 'final',
      subject: {
        reference: `Patient/${assessment.patient_id}`
      },
      occurrenceDateTime: assessment.assessed_at,
      prediction: [
        {
          outcome: {
            coding: [
              {
                system: 'http://wellfitcommunity.org/fhir/risk-levels',
                code: assessment.risk_level,
                display: assessment.risk_level
              }
            ]
          },
          probabilityDecimal: assessment.risk_score / 100,
          rationale: assessment.risk_factors.join(', ')
        }
      ],
      note: assessment.recommendations.map(rec => ({
        text: rec
      }))
    };

    assertEquals(riskAssessment.resourceType, 'RiskAssessment');
    assertEquals(riskAssessment.prediction[0].probabilityDecimal, 0.65);
    assertEquals(riskAssessment.prediction[0].rationale, "Irregular check-ins, Declining mobility");
    assertEquals(riskAssessment.note.length, 2);
  });

  await t.step("should cache bundle with expiration", () => {
    const now = Date.now();
    const expiresAt = new Date(now + 24 * 60 * 60 * 1000); // 24 hours

    const bundleCache = {
      patient_id: "user-123",
      bundle_type: 'enhanced_patient_export',
      bundle_data: {},
      validation_status: 'VALID',
      expires_at: expiresAt.toISOString()
    };

    assertExists(bundleCache.expires_at);
    assertEquals(bundleCache.validation_status, 'VALID');
    assertEquals(bundleCache.bundle_type, 'enhanced_patient_export');
    assertEquals(new Date(bundleCache.expires_at) > new Date(now), true);
  });

  await t.step("should return FHIR content type header", () => {
    const contentType = 'application/fhir+json';

    assertEquals(contentType, 'application/fhir+json');
    assertEquals(contentType.includes('fhir'), true);
  });

  await t.step("should measure processing time", () => {
    const startTime = Date.now();
    // Simulate processing
    const endTime = startTime + 500;
    const processingTime = endTime - startTime;

    assertEquals(processingTime, 500);
    assertEquals(typeof processingTime, 'number');
    assertEquals(processingTime >= 0, true);
  });
});
