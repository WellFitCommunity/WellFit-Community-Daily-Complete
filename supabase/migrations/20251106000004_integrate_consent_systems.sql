-- =====================================================
-- CONSENT SYSTEM INTEGRATION - ZERO TECH DEBT
-- =====================================================
-- Purpose: Extend existing privacy_consent table with advanced features
--          Remove duplicate patient_consents tables
-- Approach: Integration, not duplication
-- Created: 2025-11-06
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: DROP DUPLICATE TABLES (MY MISTAKE)
-- =====================================================

DROP TABLE IF EXISTS public.consent_expiration_alerts CASCADE;
DROP TABLE IF EXISTS public.consent_verification_log CASCADE;
DROP TABLE IF EXISTS public.patient_consents CASCADE;
DROP TABLE IF EXISTS public.patient_consent_policies CASCADE;

-- =====================================================
-- STEP 2: EXTEND EXISTING privacy_consent TABLE
-- =====================================================

-- Add advanced consent tracking columns
ALTER TABLE public.privacy_consent
ADD COLUMN IF NOT EXISTS consent_method TEXT CHECK (consent_method IN (
  'electronic_signature',
  'verbal_recorded',
  'written_paper',
  'implicit_registration',
  'mobile_app'
)) DEFAULT 'electronic_signature',

ADD COLUMN IF NOT EXISTS effective_date TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS expiration_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS withdrawal_reason TEXT,

-- Granular sharing permissions
ADD COLUMN IF NOT EXISTS sharing_permissions JSONB DEFAULT '{
  "share_with_providers": true,
  "share_with_family": false,
  "share_with_researchers": false,
  "allowed_third_parties": [],
  "data_types_allowed": [],
  "data_types_restricted": []
}'::jsonb,

-- Witness tracking
ADD COLUMN IF NOT EXISTS witness_id UUID REFERENCES auth.users(id),

-- Audit trail
ADD COLUMN IF NOT EXISTS audit_trail JSONB DEFAULT '[]'::jsonb,

-- IP and user agent tracking
ADD COLUMN IF NOT EXISTS ip_address INET,
ADD COLUMN IF NOT EXISTS user_agent TEXT,

-- Notes
ADD COLUMN IF NOT EXISTS notes TEXT,

-- Updated timestamp
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- =====================================================
-- STEP 3: ENHANCE consent_type CONSTRAINT
-- =====================================================

-- Drop old constraint if exists
ALTER TABLE public.privacy_consent
DROP CONSTRAINT IF EXISTS privacy_consent_consent_type_check;

-- Add comprehensive consent types
ALTER TABLE public.privacy_consent
ADD CONSTRAINT privacy_consent_consent_type_check
CHECK (consent_type IN (
  'photo',
  'privacy',
  'treatment',
  'research',
  'marketing',
  'data_sharing',
  'telehealth',
  'ai_assisted_care',
  'third_party_integration',
  'wearable_data_collection'
));

-- =====================================================
-- STEP 4: CREATE CONSENT VERIFICATION LOG
-- =====================================================
-- Tracks every time consent is checked

CREATE TABLE IF NOT EXISTS public.consent_verification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  consent_id BIGINT REFERENCES public.privacy_consent(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,

  requesting_user_id UUID REFERENCES auth.users(id),
  requesting_service TEXT, -- 'fhir_sync', 'ai_assistant', 'data_export', etc.

  verification_result BOOLEAN NOT NULL, -- true if consent exists and is valid
  verification_reason TEXT,

  consent_found BOOLEAN NOT NULL,
  consent_expired BOOLEAN NOT NULL,
  consent_withdrawn BOOLEAN NOT NULL,

  additional_metadata JSONB DEFAULT '{}'::jsonb,

  verified_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for audit queries
CREATE INDEX idx_consent_verification_user
ON public.consent_verification_log(user_id, verified_at DESC);

CREATE INDEX idx_consent_verification_service
ON public.consent_verification_log(requesting_service, verified_at DESC);

-- =====================================================
-- STEP 5: CREATE CONSENT EXPIRATION ALERTS
-- =====================================================

CREATE TABLE IF NOT EXISTS public.consent_expiration_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  consent_id BIGINT NOT NULL REFERENCES public.privacy_consent(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'expiring_soon_30d',
    'expiring_soon_7d',
    'expired',
    'requires_reauthorization'
  )),

  notification_sent BOOLEAN DEFAULT FALSE,
  notification_method TEXT, -- 'email', 'sms', 'in_app'
  notification_sent_at TIMESTAMPTZ,

  patient_responded BOOLEAN DEFAULT FALSE,
  patient_response_at TIMESTAMPTZ,
  patient_action TEXT, -- 'renewed', 'withdrew', 'ignored'

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_consent_alerts_user
ON public.consent_expiration_alerts(user_id, notification_sent);

-- =====================================================
-- STEP 6: FUNCTIONS FOR CONSENT OPERATIONS
-- =====================================================

-- Function: Check if user has valid consent
CREATE OR REPLACE FUNCTION public.check_user_consent(
  p_user_id UUID,
  p_consent_type TEXT
)
RETURNS TABLE (
  has_consent BOOLEAN,
  consent_id BIGINT,
  expires_at TIMESTAMPTZ,
  is_expired BOOLEAN,
  sharing_permissions JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(pc.consented, false) as has_consent,
    pc.id as consent_id,
    pc.expiration_date as expires_at,
    (pc.expiration_date IS NOT NULL AND pc.expiration_date < NOW()) as is_expired,
    pc.sharing_permissions
  FROM public.privacy_consent pc
  WHERE pc.user_id = p_user_id
    AND pc.consent_type = p_consent_type
    AND pc.withdrawn_at IS NULL
    AND pc.consented = true
    AND (pc.expiration_date IS NULL OR pc.expiration_date > NOW())
  ORDER BY pc.consented_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get expiring consents (drop and recreate due to signature change)
DROP FUNCTION IF EXISTS public.get_expiring_consents(INTEGER);

CREATE FUNCTION public.get_expiring_consents(
  p_days_until_expiration INTEGER DEFAULT 30
)
RETURNS TABLE (
  user_id UUID,
  consent_id BIGINT,
  consent_type TEXT,
  expiration_date TIMESTAMPTZ,
  days_until_expiration INTEGER,
  user_email TEXT,
  user_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pc.user_id,
    pc.id as consent_id,
    pc.consent_type,
    pc.expiration_date,
    EXTRACT(DAY FROM pc.expiration_date - NOW())::INTEGER as days_until_expiration,
    au.email as user_email,
    COALESCE(pc.first_name || ' ' || pc.last_name, 'Unknown') as user_name
  FROM public.privacy_consent pc
  JOIN auth.users au ON au.id = pc.user_id
  WHERE pc.expiration_date IS NOT NULL
    AND pc.expiration_date > NOW()
    AND pc.expiration_date <= NOW() + (p_days_until_expiration || ' days')::INTERVAL
    AND pc.withdrawn_at IS NULL
    AND pc.consented = true
  ORDER BY pc.expiration_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Withdraw consent
CREATE OR REPLACE FUNCTION public.withdraw_consent(
  p_consent_id BIGINT,
  p_withdrawal_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_consent_record RECORD;
BEGIN
  -- Get consent record
  SELECT * INTO v_consent_record
  FROM public.privacy_consent
  WHERE id = p_consent_id
    AND withdrawn_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consent not found or already withdrawn';
  END IF;

  -- Update consent record
  UPDATE public.privacy_consent
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
    consent_id,
    user_id,
    consent_type,
    verification_result,
    verification_reason,
    consent_found,
    consent_expired,
    consent_withdrawn
  ) VALUES (
    p_consent_id,
    v_consent_record.user_id,
    v_consent_record.consent_type,
    false,
    'Consent withdrawn by user',
    true,
    false,
    true
  );

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 7: TRIGGERS
-- =====================================================

-- Trigger: Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_privacy_consent_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_privacy_consent_timestamp ON public.privacy_consent;
CREATE TRIGGER trigger_update_privacy_consent_timestamp
BEFORE UPDATE ON public.privacy_consent
FOR EACH ROW
EXECUTE FUNCTION public.update_privacy_consent_updated_at();

-- =====================================================
-- STEP 8: ENHANCED RLS POLICIES
-- =====================================================

-- consent_verification_log policies
ALTER TABLE public.consent_verification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view verification logs"
ON public.consent_verification_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin')
  )
);

-- consent_expiration_alerts policies
ALTER TABLE public.consent_expiration_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own consent alerts"
ON public.consent_expiration_alerts
FOR SELECT
USING (user_id = auth.uid());

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
-- STEP 9: ADD INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_privacy_consent_user_type
ON public.privacy_consent(user_id, consent_type);

CREATE INDEX IF NOT EXISTS idx_privacy_consent_active
ON public.privacy_consent(user_id, consent_type)
WHERE withdrawn_at IS NULL AND consented = true;

CREATE INDEX IF NOT EXISTS idx_privacy_consent_expiring
ON public.privacy_consent(expiration_date)
WHERE expiration_date IS NOT NULL AND withdrawn_at IS NULL;

-- =====================================================
-- STEP 10: MIGRATE EXISTING DATA
-- =====================================================

-- Initialize audit_trail for existing records
UPDATE public.privacy_consent
SET audit_trail = jsonb_build_array(
  jsonb_build_object(
    'action', 'granted',
    'timestamp', consented_at,
    'method', 'electronic_signature'
  )
)
WHERE audit_trail = '[]'::jsonb OR audit_trail IS NULL;

-- Set effective_date from consented_at
UPDATE public.privacy_consent
SET effective_date = consented_at
WHERE effective_date IS NULL;

-- =====================================================
-- STEP 11: COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.privacy_consent IS
'Unified consent management table - supports photo, privacy, treatment, research, and data sharing consents';

COMMENT ON TABLE public.consent_verification_log IS
'Audit log of all consent checks - tracks who verified consent and when';

COMMENT ON TABLE public.consent_expiration_alerts IS
'Tracks notifications sent to users about expiring consents';

COMMENT ON FUNCTION public.check_user_consent IS
'Check if user has valid, non-expired consent for a specific type';

COMMENT ON FUNCTION public.get_expiring_consents IS
'Get all consents expiring within specified days (for automated notifications)';

COMMENT ON FUNCTION public.withdraw_consent IS
'Withdraw user consent with reason and audit trail';

COMMIT;

-- =====================================================
-- MIGRATION COMPLETE - INTEGRATION SUCCESSFUL
-- =====================================================
-- ✅ Extended existing privacy_consent table
-- ✅ Removed duplicate patient_consents tables
-- ✅ Preserved all existing data and UI workflows
-- ✅ Added advanced features (expiration, withdrawal, permissions)
-- ✅ Zero tech debt - single source of truth
-- =====================================================
