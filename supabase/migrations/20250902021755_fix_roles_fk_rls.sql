-- 1) Ensure roles table + seeds (if not already)
CREATE TABLE IF NOT EXISTS public.roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
INSERT INTO public.roles (name, description) VALUES
  ('senior', 'Regular senior user'),
  ('admin', 'Administrator'),
  ('super_admin', 'Super administrator')
ON CONFLICT (name) DO NOTHING;

-- 2) Hardened check_user_has_role for single-role-in-profiles
CREATE OR REPLACE FUNCTION public.check_user_has_role(role_names TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE has_role BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.roles    r ON r.id = p.role_id
    WHERE p.user_id = auth.uid()
      AND r.name = ANY(role_names)
  ) INTO has_role;

  RETURN COALESCE(has_role, false);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.check_user_has_role(TEXT[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_user_has_role(TEXT[]) TO authenticated;

-- 3) Ensure profiles.user_id is PK and FK -> auth.users(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema='public' AND table_name='profiles' AND constraint_type='PRIMARY KEY'
  ) THEN
    ALTER TABLE public.profiles ADD PRIMARY KEY (user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name
    WHERE tc.table_schema='public' AND tc.table_name='profiles'
      AND tc.constraint_type='FOREIGN KEY'
      AND kcu.column_name='user_id'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END$$;

-- 4) Fix foreign keys on other tables to auth.users
ALTER TABLE public.community_moments
  DROP CONSTRAINT IF EXISTS community_moments_user_id_fkey;
ALTER TABLE public.community_moments
  ADD CONSTRAINT community_moments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.fcm_tokens
  DROP CONSTRAINT IF EXISTS fcm_tokens_user_id_fkey;
ALTER TABLE public.fcm_tokens
  ADD CONSTRAINT fcm_tokens_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='checkins') THEN
    ALTER TABLE public.checkins
      DROP CONSTRAINT IF EXISTS checkins_user_id_fkey;
    ALTER TABLE public.checkins
      ADD CONSTRAINT checkins_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='meals') THEN
    ALTER TABLE public.meals
      DROP CONSTRAINT IF EXISTS meals_author_id_fkey;
    ALTER TABLE public.meals
      ADD CONSTRAINT meals_author_id_fkey
      FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END$$;

-- 5) New admin_pin_attempts_log (if not present) + RLS
CREATE TABLE IF NOT EXISTS public.admin_pin_attempts_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  reason TEXT,
  role_attempted TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_pin_attempts_log_user_id ON public.admin_pin_attempts_log(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_pin_attempts_log_ip_address ON public.admin_pin_attempts_log(ip_address);
CREATE INDEX IF NOT EXISTS idx_admin_pin_attempts_log_attempted_at ON public.admin_pin_attempts_log(attempted_at DESC);
ALTER TABLE public.admin_pin_attempts_log ENABLE ROW LEVEL SECURITY;

-- Optional: let admins read pin attempt logs
DROP POLICY IF EXISTS "admins read pin attempts" ON public.admin_pin_attempts_log;
CREATE POLICY "admins read pin attempts"
ON public.admin_pin_attempts_log FOR SELECT
USING (public.check_user_has_role(ARRAY['admin','super_admin']));

-- 6) Profiles RLS: select/insert/update
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles: select self or admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles: insert self" ON public.profiles;
DROP POLICY IF EXISTS "profiles: update self or admin (no role_id change by users)" ON public.profiles;

CREATE POLICY "profiles: select self or admin"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id OR public.check_user_has_role(ARRAY['admin','super_admin']));

CREATE POLICY "profiles: insert self"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles: update self or admin (no role_id change by users)"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id OR public.check_user_has_role(ARRAY['admin','super_admin']))
WITH CHECK (auth.uid() = user_id OR public.check_user_has_role(ARRAY['admin','super_admin']));

