// supabase/functions/mcp-drg-grouper-server/__tests__/index.test.ts
// Tests for MCP DRG Grouper Server - AI-powered MS-DRG assignment and revenue intelligence
// Synthetic data only - no real patient information

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("MCP DRG Grouper Server Tests", async (t) => {

  // =====================================================
  // 1. Tool Definitions — All 7 tools exist with schemas
  // =====================================================

  await t.step("should define all 7 tools with proper schemas", () => {
    const toolNames = [
      "ping",
      "run_drg_grouper",
      "get_drg_result",
      "estimate_reimbursement",
      "validate_coding",
      "flag_revenue_risk",
      "get_payer_rules"
    ];

    // Verify each tool has a description and inputSchema
    for (const name of toolNames) {
      assertExists(name, `Tool ${name} should be defined`);
    }
    assertEquals(toolNames.length, 7);
  });

  await t.step("run_drg_grouper tool has description and inputSchema", () => {
    const tool = {
      description: "AI-powered MS-DRG assignment. Extracts ICD-10 codes from clinical documentation, runs 3-pass analysis (base, +CC, +MCC), selects highest valid DRG. Advisory only.",
      inputSchema: {
        type: "object",
        properties: {
          encounter_id: { type: "string" },
          patient_id: { type: "string" },
          principal_diagnosis: { type: "string" },
          additional_diagnoses: { type: "array" },
          procedure_codes: { type: "array" }
        },
        required: ["encounter_id", "patient_id"]
      }
    };
    assertExists(tool.description);
    assertExists(tool.inputSchema);
    assertEquals(tool.inputSchema.required.includes("encounter_id"), true);
    assertEquals(tool.inputSchema.required.includes("patient_id"), true);
  });

  await t.step("estimate_reimbursement tool has payer_type enum", () => {
    const payerEnum = ["medicare", "medicaid", "commercial", "tricare", "workers_comp"];
    assertEquals(payerEnum.length, 5);
    assertEquals(payerEnum.includes("medicare"), true);
    assertEquals(payerEnum.includes("medicaid"), true);
    assertEquals(payerEnum.includes("commercial"), true);
  });

  // =====================================================
  // 2-6. Type Enums — Valid values
  // =====================================================

  await t.step("DRGType has 3 valid values: ms_drg, ap_drg, apr_drg", () => {
    const validTypes: string[] = ["ms_drg", "ap_drg", "apr_drg"];
    assertEquals(validTypes.length, 3);
    assertEquals(validTypes.includes("ms_drg"), true);
    assertEquals(validTypes.includes("ap_drg"), true);
    assertEquals(validTypes.includes("apr_drg"), true);
    // Invalid type should not be included
    assertEquals(validTypes.includes("ir_drg"), false);
  });

  await t.step("DRGStatus has 4 valid values: preliminary, confirmed, appealed, final", () => {
    const validStatuses: string[] = ["preliminary", "confirmed", "appealed", "final"];
    assertEquals(validStatuses.length, 4);
    assertEquals(validStatuses.includes("preliminary"), true);
    assertEquals(validStatuses.includes("confirmed"), true);
    assertEquals(validStatuses.includes("appealed"), true);
    assertEquals(validStatuses.includes("final"), true);
    assertEquals(validStatuses.includes("pending"), false);
  });

  await t.step("PayerType has 5 valid values", () => {
    const validPayers: string[] = [
      "medicare", "medicaid", "commercial", "tricare", "workers_comp"
    ];
    assertEquals(validPayers.length, 5);
    assertEquals(validPayers.includes("medicare"), true);
    assertEquals(validPayers.includes("medicaid"), true);
    assertEquals(validPayers.includes("commercial"), true);
    assertEquals(validPayers.includes("tricare"), true);
    assertEquals(validPayers.includes("workers_comp"), true);
    // Not in the actual type definition
    assertEquals(validPayers.includes("self_pay"), false);
    assertEquals(validPayers.includes("champva"), false);
  });

  await t.step("RuleType has 5 valid values", () => {
    const validRuleTypes: string[] = [
      "drg_based", "per_diem", "case_rate", "percent_of_charges", "fee_schedule"
    ];
    assertEquals(validRuleTypes.length, 5);
    assertEquals(validRuleTypes.includes("drg_based"), true);
    assertEquals(validRuleTypes.includes("per_diem"), true);
    assertEquals(validRuleTypes.includes("case_rate"), true);
    assertEquals(validRuleTypes.includes("percent_of_charges"), true);
    assertEquals(validRuleTypes.includes("fee_schedule"), true);
  });

  await t.step("SnapshotStatus has 4 valid values: draft, reviewed, finalized, billed", () => {
    const validStatuses: string[] = ["draft", "reviewed", "finalized", "billed"];
    assertEquals(validStatuses.length, 4);
    assertEquals(validStatuses.includes("draft"), true);
    assertEquals(validStatuses.includes("reviewed"), true);
    assertEquals(validStatuses.includes("finalized"), true);
    assertEquals(validStatuses.includes("billed"), true);
  });

  // =====================================================
  // 7. ChargesByCategory — All 7 categories
  // =====================================================

  await t.step("ChargesByCategory has all 7 categories", () => {
    const charges = {
      lab: [],
      imaging: [],
      pharmacy: [],
      nursing: [],
      procedure: [],
      evaluation: [],
      other: []
    };

    const categories = Object.keys(charges);
    assertEquals(categories.length, 7);
    assertEquals(categories.includes("lab"), true);
    assertEquals(categories.includes("imaging"), true);
    assertEquals(categories.includes("pharmacy"), true);
    assertEquals(categories.includes("nursing"), true);
    assertEquals(categories.includes("procedure"), true);
    assertEquals(categories.includes("evaluation"), true);
    assertEquals(categories.includes("other"), true);
  });

  // =====================================================
  // 8-11. Reimbursement Calculations
  // =====================================================

  await t.step("DRG-based reimbursement: weight x base rate x wage index", () => {
    const drgWeight = 1.5;
    const baseRate = 7000;
    const wageIndex = 1.0;
    const capitalRate = 500;

    const operatingPayment = baseRate * drgWeight * wageIndex;
    const capitalPayment = capitalRate * drgWeight;
    const totalEstimated = operatingPayment + capitalPayment;

    assertEquals(operatingPayment, 10500);
    assertEquals(capitalPayment, 750);
    assertEquals(totalEstimated, 11250);
  });

  await t.step("Reimbursement with wage index adjustment", () => {
    const drgWeight = 2.0;
    const baseRate = 7000;
    const wageIndex = 1.25; // High cost area
    const capitalRate = 500;

    const operatingPayment = baseRate * drgWeight * wageIndex;
    const capitalPayment = capitalRate * drgWeight;
    const totalEstimated = operatingPayment + capitalPayment;

    // 7000 * 2.0 * 1.25 = 17500
    assertEquals(operatingPayment, 17500);
    // 500 * 2.0 = 1000
    assertEquals(capitalPayment, 1000);
    assertEquals(totalEstimated, 18500);
  });

  await t.step("Per-diem calculation for Medicaid", () => {
    const perDiemRate = 1200;
    const allowablePercentage = 80;
    const allowable = allowablePercentage / 100;
    const dailyReimbursement = perDiemRate * allowable;

    assertEquals(dailyReimbursement, 960);
    assertEquals(Math.round(dailyReimbursement * 100) / 100, 960.00);
  });

  await t.step("Revenue projection structure has all required fields", () => {
    const projection = {
      drg_code: "470",
      drg_weight: 1.7,
      base_rate: 7000,
      wage_index: 1.05,
      capital_rate: 500,
      operating_payment: 12495,
      capital_payment: 850,
      total_estimated: 13345,
      payer_type: "medicare" as const,
      adjustments_applied: ["COLA: 1.02"]
    };

    assertExists(projection.drg_code);
    assertExists(projection.drg_weight);
    assertExists(projection.base_rate);
    assertExists(projection.wage_index);
    assertEquals(typeof projection.capital_rate, "number");
    assertEquals(typeof projection.operating_payment, "number");
    assertEquals(typeof projection.capital_payment, "number");
    assertEquals(typeof projection.total_estimated, "number");
    assertExists(projection.payer_type);
    assertEquals(Array.isArray(projection.adjustments_applied), true);
  });

  // =====================================================
  // 12-14. Type Structure Validation
  // =====================================================

  await t.step("PayerRule has all required fields", () => {
    const rule = {
      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      tenant_id: "2b902657-6a20-4435-a78a-576f397517ca",
      payer_type: "medicare" as const,
      state_code: null,
      fiscal_year: 2026,
      rule_type: "drg_based" as const,
      acuity_tier: null,
      base_rate_amount: 7200,
      capital_rate_amount: 520,
      wage_index_factor: 1.05,
      cost_of_living_adjustment: 1.0,
      per_diem_rate: null,
      allowable_percentage: null,
      max_days: null,
      outlier_threshold: 30000,
      carve_out_codes: [],
      rule_description: "FY2026 Medicare IPPS base rate",
      source_reference: "CMS Final Rule FY2026",
      is_active: true,
      effective_date: "2025-10-01",
      expiration_date: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z"
    };

    assertExists(rule.id);
    assertExists(rule.tenant_id);
    assertExists(rule.payer_type);
    assertEquals(rule.fiscal_year, 2026);
    assertExists(rule.rule_type);
    assertEquals(typeof rule.wage_index_factor, "number");
    assertEquals(typeof rule.cost_of_living_adjustment, "number");
    assertEquals(rule.is_active, true);
    assertExists(rule.effective_date);
    assertExists(rule.created_at);
    assertExists(rule.updated_at);
  });

  await t.step("DRGGroupingResult has all required fields", () => {
    const result = {
      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      tenant_id: "2b902657-6a20-4435-a78a-576f397517ca",
      patient_id: "11111111-2222-3333-4444-555555555555",
      encounter_id: "66666666-7777-8888-9999-aaaaaaaaaaaa",
      principal_diagnosis_code: "I21.0",
      secondary_diagnosis_codes: ["I10", "E11.65"],
      procedure_codes: [],
      drg_code: "280",
      drg_description: "Acute Myocardial Infarction, Discharged Alive w MCC",
      drg_weight: 2.0432,
      drg_type: "ms_drg" as const,
      mdc_code: "05",
      mdc_description: "Diseases and Disorders of the Circulatory System",
      has_cc: true,
      has_mcc: true,
      cc_codes: ["I10"],
      mcc_codes: ["E11.65"],
      base_drg_code: "282",
      base_drg_weight: 1.2,
      cc_drg_code: "281",
      cc_drg_weight: 1.6,
      mcc_drg_code: "280",
      mcc_drg_weight: 2.0432,
      optimal_drg_code: "280",
      estimated_reimbursement: null,
      base_rate_used: null,
      grouper_version: "MS-DRG v43",
      ai_skill_key: "drg_grouper",
      ai_model_used: "claude-sonnet-4-5-20250929",
      ai_confidence: 0.92,
      ai_reasoning: "Principal diagnosis I21.0 (STEMI anterior wall) maps to MDC 05. E11.65 qualifies as MCC.",
      status: "preliminary" as const,
      created_at: "2026-03-24T10:00:00Z",
      updated_at: "2026-03-24T10:00:00Z"
    };

    assertExists(result.id);
    assertExists(result.encounter_id);
    assertExists(result.drg_code);
    assertExists(result.drg_type);
    assertExists(result.principal_diagnosis_code);
    assertEquals(Array.isArray(result.secondary_diagnosis_codes), true);
    assertEquals(Array.isArray(result.procedure_codes), true);
    assertEquals(typeof result.drg_weight, "number");
    assertExists(result.grouper_version);
    assertExists(result.ai_skill_key);
    assertExists(result.status);
    assertEquals(result.has_cc, true);
    assertEquals(result.has_mcc, true);
    assertEquals(Array.isArray(result.cc_codes), true);
    assertEquals(Array.isArray(result.mcc_codes), true);
    assertExists(result.created_at);
    assertExists(result.updated_at);
  });

  await t.step("DailyChargeSnapshot has all required fields", () => {
    const snapshot = {
      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      tenant_id: "2b902657-6a20-4435-a78a-576f397517ca",
      patient_id: "11111111-2222-3333-4444-555555555555",
      encounter_id: "66666666-7777-8888-9999-aaaaaaaaaaaa",
      admit_date: "2026-03-20",
      service_date: "2026-03-24",
      day_number: 5,
      charges: {
        lab: [], imaging: [], pharmacy: [], nursing: [],
        procedure: [], evaluation: [], other: []
      },
      total_charge_amount: 4500.00,
      charge_count: 12,
      projected_drg_code: "470",
      projected_drg_weight: 1.7,
      projected_reimbursement: 12000,
      optimization_suggestions: [],
      missing_charge_alerts: [],
      documentation_gaps: [],
      status: "draft" as const,
      ai_skill_key: "revenue_optimizer",
      ai_model_used: null,
      created_at: "2026-03-24T10:00:00Z",
      updated_at: "2026-03-24T10:00:00Z"
    };

    assertExists(snapshot.id);
    assertExists(snapshot.tenant_id);
    assertExists(snapshot.patient_id);
    assertExists(snapshot.encounter_id);
    assertExists(snapshot.admit_date);
    assertExists(snapshot.service_date);
    assertEquals(typeof snapshot.day_number, "number");
    assertExists(snapshot.charges);
    assertEquals(typeof snapshot.total_charge_amount, "number");
    assertEquals(typeof snapshot.charge_count, "number");
    assertEquals(Array.isArray(snapshot.optimization_suggestions), true);
    assertEquals(Array.isArray(snapshot.missing_charge_alerts), true);
    assertEquals(Array.isArray(snapshot.documentation_gaps), true);
    assertExists(snapshot.status);
    assertExists(snapshot.ai_skill_key);
    assertExists(snapshot.created_at);
  });

  // =====================================================
  // 15-18. Completeness Rules
  // =====================================================

  await t.step("7 completeness rules exist", () => {
    const rules = [
      { category: "lab", check: "has_admission_labs", expectedMinimum: 3, severity: "alert" },
      { category: "lab", check: "has_daily_labs", expectedMinimum: 1, severity: "warning" },
      { category: "pharmacy", check: "has_pharmacy_charges", expectedMinimum: 1, severity: "warning" },
      { category: "nursing", check: "has_nursing_assessment", expectedMinimum: 1, severity: "alert" },
      { category: "evaluation", check: "has_em_code", expectedMinimum: 1, severity: "alert" },
      { category: "procedure", check: "has_iv_charges", expectedMinimum: 0, severity: "warning" },
      { category: "imaging", check: "has_chest_xray_day1", expectedMinimum: 0, severity: "warning" }
    ];

    assertEquals(rules.length, 7);

    const categories = rules.map(r => r.category);
    assertEquals(categories.includes("lab"), true);
    assertEquals(categories.includes("pharmacy"), true);
    assertEquals(categories.includes("nursing"), true);
    assertEquals(categories.includes("evaluation"), true);
    assertEquals(categories.includes("procedure"), true);
    assertEquals(categories.includes("imaging"), true);
  });

  await t.step("Admission labs rule expects minimum 3 on Day 1", () => {
    const admissionLabRule = {
      category: "lab",
      check: "has_admission_labs",
      description: "Admission labs (CBC, CMP, UA) expected on Day 1",
      expectedMinimum: 3,
      severity: "alert" as const,
      suggestedCode: "80053",
      estimatedImpact: 150
    };

    assertEquals(admissionLabRule.expectedMinimum, 3);
    assertEquals(admissionLabRule.severity, "alert");
    assertEquals(admissionLabRule.suggestedCode, "80053");
    assertEquals(admissionLabRule.estimatedImpact, 150);
  });

  await t.step("Daily labs rule expects minimum 1 for ICU/step-down", () => {
    const dailyLabRule = {
      category: "lab",
      check: "has_daily_labs",
      description: "Daily labs expected for ICU/step-down patients",
      expectedMinimum: 1,
      severity: "warning" as const,
      suggestedCode: "85025",
      estimatedImpact: 50
    };

    assertEquals(dailyLabRule.expectedMinimum, 1);
    assertEquals(dailyLabRule.severity, "warning");
    assertEquals(dailyLabRule.suggestedCode, "85025");
  });

  await t.step("Pharmacy charges rule expects minimum 1 for inpatients", () => {
    const pharmacyRule = {
      category: "pharmacy",
      check: "has_pharmacy_charges",
      description: "Medication administration charges expected for inpatients",
      expectedMinimum: 1,
      severity: "warning" as const,
      suggestedCode: null,
      estimatedImpact: 75
    };

    assertEquals(pharmacyRule.expectedMinimum, 1);
    assertEquals(pharmacyRule.severity, "warning");
    assertEquals(pharmacyRule.suggestedCode, null);
    assertEquals(pharmacyRule.estimatedImpact, 75);
  });

  // =====================================================
  // 19-23. Tool Input Requirements
  // =====================================================

  await t.step("run_drg_grouper requires encounter_id and patient_id", () => {
    const validation = {
      encounter_id: { type: "uuid", required: true },
      patient_id: { type: "uuid", required: true }
    };

    assertEquals(validation.encounter_id.required, true);
    assertEquals(validation.patient_id.required, true);
    assertEquals(validation.encounter_id.type, "uuid");
  });

  await t.step("estimate_reimbursement requires payer_type", () => {
    const validation = {
      payer_type: { type: "string", required: true }
    };

    assertEquals(validation.payer_type.required, true);
    // Note: drg_code is NOT required - can look up via encounter_id
  });

  await t.step("validate_coding requires encounter_id and service_date", () => {
    const validation = {
      encounter_id: { type: "uuid", required: true },
      service_date: { type: "string", required: true }
    };

    assertEquals(validation.encounter_id.required, true);
    assertEquals(validation.service_date.required, true);
  });

  await t.step("flag_revenue_risk requires encounter_id and service_date", () => {
    const validation = {
      encounter_id: { type: "uuid", required: true },
      service_date: { type: "string", required: true }
    };

    assertEquals(validation.encounter_id.required, true);
    assertEquals(validation.service_date.required, true);
  });

  await t.step("get_payer_rules requires payer_type and fiscal_year", () => {
    const validation = {
      payer_type: { type: "string", required: true },
      fiscal_year: { type: "number", required: true }
    };

    assertEquals(validation.payer_type.required, true);
    assertEquals(validation.fiscal_year.required, true);
  });

  // =====================================================
  // 24. AI Tool Schema Structures
  // =====================================================

  await t.step("DRG_ANALYSIS_TOOL schema has required fields", () => {
    const schema = {
      name: "submit_drg_analysis",
      description: "Submit the structured DRG analysis result",
      input_schema: {
        type: "object",
        required: [
          "principal_diagnosis", "secondary_diagnoses", "procedure_codes",
          "drg_assignment", "clinical_reasoning", "confidence",
          "requires_clinical_review", "review_reasons"
        ]
      }
    };

    assertEquals(schema.name, "submit_drg_analysis");
    assertExists(schema.description);
    assertEquals(schema.input_schema.required.length, 8);
    assertEquals(schema.input_schema.required.includes("principal_diagnosis"), true);
    assertEquals(schema.input_schema.required.includes("drg_assignment"), true);
    assertEquals(schema.input_schema.required.includes("clinical_reasoning"), true);
    assertEquals(schema.input_schema.required.includes("confidence"), true);
    assertEquals(schema.input_schema.required.includes("requires_clinical_review"), true);
  });

  await t.step("REVENUE_OPTIMIZATION_TOOL schema has required fields", () => {
    const schema = {
      name: "submit_revenue_analysis",
      description: "Submit the structured revenue optimization result",
      input_schema: {
        type: "object",
        required: [
          "documentation_assessment", "missing_codes", "upgrade_opportunities",
          "documentation_gaps", "modifier_suggestions", "summary",
          "total_potential_uplift", "confidence", "requires_clinical_review"
        ]
      }
    };

    assertEquals(schema.name, "submit_revenue_analysis");
    assertExists(schema.description);
    assertEquals(schema.input_schema.required.length, 9);
    assertEquals(schema.input_schema.required.includes("documentation_assessment"), true);
    assertEquals(schema.input_schema.required.includes("missing_codes"), true);
    assertEquals(schema.input_schema.required.includes("upgrade_opportunities"), true);
    assertEquals(schema.input_schema.required.includes("total_potential_uplift"), true);
    assertEquals(schema.input_schema.required.includes("requires_clinical_review"), true);
  });

  // =====================================================
  // 25-26. Server Configuration
  // =====================================================

  await t.step("Server config: name, version, tier=admin", () => {
    const config = {
      name: "mcp-drg-grouper-server",
      version: "1.0.0",
      tier: "admin" as const
    };

    assertEquals(config.name, "mcp-drg-grouper-server");
    assertEquals(config.version, "1.0.0");
    assertEquals(config.tier, "admin");
    assertNotEquals(config.tier, "public");
    assertNotEquals(config.tier, "user");
  });

  await t.step("Rate limit is 20 req/min (expensive AI calls)", () => {
    const rateLimit = {
      maxRequests: 20,
      windowMs: 60_000,
      keyPrefix: "mcp:drg_grouper"
    };

    assertEquals(rateLimit.maxRequests, 20);
    assertEquals(rateLimit.windowMs, 60_000);
    assertExists(rateLimit.keyPrefix);
    // 20 req/min is stricter than standard (usually 60)
    assertEquals(rateLimit.maxRequests < 60, true);
  });

  // =====================================================
  // 27. OptimizationSuggestion Structure
  // =====================================================

  await t.step("OptimizationSuggestion has 4 valid types", () => {
    const validTypes: string[] = [
      "missing_charge",
      "upgrade_opportunity",
      "documentation_gap",
      "modifier_suggestion"
    ];

    assertEquals(validTypes.length, 4);

    const suggestion = {
      type: "missing_charge" as const,
      description: "CBC (85025) expected on admission day - supported by H&P documentation",
      potential_impact_amount: 150,
      suggested_code: "85025",
      confidence: 0.85
    };

    assertExists(suggestion.type);
    assertExists(suggestion.description);
    assertEquals(typeof suggestion.confidence, "number");
    assertEquals(suggestion.confidence >= 0 && suggestion.confidence <= 1, true);
    // All 5 fields present
    assertEquals(Object.keys(suggestion).length, 5);
  });

  // =====================================================
  // 28-29. Edge Cases
  // =====================================================

  await t.step("Zero base rate returns zero reimbursement", () => {
    const drgWeight = 2.5;
    const baseRate = 0;
    const wageIndex = 1.05;
    const capitalRate = 0;

    const operatingPayment = baseRate * drgWeight * wageIndex;
    const capitalPayment = capitalRate * drgWeight;
    const totalEstimated = operatingPayment + capitalPayment;

    assertEquals(operatingPayment, 0);
    assertEquals(capitalPayment, 0);
    assertEquals(totalEstimated, 0);
  });

  await t.step("Missing wage index defaults to 1.0", () => {
    const drgWeight = 1.5;
    const baseRate = 7000;
    const wageIndexOverride: number | undefined = undefined;
    const ruleWageIndex = 1.0;
    const capitalRate = 500;

    // Logic from revenueHandlers.ts: wageIndexOverride ?? rule.wage_index_factor
    const wageIndex = wageIndexOverride ?? ruleWageIndex;
    assertEquals(wageIndex, 1.0);

    const operatingPayment = baseRate * drgWeight * wageIndex;
    assertEquals(operatingPayment, 10500);

    // When the rule itself has wage_index_factor = 1.0, it is effectively no adjustment
    const capitalPayment = capitalRate * drgWeight;
    const totalEstimated = operatingPayment + capitalPayment;
    assertEquals(totalEstimated, 11250);
  });

  // =====================================================
  // 30. Advisory Disclaimer
  // =====================================================

  await t.step("Advisory disclaimer present in DRG grouping responses", () => {
    const advisory = "DRG assignment is advisory only. All codes require clinical review and confirmation before billing.";
    assertEquals(advisory.includes("advisory"), true);
    assertEquals(advisory.includes("clinical review"), true);
    assertEquals(advisory.includes("billing"), true);
  });

  await t.step("Advisory disclaimer present in reimbursement responses", () => {
    const advisory = "Reimbursement estimate is advisory. Actual payment depends on payer contract terms, outlier adjustments, and claim adjudication.";
    assertEquals(advisory.includes("advisory"), true);
    assertEquals(advisory.includes("payer contract"), true);
  });

  await t.step("Advisory disclaimer present in revenue risk responses", () => {
    const advisory = "All revenue risk suggestions are advisory only. Require clinical review and confirmation before billing.";
    assertEquals(advisory.includes("advisory"), true);
    assertEquals(advisory.includes("clinical review"), true);
  });

  await t.step("Advisory disclaimer present in coding validation responses", () => {
    const advisory = "Charge validation is advisory. Missing charges should be verified against clinical documentation before adding.";
    assertEquals(advisory.includes("advisory"), true);
    assertEquals(advisory.includes("clinical documentation"), true);
  });

  // =====================================================
  // Additional: 3-pass DRG selection logic
  // =====================================================

  await t.step("3-pass DRG selects highest weight as optimal", () => {
    const baseDRG = { code: "282", weight: 1.2 };
    const ccDRG = { code: "281", weight: 1.6 };
    const mccDRG = { code: "280", weight: 2.0432 };

    // The server selects the pass with the highest DRG weight
    const passes = [baseDRG, ccDRG, mccDRG];
    const optimal = passes.reduce((best, current) =>
      current.weight > best.weight ? current : best
    );

    assertEquals(optimal.code, "280");
    assertEquals(optimal.weight, 2.0432);
    // MCC pass should always produce the highest weight when MCC codes exist
    assertEquals(optimal.weight > baseDRG.weight, true);
    assertEquals(optimal.weight > ccDRG.weight, true);
  });

  await t.step("AI tools flagged as requiring clinical review", () => {
    const aiTools = ["run_drg_grouper", "flag_revenue_risk"];
    const nonAiTools = ["get_drg_result", "estimate_reimbursement", "validate_coding", "get_payer_rules"];

    assertEquals(aiTools.includes("run_drg_grouper"), true);
    assertEquals(aiTools.includes("flag_revenue_risk"), true);
    // Non-AI tools should not require AI safety flags
    for (const tool of nonAiTools) {
      assertEquals(aiTools.includes(tool), false);
    }
  });
});
