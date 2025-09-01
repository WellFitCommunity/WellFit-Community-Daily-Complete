-- Ensure admin_notes exists before RLS policies

-- 1) Safe helper trigger (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'trigger_set_timestamp'
  ) THEN
    CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
    RETURNS TRIGGER AS $fn$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;
  END IF;
END$$;

-- 2) Create table if missing (idempotent)
CREATE TABLE IF NOT EXISTS public.admin_notes (
  id BIGSERIAL PRIMARY KEY,
  senior_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3) Create/update trigger safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_admin_notes_updated_at'
  ) THEN
    CREATE TRIGGER set_admin_notes_updated_at
    BEFORE UPDATE ON public.admin_notes
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_timestamp();
  END IF;
END$$;
