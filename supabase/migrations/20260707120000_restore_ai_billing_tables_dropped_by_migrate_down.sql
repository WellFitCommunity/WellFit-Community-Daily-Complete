-- ============================================================================
-- Restore AI billing tables destroyed by a dbmate-style migrate:down block
-- ============================================================================
-- Root cause: 20251115120000_ai_automation_skills.sql is written in dbmate
-- format with a `-- migrate:down` section. `supabase db push` does NOT honor
-- that directive; it executes the whole file top-to-bottom, so the push
-- created these four objects and then immediately DROP'd them (lines 422-438
-- of that file). The version was recorded as applied, but the objects never
-- survived. Two of the four tables (readmission_risk_predictions,
-- ai_skill_config) were later recreated by other migrations; these were not:
--
--   - public.billing_code_cache               (table)
--   - public.encounter_billing_suggestions    (table)
--   - public.increment_billing_cache_hit(uuid)(function)
--   - public.billing_suggestion_analytics     (view)
--   - public.readmission_prediction_analytics (view)
--
-- This forward-only migration restores them. It folds in the two later,
-- separately-recorded changes that also silently no-op'd against the missing
-- table:
--   - 20251205000000_fix_encounter_billing_fk.sql
--       encounter_id -> nullable, FK to encounters(id) ON DELETE SET NULL
--   - 20251207120000_add_ai_tracking_columns.sql
--       + ai_prediction_tracking_id uuid REFERENCES ai_predictions(id)
--
-- NO `migrate:down` block is included here — that is exactly what caused the
-- incident. Objects use IF NOT EXISTS / CREATE OR REPLACE and are idempotent.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Billing code cache
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_code_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  diagnosis_codes text[] NOT NULL,
  condition_keywords text[] NOT NULL,
  encounter_type text,

  suggested_cpt_codes jsonb NOT NULL DEFAULT '[]',
  suggested_hcpcs_codes jsonb NOT NULL DEFAULT '[]',
  suggested_icd10_codes jsonb NOT NULL DEFAULT '[]',

  model_used text NOT NULL,
  cache_hit_count integer DEFAULT 0,
  last_accessed_at timestamptz DEFAULT now(),

  validated boolean DEFAULT false,
  validated_by uuid REFERENCES auth.users(id),
  validated_at timestamptz,
  accuracy_score numeric(3,2),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(tenant_id, diagnosis_codes, encounter_type)
);

CREATE INDEX IF NOT EXISTS idx_billing_code_cache_tenant ON public.billing_code_cache(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_code_cache_diagnosis ON public.billing_code_cache USING gin(diagnosis_codes);
CREATE INDEX IF NOT EXISTS idx_billing_code_cache_keywords ON public.billing_code_cache USING gin(condition_keywords);
CREATE INDEX IF NOT EXISTS idx_billing_code_cache_accessed ON public.billing_code_cache(last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_code_cache_validated ON public.billing_code_cache(validated) WHERE validated = true;

DROP TRIGGER IF EXISTS trg_billing_code_cache_uat ON public.billing_code_cache;
CREATE TRIGGER trg_billing_code_cache_uat
BEFORE UPDATE ON public.billing_code_cache
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.billing_code_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "billing_code_cache_tenant_isolation" ON public.billing_code_cache;
CREATE POLICY "billing_code_cache_tenant_isolation" ON public.billing_code_cache
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

COMMENT ON TABLE public.billing_code_cache IS 'Cached AI-generated billing code suggestions to reduce API costs by 75%';

-- ---------------------------------------------------------------------------
-- Encounter billing suggestions (with later fixes folded in)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.encounter_billing_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Nullable + FK to encounters(id) per 20251205000000_fix_encounter_billing_fk.sql
  encounter_id uuid REFERENCES public.encounters(id) ON DELETE SET NULL,
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  encounter_start timestamptz NOT NULL,
  encounter_end timestamptz,
  encounter_duration_minutes integer,
  encounter_type text NOT NULL,
  chief_complaint text,

  suggested_codes jsonb NOT NULL DEFAULT '{}',

  overall_confidence numeric(3,2),
  requires_review boolean DEFAULT false,
  review_reason text,

  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'modified', 'rejected')),
  provider_id uuid REFERENCES auth.users(id),
  provider_accepted_at timestamptz,
  provider_modifications jsonb,
  final_codes_used jsonb,

  ai_model_used text,
  ai_cost numeric(10,4),
  from_cache boolean DEFAULT false,

  -- Added by 20251207120000_add_ai_tracking_columns.sql
  ai_prediction_tracking_id uuid REFERENCES public.ai_predictions(id),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_encounter_billing_tenant ON public.encounter_billing_suggestions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_encounter_billing_encounter ON public.encounter_billing_suggestions(encounter_id);
CREATE INDEX IF NOT EXISTS idx_encounter_billing_patient ON public.encounter_billing_suggestions(patient_id);
CREATE INDEX IF NOT EXISTS idx_encounter_billing_provider ON public.encounter_billing_suggestions(provider_id);
CREATE INDEX IF NOT EXISTS idx_encounter_billing_status ON public.encounter_billing_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_encounter_billing_review ON public.encounter_billing_suggestions(requires_review) WHERE requires_review = true;
CREATE INDEX IF NOT EXISTS idx_encounter_billing_ai_tracking ON public.encounter_billing_suggestions(ai_prediction_tracking_id);

DROP TRIGGER IF EXISTS trg_encounter_billing_uat ON public.encounter_billing_suggestions;
CREATE TRIGGER trg_encounter_billing_uat
BEFORE UPDATE ON public.encounter_billing_suggestions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.encounter_billing_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "encounter_billing_tenant_isolation" ON public.encounter_billing_suggestions;
CREATE POLICY "encounter_billing_tenant_isolation" ON public.encounter_billing_suggestions
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

COMMENT ON TABLE public.encounter_billing_suggestions IS 'Real-time AI billing code suggestions during encounters';
COMMENT ON COLUMN public.encounter_billing_suggestions.encounter_id IS 'References encounters(id) - nullable FK, ON DELETE SET NULL (restored from 20251205000000)';
COMMENT ON COLUMN public.encounter_billing_suggestions.ai_prediction_tracking_id IS 'Links to ai_predictions for accuracy tracking';

-- ---------------------------------------------------------------------------
-- Helper function: increment billing cache hit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_billing_cache_hit(p_cache_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.billing_code_cache
  SET
    cache_hit_count = cache_hit_count + 1,
    last_accessed_at = now()
  WHERE id = p_cache_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Analytics views (security_invoker = on per .claude/rules/supabase.md §3)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.billing_suggestion_analytics
WITH (security_invoker = on) AS
SELECT
  tenant_id,
  DATE(created_at) as suggestion_date,
  COUNT(*) as total_suggestions,
  COUNT(*) FILTER (WHERE status = 'accepted') as accepted_count,
  COUNT(*) FILTER (WHERE status = 'modified') as modified_count,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
  COUNT(*) FILTER (WHERE from_cache = true) as cache_hit_count,
  AVG(overall_confidence) as avg_confidence,
  SUM(ai_cost) as total_ai_cost,
  SUM(CASE WHEN from_cache THEN 0 ELSE ai_cost END) as actual_ai_cost
FROM public.encounter_billing_suggestions
GROUP BY tenant_id, DATE(created_at);

COMMENT ON VIEW public.billing_suggestion_analytics IS 'Daily analytics for billing suggestion performance';

CREATE OR REPLACE VIEW public.readmission_prediction_analytics
WITH (security_invoker = on) AS
SELECT
  tenant_id,
  DATE(discharge_date) as discharge_date,
  COUNT(*) as total_predictions,
  COUNT(*) FILTER (WHERE risk_category = 'critical') as critical_risk_count,
  COUNT(*) FILTER (WHERE risk_category = 'high') as high_risk_count,
  -- Live readmission_risk_predictions (recreated by a later migration) uses
  -- readmission_risk_score, not the original migration's readmission_risk_30_day.
  AVG(readmission_risk_score) as avg_risk_score,
  COUNT(*) FILTER (WHERE actual_readmission_occurred = true) as actual_readmissions,
  COUNT(*) FILTER (WHERE prediction_accuracy_score IS NOT NULL) as validated_predictions,
  AVG(prediction_accuracy_score) as avg_accuracy,
  SUM(ai_cost) as total_ai_cost
FROM public.readmission_risk_predictions
GROUP BY tenant_id, DATE(discharge_date);

COMMENT ON VIEW public.readmission_prediction_analytics IS 'Daily analytics for readmission prediction accuracy and cost';

-- ---------------------------------------------------------------------------
-- Grants (match the original up-section)
-- ---------------------------------------------------------------------------
GRANT SELECT ON public.billing_code_cache TO authenticated;
GRANT SELECT ON public.encounter_billing_suggestions TO authenticated;
GRANT SELECT ON public.billing_suggestion_analytics TO authenticated;
GRANT SELECT ON public.readmission_prediction_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_billing_cache_hit(uuid) TO authenticated;

COMMIT;
