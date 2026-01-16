# Claude for Healthcare Integration Guide

**Last Updated:** January 2026
**Status:** Production Ready
**Compliance:** HIPAA, SOC2 Type II

---

## Overview

This document details the Claude for Healthcare integration in WellFit/Envision Atlus, including all MCP servers, AI skills, and healthcare-specific features.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [MCP Server Architecture](#mcp-server-architecture)
3. [AI Skills Inventory](#ai-skills-inventory)
4. [Healthcare Integrations](#healthcare-integrations)
5. [New Features (January 2026)](#new-features-january-2026)
6. [Implementation Guide](#implementation-guide)
7. [Security & Compliance](#security--compliance)
8. [API Reference](#api-reference)
9. [Roadmap](#roadmap)

---

## Executive Summary

### Current State

| Metric | Count |
|--------|-------|
| MCP Servers | 8 (6 existing + 2 new) |
| AI Skills | 49 registered |
| FHIR Services | 8 |
| Healthcare Tables | 454 (434 with RLS) |
| Encrypted PHI Fields | 48 |

### New Capabilities Added

| Feature | Description | Status |
|---------|-------------|--------|
| CMS Coverage MCP | Medicare LCD/NCD lookups, prior auth checking | NEW |
| NPI Registry MCP | Provider validation, taxonomy codes | NEW |
| Extended Thinking | Complex medical reasoning | Available |
| Files API | Secure medical document storage | Available |

---

## MCP Server Architecture

### Active MCP Servers

| Server | Purpose | Tools | Production Ready |
|--------|---------|-------|------------------|
| `cms-coverage` | Medicare coverage database | 8 | NEW |
| `npi-registry` | Provider NPI validation | 8 | NEW |
| `postgres` | Database queries | 6 | YES |
| `edge-functions` | Workflow orchestration | 5 | YES |
| `medical-codes` | CPT/ICD-10/HCPCS lookup | 9 | YES |
| `fhir` | FHIR R4 operations | 12 | YES |
| `hl7-x12` | HL7/X12 transformations | 8 | YES |
| `clearinghouse` | Claims/eligibility/prior auth | 10 | YES |

### Configuration

```json
// .mcp.json
{
  "mcpServers": {
    "cms-coverage": {
      "type": "http",
      "url": "${VITE_SUPABASE_URL}/functions/v1/mcp-cms-coverage-server"
    },
    "npi-registry": {
      "type": "http",
      "url": "${VITE_SUPABASE_URL}/functions/v1/mcp-npi-registry-server"
    }
  }
}
```

---

## CMS Coverage MCP Server

### Tools

| Tool | Description |
|------|-------------|
| `search_lcd` | Search Local Coverage Determinations |
| `search_ncd` | Search National Coverage Determinations |
| `get_coverage_requirements` | Get coverage requirements for a code |
| `check_prior_auth_required` | Check if prior auth is needed |
| `get_lcd_details` | Get detailed LCD information |
| `get_ncd_details` | Get detailed NCD information |
| `get_coverage_articles` | Get billing/coding articles |
| `get_mac_contractors` | Get MAC contractor info by state |

### Example Usage

```typescript
// Check if MRI requires prior authorization
const result = await mcpClient.call('cms-coverage', 'check_prior_auth_required', {
  cpt_code: '70553',
  icd10_codes: ['G43.909'],
  state: 'TX'
});

// Response:
{
  cpt_code: '70553',
  requires_prior_auth: true,
  confidence: 'high',
  documentation_required: [
    'Clinical indication',
    'Prior imaging results',
    'Neurological exam'
  ],
  estimated_approval_time: '2-5 business days'
}
```

### Common Prior Auth Codes

| CPT Code | Description | Prior Auth | Approval Time |
|----------|-------------|------------|---------------|
| 70553 | MRI brain w/ & w/o contrast | YES | 2-5 days |
| 72148 | MRI lumbar spine | YES | 2-5 days |
| 27447 | Total knee replacement | YES | 5-10 days |
| 27130 | Total hip replacement | YES | 5-10 days |
| E0601 | CPAP device | YES | 3-7 days |
| K0823 | Power wheelchair | YES | 10-14 days |

---

## NPI Registry MCP Server

### Tools

| Tool | Description |
|------|-------------|
| `validate_npi` | Validate NPI format and check if active |
| `lookup_npi` | Get detailed provider information |
| `search_providers` | Search by name, specialty, location |
| `search_by_specialty` | Search by taxonomy code |
| `get_taxonomy_codes` | Get taxonomy codes for specialty |
| `bulk_validate_npis` | Validate multiple NPIs (max 50) |
| `get_provider_identifiers` | Get state licenses, DEA numbers |
| `check_npi_deactivation` | Check if NPI has been deactivated |

### Example Usage

```typescript
// Validate an NPI
const result = await mcpClient.call('npi-registry', 'validate_npi', {
  npi: '1234567890'
});

// Response:
{
  npi: '1234567890',
  valid_format: true,
  is_active: true,
  provider_name: 'John Smith MD',
  enumeration_type: 'NPI-1',
  status: 'active',
  validation_message: 'NPI is valid and active for John Smith MD'
}

// Search for cardiologists in Texas
const providers = await mcpClient.call('npi-registry', 'search_providers', {
  taxonomy_description: 'Cardiovascular Disease',
  state: 'TX',
  limit: 20
});
```

### Common Taxonomy Codes

| Specialty | Code | Type |
|-----------|------|------|
| Internal Medicine | 207R00000X | Individual |
| Family Medicine | 207Q00000X | Individual |
| Cardiology | 207RC0000X | Individual |
| Orthopedic Surgery | 207X00000X | Individual |
| Nurse Practitioner | 363L00000X | Individual |
| Hospital | 282N00000X | Organization |
| Pharmacy | 333600000X | Organization |
| Home Health | 251E00000X | Organization |

---

## AI Skills Inventory

### Clinical Decision Support (Sonnet 4.5)

| Skill | # | Description |
|-------|---|-------------|
| readmission_predictor | 2 | 30/7/90-day readmission risk |
| fall_risk_predictor | 30 | Morse Scale + evidence-based |
| infection_risk_predictor | 33 | CLABSI, CAUTI, SSI, VAP prediction |
| care_escalation_scorer | 32 | Confidence-level escalation |
| medication_adherence_predictor | 31 | Barrier identification |
| contraindication_detector | 25 | Multi-factor safety analysis |
| clinical_guideline_matcher | 24 | Smart guideline recommendations |

### Documentation (Sonnet 4.5)

| Skill | # | Description |
|-------|---|-------------|
| soap_note_generator | 18 | SOAP notes from encounters |
| discharge_summary | 19 | Auto-generate with med reconciliation |
| care_plan_generator | 20 | Evidence-based care plans |
| referral_letter | 22 | Specialist referrals with urgency |
| medical_transcript | 5 | Real-time transcription |

### Billing & Coding (Haiku 4.5)

| Skill | # | Description |
|-------|---|-------------|
| billing_suggester | 1 | ICD-10/CPT suggestions (95% cache) |
| sdoh_passive_detector | 3 | 25 social determinant categories |
| ccm_eligibility_scorer | 6 | Chronic care management scoring |

### Patient Engagement (Haiku 4.5)

| Skill | # | Description |
|-------|---|-------------|
| mood_suggestions | 12 | Personalized mood recommendations |
| smart_checkin_questions | 13 | Daily check-in personalization |
| patient_education | 14 | 6th-grade reading level content |
| medication_instructions | 29 | Multi-language, visual ID |
| cultural_health_coach | 7 | 13-language translation |

### Security & Compliance (Sonnet 4.5)

| Skill | # | Description |
|-------|---|-------------|
| security_anomaly_detector | 53 | ML-powered breach detection |
| phi_exposure_risk_scorer | 54 | PHI exposure risk assessment |
| hipaa_violation_predictor | 55 | Proactive violation detection |
| audit_report_generator | 36 | SOC2/HIPAA audit reports |

---

## Healthcare Integrations

### FHIR Services

| Service | File | Features |
|---------|------|----------|
| Resource Service | `fhirResourceService.ts` | CRUD operations for FHIR resources |
| Code Generation | `fhirCodeGeneration.ts` | Generate FHIR-compliant codes |
| Encounter Wrapper | `fhirEncounterWrapper.ts` | Encounter management |
| Interoperability | `fhirInteroperabilityIntegrator.ts` | Cross-system data exchange |
| Mapping Service | `fhirMappingService.ts` | Data mapping to FHIR |
| Questionnaire | `fhirQuestionnaireService.ts` | FHIR Questionnaires |
| Security | `fhirSecurityService.ts` | SMART on FHIR auth |
| Sync | `fhirSyncIntegration.ts` | Real-time sync |

### Database Schema (NPI Fields)

44 columns storing NPI data across:
- `billing_providers.npi`
- `facilities.npi`
- `fhir_practitioners.npi`
- `hc_staff.npi`
- `physicians.npi`
- `specialist_providers.npi`
- And 38 more provider-related tables

### Prior Authorization

Full 278 transaction support via clearinghouse MCP:
- `submitPriorAuthorization()`
- Urgency levels: routine, urgent, stat
- Supported payers: Commercial, Medicare, Medicaid, TRICARE, Workers Comp

---

## New Features (January 2026)

### Claude for Healthcare Launch

Anthropic announced Claude for Healthcare at J.P. Morgan Healthcare Conference:

| Feature | Description |
|---------|-------------|
| HIPAA BAA | Business Associate Agreement included |
| Zero-Training Policy | Patient data never used for training |
| Healthcare Connectors | CMS, NPI, PubMed, EHR integrations |
| Files API | Secure medical document storage |

### Model Recommendations

| Use Case | Model | Reason |
|----------|-------|--------|
| Clinical decision support | Opus 4.5 | Complex medical reasoning |
| Agent orchestration | Sonnet 4.5 | Extended autonomous operation |
| High-volume patient interactions | Haiku 4.5 | Cost-effective, fast |

### Extended Thinking

Enable for complex medical reasoning:

```typescript
const response = await anthropic.messages.create({
  model: 'claude-opus-4-5-20251101',
  thinking: { type: 'enabled', budget_tokens: 2000 },
  messages: [{ role: 'user', content: 'Analyze this patient risk...' }]
});
```

---

## Implementation Guide

### Deploying New MCP Servers

```bash
# Deploy CMS Coverage server
npx supabase functions deploy mcp-cms-coverage-server

# Deploy NPI Registry server
npx supabase functions deploy mcp-npi-registry-server

# Wait 60 seconds for propagation
sleep 60

# Verify deployment
curl https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/mcp-cms-coverage-server/health
curl https://xkybsjnvuohpqpbkikyn.supabase.co/functions/v1/mcp-npi-registry-server/health
```

### Environment Variables

Ensure these are set in `.claude/settings.local.json` (gitignored):

```json
{
  "env": {
    "VITE_SUPABASE_URL": "https://xkybsjnvuohpqpbkikyn.supabase.co",
    "SB_ANON_KEY": "<your-anon-key>"
  }
}
```

### Using in Code

```typescript
import { mcpCMSCoverage, mcpNPIRegistry } from '@/services/mcp';

// Check coverage requirements
const coverage = await mcpCMSCoverage.getCoverageRequirements({
  code: '27447',  // Total knee replacement
  state: 'TX'
});

// Validate provider NPI
const validation = await mcpNPIRegistry.validateNPI({
  npi: '1234567890'
});
```

---

## Security & Compliance

### HIPAA Safeguards

| Safeguard | Implementation |
|-----------|----------------|
| Access Control (§164.312(a)(1)) | RLS on 434/454 tables |
| Encryption (§164.312(a)(2)(iv)) | 48 encrypted PHI fields |
| Audit Controls (§164.312(b)) | 889 auditLogger calls in 94 services |
| Integrity (§164.312(c)(1)) | Tamper-resistant audit logs |
| Transmission Security (§164.312(e)(1)) | TLS 1.3, AES-256 |

### Data Handling

- **Zero PHI in Browser**: Patient IDs only, data stays server-side
- **Audit Logging**: All MCP tool calls logged via auditLogger
- **Rate Limiting**: Per-tool rate limits to prevent abuse
- **CORS**: White-label ready, accepts tenant HTTPS origins

---

## API Reference

### CMS Coverage API

```
POST /functions/v1/mcp-cms-coverage-server/call
Content-Type: application/json

{
  "name": "check_prior_auth_required",
  "arguments": {
    "cpt_code": "70553",
    "state": "TX"
  }
}
```

### NPI Registry API

```
POST /functions/v1/mcp-npi-registry-server/call
Content-Type: application/json

{
  "name": "validate_npi",
  "arguments": {
    "npi": "1234567890"
  }
}
```

---

## Roadmap

### Q1 2026

- [x] CMS Coverage MCP Server
- [x] NPI Registry MCP Server
- [ ] PubMed Literature MCP Server
- [ ] Apple Health Integration
- [ ] Android Health Connect Integration

### Q2 2026

- [ ] Files API Integration (medical documents)
- [ ] Extended Thinking for all clinical skills
- [ ] Opus 4.5 for complex decision support
- [ ] Healthcare subagent orchestration

### 2027 Federal Deadline

- [ ] HL7 FHIR Prior Authorization API compliance
- [ ] Payer-provider interoperability
- [ ] Full CMS API integration

---

## Related Documentation

| Document | Description |
|----------|-------------|
| [CLAUDE.md](../CLAUDE.md) | Development standards |
| [HIPAA_SOC2_SECURITY_AUDIT.md](./HIPAA_SOC2_SECURITY_AUDIT.md) | Security audit results |
| [FHIR_SERVICES.md](./FHIR_SERVICES.md) | FHIR implementation |
| [REFERRAL_SYSTEM.md](./REFERRAL_SYSTEM.md) | External referral system |

---

## Support

- **Methodist Hospital Demo**: `/demo-ready`
- **HIPAA Compliance Check**: `/security-scan`
- **AI Cost Analysis**: `/cost-check`

---

*Document generated by Claude Opus 4.5 - January 2026*
