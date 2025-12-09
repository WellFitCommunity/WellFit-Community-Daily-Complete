-- ============================================================================
-- WEB VITAL CAPTURE SYSTEM
-- ============================================================================
-- Purpose: Enable multi-modal vital sign capture via web app:
--   1. Manual entry (existing flow)
--   2. Live camera scan (no stored image - client-side OCR)
--   3. Photo capture (24h temp storage + server OCR)
--   4. Web Bluetooth BLE (Android Chrome / desktop Chrome/Edge)
--
-- Architecture:
--   - EXTENDS existing check_ins table (no new vital_readings table)
--   - Adds source tracking, device info, facility attribution
--   - temp_image_jobs for photo flow with 24h TTL
--   - Storage bucket temp_vital_images (private, auto-cleanup)
--
-- Date: 2025-12-09
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. EXTEND CHECK_INS TABLE WITH SOURCE TRACKING
-- ============================================================================

-- Add source column to track how vitals were captured
ALTER TABLE public.check_ins
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'
  CHECK (source IN ('manual', 'camera_scan', 'camera_photo', 'ble_web', 'caregiver_app', 'vendor_api', 'import'));

-- Add device info for BLE and camera flows
ALTER TABLE public.check_ins
ADD COLUMN IF NOT EXISTS device_label TEXT;

-- Add facility_id for multi-facility attribution (not RLS - just reporting)
ALTER TABLE public.check_ins
ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL;

-- Add weight column if not exists (some vitals flows capture this)
ALTER TABLE public.check_ins
ADD COLUMN IF NOT EXISTS weight NUMERIC(6,2) CHECK (weight IS NULL OR (weight >= 50 AND weight <= 800));

-- Add temperature column for comprehensive vitals
ALTER TABLE public.check_ins
ADD COLUMN IF NOT EXISTS temperature NUMERIC(4,1) CHECK (temperature IS NULL OR (temperature >= 90 AND temperature <= 110));

-- Index for source-based queries (e.g., "show all BLE readings")
CREATE INDEX IF NOT EXISTS idx_check_ins_source ON public.check_ins(source);

-- Index for facility-based reporting
CREATE INDEX IF NOT EXISTS idx_check_ins_facility ON public.check_ins(facility_id) WHERE facility_id IS NOT NULL;

-- Comments
COMMENT ON COLUMN public.check_ins.source IS 'How vitals were captured: manual, camera_scan, camera_photo, ble_web, caregiver_app, vendor_api, import';
COMMENT ON COLUMN public.check_ins.device_label IS 'Device name/model for BLE or camera type for photo/scan';
COMMENT ON COLUMN public.check_ins.facility_id IS 'Facility where vitals were captured (for multi-facility reporting)';
COMMENT ON COLUMN public.check_ins.weight IS 'Body weight in pounds (50-800)';
COMMENT ON COLUMN public.check_ins.temperature IS 'Body temperature in Fahrenheit (90-110)';

-- ============================================================================
-- 2. CREATE TEMP_IMAGE_JOBS TABLE FOR PHOTO FLOW
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.temp_image_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL,

  -- Storage reference
  storage_path TEXT NOT NULL,  -- e.g., 'temp_vital_images/{user_id}/{timestamp}.jpg'

  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending_ocr'
    CHECK (status IN ('pending_ocr', 'processing', 'processed', 'failed')),
  error TEXT,  -- Error message if failed

  -- Extracted data (stored after successful OCR)
  extracted_data JSONB,  -- { type: 'blood_pressure', systolic: 142, diastolic: 86, pulse: 78 }

  -- Check-in reference (linked after user confirms)
  check_in_id BIGINT REFERENCES public.check_ins(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  processed_at TIMESTAMPTZ,

  -- Vital type hint (helps OCR)
  vital_type TEXT DEFAULT 'blood_pressure'
    CHECK (vital_type IN ('blood_pressure', 'glucose', 'weight', 'heart_rate', 'temperature', 'pulse_oximeter'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_temp_image_jobs_user ON public.temp_image_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_temp_image_jobs_status ON public.temp_image_jobs(status);
CREATE INDEX IF NOT EXISTS idx_temp_image_jobs_expires ON public.temp_image_jobs(expires_at);
CREATE INDEX IF NOT EXISTS idx_temp_image_jobs_pending ON public.temp_image_jobs(status, created_at)
  WHERE status = 'pending_ocr';

-- Enable RLS
ALTER TABLE public.temp_image_jobs ENABLE ROW LEVEL SECURITY;

-- RLS: Users can manage their own jobs
DROP POLICY IF EXISTS "temp_image_jobs_own_select" ON public.temp_image_jobs;
CREATE POLICY "temp_image_jobs_own_select"
ON public.temp_image_jobs FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "temp_image_jobs_own_insert" ON public.temp_image_jobs;
CREATE POLICY "temp_image_jobs_own_insert"
ON public.temp_image_jobs FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "temp_image_jobs_own_update" ON public.temp_image_jobs;
CREATE POLICY "temp_image_jobs_own_update"
ON public.temp_image_jobs FOR UPDATE
USING (user_id = auth.uid());

-- RLS: Service role can manage all (for cleanup job)
DROP POLICY IF EXISTS "temp_image_jobs_service_all" ON public.temp_image_jobs;
CREATE POLICY "temp_image_jobs_service_all"
ON public.temp_image_jobs FOR ALL
USING (
  -- Check if current role is service_role
  current_setting('request.jwt.claim.role', true) = 'service_role'
);

-- Comments
COMMENT ON TABLE public.temp_image_jobs IS 'Temporary image processing jobs for photo-based vital capture. Images auto-deleted after 24 hours.';
COMMENT ON COLUMN public.temp_image_jobs.storage_path IS 'Path in temp_vital_images bucket';
COMMENT ON COLUMN public.temp_image_jobs.extracted_data IS 'OCR-extracted vital values as JSON';
COMMENT ON COLUMN public.temp_image_jobs.expires_at IS 'Auto-delete time (24 hours from creation)';

-- ============================================================================
-- 3. CLEANUP FUNCTION FOR EXPIRED IMAGES
-- ============================================================================

-- Function to delete expired temp image jobs
-- Called by pg_cron or Edge Function scheduler
CREATE OR REPLACE FUNCTION cleanup_expired_temp_images()
RETURNS TABLE(deleted_count INTEGER, storage_paths TEXT[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paths TEXT[];
  v_count INTEGER;
BEGIN
  -- Get paths of expired images
  SELECT ARRAY_AGG(storage_path)
  INTO v_paths
  FROM temp_image_jobs
  WHERE expires_at < now();

  -- Delete expired rows
  WITH deleted AS (
    DELETE FROM temp_image_jobs
    WHERE expires_at < now()
    RETURNING *
  )
  SELECT COUNT(*) INTO v_count FROM deleted;

  -- Return results (caller should delete from storage using v_paths)
  RETURN QUERY SELECT v_count, COALESCE(v_paths, ARRAY[]::TEXT[]);
END;
$$;

COMMENT ON FUNCTION cleanup_expired_temp_images IS
  'Deletes expired temp_image_jobs rows and returns storage paths for file cleanup';

-- ============================================================================
-- 4. HELPER FUNCTION TO CREATE TEMP IMAGE JOB
-- ============================================================================

CREATE OR REPLACE FUNCTION create_temp_image_job(
  p_storage_path TEXT,
  p_vital_type TEXT DEFAULT 'blood_pressure',
  p_facility_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_job_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get user's tenant
  SELECT tenant_id INTO v_tenant_id
  FROM profiles
  WHERE user_id = v_user_id;

  -- Create job
  INSERT INTO temp_image_jobs (
    user_id,
    tenant_id,
    facility_id,
    storage_path,
    vital_type
  ) VALUES (
    v_user_id,
    v_tenant_id,
    p_facility_id,
    p_storage_path,
    p_vital_type
  )
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;

COMMENT ON FUNCTION create_temp_image_job IS
  'Creates a temp image job for OCR processing. Returns job ID.';

-- ============================================================================
-- 5. UPDATE CHECK_INS RLS TO INCLUDE FACILITY CONTEXT
-- ============================================================================

-- Note: Existing RLS policies already handle user/admin/caregiver access
-- facility_id is for attribution only, not access control
-- No changes needed to existing policies

-- ============================================================================
-- 6. ADD VITAL_CAPTURE_SOURCES VIEW FOR REPORTING
-- ============================================================================

CREATE OR REPLACE VIEW vital_capture_sources AS
SELECT
  source,
  COUNT(*) as total_readings,
  COUNT(DISTINCT user_id) as unique_users,
  MIN(created_at) as first_reading,
  MAX(created_at) as last_reading
FROM check_ins
WHERE source IS NOT NULL
GROUP BY source
ORDER BY total_readings DESC;

COMMENT ON VIEW vital_capture_sources IS
  'Summary of vital readings by capture source (manual, BLE, camera, etc.)';

-- Grant read access to authenticated users (no PHI in this view)
GRANT SELECT ON vital_capture_sources TO authenticated;

COMMIT;

-- ============================================================================
-- POST-DEPLOYMENT NOTES
-- ============================================================================
--
-- 1. STORAGE BUCKET: Create 'temp_vital_images' bucket in Supabase Dashboard
--    - Set to PRIVATE (no public URLs)
--    - Add policy: authenticated users can upload to their own path
--    - Add policy: service role can read/delete all
--
-- 2. CRON JOB: Set up hourly cleanup
--    Option A: pg_cron extension (if available)
--      SELECT cron.schedule('cleanup-temp-images', '0 * * * *',
--        'SELECT * FROM cleanup_expired_temp_images()');
--    Option B: Edge Function with Supabase scheduler
--
-- 3. OCR SERVICE: Deploy process-vital-image Edge Function
--    - Uses Tesseract.js or similar
--    - Validates extracted values
--    - Updates temp_image_jobs status
-- ============================================================================
