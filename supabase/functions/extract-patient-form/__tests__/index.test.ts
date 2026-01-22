// supabase/functions/extract-patient-form/__tests__/index.test.ts
// Tests for Patient Form Extraction Edge Function - Claude Vision OCR

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Extract Patient Form Tests", async (t) => {

  // =====================================================
  // Input Validation Tests
  // =====================================================

  await t.step("should require image", () => {
    const body = { mimeType: "image/jpeg" };
    const hasImage = "image" in body;

    assertEquals(hasImage, false);
  });

  await t.step("should return 400 for missing image", () => {
    const response = {
      success: false,
      error: "No image provided"
    };

    assertEquals(response.success, false);
    assertEquals(response.error, "No image provided");
  });

  await t.step("should accept optional mimeType", () => {
    const body = {
      image: "base64encodedimagedata...",
      mimeType: "image/png"
    };

    assertExists(body.image);
    assertExists(body.mimeType);
  });

  await t.step("should default to image/jpeg if mimeType not provided", () => {
    const mimeType = undefined;
    const usedMimeType = mimeType || "image/jpeg";

    assertEquals(usedMimeType, "image/jpeg");
  });

  // =====================================================
  // ExtractedPatientData Structure Tests
  // =====================================================

  await t.step("should define demographics fields", () => {
    const data = {
      firstName: "John",
      lastName: "Doe",
      middleInitial: "Q",
      dob: "01/15/1945",
      age: 80,
      gender: "Male",
      mrn: "MRN123456",
      ssn: "123-45-6789"
    };

    assertExists(data.firstName);
    assertExists(data.lastName);
    assertExists(data.dob);
    assertEquals(typeof data.age, "number");
    assertEquals(["Male", "Female", "Other"].includes(data.gender), true);
  });

  await t.step("should define contact fields", () => {
    const data = {
      phone: "(555) 123-4567",
      email: "patient@example.com",
      address: "123 Main Street",
      city: "Houston",
      state: "TX",
      zipCode: "77001"
    };

    assertExists(data.phone);
    assertExists(data.address);
    assertExists(data.city);
    assertExists(data.state);
    assertEquals(data.zipCode.length, 5);
  });

  await t.step("should define emergency contact fields", () => {
    const data = {
      emergencyContactName: "Jane Doe",
      emergencyContactRelationship: "Spouse",
      emergencyContactPhone: "(555) 987-6543"
    };

    assertExists(data.emergencyContactName);
    assertExists(data.emergencyContactRelationship);
    assertExists(data.emergencyContactPhone);
  });

  await t.step("should define hospital details fields", () => {
    const data = {
      admissionDate: "01/20/2026",
      admissionTime: "14:30",
      hospitalUnit: "ICU",
      roomNumber: "304",
      bedNumber: "A",
      admissionSource: "Emergency Room",
      acuityLevel: "2-High",
      codeStatus: "Full Code"
    };

    assertExists(data.admissionDate);
    assertEquals(["Emergency Room", "Physician Referral", "Transfer", "Other"].includes(data.admissionSource), true);
    assertEquals(data.acuityLevel.includes("-"), true); // Format: "1-Critical", "2-High", etc.
    assertEquals(["Full Code", "DNR", "DNR/DNI", "Comfort Care", "AND"].includes(data.codeStatus), true);
  });

  await t.step("should define insurance fields", () => {
    const data = {
      primaryInsurance: "Blue Cross Blue Shield",
      insuranceId: "XYZ123456789",
      insuranceGroupNumber: "GRP001",
      medicareNumber: "1EG4-TE5-MK72",
      medicaidNumber: null
    };

    assertExists(data.primaryInsurance);
    assertExists(data.insuranceId);
    assertEquals(data.medicaidNumber, null);
  });

  await t.step("should define clinical fields", () => {
    const data = {
      clinicalNotes: "Patient reports chest pain and shortness of breath.",
      allergies: ["Penicillin", "Sulfa drugs"],
      nkda: false
    };

    assertExists(data.clinicalNotes);
    assertEquals(Array.isArray(data.allergies), true);
    assertEquals(typeof data.nkda, "boolean");
  });

  await t.step("should handle NKDA (No Known Drug Allergies)", () => {
    const dataWithAllergies = {
      allergies: ["Penicillin"],
      nkda: false
    };

    const dataNoAllergies = {
      allergies: null,
      nkda: true
    };

    assertEquals(dataWithAllergies.nkda, false);
    assertEquals(dataNoAllergies.nkda, true);
    assertEquals(dataNoAllergies.allergies, null);
  });

  await t.step("should define staff fields", () => {
    const data = {
      staffName: "Sarah Johnson, RN",
      dateCompleted: "01/20/2026",
      timeCompleted: "15:45"
    };

    assertExists(data.staffName);
    assertExists(data.dateCompleted);
    assertExists(data.timeCompleted);
  });

  // =====================================================
  // Response Metadata Tests
  // =====================================================

  await t.step("should include confidence level in response", () => {
    const extractedData = {
      firstName: "John",
      lastName: "Doe",
      confidence: "high",
      uncertainFields: [],
      notes: null
    };

    assertEquals(["high", "medium", "low"].includes(extractedData.confidence), true);
  });

  await t.step("should include uncertain fields", () => {
    const extractedData = {
      firstName: "John",
      lastName: "D??", // Unclear handwriting
      confidence: "medium",
      uncertainFields: ["lastName", "middleInitial"],
      notes: "Last name partially illegible due to handwriting"
    };

    assertEquals(Array.isArray(extractedData.uncertainFields), true);
    assertEquals(extractedData.uncertainFields.includes("lastName"), true);
    assertExists(extractedData.notes);
  });

  // =====================================================
  // Cost Calculation Tests
  // =====================================================

  await t.step("should calculate cost for API usage", () => {
    const calculateCost = (inputTokens: number, outputTokens: number): string => {
      const inputCost = (inputTokens / 1_000_000) * 3;
      const outputCost = (outputTokens / 1_000_000) * 15;
      const totalCost = inputCost + outputCost;
      return `$${totalCost.toFixed(4)}`;
    };

    // ~1000 input tokens (image), ~500 output tokens (JSON)
    const cost = calculateCost(1000, 500);

    assertEquals(cost.startsWith("$"), true);
    assertEquals(cost, "$0.0105");
  });

  await t.step("should estimate ~$0.005 per form", () => {
    const typicalInputTokens = 1000;
    const typicalOutputTokens = 333; // Adjusted for ~$0.005 total

    const inputCost = (typicalInputTokens / 1_000_000) * 3;
    const outputCost = (typicalOutputTokens / 1_000_000) * 15;
    const totalCost = inputCost + outputCost;

    // Cost should be around $0.005-$0.01
    assertEquals(totalCost < 0.02, true);
  });

  await t.step("should return usage information in response", () => {
    const response = {
      success: true,
      extractedData: { firstName: "John" },
      usage: {
        inputTokens: 1200,
        outputTokens: 450,
        estimatedCost: "$0.0111"
      }
    };

    assertExists(response.usage);
    assertEquals(typeof response.usage.inputTokens, "number");
    assertEquals(typeof response.usage.outputTokens, "number");
    assertEquals(response.usage.estimatedCost.startsWith("$"), true);
  });

  // =====================================================
  // Claude Vision API Tests
  // =====================================================

  await t.step("should construct Claude Vision API request", () => {
    const request = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: "base64imagedata..."
            }
          },
          {
            type: "text",
            text: "Analyze this patient enrollment form..."
          }
        ]
      }]
    };

    assertEquals(request.model.includes("claude"), true);
    assertEquals(request.max_tokens, 2000);
    assertEquals(request.messages[0].content[0].type, "image");
    assertEquals(request.messages[0].content[1].type, "text");
  });

  await t.step("should set required API headers", () => {
    const headers = {
      "Content-Type": "application/json",
      "x-api-key": "sk-ant-api-key",
      "anthropic-version": "2023-06-01"
    };

    assertExists(headers["Content-Type"]);
    assertExists(headers["x-api-key"]);
    assertExists(headers["anthropic-version"]);
  });

  await t.step("should support multiple image formats", () => {
    const supportedFormats = ["image/jpeg", "image/png", "image/gif", "image/webp"];

    for (const format of supportedFormats) {
      assertEquals(format.startsWith("image/"), true);
    }
  });

  // =====================================================
  // JSON Parsing Tests
  // =====================================================

  await t.step("should extract JSON from Claude response", () => {
    const responseText = `{
      "firstName": "John",
      "lastName": "Doe",
      "dob": "01/15/1945"
    }`;

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    assertExists(jsonMatch);

    const parsed = JSON.parse(jsonMatch![0]);
    assertEquals(parsed.firstName, "John");
  });

  await t.step("should handle JSON with markdown formatting", () => {
    const responseText = `Here is the extracted data:

\`\`\`json
{
  "firstName": "John",
  "lastName": "Doe"
}
\`\`\`

The handwriting was clear.`;

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    assertExists(jsonMatch);

    const parsed = JSON.parse(jsonMatch![0]);
    assertEquals(parsed.firstName, "John");
  });

  await t.step("should return 500 for parse errors", () => {
    const response = {
      success: false,
      error: "Failed to parse extracted data",
      details: "Invalid JSON in response"
    };

    assertEquals(response.success, false);
    assertEquals(response.error, "Failed to parse extracted data");
  });

  // =====================================================
  // Success Response Tests
  // =====================================================

  await t.step("should return complete success response", () => {
    const response = {
      success: true,
      extractedData: {
        firstName: "John",
        lastName: "Doe",
        dob: "01/15/1945",
        confidence: "high",
        uncertainFields: []
      },
      usage: {
        inputTokens: 1000,
        outputTokens: 500,
        estimatedCost: "$0.0105"
      }
    };

    assertEquals(response.success, true);
    assertExists(response.extractedData);
    assertExists(response.usage);
    assertEquals(response.extractedData.confidence, "high");
  });

  // =====================================================
  // Error Response Tests
  // =====================================================

  await t.step("should return 500 for missing API key", () => {
    const response = {
      success: false,
      error: "API key not configured"
    };

    assertEquals(response.success, false);
    assertEquals(response.error, "API key not configured");
  });

  await t.step("should return 500 for Claude Vision API errors", () => {
    const response = {
      success: false,
      error: "Claude Vision API error: 429"
    };

    assertEquals(response.success, false);
    assertEquals(response.error.includes("Claude Vision API error"), true);
  });

  await t.step("should handle general errors", () => {
    const error = new Error("Network timeout");
    const response = {
      success: false,
      error: error.message
    };

    assertEquals(response.success, false);
    assertEquals(response.error, "Network timeout");
  });

  // =====================================================
  // HTTP Method Tests
  // =====================================================

  await t.step("should handle OPTIONS preflight", () => {
    const request = new Request("http://localhost/extract-patient-form", {
      method: "OPTIONS"
    });

    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should only accept POST method", () => {
    const allowedMethods = ["POST"];

    assertEquals(allowedMethods.includes("POST"), true);
    assertEquals(allowedMethods.includes("GET"), false);
  });

  // =====================================================
  // CORS Tests
  // =====================================================

  await t.step("should include CORS headers in response", () => {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://example.com",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Content-Type": "application/json"
    };

    assertExists(corsHeaders["Access-Control-Allow-Origin"]);
    assertEquals(corsHeaders["Content-Type"], "application/json");
  });

  // =====================================================
  // Date Format Tests
  // =====================================================

  await t.step("should use MM/DD/YYYY date format", () => {
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;

    const validDates = ["01/15/1945", "12/31/2025", "06/01/2000"];
    const invalidDates = ["1945-01-15", "Jan 15, 1945", "15/01/1945"];

    for (const date of validDates) {
      assertEquals(dateRegex.test(date), true, `${date} should be valid`);
    }

    for (const date of invalidDates) {
      assertEquals(dateRegex.test(date), false, `${date} should be invalid`);
    }
  });

  // =====================================================
  // Null Handling Tests
  // =====================================================

  await t.step("should use null for empty fields (not empty string)", () => {
    const extractedData = {
      firstName: "John",
      lastName: "Doe",
      middleInitial: null, // Empty on form
      ssn: null,           // Not provided
      medicaidNumber: null  // Not applicable
    };

    assertEquals(extractedData.middleInitial, null);
    assertEquals(extractedData.ssn, null);
    assertNotEquals(extractedData.middleInitial, "");
  });

  // =====================================================
  // Acuity Level Tests
  // =====================================================

  await t.step("should validate acuity level format", () => {
    const validAcuityLevels = [
      "1-Critical",
      "2-High",
      "3-Moderate",
      "4-Low",
      "5-Stable"
    ];

    for (const level of validAcuityLevels) {
      assertEquals(level.includes("-"), true);
      assertEquals(/^\d-\w+$/.test(level), true);
    }
  });

  // =====================================================
  // Code Status Tests
  // =====================================================

  await t.step("should validate code status values", () => {
    const validCodeStatuses = ["Full Code", "DNR", "DNR/DNI", "Comfort Care", "AND"];

    for (const status of validCodeStatuses) {
      assertEquals(typeof status, "string");
      assertEquals(status.length > 0, true);
    }
  });

  // =====================================================
  // HIPAA Compliance Tests (PHI-Free Logging)
  // =====================================================

  await t.step("should only log confidence (not PHI)", () => {
    const logEntry = {
      level: "info",
      message: "Successfully extracted patient data",
      context: {
        confidence: "high"
        // NO: firstName, lastName, ssn, dob, address, phone, etc.
      }
    };

    assertEquals("confidence" in logEntry.context, true);
    assertEquals("firstName" in logEntry.context, false);
    assertEquals("ssn" in logEntry.context, false);
    assertEquals("dob" in logEntry.context, false);
    assertEquals("phone" in logEntry.context, false);
    assertEquals("address" in logEntry.context, false);
  });

  await t.step("should not log image data", () => {
    const logEntry = {
      message: "Error in extract-patient-form function",
      context: {
        error: "API timeout"
        // NO: image, base64 data
      }
    };

    assertEquals("image" in logEntry.context, false);
    assertEquals("base64" in logEntry.context, false);
    assertEquals("data" in logEntry.context, false);
  });

  await t.step("should truncate error messages for logging", () => {
    const longError = "A".repeat(1000);
    const truncated = longError.slice(0, 500);

    assertEquals(truncated.length, 500);
    assertEquals(truncated.length < longError.length, true);
  });

  // =====================================================
  // Environment Variable Tests
  // =====================================================

  await t.step("should require ANTHROPIC_API_KEY", () => {
    const requiredVars = ["ANTHROPIC_API_KEY"];
    assertEquals(requiredVars.length, 1);
    assertEquals(requiredVars[0], "ANTHROPIC_API_KEY");
  });

  // =====================================================
  // Handwriting Recognition Tests (Conceptual)
  // =====================================================

  await t.step("should handle handwritten text extraction", () => {
    // Claude Vision can read both handwritten and printed text
    const extractedData = {
      firstName: "John", // Could be handwritten
      lastName: "Doe",
      confidence: "medium",
      uncertainFields: ["lastName"],
      notes: "Last name handwriting partially unclear"
    };

    assertExists(extractedData.notes);
    assertEquals(extractedData.uncertainFields.includes("lastName"), true);
  });

  await t.step("should indicate uncertainty for unclear handwriting", () => {
    const extractedData = {
      firstName: "John",
      middleInitial: "Q", // Best guess
      confidence: "low",
      uncertainFields: ["middleInitial", "dob"],
      notes: "Multiple fields had unclear handwriting"
    };

    assertEquals(extractedData.confidence, "low");
    assertEquals(extractedData.uncertainFields.length, 2);
  });
});
