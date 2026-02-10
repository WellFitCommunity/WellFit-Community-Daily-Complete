# FDA Clinical Decision Support (CDS) Classification

**Envision Virtual Edge Group LLC**
**Classification Date:** February 10, 2026
**Regulatory Framework:** 21st Century Cures Act Section 3060(a), 21 CFR Part 820
**FDA Guidance:** Clinical Decision Support Software (Sept 2022)
**Assessor:** Engineering Team with clinical review

---

## 1. Classification Framework

### 1.1 Cures Act CDS Exemption Criteria

Under Section 3060(a) of the 21st Century Cures Act, CDS software is **exempt from FDA device regulation** if it meets ALL FOUR criteria:

| # | Criterion | Description |
|---|----------|-------------|
| 1 | **Not intended to acquire, process, or analyze** a medical image or signal | Does not directly interface with imaging/monitoring devices |
| 2 | **Intended for the purpose of displaying, analyzing, or printing** medical information about a patient | Provides information to clinical users |
| 3 | **Intended for the purpose of supporting or providing recommendations** to a healthcare professional | Recommendations, not autonomous decisions |
| 4 | **Intended for the purpose of enabling** such healthcare professional to **independently review** the basis for such recommendations | Clinician can see the reasoning and override |

### 1.2 Classification Categories

| Category | Definition | Regulatory Requirement |
|----------|-----------|----------------------|
| `non_device` | General wellness, administrative, or non-clinical | No FDA oversight |
| `exempt_cds` | Meets all 4 Cures Act criteria (clinician decides) | No FDA premarket review |
| `class_ii_device` | Autonomous clinical decisions without clinician review | FDA 510(k) required |

---

## 2. AI Skill Classification

### 2.1 Community AI Skills (6 skills)

| # | Skill Key | Description | Classification | Rationale |
|---|-----------|-------------|:--------------:|-----------|
| 1 | `ai-check-in-questions` | Personalized check-in questions | `non_device` | General wellness; no clinical decisions |
| 2 | `ai-missed-checkin-escalation` | Risk scoring from missed check-ins | `non_device` | Engagement tracking; flags for human review |
| 3 | `smart-mood-suggestions` | Wellness suggestions based on mood | `non_device` | General wellness per FDA guidance |
| 4 | `ai-patient-qa-bot` | Patient question answering | `non_device` | Health information, not clinical decisions |
| 5 | `claude-personalization` | Content personalization engine | `non_device` | UX optimization, no clinical decisions |
| 6 | `get-personalized-greeting` | AI greeting based on history | `non_device` | Engagement feature, not clinical |

### 2.2 Clinical AI Skills (16 skills)

| # | Skill Key | Description | Classification | Cures Act Analysis |
|---|-----------|-------------|:--------------:|-------------------|
| 7 | `ai-readmission-predictor` | 30-day readmission risk prediction | `exempt_cds` | Criterion 1: No imaging. Criterion 2: Displays risk factors. Criterion 3: Recommends interventions. Criterion 4: Clinician reviews risk factors, sees model inputs, decides on care plan. |
| 8 | `ai-fall-risk-predictor` | Fall risk assessment | `exempt_cds` | Criterion 1: No imaging. Criterion 2: Displays fall risk factors. Criterion 3: Recommends precautions. Criterion 4: Nurse reviews assessment, decides on interventions. |
| 9 | `ai-infection-risk-predictor` | Infection risk scoring | `exempt_cds` | Criterion 1: No imaging. Criterion 2: Displays infection markers. Criterion 3: Suggests isolation protocols. Criterion 4: Physician reviews data, orders cultures. |
| 10 | `ai-soap-note-generator` | SOAP note from encounter data | `exempt_cds` | Criterion 1: No imaging. Criterion 2: Displays drafted note. Criterion 3: Suggests documentation. Criterion 4: Physician reviews, edits, and signs note. |
| 11 | `ai-progress-note-synthesizer` | Progress note compilation | `exempt_cds` | Criterion 1: No imaging. Criterion 2: Displays synthesized notes. Criterion 3: Suggests summary. Criterion 4: Clinician reviews and approves/edits. |
| 12 | `ai-care-plan-generator` | Care plan recommendations | `exempt_cds` | Criterion 1: No imaging. Criterion 2: Displays care plan draft. Criterion 3: Recommends goals/interventions. Criterion 4: Care team reviews, modifies, approves. |
| 13 | `ai-discharge-summary` | Discharge summary generation | `exempt_cds` | Criterion 1: No imaging. Criterion 2: Displays summary draft. Criterion 3: Suggests follow-up items. Criterion 4: Physician reviews and signs. |
| 14 | `ai-treatment-pathway` | Treatment pathway suggestions | `exempt_cds` | Criterion 1: No imaging. Criterion 2: Displays pathway options. Criterion 3: Recommends based on diagnosis. Criterion 4: Physician selects pathway, can override. |
| 15 | `ai-clinical-guideline-matcher` | Match patient to clinical guidelines | `exempt_cds` | Criterion 1: No imaging. Criterion 2: Displays matching guidelines. Criterion 3: Suggests applicable protocols. Criterion 4: Clinician reviews guideline applicability. |
| 16 | `ai-contraindication-detector` | Drug-condition contraindication alerts | `exempt_cds` | Criterion 1: No imaging. Criterion 2: Displays contraindication data. Criterion 3: Alerts to potential issues. Criterion 4: Prescriber reviews and decides. |
| 17 | `ai-medication-reconciliation` | Medication list reconciliation | `exempt_cds` | Criterion 1: No imaging. Criterion 2: Displays discrepancies. Criterion 3: Suggests reconciliation. Criterion 4: Pharmacist/physician reviews and approves. |
| 18 | `ai-medication-instructions` | Patient medication instructions | `exempt_cds` | Criterion 1: No imaging. Criterion 2: Displays instructions. Criterion 3: Suggests patient-friendly language. Criterion 4: Clinician reviews before delivery. |
| 19 | `ai-referral-letter` | Specialist referral letter generation | `exempt_cds` | Criterion 1: No imaging. Criterion 2: Displays letter draft. Criterion 3: Suggests clinical context. Criterion 4: Referring physician reviews and signs. |
| 20 | `ai-medication-adherence-predictor` | Adherence risk scoring | `exempt_cds` | Criterion 1: No imaging. Criterion 2: Displays risk factors. Criterion 3: Suggests intervention strategies. Criterion 4: Care team reviews, decides on outreach. |
| 21 | `ai-appointment-prep-instructions` | Pre-appointment preparation | `exempt_cds` | Criterion 1: No imaging. Criterion 2: Displays prep instructions. Criterion 3: Suggests based on appointment type. Criterion 4: Staff reviews before sending. |
| 22 | `ai-patient-education` | Patient education content | `exempt_cds` | Criterion 1: No imaging. Criterion 2: Displays educational content. Criterion 3: Recommends materials. Criterion 4: Clinician reviews before delivery. |

### 2.3 Shared AI Skills (6 skills)

| # | Skill Key | Description | Classification | Rationale |
|---|-----------|-------------|:--------------:|-----------|
| 23 | `ai-care-escalation-scorer` | Care escalation risk scoring | `exempt_cds` | All 4 criteria met: clinician reviews score, sees inputs, decides on escalation |
| 24 | `ai-caregiver-briefing` | Caregiver status briefing | `non_device` | Informational summary for family, no clinical decisions |
| 25 | `ai-avatar-entity-extractor` | Patient avatar data extraction | `non_device` | Data processing utility, no clinical decisions |
| 26 | `ai-billing-suggester` | Billing code suggestions | `non_device` | Administrative/financial, not clinical |
| 27 | `ai-fhir-semantic-mapper` | FHIR data mapping | `non_device` | Data transformation utility |
| 28 | `ai-schedule-optimizer` | Appointment scheduling optimization | `non_device` | Administrative scheduling, not clinical |

---

## 3. Classification Summary

| Classification | Count | Percentage | Skills |
|---------------|:-----:|:----------:|--------|
| `non_device` | 11 | 39% | General wellness, admin, utilities |
| `exempt_cds` | 17 | 61% | Clinical recommendations with clinician review |
| `class_ii_device` | 0 | 0% | None — no autonomous clinical decisions |

**Key Finding:** No AI skills in the system make autonomous clinical decisions. All clinical AI provides recommendations that a healthcare professional independently reviews before action.

---

## 4. Design Safeguards

### 4.1 Transparency Requirements (All Exempt CDS)

Every exempt CDS skill in the system includes:

| Safeguard | Implementation |
|-----------|---------------|
| **Clinician review gate** | All AI outputs require human approval before clinical action |
| **Reasoning display** | AI confidence scores and input factors shown to clinician |
| **Override capability** | Clinician can modify or reject any AI recommendation |
| **Audit trail** | All AI decisions logged to `ai_transparency_log` with inputs, outputs, confidence |
| **Model documentation** | AI model cards in `ai_model_cards` table |

### 4.2 Monitoring

| Metric | Source | Review Frequency |
|--------|--------|-----------------|
| AI accuracy rates | `ai_accuracy_metrics` | Monthly |
| Confidence score distribution | `ai_confidence_scores` | Monthly |
| Clinician override rates | `ai_transparency_log` | Quarterly |
| Patient outcomes vs. predictions | Clinical review | Quarterly |

---

## 5. FDA General Wellness Determination

### 5.1 Applicable FDA Guidance

**"General Wellness: Policy for Low Risk Devices"** (FDA, 2019) states that products intended for general wellness purposes (e.g., weight management, physical fitness, relaxation, stress management, self-esteem, sleep management, mental acuity) are **not considered medical devices** when they:

1. Make only general wellness claims, AND
2. Present low risk to user safety

### 5.2 General Wellness Features in WellFit

| Feature | Wellness Claim | Low Risk? | Classification |
|---------|---------------|:---------:|:--------------:|
| Daily check-in (mood, activities) | Tracks wellness habits | Yes | General wellness |
| Mood tracking and suggestions | Stress management, self-esteem | Yes | General wellness |
| Trivia and word games | Mental acuity, cognitive engagement | Yes | General wellness |
| Community moments (photo sharing) | Social engagement, self-esteem | Yes | General wellness |
| Gamification and engagement scores | Motivation for healthy habits | Yes | General wellness |
| Affirmations | Self-esteem, stress management | Yes | General wellness |
| Personalized greetings | Social engagement | Yes | General wellness |

**Determination:** All WellFit community features qualify as general wellness products and are not subject to FDA device regulation.

### 5.3 Features NOT Classified as General Wellness

Any feature that captures vital signs (BP, HR, SpO2, glucose) or makes clinical assessments is classified under the CDS framework above, not general wellness. The vital signs captured in check-ins are stored as clinical data accessible to healthcare providers.

---

## 6. Annual Review

This classification will be reviewed:
- **Annually** (next: February 2027)
- **When new AI skills are added** — classify before deployment
- **When FDA guidance changes** — reassess all classifications
- **When AI capabilities change** — reclassify if autonomy increases

---

## Signatures

| Role | Name | Date |
|------|------|------|
| Compliance Officer (CCO) | Akima — MDiv, BSN, RN, CCM | ________ |
| AI System Director | Maria | ________ |

---

*Document Owner: Envision Virtual Edge Group LLC*
*Contact: maria@wellfitcommunity.com*
