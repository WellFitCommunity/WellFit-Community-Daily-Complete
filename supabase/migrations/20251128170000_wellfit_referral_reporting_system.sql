-- ============================================================================
-- External Patient Referrals & Reporting System
-- ============================================================================
-- Purpose: Allow external organizations (Atlus-only hospitals) to refer patients
--          to WellFit Community and receive engagement/health reports
--
-- Business Model:
--   - Hospital (HH-8001, Atlus-only) refers patient to WellFit Community
--   - Patient joins WellFit, does check-ins, engages with community
--   - Hospital receives reports about THEIR referred patients only
--   - Revenue: Hospitals pay for insights/reporting subscription
--
-- Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
-- ============================================================================

-- ============================================================================
-- 1. EXTERNAL REFERRAL SOURCES
-- ============================================================================
-- Organizations that can refer patients to WellFit (even without full license)

CREATE TABLE IF NOT EXISTS external_referral_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source identification
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,  -- NULL if not a tenant
  organization_name TEXT NOT NULL,
  organization_type TEXT NOT NULL CHECK (organization_type IN (
    'hospital',
    'clinic',
    'physician_practice',
    'health_system',
    'insurance_payer',
    'community_organization',
    'government_agency',
    'other'
  )),

  -- Contact info
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  primary_contact_phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,

  -- API/Integration settings
  api_key_hash TEXT,  -- Hashed API key for report access
  webhook_url TEXT,   -- Where to send real-time alerts
  fhir_endpoint TEXT, -- FHIR server for interop

  -- Subscription/Contract
  subscription_tier TEXT DEFAULT 'basic' CHECK (subscription_tier IN (
    'basic',      -- Monthly summary reports only
    'standard',   -- Weekly reports + alerts
    'premium',    -- Real-time alerts + dashboard access + FHIR
    'enterprise'  -- Custom integration + SLA
  )),
  contract_start_date DATE,
  contract_end_date DATE,
  monthly_fee DECIMAL(10,2),

  -- Settings
  is_active BOOLEAN DEFAULT true,
  can_refer_patients BOOLEAN DEFAULT true,
  can_view_reports BOOLEAN DEFAULT true,
  report_frequency TEXT DEFAULT 'weekly' CHECK (report_frequency IN (
    'daily', 'weekly', 'biweekly', 'monthly'
  )),

  -- What data they can see in reports
  report_includes_engagement BOOLEAN DEFAULT true,
  report_includes_mood BOOLEAN DEFAULT true,
  report_includes_sdoh BOOLEAN DEFAULT true,
  report_includes_missed_checkins BOOLEAN DEFAULT true,
  report_includes_community_activity BOOLEAN DEFAULT false,  -- Privacy consideration

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_ext_referral_sources_tenant ON external_referral_sources(tenant_id);
CREATE INDEX idx_ext_referral_sources_active ON external_referral_sources(is_active) WHERE is_active = true;
CREATE INDEX idx_ext_referral_sources_org_type ON external_referral_sources(organization_type);

COMMENT ON TABLE external_referral_sources IS 'Organizations that can refer patients to WellFit and receive reports';

-- ============================================================================
-- 2. PATIENT REFERRALS
-- ============================================================================
-- Individual patient referrals from external sources to WellFit

CREATE TABLE IF NOT EXISTS patient_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Referral source
  referral_source_id UUID NOT NULL REFERENCES external_referral_sources(id) ON DELETE CASCADE,
  referring_provider_name TEXT,
  referring_provider_npi TEXT,  -- National Provider Identifier

  -- Patient identification (before they join WellFit)
  patient_external_id TEXT,     -- ID in referring system (MRN, etc.)
  patient_first_name TEXT NOT NULL,
  patient_last_name TEXT NOT NULL,
  patient_phone TEXT NOT NULL,  -- Primary contact method
  patient_email TEXT,
  patient_dob DATE,

  -- After patient joins WellFit
  wellfit_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  wellfit_tenant_id UUID REFERENCES tenants(id) DEFAULT '2b902657-6a20-4435-a78a-576f397517ca',

  -- Referral details
  referral_reason TEXT,
  clinical_notes TEXT,          -- PHI - encrypted at rest
  diagnoses TEXT[],             -- ICD-10 codes
  care_goals TEXT[],
  special_instructions TEXT,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',          -- Referral received, patient not yet joined
    'invited',          -- SMS/email invitation sent to patient
    'enrolled',         -- Patient created WellFit account
    'active',           -- Patient actively using WellFit
    'inactive',         -- Patient stopped engaging (30+ days)
    'discharged',       -- Referring org discharged patient
    'declined',         -- Patient declined to join
    'expired'           -- Invitation expired (90 days)
  )),

  -- Invitation tracking
  invitation_sent_at TIMESTAMPTZ,
  invitation_method TEXT CHECK (invitation_method IN ('sms', 'email', 'both')),
  invitation_attempts INTEGER DEFAULT 0,
  last_invitation_at TIMESTAMPTZ,

  -- Enrollment tracking
  enrolled_at TIMESTAMPTZ,
  first_checkin_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,

  -- Discharge/End
  discharged_at TIMESTAMPTZ,
  discharged_by TEXT,           -- Provider name who discharged
  discharge_reason TEXT,

  -- Reporting preferences (override source defaults)
  report_frequency_override TEXT CHECK (report_frequency_override IN (
    'daily', 'weekly', 'biweekly', 'monthly', NULL
  )),
  alert_on_missed_checkins BOOLEAN DEFAULT true,
  alert_on_mood_decline BOOLEAN DEFAULT true,
  alert_on_sdoh_flags BOOLEAN DEFAULT true,
  missed_checkin_threshold INTEGER DEFAULT 3,  -- Alert after N missed check-ins

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_patient_referrals_source ON patient_referrals(referral_source_id);
CREATE INDEX idx_patient_referrals_phone ON patient_referrals(patient_phone);
CREATE INDEX idx_patient_referrals_wellfit_user ON patient_referrals(wellfit_user_id);
CREATE INDEX idx_patient_referrals_status ON patient_referrals(status);
CREATE INDEX idx_patient_referrals_pending ON patient_referrals(status) WHERE status IN ('pending', 'invited');

COMMENT ON TABLE patient_referrals IS 'Individual patient referrals from external organizations to WellFit';

-- ============================================================================
-- 3. REFERRAL REPORTS
-- ============================================================================
-- Generated reports sent to referring organizations

CREATE TABLE IF NOT EXISTS referral_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What this report covers
  referral_source_id UUID NOT NULL REFERENCES external_referral_sources(id) ON DELETE CASCADE,
  patient_referral_id UUID REFERENCES patient_referrals(id) ON DELETE CASCADE,  -- NULL = aggregate report

  -- Report period
  report_type TEXT NOT NULL CHECK (report_type IN (
    'individual_patient',   -- Single patient report
    'cohort_summary',       -- All patients for this source
    'alert',                -- Real-time alert
    'monthly_summary',      -- Monthly aggregate
    'custom'                -- Ad-hoc request
  )),
  period_start DATE,
  period_end DATE,

  -- Report content (JSON for flexibility)
  report_data JSONB NOT NULL DEFAULT '{}',
  /*
    Example report_data structure:
    {
      "patient_count": 45,
      "engagement_summary": {
        "avg_checkins_per_week": 4.2,
        "checkin_completion_rate": 0.78,
        "active_patients": 38,
        "inactive_patients": 7
      },
      "mood_summary": {
        "avg_mood_score": 3.8,
        "mood_trend": "stable",
        "patients_declining": 3
      },
      "sdoh_flags": {
        "transportation_issues": 5,
        "food_insecurity": 2,
        "social_isolation": 8,
        "housing_concerns": 1
      },
      "alerts_triggered": 12,
      "missed_checkins_total": 34
    }
  */

  -- Delivery tracking
  delivery_method TEXT CHECK (delivery_method IN ('email', 'api', 'fhir', 'dashboard', 'webhook')),
  delivered_at TIMESTAMPTZ,
  delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN (
    'pending', 'sent', 'delivered', 'failed', 'viewed'
  )),
  viewed_at TIMESTAMPTZ,
  viewed_by TEXT,

  -- Generated file (if applicable)
  report_file_url TEXT,  -- S3/storage URL
  report_format TEXT CHECK (report_format IN ('pdf', 'csv', 'json', 'fhir_bundle')),

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  generated_by TEXT DEFAULT 'system'
);

-- Indexes
CREATE INDEX idx_referral_reports_source ON referral_reports(referral_source_id);
CREATE INDEX idx_referral_reports_patient ON referral_reports(patient_referral_id);
CREATE INDEX idx_referral_reports_type ON referral_reports(report_type);
CREATE INDEX idx_referral_reports_period ON referral_reports(period_start, period_end);

COMMENT ON TABLE referral_reports IS 'Generated reports sent to referring organizations about their patients';

-- ============================================================================
-- 4. REAL-TIME ALERTS
-- ============================================================================
-- Alerts sent to referring organizations about patient status changes

CREATE TABLE IF NOT EXISTS referral_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who this alert is about
  patient_referral_id UUID NOT NULL REFERENCES patient_referrals(id) ON DELETE CASCADE,
  referral_source_id UUID NOT NULL REFERENCES external_referral_sources(id) ON DELETE CASCADE,
  wellfit_user_id UUID REFERENCES auth.users(id),

  -- Alert details
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'missed_checkins',        -- Hasn't checked in for X days
    'mood_decline',           -- Significant mood drop
    'sdoh_detected',          -- New SDOH concern identified
    'engagement_drop',        -- Activity level dropped significantly
    'safety_concern',         -- Self-harm indicators, etc.
    'hospitalization_risk',   -- Readmission risk elevated
    'medication_concern',     -- Medication adherence issues
    'social_isolation',       -- Signs of loneliness/isolation
    'care_plan_deviation',    -- Not following care plan
    'positive_milestone'      -- Good news! Patient improving
  )),

  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN (
    'info',       -- FYI
    'warning',    -- Needs attention soon
    'urgent',     -- Needs attention today
    'critical'    -- Immediate action needed
  )),

  -- Alert content
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  recommended_action TEXT,

  -- Supporting data
  alert_data JSONB DEFAULT '{}',
  /*
    Example alert_data:
    {
      "missed_checkins": 5,
      "last_checkin": "2025-11-20",
      "mood_score_trend": [4, 3, 2, 2, 1],
      "sdoh_indicators": ["transportation", "food_insecurity"]
    }
  */

  -- Delivery tracking
  delivered_via TEXT[],  -- ['email', 'webhook', 'sms']
  delivered_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,

  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolution_notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_referral_alerts_patient ON referral_alerts(patient_referral_id);
CREATE INDEX idx_referral_alerts_source ON referral_alerts(referral_source_id);
CREATE INDEX idx_referral_alerts_type ON referral_alerts(alert_type);
CREATE INDEX idx_referral_alerts_severity ON referral_alerts(severity);
CREATE INDEX idx_referral_alerts_unacknowledged ON referral_alerts(referral_source_id)
  WHERE acknowledged_at IS NULL AND severity IN ('urgent', 'critical');

COMMENT ON TABLE referral_alerts IS 'Real-time alerts sent to referring organizations about patient status changes';

-- ============================================================================
-- 5. HELPER FUNCTIONS
-- ============================================================================

-- Function to link a new WellFit user to their referral
CREATE OR REPLACE FUNCTION link_user_to_referral(
  p_user_id UUID,
  p_phone TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referral_id UUID;
  v_normalized_phone TEXT;
BEGIN
  -- Normalize phone
  v_normalized_phone := regexp_replace(p_phone, '[^0-9+]', '', 'g');

  -- Find pending/invited referral for this phone
  SELECT id INTO v_referral_id
  FROM patient_referrals
  WHERE patient_phone = v_normalized_phone
    AND status IN ('pending', 'invited')
    AND wellfit_user_id IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_referral_id IS NOT NULL THEN
    -- Link user to referral
    UPDATE patient_referrals
    SET
      wellfit_user_id = p_user_id,
      status = 'enrolled',
      enrolled_at = NOW(),
      updated_at = NOW()
    WHERE id = v_referral_id;

    RETURN v_referral_id;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION link_user_to_referral IS 'Links a new WellFit user to their pending referral by phone number';

-- Function to generate patient engagement summary for reports
CREATE OR REPLACE FUNCTION get_patient_engagement_summary(
  p_user_id UUID,
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '7 days')::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_summary JSONB;
  v_checkin_count INTEGER;
  v_avg_mood NUMERIC;
  v_missed_days INTEGER;
  v_sdoh_flags TEXT[];
BEGIN
  -- Count check-ins in period
  SELECT COUNT(*) INTO v_checkin_count
  FROM daily_check_ins
  WHERE user_id = p_user_id
    AND check_in_date BETWEEN p_start_date AND p_end_date;

  -- Average mood score
  SELECT AVG(mood_score) INTO v_avg_mood
  FROM daily_check_ins
  WHERE user_id = p_user_id
    AND check_in_date BETWEEN p_start_date AND p_end_date
    AND mood_score IS NOT NULL;

  -- Calculate missed days
  v_missed_days := (p_end_date - p_start_date + 1) - v_checkin_count;

  -- Get SDOH flags (from passive detection)
  SELECT ARRAY_AGG(DISTINCT indicator_type) INTO v_sdoh_flags
  FROM sdoh_indicators
  WHERE user_id = p_user_id
    AND detected_at BETWEEN p_start_date AND p_end_date
    AND is_active = true;

  -- Build summary
  v_summary := jsonb_build_object(
    'period_start', p_start_date,
    'period_end', p_end_date,
    'checkins_completed', v_checkin_count,
    'checkins_expected', (p_end_date - p_start_date + 1),
    'checkin_rate', ROUND(v_checkin_count::NUMERIC / GREATEST((p_end_date - p_start_date + 1), 1), 2),
    'missed_days', v_missed_days,
    'avg_mood_score', ROUND(COALESCE(v_avg_mood, 0), 1),
    'sdoh_flags', COALESCE(v_sdoh_flags, ARRAY[]::TEXT[]),
    'sdoh_flag_count', COALESCE(array_length(v_sdoh_flags, 1), 0)
  );

  RETURN v_summary;
END;
$$;

COMMENT ON FUNCTION get_patient_engagement_summary IS 'Returns engagement summary for a patient over a date range';

-- Function to check and create alerts for a referred patient
CREATE OR REPLACE FUNCTION check_referral_alerts(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referral RECORD;
  v_last_checkin DATE;
  v_missed_days INTEGER;
  v_recent_mood NUMERIC;
  v_prior_mood NUMERIC;
  v_alerts_created INTEGER := 0;
BEGIN
  -- Get referral info
  SELECT pr.*, ers.alert_on_missed_checkins, ers.alert_on_mood_decline, ers.alert_on_sdoh_flags
  INTO v_referral
  FROM patient_referrals pr
  JOIN external_referral_sources ers ON ers.id = pr.referral_source_id
  WHERE pr.wellfit_user_id = p_user_id
    AND pr.status = 'active';

  IF v_referral IS NULL THEN
    RETURN 0;
  END IF;

  -- Check missed check-ins
  IF v_referral.alert_on_missed_checkins THEN
    SELECT MAX(check_in_date) INTO v_last_checkin
    FROM daily_check_ins
    WHERE user_id = p_user_id;

    v_missed_days := CURRENT_DATE - COALESCE(v_last_checkin, CURRENT_DATE - INTERVAL '30 days')::DATE;

    IF v_missed_days >= COALESCE(v_referral.missed_checkin_threshold, 3) THEN
      -- Check if alert already exists for this
      IF NOT EXISTS (
        SELECT 1 FROM referral_alerts
        WHERE patient_referral_id = v_referral.id
          AND alert_type = 'missed_checkins'
          AND created_at > CURRENT_DATE - INTERVAL '7 days'
          AND resolved_at IS NULL
      ) THEN
        INSERT INTO referral_alerts (
          patient_referral_id, referral_source_id, wellfit_user_id,
          alert_type, severity, title, description, alert_data
        ) VALUES (
          v_referral.id, v_referral.referral_source_id, p_user_id,
          'missed_checkins',
          CASE WHEN v_missed_days >= 7 THEN 'urgent' ELSE 'warning' END,
          'Patient Missed Check-ins',
          format('%s %s has not checked in for %s days', v_referral.patient_first_name, v_referral.patient_last_name, v_missed_days),
          jsonb_build_object('missed_days', v_missed_days, 'last_checkin', v_last_checkin)
        );
        v_alerts_created := v_alerts_created + 1;
      END IF;
    END IF;
  END IF;

  -- Check mood decline
  IF v_referral.alert_on_mood_decline THEN
    -- Recent mood (last 3 days)
    SELECT AVG(mood_score) INTO v_recent_mood
    FROM daily_check_ins
    WHERE user_id = p_user_id
      AND check_in_date >= CURRENT_DATE - INTERVAL '3 days';

    -- Prior mood (4-7 days ago)
    SELECT AVG(mood_score) INTO v_prior_mood
    FROM daily_check_ins
    WHERE user_id = p_user_id
      AND check_in_date BETWEEN CURRENT_DATE - INTERVAL '7 days' AND CURRENT_DATE - INTERVAL '4 days';

    -- Alert if mood dropped by 1.5+ points
    IF v_recent_mood IS NOT NULL AND v_prior_mood IS NOT NULL
       AND (v_prior_mood - v_recent_mood) >= 1.5 THEN
      IF NOT EXISTS (
        SELECT 1 FROM referral_alerts
        WHERE patient_referral_id = v_referral.id
          AND alert_type = 'mood_decline'
          AND created_at > CURRENT_DATE - INTERVAL '7 days'
          AND resolved_at IS NULL
      ) THEN
        INSERT INTO referral_alerts (
          patient_referral_id, referral_source_id, wellfit_user_id,
          alert_type, severity, title, description, alert_data
        ) VALUES (
          v_referral.id, v_referral.referral_source_id, p_user_id,
          'mood_decline',
          CASE WHEN v_recent_mood <= 2 THEN 'urgent' ELSE 'warning' END,
          'Patient Mood Declining',
          format('%s %s mood score has dropped from %.1f to %.1f',
                 v_referral.patient_first_name, v_referral.patient_last_name, v_prior_mood, v_recent_mood),
          jsonb_build_object('recent_mood', v_recent_mood, 'prior_mood', v_prior_mood,
                            'decline', v_prior_mood - v_recent_mood)
        );
        v_alerts_created := v_alerts_created + 1;
      END IF;
    END IF;
  END IF;

  RETURN v_alerts_created;
END;
$$;

COMMENT ON FUNCTION check_referral_alerts IS 'Checks and creates alerts for a referred patient based on their activity';

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

ALTER TABLE external_referral_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_alerts ENABLE ROW LEVEL SECURITY;

-- Super admins can manage everything
CREATE POLICY "super_admin_referral_sources" ON external_referral_sources
  FOR ALL USING (
    EXISTS (SELECT 1 FROM super_admin_users WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "super_admin_patient_referrals" ON patient_referrals
  FOR ALL USING (
    EXISTS (SELECT 1 FROM super_admin_users WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "super_admin_referral_reports" ON referral_reports
  FOR ALL USING (
    EXISTS (SELECT 1 FROM super_admin_users WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "super_admin_referral_alerts" ON referral_alerts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM super_admin_users WHERE user_id = auth.uid() AND is_active = true)
  );

-- Tenant admins can view referrals TO their tenant
CREATE POLICY "tenant_admin_view_referrals" ON patient_referrals
  FOR SELECT USING (
    wellfit_tenant_id IN (
      SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role_id IN (1, 2)  -- admin, super_admin
    )
  );

-- Users can view their own referral info
CREATE POLICY "users_view_own_referral" ON patient_referrals
  FOR SELECT USING (wellfit_user_id = auth.uid());

-- ============================================================================
-- 7. GRANTS
-- ============================================================================

GRANT SELECT ON external_referral_sources TO authenticated;
GRANT SELECT ON patient_referrals TO authenticated;
GRANT SELECT ON referral_reports TO authenticated;
GRANT SELECT ON referral_alerts TO authenticated;

GRANT EXECUTE ON FUNCTION link_user_to_referral(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_patient_engagement_summary(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION check_referral_alerts(UUID) TO authenticated;

-- ============================================================================
-- 8. TRIGGERS
-- ============================================================================

-- Auto-update timestamps
CREATE TRIGGER update_external_referral_sources_updated_at
  BEFORE UPDATE ON external_referral_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patient_referrals_updated_at
  BEFORE UPDATE ON patient_referrals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Tables created:
--   1. external_referral_sources - Organizations that can refer patients
--   2. patient_referrals - Individual patient referrals
--   3. referral_reports - Generated reports for referring orgs
--   4. referral_alerts - Real-time alerts about patient status
--
-- Functions created:
--   - link_user_to_referral() - Link new user to pending referral
--   - get_patient_engagement_summary() - Generate engagement data
--   - check_referral_alerts() - Create alerts based on activity
--
-- Workflow:
--   1. Hospital registers as referral source (or links to existing tenant)
--   2. Hospital creates patient referral with phone/name
--   3. Patient receives SMS invitation to join WellFit
--   4. Patient registers → link_user_to_referral() connects them
--   5. Patient uses WellFit, does check-ins
--   6. System generates reports and alerts for hospital
--   7. Hospital receives insights about their patients
-- ============================================================================
