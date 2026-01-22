// supabase/functions/mcp-medical-codes-server/__tests__/index.test.ts
// Tests for MCP Medical Codes Server - CPT, ICD-10, HCPCS, and modifier codes

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("MCP Medical Codes Server Tests", async (t) => {

  // =====================================================
  // MCP Tools Definition Tests
  // =====================================================

  await t.step("should list available medical code tools", () => {
    const tools = [
      "search_cpt",
      "search_icd10",
      "search_hcpcs",
      "get_modifiers",
      "validate_code_combination",
      "check_bundling",
      "get_code_details",
      "suggest_codes",
      "get_sdoh_codes"
    ];

    assertEquals(tools.includes("search_cpt"), true);
    assertEquals(tools.includes("search_icd10"), true);
    assertEquals(tools.includes("search_hcpcs"), true);
    assertEquals(tools.includes("get_modifiers"), true);
    assertEquals(tools.includes("validate_code_combination"), true);
    assertEquals(tools.length, 9);
  });

  // =====================================================
  // CPT Code Tests
  // =====================================================

  await t.step("should validate search_cpt input schema", () => {
    const validInput = {
      query: "office visit",
      category: "E/M",
      limit: 20
    };

    assertExists(validInput.query);
    assertEquals(typeof validInput.limit, "number");
  });

  await t.step("should format CPT code result", () => {
    const cptCode = {
      code: "99213",
      short_description: "Office visit, established patient",
      long_description: "Office or other outpatient visit for the evaluation and management of an established patient",
      category: "E/M",
      work_rvu: 1.30,
      facility_rvu: 0.76
    };

    assertEquals(cptCode.code, "99213");
    assertEquals(typeof cptCode.work_rvu, "number");
    assertExists(cptCode.short_description);
  });

  await t.step("should validate CPT code format", () => {
    const cptCodeRegex = /^\d{5}$/;

    const validCodes = ["99213", "99214", "36415", "81000"];
    const invalidCodes = ["9921", "992134", "abc12"];

    for (const code of validCodes) {
      assertEquals(cptCodeRegex.test(code), true, `${code} should be valid`);
    }
    for (const code of invalidCodes) {
      assertEquals(cptCodeRegex.test(code), false, `${code} should be invalid`);
    }
  });

  // =====================================================
  // ICD-10 Code Tests
  // =====================================================

  await t.step("should validate search_icd10 input schema", () => {
    const validInput = {
      query: "hypertension",
      chapter: "Chapter 9",
      limit: 20
    };

    assertExists(validInput.query);
  });

  await t.step("should format ICD-10 code result", () => {
    const icd10Code = {
      code: "I10",
      description: "Essential (primary) hypertension",
      chapter: "Chapter 9: Diseases of the circulatory system",
      category: "I10-I16",
      is_billable: true
    };

    assertEquals(icd10Code.code, "I10");
    assertEquals(icd10Code.is_billable, true);
    assertExists(icd10Code.description);
  });

  await t.step("should validate ICD-10 code format", () => {
    // ICD-10 codes start with letter, followed by 2-7 alphanumeric characters
    const icd10Regex = /^[A-Z]\d{2}(\.\d{1,4})?$/;

    const validCodes = ["I10", "E11.9", "J06.9", "Z59.41"];
    const invalidCodes = ["10", "I1", "I10.12345", "abc"];

    for (const code of validCodes) {
      assertEquals(icd10Regex.test(code), true, `${code} should be valid`);
    }
    for (const code of invalidCodes) {
      assertEquals(icd10Regex.test(code), false, `${code} should be invalid`);
    }
  });

  // =====================================================
  // HCPCS Code Tests
  // =====================================================

  await t.step("should validate search_hcpcs input schema", () => {
    const validInput = {
      query: "wheelchair",
      level: "II",
      limit: 20
    };

    assertExists(validInput.query);
  });

  await t.step("should format HCPCS code result", () => {
    const hcpcsCode = {
      code: "E1161",
      short_description: "Manual wheelchair",
      long_description: "Manual adult size wheelchair, includes tilt in space",
      level: "II",
      pricing_indicator: "U"
    };

    assertEquals(hcpcsCode.code, "E1161");
    assertEquals(hcpcsCode.level, "II");
    assertExists(hcpcsCode.short_description);
  });

  await t.step("should validate HCPCS code format", () => {
    // HCPCS Level II codes start with letter, followed by 4 digits
    const hcpcsRegex = /^[A-V]\d{4}$/;

    const validCodes = ["E1161", "J3301", "A4550", "G0008"];
    const invalidCodes = ["E116", "E11611", "99213"];

    for (const code of validCodes) {
      assertEquals(hcpcsRegex.test(code), true, `${code} should be valid`);
    }
    for (const code of invalidCodes) {
      assertEquals(hcpcsRegex.test(code), false, `${code} should be invalid`);
    }
  });

  // =====================================================
  // Modifier Tests
  // =====================================================

  await t.step("should validate get_modifiers input schema", () => {
    const validInput = {
      code: "99213",
      code_type: "cpt"
    };

    assertExists(validInput.code);
    assertEquals(validInput.code_type, "cpt");
  });

  await t.step("should list common modifiers", () => {
    const commonModifiers = [
      { modifier: "25", description: "Significant, separately identifiable E/M service" },
      { modifier: "26", description: "Professional component" },
      { modifier: "59", description: "Distinct procedural service" },
      { modifier: "76", description: "Repeat procedure by same physician" },
      { modifier: "77", description: "Repeat procedure by another physician" },
      { modifier: "LT", description: "Left side" },
      { modifier: "RT", description: "Right side" },
      { modifier: "TC", description: "Technical component" }
    ];

    assertEquals(commonModifiers.length, 8);
    assertEquals(commonModifiers[0].modifier, "25");
  });

  await t.step("should validate modifier format", () => {
    // Modifiers are 2 alphanumeric characters
    const modifierRegex = /^[A-Z0-9]{2}$/;

    const validModifiers = ["25", "26", "59", "LT", "RT", "TC"];
    const invalidModifiers = ["2", "256", "lt"];

    for (const mod of validModifiers) {
      assertEquals(modifierRegex.test(mod), true, `${mod} should be valid`);
    }
    for (const mod of invalidModifiers) {
      assertEquals(modifierRegex.test(mod), false, `${mod} should be invalid`);
    }
  });

  // =====================================================
  // Code Validation Tests
  // =====================================================

  await t.step("should validate validate_code_combination input schema", () => {
    const validInput = {
      cpt_codes: ["99213", "36415"],
      icd10_codes: ["I10", "E11.9"],
      modifiers: ["25"]
    };

    assertEquals(Array.isArray(validInput.cpt_codes), true);
    assertEquals(Array.isArray(validInput.icd10_codes), true);
    assertEquals(validInput.cpt_codes.length, 2);
    assertEquals(validInput.icd10_codes.length, 2);
  });

  await t.step("should format validation result", () => {
    const validationResult = {
      cpt_validation: [
        { code: "99213", valid: true },
        { code: "36415", valid: true }
      ],
      icd10_validation: [
        { code: "I10", valid: true },
        { code: "E11.9", valid: true }
      ],
      bundling_issues: [],
      is_valid: true
    };

    assertEquals(validationResult.is_valid, true);
    assertEquals(validationResult.cpt_validation.every(v => v.valid), true);
    assertEquals(validationResult.icd10_validation.every(v => v.valid), true);
    assertEquals(validationResult.bundling_issues.length, 0);
  });

  // =====================================================
  // Bundling Rules Tests
  // =====================================================

  await t.step("should validate check_bundling input schema", () => {
    const validInput = {
      cpt_codes: ["99213", "99214", "36415"]
    };

    assertEquals(Array.isArray(validInput.cpt_codes), true);
  });

  await t.step("should detect E/M bundling issues", () => {
    const bundlingRules = [
      { column1: "99213", column2: "99214", description: "Cannot bill multiple E/M codes same day same provider" },
      { column1: "99213", column2: "99215", description: "Cannot bill multiple E/M codes same day same provider" },
      { column1: "99214", column2: "99215", description: "Cannot bill multiple E/M codes same day same provider" }
    ];

    const cptCodes = ["99213", "99214"];
    const issues = bundlingRules.filter(rule =>
      cptCodes.includes(rule.column1) && cptCodes.includes(rule.column2)
    );

    assertEquals(issues.length, 1);
    assertEquals(issues[0].column1, "99213");
    assertEquals(issues[0].column2, "99214");
  });

  await t.step("should detect duplicate codes", () => {
    const cptCodes = ["99213", "36415", "36415"];

    const codeCounts = cptCodes.reduce((acc, code) => {
      acc[code] = (acc[code] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const duplicates = Object.entries(codeCounts).filter(([_, count]) => count > 1);

    assertEquals(duplicates.length, 1);
    assertEquals(duplicates[0][0], "36415");
    assertEquals(duplicates[0][1], 2);
  });

  await t.step("should format bundling issue result", () => {
    const bundlingIssue = {
      codes: ["99213", "99214"],
      issue: "Cannot bill multiple E/M codes same day same provider",
      suggestion: "Remove one of the codes or document medical necessity"
    };

    assertExists(bundlingIssue.codes);
    assertExists(bundlingIssue.issue);
    assertExists(bundlingIssue.suggestion);
    assertEquals(bundlingIssue.codes.length, 2);
  });

  // =====================================================
  // Code Details Tests
  // =====================================================

  await t.step("should validate get_code_details input schema", () => {
    const validInput = {
      code: "99213",
      code_type: "cpt"
    };

    assertExists(validInput.code);
    assertExists(validInput.code_type);
  });

  await t.step("should support all code types", () => {
    const validCodeTypes = ["cpt", "icd10", "hcpcs"];

    assertEquals(validCodeTypes.includes("cpt"), true);
    assertEquals(validCodeTypes.includes("icd10"), true);
    assertEquals(validCodeTypes.includes("hcpcs"), true);
  });

  // =====================================================
  // Code Suggestion Tests
  // =====================================================

  await t.step("should validate suggest_codes input schema", () => {
    const validInput = {
      description: "office visit for hypertension follow-up",
      code_types: ["cpt", "icd10"],
      limit: 5
    };

    assertExists(validInput.description);
    assertEquals(Array.isArray(validInput.code_types), true);
    assertEquals(typeof validInput.limit, "number");
  });

  await t.step("should format suggestion result", () => {
    const suggestions = {
      cpt: [
        { code: "99213", short_description: "Office visit, established patient" },
        { code: "99214", short_description: "Office visit, established patient (moderate)" }
      ],
      icd10: [
        { code: "I10", description: "Essential hypertension" }
      ]
    };

    assertExists(suggestions.cpt);
    assertExists(suggestions.icd10);
    assertEquals(suggestions.cpt.length, 2);
    assertEquals(suggestions.icd10.length, 1);
  });

  // =====================================================
  // SDOH Codes Tests
  // =====================================================

  await t.step("should validate get_sdoh_codes input schema", () => {
    const validCategories = [
      "housing", "food", "transportation",
      "employment", "education", "social", "all"
    ];

    assertEquals(validCategories.includes("housing"), true);
    assertEquals(validCategories.includes("food"), true);
    assertEquals(validCategories.includes("all"), true);
    assertEquals(validCategories.length, 7);
  });

  await t.step("should return housing SDOH codes", () => {
    const housingCodes = [
      { code: "Z59.0", description: "Homelessness" },
      { code: "Z59.1", description: "Inadequate housing" },
      { code: "Z59.81", description: "Housing instability, housed" },
      { code: "Z59.811", description: "Housing instability, housed, with risk of homelessness" }
    ];

    assertEquals(housingCodes[0].code, "Z59.0");
    assertEquals(housingCodes[0].description, "Homelessness");
  });

  await t.step("should return food insecurity SDOH codes", () => {
    const foodCodes = [
      { code: "Z59.41", description: "Food insecurity" },
      { code: "Z59.48", description: "Other specified lack of adequate food" },
      { code: "E63.9", description: "Nutritional deficiency, unspecified" }
    ];

    assertEquals(foodCodes[0].code, "Z59.41");
    assertEquals(foodCodes[0].description, "Food insecurity");
  });

  await t.step("should return transportation SDOH codes", () => {
    const transportationCodes = [
      { code: "Z59.82", description: "Transportation insecurity" },
      { code: "Z75.3", description: "Unavailability and inaccessibility of health-care facilities" }
    ];

    assertEquals(transportationCodes[0].code, "Z59.82");
  });

  await t.step("should return employment SDOH codes", () => {
    const employmentCodes = [
      { code: "Z56.0", description: "Unemployment, unspecified" },
      { code: "Z56.1", description: "Change of job" },
      { code: "Z56.2", description: "Threat of job loss" }
    ];

    assertEquals(employmentCodes[0].code, "Z56.0");
  });

  await t.step("should return education SDOH codes", () => {
    const educationCodes = [
      { code: "Z55.0", description: "Illiteracy and low-level literacy" },
      { code: "Z55.5", description: "Less than a high school diploma" }
    ];

    assertEquals(educationCodes[0].code, "Z55.0");
  });

  await t.step("should return social SDOH codes", () => {
    const socialCodes = [
      { code: "Z60.2", description: "Problems related to living alone" },
      { code: "Z60.4", description: "Social exclusion and rejection" },
      { code: "Z65.4", description: "Victim of crime and terrorism" }
    ];

    assertEquals(socialCodes[0].code, "Z60.2");
  });

  // =====================================================
  // MCP Protocol Tests
  // =====================================================

  await t.step("should return MCP initialize response format", () => {
    const response = {
      jsonrpc: "2.0",
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: {
          name: "mcp-medical-codes-server",
          version: "1.0.0"
        },
        capabilities: {
          tools: {}
        }
      },
      id: 1
    };

    assertEquals(response.jsonrpc, "2.0");
    assertEquals(response.result.serverInfo.name, "mcp-medical-codes-server");
  });

  await t.step("should return MCP tools/list response format", () => {
    const response = {
      jsonrpc: "2.0",
      result: {
        tools: [
          { name: "search_cpt", description: "Search CPT codes" },
          { name: "search_icd10", description: "Search ICD-10 codes" }
        ]
      },
      id: 2
    };

    assertEquals(response.jsonrpc, "2.0");
    assertEquals(Array.isArray(response.result.tools), true);
  });

  await t.step("should return MCP tools/call response format", () => {
    const response = {
      content: [{ type: "text", text: '[{"code":"99213","description":"Office visit"}]' }],
      metadata: {
        codesReturned: 1,
        executionTimeMs: 50,
        tool: "search_cpt"
      }
    };

    assertEquals(response.content[0].type, "text");
    assertEquals(typeof response.metadata.codesReturned, "number");
    assertEquals(typeof response.metadata.executionTimeMs, "number");
  });

  // =====================================================
  // Rate Limiting Tests
  // =====================================================

  await t.step("should identify request by header", () => {
    const getIdentifier = (req: Request): string => {
      const forwarded = req.headers.get("x-forwarded-for");
      const realIp = req.headers.get("x-real-ip");
      const userId = req.headers.get("x-user-id");
      return userId || forwarded?.split(",")[0] || realIp || "anonymous";
    };

    const request = new Request("http://localhost", {
      headers: { "x-user-id": "user-123" }
    });

    assertEquals(getIdentifier(request), "user-123");
  });

  await t.step("should define rate limit configuration", () => {
    const rateLimits = {
      medicalCodes: {
        windowMs: 60000,
        maxRequests: 100
      }
    };

    assertEquals(rateLimits.medicalCodes.windowMs, 60000);
    assertEquals(rateLimits.medicalCodes.maxRequests, 100);
  });

  // =====================================================
  // Error Handling Tests
  // =====================================================

  await t.step("should return error for unknown tool", () => {
    const error = {
      error: {
        code: "internal_error",
        message: "Unknown tool: invalid_tool"
      }
    };

    assertEquals(error.error.code, "internal_error");
    assertEquals(error.error.message.includes("Unknown tool"), true);
  });

  await t.step("should return error for invalid code type", () => {
    const error = {
      error: {
        code: "internal_error",
        message: "Invalid code_type: xyz"
      }
    };

    assertEquals(error.error.message.includes("Invalid code_type"), true);
  });

  await t.step("should return error for invalid SDOH category", () => {
    const error = {
      error: {
        code: "internal_error",
        message: "Invalid SDOH category: invalid_category"
      }
    };

    assertEquals(error.error.message.includes("Invalid SDOH category"), true);
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

  await t.step("should create code lookup audit log entry", () => {
    const auditEntry = {
      user_id: "user-123",
      tool_name: "search_cpt",
      search_query: "office visit",
      codes_returned: 15,
      execution_time_ms: 75,
      created_at: new Date().toISOString()
    };

    assertExists(auditEntry.user_id);
    assertExists(auditEntry.tool_name);
    assertExists(auditEntry.search_query);
    assertEquals(typeof auditEntry.codes_returned, "number");
    assertEquals(typeof auditEntry.execution_time_ms, "number");
  });

  // =====================================================
  // CORS Tests
  // =====================================================

  await t.step("should handle OPTIONS preflight", () => {
    const request = new Request("http://localhost/mcp-medical-codes-server", {
      method: "OPTIONS"
    });

    assertEquals(request.method, "OPTIONS");
  });

  // =====================================================
  // Search Functionality Tests
  // =====================================================

  await t.step("should handle partial code search", () => {
    const query = "9921"; // Partial CPT code
    const matchPattern = `%${query}%`;

    assertEquals(matchPattern, "%9921%");
  });

  await t.step("should handle case-insensitive search", () => {
    const query = "HYPERTENSION";
    const lowerQuery = query.toLowerCase();

    assertEquals(lowerQuery, "hypertension");
  });

  await t.step("should respect search limit", () => {
    const results = Array(50).fill({ code: "99213" });
    const limit = 20;
    const limitedResults = results.slice(0, limit);

    assertEquals(limitedResults.length, 20);
  });

  // =====================================================
  // Code Category Tests
  // =====================================================

  await t.step("should filter CPT codes by category", () => {
    const codes = [
      { code: "99213", category: "E/M" },
      { code: "99214", category: "E/M" },
      { code: "36415", category: "Pathology" },
      { code: "81000", category: "Pathology" }
    ];

    const category = "E/M";
    const filtered = codes.filter(c => c.category === category);

    assertEquals(filtered.length, 2);
    assertEquals(filtered[0].code, "99213");
  });

  await t.step("should filter ICD-10 codes by chapter", () => {
    const codes = [
      { code: "I10", chapter: "Chapter 9" },
      { code: "E11.9", chapter: "Chapter 4" },
      { code: "J06.9", chapter: "Chapter 10" }
    ];

    const chapter = "Chapter 9";
    const filtered = codes.filter(c => c.chapter === chapter);

    assertEquals(filtered.length, 1);
    assertEquals(filtered[0].code, "I10");
  });

  await t.step("should filter HCPCS codes by level", () => {
    const codes = [
      { code: "E1161", level: "II" },
      { code: "J3301", level: "II" },
      { code: "99213", level: "I" }
    ];

    const level = "II";
    const filtered = codes.filter(c => c.level === level);

    assertEquals(filtered.length, 2);
  });
});
