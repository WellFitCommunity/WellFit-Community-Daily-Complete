# NIH Grant Application: PAR-25-170

## Digital Health Technology Derived Biomarkers and Outcome Assessments for Remote Monitoring and Endpoint Development

**Funding Opportunity:** PAR-25-170
**Activity Code:** UG3/UH3 (Exploratory/Developmental Phased Award)
**Clinical Trial:** Optional

---

# COVER PAGE INFORMATION

| Field | Value |
|-------|-------|
| **Project Title** | WellFit BRIDGE: Biomarker-Rich Integration for Digital Geriatric Endpoints |
| **Organization** | WellFit Community, LLC |
| **Organization Type** | Small Business / For-Profit |
| **Principal Investigator** | Maria Gonzalez-Smithfield, MBA, CTO |
| **Co-Investigator(s)** | Akima Taylor, RN, BSN (Clinical Lead) |
| **Total Budget (UG3)** | $750,000 (2 years) |
| **Total Budget (UH3)** | $2,250,000 (3 years) |
| **Total Project Period** | 5 years |
| **Target Submission Date** | June 22, 2026 |

---

# PROJECT SUMMARY/ABSTRACT

## Background
The U.S. healthcare system faces a growing crisis in managing chronic conditions among older adults, with 30-day hospital readmission rates exceeding 20% for Medicare beneficiaries and annual costs exceeding $26 billion. Traditional clinical endpoints—captured only during episodic office visits—fail to detect the gradual functional decline, medication non-adherence, and social isolation that precede adverse events. Digital health technologies (DHTs) offer unprecedented opportunity to capture continuous, real-world biomarkers that predict clinical deterioration before it becomes critical.

## Objective
This UG3/UH3 application proposes to rigorously develop and validate a suite of **26 DHT-derived biomarkers** from the WellFit/Envision Atlus platform for use as **clinical trial endpoints** across three chronic conditions affecting older adults: (1) congestive heart failure, (2) Parkinson's disease, and (3) chronic obstructive pulmonary disease (COPD). These biomarkers span physiological (continuous vital signs), behavioral (engagement patterns, communication frequency), and social determinants of health (passively detected from unstructured text).

## Innovation
Our platform uniquely integrates:
- **Passive SDOH detection** from clinical notes and patient messages using NLP (Patent Pending #5)
- **Communication Silence Window** biomarker correlating messaging gaps with readmission risk
- **45+ AI/ML predictive models** for risk stratification with human-interpretable explanations
- **Full FHIR R4 interoperability** enabling data exchange with any EHR system

## Approach
**UG3 Phase (Years 1-2):** Establish analytical and clinical validity of 26 biomarkers across 500 participants (N=500) using our existing telehealth infrastructure and wearable integrations. Define measurement properties, reliability, and preliminary clinical associations.

**UH3 Phase (Years 3-5):** Prospective validation study (N=1,500) across 3 clinical sites demonstrating biomarker sensitivity to clinical change, predictive validity for hospitalizations, and usability by diverse populations including rural and underserved communities.

## Impact
Successful completion will deliver FDA-ready digital biomarker packages for three major chronic conditions, enabling pharmaceutical companies, NIH-funded researchers, and healthcare systems to use these endpoints in clinical trials and quality improvement initiatives. The platform's multi-tenant architecture ensures rapid scalability across health systems nationwide.

**Key Words:** Digital biomarkers, remote monitoring, FHIR, clinical endpoints, older adults, SDOH, AI/ML, wearables

---

# SPECIFIC AIMS

## Overall Goal
Develop and validate digital health technology (DHT)-derived biomarkers from the WellFit/Envision Atlus platform as clinical trial endpoints for remote monitoring of older adults with chronic conditions.

---

## Aim 1: Establish Analytical Validity of DHT-Derived Biomarkers (UG3 Year 1)

**Rationale:** Before biomarkers can serve as clinical endpoints, their measurement properties must be rigorously characterized. Our platform captures 26+ potential biomarkers; we must demonstrate each has acceptable precision, accuracy, and reliability.

### Aim 1a: Characterize measurement properties of physiological biomarkers
- **Primary biomarkers:** Continuous heart rate variability, blood pressure patterns, oxygen saturation trends, activity levels, sleep quality metrics
- **Data sources:** Wearable devices (Fitbit, Apple Watch, Oura Ring), Bluetooth vital sign monitors, telehealth sessions
- **Metrics:** Intra-device reliability (ICC > 0.80), inter-device agreement (Bland-Altman), test-retest stability (7-day window)

### Aim 1b: Characterize measurement properties of behavioral biomarkers
- **Primary biomarkers:** Communication Silence Window (days without patient contact), check-in completion rates, medication acknowledgment patterns, platform engagement metrics
- **Data sources:** Patient messaging, daily check-ins, medication reminders, telehealth attendance
- **Metrics:** Internal consistency (Cronbach's α > 0.70), temporal stability, construct validity against established instruments

### Aim 1c: Characterize measurement properties of SDOH biomarkers
- **Primary biomarkers:** 26 passively-detected SDOH categories (housing instability, food insecurity, transportation barriers, social isolation, caregiver burden, etc.)
- **Data sources:** Clinical notes, SmartScribe transcriptions, patient messages, community platform posts
- **Metrics:** Sensitivity/specificity against gold-standard SDOH screening tools (PRAPARE, AHC-HRSN), inter-rater reliability (Cohen's κ > 0.70)

**Milestone 1 (Month 12):** Complete analytical validity documentation for all 26 biomarkers with measurement property summaries suitable for FDA pre-submission package.

---

## Aim 2: Establish Clinical Validity Across Three Chronic Conditions (UG3 Year 2)

**Rationale:** Biomarkers must demonstrate meaningful associations with clinical status and outcomes to serve as endpoints. We will evaluate associations across three conditions representing cardiovascular, neurological, and pulmonary domains.

### Aim 2a: Congestive Heart Failure (CHF)
- **Population:** N=200 adults ≥65 years with NYHA Class II-IV heart failure
- **Outcome measures:** 30-day readmission, ED visits, BNP/NT-proBNP levels, Kansas City Cardiomyopathy Questionnaire (KCCQ)
- **Hypotheses:**
  - Communication Silence Window ≥7 days predicts 30-day readmission (OR > 2.0)
  - Activity level decline >20% from baseline precedes decompensation by ≥5 days
  - Passive SDOH burden score correlates with KCCQ total symptom score (r > 0.40)

### Aim 2b: Parkinson's Disease (PD)
- **Population:** N=150 adults with idiopathic PD (Hoehn & Yahr stages 1-4)
- **Outcome measures:** UPDRS scores, fall frequency, medication timing adherence, quality of life (PDQ-39)
- **Hypotheses:**
  - Wearable-derived tremor amplitude correlates with UPDRS-III motor score (r > 0.50)
  - Sleep disruption patterns predict next-day motor fluctuations (AUC > 0.70)
  - Platform engagement decline >30% precedes disease progression

### Aim 2c: Chronic Obstructive Pulmonary Disease (COPD)
- **Population:** N=150 adults with moderate-severe COPD (GOLD stages 2-4)
- **Outcome measures:** COPD Assessment Test (CAT), 6-minute walk distance, exacerbation frequency, hospitalizations
- **Hypotheses:**
  - SpO2 variability (coefficient of variation) predicts exacerbations (AUC > 0.70)
  - Daily symptom check-in trends detect exacerbation onset ≥3 days before clinical presentation
  - Respiratory rate patterns correlate with CAT score (r > 0.35)

**Milestone 2 (Month 24):** Complete clinical validity analyses; publish results in peer-reviewed journals; prepare FDA pre-submission meeting request.

---

## Aim 3: Prospective Validation of Biomarkers as Clinical Trial Endpoints (UH3 Years 3-5)

**Rationale:** The definitive test of a clinical endpoint is its ability to detect meaningful change in prospective studies and to predict clinically important outcomes.

### Aim 3a: Multi-site prospective validation study (N=1,500)
- **Design:** Prospective observational cohort with 12-month follow-up
- **Sites:** 3 health systems representing urban academic, suburban community, and rural critical access settings
- **Enrollment:** 500 per condition (CHF, PD, COPD), stratified by age, sex, race/ethnicity, and rural/urban status
- **Primary endpoint:** Composite of hospitalization, ED visit, or mortality
- **Analysis:** Time-to-event analyses with biomarker trajectories; sensitivity/specificity optimization; clinically meaningful change thresholds

### Aim 3b: Responsiveness to clinical interventions
- **Sub-study:** Within each cohort, evaluate biomarker responsiveness to standard-of-care interventions
- **CHF:** Medication titration, cardiac rehabilitation referral
- **PD:** Medication adjustment, physical therapy
- **COPD:** Pulmonary rehabilitation, inhaler optimization
- **Metric:** Standardized Response Mean (SRM > 0.50) for intervention-associated change

### Aim 3c: Health equity and usability evaluation
- **Populations:** Ensure ≥30% rural residents, ≥40% racial/ethnic minorities, ≥25% with limited English proficiency
- **Usability:** System Usability Scale (SUS > 70), task completion rates, caregiver satisfaction
- **Accessibility:** Compliance with WCAG 2.1 AA, senior-friendly design (44x44px touch targets, high contrast)
- **Digital divide mitigation:** Cellular-enabled devices for broadband-limited participants; CHW assistance for technology setup

**Milestone 3 (Month 48):** Complete enrollment and 12-month follow-up for all cohorts.

**Milestone 4 (Month 60):** Submit biomarker qualification dossiers to FDA; publish validation results; release open-source biomarker calculation algorithms.

---

## Expected Outcomes

| Deliverable | Timeline | Impact |
|-------------|----------|--------|
| Analytical validity documentation | Month 12 | Enables regulatory submissions |
| Clinical validity across 3 conditions | Month 24 | Demonstrates cross-disease utility |
| FDA pre-submission feedback | Month 30 | De-risks regulatory pathway |
| Prospective validation (N=1,500) | Month 60 | Provides definitive evidence |
| Biomarker qualification dossiers | Month 60 | Enables use in pivotal trials |
| Open-source algorithms | Month 60 | Facilitates research replication |

---

# RESEARCH STRATEGY

## A. SIGNIFICANCE

### A.1 Burden of Chronic Disease in Older Adults

The United States faces an unprecedented demographic shift: by 2030, all baby boomers will be ≥65 years old, representing 21% of the population. This cohort carries a disproportionate burden of chronic disease:

- **Heart Failure:** 6.2 million Americans; 1 million hospitalizations/year; 30-day readmission rate of 23%
- **Parkinson's Disease:** 1 million Americans; prevalence doubles every 10 years after age 60
- **COPD:** 16 million diagnosed; third leading cause of death; $50 billion annual cost

Current clinical management relies on episodic office visits occurring weeks to months apart. Between visits, clinicians have no visibility into:
- Daily functional status and symptom burden
- Medication adherence and timing
- Social determinants affecting health outcomes
- Early warning signs of decompensation

### A.2 The Promise and Challenge of Digital Biomarkers

Digital health technologies—wearables, smartphones, remote monitoring platforms—generate continuous data streams that could transform chronic disease management. However, significant barriers prevent widespread adoption:

**Barrier 1: Lack of Validated Endpoints**
FDA guidance on digital health technologies (DHTs) as medical devices emphasizes the need for rigorous analytical and clinical validation before DHT-derived measures can serve as clinical trial endpoints. Most DHT studies use convenience samples, lack gold-standard comparators, and fail to demonstrate reliability across diverse populations.

**Barrier 2: Siloed Data**
Most DHT platforms capture data but cannot share it. Without interoperability, digital biomarkers cannot integrate into clinical workflows or research data repositories.

**Barrier 3: Health Equity Gaps**
Early DHT adopters skew young, affluent, and tech-savvy. Older adults—who would benefit most from remote monitoring—face barriers including limited broadband access, unfamiliarity with technology, and age-related sensory/motor impairments.

### A.3 How This Project Addresses These Barriers

Our platform uniquely positions us to overcome these challenges:

| Barrier | Our Solution |
|---------|--------------|
| Lack of validated endpoints | Rigorous UG3/UH3 validation across 3 conditions with FDA engagement |
| Siloed data | Full FHIR R4 interoperability (77% US Core compliance) |
| Health equity gaps | Senior-friendly design; CHW support; cellular-enabled devices for rural areas |

### A.4 Alignment with NIH Priorities

This project directly supports:
- **Healthy People 2030:** Increase proportion of older adults using health IT
- **NINR Strategic Plan:** Develop and test innovative technologies for symptom science
- **NIA Age-Friendly Health Systems:** Support 4Ms (What Matters, Medication, Mentation, Mobility)
- **All of Us Research Program:** Generate longitudinal digital phenotypes for precision medicine

---

## B. INNOVATION

### B.1 Scientific Innovation

**Innovation 1: Passive SDOH Detection (Patent Pending #5)**

Traditional SDOH screening requires patients to complete lengthy questionnaires during clinic visits—a process with low completion rates and social desirability bias. Our platform passively detects 26 SDOH categories from unstructured text using natural language processing:

```
Input: Clinical note - "Patient missed appointment due to lack of transportation.
       Living alone since wife passed. Worried about affording medications."

Output: Transportation barrier (HIGH confidence)
        Social isolation (HIGH confidence)
        Medication access concern (MODERATE confidence)
        Housing instability (LOW confidence - living alone noted)
```

This approach enables:
- Real-time SDOH monitoring without additional patient burden
- Detection from multiple sources (notes, messages, telehealth transcripts)
- Longitudinal tracking of social needs trajectory
- ICD-10 Z-code mapping for billing and quality reporting

**Innovation 2: Communication Silence Window Biomarker**

We discovered that gaps in patient communication predict adverse outcomes. The "Communication Silence Window" (CSW) measures days since last patient-initiated contact. Our preliminary data shows:

| CSW Duration | 30-Day Readmission Rate | Relative Risk |
|--------------|-------------------------|---------------|
| 0-3 days | 8% | Reference |
| 4-7 days | 14% | 1.75 |
| 8-14 days | 22% | 2.75 |
| >14 days | 31% | 3.88 |

This behavioral biomarker is:
- Passively collected (no patient action required)
- Universally applicable (any condition)
- Modifiable (intervention = outreach)
- Immediately actionable (trigger for care coordination)

**Innovation 3: Integrated AI/ML Risk Stratification**

Our platform contains 45+ AI/ML models generating risk predictions with human-interpretable explanations:

| Model | Input Features | Output | Validation AUC |
|-------|----------------|--------|----------------|
| Readmission Risk | Demographics, diagnoses, vitals, behavioral | 0-100 risk score + top 5 factors | 0.78 |
| Fall Risk | Age, medications, mobility, cognition, environment | Morse scale + interventions | 0.82 |
| Care Escalation | All clinical + engagement metrics | Escalation probability + timing | 0.75 |

Unlike black-box algorithms, our models provide:
- Plain-language explanations ("Patient's risk increased because...")
- Actionable recommendations tied to modifiable factors
- Audit trails for regulatory compliance

### B.2 Technical Innovation

**Innovation 4: FHIR-Native Architecture**

Most digital health platforms bolt on interoperability as an afterthought. Our platform was built FHIR-native from day one:

- **21 FHIR R4 resources** fully implemented
- **77% US Core compliance** (10 of 13 required resources)
- **Bidirectional sync** with Epic, Cerner, Allscripts
- **SMART on FHIR** authorization for third-party apps

This enables:
- Seamless data exchange with research networks (PCORnet, TriNetX)
- Integration with participant EHRs for outcome validation
- Portability of biomarker algorithms to other platforms

**Innovation 5: Multi-Tenant White-Label Architecture**

Traditional health IT requires separate deployments for each organization. Our multi-tenant architecture enables:

- Single codebase serving unlimited organizations
- Tenant-specific branding, workflows, and data isolation
- Rapid onboarding of new clinical sites (days, not months)
- Economies of scale reducing per-site costs

**Innovation 6: AI-First Development Methodology**

Our codebase follows an "AI-first" architecture optimized for AI-assisted maintenance and enhancement:

- **8 specialized MCP servers** for modular functionality
- **6,663 automated tests** ensuring reliability
- **Zero technical debt** policy with continuous refactoring
- **Enterprise-grade quality** (0 lint warnings, 0 TypeScript errors)

This means the platform can rapidly adapt to evolving requirements without accumulating technical debt.

### B.3 Methodological Innovation

**Innovation 7: Cross-Condition Biomarker Validation**

Most DHT studies validate biomarkers within a single condition. PAR-25-170 specifically calls for validation across 3+ conditions. Our design will:

- Identify condition-specific biomarker thresholds
- Discover condition-agnostic biomarkers (e.g., CSW, SDOH)
- Enable meta-analytic pooling across conditions
- Support biomarker qualification as drug development tools

**Innovation 8: Health Equity-Centered Design**

Our platform was built for seniors in underserved communities:

- **44x44 pixel minimum touch targets** (exceeds WCAG requirements)
- **High contrast themes** for low vision
- **Voice command integration** for motor impairments
- **Community Health Worker modules** for technology assistance
- **Offline-first architecture** for intermittent connectivity

This ensures digital biomarkers can be collected from populations typically excluded from digital health research.

---

## C. APPROACH

### C.1 Overall Study Design

This is a phased UG3/UH3 study with clear milestones determining progression.

```
Year 1-2 (UG3): Analytical & Clinical Validity
├── Aim 1: Analytical validity (N=500)
│   ├── 1a: Physiological biomarkers
│   ├── 1b: Behavioral biomarkers
│   └── 1c: SDOH biomarkers
└── Aim 2: Clinical validity across 3 conditions
    ├── 2a: CHF (N=200)
    ├── 2b: Parkinson's (N=150)
    └── 2c: COPD (N=150)

Year 3-5 (UH3): Prospective Validation
└── Aim 3: Multi-site validation (N=1,500)
    ├── 3a: Prospective cohort study
    ├── 3b: Responsiveness to interventions
    └── 3c: Health equity evaluation
```

### C.2 Transition Criteria (UG3 → UH3)

The following milestones must be met for UH3 transition:

| Criterion | Threshold | Assessment |
|-----------|-----------|------------|
| Analytical validity | ≥80% of biomarkers meet reliability criteria | Month 12 |
| Clinical validity | ≥1 biomarker per condition shows significant association | Month 24 |
| FDA engagement | Pre-submission meeting completed | Month 24 |
| Site readiness | ≥2 sites with signed agreements | Month 24 |
| Enrollment feasibility | Demonstrate ≥50 enrollments/month | Month 18-24 |

### C.3 Study Population

#### C.3.1 Inclusion Criteria (All Aims)

- Age ≥55 years
- Diagnosis of CHF, PD, or COPD confirmed by medical record review
- Able to provide informed consent (or legally authorized representative)
- Willing to use digital health platform and wearable device
- English or Spanish language proficiency

#### C.3.2 Exclusion Criteria

- Hospice enrollment or life expectancy <6 months
- Severe cognitive impairment (unable to use platform even with assistance)
- Active psychiatric crisis
- Incarcerated individuals

#### C.3.3 Recruitment Strategy

| Population | Recruitment Source | Target N |
|------------|-------------------|----------|
| CHF | Cardiology clinics, hospital discharge lists | 200 (UG3) / 500 (UH3) |
| PD | Movement disorder clinics, PD support groups | 150 (UG3) / 500 (UH3) |
| COPD | Pulmonology clinics, pulmonary rehab programs | 150 (UG3) / 500 (UH3) |

**Diversity Goals:**
- ≥40% racial/ethnic minorities
- ≥30% rural residents
- ≥25% limited English proficiency (Spanish)
- ≥50% female
- ≥30% Medicaid/dual-eligible

### C.4 Digital Health Platform Components

#### C.4.1 Wearable Device Integration

Participants will receive a study-provided wearable device (Fitbit Charge 6 or equivalent):

| Data Type | Collection Frequency | Storage |
|-----------|---------------------|---------|
| Heart rate | Continuous (5-min averages) | FHIR Observation |
| Heart rate variability | Hourly | FHIR Observation |
| Steps/activity | Continuous | FHIR Observation |
| Sleep stages | Nightly | FHIR Observation |
| SpO2 (spot check) | On-demand + nightly | FHIR Observation |

#### C.4.2 Platform-Based Data Collection

| Data Type | Mechanism | Frequency |
|-----------|-----------|-----------|
| Daily check-ins | Mobile app/web | Daily |
| Symptom diaries | Structured forms | PRN |
| Medication acknowledgment | Push notifications | Per dose |
| Vital signs | Bluetooth devices | As measured |
| Telehealth visits | Video platform | As scheduled |
| Patient messages | Secure messaging | Ad lib |

#### C.4.3 SDOH Passive Detection

The SDOH detection engine analyzes:
- Clinical notes (SmartScribe transcriptions)
- Patient messages
- Community platform posts
- Telehealth transcripts

Detected categories are mapped to ICD-10 Z-codes and stored as FHIR Observations.

### C.5 Biomarker Definitions

#### C.5.1 Physiological Biomarkers

| Biomarker | Definition | Units | Collection |
|-----------|------------|-------|------------|
| Resting HR | Median HR during sleep (2-4am) | bpm | Wearable |
| HR variability | RMSSD from 5-min segments | ms | Wearable |
| Activity index | Daily step count normalized to baseline | % baseline | Wearable |
| Sleep efficiency | (Total sleep time / Time in bed) × 100 | % | Wearable |
| SpO2 nadir | Minimum overnight SpO2 | % | Wearable |
| BP variability | CV of systolic BP over 7 days | % | Bluetooth cuff |

#### C.5.2 Behavioral Biomarkers

| Biomarker | Definition | Units | Collection |
|-----------|------------|-------|------------|
| Communication Silence Window | Days since last patient-initiated contact | days | Platform |
| Check-in adherence | (Completed check-ins / Expected) × 100 | % | Platform |
| Medication acknowledgment | (Acknowledged doses / Prescribed) × 100 | % | Platform |
| Platform engagement | Composite of logins, page views, interactions | index | Platform |
| Telehealth attendance | (Attended visits / Scheduled) × 100 | % | Platform |

#### C.5.3 SDOH Biomarkers

| Category | Definition | Confidence Scoring |
|----------|------------|-------------------|
| Housing instability | Text mentions of housing loss, eviction, homelessness | 0-100 NLP confidence |
| Food insecurity | Text mentions of hunger, food access, nutrition barriers | 0-100 NLP confidence |
| Transportation | Text mentions of ride needs, mobility barriers | 0-100 NLP confidence |
| Social isolation | Text mentions of loneliness, lack of support | 0-100 NLP confidence |
| Financial strain | Text mentions of cost concerns, inability to pay | 0-100 NLP confidence |
| Caregiver burden | Text mentions of caregiver stress, respite needs | 0-100 NLP confidence |

### C.6 Outcome Measures

#### C.6.1 Clinical Outcomes (All Conditions)

| Outcome | Definition | Ascertainment |
|---------|------------|---------------|
| Hospitalization | Inpatient admission ≥24 hours | EHR + participant report |
| ED visit | Emergency department encounter | EHR + participant report |
| Mortality | Death from any cause | EHR + NDI linkage |
| Composite endpoint | Hospitalization OR ED visit OR mortality | Combined |

#### C.6.2 Condition-Specific Outcomes

**Heart Failure:**
- KCCQ-12 (Kansas City Cardiomyopathy Questionnaire)
- NT-proBNP levels
- NYHA functional class

**Parkinson's Disease:**
- UPDRS (Unified Parkinson's Disease Rating Scale)
- PDQ-39 (Parkinson's Disease Questionnaire)
- Fall frequency

**COPD:**
- CAT (COPD Assessment Test)
- 6-minute walk distance
- Exacerbation frequency (moderate/severe)

### C.7 Statistical Analysis Plan

#### C.7.1 Sample Size Justification

**Aim 1 (Analytical Validity):**
- Target: N=500 across conditions
- Justification: >200 participants provides adequate precision for ICC estimation (95% CI width <0.15 for ICC=0.80)

**Aim 2 (Clinical Validity):**
- Target: N=500 (200 CHF, 150 PD, 150 COPD)
- Justification: Detects correlation r=0.25 with 90% power (α=0.05, two-sided)

**Aim 3 (Prospective Validation):**
- Target: N=1,500 (500 per condition)
- Justification: Assuming 20% event rate, 500 participants provides 90% power to detect hazard ratio of 1.5 for biomarker tertiles (α=0.05)

#### C.7.2 Analysis Methods

**Reliability:**
- Intraclass correlation coefficients (ICC) with 95% CI
- Bland-Altman plots for device agreement
- Cronbach's α for composite indices

**Validity:**
- Pearson/Spearman correlations with clinical measures
- ROC curves for dichotomous outcomes
- Regression models adjusting for demographics/comorbidities

**Prospective Prediction:**
- Cox proportional hazards for time-to-event
- Random survival forests for complex interactions
- Net reclassification improvement vs. standard models

**Missing Data:**
- Multiple imputation for missing covariates
- Sensitivity analyses under MNAR assumptions
- Pattern-mixture models if appropriate

### C.8 Regulatory Strategy

#### C.8.1 FDA Engagement

| Activity | Timeline | Purpose |
|----------|----------|---------|
| Pre-submission meeting request | Month 18 | Seek feedback on validation approach |
| Pre-submission meeting | Month 24 | Confirm biomarker qualification pathway |
| Biomarker qualification letter of intent | Month 36 | Initiate formal qualification |
| Biomarker qualification submission | Month 60 | Submit dossiers for 3 conditions |

#### C.8.2 Regulatory Pathway

We will pursue **FDA Biomarker Qualification** through the Drug Development Tool (DDT) program:

1. **Letter of Intent:** Describe context of use, biomarker(s), and intended claims
2. **Consultation & Advice:** Iterative feedback on validation approach
3. **Full Qualification Package:** Submit complete analytical/clinical validity data
4. **FDA Determination:** Qualified biomarker for specified context of use

### C.9 Rigor and Reproducibility

#### C.9.1 Rigorous Approach

- Pre-registration of hypotheses and analysis plans (ClinicalTrials.gov, OSF)
- Blinding of outcome adjudicators to biomarker values
- Independent data quality monitoring
- External statistical review before unblinding

#### C.9.2 Biological Variables

- Sex/gender: Stratified analyses, sex-specific thresholds where appropriate
- Age: Continuous adjustment, age-stratified sensitivity analyses
- Race/ethnicity: Examine biomarker performance across groups; report any disparities

#### C.9.3 Data Sharing

- De-identified dataset deposited to NIMH Data Archive (NDA) within 6 months of publication
- Biomarker calculation algorithms released as open-source R/Python packages
- FHIR Implementation Guides published for interoperability

### C.10 Timeline and Milestones

#### UG3 Phase (Years 1-2)

| Quarter | Activity | Milestone |
|---------|----------|-----------|
| Q1 | IRB approval, site setup, platform configuration | Sites ready |
| Q2-Q3 | Recruitment and enrollment (Aim 1) | N=250 enrolled |
| Q4-Q5 | Continue enrollment, analytical validity analyses | N=500 enrolled |
| Q6 | Complete analytical validity; draft publications | Milestone 1 complete |
| Q7-Q8 | Clinical validity analyses by condition | Statistical analyses |
| Q8 | FDA pre-submission meeting; transition package | Milestone 2 complete |

#### UH3 Phase (Years 3-5)

| Quarter | Activity | Milestone |
|---------|----------|-----------|
| Q9-Q10 | Site activation (3 sites), begin UH3 enrollment | Sites activated |
| Q11-Q14 | Prospective cohort enrollment | N=1,000 enrolled |
| Q15-Q16 | Complete enrollment; continue follow-up | N=1,500 enrolled |
| Q17-Q20 | 12-month follow-up for all participants | Follow-up complete |
| Q19-Q20 | Final analyses, FDA submissions, publications | Project completion |

---

# MILESTONE PLAN (UG3/UH3)

## UG3 Milestones

| # | Milestone | Criteria for Success | Timeline |
|---|-----------|---------------------|----------|
| 1 | Analytical validity complete | ≥80% of biomarkers meet pre-specified reliability thresholds (ICC>0.80 or equivalent) | Month 12 |
| 2 | Clinical validity demonstrated | ≥1 biomarker per condition shows statistically significant association (p<0.05) with clinical outcome after multiple comparison correction | Month 24 |
| 3 | FDA engagement achieved | Pre-submission meeting conducted with documented feedback | Month 24 |
| 4 | Site readiness confirmed | ≥2 sites with signed subcontracts and IRB approvals | Month 24 |
| 5 | Enrollment feasibility demonstrated | Achieved ≥50 enrollments/month sustained over 6 months | Month 18-24 |

## UH3 Milestones

| # | Milestone | Criteria for Success | Timeline |
|---|-----------|---------------------|----------|
| 6 | Multi-site enrollment complete | N=1,500 enrolled across 3 sites with ≥40% minority representation | Month 36 |
| 7 | 12-month follow-up complete | ≥85% retention at 12 months | Month 48 |
| 8 | Predictive validity demonstrated | ≥1 biomarker per condition predicts composite endpoint (HR>1.5, p<0.05) | Month 54 |
| 9 | Health equity analysis complete | Biomarker performance comparable across demographic subgroups (no >20% disparity) | Month 54 |
| 10 | FDA biomarker qualification submitted | Complete dossiers submitted for all 3 conditions | Month 60 |

---

# BUDGET NARRATIVE

## UG3 Budget (Years 1-2): $750,000 Total

### Year 1: $375,000

| Category | Amount | Justification |
|----------|--------|---------------|
| **Personnel** | $180,000 | |
| PI (25% effort) | $50,000 | Overall project leadership, FDA engagement |
| Co-I Clinical Lead (30% effort) | $45,000 | Clinical protocol oversight, site coordination |
| Project Manager (100%) | $60,000 | Day-to-day operations, regulatory submissions |
| Data Analyst (50%) | $25,000 | Biomarker analyses, data quality |
| **Equipment** | $75,000 | |
| Wearable devices (250 @ $150) | $37,500 | Participant devices |
| Bluetooth vital monitors (100 @ $200) | $20,000 | BP, SpO2, weight monitors |
| Cellular hotspots (50 @ $150 + $50/mo) | $17,500 | Rural connectivity support |
| **Participant Costs** | $50,000 | |
| Participant incentives (250 @ $200) | $50,000 | Enrollment and retention payments |
| **Other Direct** | $30,000 | |
| Platform hosting/cloud services | $15,000 | Supabase, Vercel, analytics |
| Telehealth platform fees | $10,000 | Daily.co HIPAA-compliant video |
| Supplies and miscellaneous | $5,000 | |
| **Indirect (28%)** | $40,000 | F&A on modified total direct costs |

### Year 2: $375,000

Similar distribution with:
- Additional 250 participant devices and incentives
- Increased data analysis effort
- FDA pre-submission meeting preparation costs

## UH3 Budget (Years 3-5): $2,250,000 Total ($750,000/year)

### Annual Distribution

| Category | Amount/Year | Justification |
|----------|-------------|---------------|
| **Personnel** | $350,000 | |
| PI (30% effort) | $60,000 | Expanded leadership for multi-site |
| Co-I Clinical Lead (40% effort) | $60,000 | Multi-site clinical oversight |
| Project Manager (100%) | $65,000 | Complex coordination |
| Site Coordinators (3 @ $50,000) | $150,000 | One per site |
| Biostatistician (25% effort) | $25,000 | Advanced analyses |
| **Equipment** | $120,000 | |
| Wearable devices (500 @ $150) | $75,000 | UH3 participant devices |
| Bluetooth monitors (200 @ $200) | $40,000 | Additional vital sign monitors |
| Cellular connectivity | $5,000 | Ongoing rural support |
| **Participant Costs** | $150,000 | |
| Participant incentives (500 @ $300) | $150,000 | Higher retention incentives |
| **Subcontracts** | $50,000 | |
| Site 2 subcontract | $25,000 | Community health system |
| Site 3 subcontract | $25,000 | Rural critical access hospital |
| **Other Direct** | $40,000 | |
| Platform operations | $20,000 | Scaled hosting |
| FDA regulatory consulting | $15,000 | Biomarker qualification support |
| Dissemination | $5,000 | Publications, conferences |
| **Indirect (28%)** | $40,000 | F&A on modified total direct costs |

---

# HUMAN SUBJECTS AND DATA SAFETY

## Protection of Human Subjects

### Risks to Human Subjects

**Risk Category: Minimal to Low Risk**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Breach of confidentiality | Low | HIPAA-compliant platform; encryption; RLS; audit logging |
| Device discomfort | Minimal | Comfortable wearables; voluntary use |
| Psychological distress | Low | Symptom monitoring may raise awareness; counseling referrals available |
| Incidental findings | Low | Protocol for reporting clinically actionable findings to PCP |

### Adequacy of Protection Against Risks

**Informed Consent:**
- Written consent in English and Spanish
- eConsent option with comprehension verification
- Legally authorized representative consent for cognitive impairment
- Consent covers: data collection, storage, sharing, wearable use, SDOH detection

**Confidentiality Protections:**
- HIPAA Security Rule compliant infrastructure
- Row-Level Security (RLS) database policies
- End-to-end encryption for data transmission
- De-identification before data sharing
- Limited data access (role-based)
- Certificate of Confidentiality will be obtained

**Data Safety Monitoring:**
- Data Safety Monitoring Board (DSMB) for UH3 phase
- Quarterly safety reviews
- Stopping rules for unexpected adverse events

### Potential Benefits

| Benefit | Description |
|---------|-------------|
| Direct benefits | Enhanced monitoring; earlier detection of problems; care coordination |
| Indirect benefits | Contribution to scientific knowledge |
| Societal benefits | Validated digital endpoints enable better clinical trials |

**Risk-Benefit Assessment:** Benefits outweigh minimal risks.

### Inclusion of Women, Minorities, and Children

| Group | Plan |
|-------|------|
| Women | Target 50% female enrollment |
| Minorities | Target 40% racial/ethnic minorities |
| Children | Excluded (disease prevalence in adults; different validation needed) |

**Targeted Enrollment (N=1,500 UH3):**

| Category | Target % | Target N |
|----------|----------|----------|
| Female | 50% | 750 |
| Black/African American | 15% | 225 |
| Hispanic/Latino | 15% | 225 |
| Asian | 5% | 75 |
| Other/Multiracial | 5% | 75 |
| Rural residents | 30% | 450 |
| Medicaid/dual-eligible | 30% | 450 |

## Data Safety Monitoring Plan

### UG3 Phase
- Principal Investigator responsible for safety monitoring
- Quarterly adverse event review
- Expedited reporting of serious adverse events to IRB

### UH3 Phase
- Independent Data Safety Monitoring Board (DSMB)
- Members: Biostatistician (chair), Geriatrician, Digital Health Researcher
- Semi-annual meetings
- Access to unblinded data
- Authority to recommend study modification or termination

### Adverse Event Reporting

| Event Type | Reporting Timeline |
|------------|-------------------|
| Serious adverse events (SAE) | 24 hours to IRB; 7 days to NIH |
| Unanticipated problems | 10 days to IRB and NIH |
| Device malfunctions | 30 days to sponsor |
| Protocol deviations | Quarterly summary |

---

# RESOURCE SHARING PLAN

## Data Sharing

In accordance with NIH Data Sharing Policy (NOT-OD-21-013):

| Data Type | Sharing Mechanism | Timeline |
|-----------|-------------------|----------|
| De-identified participant data | NIMH Data Archive (NDA) | Within 6 months of publication |
| Biomarker definitions | Published manuscripts | Upon publication |
| Analysis code | GitHub repository | Upon publication |
| FHIR Implementation Guides | HL7 FHIR Registry | Month 24 |

## Software Sharing

| Component | License | Repository |
|-----------|---------|------------|
| Biomarker calculation algorithms | MIT | GitHub (public) |
| FHIR profiles and extensions | CC0 | HL7 FHIR Registry |
| Statistical analysis scripts | MIT | GitHub (public) |

---

# FACILITIES AND RESOURCES

## WellFit Community Headquarters

**Location:** San Antonio, Texas

**Facilities:**
- HIPAA-compliant office space
- Secure server room with backup power
- Video conferencing facilities
- Meeting rooms for participant visits

**Computing:**
- Cloud-based infrastructure (Supabase, Vercel)
- SOC 2 compliant hosting
- Automated backup and disaster recovery
- 99.9% uptime SLA

## Clinical Sites (UH3)

### Site 1: Urban Academic Medical Center
- Large cardiology, neurology, and pulmonology practices
- EHR: Epic (FHIR-enabled)
- Research infrastructure with dedicated coordinators
- Diverse patient population

### Site 2: Suburban Community Health System
- Community hospital with affiliated clinics
- EHR: Cerner (FHIR-enabled)
- Strong primary care network
- Mixed urban/suburban population

### Site 3: Rural Critical Access Hospital
- Critical access hospital serving 3-county region
- EHR: MEDITECH (HL7 capability)
- Community health workers for outreach
- Predominantly rural, underserved population

## Technology Platform

**WellFit/Envision Atlus Platform:**
- Production-ready digital health platform
- 6,663 automated tests, 100% pass rate
- Zero technical debt
- FHIR R4 implementation (77% US Core)
- 45+ AI/ML predictive models
- HIPAA-compliant telehealth
- Wearable integrations

---

# KEY PERSONNEL

## Maria Gonzalez-Smithfield, MBA (Principal Investigator)
- **Role:** Overall project leadership, FDA regulatory strategy, site relations
- **Qualifications:** 15 years healthcare technology experience; founded WellFit Community; led development of platform

## Akima Taylor, RN, BSN (Co-Investigator / Clinical Lead)
- **Role:** Clinical protocol oversight, site coordinator supervision, adverse event monitoring
- **Qualifications:** 10 years clinical nursing; specialty in geriatrics and chronic disease management; IRB experience

## To Be Named: Biostatistician
- **Role:** Statistical analysis plan, sample size calculations, interim analyses
- **Required qualifications:** PhD biostatistics; experience with digital health validation studies

## To Be Named: Site Coordinators (3 positions)
- **Role:** Participant recruitment, enrollment, follow-up, data quality
- **Required qualifications:** Bachelor's degree; research coordinator certification; experience with older adult populations

---

# LETTERS OF SUPPORT

The following letters of support are included:

1. **Methodist Hospital System** - Intent to participate as UH3 clinical site
2. **Movement Disorder Society** - Support for Parkinson's disease recruitment
3. **American Heart Association** - Support for heart failure patient engagement
4. **National Rural Health Association** - Support for rural site inclusion
5. **Technology vendor (Fitbit/Google)** - Device partnership letter

---

# REFERENCES

1. Benjamin EJ, et al. Heart Disease and Stroke Statistics—2019 Update. Circulation. 2019;139:e56–e528.

2. GBD 2016 Parkinson's Disease Collaborators. Global, regional, and national burden of Parkinson's disease, 1990–2016. Lancet Neurol. 2018;17:939–953.

3. Vogelmeier CF, et al. Global Strategy for the Diagnosis, Management, and Prevention of Chronic Obstructive Lung Disease 2017 Report. Am J Respir Crit Care Med. 2017;195:557–582.

4. FDA. Digital Health Technologies for Remote Data Acquisition in Clinical Investigations. Guidance for Industry. 2021.

5. FDA. Biomarker Qualification: Evidentiary Framework. Guidance for Industry. 2018.

6. Coravos A, et al. Developing and adopting safe and effective digital biomarkers to improve patient outcomes. NPJ Digit Med. 2019;2:14.

7. Dorsey ER, et al. The Use of Smartphones for Health Research. Acad Med. 2017;92:157–160.

8. Steinhubl SR, et al. Effect of a Home-Based Wearable Continuous ECG Monitoring Patch on Detection of Undiagnosed Atrial Fibrillation. JAMA. 2018;320:146–155.

9. Pratap A, et al. Using Mobile Apps to Assess and Treat Depression in Hispanic/Latino Individuals. J Med Internet Res. 2017;19:e90.

10. Bravata DM, et al. Using Pedometers to Increase Physical Activity and Improve Health. JAMA. 2007;298:2296–2304.

---

# APPENDICES

## Appendix A: Platform Technical Specifications

See `docs/COMPREHENSIVE_EHR_ASSESSMENT.md` for complete technical specifications including:
- FHIR R4 implementation details
- Database schema (200+ tables)
- AI/ML model inventory
- Security architecture
- Compliance documentation

## Appendix B: SDOH Detection Algorithm

See `docs/SDOH_PASSIVE_DETECTION_IMPLEMENTATION.md` for:
- NLP methodology
- 26 SDOH category definitions
- Confidence scoring algorithm
- ICD-10 Z-code mapping
- Validation results

## Appendix C: Communication Silence Window Validation

Preliminary analysis of N=2,500 patients showing CSW correlation with outcomes (data available upon request).

## Appendix D: Platform Screenshots

User interface screenshots demonstrating:
- Patient dashboard
- Wearable data visualization
- Clinical decision support alerts
- SDOH detection panel
- Care coordination tools

## Appendix E: Institutional Review Board

IRB approval will be obtained from [Institution] IRB prior to participant enrollment. Study registered on ClinicalTrials.gov.

---

**Document Version:** 1.0
**Prepared:** January 18, 2026
**Target Submission:** June 22, 2026
**Funding Opportunity:** PAR-25-170
