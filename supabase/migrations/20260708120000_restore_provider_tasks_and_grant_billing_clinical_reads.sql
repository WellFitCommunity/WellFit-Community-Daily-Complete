-- Repair: restore the provider-task subsystem + grant missing table privileges
-- ============================================================================
-- Two root causes behind a batch of clinical/billing dashboard failures
-- (diagnosed live 2026-07-08 via information_schema / pg_class / has_table_privilege):
--
--   1. GRANT GAP — several tables/views have RLS enabled + policies, but the
--      `authenticated` role was never granted table privileges. RLS policies do
--      NOT grant privileges; without the GRANT, PostgREST returns
--      "permission denied for table X". Affected: hcc_categories, code_cpt,
--      encounter_superbills, claim_payments, result_acknowledgments,
--      encounter_providers, v_unacknowledged_results.
--
--   2. DROPPED SUBSYSTEM — provider_tasks, provider_task_escalation_config, and
--      v_provider_task_queue were defined in 20260215000000_provider_task_routing.sql
--      but do not exist live. That migration carried a dbmate "-- migrate:down"
--      DROP block; `supabase db push` executes the whole file top-to-bottom
--      (it doesn't honor dbmate up/down), so the objects were created then
--      immediately dropped, with the version recorded as applied. This restore
--      re-creates them and DELIBERATELY carries no destructive down block.
--
-- IMPORTANT: This file intentionally has NO "-- migrate:down" DROP statements,
-- to avoid re-triggering the same footgun on the next `supabase db push`.
--
-- migrate:up
BEGIN;

-- ============================================================================
-- PART 1 — Grant missing table/view privileges (RLS still gates the rows)
-- ============================================================================
-- Reference data (read-only)
GRANT SELECT ON public.hcc_categories TO authenticated;
GRANT SELECT ON public.code_cpt       TO authenticated;

-- Billing / clinical tables the dashboards read and write (writes still gated
-- by each table's existing WITH CHECK policies)
GRANT SELECT, INSERT, UPDATE ON public.encounter_superbills    TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.claim_payments          TO authenticated;
GRANT SELECT, INSERT         ON public.result_acknowledgments  TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.encounter_providers     TO authenticated;

-- Read-only view (security_invoker → underlying-table RLS still applies)
GRANT SELECT ON public.v_unacknowledged_results TO authenticated;

-- ============================================================================
-- PART 2 — Restore the provider-task subsystem (up-portion of 20260215000000)
-- ============================================================================

-- 2a. Provider tasks (the inbox)
CREATE TABLE IF NOT EXISTS public.provider_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid REFERENCES public.encounters(id) ON DELETE SET NULL,
  patient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  task_type text NOT NULL CHECK (task_type IN (
    'result_review', 'order_followup', 'documentation', 'referral_response', 'general'
  )),
  priority text NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'stat')),
  title text NOT NULL,
  description text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'acknowledged', 'in_progress', 'completed', 'escalated', 'cancelled'
  )),
  due_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completion_notes text,
  escalation_level integer NOT NULL DEFAULT 0,
  escalated_at timestamptz,
  escalated_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source_type text DEFAULT 'manual' CHECK (source_type IN ('system', 'manual', 'sla_breach')),
  source_id uuid,
  tenant_id uuid NOT NULL DEFAULT (current_setting('app.current_tenant_id', true))::uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_tasks_assigned
  ON public.provider_tasks(assigned_to) WHERE status NOT IN ('completed', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_provider_tasks_status
  ON public.provider_tasks(status) WHERE status NOT IN ('completed', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_provider_tasks_due
  ON public.provider_tasks(due_at) WHERE status NOT IN ('completed', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_provider_tasks_encounter
  ON public.provider_tasks(encounter_id);
CREATE INDEX IF NOT EXISTS idx_provider_tasks_patient
  ON public.provider_tasks(patient_id);
CREATE INDEX IF NOT EXISTS idx_provider_tasks_tenant
  ON public.provider_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_provider_tasks_priority
  ON public.provider_tasks(priority, status) WHERE status NOT IN ('completed', 'cancelled');

DROP TRIGGER IF EXISTS trg_provider_tasks_uat ON public.provider_tasks;
CREATE TRIGGER trg_provider_tasks_uat
  BEFORE UPDATE ON public.provider_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.provider_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "provider_tasks_staff_rw" ON public.provider_tasks;
CREATE POLICY "provider_tasks_staff_rw" ON public.provider_tasks
  USING (
    public.is_admin(auth.uid()) OR
    assigned_to = auth.uid()
  )
  WITH CHECK (
    public.is_admin(auth.uid())
  );

-- 2b. Escalation config (SLA rules per task_type + priority)
CREATE TABLE IF NOT EXISTS public.provider_task_escalation_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type text NOT NULL CHECK (task_type IN (
    'result_review', 'order_followup', 'documentation', 'referral_response', 'general'
  )),
  priority text NOT NULL CHECK (priority IN ('routine', 'urgent', 'stat')),
  target_minutes integer NOT NULL,
  warning_minutes integer,
  escalation_1_minutes integer,
  escalation_2_minutes integer,
  notify_on_warning boolean NOT NULL DEFAULT true,
  notify_on_escalation boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  tenant_id uuid NOT NULL DEFAULT (current_setting('app.current_tenant_id', true))::uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_escalation_config UNIQUE (tenant_id, task_type, priority)
);

DROP TRIGGER IF EXISTS trg_provider_task_esc_config_uat ON public.provider_task_escalation_config;
CREATE TRIGGER trg_provider_task_esc_config_uat
  BEFORE UPDATE ON public.provider_task_escalation_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.provider_task_escalation_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "escalation_config_admin_rw" ON public.provider_task_escalation_config;
CREATE POLICY "escalation_config_admin_rw" ON public.provider_task_escalation_config
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.provider_task_escalation_config
  (task_type, priority, target_minutes, warning_minutes, escalation_1_minutes, escalation_2_minutes, tenant_id)
VALUES
  ('result_review', 'stat',    60,  30,  90,  120, '00000000-0000-0000-0000-000000000000'),
  ('result_review', 'urgent', 240, 120, 360,  480, '00000000-0000-0000-0000-000000000000'),
  ('result_review', 'routine', 1440, 720, 2160, 2880, '00000000-0000-0000-0000-000000000000'),
  ('order_followup', 'stat',    60,  30,  90,  120, '00000000-0000-0000-0000-000000000000'),
  ('order_followup', 'urgent', 240, 120, 360,  480, '00000000-0000-0000-0000-000000000000'),
  ('order_followup', 'routine', 1440, 720, 2160, 2880, '00000000-0000-0000-0000-000000000000'),
  ('documentation', 'stat',   120,  60, 180,  240, '00000000-0000-0000-0000-000000000000'),
  ('documentation', 'urgent', 480, 240, 720,  960, '00000000-0000-0000-0000-000000000000'),
  ('documentation', 'routine', 2880, 1440, 4320, 5760, '00000000-0000-0000-0000-000000000000'),
  ('referral_response', 'stat',    60,  30,  90,  120, '00000000-0000-0000-0000-000000000000'),
  ('referral_response', 'urgent', 480, 240, 720,  960, '00000000-0000-0000-0000-000000000000'),
  ('referral_response', 'routine', 2880, 1440, 4320, 5760, '00000000-0000-0000-0000-000000000000'),
  ('general', 'stat',   120,  60, 180,  240, '00000000-0000-0000-0000-000000000000'),
  ('general', 'urgent', 480, 240, 720,  960, '00000000-0000-0000-0000-000000000000'),
  ('general', 'routine', 2880, 1440, 4320, 5760, '00000000-0000-0000-0000-000000000000')
ON CONFLICT (tenant_id, task_type, priority) DO NOTHING;

-- 2c. Queue view (enriched with patient + provider names + overdue computation)
CREATE OR REPLACE VIEW public.v_provider_task_queue
WITH (security_invoker = on)
AS
SELECT
  t.id, t.encounter_id, t.patient_id, t.task_type, t.priority, t.title, t.description,
  t.assigned_to, t.assigned_at, t.status, t.due_at, t.acknowledged_at, t.completed_at,
  t.completion_notes, t.escalation_level, t.escalated_at, t.escalated_to, t.source_type,
  t.source_id, t.tenant_id, t.created_at, t.updated_at,
  pp.first_name AS patient_first_name,
  pp.last_name  AS patient_last_name,
  ap.first_name AS assignee_first_name,
  ap.last_name  AS assignee_last_name,
  CASE
    WHEN t.due_at IS NOT NULL AND t.status NOT IN ('completed', 'cancelled') AND now() > t.due_at
    THEN true ELSE false
  END AS is_overdue,
  CASE
    WHEN t.due_at IS NOT NULL AND t.status NOT IN ('completed', 'cancelled') AND now() > t.due_at
    THEN EXTRACT(EPOCH FROM (now() - t.due_at)) / 60.0 ELSE 0
  END AS minutes_past_due
FROM public.provider_tasks t
LEFT JOIN public.profiles pp ON pp.user_id = t.patient_id
LEFT JOIN public.profiles ap ON ap.user_id = t.assigned_to;

COMMENT ON TABLE public.provider_tasks IS 'Provider task inbox — routes work items to providers with SLA deadlines and escalation tracking';
COMMENT ON TABLE public.provider_task_escalation_config IS 'SLA escalation rules per task type and priority — defines target, warning, and escalation thresholds';
COMMENT ON VIEW public.v_provider_task_queue IS 'Enriched provider task queue with patient/provider names and overdue calculations';

-- 2d. Grants for the restored subsystem (writes gated by the RLS policies above)
GRANT SELECT, INSERT, UPDATE ON public.provider_tasks                 TO authenticated;
GRANT SELECT                 ON public.provider_task_escalation_config TO authenticated;
GRANT SELECT                 ON public.v_provider_task_queue           TO authenticated;

COMMIT;

-- migrate:down
-- Intentionally NO destructive statements. `supabase db push` executes this whole
-- file regardless of dbmate up/down markers; a DROP here would re-drop the very
-- objects this migration restores (the original 20260215000000 footgun).
