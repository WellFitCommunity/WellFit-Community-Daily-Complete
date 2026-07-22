-- Re-canonicalize the EMS prehospital schema (tracker D8, Maria-approved 2026-07-22)
--
-- The CREATE statements for prehospital_handoffs, ems_department_dispatches,
-- ems_provider_signoffs and their RPCs only ever existed under
-- supabase/migrations/_ARCHIVE_SKIPPED/ — the live objects exist from a
-- pre-archive run, but a fresh environment (db reset / new silo project)
-- could not rebuild them. This migration reproduces the LIVE shapes
-- (dumped from information_schema / pg_constraint / pg_indexes /
-- pg_get_functiondef on 2026-07-22 — NOT trusted from the archived files).
--
-- Idempotent by construction: CREATE TABLE IF NOT EXISTS (constraints inline,
-- so existing DBs skip the whole statement), CREATE INDEX IF NOT EXISTS,
-- CREATE OR REPLACE FUNCTION, DROP POLICY IF EXISTS + CREATE. On prod this
-- is a no-op except for the harmless function replaces.
-- ems_dispatch_protocols + the tenant-derive/notify/auto-dispatch triggers
-- already have active migrations (20260722120000 / 20260722130000).
--
-- Forward-only; no `-- migrate:down` block (db push executes down blocks — documented footgun).

-- ---------------------------------------------------------------------------
-- 1. Tables (live shapes, constraints inline)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prehospital_handoffs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_age integer,
  patient_gender text,
  chief_complaint text NOT NULL,
  scene_location text,
  scene_type text,
  mechanism_of_injury text,
  time_dispatched timestamp with time zone,
  time_arrived_scene timestamp with time zone,
  time_left_scene timestamp with time zone,
  eta_hospital timestamp with time zone NOT NULL,
  time_arrived_hospital timestamp with time zone,
  vitals jsonb DEFAULT '{"glucose": null, "gcs_score": null, "heart_rate": null, "pain_level": null, "temperature": null, "respiratory_rate": null, "oxygen_saturation": null, "blood_pressure_systolic": null, "blood_pressure_diastolic": null}'::jsonb,
  signs_symptoms text[],
  allergies text[],
  medications text[],
  past_medical_history text[],
  last_oral_intake text,
  events_leading text,
  treatments_given jsonb DEFAULT '[]'::jsonb,
  stroke_alert boolean DEFAULT false,
  stemi_alert boolean DEFAULT false,
  trauma_alert boolean DEFAULT false,
  sepsis_alert boolean DEFAULT false,
  cardiac_arrest boolean DEFAULT false,
  alert_notes text,
  paramedic_name text NOT NULL,
  paramedic_id uuid,
  unit_number text NOT NULL,
  ems_agency text,
  receiving_hospital_id uuid,
  receiving_hospital_name text NOT NULL,
  acknowledged_by uuid,
  acknowledged_at timestamp with time zone,
  acknowledged_notes text,
  transferred_to_er_by uuid,
  transferred_at timestamp with time zone,
  receiving_nurse_id uuid,
  status text NOT NULL DEFAULT 'en_route'::text,
  sync_status text DEFAULT 'synced'::text,
  offline_created_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  patient_id uuid,
  encounter_id uuid,
  integrated_at timestamp with time zone,
  tenant_id uuid,
  destination_facility_id uuid,
  CONSTRAINT prehospital_handoffs_sync_status_check CHECK ((sync_status = ANY (ARRAY['pending'::text, 'synced'::text, 'conflict'::text]))),
  CONSTRAINT prehospital_handoffs_patient_gender_check CHECK ((patient_gender = ANY (ARRAY['M'::text, 'F'::text, 'X'::text, 'U'::text]))),
  CONSTRAINT prehospital_handoffs_status_check CHECK ((status = ANY (ARRAY['dispatched'::text, 'on_scene'::text, 'en_route'::text, 'arrived'::text, 'transferred'::text, 'cancelled'::text]))),
  CONSTRAINT prehospital_handoffs_transferred_to_er_by_fkey FOREIGN KEY (transferred_to_er_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT prehospital_handoffs_destination_facility_id_fkey FOREIGN KEY (destination_facility_id) REFERENCES facilities(id) ON DELETE SET NULL,
  CONSTRAINT prehospital_handoffs_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE SET NULL,
  CONSTRAINT prehospital_handoffs_paramedic_id_fkey FOREIGN KEY (paramedic_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT prehospital_handoffs_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT prehospital_handoffs_receiving_nurse_id_fkey FOREIGN KEY (receiving_nurse_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT prehospital_handoffs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT prehospital_handoffs_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT prehospital_handoffs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.ems_department_dispatches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  handoff_id uuid NOT NULL,
  department_code text NOT NULL,
  department_name text NOT NULL,
  alert_type text NOT NULL,
  alert_priority integer NOT NULL DEFAULT 1,
  dispatch_status text NOT NULL DEFAULT 'pending'::text,
  dispatched_at timestamp with time zone NOT NULL DEFAULT now(),
  notified_at timestamp with time zone,
  acknowledged_at timestamp with time zone,
  mobilized_at timestamp with time zone,
  ready_at timestamp with time zone,
  completed_at timestamp with time zone,
  acknowledged_by uuid,
  acknowledged_by_name text,
  acknowledged_by_role text,
  required_actions jsonb DEFAULT '[]'::jsonb,
  completed_actions jsonb DEFAULT '[]'::jsonb,
  dispatch_notes text,
  response_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  tenant_id uuid,
  CONSTRAINT ems_department_dispatches_dispatch_status_check CHECK ((dispatch_status = ANY (ARRAY['pending'::text, 'notified'::text, 'acknowledged'::text, 'mobilized'::text, 'ready'::text, 'completed'::text, 'cancelled'::text]))),
  CONSTRAINT ems_department_dispatches_handoff_id_fkey FOREIGN KEY (handoff_id) REFERENCES prehospital_handoffs(id) ON DELETE CASCADE,
  CONSTRAINT ems_department_dispatches_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT ems_department_dispatches_acknowledged_by_fkey FOREIGN KEY (acknowledged_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT ems_department_dispatches_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.ems_provider_signoffs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  handoff_id uuid NOT NULL,
  provider_id uuid,
  provider_name text NOT NULL,
  provider_role text,
  provider_credentials text,
  signoff_type text NOT NULL,
  patient_condition_on_arrival text,
  initial_interventions text[],
  treatment_plan_notes text,
  disposition text,
  admitted_to_service text,
  signoff_timestamp timestamp with time zone NOT NULL DEFAULT now(),
  electronic_signature text,
  signature_verified boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  tenant_id uuid,
  CONSTRAINT ems_provider_signoffs_signoff_type_check CHECK ((signoff_type = ANY (ARRAY['acceptance'::text, 'acknowledgement'::text, 'treatment_plan'::text, 'final_signoff'::text]))),
  CONSTRAINT ems_provider_signoffs_handoff_id_fkey FOREIGN KEY (handoff_id) REFERENCES prehospital_handoffs(id) ON DELETE CASCADE,
  CONSTRAINT ems_provider_signoffs_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT ems_provider_signoffs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
  CONSTRAINT ems_provider_signoffs_pkey PRIMARY KEY (id)
);

-- ---------------------------------------------------------------------------
-- 2. Indexes (live set)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ems_department_dispatches_tenant_id ON public.ems_department_dispatches USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ems_dispatches_created ON public.ems_department_dispatches USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ems_dispatches_dept ON public.ems_department_dispatches USING btree (department_code, dispatch_status);
CREATE INDEX IF NOT EXISTS idx_ems_dispatches_handoff ON public.ems_department_dispatches USING btree (handoff_id);
CREATE INDEX IF NOT EXISTS idx_ems_dispatches_status ON public.ems_department_dispatches USING btree (dispatch_status, dispatched_at);
CREATE INDEX IF NOT EXISTS idx_ems_provider_signoffs_tenant_id ON public.ems_provider_signoffs USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_provider_signoffs_handoff ON public.ems_provider_signoffs USING btree (handoff_id);
CREATE INDEX IF NOT EXISTS idx_provider_signoffs_provider ON public.ems_provider_signoffs USING btree (provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_signoffs_type ON public.ems_provider_signoffs USING btree (signoff_type);
CREATE INDEX IF NOT EXISTS idx_prehospital_alerts ON public.prehospital_handoffs USING btree (stroke_alert, stemi_alert, trauma_alert, sepsis_alert) WHERE (status = ANY (ARRAY['en_route'::text, 'on_scene'::text]));
CREATE INDEX IF NOT EXISTS idx_prehospital_created ON public.prehospital_handoffs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prehospital_eta ON public.prehospital_handoffs USING btree (eta_hospital) WHERE (status = ANY (ARRAY['en_route'::text, 'on_scene'::text]));
CREATE INDEX IF NOT EXISTS idx_prehospital_handoffs_encounter ON public.prehospital_handoffs USING btree (encounter_id) WHERE (encounter_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_prehospital_handoffs_facility ON public.prehospital_handoffs USING btree (destination_facility_id);
CREATE INDEX IF NOT EXISTS idx_prehospital_handoffs_integrated ON public.prehospital_handoffs USING btree (integrated_at) WHERE (integrated_at IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_prehospital_handoffs_patient ON public.prehospital_handoffs USING btree (patient_id) WHERE (patient_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_prehospital_handoffs_tenant_id ON public.prehospital_handoffs USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS idx_prehospital_hospital ON public.prehospital_handoffs USING btree (receiving_hospital_id);
CREATE INDEX IF NOT EXISTS idx_prehospital_status ON public.prehospital_handoffs USING btree (status, eta_hospital);
CREATE INDEX IF NOT EXISTS idx_prehospital_unit ON public.prehospital_handoffs USING btree (unit_number, created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. RLS (live policies) + GRANTs (§2a)
-- ---------------------------------------------------------------------------
ALTER TABLE public.prehospital_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ems_department_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ems_provider_signoffs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "EMS can manage their own handoffs" ON public.prehospital_handoffs;
CREATE POLICY "EMS can manage their own handoffs" ON public.prehospital_handoffs
  FOR ALL TO authenticated
  USING ((created_by = auth.uid()) OR (paramedic_id = auth.uid()))
  WITH CHECK ((created_by = auth.uid()) OR (paramedic_id = auth.uid()));

DROP POLICY IF EXISTS "prehospital_handoffs_tenant" ON public.prehospital_handoffs;
CREATE POLICY "prehospital_handoffs_tenant" ON public.prehospital_handoffs
  FOR ALL
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "ems_department_dispatches_tenant" ON public.ems_department_dispatches;
CREATE POLICY "ems_department_dispatches_tenant" ON public.ems_department_dispatches
  FOR ALL
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS "ems_provider_signoffs_tenant" ON public.ems_provider_signoffs;
CREATE POLICY "ems_provider_signoffs_tenant" ON public.ems_provider_signoffs
  FOR ALL
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

GRANT SELECT, INSERT, UPDATE ON public.prehospital_handoffs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ems_department_dispatches TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ems_provider_signoffs TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. updated_at trigger (live definition)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_prehospital_handoffs_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

DROP TRIGGER IF EXISTS trg_prehospital_handoffs_updated_at ON public.prehospital_handoffs;
CREATE TRIGGER trg_prehospital_handoffs_updated_at
BEFORE UPDATE ON public.prehospital_handoffs
FOR EACH ROW EXECUTE FUNCTION public.update_prehospital_handoffs_updated_at();

-- ---------------------------------------------------------------------------
-- 5. RPCs (live definitions via pg_get_functiondef)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.acknowledge_department_dispatch(p_dispatch_id uuid, p_user_id uuid DEFAULT auth.uid(), p_user_name text DEFAULT NULL::text, p_user_role text DEFAULT NULL::text, p_notes text DEFAULT NULL::text)
 RETURNS TABLE(success boolean, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.ems_department_dispatches
  SET
    dispatch_status = 'acknowledged',
    acknowledged_at = NOW(),
    acknowledged_by = p_user_id,
    acknowledged_by_name = COALESCE(p_user_name, (SELECT CONCAT(first_name, ' ', last_name) FROM profiles WHERE user_id = p_user_id)),
    acknowledged_by_role = p_user_role,
    response_notes = COALESCE(p_notes, response_notes)
  WHERE id = p_dispatch_id
    AND dispatch_status IN ('pending', 'notified');

  IF FOUND THEN
    RETURN QUERY SELECT TRUE, 'Dispatch acknowledged successfully'::TEXT;
  ELSE
    RETURN QUERY SELECT FALSE, 'Dispatch not found or already acknowledged'::TEXT;
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_door_to_treatment_time(p_handoff_id uuid)
 RETURNS TABLE(door_time timestamp with time zone, treatment_time timestamp with time zone, minutes_elapsed integer, alert_type text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    h.time_arrived_hospital as door_time,
    h.transferred_at as treatment_time,
    EXTRACT(EPOCH FROM (h.transferred_at - h.time_arrived_hospital))::INTEGER / 60 as minutes_elapsed,
    CASE
      WHEN h.stemi_alert THEN 'STEMI'
      WHEN h.stroke_alert THEN 'Stroke'
      WHEN h.trauma_alert THEN 'Trauma'
      WHEN h.sepsis_alert THEN 'Sepsis'
      ELSE 'General'
    END as alert_type
  FROM prehospital_handoffs h
  WHERE h.id = p_handoff_id
    AND h.time_arrived_hospital IS NOT NULL
    AND h.transferred_at IS NOT NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_coordinated_response_status(p_handoff_id uuid)
 RETURNS TABLE(department_code text, department_name text, alert_type text, dispatch_status text, dispatched_at timestamp with time zone, acknowledged_at timestamp with time zone, ready_at timestamp with time zone, response_time_seconds integer, acknowledged_by_name text, required_actions jsonb, completed_actions jsonb)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    edd.department_code,
    edd.department_name,
    edd.alert_type,
    edd.dispatch_status,
    edd.dispatched_at,
    edd.acknowledged_at,
    edd.ready_at,
    EXTRACT(EPOCH FROM (COALESCE(edd.ready_at, NOW()) - edd.dispatched_at))::INTEGER as response_time_seconds,
    edd.acknowledged_by_name,
    edd.required_actions,
    edd.completed_actions
  FROM public.ems_department_dispatches edd
  WHERE edd.handoff_id = p_handoff_id
  ORDER BY edd.alert_priority ASC, edd.dispatched_at ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_incoming_patients(p_hospital_name text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, patient_age integer, patient_gender text, chief_complaint text, eta_hospital timestamp with time zone, minutes_until_arrival integer, vitals jsonb, stroke_alert boolean, stemi_alert boolean, trauma_alert boolean, sepsis_alert boolean, cardiac_arrest boolean, alert_notes text, paramedic_name text, unit_number text, status text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    h.id,
    h.patient_age,
    h.patient_gender,
    h.chief_complaint,
    h.eta_hospital,
    EXTRACT(EPOCH FROM (h.eta_hospital - NOW()))::INTEGER / 60 as minutes_until_arrival,
    h.vitals,
    h.stroke_alert,
    h.stemi_alert,
    h.trauma_alert,
    h.sepsis_alert,
    h.cardiac_arrest,
    h.alert_notes,
    h.paramedic_name,
    h.unit_number,
    h.status,
    h.created_at
  FROM prehospital_handoffs h
  WHERE h.status IN ('en_route', 'on_scene', 'arrived')
    AND (p_hospital_name IS NULL OR h.receiving_hospital_name = p_hospital_name)
  ORDER BY
    -- Critical alerts first
    (h.cardiac_arrest OR h.stemi_alert OR h.stroke_alert OR h.trauma_alert OR h.sepsis_alert) DESC,
    -- Then by ETA
    h.eta_hospital ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_department_ready(p_dispatch_id uuid, p_completed_actions jsonb DEFAULT '[]'::jsonb)
 RETURNS TABLE(success boolean, message text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.ems_department_dispatches
  SET
    dispatch_status = 'ready',
    ready_at = NOW(),
    completed_actions = p_completed_actions
  WHERE id = p_dispatch_id
    AND dispatch_status IN ('acknowledged', 'mobilized');

  IF FOUND THEN
    RETURN QUERY SELECT TRUE, 'Department marked as ready'::TEXT;
  ELSE
    RETURN QUERY SELECT FALSE, 'Dispatch not found or invalid status'::TEXT;
  END IF;
END;
$function$
;


