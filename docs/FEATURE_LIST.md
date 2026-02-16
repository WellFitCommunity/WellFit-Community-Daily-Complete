# Envision ATLUS I.H.I.S. — Complete Feature List

> **Intelligent Healthcare Interoperability System**
> **Generated:** 2026-02-16 (from live codebase crawl)
> **Products:** WellFit (Community) + Envision Atlus (Clinical)
> **Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.**

---

## Platform at a Glance

| Metric | Count |
|--------|-------|
| User-facing routes | 193 |
| Admin panel sections | 48 |
| Edge functions (backend) | 144 |
| AI-powered services | 70+ registered skills |
| MCP integration servers | 11 |
| Database tables | 248+ |
| Test suites | 429 (8,415 tests, 100% pass) |

**Two products. One codebase. Deployable independently or together.**

---

## WellFit — Community Wellness Platform

*For seniors, caregivers, and community organizations.*

### Daily Engagement

| Feature | Route | Description |
|---------|-------|-------------|
| Daily Check-In | `/check-in` | Mood, vitals (BP, HR, glucose, O2), symptoms, activity tracking |
| Health Dashboard | `/dashboard` | Personalized health summary with AI-generated greetings |
| Health Insights | `/health-insights` | Trends and patterns from check-in data |
| Self-Reporting | `/self-reporting` | Fallback health data entry when check-in unavailable |
| Engagement Scoring | — | 0-100 point system across all activities |
| Automated Reminders | — | SMS/push check-in reminders with graduated escalation |
| Missed Check-In Alerts | — | AI risk scoring when engagement drops; family notification |

### My Health Hub (21st Century Cures Act)

| Feature | Route | Description |
|---------|-------|-------------|
| My Health Hub | `/my-health` | Central hub for patient access to their own records |
| Health Observations | `/health-observations` | Vital signs and lab results |
| Immunizations | `/immunizations` | Vaccine records |
| Care Plans | `/care-plans` | Active care plans |
| Allergies | `/allergies` | Allergy/intolerance list |
| Conditions | `/conditions` | Medical diagnoses |
| Medicine Cabinet | `/medicine-cabinet` | Medication tracking |
| Health Records Download | `/health-records-download` | Export as PDF, FHIR, C-CDA, or CSV |
| Telehealth Appointments | `/telehealth-appointments` | Video visit scheduling |

### Gamification & Wellness

| Feature | Route | Description |
|---------|-------|-------------|
| Memory Lane Trivia | `/memory-lane-trivia` | Daily trivia games with scoring |
| Word Find | `/word-find` | Word puzzle games |
| Community Moments | `/community` | Photo/story sharing gallery |
| Wellness Enrollments | — | Program enrollment tracking |
| Affirmations | — | Motivational content delivery |
| Personalized Content | — | AI-driven content recommendations |

### Caregiver & Family Access

| Feature | Route | Description |
|---------|-------|-------------|
| Caregiver PIN Access | `/caregiver-access` | 30-minute read-only sessions with 4-digit PIN |
| Senior View | `/senior-view/:id` | Family access to check-ins, mood trends, meds |
| Senior Reports | `/senior-reports/:id` | Printable health reports for family |
| Caregiver Dashboard | `/caregiver-dashboard` | Authenticated caregiver overview |
| Set Caregiver PIN | `/set-caregiver-pin` | Configure PIN for family members |
| Access Audit Trail | — | "Who viewed my data" logging |

### Device Integration

| Feature | Route | Description |
|---------|-------|-------------|
| Wearables Dashboard | `/wearables` | Apple Watch, Fitbit, Google Fit sync |
| Smart Scale | `/devices/scale` | Smart scale data integration |
| Blood Pressure Monitor | `/devices/blood-pressure` | BP monitor integration |
| Glucometer | `/devices/glucometer` | Glucometer data integration |
| Pulse Oximeter | `/devices/pulse-oximeter` | SpO2 monitor integration |
| Vital Capture | `/vital-capture` | Manual vital entry |

### Patient Rights & Consent

| Feature | Route | Description |
|---------|-------|-------------|
| Consent Management | `/consent-management` | Manage all consent preferences |
| Privacy Consent | `/consent-privacy` | Privacy consent flow |
| Photo Consent | `/consent-photo` | Photo sharing consent |
| Privacy Notice | `/notice-of-privacy-practices` | HIPAA privacy notice |
| Amendment Requests | `/my-amendments` | Request corrections to health records (45 CFR 164.526) |

---

## Envision Atlus — Clinical Care Engine

*For hospitals, clinicians, and care teams.*

### Clinical Workflows

| Feature | Route | Description |
|---------|-------|-------------|
| Nurse Dashboard | `/nurse-dashboard` | Nurse task management and patient overview |
| Physician Dashboard | `/physician-dashboard` | Provider patient panel and orders |
| Case Manager Dashboard | `/case-manager-dashboard` | Case management workflows |
| Social Worker Dashboard | `/social-worker-dashboard` | Social work tools and SDOH |
| ER Dashboard | `/er-dashboard` | Emergency department operations |
| Patient Chart Navigator | `/patient-chart/:id` | Unified chart: meds, labs, vitals, immunizations, documents |
| Patient Avatar | `/patient-avatar/:id` | Visual body map — devices, surgical sites, conditions, wounds |
| Clinical Alerts | `/clinical-alerts` | Real-time clinical alert management |
| Medication Manager | `/medication-manager` | Medication oversight with interaction checking |
| Compass Riley (AI Scribe) | `/compass-riley` | Real-time medical transcription with SOAP note generation |

### Bed Management & Hospital Operations

| Feature | Route | Description |
|---------|-------|-------------|
| Bed Management | `/bed-management` | Real-time bed inventory, status, assignments |
| Bed Command Center | Admin panel | Live operations with unit capacity monitoring |
| Bed Optimization | — | AI-driven bed allocation recommendations |
| Nurse Census Board | `/nurse-census` | Nurse-level census tracking |
| Capacity Forecasting | — | Predictive analytics for bed availability |
| ED Boarder Tracking | — | Emergency department overflow monitoring |

### Shift Handoff & Care Transitions

| Feature | Route | Description |
|---------|-------|-------------|
| Shift Handoff | `/shift-handoff` | Structured handoff packets with attachments and event logs |
| Hospital Transfer Portal | `/hospital-transfer` | Secure facility-to-facility transfer |
| Receiving Dashboard | `/handoff/receiving` | Incoming transfer management |
| Transfer Logs | `/transfer-logs` | Transfer audit trail |
| Emergency Response Briefings | — | Critical patient summaries for rapid response |

### Readmission Prevention

| Feature | Route | Description |
|---------|-------|-------------|
| Readmission Dashboard | `/readmissions` | 30/7/90-day readmission risk monitoring |
| Frequent Flyer Dashboard | `/frequent-flyers` | High-utilizer identification and CMS penalty risk |
| Discharge Tracking | `/discharge-tracking` | Post-discharge patient monitoring |
| RPM Dashboard | `/rpm-dashboard` | Remote patient monitoring |
| Care Coordination | `/care-coordination` | Interdisciplinary care plan management |
| Doctors View | `/doctors-view` | Clinical view of community-generated vitals |

### Referral Management

| Feature | Route | Admin Section | Description |
|---------|-------|---------------|-------------|
| Referrals Dashboard | `/referrals` | — | Hospital referral tracking with subscription tiers |
| Referral Aging | — | `referral-aging` | Color-coded aging buckets (0-3d, 4-7d, 8-14d, 14+d) with auto-reminders |
| Specialist Confirmation | — | `referral-completion` | Record specialist completion, flag overdue referrals |
| Follow-Up Reminders | — | — | Graduated SMS/email at day 3/7/14 |

### Specialty Modules

| Module | Route | Description |
|--------|-------|-------------|
| Labor & Delivery | `/pregnancy-care` | Prenatal care, partogram, fetal monitoring, delivery records, APGAR, postpartum assessment, 7 AI integrations |
| Dental Health | `/dental-health` | Assessments, tooth charts, procedures, imaging, referrals, treatment plans |
| NeuroSuite | `/neuro-suite` | Stroke assessment, dementia screening, Parkinson's registry (UPDRS, DBS, meds), wearable integration |
| Physical Therapy | `/physical-therapy` | ICF assessments, SMART goals, HEP management, outcome measures (LEFS, ODI) |
| Mental Health | `/mental-health` | PHQ-9, GAD-7, mood tracking, intervention recommendations |
| Cardiology | `/heart-health` | ECG, echo, heart failure, cardiac rehab, device monitoring |
| Oncology | `/cancer-care` | Cancer registry, TNM staging, chemo/radiation tracking |
| EMS | `/ems` | Prehospital handoff, ETA tracking, coordinated response |

### Community Health Workers

| Feature | Route | Description |
|---------|-------|-------------|
| CHW Dashboard | `/chw/dashboard` | Field visit command center |
| Vitals Capture | `/chw/vitals-capture` | Field vital signs collection |
| Medication Photo Capture | `/chw/medication-photo` | Medication reconciliation via camera |
| SDOH Assessment | `/chw/sdoh-assessment` | PRAPARE SDOH screening |
| Telehealth Lobby | `/chw/telehealth-lobby` | Field telehealth waiting room |
| Kiosk Check-In | `/kiosk/check-in` | Public kiosk for walk-in check-ins |
| Kiosk Dashboard | `/chw/kiosk-dashboard` | Kiosk status monitoring |

### Staff Wellness

| Feature | Route | Description |
|---------|-------|-------------|
| Staff Wellness | `/staff-wellness` | Staff wellness monitoring |
| NurseOS | — | Burnout assessment, resilience hub, daily check-in, coping resources |
| Time Clock | `/time-clock` | Staff time tracking with session logs |

---

## Revenue Cycle Management

*18 admin panel sections for end-to-end billing.*

| Feature | Admin Section | Description |
|---------|---------------|-------------|
| SmartScribe Atlus | `smartscribe-atlus` | AI transcription for maximum billing accuracy |
| Revenue Dashboard | `revenue-dashboard` | Real-time revenue analytics |
| Superbill Review | `superbill-review` | Provider sign-off gate (DB trigger enforced) |
| Billing Queue | `billing-queue` | Encounter-to-superbill bridge |
| Eligibility Verification | `eligibility-verification` | X12 270/271 insurance pre-check |
| Claims Submission | `claims-submission` | Generate and submit 837P claims |
| Claim Aging | `claim-aging` | Aging buckets: 0-30, 31-60, 61-90, 90+ days |
| Claim Resubmission | `claim-resubmission` | Correct denied claims, track resubmission chains |
| Claims Appeals | `claims-appeals` | AI-assisted appeal letters |
| ERA Payment Posting | `era-payment-posting` | Match ERA/835 remittance to claims |
| Prior Authorization | `prior-auth` | CMS-0057-F compliant workflow |
| Undercoding Detection | `undercoding-detection` | Compare AI-suggested vs billed codes |
| Documentation Gap | `documentation-gap` | What to document for higher E/M levels |
| HCC Opportunity Flags | `hcc-opportunity-flags` | Expiring/missing HCC diagnoses (Medicare Advantage) |
| CCM Autopilot | `ccm-autopilot` | Auto-track 20+ min interactions for CCM billing |
| SDOH Billing | `sdoh-billing` | Social determinants-aware coding |
| Staff Savings Tracker | `staff-financial-savings` | Cost savings by nurse/department |
| Billing Dashboard | `billing-dashboard` | Claims processing overview |

---

## AI-Powered Services (70+ Skills)

### Clinical Decision Support

| Service | Model | Description |
|---------|-------|-------------|
| Readmission Risk Predictor | Sonnet | 30/7/90-day readmission scoring |
| Extended Readmission Predictor | Sonnet | 1-year prediction with seasonal patterns |
| Fall Risk Predictor | Sonnet | Morse Scale + evidence-based assessment |
| Infection Risk Predictor | Sonnet | HAI prediction (CLABSI, CAUTI, SSI, VAP, C. diff) |
| Medication Adherence Predictor | Sonnet | Barrier identification, intervention recommendations |
| Care Escalation Scorer | Sonnet | Confidence-scored escalation with clinical indicators |
| Clinical Guideline Matcher | Sonnet | ACOG/AHA/ADA guideline gap detection |
| Contraindication Detector | Sonnet | Multi-factor patient safety analysis |
| Treatment Pathway Engine | Sonnet | Evidence-based treatment suggestions |
| Drug Interaction Checker | Haiku + RxNorm | Cross-check medications with allergy/disease context |

### Clinical Documentation

| Service | Model | Description |
|---------|-------|-------------|
| SOAP Note Generator | Sonnet | Auto-generate SOAP notes from encounters |
| Progress Note Synthesizer | Haiku | Aggregate vitals/trends into structured notes |
| Care Plan Generator | Sonnet | Evidence-based care plans from diagnosis + SDOH |
| Discharge Summary Generator | Sonnet | Comprehensive discharge with med reconciliation |
| Referral Letter Generator | Haiku | Specialist referral with urgency levels |
| Shift Handoff Synthesizer | Haiku | Structured nurse-to-nurse handoff |
| Care Team Chat Summarizer | Haiku | Meeting/chat summary generation |

### Patient Engagement AI

| Service | Model | Description |
|---------|-------|-------------|
| Personalized Check-In Questions | Haiku | Daily questions tailored to patient history |
| Smart Mood Suggestions | Haiku | Wellness recommendations from mood data |
| Patient Q&A Bot | Sonnet | Health Q&A with safety guardrails |
| Patient Education Generator | Haiku | 6th-grade reading level health content |
| Medication Instructions | Haiku | Personalized pill IDs, schedules, interactions |
| Appointment Prep Instructions | Haiku | Condition-specific visit preparation |
| Caregiver Briefing Generator | Haiku | Automated family caregiver updates |
| Missed Check-In Escalation | Haiku | AI risk scoring when engagement drops |
| Dashboard Personalization | Haiku | AI-driven content recommendations |

### Billing & Revenue AI

| Service | Model | Description |
|---------|-------|-------------|
| Billing Code Suggester | Haiku | ICD-10/CPT code suggestions (95% cache hit rate) |
| SDOH Coding Suggester | Haiku | Social determinants Z-code recommendations |
| CCM Eligibility Scorer | Haiku | Chronic care management qualification |
| Billing Optimization Engine | — | Modifier 25 logic, E/M level suggestions |

### Administrative AI

| Service | Model | Description |
|---------|-------|-------------|
| Schedule Optimizer | Haiku | Staff scheduling with coverage and fairness |
| Audit Report Generator | — | SOC2/HIPAA compliance report generation |
| Security Anomaly Detector | — | Behavioral security pattern detection |
| PHI Exposure Risk Scorer | — | PHI risk assessment |
| HIPAA Violation Predictor | — | Proactive violation detection |
| Population Health Insights | Sonnet | Cohort analysis for value-based care |

### Interoperability AI

| Service | Model | Description |
|---------|-------|-------------|
| FHIR Semantic Mapper | Sonnet | FHIR R4/R5 mapping with AI suggestions |
| HL7 v2 Interpreter | — | Legacy message interpretation |
| Avatar Entity Extractor | Sonnet | Extract clinical entities for patient body map |

### Shared Infrastructure

| Service | Description |
|---------|-------------|
| Intelligent Model Router | Routes requests to Haiku vs Sonnet based on complexity |
| AI Transparency Service | Decision audit trail and explainability |
| AI Confidence Scoring | Prediction confidence tracking |
| AI Accuracy Metrics | Model performance monitoring |
| AI Prompt Versioning | Prompt experimentation and A/B testing |

---

## Healthcare Interoperability

### MCP Servers (11)

| Server | Description |
|--------|-------------|
| FHIR Server | FHIR R4 resource CRUD operations |
| HL7/X12 Server | HL7 v2.x / X12 EDI transformation |
| Prior Auth Server | Prior authorization workflow (X12 278) |
| Clearinghouse Server | Claim submission (837P/I), status (276/277), eligibility (270/271) |
| CMS Coverage Server | LCD/NCD coverage lookups |
| NPI Registry Server | Provider validation and search |
| Medical Codes Server | ICD-10, CPT, HCPCS code lookups |
| PubMed Server | Biomedical literature search |
| Claude AI Server | AI service proxy |
| Edge Functions Server | Serverless orchestration |
| PostgreSQL Server | Direct database access |

### Standards Compliance

| Standard | Implementation |
|----------|---------------|
| FHIR R4 | Full resource support — Patient, Condition, MedicationRequest, Observation, Procedure, Encounter, etc. |
| HL7 v2.x | ADT, ORU, ORM message parsing and FHIR conversion |
| X12 837P | Professional claim generation and submission |
| X12 835 | ERA remittance processing |
| X12 270/271 | Eligibility verification |
| X12 278 | Prior authorization |
| C-CDA | Clinical document export |
| SMART on FHIR | OAuth 2.0 app launch framework |
| USCDI v1 | US Core Data for Interoperability (via My Health Hub) |

### Public Health Reporting

| Function | Description |
|----------|-------------|
| Immunization Registry | Submit to state immunization registries |
| Syndromic Surveillance | Real-time public health surveillance |
| Electronic Case Reporting | eCR submission for reportable conditions |
| PDMP Query | Prescription drug monitoring program checks |

---

## Security & Compliance

### Admin Panel Security Sections (7)

| Section | Description |
|---------|-------------|
| MFA Compliance | Monitor MFA enrollment across staff |
| Facility Security | Real-time security monitoring |
| Audit Logs | PHI access logs and admin actions |
| Compliance Report | HIPAA and SOC2 compliance status |
| Breach Notification | HIPAA breach tracking with 60-day notification compliance |
| BAA Tracking | Business associate agreement lifecycle |
| Training Compliance | Workforce HIPAA training tracking |

### Security Infrastructure

| Feature | Description |
|---------|-------------|
| PHI Encryption | AES-256-GCM at rest and in transit |
| Row-Level Security | RLS policies on all tables with tenant isolation |
| Audit Logging | 8-category HIPAA-compliant audit trail |
| PHI Access Logging | Detailed PHI read/write audit |
| Guardian Agent | Self-healing automated security monitoring |
| SOC2 Dashboards | 5 separate trust services criteria panels |
| Patient Amendment Review | 45 CFR 164.526 compliance queue |
| Data Retention Policies | Automated retention enforcement |
| GDPR Deletion | Right-to-be-forgotten workflow |
| AI Model Cards | HTI-1 compliant AI/ML transparency documentation |
| SAFER Guides | ONC EHR safety assessment |

### Authentication

| Method | Description |
|--------|-------------|
| Email/Password | Standard authentication |
| Passkey (WebAuthn) | Passwordless biometric login |
| TOTP 2FA | Time-based one-time password for clinical staff |
| PIN Access | Admin and provider verification |
| Caregiver PIN | 30-minute read-only family sessions |
| hCaptcha | Bot protection on public endpoints |

---

## Platform Administration

### Super Admin

| Feature | Route | Description |
|---------|-------|-------------|
| Super Admin Dashboard | `/super-admin` | Platform-level management |
| Multi-Tenant Monitor | `/multi-tenant-monitor` | Cross-tenant health monitoring |
| Tenant Selector | `/tenant-selector` | Switch between organizations |
| SOC Dashboard | `/soc-dashboard` | SOC2 compliance dashboard |
| Enterprise Migration | `/enterprise-migration` | Enterprise onboarding tools |
| Guardian Agent | `/guardian/dashboard` | Self-healing system monitoring |
| API Key Management | `/admin/api-keys` | API key lifecycle |
| AI Accuracy Dashboard | `/admin/ai-accuracy` | AI model performance |
| AI Cost Dashboard | `/admin/ai-cost` | Claude API usage and cost tracking |

### Admin Panel (48 Sections)

| Category | Sections | Key Capabilities |
|----------|----------|-----------------|
| Revenue & Billing | 18 | Full revenue cycle from eligibility to payment posting |
| Patient Care | 10 | Engagement monitoring, task routing, result escalation |
| Clinical Specialties | 3 | L&D, Cardiology, Oncology dashboards |
| Clinical Data & FHIR | 6 | Quality measures, public health, FHIR analytics |
| Referral Follow-Up | 2 | Aging analysis, specialist confirmation |
| Security & Compliance | 7 | MFA, audit, breach notification, training |
| System Administration | 3 | Facility management, module config, data export |
| DSI Transparency | 1 | AI model cards (HTI-1) |
| Encounter Audit | 1 | 5-source timeline merge with export |

---

## Infrastructure

### Multi-Tenant Architecture
- White-label deployable with per-tenant branding
- Explicit CORS origins (no wildcards) — domains added per tenant
- Row-level security for complete data isolation
- Configurable feature flags per tenant via `tenant_module_config`

### Deployment Options
| Option | License Digit | Description |
|--------|---------------|-------------|
| WellFit Only | `9` | Community wellness platform |
| Envision Atlus Only | `8` | Clinical care engine |
| Both Together | `0` | Full integration |

### Technology Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS 4 |
| Backend | Supabase (PostgreSQL 17, Edge Functions, Auth, Realtime) |
| AI | Claude (Sonnet 4.5 + Haiku 4.5) via Anthropic API |
| Testing | Vitest — 429 suites, 8,415 tests, 100% pass rate |
| Interoperability | 11 MCP servers, FHIR R4, HL7 v2.x, X12 EDI |

---

## Summary

| Category | Count |
|----------|-------|
| **Total user-facing routes** | 193 |
| **Admin panel sections** | 48 |
| **Edge functions** | 144 |
| **AI skills (registered)** | 70+ |
| **MCP integration servers** | 11 |
| **Database tables** | 248+ |
| **Migration files** | 444 |
| **Service files** | 503+ |
| **Test suites** | 429 |
| **Tests** | 8,415 |
| **Authentication methods** | 6 |
| **Specialty clinical modules** | 8 |
| **Interoperability standards** | 9 (FHIR, HL7, X12 837/835/270/271/278, C-CDA, SMART, USCDI) |

---

*Built by a superintendent and a nurse using AI tools. $645 total development cost. Zero engineers.*
