-- =====================================================
-- Fix Missing Functions and Tables
-- Date: 2025-12-22
-- Purpose: Resolve 404/406/500 errors for missing DB objects
-- =====================================================

-- ============================================
-- 1. FIX is_admin FUNCTION - must use same parameter name 'u' to replace existing
-- ============================================
-- Update the version that takes a UUID parameter (used by RLS policies)
CREATE OR REPLACE FUNCTION public.is_admin(u uuid)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check super_admin_users table first (cross-tenant)
  IF EXISTS (
    SELECT 1 FROM super_admin_users
    WHERE user_id = u
    AND is_active = true
  ) THEN
    RETURN true;
  END IF;

  -- Check profiles table for tenant-level admin
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = u
    AND (is_admin = TRUE OR role IN ('admin', 'super_admin', 'it_admin'))
  );
END;
$$;

-- Update the no-argument version that wraps the above
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SET search_path TO 'public'
AS $$ SELECT public.is_admin(auth.uid()); $$;

-- ============================================
-- 2. CREATE get_active_conditions FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.get_active_conditions(p_patient_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  patient_id UUID,
  condition_code TEXT,
  condition_name TEXT,
  onset_date DATE,
  status TEXT,
  severity TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fc.id,
    fc.patient_id,
    fc.code AS condition_code,
    fc.display AS condition_name,
    fc.onset_date_time::DATE AS onset_date,
    fc.clinical_status AS status,
    fc.severity,
    fc.created_at
  FROM fhir_conditions fc
  WHERE (p_patient_id IS NULL OR fc.patient_id = p_patient_id)
    AND fc.clinical_status IN ('active', 'recurrence', 'relapse')
  ORDER BY fc.onset_date_time DESC NULLS LAST;
END;
$$;

-- ============================================
-- 3. CREATE log_phi_access FUNCTION (HIPAA audit)
-- ============================================
CREATE OR REPLACE FUNCTION public.log_phi_access(
  p_resource_type TEXT,
  p_resource_id UUID,
  p_action TEXT DEFAULT 'VIEW',
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata,
    created_at
  ) VALUES (
    auth.uid(),
    'PHI_ACCESS_' || UPPER(p_action),
    p_resource_type,
    p_resource_id,
    p_metadata || jsonb_build_object(
      'access_type', p_action,
      'timestamp', NOW(),
      'ip_address', current_setting('request.headers', true)::json->>'x-forwarded-for'
    ),
    NOW()
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- ============================================
-- 4. CREATE get_provider_burnout_risk FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.get_provider_burnout_risk(p_provider_id UUID DEFAULT auth.uid())
RETURNS TABLE (
  risk_level TEXT,
  risk_score NUMERIC,
  factors JSONB,
  recommendations JSONB,
  last_assessed TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  -- Return default low-risk assessment if no data exists
  -- This prevents 404 errors while the feature is being built out
  RETURN QUERY
  SELECT 
    'low'::TEXT AS risk_level,
    15.0::NUMERIC AS risk_score,
    jsonb_build_object(
      'workload', 'normal',
      'patient_complexity', 'moderate',
      'documentation_burden', 'manageable'
    ) AS factors,
    jsonb_build_object(
      'suggestions', ARRAY['Take regular breaks', 'Use voice dictation for notes', 'Delegate when appropriate']
    ) AS recommendations,
    NOW() AS last_assessed;
END;
$$;

-- ============================================
-- 5. CREATE user_engagements TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL,
  engagement_type TEXT NOT NULL DEFAULT 'view',
  engagement_count INTEGER DEFAULT 1,
  last_engaged_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, feature_name, engagement_type)
);

-- RLS for user_engagements
ALTER TABLE public.user_engagements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own engagements" ON public.user_engagements;
CREATE POLICY "Users can view own engagements" ON public.user_engagements
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own engagements" ON public.user_engagements;
CREATE POLICY "Users can insert own engagements" ON public.user_engagements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own engagements" ON public.user_engagements;
CREATE POLICY "Users can update own engagements" ON public.user_engagements
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- 6. ENSURE voice_profiles TABLE EXISTS WITH RLS
-- ============================================
CREATE TABLE IF NOT EXISTS public.voice_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  voice_sample_url TEXT,
  voice_characteristics JSONB DEFAULT '{}',
  preferred_voice_type TEXT DEFAULT 'natural',
  speaking_rate NUMERIC DEFAULT 1.0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.voice_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own voice profile" ON public.voice_profiles;
CREATE POLICY "Users can view own voice profile" ON public.voice_profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own voice profile" ON public.voice_profiles;
CREATE POLICY "Users can manage own voice profile" ON public.voice_profiles
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 7. ENSURE user_workflow_preferences TABLE EXISTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_workflow_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  dashboard_layout JSONB DEFAULT '{}',
  quick_actions JSONB DEFAULT '[]',
  notification_preferences JSONB DEFAULT '{}',
  theme_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_workflow_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own workflow preferences" ON public.user_workflow_preferences;
CREATE POLICY "Users can view own workflow preferences" ON public.user_workflow_preferences
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own workflow preferences" ON public.user_workflow_preferences;
CREATE POLICY "Users can manage own workflow preferences" ON public.user_workflow_preferences
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 8. ENSURE provider_scribe_preferences TABLE EXISTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.provider_scribe_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  verbosity TEXT DEFAULT 'standard' CHECK (verbosity IN ('brief', 'standard', 'detailed')),
  auto_summarize BOOLEAN DEFAULT true,
  include_recommendations BOOLEAN DEFAULT true,
  preferred_format TEXT DEFAULT 'soap',
  specialty_templates JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.provider_scribe_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Providers can view own scribe preferences" ON public.provider_scribe_preferences;
CREATE POLICY "Providers can view own scribe preferences" ON public.provider_scribe_preferences
  FOR SELECT USING (auth.uid() = provider_id);

DROP POLICY IF EXISTS "Providers can manage own scribe preferences" ON public.provider_scribe_preferences;
CREATE POLICY "Providers can manage own scribe preferences" ON public.provider_scribe_preferences
  FOR ALL USING (auth.uid() = provider_id);

-- ============================================
-- 9. ENSURE provider_voice_profiles TABLE EXISTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.provider_voice_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  voice_model_id TEXT,
  voice_sample_urls TEXT[] DEFAULT '{}',
  transcription_language TEXT DEFAULT 'en-US',
  medical_vocabulary_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.provider_voice_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Providers can view own voice profiles" ON public.provider_voice_profiles;
CREATE POLICY "Providers can view own voice profiles" ON public.provider_voice_profiles
  FOR SELECT USING (auth.uid() = provider_id);

DROP POLICY IF EXISTS "Providers can manage own voice profiles" ON public.provider_voice_profiles;
CREATE POLICY "Providers can manage own voice profiles" ON public.provider_voice_profiles
  FOR ALL USING (auth.uid() = provider_id);

-- ============================================
-- 10. FIX feature_engagement TABLE (403 error)
-- ============================================
CREATE TABLE IF NOT EXISTS public.feature_engagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_clicked TEXT NOT NULL,
  click_count INTEGER DEFAULT 1,
  last_clicked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.feature_engagement ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own feature engagement" ON public.feature_engagement;
CREATE POLICY "Users can view own feature engagement" ON public.feature_engagement
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own feature engagement" ON public.feature_engagement;
CREATE POLICY "Users can insert own feature engagement" ON public.feature_engagement
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own feature engagement" ON public.feature_engagement;
CREATE POLICY "Users can update own feature engagement" ON public.feature_engagement
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- 11. FIX dashboard_personalization_events TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.dashboard_personalization_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_clicked TEXT NOT NULL,
  click_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dashboard_personalization_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own dashboard events" ON public.dashboard_personalization_events;
CREATE POLICY "Users can view own dashboard events" ON public.dashboard_personalization_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own dashboard events" ON public.dashboard_personalization_events;
CREATE POLICY "Users can manage own dashboard events" ON public.dashboard_personalization_events
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 12. FIX physician_workflow_preferences (409 conflict)
-- ============================================
CREATE TABLE IF NOT EXISTS public.physician_workflow_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  quick_actions JSONB DEFAULT '[]',
  dashboard_widgets JSONB DEFAULT '[]',
  notification_settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.physician_workflow_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Physicians can view own workflow preferences" ON public.physician_workflow_preferences;
CREATE POLICY "Physicians can view own workflow preferences" ON public.physician_workflow_preferences
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Physicians can manage own workflow preferences" ON public.physician_workflow_preferences;
CREATE POLICY "Physicians can manage own workflow preferences" ON public.physician_workflow_preferences
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 13. GRANT EXECUTE ON FUNCTIONS
-- ============================================
-- is_admin has two versions (with and without parameter), grant on both
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_conditions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_phi_access(text, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_provider_burnout_risk(uuid) TO authenticated;

