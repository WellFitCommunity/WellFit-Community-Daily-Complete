-- Add patient and encounter linkage to prehospital_handoffs
-- Enables EMS handoffs to create patient records and encounters

BEGIN;

-- Add patient and encounter linkage columns
ALTER TABLE public.prehospital_handoffs
  ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS integrated_at TIMESTAMPTZ;

-- Add indexes for lookups
CREATE INDEX IF NOT EXISTS idx_prehospital_handoffs_patient
  ON public.prehospital_handoffs(patient_id) WHERE patient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prehospital_handoffs_encounter
  ON public.prehospital_handoffs(encounter_id) WHERE encounter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prehospital_handoffs_integrated
  ON public.prehospital_handoffs(integrated_at) WHERE integrated_at IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.prehospital_handoffs.patient_id IS
  'Link to patient record created from EMS handoff (may be temporary record)';

COMMENT ON COLUMN public.prehospital_handoffs.encounter_id IS
  'Link to ER encounter created from this EMS handoff';

COMMENT ON COLUMN public.prehospital_handoffs.integrated_at IS
  'Timestamp when handoff was integrated into patient chart (creates encounter + vitals)';

COMMIT;
