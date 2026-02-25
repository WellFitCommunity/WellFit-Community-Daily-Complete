# Envision ATLUS I.H.I.S. — Top 24 Features

> **Intelligent Healthcare Interoperability System**
> Built by Envision Virtual Edge Group LLC
> Reviewed: 2026-02-25

---

## Overview

This document highlights the 24 most significant features of the Envision ATLUS platform, evaluated from a technical reviewer's perspective. These are not marketing bullet points — they are engineering achievements that demonstrate enterprise-grade healthcare software built with AI at the helm.

---

## Feature 1: Guardian Agent — AI That Watches AI

Most platforms deploy AI features and hope they work. Envision ATLUS built a self-healing orchestration layer that monitors every AI service in the system — detects failures, tracks health scores, auto-remediates, and logs every healing action. The Guardian Agent Dashboard shows active issues, recent healings, and knowledge base entries.

**Why it matters:** This is the kind of operational maturity found at companies like Datadog or PagerDuty, not in a healthcare startup. It tells a hospital: "We don't just use AI — we govern it." When an AI skill degrades or fails, the system catches it before a clinician notices. Every healing action is auditable. This is what responsible AI deployment looks like.

**Key components:**
- `GuardianAgentDashboard` — Real-time health monitoring UI
- `guardian-agent` / `guardian-agent-api` edge functions — Orchestration engine
- `guardian_cron_status` view — Monitoring status
- Health badges, active issue tracking, knowledge base, auto-refresh

---

## Feature 2: Community-to-Clinical Data Bridge

Seniors do daily check-ins at home — mood, symptoms, blood pressure, glucose, oxygen. That data flows through tenant-scoped views to clinicians who see it in DoctorsViewPage and PatientEngagementDashboard. The view boundary pattern is architecturally clean: Community owns the writes, Clinical gets read-only access through RLS-enforced views. No direct table coupling.

**Why it matters:** Most health platforms either do community wellness OR clinical care. Envision ATLUS does both, and the data actually connects. A doctor seeing that a member's home blood pressure has been trending up for two weeks before they show up in the ED — that's where the clinical value lives. The architecture ensures this works without compromising data ownership or creating deployment coupling.

**Key components:**
- `v_readmission_dashboard_metrics`, `v_readmission_high_risk_members`, `v_readmission_active_alerts` — Tenant-scoped clinical views
- `CommunityReadmissionDashboard` — Community-side display
- `DoctorsViewPage` — Clinical-side display of home vitals
- `PatientEngagementDashboard` — Engagement risk scoring

---

## Feature 3: SMART on FHIR — Full OAuth2 App Platform

Not just a FHIR API — a full SMART on FHIR launch framework with app registration, OAuth2 authorization, token issuance, token revocation, and JWKS configuration. This is what Epic and Cerner require for third-party app integration.

**Why it matters:** Most health tech companies spend 6-12 months getting SMART on FHIR right with a dedicated interoperability team. The SmartAppManagementPanel lets admins register and manage SMART apps from the admin UI. This single feature makes the platform pluggable into the existing hospital ecosystem instead of being another silo.

**Key components:**
- `SmartAppManagementPanel` + 10 sub-components
- `smart-authorize`, `smart-token`, `smart-configuration`, `smart-revoke`, `smart-register-app` edge functions
- Full OAuth2 flow with PKCE support
- JWKS endpoint for token verification

---

## Feature 4: AI Clinical Decision Support Suite

Not one AI model — a full suite: readmission risk prediction, fall risk assessment, infection risk, medication adherence prediction, contraindication detection, drug interaction checking, clinical guideline matching, and treatment pathway generation. Each skill is registered in the `ai_skills` table with pinned model versions, patient-facing descriptions for HTI-2 transparency, per-tenant configuration, and confidence score logging.

**Why it matters:** This is not "we added ChatGPT to a healthcare app." This is a governed, auditable, transparent clinical AI platform where every prediction can be traced, explained, and defended. The AIModelCardsDashboard exposes model documentation for compliance auditors. CMS and ONC are moving toward mandatory AI transparency — this platform is already there.

**Key components:**
- `ai-readmission-predictor`, `ai-fall-risk-predictor`, `ai-infection-risk-predictor`, `ai-medication-adherence-predictor` edge functions
- `ai-contraindication-detector`, `ai-clinical-guideline-matcher`, `ai-treatment-pathway` edge functions
- `ai_skills` registry with pinned model versions
- `ai_model_cards` for HTI-2 transparency
- `ai_confidence_scores` and `ai_accuracy_metrics` for performance tracking
- `AIModelCardsDashboard`, `AIAccuracyDashboard` for monitoring

---

## Feature 5: Bed Management Command Center

Real-time bed inventory, unit capacity tracking, ED boarder management, capacity forecasting, census snapshots, and availability predictions — all in one command center with 10 sub-components. The bed optimizer uses AI to suggest placements. The capacity monitor predicts crowding.

**Why it matters:** This is a standalone product at companies like TeleTracking and Central Logic. For a hospital operations director, this is the screen they live on. Tenant isolation means multiple facilities in the same health system each see their own bed board without cross-contamination.

**Key components:**
- `BedManagementPanel` (598 lines) + `BedCommandCenter`
- 10 bed board sub-components
- `bed-management`, `bed-optimizer`, `bed-capacity-monitor` edge functions
- `beds`, `bed_assignments`, `bed_status_history`, `bed_availability_forecasts` tables
- `v_bed_board`, `v_unit_capacity` views
- `daily_census_snapshots`, `capacity_forecasts`, `capacity_alerts`

---

## Feature 6: AI Shift Handoff Synthesis

Communication failures during nursing shift changes are one of the top causes of adverse events in hospitals. The handoff system generates structured handoff packets with sections, attachments, and AI-synthesized summaries of what happened during the shift.

**Why it matters:** The `process-shift-handoff` edge function digests clinical notes, vitals, medication changes, and care plan updates into a briefing the incoming nurse can consume in minutes instead of spending 30 minutes piecing it together. The emergency response briefing variant handles crisis scenarios. This solves a patient safety problem that hospitals have been throwing clipboards and whiteboards at for decades.

**Key components:**
- `handoff_packets`, `handoff_sections`, `handoff_attachments` tables
- `handoff_logs`, `shift_handoff_events` audit tables
- `ai_shift_handoff_summaries` — AI-generated synthesis
- `emergency_response_briefings` — Crisis variant
- `process-shift-handoff` edge function
- `handoff_synthesis_analytics` view

---

## Feature 7: My Health Hub — 21st Century Cures Act Compliance

A full patient-facing portal with dedicated routes for observations, immunizations, care plans, allergies, conditions, medications, and health records download in four formats (PDF, FHIR, C-CDA, CSV). Every PHI access is logged.

**Why it matters:** The Cures Act says patients must have electronic access to their health information, and information blocking is a federal violation. Most EHRs technically comply but make it painful. This is a usable product that seniors can actually navigate, with large touch targets and clear language. The data flows through FHIR service hooks — patients read their own records through the same interoperability layer that external systems use.

**Key components:**
- `MyHealthHubPage` (`/my-health`) — Central hub
- `/health-observations`, `/immunizations`, `/care-plans`, `/allergies`, `/conditions`, `/medicine-cabinet` routes
- `/health-records-download` — Multi-format export
- `usePhiAccessLogging()` hook — PHI access audit
- `useFhirData.ts` hooks — FHIR-based data access
- All data scoped to `auth.uid()` — no cross-patient access

---

## Feature 8: Multi-Tenant White-Label with Three Deployment Modes

Three distinct deployment configurations from a single codebase: WellFit-only (community orgs, license digit 9), Envision Atlus-only (hospitals, digit 8), or both together (full integration, digit 0). Each tenant gets their own branding, module configuration, AI skill settings, and feature flags.

**Why it matters:** A community center in Detroit and a hospital in Houston can run on the same infrastructure without seeing each other's data or UI. RLS policies use `get_current_tenant_id()` across all 248 tables. CORS uses explicit `ALLOWED_ORIGINS` per tenant domain. This is hard to retrofit — the fact that it was designed in from the start is what makes it work.

**Key components:**
- `tenants` table with license digit convention
- `tenant_module_config` — Feature flags per tenant
- `TenantBrandingManager` — Branding customization
- `TenantModuleConfigPanel` — Module enable/disable
- `useBranding()` hook — Dynamic branding
- `get_current_tenant_id()` — RLS enforcement function
- `ALLOWED_ORIGINS` — Explicit CORS per domain

---

## Feature 9: Billing & Claims Pipeline

End-to-end revenue cycle: fee schedules, claim generation (X12 837P), clearinghouse submission, eligibility verification (270/271), claim status inquiry (276/277), remittance processing (835), prior authorization (278), denial management, and appeal workflows.

**Why it matters:** Most health tech platforms punt on billing and tell customers to use a separate RCM vendor. Having it built in means a small practice or community health center can run clinical operations and billing from one system. The MCP servers for clearinghouse, CMS coverage, and NPI registry provide standardized tool interfaces. The AI billing suggester recommends codes from encounter data. The prior auth system checks LCD/NCD requirements before submission.

**Key components:**
- `claims`, `claim_lines`, `claim_denials`, `claim_status_history` tables
- `fee_schedules`, `fee_schedule_rates` tables
- `clearinghouse_config`, `clearinghouse_batches` tables
- `generate-837p`, `ai-billing-suggester`, `coding-suggest` edge functions
- `BillingDashboard`, `PriorAuthDashboard`, `ClearinghouseConfigPanel` admin components
- MCP servers: clearinghouse, CMS coverage, NPI registry
- `code_cpt`, `code_hcpcs`, `code_icd`, `code_modifiers` reference tables

---

## Feature 10: Audit & Compliance Infrastructure

Seven audit tables, GDPR deletion tracking, consent management, data retention policies, and five SOC2 dashboards covering security, compliance, audit trails, executive views, and incident response.

**Why it matters:** This is what makes everything else defensible. The `auditLogger` service is enforced in every mutation path — there's a pre-commit hook that blocks `console.log` statements. When a SOC2 auditor or OCR investigator asks "show me who accessed this patient's data on this date," the answer is a query, not a shrug.

**Key components:**
- `audit_logs`, `admin_audit_log`, `phi_access_logs`, `phi_access_logs_archive` tables
- `sensitive_disclosure_log`, `rls_policy_audit`, `data_deletion_log` tables
- `gdpr_deletion_requests`, `data_retention_policies`, `consent_expiration_alerts` tables
- `SOC2SecurityDashboard`, `SOC2ComplianceDashboard`, `SOC2AuditDashboard` components
- `SOC2ExecutiveDashboard`, `SOC2IncidentResponseDashboard` components
- `ComplianceDashboard`, `TenantAuditLogs` components
- `auditLogger` service — enforced across all code paths

---

## Feature 11: Caregiver PIN-Based Access

A time-limited PIN grant system where a patient or care team member issues a PIN to a caregiver. It expires after a set window, and every access is logged in `phi_access_logs`. The caregiver sees what they need to see and nothing more.

**Why it matters:** Most patient portals force family members to create full accounts with email and password, which is a barrier for elderly care scenarios where a daughter is checking on her mother. PIN grants solve a real problem in senior care: families want visibility without the friction of onboarding into a clinical system, and HIPAA still requires access controls and audit trails. This gives you both.

**Key components:**
- `verify-pin`, `hash-pin` edge functions
- `caregiver_access` table — Time-limited grants
- `phi_access_logs` — Access audit trail
- `notify-family-missed-check-in` — Caregiver escalation
- PIN expiration and scope enforcement

---

## Feature 12: Medication Safety Suite

A full medication safety pipeline: pill identification from camera photos, medication label reading, drug interaction checking against a cached database, AI-powered medication reconciliation, contraindication detection, and plain-language medication instructions generated by AI.

**Why it matters:** For a senior taking 8 medications from 3 different doctors, this is the difference between a dangerous interaction getting caught at home versus getting caught in the ED. Interactions are cached locally and checked in real-time, not just on a scheduled basis. The Medicine Cabinet route gives patients a unified view of everything they're taking.

**Key components:**
- `pillIdentifierService` — Camera-based pill identification
- `medicationLabelReader` — Label OCR
- `drug_interaction_cache`, `drug_interaction_check_logs` tables
- `check-drug-interactions` edge function
- `ai-medication-reconciliation`, `ai-contraindication-detector` edge functions
- `ai-medication-instructions` — Plain-language instructions
- `medication_image_extractions` table
- `/medicine-cabinet` route

---

## Feature 13: Clinical Note Locking & Amendment Workflow — 21 CFR Part 11

Once a clinical note is signed, it's locked. Any change after locking creates a formal amendment with the original preserved, the amendment tracked, the author identified, and the timestamp recorded.

**Why it matters:** Clinical notes are legal documents. This is what gets tested during Joint Commission surveys and malpractice discovery. Most startups treat clinical notes as editable text fields. Envision ATLUS treats them as legal records with chain-of-custody integrity.

**Key components:**
- `NoteLockingControls` component
- `AmendmentWorkflow` component
- `clinical_notes` table with lock status
- `clinical_note_amendments` — Amendment tracking
- `clinical_note_lock_audit` — Lock/unlock audit trail
- `clinical_field_provenance` — Field-level provenance

---

## Feature 14: Public Health Reporting Gateway

Four outbound public health integrations: immunization registry submission, syndromic surveillance reporting, electronic case reporting for reportable conditions, and PDMP queries for controlled substance monitoring.

**Why it matters:** These are regulatory requirements that most EHRs handle through separate vendor modules. Having them built into the edge function layer means a community health center or small hospital can meet state reporting mandates without buying additional software. The syndromic surveillance piece alone is something the CDC has been pushing for years and most small facilities still do manually.

**Key components:**
- `immunization-registry-submit` edge function
- `syndromic-surveillance-submit` edge function
- `ecr-submit` edge function — Electronic case reporting
- `pdmp-query` edge function — Prescription drug monitoring

---

## Feature 15: MCP Server Architecture — 10 Standardized Tool Servers

Ten Model Context Protocol servers exposing healthcare operations as standardized tool interfaces: FHIR CRUD, HL7/X12 transformation, prior authorization, clearinghouse operations, CMS coverage lookups, NPI validation, medical code lookups, database access, Claude API proxy, and edge function orchestration.

**Why it matters:** This is not just an API layer — it's an AI-native integration architecture. Any AI agent (not just Claude) can discover and use these tools through the MCP protocol. When the industry moves toward AI agents coordinating clinical workflows — and it will — this platform already has the tool layer they need. Most health tech companies are still building REST APIs. This is the next layer up.

**Key components:**
- `mcp-fhir-server` — FHIR CRUD operations
- `mcp-hl7-x12-server` — HL7/X12 transformation
- `mcp-prior-auth-server` — Prior authorization workflow
- `mcp-clearinghouse-server` — Clearinghouse integration
- `mcp-cms-coverage-server` — CMS LCD/NCD lookups
- `mcp-npi-registry-server` — NPI validation
- `mcp-medical-codes-server` — Medical code lookups
- `mcp-postgres-server` — Direct DB access
- `mcp-claude-server` — Claude API proxy
- `mcp-edge-functions-server` — Edge function orchestration

---

## Feature 16: AI Personalization Engine

The engagement side is not generic. The system learns from a patient's check-in history, mood patterns, and activity preferences to deliver personalized greetings, tailored daily check-in prompts, wellness suggestions calibrated to emotional state, and tracked content delivery.

**Why it matters:** This is not "Hello {firstName}" personalization. It's longitudinal relationship-building through AI. A senior who reported knee pain yesterday gets asked about it today. Someone whose mood has been declining gets different suggestions than someone on an upswing. This is what keeps seniors engaged with a wellness platform instead of abandoning it after two weeks.

**Key components:**
- `claude-personalization` edge function — Personalization engine
- `get-personalized-greeting` — Context-aware greetings
- `ai-check-in-questions` — Tailored daily check-in prompts
- `smart-mood-suggestions` — Mood-calibrated wellness suggestions
- `personalized_content_delivery` table — Content tracking
- `ai-missed-checkin-escalation` — Risk assessment from engagement gaps

---

## Feature 17: Master Patient Index with AI Matching

Duplicate patient detection with confidence scoring, full address comparison on expand, and defer/reject/merge workflows. The merge consolidates medication lists, care plans, and encounter histories with a full audit trail.

**Why it matters:** Duplicate patients are one of healthcare's oldest problems — same person registered twice with slightly different names creates fragmented records and safety risks. Large health systems pay companies like Verato millions for MPI management. This platform has a working review queue with AI-assisted matching built into the admin panel.

**Key components:**
- `MPIReviewQueue` component
- `mpiMatchingService` — Duplicate detection and scoring
- Defer/reject/merge action workflows
- Audit logging for all merge operations
- Search, filter, and sort capabilities

---

## Feature 18: Voice Command Infrastructure

Voice-driven navigation, check-in completion, and common actions through speech. Backed by 44x44px touch targets, 16px minimum fonts, and high contrast design throughout.

**Why it matters:** The target users are seniors with potential motor impairments, arthritis, or low tech literacy. Voice commands are not a novelty — they are an accessibility requirement. Most health apps are designed for 30-year-old product managers testing on iPhones. This is designed for a 78-year-old with tremor trying to report her blood pressure from a tablet at her kitchen table.

**Key components:**
- `VoiceActionContext` — System-wide voice state
- Voice command navigation support
- WCAG AA compliance (4.5:1 contrast minimum)
- 44x44px minimum touch targets
- 16px minimum font size, prefer 18px+
- Senior-friendly error messages in non-technical language

---

## Feature 19: SDOH Coding & Detection

Two-layer social determinants system: passive detection that analyzes clinical notes and check-in data to flag SDOH risks without requiring explicit screening, and coding suggestions that recommend ICD-10 Z-codes that most providers forget to add.

**Why it matters:** Social determinants drive 80% of health outcomes but are chronically under-documented and under-coded. CMS is increasingly tying reimbursement to SDOH documentation. The detection, coding, and reporting pipeline is built end to end — from passive detection through Z-code suggestion to FHIR-accessible population health analytics.

**Key components:**
- `sdoh-passive-detect` edge function — AI passive risk detection
- `sdoh-coding-suggest` edge function — ICD-10 Z-code recommendations
- `SDOHCoderAssist` component — Clinician review workflow
- `get_sdoh_assessments` FHIR endpoint — Population health analytics
- Z-code coverage: Z59.0 (homelessness), Z59.4 (food insecurity), transportation, financial strain, social isolation

---

## Feature 20: Gamification & Community Engagement System

Trivia games, word games, community photo sharing, daily affirmations, wellness program enrollment, and engagement scoring with risk-level flagging when participation drops.

**Why it matters:** Wellness platforms fail when people stop using them. This is not gamification for vanity metrics — it's a clinical early warning system disguised as community engagement. A senior who stops playing trivia and misses three check-ins might be declining, and the system notices before a family member does. The `ai-missed-checkin-escalation` edge function assesses risk and can trigger caregiver notification.

**Key components:**
- `trivia_game_results`, `word_game_results` tables
- `community_moments` — Member photo/story sharing
- `affirmations` — Motivational content delivery
- `user_engagements`, `feature_engagement` — Gamification tracking
- `wellness_enrollments` — Program enrollment
- `patient_engagement_scores` view — Engagement risk scoring
- `PatientEngagementDashboard` — Admin monitoring
- `ai-missed-checkin-escalation` — Risk from disengagement
- `notify-family-missed-check-in` — Caregiver alerts

---

## Feature 21: Clinical Personalization Engine

A five-layer personalization system that adapts every clinical output to the individual patient — not generic content, but care plans, treatment pathways, appointment prep, and patient education all contextualized to that patient's conditions, medications, allergies, social determinants, and reading level.

**Why it matters:** Most EHRs offer a library of static PDFs. This generates individualized clinical content that accounts for the whole patient — their medications, their allergies, their housing situation, their reading level. That is what personalized medicine is supposed to look like.

### Layer 1: Care Plan Generator (AI Skill #20)

Pulls the patient's active conditions, current medications, allergies, vitals, lab results, utilization history, AND their social determinants — housing stability, food insecurity, transportation barriers, financial strain — then generates a care plan with goals, interventions, barriers, activities, and care team assignments. Flags CCM/TCM billing eligibility. Every plan is born in "draft" status with `requiresReview: true`.

**Key components:**
- `ai-care-plan-generator/` edge function (multi-file: index, types, promptBuilder, patientContext, normalize, usageLogging)
- `carePlanAIService.ts` — Service layer
- 5 plan types: readmission prevention, chronic care, transitional care, high utilizer, preventive
- SDOH-aware barrier identification
- CPT code and billing eligibility flagging
- Model: Claude Sonnet 4.5

### Layer 2: Treatment Pathway Recommendations (AI Skill #23)

Recommends first-line through third-line interventions with evidence levels (A/B/C/D/expert consensus), guideline sources (ADA, ACC, USPSTF), contraindication cross-checks, and monitoring plans. Contextualized to severity, comorbidities, and current medications.

**Key components:**
- `ai-treatment-pathway/` edge function
- `treatmentPathwayService.ts` — Service layer
- Phases: first_line, second_line, third_line, adjunct, monitoring
- Allergy conflicts prominently flagged
- Model: Claude Sonnet 4.5

### Layer 3: Appointment Preparation Instructions (AI Skill #27)

Generates condition-specific prep at a 6th-grade reading level in the patient's preferred language, with fasting requirements, medication timing adjustments, what to bring, and what to expect. Delivered via SMS, email, print, or in-app.

**Key components:**
- `ai-appointment-prep-instructions/` edge function
- `appointmentPrepInstructionsService.ts` — Service layer
- 13 appointment types supported
- Multi-format delivery (SMS, email, HTML, print)
- Mobility, hearing, vision, cognitive accommodation
- Model: Claude Haiku 4.5

### Layer 4: Patient Education (AI Skill #22)

Generates health education content in four formats (article, bullet points, Q&A, step-by-step instructions) personalized to condition, language, and cognitive needs.

**Key components:**
- `ai-patient-education/` edge function
- `patientEducationService.ts` — Service layer
- Pre-built templates: medication adherence, fall prevention, diabetes basics, heart health
- 6th-grade reading level
- Model: Claude Haiku 4.5

### Layer 5: Dashboard Personalization

Analyzes clinical staff behavior patterns over 30 days and predicts what they'll need next. Learns which admin sections each provider uses most, optimizes dashboard layout, and suggests actions based on time of day and role.

**Key components:**
- `dashboardPersonalizationAI.ts` (442 lines) — Service layer
- `useAdminPersonalization.ts` (276 lines) — React hook
- `claude-personalization` edge function
- Role-aware (admin, billing, nurse, physician)
- Time-of-day optimization
- PHI-redacted behavior tracking
- Model: Claude Haiku 4.5

---

## Feature 22: Burnout Prevention Suite

A complete prevention and detection infrastructure for clinician burnout — the #1 workforce crisis in healthcare. Not a bolt-on wellness survey, but an integrated system with validated instruments, AI-driven interventions, peer support networks, manager visibility, and financial ROI tracking.

**Why it matters:** 63% of physicians report burnout symptoms. Nursing turnover costs hospitals $46,000 per nurse. Most health tech platforms treat clinician wellness as someone else's problem. Envision ATLUS treats it as a core product feature with validated instruments, AI interventions, and financial ROI tracking built into the same platform that generates the clinical workload. That is a complete loop.

### Validated Assessment

**BurnoutAssessmentForm** uses the Maslach Burnout Inventory (MBI) — the peer-reviewed, gold-standard instrument — scoring 22 questions across three dimensions: emotional exhaustion, depersonalization, and personal accomplishment. Four risk tiers with escalating interventions:

| Risk Level | Action |
|-----------|--------|
| Low | Standard wellness module access |
| Moderate | Nudge to check in, suggest peer support |
| High | Dashboard "Intervene" button, manager alerted |
| Critical | Urgent: peer support + supervisor check-in + EAP referral |

### Staff-Facing Tools

- **ResilienceHubDashboard** — Personal burnout radar: 30-day stress trends, daily check-in prompts, energy/mood tracking, module CTAs
- **PhysicianWellnessHub** — Physician-specific wellness hub with risk badges, achievement tracking
- **CompassionBattery** — Visual gauge of emotional resilience (compassion fatigue inverse)
- **WellnessCommandCenter** — Unified view: emotional state, documentation status, resilience progress

### Manager Visibility (Without Surveillance)

- **StaffWellnessDashboard** (550 lines) — Department-level risk counts, compassion fatigue scores, documentation debt hours, break compliance, "Intervene" button for high-risk staff
- **AdminBurnoutRadar** — Anonymous aggregate dashboards, team wellness stats, risk distribution, wellness alerts. Explicitly avoids "Big Brother" approach

### AI-Driven Interventions

- **SmartBreakEnforcer** — AI-optimized break scheduling around patient load; prevents break-skipping
- **ProactiveNudge** — AI-triggered wellness interventions based on burnout risk level
- **PeerCircleWarmHandoff** — Structured peer mentorship matching for at-risk staff
- **DocumentationDebtVisualizer** — Shows AI scribe time savings (directly anti-burnout)
- **CelebrationMoments** — Positive psychology: celebrates on-time streaks, wellness milestones

### 15 Evidence-Based Resilience Modules

Tailored for physicians, each with cited evidence and estimated duration:

1. "The Art of Saying No: Boundaries for Physicians"
2. "Prior Auth Survival Guide"
3. "Chart Smarter, Not Harder" — Documentation efficiency
4. "The 3-Minute Reset" — Micro-exercises between patients
5. "Delegation Without Guilt" — Team-based care
6. "Clinical Communication Mastery" — Difficult conversations
7. "Revenue Optimization Without Burnout" — CCM coding without overwork
8. "Overcoming Imposter Syndrome"
9. "Understanding & Healing from Moral Injury"
10. "Work-Life Integration: Beyond Balance"
11. "Managing Cognitive Overload" — Decision fatigue reduction
12. "Building Physician Peer Support Networks"
13. "Leveraging Technology Without Burnout" — Alert fatigue management
14. "Perfectionism in Medicine: Liability to Asset"
15. "Physician Financial Wellness" — Financial resilience

### Time Tracking & Work-Life Balance

- **TimeClockContext** — Auto clock-in on login, prompt clock-out on logout
- **TimeClockPage** — Hours today + weekly cumulative
- **TimeClockAdmin** — Manager view of shift data, payroll, streaks
- Streak gamification with celebration triggers for on-time arrivals
- Prevents "invisible overwork" through visibility

### Financial ROI

**StaffFinancialSavingsTracker** (600 lines) measures burnout prevention ROI across 10 categories: prevented readmissions, early interventions, care coordination, medication optimization, preventive care, documentation efficiency, telehealth efficiency, reduced ER visits, discharge planning, SDOH interventions. Shows verified vs. unverified savings, per-staff and per-position breakdowns, trend over time.

### Database Infrastructure

- `vw_staff_wellness_summary` — Aggregated staff wellness with compassion scores, documentation debt, mood trends
- `get_department_wellness_metrics()` RPC — Department-level risk aggregation
- `get_staff_wellness_list()` RPC — Paginated staff wellness list, filterable by risk level
- `time_clock_entries`, `time_clock_streaks`, `time_clock_settings` tables
- `staffWellnessService.ts` (345 lines), `resilienceHubService.ts` (300+ lines), `timeClockService.ts` (400+ lines)

---

## Feature 23: API Key Manager

Two-tier API key lifecycle management: tenant-level for organization admins and platform-level for super-admins. Keys are generated with 32 bytes of cryptographic entropy, immediately SHA-256 hashed — the raw key is shown exactly once and never stored.

**Why it matters:** This is what makes the platform an integration platform, not just an application. A hospital's IT team can generate API keys to connect their existing systems — lab feeds, scheduling systems, custom reporting tools — through authenticated, auditable, revocable access. Without this, every integration requires custom development. With this, it's self-service.

**Key components:**
- `ApiKeyManager` (940 lines) — Tenant admin key CRUD
- `SuperAdminApiKeyManager` (547 lines) — Platform-wide key management
- `generate-api-key` edge function — Cryptographically secure key generation with SHA-256 hashing
- `validate-api-key` edge function — Hash-based key validation
- `api_keys` table with `key_hash` (never stores plaintext)
- Search, filter, sort, enable/disable, permanent revocation
- CSV export for compliance audits
- Masked display format: `ak_<prefix>_--------`
- Auto-mask after 5-second display window
- Copy-to-clipboard with security logging
- Auto-refresh on 30-second intervals

---

## Feature 24: Template Maker

A dynamic documentation template builder that lets clinical staff create, edit, duplicate, and manage reusable templates with AI-assisted field binding. Templates use typed placeholder fields that can be auto-populated from patient clinical data.

**Why it matters:** Clinicians spend 2+ hours per day on documentation. Templates with AI-assisted field binding turn a 20-minute discharge summary into a 3-minute review-and-sign. That is not just efficiency — it directly connects to burnout prevention by reducing the documentation burden that drives clinicians out of healthcare.

**Key components:**
- `TemplateMaker` (988 lines) — Template creation, editing, duplication UI
- `documentation_templates` table — Template storage with version tracking
- 6 categories: clinical, administrative, communication, compliance, patient education, general
- 5 template types: document, form, letter, note, checklist
- 4 output formats: narrative, form, letter, structured
- Dynamic field builder with 6 field types: text, textarea, number, date, select, boolean
- `{placeholder}` syntax with runtime substitution
- AI-assisted mode with 3 quality tiers: fast, balanced, accurate
- Role-based template filtering (physician, nurse, NP, PA, case manager, social worker, admin)
- Version tracking, soft delete, cross-tenant sharing
- Search by name/description, filter by role and status

---

## Summary

| # | Feature | Category |
|---|---------|----------|
| 1 | Guardian Agent | AI Governance |
| 2 | Community-to-Clinical Data Bridge | Architecture |
| 3 | SMART on FHIR | Interoperability |
| 4 | AI Clinical Decision Support Suite | Clinical AI |
| 5 | Bed Management Command Center | Operations |
| 6 | AI Shift Handoff Synthesis | Patient Safety |
| 7 | My Health Hub (Cures Act) | Patient Access |
| 8 | Multi-Tenant White-Label | Architecture |
| 9 | Billing & Claims Pipeline | Revenue Cycle |
| 10 | Audit & Compliance Infrastructure | Compliance |
| 11 | Caregiver PIN-Based Access | Senior Care |
| 12 | Medication Safety Suite | Patient Safety |
| 13 | Note Locking & Amendments (21 CFR Part 11) | Compliance |
| 14 | Public Health Reporting Gateway | Population Health |
| 15 | MCP Server Architecture | AI Infrastructure |
| 16 | AI Personalization Engine | Engagement |
| 17 | Master Patient Index | Data Integrity |
| 18 | Voice Command Infrastructure | Accessibility |
| 19 | SDOH Coding & Detection | Social Determinants |
| 20 | Gamification & Engagement System | Senior Care |
| 21 | Clinical Personalization Engine | Clinical AI |
| 22 | Burnout Prevention Suite | Workforce Retention |
| 23 | API Key Manager | Integration |
| 24 | Template Maker | Documentation |

---

> *This document reflects the state of the platform as of February 2026. All features are implemented, tested, and backed by 10,099+ behavioral tests across 509 test suites.*
