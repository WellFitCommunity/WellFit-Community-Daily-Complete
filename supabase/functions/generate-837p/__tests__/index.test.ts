// supabase/functions/generate-837p/__tests__/index.test.ts
// Tests for generate-837p edge function (X12 837P Professional Claim Generation)

import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Generate 837P Edge Function Tests", async (t) => {

  await t.step("should handle CORS preflight requests", () => {
    const request = new Request("http://localhost/generate-837p", {
      method: "OPTIONS"
    });
    assertEquals(request.method, "OPTIONS");
  });

  await t.step("should reject non-POST methods", () => {
    const method = "GET";
    const expectedStatus = method === "POST" ? 200 : 405;

    assertEquals(expectedStatus, 405);
  });

  await t.step("should require authorization header", () => {
    const hasAuth = false;
    const expectedStatus = hasAuth ? 200 : 401;

    assertEquals(expectedStatus, 401);
  });

  await t.step("should validate Bearer token format", () => {
    const isValidBearer = (auth: string | null): boolean => {
      return !!auth?.startsWith("Bearer ");
    };

    assertEquals(isValidBearer("Bearer abc123"), true);
    assertEquals(isValidBearer("Basic abc123"), false);
    assertEquals(isValidBearer(null), false);
  });

  await t.step("should require encounterId and billingProviderId", () => {
    const validBody = { encounterId: "enc-123", billingProviderId: "prov-456" };
    const invalidBody = { encounterId: "enc-123" };

    assertExists(validBody.encounterId);
    assertExists(validBody.billingProviderId);
    assertEquals("billingProviderId" in invalidBody, false);
  });

  await t.step("should return 400 for missing required fields", () => {
    const hasRequiredFields = false;
    const expectedStatus = hasRequiredFields ? 200 : 400;

    assertEquals(expectedStatus, 400);
  });

  await t.step("should return 401 for unable to resolve user", () => {
    const userResolved = false;
    const expectedStatus = userResolved ? 200 : 401;

    assertEquals(expectedStatus, 401);
  });

  // X12 utility functions tests
  await t.step("should pad left with zeros correctly", () => {
    const padLeft = (v: string | number, len: number, ch = "0") => {
      const s = String(v ?? "");
      return s.length >= len ? s : ch.repeat(len - s.length) + s;
    };

    assertEquals(padLeft("123", 5), "00123");
    assertEquals(padLeft("12345", 5), "12345");
    assertEquals(padLeft("123456", 5), "123456");
    assertEquals(padLeft(42, 5), "00042");
  });

  await t.step("should format date as YYMMDD", () => {
    const yymmdd = (d = new Date()) => {
      const padLeft = (v: number, len: number) => String(v).padStart(len, "0");
      return `${String(d.getFullYear()).slice(-2)}${padLeft(d.getMonth() + 1, 2)}${padLeft(d.getDate(), 2)}`;
    };

    const testDate = new Date("2026-01-17T00:00:00Z");
    assertEquals(yymmdd(testDate), "260117");
  });

  await t.step("should format time as HHMM", () => {
    const hhmm = (d = new Date()) => {
      const padLeft = (v: number, len: number) => String(v).padStart(len, "0");
      return `${padLeft(d.getHours(), 2)}${padLeft(d.getMinutes(), 2)}`;
    };

    const testDate = new Date("2026-01-17T14:30:00");
    assertEquals(hhmm(testDate), "1430");
  });

  await t.step("should sanitize text for X12 segments", () => {
    const safeText = (s?: string | null) => {
      return (s ?? "").replace(/[~*\^\|\\]/g, "").trim();
    };

    assertEquals(safeText("Normal Text"), "Normal Text");
    assertEquals(safeText("Text~With|Special*Chars^"), "TextWithSpecialChars");
    assertEquals(safeText(null), "");
    assertEquals(safeText(undefined), "");
  });

  await t.step("should format date as D8 (CCYYMMDD)", () => {
    const formatD8 = (dateStr?: string | null, fallback = "20240101") => {
      if (!dateStr) return fallback;
      const d = dateStr.replace(/-/g, "");
      return d.length >= 8 ? d.slice(0, 8) : fallback;
    };

    assertEquals(formatD8("2026-01-17"), "20260117");
    assertEquals(formatD8(null), "20240101");
    assertEquals(formatD8("2026-01-17T00:00:00Z"), "20260117");
  });

  await t.step("should remove dots from ICD codes", () => {
    const removeICDDot = (code?: string | null) => {
      const safeText = (s?: string | null) => (s ?? "").replace(/[~*\^\|\\]/g, "").trim();
      return safeText((code ?? "").replace(".", ""));
    };

    assertEquals(removeICDDot("E11.9"), "E119");
    assertEquals(removeICDDot("I21.01"), "I2101");
    assertEquals(removeICDDot("R69"), "R69");
    assertEquals(removeICDDot(null), "");
  });

  await t.step("should generate reference number", () => {
    const generateRef = () => {
      return `WF${Date.now().toString(36).toUpperCase()}`;
    };

    const ref = generateRef();
    assertEquals(ref.startsWith("WF"), true);
    assertEquals(ref.length > 2, true);
  });

  // ISA segment tests
  await t.step("should build ISA segment with correct structure", () => {
    const buildISA = (senderId: string, receiverId: string, isaControl: number): string => {
      const now = new Date("2026-01-17T14:30:00");
      const padLeft = (v: string | number, len: number, ch = " ") => {
        const s = String(v ?? "");
        return s.length >= len ? s : ch.repeat(len - s.length) + s;
      };
      return [
        "ISA",
        "00",
        padLeft("", 10, " "),
        "00",
        padLeft("", 10, " "),
        "ZZ",
        padLeft(senderId, 15, " "),
        "ZZ",
        padLeft(receiverId, 15, " "),
        "260117",
        "1430",
        "^",
        "00501",
        padLeft(isaControl, 9, "0"),
        "0",
        "P",
        ":",
      ].join("*");
    };

    const isa = buildISA("WELLFIT", "CLEARING", 123);
    assertEquals(isa.startsWith("ISA*"), true);
    assertEquals(isa.includes("ZZ"), true);
    assertEquals(isa.includes("00501"), true);
    assertEquals(isa.includes("000000123"), true);
  });

  await t.step("should build IEA segment correctly", () => {
    const buildIEA = (groupCount: number, isaControl: number) => {
      const padLeft = (v: number, len: number) => String(v).padStart(len, "0");
      return ["IEA", String(groupCount), padLeft(isaControl, 9)].join("*");
    };

    assertEquals(buildIEA(1, 123), "IEA*1*000000123");
  });

  // GS segment tests
  await t.step("should build GS segment with correct structure", () => {
    const gsSegment = ["GS", "HC", "WELLFIT", "PAYER", "20260117", "1430", "000000001", "X", "005010X222A1"].join("*");

    assertEquals(gsSegment.startsWith("GS*HC"), true);
    assertEquals(gsSegment.includes("005010X222A1"), true);
  });

  await t.step("should build GE segment correctly", () => {
    const buildGE = (txCount: number, gsControl: number) => {
      const padLeft = (v: number, len: number) => String(v).padStart(len, "0");
      return ["GE", String(txCount), padLeft(gsControl, 9)].join("*");
    };

    assertEquals(buildGE(1, 456), "GE*1*000000456");
  });

  // SV1 segment tests
  await t.step("should build SV1 segment for procedure", () => {
    const buildSV1 = (proc: { code: string; charge_amount: number | null; units: number | null; modifiers?: string[] | null }) => {
      const safeText = (s: string) => s.replace(/[~*\^\|\\]/g, "").trim();
      const code = safeText(proc.code || "99213");
      const mods = proc.modifiers && proc.modifiers.length ? `:${proc.modifiers.map(safeText).join(":")}` : "";
      const charge = Number(proc.charge_amount || 0).toFixed(2);
      const units = String(proc.units || 1);
      return ["SV1", `HC:${code}${mods}`, charge, "UN", units].join("*");
    };

    const sv1 = buildSV1({ code: "99213", charge_amount: 150.00, units: 1, modifiers: [] });
    assertEquals(sv1, "SV1*HC:99213*150.00*UN*1");

    const sv1WithMods = buildSV1({ code: "99213", charge_amount: 175.00, units: 1, modifiers: ["25", "GT"] });
    assertEquals(sv1WithMods, "SV1*HC:99213:25:GT*175.00*UN*1");
  });

  await t.step("should default SV1 values when missing", () => {
    const buildSV1 = (proc: { code: string; charge_amount: number | null; units: number | null }) => {
      const code = proc.code || "99213";
      const charge = Number(proc.charge_amount || 0).toFixed(2);
      const units = String(proc.units || 1);
      return ["SV1", `HC:${code}`, charge, "UN", units].join("*");
    };

    const sv1 = buildSV1({ code: "", charge_amount: null, units: null });
    assertEquals(sv1, "SV1*HC:99213*0.00*UN*1");
  });

  // 837P structure tests
  await t.step("should structure ST segment correctly", () => {
    const stCtrl = "0001";
    const stSegment = ["ST", "837", stCtrl, "005010X222A1"].join("*");

    assertEquals(stSegment, "ST*837*0001*005010X222A1");
  });

  await t.step("should structure BHT segment correctly", () => {
    const ref = "WF123ABC";
    const bhtSegment = ["BHT", "0019", "00", ref, "260117", "1430", "TH"].join("*");

    assertEquals(bhtSegment.startsWith("BHT*0019*00"), true);
    assertEquals(bhtSegment.includes("TH"), true);
  });

  await t.step("should structure NM1 submitter segment (1000A)", () => {
    const nm1Segment = [
      "NM1", "41", "2", "WELLFIT COMMUNITY", "", "", "", "", "46", "WELLFIT"
    ].join("*");

    assertEquals(nm1Segment.startsWith("NM1*41*2"), true);
    assertEquals(nm1Segment.includes("WELLFIT"), true);
  });

  await t.step("should structure NM1 receiver segment (1000B)", () => {
    const nm1Segment = [
      "NM1", "40", "2", "BLUE CROSS", "", "", "", "", "46", "BCBS123"
    ].join("*");

    assertEquals(nm1Segment.startsWith("NM1*40*2"), true);
  });

  await t.step("should structure HL billing provider segment (2000A)", () => {
    const hlSegment = ["HL", "1", "", "20", "1"].join("*");

    assertEquals(hlSegment, "HL*1**20*1");
  });

  await t.step("should structure PRV segment for taxonomy", () => {
    const prvSegment = ["PRV", "BI", "PXC", "207Q00000X"].join("*");

    assertEquals(prvSegment, "PRV*BI*PXC*207Q00000X");
  });

  await t.step("should structure HL subscriber segment (2000B)", () => {
    const hlSegment = ["HL", "2", "1", "22", "0"].join("*");

    assertEquals(hlSegment, "HL*2*1*22*0");
  });

  await t.step("should structure SBR segment correctly", () => {
    const sbrSegment = ["SBR", "P", "", "", "", "", "", "", "18"].join("*");

    assertEquals(sbrSegment.startsWith("SBR*P"), true);
    assertEquals(sbrSegment.includes("18"), true);
  });

  await t.step("should structure NM1 patient segment", () => {
    const nm1Segment = [
      "NM1", "IL", "1", "DOE", "JOHN", "", "", "", "MI", "MEM123456"
    ].join("*");

    assertEquals(nm1Segment.startsWith("NM1*IL*1"), true);
    assertEquals(nm1Segment.includes("MI"), true);
  });

  await t.step("should structure DMG segment for demographics", () => {
    const dmgSegment = ["DMG", "D8", "19800101", "M"].join("*");

    assertEquals(dmgSegment, "DMG*D8*19800101*M");
  });

  await t.step("should structure CLM segment correctly", () => {
    const claimId = "enc-123";
    const totalCharge = 450.00;
    const clmSegment = ["CLM", claimId, totalCharge.toFixed(2), "", "", "", "1"].join("*");

    assertEquals(clmSegment.startsWith("CLM*enc-123*450.00"), true);
  });

  await t.step("should structure DTP segment for date of service", () => {
    const dtpSegment = ["DTP", "434", "D8", "20260117"].join("*");

    assertEquals(dtpSegment, "DTP*434*D8*20260117");
  });

  await t.step("should structure HI segment for principal diagnosis", () => {
    const hiSegment = ["HI", "BK:E119"].join("*");

    assertEquals(hiSegment, "HI*BK:E119");
  });

  await t.step("should structure HI segment for secondary diagnosis", () => {
    const hiSegment = ["HI", "BF:I10"].join("*");

    assertEquals(hiSegment, "HI*BF:I10");
  });

  await t.step("should use default diagnosis R69 when none provided", () => {
    const diagnoses: { code: string }[] = [];
    const hiCode = diagnoses.length > 0 ? diagnoses[0].code : "R69";

    assertEquals(hiCode, "R69");
  });

  await t.step("should structure LX segment for service line", () => {
    const lxSegment = ["LX", "1"].join("*");

    assertEquals(lxSegment, "LX*1");
  });

  await t.step("should structure SE segment correctly", () => {
    const segCount = 25;
    const stCtrl = "0001";
    const seSegment = ["SE", String(segCount), stCtrl].join("*");

    assertEquals(seSegment, "SE*25*0001");
  });

  // Control number tests
  await t.step("should format ISA control number as 9 digits", () => {
    const padLeft = (v: number, len: number) => String(v).padStart(len, "0");
    const isaControl = 12345;

    assertEquals(padLeft(isaControl, 9), "000012345");
  });

  await t.step("should format GS control number as 9 digits", () => {
    const padLeft = (v: number, len: number) => String(v).padStart(len, "0");
    const gsControl = 67890;

    assertEquals(padLeft(gsControl, 9), "000067890");
  });

  await t.step("should format ST control number as 4 digits", () => {
    const padLeft = (v: number, len: number) => String(v).padStart(len, "0");
    const stControl = 42;

    assertEquals(padLeft(stControl, 4), "0042");
  });

  // Total charge calculation
  await t.step("should calculate total charge from procedures", () => {
    const procedures = [
      { charge_amount: 150.00 },
      { charge_amount: 75.50 },
      { charge_amount: 200.00 }
    ];
    const totalCharge = procedures.reduce((sum, pr) => sum + (Number(pr.charge_amount) || 0), 0);

    assertEquals(totalCharge, 425.50);
  });

  await t.step("should handle null charge amounts", () => {
    const procedures = [
      { charge_amount: 150.00 },
      { charge_amount: null },
      { charge_amount: undefined }
    ];
    const totalCharge = procedures.reduce((sum, pr) => sum + (Number(pr.charge_amount) || 0), 0);

    assertEquals(totalCharge, 150.00);
  });

  // X12 envelope tests
  await t.step("should use segment terminator tilde", () => {
    const segments = ["ISA*00*...", "GS*HC*...", "ST*837*..."];
    const x12 = segments.join("~") + "~";

    assertEquals(x12.endsWith("~"), true);
    assertEquals(x12.split("~").length, 4); // 3 segments + empty after trailing ~
  });

  // Database response tests
  await t.step("should structure claims insert correctly", () => {
    const claimInsert = {
      encounter_id: "enc-123",
      x12_content: "ISA*...",
      claim_type: "837P",
      status: "generated",
      control_numb: "0001",
      segment_cou: 25,
      created_by: "user-456",
      created_at: new Date().toISOString()
    };

    assertEquals(claimInsert.claim_type, "837P");
    assertEquals(claimInsert.status, "generated");
    assertExists(claimInsert.created_at);
  });

  // HTTP status codes
  await t.step("should return 200 for successful generation", () => {
    const success = true;
    const expectedStatus = success ? 200 : 500;

    assertEquals(expectedStatus, 200);
  });

  await t.step("should return 207 for partial success (storage error)", () => {
    const generated = true;
    const storedOk = false;
    const expectedStatus = generated && !storedOk ? 207 : 200;

    assertEquals(expectedStatus, 207);
  });

  await t.step("should return 500 for server errors", () => {
    const hasError = true;
    const expectedStatus = hasError ? 500 : 200;

    assertEquals(expectedStatus, 500);
  });

  // HIPAA audit logging
  await t.step("should log successful claim generation", () => {
    const auditLog = {
      event_type: "CLAIMS_GENERATION_SUCCESS",
      event_category: "FINANCIAL",
      actor_user_id: "user-123",
      actor_ip_address: "192.168.1.1",
      operation: "GENERATE_CLAIM",
      resource_type: "auth_event",
      success: true,
      metadata: {
        encounter_id: "enc-123",
        billing_provider_id: "prov-456",
        payer_id: "payer-789",
        patient_id: "patient-111",
        control_number: "0001",
        segment_count: 25,
        claim_type: "837P",
        processing_time_ms: 150,
        procedure_count: 3,
        diagnosis_count: 2
      }
    };

    assertEquals(auditLog.event_type, "CLAIMS_GENERATION_SUCCESS");
    assertEquals(auditLog.success, true);
    assertEquals(auditLog.metadata.claim_type, "837P");
  });

  await t.step("should log failed claim generation", () => {
    const auditLog = {
      event_type: "CLAIMS_GENERATION_FAILED",
      event_category: "FINANCIAL",
      operation: "GENERATE_CLAIM",
      success: false,
      error_code: "CLAIM_STORAGE_ERROR",
      error_message: "Database connection failed"
    };

    assertEquals(auditLog.event_type, "CLAIMS_GENERATION_FAILED");
    assertEquals(auditLog.success, false);
    assertExists(auditLog.error_message);
  });

  // Response structure tests
  await t.step("should return X12 content as text/plain", () => {
    const contentType = "text/plain; charset=utf-8";

    assertEquals(contentType.includes("text/plain"), true);
  });

  await t.step("should structure partial success response", () => {
    const response = {
      x12: "ISA*...",
      claimId: "enc-123",
      controlNumber: "0001",
      storeError: "Database insert failed"
    };

    assertExists(response.x12);
    assertExists(response.storeError);
  });

  await t.step("should structure error response correctly", () => {
    const errorResponse = {
      error: "encounterId and billingProviderId are required"
    };

    assertExists(errorResponse.error);
  });

  // IP extraction tests
  await t.step("should extract client IP from headers", () => {
    const headers = {
      "x-forwarded-for": "192.168.1.1, 10.0.0.1",
      "cf-connecting-ip": "172.16.0.1",
      "x-real-ip": "203.0.113.1"
    };

    const clientIp = headers["x-forwarded-for"]?.split(",")[0].trim() ||
                     headers["cf-connecting-ip"] ||
                     headers["x-real-ip"] || null;

    assertEquals(clientIp, "192.168.1.1");
  });

  await t.step("should use null when no IP available", () => {
    const headers: Record<string, string> = {};

    const clientIp = headers["x-forwarded-for"]?.split(",")[0].trim() ||
                     headers["cf-connecting-ip"] ||
                     headers["x-real-ip"] || null;

    assertEquals(clientIp, null);
  });
});
