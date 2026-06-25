# Health Data Assets Strategy — What WellFit / Envision Atlus Can Fund, Sell, and Prove

> **Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.**
> Proprietary and confidential. Contact: maria@wellfitcommunity.com

**Author:** AI Health Analyst (Claude) for Maria LeBlanc, AI Systems Director
**Date:** 2026-06-23
**Status:** Strategy + live data-completeness baseline (read-only audit, no schema changes)
**Companion docs:** [`README.md`](./README.md) (funding library), [`ENVISION_ATLUS_GRANTS.md`](./ENVISION_ATLUS_GRANTS.md), [`../business/REVENUE_OPPORTUNITIES_2026.md`](../business/REVENUE_OPPORTUNITIES_2026.md)

---

## 1. The question this answers

> "Take the data we will receive and assemble it into something *useful* — for grants, advancement, and improving care. As a health analyst, which datasets are most valuable in healthcare and equity?"

This document does three things:
1. Names the health datasets the market is actually **paying for and funding** right now, and who buys them.
2. Maps those to the data products **WellFit/Envision Atlus is positioned to produce.**
3. Reports a **live completeness baseline** so we know what is reportable *today* vs. what needs a data-capture push first.

**The headline:** The platform's schema is unusually grant-ready — it captures social, demographic, and clinical-outcome data in one linked place, coded to national standards. The current database, however, is a pre-pilot/seed environment: the *capability* exists, the *data* is not yet populated. The gating task is **data capture at the first real pilot**, not data architecture.

---

## 2. The most sought-after health datasets (market view)

Ordered by strength and trajectory of demand.

| # | Dataset category | Why it's in demand | Who buys / funds it |
|---|---|---|---|
| 1 | **SDOH linked to outcomes** (screen → Z-code → referral → *resolution* → outcome) | Everyone screens; almost no one proves resolution changed an outcome. CMS now requires SDOH reporting; MA plans are scored on it. | Medicare Advantage plans, ACOs, CMS innovation, HRSA, RWJF, community foundations |
| 2 | **Real-World Evidence / Real-World Data (RWE/RWD)** | Longitudinal outcomes outside trials; FDA increasingly accepts for label expansion + post-market safety. | Pharma, research networks, FDA-regulated studies |
| 3 | **Remote patient monitoring time-series** (home BP, glucose, SpO2, weight, activity) | Catches deterioration before costly admissions; dedicated reimbursement (CPT 99453–99458). | Payers, device makers, chronic-disease grant programs |
| 4 | **Health-equity / disparities datasets** (outcomes stratified by race, ethnicity, language, geography) | CMS Health Equity Index now influences MA Star Ratings → directly affects plan payment. | Health plans, CMS, equity foundations, academic health-equity centers |
| 5 | **Patient-Reported Outcomes & functional status** (mood, pain, ADLs, falls, gait) | Required in value-based contracts; scarce at scale; central to aging/ADRD research. | Aging-services funders, NIH/NIA, ADRD programs, payers |
| 6 | **Medication adherence & care-gap data** | Tied to Star Ratings and quality bonuses. | Pharma, payers, pharmacies |
| 7 | **Loneliness / social isolation data** | Named Surgeon General + CDC priority with dedicated funding; rarely measured by both validated screen *and* behavior. | Aging foundations, public health, behavioral-health grants |

---

## 3. WellFit's differentiated position

The combination that is genuinely scarce in this market — and that the schema is built to produce — is:

> **Longitudinal outcomes + standardized demographics + validated SDOH + closed-loop referral — on a hard-to-reach senior population.**

Most data vendors hold *one* layer:
- **Claims data** has utilization but no SDOH or patient-reported data.
- **EHR data** has clinical but little home/social context.
- **Survey data** has SDOH but no outcomes.

WellFit links **social → clinical → outcome on the same person, over time**, for a population normally invisible to the data economy. That linkage maps directly onto demand categories **#1, #4, and #5** — the three with the fastest-rising demand.

---

## 4. The seven data products to build (ranked by funder/equity weight)

Each is a **de-identified, aggregate** product (counts and rates, never patient rows) suitable for a funder packet or a buyer.

1. **Equity Stratification Engine** — every outcome (check-in adherence, BP control, readmission, falls) broken out by race, ethnicity, language, age band, ZIP, and SDOH risk tier. *The single most-requested funder artifact.* Backed by `profiles` (race / race_omb_categories, ethnicity / ethnicity_omb, zip_code, dob, gender) joined to outcome tables.
2. **Closed-Loop SDOH Referral Report** — screened → need identified → referred → *resolved*. Backed by `sdoh_screenings` (PRAPARE/AHC tool field), `sdoh_observations` (Z-codes, risk_level, LOINC), `sdoh_referrals` (status). The **closed-loop rate** is the gold-standard metric most programs cannot report.
3. **Hypertension & Diabetes Control in the Home** — % controlled vs. uncontrolled, trended, stratified by equity group. Backed by `check_ins` (bp_systolic/diastolic, glucose_mg_dl, pulse_oximeter) + `wearable_vital_signs`. Doubles as the RPM reimbursement angle.
4. **30-Day Readmission Reduction** — 7/30/90-day categories, risk scores, follow-up completion. Backed by `patient_readmissions`.
5. **Reach & Retention of Hard-to-Reach Seniors** — adherence, consecutive missed check-ins, digital-literacy barriers. Demonstrates reach into underserved populations + a safety net.
6. **Fall Risk & Aging-in-Place** — gait speed, balance, tremor, freezing-of-gait, fall detection. Backed by `wearable_gait_analysis` + `wearable_fall_detections`. Rare depth for community programs.
7. **Social Isolation / Loneliness** — SDOH social-isolation + community-connection categories + engagement behavior. Aligns to dedicated CDC/Surgeon General funding.

**Where these map in the existing funding library:** #1/#4/#5 support the [NIH PAR-25-170](./NIH_PAR-25-170_GRANT_APPLICATION.md) and [AHRQ R21/R33](./AHRQ_R21_R33_APPLICATION.md) applications; #2/#4 support the [CMS ACCESS Model](./CMS_ACCESS_MODEL_APPLICATION.md) submission.

---

## 5. What makes a dataset fundable or saleable (the quality bar)

A dataset is worth money only if it clears these. This is where strategy meets reality:

| Quality dimension | Why it matters | WellFit status |
|---|---|---|
| **Standardized coding** (FHIR, LOINC, ICD-10 Z-codes, OMB race/ethnicity) | Un-coded data is nearly worthless; coding is what makes it shareable/saleable. | **Strong** — schema uses OMB race categories, Z-codes, LOINC, FHIR observations |
| **Completeness** | A 90%-complete equity field is worth multiples of a 50% one; reviewers discount sparse data. | **Weak today** — see baseline §6. This is the #1 risk. |
| **Longitudinality** | Repeated measures over time beat snapshots. | **Promising** — check-ins span ~7 months already |
| **Consent & de-identification** | Properly de-identified consented data is saleable; PHI is a liability. | **Architecture supports it** — PHI encryption + tenant RLS in place |
| **Linkage** | Connecting social → clinical → outcome on one person is the hardest thing to replicate. | **Crown jewel** — schema is built for it |

**Bottom line:** Coding and linkage are already strong. **Completeness is the one thing standing between the schema and a fundable dataset.**

---

## 6. Live data-completeness baseline (2026-06-23)

Read-only audit of the production project (`xkybsjnvuohpqpbkikyn`, PostgreSQL 17). **This is a pre-pilot/seed environment — 1 tenant, test members.** Numbers reflect capability and capture gaps, not a live population.

### Volume

| Table | Rows | Note |
|---|---|---|
| `check_ins` | 71 | 10 distinct members; date range 2025-11-20 → 2026-06-17 |
| `profiles` | 61 | 1 distinct tenant |
| `care_coordination_plans` | 3 | |
| `sdoh_observations` | **0** | not yet populated |
| `sdoh_screenings` | **0** | not yet populated |
| `sdoh_referrals` | **0** | not yet populated |
| `patient_readmissions` | **0** | not yet populated |
| `wearable_vital_signs` | **0** | not yet populated |

### Demographic / equity-field completeness (of 61 profiles)

| Field | Populated | % | Reportability |
|---|---|---|---|
| `race` / `race_omb_categories` | 0 | 0% | Column exists; **not being captured** |
| `ethnicity` | 3 | 5% | Sparse |
| `ethnicity_omb` | 0 | 0% | Not captured |
| `zip_code` | 3 | 5% | Sparse (geographic equity needs this) |
| `dob` (age) | 10 | 16% | Sparse |
| `gender` | 13 | 21% | Sparse |
| `address`, `living_situation`, `marital_status`, `health_conditions` | 0 | 0% | Not captured |
| **`preferred_language`** | — | — | **Column absent from live `profiles`** — language-access equity not capturable today |

### Check-in vitals completeness (of 71 check-ins)

| Vital | Populated | % |
|---|---|---|
| Blood pressure (sys+dia) | 38 | 54% |
| SpO2 (pulse oximeter) | 13 | 18% |
| Glucose | 4 | 6% |
| Heart rate | 0 | 0% |

### What this means

- **None of the seven products are reportable on real numbers today.** The schema supports all of them; the data does not yet exist.
- **The equity story is currently un-tellable**: race 0%, ethnicity 5%, ZIP 5%. Equity stratification (Product #1, the most-requested) requires these fields, and the intake flow is not capturing them even in seed data.
- **`preferred_language` does not exist in the live `profiles` table**, despite migrations referencing US Core language fields — a concrete gap for the language-access equity angle. (Verified live per governance Rule #18; do not trust the migration files here.)
- **Vitals capture is the bright spot**: BP at 54% across a 7-month span shows the home-monitoring product (#3) is the closest to viable once real members enroll.

---

## 7. Recommended sequence

1. **Make the intake flow capture the equity fields.** Race (OMB), ethnicity (OMB), preferred language, and ZIP must be collected at registration. Add `preferred_language` to `profiles` (Tier-3 schema change — requires Maria's sign-off). Without this, Product #1 can never report.
2. **Stand up the de-identified aggregate reporting layer** — `security_invoker` views + a couple of materialized views that output counts/rates only, extending the existing `v_readmission_*` / `patient_engagement_metrics` pattern. Build Products #1 and #2 first.
3. **Re-run this completeness baseline as the pilot go/no-go gate.** A product is "fundable" once its backing fields clear ~80% completeness on real members. This file is the template; re-run quarterly.
4. **Package the first reportable product into a one-page funder artifact** mapped to a specific application in the grants library.

---

## 8. Honest caveat

The equity stratification is only as credible as race/ethnicity/language/ZIP completeness. Today those sit at 0–5%. A reviewer will discount any equity claim built on that. The differentiator (linkage across social/clinical/outcome) is real and rare — but it converts to funding *only after* the capture gap is closed. Fix capture first; the rest of the schema is already ahead of the market.
