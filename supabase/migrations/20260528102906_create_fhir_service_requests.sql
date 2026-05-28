-- ============================================================================
-- FHIR R4 ServiceRequest table — ONC 170.315(a)(2) Lab CPOE + (a)(3) Imaging
-- ============================================================================
--
-- Live DB state (verified 2026-05-28 via Supabase MCP execute_sql per Rule #18):
--   • No fhir_service_requests table existed before this migration.
--   • fhir_diagnostic_reports + fhir_observations exist for RESULTS; this
--     table is the ORDER side of the same flow.
--
-- One table serves BOTH lab orders (ONC-2) and imaging orders (ONC-3). The
-- `category` array discriminates: ['laboratory'] vs ['imaging']. This matches
-- the FHIR R4 ServiceRequest spec where category is multi-valued and used to
-- segment order types.
--
-- @see https://hl7.org/fhir/R4/servicerequest.html
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fhir_service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fhir_id TEXT NOT NULL UNIQUE,
  tenant_id UUID REFERENCES public.tenants(id),
  patient_id UUID NOT NULL,

  -- FHIR R4 status / intent (mirrors MedicationRequest values)
  status TEXT NOT NULL
    CHECK (status IN ('draft', 'active', 'on-hold', 'revoked', 'completed', 'entered-in-error', 'unknown')),
  intent TEXT NOT NULL
    CHECK (intent IN ('proposal', 'plan', 'directive', 'order', 'original-order', 'reflex-order', 'filler-order', 'instance-order', 'option')),

  -- Category — discriminates lab vs imaging vs other. Multi-valued per FHIR.
  -- Common values: 'laboratory', 'imaging', 'counselling', 'education',
  -- 'surgical-procedure'. Caller fills this on insert.
  category TEXT[] NOT NULL,

  -- What is being ordered. LOINC for labs, RadLex/CPT for imaging, SNOMED for procedures.
  code_system TEXT,
  code TEXT NOT NULL,
  code_display TEXT NOT NULL,

  -- Priority (FHIR R4 RequestPriority value set — same enum as MedicationRequest)
  priority TEXT CHECK (priority IN ('routine', 'urgent', 'asap', 'stat')),

  -- Authoring
  authored_on TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Requester / performer
  requester_type TEXT,
  requester_id UUID,
  requester_display TEXT,
  requester_practitioner_id UUID,
  performer_type TEXT,
  performer_id UUID,
  performer_display TEXT,

  -- Clinical context
  reason_code TEXT[],
  reason_reference TEXT[],
  encounter_id UUID,

  -- Specimen (primarily lab, but FHIR allows on any ServiceRequest)
  -- Free-text specimen type for MVP. FHIR Specimen resource linkage is a
  -- USCDI v3 best-practice add-on; not required for (a)(2) certification.
  specimen_type TEXT,

  -- Lab-specific (boolean flag rather than a full pre-procedure-instruction list)
  fasting_required BOOLEAN,

  -- Imaging-specific (used by ONC-3 — body site, contrast, laterality)
  body_site TEXT,
  body_site_laterality TEXT CHECK (body_site_laterality IN ('left', 'right', 'bilateral') OR body_site_laterality IS NULL),
  contrast_required BOOLEAN,

  -- Occurrence — when the service should be performed
  occurrence_datetime TIMESTAMPTZ,
  occurrence_period_start TIMESTAMPTZ,
  occurrence_period_end TIMESTAMPTZ,

  -- Notes & instructions
  note TEXT,
  patient_instruction TEXT,

  -- Sync metadata (for external EHR integration)
  last_synced_at TIMESTAMPTZ,
  sync_source TEXT,
  external_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Indexes — match the access patterns of MedicationRequestService
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_fhir_service_requests_tenant
  ON public.fhir_service_requests(tenant_id);

CREATE INDEX IF NOT EXISTS idx_fhir_service_requests_patient
  ON public.fhir_service_requests(patient_id);

CREATE INDEX IF NOT EXISTS idx_fhir_service_requests_category
  ON public.fhir_service_requests USING gin(category);

CREATE INDEX IF NOT EXISTS idx_fhir_service_requests_status_authored
  ON public.fhir_service_requests(status, authored_on DESC);

-- ----------------------------------------------------------------------------
-- updated_at trigger (re-uses the existing FHIR med request function pattern)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_fhir_service_request_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_fhir_service_request_updated_at ON public.fhir_service_requests;
CREATE TRIGGER update_fhir_service_request_updated_at
BEFORE UPDATE ON public.fhir_service_requests
FOR EACH ROW EXECUTE FUNCTION public.update_fhir_service_request_updated_at();

-- ----------------------------------------------------------------------------
-- RLS — same policy shape as fhir_medication_requests
-- ----------------------------------------------------------------------------

ALTER TABLE public.fhir_service_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY fhir_service_requests_select
  ON public.fhir_service_requests
  FOR SELECT
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

CREATE POLICY fhir_service_requests_insert
  ON public.fhir_service_requests
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant_id());

-- UPDATE policy must have BOTH USING and WITH CHECK — otherwise a tenant
-- admin who can update a row could mutate tenant_id to a different tenant
-- (the API-3a gap from 2026-05-27 — pre-commit rule #16 enforces this).
CREATE POLICY fhir_service_requests_update
  ON public.fhir_service_requests
  FOR UPDATE
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin())
  WITH CHECK (tenant_id = get_current_tenant_id() AND is_tenant_admin());

CREATE POLICY fhir_service_requests_delete
  ON public.fhir_service_requests
  FOR DELETE
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

-- ----------------------------------------------------------------------------
-- Comments — document the order-type discriminator
-- ----------------------------------------------------------------------------

COMMENT ON TABLE public.fhir_service_requests IS
  'FHIR R4 ServiceRequest — order resource for labs (ONC 170.315(a)(2)), imaging (ONC 170.315(a)(3)), and other procedures. Category array discriminates order type. Results live in fhir_diagnostic_reports / fhir_observations.';

COMMENT ON COLUMN public.fhir_service_requests.category IS
  'FHIR R4 ServiceRequest.category (multi-valued). Common codes: laboratory, imaging, counselling, education, surgical-procedure. Acts as the order-type discriminator for filtering and routing.';

COMMENT ON COLUMN public.fhir_service_requests.code IS
  'FHIR ServiceRequest.code — test/procedure being ordered. LOINC for labs, RadLex or CPT for imaging, SNOMED CT for procedures.';

COMMENT ON COLUMN public.fhir_service_requests.specimen_type IS
  'Lab-order context. For ONC (a)(2): blood, urine, saliva, stool, etc. Free-text MVP; future migration may link to fhir_specimens.';

COMMENT ON COLUMN public.fhir_service_requests.fasting_required IS
  'Lab-order context. NULL when not applicable.';

COMMENT ON COLUMN public.fhir_service_requests.body_site IS
  'Imaging-order context. For ONC (a)(3): chest, abdomen, left knee, etc. NULL when not applicable.';
