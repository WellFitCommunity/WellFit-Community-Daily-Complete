-- ============================================================================
-- SPECIALIST WORKFLOW ENGINE - DATABASE SCHEMA
-- Future-proof schema for ANY specialist type in rural healthcare
-- ============================================================================

-- Enable PostGIS for geolocation features
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- SPECIALIST PROVIDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.specialist_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  specialist_type TEXT NOT NULL CHECK (specialist_type IN (
    'CHW', 'AgHealth', 'MAT', 'WoundCare', 'Geriatric', 'Telepsych', 'RT', 'Custom'
  )),
  workflow_template_id TEXT NOT NULL,
  license_number TEXT,
  npi TEXT,
  service_area GEOGRAPHY(POLYGON, 4326), -- Geographic service area
  credentials JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_specialist UNIQUE(user_id, specialist_type)
);

CREATE INDEX idx_specialist_providers_user_id ON public.specialist_providers(user_id);
CREATE INDEX idx_specialist_providers_type ON public.specialist_providers(specialist_type);
CREATE INDEX idx_specialist_providers_active ON public.specialist_providers(is_active);
CREATE INDEX idx_specialist_providers_service_area ON public.specialist_providers USING GIST(service_area);

-- ============================================================================
-- FIELD VISITS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.field_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL REFERENCES public.specialist_providers(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  visit_type TEXT NOT NULL,
  workflow_template_id TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  check_in_location GEOGRAPHY(POINT, 4326),
  check_in_time TIMESTAMPTZ,
  check_out_location GEOGRAPHY(POINT, 4326),
  check_out_time TIMESTAMPTZ,
  current_step INTEGER DEFAULT 1,
  completed_steps INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  data JSONB DEFAULT '{}'::jsonb, -- Flexible data storage
  photos TEXT[] DEFAULT ARRAY[]::TEXT[],
  voice_notes TEXT[] DEFAULT ARRAY[]::TEXT[],
  offline_captured BOOLEAN DEFAULT false,
  synced_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  encounter_id UUID REFERENCES public.encounters(id), -- Link to billable encounter
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_field_visits_specialist ON public.field_visits(specialist_id);
CREATE INDEX idx_field_visits_patient ON public.field_visits(patient_id);
CREATE INDEX idx_field_visits_status ON public.field_visits(status);
CREATE INDEX idx_field_visits_scheduled ON public.field_visits(scheduled_at);
CREATE INDEX idx_field_visits_workflow ON public.field_visits(workflow_template_id);
CREATE INDEX idx_field_visits_check_in_loc ON public.field_visits USING GIST(check_in_location);

-- ============================================================================
-- SPECIALIST ASSESSMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.specialist_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES public.field_visits(id) ON DELETE CASCADE,
  assessment_type TEXT NOT NULL,
  template_id TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  photos TEXT[] DEFAULT ARRAY[]::TEXT[],
  calculated_scores JSONB DEFAULT '{}'::jsonb,
  requires_review BOOLEAN DEFAULT false,
  reviewed_by UUID REFERENCES public.profiles(user_id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_specialist_assessments_visit ON public.specialist_assessments(visit_id);
CREATE INDEX idx_specialist_assessments_type ON public.specialist_assessments(assessment_type);
CREATE INDEX idx_specialist_assessments_requires_review ON public.specialist_assessments(requires_review);

-- ============================================================================
-- SPECIALIST ALERTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.specialist_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES public.field_visits(id) ON DELETE CASCADE,
  alert_rule_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  triggered_by JSONB NOT NULL,
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  notify_role TEXT NOT NULL,
  notify_user_id UUID REFERENCES public.profiles(user_id),
  message TEXT NOT NULL,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES public.profiles(user_id),
  escalated BOOLEAN DEFAULT false,
  escalated_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT
);

CREATE INDEX idx_specialist_alerts_visit ON public.specialist_alerts(visit_id);
CREATE INDEX idx_specialist_alerts_severity ON public.specialist_alerts(severity);
CREATE INDEX idx_specialist_alerts_acknowledged ON public.specialist_alerts(acknowledged);
CREATE INDEX idx_specialist_alerts_resolved ON public.specialist_alerts(resolved);
CREATE INDEX idx_specialist_alerts_notify_user ON public.specialist_alerts(notify_user_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.specialist_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialist_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialist_alerts ENABLE ROW LEVEL SECURITY;

-- Specialist Providers Policies
CREATE POLICY "Users can view their own specialist profiles"
  ON public.specialist_providers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all specialist profiles"
  ON public.specialist_providers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can insert specialist profiles"
  ON public.specialist_providers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update specialist profiles"
  ON public.specialist_providers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Field Visits Policies
CREATE POLICY "Specialists can view their own visits"
  ON public.field_visits FOR SELECT
  USING (
    specialist_id IN (
      SELECT id FROM public.specialist_providers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Patients can view their own visits"
  ON public.field_visits FOR SELECT
  USING (auth.uid() = patient_id);

CREATE POLICY "Care team can view patient visits"
  ON public.field_visits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('physician', 'nurse', 'case_manager', 'admin')
    )
  );

CREATE POLICY "Specialists can create visits"
  ON public.field_visits FOR INSERT
  WITH CHECK (
    specialist_id IN (
      SELECT id FROM public.specialist_providers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Specialists can update their own visits"
  ON public.field_visits FOR UPDATE
  USING (
    specialist_id IN (
      SELECT id FROM public.specialist_providers WHERE user_id = auth.uid()
    )
  );

-- Assessments Policies
CREATE POLICY "Users can view assessments for visits they can access"
  ON public.specialist_assessments FOR SELECT
  USING (
    visit_id IN (SELECT id FROM public.field_visits)
  );

CREATE POLICY "Specialists can create assessments"
  ON public.specialist_assessments FOR INSERT
  WITH CHECK (
    visit_id IN (
      SELECT fv.id FROM public.field_visits fv
      JOIN public.specialist_providers sp ON fv.specialist_id = sp.id
      WHERE sp.user_id = auth.uid()
    )
  );

-- Alerts Policies
CREATE POLICY "Users can view alerts assigned to them"
  ON public.specialist_alerts FOR SELECT
  USING (notify_user_id = auth.uid());

CREATE POLICY "Users can view alerts for their role"
  ON public.specialist_alerts FOR SELECT
  USING (
    notify_role IN (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Specialists can create alerts"
  ON public.specialist_alerts FOR INSERT
  WITH CHECK (true); -- Alerts are system-generated

CREATE POLICY "Users can acknowledge alerts assigned to them"
  ON public.specialist_alerts FOR UPDATE
  USING (notify_user_id = auth.uid() OR notify_role IN (
    SELECT role FROM public.profiles WHERE id = auth.uid()
  ));

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if point is within specialist's service area
CREATE OR REPLACE FUNCTION public.is_within_service_area(
  specialist_id UUID,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  service_area_geog GEOGRAPHY;
  point_geog GEOGRAPHY;
BEGIN
  -- Get specialist's service area
  SELECT service_area INTO service_area_geog
  FROM public.specialist_providers
  WHERE id = specialist_id;

  -- If no service area defined, return true (no restriction)
  IF service_area_geog IS NULL THEN
    RETURN true;
  END IF;

  -- Create point from lat/lon
  point_geog := ST_MakePoint(lon, lat)::geography;

  -- Check if point is within service area
  RETURN ST_Contains(service_area_geog::geometry, point_geog::geometry);
END;
$$;

-- Function to add photo to visit
CREATE OR REPLACE FUNCTION public.add_photo_to_visit(
  visit_id UUID,
  photo_url TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.field_visits
  SET photos = array_append(photos, photo_url),
      updated_at = NOW()
  WHERE id = visit_id;
END;
$$;

-- Function to calculate visit duration
CREATE OR REPLACE FUNCTION public.get_visit_duration(visit_id UUID)
RETURNS INTERVAL
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  check_in TIMESTAMPTZ;
  check_out TIMESTAMPTZ;
BEGIN
  SELECT check_in_time, check_out_time INTO check_in, check_out
  FROM public.field_visits
  WHERE id = visit_id;

  IF check_in IS NULL OR check_out IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN check_out - check_in;
END;
$$;

-- Function to get distance between check-in and check-out locations
CREATE OR REPLACE FUNCTION public.get_visit_location_distance(visit_id UUID)
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  check_in_loc GEOGRAPHY;
  check_out_loc GEOGRAPHY;
BEGIN
  SELECT check_in_location, check_out_location INTO check_in_loc, check_out_loc
  FROM public.field_visits
  WHERE id = visit_id;

  IF check_in_loc IS NULL OR check_out_loc IS NULL THEN
    RETURN NULL;
  END IF;

  -- Return distance in meters
  RETURN ST_Distance(check_in_loc, check_out_loc);
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_specialist_providers_updated_at
  BEFORE UPDATE ON public.specialist_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_field_visits_updated_at
  BEFORE UPDATE ON public.field_visits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE ON public.specialist_providers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.field_visits TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.specialist_assessments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.specialist_alerts TO authenticated;

-- Grant access to helper functions
GRANT EXECUTE ON FUNCTION public.is_within_service_area TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_photo_to_visit TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_visit_duration TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_visit_location_distance TO authenticated;

-- ============================================================================
-- INDEXES FOR JSONB QUERIES
-- ============================================================================

-- Optimize JSONB queries on visit data
CREATE INDEX IF NOT EXISTS idx_field_visits_data_gin ON public.field_visits USING GIN(data);
CREATE INDEX IF NOT EXISTS idx_specialist_assessments_data_gin ON public.specialist_assessments USING GIN(data);
CREATE INDEX IF NOT EXISTS idx_specialist_alerts_triggered_by_gin ON public.specialist_alerts USING GIN(triggered_by);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.specialist_providers IS 'Specialist providers (CHW, MAT, etc.) with geographic service areas';
COMMENT ON TABLE public.field_visits IS 'Field visits with GPS tracking and offline sync support';
COMMENT ON TABLE public.specialist_assessments IS 'Flexible assessments with any questionnaire type';
COMMENT ON TABLE public.specialist_alerts IS 'Rule-based alerts with escalation paths';

COMMENT ON COLUMN public.specialist_providers.service_area IS 'Geographic polygon defining service area (PostGIS)';
COMMENT ON COLUMN public.field_visits.data IS 'Flexible JSONB storage for any workflow data';
COMMENT ON COLUMN public.field_visits.offline_captured IS 'True if data was captured offline and synced later';

-- Migration complete
