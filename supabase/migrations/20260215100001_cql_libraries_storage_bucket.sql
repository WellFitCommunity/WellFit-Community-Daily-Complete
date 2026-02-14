-- CQL Libraries Storage Bucket
-- Purpose: Store ELM JSON files (compiled CQL) for eCQM measure evaluation
-- ONC Criteria: 170.315(c)(1) — CQL-based quality measure calculation

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cql-libraries',
  'cql-libraries',
  false,
  5242880, -- 5 MB max per file
  ARRAY['application/json']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: service role can manage all files
CREATE POLICY "Service role manages cql-libraries"
  ON storage.objects
  FOR ALL
  USING (bucket_id = 'cql-libraries' AND auth.role() = 'service_role');

-- RLS: authenticated admins can read
CREATE POLICY "Admins can read cql-libraries"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'cql-libraries'
    AND EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  );

-- Note: CQL ELM library storage for eCQM evaluation engine
