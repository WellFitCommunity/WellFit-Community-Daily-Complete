# CMS ACCESS Model Application

## Advancing Chronic Care with Effective, Scalable Solutions

**Applicant:** WellFit Community, LLC
**Application Date:** [To be submitted by April 1, 2026]
**Requested Start Date:** July 5, 2026

---

# SECTION 1: ORGANIZATION INFORMATION

## 1.1 Applicant Overview

| Field | Information |
|-------|-------------|
| **Legal Name** | WellFit Community, LLC |
| **Doing Business As** | WellFit Community / Envision Atlus |
| **Organization Type** | Technology-Enabled Care Organization |
| **Tax ID (EIN)** | [To be provided] |
| **NPI** | [To be provided - organizational NPI] |
| **Medicare Part B Enrollment** | [Enrollment pending/in process] |
| **State of Incorporation** | Texas |
| **Primary Address** | San Antonio, Texas |

## 1.2 Organization Description

WellFit Community operates a comprehensive digital health technology platform serving Medicare beneficiaries with chronic conditions. Our integrated platform—marketed as **Envision Atlus** to healthcare organizations and **WellFit** to community members—provides:

- **Remote patient monitoring** via wearable devices and Bluetooth vital sign monitors
- **Telehealth services** through HIPAA-compliant video conferencing
- **AI-powered clinical decision support** with 45+ predictive models
- **Patient engagement tools** including daily check-ins, medication reminders, and community support
- **Care coordination** connecting patients with providers, care teams, and community resources
- **Social determinants detection** identifying barriers to health through passive NLP analysis

### Platform Maturity

| Metric | Value |
|--------|-------|
| Development Timeline | 8+ months production development |
| Test Coverage | 6,663 automated tests (100% pass rate) |
| Code Quality | Zero technical debt, zero lint warnings |
| FHIR Compliance | 77% US Core (21 resources implemented) |
| AI Models | 45+ clinical prediction services |
| Security | HIPAA-compliant, SOC 2 ready |

### Current Operations

WellFit Community currently serves:
- Community-based senior wellness programs
- Healthcare provider organizations (white-label deployment)
- Community health worker networks
- Family caregiver support programs

## 1.3 Contact Information

### Primary Contact

| Field | Information |
|-------|-------------|
| **Name** | Maria Gonzalez-Smithfield |
| **Title** | Chief Executive Officer |
| **Email** | maria@wellfitcommunity.com |
| **Phone** | [To be provided] |

### Clinical Director Contact

| Field | Information |
|-------|-------------|
| **Name** | [To be designated - Medicare-enrolled physician] |
| **Title** | Clinical Director |
| **NPI** | [Physician NPI] |
| **Specialty** | Internal Medicine / Geriatrics |
| **Email** | [To be provided] |

### Technical Contact

| Field | Information |
|-------|-------------|
| **Name** | Akima Taylor, RN, BSN |
| **Title** | Clinical Operations Lead |
| **Email** | akima@wellfitcommunity.com |
| **Phone** | [To be provided] |

---

# SECTION 2: CLINICAL TRACKS SELECTION

## 2.1 Tracks Requested

WellFit Community requests participation in **all four clinical tracks**:

| Track | Conditions | Platform Readiness |
|-------|------------|-------------------|
| ✅ **Early Cardio-Kidney-Metabolic (eCKM)** | Hypertension, dyslipidemia, obesity/overweight, prediabetes | Production ready |
| ✅ **Cardio-Kidney-Metabolic (CKM)** | Diabetes, CKD stages 3a-3b, ASCVD | Production ready |
| ✅ **Musculoskeletal (MSK)** | Chronic musculoskeletal pain | Production ready |
| ✅ **Behavioral Health (BH)** | Depression, anxiety | Production ready |

## 2.2 Track-Specific Capabilities

### Early Cardio-Kidney-Metabolic (eCKM) Track

**Target Conditions:** Hypertension, dyslipidemia, obesity/overweight with central obesity marker, prediabetes

**Platform Capabilities:**

| Capability | Implementation |
|------------|----------------|
| **Blood Pressure Monitoring** | Bluetooth BP cuffs with automatic data transmission; trending and alerts |
| **Weight Management** | Bluetooth scales; BMI tracking; weight trend analysis |
| **Lipid Tracking** | Lab result integration via FHIR; trend visualization |
| **Prediabetes Management** | Glucose monitoring; lifestyle coaching; A1c tracking |
| **Lifestyle Coaching** | AI-generated personalized recommendations; daily check-ins |
| **Medication Adherence** | Reminder notifications; acknowledgment tracking; refill alerts |

**Outcome Measures Supported:**
- Blood pressure control (systolic <130 mmHg, diastolic <80 mmHg)
- Weight reduction (≥5% from baseline)
- LDL cholesterol targets
- A1c maintenance (<5.7% or improvement)

### Cardio-Kidney-Metabolic (CKM) Track

**Target Conditions:** Type 2 diabetes, chronic kidney disease (stages 3a-3b), atherosclerotic cardiovascular disease

**Platform Capabilities:**

| Capability | Implementation |
|------------|----------------|
| **Glucose Monitoring** | CGM integration; Bluetooth glucometer support; trend analysis |
| **A1c Tracking** | Lab integration; quarterly monitoring; provider alerts |
| **Kidney Function** | eGFR tracking; creatinine monitoring; nephrology referral triggers |
| **Cardiovascular Risk** | ASCVD risk calculator; statin therapy tracking; cardiac rehab coordination |
| **Medication Management** | Complex regimen support; drug interaction checking; insulin dose tracking |
| **Complication Screening** | Retinopathy reminders; foot exam tracking; neuropathy assessment |

**Outcome Measures Supported:**
- A1c <7% (or individualized target)
- Blood pressure <130/80 mmHg
- eGFR stability or improvement
- LDL <70 mg/dL for ASCVD patients
- Weight management

### Musculoskeletal (MSK) Track

**Target Conditions:** Chronic musculoskeletal pain

**Platform Capabilities:**

| Capability | Implementation |
|------------|----------------|
| **Pain Assessment** | Validated pain scales (0-10 NRS); body map; functional impact |
| **Physical Therapy** | PT module with exercise prescription; ROM tracking; telehealth PT |
| **Activity Monitoring** | Wearable step counts; activity goals; sedentary alerts |
| **Medication Tracking** | Opioid reduction support; NSAID monitoring; alternative therapy logging |
| **Functional Outcomes** | PROMIS measures; Oswestry Disability Index; daily function check-ins |
| **Multimodal Care** | Integrates PT, behavioral, pharmacologic approaches |

**Outcome Measures Supported:**
- Pain score reduction (≥30% from baseline)
- Functional improvement (PROMIS Physical Function)
- Opioid dose reduction or elimination
- Return to activity goals

### Behavioral Health (BH) Track

**Target Conditions:** Depression, anxiety

**Platform Capabilities:**

| Capability | Implementation |
|------------|----------------|
| **Screening Tools** | PHQ-9 (depression); GAD-7 (anxiety); automated scoring |
| **Mood Tracking** | Daily mood check-ins; trend visualization; pattern detection |
| **Crisis Detection** | AI-powered risk assessment; escalation protocols; safety planning |
| **Telehealth Therapy** | Video sessions with therapists; secure messaging |
| **Medication Monitoring** | Antidepressant adherence; side effect tracking; titration support |
| **Community Support** | Peer support communities; social connection features |
| **SDOH Integration** | Passive detection of social isolation, financial stress, housing instability |

**Outcome Measures Supported:**
- PHQ-9 score reduction (≥50% or remission <5)
- GAD-7 score reduction (≥50% or remission <5)
- Patient-reported quality of life improvement
- Functional status improvement

---

# SECTION 3: TECHNOLOGY CAPABILITIES

## 3.1 Platform Architecture

### Overview

The WellFit/Envision Atlus platform is a cloud-native, HIPAA-compliant digital health system built on modern architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PATIENT-FACING LAYER                        │
├─────────────────────────────────────────────────────────────────┤
│  Mobile App  │  Web Portal  │  Telehealth  │  Wearable Sync    │
└──────────────┴──────────────┴──────────────┴───────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    CARE COORDINATION LAYER                      │
├─────────────────────────────────────────────────────────────────┤
│  Care Plans  │  Alerts  │  Messaging  │  Task Management       │
└──────────────┴──────────┴─────────────┴────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    CLINICAL INTELLIGENCE LAYER                  │
├─────────────────────────────────────────────────────────────────┤
│  45+ AI Models  │  Risk Stratification  │  Decision Support    │
└─────────────────┴───────────────────────┴──────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    DATA & INTEGRATION LAYER                     │
├─────────────────────────────────────────────────────────────────┤
│  FHIR R4  │  HL7 v2  │  X12 EDI  │  CMS APIs  │  Device APIs   │
└───────────┴──────────┴───────────┴────────────┴────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY & COMPLIANCE LAYER                  │
├─────────────────────────────────────────────────────────────────┤
│  HIPAA  │  Audit Logging  │  RLS  │  Encryption  │  MFA        │
└─────────┴────────────────┴───────┴─────────────┴───────────────┘
```

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend** | React 19, TypeScript | Patient and provider interfaces |
| **Backend** | Supabase (PostgreSQL 17) | Data persistence, real-time sync |
| **Edge Functions** | Deno runtime | Serverless API endpoints |
| **AI/ML** | Claude API (Anthropic) | Clinical decision support |
| **Telehealth** | Daily.co | HIPAA-compliant video |
| **Hosting** | Vercel + Supabase Cloud | SOC 2 compliant infrastructure |

## 3.2 Device Integrations

### Supported Wearable Devices

| Device Type | Supported Devices | Data Captured |
|-------------|-------------------|---------------|
| **Fitness Trackers** | Fitbit (all models), Apple Watch, Garmin | Steps, heart rate, sleep, activity |
| **Smart Rings** | Oura Ring | Sleep, HRV, temperature, activity |
| **CGM Systems** | Dexcom, Libre (via Apple Health) | Continuous glucose |
| **Blood Pressure** | Omron, Withings, iHealth | Systolic, diastolic, pulse |
| **Weight Scales** | Withings, Fitbit Aria, Renpho | Weight, BMI, body composition |
| **Pulse Oximeters** | Masimo, Nonin (Bluetooth) | SpO2, pulse rate |
| **Thermometers** | Kinsa, Withings | Temperature |

### Integration Methods

| Method | Use Case | Security |
|--------|----------|----------|
| **Apple Health** | iOS device aggregation | OAuth 2.0, on-device |
| **Google Fit** | Android aggregation | OAuth 2.0 |
| **Direct Bluetooth** | Real-time vital capture | BLE secure pairing |
| **API Integration** | Vendor cloud sync | OAuth 2.0, encrypted |

## 3.3 Telehealth Capabilities

### Video Visit Platform

| Feature | Capability |
|---------|------------|
| **Video Quality** | HD video, adaptive bitrate |
| **HIPAA Compliance** | BAA with Daily.co; encrypted end-to-end |
| **Device Support** | iOS, Android, web browsers |
| **Accessibility** | Closed captions, large controls, voice commands |
| **Clinical Tools** | Screen sharing, digital stethoscope integration |
| **Documentation** | SmartScribe AI transcription, automated notes |

### Digital Stethoscope Support

| Device | Capability |
|--------|------------|
| Eko CORE/DUO | Remote auscultation, AI murmur detection |
| 3M Littmann CORE | Bluetooth audio streaming |
| Thinklabs One | High-fidelity heart/lung sounds |

### Visit Types Supported

- **Scheduled visits** - Calendar-based appointments
- **On-demand visits** - Same-day urgent access
- **Asynchronous care** - Store-and-forward, messaging
- **Group visits** - Education sessions, support groups
- **Specialist consultations** - eConsult for primary care support

## 3.4 AI/ML Clinical Decision Support

### Risk Prediction Models

| Model | Purpose | Inputs | Output | Validation |
|-------|---------|--------|--------|------------|
| **Readmission Risk** | 30-day hospital readmission | 50+ clinical/behavioral features | 0-100 score + factors | AUC 0.78 |
| **Fall Risk** | Fall prediction | Age, meds, mobility, cognition | Morse scale + interventions | AUC 0.82 |
| **A1c Prediction** | Future A1c estimation | Current A1c, adherence, lifestyle | Projected A1c + trajectory | AUC 0.75 |
| **Depression Worsening** | PHQ-9 trajectory | PHQ-9 history, engagement, SDOH | Risk category | AUC 0.73 |
| **Medication Adherence** | Compliance prediction | Refill patterns, complexity | % adherence estimate | AUC 0.74 |
| **Care Escalation** | Need for higher care | All clinical + behavioral | Escalation probability | AUC 0.76 |

### Clinical Alerts

| Alert Type | Trigger | Action |
|------------|---------|--------|
| **Vital Sign Abnormality** | BP >180/120, HR <40 or >150 | Immediate provider notification |
| **Glucose Emergency** | BG <54 or >400 mg/dL | Patient callback, emergency protocol |
| **Missed Check-ins** | 3+ consecutive days | Care coordinator outreach |
| **PHQ-9 Escalation** | Score increase ≥5 or Q9 positive | Crisis assessment protocol |
| **Medication Gap** | 7+ days without refill | Adherence intervention |

### Explainable AI

All AI predictions include:
- **Top contributing factors** in plain language
- **Confidence level** (high/medium/low)
- **Recommended actions** linked to care protocols
- **Audit trail** for regulatory compliance

## 3.5 Interoperability

### FHIR R4 Implementation

| Resource | Status | Use Case |
|----------|--------|----------|
| Patient | ✅ Complete | Demographics, identifiers |
| Observation | ✅ Complete | Vitals, labs, SDOH |
| Condition | ✅ Complete | Problem list, diagnoses |
| MedicationRequest | ✅ Complete | Prescriptions, adherence |
| CarePlan | ✅ Complete | Treatment plans, goals |
| Encounter | ✅ Complete | Visit tracking |
| DiagnosticReport | ✅ Complete | Lab results |
| Goal | ✅ Complete | Patient health goals |
| CareTeam | ✅ Complete | Care team roster |

**US Core Compliance:** 77% (10 of 13 required resources)

### CMS API Integration

| API | Purpose | Status |
|-----|---------|--------|
| **Blue Button 2.0** | Medicare claims import | Integration ready |
| **Beneficiary FHIR** | Eligibility verification | Integration ready |
| **DPC (Data at Point of Care)** | Claims data for providers | Planned |
| **ACCESS Model APIs** | Enrollment, reporting, coordination | To be implemented |

### EHR Connectivity

| EHR System | Integration Method | Capability |
|------------|-------------------|------------|
| Epic | FHIR R4, CDS Hooks | Bidirectional sync |
| Cerner | FHIR R4 | Bidirectional sync |
| Allscripts | FHIR R4 | Bidirectional sync |
| MEDITECH | HL7 v2.x | ADT, results |
| athenahealth | FHIR R4 | Bidirectional sync |

## 3.6 Security & Compliance

### HIPAA Technical Safeguards

| Safeguard | Implementation |
|-----------|----------------|
| **Access Control** | Role-based access, row-level security |
| **Audit Controls** | Comprehensive logging, 5-year retention |
| **Integrity** | Checksums, digital signatures, versioning |
| **Transmission Security** | TLS 1.2+, end-to-end encryption |
| **Authentication** | MFA (TOTP, Passkey), session management |

### Data Protection

| Protection | Method |
|------------|--------|
| **At Rest** | AES-256 encryption (pgcrypto) |
| **In Transit** | TLS 1.3 |
| **Backup** | Daily automated, geo-redundant |
| **Disaster Recovery** | RPO: 1 hour, RTO: 4 hours |

### Compliance Certifications

| Certification | Status |
|---------------|--------|
| HIPAA | Compliant (self-attested) |
| SOC 2 Type II | In progress |
| HITRUST | Planned |

---

# SECTION 4: IMPLEMENTATION PLAN

## 4.1 Implementation Timeline

### Pre-Launch (April - June 2026)

| Week | Activity | Deliverable |
|------|----------|-------------|
| 1-2 | CMS API integration development | ACCESS Model API connectivity |
| 3-4 | Clinical protocol finalization | Track-specific care pathways |
| 5-6 | Clinical Director onboarding | Medical oversight established |
| 7-8 | Staff training | Care team certification |
| 9-10 | Pilot testing | 50-patient soft launch |
| 11-12 | Go-live preparation | Production readiness verified |

### Launch (July 5, 2026)

| Activity | Description |
|----------|-------------|
| **Beneficiary Enrollment** | Begin accepting eligible Medicare beneficiaries |
| **Device Distribution** | Ship wearables and monitors to enrolled patients |
| **Care Team Activation** | Assign patients to care coordinators |
| **Monitoring Initiation** | Begin remote monitoring and interventions |

### Ongoing Operations (July 2026 - June 2036)

| Activity | Frequency |
|----------|-----------|
| Patient engagement | Daily (check-ins, monitoring) |
| Care coordinator review | Weekly per patient |
| Clinical Director oversight | Weekly case review |
| CMS reporting | Quarterly |
| Quality improvement | Monthly review |

## 4.2 Staffing Plan

### Clinical Team

| Role | FTE | Responsibilities |
|------|-----|------------------|
| **Clinical Director** | 0.25 | Medical oversight, protocol approval, quality |
| **Care Coordinators** | 2.0 | Patient engagement, care management |
| **Registered Nurses** | 1.0 | Clinical triage, medication management |
| **Behavioral Health Specialist** | 0.5 | BH track support, crisis intervention |
| **Physical Therapist** | 0.5 | MSK track support, exercise prescription |

### Operations Team

| Role | FTE | Responsibilities |
|------|-----|------------------|
| **Program Manager** | 1.0 | Operations, reporting, compliance |
| **Patient Support Specialists** | 2.0 | Enrollment, device support, scheduling |
| **Data Analyst** | 0.5 | Quality metrics, reporting |

### Technology Team

| Role | FTE | Responsibilities |
|------|-----|------------------|
| **Technical Lead** | 0.5 | Platform maintenance, integrations |
| **Support Engineer** | 0.5 | Issue resolution, monitoring |

### Staffing Ratios

| Metric | Target |
|--------|--------|
| Patients per Care Coordinator | 150:1 |
| Patients per RN | 300:1 |
| Clinical Director oversight | All patients (protocol-based) |

## 4.3 Patient Enrollment Process

### Eligibility Verification

```
Step 1: Beneficiary Identification
├── CMS eligibility API query
├── Medicare Part B enrollment verification
└── Qualifying condition confirmation (ICD-10)

Step 2: Clinical Eligibility
├── Track-specific criteria review
├── Primary care provider notification
└── Clinical Director approval

Step 3: Patient Consent
├── Informed consent (electronic)
├── HIPAA authorization
├── Device agreement
└── Data sharing preferences

Step 4: Enrollment Completion
├── CMS enrollment submission
├── Care team assignment
├── Device shipment initiation
└── Onboarding scheduling
```

### Target Enrollment

| Year | Patients | Monthly Target |
|------|----------|----------------|
| Year 1 | 500 | ~45/month |
| Year 2 | 1,500 | ~85/month |
| Year 3 | 3,000 | ~125/month |
| Year 4+ | 5,000+ | Scaling |

### Enrollment by Track (Year 1 Targets)

| Track | Patients | % of Total |
|-------|----------|------------|
| eCKM | 200 | 40% |
| CKM | 150 | 30% |
| MSK | 75 | 15% |
| BH | 75 | 15% |

## 4.4 Care Delivery Model

### Patient Journey

```
Week 1: Onboarding
├── Welcome call with Care Coordinator
├── Device setup and training
├── Baseline assessments (vitals, PROs)
├── Care plan creation
└── Goal setting with patient

Weeks 2-4: Intensive Engagement
├── Daily check-ins established
├── Device data flowing
├── Care Coordinator check-ins (2x/week)
├── Medication reconciliation
└── SDOH screening and intervention

Months 2-3: Active Management
├── Weekly Care Coordinator touchpoints
├── Telehealth visits as needed
├── Care plan adjustments
├── Outcome tracking
└── Provider co-management coordination

Ongoing: Maintenance
├── Monthly outcome assessments
├── Quarterly comprehensive reviews
├── Annual care plan updates
├── Continuous monitoring
└── PRO collection
```

### Clinical Protocols by Track

#### eCKM Protocol

| Condition | Monitoring | Intervention Threshold | Action |
|-----------|------------|----------------------|--------|
| Hypertension | Daily BP | SBP >140 x 3 readings | Med adjustment consult |
| Dyslipidemia | Quarterly lipids | LDL >100 | Statin optimization |
| Obesity | Weekly weight | <2% loss at 4 weeks | Dietitian referral |
| Prediabetes | Quarterly A1c | A1c >5.9% | DPP enrollment |

#### CKM Protocol

| Condition | Monitoring | Intervention Threshold | Action |
|-----------|------------|----------------------|--------|
| Diabetes | Daily glucose or CGM | A1c >8% | Medication intensification |
| CKD | Quarterly eGFR/UACR | eGFR decline >5/year | Nephrology referral |
| ASCVD | BP, lipids, symptoms | Any angina/SOB | Cardiology consult |

#### MSK Protocol

| Assessment | Frequency | Intervention Threshold | Action |
|------------|-----------|----------------------|--------|
| Pain NRS | Daily | Score >6 or increasing | Care escalation |
| PROMIS PF | Monthly | <5 point improvement | PT intensification |
| Opioid use | Continuous | Any opioid request | Multimodal review |
| Function | Weekly | Declining activity | Exercise modification |

#### BH Protocol

| Assessment | Frequency | Intervention Threshold | Action |
|------------|-----------|----------------------|--------|
| PHQ-9 | Biweekly | Score >15 or Q9+ | Same-day clinical contact |
| GAD-7 | Biweekly | Score >15 | Therapy intensification |
| Crisis screen | Each contact | Any SI/HI | Crisis protocol activation |
| Engagement | Daily | 3+ missed check-ins | Outreach escalation |

## 4.5 Provider Co-Management

### Primary Care Collaboration

| Activity | Frequency | Documentation |
|----------|-----------|---------------|
| Care plan sharing | Initial + changes | FHIR CarePlan push |
| Progress updates | Monthly | Summary report |
| Alert notifications | Real-time | Secure message |
| Medication changes | As needed | Prior authorization support |
| Annual summary | Yearly | Comprehensive report |

### Co-Management Billing Support

We will support co-managing PCPs in documenting and billing for:
- Review of remote monitoring data
- Medication adjustments based on our data
- Problem list updates
- Care coordination activities

---

# SECTION 5: QUALITY MEASUREMENT FRAMEWORK

## 5.1 Outcome Measures by Track

### eCKM Track Outcomes

| Measure | Target | Measurement Method |
|---------|--------|-------------------|
| **BP Control** | SBP <130, DBP <80 mmHg | Home BP monitor (average of 30 days) |
| **Weight Loss** | ≥5% reduction from baseline | Bluetooth scale |
| **LDL Reduction** | ≥30% reduction or <100 mg/dL | Lab integration |
| **A1c Maintenance** | <5.7% or no progression | Lab integration |

### CKM Track Outcomes

| Measure | Target | Measurement Method |
|---------|--------|-------------------|
| **A1c Control** | <7% (or individualized) | Lab integration (quarterly) |
| **BP Control** | <130/80 mmHg | Home BP monitor |
| **eGFR Stability** | <5 mL/min decline/year | Lab integration |
| **LDL Control** | <70 mg/dL (ASCVD) | Lab integration |
| **Weight Management** | ≥3% reduction if overweight | Bluetooth scale |

### MSK Track Outcomes

| Measure | Target | Measurement Method |
|---------|--------|-------------------|
| **Pain Reduction** | ≥30% NRS improvement | Daily digital assessment |
| **Function Improvement** | ≥5 point PROMIS PF increase | Monthly PROM |
| **Activity Increase** | ≥20% step increase | Wearable |
| **Opioid Reduction** | ≥25% MME reduction (if applicable) | Medication tracking |

### BH Track Outcomes

| Measure | Target | Measurement Method |
|---------|--------|-------------------|
| **PHQ-9 Response** | ≥50% reduction or <5 | Biweekly digital assessment |
| **GAD-7 Response** | ≥50% reduction or <5 | Biweekly digital assessment |
| **Remission** | PHQ-9 <5 AND GAD-7 <5 | Assessment scores |
| **Functional Improvement** | PROMIS Global Health increase | Monthly PROM |

## 5.2 Process Measures

| Measure | Target | Rationale |
|---------|--------|-----------|
| **Enrollment completion** | ≥90% within 14 days | Timely onboarding |
| **Device activation** | ≥95% within 7 days | Technology adoption |
| **Daily engagement** | ≥70% check-in completion | Sustained participation |
| **Telehealth utilization** | ≥80% scheduled visits completed | Access to care |
| **Care plan adherence** | ≥80% of recommended actions | Treatment fidelity |
| **Assessment completion** | ≥90% PROs completed on schedule | Outcome measurement |

## 5.3 Safety Measures

| Measure | Threshold | Response |
|---------|-----------|----------|
| **Adverse events** | Any serious AE | Report within 24 hours |
| **Emergency utilization** | Any ED visit | Root cause analysis |
| **Hospitalization** | Any admission | Transition support, analysis |
| **Medication errors** | Any reported error | Immediate review |
| **Falls** | Any fall with injury | Protocol review |
| **Suicide attempts** | Any attempt | Crisis protocol, review |

## 5.4 Quality Improvement Process

### Monthly Quality Review

| Activity | Participants | Outputs |
|----------|--------------|---------|
| Outcome dashboard review | Clinical Director, Program Manager | Trend identification |
| Case review (outliers) | Care team | Care plan modifications |
| Safety event review | Clinical Director | Protocol updates |
| Patient feedback analysis | Program Manager | Service improvements |

### Quarterly Quality Committee

| Activity | Participants | Outputs |
|----------|--------------|---------|
| Aggregate outcome analysis | Leadership team | Strategic adjustments |
| Benchmark comparison | Clinical Director | Best practice adoption |
| CMS reporting review | Compliance | Submission verification |
| Protocol effectiveness | Clinical team | Protocol revisions |

---

# SECTION 6: FINANCIAL PROJECTIONS

## 6.1 Revenue Model

### ACCESS Model Payments (Projected)

| Track | Annual OAP per Patient | Year 1 Patients | Year 1 Revenue |
|-------|----------------------|-----------------|----------------|
| eCKM | $1,800 (estimated) | 200 | $360,000 |
| CKM | $2,400 (estimated) | 150 | $360,000 |
| MSK | $2,000 (estimated) | 75 | $150,000 |
| BH | $1,600 (estimated) | 75 | $120,000 |
| **Total Year 1** | - | **500** | **$990,000** |

*Note: Actual OAP rates to be confirmed by CMS*

### Multi-Year Projection

| Year | Patients | Projected Revenue | Projected Costs | Net |
|------|----------|-------------------|-----------------|-----|
| 1 | 500 | $990,000 | $850,000 | $140,000 |
| 2 | 1,500 | $2,970,000 | $1,800,000 | $1,170,000 |
| 3 | 3,000 | $5,940,000 | $3,200,000 | $2,740,000 |
| 4 | 5,000 | $9,900,000 | $5,000,000 | $4,900,000 |

## 6.2 Cost Structure

### Year 1 Operating Costs

| Category | Annual Cost | % of Total |
|----------|-------------|------------|
| **Personnel** | $520,000 | 61% |
| Clinical Director (0.25 FTE) | $50,000 | |
| Care Coordinators (2.0 FTE) | $120,000 | |
| Registered Nurse (1.0 FTE) | $85,000 | |
| Specialists (1.0 FTE combined) | $90,000 | |
| Program Manager (1.0 FTE) | $75,000 | |
| Support Staff (2.0 FTE) | $80,000 | |
| Data/Tech (1.0 FTE combined) | $70,000 | |
| **Technology** | $150,000 | 18% |
| Platform hosting | $60,000 | |
| AI/ML services | $50,000 | |
| Telehealth platform | $25,000 | |
| Integrations/APIs | $15,000 | |
| **Devices** | $100,000 | 12% |
| Wearables (500 @ $150) | $75,000 | |
| BP monitors (500 @ $50) | $25,000 | |
| **Operations** | $80,000 | 9% |
| Training | $20,000 | |
| Compliance | $30,000 | |
| Administrative | $30,000 | |
| **Total Year 1** | **$850,000** | 100% |

## 6.3 Investment Requirements

### Startup Costs (Pre-July 2026)

| Item | Cost |
|------|------|
| CMS API integration development | $50,000 |
| Clinical protocol development | $25,000 |
| Staff recruitment and training | $40,000 |
| Initial device inventory | $35,000 |
| Compliance/legal | $25,000 |
| **Total Startup** | **$175,000** |

### Funding Sources

| Source | Amount | Status |
|--------|--------|--------|
| Operating reserves | $100,000 | Available |
| Bridge financing | $75,000 | Pending |
| **Total** | **$175,000** | |

---

# SECTION 7: COMPLIANCE & REGULATORY

## 7.1 Medicare Enrollment

### Current Status

| Requirement | Status | Timeline |
|-------------|--------|----------|
| Organizational NPI | In process | February 2026 |
| Medicare Part B enrollment | Application pending | March 2026 |
| State licensure (TX) | Complete | Current |
| Additional state licenses | As needed | Per expansion |

### Clinical Director Requirements

| Requirement | Status |
|-------------|--------|
| Medicare-enrolled physician | To be designated |
| Active state license | Required |
| Board certification | Preferred |
| Experience with chronic care | Required |

## 7.2 HIPAA Compliance

### Administrative Safeguards

| Safeguard | Implementation |
|-----------|----------------|
| Security Officer | Designated |
| Workforce training | Annual + onboarding |
| Risk analysis | Annual + significant changes |
| Incident response | Documented procedure |
| Business Associate Agreements | All vendors |

### Technical Safeguards

| Safeguard | Implementation |
|-----------|----------------|
| Access controls | Role-based, MFA required |
| Audit controls | Comprehensive logging |
| Integrity controls | Checksums, versioning |
| Transmission security | TLS 1.2+ |

### Physical Safeguards

| Safeguard | Implementation |
|-----------|----------------|
| Facility access | Cloud-based (SOC 2 vendors) |
| Workstation security | Encrypted devices, remote wipe |
| Device controls | Inventory tracking |

## 7.3 FDA Considerations

### Device Classification

| Device Type | FDA Status | Our Approach |
|-------------|------------|--------------|
| Wearables (Fitbit, etc.) | General wellness | Consumer devices |
| BP monitors | 510(k) cleared | Use cleared devices |
| CGMs | 510(k)/PMA | Use cleared devices |
| Our software | Enforcement discretion (CDS) | Monitor FDA guidance |

### Clinical Decision Support

Our AI/ML models operate as:
- **Category 1 CDS** (supports clinician decision-making)
- Not intended to replace clinical judgment
- Clinician reviews all AI recommendations
- Transparent algorithms with explanations

## 7.4 State Licensure

### Current Operations

| State | Status | Services |
|-------|--------|----------|
| Texas | Licensed | Full operations |

### Expansion Plan

| State | Timeline | Rationale |
|-------|----------|-----------|
| Florida | Q3 2026 | Large Medicare population |
| California | Q4 2026 | Market opportunity |
| Arizona | Q1 2027 | Senior demographics |

---

# SECTION 8: APPENDICES

## Appendix A: Technology Screenshots

*[To be included: Platform screenshots demonstrating]*
- Patient dashboard
- Vital signs monitoring
- Telehealth interface
- Care coordination tools
- Clinical alerts
- PROM collection
- AI risk predictions

## Appendix B: Clinical Protocols

*[To be included: Detailed clinical protocols for each track]*
- eCKM hypertension management protocol
- CKM diabetes management protocol
- MSK chronic pain protocol
- BH depression/anxiety protocol

## Appendix C: Sample Reports

*[To be included: Sample CMS reporting formats]*
- Quarterly outcome reports
- Patient-level detail reports
- Quality measure summaries

## Appendix D: Letters of Support

*[To be obtained]*
- Primary care practice partners
- Specialty consultants
- Patient advocacy organizations
- Technology vendors (device manufacturers)

## Appendix E: Staff Credentials

*[To be included]*
- Clinical Director CV
- Key clinical staff qualifications
- Training certifications

## Appendix F: HIPAA Documentation

*[Available upon request]*
- Notice of Privacy Practices
- Security policies
- Risk assessment summary
- BAA template

---

# SUBMISSION CHECKLIST

## Required Documents

- [ ] Completed CMS ACCESS Model Request for Applications
- [ ] Organization information and legal documentation
- [ ] Medicare Part B enrollment confirmation
- [ ] Clinical Director designation and credentials
- [ ] Technology capability documentation
- [ ] Implementation plan
- [ ] Quality measurement framework
- [ ] Financial projections
- [ ] HIPAA compliance attestation
- [ ] State licensure documentation
- [ ] Letters of support

## Pre-Submission Verification

- [ ] All required fields completed
- [ ] Contact information verified
- [ ] NPI numbers confirmed
- [ ] Signatures obtained
- [ ] Supporting documents attached

## Submission

- [ ] Register on CMS Participant Portal
- [ ] Upload application materials
- [ ] Submit by **April 1, 2026**
- [ ] Confirm receipt from CMS

---

# CONTACT INFORMATION

**WellFit Community, LLC**

**Application Contact:**
Maria Gonzalez-Smithfield, CEO
maria@wellfitcommunity.com

**Clinical Contact:**
Akima Taylor, RN, BSN
Clinical Operations Lead
akima@wellfitcommunity.com

**Technical Contact:**
[Technical Lead Name]
[Email]

---

**Document Version:** 1.0
**Prepared:** January 18, 2026
**Target Submission:** April 1, 2026

**CMS Contact:** ACCESSModelTeam@cms.hhs.gov
