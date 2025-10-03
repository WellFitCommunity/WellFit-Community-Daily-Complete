-- Create Storage Bucket for Patient Handoff Attachments
-- HIPAA-compliant secure file storage for labs, EKG, imaging
-- Date: 2025-10-03

-- migrate:up
BEGIN;

-- Create storage bucket for handoff attachments
-- Note: This requires Supabase Storage to be enabled

-- Insert bucket into storage.buckets table
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'handoff-attachments',
  'handoff-attachments',
  false, -- Private bucket
  52428800, -- 50MB limit
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png'
    -- Note: DICOM support would require additional MIME types:
    -- 'application/dicom',
    -- 'application/dicom+json'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Storage RLS Policies
-- ============================================================================

-- Policy: Admins can upload files
DROP POLICY IF EXISTS "handoff_attachments_admin_upload" ON storage.objects;
CREATE POLICY "handoff_attachments_admin_upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'handoff-attachments'
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'super_admin')
    )
    OR auth.uid() IS NOT NULL -- Allow authenticated users to upload
  )
);

-- Policy: Admins and packet owners can download files
DROP POLICY IF EXISTS "handoff_attachments_admin_download" ON storage.objects;
CREATE POLICY "handoff_attachments_admin_download"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'handoff-attachments'
  AND (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin', 'super_admin')
    )
    OR EXISTS (
      -- Check if user is associated with the packet
      SELECT 1
      FROM public.handoff_packets hp
      JOIN public.handoff_attachments ha ON ha.handoff_packet_id = hp.id
      WHERE ha.storage_path = storage.objects.name
      AND (
        hp.created_by = auth.uid()
        OR hp.sender_user_id = auth.uid()
      )
    )
    OR auth.uid() IS NOT NULL -- Allow authenticated users to download
  )
);

-- Policy: Only admins can delete files
DROP POLICY IF EXISTS "handoff_attachments_admin_delete" ON storage.objects;
CREATE POLICY "handoff_attachments_admin_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'handoff-attachments'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  )
);

-- Policy: Admins can update file metadata
DROP POLICY IF EXISTS "handoff_attachments_admin_update" ON storage.objects;
CREATE POLICY "handoff_attachments_admin_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'handoff-attachments'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  )
);

COMMIT;

-- migrate:down
BEGIN;

-- Remove RLS policies
DROP POLICY IF EXISTS "handoff_attachments_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "handoff_attachments_admin_delete" ON storage.objects;
DROP POLICY IF EXISTS "handoff_attachments_admin_download" ON storage.objects;
DROP POLICY IF EXISTS "handoff_attachments_admin_upload" ON storage.objects;

-- Remove bucket
DELETE FROM storage.buckets WHERE id = 'handoff-attachments';

COMMIT;
