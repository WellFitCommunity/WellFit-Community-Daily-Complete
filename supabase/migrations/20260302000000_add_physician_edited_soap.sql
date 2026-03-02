-- Add physician-edited SOAP note columns to scribe_sessions
-- Part of Compass Riley Ambient Learning Session 2: Clinical Style Profiler
-- These store the physician's final version after editing AI-generated notes

ALTER TABLE public.scribe_sessions
  ADD COLUMN IF NOT EXISTS physician_note_subjective text,
  ADD COLUMN IF NOT EXISTS physician_note_objective text,
  ADD COLUMN IF NOT EXISTS physician_note_assessment text,
  ADD COLUMN IF NOT EXISTS physician_note_plan text,
  ADD COLUMN IF NOT EXISTS physician_note_hpi text,
  ADD COLUMN IF NOT EXISTS physician_note_ros text,
  ADD COLUMN IF NOT EXISTS soap_edit_analysis jsonb;

COMMENT ON COLUMN public.scribe_sessions.physician_note_subjective IS 'Physician-edited subjective section (null if unedited)';
COMMENT ON COLUMN public.scribe_sessions.soap_edit_analysis IS 'SOAPEditAnalysis JSON — diff between AI and physician versions for style profiling';
