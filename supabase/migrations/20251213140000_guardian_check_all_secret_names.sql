-- Migration: Update trigger_guardian_monitoring to check all possible secret key names in Vault
-- Supabase Vault may store the key under different names depending on how it was added

CREATE OR REPLACE FUNCTION trigger_guardian_monitoring()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
  secret_key text;
  request_id bigint;
  key_source text := 'none';
BEGIN
  -- Get Supabase URL from app settings or use default
  supabase_url := current_setting('app.supabase_url', true);

  IF supabase_url IS NULL THEN
    supabase_url := 'https://xkybsjnvuohpqpbkikyn.supabase.co';
  END IF;

  -- Try to get secret key from Vault - check all possible names
  BEGIN
    -- Try lowercase with underscore (our preferred)
    SELECT decrypted_secret INTO secret_key
    FROM vault.decrypted_secrets
    WHERE name = 'sb_secret_key'
    LIMIT 1;

    IF secret_key IS NOT NULL THEN
      key_source := 'vault:sb_secret_key';
    END IF;

    -- Try uppercase (common pattern)
    IF secret_key IS NULL THEN
      SELECT decrypted_secret INTO secret_key
      FROM vault.decrypted_secrets
      WHERE name = 'SB_SECRET_KEY'
      LIMIT 1;

      IF secret_key IS NOT NULL THEN
        key_source := 'vault:SB_SECRET_KEY';
      END IF;
    END IF;

    -- Try legacy name
    IF secret_key IS NULL THEN
      SELECT decrypted_secret INTO secret_key
      FROM vault.decrypted_secrets
      WHERE name = 'service_role_key'
      LIMIT 1;

      IF secret_key IS NOT NULL THEN
        key_source := 'vault:service_role_key';
      END IF;
    END IF;

    -- Try SUPABASE_SERVICE_ROLE_KEY (another common pattern)
    IF secret_key IS NULL THEN
      SELECT decrypted_secret INTO secret_key
      FROM vault.decrypted_secrets
      WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
      LIMIT 1;

      IF secret_key IS NOT NULL THEN
        key_source := 'vault:SUPABASE_SERVICE_ROLE_KEY';
      END IF;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    secret_key := NULL;
  END;

  -- Fallback: try app settings
  IF secret_key IS NULL THEN
    secret_key := current_setting('app.sb_secret_key', true);
    IF secret_key IS NOT NULL THEN
      key_source := 'setting:app.sb_secret_key';
    END IF;
  END IF;

  IF secret_key IS NULL THEN
    secret_key := current_setting('app.service_role_key', true);
    IF secret_key IS NOT NULL THEN
      key_source := 'setting:app.service_role_key';
    END IF;
  END IF;

  -- Call Guardian agent monitoring via pg_net
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

  -- Log the request with key source info
  RAISE NOTICE 'Guardian monitoring triggered with request_id: %, key_source: %', request_id, key_source;

  INSERT INTO guardian_cron_log (job_name, status, details)
  VALUES (
    'guardian-automated-monitoring',
    'triggered',
    jsonb_build_object(
      'request_id', request_id,
      'timestamp', now(),
      'key_source', key_source
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Guardian monitoring failed: %', SQLERRM;
    INSERT INTO guardian_cron_log (job_name, status, details)
    VALUES (
      'guardian-automated-monitoring',
      'failed',
      jsonb_build_object('error', SQLERRM, 'timestamp', now())
    );
END;
$$;

COMMENT ON FUNCTION trigger_guardian_monitoring() IS
  'Triggers Guardian monitoring via pg_net. Checks Vault for sb_secret_key, SB_SECRET_KEY, service_role_key, or SUPABASE_SERVICE_ROLE_KEY.';
