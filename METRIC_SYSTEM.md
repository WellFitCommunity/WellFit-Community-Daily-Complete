# WellFit Community Healthcare Metric System
## Comprehensive Risk Assessment & Patient Engagement Framework

**Last Updated:** October 5, 2025
**Version:** 2.0

---

## Executive Summary

The WellFit metric system integrates **three complementary scoring mechanisms** to provide a holistic view of senior patient health and wellbeing:

1. **Clinical Risk Assessment** (0-10 scale) - Medical/clinical risk factors
2. **Patient Engagement Score** (0-100 scale) - Activity and participation levels
3. **FHIR Population Metrics** - Population health analytics and quality measures

---

## 1. Clinical Risk Assessment (RiskAssessmentForm)

### Purpose
Clinician-administered assessment of medical and social risk factors affecting patient outcomes.

### Scoring System
- **Scale:** 0-10 points (composite of 4 sub-scores)
- **Sub-scores:** Each scored 1-10
  - Medical Risk (conditions, hospitalizations)
  - Mobility Risk (falls, ADL limitations)
  - Cognitive Risk (memory, decision-making)
  - Social Risk (isolation, living situation)

### Risk Levels & Thresholds

| Overall Score | Risk Level | Priority | Intervention Required |
|--------------|------------|----------|----------------------|
| 8-10 | **CRITICAL** 🔴 | URGENT | Immediate intervention, daily monitoring |
| 6-7.9 | **HIGH** 🟠 | HIGH | Close monitoring, weekly check-ins |
| 4-5.9 | **MODERATE** 🟡 | MEDIUM | Regular monitoring, bi-weekly check-ins |
| 0-3.9 | **LOW** 🟢 | LOW | Standard care, monthly check-ins |

### Key Components
- **Risk Factors:** Fall risk, medication non-compliance, social isolation, cognitive decline, etc.
- **Recommended Actions:** PT referral, medication review, social services, mental health support
- **Review Frequency:** Based on risk level (daily, weekly, bi-weekly, monthly)
- **Next Assessment Due:** Automatically calculated based on frequency

### Clinical Use
- Performed by healthcare providers (nurses, doctors, care coordinators)
- Documented in `risk_assessments` table
- Triggers care plan adjustments
- Required for CCM billing compliance

---

## 2. Patient Engagement Score (PatientEngagementDashboard)

### Purpose
Automated, objective measurement of senior participation and activity within the WellFit platform.

### Scoring System
- **Scale:** 0-100 points (last 30 days)
- **Point Values:**

| Activity Type | Points | Frequency | 30-Day Max |
|--------------|--------|-----------|------------|
| Daily Check-ins | 2 pts each | Daily | 60 pts |
| Games (Trivia/Word Find) | 5 pts each | Multiple/day | Unlimited |
| Self-Report Health Submissions | 3 pts each | Weekly | 12-15 pts |
| Questions to Care Team | 2 pts each | As needed | Unlimited |
| Meal Interactions | 2 pts each | Daily | 60 pts |
| Meal Photos Uploaded | +3 bonus | As created | Unlimited |
| Community Photo Shares | 3 pts each | As shared | Unlimited |

### Engagement Risk Mapping

| Engagement Score | Activity Level | Implied Risk | Color | Action |
|-----------------|----------------|--------------|-------|--------|
| 70-100 | **HIGH ENGAGEMENT** | **LOW RISK** 🟢 | Green | Maintain, celebrate |
| 40-69 | **MEDIUM ENGAGEMENT** | **MEDIUM RISK** 🟡 | Yellow | Monitor, encourage |
| 0-39 | **LOW ENGAGEMENT** | **HIGH RISK** 🔴 | Red | **Intervene immediately** |

### Why This Matters
- **Proxy for Wellbeing:** Active seniors are healthier seniors
- **Early Warning System:** Sudden drops in engagement = potential health crisis
- **Objective Data:** No clinician bias, purely behavioral
- **Real-Time:** Updates automatically as seniors interact

### Example Scenarios

**High Risk Scenario:**
- Mrs. Johnson scored 85/100 last month
- This month: **18/100** ⚠️
- **Action:** Immediate wellness call - possible health event, depression, or hospitalization

**Thriving Scenario:**
- Mr. Davis: 92/100
- Plays trivia daily, uploads meal photos, asks questions
- **Action:** Feature in community newsletter, maintain positive reinforcement

---

## 3. FHIR Population Metrics (FhirAiDashboard)

### Purpose
Clinical quality measures and population health analytics using standardized FHIR data.

### Metrics Tracked

#### Quality Indicators
- **Care Gaps:** Missing preventive care (flu shots, screenings, diabetic eye exams)
- **Chronic Disease Management:** HbA1c control, BP control, medication adherence
- **Readmission Risk:** 30-day readmission predictions
- **Emergency Department Utilization:** Avoidable ED visits

#### Population Health
- **High-Risk Patient Count:** Patients with risk_level = CRITICAL or HIGH
- **Risk Matrix Quadrants:**
  - High Risk + Low Adherence (priority)
  - High Risk + High Adherence (monitor)
  - Low Risk + Low Adherence (engage)
  - Low Risk + High Adherence (maintain)

#### Clinical Outcomes
- **Hospital Admissions:** Tracking trends
- **Condition-Specific Metrics:** Diabetes, HTN, CHF, COPD, CKD
- **SDOH (Social Determinants of Health):** Food insecurity, housing instability, transportation barriers

### FHIR Resources Used
- **Patient** - Demographics, contact info
- **Observation** - Vitals, labs, assessments
- **Condition** - Diagnoses, problem list
- **MedicationRequest** - Prescriptions, adherence
- **Encounter** - Visits, admissions, ED
- **Procedure** - Interventions, screenings
- **CarePlan** - Treatment plans, goals

---

## Integrated Metric System: How They Work Together

### The Three-Dimensional View

```
Clinical Risk Assessment (Medical)
        ↓
Patient Engagement (Behavioral)
        ↓
FHIR Metrics (Outcomes)
        ↓
    COMPREHENSIVE CARE PICTURE
```

### Use Case Examples

#### Example 1: Complete Picture
**Patient:** Mary Thompson, 78 years old

| Metric | Score | Interpretation |
|--------|-------|----------------|
| Clinical Risk | 7.5/10 - **HIGH** | Multiple chronic conditions, recent fall |
| Engagement Score | 82/100 - **HIGH** | Very active, plays games daily, uploads meals |
| FHIR Metrics | HbA1c 7.2%, BP controlled | Good adherence to diabetes/HTN management |

**Assessment:**
- **Medical Risk:** HIGH (needs close monitoring)
- **Behavioral Risk:** LOW (highly engaged, compliant)
- **Outcome Risk:** MODERATE (medical complexity but good self-management)

**Care Plan:**
- Continue current engagement (it's working!)
- Weekly nursing check-ins due to clinical complexity
- Monitor for fall prevention compliance
- Celebrate engagement in community newsletter

---

#### Example 2: Hidden Risk
**Patient:** John Davis, 72 years old

| Metric | Score | Interpretation |
|--------|-------|----------------|
| Clinical Risk | 4/10 - **MODERATE** | Stable diabetes, no major concerns |
| Engagement Score | 15/100 - **LOW** | Stopped using app 3 weeks ago |
| FHIR Metrics | Missed last 2 appointments, no recent labs | Non-adherence pattern emerging |

**Assessment:**
- **Medical Risk:** MODERATE (on paper)
- **Behavioral Risk:** **CRITICAL** (disengaged, missing care)
- **Outcome Risk:** **HIGH** (likely deteriorating)

**Care Plan:**
- **IMMEDIATE OUTREACH** - wellness call within 24 hours
- Home visit if no response
- Check for: hospitalization, depression, family crisis, medication issues
- Reassess clinical risk after contact

---

#### Example 3: Success Story
**Patient:** Ruth Martinez, 81 years old

| Metric | Score | Interpretation |
|--------|-------|----------------|
| Clinical Risk | 6.5/10 - **HIGH** | CHF, COPD, recent hospitalization |
| Engagement Score | 88/100 - **HIGH** | Daily check-ins, asks questions, shares progress |
| FHIR Metrics | No readmissions, stable weights, good medication adherence | Excellent self-management |

**Assessment:**
- **Medical Risk:** HIGH (complexity)
- **Behavioral Risk:** LOW (engaged, compliant)
- **Outcome Risk:** LOW (high engagement mitigating medical risk)

**Care Plan:**
- Current strategy is working - don't change it!
- Continue weekly nursing calls
- Use as case study for other patients
- Maintain positive reinforcement

---

## Self-Reports Integration

### Current Status
Self-reports are tracked in the `self_report_submissions` table and **ARE INCLUDED** in the Patient Engagement Score:
- **3 points per submission**
- Expected weekly (12-15 points/month potential)

### Self-Report Data Collected
From `self_report_submissions.report_data` (JSONB):

```json
{
  "mood": "good",
  "pain_level": 3,
  "appetite": "normal",
  "sleep_quality": 7,
  "medication_taken_today": true,
  "concerns": "slight dizziness in mornings",
  "vitals": {
    "blood_pressure": "138/82",
    "heart_rate": 72,
    "weight": 165,
    "glucose": 124
  }
}
```

### Enhancement Opportunity
**Connect Self-Report Data to Clinical Risk Assessment:**

Currently:
- Self-reports → Engagement score only
- Clinical risk → Manual assessment only

**Proposed:**
- Parse self-report data for risk indicators:
  - High pain levels → Increase mobility risk score
  - Poor sleep quality → Flag for cognitive/depression screening
  - Missed medications → Increase medical risk score
  - Concerning vitals → Alert provider
  - Patient-reported concerns → Auto-create care team question

---

## SDOH (Social Determinants of Health) Integration

### Current SDOH Data
Captured in `sdoh_assessments` table:
- Food insecurity
- Housing instability
- Transportation barriers
- Financial stress
- Social isolation
- Utility access
- Safety concerns

### SDOH Risk Weighting
SDOH factors **AMPLIFY** clinical risk:

| SDOH Issues | Risk Multiplier | Rationale |
|-------------|-----------------|-----------|
| 0-1 | 1.0x | Minimal social barriers |
| 2-3 | 1.25x | Moderate barriers affecting care |
| 4+ | 1.5x | Severe barriers, high intervention need |

**Example:**
- Base clinical risk: 6/10 (HIGH)
- SDOH issues: 5 (food insecurity, housing, transportation, financial, isolation)
- **Adjusted risk: 6 × 1.5 = 9/10 (CRITICAL)**
- **Why:** Clinical complexity + social barriers = much higher risk of adverse outcomes

---

## Recommended Unified Scoring Framework

### Composite Risk Score (CRS)
**Formula:**
```
CRS = (Clinical_Risk × SDOH_Multiplier × 0.5) +
      ((100 - Engagement_Score) / 10 × 0.3) +
      (FHIR_Risk_Indicators × 0.2)

Where:
- Clinical_Risk: 0-10 scale
- SDOH_Multiplier: 1.0, 1.25, or 1.5
- Engagement_Score: 0-100 (inverted - low engagement = high risk)
- FHIR_Risk_Indicators: 0-10 scale (care gaps, readmissions, ED visits)
```

### Unified Risk Tiers

| CRS Score | Overall Risk | Action Protocol |
|-----------|--------------|-----------------|
| 8.0-10.0 | **CRITICAL** 🔴 | Daily contact, care coordinator assigned, escalation to provider |
| 6.0-7.9 | **HIGH** 🟠 | Twice weekly contact, active care plan, frequent monitoring |
| 4.0-5.9 | **MODERATE** 🟡 | Weekly contact, standard care plan, regular check-ins |
| 2.0-3.9 | **LOW-MODERATE** 🟢 | Bi-weekly contact, preventive focus |
| 0-1.9 | **LOW** 🟢 | Monthly contact, maintenance care |

---

## Dashboard Comparison & Recommendations

### Current State

| Dashboard | Primary Focus | Data Source | Users | Overlap? |
|-----------|---------------|-------------|-------|----------|
| **FHIR AI Dashboard** | Clinical quality, population health | FHIR resources, EHR data | Clinicians, QI teams | YES - risk assessment |
| **Reports & Analytics** | Engagement stats, exports | Check-ins, app usage | Admins, reporting | YES - engagement metrics |
| **Patient Engagement & Risk** | Behavioral tracking, activity levels | App interactions | Care coordinators, nurses | YES - engagement + risk |

### Recommendation: **MERGE with Clear Sections**

Create **ONE Unified Patient Intelligence Dashboard** with tabs:

#### Tab 1: Patient Engagement (Behavioral)
- Current `PatientEngagementDashboard`
- Activity tracking, engagement scores
- Real-time risk alerts for disengagement

#### Tab 2: Clinical Risk Assessment (Medical)
- Current `RiskAssessmentForm` + `RiskAssessmentManager`
- Medical risk scoring
- Care plan generation

#### Tab 3: Population Health (FHIR)
- Current `FhirAiDashboard`
- Quality metrics, care gaps
- Population-level analytics

#### Tab 4: Comprehensive Reports
- Current `ReportsSection`
- Excel exports, printable reports
- Combines all three metric types

### Benefits of Merging
1. **One Source of Truth:** Admins see all patient data in one place
2. **Context Switching Eliminated:** No more clicking between dashboards
3. **Holistic View:** See behavioral + clinical + outcomes together
4. **Easier Onboarding:** One dashboard to learn, not three
5. **Consistent UX:** One design language, one navigation pattern

---

## Implementation Priorities

### Phase 1: Immediate (This Week)
1. ✅ Fix `patient_engagement_scores` view permissions
2. ✅ Add CRITICAL risk level to engagement dashboard
3. ✅ Document current metric system (this file)
4. Deploy permissions fix

### Phase 2: Short-Term (Next Sprint)
1. Create unified dashboard with tabs
2. Connect self-report vitals to clinical risk auto-scoring
3. Implement SDOH risk multiplier in calculations
4. Add composite risk score (CRS) calculation

### Phase 3: Medium-Term (Next Month)
1. Machine learning risk prediction model
2. Automated care plan generation
3. Predictive analytics for engagement drops
4. Integration with billing/CCM time tracking

---

## Metric System Rules & Weights

### Engagement Score Calculation (Current)
```sql
engagement_score = LEAST(100, (
  (check_ins_30d * 2) +           -- 2 pts each
  (trivia_games_30d * 5) +        -- 5 pts each
  (word_games_30d * 5) +          -- 5 pts each
  (self_reports_30d * 3) +        -- 3 pts each
  (questions_asked_30d * 2) +     -- 2 pts each
  (meal_interactions_30d * 2) +   -- 2 pts each
  (meal_photos_30d * 3) +         -- 3 pts bonus
  (community_photos_30d * 3)      -- 3 pts each
))
```

### Clinical Risk Score Calculation (Current)
```javascript
overall_score = (
  medical_risk_score +      // 0-10
  mobility_risk_score +     // 0-10
  cognitive_risk_score +    // 0-10
  social_risk_score         // 0-10
) / 4                       // Average to 0-10 scale
```

### Proposed Enhanced Scoring
```javascript
// Add self-report vitals auto-scoring
vitals_risk_score = calculateVitalsRisk(self_report_data);
symptom_risk_score = calculateSymptomRisk(self_report_data);

enhanced_clinical_risk = (
  medical_risk_score +
  mobility_risk_score +
  cognitive_risk_score +
  social_risk_score +
  vitals_risk_score +       // NEW
  symptom_risk_score        // NEW
) / 6;

// Apply SDOH multiplier
sdoh_count = count_sdoh_issues(sdoh_assessment);
sdoh_multiplier = sdoh_count >= 4 ? 1.5 :
                  sdoh_count >= 2 ? 1.25 : 1.0;

adjusted_clinical_risk = enhanced_clinical_risk * sdoh_multiplier;

// Calculate composite
composite_risk_score = (
  (adjusted_clinical_risk * 0.5) +                    // 50% weight
  ((100 - engagement_score) / 10 * 0.3) +             // 30% weight
  (fhir_risk_indicators * 0.2)                        // 20% weight
);
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     SENIOR INTERACTIONS                      │
│  Games | Check-ins | Meals | Photos | Questions | Reports   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │ ENGAGEMENT TRACKING  │
            │  (Automatic Scoring) │
            └──────────┬───────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌───────────┐  ┌───────────┐  ┌──────────────┐
│ CLINICAL  │  │   FHIR    │  │    SDOH      │
│   RISK    │  │  METRICS  │  │  ASSESSMENT  │
│ ASSESSMENT│  │           │  │              │
└─────┬─────┘  └─────┬─────┘  └──────┬───────┘
      │              │                │
      └──────────────┼────────────────┘
                     ▼
         ┌───────────────────────┐
         │  COMPOSITE RISK SCORE │
         │   (Unified Picture)   │
         └───────────┬───────────┘
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
    ┌─────────┐ ┌────────┐ ┌─────────┐
    │CRITICAL │ │  HIGH  │ │MODERATE │
    │  ALERT  │ │ ALERT  │ │ MONITOR │
    └─────────┘ └────────┘ └─────────┘
         │          │           │
         └──────────┴───────────┘
                    │
                    ▼
          ┌──────────────────┐
          │   CARE ACTIONS   │
          │ • Outreach       │
          │ • Interventions  │
          │ • Care Plans     │
          └──────────────────┘
```

---

## Key Takeaways

1. **Three Complementary Systems, Not Competing**
   - Clinical Risk = Medical complexity
   - Engagement = Behavioral health proxy
   - FHIR = Clinical outcomes

2. **Critical Risk Level IS Included**
   - Risk scores 8-10/10 = CRITICAL
   - Requires urgent intervention
   - Never altered - verified in codebase

3. **Self-Reports ARE Scored**
   - 3 points per submission in engagement
   - Opportunity: Also feed clinical risk scoring

4. **SDOH Multiplies Risk**
   - Social barriers amplify medical risk
   - 4+ issues = 1.5x risk multiplier

5. **Merge Recommended**
   - One unified dashboard with tabs
   - Eliminate redundancy
   - Comprehensive patient view

---

## Next Steps

1. Deploy permissions fix migration
2. Verify CRITICAL risk level displaying in admin panel
3. Review this document with clinical team
4. Plan dashboard merge architecture
5. Implement self-report → clinical risk auto-scoring

**Questions? Contact:** System Administrator or Clinical Operations Lead

---

*Generated with Claude Code for WellFit Community Healthcare Platform*
