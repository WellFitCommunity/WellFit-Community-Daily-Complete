# Dental Health Module: Evaluation & Impact Measurement Plan

## Executive Summary

This evaluation plan outlines the methodology for assessing the **WellFit Dental Health Module's** impact on clinical outcomes, health equity, patient engagement, and financial sustainability. The plan follows **RE-AIM framework** (Reach, Effectiveness, Adoption, Implementation, Maintenance) and aligns with funder requirements for evidence-based program evaluation.

---

## Table of Contents

1. [Evaluation Framework](#evaluation-framework)
2. [Key Evaluation Questions](#key-evaluation-questions)
3. [Logic Model](#logic-model)
4. [Data Collection Methods](#data-collection-methods)
5. [Outcome Measures](#outcome-measures)
6. [Timeline & Milestones](#timeline--milestones)
7. [Analysis Plan](#analysis-plan)
8. [Reporting & Dissemination](#reporting--dissemination)

---

## 1. Evaluation Framework

### RE-AIM Framework

| Dimension | Focus | WellFit Application |
|-----------|-------|-------------------|
| **Reach** | Who is reached? | % of eligible patients enrolled in dental module |
| **Effectiveness** | What are the outcomes? | Clinical improvements (HbA1c, gum health), ED visit reduction |
| **Adoption** | Who adopts the program? | # of providers using module, # of community sites |
| **Implementation** | How consistently is it delivered? | Fidelity to protocols, patient engagement rates |
| **Maintenance** | Is it sustained over time? | 12-month retention, revenue sustainability |

---

## 2. Key Evaluation Questions

### Clinical Impact
1. **Does dental integration improve chronic disease outcomes?**
   - Sub-questions:
     - Does HbA1c improve in diabetic patients receiving gum disease treatment?
     - Do cardiovascular event rates decrease with improved periodontal health?
     - Does nutritional status improve after dental restoration?

2. **Does the module reduce preventable hospitalizations?**
   - Sub-questions:
     - Are dental-related ED visits reduced?
     - Are exacerbations of chronic conditions (e.g., diabetic crises) prevented?

### Health Equity
3. **Does the module reduce oral health disparities?**
   - Sub-questions:
     - Do underserved populations (racial/ethnic minorities, low-income) show improved access?
     - Are disparities in untreated tooth decay narrowed?

### Patient Engagement
4. **Do patients engage with self-tracking and preventive care?**
   - Sub-questions:
     - What % of patients complete daily dental health tracking?
     - Do patients attend recommended preventive visits (2x/year)?

### Financial Sustainability
5. **Is the module financially sustainable?**
   - Sub-questions:
     - What revenue is generated from reimbursement pathways?
     - What is the cost per patient served?
     - What is the ROI?

---

## 3. Logic Model

### Inputs
- **Staff**: Dental hygienist (0.5 FTE), dentist (consultant), CHWs (dental training)
- **Technology**: Dental module software, FHIR integration, patient dashboard
- **Funding**: Grant funding ($150K Year 1), reimbursement revenue
- **Infrastructure**: Supabase database, RLS security, CDT code library

### Activities
- **Clinical Services**:
  - Dental assessments and cleanings
  - Periodontal disease treatment
  - Fluoride varnish application
  - Dental referrals to specialists
- **Patient Self-Management**:
  - Daily symptom tracking
  - Oral hygiene education
  - Nutritional counseling
- **Care Coordination**:
  - CHW home visits with oral health screening
  - Specialist referral coordination
  - Integration with primary care providers

### Outputs (Year 1 Targets)
- **1,000 patients** enrolled in dental module
- **600 dental assessments** completed
- **400 preventive cleanings** performed
- **150 patients** referred to specialists
- **300 patients** using daily self-tracking
- **500 educational modules** completed

### Outcomes

**Short-Term (3-6 months)**:
- 40% of patients complete at least one self-tracking entry
- 65% of diabetic patients receive dental assessment
- 50% reduction in patients with untreated gum disease (from 58% to 29%)

**Medium-Term (6-12 months)**:
- HbA1c improvement of 0.4% in diabetics with treated gum disease
- 30% increase in fruit/vegetable consumption in patients receiving dental restoration
- 50% reduction in dental-related ED visits (from 18 to 9 per 1,000 patients)

**Long-Term (12-24 months)**:
- 15% reduction in diabetic complications (fewer hospitalizations)
- 10% reduction in cardiovascular events in high-risk patients
- 20% improvement in quality of life scores
- Financial sustainability achieved (revenue exceeds costs)

### Impact
- **Population Health**: Improved oral health across community
- **Health Equity**: Reduced disparities in underserved populations
- **System Integration**: Model for medical-dental integration scaled to other health systems
- **Economic Impact**: $1M+ in healthcare cost savings from prevented complications

---

## 4. Data Collection Methods

### Primary Data Sources

#### 1. Electronic Health Records (EHR) / Database
**Data Elements**:
- Clinical data from `dental_assessments` table:
  - Periodontal status
  - Plaque/bleeding indices
  - Pain scores
  - Treatment recommendations
- Procedure data from `dental_procedures` table:
  - CDT codes
  - Dates of service
  - Costs
- Patient self-tracking from `patient_dental_health_tracking` table:
  - Symptom reports
  - Hygiene habits
  - Nutrition impact

**Collection Frequency**: Real-time (automated)

**Responsible Party**: WellFit IT team

#### 2. Patient Surveys
**Instruments**:
- **Baseline Survey** (at enrollment):
  - Demographics
  - Oral health history
  - Chronic conditions
  - Social determinants (income, insurance, transportation)

- **Follow-Up Surveys** (3, 6, 12 months):
  - Oral Health Impact Profile (OHIP-14) - standardized QoL measure
  - Patient satisfaction (5-point Likert scale)
  - Self-reported oral health status
  - Dietary quality (fruit/vegetable consumption)

- **Provider Satisfaction Survey** (annual):
  - Ease of use of dental module
  - Integration with workflow
  - Clinical utility

**Collection Method**: Digital survey via patient portal (Spanish + English)

**Response Rate Target**: 70%

#### 3. Claims Data
**Data Elements**:
- ED visits (ICD-10 codes for dental conditions: K02-K08)
- Hospitalizations (diabetes complications, cardiovascular events)
- Chronic disease management visits (CPT 99490, 99457)

**Source**: Insurance claims database

**Collection Frequency**: Quarterly

#### 4. Financial Data
**Data Elements**:
- Revenue by source (Medicare Advantage, Medicaid, CCM/RPM, grants)
- Costs (personnel, supplies, technology)
- ROI calculation

**Source**: Finance department

**Collection Frequency**: Monthly

#### 5. Qualitative Data
**Methods**:
- **Focus Groups** (2 groups of 8-10 patients, Year 1):
  - Barriers to dental care
  - Experience with self-tracking dashboard
  - Educational content effectiveness

- **Key Informant Interviews** (10 providers, Year 1):
  - Integration challenges
  - Workflow impact
  - Clinical value

**Collection Timing**: 6 months and 12 months

**Analysis**: Thematic coding using NVivo or Atlas.ti

---

## 5. Outcome Measures

### Primary Outcomes

| Outcome | Measure | Data Source | Target | Timeframe |
|---------|---------|-------------|--------|-----------|
| **Chronic Disease Control** | HbA1c change in diabetic patients with periodontal disease | Lab results in EHR | -0.4% reduction | 6 months |
| **ED Visit Reduction** | # of dental-related ED visits per 1,000 patients | Claims data | <8 visits (from 18) | 12 months |
| **Oral Health Status** | % with untreated gum disease | Clinical assessments | <30% (from 58%) | 6 months |

### Secondary Outcomes

| Outcome | Measure | Data Source | Target | Timeframe |
|---------|---------|-------------|--------|-----------|
| **Patient Engagement** | % completing daily tracking | Database logs | 40% | 3 months |
| **Preventive Care Adherence** | % with 2+ dental visits/year | Procedure records | 60% | 12 months |
| **Quality of Life** | OHIP-14 score improvement | Patient surveys | 20% improvement | 12 months |
| **Nutrition Impact** | Self-reported difficulty chewing | Patient surveys | 50% reduction | 6 months |
| **Health Equity** | Gap in gum disease prevalence between low/high-income patients | Clinical data + demographics | 50% reduction in gap | 12 months |

### Process Measures

| Measure | Data Source | Target |
|---------|-------------|--------|
| % of eligible diabetic patients assessed | Database query | 65% |
| % of high-risk patients referred to specialists | Referral records | 80% |
| % of referrals completed | Follow-up data | 70% |
| Provider satisfaction score | Survey | ≥4.0/5.0 |
| Patient satisfaction score | Survey | ≥4.2/5.0 |

### Financial Measures

| Measure | Data Source | Target (Year 1) |
|---------|-------------|-----------------|
| Revenue per patient | Finance reports | $1,250 |
| Cost per patient | Finance reports | $265 |
| Net revenue | Finance reports | $985K (1,000 patients) |
| ROI | Finance calculations | 480% |

---

## 6. Timeline & Milestones

### Year 1 Evaluation Timeline

| Quarter | Activities | Data Collection | Reporting |
|---------|-----------|----------------|-----------|
| **Q1** (Months 1-3) | - Module launch<br>- Staff training<br>- Patient enrollment | - Baseline surveys<br>- System usage logs | - Q1 progress report to funders |
| **Q2** (Months 4-6) | - Scale enrollment to 500 patients<br>- First focus groups | - 3-month follow-up surveys<br>- Clinical data extraction<br>- Claims data pull | - Mid-year report<br>- Preliminary outcomes analysis |
| **Q3** (Months 7-9) | - Reach 750 patients<br>- Provider training refresh | - 6-month follow-up surveys<br>- ED visit analysis | - Q3 progress report<br>- Adjustments based on findings |
| **Q4** (Months 10-12) | - Reach 1,000 patients<br>- Key informant interviews<br>- Second focus groups | - 12-month follow-up surveys<br>- Full year claims data<br>- Financial analysis | - **Year 1 Comprehensive Report**<br>- Dissemination of findings |

### Milestones

**Month 3**:
- ✓ 250 patients enrolled
- ✓ 100 dental assessments completed
- ✓ 40% daily tracking completion rate

**Month 6**:
- ✓ 500 patients enrolled
- ✓ 300 dental assessments completed
- ✓ HbA1c data for first cohort of diabetic patients
- ✓ First claims data analysis (ED visits)

**Month 9**:
- ✓ 750 patients enrolled
- ✓ 450 dental assessments completed
- ✓ Mid-year adjustments implemented

**Month 12**:
- ✓ 1,000 patients enrolled
- ✓ 600 dental assessments completed
- ✓ Comprehensive evaluation report completed
- ✓ Grant renewal application submitted (if applicable)

---

## 7. Analysis Plan

### Quantitative Analysis

#### Descriptive Statistics
- **Demographics**: Age, gender, race/ethnicity, income, insurance status
- **Clinical Characteristics**: Chronic conditions, baseline oral health status
- **Utilization**: # of assessments, cleanings, procedures per patient

#### Bivariate Analysis
- **T-tests**: Compare pre-post HbA1c, plaque index, bleeding index
- **Chi-square tests**: Compare categorical outcomes (e.g., % with untreated gum disease)
- **Mann-Whitney U**: Compare non-parametric data (e.g., pain scores)

#### Multivariate Analysis
- **Regression Models**:
  - **Linear regression**: Predict HbA1c change based on periodontal treatment, controlling for age, baseline HbA1c, treatment adherence
  - **Logistic regression**: Predict ED visit probability based on dental module participation, controlling for comorbidities, SDOH
  - **Cox proportional hazards**: Predict time to cardiovascular event based on periodontal status

#### Subgroup Analysis
- **Stratify by**:
  - Race/ethnicity (to assess health equity impact)
  - Income level (<200% FPL vs. ≥200% FPL)
  - Chronic condition type (diabetes vs. heart disease)

#### Cost-Effectiveness Analysis
- **Cost per ED visit averted**: Total program cost / # of ED visits prevented
- **Cost per HbA1c % point reduction**: Total program cost / Total HbA1c reduction across cohort
- **QALY (Quality-Adjusted Life Year) analysis**: Cost per QALY gained (if resources allow for formal CEA)

### Qualitative Analysis

**Thematic Coding**:
1. **Open Coding**: Identify initial themes from focus group transcripts
2. **Axial Coding**: Group codes into categories
3. **Selective Coding**: Develop core themes

**Key Themes to Explore**:
- Barriers to dental care access (cost, transportation, fear)
- Facilitators of engagement (ease of use, CHW support, educational value)
- Integration challenges (workflow, documentation burden)
- Unanticipated outcomes (positive or negative)

**Inter-Rater Reliability**: 2 coders independently code 20% of transcripts; Cohen's kappa ≥0.80

---

## 8. Reporting & Dissemination

### Internal Reporting

**Monthly Dashboards** (for WellFit leadership):
- Enrollment progress
- Key metrics (ED visits, patient engagement)
- Financial performance

**Quarterly Reports** (for funders):
- Progress toward milestones
- Early outcomes
- Challenges and mitigation strategies

**Annual Comprehensive Report**:
- Executive summary
- Full evaluation findings
- Recommendations for Year 2

### External Dissemination

**Peer-Reviewed Publications** (target journals):
- *American Journal of Public Health* - Health equity findings
- *Journal of Dental Research* - Oral-systemic health outcomes
- *Diabetes Care* - HbA1c improvement results
- *Health Affairs* - Cost-effectiveness analysis

**Conference Presentations**:
- American Public Health Association (APHA) Annual Meeting
- AcademyHealth Annual Research Meeting
- American Dental Association (ADA) Annual Session
- National Association of Community Health Centers (NACHC) Conference

**Policy Briefs**:
- For state Medicaid agencies (to advocate for dental coverage expansion)
- For CMS (to support medical-dental integration in value-based care models)
- For local health departments (to promote community-based oral health)

**Webinars & Workshops**:
- Host 2 webinars/year for other health centers interested in replication
- Develop implementation toolkit for dissemination

### Community Reporting

**Patient-Friendly Summary**:
- Infographic highlighting key findings
- Posted on WellFit website and patient portal
- Shared at community advisory board meetings

**Media Outreach**:
- Press release on major findings
- Local news interviews
- Social media campaign (#SmileHealthMatters)

---

## Data Management & Quality Assurance

### Data Security
- HIPAA-compliant data storage (Supabase encryption)
- De-identified datasets for analysis
- IRB approval obtained (if research publication planned)

### Data Quality Checks
- **Completeness**: Monthly audit of missing data fields
- **Accuracy**: Random sample validation (10% of records quarterly)
- **Consistency**: Automated data validation rules in database

### Data Governance
- **Data Steward**: WellFit Data Analyst
- **Access Control**: Role-based permissions (RLS policies)
- **Audit Trail**: All data access logged

---

## Budget for Evaluation (Included in Grant Request)

| Item | Cost (Year 1) | Justification |
|------|--------------|---------------|
| **Data Analyst (0.3 FTE)** | $25,000 | Data extraction, cleaning, analysis |
| **Evaluation Consultant** | $15,000 | Advanced statistical analysis, publication support |
| **Survey Software (Qualtrics)** | $2,000 | Patient and provider surveys |
| **Focus Group Incentives** | $800 | $50 gift card × 16 participants |
| **Transcription Services** | $1,200 | Focus groups and interviews |
| **IRB Application Fee** | $500 | If seeking research publication |
| **Dissemination** | $5,500 | Conference travel, publication fees |
| **TOTAL** | **$50,000** | ~25% of Year 1 grant request |

---

## Continuous Quality Improvement (CQI)

### CQI Cycle

**Plan**: Review monthly metrics → Identify areas below target
**Do**: Implement targeted interventions (e.g., patient outreach campaign)
**Study**: Assess impact of intervention (2-month monitoring)
**Act**: Scale successful interventions, discontinue ineffective ones

**Example CQI Project** (Month 4):
- **Problem**: Daily tracking completion rate only 25% (target: 40%)
- **Intervention**: SMS reminders + gamification (streak badges)
- **Study**: Track completion rate over 8 weeks
- **Result**: Completion rate increased to 42%
- **Action**: Make SMS reminders standard protocol

---

## Ethical Considerations

### Informed Consent
- All patients provide opt-in consent for data use in evaluation
- De-identification for published research

### Health Equity Lens
- Ensure evaluation captures experiences of marginalized populations
- Oversample underrepresented groups in focus groups

### Community Engagement
- Community advisory board reviews evaluation findings
- Patients co-author patient-friendly summary

---

## Conclusion

This comprehensive evaluation plan ensures **rigorous, transparent, and actionable assessment** of the WellFit Dental Health Module. By combining quantitative outcome measures, qualitative insights, and cost-effectiveness analysis, we will generate **strong evidence** for:
- Clinical impact on chronic disease management
- Health equity advancement
- Financial sustainability
- Scalability to other health systems

**Our commitment**: Data-driven continuous improvement and transparent reporting to funders, community, and the field.

---

*Document Version: 1.0*
*Last Updated: November 9, 2025*
*Maintained by: WellFit Evaluation Team*
