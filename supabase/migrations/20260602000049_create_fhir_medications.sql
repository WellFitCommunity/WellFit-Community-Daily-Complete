-- Create the FHIR R4 Medication resource table (drug-DEFINITION catalog).
--
-- Context: docs/trackers/clinical-logic-adversarial-audit-2026-06-01.md (AV-2).
-- MedicationService queried fhir_medications, which did not exist -> every call threw.
-- This is a DEFINITION resource (the abstract drug: code/form/ingredient/manufacturer),
-- distinct from the existing fhir_medication_requests (prescriptions) and the patient-scoped
-- `medications` table (a patient's personal med list). Repointing to either would conflate
-- record types, so the catalog gets its own table — matching the columns MedicationService
-- already selects.
--
-- Drug definitions are non-PHI reference data: authenticated users may READ the catalog;
-- only tenant admins may write it.

CREATE TABLE IF NOT EXISTS public.fhir_medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fhir_id TEXT,
  -- FHIR Medication.code (CodeableConcept), flattened like other fhir_* tables
  code_system TEXT,
  code TEXT,
  code_display TEXT,
  code_text TEXT,
  -- FHIR Medication.status: active | inactive | entered-in-error
  status TEXT CHECK (status IS NULL OR status IN ('active', 'inactive', 'entered-in-error')),
  -- FHIR Medication.manufacturer (Reference(Organization))
  manufacturer_id UUID,
  manufacturer_display TEXT,
  -- FHIR Medication.form (CodeableConcept)
  form JSONB,
  -- FHIR Medication.amount (Ratio)
  amount_numerator NUMERIC,
  amount_denominator NUMERIC,
  -- FHIR Medication.ingredient[] and .batch
  ingredient JSONB,
  batch JSONB,
  tenant_id UUID REFERENCES public.tenants(id),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes matching MedicationService access paths (getByRxNorm: code+code_system; search: code_display)
CREATE INDEX IF NOT EXISTS idx_fhir_medications_code ON public.fhir_medications (code, code_system);
CREATE INDEX IF NOT EXISTS idx_fhir_medications_code_display ON public.fhir_medications (code_display);

ALTER TABLE public.fhir_medications ENABLE ROW LEVEL SECURITY;

-- Reference data: any authenticated user may read the drug catalog (non-PHI).
CREATE POLICY "fhir_medications_select" ON public.fhir_medications
  FOR SELECT TO authenticated USING (true);

-- Only tenant admins may modify the catalog.
CREATE POLICY "fhir_medications_insert" ON public.fhir_medications
  FOR INSERT TO authenticated WITH CHECK (is_tenant_admin());
CREATE POLICY "fhir_medications_update" ON public.fhir_medications
  FOR UPDATE TO authenticated USING (is_tenant_admin()) WITH CHECK (is_tenant_admin());
CREATE POLICY "fhir_medications_delete" ON public.fhir_medications
  FOR DELETE TO authenticated USING (is_tenant_admin());

COMMENT ON TABLE public.fhir_medications IS
  'FHIR R4 Medication resource — drug-definition catalog (non-PHI reference data). Distinct from fhir_medication_requests (orders) and medications (patient med list). See AV-2.';
