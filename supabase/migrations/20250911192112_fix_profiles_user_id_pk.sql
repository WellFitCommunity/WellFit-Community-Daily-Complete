BEGIN;

-- Keep RLS enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1) Enforce user_id NOT NULL
ALTER TABLE public.profiles
  ALTER COLUMN user_id SET NOT NULL;

-- 2) Ensure FK to auth.users(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema='public'
      AND table_name='profiles'
      AND constraint_name='profiles_user_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3) Drop existing policies and recreate on user_id
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.polname);
  END LOOP;
END $$;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.profiles IS 'user_id is canonical; RLS uses auth.uid() = user_id. PK flip attempted conditionally.';

-- 4) Add UNIQUE(user_id) if no duplicates
DO $$
DECLARE dup_count bigint; has_unique boolean;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (SELECT user_id FROM public.profiles GROUP BY user_id HAVING COUNT(*) > 1) d;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.profiles'::regclass AND contype='u' AND conname='profiles_user_id_key'
  ) INTO has_unique;

  IF dup_count = 0 AND NOT has_unique THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  ELSIF dup_count > 0 THEN
    RAISE NOTICE 'profiles.user_id has % duplicates; UNIQUE not added. Fix data then re-run.', dup_count;
  END IF;
END $$;

-- 5) Flip PK to user_id ONLY IF safe (no inbound child FKs + no NULLs/dups)
DO $$
DECLARE child_fk_count int; null_count bigint; dup_count bigint; pk_on_user_id boolean; pk_name text;
BEGIN
  -- inbound FKs (other tables -> profiles)
  SELECT COUNT(*) INTO child_fk_count
  FROM pg_constraint c
  WHERE c.contype='f' AND c.confrelid='public.profiles'::regclass;

  SELECT COUNT(*) INTO null_count FROM public.profiles WHERE user_id IS NULL;

  SELECT COUNT(*) INTO dup_count
  FROM (SELECT user_id FROM public.profiles GROUP BY user_id HAVING COUNT(*) > 1) d;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
    WHERE c.conrelid='public.profiles'::regclass AND c.contype='p' AND a.attname='user_id'
  ) INTO pk_on_user_id;

  IF pk_on_user_id THEN
    RAISE NOTICE 'profiles PK already on user_id.';
    RETURN;
  END IF;

  IF child_fk_count = 0 AND null_count = 0 AND dup_count = 0 THEN
    SELECT conname INTO pk_name
    FROM pg_constraint
    WHERE conrelid='public.profiles'::regclass AND contype='p'
    LIMIT 1;

    IF pk_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', pk_name);
    END IF;

    ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (user_id);
    RAISE NOTICE 'Switched primary key to user_id successfully.';
  ELSE
    RAISE NOTICE 'PK NOT switched. child_fks:% null_user_id:% dup_user_id:% — resolve then re-run.',
      child_fk_count, null_count, dup_count;
  END IF;
END $$;

COMMIT;
