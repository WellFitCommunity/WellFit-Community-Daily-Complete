-- ============================================================================
-- GUARDIAN EYES STORAGE BUCKET
-- ============================================================================
-- Storage bucket for Guardian Eyes screenshots and visual recordings
-- Used for error state captures, UI screenshots, and debugging images
-- ============================================================================

-- Create the Guardian Eyes storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'guardian-eyes',
  'guardian-eyes',
  false,  -- Private bucket (not publicly accessible)
  5242880,  -- 5MB max file size per image
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- RLS POLICIES FOR GUARDIAN EYES BUCKET
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role full access to guardian-eyes" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to guardian-eyes" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view guardian-eyes files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete guardian-eyes files" ON storage.objects;

-- Service role has full access (for edge functions)
CREATE POLICY "Service role full access to guardian-eyes"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'guardian-eyes')
WITH CHECK (bucket_id = 'guardian-eyes');

-- Authenticated users can upload screenshots (Guardian Agent client-side)
CREATE POLICY "Authenticated users can upload to guardian-eyes"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'guardian-eyes');

-- Admins can view screenshots (role_code: 1=admin, 2=super_admin)
CREATE POLICY "Admins can view guardian-eyes files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'guardian-eyes'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role_code IN (1, 2)
  )
);

-- Admins can delete old screenshots (cleanup)
CREATE POLICY "Admins can delete guardian-eyes files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'guardian-eyes'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role_code IN (1, 2)
  )
);

-- ============================================================================
-- ADD SCREENSHOT COLUMNS TO GUARDIAN EYES RECORDINGS
-- ============================================================================

-- Add screenshot URL column to guardian_eyes_recordings if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guardian_eyes_recordings'
    AND column_name = 'screenshot_path'
  ) THEN
    ALTER TABLE public.guardian_eyes_recordings
      ADD COLUMN screenshot_path TEXT,
      ADD COLUMN screenshot_url TEXT;
  END IF;
END $$;

-- ============================================================================
-- CLEANUP FUNCTION FOR OLD SCREENSHOTS
-- ============================================================================

-- Function to cleanup old guardian eyes files (30 day retention)
CREATE OR REPLACE FUNCTION public.cleanup_guardian_eyes_storage()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER := 0;
  old_file RECORD;
BEGIN
  -- Get files older than 30 days
  FOR old_file IN
    SELECT name FROM storage.objects
    WHERE bucket_id = 'guardian-eyes'
    AND created_at < NOW() - INTERVAL '30 days'
  LOOP
    -- Delete from storage
    DELETE FROM storage.objects
    WHERE bucket_id = 'guardian-eyes'
    AND name = old_file.name;

    deleted_count := deleted_count + 1;
  END LOOP;

  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_guardian_eyes_storage TO service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.cleanup_guardian_eyes_storage IS 'Removes Guardian Eyes screenshots older than 30 days';
