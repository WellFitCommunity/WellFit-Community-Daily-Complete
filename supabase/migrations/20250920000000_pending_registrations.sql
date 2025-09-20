-- Create pending_registrations table for phone verification flow
-- This stores registration data temporarily until phone is verified

CREATE TABLE IF NOT EXISTS public.pending_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  role_code INTEGER NOT NULL DEFAULT 4,
  role_slug TEXT NOT NULL DEFAULT 'senior',
  hcaptcha_verified BOOLEAN DEFAULT true,
  verification_code_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Index for phone lookup
CREATE INDEX IF NOT EXISTS idx_pending_registrations_phone ON public.pending_registrations(phone);

-- Index for cleanup (expired entries)
CREATE INDEX IF NOT EXISTS idx_pending_registrations_expires_at ON public.pending_registrations(expires_at);

-- Enable RLS
ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: No direct access from clients (admin/service only)
CREATE POLICY "pending_registrations_admin_only" ON public.pending_registrations
  FOR ALL USING (false); -- Block all client access

-- Grant access to service role only
GRANT ALL ON public.pending_registrations TO service_role;

-- Add function to clean up expired pending registrations
CREATE OR REPLACE FUNCTION public.cleanup_expired_pending_registrations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.pending_registrations
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION public.cleanup_expired_pending_registrations() TO service_role;

COMMENT ON TABLE public.pending_registrations IS 'Temporary storage for registration data pending phone verification';
COMMENT ON FUNCTION public.cleanup_expired_pending_registrations() IS 'Removes expired pending registrations (call periodically)';