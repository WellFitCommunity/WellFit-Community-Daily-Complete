-- EMS DEPARTMENT DISPATCH SYSTEM
-- Automatic notification and mobilization of hospital departments
-- when critical EMS handoffs arrive from the field
--
-- This implements the "coordinated response" workflow:
-- Paramedic sends alert → System dispatches all needed departments → Everyone mobilized before arrival

BEGIN;

-- ============================================================================
-- PART 1: DEPARTMENT DEFINITIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.hospital_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Department Info
  department_code TEXT NOT NULL UNIQUE, -- 'neuro', 'cardio', 'trauma', 'lab', 'radiology', 'pharmacy', 'er'
  department_name TEXT NOT NULL,
  description TEXT,

  -- Contact Info for Alerts
  primary_phone TEXT, -- Pager or department phone
  primary_email TEXT,
  alert_group_id UUID, -- Link to group messaging system

  -- Active/Inactive
  is_active BOOLEAN DEFAULT TRUE,

  -- Hospital Link (multi-tenant support)
  hospital_id UUID,
  hospital_name TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_hospital_departments_code ON public.hospital_departments(department_code);
CREATE INDEX IF NOT EXISTS idx_hospital_departments_hospital ON public.hospital_departments(hospital_id);

-- ============================================================================
-- PART 2: DISPATCH PROTOCOLS (Which departments get called for which alerts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ems_dispatch_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Alert Type
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'stroke', 'stemi', 'trauma', 'sepsis', 'cardiac_arrest', 'general'
  )),

  -- Which department responds
  department_code TEXT NOT NULL REFERENCES public.hospital_departments(department_code) ON DELETE CASCADE,

  -- Dispatch Parameters
  auto_dispatch BOOLEAN DEFAULT TRUE, -- Automatically dispatch when alert comes in
  priority_level INTEGER DEFAULT 1, -- 1=critical (dispatch immediately), 2=urgent (dispatch within 5min), 3=routine
  estimated_response_time_minutes INTEGER DEFAULT 5,

  -- Required Actions
  required_actions JSONB DEFAULT '[]'::jsonb,
  -- Example:
  -- [
  --   "Activate stroke team",
  --   "Prepare CT scanner",
  --   "Ready tPA if indicated",
  --   "Notify neurologist on call"
  -- ]

  -- Notification Template
  notification_template TEXT,

  -- Active/Inactive
  is_active BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for protocol lookups
CREATE INDEX IF NOT EXISTS idx_dispatch_protocols_alert ON public.ems_dispatch_protocols(alert_type, auto_dispatch);
CREATE INDEX IF NOT EXISTS idx_dispatch_protocols_dept ON public.ems_dispatch_protocols(department_code);

-- ============================================================================
-- PART 3: DISPATCH LOG (Track who was notified and when)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ems_department_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to EMS Handoff
  handoff_id UUID NOT NULL REFERENCES public.prehospital_handoffs(id) ON DELETE CASCADE,

  -- Department Dispatched
  department_code TEXT NOT NULL REFERENCES public.hospital_departments(department_code) ON DELETE CASCADE,
  department_name TEXT NOT NULL,

  -- Alert Details
  alert_type TEXT NOT NULL,
  alert_priority INTEGER NOT NULL DEFAULT 1,

  -- Dispatch Status
  dispatch_status TEXT NOT NULL DEFAULT 'pending' CHECK (dispatch_status IN (
    'pending',    -- Dispatch initiated
    'notified',   -- Department received alert
    'acknowledged', -- Department confirmed receipt
    'mobilized',  -- Department is responding
    'ready',      -- Department ready for patient
    'completed',  -- Patient received/treated
    'cancelled'   -- Alert cancelled
  )),

  -- Timing (Door-to-[Department] metrics)
  dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notified_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  mobilized_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Who Acknowledged
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_by_name TEXT,
  acknowledged_by_role TEXT, -- 'physician', 'nurse', 'tech', etc.

  -- Required Actions Checklist
  required_actions JSONB DEFAULT '[]'::jsonb,
  completed_actions JSONB DEFAULT '[]'::jsonb,

  -- Notes
  dispatch_notes TEXT,
  response_notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ems_dispatches_handoff ON public.ems_department_dispatches(handoff_id);
CREATE INDEX IF NOT EXISTS idx_ems_dispatches_dept ON public.ems_department_dispatches(department_code, dispatch_status);
CREATE INDEX IF NOT EXISTS idx_ems_dispatches_status ON public.ems_department_dispatches(dispatch_status, dispatched_at);
CREATE INDEX IF NOT EXISTS idx_ems_dispatches_created ON public.ems_department_dispatches(created_at DESC);

-- ============================================================================
-- PART 4: PROVIDER SIGN-OFF (Receiving provider accepts handoff)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ems_provider_signoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to EMS Handoff
  handoff_id UUID NOT NULL REFERENCES public.prehospital_handoffs(id) ON DELETE CASCADE,

  -- Accepting Provider (role-agnostic: MD, DO, PA, NP, etc.)
  provider_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider_name TEXT NOT NULL,
  provider_role TEXT, -- 'physician', 'pa', 'np', 'resident', etc.
  provider_credentials TEXT, -- 'MD', 'DO', 'PA-C', 'NP-C', etc.

  -- Sign-Off Details
  signoff_type TEXT NOT NULL CHECK (signoff_type IN (
    'acceptance',    -- Provider accepts incoming patient
    'acknowledgement', -- Provider acknowledges transfer
    'treatment_plan', -- Provider documents initial treatment plan
    'final_signoff'  -- Provider completes handoff documentation
  )),

  -- Clinical Assessment
  patient_condition_on_arrival TEXT,
  initial_interventions TEXT[],
  treatment_plan_notes TEXT,

  -- Disposition
  disposition TEXT, -- 'admitted', 'er_observation', 'icu', 'transferred', 'discharged'
  admitted_to_service TEXT, -- 'medicine', 'surgery', 'cardiology', etc.

  -- Timing
  signoff_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Electronic Signature
  electronic_signature TEXT, -- Provider's typed full name as signature
  signature_verified BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_provider_signoffs_handoff ON public.ems_provider_signoffs(handoff_id);
CREATE INDEX IF NOT EXISTS idx_provider_signoffs_provider ON public.ems_provider_signoffs(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_signoffs_type ON public.ems_provider_signoffs(signoff_type);

-- ============================================================================
-- PART 5: AUTO-DISPATCH FUNCTION (Triggered when EMS handoff created/updated)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_dispatch_departments()
RETURNS TRIGGER AS $$
DECLARE
  v_alert_types TEXT[] := '{}';
  v_protocol RECORD;
  v_department RECORD;
BEGIN
  -- Determine which alerts are active
  IF NEW.stroke_alert THEN v_alert_types := array_append(v_alert_types, 'stroke'); END IF;
  IF NEW.stemi_alert THEN v_alert_types := array_append(v_alert_types, 'stemi'); END IF;
  IF NEW.trauma_alert THEN v_alert_types := array_append(v_alert_types, 'trauma'); END IF;
  IF NEW.sepsis_alert THEN v_alert_types := array_append(v_alert_types, 'sepsis'); END IF;
  IF NEW.cardiac_arrest THEN v_alert_types := array_append(v_alert_types, 'cardiac_arrest'); END IF;

  -- If no specific alerts, use 'general'
  IF array_length(v_alert_types, 1) IS NULL THEN
    v_alert_types := ARRAY['general'];
  END IF;

  -- For each alert type, find matching protocols and dispatch departments
  FOR v_protocol IN
    SELECT DISTINCT
      edp.alert_type,
      edp.department_code,
      edp.priority_level,
      edp.required_actions,
      hd.department_name
    FROM public.ems_dispatch_protocols edp
    JOIN public.hospital_departments hd ON hd.department_code = edp.department_code
    WHERE edp.alert_type = ANY(v_alert_types)
      AND edp.auto_dispatch = TRUE
      AND edp.is_active = TRUE
      AND hd.is_active = TRUE
      AND (hd.hospital_name = NEW.receiving_hospital_name OR hd.hospital_name IS NULL)
  LOOP
    -- Create dispatch record (if not already exists)
    INSERT INTO public.ems_department_dispatches (
      handoff_id,
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
      v_protocol.department_code,
      v_protocol.department_name,
      v_protocol.alert_type,
      v_protocol.priority_level,
      'notified', -- Mark as notified immediately
      v_protocol.required_actions,
      NOW()
    )
    ON CONFLICT DO NOTHING; -- Prevent duplicate dispatches

    -- Note: Actual notification sending (email/SMS/pager) would happen via
    -- Supabase Realtime subscription or Edge Function listening to this insert

    RAISE NOTICE 'Dispatched % for % alert (priority %)',
      v_protocol.department_name, v_protocol.alert_type, v_protocol.priority_level;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger: Auto-dispatch on new/updated handoff
DROP TRIGGER IF EXISTS trg_auto_dispatch_departments ON public.prehospital_handoffs;
CREATE TRIGGER trg_auto_dispatch_departments
  AFTER INSERT OR UPDATE OF stroke_alert, stemi_alert, trauma_alert, sepsis_alert, cardiac_arrest
  ON public.prehospital_handoffs
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_dispatch_departments();

-- ============================================================================
-- PART 6: HELPER FUNCTIONS
-- ============================================================================

-- Get coordinated response status for a handoff
CREATE OR REPLACE FUNCTION public.get_coordinated_response_status(p_handoff_id UUID)
RETURNS TABLE (
  department_code TEXT,
  department_name TEXT,
  alert_type TEXT,
  dispatch_status TEXT,
  dispatched_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  response_time_seconds INTEGER,
  acknowledged_by_name TEXT,
  required_actions JSONB,
  completed_actions JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

COMMENT ON FUNCTION public.get_coordinated_response_status IS
  'Get status of all department dispatches for a given EMS handoff. Shows coordinated response progress.';

-- Acknowledge dispatch (department confirms receipt)
CREATE OR REPLACE FUNCTION public.acknowledge_department_dispatch(
  p_dispatch_id UUID,
  p_user_id UUID DEFAULT auth.uid(),
  p_user_name TEXT DEFAULT NULL,
  p_user_role TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ems_department_dispatches
  SET
    dispatch_status = 'acknowledged',
    acknowledged_at = NOW(),
    acknowledged_by = p_user_id,
    acknowledged_by_name = COALESCE(p_user_name, (SELECT full_name FROM profiles WHERE user_id = p_user_id)),
    acknowledged_by_role = COALESCE(p_user_role, (SELECT role FROM profiles WHERE user_id = p_user_id)),
    response_notes = COALESCE(p_notes, response_notes)
  WHERE id = p_dispatch_id
    AND dispatch_status IN ('pending', 'notified');

  IF FOUND THEN
    RETURN QUERY SELECT TRUE, 'Dispatch acknowledged successfully'::TEXT;
  ELSE
    RETURN QUERY SELECT FALSE, 'Dispatch not found or already acknowledged'::TEXT;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.acknowledge_department_dispatch IS
  'Allow department staff to acknowledge receipt of EMS dispatch alert';

-- Mark department as ready
CREATE OR REPLACE FUNCTION public.mark_department_ready(
  p_dispatch_id UUID,
  p_completed_actions JSONB DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

COMMENT ON FUNCTION public.mark_department_ready IS
  'Mark department as ready to receive patient (all prep complete)';

-- ============================================================================
-- PART 7: DEFAULT DISPATCH PROTOCOLS (Standard hospital setup)
-- ============================================================================

-- First, ensure default departments exist
INSERT INTO public.hospital_departments (department_code, department_name, description, is_active)
VALUES
  ('er', 'Emergency Department', 'Emergency room/ER staff', TRUE),
  ('neuro', 'Neurology', 'Stroke team and neurologists', TRUE),
  ('cardio', 'Cardiology', 'Cardiology and cardiac cath lab', TRUE),
  ('trauma', 'Trauma Surgery', 'Trauma surgeons and team', TRUE),
  ('icu', 'Intensive Care', 'ICU/critical care team', TRUE),
  ('lab', 'Laboratory', 'Lab techs for stat tests', TRUE),
  ('radiology', 'Radiology', 'CT/MRI/X-ray technicians', TRUE),
  ('pharmacy', 'Pharmacy', 'Pharmacists for critical meds', TRUE),
  ('respiratory', 'Respiratory Therapy', 'RT for airway/ventilator management', TRUE)
ON CONFLICT (department_code) DO NOTHING;

-- Now create dispatch protocols
INSERT INTO public.ems_dispatch_protocols (alert_type, department_code, auto_dispatch, priority_level, required_actions)
VALUES
  -- STROKE PROTOCOLS
  ('stroke', 'er', TRUE, 1, '["Clear CT scanner", "Prepare stroke bay", "Notify ER physician"]'::jsonb),
  ('stroke', 'neuro', TRUE, 1, '["Activate stroke team", "Notify neurologist on call", "Prepare tPA if indicated"]'::jsonb),
  ('stroke', 'radiology', TRUE, 1, '["Prepare CT scanner immediately", "Have CT tech standing by", "Clear non-urgent cases"]'::jsonb),
  ('stroke', 'lab', TRUE, 1, '["Prepare for stat labs (CBC, BMP, PT/INR, troponin)", "Have blood draw supplies ready"]'::jsonb),
  ('stroke', 'pharmacy', TRUE, 2, '["Prepare tPA if needed", "Review anticoagulation status"]'::jsonb),

  -- STEMI PROTOCOLS
  ('stemi', 'er', TRUE, 1, '["Prepare cardiac bay", "Have 12-lead ready", "Notify ER physician"]'::jsonb),
  ('stemi', 'cardio', TRUE, 1, '["Activate cath lab", "Notify interventional cardiologist", "Prepare for emergency PCI"]'::jsonb),
  ('stemi', 'lab', TRUE, 1, '["Stat cardiac markers", "Prepare for serial troponins"]'::jsonb),
  ('stemi', 'pharmacy', TRUE, 1, '["Prepare antiplatelet agents", "Ready heparin/antithrombotics"]'::jsonb),
  ('stemi', 'radiology', TRUE, 2, '["Standby for cath lab imaging"]'::jsonb),

  -- TRAUMA PROTOCOLS
  ('trauma', 'er', TRUE, 1, '["Activate trauma bay", "Prepare resuscitation equipment", "Notify trauma team leader"]'::jsonb),
  ('trauma', 'trauma', TRUE, 1, '["Activate trauma surgeon", "Notify OR if needed", "Prepare for emergency surgery"]'::jsonb),
  ('trauma', 'lab', TRUE, 1, '["Type and cross 4 units PRBCs", "Stat trauma panel", "Prepare for massive transfusion"]'::jsonb),
  ('trauma', 'radiology', TRUE, 1, '["Prepare CT scanner", "Have portable X-ray ready", "FAST ultrasound available"]'::jsonb),
  ('trauma', 'respiratory', TRUE, 2, '["Prepare airway equipment", "Ventilator ready if needed"]'::jsonb),

  -- SEPSIS PROTOCOLS
  ('sepsis', 'er', TRUE, 1, '["Prepare sepsis bay", "Ready for large-bore IV access", "Notify ER physician"]'::jsonb),
  ('sepsis', 'lab', TRUE, 1, '["Stat lactate and blood cultures", "CBC, BMP, liver panel", "Prepare for serial lactates"]'::jsonb),
  ('sepsis', 'pharmacy', TRUE, 1, '["Prepare broad-spectrum antibiotics", "Ready IV fluids (crystalloid)", "Vasopressors on standby"]'::jsonb),
  ('sepsis', 'icu', TRUE, 2, '["Prepare ICU bed if needed", "Notify intensivist"]'::jsonb),

  -- CARDIAC ARREST PROTOCOLS
  ('cardiac_arrest', 'er', TRUE, 1, '["Activate code team", "Prepare resuscitation bay", "Ready advanced airway equipment"]'::jsonb),
  ('cardiac_arrest', 'cardio', TRUE, 1, '["Notify cardiologist", "Prepare for post-arrest cath if ROSC", "Therapeutic hypothermia protocol ready"]'::jsonb),
  ('cardiac_arrest', 'respiratory', TRUE, 1, '["Prepare ventilator", "Advanced airway equipment ready"]'::jsonb),
  ('cardiac_arrest', 'icu', TRUE, 1, '["Prepare ICU bed", "Notify intensivist", "Ready for post-arrest care"]'::jsonb),
  ('cardiac_arrest', 'pharmacy', TRUE, 1, '["Prepare ACLS medications", "Ready continuous infusions"]'::jsonb),

  -- GENERAL (non-critical)
  ('general', 'er', TRUE, 3, '["Prepare ER bed", "Notify charge nurse"]'::jsonb)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- PART 8: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.hospital_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ems_dispatch_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ems_department_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ems_provider_signoffs ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view departments
CREATE POLICY "Authenticated users can view departments"
  ON public.hospital_departments FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins to manage departments
CREATE POLICY "Admins can manage departments"
  ON public.hospital_departments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Allow all authenticated users to view protocols
CREATE POLICY "Authenticated users can view protocols"
  ON public.ems_dispatch_protocols FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins to manage protocols
CREATE POLICY "Admins can manage protocols"
  ON public.ems_dispatch_protocols FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Allow staff to view dispatches
CREATE POLICY "Staff can view dispatches"
  ON public.ems_department_dispatches FOR SELECT
  TO authenticated
  USING (true);

-- Allow staff to acknowledge/update dispatches
CREATE POLICY "Staff can update dispatches"
  ON public.ems_department_dispatches FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- System can insert dispatches (auto-dispatch trigger)
CREATE POLICY "System can insert dispatches"
  ON public.ems_department_dispatches FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow providers to create signoffs
CREATE POLICY "Providers can create signoffs"
  ON public.ems_provider_signoffs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to view signoffs
CREATE POLICY "Users can view signoffs"
  ON public.ems_provider_signoffs FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- PART 9: GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_coordinated_response_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_department_dispatch TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_department_ready TO authenticated;

-- ============================================================================
-- PART 10: COMMENTS
-- ============================================================================

COMMENT ON TABLE public.hospital_departments IS
  'Hospital departments that can be dispatched when EMS alerts arrive (neuro, cardio, lab, etc.)';

COMMENT ON TABLE public.ems_dispatch_protocols IS
  'Defines which departments get auto-dispatched for which alert types (stroke→neuro, STEMI→cardio, etc.)';

COMMENT ON TABLE public.ems_department_dispatches IS
  'Log of department dispatches for each EMS handoff. Tracks who was notified, when they acknowledged, and when they are ready.';

COMMENT ON TABLE public.ems_provider_signoffs IS
  'Provider sign-offs for EMS handoffs. Role-agnostic: supports MD, DO, PA, NP, etc. accepting transfers.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'EMS DEPARTMENT DISPATCH SYSTEM CREATED SUCCESSFULLY';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Components:';
  RAISE NOTICE '  ✓ Hospital departments table';
  RAISE NOTICE '  ✓ Dispatch protocols (stroke→neuro, STEMI→cardio, etc.)';
  RAISE NOTICE '  ✓ Dispatch tracking table';
  RAISE NOTICE '  ✓ Provider sign-off table (role-agnostic)';
  RAISE NOTICE '  ✓ Auto-dispatch trigger function';
  RAISE NOTICE '  ✓ Default protocols for 5 critical alert types';
  RAISE NOTICE '';
  RAISE NOTICE 'Workflow:';
  RAISE NOTICE '  1. Paramedic submits handoff with alerts (stroke, STEMI, etc.)';
  RAISE NOTICE '  2. Trigger auto-dispatches all relevant departments';
  RAISE NOTICE '  3. Departments acknowledge and prepare';
  RAISE NOTICE '  4. Provider (MD/PA/NP) accepts and signs off on transfer';
  RAISE NOTICE '  5. Patient arrives to coordinated, ready team';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Build department dashboard UI and notification system';
  RAISE NOTICE '=================================================================';
END $$;

COMMIT;
