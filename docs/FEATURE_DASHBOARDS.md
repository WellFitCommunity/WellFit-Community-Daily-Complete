# Feature Dashboards Reference

Dashboards wired up to connect backend infrastructure to UI (as of 2025-12-02).

## Physical Therapy Dashboard

| Aspect | Details |
|--------|---------|
| **Route** | `/physical-therapy` |
| **Component** | `src/components/physicalTherapy/PhysicalTherapyDashboard.tsx` |
| **Service** | `src/services/physicalTherapyService.ts` |
| **Types** | `src/types/physicalTherapy.ts` (1,023 lines - comprehensive) |
| **Feature Flag** | `REACT_APP_FEATURE_PHYSICAL_THERAPY=true` |
| **Allowed Roles** | admin, super_admin, physical_therapist, pt, physician, nurse |
| **Features** | ICF-based assessments, treatment plans, SMART goals, HEP management, outcome measures (LEFS, ODI, etc.) |

## Care Coordination Dashboard

| Aspect | Details |
|--------|---------|
| **Route** | `/care-coordination` |
| **Component** | `src/components/careCoordination/CareCoordinationDashboard.tsx` |
| **Service** | `src/services/careCoordinationService.ts` |
| **Feature Flag** | `REACT_APP_FEATURE_CARE_COORDINATION=true` |
| **Allowed Roles** | admin, super_admin, case_manager, social_worker, nurse, physician |
| **Features** | Care plan management, team alerts, interdisciplinary coordination, AI recommendations |

## Referrals Dashboard

| Aspect | Details |
|--------|---------|
| **Route** | `/referrals` |
| **Component** | `src/components/referrals/ReferralsDashboard.tsx` |
| **Database Tables** | `external_referral_sources`, `patient_referrals`, `referral_alerts`, `referral_reports` |
| **Feature Flag** | `REACT_APP_FEATURE_REFERRAL_MANAGEMENT=true` |
| **Allowed Roles** | admin, super_admin, case_manager, nurse |
| **Features** | Hospital referral tracking, patient linking, engagement reports, subscription tiers |

See also: [REFERRAL_SYSTEM.md](./REFERRAL_SYSTEM.md)

## Questionnaire Analytics Dashboard

| Aspect | Details |
|--------|---------|
| **Route** | `/questionnaire-analytics` |
| **Component** | `src/components/questionnaires/QuestionnaireAnalyticsDashboard.tsx` |
| **Database Tables** | `questionnaire_deployments`, `questionnaire_responses`, `question_templates` |
| **Feature Flag** | `REACT_APP_FEATURE_QUESTIONNAIRE_ANALYTICS=true` |
| **Allowed Roles** | admin, super_admin, nurse, case_manager, quality_manager |
| **Features** | SMART questionnaire deployment, response tracking, completion analytics, risk flag detection |

## NeuroSuite Dashboard (with Parkinson's Tab)

| Aspect | Details |
|--------|---------|
| **Route** | `/neuro-suite` |
| **Component** | `src/components/neuro/NeuroSuiteDashboard.tsx` |
| **Service** | `src/services/neuroSuiteService.ts`, `src/services/parkinsonsService.ts` |
| **Types** | `src/types/neuroSuite.ts`, `src/types/parkinsons.ts` |
| **Database Tables** | `parkinsons_patient_registry`, `parkinsons_medications`, `parkinsons_medication_log`, `parkinsons_symptom_diary`, `parkinsons_updrs`, `parkinsons_dbs_sessions`, `parkinsons_robert_tracking`, `parkinsons_forbes_tracking` |
| **Feature Flag** | `REACT_APP_FEATURE_NEURO_SUITE=true` |
| **Allowed Roles** | admin, super_admin, physician, doctor, nurse |
| **Tabs** | Stroke, Dementia, **Parkinson's**, Alerts, Wearables |
| **Parkinson's Features** | Patient registry, medication tracking, UPDRS assessments, DBS session logging, symptom diary, ROBERT & FORBES framework guides, risk stratification |

## Enabling Dashboards

Add the following to your `.env` file:

```env
REACT_APP_FEATURE_PHYSICAL_THERAPY=true
REACT_APP_FEATURE_CARE_COORDINATION=true
REACT_APP_FEATURE_REFERRAL_MANAGEMENT=true
REACT_APP_FEATURE_QUESTIONNAIRE_ANALYTICS=true
REACT_APP_FEATURE_NEURO_SUITE=true
```

## Mental Health Dashboard

| Aspect | Details |
|--------|---------|
| **Route** | `/mental-health` |
| **Component** | `src/components/mentalHealth/MentalHealthDashboard.tsx` |
| **Feature Flag** | `REACT_APP_FEATURE_MENTAL_HEALTH=true` |
