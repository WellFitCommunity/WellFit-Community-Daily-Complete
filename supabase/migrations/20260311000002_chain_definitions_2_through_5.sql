-- ============================================================
-- Seed: Chain Definitions 2-5 for MCP Orchestration
--
-- Chain 2: Provider Onboarding (NPI → FHIR → Postgres)
-- Chain 3: Clinical Decision Support (FHIR → PubMed → CMS → Claude)
-- Chain 4: Encounter-to-Claim (FHIR → Medical Codes → Coding → HL7 → Clearinghouse)
-- Chain 5: Prior Auth Workflow (CMS → Prior Auth → PubMed → HL7 → Clearinghouse)
--
-- All chains follow the same pattern as existing chains 1 and 6.
-- Placeholder steps marked where integration is pending.
-- ============================================================

-- ============================================================
-- Chain 2: Provider Onboarding
-- NPI lookup → validate → create FHIR Practitioner → insert
-- into billing_providers via whitelisted postgres query
-- ============================================================
INSERT INTO chain_definitions (chain_key, display_name, description, version)
VALUES (
  'provider_onboarding',
  'Provider Onboarding Pipeline',
  'Automated provider onboarding: searches NPI registry by name/specialty, validates NPI checksum, creates FHIR Practitioner resource for interoperability, and inserts provider into billing_providers table. Reduces manual data entry for new provider enrollment.',
  1
) ON CONFLICT (chain_key) DO NOTHING;

INSERT INTO chain_step_definitions (
  chain_definition_id, step_order, step_key, display_name,
  mcp_server, tool_name,
  requires_approval, approval_role,
  is_conditional, condition_expression,
  is_placeholder, placeholder_message,
  timeout_ms, max_retries, input_mapping
)
SELECT
  cd.id,
  s.step_order,
  s.step_key,
  s.display_name,
  s.mcp_server,
  s.tool_name,
  s.requires_approval,
  s.approval_role,
  s.is_conditional,
  s.condition_expression,
  s.is_placeholder,
  s.placeholder_message,
  s.timeout_ms,
  s.max_retries,
  s.input_mapping
FROM chain_definitions cd
CROSS JOIN (VALUES
  -- Step 1: Search NPI registry for provider
  (1, 'search_provider', 'Search NPI Registry',
   'mcp-npi-registry-server', 'search_providers',
   false, NULL,
   false, NULL,
   false, NULL,
   15000, 2,
   '{"first_name": "$.input.first_name", "last_name": "$.input.last_name", "state": "$.input.state", "taxonomy_code": "$.input.taxonomy_code"}'::jsonb),

  -- Step 2: Validate NPI checksum and deactivation status
  (2, 'validate_npi', 'Validate NPI',
   'mcp-npi-registry-server', 'validate_npi',
   false, NULL,
   false, NULL,
   false, NULL,
   15000, 2,
   '{"npi": "$.input.npi"}'::jsonb),

  -- Step 3: Get full NPI details for FHIR resource creation
  (3, 'lookup_npi', 'Lookup NPI Details',
   'mcp-npi-registry-server', 'lookup_npi',
   false, NULL,
   false, NULL,
   false, NULL,
   15000, 2,
   '{"npi": "$.input.npi"}'::jsonb),

  -- Step 4: Create FHIR Practitioner resource
  (4, 'create_fhir_practitioner', 'Create FHIR Practitioner',
   'mcp-fhir-server', 'create_resource',
   false, NULL,
   false, NULL,
   false, NULL,
   30000, 1,
   '{"resource_type": "$.literal.Practitioner", "npi": "$.input.npi", "first_name": "$.steps.lookup_npi.first_name", "last_name": "$.steps.lookup_npi.last_name", "taxonomy_code": "$.steps.lookup_npi.taxonomy_code", "state": "$.steps.lookup_npi.state"}'::jsonb),

  -- Step 5: Insert into billing_providers — ADMIN APPROVAL REQUIRED
  (5, 'insert_billing_provider', 'Register Billing Provider',
   'mcp-postgres-server', 'execute_query',
   true, 'admin',
   false, NULL,
   false, NULL,
   15000, 0,
   '{"query_key": "$.literal.insert_billing_provider", "params": "$.steps.lookup_npi"}'::jsonb)

) AS s(
  step_order, step_key, display_name,
  mcp_server, tool_name,
  requires_approval, approval_role,
  is_conditional, condition_expression,
  is_placeholder, placeholder_message,
  timeout_ms, max_retries, input_mapping
)
WHERE cd.chain_key = 'provider_onboarding'
ON CONFLICT (chain_definition_id, step_key) DO NOTHING;


-- ============================================================
-- Chain 3: Clinical Decision Support
-- Patient summary → medications → PubMed evidence →
-- CMS coverage check → AI synthesis (physician approval)
-- ============================================================
INSERT INTO chain_definitions (chain_key, display_name, description, version)
VALUES (
  'clinical_decision_support',
  'Clinical Decision Support Pipeline',
  'AI-assisted clinical decision support: retrieves patient summary and active medications via FHIR, searches PubMed for condition-relevant evidence, checks CMS coverage requirements, and synthesizes a clinical decision support recommendation via Claude (physician review required). All output is advisory only.',
  1
) ON CONFLICT (chain_key) DO NOTHING;

INSERT INTO chain_step_definitions (
  chain_definition_id, step_order, step_key, display_name,
  mcp_server, tool_name,
  requires_approval, approval_role,
  is_conditional, condition_expression,
  is_placeholder, placeholder_message,
  timeout_ms, max_retries, input_mapping
)
SELECT
  cd.id,
  s.step_order,
  s.step_key,
  s.display_name,
  s.mcp_server,
  s.tool_name,
  s.requires_approval,
  s.approval_role,
  s.is_conditional,
  s.condition_expression,
  s.is_placeholder,
  s.placeholder_message,
  s.timeout_ms,
  s.max_retries,
  s.input_mapping
FROM chain_definitions cd
CROSS JOIN (VALUES
  -- Step 1: Get patient summary from FHIR
  (1, 'get_patient_summary', 'Get Patient Summary',
   'mcp-fhir-server', 'get_patient_summary',
   false, NULL,
   false, NULL,
   false, NULL,
   30000, 2,
   '{"patient_id": "$.input.patient_id"}'::jsonb),

  -- Step 2: Get active medication list
  (2, 'get_medications', 'Get Active Medications',
   'mcp-fhir-server', 'get_medication_list',
   false, NULL,
   false, NULL,
   false, NULL,
   30000, 2,
   '{"patient_id": "$.input.patient_id"}'::jsonb),

  -- Step 3: Search PubMed for evidence related to condition
  (3, 'search_evidence', 'Search PubMed Evidence',
   'mcp-pubmed-server', 'search_pubmed',
   false, NULL,
   false, NULL,
   false, NULL,
   30000, 2,
   '{"query": "$.input.clinical_query", "max_results": "$.input.max_results"}'::jsonb),

  -- Step 4: Check CMS coverage requirements for proposed treatment
  (4, 'check_coverage', 'Check CMS Coverage',
   'mcp-cms-coverage-server', 'get_coverage_requirements',
   false, NULL,
   false, NULL,
   false, NULL,
   15000, 1,
   '{"cpt_code": "$.input.cpt_code", "icd_codes": "$.input.icd_codes"}'::jsonb),

  -- Step 5: AI synthesis — PHYSICIAN APPROVAL REQUIRED
  -- Claude analyzes patient context + evidence + coverage and generates recommendation
  (5, 'ai_synthesis', 'AI Clinical Synthesis',
   'mcp-claude-server', 'analyze-text',
   true, 'physician',
   false, NULL,
   false, NULL,
   60000, 0,
   '{"text": "$.steps.get_patient_summary", "context": "$.steps.search_evidence", "medications": "$.steps.get_medications", "coverage": "$.steps.check_coverage", "instruction": "$.literal.Synthesize clinical decision support recommendation. This is advisory only and requires physician review. Include: patient summary, relevant evidence from PubMed, medication considerations, and CMS coverage status. Flag any contraindications or coverage gaps."}'::jsonb)

) AS s(
  step_order, step_key, display_name,
  mcp_server, tool_name,
  requires_approval, approval_role,
  is_conditional, condition_expression,
  is_placeholder, placeholder_message,
  timeout_ms, max_retries, input_mapping
)
WHERE cd.chain_key = 'clinical_decision_support'
ON CONFLICT (chain_definition_id, step_key) DO NOTHING;


-- ============================================================
-- Chain 4: Encounter-to-Claim
-- FHIR encounter → AI code suggestion (coder approval) →
-- validate codes → charge capture → generate 837P →
-- submit to clearinghouse (placeholder)
-- ============================================================
INSERT INTO chain_definitions (chain_key, display_name, description, version)
VALUES (
  'encounter_to_claim',
  'Encounter-to-Claim Pipeline',
  'End-to-end encounter billing: retrieves encounter details from FHIR, AI-suggests CPT/ICD codes from encounter documentation (coder approval required), validates suggested code combinations, captures charges, generates 837P professional claim, and submits to clearinghouse. All AI coding suggestions are advisory and require certified coder review.',
  1
) ON CONFLICT (chain_key) DO NOTHING;

INSERT INTO chain_step_definitions (
  chain_definition_id, step_order, step_key, display_name,
  mcp_server, tool_name,
  requires_approval, approval_role,
  is_conditional, condition_expression,
  is_placeholder, placeholder_message,
  timeout_ms, max_retries, input_mapping
)
SELECT
  cd.id,
  s.step_order,
  s.step_key,
  s.display_name,
  s.mcp_server,
  s.tool_name,
  s.requires_approval,
  s.approval_role,
  s.is_conditional,
  s.condition_expression,
  s.is_placeholder,
  s.placeholder_message,
  s.timeout_ms,
  s.max_retries,
  s.input_mapping
FROM chain_definitions cd
CROSS JOIN (VALUES
  -- Step 1: Get encounter details from FHIR
  (1, 'get_encounter', 'Get Encounter Details',
   'mcp-fhir-server', 'get_resource',
   false, NULL,
   false, NULL,
   false, NULL,
   30000, 2,
   '{"resource_type": "$.literal.Encounter", "resource_id": "$.input.encounter_id"}'::jsonb),

  -- Step 2: AI code suggestion — CODER APPROVAL REQUIRED
  -- Suggests CPT/ICD codes based on encounter documentation
  (2, 'suggest_codes', 'AI Code Suggestion',
   'mcp-medical-codes-server', 'suggest_codes',
   true, 'coder',
   false, NULL,
   false, NULL,
   30000, 0,
   '{"encounter_id": "$.input.encounter_id", "encounter_data": "$.steps.get_encounter"}'::jsonb),

  -- Step 3: Validate the approved code combination
  (3, 'validate_codes', 'Validate Code Combination',
   'mcp-medical-codes-server', 'validate_code_combination',
   false, NULL,
   false, NULL,
   false, NULL,
   15000, 1,
   '{"cpt_code": "$.steps.suggest_codes.cpt_code", "icd_codes": "$.steps.suggest_codes.icd_codes", "modifier_codes": "$.steps.suggest_codes.modifier_codes"}'::jsonb),

  -- Step 4: Capture charges via medical coding server
  (4, 'capture_charges', 'Capture Charges',
   'mcp-medical-coding-server', 'aggregate_daily_charges',
   false, NULL,
   false, NULL,
   false, NULL,
   30000, 1,
   '{"patient_id": "$.input.patient_id", "encounter_id": "$.input.encounter_id", "service_date": "$.input.service_date"}'::jsonb),

  -- Step 5: Generate 837P professional claim
  (5, 'generate_837p', 'Generate 837P Claim',
   'mcp-hl7-x12-server', 'generate_837p',
   false, NULL,
   false, NULL,
   false, NULL,
   30000, 1,
   '{"patient_id": "$.input.patient_id", "encounter_id": "$.input.encounter_id", "provider_npi": "$.input.provider_npi", "payer_id": "$.input.payer_id", "cpt_code": "$.steps.suggest_codes.cpt_code", "icd_codes": "$.steps.suggest_codes.icd_codes", "modifier_codes": "$.steps.suggest_codes.modifier_codes", "charge_amount": "$.steps.capture_charges.total_charge_amount"}'::jsonb),

  -- Step 6: Submit to clearinghouse — PLACEHOLDER
  (6, 'submit_claim', 'Submit to Clearinghouse',
   'mcp-clearinghouse-server', 'submit_claim',
   false, NULL,
   false, NULL,
   true, 'Clearinghouse integration pending sandbox credentials (expected week of 2026-03-16). The 837P file from step 5 is ready for manual submission or will auto-submit once credentials are configured.',
   30000, 0,
   '{"claim_data": "$.steps.generate_837p"}'::jsonb)

) AS s(
  step_order, step_key, display_name,
  mcp_server, tool_name,
  requires_approval, approval_role,
  is_conditional, condition_expression,
  is_placeholder, placeholder_message,
  timeout_ms, max_retries, input_mapping
)
WHERE cd.chain_key = 'encounter_to_claim'
ON CONFLICT (chain_definition_id, step_key) DO NOTHING;


-- ============================================================
-- Chain 5: Prior Auth Workflow
-- CMS check → create PA (conditional) → PubMed evidence →
-- submit PA (physician approval) → X12 278 submission (placeholder)
-- ============================================================
INSERT INTO chain_definitions (chain_key, display_name, description, version)
VALUES (
  'prior_auth_workflow',
  'Prior Authorization Workflow',
  'End-to-end prior authorization: checks CMS requirements to determine if PA is needed, creates PA request if required, searches PubMed for supporting clinical evidence, submits PA for physician review and approval, and generates X12 278 for electronic submission to payer. Clearinghouse submission pending integration.',
  1
) ON CONFLICT (chain_key) DO NOTHING;

INSERT INTO chain_step_definitions (
  chain_definition_id, step_order, step_key, display_name,
  mcp_server, tool_name,
  requires_approval, approval_role,
  is_conditional, condition_expression,
  is_placeholder, placeholder_message,
  timeout_ms, max_retries, input_mapping
)
SELECT
  cd.id,
  s.step_order,
  s.step_key,
  s.display_name,
  s.mcp_server,
  s.tool_name,
  s.requires_approval,
  s.approval_role,
  s.is_conditional,
  s.condition_expression,
  s.is_placeholder,
  s.placeholder_message,
  s.timeout_ms,
  s.max_retries,
  s.input_mapping
FROM chain_definitions cd
CROSS JOIN (VALUES
  -- Step 1: Check if prior authorization is required
  (1, 'check_pa_required', 'Check PA Requirement',
   'mcp-cms-coverage-server', 'check_prior_auth_required',
   false, NULL,
   false, NULL,
   false, NULL,
   15000, 2,
   '{"cpt_code": "$.input.cpt_code", "icd_codes": "$.input.icd_codes", "payer_id": "$.input.payer_id"}'::jsonb),

  -- Step 2: Create prior auth request — CONDITIONAL
  -- Only runs if step 1 indicates PA is required
  (2, 'create_pa', 'Create Prior Auth Request',
   'mcp-prior-auth-server', 'create_prior_auth',
   false, NULL,
   true, '$.steps.check_pa_required.prior_auth_required == true',
   false, NULL,
   30000, 0,
   '{"patient_id": "$.input.patient_id", "encounter_id": "$.input.encounter_id", "cpt_code": "$.input.cpt_code", "icd_codes": "$.input.icd_codes", "payer_id": "$.input.payer_id", "provider_npi": "$.input.provider_npi", "clinical_reason": "$.input.clinical_reason"}'::jsonb),

  -- Step 3: Search PubMed for supporting evidence — CONDITIONAL
  -- Only runs if PA was created (step 2 ran)
  (3, 'search_evidence', 'Search Supporting Evidence',
   'mcp-pubmed-server', 'search_pubmed',
   false, NULL,
   true, '$.steps.check_pa_required.prior_auth_required == true',
   false, NULL,
   30000, 2,
   '{"query": "$.input.clinical_query", "max_results": "$.literal.5"}'::jsonb),

  -- Step 4: Submit PA for physician review — CONDITIONAL + PHYSICIAN APPROVAL
  -- Physician reviews the PA with supporting evidence before submission
  (4, 'submit_pa', 'Submit Prior Auth',
   'mcp-prior-auth-server', 'submit_prior_auth',
   true, 'physician',
   true, '$.steps.check_pa_required.prior_auth_required == true',
   false, NULL,
   30000, 0,
   '{"prior_auth_id": "$.steps.create_pa.prior_auth_id", "supporting_evidence": "$.steps.search_evidence"}'::jsonb),

  -- Step 5: Generate X12 278 request — CONDITIONAL + PLACEHOLDER
  -- Electronic PA submission to payer via clearinghouse
  (5, 'submit_278', 'Submit X12 278 to Payer',
   'mcp-clearinghouse-server', 'submit_prior_auth',
   false, NULL,
   true, '$.steps.check_pa_required.prior_auth_required == true',
   true, 'Clearinghouse X12 278 submission pending sandbox credentials (expected week of 2026-03-16). The prior auth from step 4 has been submitted internally — electronic payer submission will auto-connect once clearinghouse integration is active.',
   30000, 0,
   '{"prior_auth_id": "$.steps.create_pa.prior_auth_id", "x12_type": "$.literal.278"}'::jsonb)

) AS s(
  step_order, step_key, display_name,
  mcp_server, tool_name,
  requires_approval, approval_role,
  is_conditional, condition_expression,
  is_placeholder, placeholder_message,
  timeout_ms, max_retries, input_mapping
)
WHERE cd.chain_key = 'prior_auth_workflow'
ON CONFLICT (chain_definition_id, step_key) DO NOTHING;
