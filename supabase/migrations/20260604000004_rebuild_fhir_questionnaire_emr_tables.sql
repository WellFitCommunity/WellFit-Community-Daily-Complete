-- Rebuild: EMR/FHIR questionnaire response + deployment tables under non-colliding names
--
-- DRIFT FORENSIC (DB-reference drift triage #9 + #21 — rpc::deploy_questionnaire_to_wellfit,
-- rpc::get_questionnaire_stats):
--   The FHIR Questionnaire Builder (Envision Atlus / EMR side; admin
--   FHIRFormBuilderEnhanced via fhirQuestionnaireService) is one pipeline:
--   build AI-generated FHIR questionnaire -> deploy -> collect responses -> stats.
--   Its original migration (_APPLIED_20250928000000) created 5 bigint-keyed tables:
--   fhir_questionnaires, questionnaire_responses, questionnaire_templates,
--   questionnaire_analytics, questionnaire_deployments.
--
--   A SEPARATE, newer uuid-based WellFit/community questionnaire system
--   (question_templates + question_assignments, used by QuestionnaireAnalyticsDashboard
--   + CHWDashboardPage) REUSED three of those names — questionnaire_responses,
--   questionnaire_deployments, questionnaire_analytics — with different uuid schemas,
--   clobbering the EMR side's companion tables. Only fhir_questionnaires +
--   questionnaire_templates (both still bigint) survived as the EMR builder's.
--   The deploy/stats functions were then dropped by 20251209110000 because their
--   tables no longer matched.
--
--   Per Maria (2026-06-04): these are TWO SEPARATE SYSTEMS (EMR/FHIR vs WellFit),
--   each owning its own data — a name collision, not a replacement. Resolution:
--   give the EMR side its OWN response + deployment tables under non-colliding
--   `fhir_` names and repoint the two functions at them. The WellFit uuid tables
--   (questionnaire_responses/deployments/analytics) are LEFT UNTOUCHED.
--
--   Schemas + RLS are faithful to the original _APPLIED_20250928000000 definitions
--   (renamed). Deps verified live first: fhir_questionnaires (bigint id),
--   user_roles.role, set_updated_at(). get_questionnaire_stats also gains a
--   divide-by-zero guard (NULLIF) the original lacked (it errored for 0 responses).
--   (questionnaire_analytics is NOT rebuilt — neither function reads it and no EMR
--   code references it; can be added later if a consumer appears.)

BEGIN;

-- 1) EMR questionnaire responses (bigint, FK fhir_questionnaires)
CREATE TABLE IF NOT EXISTS public.fhir_questionnaire_responses (
  id bigserial PRIMARY KEY,
  questionnaire_id bigint NOT NULL REFERENCES public.fhir_questionnaires(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  response_id text UNIQUE NOT NULL,                      -- FHIR QuestionnaireResponse.id
  status text NOT NULL DEFAULT 'in-progress'
    CHECK (status IN ('in-progress','completed','amended','entered-in-error','stopped')),
  response_json jsonb NOT NULL,
  total_score numeric,
  subscores jsonb,
  interpretation text,
  risk_level text CHECK (risk_level IN ('LOW','MODERATE','HIGH','CRITICAL')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  synced_to_ehr boolean DEFAULT false,
  ehr_sync_at timestamptz,
  ehr_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fhir_q_responses_questionnaire ON public.fhir_questionnaire_responses(questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_fhir_q_responses_patient ON public.fhir_questionnaire_responses(patient_id);
CREATE INDEX IF NOT EXISTS idx_fhir_q_responses_status ON public.fhir_questionnaire_responses(status);
CREATE INDEX IF NOT EXISTS idx_fhir_q_responses_completed_at ON public.fhir_questionnaire_responses(completed_at DESC);

DROP TRIGGER IF EXISTS trg_fhir_questionnaire_responses_uat ON public.fhir_questionnaire_responses;
CREATE TRIGGER trg_fhir_questionnaire_responses_uat
  BEFORE UPDATE ON public.fhir_questionnaire_responses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.fhir_questionnaire_responses ENABLE ROW LEVEL SECURITY;

-- Patients see/manage their own responses
DROP POLICY IF EXISTS "fhir_q_responses_patient_own" ON public.fhir_questionnaire_responses;
CREATE POLICY "fhir_q_responses_patient_own" ON public.fhir_questionnaire_responses
  FOR ALL
  USING (patient_id = auth.uid())
  WITH CHECK (patient_id = auth.uid());

-- Clinical staff see/manage all
DROP POLICY IF EXISTS "fhir_q_responses_clinical_all" ON public.fhir_questionnaire_responses;
CREATE POLICY "fhir_q_responses_clinical_all" ON public.fhir_questionnaire_responses
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles ur
                 WHERE ur.user_id = auth.uid()
                   AND ur.role IN ('admin','super_admin','nurse','doctor')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur
                      WHERE ur.user_id = auth.uid()
                        AND ur.role IN ('admin','super_admin','nurse','doctor')));

-- 2) EMR questionnaire deployments (bigint, FK fhir_questionnaires)
CREATE TABLE IF NOT EXISTS public.fhir_questionnaire_deployments (
  id bigserial PRIMARY KEY,
  questionnaire_id bigint NOT NULL REFERENCES public.fhir_questionnaires(id) ON DELETE CASCADE,
  deployment_type text NOT NULL
    CHECK (deployment_type IN ('WELLFIT_DASHBOARD','PATIENT_PORTAL','EHR_INTEGRATION','MOBILE_APP','KIOSK','SURVEY_LINK')),
  deployment_status text NOT NULL DEFAULT 'PENDING'
    CHECK (deployment_status IN ('PENDING','ACTIVE','PAUSED','RETIRED')),
  target_audience text[],
  frequency_config jsonb,
  triggers jsonb,
  endpoint_url text,
  api_credentials_encrypted text,
  mapping_config jsonb,
  total_administrations integer DEFAULT 0,
  success_rate numeric(5,2),
  last_sync_at timestamptz,
  deployed_at timestamptz NOT NULL DEFAULT now(),
  deployed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fhir_q_deployments_questionnaire ON public.fhir_questionnaire_deployments(questionnaire_id);
CREATE INDEX IF NOT EXISTS idx_fhir_q_deployments_status ON public.fhir_questionnaire_deployments(deployment_status);

DROP TRIGGER IF EXISTS trg_fhir_questionnaire_deployments_uat ON public.fhir_questionnaire_deployments;
CREATE TRIGGER trg_fhir_questionnaire_deployments_uat
  BEFORE UPDATE ON public.fhir_questionnaire_deployments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.fhir_questionnaire_deployments ENABLE ROW LEVEL SECURITY;

-- Admin-only (matches original questionnaire_deployments policy)
DROP POLICY IF EXISTS "fhir_q_deployments_admin_only" ON public.fhir_questionnaire_deployments;
CREATE POLICY "fhir_q_deployments_admin_only" ON public.fhir_questionnaire_deployments
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles ur
                 WHERE ur.user_id = auth.uid()
                   AND ur.role IN ('admin','super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur
                      WHERE ur.user_id = auth.uid()
                        AND ur.role IN ('admin','super_admin')));

-- 3) Repoint get_questionnaire_stats at the EMR responses table (+ divide-by-zero guard)
CREATE OR REPLACE FUNCTION public.get_questionnaire_stats(questionnaire_uuid bigint)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  stats jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_responses', count(*),
    'completed_responses', count(*) FILTER (WHERE status = 'completed'),
    'completion_rate', round(
      (count(*) FILTER (WHERE status = 'completed')::numeric / NULLIF(count(*), 0)) * 100, 2),
    'average_score', round(avg(total_score), 2),
    'high_risk_count', count(*) FILTER (WHERE risk_level IN ('HIGH','CRITICAL'))
  ) INTO stats
  FROM public.fhir_questionnaire_responses
  WHERE questionnaire_id = questionnaire_uuid;

  RETURN stats;
END;
$$;

-- 4) Repoint deploy_questionnaire_to_wellfit at the EMR deployments table
CREATE OR REPLACE FUNCTION public.deploy_questionnaire_to_wellfit(questionnaire_uuid bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.fhir_questionnaires
  SET deployed_to_wellfit = true,
      deployment_config = jsonb_build_object('deployed_at', now())
  WHERE id = questionnaire_uuid;

  INSERT INTO public.fhir_questionnaire_deployments (
    questionnaire_id, deployment_type, deployment_status, deployed_by
  ) VALUES (
    questionnaire_uuid, 'WELLFIT_DASHBOARD', 'ACTIVE', auth.uid()
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_questionnaire_stats(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deploy_questionnaire_to_wellfit(bigint) TO authenticated;

COMMENT ON TABLE public.fhir_questionnaire_responses IS 'EMR/Atlus FHIR questionnaire responses (bigint, FK fhir_questionnaires). Separate from the WellFit uuid questionnaire_responses system.';
COMMENT ON TABLE public.fhir_questionnaire_deployments IS 'EMR/Atlus FHIR questionnaire deployment records. Separate from the WellFit uuid questionnaire_deployments system.';

COMMIT;
