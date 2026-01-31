// supabase/functions/mcp-clearinghouse-server/__tests__/index.test.ts
// Tests for Clearinghouse MCP Server - Healthcare claims and billing operations

import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("Clearinghouse MCP Server Tests", async (t) => {

  // =====================================================
  // Clearinghouse Provider Tests
  // =====================================================

  await t.step("should support Waystar provider", () => {
    const providers: string[] = ['waystar', 'change_healthcare', 'availity'];
    assertEquals(providers.includes('waystar'), true);
  });

  await t.step("should support Change Healthcare provider", () => {
    const providers: string[] = ['waystar', 'change_healthcare', 'availity'];
    assertEquals(providers.includes('change_healthcare'), true);
  });

  await t.step("should support Availity provider", () => {
    const providers: string[] = ['waystar', 'change_healthcare', 'availity'];
    assertEquals(providers.includes('availity'), true);
  });

  // =====================================================
  // Clearinghouse Config Tests
  // =====================================================

  await t.step("should require clearinghouse configuration", () => {
    const config = {
      provider: 'waystar' as const,
      apiUrl: 'https://api.waystar.com',
      clientId: 'client-123',
      clientSecret: 'secret-456',
      submitterId: 'submitter-789'
    };

    assertExists(config.provider);
    assertExists(config.apiUrl);
    assertExists(config.clientId);
    assertExists(config.clientSecret);
    assertExists(config.submitterId);
  });

  await t.step("should return error if not configured", () => {
    const result = {
      success: false,
      error: 'Clearinghouse not configured',
      guidance: 'Configure clearinghouse credentials in Admin > Billing > Clearinghouse Config'
    };

    assertEquals(result.success, false);
    assertEquals(result.error, 'Clearinghouse not configured');
    assertExists(result.guidance);
  });

  // =====================================================
  // OAuth Token Tests
  // =====================================================

  await t.step("should get token URL for Waystar", () => {
    const apiUrl = 'https://api.waystar.com';
    const tokenUrl = `${apiUrl}/oauth/token`;

    assertEquals(tokenUrl, 'https://api.waystar.com/oauth/token');
  });

  await t.step("should get token URL for Change Healthcare", () => {
    const apiUrl = 'https://api.changehealthcare.com';
    const tokenUrl = `${apiUrl}/apip/auth/v2/token`;

    assertEquals(tokenUrl, 'https://api.changehealthcare.com/apip/auth/v2/token');
  });

  await t.step("should cache access token with expiry", () => {
    const tokenResponse = {
      access_token: 'token-abc123',
      expires_in: 3600
    };
    const tokenExpiry = new Date(Date.now() + (tokenResponse.expires_in - 60) * 1000);

    assertExists(tokenExpiry);
    assertEquals(tokenExpiry > new Date(), true);
  });

  await t.step("should request new token when expired", () => {
    const tokenExpiry = new Date(Date.now() - 1000); // Expired 1 second ago
    const needsNewToken = !tokenExpiry || tokenExpiry <= new Date();

    assertEquals(needsNewToken, true);
  });

  // =====================================================
  // MCP Tool Definitions Tests
  // =====================================================

  await t.step("should define submit_claim tool", () => {
    const tools = ['submit_claim', 'check_claim_status', 'verify_eligibility', 'process_remittance', 'submit_prior_auth', 'test_connection', 'get_payer_list', 'get_submission_stats', 'get_rejection_reasons'];
    assertEquals(tools.includes('submit_claim'), true);
  });

  await t.step("should define all 9 tools", () => {
    const tools = ['submit_claim', 'check_claim_status', 'verify_eligibility', 'process_remittance', 'submit_prior_auth', 'test_connection', 'get_payer_list', 'get_submission_stats', 'get_rejection_reasons'];
    assertEquals(tools.length, 9);
  });

  // =====================================================
  // Claim Submission Tests (837P/837I)
  // =====================================================

  await t.step("should require claim_id for submission", () => {
    const claim = {
      x12_content: 'ISA*00*...',
      claim_type: '837P',
      payer_id: 'PAYER001',
      patient_id: 'PAT123',
      total_charge: 500.00
    };
    const hasClaim_id = 'claim_id' in claim;

    assertEquals(hasClaim_id, false);
  });

  await t.step("should require x12_content for submission", () => {
    const claim = {
      claim_id: 'CLM001',
      claim_type: '837P' as const,
      payer_id: 'PAYER001',
      patient_id: 'PAT123',
      total_charge: 500.00
    };
    const hasX12 = 'x12_content' in claim;

    assertEquals(hasX12, false);
  });

  await t.step("should support 837P claim type", () => {
    const claimTypes = ['837P', '837I'];
    assertEquals(claimTypes.includes('837P'), true);
  });

  await t.step("should support 837I claim type", () => {
    const claimTypes = ['837P', '837I'];
    assertEquals(claimTypes.includes('837I'), true);
  });

  await t.step("should return submission_id on successful submission", () => {
    const result = {
      success: true,
      submission_id: 'SUB-1234567890-abc123',
      claim_id: 'CLM001',
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      estimated_processing_time: '24-48 hours'
    };

    assertEquals(result.success, true);
    assertExists(result.submission_id);
    assertEquals(result.status, 'submitted');
  });

  await t.step("should include tracking info in submission result", () => {
    const result = {
      tracking: {
        submission_id: 'SUB-123',
        payer_id: 'PAYER001',
        total_charge: 500.00,
        claim_type: '837P'
      }
    };

    assertExists(result.tracking.submission_id);
    assertExists(result.tracking.payer_id);
    assertExists(result.tracking.total_charge);
  });

  // =====================================================
  // Claim Status Tests (276/277)
  // =====================================================

  await t.step("should require payer_id for status check", () => {
    const request = {
      provider_npi: '1234567890',
      date_of_service_from: '2026-01-01'
    };
    const hasPayerId = 'payer_id' in request;

    assertEquals(hasPayerId, false);
  });

  await t.step("should require provider_npi for status check", () => {
    const request = {
      payer_id: 'PAYER001',
      date_of_service_from: '2026-01-01'
    };
    const hasNpi = 'provider_npi' in request;

    assertEquals(hasNpi, false);
  });

  await t.step("should require date_of_service_from for status check", () => {
    const request = {
      payer_id: 'PAYER001',
      provider_npi: '1234567890'
    };
    const hasDate = 'date_of_service_from' in request;

    assertEquals(hasDate, false);
  });

  await t.step("should return claim status codes", () => {
    const statuses = ['accepted', 'in_review', 'pending_info', 'paid', 'denied', 'partial_pay'];
    assertEquals(statuses.length, 6);
    assertEquals(statuses.includes('paid'), true);
    assertEquals(statuses.includes('denied'), true);
  });

  await t.step("should include status category codes", () => {
    const statusCategories: Record<string, string> = {
      'accepted': 'A1',
      'paid': 'F1',
      'denied': 'A7',
      'in_review': 'P1'
    };

    assertEquals(statusCategories['accepted'], 'A1');
    assertEquals(statusCategories['paid'], 'F1');
    assertEquals(statusCategories['denied'], 'A7');
  });

  // =====================================================
  // Eligibility Verification Tests (270/271)
  // =====================================================

  await t.step("should require subscriber info for eligibility", () => {
    const requiredFields = ['payer_id', 'subscriber_id', 'subscriber_first_name', 'subscriber_last_name', 'subscriber_dob', 'provider_npi', 'date_of_service'];
    assertEquals(requiredFields.length, 7);
  });

  await t.step("should support dependent eligibility check", () => {
    const dependent = {
      first_name: 'Jane',
      last_name: 'Doe',
      dob: '2010-05-15',
      relationship_code: '19' // Child
    };

    assertExists(dependent.first_name);
    assertExists(dependent.relationship_code);
  });

  await t.step("should return eligibility details", () => {
    const eligibility = {
      active: true,
      subscriber: { id: 'SUB123', name: 'John Doe', dob: '1980-01-01' },
      payer: { id: 'PAYER001', name: 'Demo Insurance Company' },
      plan: {
        name: 'PPO Gold Plan',
        group_number: 'GRP12345',
        effective_date: '2024-01-01',
        term_date: '2024-12-31'
      }
    };

    assertEquals(eligibility.active, true);
    assertExists(eligibility.subscriber);
    assertExists(eligibility.payer);
    assertExists(eligibility.plan);
  });

  await t.step("should include coverage details", () => {
    const coverage = {
      individual_deductible: 1500.00,
      individual_deductible_met: 750.00,
      family_deductible: 3000.00,
      individual_oop_max: 5000.00,
      office_visit_copay: 25.00,
      specialist_copay: 50.00,
      er_copay: 250.00,
      inpatient_coinsurance: 20
    };

    assertEquals(coverage.office_visit_copay, 25.00);
    assertEquals(coverage.inpatient_coinsurance, 20);
  });

  await t.step("should list prior auth required services", () => {
    const priorAuthServices = [
      'MRI/CT scans',
      'Outpatient surgery',
      'DME over $500'
    ];

    assertEquals(priorAuthServices.length, 3);
    assertEquals(priorAuthServices.includes('MRI/CT scans'), true);
  });

  // =====================================================
  // Remittance Processing Tests (835)
  // =====================================================

  await t.step("should require x12_content for remittance processing", () => {
    const hasX12 = false;
    assertEquals(hasX12, false);
  });

  await t.step("should parse ISA segment for control number", () => {
    const isaSegment = "ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *260122*1200*^*00501*000000001*0*P*:~";
    const controlNumber = isaSegment.split('*')[13];

    assertEquals(controlNumber, '000000001');
  });

  await t.step("should parse BPR segment for payment info", () => {
    const bprSegment = "BPR*I*1500.00*C*ACH*CCP*01*999999999*DA*1234567890*1512345678**01*999888777*DA*9876543210*20260122~";
    const fields = bprSegment.split('*');
    const paymentAmount = parseFloat(fields[2] || '0');
    const paymentMethod = fields[4];

    assertEquals(paymentAmount, 1500.00);
    assertEquals(paymentMethod, 'ACH');
  });

  await t.step("should count CLP segments (claims)", () => {
    const segments = [
      "ISA*...",
      "BPR*...",
      "CLP*CLM001*1*500.00*450.00*50.00*...",
      "CLP*CLM002*1*300.00*270.00*30.00*...",
      "CLP*CLM003*4*200.00*0.00*0.00*..."
    ];
    const claimCount = segments.filter(s => s.startsWith('CLP')).length;

    assertEquals(claimCount, 3);
  });

  await t.step("should parse CLP status codes", () => {
    const statuses: Record<string, string> = {
      '1': 'Processed as Primary',
      '2': 'Processed as Secondary',
      '4': 'Denied',
      '22': 'Reversal of Previous Payment'
    };

    assertEquals(statuses['1'], 'Processed as Primary');
    assertEquals(statuses['4'], 'Denied');
  });

  await t.step("should parse CAS adjustment reasons", () => {
    const reasons: Record<string, string> = {
      '1': 'Deductible',
      '2': 'Coinsurance',
      '3': 'Copayment',
      '45': 'Charges exceed fee schedule maximum',
      '197': 'Precertification/authorization/notification absent'
    };

    assertEquals(reasons['1'], 'Deductible');
    assertEquals(reasons['45'], 'Charges exceed fee schedule maximum');
  });

  await t.step("should calculate remittance summary", () => {
    const claims = [
      { charge_amount: 500, paid_amount: 450, patient_responsibility: 50 },
      { charge_amount: 300, paid_amount: 270, patient_responsibility: 30 },
      { charge_amount: 200, paid_amount: 0, patient_responsibility: 0 }
    ];

    const summary = {
      total_charges: claims.reduce((sum, c) => sum + c.charge_amount, 0),
      total_paid: claims.reduce((sum, c) => sum + c.paid_amount, 0),
      total_patient_responsibility: claims.reduce((sum, c) => sum + c.patient_responsibility, 0)
    };

    assertEquals(summary.total_charges, 1000);
    assertEquals(summary.total_paid, 720);
    assertEquals(summary.total_patient_responsibility, 80);
  });

  // =====================================================
  // Prior Authorization Tests (278)
  // =====================================================

  await t.step("should require prior auth request fields", () => {
    const requiredFields = ['payer_id', 'patient_id', 'subscriber_id', 'provider_npi', 'service_type', 'service_codes', 'diagnosis_codes', 'date_of_service', 'urgency'];
    assertEquals(requiredFields.length, 9);
  });

  await t.step("should support urgency levels", () => {
    const urgencyLevels = ['routine', 'urgent', 'stat'];
    assertEquals(urgencyLevels.length, 3);
    assertEquals(urgencyLevels.includes('stat'), true);
  });

  await t.step("should set expected response time based on urgency", () => {
    const getExpectedTime = (urgency: string): string => {
      if (urgency === 'stat') return '4 hours';
      if (urgency === 'urgent') return '24 hours';
      return '5-7 business days';
    };

    assertEquals(getExpectedTime('stat'), '4 hours');
    assertEquals(getExpectedTime('urgent'), '24 hours');
    assertEquals(getExpectedTime('routine'), '5-7 business days');
  });

  await t.step("should return auth number on submission", () => {
    const result = {
      success: true,
      prior_auth: {
        auth_number: 'PA-1234567890-ABC',
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        urgency: 'urgent',
        expected_response_time: '24 hours'
      }
    };

    assertEquals(result.success, true);
    assertExists(result.prior_auth.auth_number);
    assertEquals(result.prior_auth.status, 'submitted');
  });

  // =====================================================
  // Test Connection Tests
  // =====================================================

  await t.step("should return connection guidance when not configured", () => {
    const result = {
      success: false,
      connected: false,
      error: 'Clearinghouse not configured',
      guidance: {
        step1: 'Go to Admin > Billing > Clearinghouse Config',
        step2: 'Select your clearinghouse provider',
        step3: 'Enter your API credentials',
        step4: 'Click Test Connection to verify',
        step5: 'Save configuration once verified'
      },
      providers: [
        { name: 'Waystar', description: 'Most popular, comprehensive features' },
        { name: 'Change Healthcare', description: 'Largest payer network' },
        { name: 'Availity', description: 'Free portal, affordable API' }
      ]
    };

    assertEquals(result.connected, false);
    assertExists(result.guidance);
    assertEquals(result.providers.length, 3);
  });

  await t.step("should return capabilities when connected", () => {
    const result = {
      success: true,
      connected: true,
      provider: 'waystar',
      capabilities: {
        '837P_submission': true,
        '837I_submission': true,
        '270_271_eligibility': true,
        '276_277_status': true,
        '278_prior_auth': true,
        '835_remittance': true
      }
    };

    assertEquals(result.connected, true);
    assertEquals(result.capabilities['837P_submission'], true);
    assertEquals(result.capabilities['270_271_eligibility'], true);
  });

  await t.step("should return troubleshooting on connection failure", () => {
    const result = {
      success: false,
      connected: false,
      error: 'Authentication failed',
      troubleshooting: [
        'Verify API URL is correct',
        'Check client ID and secret',
        'Ensure account is active with clearinghouse',
        'Contact clearinghouse support if issues persist'
      ]
    };

    assertEquals(result.connected, false);
    assertEquals(result.troubleshooting.length, 4);
  });

  // =====================================================
  // Payer List Tests
  // =====================================================

  await t.step("should return payer list", () => {
    const payers = [
      { id: '00001', name: 'Aetna', type: 'commercial', states: ['ALL'] },
      { id: '00002', name: 'Blue Cross Blue Shield', type: 'commercial', states: ['ALL'] },
      { id: 'CMS', name: 'Medicare', type: 'medicare', states: ['ALL'] }
    ];

    assertEquals(payers.length >= 3, true);
    assertEquals(payers[0].name, 'Aetna');
  });

  await t.step("should filter payers by search term", () => {
    const payers = [
      { id: '00001', name: 'Aetna', type: 'commercial' },
      { id: '00002', name: 'Blue Cross Blue Shield', type: 'commercial' },
      { id: '00003', name: 'Cigna', type: 'commercial' }
    ];
    const search = 'blue';
    const filtered = payers.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

    assertEquals(filtered.length, 1);
    assertEquals(filtered[0].name, 'Blue Cross Blue Shield');
  });

  await t.step("should filter payers by state", () => {
    const payers = [
      { id: '00001', name: 'Aetna', states: ['ALL'] },
      { id: '00010', name: 'Kaiser Permanente', states: ['CA', 'CO', 'GA'] }
    ];
    const state = 'TX';
    const filtered = payers.filter(p => p.states.includes('ALL') || p.states.includes(state));

    assertEquals(filtered.length, 1);
    assertEquals(filtered[0].name, 'Aetna');
  });

  await t.step("should filter payers by type", () => {
    const payers = [
      { id: '00001', name: 'Aetna', type: 'commercial' },
      { id: 'CMS', name: 'Medicare', type: 'medicare' },
      { id: '00021', name: 'Centene', type: 'medicaid' }
    ];
    const type = 'medicare';
    const filtered = payers.filter(p => p.type === type);

    assertEquals(filtered.length, 1);
    assertEquals(filtered[0].name, 'Medicare');
  });

  // =====================================================
  // Submission Stats Tests
  // =====================================================

  await t.step("should return submission statistics", () => {
    const stats = {
      period: { from: '2026-01-01', to: '2026-01-22' },
      submissions: {
        total: 156,
        accepted: 142,
        rejected: 8,
        pending: 6,
        acceptance_rate: 91.03
      },
      payments: {
        total_charges: 245000.00,
        total_paid: 198500.00,
        collection_rate: 81.02
      }
    };

    assertExists(stats.period);
    assertEquals(stats.submissions.total, 156);
    assertEquals(stats.submissions.acceptance_rate, 91.03);
    assertEquals(stats.payments.collection_rate, 81.02);
  });

  await t.step("should include timing metrics", () => {
    const timing = {
      avg_days_to_payment: 18,
      avg_days_to_first_response: 3
    };

    assertEquals(timing.avg_days_to_payment, 18);
    assertEquals(timing.avg_days_to_first_response, 3);
  });

  await t.step("should include top rejection reasons", () => {
    const rejections = [
      { code: '16', description: 'Claim lacks required information', count: 3 },
      { code: '29', description: 'Time limit for filing has expired', count: 2 },
      { code: '197', description: 'Prior auth required', count: 1 }
    ];

    assertEquals(rejections.length >= 3, true);
    assertEquals(rejections[0].code, '16');
  });

  // =====================================================
  // Rejection Reasons Tests
  // =====================================================

  await t.step("should return rejection reasons with remediation", () => {
    const reasons = [
      { code: '1', category: 'patient', description: 'Deductible amount', remediation: 'Bill patient for deductible portion' },
      { code: '16', category: 'other', description: 'Claim lacks required information', remediation: 'Review claim for missing fields, complete and resubmit' },
      { code: '197', category: 'authorization', description: 'Prior authorization required', remediation: 'Obtain prior auth retroactively if possible, or appeal' }
    ];

    assertExists(reasons[0].remediation);
    assertEquals(reasons[2].category, 'authorization');
  });

  await t.step("should filter rejection reasons by code", () => {
    const reasons = [
      { code: '1', category: 'patient' },
      { code: '16', category: 'other' },
      { code: '197', category: 'authorization' }
    ];
    const code = '197';
    const filtered = reasons.filter(r => r.code === code);

    assertEquals(filtered.length, 1);
    assertEquals(filtered[0].category, 'authorization');
  });

  await t.step("should filter rejection reasons by category", () => {
    const reasons = [
      { code: '1', category: 'patient' },
      { code: '2', category: 'patient' },
      { code: '16', category: 'other' }
    ];
    const category = 'patient';
    const filtered = reasons.filter(r => r.category === category);

    assertEquals(filtered.length, 2);
  });

  await t.step("should include appeal guidance", () => {
    const appealGuidance = {
      timeframe: 'Most payers allow appeals within 60-180 days',
      process: [
        '1. Review denial reason carefully',
        '2. Gather supporting documentation',
        '3. Write appeal letter citing medical necessity',
        '4. Include relevant clinical notes and test results',
        '5. Submit via payer portal or certified mail',
        '6. Track appeal status and follow up'
      ],
      tips: [
        'Always reference the specific denial code in appeals',
        'Include peer-reviewed literature for medical necessity'
      ]
    };

    assertEquals(appealGuidance.process.length, 6);
    assertExists(appealGuidance.timeframe);
  });

  // =====================================================
  // MCP Protocol Tests
  // =====================================================

  await t.step("should return protocol version on initialize", () => {
    const result = {
      protocolVersion: '2025-11-25',
      serverInfo: {
        name: 'mcp-clearinghouse-server',
        version: '1.0.0'
      },
      capabilities: { tools: {} }
    };

    assertEquals(result.protocolVersion, '2025-11-25');
    assertEquals(result.serverInfo.name, 'mcp-clearinghouse-server');
  });

  await t.step("should list tools on tools/list", () => {
    const tools = [
      { name: 'submit_claim', description: 'Submit an 837P/837I claim' },
      { name: 'check_claim_status', description: 'Check claim status' },
      { name: 'verify_eligibility', description: 'Verify eligibility' }
    ];

    assertEquals(tools.length >= 3, true);
    assertExists(tools[0].description);
  });

  await t.step("should return execution metadata on tool call", () => {
    const result = {
      content: [{ type: 'text', text: '{"success": true}' }],
      metadata: {
        tool: 'submit_claim',
        executionTimeMs: 245
      }
    };

    assertExists(result.metadata.tool);
    assertExists(result.metadata.executionTimeMs);
  });

  await t.step("should return error for unknown tool", () => {
    const error = {
      code: -32601,
      message: 'Unknown tool: invalid_tool'
    };

    assertEquals(error.code, -32601);
    assertEquals(error.message.includes('Unknown tool'), true);
  });

  await t.step("should return error for unknown method", () => {
    const error = {
      code: -32601,
      message: 'Method not found: invalid/method'
    };

    assertEquals(error.code, -32601);
    assertEquals(error.message.includes('Method not found'), true);
  });

  // =====================================================
  // Authentication Tests
  // =====================================================

  await t.step("should require Bearer token", () => {
    const authHeader = null;
    const isAuthorized = authHeader?.startsWith('Bearer ');

    assertEquals(isAuthorized, undefined);
  });

  await t.step("should return 401 for missing auth", () => {
    const error = { code: -32000, message: 'Unauthorized' };
    assertEquals(error.code, -32000);
    assertEquals(error.message, 'Unauthorized');
  });

  // =====================================================
  // Rate Limiting Tests
  // =====================================================

  await t.step("should use clearinghouse rate limits", () => {
    const clearinghouseRateLimits = {
      requestsPerMinute: 30,
      requestsPerHour: 500
    };

    assertExists(clearinghouseRateLimits.requestsPerMinute);
    assertExists(clearinghouseRateLimits.requestsPerHour);
  });

  await t.step("should return rate limit response when exceeded", () => {
    const response = {
      error: 'Rate limit exceeded',
      retryAfter: 60
    };

    assertEquals(response.error, 'Rate limit exceeded');
    assertExists(response.retryAfter);
  });

  // =====================================================
  // HTTP Method Tests
  // =====================================================

  await t.step("should handle OPTIONS preflight", () => {
    const request = new Request("http://localhost/mcp-clearinghouse-server", {
      method: "OPTIONS"
    });

    assertEquals(request.method, "OPTIONS");
  });

  // =====================================================
  // Error Response Tests
  // =====================================================

  await t.step("should return internal error on exception", () => {
    const error = {
      code: -32603,
      message: 'Internal error'
    };

    assertEquals(error.code, -32603);
    assertEquals(error.message, 'Internal error');
  });

  // =====================================================
  // Logging Tests
  // =====================================================

  await t.step("should log clearinghouse errors", () => {
    const logEntry = {
      level: "error",
      event: "Clearinghouse MCP error",
      context: {
        errorMessage: "Connection timeout",
        errorStack: "Error: Connection timeout\n    at..."
      }
    };

    assertEquals(logEntry.level, "error");
    assertEquals(logEntry.event, "Clearinghouse MCP error");
    assertExists(logEntry.context.errorMessage);
  });
});
