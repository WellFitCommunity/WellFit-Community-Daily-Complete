-- ============================================================================
-- Breach Notification Engine
-- 45 CFR 164.400-414: HIPAA Breach Notification Rule
-- ============================================================================

-- Breach incidents table
CREATE TABLE IF NOT EXISTS public.breach_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  incident_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  discovered_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  occurred_date TIMESTAMPTZ,
  reported_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'reported'
    CHECK (status IN ('reported', 'investigating', 'risk_assessment', 'notification_required', 'notification_in_progress', 'resolved', 'closed_no_notification')),
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  phi_types_involved TEXT[] DEFAULT '{}',
  individuals_affected INTEGER DEFAULT 0,
  breach_type TEXT NOT NULL DEFAULT 'unauthorized_access'
    CHECK (breach_type IN ('unauthorized_access', 'unauthorized_disclosure', 'loss', 'theft', 'improper_disposal', 'hacking', 'other')),

  -- 4-factor risk assessment (45 CFR 164.402)
  risk_nature_of_phi TEXT,
  risk_unauthorized_person TEXT,
  risk_acquired_or_viewed TEXT,
  risk_mitigation_applied TEXT,
  risk_assessment_result TEXT CHECK (risk_assessment_result IN ('low_probability', 'notification_required')),
  risk_assessed_by UUID REFERENCES auth.users(id),
  risk_assessed_at TIMESTAMPTZ,

  -- Notification tracking
  notification_plan_created BOOLEAN DEFAULT FALSE,
  hhs_notification_required BOOLEAN DEFAULT FALSE,
  hhs_notified_at TIMESTAMPTZ,
  media_notification_required BOOLEAN DEFAULT FALSE,
  media_notified_at TIMESTAMPTZ,
  individual_notification_deadline TIMESTAMPTZ,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Generate sequential incident numbers per tenant
CREATE OR REPLACE FUNCTION generate_breach_incident_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(incident_number FROM 'BR-(\d+)') AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.breach_incidents
  WHERE tenant_id = NEW.tenant_id;

  NEW.incident_number := 'BR-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_breach_incident_number
  BEFORE INSERT ON public.breach_incidents
  FOR EACH ROW
  WHEN (NEW.incident_number IS NULL OR NEW.incident_number = '')
  EXECUTE FUNCTION generate_breach_incident_number();

-- Breach notifications table (individual notifications sent)
CREATE TABLE IF NOT EXISTS public.breach_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  breach_incident_id UUID NOT NULL REFERENCES public.breach_incidents(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  notification_type TEXT NOT NULL CHECK (notification_type IN ('individual', 'hhs', 'media', 'state_attorney_general')),
  recipient_id UUID REFERENCES auth.users(id),
  recipient_description TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'postal_mail', 'substitute_notice', 'phone')),
  sent_at TIMESTAMPTZ,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'returned')),
  content_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Breach risk assessments (audit trail for the 4-factor analysis)
CREATE TABLE IF NOT EXISTS public.breach_risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  breach_incident_id UUID NOT NULL REFERENCES public.breach_incidents(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  assessed_by UUID NOT NULL REFERENCES auth.users(id),
  factor_1_nature_of_phi JSONB NOT NULL DEFAULT '{}',
  factor_2_unauthorized_person JSONB NOT NULL DEFAULT '{}',
  factor_3_acquired_or_viewed JSONB NOT NULL DEFAULT '{}',
  factor_4_mitigation JSONB NOT NULL DEFAULT '{}',
  overall_risk_level TEXT NOT NULL CHECK (overall_risk_level IN ('low_probability', 'notification_required')),
  rationale TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_breach_incidents_tenant ON public.breach_incidents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_breach_incidents_status ON public.breach_incidents(status);
CREATE INDEX IF NOT EXISTS idx_breach_incidents_discovered ON public.breach_incidents(discovered_date);
CREATE INDEX IF NOT EXISTS idx_breach_notifications_incident ON public.breach_notifications(breach_incident_id);
CREATE INDEX IF NOT EXISTS idx_breach_notifications_tenant ON public.breach_notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_breach_risk_assessments_incident ON public.breach_risk_assessments(breach_incident_id);

-- RLS
ALTER TABLE public.breach_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breach_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breach_risk_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY breach_incidents_tenant_read ON public.breach_incidents
  FOR SELECT USING (tenant_id = (SELECT get_current_tenant_id()));

CREATE POLICY breach_incidents_tenant_insert ON public.breach_incidents
  FOR INSERT WITH CHECK (tenant_id = (SELECT get_current_tenant_id()));

CREATE POLICY breach_incidents_tenant_update ON public.breach_incidents
  FOR UPDATE USING (tenant_id = (SELECT get_current_tenant_id()));

CREATE POLICY breach_notifications_tenant_read ON public.breach_notifications
  FOR SELECT USING (tenant_id = (SELECT get_current_tenant_id()));

CREATE POLICY breach_notifications_tenant_insert ON public.breach_notifications
  FOR INSERT WITH CHECK (tenant_id = (SELECT get_current_tenant_id()));

CREATE POLICY breach_risk_assessments_tenant_read ON public.breach_risk_assessments
  FOR SELECT USING (tenant_id = (SELECT get_current_tenant_id()));

CREATE POLICY breach_risk_assessments_tenant_insert ON public.breach_risk_assessments
  FOR INSERT WITH CHECK (tenant_id = (SELECT get_current_tenant_id()));

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.breach_incidents TO authenticated;
GRANT SELECT, INSERT ON public.breach_notifications TO authenticated;
GRANT SELECT, INSERT ON public.breach_risk_assessments TO authenticated;

-- Updated_at trigger
CREATE TRIGGER set_breach_incidents_updated_at
  BEFORE UPDATE ON public.breach_incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
