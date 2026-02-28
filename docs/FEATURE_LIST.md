# Envision ATLUS I.H.I.S. -- Feature List

> **Intelligent Healthcare Interoperability System**
> Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
> Version: 2026-02-28
> Products: WellFit (Community) + Envision Atlus (Clinical)

---

## Platform Overview

Envision ATLUS I.H.I.S. is a dual-product, HIPAA-compliant healthcare platform combining **WellFit** (a community wellness engagement platform for seniors and caregivers) with **Envision Atlus** (an enterprise clinical care management engine for hospitals and providers). Both products share a common spine of identity, tenancy, FHIR/HL7 interoperability, billing infrastructure, and 26+ AI-powered services built on Anthropic Claude.

**Key Statistics:**
- **151 routes** across public, protected, admin, clinical, CHW, workflow, and EMS categories
- **147 edge functions** deployed on Supabase (Deno runtime)
- **26 AI edge functions** powered by Claude (Haiku 4.5, Sonnet 4.5, Opus 4.5)
- **11 MCP servers** providing 96 tools across 3 security tiers
- **50+ AI service-layer modules** for clinical reasoning, billing optimization, and patient engagement
- **458 database migrations** across ~248 tables with Row-Level Security
- **209 service files** in the service layer
- **10,304 tests** across 517 suites (100% pass rate)
- **Multi-tenant white-label architecture** with explicit CORS origins per tenant

---

## WellFit -- Community Wellness Platform

### For Seniors & Members

| Feature | Route | Description |
|---------|-------|-------------|
| Member Dashboard | `/dashboard` | Personalized home view with check-in status, engagement scores, and quick actions |
| Daily Check-In | `/check-in` | Daily wellness check-in with vitals (BP, HR, SpO2, glucose), mood, symptoms, and activity tracking |
| My Health Hub | `/my-health` | 21st Century Cures Act compliant portal for accessing personal health records |
| Health Observations | `/health-observations` | View vital signs and lab results via FHIR |
| Immunizations | `/immunizations` | Vaccine records via FHIR |
| Care Plans | `/care-plans` | Active care plans via FHIR |
| Allergies | `/allergies` | Allergy and intolerance list via FHIR |
| Conditions | `/conditions` | Medical conditions and diagnoses via FHIR |
| Medicine Cabinet | `/medicine-cabinet` | Personal medication tracking and management |
| Medication Management | `/medication-management` | Medication reminders, adherence tracking, and drug interaction warnings |
| Health Insights | `/health-insights` | AI-powered health analytics and trends |
| Health Tracker | `/health-dashboard` | Comprehensive health metrics dashboard |
| Dental Health | `/dental-health` | Dental health tracking dashboard |
| Self-Reporting | `/self-reporting` | Fallback self-reported health data when devices are unavailable |
| Vital Capture | `/vital-capture` | Manual vital sign entry interface |
| Wearable Dashboard | `/wearables` | Apple Watch, Fitbit, and other wearable device data aggregation |
| Smart Scale | `/devices/scale` | Connected smart scale integration |
| Blood Pressure Monitor | `/devices/blood-pressure` | Connected BP monitor integration |
| Glucometer | `/devices/glucometer` | Connected glucose monitor integration |
| Pulse Oximeter | `/devices/pulse-oximeter` | Connected pulse oximeter integration |
| Health Records Download | `/health-records-download` | Export personal records in PDF, FHIR, C-CDA, or CSV format |
| Telehealth Appointments | `/telehealth-appointments` | Schedule and join video visits |
| Ask a Nurse | `/ask-nurse` | AI-powered Q&A with nurse escalation |
| Community Moments | `/community` | Member-shared photos, stories, and social engagement |
| Word Find Game | `/word-find` | Cognitive engagement word puzzle game |
| Memory Lane Trivia | `/memory-lane-trivia` | Nostalgia-themed trivia game for cognitive engagement |
| Mental Health Dashboard | `/mental-health` | Mental health tracking and resources (feature-flagged) |
| Heart Health | `/heart-health` | Patient-facing cardiology dashboard (feature-flagged) |
| Pregnancy Care | `/pregnancy-care` | Patient-facing labor and delivery dashboard (feature-flagged) |
| Cancer Care | `/cancer-care` | Patient-facing oncology dashboard (feature-flagged) |
| Doctors View | `/doctors-view` | View latest check-in vitals and self-reports shared with your care team |
| Consent Management | `/consent-management` | Manage data sharing consents and preferences |
| Amendment Requests | `/my-amendments` | Request amendments to personal health records (45 CFR 164.526) |
| Notice of Privacy Practices | `/notice-of-privacy-practices` | HIPAA Notice of Privacy Practices |
| Profile | `/profile` | Personal profile management |
| Demographics | `/demographics` | Demographic information management |
| Settings | `/settings` | Application preferences and notification settings |
| Help | `/help` | AI-powered help and support |
| EMS Access | `/ems` | Emergency medical services quick access |

### For Caregivers

| Feature | Route | Description |
|---------|-------|-------------|
| Caregiver Access | `/caregiver-access` | PIN-based access portal for family caregivers (no login required) |
| Senior View | `/senior-view/:seniorId` | View loved one's check-in status and wellness data via PIN |
| Senior Reports | `/senior-reports/:seniorId` | View wellness reports for a senior via PIN |
| Caregiver Dashboard | `/caregiver-dashboard` | Authenticated caregiver home with alerts and status |
| Set Caregiver PIN | `/set-caregiver-pin` | Configure PIN-based access for family members |

### For Community Organizations

| Feature | Route | Description |
|---------|-------|-------------|
| Kiosk Check-In | `/kiosk/check-in` | Public kiosk for community site walk-in check-ins |
| Kiosk Dashboard | `/chw/kiosk-dashboard` | Admin view of kiosk activity and utilization |
| CHW Dashboard | `/chw/dashboard` | Community Health Worker home dashboard |
| CHW Vitals Capture | `/chw/vitals-capture` | Staff-assisted vital sign capture at community sites |
| Medication Photo Capture | `/chw/medication-photo` | AI-powered medication label and pill photo identification |
| SDOH Assessment | `/chw/sdoh-assessment` | Social Determinants of Health screening tool |
| Telehealth Lobby | `/chw/telehealth-lobby` | Telehealth waiting room for community sites |
| Provider Availability | `/provider/availability` | Provider schedule management for telehealth |
| Appointment Analytics | `/appointment-analytics` | Appointment utilization and no-show analytics |

---

## Envision Atlus -- Clinical Care Engine

### Role-Based Clinical Dashboards

| Feature | Route | Roles |
|---------|-------|-------|
| Physician Office Dashboard | `/physician-office` | 6-tab workspace: patients, orders, notes, schedule, messages, analytics |
| Physician Panel | `/physician-dashboard` | Clinical patient management with priority boards |
| Nurse Office Dashboard | `/nurse-office` | 6-tab nurse-specific workflow workspace |
| Nurse Panel | `/nurse-dashboard` | Nurse care management with bed status and handoffs |
| Nurse Census Board | `/nurse-census` | Real-time unit census with patient acuity |
| Case Manager Dashboard | `/case-manager-dashboard` | Care coordination, referrals, and discharge planning |
| Social Worker Dashboard | `/social-worker-dashboard` | SDOH assessments and community resource coordination |
| ER Dashboard | `/er-dashboard` | Emergency department patient flow and boarding |
| Specialist Dashboard | `/specialist/dashboard/:type` | Specialty-specific workflow by provider type |
| Staff Wellness Dashboard | `/staff-wellness` | Staff burnout monitoring and wellness resources |

### Patient Care & Documentation

| Feature | Route / Admin Section | Description |
|---------|----------------------|-------------|
| Unified Patient Chart | `/patient-chart/:patientId` | Comprehensive chart with tabs: meds, care plans, labs, vitals, immunizations, notes |
| Patient Avatar Body Map | `/patient-avatar/:patientId` | Visual body map with clinical markers, devices, SDOH indicators, and pregnancy overlay |
| Patient Engagement Dashboard | Admin: `patient-engagement` | Monitor senior activity levels to identify at-risk patients |
| Compass Riley AI Scribe | `/compass-riley` | Real-time AI medical transcription with 3 modes: SmartScribe, Compass Riley, Consultation |
| Clinical Note Summarization | Admin: `clinical-note-summary` | AI-generated SOAP notes, progress notes, and discharge summaries |
| Care Gap Detection | `/admin/care-gaps` | Identify and close preventive care gaps across patient panels |
| Care Coordination | `/care-coordination` | Multi-disciplinary care plan management (feature-flagged) |
| Readmission Risk Dashboard | `/readmissions` | AI-predicted readmission risk with intervention tracking |
| Community Readmission | `/community-readmission` | Community-facing readmission prevention dashboard |
| Referrals Management | `/referrals` | External referral tracking with aging analysis (feature-flagged) |
| Referral Aging Analysis | Admin: `referral-aging` | Track pending referrals by aging bucket with automated follow-up |
| Specialist Confirmation | Admin: `referral-completion` | Record specialist completion and close the referral loop |
| Discharge Tracking | `/discharge-tracking` | Post-discharge patient follow-up dashboard (feature-flagged) |
| Frequent Flyer Dashboard | `/frequent-flyers` | High utilizer analytics and intervention tracking (feature-flagged) |
| Remote Patient Monitoring | `/rpm-dashboard` | RPM vital trends and alert management |
| Clinical Alerts | `/clinical-alerts` | Real-time clinical alert routing and management |
| Questionnaire Analytics | `/questionnaire-analytics` | Questionnaire response analytics and trends (feature-flagged) |
| Healthcare Integrations | `/healthcare-integrations` | Integration status dashboard for FHIR, HL7, labs, pharmacy (feature-flagged) |
| Provider Assignment | Admin: `provider-assignment` | Assign attending, supervising, and consulting providers to encounters |
| Unacknowledged Results | Admin: `unacknowledged-results` | Track critical lab and imaging results requiring clinician review |
| Provider Task Queue | Admin: `provider-task-queue` | Inbox routing with SLA deadlines and escalation tracking |
| Result Escalation Engine | Admin: `result-escalation` | Auto-route abnormal values to specialist providers with SLA tracking |
| Provider Coverage & On-Call | Admin: `provider-coverage` | Absence coverage, on-call rotations, and automatic task routing |
| Paper Form Scanner | Admin: `paper-form-scanner` | AI-powered OCR for paper forms (rural hospital outage resilience) |
| Hospital Patient Enrollment | Admin: `hospital-enrollment` | Patient enrollment for clinical workflows |
| Field Visit Workflow | `/specialist/visit/:visitId` | Community-based specialist visit documentation |

### Bed Management & Patient Flow

| Feature | Route / Admin Section | Description |
|---------|----------------------|-------------|
| Bed Management Panel | `/bed-management` | Real-time bed inventory, assignments, and capacity forecasting |
| Shift Handoff Dashboard | `/shift-handoff` | AI-assisted nurse shift handoff with auto-scored patient risks |
| Patient Handoff System | Admin: `patient-handoff` | Secure inter-facility transfer of care (HIPAA compliant) |
| Hospital Transfer Portal | `/hospital-transfer` | Full transfer workflow with medication reconciliation |
| Receiving Dashboard | `/handoff/receiving` | Incoming transfer acceptance and preparation |
| Transfer Logs | `/transfer-logs` | Audit trail of all patient transfers |

### Clinical Specialty Modules

| Module | Route | Components | Status |
|--------|-------|------------|--------|
| **Labor & Delivery** | `/pregnancy-care` | 37 components: prenatal care, labor tracking, fetal monitoring, delivery records, postpartum assessments, PPD screening, AI birth plan generator, contraindication checker, patient education, billing suggestions, SDOH panel, shift handoff, progress notes, escalation, drug interaction alerts, guidelines compliance, discharge summary, metrics | Complete (8 sessions) |
| **Cardiology** | `/heart-health` | ECG results, echocardiography, heart failure assessment, cardiac device monitoring, cardiac registry, device battery alerts | Foundation built; Phase 1 pending (12-13 sessions) |
| **Oncology** | `/cancer-care` | Cancer registry, TNM staging, treatment tracking, overview dashboard, alerts | Foundation built; Phase 1 pending (11 sessions) |
| **Neurology Suite** | `/neuro-suite` | Cognitive assessment, stroke assessment, neuro dashboard | Built |
| **Memory Clinic** | `/memory-clinic/:patientId` | Dementia assessment, caregiver portal, stroke rehab dashboard | Built |
| **Physical Therapy** | `/physical-therapy` | PT assessments, treatment plans, session tracking | Built |
| **Dental** | `/dental-health` | Dental health dashboard with assessments, procedures, tooth chart, imaging | Built |
| **Mental Health** | `/mental-health` | Mental health tracking and screening tools | Built |

### Medication Safety

| Feature | Location | Description |
|---------|----------|-------------|
| Medication Manager | `/medication-manager` | Admin-level medication oversight for clinical staff |
| Drug Interaction Checker | Edge: `check-drug-interactions` | Real-time drug-drug interaction detection with PubMed evidence |
| AI Contraindication Detector | Edge: `ai-contraindication-detector` | Detect medication contraindications for patient context |
| AI Medication Reconciliation | Edge: `ai-medication-reconciliation` | Reconcile medications across care transitions |
| AI Medication Adherence | Edge: `ai-medication-adherence-predictor` | Predict medication non-adherence risk |
| Pill Identifier Service | Service layer | AI-powered pill identification from photos |
| Medication Label Reader | Service layer | AI-powered medication label text extraction |

### Revenue Cycle Management

| Feature | Admin Section ID | Description |
|---------|-----------------|-------------|
| Revenue Dashboard | `revenue-dashboard` | Real-time revenue analytics and optimization opportunities |
| SmartScribe Atlus | `smartscribe-atlus` | AI transcription optimized for maximum billing accuracy |
| Billing & Claims Management | `billing-dashboard` | Claims processing monitoring and revenue tracking |
| Claims Submission Center | `claims-submission` | Generate and submit 837P claims to clearinghouses |
| Claims Appeals & Resubmission | `claims-appeals` | AI-assisted appeal letters for denied claims |
| Claim Resubmission Workflow | `claim-resubmission` | Correct denied claims, track resubmission chains, void unrecoverable claims |
| Claim Aging Dashboard | `claim-aging` | Track claims by aging bucket to identify revenue bottlenecks |
| Prior Authorization Center | `prior-auth` | CMS-0057-F compliant prior auth requests, decisions, and appeals |
| Superbill Provider Sign-Off | `superbill-review` | Review and approve superbills before clearinghouse submission |
| Billing Queue | `billing-queue` | Bridge signed encounters to superbill drafts with one-click generation |
| Eligibility Verification | `eligibility-verification` | Verify patient insurance coverage (270/271) before billing to prevent denials |
| ERA Payment Posting | `era-payment-posting` | Match ERA/835 remittance advice to claims and post payments |
| Undercoding Detection | `undercoding-detection` | Compare AI-suggested codes vs billed codes to identify revenue gaps |
| Documentation Gap Indicator | `documentation-gap` | Alerts showing what to document to qualify for higher E/M levels |
| HCC Opportunity Flags | `hcc-opportunity-flags` | Identify expiring and missing HCC diagnoses for Medicare Advantage risk adjustment |
| CCM Autopilot | `ccm-autopilot` | Automatic tracking of 20+ minute interactions for CCM billing (CPT 99490) |
| SDOH Billing Encoder | `sdoh-billing` | Social determinants of health-aware medical coding |
| Provider Registry | `provider-registry` | Register and verify billing providers via NPI Registry (NPPES auto-populate) |
| Staff Financial Savings | `staff-financial-savings` | Track cost savings by nurse, position, and department |
| EDI Clearinghouse Config | Admin: `clearinghouse-config` | Configure Waystar, Change Healthcare, or Availity credentials |
| Billing Review | `/billing/review` | Detailed billing review dashboard (feature-flagged) |
| Revenue Analytics | `/revenue-dashboard` | Revenue trend analytics (feature-flagged) |
| AI Revenue Dashboard | `/admin/ai-revenue` | AI-powered revenue optimization insights |
| AI Cost Dashboard | `/admin/ai-cost` | AI service cost tracking and budget analysis (super admin) |

### EMS & Emergency Response

| Feature | Route | Description |
|---------|-------|-------------|
| EMS Metrics Dashboard | `/ems/metrics` | EMS response time, transport, and outcome analytics (feature-flagged) |
| Coordinated Response | `/ems/coordinated-response/:id` | Multi-agency coordinated emergency response dashboard (feature-flagged) |
| Emergency Alert Dispatch | Edge function | Real-time emergency alert routing to on-call providers |
| Constable Dispatch | `/constable-dispatch` | Law enforcement welfare check dispatch (feature-flagged) |
| Law Enforcement Landing | `/law-enforcement` | Public-facing law enforcement coordination portal (feature-flagged) |

---

## AI-Powered Services

### Clinical AI (16 Edge Functions)

| Service | Edge Function | Model Tier | Description |
|---------|--------------|------------|-------------|
| Readmission Risk Predictor | `ai-readmission-predictor` | Sonnet | Predict 30-day readmission risk with contributing factors |
| Fall Risk Predictor | `ai-fall-risk-predictor` | Sonnet | Assess patient fall risk based on clinical data |
| Infection Risk Predictor | `ai-infection-risk-predictor` | Sonnet | Predict healthcare-associated infection risk |
| SOAP Note Generator | `ai-soap-note-generator` | Sonnet | Generate structured SOAP notes from encounter data |
| Progress Note Synthesizer | `ai-progress-note-synthesizer` | Sonnet | Synthesize multi-source progress notes |
| Care Plan Generator | `ai-care-plan-generator` | Sonnet | Generate individualized care plans |
| Discharge Summary | `ai-discharge-summary` | Sonnet | Generate discharge summaries with follow-up instructions |
| Treatment Pathway | `ai-treatment-pathway` | Sonnet | Reference evidence-based treatment pathways for 12+ conditions |
| Clinical Guideline Matcher | `ai-clinical-guideline-matcher` | Sonnet | Match patient data to clinical guidelines for 12+ conditions |
| Contraindication Detector | `ai-contraindication-detector` | Sonnet | Detect medication contraindications for patient context |
| Medication Reconciliation | `ai-medication-reconciliation` | Sonnet | Reconcile medications across care transitions |
| Medication Adherence Predictor | `ai-medication-adherence-predictor` | Sonnet | Predict medication non-adherence risk |
| Medication Instructions | `ai-medication-instructions` | Haiku | Generate patient-friendly medication instructions |
| Referral Letter Generator | `ai-referral-letter` | Sonnet | Generate specialist referral letters |
| Appointment Prep Instructions | `ai-appointment-prep-instructions` | Haiku | Generate patient-specific appointment preparation instructions |
| Patient Education Generator | `ai-patient-education` | Haiku | Generate personalized patient education materials |

### Community AI (6 Edge Functions)

| Service | Edge Function | Model Tier | Description |
|---------|--------------|------------|-------------|
| Check-In Question Generator | `ai-check-in-questions` | Haiku | Personalized daily check-in questions based on history |
| Missed Check-In Escalation | `ai-missed-checkin-escalation` | Sonnet | Risk scoring for missed check-in patterns |
| Smart Mood Suggestions | `smart-mood-suggestions` | Haiku | Wellness suggestions based on mood data |
| Patient Q&A Bot | `ai-patient-qa-bot` | Haiku | Community member health question answering |
| Personalization Engine | `claude-personalization` | Haiku | Content and experience personalization |
| Personalized Greeting | `get-personalized-greeting` | Haiku | AI greeting based on engagement history |

### Shared AI (6 Edge Functions)

| Service | Edge Function | Model Tier | Description |
|---------|--------------|------------|-------------|
| Care Escalation Scorer | `ai-care-escalation-scorer` | Sonnet | Score care escalation urgency across both systems |
| Caregiver Briefing | `ai-caregiver-briefing` | Haiku | Generate plain-language caregiver status briefings |
| Avatar Entity Extractor | `ai-avatar-entity-extractor` | Sonnet | Extract clinical entities for patient avatar body map |
| Billing Suggester | `ai-billing-suggester` | Sonnet | Suggest billing codes from encounter documentation |
| FHIR Semantic Mapper | `ai-fhir-semantic-mapper` | Sonnet | Map legacy data to FHIR R4 resources semantically |
| Schedule Optimizer | `ai-schedule-optimizer` | Sonnet | Optimize provider and appointment scheduling |

### Additional AI Edge Functions

| Service | Edge Function | Description |
|---------|--------------|-------------|
| Provider Assistant | `ai-provider-assistant` | AI assistant for provider workflow queries |
| Coding Suggest | `coding-suggest` | AI-powered CPT/ICD-10 code suggestions from documentation |
| SDOH Coding Suggest | `sdoh-coding-suggest` | Social determinants Z-code suggestions |
| Claude Chat | `claude-chat` | General-purpose Claude conversation interface |

### Compass Riley -- AI Medical Scribe (Route: `/compass-riley`)

| Mode | Description |
|------|-------------|
| SmartScribe Mode | Real-time medical transcription with SOAP note generation and billing code extraction |
| Compass Riley Mode | Progressive clinical reasoning with anti-hallucination grounding, PubMed evidence retrieval, guideline matching for 12+ conditions, and conversation drift protection across 21 clinical domains |
| Consultation Mode | Physician clinical reasoning partner with structured case presentation, Socratic reasoning, differential diagnosis with red flags and key tests, cannot-miss diagnoses with severity classification, and peer consult prep in SBAR format for 12 specialties |

**Compass Riley Features:**
- Anti-hallucination grounding in all prompt paths
- Progressive clinical reasoning across encounters
- Conversation drift protection (21 domains)
- PubMed evidence retrieval with zero PHI leakage
- Clinical guideline matching (12+ conditions)
- Treatment pathway references (12+ conditions)
- Enhanced differentials with red flags, key tests, and literature notes
- Structured cannot-miss diagnoses with severity levels
- Peer consult prep in SBAR format for 12 specialties
- Voice learning and correction
- Session feedback and quality tracking

### AI Service Layer (50+ Modules in `src/services/ai/`)

| Category | Services |
|----------|----------|
| Clinical Decision Support | Readmission prediction (feature extractor, model config, predictor), fall risk, infection risk, holistic risk assessment, clinical guideline matching, treatment pathway, contraindication detection |
| Documentation | SOAP notes, progress notes, discharge summaries, care plans, referral letters, patient education |
| Billing & Revenue | Billing code suggestion, billing optimization engine, undercoding detection, SDOH coding, HCC opportunity detection, CCM eligibility scoring |
| Patient Engagement | Dashboard personalization, patient outreach, pill identification, medication label reading, patient Q&A, missed check-in escalation |
| Operations | Bed optimization, schedule optimization, field visit optimization, handoff risk synthesis, welfare check dispatch |
| Security & Compliance | HIPAA violation prediction, PHI exposure risk scoring, security anomaly detection, emergency access intelligence |
| Transparency & Accuracy | AI accuracy tracking, audit report generation, confidence scoring, model cards |
| Interoperability | FHIR semantic mapping, HL7 v2 interpretation |
| Care Coordination | Care escalation scoring, caregiver briefing, care team chat summarization |
| Medication Safety | Medication reconciliation, adherence prediction, contraindication detection, medication instructions |

---

## Healthcare Interoperability

### FHIR R4

| Feature | Description |
|---------|-------------|
| FHIR R4 Server | Full FHIR R4 REST API via `fhir-r4` edge function |
| FHIR Metadata | Capability statement endpoint via `fhir-metadata` |
| 21 FHIR Resource Services | Patient, Encounter, Condition, MedicationRequest, Medication, Observation, Procedure, DiagnosticReport, Immunization, AllergyIntolerance, CarePlan, CareTeam, Goal, Practitioner, PractitionerRole, Organization, Location, DocumentReference, Provenance, SDOH, HealthEquity |
| Specialty FHIR | Cardiology, dental, L&D, oncology sub-services |
| Medication Affordability | FHIR-based medication cost and alternative lookup |
| FHIR Data Mapper | Transform legacy data into FHIR-compliant formats (admin section) |
| FHIR Questionnaire Builder | AI-assisted clinical questionnaire creation (admin section) |
| AI-Enhanced FHIR Analytics | Real-time patient insights and clinical decision support (admin section) |
| FHIR Conflict Resolution | Resolve sync conflicts from external EHR systems (`/admin/fhir-conflicts`) |
| Enhanced FHIR Export | Bulk FHIR resource export via `enhanced-fhir-export` |
| C-CDA Export | Consolidated CDA document generation via `ccda-export` |
| FHIR Semantic Mapping | AI-powered legacy-to-FHIR data transformation |
| PDF Health Summary | Patient-facing PDF health summary generation |

### HL7 v2.x

| Feature | Description |
|---------|-------------|
| HL7 Message Receiver | Inbound HL7 v2.x message processing via `hl7-receive` |
| HL7/X12 Message Lab | Parse, validate, and convert HL7 v2.x and X12 837P messages (admin section) |
| HL7-to-FHIR Conversion | Transform HL7 v2.x messages to FHIR R4 resources |

### X12 EDI

| Feature | Description |
|---------|-------------|
| 837P Claim Generation | Generate X12 837P professional claims via `generate-837p` |
| X12 Claim Generator | UI component for X12 claim creation and validation |
| X12 997 Parser | Functional acknowledgment parsing and tracking |

### SMART on FHIR

| Feature | Route / Function | Description |
|---------|-----------------|-------------|
| SMART App Management | `/admin/smart-apps` | Register and manage SMART on FHIR applications |
| SMART Authorization | `smart-authorize` | OAuth2 authorization endpoint |
| SMART Token | `smart-token` | OAuth2 token endpoint |
| SMART Configuration | `smart-configuration` | `.well-known/smart-configuration` discovery |
| SMART App Registration | `smart-register-app` | Dynamic client registration |
| SMART Revocation | `smart-revoke` | Token revocation endpoint |

### Public Health Reporting

| Feature | Edge Function | Description |
|---------|--------------|-------------|
| Immunization Registry | `immunization-registry-submit` | Submit immunization records to state registries |
| Syndromic Surveillance | `syndromic-surveillance-submit` | Report syndromic data to public health authorities |
| Electronic Case Reporting | `ecr-submit` | Automated electronic case reporting |
| PDMP Query | `pdmp-query` | Prescription Drug Monitoring Program lookups |
| Public Health Dashboard | Admin: `public-health-reporting` | Monitor all public health data transmissions |

---

## Security & Compliance

### HIPAA Controls

| Feature | Route / Section | Description |
|---------|----------------|-------------|
| Facility Security Dashboard | Admin: `tenant-security` | Real-time security monitoring with alert management and session tracking |
| Audit Logs | Admin: `tenant-audit-logs` | PHI access logs and administrative action audit trail |
| Compliance Report | Admin: `tenant-compliance` | HIPAA and security compliance status reporting |
| Breach Notification Engine | Admin: `breach-notification` | HIPAA breach incident tracking with risk assessment and 60-day notification compliance |
| BAA Tracking | Admin: `baa-tracking` | Business associate agreement lifecycle management and renewal tracking |
| Patient Amendment Review | Admin: `patient-amendment-review` | Review patient requests to amend health records (45 CFR 164.526) |
| Training Compliance | Admin: `training-compliance` | HIPAA workforce security awareness training tracking |
| Configuration Change History | Admin: `tenant-config-history` | Full audit trail of all configuration changes with CSV/JSON export |
| Encounter Audit Timeline | Admin: `encounter-audit-timeline` | Chronological audit of encounter status changes, field edits, and access events |
| MFA Compliance | Admin: `mfa-compliance` | Monitor MFA enrollment across admin and clinical staff |
| PHI Access Logging | Service: `phiAccessLogger` | Every PHI read/write logged with user, timestamp, and reason |
| Idle Timeout | Component | Auto-logout after 15 minutes of inactivity (HIPAA compliance) |
| PHI Encryption | Edge: `phi-encrypt` | Server-side PHI field encryption |
| PIN-Based Auth | Edge functions | Hashed PIN verification for caregiver and admin access |
| Passkey Authentication | Edge functions | WebAuthn/FIDO2 passwordless authentication |
| Consent Management | `/consent-management` | Patient data sharing consent preferences |

### SOC2 Readiness

| Feature | Route | Description |
|---------|-------|-------------|
| SOC2 Compliance Dashboard | `/soc-dashboard` | Comprehensive SOC2 controls monitoring |
| SOC2 Security Dashboard | Admin component | Multi-section SOC2 security assessment |

### HTI-1 / HTI-2 Compliance

| Feature | Route / Section | Description |
|---------|----------------|-------------|
| AI Model Cards | `/admin/model-cards` | HTI-1 compliant AI/ML model documentation and risk classification |
| AI Transparency Log | Database table | Every AI decision logged with model version, input hash, and confidence score |
| Patient Descriptions | Database: `ai_skills.patient_description` | Plain-language explanations of all 60 AI skills for patient transparency |
| Healthcare Algorithms Dashboard | `/admin/healthcare-algorithms` | Algorithm inventory and documentation |
| AI Accuracy Dashboard | `/admin/ai-accuracy` | AI prediction accuracy monitoring and validation |

### ONC Certification

| Feature | Route | Description |
|---------|-------|-------------|
| SAFER Guides Assessment | `/admin/safer-guides` | ONC SAFER Guides EHR safety self-assessment tool |

---

## Platform Administration

### Tenant & Organization Management

| Feature | Route / Section | Description |
|---------|----------------|-------------|
| Intelligent Admin Panel | `/admin` | Mission Control orchestrator with category-based section navigation and pinnable dashboards |
| Super Admin Dashboard | `/super-admin` | Platform-level administration and oversight |
| Multi-Tenant Selector | `/tenant-selector` | Switch between tenant contexts |
| Multi-Tenant Monitor | `/multi-tenant-monitor` | Cross-tenant health monitoring |
| Enterprise Migration | `/enterprise-migration` | Data migration tools for enterprise onboarding |
| Facility Management | Admin: `facility-management` | Manage hospitals, clinics, and facilities |
| Module Configuration | Admin: `module-configuration` | Enable or disable platform modules per tenant |
| Tenant IT Dashboard | `/it-admin` | IT administrator operations dashboard |
| System Administration | `/admin/system` | System-level configuration and monitoring |

### User & Role Management

| Feature | Route / Section | Description |
|---------|----------------|-------------|
| User Management | Admin: `user-management` | Manage patient and staff accounts |
| Staff Role Management | Admin: `user-role-management` | Assign, change, and revoke roles with hierarchy enforcement and audit logging |
| User Provisioning | Admin: `user-provisioning` | Create new user accounts and manage pending registrations |
| Enroll Senior | `/admin/enroll-senior` | Individual senior enrollment form |
| Bulk Enrollment | `/admin/bulk-enroll` | CSV-based bulk patient enrollment |
| Admin Profile Editor | `/admin-profile-editor` | Admin user profile management |
| Admin Settings | `/admin/settings` | Administrative preferences and configuration |
| API Key Management | `/admin/api-keys` | Generate and manage API keys (super admin only) |

### Data & Analytics

| Feature | Route / Section | Description |
|---------|----------------|-------------|
| Reports & Analytics | Admin: `reports-analytics` | System-wide analytics and insights |
| Data Export | Admin: `data-export` | Export check-in data and advanced admin functions |
| Bulk Export | `/admin/bulk-export` | Bulk data export with format selection |
| Admin Reports | `/admin/reports` | Printable report generation (feature-flagged) |
| Quality Measures | Admin: `quality-measures` | eCQM, HEDIS, MIPS, and Star Ratings performance tracking |
| Photo Approval | `/admin/photo-approval` | Moderate community-submitted photos |
| Template Maker | `/template-maker` | Create document templates for clinical workflows |

### Guardian Agent (Self-Healing System)

| Feature | Route | Description |
|---------|-------|-------------|
| Guardian Agent Dashboard | `/guardian/dashboard` | Self-healing system monitoring with anomaly detection |
| Guardian Approvals List | `/guardian/approvals` | Review and approve system-recommended fixes |
| Guardian Approval Form | `/guardian/approval/:ticketId` | Detailed fix approval workflow |
| Guardian Eyes Recording | Background service | Smart session recording (1% sampling + all errors and security events) |
| Guardian PR Service | Edge function | Automated pull request generation for approved fixes |

### Time & Attendance

| Feature | Route | Description |
|---------|-------|-------------|
| Time Clock | `/time-clock` | Staff clock-in/out with shift tracking (feature-flagged) |
| Time Clock Admin | `/admin/time-clock` | Administrative time entry management and export |

---

## MCP Servers (Model Context Protocol)

11 MCP servers providing 96 tools for AI-assisted healthcare operations:

| Server | Tools | Tier | Description |
|--------|-------|------|-------------|
| `mcp-fhir-server` | 14 | Tier 3 (Service Role) | FHIR CRUD operations across all resource types |
| `mcp-hl7-x12-server` | 9 | Tier 3 | HL7 v2.x parsing, validation, and FHIR conversion; X12 837P generation |
| `mcp-prior-auth-server` | 11 | Tier 3 | Prior authorization lifecycle: create, submit, check status, appeal, FHIR conversion |
| `mcp-clearinghouse-server` | 10 | Tier 3 | Clearinghouse integration: submit claims, check status, process remittance |
| `mcp-cms-coverage-server` | 9 | Tier 2 (Admin) | CMS LCD/NCD lookups and coverage determination |
| `mcp-npi-registry-server` | 8 | Tier 2 | NPI validation, provider search, taxonomy codes, bulk validation |
| `mcp-pubmed-server` | 7 | Tier 2 | PubMed article search, abstracts, citations, clinical trial lookups, MeSH terms |
| `mcp-medical-codes-server` | 9 | Tier 3 | CPT, ICD-10, HCPCS, and modifier code lookups with validation |
| `mcp-postgres-server` | 7 | Tier 3 | Direct database analytics with tenant-scoped query safety |
| `mcp-edge-functions-server` | 7 | Tier 3 | Edge function orchestration, batch invocation, and health monitoring |
| `mcp-claude-server` | 5 | Tier 1 (Public) | Claude API proxy for text analysis, summarization, and suggestions |

---

## Edge Functions (147 Deployed)

### Authentication & Identity (20)

`login`, `register`, `envision-login`, `envision-totp-setup`, `envision-totp-verify`, `envision-totp-use-backup`, `envision-verify-pin`, `envision-check-super-admin`, `envision-complete-reset`, `envision-request-reset`, `admin_register`, `admin_start_session`, `admin_end_session`, `admin_set_pin`, `admin-totp-setup`, `admin-totp-verify`, `verify-admin-pin`, `setup-admin-credentials`, `login-security`, `hash-pin`

### Passkey / WebAuthn (4)

`passkey-auth-start`, `passkey-auth-finish`, `passkey-register-start`, `passkey-register-finish`

### Verification & Security (5)

`verify-hcaptcha`, `sms-send-code`, `sms-verify-code`, `verify-pin-reset`, `request-pin-reset`

### Messaging & Notifications (12)

`send-sms`, `send-email`, `send-push-notification`, `send_welcome_email`, `send-appointment-reminder`, `send-telehealth-appointment-notification`, `send-team-alert`, `emergency-alert-dispatch`, `send-checkin-reminders`, `send-check-in-reminder-sms`, `send-consecutive-missed-alerts`, `send-referral-followup-reminders`

### Community Wellness (7)

`create-checkin`, `notify-family-missed-check-in`, `notify-stale-checkins`, `send-stale-reminders`, `nurse-question-auto-escalate`, `admin-user-questions`, `enrollClient`

### Clinical Operations (9)

`bed-management`, `bed-optimizer`, `bed-capacity-monitor`, `detect-no-shows`, `process-appointment-reminders`, `ld-alert-notifier`, `vital-threshold-monitor`, `security-alert-processor`, `get-risk-assessments`

### SMART on FHIR (5)

`smart-authorize`, `smart-token`, `smart-configuration`, `smart-register-app`, `smart-revoke`

### Telehealth (2)

`create-patient-telehealth-token`, `create-telehealth-room`

### Data Management (7)

`bulk-export`, `export-status`, `user-data-management`, `mobile-sync`, `update-profile-note`, `update-voice-profile`, `save-fcm-token`

### Medical Processing (7)

`check-drug-interactions`, `coding-suggest`, `sdoh-coding-suggest`, `process-medical-transcript`, `realtime_medical_transcription`, `extract-patient-form`, `process-vital-image`

### FHIR & Interoperability (4)

`fhir-r4`, `fhir-metadata`, `ccda-export`, `enhanced-fhir-export`

### HL7 & Public Health (4)

`hl7-receive`, `immunization-registry-submit`, `syndromic-surveillance-submit`, `ecr-submit`

### Billing & Revenue (2)

`generate-837p`, `generate-api-key`

### AI Services (26)

`ai-readmission-predictor`, `ai-fall-risk-predictor`, `ai-infection-risk-predictor`, `ai-soap-note-generator`, `ai-progress-note-synthesizer`, `ai-care-plan-generator`, `ai-discharge-summary`, `ai-treatment-pathway`, `ai-clinical-guideline-matcher`, `ai-contraindication-detector`, `ai-medication-reconciliation`, `ai-medication-adherence-predictor`, `ai-medication-instructions`, `ai-referral-letter`, `ai-appointment-prep-instructions`, `ai-patient-education`, `ai-check-in-questions`, `ai-missed-checkin-escalation`, `ai-patient-qa-bot`, `ai-care-escalation-scorer`, `ai-caregiver-briefing`, `ai-avatar-entity-extractor`, `ai-billing-suggester`, `ai-fhir-semantic-mapper`, `ai-schedule-optimizer`, `ai-provider-assistant`

### System Operations (9)

`health-monitor`, `system-status`, `prometheus-metrics`, `daily-backup-verification`, `nightly-excel-backup`, `cleanup-temp-images`, `phi-encrypt`, `pdmp-query`, `safer-guides-pdf`

### Guardian Agent (3)

`guardian-agent`, `guardian-agent-api`, `guardian-pr-service`

### AI Infrastructure (3)

`agent-orchestrator`, `claude-chat`, `log-ai-confidence-score`

### MCP Servers (11)

`mcp-claude-server`, `mcp-clearinghouse-server`, `mcp-cms-coverage-server`, `mcp-edge-functions-server`, `mcp-fhir-server`, `mcp-hl7-x12-server`, `mcp-medical-codes-server`, `mcp-npi-registry-server`, `mcp-postgres-server`, `mcp-prior-auth-server`, `mcp-pubmed-server`

---

## Infrastructure

### Architecture

| Component | Technology |
|-----------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4.1 |
| Backend | Supabase (PostgreSQL 17), Deno Edge Functions |
| AI Engine | Anthropic Claude (Haiku 4.5, Sonnet 4.5, Opus 4.5) |
| Authentication | Supabase Auth with JWT, TOTP MFA, WebAuthn/Passkey, PIN-based access |
| Real-time | Supabase Realtime (WebSocket subscriptions) |
| Storage | Supabase Storage with PHI encryption |
| Monitoring | Prometheus metrics, Guardian Agent self-healing, performance monitoring |
| State Management | React Query (TanStack), React Context (10 contexts) |
| Testing | Vitest, React Testing Library (10,304 tests, 517 suites) |

### Multi-Tenant White-Label

| Capability | Description |
|------------|-------------|
| Tenant Isolation | Row-Level Security on all tables with `get_current_tenant_id()` |
| Custom Branding | Per-tenant colors, logos, and domain via `useBranding()` hook |
| Module Access | Two-tier entitlement system: paid-for + enabled via `useModuleAccess()` |
| Explicit CORS | `ALLOWED_ORIGINS` env var with per-tenant domains (no wildcards) |
| License Types | `0` = Both products, `8` = Atlus only, `9` = WellFit only |
| Tenant Suspension | Login enforcement and UI banners for suspended tenants |

### Database

| Metric | Count |
|--------|-------|
| Migrations | 458 |
| Tables (estimated) | ~248 |
| Views (materialized + standard) | 30+ |
| RLS Policies | All tables with tenant and user scoping |

### Codebase Health (as of 2026-02-28)

| Metric | Value |
|--------|-------|
| Tests | 10,304 passed, 0 failed |
| Test Suites | 517 |
| Typecheck | 0 errors |
| Lint | 0 errors, 0 warnings |
| Service Files | 209 |
| React Contexts | 10 |
| Edge Functions | 147 deployed |
| MCP Servers | 11 (96 tools) |
| AI Edge Functions | 26 |
| AI Service Modules | 50+ |
| God Files (>600 lines) | 1 flagged (SOC2ComplianceDashboard) |

---

*Generated from codebase crawl on 2026-02-28. Only features with actual routes, components, edge functions, or service implementations are listed. No invented features.*
