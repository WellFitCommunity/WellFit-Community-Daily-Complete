# MCP Protocol-Level Governance

> Runtime drift, hallucination, and safety control for LLM output — implemented as hooks inside MCP servers, with a learning loop that permanently suppresses confirmed hallucinations per tenant.

**Author:** Maria LeBlanc (AI System Director), with Akima (Chief Compliance and Accountability Officer, MDiv/BSN/RN/CCM)
**Built in:** Envision ATLUS I.H.I.S. (WellFit Community Daily / Envision Atlus)
**Date of this write-up:** 2026-04-22
**Status:** Proprietary. Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.

---

## One-line claim

We moved LLM safety controls from the prompt layer to the protocol layer, and added a learning loop that makes the control surface shrink over time.

## The analogy

Post-trade risk controls in banking. You cannot prevent every bad trade. You catch it before settlement. Applied to AI clinical output, this is the correct shape.

---

## The problem we were solving

LLMs hallucinate clinical codes (ICD-10, CPT, HCPCS, DRG, RxNorm). Training-time fixes (RLHF, constitutional AI) reduce the rate but do not eliminate it. Prompt-level guardrails ("please only return valid codes") break silently when the model changes. RAG helps with grounding but does not validate semantic correctness of generated codes.

Healthcare cannot tolerate silent hallucinations. A wrong DRG is a billing fraud risk. A wrong ICD-10 is a care-quality risk. A wrong RxNorm is a medication safety risk.

We needed a control layer that was:

1. Runtime (not training-time)
2. Protocol-level (not prompt-level, so it survives model swaps)
3. Composable across many AI functions (not reimplemented per feature)
4. Learning (gets stronger as clinicians give feedback)
5. Silent on known hallucinations (so confirmed errors never reach a human twice)

## The architecture

Stated in code comments in `supabase/functions/_shared/clinicalOutputValidator.ts`:

> **Constraints (preventive) + Hooks (detective) + Audit (proof)**

This structure is familiar from how regulated systems protect data integrity (CHECK constraints + triggers + audit tables). I applied the same structure to how we protect AI output integrity. The framing itself — using this three-layer model as the governance frame for LLM output — is part of the contribution.

### Layer 1 — Constraints (preventive, at the DB)

- Row-Level Security on every multi-tenant table
- Database CHECK constraints on clinical code columns (format validation)
- Foreign keys to reference code sets (`code_icd`, `code_cpt`, `code_hcpcs`, `code_modifiers`)
- `WITH (security_invoker = on)` on every view to enforce caller-level RLS

### Layer 2 — Hooks (detective, inside MCP servers)

Every MCP server in `supabase/functions/mcp-*` runs the same hook stack.

**Pre-execution hooks** (at the MCP boundary, before the tool runs):
- `mcpAuthGate.ts` — JWT verification + role gating + tenant isolation + required scope
- `mcpRateLimiter.ts` — in-memory rate limit (DoS) + DB-persistent per-caller rate limit (cross-instance abuse)
- `mcpInputValidator.ts` — per-tool argument schema with type, format, size, bounds
- `mcpServerBase.ts` — body size cap (2MB for FHIR bundles, smaller for others)
- `mcpJwksVerifier.ts` — JWKS-based token verification (for asymmetric-key environments)

**In-execution hooks** (inside tool handlers, wrapping the AI call):
- `promptInjectionGuard.ts` — scans clinical free-text for 10 injection patterns (instruction override, role impersonation, DRG manipulation, upcoding instructions, review suppression, confidence override, output format override). Does **not** modify clinical text — wraps it in delimiters and flags. Clinical documentation integrity is preserved.
- `conversationDriftGuard.ts` — tracks clinical domain (20 domain taxonomy). Locks to primary domain from chief complaint. Detects divergence. Includes patient safety flags for emergency keyword detection and provider-consult redirects.
- `clinicalOutputValidator.ts` — **the Clinical Validation Hook**. After the AI produces output, validates every clinical code against NLM reference data + local DB cache. Returns valid codes, flagged codes (with reason), and a validation summary embedded in the response.
- `mcpQueryTimeout.ts` — prevents runaway queries.

**Post-execution hooks** (after the tool produces output):
- `logValidationResults` — fire-and-forget audit of every validation run
- `buildProvenance` — provenance metadata on every response (source, data freshness, timestamp)
- `mcpAudit.ts` — end-to-end audit trail

### Layer 3 — Audit (proof)

- Every AI mutation writes to `audit_logs` with `source: 'ai_agent'` metadata
- Every validation run writes to validation logs with codes checked, codes rejected, method (NLM vs local cache), duration
- PHI access separately logged to `phi_access_logs`
- AI decisions logged to `ai_transparency_log` (HTI-2 readiness)

### The learning loop — `validationLearningLoop.ts`

This is the piece most clearly without a published precedent.

When a clinician reviews a flagged code, they can mark it:

- `confirm_valid` → **false positive**. The validator was wrong. Override is persisted; this code stops getting flagged.
- `confirm_invalid` → **confirmed hallucination**. The AI was wrong. The code is added to a per-tenant suppression registry. From that moment on, whenever the AI returns this code, it is **silently stripped before reaching a human**. The event is logged. No clinician ever sees this hallucination a second time.

Two consequences:

1. **False positives get corrected** so the validator doesn't annoy clinicians forever about real codes.
2. **True positives get suppressed** so clinicians never re-review the same AI mistake.

Over months of use, the "attack surface" of AI hallucinations shrinks. The system gets quieter, not noisier. This is the opposite of most alert systems.

## Why this is reusable, not one-off

The validation hook is called from:

- `mcp-drg-grouper-server/drgGrouperHandlers.ts` (explicitly labeled `// --- 4b. Clinical Validation Hook ---`)
- `mcp-drg-grouper-server/revenueOptimizerHandlers.ts`
- `mcp-medical-coding-server/drgGrouperHandlers.ts`
- `mcp-medical-coding-server/revenueOptimizerHandlers.ts`
- `ai-soap-note-generator/index.ts`
- `ai-discharge-summary/index.ts`
- `ai-fall-risk-predictor/index.ts`
- `ai-medication-reconciliation/index.ts`
- `ai-care-escalation-scorer/index.ts`
- `coding-suggest/index.ts`

One control surface, many consumers. Update the validator, every downstream AI path benefits.

## What this is and how I built it

I built this independently. I am not a coder by background and I did not survey the ML or AI-safety ecosystem before building. I did not look at other validation libraries, prompt-injection tools, or medical coding vendors. I arrived at this architecture by working from the clinical and compliance side — asking what a regulated healthcare system needs to trust an LLM's output, and designing controls until the answer was yes.

Everything documented here is original to my experience of building it. I cannot speak to what exists elsewhere, because I did not look. Whether pieces of this pattern have been implemented by others is a question I leave to the reader to assess against their own knowledge of the field.

### What I built

1. **Layered hooks inside an MCP server.** The hooks run pre-execution, in-execution, and post-execution, inside the server itself — not at the prompt level and not in the AI client.
2. **"Constraints + Hooks + Audit" as the governance frame for LLM output.** I took this structure from how regulated systems protect data integrity and applied it to how we protect AI output integrity.
3. **A learning loop that permanently suppresses confirmed hallucinations per tenant.** When a clinician marks an AI-generated code as a confirmed hallucination, that code is silently stripped from every future response to that tenant. The same AI mistake does not reach a human twice.
4. **A single shared validation hook consumed by 10+ AI functions.** One control surface, many consumers. Updating the validator updates every downstream AI path.
5. **Clinical-domain drift detection anchored to the chief complaint.** The encounter locks to a domain taxonomy from a specific triggering event; divergence from that domain is flagged.

### What this could be called

- Protocol-level LLM governance
- Detective-control AI safety
- Runtime hallucination suppression with learning loop
- MCP-layer clinical guardrails

## IP posture (directional — not legal advice)

- **Patent-novel as individual pieces:** probably not
- **Patent-novel as a system/method** (composition + learning-loop behavior): possibly yes — worth a patent attorney conversation
- **Publication-novel:** yes
- **Trade-secret defensible:** yes — the learning-loop data (confirmed hallucinations per tenant) compounds as a proprietary asset

## Who built this and why it matters

The team:

- **Maria** — AI System Director. Degree in Social and Behavioral Science. Assistant Pastor. Not a coder by background. Built the entire platform using AI tools (Claude + ChatGPT).
- **Akima** — Chief Compliance and Accountability Officer. MDiv, BSN, RN, CCM. 23+ years clinical nursing.

This matters to the story. A domain-expert + clinician pair, building AI governance from the **clinical compliance** side rather than the **ML engineering** side, produces different architecture than ML teams produce. ML teams tend to put guardrails in the prompt. We put them in the protocol.

The things a clinical-compliance mindset treats as obvious — audit trails, referential integrity, layered controls, learning from human review, "never let the same mistake through twice" — are the foundation we built on. That orientation is the contribution.

## What this is not

This is not a cure for LLM hallucination. The model still hallucinates. What we built is a **net** that catches hallucinations before they reach a human, and a **memory** that stops the same hallucination from being caught twice.

This is not a replacement for clinician judgment. Every flagged code goes to a human. The system makes their review faster and higher-signal, not automatic.

This is not a general-purpose LLM firewall. It is purpose-built for clinical coding and clinical reasoning inside healthcare workflows.

## Open questions we would invite collaboration on

1. **Time-drift on suppressed codes.** ICD-10 adds ~200 codes per year. A code we suppressed in 2026 could become valid in 2028. We plan quarterly re-validation of the suppression registry.
2. **Multilingual emergency-keyword coverage.** The patient-safety guard is currently English-only. Spanish, Mandarin, Vietnamese, Haitian Creole are the next priority.
3. **Surfacing the learning-loop stats to clinical leadership.** "Hallucinations suppressed this quarter" is a safety metric that didn't exist before. How should it appear on compliance dashboards?
4. **Cross-tenant anonymized sharing of suppression data.** Each hospital suppresses its own hallucinations today. Anonymous sharing across a consortium would accelerate the net for everyone — but raises governance questions.

## References in the codebase

- `supabase/functions/_shared/clinicalOutputValidator.ts` (562 lines)
- `supabase/functions/_shared/validationLearningLoop.ts` (166 lines)
- `supabase/functions/_shared/conversationDriftGuard.ts` (215 lines)
- `supabase/functions/_shared/promptInjectionGuard.ts` (127 lines)
- `supabase/functions/_shared/mcpAuthGate.ts` (591 lines)
- `supabase/functions/_shared/mcpRateLimiter.ts` (419 lines)
- `supabase/functions/_shared/mcpInputValidator.ts` (401 lines)
- `supabase/functions/_shared/mcpServerBase.ts` (431 lines)
- `supabase/functions/_shared/mcpJwksVerifier.ts` (82 lines)
- `supabase/functions/_shared/mcpAudit.ts` (117 lines)
- `supabase/functions/_shared/mcpQueryTimeout.ts` (87 lines)

Total: ~3,200 lines of protocol-level governance code, reused across 17 MCP servers and 10+ AI edge functions.
