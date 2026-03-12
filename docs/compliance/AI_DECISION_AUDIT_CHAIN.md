# AI Decision Audit Chain -- Causal Traceability Specification

> **Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.**

**Status:** Specification (not yet implemented)
**Last Updated:** 2026-03-12
**Owner:** Shared Spine (S4 Audit & Compliance)

---

## 1. The Decision Chain Model

Every AI action in WellFit/Envision Atlus must be traceable through a six-link chain:

```
Trigger --> Context --> Decision --> Action --> Outcome --> Verification
```

Each link is a row in `ai_decision_chain`. A `chain_id` groups the full sequence. A `parent_decision_id` creates a tree when one decision spawns sub-decisions.

### Example Chains

**Guardian missed-checkin escalation:**

| Link | Record |
|------|--------|
| Trigger | Guardian cron detects 3 consecutive missed check-ins for patient-abc |
| Context | `patientContextService.getPatientContext()` returns high fall-risk, lives alone, caregiver on file |
| Decision | `ai-missed-checkin-escalation` scores risk 0.91, recommends caregiver notification |
| Action | Edge function `notify-family-missed-check-in` sends SMS to caregiver |
| Outcome | Caregiver acknowledges via SMS reply |
| Verification | Care team reviews alert, marks resolved in SOC dashboard |

**Clinical readmission prediction:**

| Link | Record |
|------|--------|
| Trigger | Discharge event fires for encounter-xyz |
| Context | Patient vitals, 2 prior admissions in 90 days, HbA1c 9.2 |
| Decision | `ai-readmission-predictor` returns risk score 0.82 |
| Action | `ai-care-plan-generator` produces 30-day follow-up plan |
| Outcome | Clinician reviews plan in PatientChartNavigator |
| Verification | Clinician modifies plan (human_override=true), approves modified version |

**Guardian code repair:**

| Link | Record |
|------|--------|
| Trigger | RuntimeHealer detects TypeError in bed-management module |
| Context | Error signature matched in ErrorSignatureLibrary, authority_tier=2 |
| Decision | AgentBrain proposes null-check patch, sandbox test passes |
| Action | Patch applied via ExecutionSandbox |
| Outcome | Tests pass, no regression |
| Verification | Review ticket created in guardian_review_tickets, admin approves |

---

## 2. Required Audit Fields

### `ai_decision_chain` Table

| Field | Type | Description |
|-------|------|-------------|
| `id` | `UUID` | Primary key |
| `chain_id` | `UUID` | Groups related decisions in a sequence |
| `parent_decision_id` | `UUID` | FK to self -- the decision that triggered this one |
| `tenant_id` | `UUID` | Tenant isolation (RLS) |
| `trigger_type` | `text` | One of: `guardian_alert`, `user_request`, `scheduled`, `ai_initiated`, `system_event` |
| `trigger_source` | `text` | Specific trigger (alert ID, cron job name, user action, edge function name) |
| `context_snapshot` | `jsonb` | Anonymized data the AI had at decision time (patient_id only, no PHI) |
| `model_id` | `text` | Exact model version (e.g., `claude-sonnet-4-5-20250929`) |
| `skill_key` | `text` | FK to `ai_skills.skill_key` |
| `decision_type` | `text` | One of: `clinical`, `operational`, `code_repair`, `escalation`, `documentation`, `billing` |
| `decision_summary` | `text` | Plain-language description of what the AI decided |
| `confidence_score` | `numeric(5,2)` | 0.00--1.00 confidence (normalized, unlike `ai_confidence_scores` which uses 0--100) |
| `authority_tier` | `smallint` | 1--4 per Guardian AI Repair Authority rules |
| `action_taken` | `text` | What actually happened (edge function called, notification sent, patch applied) |
| `outcome` | `text` | One of: `success`, `failure`, `pending_review`, `overridden`, `expired` |
| `human_override` | `boolean` | Was the AI decision overridden by a human? |
| `override_reason` | `text` | Why it was overridden (null if not applicable) |
| `reviewed_by` | `UUID` | FK to `auth.users` -- who reviewed (null if not yet reviewed) |
| `reviewed_at` | `timestamptz` | When reviewed |
| `created_at` | `timestamptz` | When the decision was made |

---

## 3. Migration SQL

```sql
-- Migration: ai_decision_chain table
-- Purpose: Causal traceability for all AI decisions

CREATE TABLE IF NOT EXISTS public.ai_decision_chain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id UUID NOT NULL DEFAULT gen_random_uuid(),
  parent_decision_id UUID REFERENCES public.ai_decision_chain(id),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),

  -- Trigger
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'guardian_alert', 'user_request', 'scheduled', 'ai_initiated', 'system_event'
  )),
  trigger_source TEXT NOT NULL,

  -- Context (anonymized -- patient_id only, never PHI)
  context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- AI Model
  model_id TEXT NOT NULL,
  skill_key TEXT,

  -- Decision
  decision_type TEXT NOT NULL CHECK (decision_type IN (
    'clinical', 'operational', 'code_repair', 'escalation', 'documentation', 'billing'
  )),
  decision_summary TEXT NOT NULL,
  confidence_score NUMERIC(5,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  authority_tier SMALLINT CHECK (authority_tier BETWEEN 1 AND 4),

  -- Action & Outcome
  action_taken TEXT,
  outcome TEXT NOT NULL DEFAULT 'pending_review' CHECK (outcome IN (
    'success', 'failure', 'pending_review', 'overridden', 'expired'
  )),

  -- Human Review
  human_override BOOLEAN DEFAULT false,
  override_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.ai_decision_chain ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for ai_decision_chain"
  ON public.ai_decision_chain FOR ALL
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

-- Indexes
CREATE INDEX idx_ai_decision_chain_chain ON public.ai_decision_chain(chain_id);
CREATE INDEX idx_ai_decision_chain_parent ON public.ai_decision_chain(parent_decision_id);
CREATE INDEX idx_ai_decision_chain_tenant ON public.ai_decision_chain(tenant_id);
CREATE INDEX idx_ai_decision_chain_skill ON public.ai_decision_chain(skill_key);
CREATE INDEX idx_ai_decision_chain_type ON public.ai_decision_chain(decision_type);
CREATE INDEX idx_ai_decision_chain_outcome ON public.ai_decision_chain(outcome);
CREATE INDEX idx_ai_decision_chain_created ON public.ai_decision_chain(created_at DESC);
CREATE INDEX idx_ai_decision_chain_override ON public.ai_decision_chain(human_override)
  WHERE human_override = true;

COMMENT ON TABLE public.ai_decision_chain IS
  'Causal traceability for every AI decision. Each row is one link in a Trigger->Outcome chain.';
```

---

## 4. Chain Linking Rules

1. **First decision in a chain:** `chain_id` is auto-generated, `parent_decision_id` is null.
2. **Subsequent decisions:** Inherit `chain_id` from parent, set `parent_decision_id` to the row that triggered them.
3. **Fan-out:** One decision can spawn multiple children (e.g., a guardian alert triggers both a caregiver notification and a care plan generation). Each child shares the same `chain_id`.
4. **Chain closure:** A chain is considered closed when all leaf decisions have `outcome != 'pending_review'`.

---

## 5. Integration with Existing Tables

This table **extends** the current audit infrastructure without replacing it.

| Existing Table | Relationship to `ai_decision_chain` |
|----------------|--------------------------------------|
| `ai_confidence_scores` | Confidence scores logged per-suggestion. The `ai_decision_chain.confidence_score` is the normalized (0--1) equivalent. Link via `context_snapshot.confidence_log_id`. |
| `ai_transparency_log` | Tracks when users *view* transparency info. When a user views a decision chain, log to `ai_transparency_log` with `event_type = 'viewed_decision_chain'`. |
| `ai_model_registry` | `ai_decision_chain.model_id` should match `ai_model_registry.provider_model_id`. Queries can join for full model card context. |
| `audit_logs` | General audit trail. Guardian AuditLogger already writes here with `event_category = 'GUARDIAN'`. Decision chain rows should reference `audit_logs.resource_id` in `context_snapshot.audit_log_id` when applicable. |
| `guardian_review_tickets` | When `outcome = 'pending_review'`, a corresponding `guardian_review_tickets` row exists. Link via `context_snapshot.review_ticket_id`. |
| `ai_audit_reports` | Periodic compliance reports. Report generation queries `ai_decision_chain` for the reporting period. |
| `guardian_telemetry` | Real-time telemetry. Each decision chain entry may have a corresponding telemetry event. |

**Write pattern:** Services that currently write to `ai_confidence_scores` or `audit_logs` should additionally insert into `ai_decision_chain`. The chain table is the *causal* layer; existing tables remain the *operational* layer.

---

## 6. Auditor Queries

### All AI decisions affecting patient care in last 30 days

```sql
SELECT dc.id, dc.chain_id, dc.decision_type, dc.decision_summary,
       dc.confidence_score, dc.outcome, dc.human_override,
       dc.model_id, dc.skill_key, dc.created_at
FROM ai_decision_chain dc
WHERE dc.decision_type = 'clinical'
  AND dc.created_at >= now() - INTERVAL '30 days'
  AND dc.tenant_id = get_current_tenant_id()
ORDER BY dc.created_at DESC;
```

### Full chain from alert to resolution for a specific incident

```sql
WITH RECURSIVE chain AS (
  SELECT * FROM ai_decision_chain
  WHERE id = '<root_decision_id>'
  UNION ALL
  SELECT dc.* FROM ai_decision_chain dc
  JOIN chain c ON dc.parent_decision_id = c.id
)
SELECT id, parent_decision_id, trigger_type, decision_type,
       decision_summary, confidence_score, action_taken,
       outcome, human_override, override_reason, created_at
FROM chain
ORDER BY created_at;
```

### All AI decisions overridden by humans

```sql
SELECT dc.id, dc.decision_summary, dc.confidence_score,
       dc.override_reason, dc.reviewed_by, dc.reviewed_at,
       p.first_name || ' ' || p.last_name AS reviewer_name
FROM ai_decision_chain dc
LEFT JOIN profiles p ON p.user_id = dc.reviewed_by
WHERE dc.human_override = true
  AND dc.tenant_id = get_current_tenant_id()
ORDER BY dc.reviewed_at DESC;
```

### Confidence score distribution for clinical AI

```sql
SELECT skill_key,
       COUNT(*) AS total_decisions,
       AVG(confidence_score) AS avg_confidence,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY confidence_score) AS median_confidence,
       COUNT(*) FILTER (WHERE confidence_score >= 0.9) AS high_confidence_count,
       COUNT(*) FILTER (WHERE confidence_score < 0.5) AS low_confidence_count,
       COUNT(*) FILTER (WHERE human_override = true) AS override_count
FROM ai_decision_chain
WHERE decision_type = 'clinical'
  AND created_at >= now() - INTERVAL '90 days'
  AND tenant_id = get_current_tenant_id()
GROUP BY skill_key
ORDER BY total_decisions DESC;
```

### Open chains (pending review)

```sql
SELECT chain_id,
       COUNT(*) AS decisions_in_chain,
       MIN(created_at) AS chain_started,
       MAX(created_at) AS last_activity,
       ARRAY_AGG(DISTINCT decision_type) AS decision_types,
       BOOL_OR(outcome = 'pending_review') AS has_pending
FROM ai_decision_chain
WHERE tenant_id = get_current_tenant_id()
GROUP BY chain_id
HAVING BOOL_OR(outcome = 'pending_review')
ORDER BY last_activity DESC;
```

---

## 7. HTI-2 Transparency Support

### Patient-Facing Explanation Generation

Each `ai_decision_chain` row with `decision_type = 'clinical'` must be explainable. The `decision_summary` field stores the plain-language explanation. For patient-facing display (My Health Hub), join with `ai_model_registry` to get `patient_description` from the skill and `known_limitations` from the model card:

```sql
SELECT dc.decision_summary,
       s.patient_description AS skill_explanation,
       r.known_limitations,
       r.risk_level AS model_risk_level
FROM ai_decision_chain dc
JOIN ai_skills s ON s.skill_key = dc.skill_key
JOIN ai_model_registry r ON r.model_key = dc.skill_key
WHERE dc.id = '<decision_id>';
```

### Algorithm Transparency Reporting

HTI-2 requires organizations to make available the "source attributes" used by predictive DSIs. The `context_snapshot` field captures which data elements the AI consumed (by reference, not value -- no PHI). Auditors can verify:

1. **What data was used** -- `context_snapshot` keys list the data categories
2. **What model made the decision** -- `model_id` + `ai_model_registry` join
3. **What the output was** -- `decision_summary` + `action_taken`
4. **Whether a human reviewed it** -- `reviewed_by`, `reviewed_at`, `human_override`

### Bias Monitoring

Override rate by decision type reveals potential bias:

```sql
SELECT decision_type, skill_key,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE human_override) AS overridden,
       ROUND(COUNT(*) FILTER (WHERE human_override)::numeric / COUNT(*), 3) AS override_rate
FROM ai_decision_chain
WHERE created_at >= now() - INTERVAL '90 days'
  AND tenant_id = get_current_tenant_id()
GROUP BY decision_type, skill_key
HAVING COUNT(*) >= 10
ORDER BY override_rate DESC;
```

A consistently high override rate for a specific skill signals that the model may be systematically wrong for the tenant's patient population -- triggering a model card review per the `ai_model_registry` maintenance cycle.

---

## 8. Implementation Notes

**Logging entry point:** Services that call Claude edge functions should insert into `ai_decision_chain` immediately after receiving the AI response. The `guardianFlowEngine`, `careEscalationScorerService`, `readmissionRiskPredictionService`, and all `ai-*` edge functions are primary integration targets.

**PHI rule:** `context_snapshot` must contain only identifiers (`patient_id`, `encounter_id`, `alert_id`) and category labels (`data_sources: ['vitals', 'medications']`). Never store names, DOBs, SSNs, or clinical values in this field.

**Retention:** Follow `data_retention_policies` table. AI decision chains for clinical decisions must be retained for minimum 6 years (HIPAA) or 10 years (state law, whichever is longer).

**Performance:** The `chain_id` and `created_at DESC` indexes support the two most common query patterns (chain traversal and recent-decisions listing). The partial index on `human_override = true` avoids scanning the full table for override analysis.
