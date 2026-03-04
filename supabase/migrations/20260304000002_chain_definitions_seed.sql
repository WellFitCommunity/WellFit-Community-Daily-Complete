-- ============================================================
-- Seed: Chain Definitions for MCP Orchestration
--
-- Chain 6: Medical Coding → Revenue (6 steps, all same server)
-- Chain 1: Claims Pipeline (5 steps, 4 servers, 1 placeholder)
-- ============================================================

-- ============================================================
-- Chain 6: Medical Coding → Revenue
-- Aggregates charges → snapshots → DRG grouper (approval gate)
-- → revenue projection → optimization → validation
-- ============================================================
INSERT INTO chain_definitions (chain_key, display_name, description, version)
VALUES (
  'medical_coding_revenue',
  'Medical Coding → Revenue Pipeline',
  'End-to-end inpatient revenue pipeline: aggregates daily charges from 5 source tables, persists a charge snapshot, runs AI-powered MS-DRG grouping (physician approval required), calculates expected reimbursement, generates optimization suggestions, and validates charge completeness.',
  1
) ON CONFLICT (chain_key) DO NOTHING;

-- Steps for Chain 6
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
  -- Step 1: Aggregate daily charges from 5 source tables
  (1, 'aggregate_charges', 'Aggregate Daily Charges',
   'mcp-medical-coding-server', 'aggregate_daily_charges',
   false, NULL,
   false, NULL,
   false, NULL,
   30000, 1,
   '{"patient_id": "$.input.patient_id", "encounter_id": "$.input.encounter_id", "service_date": "$.input.service_date"}'::jsonb),

  -- Step 2: Save the aggregated snapshot to database
  (2, 'save_snapshot', 'Save Charge Snapshot',
   'mcp-medical-coding-server', 'save_daily_snapshot',
   false, NULL,
   false, NULL,
   false, NULL,
   15000, 1,
   '{"patient_id": "$.input.patient_id", "encounter_id": "$.input.encounter_id", "service_date": "$.input.service_date", "charges": "$.steps.aggregate_charges.charges", "total_charge_amount": "$.steps.aggregate_charges.total_charge_amount", "charge_count": "$.steps.aggregate_charges.charge_count"}'::jsonb),

  -- Step 3: AI DRG grouper — PHYSICIAN APPROVAL REQUIRED
  (3, 'drg_grouper', 'Run DRG Grouper',
   'mcp-medical-coding-server', 'run_drg_grouper',
   true, 'physician',
   false, NULL,
   false, NULL,
   60000, 0,
   '{"encounter_id": "$.input.encounter_id"}'::jsonb),

  -- Step 4: Calculate revenue projection from DRG result + payer rules
  (4, 'revenue_projection', 'Calculate Revenue Projection',
   'mcp-medical-coding-server', 'get_revenue_projection',
   false, NULL,
   false, NULL,
   false, NULL,
   15000, 1,
   '{"encounter_id": "$.input.encounter_id", "payer_type": "$.input.payer_type", "fiscal_year": "$.input.fiscal_year", "state_code": "$.input.state_code"}'::jsonb),

  -- Step 5: AI optimization suggestions
  (5, 'optimize_revenue', 'Optimize Daily Revenue',
   'mcp-medical-coding-server', 'optimize_daily_revenue',
   false, NULL,
   false, NULL,
   false, NULL,
   60000, 0,
   '{"encounter_id": "$.input.encounter_id", "service_date": "$.input.service_date"}'::jsonb),

  -- Step 6: Rule-based charge completeness validation
  (6, 'validate_charges', 'Validate Charge Completeness',
   'mcp-medical-coding-server', 'validate_charge_completeness',
   false, NULL,
   false, NULL,
   false, NULL,
   15000, 1,
   '{"encounter_id": "$.input.encounter_id", "service_date": "$.input.service_date"}'::jsonb)

) AS s(
  step_order, step_key, display_name,
  mcp_server, tool_name,
  requires_approval, approval_role,
  is_conditional, condition_expression,
  is_placeholder, placeholder_message,
  timeout_ms, max_retries, input_mapping
)
WHERE cd.chain_key = 'medical_coding_revenue'
ON CONFLICT (chain_definition_id, step_key) DO NOTHING;

-- ============================================================
-- Chain 1: Claims Pipeline
-- Validate codes → check coverage → prior auth (conditional)
-- → generate 837P → submit to clearinghouse (placeholder)
-- ============================================================
INSERT INTO chain_definitions (chain_key, display_name, description, version)
VALUES (
  'claims_pipeline',
  'Claims Submission Pipeline',
  'End-to-end claim submission: validates CPT/ICD code combinations, checks CMS coverage requirements and prior auth necessity, creates prior authorization if required (physician approval), generates 837P claim file, and submits to clearinghouse. Note: clearinghouse auto-submission is pending integration.',
  1
) ON CONFLICT (chain_key) DO NOTHING;

-- Steps for Chain 1
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
  -- Step 1: Validate CPT/ICD code combination
  (1, 'validate_codes', 'Validate Code Combination',
   'mcp-medical-codes-server', 'validate_code_combination',
   false, NULL,
   false, NULL,
   false, NULL,
   15000, 1,
   '{"cpt_code": "$.input.cpt_code", "icd_codes": "$.input.icd_codes", "modifier_codes": "$.input.modifier_codes"}'::jsonb),

  -- Step 2: Check if prior authorization is required
  (2, 'check_prior_auth', 'Check Prior Auth Required',
   'mcp-cms-coverage-server', 'check_prior_auth_required',
   false, NULL,
   false, NULL,
   false, NULL,
   15000, 1,
   '{"cpt_code": "$.input.cpt_code", "icd_codes": "$.input.icd_codes", "payer_id": "$.input.payer_id"}'::jsonb),

  -- Step 3: Create prior auth — CONDITIONAL + PHYSICIAN APPROVAL
  -- Only runs if step 2 says prior auth is required
  (3, 'create_prior_auth', 'Create Prior Authorization',
   'mcp-prior-auth-server', 'create_prior_auth',
   true, 'physician',
   true, '$.steps.check_prior_auth.prior_auth_required == true',
   false, NULL,
   30000, 0,
   '{"patient_id": "$.input.patient_id", "encounter_id": "$.input.encounter_id", "cpt_code": "$.input.cpt_code", "icd_codes": "$.input.icd_codes", "payer_id": "$.input.payer_id", "provider_npi": "$.input.provider_npi"}'::jsonb),

  -- Step 4: Generate 837P claim file
  (4, 'generate_837p', 'Generate 837P Claim',
   'mcp-hl7-x12-server', 'generate_837p',
   false, NULL,
   false, NULL,
   false, NULL,
   30000, 1,
   '{"patient_id": "$.input.patient_id", "encounter_id": "$.input.encounter_id", "provider_npi": "$.input.provider_npi", "payer_id": "$.input.payer_id", "cpt_code": "$.input.cpt_code", "icd_codes": "$.input.icd_codes", "modifier_codes": "$.input.modifier_codes", "charge_amount": "$.input.charge_amount"}'::jsonb),

  -- Step 5: Submit to clearinghouse — PLACEHOLDER
  (5, 'submit_claim', 'Submit to Clearinghouse',
   'mcp-clearinghouse-server', 'submit_claim',
   false, NULL,
   false, NULL,
   true, 'Clearinghouse integration pending — 837P generated successfully but auto-submission is not yet connected. The 837P file from step 4 is ready for manual submission.',
   30000, 0,
   '{"claim_data": "$.steps.generate_837p.output"}'::jsonb)

) AS s(
  step_order, step_key, display_name,
  mcp_server, tool_name,
  requires_approval, approval_role,
  is_conditional, condition_expression,
  is_placeholder, placeholder_message,
  timeout_ms, max_retries, input_mapping
)
WHERE cd.chain_key = 'claims_pipeline'
ON CONFLICT (chain_definition_id, step_key) DO NOTHING;
