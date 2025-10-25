-- Fix missing patient admission tracking for Nurse OS
-- This migration adds proper admission tracking infrastructure

-- Enable btree_gist extension for EXCLUDE constraint
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Create patient_admissions table for proper admission/discharge tracking
CREATE TABLE IF NOT EXISTS public.patient_admissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admission_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  discharge_date TIMESTAMPTZ,
  facility_unit TEXT,
  room_number TEXT,
  attending_physician_id UUID REFERENCES fhir_practitioners(id),
  admission_diagnosis TEXT,
  is_active BOOLEAN GENERATED ALWAYS AS (discharge_date IS NULL) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure only one active admission per patient
  CONSTRAINT unique_active_admission EXCLUDE USING gist (
    patient_id WITH =,
    tstzrange(admission_date, COALESCE(discharge_date, 'infinity'::timestamptz), '[)') WITH &&
  )
);

-- 2. Create indexes
CREATE INDEX idx_patient_admissions_patient ON public.patient_admissions(patient_id);
CREATE INDEX idx_patient_admissions_active ON public.patient_admissions(patient_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_patient_admissions_dates ON public.patient_admissions(admission_date DESC, discharge_date);

-- 3. Enable RLS
ALTER TABLE public.patient_admissions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
CREATE POLICY "Nurses can view admissions"
  ON public.patient_admissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()::uuid
      AND profiles.role IN ('nurse', 'physician', 'admin')
    )
  );

CREATE POLICY "Nurses can create admissions"
  ON public.patient_admissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()::uuid
      AND profiles.role IN ('nurse', 'physician', 'admin')
    )
  );

CREATE POLICY "Nurses can update admissions"
  ON public.patient_admissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()::uuid
      AND profiles.role IN ('nurse', 'physician', 'admin')
    )
  );

-- 5. Trigger for updated_at
CREATE TRIGGER update_patient_admissions_updated_at
  BEFORE UPDATE ON public.patient_admissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. Helper function to get currently admitted patients
CREATE OR REPLACE FUNCTION public.get_admitted_patients()
RETURNS TABLE (
  patient_id UUID,
  patient_name TEXT,
  room_number TEXT,
  facility_unit TEXT,
  admission_date TIMESTAMPTZ,
  days_admitted INTEGER,
  attending_physician_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pa.patient_id,
    COALESCE(p.first_name || ' ' || p.last_name, 'Unknown') AS patient_name,
    pa.room_number,
    pa.facility_unit,
    pa.admission_date,
    EXTRACT(DAY FROM NOW() - pa.admission_date)::INTEGER AS days_admitted,
    pa.attending_physician_id
  FROM public.patient_admissions pa
  LEFT JOIN public.profiles p ON p.user_id = pa.patient_id
  WHERE pa.is_active = TRUE
  AND p.role = 'senior'
  ORDER BY pa.room_number NULLS LAST, pa.admission_date DESC;
END;
$$;

-- 7. Function to admit patient (replaces missing logic in shiftHandoffService.ts)
CREATE OR REPLACE FUNCTION public.admit_patient(
  p_patient_id UUID,
  p_room_number TEXT,
  p_facility_unit TEXT DEFAULT NULL,
  p_attending_physician_id UUID DEFAULT NULL,
  p_admission_diagnosis TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admission_id UUID;
  v_patient_role TEXT;
BEGIN
  -- Verify patient exists and is a senior
  SELECT role INTO v_patient_role
  FROM public.profiles
  WHERE user_id = p_patient_id;

  IF v_patient_role IS NULL THEN
    RAISE EXCEPTION 'Patient not found';
  END IF;

  IF v_patient_role != 'senior' THEN
    RAISE EXCEPTION 'User is not a patient (role: %)', v_patient_role;
  END IF;

  -- Check for existing active admission
  IF EXISTS (
    SELECT 1 FROM public.patient_admissions
    WHERE patient_id = p_patient_id AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Patient already has an active admission';
  END IF;

  -- Create admission
  INSERT INTO public.patient_admissions (
    patient_id,
    room_number,
    facility_unit,
    attending_physician_id,
    admission_diagnosis
  ) VALUES (
    p_patient_id,
    p_room_number,
    p_facility_unit,
    p_attending_physician_id,
    p_admission_diagnosis
  )
  RETURNING id INTO v_admission_id;

  -- Update profiles.room_number for backward compatibility
  UPDATE public.profiles
  SET room_number = p_room_number
  WHERE user_id = p_patient_id;

  -- Log admission
  INSERT INTO public.audit_phi_access (
    user_id,
    resource_type,
    resource_id,
    action,
    ip_address
  ) VALUES (
    auth.uid()::uuid,
    'patient_admission',
    v_admission_id,
    'ADMIT_PATIENT',
    inet_client_addr()::text
  );

  RETURN v_admission_id;
END;
$$;

-- 8. Function to discharge patient
CREATE OR REPLACE FUNCTION public.discharge_patient(
  p_patient_id UUID,
  p_discharge_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admission_id UUID;
BEGIN
  -- Find active admission
  SELECT id INTO v_admission_id
  FROM public.patient_admissions
  WHERE patient_id = p_patient_id AND is_active = TRUE
  LIMIT 1;

  IF v_admission_id IS NULL THEN
    RAISE EXCEPTION 'No active admission found for patient';
  END IF;

  -- Discharge
  UPDATE public.patient_admissions
  SET
    discharge_date = NOW(),
    updated_at = NOW()
  WHERE id = v_admission_id;

  -- Log discharge
  INSERT INTO public.audit_phi_access (
    user_id,
    resource_type,
    resource_id,
    action,
    ip_address,
    details
  ) VALUES (
    auth.uid()::uuid,
    'patient_admission',
    v_admission_id,
    'DISCHARGE_PATIENT',
    inet_client_addr()::text,
    jsonb_build_object('notes', p_discharge_notes)
  );

  RETURN TRUE;
END;
$$;

-- 9. Grant permissions
GRANT SELECT ON public.patient_admissions TO authenticated;
GRANT INSERT, UPDATE ON public.patient_admissions TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admitted_patients() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admit_patient(UUID, TEXT, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.discharge_patient(UUID, TEXT) TO authenticated;

COMMENT ON TABLE public.patient_admissions IS 'Tracks patient admission and discharge events for hospital units';
COMMENT ON FUNCTION public.admit_patient IS 'Admits a patient to a hospital unit, creating admission record and updating profile';
COMMENT ON FUNCTION public.discharge_patient IS 'Discharges a patient from active admission status';
