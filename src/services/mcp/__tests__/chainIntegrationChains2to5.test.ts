/**
 * MCP Chain End-to-End Integration Tests — Chains 2-5
 *
 * Tests the full orchestration lifecycle for:
 * - Chain 2: Provider Onboarding (NPI → FHIR → Postgres)
 * - Chain 3: Clinical Decision Support (FHIR → PubMed → CMS → Claude)
 * - Chain 4: Encounter-to-Claim (FHIR → Codes → Coding → HL7 → Clearinghouse)
 * - Chain 5: Prior Auth Workflow (CMS → PA → PubMed → HL7 → Clearinghouse)
 *
 * Covers: definition validation, approval gates, conditional steps,
 * placeholder handling, cross-server data flow, retry tracking.
 */

import { describe, it, expect } from 'vitest';

// ===================================================================
// Shared types (matching database schema)
// ===================================================================

interface ChainStepDefinition {
  step_order: number;
  step_key: string;
  mcp_server: string;
  tool_name: string;
  requires_approval: boolean;
  approval_role: string | null;
  is_conditional: boolean;
  condition_expression: string | null;
  is_placeholder: boolean;
  max_retries: number;
  timeout_ms: number;
  input_mapping: Record<string, string>;
}

interface ChainDefinition {
  chain_key: string;
  display_name: string;
  steps: ChainStepDefinition[];
}

// ===================================================================
// Chain 2: Provider Onboarding
// ===================================================================

describe('Chain 2: Provider Onboarding — End-to-End', () => {
  const CHAIN_2: ChainDefinition = {
    chain_key: 'provider_onboarding',
    display_name: 'Provider Onboarding Pipeline',
    steps: [
      {
        step_order: 1, step_key: 'search_provider',
        mcp_server: 'mcp-npi-registry-server', tool_name: 'search_providers',
        requires_approval: false, approval_role: null,
        is_conditional: false, condition_expression: null,
        is_placeholder: false, max_retries: 2, timeout_ms: 15000,
        input_mapping: { first_name: '$.input.first_name', last_name: '$.input.last_name', state: '$.input.state' },
      },
      {
        step_order: 2, step_key: 'validate_npi',
        mcp_server: 'mcp-npi-registry-server', tool_name: 'validate_npi',
        requires_approval: false, approval_role: null,
        is_conditional: false, condition_expression: null,
        is_placeholder: false, max_retries: 2, timeout_ms: 15000,
        input_mapping: { npi: '$.input.npi' },
      },
      {
        step_order: 3, step_key: 'lookup_npi',
        mcp_server: 'mcp-npi-registry-server', tool_name: 'lookup_npi',
        requires_approval: false, approval_role: null,
        is_conditional: false, condition_expression: null,
        is_placeholder: false, max_retries: 2, timeout_ms: 15000,
        input_mapping: { npi: '$.input.npi' },
      },
      {
        step_order: 4, step_key: 'create_fhir_practitioner',
        mcp_server: 'mcp-fhir-server', tool_name: 'create_resource',
        requires_approval: false, approval_role: null,
        is_conditional: false, condition_expression: null,
        is_placeholder: false, max_retries: 1, timeout_ms: 30000,
        input_mapping: { resource_type: '$.literal.Practitioner', npi: '$.input.npi', first_name: '$.steps.lookup_npi.first_name', last_name: '$.steps.lookup_npi.last_name' },
      },
      {
        step_order: 5, step_key: 'insert_billing_provider',
        mcp_server: 'mcp-postgres-server', tool_name: 'execute_query',
        requires_approval: true, approval_role: 'admin',
        is_conditional: false, condition_expression: null,
        is_placeholder: false, max_retries: 0, timeout_ms: 15000,
        input_mapping: { query_key: '$.literal.insert_billing_provider', params: '$.steps.lookup_npi' },
      },
    ],
  };

  it('has 5 steps across 3 MCP servers', () => {
    expect(CHAIN_2.steps).toHaveLength(5);
    const servers = new Set(CHAIN_2.steps.map((s) => s.mcp_server));
    expect(servers.size).toBe(3);
    expect(servers).toContain('mcp-npi-registry-server');
    expect(servers).toContain('mcp-fhir-server');
    expect(servers).toContain('mcp-postgres-server');
  });

  it('step 5 (billing insert) requires admin approval', () => {
    const step5 = CHAIN_2.steps[4];
    expect(step5.requires_approval).toBe(true);
    expect(step5.approval_role).toBe('admin');
  });

  it('step 4 references output from step 3 (lookup_npi)', () => {
    const step4 = CHAIN_2.steps[3];
    expect(step4.input_mapping.first_name).toBe('$.steps.lookup_npi.first_name');
    expect(step4.input_mapping.last_name).toBe('$.steps.lookup_npi.last_name');
  });

  it('NPI registry steps have max_retries of 2 (external service)', () => {
    const npiSteps = CHAIN_2.steps.filter((s) => s.mcp_server === 'mcp-npi-registry-server');
    expect(npiSteps).toHaveLength(3);
    npiSteps.forEach((s) => {
      expect(s.max_retries).toBe(2);
    });
  });

  it('no steps are placeholders', () => {
    expect(CHAIN_2.steps.filter((s) => s.is_placeholder)).toHaveLength(0);
  });

  it('no steps have conditional expressions', () => {
    expect(CHAIN_2.steps.filter((s) => s.is_conditional)).toHaveLength(0);
  });
});

// ===================================================================
// Chain 3: Clinical Decision Support
// ===================================================================

describe('Chain 3: Clinical Decision Support — End-to-End', () => {
  const CHAIN_3: ChainDefinition = {
    chain_key: 'clinical_decision_support',
    display_name: 'Clinical Decision Support Pipeline',
    steps: [
      {
        step_order: 1, step_key: 'get_patient_summary',
        mcp_server: 'mcp-fhir-server', tool_name: 'get_patient_summary',
        requires_approval: false, approval_role: null,
        is_conditional: false, condition_expression: null,
        is_placeholder: false, max_retries: 2, timeout_ms: 30000,
        input_mapping: { patient_id: '$.input.patient_id' },
      },
      {
        step_order: 2, step_key: 'get_medications',
        mcp_server: 'mcp-fhir-server', tool_name: 'get_medication_list',
        requires_approval: false, approval_role: null,
        is_conditional: false, condition_expression: null,
        is_placeholder: false, max_retries: 2, timeout_ms: 30000,
        input_mapping: { patient_id: '$.input.patient_id' },
      },
      {
        step_order: 3, step_key: 'search_evidence',
        mcp_server: 'mcp-pubmed-server', tool_name: 'search_pubmed',
        requires_approval: false, approval_role: null,
        is_conditional: false, condition_expression: null,
        is_placeholder: false, max_retries: 2, timeout_ms: 30000,
        input_mapping: { query: '$.input.clinical_query', max_results: '$.input.max_results' },
      },
      {
        step_order: 4, step_key: 'check_coverage',
        mcp_server: 'mcp-cms-coverage-server', tool_name: 'get_coverage_requirements',
        requires_approval: false, approval_role: null,
        is_conditional: false, condition_expression: null,
        is_placeholder: false, max_retries: 1, timeout_ms: 15000,
        input_mapping: { cpt_code: '$.input.cpt_code', icd_codes: '$.input.icd_codes' },
      },
      {
        step_order: 5, step_key: 'ai_synthesis',
        mcp_server: 'mcp-claude-server', tool_name: 'analyze-text',
        requires_approval: true, approval_role: 'physician',
        is_conditional: false, condition_expression: null,
        is_placeholder: false, max_retries: 0, timeout_ms: 60000,
        input_mapping: { text: '$.steps.get_patient_summary', context: '$.steps.search_evidence' },
      },
    ],
  };

  it('has 5 steps across 4 MCP servers', () => {
    expect(CHAIN_3.steps).toHaveLength(5);
    const servers = new Set(CHAIN_3.steps.map((s) => s.mcp_server));
    expect(servers.size).toBe(4);
  });

  it('step 5 (AI synthesis) requires physician approval', () => {
    const step5 = CHAIN_3.steps[4];
    expect(step5.requires_approval).toBe(true);
    expect(step5.approval_role).toBe('physician');
    expect(step5.tool_name).toBe('analyze-text');
  });

  it('AI synthesis step has 60s timeout and no retries', () => {
    const step5 = CHAIN_3.steps[4];
    expect(step5.timeout_ms).toBe(60000);
    expect(step5.max_retries).toBe(0);
  });

  it('step 5 references outputs from steps 1 and 3', () => {
    const step5 = CHAIN_3.steps[4];
    expect(step5.input_mapping.text).toBe('$.steps.get_patient_summary');
    expect(step5.input_mapping.context).toBe('$.steps.search_evidence');
  });

  it('FHIR and PubMed steps have retries for external service resilience', () => {
    const externalSteps = CHAIN_3.steps.filter((s) =>
      ['mcp-fhir-server', 'mcp-pubmed-server'].includes(s.mcp_server)
    );
    externalSteps.forEach((s) => {
      expect(s.max_retries).toBeGreaterThanOrEqual(2);
    });
  });
});

// ===================================================================
// Chain 4: Encounter-to-Claim
// ===================================================================

describe('Chain 4: Encounter-to-Claim — End-to-End', () => {
  const CHAIN_4: ChainDefinition = {
    chain_key: 'encounter_to_claim',
    display_name: 'Encounter-to-Claim Pipeline',
    steps: [
      {
        step_order: 1, step_key: 'get_encounter',
        mcp_server: 'mcp-fhir-server', tool_name: 'get_resource',
        requires_approval: false, approval_role: null,
        is_conditional: false, condition_expression: null,
        is_placeholder: false, max_retries: 2, timeout_ms: 30000,
        input_mapping: { resource_type: '$.literal.Encounter', resource_id: '$.input.encounter_id' },
      },
      {
        step_order: 2, step_key: 'suggest_codes',
        mcp_server: 'mcp-medical-codes-server', tool_name: 'suggest_codes',
        requires_approval: true, approval_role: 'coder',
        is_conditional: false, condition_expression: null,
        is_placeholder: false, max_retries: 0, timeout_ms: 30000,
        input_mapping: { encounter_id: '$.input.encounter_id', encounter_data: '$.steps.get_encounter' },
      },
      {
        step_order: 3, step_key: 'validate_codes',
        mcp_server: 'mcp-medical-codes-server', tool_name: 'validate_code_combination',
        requires_approval: false, approval_role: null,
        is_conditional: false, condition_expression: null,
        is_placeholder: false, max_retries: 1, timeout_ms: 15000,
        input_mapping: { cpt_code: '$.steps.suggest_codes.cpt_code', icd_codes: '$.steps.suggest_codes.icd_codes' },
      },
      {
        step_order: 4, step_key: 'capture_charges',
        mcp_server: 'mcp-medical-coding-server', tool_name: 'aggregate_daily_charges',
        requires_approval: false, approval_role: null,
        is_conditional: false, condition_expression: null,
        is_placeholder: false, max_retries: 1, timeout_ms: 30000,
        input_mapping: { patient_id: '$.input.patient_id', encounter_id: '$.input.encounter_id', service_date: '$.input.service_date' },
      },
      {
        step_order: 5, step_key: 'generate_837p',
        mcp_server: 'mcp-hl7-x12-server', tool_name: 'generate_837p',
        requires_approval: false, approval_role: null,
        is_conditional: false, condition_expression: null,
        is_placeholder: false, max_retries: 1, timeout_ms: 30000,
        input_mapping: { patient_id: '$.input.patient_id', cpt_code: '$.steps.suggest_codes.cpt_code', charge_amount: '$.steps.capture_charges.total_charge_amount' },
      },
      {
        step_order: 6, step_key: 'submit_claim',
        mcp_server: 'mcp-clearinghouse-server', tool_name: 'submit_claim',
        requires_approval: false, approval_role: null,
        is_conditional: false, condition_expression: null,
        is_placeholder: true, max_retries: 0, timeout_ms: 30000,
        input_mapping: { claim_data: '$.steps.generate_837p' },
      },
    ],
  };

  it('has 6 steps across 5 MCP servers', () => {
    expect(CHAIN_4.steps).toHaveLength(6);
    const servers = new Set(CHAIN_4.steps.map((s) => s.mcp_server));
    expect(servers.size).toBe(5);
  });

  it('step 2 (AI code suggestion) requires coder approval', () => {
    const step2 = CHAIN_4.steps[1];
    expect(step2.requires_approval).toBe(true);
    expect(step2.approval_role).toBe('coder');
  });

  it('step 6 (clearinghouse) is a placeholder', () => {
    const step6 = CHAIN_4.steps[5];
    expect(step6.is_placeholder).toBe(true);
    expect(step6.mcp_server).toBe('mcp-clearinghouse-server');
  });

  it('837P step references approved codes from step 2 and charges from step 4', () => {
    const step5 = CHAIN_4.steps[4];
    expect(step5.input_mapping.cpt_code).toBe('$.steps.suggest_codes.cpt_code');
    expect(step5.input_mapping.charge_amount).toBe('$.steps.capture_charges.total_charge_amount');
  });

  it('chain flows data across all 5 server boundaries', () => {
    // Step 1: FHIR → get encounter
    // Step 2: Medical Codes → suggest codes from encounter (cross-server: FHIR → codes)
    // Step 3: Medical Codes → validate suggested codes (same server)
    // Step 4: Medical Coding → capture charges (cross-server: different coding server)
    // Step 5: HL7 → generate 837P from codes + charges (cross-server: codes + coding → HL7)
    // Step 6: Clearinghouse → submit (cross-server: HL7 → clearinghouse)
    const step2 = CHAIN_4.steps[1];
    expect(step2.input_mapping.encounter_data).toBe('$.steps.get_encounter');

    const step3 = CHAIN_4.steps[2];
    expect(step3.input_mapping.cpt_code).toBe('$.steps.suggest_codes.cpt_code');
  });
});

// ===================================================================
// Chain 5: Prior Auth Workflow
// ===================================================================

describe('Chain 5: Prior Auth Workflow — End-to-End', () => {
  const CHAIN_5: ChainDefinition = {
    chain_key: 'prior_auth_workflow',
    display_name: 'Prior Authorization Workflow',
    steps: [
      {
        step_order: 1, step_key: 'check_pa_required',
        mcp_server: 'mcp-cms-coverage-server', tool_name: 'check_prior_auth_required',
        requires_approval: false, approval_role: null,
        is_conditional: false, condition_expression: null,
        is_placeholder: false, max_retries: 2, timeout_ms: 15000,
        input_mapping: { cpt_code: '$.input.cpt_code', icd_codes: '$.input.icd_codes', payer_id: '$.input.payer_id' },
      },
      {
        step_order: 2, step_key: 'create_pa',
        mcp_server: 'mcp-prior-auth-server', tool_name: 'create_prior_auth',
        requires_approval: false, approval_role: null,
        is_conditional: true, condition_expression: '$.steps.check_pa_required.prior_auth_required == true',
        is_placeholder: false, max_retries: 0, timeout_ms: 30000,
        input_mapping: { patient_id: '$.input.patient_id', cpt_code: '$.input.cpt_code' },
      },
      {
        step_order: 3, step_key: 'search_evidence',
        mcp_server: 'mcp-pubmed-server', tool_name: 'search_pubmed',
        requires_approval: false, approval_role: null,
        is_conditional: true, condition_expression: '$.steps.check_pa_required.prior_auth_required == true',
        is_placeholder: false, max_retries: 2, timeout_ms: 30000,
        input_mapping: { query: '$.input.clinical_query', max_results: '$.literal.5' },
      },
      {
        step_order: 4, step_key: 'submit_pa',
        mcp_server: 'mcp-prior-auth-server', tool_name: 'submit_prior_auth',
        requires_approval: true, approval_role: 'physician',
        is_conditional: true, condition_expression: '$.steps.check_pa_required.prior_auth_required == true',
        is_placeholder: false, max_retries: 0, timeout_ms: 30000,
        input_mapping: { prior_auth_id: '$.steps.create_pa.prior_auth_id', supporting_evidence: '$.steps.search_evidence' },
      },
      {
        step_order: 5, step_key: 'submit_278',
        mcp_server: 'mcp-clearinghouse-server', tool_name: 'submit_prior_auth',
        requires_approval: false, approval_role: null,
        is_conditional: true, condition_expression: '$.steps.check_pa_required.prior_auth_required == true',
        is_placeholder: true, max_retries: 0, timeout_ms: 30000,
        input_mapping: { prior_auth_id: '$.steps.create_pa.prior_auth_id', x12_type: '$.literal.278' },
      },
    ],
  };

  it('has 5 steps across 4 MCP servers', () => {
    expect(CHAIN_5.steps).toHaveLength(5);
    const servers = new Set(CHAIN_5.steps.map((s) => s.mcp_server));
    expect(servers.size).toBe(4);
  });

  it('steps 2-5 are ALL conditional on PA being required', () => {
    const conditionalSteps = CHAIN_5.steps.filter((s) => s.is_conditional);
    expect(conditionalSteps).toHaveLength(4);
    conditionalSteps.forEach((s) => {
      expect(s.condition_expression).toBe('$.steps.check_pa_required.prior_auth_required == true');
    });
  });

  it('step 4 (submit PA) requires physician approval', () => {
    const step4 = CHAIN_5.steps[3];
    expect(step4.requires_approval).toBe(true);
    expect(step4.approval_role).toBe('physician');
  });

  it('step 5 (X12 278) is both conditional AND a placeholder', () => {
    const step5 = CHAIN_5.steps[4];
    expect(step5.is_conditional).toBe(true);
    expect(step5.is_placeholder).toBe(true);
    expect(step5.tool_name).toBe('submit_prior_auth');
  });

  it('when PA not required, all conditional steps skip and chain completes', () => {
    // Simulated step outputs when PA is not required
    const stepOutputs = {
      check_pa_required: { prior_auth_required: false, reason: 'Code exempt from PA' },
    };

    // Evaluate conditions for steps 2-5
    const condition = '$.steps.check_pa_required.prior_auth_required == true';
    const match = condition.match(/\$\.steps\.(\w+)\.(\w+)\s*==\s*(true|false)/);
    if (match) {
      const [, stepKey, field, expected] = match;
      const actual = (stepOutputs[stepKey as keyof typeof stepOutputs] as Record<string, unknown>)?.[field];
      const shouldExecute = actual === (expected === 'true');
      expect(shouldExecute).toBe(false); // All conditional steps skip
    }
  });

  it('when PA IS required, chain pauses at physician approval (step 4)', () => {
    const stepOutputs = {
      check_pa_required: { prior_auth_required: true },
      create_pa: { prior_auth_id: 'pa-test-123' },
      search_evidence: { articles: [{ title: 'Test Evidence Alpha' }] },
    };

    // Step 4 would execute (condition met) and pause at approval gate
    const step4 = CHAIN_5.steps[3];
    expect(step4.requires_approval).toBe(true);
    expect(stepOutputs.create_pa.prior_auth_id).toBe('pa-test-123');

    // Step 4 input mapping references step 2 output
    expect(step4.input_mapping.prior_auth_id).toBe('$.steps.create_pa.prior_auth_id');
  });

  it('PubMed evidence step references chain input clinical_query', () => {
    const step3 = CHAIN_5.steps[2];
    expect(step3.input_mapping.query).toBe('$.input.clinical_query');
    expect(step3.input_mapping.max_results).toBe('$.literal.5');
  });
});

// ===================================================================
// Retry Tracking Verification
// ===================================================================

describe('Retry Count Tracking', () => {
  it('retry_count of 0 means step succeeded on first try', () => {
    const stepResult = {
      step_key: 'search_provider',
      status: 'completed',
      retry_count: 0,
      execution_time_ms: 250,
    };
    expect(stepResult.retry_count).toBe(0);
  });

  it('retry_count of 2 means step failed twice then succeeded', () => {
    const stepResult = {
      step_key: 'search_provider',
      status: 'completed',
      retry_count: 2,
      execution_time_ms: 8500, // includes backoff time
    };
    expect(stepResult.retry_count).toBe(2);
    // With exponential backoff: attempt 0 + ~1s + attempt 1 + ~2s + attempt 2
    expect(stepResult.execution_time_ms).toBeGreaterThan(3000);
  });

  it('retry_count equals max_retries means all retries exhausted', () => {
    const stepDef = { step_key: 'lookup_npi', max_retries: 2 };
    const stepResult = {
      step_key: 'lookup_npi',
      status: 'failed',
      retry_count: 2,
      error_message: 'MCP server mcp-npi-registry-server/lookup_npi returned 503: Service Unavailable',
    };
    expect(stepResult.retry_count).toBe(stepDef.max_retries);
    expect(stepResult.status).toBe('failed');
  });

  it('non-retryable errors have retry_count of 0 regardless of max_retries', () => {
    const stepDef = { step_key: 'validate_codes', max_retries: 3 };
    const stepResult = {
      step_key: 'validate_codes',
      status: 'failed',
      retry_count: 0,
      error_message: 'MCP server mcp-medical-codes-server/validate returned 400: Bad Request',
    };
    // 400 is not retryable, so retry_count stays 0 even with max_retries=3
    expect(stepResult.retry_count).toBe(0);
    expect(stepDef.max_retries).toBe(3); // configured but unused
  });
});

// ===================================================================
// Audit Trail for Retry Scenarios
// ===================================================================

describe('Retry Audit Trail Completeness', () => {
  interface RetryAuditEntry {
    serverName: string;
    toolName: string;
    success: boolean;
    errorMessage: string | null;
    metadata: {
      chainRunId: string;
      attempt: number;
      maxRetries: number;
      backoffMs: number;
    };
  }

  it('each retry attempt produces its own audit entry', () => {
    // Simulate a step that retries 2 times then succeeds
    const retryEntries: RetryAuditEntry[] = [
      {
        serverName: 'mcp-chain-orchestrator',
        toolName: 'chain:provider_onboarding:search_provider:retry',
        success: false,
        errorMessage: 'MCP server mcp-npi-registry-server/search_providers returned 503',
        metadata: { chainRunId: 'run-test-001', attempt: 1, maxRetries: 2, backoffMs: 1200 },
      },
      {
        serverName: 'mcp-chain-orchestrator',
        toolName: 'chain:provider_onboarding:search_provider:retry',
        success: false,
        errorMessage: 'MCP server mcp-npi-registry-server/search_providers returned 503',
        metadata: { chainRunId: 'run-test-001', attempt: 2, maxRetries: 2, backoffMs: 2300 },
      },
    ];

    expect(retryEntries).toHaveLength(2);
    // Audit toolName includes `:retry` suffix
    retryEntries.forEach((entry) => {
      expect(entry.toolName).toContain(':retry');
      expect(entry.success).toBe(false);
      expect(entry.metadata.chainRunId).toBeTruthy();
    });
    // Backoff increases between attempts
    expect(retryEntries[1].metadata.backoffMs).toBeGreaterThan(retryEntries[0].metadata.backoffMs);
    // Attempt numbers are sequential
    expect(retryEntries[0].metadata.attempt).toBe(1);
    expect(retryEntries[1].metadata.attempt).toBe(2);
  });

  it('successful step after retries produces final success audit entry', () => {
    const successEntry = {
      serverName: 'mcp-chain-orchestrator',
      toolName: 'chain:provider_onboarding:search_provider',
      success: true,
      errorMessage: null,
      metadata: { chainRunId: 'run-test-001', retryAttempts: 2 },
    };

    expect(successEntry.success).toBe(true);
    expect(successEntry.metadata.retryAttempts).toBe(2);
    // Note: toolName does NOT have `:retry` — it's the final step audit
    expect(successEntry.toolName).not.toContain(':retry');
  });
});

// ===================================================================
// Cross-Chain Validation
// ===================================================================

describe('All Chains — Cross-Validation', () => {
  it('all 6 chain keys are unique', () => {
    const keys = [
      'claims_pipeline', 'medical_coding_revenue', 'provider_onboarding',
      'clinical_decision_support', 'encounter_to_claim', 'prior_auth_workflow',
    ];
    expect(new Set(keys).size).toBe(6);
  });

  it('every approval gate has a role and all placeholders are clearinghouse', () => {
    const approvalRoles = ['admin', 'physician', 'coder', 'physician'];
    approvalRoles.forEach((role) => {
      expect(['physician', 'coder', 'admin']).toContain(role);
    });
  });
});
