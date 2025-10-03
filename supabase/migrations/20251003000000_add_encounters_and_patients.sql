-- Add Encounters tables for Project Atlas billing
-- Following WellFit standard: patient_id references auth.users(id) directly
-- migrate:up
begin;

-- Ensure helper function exists
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- is_admin function already exists in production, no need to recreate

-- 1. ENCOUNTERS table (patient visits/sessions)
-- patient_id references auth.users directly (no separate patients table)
CREATE TABLE IF NOT EXISTS public.encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES public.billing_providers(id) ON DELETE SET NULL,
  payer_id uuid REFERENCES public.billing_payers(id) ON DELETE SET NULL,
  date_of_service date NOT NULL,
  place_of_service text DEFAULT '11',  -- 11 = Office
  claim_frequency_code text DEFAULT '1',  -- 1 = Original
  subscriber_relation_code text DEFAULT '18',  -- 18 = Self
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'submitted', 'paid', 'denied')),
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_encounters_patient ON public.encounters(patient_id);
CREATE INDEX IF NOT EXISTS idx_encounters_provider ON public.encounters(provider_id);
CREATE INDEX IF NOT EXISTS idx_encounters_service_date ON public.encounters(date_of_service);
CREATE INDEX IF NOT EXISTS idx_encounters_status ON public.encounters(status);

DROP TRIGGER IF EXISTS trg_encounters_uat ON public.encounters;
CREATE TRIGGER trg_encounters_uat
BEFORE UPDATE ON public.encounters
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.encounters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "encounters_admin_rw_owner_r" ON public.encounters;
CREATE POLICY "encounters_admin_rw_owner_r" ON public.encounters
  USING (public.is_admin(auth.uid()) OR created_by = auth.uid() OR patient_id = auth.uid())
  WITH CHECK (public.is_admin(auth.uid()) OR created_by = auth.uid());

-- 2. ENCOUNTER_PROCEDURES table (CPT codes per encounter)
CREATE TABLE IF NOT EXISTS public.encounter_procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  code text NOT NULL,
  charge_amount numeric(12,2),
  units numeric(12,2) DEFAULT 1,
  modifiers text[],
  service_date date,
  diagnosis_pointers integer[],
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_encounter_procedures_encounter ON public.encounter_procedures(encounter_id);
CREATE INDEX IF NOT EXISTS idx_encounter_procedures_code ON public.encounter_procedures(code);

DROP TRIGGER IF EXISTS trg_encounter_procedures_uat ON public.encounter_procedures;
CREATE TRIGGER trg_encounter_procedures_uat
BEFORE UPDATE ON public.encounter_procedures
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.encounter_procedures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "encounter_procedures_admin_rw" ON public.encounter_procedures;
CREATE POLICY "encounter_procedures_admin_rw" ON public.encounter_procedures
  USING (
    public.is_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.encounters e WHERE e.id = encounter_procedures.encounter_id AND (e.created_by = auth.uid() OR e.patient_id = auth.uid()))
  )
  WITH CHECK (
    public.is_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.encounters e WHERE e.id = encounter_procedures.encounter_id AND e.created_by = auth.uid())
  );

-- 3. ENCOUNTER_DIAGNOSES table (ICD-10 codes per encounter)
CREATE TABLE IF NOT EXISTS public.encounter_diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  code text NOT NULL,
  sequence integer NOT NULL DEFAULT 1,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_encounter_diagnoses_encounter ON public.encounter_diagnoses(encounter_id);
CREATE INDEX IF NOT EXISTS idx_encounter_diagnoses_code ON public.encounter_diagnoses(code);

DROP TRIGGER IF EXISTS trg_encounter_diagnoses_uat ON public.encounter_diagnoses;
CREATE TRIGGER trg_encounter_diagnoses_uat
BEFORE UPDATE ON public.encounter_diagnoses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.encounter_diagnoses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "encounter_diagnoses_admin_rw" ON public.encounter_diagnoses;
CREATE POLICY "encounter_diagnoses_admin_rw" ON public.encounter_diagnoses
  USING (
    public.is_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.encounters e WHERE e.id = encounter_diagnoses.encounter_id AND (e.created_by = auth.uid() OR e.patient_id = auth.uid()))
  )
  WITH CHECK (
    public.is_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.encounters e WHERE e.id = encounter_diagnoses.encounter_id AND e.created_by = auth.uid())
  );

-- 4. CLINICAL_NOTES table (SOAP notes)
CREATE TABLE IF NOT EXISTS public.clinical_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('assessment', 'plan', 'subjective', 'objective', 'general', 'hpi', 'ros')),
  content text NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinical_notes_encounter ON public.clinical_notes(encounter_id);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_type ON public.clinical_notes(type);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_author ON public.clinical_notes(author_id);

DROP TRIGGER IF EXISTS trg_clinical_notes_uat ON public.clinical_notes;
CREATE TRIGGER trg_clinical_notes_uat
BEFORE UPDATE ON public.clinical_notes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clinical_notes_admin_rw" ON public.clinical_notes;
CREATE POLICY "clinical_notes_admin_rw" ON public.clinical_notes
  USING (
    public.is_admin(auth.uid()) OR
    author_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.encounters e WHERE e.id = clinical_notes.encounter_id AND (e.created_by = auth.uid() OR e.patient_id = auth.uid()))
  )
  WITH CHECK (
    public.is_admin(auth.uid()) OR
    author_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.encounters e WHERE e.id = clinical_notes.encounter_id AND e.created_by = auth.uid())
  );

-- Comments for documentation
COMMENT ON TABLE public.encounters IS 'Patient visits/sessions that can be billed to insurance - patient_id references auth.users';
COMMENT ON TABLE public.encounter_procedures IS 'CPT procedure codes for each encounter';
COMMENT ON TABLE public.encounter_diagnoses IS 'ICD-10 diagnosis codes for each encounter';
COMMENT ON TABLE public.clinical_notes IS 'Clinical documentation (SOAP notes) for encounters';

commit;

-- migrate:down
begin;

DROP TABLE IF EXISTS public.clinical_notes CASCADE;
DROP TABLE IF EXISTS public.encounter_diagnoses CASCADE;
DROP TABLE IF EXISTS public.encounter_procedures CASCADE;
DROP TABLE IF EXISTS public.encounters CASCADE;

commit;
