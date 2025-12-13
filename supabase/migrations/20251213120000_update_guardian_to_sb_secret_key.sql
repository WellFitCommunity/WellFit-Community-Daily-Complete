-- Migration: Update trigger_guardian_monitoring to use SB_SECRET_KEY
-- The service_role_key has been deprecated in favor of SB_SECRET_KEY in Supabase's new naming convention
-- This migration updates the function to use the new key name

-- Update the function to use the new key naming convention
CREATE OR REPLACE FUNCTION trigger_guardian_monitoring()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
  secret_key text;
  request_id bigint;
BEGIN
  -- Get Supabase URL from app settings or use default
  supabase_url := current_setting('app.supabase_url', true);

  IF supabase_url IS NULL THEN
    supabase_url := 'https://xkybsjnvuohpqpbkikyn.supabase.co';
  END IF;

  -- Try to get secret key from Vault first (most secure)
  BEGIN
    SELECT decrypted_secret INTO secret_key
    FROM vault.decrypted_secrets
    WHERE name = 'sb_secret_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    secret_key := NULL;
  END;

  -- Fallback: try app.sb_secret_key setting (new naming convention)
  IF secret_key IS NULL THEN
    secret_key := current_setting('app.sb_secret_key', true);
  END IF;

  -- Fallback: try deprecated app.service_role_key for backwards compatibility
  IF secret_key IS NULL THEN
    secret_key := current_setting('app.service_role_key', true);
  END IF;

  -- Call Guardian agent monitoring via pg_net
  -- net.http_post returns a request_id (bigint), not a response
  -- The request is made asynchronously
  request_id := net.http_post(
    url := supabase_url || '/functions/v1/guardian-agent',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(secret_key, '')
    ),
    body := jsonb_build_object(
      'action', 'monitor'
    )
  );

  -- Log the request
  RAISE NOTICE 'Guardian monitoring triggered with request_id: %', request_id;

  -- Log to our custom table
  INSERT INTO guardian_cron_log (job_name, status, details)
  VALUES (
    'guardian-automated-monitoring',
    'triggered',
    jsonb_build_object(
      'request_id', request_id,
      'timestamp', now(),
      'key_source', CASE
        WHEN secret_key IS NOT NULL THEN 'configured'
        ELSE 'missing'
      END
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Don't fail if Guardian call fails - just log it
    RAISE WARNING 'Guardian monitoring failed: %', SQLERRM;

    -- Log the failure
    INSERT INTO guardian_cron_log (job_name, status, details)
    VALUES (
      'guardian-automated-monitoring',
      'failed',
      jsonb_build_object('error', SQLERRM, 'timestamp', now())
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION trigger_guardian_monitoring() TO postgres;

-- Update comment
COMMENT ON FUNCTION trigger_guardian_monitoring() IS
  'Triggers Guardian monitoring via HTTP POST using pg_net. Uses SB_SECRET_KEY from Vault or app settings. Called by cron every 5 minutes.';
