-- migrate:up
-- Enable insert policy for profiles table (RLS)

-- 1. Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Create policy allowing inserts by authenticated users
CREATE POLICY "Allow profile inserts"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- migrate:down
-- Rollback insert policy
DROP POLICY IF EXISTS "Allow profile inserts" ON public.profiles;
