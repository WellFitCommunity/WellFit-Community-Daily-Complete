-- Bed Optimizer Analytics Tables
-- Supports predictive capacity planning and surge management
-- Copyright (c) 2026 Envision VirtualEdge Group LLC. All rights reserved.

-- =============================================================================
-- LOS PREDICTIONS TABLE
-- =============================================================================

-- Historical LOS data for predictions
CREATE TABLE IF NOT EXISTS public.los_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  unit_id uuid,
  diagnosis_category text NOT NULL,
  avg_los_hours numeric NOT NULL,
  std_dev_hours numeric,
  sample_size integer NOT NULL DEFAULT 0,
  confidence_level numeric DEFAULT 0.95,
  calculated_at timestamptz DEFAULT now()
);

-- Add foreign key only if hospital_units table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hospital_units' AND table_schema = 'public') THEN
    ALTER TABLE public.los_predictions
      ADD CONSTRAINT fk_los_predictions_unit
      FOREIGN KEY (unit_id) REFERENCES public.hospital_units(id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  -- Constraint already exists, skip
  NULL;
END $$;

COMMENT ON TABLE public.los_predictions IS 'Historical length of stay predictions by diagnosis category';
COMMENT ON COLUMN public.los_predictions.confidence_level IS 'Statistical confidence level for predictions (default 95%)';

-- Index for LOS lookups
CREATE INDEX IF NOT EXISTS idx_los_predictions_lookup
  ON public.los_predictions(tenant_id, diagnosis_category, calculated_at DESC);

-- =============================================================================
-- CAPACITY FORECASTS TABLE
-- =============================================================================

-- Capacity forecasts (24-72 hour windows)
CREATE TABLE IF NOT EXISTS public.capacity_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  unit_id uuid,
  forecast_date date NOT NULL,
  forecast_hour integer CHECK (forecast_hour >= 0 AND forecast_hour < 24),
  predicted_census integer NOT NULL,
  predicted_admissions integer DEFAULT 0,
  predicted_discharges integer DEFAULT 0,
  confidence_lower integer,
  confidence_upper integer,
  model_version text DEFAULT 'v1',
  created_at timestamptz DEFAULT now(),
  -- Prevent duplicate forecasts for same unit/date/hour
  CONSTRAINT unique_capacity_forecast UNIQUE (tenant_id, unit_id, forecast_date, forecast_hour)
);

-- Add foreign key only if hospital_units table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hospital_units' AND table_schema = 'public') THEN
    ALTER TABLE public.capacity_forecasts
      ADD CONSTRAINT fk_capacity_forecasts_unit
      FOREIGN KEY (unit_id) REFERENCES public.hospital_units(id)
      ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

COMMENT ON TABLE public.capacity_forecasts IS 'Hourly capacity forecasts for predictive bed management';
COMMENT ON COLUMN public.capacity_forecasts.model_version IS 'Version of the prediction model used';

-- Index for forecast lookups
CREATE INDEX IF NOT EXISTS idx_capacity_forecasts_lookup
  ON public.capacity_forecasts(tenant_id, unit_id, forecast_date);

CREATE INDEX IF NOT EXISTS idx_capacity_forecasts_date
  ON public.capacity_forecasts(forecast_date DESC);

-- =============================================================================
-- SURGE EVENTS TABLE
-- =============================================================================

-- Surge events tracking
CREATE TABLE IF NOT EXISTS public.surge_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  facility_id uuid,
  event_type text NOT NULL CHECK (event_type IN (
    'capacity_warning',
    'capacity_critical',
    'diversion',
    'surge_protocol',
    'normalized'
  )),
  trigger_threshold numeric,
  actual_value numeric,
  affected_units uuid[],
  actions_taken jsonb DEFAULT '[]',
  started_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  metadata jsonb DEFAULT '{}'
);

COMMENT ON TABLE public.surge_events IS 'Tracking of surge events and capacity crises';
COMMENT ON COLUMN public.surge_events.event_type IS 'Type: warning/critical/diversion/surge_protocol/normalized';
COMMENT ON COLUMN public.surge_events.affected_units IS 'Array of unit IDs affected by this surge event';

-- Index for active surge events
CREATE INDEX IF NOT EXISTS idx_surge_events_active
  ON public.surge_events(tenant_id, facility_id)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_surge_events_tenant_time
  ON public.surge_events(tenant_id, started_at DESC);

-- =============================================================================
-- PLACEMENT RECOMMENDATIONS TABLE
-- =============================================================================

-- Optimization recommendations for bed placement
CREATE TABLE IF NOT EXISTS public.placement_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  recommended_bed_id uuid,
  recommended_unit_id uuid,
  score numeric NOT NULL,
  factors jsonb NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.placement_recommendations IS 'AI-generated bed placement recommendations';
COMMENT ON COLUMN public.placement_recommendations.score IS 'Overall placement score (0-100)';
COMMENT ON COLUMN public.placement_recommendations.factors IS 'JSON breakdown of scoring factors';

-- Index for pending recommendations
CREATE INDEX IF NOT EXISTS idx_placement_recommendations_pending
  ON public.placement_recommendations(tenant_id, patient_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_placement_recommendations_expires
  ON public.placement_recommendations(expires_at)
  WHERE status = 'pending';

-- =============================================================================
-- THROUGHPUT METRICS TABLE
-- =============================================================================

-- Throughput optimization metrics
CREATE TABLE IF NOT EXISTS public.throughput_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  unit_id uuid,
  metric_date date NOT NULL,
  metric_hour integer CHECK (metric_hour >= 0 AND metric_hour < 24),
  admissions integer DEFAULT 0,
  discharges integer DEFAULT 0,
  transfers_in integer DEFAULT 0,
  transfers_out integer DEFAULT 0,
  avg_los_hours numeric,
  avg_turnaround_minutes numeric,
  bed_days_available integer,
  bed_days_used integer,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_throughput_metric UNIQUE (tenant_id, unit_id, metric_date, metric_hour)
);

COMMENT ON TABLE public.throughput_metrics IS 'Hourly throughput metrics for capacity optimization';

CREATE INDEX IF NOT EXISTS idx_throughput_metrics_lookup
  ON public.throughput_metrics(tenant_id, unit_id, metric_date);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.los_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capacity_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surge_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.throughput_metrics ENABLE ROW LEVEL SECURITY;

-- Service role policies (full access)
CREATE POLICY "Service role full access on los_predictions"
  ON public.los_predictions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on capacity_forecasts"
  ON public.capacity_forecasts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on surge_events"
  ON public.surge_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on placement_recommendations"
  ON public.placement_recommendations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on throughput_metrics"
  ON public.throughput_metrics FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Tenant isolation policies for authenticated users
-- Uses a helper function to get tenant_id from profile

-- Create helper function if it doesn't exist
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- los_predictions: Tenant can read own data
CREATE POLICY "Tenant isolation on los_predictions"
  ON public.los_predictions
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- capacity_forecasts: Tenant can read own data
CREATE POLICY "Tenant isolation on capacity_forecasts"
  ON public.capacity_forecasts
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- surge_events: Tenant can read own data
CREATE POLICY "Tenant isolation on surge_events"
  ON public.surge_events
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- placement_recommendations: Tenant can read own data
CREATE POLICY "Tenant isolation on placement_recommendations"
  ON public.placement_recommendations
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- throughput_metrics: Tenant can read own data
CREATE POLICY "Tenant isolation on throughput_metrics"
  ON public.throughput_metrics
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id());

-- =============================================================================
-- SEED DEFAULT LOS DATA
-- =============================================================================

-- Insert common diagnosis category defaults (no tenant_id means global defaults)
-- These will be used when tenant-specific data is not available
INSERT INTO public.los_predictions (tenant_id, diagnosis_category, avg_los_hours, std_dev_hours, sample_size)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'cardiac', 96, 24, 1000),
  ('00000000-0000-0000-0000-000000000000', 'respiratory', 72, 18, 1000),
  ('00000000-0000-0000-0000-000000000000', 'surgical', 48, 12, 1000),
  ('00000000-0000-0000-0000-000000000000', 'medical', 72, 24, 1000),
  ('00000000-0000-0000-0000-000000000000', 'observation', 24, 6, 1000),
  ('00000000-0000-0000-0000-000000000000', 'stroke', 120, 36, 500),
  ('00000000-0000-0000-0000-000000000000', 'trauma', 96, 48, 500),
  ('00000000-0000-0000-0000-000000000000', 'pneumonia', 96, 24, 800),
  ('00000000-0000-0000-0000-000000000000', 'sepsis', 144, 48, 600),
  ('00000000-0000-0000-0000-000000000000', 'chf', 96, 24, 700),
  ('00000000-0000-0000-0000-000000000000', 'copd', 72, 24, 700),
  ('00000000-0000-0000-0000-000000000000', 'hip_fracture', 120, 36, 400),
  ('00000000-0000-0000-0000-000000000000', 'gi_bleed', 72, 24, 500),
  ('00000000-0000-0000-0000-000000000000', 'diabetes_acute', 48, 12, 600)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- UTILITY FUNCTIONS
-- =============================================================================

-- Function to get LOS prediction for a diagnosis
CREATE OR REPLACE FUNCTION get_los_prediction(
  p_tenant_id uuid,
  p_diagnosis_category text,
  p_unit_id uuid DEFAULT NULL
)
RETURNS TABLE (
  predicted_los_hours numeric,
  confidence_lower numeric,
  confidence_upper numeric,
  sample_size integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  z_score numeric := 1.96; -- 95% confidence
  rec RECORD;
BEGIN
  -- Try tenant-specific + unit-specific first
  SELECT lp.avg_los_hours, lp.std_dev_hours, lp.sample_size
  INTO rec
  FROM los_predictions lp
  WHERE lp.tenant_id = p_tenant_id
    AND lp.diagnosis_category = p_diagnosis_category
    AND (p_unit_id IS NULL OR lp.unit_id = p_unit_id)
  ORDER BY lp.calculated_at DESC
  LIMIT 1;

  -- Fall back to global defaults if no tenant-specific data
  IF rec IS NULL THEN
    SELECT lp.avg_los_hours, lp.std_dev_hours, lp.sample_size
    INTO rec
    FROM los_predictions lp
    WHERE lp.tenant_id = '00000000-0000-0000-0000-000000000000'
      AND lp.diagnosis_category = p_diagnosis_category
    ORDER BY lp.calculated_at DESC
    LIMIT 1;
  END IF;

  -- Default if nothing found
  IF rec IS NULL THEN
    RETURN QUERY SELECT 48::numeric, 24::numeric, 72::numeric, 0;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    rec.avg_los_hours as predicted_los_hours,
    GREATEST(0, rec.avg_los_hours - z_score * COALESCE(rec.std_dev_hours, rec.avg_los_hours * 0.25)) as confidence_lower,
    rec.avg_los_hours + z_score * COALESCE(rec.std_dev_hours, rec.avg_los_hours * 0.25) as confidence_upper,
    rec.sample_size;
END;
$$;

COMMENT ON FUNCTION get_los_prediction IS 'Returns LOS prediction for a diagnosis category with confidence interval';

-- Function to expire old placement recommendations
CREATE OR REPLACE FUNCTION expire_old_placement_recommendations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count integer;
BEGIN
  UPDATE placement_recommendations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < now();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

COMMENT ON FUNCTION expire_old_placement_recommendations IS 'Marks pending recommendations past their expiry as expired';
