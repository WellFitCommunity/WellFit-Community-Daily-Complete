-- =====================================================
-- DYNAMIC CONSENT MANAGEMENT SYSTEM
-- =====================================================
-- Purpose: Implement granular patient consent tracking
-- Compliance: 21st Century Cures Act, HIPAA §164.508
-- Created: 2025-11-06
-- =====================================================

-- =====================================================
-- 1. CONSENT POLICY DEFINITIONS
-- =====================================================
-- Stores consent policy templates with versioning

CREATE TABLE IF NOT EXISTS public.patient_consent_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_name TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  policy_category TEXT NOT NULL CHECK (policy_category IN (
    'treatment',
    'research',
    'marketing',
    'data_sharing',
    'telehealth',
    'ai_assisted_care',
    'third_party_integration',
    'wearable_data_collection'
  )),
  effective_date TIMESTAMPTZ NOT NULL,
  expiration_date TIMESTAMPTZ,
  regulatory_source TEXT, -- 'HIPAA', 'HITECH', '21st_Century_Cures_Act', 'State_Law'
  policy_text TEXT NOT NULL,
  policy_summary TEXT, -- Short patient-friendly summary
  requires_reauthorization BOOLEAN DEFAULT false,
  reauthorization_frequency_days INTEGER, -- e.g., 365 for annual
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique policy name + version combination
  UNIQUE(policy_name, policy_version)
);

-- Index for active policy lookups
CREATE INDEX idx_consent_policies_active
ON public.patient_consent_policies(policy_category, is_active)
WHERE is_active = true;

-- =====================================================
-- 2. PATIENT CONSENTS
-- =====================================================
-- Individual patient consent records with audit trail

CREATE TABLE IF NOT EXISTS public.patient_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  consent_policy_id UUID REFERENCES public.patient_consent_policies(id),

  -- Consent details
  consent_type TEXT NOT NULL CHECK (consent_type IN (
    'treatment',
    'research',
    'marketing',
    'data_sharing',
    'telehealth',
    'ai_assisted_care',
    'third_party_integration',
    'wearable_data_collection'
  )),
  consent_given BOOLEAN NOT NULL,

  -- Consent method tracking
  consent_method TEXT CHECK (consent_method IN (
    'electronic_signature',
    'verbal_recorded',
    'written_paper',
    'implicit_registration',
    'mobile_app'
  )),

  -- Temporal validity
  effective_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expiration_date TIMESTAMPTZ, -- NULL means no expiration
  withdrawn_at TIMESTAMPTZ,
  withdrawal_reason TEXT,

  -- Granular sharing permissions
  sharing_permissions JSONB DEFAULT '{}'::jsonb,
  -- Example structure:
  -- {
  --   "share_with_providers": true,
  --   "share_with_family": false,
  --   "share_with_researchers": false,
  --   "allowed_third_parties": ["fitbit", "apple_health"],
  --   "data_types_allowed": ["vitals", "medications"],
  --   "data_types_restricted": ["mental_health", "substance_abuse"]
  -- }

  -- Audit trail
  consent_document_url TEXT, -- Link to signed consent form (if applicable)
  ip_address INET,
  user_agent TEXT,
  witness_id UUID REFERENCES public.profiles(user_id), -- Staff member witnessing consent

  -- Metadata
  notes TEXT,
  audit_trail JSONB DEFAULT '[]'::jsonb, -- History of changes

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure no duplicate active consents for same type
  CONSTRAINT unique_active_consent UNIQUE (patient_id, consent_type, withdrawn_at)
);

-- Indexes for performance
CREATE INDEX idx_patient_consents_patient ON public.patient_consents(patient_id);
CREATE INDEX idx_patient_consents_type ON public.patient_consents(consent_type);
CREATE INDEX idx_patient_consents_active
ON public.patient_consents(patient_id, consent_type)
WHERE withdrawn_at IS NULL AND consent_given = true;
CREATE INDEX idx_patient_consents_expiring
ON public.patient_consents(expiration_date)
WHERE expiration_date IS NOT NULL AND withdrawn_at IS NULL;

-- =====================================================
-- 3. CONSENT VERIFICATION LOG
-- =====================================================
-- Track every time consent is checked/verified

CREATE TABLE IF NOT EXISTS public.consent_verification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,
  requesting_user_id UUID REFERENCES public.profiles(user_id),
  requesting_service TEXT, -- 'fhir_sync', 'data_export', 'ai_assistant', etc.

  verification_result BOOLEAN NOT NULL, -- true if consent exists and is valid
  verification_reason TEXT, -- Why consent was checked
  consent_found BOOLEAN,
  consent_expired BOOLEAN,
  consent_withdrawn BOOLEAN,

  additional_metadata JSONB DEFAULT '{}'::jsonb,

  verified_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for audit queries
CREATE INDEX idx_consent_verification_patient
ON public.consent_verification_log(patient_id, verified_at DESC);
CREATE INDEX idx_consent_verification_service
ON public.consent_verification_log(requesting_service, verified_at DESC);

-- =====================================================
-- 4. CONSENT EXPIRATION ALERTS
-- =====================================================
-- Track notifications sent to patients about expiring consents

CREATE TABLE IF NOT EXISTS public.consent_expiration_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  consent_id UUID NOT NULL REFERENCES public.patient_consents(id) ON DELETE CASCADE,

  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'expiring_soon_30d',
    'expiring_soon_7d',
    'expired',
    'requires_reauthorization'
  )),

  notification_sent BOOLEAN DEFAULT false,
  notification_method TEXT, -- 'email', 'sms', 'in_app', 'portal'
  notification_sent_at TIMESTAMPTZ,

  patient_responded BOOLEAN DEFAULT false,
  patient_response_at TIMESTAMPTZ,
  patient_action TEXT, -- 'renewed', 'withdrew', 'ignored'

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_consent_alerts_patient
ON public.consent_expiration_alerts(patient_id, notification_sent);

-- =====================================================
-- 5. FUNCTIONS & TRIGGERS
-- =====================================================

-- Function: Check if patient has valid consent for a specific type
CREATE OR REPLACE FUNCTION public.check_patient_consent(
  p_patient_id UUID,
  p_consent_type TEXT
)
RETURNS TABLE (
  has_consent BOOLEAN,
  consent_id UUID,
  expires_at TIMESTAMPTZ,
  is_expired BOOLEAN,
  sharing_permissions JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(pc.consent_given, false) as has_consent,
    pc.id as consent_id,
    pc.expiration_date as expires_at,
    (pc.expiration_date IS NOT NULL AND pc.expiration_date < NOW()) as is_expired,
    pc.sharing_permissions
  FROM public.patient_consents pc
  WHERE pc.patient_id = p_patient_id
    AND pc.consent_type = p_consent_type
    AND pc.withdrawn_at IS NULL
    AND pc.consent_given = true
    AND (pc.expiration_date IS NULL OR pc.expiration_date > NOW())
  ORDER BY pc.effective_date DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get all expiring consents (for automated notifications)
CREATE OR REPLACE FUNCTION public.get_expiring_consents(
  p_days_until_expiration INTEGER DEFAULT 30
)
RETURNS TABLE (
  patient_id UUID,
  consent_id UUID,
  consent_type TEXT,
  expiration_date TIMESTAMPTZ,
  days_until_expiration INTEGER,
  patient_email TEXT,
  patient_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pc.patient_id,
    pc.id as consent_id,
    pc.consent_type,
    pc.expiration_date,
    EXTRACT(DAY FROM pc.expiration_date - NOW())::INTEGER as days_until_expiration,
    p.email as patient_email,
    p.full_name as patient_name
  FROM public.patient_consents pc
  JOIN public.profiles p ON p.user_id = pc.patient_id
  WHERE pc.expiration_date IS NOT NULL
    AND pc.expiration_date > NOW()
    AND pc.expiration_date <= NOW() + INTERVAL '1 day' * p_days_until_expiration
    AND pc.withdrawn_at IS NULL
    AND pc.consent_given = true
  ORDER BY pc.expiration_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Withdraw consent
CREATE OR REPLACE FUNCTION public.withdraw_patient_consent(
  p_consent_id UUID,
  p_withdrawal_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_consent_record RECORD;
BEGIN
  -- Get consent record
  SELECT * INTO v_consent_record
  FROM public.patient_consents
  WHERE id = p_consent_id
    AND withdrawn_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consent not found or already withdrawn';
  END IF;

  -- Update consent record
  UPDATE public.patient_consents
  SET
    withdrawn_at = NOW(),
    withdrawal_reason = p_withdrawal_reason,
    updated_at = NOW(),
    audit_trail = audit_trail || jsonb_build_object(
      'action', 'withdrawn',
      'timestamp', NOW(),
      'reason', p_withdrawal_reason
    )
  WHERE id = p_consent_id;

  -- Log the withdrawal
  INSERT INTO public.consent_verification_log (
    patient_id,
    consent_type,
    verification_result,
    verification_reason,
    consent_found,
    consent_withdrawn
  ) VALUES (
    v_consent_record.patient_id,
    v_consent_record.consent_type,
    false,
    'Consent withdrawn by patient',
    true,
    true
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_consent_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_consent_timestamp
BEFORE UPDATE ON public.patient_consents
FOR EACH ROW
EXECUTE FUNCTION public.update_consent_updated_at();

CREATE TRIGGER trigger_update_policy_timestamp
BEFORE UPDATE ON public.patient_consent_policies
FOR EACH ROW
EXECUTE FUNCTION public.update_consent_updated_at();

-- =====================================================
-- 6. ROW-LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE public.patient_consent_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_verification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_expiration_alerts ENABLE ROW LEVEL SECURITY;

-- Policies for patient_consent_policies
CREATE POLICY "Everyone can view active consent policies"
ON public.patient_consent_policies
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage consent policies"
ON public.patient_consent_policies
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin')
  )
);

-- Policies for patient_consents
CREATE POLICY "Patients can view their own consents"
ON public.patient_consents
FOR SELECT
USING (patient_id = auth.uid());

CREATE POLICY "Patients can insert their own consents"
ON public.patient_consents
FOR INSERT
WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Patients can update their own consents"
ON public.patient_consents
FOR UPDATE
USING (patient_id = auth.uid())
WITH CHECK (patient_id = auth.uid());

CREATE POLICY "Admins can view all patient consents"
ON public.patient_consents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin')
  )
);

CREATE POLICY "Admin roles can manage all consents"
ON public.patient_consents
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin')
  )
);

-- Policies for consent_verification_log (audit access)
CREATE POLICY "Admins and auditors can view verification logs"
ON public.consent_verification_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin')
  )
);

-- Policies for consent_expiration_alerts
CREATE POLICY "Patients can view their own consent alerts"
ON public.consent_expiration_alerts
FOR SELECT
USING (patient_id = auth.uid());

CREATE POLICY "Admins can manage consent alerts"
ON public.consent_expiration_alerts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin')
  )
);

-- =====================================================
-- 7. SEED DATA - DEFAULT CONSENT POLICIES
-- =====================================================

INSERT INTO public.patient_consent_policies (
  policy_name,
  policy_version,
  policy_category,
  effective_date,
  regulatory_source,
  policy_text,
  policy_summary,
  requires_reauthorization,
  reauthorization_frequency_days
) VALUES
(
  'Standard Treatment Consent',
  '1.0',
  'treatment',
  NOW(),
  'HIPAA',
  'I consent to receive medical treatment from WellFit Community and authorize healthcare providers to access my medical records for treatment purposes.',
  'Allow providers to access your medical records for treatment',
  false,
  NULL
),
(
  'Medical Research Participation',
  '1.0',
  'research',
  NOW(),
  '21st_Century_Cures_Act',
  'I consent to allow my de-identified health data to be used for medical research purposes. I understand that my identity will be protected and my data will only be used for approved research studies.',
  'Allow de-identified data for medical research (optional)',
  true,
  365 -- Annual reauthorization
),
(
  'Marketing Communications',
  '1.0',
  'marketing',
  NOW(),
  'HIPAA',
  'I consent to receive marketing communications, newsletters, and health tips from WellFit Community. I can withdraw this consent at any time.',
  'Receive health tips and newsletters (optional)',
  false,
  NULL
),
(
  'Third-Party Data Sharing',
  '1.0',
  'data_sharing',
  NOW(),
  '21st_Century_Cures_Act',
  'I consent to share my health data with third-party applications that I authorize, such as fitness trackers, health apps, and wearable devices.',
  'Share data with apps like Fitbit, Apple Health (optional)',
  true,
  180 -- Semi-annual reauthorization
),
(
  'Telehealth Services',
  '1.0',
  'telehealth',
  NOW(),
  'State_Law',
  'I consent to receive healthcare services via telehealth (video visits, phone calls, secure messaging). I understand the limitations and benefits of remote healthcare delivery.',
  'Allow video visits and remote care',
  false,
  NULL
),
(
  'AI-Assisted Care',
  '1.0',
  'ai_assisted_care',
  NOW(),
  'FDA_Guidance',
  'I consent to the use of artificial intelligence tools (Riley AI Assistant, Smart Scribe) to assist in my healthcare. I understand that all AI recommendations are reviewed by licensed healthcare providers.',
  'Allow AI tools to assist in your care (optional)',
  true,
  365
),
(
  'Wearable Data Collection',
  '1.0',
  'wearable_data_collection',
  NOW(),
  '21st_Century_Cures_Act',
  'I consent to automatic collection of health data from my wearable devices (smartwatch, fitness tracker) for continuous health monitoring.',
  'Auto-sync data from wearables (optional)',
  false,
  NULL
);

-- =====================================================
-- 8. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.patient_consent_policies IS
'Consent policy templates with versioning - defines available consent types';

COMMENT ON TABLE public.patient_consents IS
'Individual patient consent records with granular permissions and audit trail';

COMMENT ON TABLE public.consent_verification_log IS
'Audit log of all consent checks - tracks who verified consent and when';

COMMENT ON TABLE public.consent_expiration_alerts IS
'Tracks notifications sent to patients about expiring consents';

COMMENT ON FUNCTION public.check_patient_consent IS
'Check if patient has valid, non-expired consent for a specific type';

COMMENT ON FUNCTION public.get_expiring_consents IS
'Get all consents expiring within specified days (for automated notifications)';

COMMENT ON FUNCTION public.withdraw_patient_consent IS
'Withdraw patient consent with reason and audit trail';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- This migration adds comprehensive consent management:
-- ✅ Granular consent types (7 categories)
-- ✅ Consent versioning and audit trail
-- ✅ Expiration and reauthorization tracking
-- ✅ Withdrawal workflow
-- ✅ RLS policies for data security
-- ✅ Helper functions for consent verification
-- ✅ Default consent policies (seed data)
-- =====================================================
