-- ============================================================================
-- P5-3: AI Escalation Override Audit Table
-- Tracker: docs/trackers/claude-in-claude-triage-tracker.md
-- Copyright © 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.
-- ============================================================================
-- Purpose: Records every clinician override or appeal of an AI escalation
-- decision, with structured justification and Claude's analysis.
-- Supports: HTI-2 transparency, model improvement, pattern analysis.

CREATE TABLE IF NOT EXISTS public.ai_escalation_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES auth.users(id),
  clinician_id UUID NOT NULL REFERENCES auth.users(id),

  -- What was overridden
  skill_key TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('override', 'appeal')),
  original_level TEXT NOT NULL CHECK (original_level IN ('none', 'monitor', 'notify', 'escalate', 'emergency')),
  override_level TEXT NOT NULL CHECK (override_level IN ('none', 'monitor', 'notify', 'escalate', 'emergency')),

  -- Clinician input
  clinician_reason TEXT NOT NULL,
  clinical_evidence JSONB DEFAULT '[]'::jsonb,

  -- Claude analysis
  justification JSONB,
  is_justified BOOLEAN,
  risk_assessment TEXT CHECK (risk_assessment IN ('low', 'moderate', 'high')),
  requires_supervisor_review BOOLEAN DEFAULT false,

  -- Appeal-specific fields
  appeal_supported BOOLEAN,
  recommended_level TEXT CHECK (recommended_level IN ('none', 'monitor', 'notify', 'escalate', 'emergency')),
  ai_blind_spots JSONB DEFAULT '[]'::jsonb,
  systematic_issue BOOLEAN DEFAULT false,

  -- Supervisor review
  supervisor_id UUID REFERENCES auth.users(id),
  supervisor_reviewed_at TIMESTAMPTZ,
  supervisor_decision TEXT CHECK (supervisor_decision IN ('approved', 'rejected', 'modified')),
  supervisor_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS (mandatory)
ALTER TABLE public.ai_escalation_overrides ENABLE ROW LEVEL SECURITY;

-- Tenant isolation + clinician/admin access
CREATE POLICY "Tenant isolation for overrides"
  ON public.ai_escalation_overrides
  FOR ALL
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_overrides_tenant
  ON public.ai_escalation_overrides(tenant_id);

CREATE INDEX IF NOT EXISTS idx_overrides_patient
  ON public.ai_escalation_overrides(patient_id);

CREATE INDEX IF NOT EXISTS idx_overrides_clinician
  ON public.ai_escalation_overrides(clinician_id);

CREATE INDEX IF NOT EXISTS idx_overrides_skill
  ON public.ai_escalation_overrides(skill_key);

CREATE INDEX IF NOT EXISTS idx_overrides_action_type
  ON public.ai_escalation_overrides(action_type);

CREATE INDEX IF NOT EXISTS idx_overrides_created
  ON public.ai_escalation_overrides(created_at DESC);

-- Comment for documentation
COMMENT ON TABLE public.ai_escalation_overrides IS
  'Audit trail for clinician overrides and appeals of AI escalation decisions. '
  'Records justification, Claude analysis, and supervisor review. '
  'Supports HTI-2 transparency and AI model improvement.';
