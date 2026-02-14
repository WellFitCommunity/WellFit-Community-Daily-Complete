-- Provider Task Routing — inbox, SLA escalation config, and queue view
-- P3: Clinical Safety & Revenue Build Tracker
--
-- Design:
--   - provider_tasks = the provider inbox (tasks routed to providers)
--   - provider_task_escalation_config = SLA rules per task_type + priority
--   - v_provider_task_queue = enriched view with patient/provider names + overdue flags
--
-- migrate:up
BEGIN;

-- 1. Provider tasks (the inbox)
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

-- Indexes
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

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_provider_tasks_uat ON public.provider_tasks;
CREATE TRIGGER trg_provider_tasks_uat
  BEFORE UPDATE ON public.provider_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
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

-- 2. Escalation config (SLA rules per task_type + priority)
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

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_provider_task_esc_config_uat ON public.provider_task_escalation_config;
CREATE TRIGGER trg_provider_task_esc_config_uat
  BEFORE UPDATE ON public.provider_task_escalation_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.provider_task_escalation_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "escalation_config_admin_rw" ON public.provider_task_escalation_config;
CREATE POLICY "escalation_config_admin_rw" ON public.provider_task_escalation_config
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 3. Seed 15 default configs (5 task_types x 3 priorities)
-- Uses a zero-UUID tenant so these serve as global defaults;
-- tenant-specific rows override via the UNIQUE constraint.
INSERT INTO public.provider_task_escalation_config
  (task_type, priority, target_minutes, warning_minutes, escalation_1_minutes, escalation_2_minutes, tenant_id)
VALUES
  -- result_review
  ('result_review', 'stat',    60,  30,  90,  120, '00000000-0000-0000-0000-000000000000'),
  ('result_review', 'urgent', 240, 120, 360,  480, '00000000-0000-0000-0000-000000000000'),
  ('result_review', 'routine', 1440, 720, 2160, 2880, '00000000-0000-0000-0000-000000000000'),
  -- order_followup
  ('order_followup', 'stat',    60,  30,  90,  120, '00000000-0000-0000-0000-000000000000'),
  ('order_followup', 'urgent', 240, 120, 360,  480, '00000000-0000-0000-0000-000000000000'),
  ('order_followup', 'routine', 1440, 720, 2160, 2880, '00000000-0000-0000-0000-000000000000'),
  -- documentation
  ('documentation', 'stat',   120,  60, 180,  240, '00000000-0000-0000-0000-000000000000'),
  ('documentation', 'urgent', 480, 240, 720,  960, '00000000-0000-0000-0000-000000000000'),
  ('documentation', 'routine', 2880, 1440, 4320, 5760, '00000000-0000-0000-0000-000000000000'),
  -- referral_response
  ('referral_response', 'stat',    60,  30,  90,  120, '00000000-0000-0000-0000-000000000000'),
  ('referral_response', 'urgent', 480, 240, 720,  960, '00000000-0000-0000-0000-000000000000'),
  ('referral_response', 'routine', 2880, 1440, 4320, 5760, '00000000-0000-0000-0000-000000000000'),
  -- general
  ('general', 'stat',   120,  60, 180,  240, '00000000-0000-0000-0000-000000000000'),
  ('general', 'urgent', 480, 240, 720,  960, '00000000-0000-0000-0000-000000000000'),
  ('general', 'routine', 2880, 1440, 4320, 5760, '00000000-0000-0000-0000-000000000000')
ON CONFLICT (tenant_id, task_type, priority) DO NOTHING;

-- 4. Queue view (enriched with patient + provider names + overdue computation)
CREATE OR REPLACE VIEW public.v_provider_task_queue
WITH (security_invoker = on)
AS
SELECT
  t.id,
  t.encounter_id,
  t.patient_id,
  t.task_type,
  t.priority,
  t.title,
  t.description,
  t.assigned_to,
  t.assigned_at,
  t.status,
  t.due_at,
  t.acknowledged_at,
  t.completed_at,
  t.completion_notes,
  t.escalation_level,
  t.escalated_at,
  t.escalated_to,
  t.source_type,
  t.source_id,
  t.tenant_id,
  t.created_at,
  t.updated_at,
  -- Patient name
  pp.first_name AS patient_first_name,
  pp.last_name  AS patient_last_name,
  -- Assignee name
  ap.first_name AS assignee_first_name,
  ap.last_name  AS assignee_last_name,
  -- Overdue calculation
  CASE
    WHEN t.due_at IS NOT NULL
     AND t.status NOT IN ('completed', 'cancelled')
     AND now() > t.due_at
    THEN true
    ELSE false
  END AS is_overdue,
  CASE
    WHEN t.due_at IS NOT NULL
     AND t.status NOT IN ('completed', 'cancelled')
     AND now() > t.due_at
    THEN EXTRACT(EPOCH FROM (now() - t.due_at)) / 60.0
    ELSE 0
  END AS minutes_past_due
FROM public.provider_tasks t
LEFT JOIN public.profiles pp ON pp.user_id = t.patient_id
LEFT JOIN public.profiles ap ON ap.user_id = t.assigned_to;

-- Comments
COMMENT ON TABLE public.provider_tasks IS 'Provider task inbox — routes work items to providers with SLA deadlines and escalation tracking';
COMMENT ON TABLE public.provider_task_escalation_config IS 'SLA escalation rules per task type and priority — defines target, warning, and escalation thresholds';
COMMENT ON VIEW public.v_provider_task_queue IS 'Enriched provider task queue with patient/provider names and overdue calculations';

COMMIT;

-- migrate:down
BEGIN;
DROP VIEW IF EXISTS public.v_provider_task_queue CASCADE;
DROP TABLE IF EXISTS public.provider_task_escalation_config CASCADE;
DROP TABLE IF EXISTS public.provider_tasks CASCADE;
COMMIT;
