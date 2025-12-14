# External Referral & Reporting System

Hospitals with Atlus-only licenses can refer patients to WellFit Community and receive reports.

## Flow Diagram

```
Hospital (HH-8001, Atlus-only)
         │
         │ Refers patient
         ▼
WellFit Community (patient joins, does check-ins)
         │
         │ Generates reports & alerts
         ▼
Hospital receives insights about THEIR patients only
```

## Database Tables

| Table | Purpose |
|-------|---------|
| `external_referral_sources` | Organizations that can refer patients |
| `patient_referrals` | Individual patient referrals with status tracking |
| `referral_reports` | Generated engagement/health reports |
| `referral_alerts` | Real-time alerts (missed check-ins, mood decline, SDOH flags) |

## Subscription Tiers

| Tier | Features |
|------|----------|
| `basic` | Monthly summary reports |
| `standard` | Weekly reports + alerts |
| `premium` | Real-time alerts + dashboard access |
| `enterprise` | FHIR integration + SLA |

## Key Database Functions

| Function | Purpose |
|----------|---------|
| `link_user_to_referral(user_id, phone)` | Auto-links new user to pending referral |
| `get_patient_engagement_summary(user_id, start, end)` | Generates engagement data |
| `check_referral_alerts(user_id)` | Creates alerts based on patient activity |

## Dashboard

- **Route**: `/referrals`
- **Component**: `src/components/referrals/ReferralsDashboard.tsx`
- **Feature Flag**: `REACT_APP_FEATURE_REFERRAL_MANAGEMENT=true`
- **Allowed Roles**: admin, super_admin, case_manager, nurse

## Features

- Hospital referral tracking
- Patient linking (auto-link when patient registers with referred phone)
- Engagement reports generation
- Subscription tier management
- Alert configuration per referral source
