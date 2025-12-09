-- Create storage bucket for temp vital images
-- This bucket stores images for OCR processing with 24h TTL

-- Insert bucket configuration
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'temp_vital_images',
  'temp_vital_images',
  false,  -- Private bucket - no public URLs
  10485760,  -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']::text[];

-- RLS Policy: Users can upload to their own folder
-- Storage path format: {user_id}/{timestamp}.jpg
DROP POLICY IF EXISTS "temp_vital_images_upload" ON storage.objects;
CREATE POLICY "temp_vital_images_upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'temp_vital_images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy: Users can read their own files
DROP POLICY IF EXISTS "temp_vital_images_read" ON storage.objects;
CREATE POLICY "temp_vital_images_read"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'temp_vital_images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS Policy: Users can delete their own files
DROP POLICY IF EXISTS "temp_vital_images_delete" ON storage.objects;
CREATE POLICY "temp_vital_images_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'temp_vital_images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Service role can manage all files (for cleanup job)
-- Note: service_role bypasses RLS by default, so no policy needed
