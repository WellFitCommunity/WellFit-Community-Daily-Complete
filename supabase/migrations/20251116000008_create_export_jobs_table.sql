-- Create export_jobs table for bulk data export tracking
-- Used by bulk-export and export-status edge functions

CREATE TABLE IF NOT EXISTS public.export_jobs (
  id TEXT PRIMARY KEY,
  export_type TEXT NOT NULL CHECK (export_type IN ('check_ins', 'risk_assessments', 'users_profiles', 'billing_claims', 'fhir_resources', 'audit_logs')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  total_records INTEGER NOT NULL DEFAULT 0,
  processed_records INTEGER NOT NULL DEFAULT 0,
  filters JSONB DEFAULT '{}'::jsonb,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  download_url TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- When the download link expires
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_export_jobs_requested_by ON public.export_jobs(requested_by);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON public.export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_created_at ON public.export_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_jobs_expires_at ON public.export_jobs(expires_at) WHERE expires_at IS NOT NULL;

-- Enable RLS
ALTER TABLE public.export_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can see their own export jobs
DROP POLICY IF EXISTS "export_jobs_select_own" ON public.export_jobs;
CREATE POLICY "export_jobs_select_own"
ON public.export_jobs FOR SELECT
USING (requested_by = auth.uid());

-- Admins can see all export jobs
DROP POLICY IF EXISTS "export_jobs_admin_all" ON public.export_jobs;
CREATE POLICY "export_jobs_admin_all"
ON public.export_jobs FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  )
);

-- Service role can do everything (for edge functions)
DROP POLICY IF EXISTS "export_jobs_service_all" ON public.export_jobs;
CREATE POLICY "export_jobs_service_all"
ON public.export_jobs FOR ALL
USING (auth.role() = 'service_role');

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_export_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_export_jobs_updated_at ON public.export_jobs;
CREATE TRIGGER trigger_update_export_jobs_updated_at
BEFORE UPDATE ON public.export_jobs
FOR EACH ROW
EXECUTE FUNCTION update_export_jobs_updated_at();

-- Comments
COMMENT ON TABLE public.export_jobs IS 'Tracks bulk data export jobs for admins';
COMMENT ON COLUMN public.export_jobs.export_type IS 'Type of data being exported';
COMMENT ON COLUMN public.export_jobs.filters IS 'Export filters (date range, user types, format, etc)';
COMMENT ON COLUMN public.export_jobs.download_url IS 'Signed URL for downloading the exported file';
COMMENT ON COLUMN public.export_jobs.expires_at IS 'When the download URL expires (typically 24-48 hours)';
