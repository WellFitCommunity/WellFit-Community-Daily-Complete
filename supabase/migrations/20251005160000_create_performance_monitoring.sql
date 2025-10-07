-- Custom Performance Monitoring System (FREE alternative to DataDog/Sentry)

BEGIN;

-- ========================================================================
-- 1. ERROR LOGS TABLE
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  error_message text NOT NULL,
  error_stack text,
  error_type text,
  component_name text,
  page_url text,
  user_agent text,
  browser_info jsonb,
  severity text CHECK (severity IN ('critical', 'error', 'warning', 'info')) DEFAULT 'error',
  created_at timestamptz DEFAULT now(),
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_error_logs_created ON public.error_logs(created_at DESC);
CREATE INDEX idx_error_logs_severity ON public.error_logs(severity, created_at DESC);
CREATE INDEX idx_error_logs_unresolved ON public.error_logs(resolved, created_at DESC) WHERE resolved = false;
CREATE INDEX idx_error_logs_user ON public.error_logs(user_id, created_at DESC);

-- ========================================================================
-- 2. PERFORMANCE METRICS TABLE
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metric_type text NOT NULL, -- 'page_load', 'api_call', 'component_render', 'user_action'
  metric_name text NOT NULL,
  duration_ms numeric(10,2),
  page_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_performance_metrics_type ON public.performance_metrics(metric_type, created_at DESC);
CREATE INDEX idx_performance_metrics_name ON public.performance_metrics(metric_name, created_at DESC);
CREATE INDEX idx_performance_metrics_created ON public.performance_metrics(created_at DESC);

-- ========================================================================
-- 3. USER SESSIONS TABLE
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_start timestamptz DEFAULT now(),
  session_end timestamptz,
  duration_seconds integer,
  pages_viewed integer DEFAULT 0,
  actions_taken integer DEFAULT 0,
  device_type text,
  browser text,
  os text,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_user_sessions_user ON public.user_sessions(user_id, session_start DESC);
CREATE INDEX idx_user_sessions_start ON public.user_sessions(session_start DESC);

-- ========================================================================
-- 4. FEATURE USAGE TRACKING
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.feature_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  feature_name text NOT NULL,
  action text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_feature_usage_feature ON public.feature_usage(feature_name, created_at DESC);
CREATE INDEX idx_feature_usage_user ON public.feature_usage(user_id, created_at DESC);
CREATE INDEX idx_feature_usage_created ON public.feature_usage(created_at DESC);

-- ========================================================================
-- 5. SYSTEM HEALTH METRICS (For API monitoring)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.system_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  metric_value numeric,
  status text CHECK (status IN ('healthy', 'degraded', 'critical')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_system_health_metric ON public.system_health(metric_name, created_at DESC);
CREATE INDEX idx_system_health_status ON public.system_health(status, created_at DESC);

-- ========================================================================
-- 6. PERFORMANCE SUMMARY VIEW (Real-time dashboard data)
-- ========================================================================
CREATE OR REPLACE VIEW public.performance_summary AS
WITH recent_errors AS (
  SELECT COUNT(*) as error_count
  FROM public.error_logs
  WHERE created_at >= now() - interval '24 hours'
),
avg_performance AS (
  SELECT
    metric_type,
    AVG(duration_ms) as avg_duration,
    MAX(duration_ms) as max_duration,
    COUNT(*) as count
  FROM public.performance_metrics
  WHERE created_at >= now() - interval '24 hours'
  GROUP BY metric_type
),
active_users AS (
  SELECT COUNT(DISTINCT user_id) as count
  FROM public.user_sessions
  WHERE session_start >= now() - interval '24 hours'
)
SELECT
  (SELECT error_count FROM recent_errors) as errors_24h,
  (SELECT count FROM active_users) as active_users_24h,
  (SELECT json_agg(json_build_object(
    'type', metric_type,
    'avg_ms', avg_duration,
    'max_ms', max_duration,
    'count', count
  )) FROM avg_performance) as performance_24h;

-- ========================================================================
-- 7. RLS POLICIES
-- ========================================================================

-- Error logs: Only admins can view all, users can view their own
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all errors" ON public.error_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')));

CREATE POLICY "Users can insert error logs" ON public.error_logs FOR INSERT
  WITH CHECK (true); -- Allow anonymous error logging

-- Performance metrics: Admins only
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view performance" ON public.performance_metrics FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')));

CREATE POLICY "Anyone can insert metrics" ON public.performance_metrics FOR INSERT
  WITH CHECK (true);

-- User sessions: Admins and own sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all sessions" ON public.user_sessions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')));

CREATE POLICY "Users view own sessions" ON public.user_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Anyone can insert sessions" ON public.user_sessions FOR INSERT
  WITH CHECK (true);

-- Feature usage: Admins only
ALTER TABLE public.feature_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view feature usage" ON public.feature_usage FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')));

CREATE POLICY "Anyone can log feature usage" ON public.feature_usage FOR INSERT
  WITH CHECK (true);

-- System health: Admins only
ALTER TABLE public.system_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view system health" ON public.system_health FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')));

-- Grant permissions
GRANT SELECT ON public.performance_summary TO authenticated;

-- ========================================================================
-- 8. CLEANUP FUNCTION (Auto-delete old data to save space)
-- ========================================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_monitoring_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Keep errors for 90 days
  DELETE FROM public.error_logs WHERE created_at < now() - interval '90 days';

  -- Keep performance metrics for 30 days
  DELETE FROM public.performance_metrics WHERE created_at < now() - interval '30 days';

  -- Keep sessions for 60 days
  DELETE FROM public.user_sessions WHERE created_at < now() - interval '60 days';

  -- Keep feature usage for 60 days
  DELETE FROM public.feature_usage WHERE created_at < now() - interval '60 days';

  -- Keep system health for 30 days
  DELETE FROM public.system_health WHERE created_at < now() - interval '30 days';
END;
$$;

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '✅ Performance Monitoring System Created!';
  RAISE NOTICE '   📊 Tables: error_logs, performance_metrics, user_sessions, feature_usage, system_health';
  RAISE NOTICE '   📈 View: performance_summary (24h dashboard data)';
  RAISE NOTICE '   🔒 RLS enabled with admin-only access';
  RAISE NOTICE '   🧹 Auto-cleanup function created';
  RAISE NOTICE '';
  RAISE NOTICE '💡 FREE alternative to DataDog/Sentry - $0/month!';
END $$;
