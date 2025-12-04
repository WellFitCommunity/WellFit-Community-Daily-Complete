-- Create app_owners table if it doesn't exist (required for auth.users triggers)
CREATE TABLE IF NOT EXISTS public.app_owners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.app_owners ENABLE ROW LEVEL SECURITY;

-- Basic policy - app owners can read their own records
DROP POLICY IF EXISTS "app_owners_read" ON public.app_owners;
CREATE POLICY "app_owners_read" ON public.app_owners
FOR SELECT USING (user_id = auth.uid());
