-- Create privacy_consent table with all required columns
-- This table stores user consent signatures for photo/media release and privacy policy

BEGIN;

-- Create the table
CREATE TABLE IF NOT EXISTS public.privacy_consent (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  consent_type text, -- 'photo', 'privacy', etc. (optional)
  consented boolean DEFAULT true NOT NULL,
  first_name text,
  last_name text,
  file_path text, -- path to signature image in storage
  signed_at timestamptz,
  consented_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_privacy_consent_user_id ON public.privacy_consent(user_id);

-- Create storage bucket for consent signatures
INSERT INTO storage.buckets (id, name, public)
VALUES ('consent-signatures', 'consent-signatures', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.privacy_consent ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own consent records" ON public.privacy_consent;
DROP POLICY IF EXISTS "Users can insert their own consent records" ON public.privacy_consent;
DROP POLICY IF EXISTS "Admins can view all consent records" ON public.privacy_consent;

-- Users can view their own consent records
CREATE POLICY "Users can view their own consent records"
ON public.privacy_consent FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can insert their own consent records
CREATE POLICY "Users can insert their own consent records"
ON public.privacy_consent FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Admins can view all consent records
CREATE POLICY "Admins can view all consent records"
ON public.privacy_consent FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
);

-- Storage bucket policies
DROP POLICY IF EXISTS "Users can upload their own consent signatures" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own consent signatures" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all consent signatures" ON storage.objects;

-- Users can upload their own signatures
CREATE POLICY "Users can upload their own consent signatures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'consent-signatures'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can view their own signatures
CREATE POLICY "Users can view their own consent signatures"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'consent-signatures'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins can view all signatures
CREATE POLICY "Admins can view all consent signatures"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'consent-signatures'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  )
);

COMMIT;
