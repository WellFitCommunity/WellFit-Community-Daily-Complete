# WellFit + Envision Atlus Platform Feature Highlights

> **Envision Virtual Edge Group LLC** | Confidential | February 7, 2026
>
> Two products. One mission: Prevent hospital readmissions by keeping communities healthy.
>
> Built by a registered nurse and a construction superintendent using AI development tools. Built with AI-first development methodology.

---

## The Headline

This platform bridges **community wellness** and **clinical care** in a single codebase that no competitor offers at any price point — let alone at ours.

A senior does a 2-minute daily check-in on their phone. Their doctor sees those vitals in real-time. AI flags risks before they become emergencies. The hospital bills for remote monitoring. Readmissions drop. Everyone wins.

---

## Top-Tier Features

### 1. The Two-Product Bridge (Community + Clinical)

**What it is:** WellFit (community wellness) and Envision Atlus (clinical care engine) can deploy independently or together. When deployed together, patient-generated data flows directly to clinical decision-making.

**Why it matters:** Most healthcare platforms are either patient-facing OR clinician-facing. Never both. The integration point — community data informing clinical care — is where readmissions actually get prevented.

**How it works:**
- Senior completes a daily check-in (mood, blood pressure, heart rate, glucose, symptoms)
- Data flows through tenant-isolated database with row-level security
- Doctor sees the same vitals on their clinical dashboard in real-time
- AI risk models consume both community engagement patterns and clinical history

**Deployment flexibility:**
| Option | Use Case |
|--------|----------|
| WellFit Only | Community org running wellness programs for seniors |
| Envision Atlus Only | Hospital running clinical workflows without community engagement |
| Both Together | Full integration — the complete readmission prevention platform |

---

### 2. 40+ AI-Powered Clinical Services

**What it is:** A comprehensive AI service layer powered by Claude, covering clinical decision support, documentation automation, risk prediction, and patient engagement.

**Clinical AI Services:**
| Service | What It Does |
|---------|-------------|
| Readmission Risk Predictor | Identifies patients likely to be readmitted within 30 days |
| Fall Risk Predictor | Assesses fall probability using clinical and behavioral data |
| SOAP Note Generator | Generates structured clinical notes from provider input |
| Progress Note Synthesizer | Summarizes patient progress across encounters |
| Care Plan Generator | Creates individualized care plans from diagnoses and history |
| Discharge Summary Generator | Automates discharge documentation |
| Medication Reconciliation | Identifies medication conflicts across care settings |
| Drug Interaction Detector | Flags contraindications in real-time |
| Clinical Guideline Matcher | Maps patient conditions to evidence-based guidelines |
| Treatment Pathway Engine | Recommends treatment pathways based on clinical data |
| Referral Letter Generator | Creates specialist referral letters from patient context |
| Infection Risk Predictor | Identifies hospital-acquired infection risk factors |
| Medication Adherence Predictor | Predicts non-adherence using behavioral patterns |
| Patient Education Generator | Creates personalized patient education materials |
| Billing Code Suggester | Recommends CPT/ICD codes from clinical documentation |

**Community AI Services:**
| Service | What It Does |
|---------|-------------|
| Personalized Check-In Questions | Tailors daily questions to each member's health profile |
| Smart Mood Suggestions | Wellness suggestions based on mood patterns |
| Missed Check-In Escalation | Risk scoring when engagement drops |
| Patient Q&A Bot | Answers member health questions |
| Personalized Greetings | AI-generated greetings based on member history |
| Dashboard Personalization | Customizes the experience per user behavior |

**Every AI service** is registered in a skill registry, tracked for cost, and logged for transparency and compliance.

---

### 3. Patient Avatar / Body Map

**What it is:** A visual body map that displays clinical markers, medical devices, and conditions directly on a human figure. Clinicians see the patient's clinical state at a glance.

**What it shows:**
- Device placements (pacemakers, insulin pumps, IV lines, catheters)
- Surgical sites and wound locations
- Condition markers (joint replacements, fractures, skin conditions)
- Device insertions and removals over time

**How it works:**
- SmartScribe transcription feeds into an AI entity extractor (Claude Haiku 4.5)
- Extracted medical entities are mapped to body coordinates
- Markers appear on the avatar with confidence scores
- Falls back to regex extraction if AI is unavailable

**Why it matters in a demo:** This is the feature people remember. It turns abstract clinical data into something visual and immediate.

---

### 4. Healthcare Interoperability Infrastructure (10 MCP Servers)

**What it is:** A full interoperability layer that allows the platform to communicate with any EHR, payer, clearinghouse, or registry using healthcare industry standards.

**MCP Servers:**
| Server | Standard | Purpose |
|--------|----------|---------|
| FHIR Server | FHIR R4 | Patient data exchange with any EHR |
| HL7/X12 Server | HL7 v2.x, X12 837/835 | Legacy message transformation |
| Prior Auth Server | X12 278 | Prior authorization workflow |
| Clearinghouse Server | X12 837P/837I | Claim submission and status |
| CMS Coverage Server | LCD/NCD | Medicare coverage determination lookups |
| NPI Registry Server | NPPES | Provider validation |
| Medical Codes Server | CPT/ICD/HCPCS | Code lookups and validation |
| Claude Server | Anthropic API | AI service proxy |
| Edge Functions Server | Supabase | Serverless function orchestration |
| PostgreSQL Server | SQL | Direct database access |

**What this means:** The platform can receive HL7 ADT messages from a hospital, convert them to FHIR, submit claims to a clearinghouse, verify insurance eligibility, check prior auth requirements, and validate provider NPIs — all through standardized APIs.

Most startups with 50+ engineers don't have this breadth of interoperability.

---

### 5. 21st Century Cures Act Compliance (My Health Hub)

**What it is:** A patient-facing portal where members can access their own medical records electronically, as required by federal law (Information Blocking Rule).

**Patient Access Points:**
| Section | USCDI Data Element |
|---------|-------------------|
| Health Observations | Vital signs, lab results |
| Immunizations | Vaccine records and schedules |
| Care Plans | Active treatment plans |
| Allergies | Allergy and intolerance list |
| Conditions | Medical diagnoses |
| Medicine Cabinet | Current and historical medications |
| Health Records Download | Export in PDF, FHIR, C-CDA, and CSV formats |
| Telehealth Appointments | Video visit scheduling |

**Why it matters:** Many hospitals with dedicated IT departments still struggle to meet Cures Act requirements. This platform does it out of the box.

---

## Strong-Tier Features

### 6. Multi-Tenant White-Label Architecture

Any healthcare organization deploys with their own branding, domain, and configuration. One codebase serves all tenants with database-level isolation (row-level security).

- Custom branding per tenant via `useBranding()` hook
- Explicit CORS origins per tenant (no wildcards — HIPAA compliant)
- Feature flags per tenant via `useModuleAccess()` hook
- Tenant licensing: WellFit-only, Atlus-only, or both

---

### 7. Community Engagement Engine

Keeping seniors engaged between doctor visits is where readmissions actually get prevented. The platform includes:

- **Daily check-ins** with vitals, mood, symptoms, and activity tracking
- **Gamification** with trivia games, word games, and engagement scoring
- **Community moments** for sharing photos and stories
- **Personalized affirmations** and wellness content delivery
- **AI-powered greetings** tailored to each member's history
- **Caregiver access** with PIN-based family member monitoring
- **Missed check-in escalation** with automated alerts to care teams
- **SMS reminders** via Twilio integration

---

### 8. Unified Patient Chart Navigator

A single page where clinicians select a patient and browse all their documents without losing context. Tabs for medications, care plans, labs/vitals, immunizations, body map, and clinical documents — all sharing the same patient ID from the URL.

Solves the universal clinical UX problem: "I clicked to a different section and lost my patient."

---

### 9. Full Revenue Cycle / Billing Pipeline

| Capability | Standard |
|-----------|----------|
| Claim generation | X12 837P/837I |
| Clearinghouse submission | EDI |
| Claim status tracking | X12 276/277 |
| Eligibility verification | X12 270/271 |
| Prior authorization | X12 278 |
| Remittance processing | ERA/835 |
| Fee schedule management | Custom |
| AI billing code suggestions | CPT/ICD/HCPCS |

---

## The Demo Story (5 Minutes)

The most compelling way to show this platform:

1. **Senior check-in** (1 min) — Show a member completing a daily check-in on their phone. Mood, blood pressure, heart rate, glucose, how they slept, any symptoms.

2. **AI analysis** (30 sec) — Show the AI processing the check-in: risk scoring, mood suggestions, personalized follow-up questions generated.

3. **Doctor's view** (1 min) — Switch to the clinical dashboard. Same data appears in real-time with risk indicators. Show the vitals trending over 7 and 30 days.

4. **Body map** (1 min) — Open the patient avatar. Show clinical markers on the body — devices, conditions, surgical sites. Show how SmartScribe transcription automatically populates markers.

5. **FHIR export** (30 sec) — Show the patient's data exported as a FHIR bundle, ready to send to any EHR. Show My Health Hub where the patient sees their own records.

6. **The close** (1 min) — "This platform bridges community wellness with clinical care in a way no one else offers. It was built with an AI-first development methodology by domain experts — a clinical nurse with 23+ years of experience and an operations specialist. No traditional engineering team required."

---

## Technical Foundation

| Aspect | Detail |
|--------|--------|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS 4 |
| Backend | Supabase (PostgreSQL 17), Edge Functions (Deno) |
| AI | Claude (Anthropic) — 40+ registered skills |
| Auth | JWT + Supabase Auth, TOTP for clinical staff |
| Compliance | HIPAA, 21st Century Cures Act, WCAG AA |
| Testing | 7,490 tests across 306 suites, 100% pass rate |
| Interoperability | FHIR R4, HL7 v2.x, X12, C-CDA |
| Infrastructure | Vercel (frontend), Supabase (backend), Twilio (SMS) |
| Development Approach | AI-first methodology, domain-expert led |

---

*Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.*
