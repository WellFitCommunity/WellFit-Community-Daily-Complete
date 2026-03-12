-- Migration: clinical_notes full-text search
-- Purpose: Enable GlobalSearchBar to search clinical notes by content
-- Tracker: docs/trackers/chatgpt-audit-gaps-tracker.md (S3-3)

-- GIN index on clinical_notes.content for full-text search
CREATE INDEX IF NOT EXISTS idx_clinical_notes_content_fts
  ON public.clinical_notes
  USING gin(to_tsvector('english', content));

-- Search function with tenant isolation via RLS (security_invoker)
CREATE OR REPLACE FUNCTION public.search_clinical_notes(
  p_query TEXT,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  note_id UUID,
  encounter_id UUID,
  note_type TEXT,
  content_snippet TEXT,
  author_id UUID,
  tenant_id UUID,
  created_at TIMESTAMPTZ,
  relevance REAL
)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
BEGIN
  RETURN QUERY
  -- Full-text search with ts_rank scoring
  SELECT
    cn.id AS note_id,
    cn.encounter_id,
    cn.type AS note_type,
    -- Return first 200 chars as snippet (no PHI concern — RLS controls access)
    LEFT(cn.content, 200) AS content_snippet,
    cn.author_id,
    cn.tenant_id,
    cn.created_at,
    ts_rank(to_tsvector('english', cn.content), plainto_tsquery('english', p_query)) AS relevance
  FROM public.clinical_notes cn
  WHERE to_tsvector('english', cn.content) @@ plainto_tsquery('english', p_query)
  ORDER BY relevance DESC, cn.created_at DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.search_clinical_notes IS
  'Full-text search across clinical notes. RLS-enforced via SECURITY INVOKER — users only see notes they have access to.';
