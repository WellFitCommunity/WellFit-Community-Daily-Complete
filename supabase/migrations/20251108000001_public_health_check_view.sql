-- Public Health Check View for UptimeRobot Monitoring
-- This creates a publicly accessible view that can be queried without authentication
-- UptimeRobot can use Supabase REST API to check this view

-- Create a simple health check table
CREATE TABLE IF NOT EXISTS public.system_health_check (
  id int PRIMARY KEY DEFAULT 1,
  status text NOT NULL DEFAULT 'operational',
  last_check timestamptz DEFAULT now(),
  uptime_start timestamptz DEFAULT now(),
  CONSTRAINT single_row_check CHECK (id = 1)
);

-- Insert the single health check row
INSERT INTO public.system_health_check (id, status, uptime_start)
VALUES (1, 'operational', now())
ON CONFLICT (id) DO UPDATE
SET last_check = now();

-- Create a function to update health status (called by Guardian)
CREATE OR REPLACE FUNCTION update_system_health(p_status text DEFAULT 'operational')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.system_health_check
  SET status = p_status,
      last_check = now()
  WHERE id = 1;
END;
$$;

-- Grant public read access to health check table
-- This allows UptimeRobot to query it via REST API without auth
ALTER TABLE public.system_health_check ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read the health check (no auth required)
DROP POLICY IF EXISTS "Allow public read access to health check" ON public.system_health_check;
CREATE POLICY "Allow public read access to health check"
ON public.system_health_check
FOR SELECT
TO anon
USING (true);

-- Policy: Only service role can update
DROP POLICY IF EXISTS "Only service can update health check" ON public.system_health_check;
CREATE POLICY "Only service can update health check"
ON public.system_health_check
FOR UPDATE
TO service_role
USING (true);

-- Create a view with additional health metrics
CREATE OR REPLACE VIEW public.system_status_view AS
SELECT
  status,
  last_check,
  uptime_start,
  EXTRACT(EPOCH FROM (now() - uptime_start))::bigint as uptime_seconds,
  now() as timestamp,
  -- Check if last check was recent (within 10 minutes)
  CASE
    WHEN last_check > now() - interval '10 minutes' THEN 'healthy'
    ELSE 'stale'
  END as check_freshness
FROM public.system_health_check
WHERE id = 1;

-- Grant public read access to the view
GRANT SELECT ON public.system_status_view TO anon;

-- Update Guardian monitoring to update health status
CREATE OR REPLACE FUNCTION trigger_guardian_monitoring()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
  request_id bigint;
BEGIN
  -- Update health check timestamp
  UPDATE public.system_health_check
  SET last_check = now()
  WHERE id = 1;

  -- Get Supabase URL and service role key
  supabase_url := current_setting('app.supabase_url', true);
  service_role_key := current_setting('app.service_role_key', true);

  IF supabase_url IS NULL THEN
    supabase_url := 'https://xkybsjnvuohpqpbkikyn.supabase.co';
  END IF;

  -- Call Guardian agent monitoring via pg_net
  request_id := net.http_post(
    url := supabase_url || '/functions/v1/guardian-agent',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
    ),
    body := jsonb_build_object(
      'action', 'monitor'
    )
  );

  -- Log the request ID
  RAISE NOTICE 'Guardian monitoring triggered with request_id: %', request_id;

  -- Log to our custom table
  INSERT INTO guardian_cron_log (job_name, status, details)
  VALUES (
    'guardian-automated-monitoring',
    'triggered',
    jsonb_build_object('request_id', request_id, 'timestamp', now())
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Mark health check as degraded if Guardian fails
    UPDATE public.system_health_check
    SET status = 'degraded',
        last_check = now()
    WHERE id = 1;

    RAISE WARNING 'Guardian monitoring failed: %', SQLERRM;

    INSERT INTO guardian_cron_log (job_name, status, details)
    VALUES (
      'guardian-automated-monitoring',
      'failed',
      jsonb_build_object('error', SQLERRM, 'timestamp', now())
    );
END;
$$;

COMMENT ON TABLE public.system_health_check IS
  'Public health check table for UptimeRobot and external monitoring. Accessible via REST API without authentication.';

COMMENT ON VIEW public.system_status_view IS
  'Public view showing system health status with uptime metrics. Query via: https://xkybsjnvuohpqpbkikyn.supabase.co/rest/v1/system_status_view?select=*';

COMMENT ON FUNCTION update_system_health(text) IS
  'Updates system health status. Called by Guardian or manual interventions.';
