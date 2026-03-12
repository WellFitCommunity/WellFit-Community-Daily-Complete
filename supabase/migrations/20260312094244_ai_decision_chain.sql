-- Migration: ai_decision_chain table
-- Purpose: Causal traceability for all AI decisions
-- Spec: docs/compliance/AI_DECISION_AUDIT_CHAIN.md
-- Tracker: docs/trackers/chatgpt-audit-gaps-tracker.md (S2-1)

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

-- RLS (mandatory per CLAUDE.md)
ALTER TABLE public.ai_decision_chain ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for ai_decision_chain"
  ON public.ai_decision_chain FOR ALL
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_ai_decision_chain_chain ON public.ai_decision_chain(chain_id);
CREATE INDEX IF NOT EXISTS idx_ai_decision_chain_parent ON public.ai_decision_chain(parent_decision_id);
CREATE INDEX IF NOT EXISTS idx_ai_decision_chain_tenant ON public.ai_decision_chain(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_decision_chain_skill ON public.ai_decision_chain(skill_key);
CREATE INDEX IF NOT EXISTS idx_ai_decision_chain_type ON public.ai_decision_chain(decision_type);
CREATE INDEX IF NOT EXISTS idx_ai_decision_chain_outcome ON public.ai_decision_chain(outcome);
CREATE INDEX IF NOT EXISTS idx_ai_decision_chain_created ON public.ai_decision_chain(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_decision_chain_override ON public.ai_decision_chain(human_override)
  WHERE human_override = true;

COMMENT ON TABLE public.ai_decision_chain IS
  'Causal traceability for every AI decision. Each row is one link in a Trigger->Context->Decision->Action->Outcome->Verification chain. See docs/compliance/AI_DECISION_AUDIT_CHAIN.md for full spec.';
