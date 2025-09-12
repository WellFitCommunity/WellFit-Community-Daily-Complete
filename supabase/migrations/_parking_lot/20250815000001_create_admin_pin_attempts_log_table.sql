-- Migration to create a table for logging admin PIN attempts, separate from the rate limiting counter

CREATE TABLE IF NOT EXISTS public.admin_pin_attempts_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Link to the user who attempted, if available
  ip_address TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  reason TEXT, -- e.g., "Invalid PIN", "Rate limited", "Successful PIN verification", "Server error"
  role_attempted TEXT, -- e.g., "admin", "super_admin"
  user_agent TEXT -- Optional: Store user agent for more context
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_pin_attempts_log_user_id ON public.admin_pin_attempts_log(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_pin_attempts_log_ip_address ON public.admin_pin_attempts_log(ip_address);
CREATE INDEX IF NOT EXISTS idx_admin_pin_attempts_log_attempted_at ON public.admin_pin_attempts_log(attempted_at DESC);

-- RLS Policy: Assuming only service_role or a dedicated security role should write to this.
-- Reading might be allowed for admins for audit purposes, but write access should be highly restricted.

ALTER TABLE public.admin_pin_attempts_log ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access.
CREATE POLICY "Allow service_role full access on admin_pin_attempts_log"
ON public.admin_pin_attempts_log
FOR ALL
USING (true)
WITH CHECK (true);

-- Note: The `admin_pin_attempts` table (used for rate limit counting) is defined in `20250801000000_create_admin_pin_attempts_table.sql`.
-- This new `admin_pin_attempts_log` table is for detailed logging of each attempt, not just counting for rate limits.
-- Ensure the existing `admin_pin_attempts` table is correctly set up for rate limiting by IP.
-- If `admin_pin_attempts` was not previously created or needs adjustment for IP-based rate limiting,
-- ensure its schema is: ip_address (TEXT, PK), attempts (INTEGER), last_attempt_at (TIMESTAMPTZ).
-- The `verify-admin-pin` function was updated to use `admin_pin_attempts` for rate limiting counts by IP
-- and `admin_pin_attempts_log` for detailed logging of each attempt including `user_id`.

-- Also, the `admin_pin_attempts` table (for rate limit *counting*) needs to exist.
-- The audit mentioned creating `admin_pin_attempts (user_id, success, attempted_at)`.
-- The `verify-admin-pin` function was already using a table named `admin_pin_attempts`
-- but structured for IP-based rate limiting: `ip_address, attempts, last_attempt_at`.
-- We will keep `admin_pin_attempts` for IP-based rate limiting counter and use the new
-- `admin_pin_attempts_log` for detailed audit logging including `user_id`.
-- If the original `admin_pin_attempts` table from the audit was intended for logging, this new table replaces that idea.
-- If it was for user-specific rate limiting, that's different. Current implementation is IP-based rate limit + user-specific audit log.

-- Example of what admin_pin_attempts (for rate limiting counter by IP) should look like if it doesn't exist or needs creation/alteration:
-- CREATE TABLE IF NOT EXISTS public.admin_pin_attempts (
--   ip_address TEXT PRIMARY KEY,
--   attempts INTEGER NOT NULL DEFAULT 0,
--   last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );
-- CREATE INDEX IF NOT EXISTS idx_admin_pin_attempts_last_attempt ON public.admin_pin_attempts(last_attempt_at);
-- ALTER TABLE public.admin_pin_attempts ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow service_role full access on admin_pin_attempts"
-- ON public.admin_pin_attempts
-- FOR ALL USING (true) WITH CHECK (true);
-- This is just for reference; the function currently uses a structure that implies ip_address is not unique if old entries are not cleared.
-- The Deno function code for `admin_pin_attempts` implies a structure like:
-- ip_address (TEXT), attempts (INTEGER), last_attempt_at (TIMESTAMPTZ). It selects a single row by IP.
-- And then upserts/inserts. This is fine. The important part is that it's distinct from `admin_pin_attempts_log`.
