# Envision ATLUS I.H.I.S. — System Readiness Assessment

> **Date:** 2026-02-28
> **Assessed by:** Claude Opus 4.6 (at Maria's request — "don't fluff me")
> **Scope:** Full codebase architecture, AI infrastructure, clinical readiness, deployment gaps

---

## Executive Summary

The Envision ATLUS I.H.I.S. platform is architecturally enterprise-grade. It has the infrastructure of a system built by a funded engineering team — multi-tenant, HIPAA-aware, FHIR-interoperable, with 26 AI skills and 11 MCP servers. It was built by a superintendent and a nurse using AI tools for approximately $645 in compute costs.

**The architecture is real. The gaps are operational, not structural.**

---

## What's Real (Not Fluff)

### Infrastructure Scale

| Metric | Count | Assessment |
|--------|-------|------------|
| Database tables | 248 | Enterprise-scale schema with RLS |
| Edge functions | 137 (all deployed) | Comprehensive serverless backend |
| AI skills | 26 edge functions + 19 service-layer | More AI integration than most funded health-tech startups |
| MCP servers | 11 (96 tools) | Full integration layer |
| Tests | 10,304 across 517 suites | Exceeds most production codebases |
| Lint warnings | 0 (down from 1,671 in Jan 2026) | Clean codebase |
| Type errors | 0 | Strict TypeScript compliance |

### Security Posture

| Control | Status |
|---------|--------|
| Row-Level Security (RLS) | On all tenant-scoped tables |
| PHI access logging | Every PHI read/write audited |
| JWT authentication | Proper verification (not just parsing) |
| CORS/CSP | No wildcards — explicit origins only |
| Rate limiting | All MCP servers + AI service layer |
| Circuit breaker | 5-failure halt on Claude service |
| Budget enforcement | $25/day, $350/month per user |
| Input validation | Declarative framework with healthcare-specific validators (NPI Luhn, CPT, ICD-10) |
| Tenant isolation | `get_current_tenant_id()` in RLS + edge functions |

### Clinical AI Guardrails

| Guardrail | Implementation |
|-----------|---------------|
| Temperature | 0.1 for all clinical calls (near-deterministic) |
| Model pinning | Explicit version strings, never "latest" |
| Anti-hallucination | Compass Riley grounding rules — `[STATED]`/`[INFERRED]`/`[GAP]` tagging |
| Conversation drift | Domain tracking, off-topic detection |
| Evidence grounding | PubMed integration for clinical recommendations |
| Guideline matching | ADA, AHA, GOLD + 9 more condition-specific guidelines |
| Confidence scoring | 0-100 per AI suggestion, logged to `ai_confidence_scores` |
| Patient transparency | Plain-language `patient_description` for every AI skill (HTI-2 ready) |
| Structured output | JSON schema enforcement on clinical AI responses |

### Architecture Strengths

| Strength | Why It Matters |
|----------|---------------|
| **Dual-product architecture** (WellFit + Envision Atlus) | Deploy independently or together — serves community health AND hospital |
| **White-label multi-tenant** | One codebase, many organizations |
| **FHIR R4 + HL7 v2.x + C-CDA** | Interoperability with any EHR |
| **SMART on FHIR** | Third-party app ecosystem ready |
| **Governance system (CLAUDE.md)** | 16 enforced rules, hooks, sub-agent governance — ahead of industry |
| **Cross-AI auditing** | Claude + ChatGPT cross-check each other's output |
| **Canonical patient context spine** | Single source of truth for patient data across both products |

---

## Gaps (Honest Assessment)

### Critical for Hospital Deployment

| # | Gap | Impact | Effort to Close |
|---|-----|--------|-----------------|
| 1 | **No real patient data has flowed through the system** | Untested workflows under real clinical conditions | Requires pilot site |
| 2 | **Clinical AI unvalidated** | CMO will ask for sensitivity/specificity data on predictions | 50+ real encounters minimum |
| 3 | **No ONC Health IT Certification** | Required by law for hospitals under 21st Century Cures Act | Formal process — months |
| 4 | **No SOC2 Type II** | Hospitals and payers require it | External auditor engagement |
| 5 | **Revenue cycle not end-to-end** | Clearinghouse blocked on vendor credentials (Waystar/Change/Availity) | Vendor contract |
| 6 | **No load testing** | Unknown behavior under concurrent clinical use | 1-2 sessions to build |
| 7 | **Single point of failure (Maria)** | No second human who understands the full system | Hire or document for handoff |

### Important but Not Blocking

| # | Gap | Impact | Effort to Close |
|---|-----|--------|-----------------|
| 8 | **Oncology module foundation-only** | 11 sessions remaining for production | Significant build |
| 9 | **Cardiology module 60-65% built** | 12-13 sessions remaining | Significant build |
| 10 | **No native mobile app** | Seniors are mobile-first; web-only limits reach | Major project |
| 11 | **No real user testing with seniors** | Accessibility standards documented but untested with actual 75-year-olds | Usability study |
| 12 | **SKILLS_AND_COMMANDS.md severely outdated** | References Methodist demo (Dec 2025), 625 tests, old directory structure | 1 hour to update |
| 13 | **1 god file remaining** | SOC2ComplianceDashboard at 1,062 lines | 1 session to decompose |

---

## Readiness by Deployment Setting

| Setting | Ready? | Reasoning |
|---------|--------|-----------|
| **Major hospital system (500+ beds)** | Not yet | Needs ONC certification, SOC2 Type II, clinical validation studies, support team, load testing |
| **Small hospital / critical access** | Close — needs pilot | Architecture supports it, AI guardrails are real, but needs validation with real workflows |
| **Doctor's office / small practice** | Yes, with pilot phase | AI documentation (SOAP notes), check-ins, FHIR interop, medication management — genuinely useful today |
| **Rural community health center** | Strong fit | High need, lower regulatory bar, community + clinical together is the unique value proposition |
| **Public health department** | Strong fit | Population health, engagement tracking, SDOH coding, check-in monitoring |
| **VA / veteran-serving org** | Future fit (after Cultural Competency MCP) | Once population-aware AI is built, this becomes differentiated from competitors |
| **Community wellness organization** | Ready now | WellFit product is fully functional for engagement, check-ins, gamification |

---

## What Makes This System Different

Most EMR competitors were built over years by engineering teams. This system was built by domain experts (a superintendent + a nurse) using AI tools. That creates two advantages:

1. **Domain knowledge is baked in, not bolted on.** The SDOH coding, cultural competency vision, patient engagement model, and caregiver workflows came from people who understand healthcare — not engineers guessing at clinical needs.

2. **The governance system is the real IP.** CLAUDE.md, hooks, cross-AI auditing, sub-agent governance — this is a control system for AI-generated code that most organizations haven't figured out yet. The methodology that built this system is as valuable as the system itself.

---

## Recommended Next Steps (Priority Order)

| # | Action | Why | Effort |
|---|--------|-----|--------|
| 1 | **Finish MCP Server Compliance** (Sessions 5-6) | Currently in progress — complete what's started | ~17 hours |
| 2 | **Build Compass Riley V2** (CoT/ToT reasoning) | Differentiates clinical AI from competitors | 3 sessions |
| 3 | **Build Cultural Competency MCP Server** | Unique feature no other EMR has | 3-4 sessions |
| 4 | **Find a pilot site** | Most important gap to close — everything else can iterate | Outreach |
| 5 | **Run 50 encounters through SOAP note generator** | Creates validation data for CMO conversations | Pilot site dependent |
| 6 | **SOC2 readiness assessment** | Framework exists — get an auditor to confirm | External engagement |
| 7 | **Update all skills to current state** | Skills reference outdated data — credibility issue if noticed | 1-2 hours |
| 8 | **Decompose SOC2ComplianceDashboard** | Last god file (1,062 lines) | 1 session |
| 9 | **Build load testing** | Prove system handles concurrent clinical use | 1-2 sessions |
| 10 | **Complete one specialty module** (Cardiology or Oncology) | Shows depth to hospital evaluators | 11-13 sessions |

---

## The Bottom Line

The code is real. The architecture is real. The AI guardrails are real. The gaps are not surprises — they're the natural next phase: **validation, certification, and operational maturity.**

You built the right thing. Now you need to prove it works in the real world.

---

*This assessment was requested by Maria ("don't fluff me") and reflects an honest evaluation of the codebase based on direct code review, not marketing claims.*
