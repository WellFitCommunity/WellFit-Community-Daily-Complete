# Governance Boundary Map

## One Repo. Two Products. One Shared Spine.

This repository contains **two products** that may deploy **together or independently**:

| Product | Code | Target | License Digit |
|---------|------|--------|---------------|
| **WellFit** | System A | Seniors, caregivers, community orgs | `9` |
| **Envision Atlus** | System B | Hospitals, clinicians, care teams | `8` |
| **Both Together** | — | Full integration | `0` |

A **Shared Spine** provides identity, tenancy, roles, audit, FHIR, billing, and AI infrastructure to both products.

**Rule:** WellFit must operate without any Clinical tables, edge functions, or admin UI. Envision Atlus must operate without any Community engagement UI or offline storage flows.

---

## Authority

This document governs architectural boundaries in this repository. Any change that violates these boundaries requires explicit review and approval. This document is referenced from CLAUDE.md and must be consulted before any refactoring that moves code between systems.

---

## System A — WellFit (Community)

### Purpose

Community wellness engagement: daily check-ins, self-reporting, mood tracking, caregiver interaction, peer engagement, gamification.

### A1. UI Surface

| Path | Components |
|------|-----------|
| `src/components/CheckInTracker.tsx` | Main check-in orchestrator (474 lines) |
| `src/components/check-in/*` | CheckInFormBody, CheckInModals, CheckInHistory, types |
| `src/components/community/*` | CommunityReadmissionDashboard (see A4 below) |

**Allowed imports:** Shared layout/branding, AuthContext, auditLogger, envision-atlus design system.

**Forbidden imports:** Nothing from `admin/`, `bed-board/`, `smart-app/`, or clinical services.

### A2. Data Surface

**Primary tables (Community-owned):**

| Table | Purpose | RLS |
|-------|---------|-----|
| `check_ins` | Daily wellness check-ins with vitals | user_id + tenant_id |
| `self_reports` | Fallback self-reported health data | user_id |
| `community_moments` | Member-shared photos/stories | user_id |
| `affirmations` | Motivational content delivery | tenant-scoped |
| `user_engagements` | Gamification tracking | user_id |
| `feature_engagement` | Feature usage metrics | user_id |
| `trivia_game_results` | Game participation | user_id |
| `word_game_results` | Game participation | user_id |
| `enhanced_check_in_responses` | Check-in follow-ups | user_id |
| `wellness_enrollments` | Program enrollment | user_id |
| `personalized_content_delivery` | Content recommendations | user_id |
| `communication_silence_window` | Do-not-disturb | user_id |
| `mobile_vitals` | Mobile device health readings | user_id |
| `consecutive_missed_checkins_log` | Engagement gap tracking | user_id |

**Community-owned views:**

| View | Purpose |
|------|---------|
| `v_latest_check_in` | Most recent check-in per user (security_invoker) |
| `patient_engagement_metrics` | Engagement scoring |
| `patient_engagement_scores` | Wellness scores (materialized) |
| `user_consecutive_missed_days` | Engagement gaps (materialized) |

**Community writes to:** `check_ins` (via edge function), `self_reports` (direct fallback).

**Community never writes to:** Any clinical workflow table (beds, encounters, clinical_notes, etc.).

### A3. Edge Functions (Community-owned)

| Function | Purpose |
|----------|---------|
| `create-checkin` | Validate + insert check-in with tenant resolution |
| `ai-check-in-questions` | Personalized check-in questions |
| `send-checkin-reminders` | SMS/push daily reminders |
| `send-check-in-reminder-sms` | Dedicated SMS reminder |
| `notify-family-missed-check-in` | Caregiver escalation |
| `send-consecutive-missed-alerts` | Missed check-in pattern alerts |
| `notify-stale-checkins` | Engagement gap alerts |
| `smart-mood-suggestions` | Wellness suggestions from mood |
| `get-personalized-greeting` | AI greeting based on history |
| `claude-personalization` | Personalization engine |
| `ai-patient-qa-bot` | Community member chat |
| `ai-missed-checkin-escalation` | Risk from missed check-ins |

### A4. The View Boundary Pattern (CommunityReadmissionDashboard)

`CommunityReadmissionDashboard` lives in `src/components/community/` and displays readmission risk data. This is **architecturally intentional** — it does NOT violate boundaries because:

1. It queries **three tenant-scoped views**, never clinical tables directly:
   - `v_readmission_dashboard_metrics` (aggregated KPIs)
   - `v_readmission_high_risk_members` (filtered by tenant + role)
   - `v_readmission_active_alerts` (tenant-scoped alerts)
2. All access is **read-only** — no mutations to clinical data
3. Views enforce **RLS via `security_invoker`** — tenant isolation at the database level
4. The views are the **coupling layer** between Clinical data and Community UI

**This is the approved pattern for cross-system data display:** Clinical owns the tables. Shared Spine owns the views. Community reads the views.

### A5. My Health Hub — 21st Century Cures Act Compliance

The `/my-health` route (MyHealthHubPage) gives patients/seniors electronic access to their own clinical records as required by the 21st Century Cures Act (Information Blocking Rule). This is the **second authorized cross-system read path** (alongside `patientContextService`).

**Routes (all protected, auth required):**

| Route | Component | USCDI Element |
|-------|-----------|---------------|
| `/my-health` | MyHealthHubPage | Central hub — navigation to all records |
| `/health-observations` | HealthObservationsPage | Vital signs, lab results |
| `/immunizations` | ImmunizationsPage | Vaccine records |
| `/care-plans` | CarePlansPage | Active care plans |
| `/allergies` | AllergiesPage | Allergy/intolerance list |
| `/conditions` | ConditionsPage | Medical conditions/diagnoses |
| `/medicine-cabinet` | MedicineCabinet | Medication tracking |
| `/health-records-download` | HealthRecordsDownloadPage | Export (PDF, FHIR, C-CDA, CSV) |
| `/telehealth-appointments` | TelehealthAppointmentsPage | Video visit scheduling |

**Data access pattern:** `FHIR service hooks (useFhirData.ts) → patient's own records → read-only display`

**Security:** PHI access logged via `usePhiAccessLogging()` hook. Data scoped to `auth.uid()`. No cross-patient access.

**This is NOT a boundary violation.** The Cures Act requires patients have electronic access to their health information. My Health Hub provides that access through FHIR services (the Shared Spine), not by querying clinical tables directly. Clinical owns the data. FHIR services are the coupling layer. Community displays it read-only.

---

## System B — Envision Atlus (Clinical)

### Purpose

Hospital and clinic-grade workflows: bed management, patient encounters, clinical documentation, readmission prevention, SMART on FHIR, medication management, billing.

### B1. UI Surface

| Path | Components |
|------|-----------|
| `src/components/admin/BedManagementPanel.tsx` | Bed board orchestrator (598 lines) |
| `src/components/admin/bed-board/*` | 10 bed board sub-components |
| `src/components/admin/BedCommandCenter.tsx` | Real-time bed operations |
| `src/components/admin/SmartAppManagementPanel.tsx` | SMART app registration |
| `src/components/admin/smart-app/*` | SMART sub-components |
| `src/components/admin/*.tsx` | 71 admin components (see B1 detail) |
| `src/components/admin/sections/*` | Dashboard section definitions |

**B1 detail — admin component categories:**

| Category | Examples |
|----------|---------|
| Patient Care | PatientEngagementDashboard, RiskAssessmentManager, MedicationManager |
| Bed Management | BedManagementPanel, BedCommandCenter |
| SMART/FHIR | SmartAppManagementPanel, FHIRInteroperabilityDashboard, FHIRDataMapper |
| Billing/Revenue | AICostDashboard, AIFinancialDashboard, StaffFinancialSavingsTracker |
| Compliance | SOC2SecurityDashboard (x5), ComplianceDashboard, TenantSecurityDashboard |
| Operations | SystemAdminDashboard, PerformanceMonitoringDashboard, DisasterRecoveryDashboard |
| Clinical Tools | NurseQuestionManager, NoteLockingControls, AmendmentWorkflow, PaperFormScanner |

**Allowed imports:** Shared layout/branding, AdminAuthContext/EnvisionAuthContext, auditLogger, clinical services.

**Forbidden imports:** Nothing from `community/`, no community engagement logic, no offline storage flows.

**Exception:** `AdminFeatureToggle.tsx` references `community_moments` (1 table) for gallery feature flagging. This is a feature toggle, not a data dependency.

### B2. Data Surface

**Clinical-owned tables (primary):**

| Category | Tables |
|----------|--------|
| Bed Management | `beds`, `bed_assignments`, `bed_status_history`, `bed_availability_forecasts`, `hospital_units`, `hospital_departments`, `facilities`, `daily_census_snapshots`, `capacity_forecasts`, `capacity_alerts`, `ed_boarders`, `ed_crowding_predictions` |
| Encounters | `encounters`, `encounter_diagnoses`, `encounter_procedures`, `patient_admissions`, `scheduled_arrivals` |
| Clinical Notes | `clinical_notes`, `ai_progress_notes`, `clinical_note_amendments`, `clinical_note_lock_audit`, `clinical_field_provenance` |
| Readmission | `patient_readmissions`, `readmission_risk_predictions`, `ai_extended_readmission_predictions`, `high_utilizer_analytics`, `los_predictions`, `los_benchmarks` |
| Care Coordination | `care_coordination_plans`, `care_team_alerts`, `care_team_members`, `specialist_alerts`, `specialist_assessments`, `specialist_providers`, `ccm_eligibility_assessments`, `ccm_time_tracking` |
| Medications | `medications`, `medication_doses_taken`, `medication_image_extractions`, `drug_interaction_cache`, `drug_interaction_check_logs`, `allergy_intolerances`, `ai_medication_instructions` |
| Discharge | `discharge_plans`, `post_discharge_follow_ups` |
| Shift Handoff | `handoff_packets`, `handoff_sections`, `handoff_attachments`, `handoff_logs`, `shift_handoff_events`, `ai_shift_handoff_summaries`, `emergency_response_briefings` |
| Lab/Diagnostics | `lab_results`, `fhir_diagnostic_reports`, `fhir_observations` |
| Dental | `dental_assessments`, `dental_observations`, `dental_procedures`, `dental_referrals`, `dental_tooth_chart`, `dental_treatment_plans`, `dental_imaging` |
| AI Clinical | `ai_fall_risk_assessments`, `ai_hipaa_violation_predictions`, `ai_referral_letters`, `ai_guideline_matches`, `ai_contraindication_checks` |

**Clinical-owned views:**

| View | Purpose |
|------|---------|
| `v_bed_board` | Bed inventory dashboard |
| `v_unit_capacity` | Unit-level capacity |
| `v_readmission_dashboard_metrics` | Readmission KPIs |
| `v_readmission_high_risk_members` | High-risk patient roster |
| `v_readmission_active_alerts` | Active care alerts |
| `readmission_prediction_analytics` | Model performance |
| `guardian_cron_status` | Guardian monitoring |
| `ccm_eligibility_analytics` | CCM qualification |
| `handoff_synthesis_analytics` | Handoff completion |
| `provider_workload_metrics` | Provider utilization (materialized) |
| `check_ins_decrypted` | PHI-decrypted check-ins (encrypted access) |
| `risk_assessments_decrypted` | PHI-decrypted risk assessments |

### B3. Edge Functions (Clinical-owned)

| Category | Functions |
|----------|----------|
| Bed Management | `bed-management`, `bed-optimizer`, `bed-capacity-monitor` |
| Clinical AI | `ai-readmission-predictor`, `ai-fall-risk-predictor`, `ai-infection-risk-predictor`, `ai-medication-adherence-predictor`, `ai-soap-note-generator`, `ai-progress-note-synthesizer`, `ai-care-plan-generator`, `ai-discharge-summary`, `ai-treatment-pathway`, `ai-clinical-guideline-matcher`, `ai-contraindication-detector`, `ai-medication-reconciliation`, `ai-medication-instructions`, `ai-referral-letter`, `ai-patient-education`, `ai-appointment-prep-instructions` |
| SMART/OAuth | `smart-authorize`, `smart-token`, `smart-configuration`, `smart-revoke`, `smart-register-app` |
| Clinical Auth | `envision-login`, `envision-totp-setup`, `envision-totp-verify`, `envision-totp-use-backup`, `envision-verify-pin`, `envision-check-super-admin`, `admin_register`, `admin_start_session`, `admin_end_session`, `admin_set_pin`, `verify-admin-pin` |
| Clinical Notifications | `send-appointment-reminder`, `send-telehealth-appointment-notification`, `send-team-alert`, `emergency-alert-dispatch` |
| Telehealth | `create-patient-telehealth-token`, `create-telehealth-room` |
| Operations | `detect-no-shows`, `process-appointment-reminders` |

### B4. Clinical Access to Community Data — Care Coordination & RPM

Doctors and clinical staff access community-generated data (self-reports, check-in vitals, engagement patterns) for care coordination. This is the **reverse** of the Cures Act flow (A5) and the core value proposition of running both products together (license digit `0`).

**Clinical-facing views of community data:**

| Route / Component | What Doctors See | Data Source |
|-------------------|-----------------|-------------|
| DoctorsViewPage (`/doctors-view`) | Latest check-in vitals (BP, HR, SpO2, glucose) + last 5 self-reports (mood, symptoms, activity) | `check_ins`, `self_reports` |
| PatientEngagementDashboard | Engagement risk scores, mood trends, symptom frequency, check-in counts | `patient_engagement_scores` view |
| PatientChartNavigator (`/patient-chart/:id`) | Full patient chart with tabs: meds, care plans, labs, vitals, immunizations | FHIR services |
| ExportCheckIns | CSV/JSON export of check-in metadata | `check_ins` |
| `v_latest_check_in` view | Most recent check-in per patient | `check_ins` |

**Access control:** Clinical staff access community data through RLS policies that grant `is_tenant_admin()` read access to `check_ins` and `self_reports` within the same tenant. Caregivers access via time-limited PIN grants.

**This is NOT a boundary violation.** Clinical reading community data for care coordination is the intended integration point. The rule is: **Clinical may read community data directly (same tenant). Community may only read clinical data through views or FHIR services.**

**Known gaps (future RPM work):**

| Gap | Impact |
|-----|--------|
| Wearable vital signs (`wearable_vital_signs`) not surfaced to clinicians | Apple Watch/Fitbit data collected but invisible to doctors |
| No automated vital sign thresholds or alerts | Abnormal home BP/HR/glucose doesn't trigger clinical notification |
| No RPM billing infrastructure (CPT 99453-99458) | Cannot bill Medicare for remote monitoring |
| Check-in vitals not converted to FHIR Observations | Home vitals invisible to external EHR systems |
| No longitudinal vital trending dashboard | Doctors see latest values but not 7/30-day trends |

---

## Shared Spine

### Purpose

Identity, tenancy, roles, audit, security, FHIR/HL7 interoperability, billing infrastructure, AI platform, and cross-product services that both products consume.

### S1. Identity & Authentication

| Table | Purpose |
|-------|---------|
| `auth.users` | Supabase auth (root identity) |
| `profiles` | Extended user profile (name, DOB, address, tenant_id) |
| `user_roles` | Role assignment (authoritative source) |
| `pending_registrations` | Registration queue |
| `account_lockouts` | Login security |
| `login_attempts` | Auth audit trail |
| `password_history` | Password rotation |

**Join key:** `user_id` references `auth.users.id`.

**Convention:** Use `patient_id` in all new code. The `patientContextService` abstracts the `user_id` / `patient_id` resolution.

### S2. Multi-Tenancy

| Table | Purpose |
|-------|---------|
| `tenants` | Organization configuration |
| `tenant_module_config` | Feature flags per tenant (RLS: tenant-scoped) |
| `tenant_branding_audit` | Branding change audit |
| `tenant_ai_skill_config` | AI feature customization per tenant |
| `admin_settings` | Global/tenant admin settings |

**Enforcement:** `get_current_tenant_id()` in RLS policies, edge functions, and read-only UI filters.

### S3. Roles & Authorization

**Authoritative source:** `user_roles` table.

UI checks are informational only. Database RLS is the enforcement layer. Edge functions must independently verify roles.

### S4. Audit & Compliance

| Table | Purpose |
|-------|---------|
| `audit_logs` | General application audit (REQUIRED for all mutations) |
| `admin_audit_log` | Admin action audit |
| `phi_access_logs` | PHI read/write audit |
| `phi_access_logs_archive` | PHI access history |
| `sensitive_disclosure_log` | PHI disclosure audit |
| `rls_policy_audit` | RLS policy change history |
| `data_deletion_log` | GDPR deletion tracking |
| `gdpr_deletion_requests` | Deletion request queue |
| `data_retention_policies` | Retention rules |
| `consent_expiration_alerts` | Consent management |

**Rule:** Clinical mutations require audit logging. Community requires audit logging for emergency flags, caregiver grants, and data exports.

### S5. Canonical Patient Context

**File:** `src/services/patientContextService.ts`

This is the **one authorized cross-system read path**. It aggregates patient data from both systems into a single context with traceability metadata (`context_meta`).

| Method | Purpose | Speed |
|--------|---------|-------|
| `getPatientContext(id)` | Full context (demographics, contacts, timeline, risk) | Standard |
| `getPatientContext(id, options)` | Selective fetch (choose what to include) | Configurable |
| `getMinimalContext(id)` | Demographics only | Fast |
| `patientExists(id)` | Existence check | Fast |

**Rule:** Use `patientContextService` for any query that spans both systems. Direct single-table queries are OK for single-field lookups.

### S6. FHIR & Interoperability

| Tables | Purpose |
|--------|---------|
| `fhir_patients`, `fhir_patient_mappings`, `fhir_practitioners`, `fhir_practitioner_roles`, `fhir_conditions`, `fhir_medication_requests`, `fhir_connections`, `fhir_resource_sync`, `fhir_sync_logs`, `fhir_sync_conflicts`, `fhir_token_lifecycle`, `fhir_procedures`, `fhir_observations`, `fhir_diagnostic_reports` | FHIR R4 resource cache and sync |
| `hl7_connections`, `hl7_message_log`, `hl7_message_queue`, `hl7_fhir_mappings`, `hl7_code_mappings` | HL7 v2.x integration |
| `ehr_patient_mappings` | EHR MRN mapping |

**Edge functions:** `fhir-r4`, `fhir-metadata`, `ccda-export`, `enhanced-fhir-export`, `hl7-receive`, `ai-fhir-semantic-mapper`

### S7. Billing Infrastructure

| Tables | Purpose |
|--------|---------|
| `billing_providers`, `billing_payers`, `billing_workflows`, `billing_code_cache` | Provider/payer config |
| `claims`, `claim_lines`, `claim_attachments`, `claim_denials`, `claim_review_history`, `claim_status_history`, `claim_flag_types` | Claims lifecycle |
| `fee_schedules`, `fee_schedule_rates`, `fee_schedule_items` | Contracted rates |
| `remittances` | ERA/835 remittance |
| `encounter_billing_suggestions` | Revenue suggestions |
| `clearinghouse_config`, `clearinghouse_batches`, `clearinghouse_batch_items` | Clearinghouse integration |
| `code_cpt`, `code_hcpcs`, `code_icd`, `code_modifiers` | Reference code sets |

**Edge functions:** `generate-837p`, `ai-billing-suggester`, `coding-suggest`, `sdoh-coding-suggest`

### S8. AI Platform

**AI Skill Registry:**

| Table | Purpose |
|-------|---------|
| `ai_skills` | Skill registry (skill_key, model, is_active) |
| `ai_skill_config` | Per-tenant skill configuration |
| `ai_model_registry` | Model availability |
| `ai_model_cards` | Model documentation (transparency) |
| `ai_prompt_versions` | Prompt versioning |
| `ai_prompt_experiments` | A/B testing |
| `ai_confidence_scores` | Prediction confidence |
| `ai_accuracy_metrics` | Model performance |
| `ai_transparency_log` | AI decision audit |
| `ai_audit_reports` | AI compliance reporting |
| `claude_usage_logs` | Claude API usage tracking |
| `mcp_cost_metrics` | MCP API cost tracking |

**AI Service Ownership:**

| Owner | Services | Rationale |
|-------|----------|-----------|
| Community | `ai-check-in-questions`, `ai-missed-checkin-escalation`, `smart-mood-suggestions`, `ai-patient-qa-bot`, `claude-personalization`, `get-personalized-greeting` | Consume community data, serve community UI |
| Clinical | `ai-readmission-predictor`, `ai-fall-risk-predictor`, `ai-soap-note-generator`, `ai-discharge-summary`, `ai-care-plan-generator`, `ai-medication-reconciliation`, `ai-contraindication-detector`, `ai-clinical-guideline-matcher`, `ai-treatment-pathway`, `ai-referral-letter`, `ai-medication-instructions`, `ai-progress-note-synthesizer`, `ai-infection-risk-predictor`, `ai-medication-adherence-predictor`, `ai-appointment-prep-instructions`, `ai-patient-education` | Consume clinical data, serve clinical workflows |
| Shared | `ai-care-escalation-scorer`, `ai-caregiver-briefing`, `ai-avatar-entity-extractor`, `ai-billing-suggester`, `ai-fhir-semantic-mapper`, `ai-schedule-optimizer` | Consume data from both systems or serve infrastructure |

**Service layer AI ownership:**

| Owner | Services |
|-------|----------|
| Community | `dashboardPersonalizationAI`, `patientOutreachService`, `pillIdentifierService`, `medicationLabelReader` |
| Clinical | `bedManagementService` + `bedOptimizer`, `readmissionRiskPredictionService`, `dischargePlanningService`, `drugInteractionService`, `holisticRiskAssessment`, `careCoordinationService`, `ccmAutopilotService`, `labResultVaultService`, `postAcuteFacilityMatcher` |
| Shared | `claudeService`, `claudeEdgeService`, `intelligentModelRouter`, `aiAdapterAssistant`, `aiTransparencyService`, `claudeCareAssistant` |

### S9. MCP Servers

All MCP servers are Shared Spine infrastructure (Tier 3 — service role required):

| Server | Purpose |
|--------|---------|
| `mcp-fhir-server` | FHIR CRUD operations |
| `mcp-hl7-x12-server` | HL7/X12 transformation |
| `mcp-prior-auth-server` | Prior authorization workflow |
| `mcp-clearinghouse-server` | Clearinghouse integration |
| `mcp-cms-coverage-server` | CMS LCD/NCD lookups |
| `mcp-npi-registry-server` | NPI validation |
| `mcp-postgres-server` | Direct DB access |
| `mcp-claude-server` | Claude API proxy |
| `mcp-medical-codes-server` | Medical code lookups |
| `mcp-edge-functions-server` | Edge function orchestration |

### S10. Shared Edge Functions

| Category | Functions |
|----------|----------|
| Auth (shared) | `login`, `register`, `passkey-auth-*`, `hash-pin`, `verify-pin-reset`, `sms-send-code`, `sms-verify-code`, `verify-hcaptcha`, `setup-admin-credentials`, `login-security` |
| Messaging (shared) | `send-sms`, `send-email`, `send-push-notification`, `send_welcome_email` |
| Public Health | `immunization-registry-submit`, `syndromic-surveillance-submit`, `ecr-submit`, `pdmp-query` |
| Data Management | `bulk-export`, `user-data-management`, `export-status`, `mobile-sync` |
| Medication Safety | `check-drug-interactions` |
| AI Infrastructure | `agent-orchestrator`, `guardian-agent`, `guardian-agent-api`, `claude-chat`, `log-ai-confidence-score` |
| System | `health-monitor`, `system-status`, `prometheus-metrics`, `daily-backup-verification`, `nightly-excel-backup`, `cleanup-temp-images` |

### S11. Contexts (React)

| Context | Owner | Purpose |
|---------|-------|---------|
| `AuthContext` | Community | Member authentication |
| `AdminAuthContext` | Shared | Admin authentication |
| `EnvisionAuthContext` | Clinical | Provider authentication |
| `PatientContext` | Shared | Selected patient state |
| `SessionTimeoutContext` | Shared | Session expiry |
| `TimeClockContext` | Clinical | Staff time tracking |
| `VoiceActionContext` | Shared | Voice command state |
| `LanguageContext` | Shared | i18n |
| `NavigationHistoryContext` | Shared | Browser history |
| `DemoModeContext` | Shared | Demo mode flag |

---

## Dual-Use Tables

Some tables serve both products. These are **not violations** — they are shared data with product-specific access patterns:

| Table | Community Use | Clinical Use |
|-------|-------------|-------------|
| `check_ins` | Self-reported wellness (mood, symptoms, activities) | Vital signs for care coordination (BP, HR, glucose) |
| `profiles` | Member demographics, emergency contact | Patient demographics, clinical enrollment |
| `appointments` | Community scheduling | Clinical scheduling |
| `care_coordination_plans` | (read-only via views) | Active care plan management |
| `care_team_alerts` | (read-only via views) | Alert generation and routing |

**Rule for dual-use tables:** Both products may read. Only the owning product may write. For `check_ins`, Community writes via `create-checkin` edge function. Clinical reads for care coordination.

---

## Coupling Rules — Separation WITH Cohesion

The two products are separated so they can deploy independently, but cohesive so they share value when deployed together. The 21st Century Cures Act (Information Blocking Rule) requires patients have electronic access to their records. Care coordination requires clinicians see patient-generated data. Both flows are authorized.

### Three Authorized Cross-System Read Paths

| # | Direction | Pattern | Example |
|---|-----------|---------|---------|
| 1 | Community → Clinical | Read **through views** (security_invoker) | CommunityReadmissionDashboard queries `v_readmission_*` |
| 2 | Community → Clinical | Read **through FHIR hooks** (Cures Act) | My Health Hub displays patient's own meds, labs, conditions |
| 3 | Clinical → Community | Read **directly** (same tenant, RLS-scoped) | DoctorsViewPage queries `check_ins` + `self_reports` for home vitals |

**All three are read-only. No cross-system writes.**

### Allowed

| Pattern | Example |
|---------|---------|
| Community reads Clinical data **through views** | CommunityReadmissionDashboard queries `v_readmission_*` |
| Community reads Clinical data **through FHIR services** | My Health Hub uses `useFhirData` hooks for patient's own records |
| Clinical reads Community data **through direct query or service** | DoctorsViewPage, PatientEngagementDashboard query `check_ins` for vitals |
| Both products use Shared Spine services | `patientContextService`, `auditLogger`, `claudeService` |
| AI services span both systems **when registered in ai_skills** | `ai-care-escalation-scorer` consumes both |

### Forbidden

| Pattern | Why |
|---------|-----|
| Community UI writing to clinical workflow tables | Breaks clinical data integrity |
| Clinical UI importing community engagement components | Creates deployment coupling |
| Shared utilities that mix domain logic from both systems | Creates "god" files |
| Edge functions that bypass tenant isolation | Security violation |
| Blocking patient access to their own records | Cures Act violation |
| Blocking clinician access to home-generated vitals (same tenant) | Defeats the value of shared deployment |

---

## Refactor Guardrails

1. **Views are the boundary layer.** When Community needs Clinical data, create a tenant-scoped view with `security_invoker = on`. Never query clinical tables directly from community components.

2. **Edge functions are the privilege boundary.** The browser never has direct access to cross-system writes. Edge functions decide what crosses.

3. **No shared "god" utility files.** Services are either Community, Clinical, or Shared. A service cannot import from both community and clinical UI code.

4. **Systems must be toggleable independently.** A tenant with license digit `9` (WellFit-only) must never see clinical UI or hit clinical edge functions. A tenant with license digit `8` (Atlus-only) must never see community engagement UI.

5. **600-line max per component file.** Decompose using the barrel re-export subdirectory pattern (`component-name/index.ts`).

6. **`patientContextService` is the canonical cross-system read path.** Any new feature that aggregates data from both systems must go through it, not ad-hoc joins.

---

## Naming Convention

| Path Pattern | Owner |
|-------------|-------|
| `src/components/community/*` | System A (WellFit) |
| `src/components/check-in/*` | System A (WellFit) |
| `src/components/admin/*` | System B (Envision Atlus) |
| `src/components/admin/bed-board/*` | System B |
| `src/components/admin/smart-app/*` | System B |
| `src/components/admin/sections/*` | System B |
| `src/components/envision-atlus/*` | Shared (design system) |
| `src/services/*` | See S8 ownership table |
| `src/contexts/*` | See S11 ownership table |
| `supabase/functions/*` | See A3, B3, S10 ownership tables |

---

## Scale Summary

| Component | Community | Clinical | Shared | Total |
|-----------|-----------|----------|--------|-------|
| UI Components | ~15 | ~71 | Design system | ~86+ |
| Database Tables | ~60 | ~80 | ~108 | ~248 |
| Edge Functions | ~15 | ~30 | ~99 | ~144 |
| Service Files | ~12 | ~25 | ~466 | ~503 |
| AI Skills (edge) | 6 | 16 | 6 | 28 |
| AI Skills (service) | 4 | 9 | 6 | 19 |
| Views | 4 | 12 | 14+ | 30+ |
| Contexts | 1 | 2 | 7 | 10 |
