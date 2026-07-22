-- Restore ems_dispatch_protocols + repair auto_dispatch_departments
-- (tracker: docs/trackers/ems-and-hospital-transfer-repair-tracker-2026-07-22.md)
--
-- LIVE-PROBE FINDING (2026-07-22, rolled-back synthetic handoff insert): the live
-- auto_dispatch_departments() still queries ems_dispatch_protocols — a table that
-- does NOT exist live (its CREATE only ever ran from _ARCHIVE_SKIPPED) — and joins
-- hospital_departments on old-shape columns (department_code/department_name/
-- hospital_name; live shape is code/name, no hospital_name). Because the trigger
-- fires AFTER INSERT on prehospital_handoffs, EVERY alert-flagged EMS handoff
-- insert has been ERRORING in production. The 5 existing dispatch rows are seeds.
--
-- This migration:
--   1. Recreates ems_dispatch_protocols (archived shape, FK adapted to the live
--      hospital_departments.code unique key) + RLS + GRANT (§2a).
--   2. Seeds the standard department set for the default tenant WF-0001
--      (hospital_departments is empty live) and the archived alert protocols.
--      alert_phone/alert_email stay NULL — paging no-ops until an admin sets them;
--      the dispatch dashboard remains the notification surface.
--   3. Rewrites auto_dispatch_departments() against live shapes, wrapped so a
--      dispatch failure can NEVER block the paramedic's handoff insert again
--      (fail toward the patient arriving on the board; failures logged loudly).
--
-- Forward-only; no `-- migrate:down` block (db push executes down blocks — documented footgun).

-- ---------------------------------------------------------------------------
-- 1. Protocols table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ems_dispatch_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'stroke', 'stemi', 'trauma', 'sepsis', 'cardiac_arrest', 'general'
  )),
  department_code TEXT NOT NULL REFERENCES public.hospital_departments(code) ON DELETE CASCADE,
  auto_dispatch BOOLEAN DEFAULT TRUE,
  priority_level INTEGER DEFAULT 1,
  estimated_response_time_minutes INTEGER DEFAULT 5,
  required_actions JSONB DEFAULT '[]'::jsonb,
  notification_template TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (alert_type, department_code)
);

CREATE INDEX IF NOT EXISTS idx_dispatch_protocols_alert
  ON public.ems_dispatch_protocols(alert_type, auto_dispatch);
CREATE INDEX IF NOT EXISTS idx_dispatch_protocols_dept
  ON public.ems_dispatch_protocols(department_code);

ALTER TABLE public.ems_dispatch_protocols ENABLE ROW LEVEL SECURITY;

-- Reference/config data: readable by clinical users; managed via service role only.
DROP POLICY IF EXISTS "ems_dispatch_protocols_read" ON public.ems_dispatch_protocols;
CREATE POLICY "ems_dispatch_protocols_read" ON public.ems_dispatch_protocols
  FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public.ems_dispatch_protocols TO authenticated;

COMMENT ON TABLE public.ems_dispatch_protocols IS
  'Which departments auto-dispatch for each EMS alert type (consumed by auto_dispatch_departments trigger).';

-- ---------------------------------------------------------------------------
-- 2a. Seed standard departments for the default tenant (table is empty live)
-- ---------------------------------------------------------------------------
INSERT INTO public.hospital_departments (tenant_id, code, name, description, is_active)
VALUES
  ('2b902657-6a20-4435-a78a-576f397517ca', 'er',          'Emergency Department',   'Emergency and trauma intake', TRUE),
  ('2b902657-6a20-4435-a78a-576f397517ca', 'neuro',       'Neurology',              'Stroke team and neurology services', TRUE),
  ('2b902657-6a20-4435-a78a-576f397517ca', 'cardio',      'Cardiology',             'Cath lab and cardiology services', TRUE),
  ('2b902657-6a20-4435-a78a-576f397517ca', 'trauma',      'Trauma Surgery',         'Trauma surgical team', TRUE),
  ('2b902657-6a20-4435-a78a-576f397517ca', 'radiology',   'Radiology',              'CT, X-ray, and imaging services', TRUE),
  ('2b902657-6a20-4435-a78a-576f397517ca', 'lab',         'Laboratory',             'Clinical laboratory and blood bank', TRUE),
  ('2b902657-6a20-4435-a78a-576f397517ca', 'pharmacy',    'Pharmacy',               'Inpatient pharmacy services', TRUE),
  ('2b902657-6a20-4435-a78a-576f397517ca', 'respiratory', 'Respiratory Therapy',    'Airway and ventilator support', TRUE),
  ('2b902657-6a20-4435-a78a-576f397517ca', 'icu',         'Intensive Care Unit',    'Critical care services', TRUE)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2b. Seed alert protocols (archived clinical protocol set, unchanged)
-- ---------------------------------------------------------------------------
INSERT INTO public.ems_dispatch_protocols (alert_type, department_code, auto_dispatch, priority_level, required_actions)
VALUES
  ('stroke', 'er', TRUE, 1, '["Clear CT scanner", "Prepare stroke bay", "Notify ER physician"]'::jsonb),
  ('stroke', 'neuro', TRUE, 1, '["Activate stroke team", "Notify neurologist on call", "Prepare tPA if indicated"]'::jsonb),
  ('stroke', 'radiology', TRUE, 1, '["Prepare CT scanner immediately", "Have CT tech standing by", "Clear non-urgent cases"]'::jsonb),
  ('stroke', 'lab', TRUE, 1, '["Prepare for stat labs (CBC, BMP, PT/INR, troponin)", "Have blood draw supplies ready"]'::jsonb),
  ('stroke', 'pharmacy', TRUE, 2, '["Prepare tPA if needed", "Review anticoagulation status"]'::jsonb),
  ('stemi', 'er', TRUE, 1, '["Prepare cardiac bay", "Have 12-lead ready", "Notify ER physician"]'::jsonb),
  ('stemi', 'cardio', TRUE, 1, '["Activate cath lab", "Notify interventional cardiologist", "Prepare for emergency PCI"]'::jsonb),
  ('stemi', 'lab', TRUE, 1, '["Stat cardiac markers", "Prepare for serial troponins"]'::jsonb),
  ('stemi', 'pharmacy', TRUE, 1, '["Prepare antiplatelet agents", "Ready heparin/antithrombotics"]'::jsonb),
  ('stemi', 'radiology', TRUE, 2, '["Standby for cath lab imaging"]'::jsonb),
  ('trauma', 'er', TRUE, 1, '["Activate trauma bay", "Prepare resuscitation equipment", "Notify trauma team leader"]'::jsonb),
  ('trauma', 'trauma', TRUE, 1, '["Activate trauma surgeon", "Notify OR if needed", "Prepare for emergency surgery"]'::jsonb),
  ('trauma', 'lab', TRUE, 1, '["Type and cross 4 units PRBCs", "Stat trauma panel", "Prepare for massive transfusion"]'::jsonb),
  ('trauma', 'radiology', TRUE, 1, '["Prepare CT scanner", "Have portable X-ray ready", "FAST ultrasound available"]'::jsonb),
  ('trauma', 'respiratory', TRUE, 2, '["Prepare airway equipment", "Ventilator ready if needed"]'::jsonb),
  ('sepsis', 'er', TRUE, 1, '["Prepare sepsis bay", "Ready for large-bore IV access", "Notify ER physician"]'::jsonb),
  ('sepsis', 'lab', TRUE, 1, '["Stat lactate and blood cultures", "CBC, BMP, liver panel", "Prepare for serial lactates"]'::jsonb),
  ('sepsis', 'pharmacy', TRUE, 1, '["Prepare broad-spectrum antibiotics", "Ready IV fluids (crystalloid)", "Vasopressors on standby"]'::jsonb),
  ('sepsis', 'icu', TRUE, 2, '["Prepare ICU bed if needed", "Notify intensivist"]'::jsonb),
  ('cardiac_arrest', 'er', TRUE, 1, '["Activate code team", "Prepare resuscitation bay", "Ready advanced airway equipment"]'::jsonb),
  ('cardiac_arrest', 'cardio', TRUE, 1, '["Notify cardiologist", "Prepare for post-arrest cath if ROSC", "Therapeutic hypothermia protocol ready"]'::jsonb),
  ('cardiac_arrest', 'respiratory', TRUE, 1, '["Prepare ventilator", "Advanced airway equipment ready"]'::jsonb),
  ('cardiac_arrest', 'icu', TRUE, 1, '["Prepare ICU bed", "Notify intensivist", "Ready for post-arrest care"]'::jsonb),
  ('cardiac_arrest', 'pharmacy', TRUE, 1, '["Prepare ACLS medications", "Ready continuous infusions"]'::jsonb),
  ('general', 'er', TRUE, 3, '["Prepare ER bed", "Notify charge nurse"]'::jsonb)
ON CONFLICT (alert_type, department_code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Repair the dispatch trigger function against LIVE shapes; never block
--    the handoff insert on a dispatch failure.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_dispatch_departments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alert_types TEXT[] := '{}';
  v_protocol RECORD;
BEGIN
  IF NEW.stroke_alert THEN v_alert_types := array_append(v_alert_types, 'stroke'); END IF;
  IF NEW.stemi_alert THEN v_alert_types := array_append(v_alert_types, 'stemi'); END IF;
  IF NEW.trauma_alert THEN v_alert_types := array_append(v_alert_types, 'trauma'); END IF;
  IF NEW.sepsis_alert THEN v_alert_types := array_append(v_alert_types, 'sepsis'); END IF;
  IF NEW.cardiac_arrest THEN v_alert_types := array_append(v_alert_types, 'cardiac_arrest'); END IF;

  IF array_length(v_alert_types, 1) IS NULL THEN
    v_alert_types := ARRAY['general'];
  END IF;

  BEGIN
    FOR v_protocol IN
      SELECT DISTINCT
        edp.alert_type,
        edp.department_code,
        edp.priority_level,
        edp.required_actions,
        hd.name AS department_name
      FROM public.ems_dispatch_protocols edp
      JOIN public.hospital_departments hd ON hd.code = edp.department_code
      WHERE edp.alert_type = ANY(v_alert_types)
        AND edp.auto_dispatch = TRUE
        AND edp.is_active = TRUE
        AND hd.is_active = TRUE
        AND (hd.tenant_id = NEW.tenant_id OR hd.tenant_id IS NULL OR NEW.tenant_id IS NULL)
    LOOP
      INSERT INTO public.ems_department_dispatches (
        handoff_id,
        tenant_id,
        department_code,
        department_name,
        alert_type,
        alert_priority,
        dispatch_status,
        required_actions,
        dispatched_at
      )
      VALUES (
        NEW.id,
        NEW.tenant_id,
        v_protocol.department_code,
        v_protocol.department_name,
        v_protocol.alert_type,
        v_protocol.priority_level,
        'notified',
        v_protocol.required_actions,
        NOW()
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    -- A dispatch failure must never reject the paramedic's handoff — the
    -- patient still needs to appear on the incoming board. Fail loud in logs.
    RAISE WARNING 'auto_dispatch_departments failed for handoff %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;
