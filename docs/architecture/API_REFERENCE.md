# API Reference

**Envision Virtual Edge Group LLC**
**Last Updated:** February 6, 2026

---

## Overview

The WellFit Community and Envision Atlus platforms expose their API through two layers:

1. **10 MCP Servers** - Model Context Protocol servers for structured healthcare data operations
2. **130+ Edge Functions** - Supabase Deno-based serverless functions for clinical, AI, and administrative operations

All endpoints are served from `https://{project-id}.supabase.co/functions/v1/{function-name}`.

---

## Authentication

### Three-Tier Authentication Model

| Tier | Auth Method | Use Case | Example Servers |
|------|-----------|----------|-----------------|
| **Tier 1** (External API) | Supabase apikey header only | Public healthcare APIs | CMS Coverage, NPI Registry, Clearinghouse |
| **Tier 2** (User-Scoped) | Apikey + User JWT (RLS enforced) | User data with tenant isolation | Postgres, Medical Codes |
| **Tier 3** (Admin) | Apikey + Service Role Key + Role verification | Clinical writes, PHI access | FHIR, Prior Auth, HL7/X12, Claude, Edge Functions |

### Headers

```
# All requests
apikey: <supabase-anon-key>
Content-Type: application/json

# Tier 2+ (user context)
Authorization: Bearer <user-jwt>

# Tier 3 (admin/clinical)
Authorization: Bearer <service-role-key>
X-MCP-KEY: <optional machine-to-machine key>
```

---

## MCP Server Protocol

All MCP servers use **JSON-RPC 2.0** over HTTP POST.

### Standard Methods

| Method | Purpose | Auth Required |
|--------|---------|:-------------:|
| `initialize` | Server discovery (name, version, capabilities) | No |
| `tools/list` | List available tools with schemas | No |
| `tools/call` | Execute a tool | Tier-dependent |

### Request Format

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "tool_name",
    "arguments": { "param1": "value1" }
  },
  "id": 1
}
```

### Response Format

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{ "type": "text", "text": "..." }],
    "metadata": {
      "tool": "tool_name",
      "executionTimeMs": 245,
      "requestId": "uuid"
    }
  },
  "id": 1
}
```

### Health Check

All servers respond to `GET /` with server status.

---

## MCP Servers

### 1. mcp-fhir-server (Tier 3)

**Purpose:** FHIR R4 resource CRUD operations, patient summaries, EHR sync.

**Roles Required:** `nurse`, `charge_nurse`, `physician`, `care_manager`, `admin`, `super_admin`

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `export_patient_bundle` | Export complete FHIR Bundle | `patient_id`, `resources[]`, `start_date`, `end_date` |
| `get_resource` | Get FHIR resource by ID | `resource_type`, `resource_id` |
| `search_resources` | Search with filters | `resource_type`, `patient_id`, `status`, `category`, `code`, `date_from`, `date_to` |
| `create_resource` | Create FHIR resource | `resource_type`, `data`, `patient_id` |
| `update_resource` | Update FHIR resource | `resource_type`, `resource_id`, `data` |
| `validate_resource` | Validate against FHIR schema | `resource_type`, `data` |
| `get_patient_summary` | CCD-style clinical summary | `patient_id`, `include_sections[]` |
| `get_observations` | Vitals and lab results | `patient_id`, `category`, `code`, `date_from`, `date_to` |
| `get_medication_list` | Active/historical medications | `patient_id`, `status`, `include_history` |
| `get_condition_list` | Diagnoses and conditions | `patient_id`, `clinical_status`, `category` |
| `get_sdoh_assessments` | Social determinants of health | `patient_id`, `domain` |
| `get_care_team` | Care team members | `patient_id`, `include_contact_info` |
| `list_ehr_connections` | EHR/FHIR connections | `tenant_id`, `status` |
| `trigger_ehr_sync` | Trigger external EHR sync | `connection_id`, `direction`, `patient_id`, `resources[]` |

**Supported FHIR Resources:** Patient, MedicationRequest, Condition, DiagnosticReport, Procedure, Observation, Immunization, CarePlan, CareTeam, Practitioner, PractitionerRole, Encounter, DocumentReference, AllergyIntolerance, Goal, Location, Organization, Medication

---

### 2. mcp-prior-auth-server (Tier 3)

**Purpose:** Prior authorization lifecycle management (CMS-0057-F compliance). Da Vinci PAS IG conformant.

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `create_prior_auth` | Create PA request (draft) | `patient_id`, `payer_id`, `service_codes[]`, `diagnosis_codes[]`, `tenant_id` |
| `submit_prior_auth` | Submit PA to payer | `prior_auth_id` |
| `get_prior_auth` | Get PA details | `prior_auth_id` or `auth_number` |
| `get_patient_prior_auths` | All PAs for patient | `patient_id`, `status` |
| `record_decision` | Record payer decision | `prior_auth_id`, `decision_type`, `tenant_id` |
| `create_appeal` | Appeal a denied PA | `prior_auth_id`, `appeal_reason`, `tenant_id` |
| `check_prior_auth_required` | Check if PA needed | `patient_id`, `service_codes[]`, `date_of_service`, `tenant_id` |
| `get_pending_prior_auths` | PAs approaching deadline | `tenant_id`, `hours_threshold` |
| `get_prior_auth_statistics` | Dashboard analytics | `tenant_id`, `start_date`, `end_date` |
| `cancel_prior_auth` | Cancel PA request | `prior_auth_id`, `reason` |
| `to_fhir_claim` | Convert to FHIR Claim | `prior_auth_id` |

**Urgency Deadlines:** stat = 4 hours, urgent = 72 hours, routine = 7 days

---

### 3. mcp-hl7-x12-server (Tier 3)

**Purpose:** Bidirectional HL7 v2.x and X12 message transformation.

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `parse_hl7` | Parse HL7 v2.x message | `message`, `strip_mllp` |
| `hl7_to_fhir` | Convert HL7 to FHIR R4 Bundle | `message` |
| `generate_hl7_ack` | Generate ACK response | `original_message`, `ack_code` |
| `validate_hl7` | Validate message structure | `message`, `message_type` |
| `generate_837p` | Generate X12 837P claim | `encounter_id` or `claim_data` |
| `validate_x12` | Validate X12 837P | `x12_content` |
| `parse_x12` | Extract structured data from X12 | `x12_content` |
| `x12_to_fhir` | Convert X12 to FHIR Claim | `x12_content` |

**Supported Types:** HL7 ADT, ORU, ORM | X12 837P, 837I

---

### 4. mcp-claude-server (Tier 3)

**Purpose:** Consolidated Claude AI operations with PHI de-identification, prompt caching, and audit logging.

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `analyze-text` | Analyze text with Claude | `text`, `prompt`, `model` |
| `generate-suggestion` | Generate AI suggestions | `context`, `task`, `model` |
| `summarize` | Summarize content | `content`, `maxLength`, `model` |

**Default Models:** Sonnet for analysis, Haiku for suggestions/summaries. PHI automatically redacted before API call.

---

### 5. mcp-cms-coverage-server (Tier 1)

**Purpose:** Medicare LCD/NCD coverage lookups for prior authorization compliance.

**External API:** CMS Medicare Coverage Database

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `search_lcd` | Search Local Coverage Determinations | `query`, `state`, `contractor_number`, `status` |
| `search_ncd` | Search National Coverage Determinations | `query`, `benefit_category`, `status` |
| `get_coverage_requirements` | Coverage for CPT/HCPCS code | `code`, `state`, `payer_type` |
| `check_prior_auth_required` | PA requirement check | `cpt_code`, `icd10_codes[]`, `state` |
| `get_lcd_details` | LCD details by ID | `lcd_id` |
| `get_ncd_details` | NCD details by ID | `ncd_id` |
| `get_coverage_articles` | Billing/coding guidance | `code`, `article_type` |
| `get_mac_contractors` | MAC info for state | `state`, `jurisdiction` |

---

### 6. mcp-npi-registry-server (Tier 1)

**Purpose:** National Provider Identifier validation and provider lookup.

**External API:** CMS NPI Registry (NPPES)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `validate_npi` | Validate NPI (Luhn check + registry) | `npi` |
| `lookup_npi` | Detailed provider info | `npi` |
| `search_providers` | Search by name/specialty/location | `first_name`, `last_name`, `state`, `taxonomy_description` |
| `search_by_specialty` | Search by taxonomy code | `taxonomy_code`, `state`, `city` |
| `get_taxonomy_codes` | Taxonomy codes for specialty | `specialty`, `category` |
| `bulk_validate_npis` | Validate up to 50 NPIs | `npis[]` |
| `get_provider_identifiers` | State licenses, DEA, etc. | `npi` |
| `check_npi_deactivation` | Check deactivation status | `npi` |

---

### 7. mcp-clearinghouse-server (Tier 1)

**Purpose:** Healthcare clearinghouse EDI operations.

**Supports:** Waystar, Change Healthcare, Availity

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `submit_claim` | Submit 837P/837I claim | `claim` (object with x12_content, payer_id, etc.) |
| `check_claim_status` | X12 276/277 status inquiry | `request` (payer_id, provider_npi, date range) |
| `verify_eligibility` | X12 270/271 eligibility check | `request` (subscriber info, payer, service types) |
| `process_remittance` | Process ERA/835 | `x12_content` |
| `submit_prior_auth` | X12 278 PA request | `request` (service codes, diagnosis, urgency) |
| `test_connection` | Test clearinghouse connectivity | (none) |
| `get_payer_list` | Supported payers | `search`, `state`, `type` |
| `get_submission_stats` | Claim submission metrics | `date_from`, `date_to`, `payer_id` |
| `get_rejection_reasons` | Rejection codes and remediation | `rejection_code`, `category` |

---

### 8. mcp-postgres-server (Tier 2)

**Purpose:** Safe, whitelisted database queries with RLS enforcement.

**Security:** Only pre-approved queries allowed. All queries include automatic `tenant_id` filter.

| Tool | Description |
|------|-------------|
| `execute_whitelisted_query` | Run approved analytics queries |

**Whitelisted Query Categories:** Patient analytics by risk, readmission risk summary, encounter summaries, SDOH flag distribution, medication adherence statistics, claims status summary, care team utilization.

---

### 9. mcp-medical-codes-server (Tier 2)

**Purpose:** CPT, ICD-10, HCPCS medical code lookup and validation.

| Capability | Description |
|------------|-------------|
| Code search | Search by keyword or code number |
| Validation | Validate code format and existence |
| Metadata | Code descriptions, categories, specialties |

---

### 10. mcp-edge-functions-server (Tier 3)

**Purpose:** Edge function orchestration and management.

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `invoke_function` | Invoke a whitelisted function | `function_name`, `payload`, `timeout` |
| `list_functions` | List available functions | `category` |
| `get_function_info` | Function details | `function_name` |
| `batch_invoke` | Invoke multiple functions | `invocations[]`, `stop_on_error` |

**Invocable Functions:** get-welfare-priorities, calculate-readmission-risk, sdoh-passive-detect, generate-engagement-report, generate-quality-report, enhanced-fhir-export, hl7-receive, generate-837p, process-shift-handoff, create-care-alert, send-sms, hash-pin, verify-pin

---

## Edge Functions (Selected)

### AI Clinical Services (40+)

| Function | Purpose |
|----------|---------|
| `ai-medication-instructions` | Generate patient medication instructions |
| `ai-contraindication-detector` | Detect drug contraindications |
| `ai-caregiver-briefing` | Generate caregiver briefings |
| `ai-clinical-guideline-matcher` | Match clinical guidelines to patient |
| `ai-referral-letter` | Generate referral letters |
| `ai-soap-note-generator` | Generate SOAP notes |
| `ai-care-plan-generator` | Generate care plans |
| `ai-care-escalation-scorer` | Score escalation risk |
| `ai-discharge-summary` | Generate discharge summaries |
| `ai-fall-risk-predictor` | Predict fall risk |
| `ai-infection-risk-predictor` | Predict infection risk |
| `ai-readmission-predictor` | Predict readmission risk |
| `ai-medication-adherence-predictor` | Predict medication adherence |
| `ai-medication-reconciliation` | Reconcile medication lists |
| `ai-patient-education` | Generate patient education materials |
| `ai-billing-suggester` | Suggest billing codes |
| `ai-patient-qa-bot` | Patient Q&A chatbot |
| `ai-schedule-optimizer` | Optimize clinical schedules |
| `ai-provider-assistant` | Provider clinical assistant |
| `realtime_medical_transcription` | Real-time medical transcription |

### Authentication

| Function | Purpose |
|----------|---------|
| `register` | Patient registration |
| `login` | User authentication |
| `admin_register` | Admin account creation |
| `admin_start_session` / `admin_end_session` | Admin session management |
| `hash-pin` / `verify-pin` | PIN management |
| `verify-hcaptcha` | Bot protection verification |
| `smart-authorize` / `smart-token` | SMART on FHIR authorization |
| `passkey-auth-start` / `passkey-register-start` | Passkey (WebAuthn) authentication |

### Notifications

| Function | Purpose |
|----------|---------|
| `send-sms` | SMS delivery via Twilio |
| `send-email` / `send_welcome_email` | Email delivery via MailerSend |
| `send-push-notification` | Push notifications via Firebase |
| `send-checkin-reminders` | Automated check-in reminders |
| `send-appointment-reminder` | Appointment reminders |
| `emergency-alert-dispatch` | Emergency alert dispatch |
| `notify-family-missed-check-in` | Family notification on missed check-in |

### Data Export

| Function | Purpose |
|----------|---------|
| `enhanced-fhir-export` | FHIR Bundle export with AI assessments |
| `ccda-export` | C-CDA format export |
| `pdf-health-summary` | PDF health summary generation |
| `bulk-export` | Bulk patient data export |

### Clinical Integration

| Function | Purpose |
|----------|---------|
| `hl7-receive` | Inbound HL7 v2.x message processing |
| `generate-837p` | X12 837P claim generation |
| `ecr-submit` | Electronic case reporting |
| `immunization-registry-submit` | Immunization registry submission |
| `syndromic-surveillance-submit` | Public health syndromic surveillance |
| `pdmp-query` | Prescription drug monitoring program query |
| `fhir-metadata` | FHIR CapabilityStatement |

### System

| Function | Purpose |
|----------|---------|
| `system-status` | Platform health check |
| `prometheus-metrics` | Prometheus-format metrics |
| `mobile-sync` | Mobile app data synchronization |
| `validate-api-key` | API key validation |

---

## Rate Limiting

| Scope | Default Limit |
|-------|:-------------:|
| General API | 60 requests/minute |
| MCP Servers | Configurable per server |
| AI Services | Budget-capped (daily/monthly) |

Rate limit responses return HTTP 429 with retry-after header.

---

## CORS Policy

All endpoints enforce strict CORS:
- Origins must be listed in `ALLOWED_ORIGINS` environment variable
- No wildcards (`*`) permitted
- CSP header includes `frame-ancestors 'none'`
- Preflight (OPTIONS) handled by shared CORS module

---

## Error Responses

### Standard Error Format

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32600,
    "message": "Invalid request",
    "data": { "details": "..." }
  },
  "id": 1
}
```

### Error Codes

| Code | Meaning |
|------|---------|
| -32700 | Parse error |
| -32600 | Invalid request |
| -32601 | Method not found |
| -32602 | Invalid params |
| -32603 | Internal error |
| 401 | Unauthorized (missing/invalid auth) |
| 403 | Forbidden (insufficient role) |
| 429 | Rate limited |

---

*Document Owner: Envision Virtual Edge Group LLC*
*Contact: maria@wellfitcommunity.com*
