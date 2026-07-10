-- =====================================================================
-- FHIR DocumentReference backing view
--
-- The MCP FHIR server maps DocumentReference -> `fhir_document_references`, but
-- that table never existed live (aspirational mapping). The real patient-scoped
-- clinical documents live in `ai_progress_notes` (has patient_id, note_type,
-- summary, status, finalized_at). (`clinical_notes` is encounter-scoped with no
-- patient_id, so it is not a direct DocumentReference source; a future migration
-- can UNION it in via an encounter->patient join.)
--
-- This view is the coupling layer (governance supabase.md §3): it presents
-- ai_progress_notes with the FHIR-standard column names that
-- FHIR_SELECT_COLUMNS['fhir_document_references'] expects, so DocumentReference
-- export/search/get_resource work with no code change.
--
-- security_invoker = on. Verified against live information_schema 2026-07-10.
-- =====================================================================

CREATE OR REPLACE VIEW public.fhir_document_references
WITH (security_invoker = on) AS
SELECT
  n.id,
  n.patient_id,
  n.note_type                              AS type,
  n.status,
  'clinical-note'::text                    AS category,
  COALESCE(n.finalized_at, n.created_at)   AS date,
  n.summary                                AS description,
  'text/plain'::text                       AS content_type,
  n.created_at,
  n.updated_at
FROM public.ai_progress_notes n;

-- RLS does not grant privileges; grant explicit read to authenticated (supabase.md §2a).
GRANT SELECT ON public.fhir_document_references TO authenticated;

COMMENT ON VIEW public.fhir_document_references IS
  'FHIR DocumentReference coupling view over ai_progress_notes. security_invoker.';
