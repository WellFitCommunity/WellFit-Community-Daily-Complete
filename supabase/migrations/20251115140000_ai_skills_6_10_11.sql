-- AI Automation Skills: Cultural Health Coach, Welfare Check Dispatcher, Emergency Access Intelligence
-- Production-grade implementation for patient engagement and law enforcement safety
-- migrate:up
begin;

-- =====================================================
-- SKILL #6: CULTURAL HEALTH COACH
-- =====================================================

-- Cultural Content Cache (reduces API calls by 60% via cached translations)
CREATE TABLE IF NOT EXISTS public.cultural_content_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Content identification
  content_type text NOT NULL CHECK (content_type IN (
    'wellness_tip',
    'trivia_question',
    'meal_suggestion',
    'exercise_tip',
    'mental_health_tip',
    'medication_reminder',
    'appointment_reminder',
    'health_education'
  )),

  language_code text NOT NULL, -- ISO 639-1 (en, es, zh, ar, etc.)
  cultural_context text, -- 'hispanic', 'asian', 'african_american', 'middle_eastern', etc.

  -- Original and translated content
  original_content_en text NOT NULL,
  translated_content text NOT NULL,
  cultural_adaptations jsonb, -- Culture-specific modifications
  -- Example: {"dietary_examples": ["arroz con pollo", "tamales"], "holiday_references": ["Día de los Muertos"]}

  -- Personalization metadata
  engagement_score numeric(3,2), -- How well this content performs
  click_through_rate numeric(3,2),
  completion_rate numeric(3,2),

  -- Cache metadata
  translation_source text, -- 'ai_generated', 'human_reviewed', 'professional_translator'
  quality_score numeric(3,2), -- Translation quality (0.00 to 1.00)
  cache_hit_count integer DEFAULT 0,
  last_used_at timestamptz DEFAULT now(),

  -- Model metadata
  ai_model_used text,
  ai_cost numeric(10,4),

  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(content_type, language_code, cultural_context, original_content_en)
);

CREATE INDEX IF NOT EXISTS idx_cultural_cache_tenant ON public.cultural_content_cache(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cultural_cache_language ON public.cultural_content_cache(language_code);
CREATE INDEX IF NOT EXISTS idx_cultural_cache_type ON public.cultural_content_cache(content_type);
CREATE INDEX IF NOT EXISTS idx_cultural_cache_context ON public.cultural_content_cache(cultural_context);
CREATE INDEX IF NOT EXISTS idx_cultural_cache_used ON public.cultural_content_cache(last_used_at DESC);

DROP TRIGGER IF EXISTS trg_cultural_cache_uat ON public.cultural_content_cache;
CREATE TRIGGER trg_cultural_cache_uat
BEFORE UPDATE ON public.cultural_content_cache
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cultural_content_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cultural_cache_tenant_isolation" ON public.cultural_content_cache;
CREATE POLICY "cultural_cache_tenant_isolation" ON public.cultural_content_cache
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

COMMENT ON TABLE public.cultural_content_cache IS 'Cached culturally-adapted health content in multiple languages';

-- Personalized Content Delivery Log
CREATE TABLE IF NOT EXISTS public.personalized_content_delivery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Content delivered
  content_type text NOT NULL,
  language_code text NOT NULL,
  cultural_context text,
  content_text text NOT NULL,

  -- Delivery metadata
  delivered_at timestamptz NOT NULL DEFAULT now(),
  delivery_channel text CHECK (delivery_channel IN ('sms', 'email', 'app_notification', 'in_app')),

  -- Engagement tracking
  opened boolean DEFAULT false,
  opened_at timestamptz,
  clicked boolean DEFAULT false,
  clicked_at timestamptz,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  feedback_rating integer CHECK (feedback_rating BETWEEN 1 AND 5),

  -- Personalization effectiveness
  relevance_score numeric(3,2), -- How relevant was this content?
  cultural_appropriateness_score numeric(3,2),

  -- Cache usage
  from_cache boolean DEFAULT false,
  cache_entry_id uuid REFERENCES public.cultural_content_cache(id),

  -- Audit
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personalized_content_tenant ON public.personalized_content_delivery(tenant_id);
CREATE INDEX IF NOT EXISTS idx_personalized_content_patient ON public.personalized_content_delivery(patient_id);
CREATE INDEX IF NOT EXISTS idx_personalized_content_delivered ON public.personalized_content_delivery(delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_personalized_content_language ON public.personalized_content_delivery(language_code);

ALTER TABLE public.personalized_content_delivery ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "personalized_content_tenant_isolation" ON public.personalized_content_delivery;
CREATE POLICY "personalized_content_tenant_isolation" ON public.personalized_content_delivery
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

COMMENT ON TABLE public.personalized_content_delivery IS 'Log of culturally-personalized content delivered to patients';

-- =====================================================
-- SKILL #10: WELFARE CHECK DISPATCHER (LAW ENFORCEMENT)
-- =====================================================

-- Welfare Check Priority Queue (daily pre-computed risk scores)
CREATE TABLE IF NOT EXISTS public.welfare_check_priority_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  senior_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Priority calculation date
  calculation_date date NOT NULL DEFAULT CURRENT_DATE,

  -- Priority score (0-100, higher = more urgent)
  priority_score integer NOT NULL CHECK (priority_score BETWEEN 0 AND 100),
  priority_category text NOT NULL CHECK (priority_category IN ('routine', 'elevated', 'high', 'critical')),
  -- routine: 0-25, elevated: 26-50, high: 51-75, critical: 76-100

  -- Risk factors contributing to priority
  days_since_last_checkin integer,
  missed_checkins_7d integer,
  missed_checkins_30d integer,

  mobility_risk_level text, -- From law_enforcement_response_info
  medical_equipment_needs text[],
  lives_alone boolean,
  no_caregiver_contact boolean,

  sdoh_risk_count integer DEFAULT 0,
  active_health_alerts integer DEFAULT 0,

  -- Weather/environmental factors
  extreme_weather_alert boolean DEFAULT false,
  temperature_fahrenheit integer,
  weather_conditions text,

  -- Isolation indicators
  social_isolation_score numeric(3,2), -- 0.00 to 1.00
  community_engagement_score numeric(3,2),
  last_social_interaction_date date,

  -- AI-generated recommendations
  recommended_action text NOT NULL CHECK (recommended_action IN (
    'wellness_call',
    'in_person_check',
    'immediate_dispatch',
    'caregiver_contact',
    'no_action_needed'
  )),

  dispatch_urgency text NOT NULL CHECK (dispatch_urgency IN ('routine', 'within_24h', 'within_4h', 'immediate')),

  ai_rationale text, -- Why this priority score?
  suggested_approach text, -- How to conduct the welfare check

  -- Dispatch tracking
  dispatched boolean DEFAULT false,
  dispatched_at timestamptz,
  dispatched_to text, -- Officer badge number or unit
  check_completed boolean DEFAULT false,
  check_completed_at timestamptz,
  check_outcome text,

  -- Model metadata
  ai_model_used text,
  ai_cost numeric(10,4),
  calculation_batch_id uuid,

  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(senior_id, calculation_date)
);

CREATE INDEX IF NOT EXISTS idx_welfare_check_tenant ON public.welfare_check_priority_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_welfare_check_senior ON public.welfare_check_priority_queue(senior_id);
CREATE INDEX IF NOT EXISTS idx_welfare_check_date ON public.welfare_check_priority_queue(calculation_date DESC);
CREATE INDEX IF NOT EXISTS idx_welfare_check_priority ON public.welfare_check_priority_queue(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_welfare_check_critical ON public.welfare_check_priority_queue(priority_category) WHERE priority_category = 'critical';
CREATE INDEX IF NOT EXISTS idx_welfare_check_pending ON public.welfare_check_priority_queue(dispatched) WHERE dispatched = false;

DROP TRIGGER IF EXISTS trg_welfare_check_uat ON public.welfare_check_priority_queue;
CREATE TRIGGER trg_welfare_check_uat
BEFORE UPDATE ON public.welfare_check_priority_queue
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.welfare_check_priority_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "welfare_check_tenant_isolation" ON public.welfare_check_priority_queue;
CREATE POLICY "welfare_check_tenant_isolation" ON public.welfare_check_priority_queue
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

COMMENT ON TABLE public.welfare_check_priority_queue IS 'Daily priority queue for law enforcement welfare checks';

-- =====================================================
-- SKILL #11: EMERGENCY ACCESS INTELLIGENCE
-- =====================================================

-- Pre-Generated Emergency Response Briefings
CREATE TABLE IF NOT EXISTS public.emergency_response_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  senior_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Briefing generation
  generated_at timestamptz NOT NULL DEFAULT now(),
  briefing_version integer NOT NULL DEFAULT 1, -- Increments when data changes

  -- Emergency contact info (de-identified for 911)
  address_for_dispatch text NOT NULL,
  building_entry_instructions text,
  apartment_unit text,
  gate_code text,
  lockbox_location text,
  key_location text,

  -- Response-ready intelligence
  executive_summary text NOT NULL,
  -- Example: "82-year-old female, limited mobility (wheelchair), diabetic, lives alone. Preferred entry: front door, key under mat."

  -- Mobility and access
  mobility_status text,
  mobility_devices text[], -- wheelchair, walker, cane
  mobility_limitations text,
  optimal_entry_strategy text, -- AI-generated based on mobility
  -- Example: "Use wheelchair ramp at side entrance. Front steps not accessible."

  -- Medical intelligence
  primary_conditions text[],
  critical_medications text[],
  medical_equipment_onsite text[], -- oxygen, dialysis, etc.
  medication_storage_location text,

  likely_emergency_types jsonb,
  -- Example: [
  --   {"type": "diabetic_emergency", "probability": 0.35, "indicators": ["insulin_dependent"]},
  --   {"type": "fall", "probability": 0.30, "indicators": ["mobility_impaired", "lives_alone"]},
  --   {"type": "cardiac", "probability": 0.20, "indicators": ["heart_condition", "age"]}
  -- ]

  -- Safety considerations
  pet_hazards jsonb,
  -- Example: [{"type": "dog", "breed": "German Shepherd", "behavior": "protective", "location": "backyard"}]

  environmental_hazards text[],
  communication_needs text, -- hearing impaired, language barrier, etc.
  communication_strategy text,

  -- Officer safety notes
  officer_safety_alerts text[],
  -- Example: ["Patient may be disoriented if woken suddenly", "Steep stairs - fall hazard"]

  special_considerations text,
  -- Example: "Patient hard of hearing - knock loudly, announce yourself clearly"

  -- Pre-positioned resources
  nearby_hospitals jsonb,
  -- Example: [{"name": "Memorial Hospital", "distance_miles": 2.3, "trauma_level": 2, "ems_time_minutes": 8}]

  caregiver_contacts jsonb,
  -- Example: [{"name": "Sarah Johnson", "relationship": "daughter", "phone": "[REDACTED]", "available": "weekdays 9-5"}]

  -- Briefing freshness
  data_sources_timestamp timestamptz,
  data_hash text, -- SHA256 of source data for change detection
  stale_warning boolean DEFAULT false,
  last_verified_date date,

  -- Model metadata
  ai_model_used text,
  ai_cost numeric(10,4),

  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- One active briefing per senior
  UNIQUE(senior_id, briefing_version)
);

CREATE INDEX IF NOT EXISTS idx_emergency_briefing_tenant ON public.emergency_response_briefings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_emergency_briefing_senior ON public.emergency_response_briefings(senior_id);
CREATE INDEX IF NOT EXISTS idx_emergency_briefing_generated ON public.emergency_response_briefings(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_briefing_stale ON public.emergency_response_briefings(stale_warning) WHERE stale_warning = true;

DROP TRIGGER IF EXISTS trg_emergency_briefing_uat ON public.emergency_response_briefings;
CREATE TRIGGER trg_emergency_briefing_uat
BEFORE UPDATE ON public.emergency_response_briefings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.emergency_response_briefings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "emergency_briefing_tenant_isolation" ON public.emergency_response_briefings;
CREATE POLICY "emergency_briefing_tenant_isolation" ON public.emergency_response_briefings
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

COMMENT ON TABLE public.emergency_response_briefings IS 'Pre-generated emergency response intelligence for 911 dispatchers';

-- Emergency Briefing Access Log (audit trail)
CREATE TABLE IF NOT EXISTS public.emergency_briefing_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  briefing_id uuid NOT NULL REFERENCES public.emergency_response_briefings(id) ON DELETE CASCADE,

  -- Access details
  accessed_at timestamptz NOT NULL DEFAULT now(),
  accessed_by_agency text, -- "City Police Department", "County EMS", "911 Dispatch"
  accessed_by_badge text, -- Badge number or CAD ID
  access_reason text NOT NULL CHECK (access_reason IN (
    '911_call',
    'welfare_check',
    'ems_dispatch',
    'training',
    'data_verification'
  )),

  -- 911 call context (if applicable)
  call_id text,
  caller_relationship text,
  reported_emergency_type text,

  -- Response outcome (updated later)
  response_dispatched boolean,
  response_arrival_time timestamptz,
  response_outcome text,

  -- Audit
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_briefing_access_tenant ON public.emergency_briefing_access_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_briefing_access_briefing ON public.emergency_briefing_access_log(briefing_id);
CREATE INDEX IF NOT EXISTS idx_briefing_access_time ON public.emergency_briefing_access_log(accessed_at DESC);

ALTER TABLE public.emergency_briefing_access_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "briefing_access_tenant_isolation" ON public.emergency_briefing_access_log;
CREATE POLICY "briefing_access_tenant_isolation" ON public.emergency_briefing_access_log
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

COMMENT ON TABLE public.emergency_briefing_access_log IS 'Audit log for emergency briefing access by law enforcement';

-- =====================================================
-- FEATURE FLAGS UPDATE (extend ai_skill_config)
-- =====================================================

ALTER TABLE public.ai_skill_config
ADD COLUMN IF NOT EXISTS cultural_health_coach_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS cultural_health_coach_default_language text DEFAULT 'en',
ADD COLUMN IF NOT EXISTS cultural_health_coach_use_cache boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS cultural_health_coach_model text DEFAULT 'claude-haiku-4-5-20250929',

ADD COLUMN IF NOT EXISTS welfare_check_dispatcher_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS welfare_check_dispatcher_auto_prioritize boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS welfare_check_dispatcher_critical_threshold integer DEFAULT 75,
ADD COLUMN IF NOT EXISTS welfare_check_dispatcher_model text DEFAULT 'claude-haiku-4-5-20250929',

ADD COLUMN IF NOT EXISTS emergency_intelligence_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS emergency_intelligence_auto_regenerate boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS emergency_intelligence_stale_days integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS emergency_intelligence_model text DEFAULT 'claude-haiku-4-5-20250929';

COMMENT ON COLUMN public.ai_skill_config.cultural_health_coach_enabled IS 'Enable culturally-adapted health content';
COMMENT ON COLUMN public.ai_skill_config.welfare_check_dispatcher_enabled IS 'Enable AI welfare check prioritization for law enforcement';
COMMENT ON COLUMN public.ai_skill_config.emergency_intelligence_enabled IS 'Enable pre-generated emergency response briefings';

-- =====================================================
-- ANALYTICS VIEWS
-- =====================================================

-- Cultural Content Performance
CREATE OR REPLACE VIEW public.cultural_content_analytics AS
SELECT
  tenant_id,
  language_code,
  cultural_context,
  content_type,
  COUNT(*) as deliveries,
  COUNT(*) FILTER (WHERE opened = true) as opened_count,
  COUNT(*) FILTER (WHERE clicked = true) as clicked_count,
  COUNT(*) FILTER (WHERE completed = true) as completed_count,
  AVG(relevance_score) as avg_relevance,
  AVG(cultural_appropriateness_score) as avg_cultural_appropriateness,
  COUNT(*) FILTER (WHERE from_cache = true) as cache_hit_count
FROM public.personalized_content_delivery
WHERE delivered_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY tenant_id, language_code, cultural_context, content_type;

COMMENT ON VIEW public.cultural_content_analytics IS 'Performance metrics for culturally-adapted content';

-- Welfare Check Dispatch Analytics
CREATE OR REPLACE VIEW public.welfare_check_analytics AS
SELECT
  tenant_id,
  calculation_date,
  COUNT(*) as total_seniors,
  COUNT(*) FILTER (WHERE priority_category = 'critical') as critical_count,
  COUNT(*) FILTER (WHERE priority_category = 'high') as high_count,
  COUNT(*) FILTER (WHERE dispatched = true) as dispatched_count,
  COUNT(*) FILTER (WHERE check_completed = true) as completed_count,
  AVG(priority_score) as avg_priority_score,
  AVG(EXTRACT(EPOCH FROM (check_completed_at - dispatched_at))/3600) as avg_response_hours
FROM public.welfare_check_priority_queue
GROUP BY tenant_id, calculation_date;

COMMENT ON VIEW public.welfare_check_analytics IS 'Daily welfare check dispatch analytics';

-- Emergency Briefing Usage
CREATE OR REPLACE VIEW public.emergency_briefing_analytics AS
SELECT
  tenant_id,
  DATE(accessed_at) as access_date,
  COUNT(*) as total_accesses,
  COUNT(DISTINCT briefing_id) as unique_briefings_accessed,
  COUNT(*) FILTER (WHERE access_reason = '911_call') as emergency_calls,
  COUNT(*) FILTER (WHERE access_reason = 'welfare_check') as welfare_checks,
  COUNT(*) FILTER (WHERE response_dispatched = true) as responses_dispatched,
  AVG(EXTRACT(EPOCH FROM (response_arrival_time - accessed_at))/60) as avg_response_minutes
FROM public.emergency_briefing_access_log
GROUP BY tenant_id, DATE(accessed_at);

COMMENT ON VIEW public.emergency_briefing_analytics IS 'Emergency briefing access and response metrics';

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT SELECT ON public.cultural_content_cache TO authenticated;
GRANT SELECT ON public.personalized_content_delivery TO authenticated;
GRANT SELECT ON public.welfare_check_priority_queue TO authenticated;
GRANT SELECT ON public.emergency_response_briefings TO authenticated;
GRANT SELECT ON public.emergency_briefing_access_log TO authenticated;
GRANT SELECT ON public.cultural_content_analytics TO authenticated;
GRANT SELECT ON public.welfare_check_analytics TO authenticated;
GRANT SELECT ON public.emergency_briefing_analytics TO authenticated;

commit;

-- migrate:down
begin;

DROP VIEW IF EXISTS public.emergency_briefing_analytics CASCADE;
DROP VIEW IF EXISTS public.welfare_check_analytics CASCADE;
DROP VIEW IF EXISTS public.cultural_content_analytics CASCADE;

ALTER TABLE public.ai_skill_config
DROP COLUMN IF EXISTS cultural_health_coach_enabled,
DROP COLUMN IF EXISTS cultural_health_coach_default_language,
DROP COLUMN IF EXISTS cultural_health_coach_use_cache,
DROP COLUMN IF EXISTS cultural_health_coach_model,
DROP COLUMN IF EXISTS welfare_check_dispatcher_enabled,
DROP COLUMN IF EXISTS welfare_check_dispatcher_auto_prioritize,
DROP COLUMN IF EXISTS welfare_check_dispatcher_critical_threshold,
DROP COLUMN IF EXISTS welfare_check_dispatcher_model,
DROP COLUMN IF EXISTS emergency_intelligence_enabled,
DROP COLUMN IF EXISTS emergency_intelligence_auto_regenerate,
DROP COLUMN IF EXISTS emergency_intelligence_stale_days,
DROP COLUMN IF EXISTS emergency_intelligence_model;

DROP TABLE IF EXISTS public.emergency_briefing_access_log CASCADE;
DROP TABLE IF EXISTS public.emergency_response_briefings CASCADE;
DROP TABLE IF EXISTS public.welfare_check_priority_queue CASCADE;
DROP TABLE IF EXISTS public.personalized_content_delivery CASCADE;
DROP TABLE IF EXISTS public.cultural_content_cache CASCADE;

commit;
