-- ============================================================================
-- Business Associate Agreement (BAA) Tracking
-- 45 CFR 164.502(e): Business Associate Contracts
-- ============================================================================

-- Business Associate Agreements table
CREATE TABLE IF NOT EXISTS public.business_associate_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  associate_name TEXT NOT NULL,
  associate_type TEXT NOT NULL DEFAULT 'vendor'
    CHECK (associate_type IN ('vendor', 'subcontractor', 'clearinghouse', 'cloud_provider', 'ehr_vendor', 'other')),
  service_description TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'active', 'expired', 'terminated', 'not_required')),
  effective_date DATE,
  expiration_date DATE,
  renewal_date DATE,
  auto_renew BOOLEAN DEFAULT FALSE,
  baa_document_url TEXT,
  phi_types_shared TEXT[] DEFAULT '{}',
  permitted_uses TEXT,
  security_requirements TEXT,
  breach_notification_terms TEXT,
  termination_terms TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- BAA review history (audit trail)
CREATE TABLE IF NOT EXISTS public.baa_review_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baa_id UUID NOT NULL REFERENCES public.business_associate_agreements(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  reviewed_by UUID NOT NULL REFERENCES auth.users(id),
  review_type TEXT NOT NULL CHECK (review_type IN ('initial_review', 'annual_review', 'renewal', 'amendment', 'termination', 'status_change')),
  previous_status TEXT,
  new_status TEXT,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_baa_tenant ON public.business_associate_agreements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_baa_status ON public.business_associate_agreements(status);
CREATE INDEX IF NOT EXISTS idx_baa_expiration ON public.business_associate_agreements(expiration_date);
CREATE INDEX IF NOT EXISTS idx_baa_review_history_baa ON public.baa_review_history(baa_id);
CREATE INDEX IF NOT EXISTS idx_baa_review_history_tenant ON public.baa_review_history(tenant_id);

-- RLS
ALTER TABLE public.business_associate_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baa_review_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY baa_tenant_read ON public.business_associate_agreements
  FOR SELECT USING (tenant_id = (SELECT get_current_tenant_id()));

CREATE POLICY baa_tenant_insert ON public.business_associate_agreements
  FOR INSERT WITH CHECK (tenant_id = (SELECT get_current_tenant_id()));

CREATE POLICY baa_tenant_update ON public.business_associate_agreements
  FOR UPDATE USING (tenant_id = (SELECT get_current_tenant_id()));

CREATE POLICY baa_review_tenant_read ON public.baa_review_history
  FOR SELECT USING (tenant_id = (SELECT get_current_tenant_id()));

CREATE POLICY baa_review_tenant_insert ON public.baa_review_history
  FOR INSERT WITH CHECK (tenant_id = (SELECT get_current_tenant_id()));

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.business_associate_agreements TO authenticated;
GRANT SELECT, INSERT ON public.baa_review_history TO authenticated;

-- Updated_at trigger
CREATE TRIGGER set_baa_updated_at
  BEFORE UPDATE ON public.business_associate_agreements
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
