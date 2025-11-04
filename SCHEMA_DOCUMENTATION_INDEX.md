# WellFit Community - Database Schema Documentation Index

## Quick Navigation

### Generated Documentation Files

1. **DATABASE_SCHEMA_REFERENCE.md** (1,617 lines)
   - Complete table-by-table reference
   - All 50+ tables documented with columns, types, and purposes
   - Complete RLS policy definitions
   - All 60+ indexes cataloged
   - FHIR resource specifications
   - Billing system details
   - Functions and triggers

2. **SCHEMA_DOCUMENTATION_INDEX.md** (this file)
   - Quick reference and navigation guide

### Source Files

- **supabase/migrations/** (202 SQL files)
  - 20250916-20251104 evolution timeline
  - Individual migration files for each feature
  
- **archive/DATABASE_MIGRATION_GUIDE.md**
  - Historical migration documentation
  - Post-migration verification steps

---

## Key Tables by Category

### Authentication & Access Control
- `profiles` - User profile + FHIR extensions
- `user_roles` - Admin role assignments
- `admin_pins` - Hashed PIN authentication
- `admin_audit_log` - Admin action audit trail

### Clinical Core
- `check_ins` - Vital signs (BP, HR, O2, glucose)
- `encounters` - Billable patient visits
- `encounter_procedures` - CPT billing codes
- `encounter_diagnoses` - ICD-10 codes
- `clinical_notes` - SOAP documentation
- `health_entries` - Wellness tracking
- `meals` - Nutrition tracking

### FHIR Resources
- `fhir_observations` - Vitals, labs (LOINC)
- `fhir_medication_requests` - Prescriptions (RxNorm)
- `fhir_conditions` - Diagnoses (SNOMED CT)
- `fhir_procedures` - Surgical procedures
- `fhir_care_plans` - Care goals + activities
- `fhir_immunizations` - Vaccine records
- `fhir_diagnostic_reports` - Lab/imaging results
- `fhir_practitioner` - Provider credentials

### Billing & Claims
- `billing_providers` - Healthcare providers (NPI, EIN)
- `billing_payers` - Insurance carriers
- `fee_schedules` - Annual billing rates
- `fee_schedule_items` - Individual code rates
- `code_cpt` - CPT code library
- `code_hcpcs` - HCPCS code library
- `code_icd10` - ICD-10 code library
- `claims` - Submitted claims
- `claim_lines` - Service lines in claims
- `claim_status_history` - Claim audit trail
- `clearinghouse_batches` - X12 claim batches
- `remittances` - 835 payer responses

### Patient Care Coordination
- `patient_readmissions` - Readmission tracking (CMS compliance)
- `care_coordination_plans` - High-risk care plans
- `handoff_packets` - Secure patient transfers
- `shift_handoff_risk_scores` - Smart shift prioritization
- `scribe_sessions` - Medical scribe transcriptions

### Community Features
- `community_moments` - Shared stories (public)
- `community_photos` - Photo sharing (public)
- `admin_notes` - Admin notes on patients

### Analytics & Risk Assessment
- `emergency_alerts` - AI emergency notifications
- `ai_risk_assessments` - Patient risk scores
- `care_recommendations` - AI recommendations
- `vitals_trends` - Vital sign analysis
- `population_insights` - Aggregate health analytics
- `predictive_outcomes` - AI outcome predictions
- `intervention_queue` - Clinical interventions

### Security & Audit (SOC 2)
- `security_events` - Security incident logging
- `audit_logs` - Comprehensive PHI audit trail

---

## Key Statistics

| Metric | Count |
|--------|-------|
| Total Tables | 50+ |
| FHIR Resources | 10 |
| Billing Tables | 16+ |
| Views | 5+ |
| Functions | 10+ |
| Indexes | 60+ |
| RLS Policies | 100+ |
| Migrations | 202 |

---

## RLS Policy Summary

### Patient Data (Read Own)
- `check_ins`, `health_entries`, `meals`
- `encounters`, `clinical_notes`
- All FHIR observation resources

### Community (Public Read)
- `community_moments`, `community_photos`
- All authenticated users can read

### Admin-Only
- `admin_notes`, `admin_profile_view_logs`
- `population_insights`, `quality_metrics`

### Code Libraries (Public Read, Admin Write)
- `code_cpt`, `code_hcpcs`, `code_icd10`, `code_modifiers`

### Billing (Admin-Centric)
- `billing_providers`, `billing_payers`
- `fee_schedules`, `fee_schedule_items`
- `claims`, `claim_lines`, `clearinghouse_batches`

### Service Role Only (No RLS)
- `user_roles`, `admin_pins`, `admin_audit_log`
- Configuration tables

---

## Performance Indexes (60+)

### Patient Lookups (10)
- `idx_check_ins_user_id`
- `idx_health_entries_user_id`
- `idx_fhir_observations_patient_id`
- `idx_ai_risk_assessments_patient_id`
- `idx_emergency_alerts_patient_id`
- And 5 more...

### Billing (12)
- `idx_encounters_patient`, `idx_encounters_status`
- `idx_claims_encounter`, `idx_claims_payer`
- `idx_fee_schedules_payer_active`
- And 7 more...

### Temporal (8)
- `idx_check_ins_created_at`
- `idx_fee_schedules_effective_date`
- `idx_fhir_observations_effective_datetime`
- And 5 more...

### Status/Filters (10)
- `idx_check_ins_emergency` (partial: WHERE is_emergency)
- `idx_emergency_alerts_severity` (partial: WHERE NOT resolved)
- `idx_handoff_risk_nurse_review` (partial: WHERE nurse_reviewed=FALSE)
- And 7 more...

---

## Compliance & Standards

### HIPAA
- PHI encrypted at application layer
- Audit trail for all PHI access
- Patient consent tracking
- Secure 72-hour expiring tokens for transfers

### SOC 2 Type II
- Security event logging
- Comprehensive audit logs
- Access control monitoring
- Security monitoring dashboard

### FHIR R4
- 10 resources fully implemented
- US Core Profile compatibility
- Standard coding systems (LOINC, SNOMED CT, RxNorm)

### Healthcare Billing
- X12 837 claim support
- X12 835 remittance processing
- CMS fee schedule compatibility
- Clearinghouse batch management

---

## Common Query Patterns

### Get Patient's Recent Vitals
```sql
SELECT * FROM check_ins 
WHERE user_id = $1 
ORDER BY created_at DESC 
LIMIT 10;
```

### Find Active Risk Assessments
```sql
SELECT * FROM ai_risk_assessments 
WHERE patient_id = $1 
AND risk_level IN ('HIGH', 'CRITICAL')
ORDER BY assessed_at DESC;
```

### Get Unresolved Alerts
```sql
SELECT * FROM emergency_alerts 
WHERE patient_id = $1 
AND resolved = false 
ORDER BY severity DESC;
```

### Retrieve Encounter with Billing
```sql
SELECT e.*, 
       array_agg(ep.code) as procedures,
       array_agg(ed.code) as diagnoses
FROM encounters e
LEFT JOIN encounter_procedures ep ON e.id = ep.encounter_id
LEFT JOIN encounter_diagnoses ed ON e.id = ed.encounter_id
WHERE e.patient_id = $1
GROUP BY e.id;
```

### Claims Processing Status
```sql
SELECT c.id, c.control_number, c.status, 
       count(cl.id) as line_count,
       sum(cl.charge_amount) as total
FROM claims c
LEFT JOIN claim_lines cl ON c.id = cl.claim_id
WHERE c.payer_id = $1
GROUP BY c.id
ORDER BY c.created_at DESC;
```

---

## Trigger Functions

### `set_updated_at()`
- Maintains `updated_at` on 25+ tables
- Called BEFORE UPDATE
- Sets `NEW.updated_at := now()`

### `update_updated_at_column()`
- Alternative implementation
- Same functionality

---

## Sequences (EDI Control Numbers)

1. `handoff_packet_seq` - Packet numbers (HO-YYYYMMDD-######)
2. `x12_isa_seq` - ISA interchange control
3. `x12_gs_seq` - GS group control
4. `x12_st_seq` - ST transaction set control

---

## Extension Points

### Future Analytics
- Materialized views for dashboards
- Time-series aggregation tables
- Population health metrics

### Clinical Workflows
- Order management system
- Lab result automation
- Medication interaction checking

### Integrations
- HL7 v2 message support
- Third-party EHR connectors
- Payer API bridges

### Data Quality
- Validation rules engine
- Quality monitoring dashboard
- Master data management

### Advanced Security
- Field-level encryption
- Tokenization service
- Anomaly detection

---

## Documentation Files Location

```
/workspaces/WellFit-Community-Daily-Complete/
├── DATABASE_SCHEMA_REFERENCE.md          (Complete reference - 1,617 lines)
├── SCHEMA_DOCUMENTATION_INDEX.md         (This file)
├── archive/
│   └── DATABASE_MIGRATION_GUIDE.md       (Migration overview)
├── supabase/
│   └── migrations/                       (202 SQL files)
└── src/
    └── services/                         (FHIR implementation)
```

---

## Quick Links

- Full Schema Reference: `DATABASE_SCHEMA_REFERENCE.md`
- Migration History: `supabase/migrations/`
- FHIR Services: `src/services/fhir/`
- Billing Services: `src/services/billing/`

---

## Generated: 2025-11-04
## Last Updated: 2025-11-04
## Database: Supabase PostgreSQL
## Status: Production Ready
