-- Enable RLS for checkins table
-- Assuming checkins table exists. If not, it should be created first.
-- CREATE TABLE IF NOT EXISTS public.checkins (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- or auth.users(id)
--   is_emergency BOOLEAN DEFAULT FALSE,
--   label TEXT, -- Type of alert or check-in
--   created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
--   -- Potentially other fields like mood, measurements, notes etc.
--   details JSONB
-- );

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

-- Policy: Users can SELECT their own checkins
CREATE POLICY "Allow users to select their own checkins"
ON public.checkins
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can INSERT their own checkins
CREATE POLICY "Allow users to insert their own checkins"
ON public.checkins
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Note: UPDATE and DELETE policies for users on checkins might not be typical.
-- Check-ins are usually point-in-time records.
-- If modification is needed, specific policies would be required.
/*
CREATE POLICY "Allow users to update their own checkins"
ON public.checkins
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to delete their own checkins"
ON public.checkins
FOR DELETE
USING (auth.uid() = user_id);
*/

COMMENT ON TABLE public.checkins IS 'Stores daily or periodic check-ins by users, including emergency alerts.';
COMMENT ON POLICY "Allow users to select their own checkins" ON public.checkins IS 'Users can view their own check-in history.';
COMMENT ON POLICY "Allow users to insert their own checkins" ON public.checkins IS 'Users can submit new check-ins for themselves.';
