-- Fix privacy_consent table to match what the consent pages expect
-- The pages insert: user_id, first_name, last_name, file_path, signed_at/consented_at

BEGIN;

-- Add missing columns if they don't exist
DO $$
BEGIN
  -- Add first_name column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'privacy_consent'
    AND column_name = 'first_name'
  ) THEN
    ALTER TABLE public.privacy_consent ADD COLUMN first_name text;
  END IF;

  -- Add last_name column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'privacy_consent'
    AND column_name = 'last_name'
  ) THEN
    ALTER TABLE public.privacy_consent ADD COLUMN last_name text;
  END IF;

  -- Add file_path column for signature image storage
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'privacy_consent'
    AND column_name = 'file_path'
  ) THEN
    ALTER TABLE public.privacy_consent ADD COLUMN file_path text;
  END IF;

  -- Add signed_at column (in addition to consented_at)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'privacy_consent'
    AND column_name = 'signed_at'
  ) THEN
    ALTER TABLE public.privacy_consent ADD COLUMN signed_at timestamptz;
  END IF;
END $$;

-- Make consent_type optional since the pages don't always provide it
ALTER TABLE public.privacy_consent ALTER COLUMN consent_type DROP NOT NULL;

-- Create storage bucket for consent signatures if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('consent-signatures', 'consent-signatures', false)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for consent-signatures bucket
DO $$
BEGIN
  -- Drop existing policies if they exist
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
END $$;

-- Add RLS policies for privacy_consent table if they don't exist
ALTER TABLE public.privacy_consent ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
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
END $$;

COMMIT;
