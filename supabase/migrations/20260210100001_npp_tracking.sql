-- ============================================================================
-- Notice of Privacy Practices (NPP) Tracking
-- 45 CFR 164.520: Notice of Privacy Practices for PHI
-- ============================================================================

-- NPP versions table (versioned NPP content per tenant)
CREATE TABLE IF NOT EXISTS public.npp_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  version_number TEXT NOT NULL,
  effective_date DATE NOT NULL,
  content_hash TEXT NOT NULL,
  summary TEXT,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  published_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, version_number)
);

-- NPP acknowledgments table (patient acknowledgment tracking)
CREATE TABLE IF NOT EXISTS public.npp_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  patient_id UUID NOT NULL REFERENCES auth.users(id),
  npp_version_id UUID NOT NULL REFERENCES public.npp_versions(id),
  acknowledgment_type TEXT NOT NULL DEFAULT 'electronic'
    CHECK (acknowledgment_type IN ('electronic', 'signed', 'verbal', 'refused')),
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  refusal_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(patient_id, npp_version_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_npp_versions_tenant ON public.npp_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_npp_versions_current ON public.npp_versions(tenant_id, is_current) WHERE is_current = TRUE;
CREATE INDEX IF NOT EXISTS idx_npp_acknowledgments_patient ON public.npp_acknowledgments(patient_id);
CREATE INDEX IF NOT EXISTS idx_npp_acknowledgments_tenant ON public.npp_acknowledgments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_npp_acknowledgments_version ON public.npp_acknowledgments(npp_version_id);

-- RLS
ALTER TABLE public.npp_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.npp_acknowledgments ENABLE ROW LEVEL SECURITY;

-- NPP versions: anyone in tenant can read, admins can insert/update
CREATE POLICY npp_versions_tenant_read ON public.npp_versions
  FOR SELECT USING (tenant_id = (SELECT get_current_tenant_id()));

CREATE POLICY npp_versions_admin_insert ON public.npp_versions
  FOR INSERT WITH CHECK (tenant_id = (SELECT get_current_tenant_id()));

CREATE POLICY npp_versions_admin_update ON public.npp_versions
  FOR UPDATE USING (tenant_id = (SELECT get_current_tenant_id()));

-- NPP acknowledgments: patients can read/insert own, admins can read all in tenant
CREATE POLICY npp_ack_patient_read ON public.npp_acknowledgments
  FOR SELECT USING (
    patient_id = auth.uid()
    OR tenant_id = (SELECT get_current_tenant_id())
  );

CREATE POLICY npp_ack_patient_insert ON public.npp_acknowledgments
  FOR INSERT WITH CHECK (
    patient_id = auth.uid()
    AND tenant_id = (SELECT get_current_tenant_id())
  );

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.npp_versions TO authenticated;
GRANT SELECT, INSERT ON public.npp_acknowledgments TO authenticated;

-- Updated_at trigger for npp_versions
CREATE TRIGGER set_npp_versions_updated_at
  BEFORE UPDATE ON public.npp_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
