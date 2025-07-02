-- Create admin_pin_attempts table
CREATE TABLE IF NOT EXISTS public.admin_pin_attempts (
  id BIGSERIAL PRIMARY KEY,
  ip_address TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  last_attempt_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.admin_pin_attempts IS 'Tracks attempts to verify admin PIN by IP address for rate limiting.';
COMMENT ON COLUMN public.admin_pin_attempts.ip_address IS 'IP address from which the PIN verification attempt was made.';
COMMENT ON COLUMN public.admin_pin_attempts.attempts IS 'Number of failed attempts from this IP address in the current window.';
COMMENT ON COLUMN public.admin_pin_attempts.last_attempt_at IS 'Timestamp of the last failed attempt from this IP address.';

-- Index for querying by IP address
CREATE INDEX IF NOT EXISTS idx_admin_pin_attempts_ip_address ON public.admin_pin_attempts(ip_address);

-- RLS for admin_pin_attempts (restrictive, as it's internal)
ALTER TABLE public.admin_pin_attempts ENABLE ROW LEVEL SECURITY;

-- No policies are granted by default. Access should be through SECURITY DEFINER functions.
-- This table should not be directly accessible by users.
-- Supabase functions running with service_role or as SECURITY DEFINER can access it.

-- Optional: Consider a cron job or function to periodically clean up old entries
-- from admin_pin_attempts to prevent the table from growing indefinitely.
-- Example: DELETE FROM public.admin_pin_attempts WHERE last_attempt_at < NOW() - INTERVAL '1 day';
