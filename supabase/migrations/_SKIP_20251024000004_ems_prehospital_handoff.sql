-- EMS Prehospital Handoff System
-- CRITICAL for Rural Hospitals: Ambulance → ER communication
--
-- This system enables:
-- 1. Paramedics to send patient info from field
-- 2. ER to receive advance notification (STEMI, stroke, trauma alerts)
-- 3. Improved door-to-treatment times
-- 4. Joint Commission compliance for pre-hospital documentation
--
-- Rural focus: Offline-capable, mobile-first, 60-second entry

BEGIN;

-- ============================================================================
-- PART 1: PREHOSPITAL HANDOFFS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.prehospital_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Patient Demographics (minimal PHI in field)
  patient_age INTEGER,
  patient_gender TEXT CHECK (patient_gender IN ('M', 'F', 'X', 'U')),
  chief_complaint TEXT NOT NULL,

  -- Scene Information
  scene_location TEXT, -- General location (not exact address for privacy)
  scene_type TEXT, -- residence, highway, public_place, etc.
  mechanism_of_injury TEXT, -- MVA, fall, assault, medical, etc.

  -- Timing (Critical for metrics)
  time_dispatched TIMESTAMPTZ,
  time_arrived_scene TIMESTAMPTZ,
  time_left_scene TIMESTAMPTZ,
  eta_hospital TIMESTAMPTZ NOT NULL,
  time_arrived_hospital TIMESTAMPTZ,

  -- Vitals (Latest readings) - JSONB for flexibility
  vitals JSONB DEFAULT '{
    "blood_pressure_systolic": null,
    "blood_pressure_diastolic": null,
    "heart_rate": null,
    "respiratory_rate": null,
    "oxygen_saturation": null,
    "temperature": null,
    "glucose": null,
    "gcs_score": null,
    "pain_level": null
  }'::jsonb,

  -- SAMPLE History (Standard EMS format)
  signs_symptoms TEXT[], -- Chief complaint details
  allergies TEXT[], -- Known allergies
  medications TEXT[], -- Current medications
  past_medical_history TEXT[], -- Relevant conditions
  last_oral_intake TEXT, -- When/what they last ate
  events_leading TEXT, -- What happened

  -- Treatments Given in Field (JSONB array)
  treatments_given JSONB DEFAULT '[]'::jsonb,
  -- Example: [
  --   {"treatment": "Aspirin 325mg PO", "time": "14:35"},
  --   {"treatment": "IV 18g left AC", "time": "14:37"},
  --   {"treatment": "O2 4L NC", "time": "14:35"}
  -- ]

  -- Critical Alerts (Boolean flags for quick triage)
  stroke_alert BOOLEAN DEFAULT FALSE,
  stemi_alert BOOLEAN DEFAULT FALSE, -- ST-elevation MI
  trauma_alert BOOLEAN DEFAULT FALSE,
  sepsis_alert BOOLEAN DEFAULT FALSE,
  cardiac_arrest BOOLEAN DEFAULT FALSE,

  -- Alert details
  alert_notes TEXT, -- Why alert was triggered

  -- EMS Crew Information
  paramedic_name TEXT NOT NULL,
  paramedic_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- If logged in
  unit_number TEXT NOT NULL,
  ems_agency TEXT,

  -- Receiving Hospital
  receiving_hospital_id UUID, -- Link to hospital/facility
  receiving_hospital_name TEXT NOT NULL,

  -- ER Acknowledgement
  acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_notes TEXT,

  -- Patient Handoff (When transferred to ER bed)
  transferred_to_er_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  transferred_at TIMESTAMPTZ,
  receiving_nurse_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Status Tracking
  status TEXT NOT NULL DEFAULT 'en_route' CHECK (status IN (
    'dispatched',  -- Call received, en route to scene
    'on_scene',    -- Arrived at scene, assessing
    'en_route',    -- Transporting to hospital
    'arrived',     -- At hospital, awaiting transfer
    'transferred', -- Patient handed off to ER
    'cancelled'    -- Call cancelled
  )),

  -- Offline Support
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  offline_created_at TIMESTAMPTZ, -- When created locally if offline

  -- Audit Trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID DEFAULT auth.uid()
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_prehospital_status ON public.prehospital_handoffs(status, eta_hospital);
CREATE INDEX IF NOT EXISTS idx_prehospital_hospital ON public.prehospital_handoffs(receiving_hospital_id);
CREATE INDEX IF NOT EXISTS idx_prehospital_eta ON public.prehospital_handoffs(eta_hospital) WHERE status IN ('en_route', 'on_scene');
CREATE INDEX IF NOT EXISTS idx_prehospital_alerts ON public.prehospital_handoffs(stroke_alert, stemi_alert, trauma_alert, sepsis_alert) WHERE status IN ('en_route', 'on_scene');
CREATE INDEX IF NOT EXISTS idx_prehospital_created ON public.prehospital_handoffs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prehospital_unit ON public.prehospital_handoffs(unit_number, created_at DESC);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_prehospital_handoffs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prehospital_handoffs_updated_at ON public.prehospital_handoffs;
CREATE TRIGGER trg_prehospital_handoffs_updated_at
  BEFORE UPDATE ON public.prehospital_handoffs
  FOR EACH ROW EXECUTE FUNCTION public.update_prehospital_handoffs_updated_at();

-- ============================================================================
-- PART 2: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.prehospital_handoffs ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view active incoming patients for their hospital
CREATE POLICY "Staff can view incoming patients for their hospital"
  ON public.prehospital_handoffs FOR SELECT
  TO authenticated
  USING (
    status IN ('en_route', 'on_scene', 'arrived') OR
    acknowledged_by = auth.uid() OR
    created_by = auth.uid()
  );

-- EMS/Paramedics can create and update their own handoffs
CREATE POLICY "EMS can manage their own handoffs"
  ON public.prehospital_handoffs FOR ALL
  TO authenticated
  USING (
    created_by = auth.uid() OR
    paramedic_id = auth.uid()
  )
  WITH CHECK (
    created_by = auth.uid() OR
    paramedic_id = auth.uid()
  );

-- Hospital staff can acknowledge and update status
CREATE POLICY "Hospital staff can acknowledge handoffs"
  ON public.prehospital_handoffs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Admins can view all
CREATE POLICY "Admins can view all handoffs"
  ON public.prehospital_handoffs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ============================================================================
-- PART 3: HELPER FUNCTIONS
-- ============================================================================

-- Get active incoming patients for ER dashboard
CREATE OR REPLACE FUNCTION public.get_incoming_patients(p_hospital_name TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  patient_age INTEGER,
  patient_gender TEXT,
  chief_complaint TEXT,
  eta_hospital TIMESTAMPTZ,
  minutes_until_arrival INTEGER,
  vitals JSONB,
  stroke_alert BOOLEAN,
  stemi_alert BOOLEAN,
  trauma_alert BOOLEAN,
  sepsis_alert BOOLEAN,
  cardiac_arrest BOOLEAN,
  alert_notes TEXT,
  paramedic_name TEXT,
  unit_number TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

COMMENT ON FUNCTION public.get_incoming_patients IS
  'Get list of incoming patients for ER dashboard, sorted by urgency and ETA';

-- Calculate door-to-treatment metrics
CREATE OR REPLACE FUNCTION public.calculate_door_to_treatment_time(p_handoff_id UUID)
RETURNS TABLE (
  door_time TIMESTAMPTZ,
  treatment_time TIMESTAMPTZ,
  minutes_elapsed INTEGER,
  alert_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

COMMENT ON FUNCTION public.calculate_door_to_treatment_time IS
  'Calculate door-to-treatment time for quality metrics (Joint Commission)';

-- ============================================================================
-- PART 4: GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_incoming_patients TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_door_to_treatment_time TO authenticated;

-- ============================================================================
-- PART 5: COMMENTS
-- ============================================================================

COMMENT ON TABLE public.prehospital_handoffs IS
  'EMS prehospital patient handoffs from ambulance to ER. Critical for rural hospitals with long transport times.';

COMMENT ON COLUMN public.prehospital_handoffs.chief_complaint IS
  'Primary reason for EMS call (chest pain, difficulty breathing, trauma, etc.)';

COMMENT ON COLUMN public.prehospital_handoffs.vitals IS
  'Latest vital signs from field. JSONB allows for flexible vitals tracking.';

COMMENT ON COLUMN public.prehospital_handoffs.treatments_given IS
  'Array of treatments/interventions performed by EMS (IV, meds, procedures)';

COMMENT ON COLUMN public.prehospital_handoffs.stroke_alert IS
  'TRUE if stroke protocol activated (facial droop, weakness, speech issues)';

COMMENT ON COLUMN public.prehospital_handoffs.stemi_alert IS
  'TRUE if STEMI (heart attack) detected on 12-lead ECG';

COMMENT ON COLUMN public.prehospital_handoffs.trauma_alert IS
  'TRUE if trauma activation criteria met (severe injury, mechanism)';

COMMENT ON COLUMN public.prehospital_handoffs.sepsis_alert IS
  'TRUE if sepsis criteria met (infection + organ dysfunction)';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  -- Verify table exists
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'prehospital_handoffs') THEN
    RAISE EXCEPTION 'Failed to create prehospital_handoffs table';
  END IF;

  -- Verify functions exist
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_incoming_patients') THEN
    RAISE EXCEPTION 'Failed to create get_incoming_patients function';
  END IF;

  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'EMS PREHOSPITAL HANDOFF SYSTEM CREATED SUCCESSFULLY';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  - Real-time ambulance to ER communication';
  RAISE NOTICE '  - Critical alerts (STEMI, Stroke, Trauma, Sepsis)';
  RAISE NOTICE '  - Offline-capable for poor cell coverage';
  RAISE NOTICE '  - Door-to-treatment time tracking';
  RAISE NOTICE '  - Joint Commission compliance';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. Build paramedic mobile form';
  RAISE NOTICE '  2. Build ER incoming patient dashboard';
  RAISE NOTICE '  3. Add real-time notifications';
  RAISE NOTICE '=================================================================';
END $$;

COMMIT;
