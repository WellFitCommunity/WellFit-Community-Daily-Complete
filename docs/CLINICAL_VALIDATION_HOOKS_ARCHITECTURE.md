# Clinical Validation Hooks Architecture

> **Author:** Maria (AI System Director) + Claude Opus 4.6
> **Date:** 2026-03-06
> **Purpose:** Document the design rationale, real-world alignment, and implementation plan for runtime validation hooks that catch AI-hallucinated clinical codes before they reach human reviewers.
> **Status:** Design approved. Implementation pending.

---

## The Problem

Our AI edge functions suggest ICD-10 codes, CPT codes, Z-codes, DRG assignments, and risk scores to coders and billers. If the AI hallucinates a code that doesn't exist, the human reviewer has to catch it themselves. That's asking a biller to be a safety net for AI hallucination — that's not their job.

**Their job is to judge whether the right code was picked, not whether the code is real.**

The validation hook handles "is it real?" so the biller only has to answer "is it right?"

```
Without hooks:  AI suggests Z99.9 → Biller sees it → Biller has to know Z99.9 doesn't exist
With hooks:     AI suggests Z99.9 → Hook catches it → Biller never sees it
```

---

## Real-World Clinical Coding Workflow

### What Hospitals Actually Do

```
Doctor sees patient
        |
Doctor dictates/writes note
        |
Note goes to Health Information Management (HIM) department
        |
Certified coder reads the note
        |
Coder assigns ICD-10 (diagnoses) + CPT (procedures)
        |
Codes go into the encoder/grouper software
        |
Grouper calculates DRG + expected reimbursement
        |
Charge goes to billing
        |
Biller submits claim (837P) to payer
```

### Our System's Workflow

```
Doctor documents encounter
        |
AI reads documentation (coding-suggest, ai-billing-suggester)
        |
AI suggests ICD-10 + CPT codes
        |
 ** VALIDATION HOOK — catches hallucinated codes **
        |
Coder/biller reviews AI suggestions (accepts/rejects/modifies)
        |
DRG grouper calculates DRG + reimbursement
        |
Revenue optimizer flags documentation gaps
        |
Biller submits claim via clearinghouse
```

**These two workflows are the same chain.** The only difference is we replaced the manual "coder reads the note and picks codes from memory/reference books" step with "AI suggests codes and coder reviews them." That's what every major EHR vendor is moving toward — Epic, Cerner (Oracle Health), athenahealth are all building AI-assisted coding.

---

## Role Mapping: Our System vs Hospital Staff

| Role in Our System | Hospital Equivalent | What They Do |
|---------------------|-------------------|-------------|
| AI coding assistant (`coding-suggest`, `ai-billing-suggester`) | Computer-Assisted Coding (CAC) | Suggests codes from documentation |
| Validation hook (`clinicalOutputValidator`) | Encoder / code editor | Verifies codes are valid and exist |
| DRG grouper (`drgGrouperHandlers`) | DRG grouper (3M APR-DRG, MS-DRG) | Calculates reimbursement group from coded diagnoses/procedures |
| Revenue optimizer (`revenueOptimizerHandlers`) | Clinical Documentation Improvement (CDI) | Finds documentation gaps for better code specificity |
| Biller (claim submission via clearinghouse) | Revenue cycle / billing department | Submits claims to payers |
| SDOH coding (`sdoh-coding-suggest`) | Social work / care coordination | Identifies social determinant Z-codes from documentation |

**Physicians diagnose. Coders translate diagnoses to codes. The grouper aggregates codes into a DRG. The biller submits claims.** Our AI assists the coder — it does not replace them. The validation hook ensures AI suggestions are valid before the coder reviews them.

### Workflow Nuance: Who Codes?

- **Hospital inpatient:** Physician documents -> Coder codes -> Grouper groups -> Biller bills
- **Small practice outpatient:** Physician documents AND codes (with AI assistance) -> Biller submits

Both workflows benefit from validation hooks. Whether it's a coder or a physician entering codes, the hook catches hallucinated suggestions before they're accepted.

---

## Industry Equivalents

Hospitals already use validation tools. Our hooks are the AI-era equivalent.

| Product | What It Does | Annual Cost | Our Equivalent |
|---------|-------------|-------------|----------------|
| 3M CodeFinder | Validates codes, checks bundling rules, flags conflicts | $30,000-$80,000 | Validation hook + NCCI bundling |
| Optum EncoderPro | Code lookup + validation + DRG grouping | $25,000-$60,000 | Validation hook + DRG grouper |
| TruCode | Encoder with AI-assisted code suggestions | $20,000-$50,000 | AI coding assistant + validation hook |
| Nuance DAX / 3M M*Modal | AI-powered clinical documentation + coding | $50,000-$150,000 | AI coding + documentation + validation |

**Key difference:** Those products validate codes the *coder* picks. Ours validates codes the *AI* picks — before the coder even sees them. That's a step ahead of current market products.

---

## What the Validation Hooks Check

### Code Existence Validation

| AI Output Type | What the Hook Checks | Data Source |
|---------------|---------------------|-------------|
| ICD-10 codes | Does this code exist? Is it active for current fiscal year? | NLM API + `code_icd` cache |
| Z-codes (SDOH) | Is this in the Z55-Z65 range? Does it exist in ICD-10-CM? | NLM API + range check |
| DRG codes | Does this DRG exist in current MS-DRG table? Correct weight? | `ms_drg_reference` table |
| CPT codes | Does this code exist? Is it active? | `code_cpt` table (AMA license required for descriptions) |
| HCPCS codes | Does this code exist? Correct level? | `code_hcpcs` table |

### Clinical Safety Validation

| AI Output Type | What the Hook Checks | Data Source |
|---------------|---------------------|-------------|
| Risk scores | Range valid (0-100)? Supporting factors present? | Logic check |
| Medication recommendations | Cross-check against patient allergies | `allergy_intolerances` table |
| Escalation levels | Documented triggers present for CRITICAL status? | Data presence check |
| Care plan recommendations | Interventions match documented conditions? | Patient context |

### What Hooks Cannot Check

| Limitation | Why | Who Handles It |
|-----------|-----|---------------|
| Clinical appropriateness | "Does this patient actually have diabetes?" requires clinical judgment | Coder / physician |
| Documentation sufficiency | "Is the note detailed enough to support this code?" requires reading comprehension | CDI specialist / revenue optimizer AI |
| Payer-specific rules | Each insurance company has different coverage policies | Biller / clearinghouse |

**The hook validates the code's existence, not its appropriateness. This is important to communicate so nobody thinks hooks replace clinical review.**

---

## Architecture Design

### Data Flow

```
AI Edge Function
        |
    generates output (codes, scores, recommendations)
        |
   clinicalOutputValidator.validate(type, output, patientId)
        |
   +------------------+------------------+
   |                  |                  |
Code Existence    Safety Cross-Check   Range Validation
(NLM API /        (allergies,          (scores 0-100,
 local cache)      contraindications)   required fields)
   |                  |                  |
   +------------------+------------------+
        |
   All valid? ──YES──> Return to coder/biller
        |
       NO
        |
   Flag invalid items + log + return clean results
```

### Validation Response Shape

```typescript
interface ValidationResult {
  valid: boolean;
  validatedCodes: ValidatedCode[];
  rejectedCodes: RejectedCode[];
  warnings: string[];
  audit: {
    timestamp: string;
    source_function: string;
    codes_checked: number;
    codes_rejected: number;
    validation_method: 'nlm_api' | 'local_cache' | 'both';
  };
}

interface ValidatedCode {
  code: string;
  system: 'icd10' | 'cpt' | 'hcpcs' | 'drg' | 'z-code';
  description: string;
  validated: true;
  source: 'nlm_api' | 'local_cache';
}

interface RejectedCode {
  code: string;
  system: string;
  reason: 'code_not_found' | 'code_inactive' | 'wrong_fiscal_year' | 'invalid_format' | 'allergy_conflict';
  ai_suggested: true;
  validated: false;
}
```

---

## ICD-10 Code Sources — How We Get Reference Data

### Available Sources

| Source | Cost | Auth Required | Coverage | Update Cycle |
|--------|------|---------------|----------|-------------|
| **NLM Clinical Tables API** | Free | None | ~72,000 ICD-10-CM codes | Annual (auto-updated) |
| CMS Bulk Download | Free | None | Full ICD-10-CM + PCS | Annual (October) |
| WHO ICD API | Free | OAuth2 registration | ~14,000 ICD-10 (international, not CM) | Periodic |

### Recommended Approach: Hybrid (API + Light Local Cache)

| Layer | Purpose | Source |
|-------|---------|--------|
| **Real-time validation** | When AI suggests a code, verify it exists | NLM Clinical Tables API |
| **Local cache** | Top ~5,000 most common codes for fast offline validation | CMS annual download, filtered |
| **Search/autocomplete** | Clinician searches for a code in the UI | NLM API (always current) |

**NLM API Example:**
```
GET https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code,name&terms=E11
```
Returns matching ICD-10-CM codes with descriptions. Free, no key, no rate limits for reasonable use.

**Why hybrid:**
- API-first means we're never stale — NLM updates automatically
- Local cache means validation hooks don't add network latency for common codes
- No 72,000-row maintenance burden — cache the common ones, API the rare ones
- If the API is down, local cache still catches the most common hallucinations

### Code Set Licensing

| Code Set | Free? | Source | Notes |
|----------|-------|--------|-------|
| ICD-10-CM (diagnoses) | Yes — public domain | CMS / NLM API | No restrictions |
| ICD-10-PCS (procedures) | Yes — public domain | CMS / NLM API | No restrictions |
| HCPCS Level II | Yes — public domain | CMS download | No restrictions |
| CPT (Level I) | **No — AMA license required** | AMA | ~$635/year single-user; redistribution license negotiated (est. $5,000-$15,000/year) |
| MS-DRG tables | Yes — public domain | CMS download | No restrictions |

**CPT nuance:** You can use CPT code *numbers* without a license. The license is required for *descriptions* (the text explaining what each code means). Validation hooks can check "does code 99213 exist?" without a license. Displaying "99213 — Office visit, established patient, low complexity" requires one.

---

## Strategic Value

### For Hospital Sales

> "Our AI reads the physician's documentation and suggests codes. Before the coder sees them, we validate every code against the current CMS reference data — ICD-10-CM, CPT, HCPCS, DRG tables. Hallucinated or invalid codes never reach your staff. Every validation is logged for compliance."

A hospital HIM director would recognize this immediately — it's their existing workflow with a safety layer most systems don't have.

### For Compliance (Akima)

Every validated output, every caught hallucination, every flagged code — logged. When a compliance officer asks "has your AI ever suggested a code that doesn't exist?", the answer is: "Yes, 47 times last quarter, all caught before display, here's the log." That's auditable, measurable proof.

### For Investors

This transforms the AI safety story from "trust our prompts" to "we verify every output." Preventive controls (prompt constraints) + detective controls (validation hooks) = defense in depth.

### Competitive Position

| Capability | Us | Typical AI Coding Startups |
|-----------|----|----|
| AI code suggestion | Yes | Yes |
| Post-output validation against CMS data | Yes (planned) | Rare |
| Validation across full platform (14+ AI functions) | Yes (planned) | No — most validate per-product |
| Hallucination logging and metrics | Yes (planned) | Rare |
| Integrated DRG grouping + validation | Yes | Usually separate vendor |

---

## Strengths

1. **Solves the #1 AI trust problem in healthcare** — verifiable, not just "we told the AI to behave"
2. **Auditable paper trail** — every validation logged for SOC2/HIPAA
3. **Measurable AI safety** — hallucination catch rate becomes a reportable metric
4. **Model-independent** — works regardless of which AI model produced the output
5. **Mirrors real-world hospital workflow** — HIM directors will recognize the pattern immediately
6. **Cheap to build** — NLM API is free, table structures exist, edge functions exist
7. **Built into the platform** — replaces $30,000-$100,000/year encoder products

## Limitations (Honest Assessment)

1. **Reference data is the bottleneck** — hooks are only as good as the data they validate against. Empty lookup tables create false confidence.
2. **False positives risk** — if reference data is incomplete or stale, valid codes get flagged. Clinicians lose trust.
3. **Performance cost** — database/API lookups after every AI call. Must be batched, not sequential.
4. **Cannot check clinical appropriateness** — validates code existence, not whether the code matches the patient's actual condition. That's still human judgment.
5. **CPT licensing gap** — full CPT validation requires AMA license for production.
6. **Maintenance burden** — CMS updates ICD-10 annually (October), CPT annually (January), DRG annually (October), HCPCS quarterly. Reference data freshness monitoring (P1-9) helps but someone must do the actual data loads.

---

## Dependencies

| Dependency | Status | Impact |
|-----------|--------|--------|
| NLM API integration | Not built | Required for ICD-10 real-time validation |
| `code_icd` table seeding | Empty | Required for local cache validation |
| `ms_drg_reference` table | Not built (P1-1) | Required for DRG validation — needs Akima review |
| `code_cpt` table | ~120 rows (E/M only) | Sufficient for pilot, needs AMA license for full |
| `code_hcpcs` table | Not seeded | Required for HCPCS validation |
| Reference data freshness (P1-9) | Built | Monitors staleness of all reference tables |
| Clinical constraint prompts (P1-5) | Built | Preventive layer — hooks add detective layer |
| Prompt injection guard (P1-7) | Built | Input sanitization — hooks validate output |

---

## Items Requiring Akima Review

- [ ] **P1-1:** DRG validation table — which MS-DRG version year to seed? Is a reference table sufficient for pilot or do we need an external grouper API (Optum/3M)?
- [ ] **CPT licensing:** Do billers need CPT descriptions displayed, or just code entry? Determines whether AMA redistribution license is needed for pilot.
- [ ] **Failure behavior:** When a hallucinated code is caught — strip it silently, reject the whole response, or flag it visually for the coder to see?
- [ ] **P4-4:** Cultural competency profiles need clinical accuracy review (prevalence rates, screening tools, drug interactions).

---

## Relationship to Existing Tracker Items

| Tracker Item | Relationship |
|-------------|-------------|
| P1-1 (DRG validation table) | Required for DRG hook validation |
| P1-5 (AI constraints) | Preventive controls — hooks add detective controls |
| P1-6 (Adversarial testing) | Tests should include hook validation |
| P1-7 (Prompt injection) | Input sanitization — hooks validate output |
| P1-8 (Post-output validation) | **This document IS the expanded design for P1-8** |
| P1-9 (Reference data freshness) | Ensures hook reference data stays current |
| P3-1 (CMS coverage data) | Enriches validation context |
| P3-2 (Medical codes seeding) | Required for local cache validation |
| P3-4 (NUCC taxonomy) | Enriches provider validation |

---

## FHIR Integration — Why Validation Hooks Must Cover Interoperability

### The FHIR Connection

Every code that flows through our system doesn't just stay in our database. Codes travel outward through FHIR resources to external EHR systems, health information exchanges (HIEs), payers, and patients (via My Health Hub / 21st Century Cures Act). A hallucinated code that passes through our system and lands in a FHIR bundle becomes **someone else's problem** — and our liability.

```
AI suggests ICD-10 code
        |
  Validation Hook (catches hallucinations HERE)
        |
  Coder accepts code
        |
  Code stored in our database
        |
  +------------------+------------------+------------------+
  |                  |                  |                  |
FHIR Condition    837P Claim        C-CDA Export      Patient Portal
(sent to EHR)     (sent to payer)   (sent to HIE)     (My Health Hub)
  |                  |                  |                  |
External systems     Insurance         Other hospitals    Patient sees it
trust this code      pays based on it  treat based on it  makes decisions
```

**If the code is wrong at the top, it's wrong everywhere downstream.** The validation hook is the last gate before a code enters the interoperability pipeline.

### FHIR Resources That Carry Codes

Every FHIR resource our system generates contains coded values. Each is a potential hallucination vector.

| FHIR Resource | Code Systems Used | Where It Goes | Risk If Hallucinated |
|--------------|-------------------|---------------|---------------------|
| `Condition` | ICD-10-CM | EHR, patient portal, care plans | Wrong diagnosis in patient's permanent record |
| `Procedure` | CPT, ICD-10-PCS | EHR, claims | Wrong procedure billed, wrong surgical history |
| `MedicationRequest` | RxNorm, NDC | EHR, pharmacy, patient portal | Wrong medication in reconciliation list |
| `Observation` | LOINC (lab), SNOMED CT (clinical) | EHR, lab systems, patient portal | Wrong lab result interpretation, wrong vital sign coding |
| `AllergyIntolerance` | RxNorm, SNOMED CT | EHR, pharmacy alerts | Missing allergy = patient safety risk; fake allergy = unnecessary medication avoidance |
| `DiagnosticReport` | LOINC | EHR, lab systems | Wrong report type, misrouted results |
| `Claim` | CPT, ICD-10-CM, HCPCS | Payer via clearinghouse | Claim denial, audit trigger, fraud flag |
| `CareTeam` | NUCC taxonomy | Care coordination | Wrong provider specialty, misrouted referrals |
| `Immunization` | CVX, MVX | Immunization registries, patient portal | Wrong vaccine record — public health impact |
| `CarePlan` | SNOMED CT | EHR, care coordination | Wrong care goals, inappropriate interventions |

### Code Systems That Need Validation

Our AI functions generate or reference codes from multiple terminologies. Each needs its own validation path.

| Code System | Full Name | Size | Free? | Validation Source | Used In |
|------------|-----------|------|-------|-------------------|---------|
| ICD-10-CM | International Classification of Diseases, 10th Revision, Clinical Modification | ~72,000 codes | Yes | NLM API + CMS download | Conditions, Claims |
| ICD-10-PCS | ICD-10 Procedure Coding System | ~78,000 codes | Yes | CMS download | Procedures, Claims |
| CPT | Current Procedural Terminology | ~10,000 codes | No (AMA) | `code_cpt` table | Procedures, Claims |
| HCPCS | Healthcare Common Procedure Coding System | ~7,000 codes | Yes | CMS download | Claims, DME |
| RxNorm | Normalized Drug Names | ~100,000+ concepts | Yes | NLM RxNorm API | MedicationRequest, AllergyIntolerance |
| SNOMED CT | Systematized Nomenclature of Medicine | ~350,000 concepts | Yes (US license) | NLM SNOMED API | Conditions, Observations, Allergies, CarePlans |
| LOINC | Logical Observation Identifiers Names and Codes | ~98,000 codes | Yes | LOINC.org / NLM API | Observations, DiagnosticReports |
| CVX | Vaccine Administered codes | ~200 codes | Yes | CDC download | Immunizations |
| NDC | National Drug Code | ~300,000 codes | Yes | FDA NDC Directory API | Medications, pharmacy |
| NUCC | National Uniform Claim Committee taxonomy | ~600+ codes | Yes | NUCC.org download | CareTeam, provider specialty |
| MS-DRG | Medicare Severity Diagnosis Related Groups | ~760 codes | Yes | CMS download | DRG grouping, reimbursement |

### Free Government APIs for Code Validation

| API | Code Systems | Auth | Rate Limits | URL Pattern |
|-----|-------------|------|-------------|-------------|
| **NLM Clinical Tables** | ICD-10-CM, ICD-10-PCS | None | Reasonable use | `clinicaltables.nlm.nih.gov/api/icd10cm/v3/search` |
| **NLM RxNorm** | RxNorm, NDC crosswalk | None (UMLS for bulk) | Reasonable use | `rxnav.nlm.nih.gov/REST/rxcui.json?name=...` |
| **NLM SNOMED** | SNOMED CT (US Edition) | UMLS API key (free) | Reasonable use | `uts-ws.nlm.nih.gov/rest/...` |
| **NLM LOINC** | LOINC codes | UMLS API key (free) | Reasonable use | `uts-ws.nlm.nih.gov/rest/...` |
| **FDA NDC** | National Drug Codes | None | Reasonable use | `api.fda.gov/drug/ndc.json?search=...` |
| **CDC CVX** | Vaccine codes | None | Static download | `cdc.gov/vaccines/programs/iis/` |

**All of these are free, government-maintained, and designed for exactly this use case.** The US government publishes these APIs specifically so healthcare IT systems can validate clinical data. We should be using them.

### FHIR Validation Hook — Extended Data Flow

```
AI Edge Function generates clinical output
        |
   clinicalOutputValidator.validate(type, output, patientId)
        |
   +------------------+------------------+------------------+
   |                  |                  |                  |
Code Existence    Terminology        FHIR Resource       Safety
(ICD-10, CPT,     Validation         Structure           Cross-Check
 DRG, HCPCS)      (RxNorm, SNOMED,   (required fields,   (allergies,
                    LOINC, CVX)       reference links,     contraindications)
                                      valid code systems)
   |                  |                  |                  |
   +------------------+------------------+------------------+
        |
   All valid? ──YES──> Code enters database + FHIR pipeline
        |
       NO
        |
   Flag + log + strip invalid items before they reach:
     - Coder/biller UI
     - FHIR export bundles
     - 837P claim generation
     - C-CDA documents
     - Patient portal (My Health Hub)
     - Immunization registry submissions
     - Syndromic surveillance reports
```

### FHIR-Specific Validation Rules

Beyond code existence, FHIR resources have structural requirements that validation hooks should enforce.

| Rule | What It Checks | Why |
|------|---------------|-----|
| Code system URI matches code format | ICD-10 code with `http://snomed.info/sct` URI = wrong | External systems reject mismatched code/system pairs |
| Required references present | Observation without `subject` reference to Patient | FHIR consumers expect connected resources (P1-2 fixed this for generation — hooks verify it persists) |
| Value set binding | `Condition.clinicalStatus` must be from `active/recurrence/relapse/inactive/remission/resolved` | FHIR spec requires specific value sets for certain fields |
| Identifier format | NPI must be 10 digits, MRN must match facility pattern | Downstream systems validate these on receipt |
| Date consistency | Encounter end date cannot precede start date | Temporal logic errors break timelines |
| Quantity units | Lab result units must be UCUM format | Non-UCUM units rejected by FHIR validators |

### What This Means for Interoperability Compliance

| Standard | Requirement | How Validation Hooks Help |
|----------|------------|--------------------------|
| **21st Century Cures Act** | Patients must have electronic access to their records (via My Health Hub) | Hooks ensure patients see validated codes, not AI hallucinations |
| **USCDI v3** | Standardized data classes with required code systems | Hooks verify correct code systems used per USCDI data class |
| **ONC HTI-2** | Algorithm transparency — AI decisions must be explainable | Validation audit log shows what was checked, what was caught |
| **CMS Interoperability Rule** | Payer-to-payer and provider-to-payer data exchange | Hooks ensure codes in exchanged data are valid |
| **HL7 FHIR US Core** | FHIR profiles with required value set bindings | Hooks validate value set compliance before export |
| **HIPAA 837P/I** | Claims must use valid code sets | Hooks prevent hallucinated codes from reaching clearinghouse |

### The Downstream Impact Chain

When a hallucinated code escapes our system without validation:

| Where It Goes | What Happens | Who's Affected |
|--------------|-------------|---------------|
| **Payer (via 837P claim)** | Claim denied for invalid code, audit triggered, potential fraud flag | Revenue cycle — delayed or lost reimbursement |
| **EHR (via FHIR)** | Wrong diagnosis in patient record, wrong care plan triggered | Clinicians at receiving hospital — may treat based on wrong data |
| **Patient portal (My Health Hub)** | Patient sees incorrect diagnosis, calls doctor panicked | Patient trust, provider burden |
| **HIE (via C-CDA)** | Wrong data propagates across health information exchange | Every provider who pulls this patient's record |
| **Immunization registry** | Wrong vaccine code reported to state | Public health reporting accuracy |
| **Syndromic surveillance** | Wrong condition reported to public health | Epidemiological data integrity |
| **Quality reporting (HEDIS/MIPS)** | Wrong codes affect quality measure calculations | Provider quality scores, reimbursement penalties |

**One hallucinated code can cascade through 7+ systems.** The validation hook is not just an internal safety measure — it's the gate that protects the entire interoperability ecosystem.

---

## Competitive Differentiation — What Makes This Architecture Novel

### What Others Are Doing

| Company | What They Do | What They Don't Do |
|---------|-------------|-------------------|
| Nabla, Abridge, Nuance DAX | AI listens to doctor-patient conversation, generates notes | No coding, no validation, no DRG, no billing chain |
| Codemetrix, Fathom | AI reads notes, suggests codes | No runtime validation against CMS data, no constraint architecture |
| 3M, Optum | Encoder + DRG grouper | Not AI-powered, no prompt injection guards, no hallucination detection |
| Guardrails AI, NeMo Guardrails | Generic LLM output validation | Not healthcare-specific, no ICD-10/DRG/FHIR awareness |
| Epic, Oracle Health (Cerner) | Full EHR with some AI features being added | Massive legacy systems, AI bolted on, not AI-first |

### What Nobody Else Has — The Full Chain

```
Documentation
    -> AI Coding (14 edge functions)
    -> Prompt Injection Guard (input sanitization)
    -> Clinical Constraints (shared "do NOT" architecture)
    -> Validation Hooks (post-output verification against CMS/NLM/FDA data)
    -> Human Review (coder/biller)
    -> DRG Grouping (AI-assisted + reference table validation)
    -> Revenue Optimization (documentation gap detection)
    -> FHIR Export (validated codes only)
    -> Clearinghouse Submission (validated claims only)
```

With:
- 14 AI edge functions governed by a shared constraint architecture
- Prompt injection detection on clinical free-text
- Post-output validation against live CMS/NLM/FDA reference data
- FHIR resource structure validation before interoperability export
- Every step audited for HIPAA/SOC2
- Multi-tenant, white-label, deployable to different hospitals
- Defense in depth: preventive (constraints) + detective (hooks) + proof (audit logs)

### The Design Philosophy

Most AI healthcare companies ask: **"How do we make AI suggest good codes?"**

This system asks: **"AI will hallucinate. How do we catch it before it reaches a human? And how do we prove we caught it?"**

Designing for failure is better engineering. Every safety-critical system — aviation, nuclear, medical devices — is designed around the assumption that components will fail. This validation hook architecture applies that principle to AI-generated clinical output.

The constraint architecture (tell AI what NOT to do) + validation hooks (catch it when it does it anyway) + audit logging (prove you caught it) is **defense in depth** — a military and cybersecurity concept applied to clinical AI.

---

*This document is part of the Envision ATLUS governance framework. The validation hook architecture represents a defense-in-depth approach: prompt constraints prevent hallucination, validation hooks detect it, and audit logging proves it.*
