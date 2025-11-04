# WellFit Community - Comprehensive Database Schema Reference

**Last Updated:** 2025-11-04  
**Total Migrations:** 202 active SQL migration files  
**Git Status:** Main branch clean  
**Database:** Supabase PostgreSQL

---

## TABLE OF CONTENTS

1. [Overview](#overview)
2. [Authentication & Access Control](#authentication--access-control)
3. [User & Profile Management](#user--profile-management)
4. [Clinical Core Tables](#clinical-core-tables)
5. [FHIR Resources](#fhir-resources)
6. [Billing & Claims](#billing--claims)
7. [Patient Care Coordination](#patient-care-coordination)
8. [Community Features](#community-features)
9. [Analytics & Risk Assessment](#analytics--risk-assessment)
10. [Security & Audit](#security--audit)
11. [Views & Materialized Views](#views--materialized-views)
12. [Database Functions](#database-functions)
13. [Indexes & Performance](#indexes--performance)
14. [RLS Policies Summary](#rls-policies-summary)

---

## OVERVIEW

### Key Statistics
- **Active Tables:** 50+
- **Views:** 5+ (security monitoring, engagement, handoff)
- **Functions:** 10+ custom database functions
- **FHIR Resources Supported:** 10 (Observations, Medications, Conditions, Procedures, Care Plans, etc.)
- **Billing Tables:** 16+ (claims, fee schedules, provider management)
- **Encryption:** PHI encrypted at application layer (edge functions)

### Architecture Patterns
- **Multi-tenant Support:** Tenant isolation via RLS policies
- **Audit Logging:** Comprehensive SOC 2 compliance tracking
- **Event-Driven:** Triggers for `updated_at` timestamps
- **Performance:** Composite indexes on common query patterns
- **Security:** Row Level Security (RLS) enabled on sensitive tables

---

## AUTHENTICATION & ACCESS CONTROL

### Table: `public.profiles`
**Purpose:** Core user profile information, extended for FHIR requirements

| Column | Type | Notes |
|--------|------|-------|
| user_id | UUID (PK) | References `auth.users(id)` |
| phone | TEXT | Unique phone number |
| phone_verified | BOOLEAN | SMS verification status |
| email_verified | BOOLEAN | Email verification status |
| verified_at | TIMESTAMPTZ | When user completed verification |
| force_password_change | BOOLEAN | Security flag |
| consent | BOOLEAN | General consent to terms |
| demographics_complete | BOOLEAN | Onboarding step completion |
| onboarded | BOOLEAN | Full registration complete |
| first_name | TEXT | FHIR-required field |
| last_name | TEXT | FHIR-required field |
| email | TEXT | User email |
| dob | DATE | Date of birth |
| address | TEXT | Patient address |
| caregiver_email | TEXT | Emergency contact |
| emergency_contact_name | TEXT | Emergency contact name |
| role | TEXT | User role (senior, healthcare_provider, admin, etc.) |
| role_code | INTEGER | Numeric role identifier |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last updated (trigger-maintained) |

**RLS Policies:**
- SELECT: Users can view own profile (`user_id = auth.uid()`)
- UPDATE: Users can update own profile (`user_id = auth.uid()`)
- Admins: Full access via admin bypass

**Indexes:**
- `idx_profiles_phone` - Phone number lookups
- `idx_profiles_role` - Role-based queries
- `idx_profiles_role_code` - Role code filtering

---

### Table: `public.user_roles`
**Purpose:** Source of truth for admin/super_admin role assignments

| Column | Type | Notes |
|--------|------|-------|
| user_id | UUID (FK) | References `auth.users(id)` |
| role | TEXT | 'admin' or 'super_admin' |
| created_at | TIMESTAMPTZ | Role assignment date |

**Composite PK:** `(user_id, role)`

**RLS Policies:**
- SELECT: Users can view their own roles (`user_id = auth.uid()`)
- INSERT/UPDATE: Service role only (no RLS policy)

---

### Table: `public.admin_pins`
**Purpose:** Hashed PIN storage for admin authentication, per role

| Column | Type | Notes |
|--------|------|-------|
| user_id | UUID (FK) | References `auth.users(id)` |
| role | TEXT | 'admin' or 'super_admin' |
| pin_hash | TEXT | Bcrypt-hashed PIN (never stored plain) |
| updated_at | TIMESTAMPTZ | Last PIN update |
| updated_by_ip | TEXT | IP address of PIN update |

**Composite PK:** `(user_id, role)`

**RLS:** No policies - service role access only (bypasses RLS)

**Indexes:**
- `idx_admin_pins_user_role` - User/role lookups

---

### Table: `public.admin_audit_log`
**Purpose:** Audit trail of all admin PIN changes and sensitive actions

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL (PK) | Auto-incrementing |
| user_id | UUID (FK) | Admin who performed action |
| action | TEXT | Action description |
| target_role | TEXT | Role being modified |
| ip_address | TEXT | Source IP |
| user_agent | TEXT | Browser/client info |
| metadata | JSONB | Additional context |
| timestamp | TIMESTAMPTZ | When action occurred |

**RLS:** No policies - admin access via RPC only

---

## USER & PROFILE MANAGEMENT

### Table: `public.appointment_reminders`
**Purpose:** Twilio SMS/call reminders for appointments

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL (PK) | |
| patient_phone | TEXT | Patient phone number |
| patient_name | TEXT | Patient name |
| appointment_date | TEXT | Date of appointment |
| appointment_time | TEXT | Time of appointment |
| provider_name | TEXT | Provider name |
| location | TEXT | Appointment location |
| message_sent | TEXT | Message content sent |
| twilio_sid | TEXT | Twilio message SID |
| sent_by | UUID (FK) | Staff member who sent reminder |
| sent_at | TIMESTAMPTZ | When reminder was sent |

**RLS Policies:**
- SELECT: Users can view reminders they sent (`sent_by = auth.uid()`)

**Indexes:**
- `idx_reminders_phone` - Phone number lookups
- `idx_reminders_sent_by` - Sender tracking

---

## CLINICAL CORE TABLES

### Table: `public.check_ins` (Vital Signs)
**Purpose:** Patient vital sign check-ins and health assessments

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL (PK) | |
| user_id | UUID (FK) | Patient reference |
| is_emergency | BOOLEAN | Emergency flag |
| label | TEXT | Check-in label/name |
| notes | TEXT | Provider notes |
| mood | TEXT | Patient mood (optional) |
| activity_level | TEXT | Activity level (optional) |
| heart_rate | INTEGER | BPM (50-300) |
| pulse_oximeter | INTEGER | O2 sat % (0-100) |
| bp_systolic | INTEGER | BP systolic (0-300) |
| bp_diastolic | INTEGER | BP diastolic (0-200) |
| glucose_mg_dl | INTEGER | Glucose level (0-1000) |
| created_at | TIMESTAMPTZ | |

**RLS Policies:**
- SELECT: Patient own data; Admins all data
- INSERT: Patient own data; Admins all data
- Admin full access

**Indexes:**
- `idx_check_ins_user_id` - Patient lookups
- `idx_check_ins_created_at` - Time-based queries
- `idx_check_ins_emergency` - Emergency flag filtering

---

### Table: `public.encounters`
**Purpose:** Patient visits/sessions that can be billed to insurance

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| patient_id | UUID (FK) | Patient reference (auth.users) |
| provider_id | UUID (FK) | Provider reference |
| payer_id | UUID (FK) | Insurance payer |
| date_of_service | DATE | When service provided |
| place_of_service | TEXT | Default '11' (office) |
| claim_frequency_code | TEXT | Default '1' (original claim) |
| subscriber_relation_code | TEXT | Default '18' (self) |
| status | TEXT | 'draft', 'ready', 'submitted', 'paid', 'denied' |
| notes | TEXT | Encounter notes |
| created_by | UUID (FK) | User who created encounter |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Composite Relationships:**
- Links to `encounter_procedures` (CPT codes)
- Links to `encounter_diagnoses` (ICD-10 codes)
- Links to `clinical_notes` (SOAP notes)

**RLS Policies:**
- Admin/provider/patient read-write (via `is_admin()` function)

**Indexes:**
- `idx_encounters_patient` - Patient lookups
- `idx_encounters_provider` - Provider lookups
- `idx_encounters_service_date` - Date range queries
- `idx_encounters_status` - Status filtering

---

### Table: `public.encounter_procedures`
**Purpose:** CPT procedure codes for billing within encounters

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| encounter_id | UUID (FK) | Parent encounter |
| code | TEXT | CPT code (e.g., '99213') |
| charge_amount | NUMERIC(12,2) | Billed amount |
| units | NUMERIC(12,2) | Number of units |
| modifiers | TEXT[] | CPT modifiers |
| service_date | DATE | Date service provided |
| diagnosis_pointers | INTEGER[] | Links to diagnosis codes |
| description | TEXT | Code description |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes:**
- `idx_encounter_procedures_encounter` - Encounter lookups
- `idx_encounter_procedures_code` - Code lookups

---

### Table: `public.encounter_diagnoses`
**Purpose:** ICD-10 diagnosis codes for encounters

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| encounter_id | UUID (FK) | Parent encounter |
| code | TEXT | ICD-10 code (e.g., 'I10') |
| sequence | INTEGER | Diagnosis sequence (primary=1) |
| description | TEXT | Code description |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes:**
- `idx_encounter_diagnoses_encounter` - Encounter lookups
- `idx_encounter_diagnoses_code` - Code lookups

---

### Table: `public.clinical_notes`
**Purpose:** SOAP notes and clinical documentation for encounters

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| encounter_id | UUID (FK) | Parent encounter |
| type | TEXT | 'assessment', 'plan', 'subjective', 'objective', 'general', 'hpi', 'ros' |
| content | TEXT | Note content |
| author_id | UUID (FK) | Provider who wrote note |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes:**
- `idx_clinical_notes_encounter` - Encounter lookups
- `idx_clinical_notes_type` - Note type filtering
- `idx_clinical_notes_author` - Author tracking

---

### Table: `public.health_entries`
**Purpose:** Wellness and mood tracking entries

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL (PK) | |
| user_id | UUID (FK) | Patient reference |
| entry_type | TEXT | Type of health entry |
| data | JSONB | Flexible data storage |
| created_at | TIMESTAMPTZ | |

**RLS Policies:**
- SELECT/INSERT: Patient own data
- Admin: Full access

**Indexes:**
- `idx_health_entries_user_id` - Patient lookups
- `idx_health_entries_created_at` - Time-based queries
- `idx_health_entries_type` - Entry type filtering

---

### Table: `public.meals`
**Purpose:** Meal logging and nutrition tracking

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL (PK) | |
| user_id | UUID (FK) | Patient reference |
| meal_type | TEXT | breakfast, lunch, dinner, snack |
| description | TEXT | Meal description |
| image_url | TEXT | Photo of meal |
| created_at | TIMESTAMPTZ | |

**RLS Policies:**
- SELECT/INSERT: Patient own data

**Indexes:**
- `idx_meals_user_id` - Patient lookups
- `idx_meals_created_at` - Time-based queries

---

## FHIR RESOURCES

### Table: `public.fhir_observations`
**Purpose:** FHIR R4 Observation Resource (vitals, labs, clinical observations)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| fhir_id | TEXT (UNIQUE) | FHIR canonical ID |
| status | TEXT | 'registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown' |
| category | TEXT[] | 'vital-signs', 'laboratory', 'social-history', etc. |
| category_coding_system | TEXT[] | FHIR coding system URLs |
| code_system | TEXT | Default 'http://loinc.org' |
| code | TEXT | LOINC code (e.g., '8480-6' for systolic BP) |
| code_display | TEXT | Human-readable code name |
| code_text | TEXT | Additional code text |
| patient_id | UUID (FK) | Patient reference |
| encounter_id | UUID (FK) | Associated encounter |
| effective_datetime | TIMESTAMPTZ | When observation made |
| effective_period_start | TIMESTAMPTZ | Period start |
| effective_period_end | TIMESTAMPTZ | Period end |
| issued | TIMESTAMPTZ | Result availability timestamp |
| performer_type | TEXT[] | Performer resource types |
| performer_id | TEXT[] | Performer IDs |
| performer_display | TEXT[] | Performer names |
| value_quantity_value | DECIMAL(10,3) | Numeric value |
| value_quantity_unit | TEXT | Unit (mg, mL, etc.) |
| value_quantity_code | TEXT | UCUM code |
| value_quantity_system | TEXT | Default 'http://unitsofmeasure.org' |
| value_codeable_concept_code | TEXT | Coded value |
| value_codeable_concept_display | TEXT | Coded value display |
| value_codeable_concept_system | TEXT | Coding system |
| value_string | TEXT | String value |
| value_boolean | BOOLEAN | Boolean value |
| value_integer | INTEGER | Integer value |
| value_range_low | DECIMAL(10,3) | Range low |
| value_range_high | DECIMAL(10,3) | Range high |
| value_ratio_numerator | DECIMAL(10,3) | Ratio numerator |
| value_ratio_denominator | DECIMAL(10,3) | Ratio denominator |
| value_sampled_data | JSONB | Complex data |
| value_time | TIME | Time value |
| value_datetime | TIMESTAMPTZ | DateTime value |
| value_period_start | TIMESTAMPTZ | Period start |
| value_period_end | TIMESTAMPTZ | Period end |
| data_absent_reason_code | TEXT | Why no value |
| data_absent_reason_display | TEXT | Absence description |
| interpretation_code | TEXT[] | 'normal', 'abnormal', 'critical' |
| interpretation_display | TEXT[] | Interpretation names |
| interpretation_system | TEXT[] | Interpretation coding system |
| note | TEXT | Comments |
| body_site_code | TEXT | SNOMED CT body site |
| body_site_display | TEXT | Body site name |
| body_site_system | TEXT | Default 'http://snomed.info/sct' |
| method_code | TEXT | Measurement method |
| method_display | TEXT | Method description |
| method_system | TEXT | Method coding system |
| specimen_id | TEXT | Associated specimen |
| specimen_display | TEXT | Specimen description |
| reference_range_low | DECIMAL(10,3) | Normal range low |
| reference_range_high | DECIMAL(10,3) | Normal range high |
| reference_range_text | TEXT | Range description |
| related_type | TEXT | 'has-member', 'sequelto', 'derived-from' |
| related_target_id | UUID | Related observation ID |
| component_code_system | TEXT | Component code system |
| component_code | TEXT | Component code |
| component_value | TEXT | Component value |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**RLS Policies:**
- SELECT: Patient own data; Admins all
- Admin: Full access

**Indexes:**
- `idx_fhir_observations_patient_id` - Patient lookups
- `idx_fhir_observations_code` - Code filtering
- `idx_fhir_observations_effective_datetime` - Date range queries
- `idx_fhir_observations_category` - Category filtering

---

### Table: `public.fhir_medication_requests`
**Purpose:** FHIR R4 MedicationRequest Resource (prescriptions, refills)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| fhir_id | TEXT (UNIQUE) | FHIR canonical ID |
| status | TEXT | 'active', 'on-hold', 'cancelled', 'completed', 'entered-in-error', 'stopped', 'draft', 'unknown' |
| intent | TEXT | 'proposal', 'plan', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order', 'option' |
| patient_id | UUID (FK) | Patient reference |
| medication_code_system | TEXT | RxNorm, NDC, SNOMED CT |
| medication_code | TEXT | Medication code |
| medication_display | TEXT | Medication name (e.g., "Lisinopril 10mg tablet") |
| medication_text | TEXT | Free text medication name |
| dosage_text | TEXT | Human-readable dosage |
| dosage_timing_frequency | INTEGER | Times per period |
| dosage_timing_period | DECIMAL | Period value |
| dosage_timing_period_unit | TEXT | 's', 'min', 'h', 'd', 'wk', 'mo', 'a' |
| dosage_route_code | TEXT | SNOMED CT route code |
| dosage_route_display | TEXT | e.g., "Oral", "Intravenous" |
| dosage_dose_quantity | DECIMAL | Dose amount |
| dosage_dose_unit | TEXT | e.g., "mg", "mL", "tablet" |
| dosage_dose_code | TEXT | UCUM code |
| dosage_additional_instruction | TEXT[] | Additional instructions |
| dosage_patient_instruction | TEXT | Patient instructions |
| dosage_as_needed_boolean | BOOLEAN | PRN indicator |
| dosage_as_needed_reason | TEXT | Reason for PRN |
| dispense_quantity | DECIMAL | Number of pills/doses |
| dispense_unit | TEXT | Unit of dispense |
| dispense_expected_supply_duration | DECIMAL | Supply duration value |
| dispense_expected_supply_duration_unit | TEXT | Duration unit |
| number_of_repeats_allowed | INTEGER | Refills allowed |
| validity_period_start | TIMESTAMPTZ | Prescription valid from |
| validity_period_end | TIMESTAMPTZ | Prescription valid to |
| authored_on | TIMESTAMPTZ | Prescription date |
| requester_type | TEXT | 'Practitioner', 'PractitionerRole', 'Organization', 'Patient', 'RelatedPerson', 'Device' |
| requester_id | UUID | Prescriber ID |
| requester_display | TEXT | Prescriber name |
| performer_type | TEXT | Dispenser type |
| performer_id | UUID | Dispenser ID |
| performer_display | TEXT | Dispenser name |
| reason_code | TEXT[] | ICD-10, SNOMED CT codes |
| reason_reference | UUID[] | Condition reference IDs |
| priority | TEXT | 'routine', 'urgent', 'asap', 'stat' |
| category | TEXT[] | 'inpatient', 'outpatient', 'community', 'discharge' |
| note | TEXT | Additional notes |
| substitution_allowed | BOOLEAN | Generic substitution allowed |
| substitution_reason_code | TEXT | Substitution reason |
| prior_prescription_id | UUID (FK) | Previous prescription |
| based_on_type | TEXT | Type of supporting document |
| based_on_id | UUID | Supporting document ID |
| reported_boolean | BOOLEAN | Patient reported indicator |
| reported_reference_type | TEXT | Reporter type |
| reported_reference_id | UUID | Reporter ID |
| encounter_id | UUID (FK) | Associated encounter |

**Indexes:**
- `idx_fhir_medication_requests_patient_id` - Patient lookups
- `idx_fhir_medication_requests_status` - Status filtering
- `idx_fhir_medication_requests_authored_on` - Date range queries

---

### Table: `public.fhir_conditions`
**Purpose:** FHIR R4 Condition Resource (diagnosis, problems)

**Key Columns:**
- `id` (UUID PK)
- `fhir_id` (TEXT UNIQUE)
- `clinical_status` - 'active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved'
- `verification_status` - 'unconfirmed', 'provisional', 'differential', 'confirmed', 'refuted', 'entered-in-error'
- `category` (TEXT[]) - 'problem-list-item', 'encounter-diagnosis', 'health-concern'
- `severity_code` - 'mild', 'moderate', 'severe'
- `code_system`, `code`, `code_display` - SNOMED CT preferred
- `patient_id` (UUID FK)
- `subject_reference` - Full subject reference
- `onset_datetime` - When condition started
- `abatement_datetime` - When condition resolved
- `recorded_date` - When recorded in system
- `recorder_id`, `recorder_display` - Who recorded
- `asserter_id`, `asserter_display` - Who asserted
- `stage_summary`, `stage_assessment` - Disease stage
- `note` - Additional notes
- `created_at`, `updated_at`

---

### Table: `public.fhir_care_plans`
**Purpose:** FHIR R4 CarePlan Resource (personalized care plans)

**Key Columns:**
- `id` (UUID PK)
- `fhir_id` (TEXT UNIQUE)
- `status` - 'draft', 'active', 'on-hold', 'revoked', 'completed', 'entered-in-error', 'unknown'
- `intent` - 'proposal', 'plan', 'order', 'option'
- `category` (TEXT[]) - 'assessment-plan', 'treatment', 'discharge-planning'
- `patient_id` (UUID FK)
- `encounter_id` (UUID FK)
- `created_date` - When plan created
- `period_start`, `period_end` - Plan period
- `custodian_id`, `custodian_display` - Responsible provider
- `care_team` (JSONB) - Team members
- `addresses` (TEXT[]) - Referenced conditions
- `goals` (JSONB) - Care goals
- `activity` (JSONB) - Planned activities

---

### Table: `public.fhir_procedures`
**Purpose:** FHIR R4 Procedure Resource (procedures, treatments)

**Key Columns:**
- `id` (UUID PK)
- `fhir_id` (TEXT UNIQUE)
- `status` - 'preparation', 'in-progress', 'not-done', 'on-hold', 'stopped', 'completed', 'entered-in-error', 'unknown'
- `status_reason_code` - Why procedure not done
- `category_code` - SNOMED CT category
- `code_system`, `code`, `code_display` - SNOMED CT procedure code
- `patient_id` (UUID FK)
- `encounter_id` (UUID FK)
- `performed_datetime` - When procedure performed
- `performed_period_start`, `performed_period_end` - Procedure period
- `performer_actor_id`, `performer_actor_display` - Who performed
- `performer_onbehalfof_id` - On behalf of organization
- `performer_function_code` - Function in procedure
- `reason_code` (TEXT[]) - Why procedure performed
- `reason_reference` (UUID[]) - Reference to conditions
- `body_site` (JSONB) - Body site information
- `outcome_code` - Procedure outcome
- `complication` (TEXT[]) - Complications
- `complication_detail` (JSONB) - Complication details
- `used_reference` (JSONB) - Items used
- `notes` - Notes about procedure

---

### Table: `public.fhir_immunizations`
**Purpose:** FHIR R4 Immunization Resource (vaccines, vaccinations)

**Key Columns:**
- `id` (UUID PK)
- `fhir_id` (TEXT UNIQUE)
- `status` - 'completed', 'entered-in-error', 'not-done'
- `status_reason_code` - Why not done
- `vaccine_code_system`, `vaccine_code`, `vaccine_display` - Vaccine code
- `patient_id` (UUID FK)
- `encounter_id` (UUID FK)
- `occurrence_datetime` - When vaccine given
- `primary_source` - Whether from primary source
- `report_origin_code` - Where report originated
- `manufacturer_id`, `manufacturer_display` - Vaccine manufacturer
- `lot_number` - Vaccine lot number
- `expiration_date` - Vaccine expiration
- `site_code`, `site_display` - Body site (arm, etc.)
- `route_code`, `route_display` - Route (IM, oral, etc.)
- `dose_quantity` - Dose amount
- `performer_actor_id`, `performer_actor_display` - Who administered
- `reason_code` (TEXT[]) - Reason for vaccination
- `note` - Notes

---

### Table: `public.fhir_practitioner`
**Purpose:** FHIR R4 Practitioner Resource (healthcare providers)

**Key Columns:**
- `id` (UUID PK)
- `fhir_id` (TEXT UNIQUE)
- `active` (BOOLEAN) - Whether practitioner active
- `name_use` - 'usual', 'official', 'temp', 'nickname', 'anonymous', 'old', 'maiden'
- `family_name` - Last name
- `given_name` (TEXT[]) - First/middle names
- `prefix_name` (TEXT[]) - Prefixes (Dr., etc.)
- `suffix_name` (TEXT[]) - Suffixes (Jr., etc.)
- `telecom_system` (TEXT[]) - 'phone', 'fax', 'email', 'pager', 'url', 'sms', 'other'
- `telecom_value` (TEXT[]) - Contact values
- `telecom_use` (TEXT[]) - 'home', 'work', 'temp', 'old', 'mobile'
- `address_use` (TEXT[])
- `address_type` (TEXT[]) - 'physical', 'postal', 'both'
- `address_line` (TEXT[])
- `city` (TEXT[])
- `postal_code` (TEXT[])
- `country` (TEXT[])
- `gender` - 'male', 'female', 'other', 'unknown'
- `birthdate` - Date of birth
- `communication` (JSONB) - Languages spoken
- `qualification` (JSONB) - Credentials and qualifications
  - code, issuer, period, identifier
- `identifier` (JSONB) - Professional identifiers
  - NPI, DEA, state license, etc.

---

## BILLING & CLAIMS

### Table: `public.billing_providers`
**Purpose:** Healthcare provider/practitioner billing information

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| user_id | UUID (FK) | Associated user account |
| npi | VARCHAR(10) (UNIQUE) | National Provider Identifier |
| taxonomy_code | VARCHAR(10) | Provider taxonomy code |
| organization_name | TEXT | Provider/group name |
| ein | VARCHAR(10) | Employer ID Number |
| submitter_id | TEXT | X12 submitter ID |
| contact_phone | TEXT | Provider phone |
| address_line1 | TEXT | Office address |
| city | TEXT | Office city |
| state | TEXT | Office state |
| zip | TEXT | Office zip code |
| created_by | UUID (FK) | User who created record |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**RLS Policies:**
- Admin/Creator read-write; others read

**Indexes:**
- `idx_billing_providers_user` - User lookups

---

### Table: `public.billing_payers`
**Purpose:** Insurance payer/carrier information

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| name | TEXT | Payer name (e.g., 'Blue Cross Blue Shield') |
| payer_id | TEXT | Payer-assigned ID |
| receiver_id | TEXT | X12 receiver ID |
| clearinghouse_id | TEXT | Clearinghouse ISA receiver |
| notes | TEXT | Additional notes |
| created_by | UUID (FK) | User who created |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**RLS Policies:**
- Admin/Creator read-write

**Indexes:**
- `idx_billing_payers_name` - Payer name lookups

---

### Table: `public.fee_schedules`
**Purpose:** Annual fee schedules for billing (Medicare, Medicaid, etc.)

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| name | TEXT | Schedule name (e.g., 'Medicare 2025 National Average') |
| payer_type | TEXT | 'medicare', 'medicaid', 'commercial', 'self_pay' |
| effective_date | DATE | When rates become effective |
| end_date | DATE | When rates expire |
| is_active | BOOLEAN | Current active schedule |
| locality | TEXT | Medicare locality adjustment (if applicable) |
| notes | TEXT | Notes about schedule |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |
| created_by | UUID (FK) | Admin who created |

**UNIQUE:** `(payer_type, effective_date, locality)`

**RLS Policies:**
- Admins: Full access
- Providers: Read active only

**Indexes:**
- `idx_fee_schedules_payer_active` - Active schedule lookups
- `idx_fee_schedules_effective_date` - Date-based queries

---

### Table: `public.fee_schedule_items`
**Purpose:** Individual code rates within fee schedules

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| fee_schedule_id | UUID (FK) | Parent schedule |
| code_system | TEXT | 'CPT' or 'HCPCS' |
| code | TEXT | Procedure code |
| modifier1 | TEXT | CPT modifier 1 |
| modifier2 | TEXT | CPT modifier 2 |
| modifier3 | TEXT | CPT modifier 3 |
| modifier4 | TEXT | CPT modifier 4 |
| price | NUMERIC(12,2) | Reimbursement rate |
| unit | TEXT | Default 'UN' (unit) |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**UNIQUE:** `(fee_schedule_id, code_system, code, modifier1, modifier2, modifier3, modifier4)`

**RLS Policies:**
- Admins: Read-write
- All authenticated: Read

**Indexes:**
- `idx_fsi_fee_schedule` - Schedule lookups
- `idx_fsi_code` - Code lookups

---

### Table: `public.code_cpt`
**Purpose:** CPT procedure code reference library

| Column | Type | Notes |
|--------|------|-------|
| code | TEXT (PK) | CPT code (e.g., '99213') |
| short_desc | TEXT | Short description |
| long_desc | TEXT | Full description |
| status | TEXT | 'active' or 'inactive' |
| effective_from | DATE | When code became effective |
| effective_to | DATE | When code retired |

**RLS Policies:**
- All: Read
- Admins: Write

---

### Table: `public.code_hcpcs`
**Purpose:** HCPCS code reference library

| Column | Type | Notes |
|--------|------|-------|
| code | TEXT (PK) | HCPCS code |
| desc | TEXT | Description |
| status | TEXT | 'active' or 'inactive' |
| effective_from | DATE | Effective date |
| effective_to | DATE | Retirement date |

**RLS Policies:**
- All: Read
- Admins: Write

---

### Table: `public.code_icd10`
**Purpose:** ICD-10 diagnosis code reference library

| Column | Type | Notes |
|--------|------|-------|
| code | TEXT (PK) | ICD-10 code (no dot) |
| desc | TEXT | Description |
| chapter | TEXT | ICD-10 chapter |
| billable | BOOLEAN | Whether billable code |
| status | TEXT | 'active' or 'inactive' |
| effective_from | DATE | Effective date |
| effective_to | DATE | Retirement date |

**RLS Policies:**
- All: Read
- Admins: Write

**Indexes:**
- `idx_icd10_status` - Status filtering

---

### Table: `public.claims`
**Purpose:** Healthcare claims submitted to payers

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| encounter_id | UUID (FK) | Associated encounter |
| payer_id | UUID (FK) | Payer/insurance |
| billing_provider_id | UUID (FK) | Submitting provider |
| claim_type | TEXT | Default '837P' (professional) |
| status | TEXT | 'generated', 'submitted', 'accepted', 'rejected', 'paid', 'void' |
| control_number | TEXT | ST02 control number |
| segment_count | INTEGER | Number of segments in X12 |
| total_charge | NUMERIC(12,2) | Total billed amount |
| x12_content | TEXT | Raw outbound X12 claim |
| response_payload | TEXT | Payer/clearinghouse response |
| created_by | UUID (FK) | User who created claim |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Composite Relationships:**
- Links to `claim_lines` (service lines)
- Links to `claim_attachments` (supporting docs)
- Links to `claim_status_history` (status changes)

**RLS Policies:**
- Admin/Creator: Read-write
- Patient: Read own claims

**Indexes:**
- `idx_claims_encounter` - Encounter lookups
- `idx_claims_payer` - Payer lookups
- `idx_claims_status` - Status filtering

---

### Table: `public.claim_lines`
**Purpose:** Service lines within claims

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| claim_id | UUID (FK) | Parent claim |
| code_system | TEXT | 'CPT' or 'HCPCS' |
| procedure_code | TEXT | Service code |
| modifiers | TEXT[] | Modifiers |
| units | NUMERIC(12,2) | Service units |
| charge_amount | NUMERIC(12,2) | Line charge |
| diagnosis_pointers | INTEGER[] | Links to diagnosis codes |
| service_date | DATE | Service date |
| position | INTEGER | Line X position |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes:**
- `idx_cl_claim` - Claim lookups

---

### Table: `public.claim_status_history`
**Purpose:** Audit trail of claim status changes

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| claim_id | UUID (FK) | Associated claim |
| from_status | TEXT | Previous status |
| to_status | TEXT | New status |
| note | TEXT | Change notes |
| payload | JSONB | Additional data |
| created_by | UUID (FK) | User who made change |
| created_at | TIMESTAMPTZ | |

**Indexes:**
- `idx_csh_claim` - Claim lookups

---

### Table: `public.claim_attachments`
**Purpose:** Supporting documentation for claims

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| claim_id | UUID (FK) | Associated claim |
| doc_type | TEXT | 'PWK', 'medical_record', etc. |
| storage_path | TEXT | Supabase Storage or external URL |
| note | TEXT | Document notes |
| created_by | UUID (FK) | User who uploaded |
| created_at | TIMESTAMPTZ | |

**Indexes:**
- `idx_ca_claim` - Claim lookups

---

### Table: `public.clearinghouse_batches`
**Purpose:** X12 claim batches sent to clearinghouses

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| batch_ref | TEXT (UNIQUE) | Batch reference number |
| status | TEXT | 'created', 'submitted', 'acknowledged', 'rejected', 'completed' |
| file_content | TEXT | Raw X12 837 file |
| response_payload | TEXT | Clearinghouse response |
| submitted_at | TIMESTAMPTZ | When batch submitted |
| created_by | UUID (FK) | User who created |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes:**
- `idx_chb_status` - Status filtering

---

### Table: `public.clearinghouse_batch_items`
**Purpose:** Individual claims within clearinghouse batches

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| batch_id | UUID (FK) | Parent batch |
| claim_id | UUID (FK) | Claim in batch |
| st_control_number | TEXT | ST02 control number |
| status | TEXT | 'queued', 'sent', 'ack', 'err' |
| note | TEXT | Status note |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**UNIQUE:** `(batch_id, claim_id)`

**Indexes:**
- `idx_chbi_batch` - Batch lookups
- `idx_chbi_claim` - Claim lookups

---

### Table: `public.remittances`
**Purpose:** 835 remittance advice files from payers

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| payer_id | UUID (FK) | Payer who sent remittance |
| received_at | TIMESTAMPTZ | When received |
| file_content | TEXT | Raw 835 file content |
| summary | JSONB | Parsed summary data |
| details | JSONB | Parsed line details |
| created_by | UUID (FK) | User who processed |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes:**
- `idx_remit_payer` - Payer lookups

---

## PATIENT CARE COORDINATION

### Table: `public.patient_readmissions`
**Purpose:** Frequent flyer readmission tracking for CMS compliance

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| patient_id | UUID (FK) | Patient reference |
| admission_date | TIMESTAMPTZ | Admission date/time |
| discharge_date | TIMESTAMPTZ | Discharge date/time |
| facility_name | TEXT | Hospital/facility name |
| facility_type | TEXT | 'er', 'hospital', 'urgent_care', 'observation' |
| is_readmission | BOOLEAN | Whether readmission event |
| days_since_last_discharge | INTEGER | Days since previous discharge |
| previous_admission_id | UUID (FK) | Link to prior admission |
| readmission_category | TEXT | '7_day', '30_day', '90_day', 'none' |
| primary_diagnosis_code | TEXT | ICD-10 code |
| primary_diagnosis_description | TEXT | Diagnosis description |
| secondary_diagnoses | JSONB | Array of additional diagnoses |
| risk_score | INTEGER | 0-100 risk score |
| follow_up_scheduled | BOOLEAN | FU appointment scheduled |
| follow_up_completed | BOOLEAN | FU completed |
| follow_up_date | DATE | Scheduled FU date |
| care_plan_created | BOOLEAN | Care plan exists |
| care_team_notified | BOOLEAN | Team notified |
| high_utilizer_flag | BOOLEAN | Frequent visitor flag |
| created_by | UUID (FK) | User who created |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**RLS Policies:**
- Admin: Full access
- Patient: Read own

**Indexes:**
- `idx_patient_readmissions_patient` - Patient lookups
- `idx_patient_readmissions_admission` - Admission date queries
- `idx_patient_readmissions_is_readmission` - Readmission filtering
- `idx_patient_readmissions_high_utilizer` - High-risk filtering

---

### Table: `public.care_coordination_plans`
**Purpose:** Personalized care plans for high-risk patients

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| patient_id | UUID (FK) | Patient reference |
| plan_type | TEXT | 'readmission_prevention', 'chronic_care', 'transitional_care', 'high_utilizer' |
| status | TEXT | 'draft', 'active', 'completed', 'discontinued' |
| priority | TEXT | 'low', 'medium', 'high', 'critical' |
| title | TEXT | Plan title |
| goals | JSONB | Array of care goals |
| interventions | JSONB | Array of planned interventions |
| barriers | JSONB | Identified barriers to care |
| patient_preferences | JSONB | Patient wishes/preferences |
| responsible_providers | TEXT[] | Provider IDs/names |
| created_date | TIMESTAMPTZ | Plan creation date |
| plan_period_start | TIMESTAMPTZ | Plan effective date |
| plan_period_end | TIMESTAMPTZ | Plan end date |
| created_by | UUID (FK) | Creating provider |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

---

### Table: `public.handoff_packets`
**Purpose:** HIPAA-compliant patient transfer packets between facilities

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| packet_number | TEXT (UNIQUE) | HO-YYYYMMDD-######  |
| patient_mrn | TEXT | Medical record number |
| patient_name_encrypted | TEXT | Encrypted patient name |
| patient_dob_encrypted | TEXT | Encrypted DOB |
| patient_gender | TEXT | 'M', 'F', 'X', 'U' |
| sending_facility | TEXT | Sending facility name |
| receiving_facility | TEXT | Receiving facility name |
| urgency_level | TEXT | 'routine', 'urgent', 'emergent', 'critical' |
| reason_for_transfer | TEXT | Reason for transfer |
| clinical_data | JSONB | Vitals, meds, allergies snapshot |
| sender_provider_name | TEXT | Sending provider |
| sender_callback_number | TEXT | Callback phone |
| sender_notes | TEXT | Notes from sender |
| sender_user_id | UUID (FK) | Sending user |
| status | TEXT | 'draft', 'sent', 'acknowledged', 'cancelled' |
| access_token | TEXT (UNIQUE) | Tokenized secure link (base64) |
| access_expires_at | TIMESTAMPTZ | Token expiration (72 hours) |
| acknowledged_by | UUID (FK) | Receiving user |
| acknowledged_at | TIMESTAMPTZ | When acknowledged |
| acknowledgement_notes | TEXT | Receiving notes |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |
| created_by | UUID (FK) | Creator |
| ip_address | INET | Source IP |
| user_agent | TEXT | Source browser/client |

**Indexes:**
- `idx_handoff_packets_status` - Status filtering
- `idx_handoff_packets_sending` - Sending facility
- `idx_handoff_packets_receiving` - Receiving facility
- `idx_handoff_packets_created` - Time-based queries
- `idx_handoff_packets_access_token` - Secure link lookups
- `idx_handoff_packets_sender_user` - User lookups

---

### Table: `public.shift_handoff_risk_scores`
**Purpose:** Smart shift handoff risk prioritization for nurse rounds

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| patient_id | UUID (FK) | Patient reference |
| admission_id | UUID (FK) | Admission reference |
| shift_date | DATE | Shift date |
| shift_type | TEXT | 'day', 'evening', 'night' |
| scoring_time | TIMESTAMPTZ | When scored |
| auto_medical_acuity_score | INTEGER | 0-100 auto-calculated |
| auto_stability_score | INTEGER | 0-100 auto-calculated |
| auto_early_warning_score | INTEGER | 0-100 auto-calculated (NEWS/MEWS) |
| auto_event_risk_score | INTEGER | 0-100 auto-calculated |
| auto_composite_score | INTEGER | Weighted average (GENERATED) |
| auto_risk_level | TEXT | CRITICAL/HIGH/MEDIUM/LOW (GENERATED) |
| nurse_reviewed | BOOLEAN | Human review completed |
| nurse_id | UUID (FK) | Reviewing nurse |
| nurse_reviewed_at | TIMESTAMPTZ | When nurse reviewed |
| nurse_risk_level | TEXT | Override risk level |
| nurse_adjustment_reason | TEXT | Why nurse changed score |
| final_risk_level | TEXT | Auto or nurse override (GENERATED) |
| risk_factors | TEXT[] | Detected risk flags |
| clinical_snapshot | JSONB | Key vitals/events |
| handoff_priority | INTEGER | Priority ranking |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**Indexes:**
- `idx_handoff_risk_patient` - Patient lookups
- `idx_handoff_risk_shift` - Shift-based queries
- `idx_handoff_risk_final_level` - Risk level filtering
- `idx_handoff_risk_priority` - Priority sorting
- `idx_handoff_risk_nurse_review` - Pending review

**Generated Columns:**
- `auto_composite_score` - Weighted average (30% acuity, 25% stability, 30% EWS, 15% event)
- `auto_risk_level` - Thresholds: 75+ CRITICAL, 50+ HIGH, 25+ MEDIUM, else LOW
- `final_risk_level` - Prefers nurse_risk_level if set, otherwise uses auto

---

## COMMUNITY FEATURES

### Table: `public.community_moments`
**Purpose:** Shared community moments/stories (visible to all users)

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL (PK) | |
| user_id | UUID (FK) | Content creator |
| file_url | TEXT | Media URL |
| file_path | TEXT | Storage path |
| title | TEXT | Moment title |
| description | TEXT | Moment description |
| emoji | TEXT | Associated emoji |
| tags | TEXT[] | Tagging system |
| is_gallery_high | BOOLEAN | Featured in gallery |
| created_at | TIMESTAMPTZ | |

**RLS Policies:**
- SELECT: All users can view
- INSERT/UPDATE: Own content only
- Admins: Full access

**Indexes:**
- `idx_community_moments_user_id` - Creator lookups
- `idx_community_moments_created_at` - Recent moments

---

### Table: `public.community_photos`
**Purpose:** Photo sharing within community

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL (PK) | |
| user_id | UUID (FK) | Photo creator |
| file_url | TEXT | Photo URL |
| description | TEXT | Photo description |
| created_at | TIMESTAMPTZ | |

**RLS Policies:**
- SELECT: All users can view
- INSERT: Own photos only

---

### Table: `public.admin_notes`
**Purpose:** Admin notes on patient profiles (HIPAA audit trail)

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL (PK) | |
| patient_id | UUID (FK) | Patient being noted |
| admin_id | UUID (FK) | Admin creating note |
| note | TEXT | Note content |
| created_at | TIMESTAMPTZ | |

**RLS Policies:**
- Admin-only access

**Indexes:**
- `idx_admin_notes_patient_id` - Patient lookups
- `idx_admin_notes_admin_id` - Admin tracking

---

### Table: `public.admin_profile_view_logs`
**Purpose:** Audit trail of admin profile access (HIPAA compliance)

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL (PK) | |
| admin_id | UUID (FK) | Admin accessing |
| patient_id | UUID (FK) | Patient accessed |
| accessed_at | TIMESTAMPTZ | When accessed |

**RLS Policies:**
- Admin-only access

**Indexes:**
- `idx_admin_profile_view_logs_admin_id` - Admin tracking
- `idx_admin_profile_view_logs_patient_id` - Patient access history

---

## ANALYTICS & RISK ASSESSMENT

### Table: `public.emergency_alerts`
**Purpose:** AI-generated emergency alerts and notifications

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL (PK) | |
| patient_id | UUID (FK) | Patient with alert |
| alert_type | TEXT | 'VITAL_ANOMALY', 'MISSED_CHECKINS', 'RISK_ESCALATION', 'EMERGENCY_CONTACT' |
| severity | TEXT | 'WARNING', 'URGENT', 'CRITICAL' |
| message | TEXT | Alert message |
| suggested_actions | TEXT[] | Recommended actions |
| probability_score | INTEGER | 0-100 probability |
| action_required | BOOLEAN | Requires intervention |
| resolved | BOOLEAN | Alert resolved |
| resolved_at | TIMESTAMPTZ | When resolved |
| resolved_by | UUID (FK) | User who resolved |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**RLS Policies:**
- SELECT: Patient own; Admins all
- Admin: Full access

**Indexes:**
- `idx_emergency_alerts_patient_id` - Patient lookups
- `idx_emergency_alerts_severity` - Severity filtering
- `idx_emergency_alerts_created_at` - Time-based

---

### Table: `public.ai_risk_assessments`
**Purpose:** AI-calculated patient risk scores and factors

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL (PK) | |
| patient_id | UUID (FK) | Patient being assessed |
| risk_level | TEXT | 'LOW', 'MODERATE', 'HIGH', 'CRITICAL' |
| risk_score | INTEGER | 0-100 composite score |
| risk_factors | TEXT[] | Detected risk factors |
| recommendations | TEXT[] | Care recommendations |
| priority | INTEGER | 1-5 priority level |
| trend_direction | TEXT | 'IMPROVING', 'STABLE', 'DECLINING' |
| assessed_at | TIMESTAMPTZ | Assessment timestamp |
| assessment_version | TEXT | Model version |

**RLS Policies:**
- SELECT: Patient own; Admins all
- Admin: Full access

**Indexes:**
- `idx_ai_risk_assessments_patient_id` - Patient lookups
- `idx_ai_risk_assessments_risk_level` - Risk filtering
- `idx_ai_risk_assessments_assessed_at` - Time-based

---

### Table: `public.care_recommendations`
**Purpose:** AI-generated personalized care recommendations

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL (PK) | |
| patient_id | UUID (FK) | Patient |
| category | TEXT | 'MEDICATION', 'LIFESTYLE', 'MONITORING', 'FOLLOW_UP', 'INTERVENTION' |
| priority | TEXT | 'LOW', 'MEDIUM', 'HIGH', 'URGENT' |
| recommendation | TEXT | Recommendation text |
| reasoning | TEXT | Why recommended |
| estimated_impact | TEXT | Expected improvement |
| timeline | TEXT | When to implement |
| status | TEXT | 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED' |
| assigned_to | UUID (FK) | Provider responsible |
| created_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | When completed |
| due_date | TIMESTAMPTZ | Due date |

**RLS Policies:**
- SELECT: Patient own, assigned providers, admins
- Admin: Full access

**Indexes:**
- `idx_care_recommendations_patient_id` - Patient lookups
- `idx_care_recommendations_priority` - Priority filtering
- `idx_care_recommendations_assigned_to` - Provider assignment

---

### Table: `public.vitals_trends`
**Purpose:** AI analysis of vital sign trends over time

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL (PK) | |
| patient_id | UUID (FK) | Patient |
| metric | TEXT | 'bp_systolic', 'bp_diastolic', 'heart_rate', 'glucose_mg_dl', 'pulse_oximeter' |
| current_value | NUMERIC | Current reading |
| previous_value | NUMERIC | Previous reading |
| trend | TEXT | 'RISING', 'FALLING', 'STABLE' |
| change_percent | NUMERIC | % change |
| is_abnormal | BOOLEAN | Outside normal range |
| normal_range_min | NUMERIC | Lower normal bound |
| normal_range_max | NUMERIC | Upper normal bound |
| recommendation | TEXT | Clinical recommendation |
| analyzed_at | TIMESTAMPTZ | Analysis time |

**RLS Policies:**
- SELECT: Patient own; Admins all
- Admin: Full access

**Indexes:**
- `idx_vitals_trends_patient_id` - Patient lookups
- `idx_vitals_trends_metric` - Metric filtering
- `idx_vitals_trends_analyzed_at` - Time-based

---

### Table: `public.population_insights`
**Purpose:** Aggregate population-level health analytics

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL (PK) | |
| total_patients | INTEGER | Total active patients |
| active_patients | INTEGER | Recently engaged patients |
| high_risk_patients | INTEGER | HIGH/CRITICAL risk count |
| average_health_score | NUMERIC(5,2) | Population health score |
| trending_concerns | TEXT[] | Top health concerns |
| engagement_rate | NUMERIC(5,2) | % of active engagement |
| common_conditions | JSONB | Condition frequency map |
| risk_distribution | JSONB | Risk level distribution |
| generated_at | TIMESTAMPTZ | When generated |
| period_days | INTEGER | Analysis period (default 30) |

**RLS Policies:**
- Admin-only access

---

### Table: `public.predictive_outcomes`
**Purpose:** AI predictions for patient clinical outcomes

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL (PK) | |
| patient_id | UUID (FK) | Patient |
| condition | TEXT | Predicted condition |
| probability | INTEGER | 0-100 probability |
| timeframe | TEXT | Prediction window (e.g., '30 days') |
| confidence_level | TEXT | 'LOW', 'MEDIUM', 'HIGH' |
| based_on | TEXT[] | Data sources used |
| predicted_at | TIMESTAMPTZ | Prediction timestamp |
| expires_at | TIMESTAMPTZ | Prediction expiration |

**RLS Policies:**
- SELECT: Patient own; Admins all
- Admin: Full access

**Indexes:**
- `idx_predictive_outcomes_patient_id` - Patient lookups
- `idx_predictive_outcomes_condition` - Condition filtering

---

### Table: `public.intervention_queue`
**Purpose:** Track required clinical interventions

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL (PK) | |
| patient_id | UUID (FK) | Patient |
| intervention_type | TEXT | 'CLINICAL', 'MEDICATION', 'LIFESTYLE', 'MONITORING', 'EMERGENCY', 'FOLLOW_UP' |
| priority | INTEGER | 1-5 (1=highest) |
| description | TEXT | Intervention details |
| estimated_time | TEXT | Time required |
| expected_outcome | TEXT | Expected result |
| status | TEXT | 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED' |
| assigned_to | UUID (FK) | Provider responsible |
| due_date | TIMESTAMPTZ | Due date |
| created_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | Completion time |

**RLS Policies:**
- SELECT: Patient own, assigned provider, admins
- Admin: Full access

**Indexes:**
- `idx_intervention_queue_patient_id` - Patient lookups
- `idx_intervention_queue_priority` - Priority sorting
- `idx_intervention_queue_assigned_to` - Provider assignment

---

## SECURITY & AUDIT

### Table: `public.security_events`
**Purpose:** SOC 2 security event logging

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL (PK) | |
| timestamp | TIMESTAMPTZ | Event timestamp |
| event_type | TEXT | 'AUTH_FAILED', 'UNAUTHORIZED_ACCESS', etc. |
| severity | TEXT | 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL' |
| actor_user_id | UUID | User performing action |
| actor_ip_address | INET | Source IP |
| resource_type | TEXT | Resource type |
| resource_id | UUID | Resource ID |
| auto_blocked | BOOLEAN | Whether auto-blocked |
| requires_investigation | BOOLEAN | Requires review |
| investigated | BOOLEAN | Investigated flag |

**Purpose:** Security monitoring and incident detection

---

### Table: `public.audit_logs`
**Purpose:** Comprehensive audit trail for SOC 2 compliance

| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL (PK) | |
| timestamp | TIMESTAMPTZ | Action timestamp |
| actor_user_id | UUID | User performing action |
| actor_role | TEXT | User's role |
| actor_ip_address | INET | Source IP |
| event_type | TEXT | Type of event |
| event_category | TEXT | 'PHI_ACCESS', 'AUTHENTICATION', etc. |
| resource_type | TEXT | Type of resource |
| resource_id | UUID | Resource ID |
| target_user_id | UUID | Affected user |
| operation | TEXT | 'CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT' |
| metadata | JSONB | Additional context |
| success | BOOLEAN | Operation success |
| error_message | TEXT | If failed |

**RLS:** No policy - admin/service role only

---

## VIEWS & MATERIALIZED VIEWS

### View: `public.profiles_with_user_id`
**Purpose:** Simplified profile view for reporting

**Columns:** user_id, first_name, last_name, phone, email, dob, address, caregiver_email, emergency_contact_name, role, created_at, updated_at

**Grant:** SELECT to authenticated

---

### View: `public.security_monitoring_dashboard`
**Purpose:** Real-time SOC 2 monitoring dashboard

**Metrics:**
- security_events_24h - Events in past 24 hours
- critical_events_24h - CRITICAL severity
- high_events_24h - HIGH severity
- failed_logins_24h - Failed auth attempts
- unauthorized_access_24h - Unauthorized access
- auto_blocked_24h - Auto-blocked events
- open_investigations - Pending investigations
- phi_access_24h - PHI access events
- failed_operations_24h - Failed operations

**Grant:** SELECT to authenticated

---

### View: `public.phi_access_audit`
**Purpose:** HIPAA audit trail for PHI access

**Columns:** id, timestamp, actor_user_id, actor_role, actor_ip_address, event_type, resource_type, resource_id, target_user_id, operation, metadata, success, error_message, actor_email, patient_name, access_type, risk_level

**Grant:** SELECT to authenticated

---

### View: `public.security_events_analysis`
**Purpose:** Security event trend analysis (hourly aggregation)

**Aggregations:** hour, event_type, severity, event_count, unique_actors, unique_ips, auto_blocked_count, investigation_required_count, latest_occurrence

**Grant:** SELECT to authenticated

---

## DATABASE FUNCTIONS

### Function: `public.set_updated_at()`
**Purpose:** Trigger function to maintain `updated_at` timestamps

**Language:** PL/pgSQL  
**Used by:** All major tables via triggers

---

### Function: `public.is_admin(p_uid uuid)`
**Purpose:** Check if user has admin or super_admin role

**Returns:** BOOLEAN  
**Logic:** SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_uid AND role IN ('admin', 'super_admin'))

---

### Function: `public.next_seq(seq text)`
**Purpose:** Get next value from named sequence

**Returns:** BIGINT  
**Used for:** X12 EDI control numbers

---

### Function: `public.cleanup_expired_fhir_bundles()`
**Purpose:** Delete expired FHIR bundles (>24 hours old)

**Language:** PL/pgSQL  
**Maintenance:** Run daily

---

### Function: `public.get_latest_risk_assessment(patient_uuid uuid)`
**Purpose:** Get most recent risk assessment for patient

**Returns:** ai_risk_assessments row

---

### Function: `public.get_active_emergency_alerts()`
**Purpose:** Get unresolved URGENT/CRITICAL alerts

**Returns:** SETOF emergency_alerts

---

## INDEXES & PERFORMANCE

### Critical Performance Indexes

**Patient Lookups:**
- `idx_check_ins_user_id` - Vitals by patient
- `idx_health_entries_user_id` - Health entries by patient
- `idx_ai_risk_assessments_patient_id` - Risk scores by patient
- `idx_emergency_alerts_patient_id` - Alerts by patient
- `idx_fhir_observations_patient_id` - Observations by patient

**Billing Lookups:**
- `idx_encounters_patient` - Encounters by patient
- `idx_claims_encounter` - Claims by encounter
- `idx_claims_payer` - Claims by payer
- `idx_claims_status` - Claims by status
- `idx_fee_schedules_payer_active` - Active fee schedules

**Time-Based Queries:**
- `idx_check_ins_created_at` - Recent check-ins
- `idx_emergency_alerts_created_at` - Recent alerts
- `idx_fee_schedules_effective_date` - Effective date ranges

**Partial Indexes (Performance):**
- `idx_check_ins_emergency` - Emergency check-ins (WHERE is_emergency=true)
- `idx_emergency_alerts_severity` - Unresolved URGENT/CRITICAL (WHERE NOT resolved)
- `idx_care_recommendations_priority` - Pending high-priority (WHERE status='PENDING')
- `idx_handoff_risk_nurse_review` - Pending review (WHERE nurse_reviewed=FALSE)

---

## RLS POLICIES SUMMARY

### By Role

**Super Admin (super_admin):**
- Full access to all tables
- Manages ai_configuration
- Accesses security_events, audit_logs
- Manages user_roles, admin_pins

**Admin (admin):**
- Access to patient data
- Can view/manage billing
- Access to risk assessments
- Can manage providers, payers
- View audit logs

**Healthcare Provider (healthcare_provider, case_manager):**
- View own patient caseload
- Read encounters, clinical notes
- Access fee schedules
- Submit claims

**Patient (authenticated user):**
- View own profile, health data
- View own check-ins, vitals
- View own encounters (read-only)
- Access own risk assessments
- Participate in community features

---

## SUMMARY STATISTICS

- **Total Tables:** 50+
- **Total Views:** 5+
- **Total Functions:** 10+
- **Total Indexes:** 60+
- **FHIR Resources:** 10 (Observation, Medication, Condition, Procedure, CarePlan, Immunization, DiagnosticReport, MedicationRequest, Practitioner, Encounter)
- **Billing Tables:** 16+
- **RLS Enabled Tables:** 40+
- **Sequences:** 3 (handoff_packet_seq, x12_isa_seq, x12_gs_seq, x12_st_seq)

---

## MIGRATION HISTORY

**Total Migrations:** 202 active SQL files  
**Date Range:** 2025-09-16 to 2025-11-04  
**Key Phases:**
1. Core auth & roles (20250916)
2. AI analytics tables (20250918)
3. FHIR resources (20251017)
4. Billing system (2025092832322)
5. Clinical workflows (20251003-20251004)
6. Security & audit (20251018-20251019)

---

## ACCESSING THIS DOCUMENTATION

**Last Updated:** 2025-11-04  
**Maintained by:** WellFit Development Team  
**Related Files:**
- `/archive/DATABASE_MIGRATION_GUIDE.md` - Migration overview
- `/supabase/migrations/*.sql` - Individual migration files

