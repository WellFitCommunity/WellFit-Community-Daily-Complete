# AI-Powered DRG Grouper — Product Strategy

> **Envision ATLUS I.H.I.S. — Medical Coding Server**
> **Prepared for:** Clinical & Revenue Cycle Review
> **Date:** 2026-03-05
> **Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.**

---

## The Problem

Hospitals lose revenue every day because DRG coding is either too expensive or too inaccurate.

**Current market reality:**
- 3M and Optum control the certified DRG grouper market
- Annual licenses cost $50K-$200K+ depending on hospital size
- Optum is owned by UnitedHealth Group — the largest health insurer in the country, creating an inherent conflict of interest in a tool that determines how much hospitals get paid
- Small and rural hospitals often cannot afford these tools at all
- Hospitals without groupers rely on manual coding, which misses CC/MCC upgrades and leaves money on the table

**The silent revenue loss:**
- A hospital doing 50 admits/day with an average missed DRG bump of $800 loses ~$40,000/day
- Over a fiscal year, that is $14.6M in unrealized revenue
- Many hospitals don't know they're losing this money because they've never had a tool that shows them what they're missing
- Hospitals that DO have groupers still lose revenue when the tool doesn't pull the best code from the clinical documentation

**Who this affects most:**
- Rural and critical access hospitals (no budget for enterprise grouper licenses)
- Safety-net hospitals (operating on thin margins)
- Community hospitals (mid-size, 100-300 beds, often using outdated tools)
- Any hospital where coders are overwhelmed and documentation review is incomplete

---

## Our Approach

### AI-Powered DRG Grouping at a Fraction of the Cost

The Envision ATLUS Medical Coding Server uses Claude AI to perform DRG grouping using the same methodology as certified groupers — but at pennies per encounter instead of tens of thousands per year.

### How It Works

**Step 1: Documentation Intake**
- System ingests clinical documentation (H&P, progress notes, discharge summary, operative reports)
- No manual code entry required — the AI reads the documentation directly

**Step 2: ICD-10 Code Extraction**
- Claude extracts all relevant ICD-10-CM diagnosis codes and ICD-10-PCS procedure codes from the clinical text
- Identifies principal diagnosis, secondary diagnoses, complications, and comorbidities

**Step 3: Three-Pass DRG Analysis**
- **Pass 1 (Base):** Group with principal diagnosis + procedures only
- **Pass 2 (+CC):** Add complication/comorbidity codes, check for DRG upgrade
- **Pass 3 (+MCC):** Add major CC codes, check for highest valid DRG
- Select the highest-weight valid DRG across all three passes

This is the exact MS-DRG methodology published by CMS. We didn't invent a new process — we automated the existing one.

**Step 4: Validation**
- AI suggestion validated against CMS MS-DRG reference table (published annually, public data)
- Checks: Does the DRG code exist? Does the weight match? Does the MDC align with the principal diagnosis?
- Any discrepancy flags the case for human review

**Step 5: Human Review**
- Certified coder reviews flagged cases and all AI suggestions
- System is advisory — never auto-files claims
- Full audit trail: what the AI extracted, why it chose the DRG, what documentation supported it

---

## Why This Works Without a Certified Grouper License

**CMS does not mandate which tool a hospital uses for DRG assignment.** CMS mandates accurate coding. The regulatory requirement is the outcome (correct DRG), not the vendor.

**The MS-DRG logic is public data.** CMS publishes the complete MS-DRG definitions, relative weights, MDC assignments, CC/MCC lists, and surgical hierarchy tables every fiscal year. This is not proprietary information — it is federal government data available to anyone.

**What 3M and Optum sell is convenience, not secret logic.** Their tools package the public CMS data into software with a certification stamp. The certification process was built around their products. Hospitals have been conditioned to believe certification is a regulatory requirement. It is not.

**Our safeguards match or exceed certified grouper workflows:**
1. Reference table validation against official CMS MS-DRG data
2. Mandatory human coder review on every case
3. Complete audit trail (AI reasoning, extracted codes, documentation references)
4. AI transparency logging per ONC HTI-2 requirements
5. Structured JSON output — no ambiguous free-text parsing

---

## Cost Comparison

| Factor | 3M / Optum Grouper | Envision ATLUS AI Grouper |
|--------|-------------------|--------------------------|
| Annual license | $50K - $200K+ | $0 (included in platform) |
| Per-encounter cost | Included in license | ~$0.02 - $0.05 per encounter (AI API cost) |
| Cost for 50 admits/day | $50K-$200K/year | ~$365 - $912/year |
| Implementation time | Weeks to months | Hours (edge function deployment) |
| FY update cycle | Wait for vendor update | Update reference table + prompt same day CMS publishes |
| Documentation review | Coder must read and code manually | AI reads documentation, suggests codes |
| CC/MCC optimization | Shows valid groupings | Actively identifies missed CC/MCC from documentation |
| Audit trail | Varies by product | Every AI decision logged with reasoning |
| Transparency | Black box | Full prompt, extraction, and reasoning visible |

---

## The Revenue Recovery Opportunity

### What hospitals are losing today

**Scenario: 200-bed community hospital, 50 admits/day**

| Revenue Leak | How It Happens | Est. Daily Loss |
|-------------|----------------|----------------|
| Missed CC/MCC upgrades | Coder doesn't review all secondary diagnoses in documentation | $15,000 - $25,000 |
| Under-coded principal diagnosis | Less specific ICD-10 selected when documentation supports higher specificity | $5,000 - $10,000 |
| Missing documentation queries | No tool to flag when documentation doesn't support the acuity level | $3,000 - $8,000 |
| Charge capture gaps | Labs, pharmacy, nursing interventions not captured on day-of-service | $5,000 - $15,000 |
| **Total estimated daily loss** | | **$28,000 - $58,000** |
| **Annualized** | | **$10.2M - $21.2M** |

### What our system catches

The Medical Coding Server doesn't just assign DRGs. It:

1. **Reads the entire clinical record** — not just the codes a human entered, but the documentation itself
2. **Identifies codes the coder missed** — secondary diagnoses, CC/MCC qualifiers buried in progress notes
3. **Flags documentation gaps** — "Documentation says 'acute kidney injury' but doesn't specify stage. Query physician for specificity → potential DRG upgrade"
4. **Runs daily charge completeness checks** — "Day 3 of admission: no pharmacy charges captured. Expected for this acuity level."
5. **Projects revenue impact** — Shows the dollar difference between current coding and optimized coding

---

## Validation Strategy

### Retrospective Study (Required Before Production)

To establish credibility with hospital revenue cycle teams:

1. **Obtain 100+ coded encounters** from a partner hospital (already coded by their certified grouper)
2. **Run each encounter through our AI grouper** with the same clinical documentation
3. **Compare DRG assignments:**
   - Match rate (our DRG = their DRG)
   - Upgrade detection (cases where we find a higher valid DRG they missed)
   - Error rate (cases where our suggestion is wrong)
4. **Target: 95%+ match rate** with additional upgrade detections
5. **Document results** for hospital C-suite and compliance review

### Ongoing Accuracy Monitoring

- Every AI suggestion compared to final coder-assigned DRG
- Running accuracy metrics per diagnosis category, per coder, per unit
- Monthly reports to compliance: accuracy rate, revenue impact, flagged cases
- Model version pinned in `ai_skills` table — no silent upgrades

---

## Compliance Position

| Requirement | How We Meet It |
|-------------|---------------|
| CMS accurate coding mandate | AI + human coder review + reference table validation |
| OIG compliance guidance | Advisory-only (never auto-files), audit trail, no incentive to upcode |
| ONC HTI-2 algorithm transparency | AI skill registered with patient-facing description, decision audit log |
| HIPAA | PHI stays server-side, patient IDs only in browser, audit logging |
| False Claims Act protection | System suggests, human decides. Full documentation of AI reasoning. |

**Key compliance principle:** The system identifies what the documentation supports. It never suggests codes that aren't supported by clinical documentation. Every suggestion includes the documentation reference that supports it.

---

## Standalone Product Opportunity

The Medical Coding Server is architecturally independent. It can be:

1. **Bundled with Envision ATLUS** — full platform with bed management, care coordination, etc.
2. **Sold standalone as an API** — hospitals integrate via MCP protocol or REST wrapper into their existing EHR
3. **Offered as a service** — hospital sends encounters, gets back DRG suggestions with audit trail

This addresses a market gap: hospitals that can't afford 3M/Optum but need DRG optimization. No competing product offers AI-powered grouping at this price point.

---

## Technical Architecture (For Engineering Review)

| Component | Location | Status |
|-----------|----------|--------|
| MCP Server | `supabase/functions/mcp-medical-coding-server/` | Built (11 tools) |
| DRG Grouper | `drgGrouperHandlers.ts` | Built (3-pass methodology) |
| Charge Aggregation | `chargeAggregationHandlers.ts` | Built (5 source tables) |
| Revenue Optimizer | `revenueOptimizerHandlers.ts` | Built (AI-powered) |
| Charge Validation | `revenueOptimizerHandlers.ts` | Built (7 rules) |
| Revenue Projection | `toolHandlers.ts` | Built (DRG + per diem formulas) |
| Payer Rules Engine | `toolHandlers.ts` | Built (Medicare + Medicaid) |
| MS-DRG Reference Table | Not yet built | Tracked (P1-1) |
| Fee Schedule Lookup | Not yet wired | Tracked (P2-1) |
| Chain Orchestration | `mcp-chain-orchestrator/` | Built (Chain 6 defined) |
| Browser Client | `mcpMedicalCodingClient.ts` | Built (needs endpoint fix P0-2) |
| Admin UI Panel | Not yet built | Future session |
| Retrospective Validation | Not started | Required before production |

**Remaining work tracked in:** `docs/trackers/mcp-production-readiness-tracker.md`

---

*This document describes product strategy and technical architecture. It does not contain PHI, proprietary hospital data, or information about specific partner institutions.*
