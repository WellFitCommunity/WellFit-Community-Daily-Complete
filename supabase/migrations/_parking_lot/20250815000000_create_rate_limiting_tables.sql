-- Migration to create tables for rate limiting login and registration attempts

CREATE TABLE IF NOT EXISTS public.rate_limit_logins (
  ip_address TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ip_address, attempted_at) -- Composite key to allow multiple attempts from same IP over time
);

-- Index for querying recent attempts by IP
CREATE INDEX IF NOT EXISTS idx_rate_limit_logins_ip_attempted_at ON public.rate_limit_logins(ip_address, attempted_at DESC);

CREATE TABLE IF NOT EXISTS public.rate_limit_registrations (
  ip_address TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ip_address, attempted_at)
);

-- Index for querying recent attempts by IP
CREATE INDEX IF NOT EXISTS idx_rate_limit_registrations_ip_attempted_at ON public.rate_limit_registrations(ip_address, attempted_at DESC);

-- Optional: Policy to auto-delete old records (e.g., older than 1 hour) to keep tables small.
-- This could also be handled by a cron job or scheduled function.
-- Example for logins table:
-- CREATE OR REPLACE FUNCTION delete_old_login_attempts() RETURNS trigger
-- LANGUAGE plpgsql
-- AS $$
-- BEGIN
--   DELETE FROM public.rate_limit_logins WHERE attempted_at < NOW() - INTERVAL '1 hour';
--   RETURN NEW;
-- END;
-- $$;

-- CREATE TRIGGER trigger_delete_old_login_attempts
-- AFTER INSERT ON public.rate_limit_logins
-- EXECUTE PROCEDURE delete_old_login_attempts();

-- (Similar trigger can be created for rate_limit_registrations)

-- Note: RLS should be enabled for these tables if they are accessed by less privileged roles,
-- but typically these would be accessed by service_role or a dedicated security role.
-- For this implementation, we assume access via service_role key within Supabase functions.

ALTER TABLE public.rate_limit_logins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_registrations ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access
CREATE POLICY "Allow service_role full access on rate_limit_logins"
ON public.rate_limit_logins
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow service_role full access on rate_limit_registrations"
ON public.rate_limit_registrations
FOR ALL
USING (true)
WITH CHECK (true);
