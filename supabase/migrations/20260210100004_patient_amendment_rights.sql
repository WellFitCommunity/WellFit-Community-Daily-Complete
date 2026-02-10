-- ============================================================================
-- Patient Amendment Rights
-- 45 CFR 164.526: Right to Amend PHI
-- ============================================================================

-- Patient amendment requests (patient-initiated, distinct from clinical note amendments)
CREATE TABLE IF NOT EXISTS public.patient_amendment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  patient_id UUID NOT NULL REFERENCES auth.users(id),
  request_number TEXT NOT NULL,
  record_type TEXT NOT NULL
    CHECK (record_type IN ('demographics', 'conditions', 'medications', 'allergies', 'vitals', 'lab_results', 'care_plans', 'clinical_notes', 'other')),
  record_description TEXT NOT NULL,
  current_value TEXT,
  requested_value TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'under_review', 'accepted', 'denied', 'withdrawn')),
  response_deadline TIMESTAMPTZ NOT NULL,

  -- Clinical review fields
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_decision TEXT CHECK (review_decision IN ('accepted', 'denied')),
  denial_reason TEXT,

  -- Patient disagreement statement (45 CFR 164.526(d))
  disagreement_statement TEXT,
  disagreement_filed_at TIMESTAMPTZ,

  -- Rebuttal from covered entity
  rebuttal_statement TEXT,
  rebuttal_filed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Generate sequential request numbers per tenant
CREATE OR REPLACE FUNCTION generate_amendment_request_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(request_number FROM 'AMR-(\d+)') AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.patient_amendment_requests
  WHERE tenant_id = NEW.tenant_id;

  NEW.request_number := 'AMR-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_amendment_request_number
  BEFORE INSERT ON public.patient_amendment_requests
  FOR EACH ROW
  WHEN (NEW.request_number IS NULL OR NEW.request_number = '')
  EXECUTE FUNCTION generate_amendment_request_number();

-- Set 60-day response deadline
CREATE OR REPLACE FUNCTION set_amendment_response_deadline()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.response_deadline IS NULL THEN
    NEW.response_deadline := NEW.created_at + INTERVAL '60 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_amendment_deadline
  BEFORE INSERT ON public.patient_amendment_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_amendment_response_deadline();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_patient_amendments_tenant ON public.patient_amendment_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patient_amendments_patient ON public.patient_amendment_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_amendments_status ON public.patient_amendment_requests(status);
CREATE INDEX IF NOT EXISTS idx_patient_amendments_deadline ON public.patient_amendment_requests(response_deadline);

-- RLS
ALTER TABLE public.patient_amendment_requests ENABLE ROW LEVEL SECURITY;

-- Patients can read/insert own requests
CREATE POLICY patient_amendments_own_read ON public.patient_amendment_requests
  FOR SELECT USING (
    patient_id = auth.uid()
    OR tenant_id = (SELECT get_current_tenant_id())
  );

CREATE POLICY patient_amendments_own_insert ON public.patient_amendment_requests
  FOR INSERT WITH CHECK (
    patient_id = auth.uid()
    AND tenant_id = (SELECT get_current_tenant_id())
  );

-- Clinical staff can update (review) within tenant
CREATE POLICY patient_amendments_staff_update ON public.patient_amendment_requests
  FOR UPDATE USING (tenant_id = (SELECT get_current_tenant_id()));

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.patient_amendment_requests TO authenticated;

-- Updated_at trigger
CREATE TRIGGER set_patient_amendments_updated_at
  BEFORE UPDATE ON public.patient_amendment_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
