-- Repair the Guardian Eyes recording pipeline (2026-07-23).
--
-- Guardian Eyes had recorded ZERO rows since inception because of schema/code drift,
-- with every failure swallowed by empty catch blocks:
--   1. guardian-agent recordSnapshot() inserts a tenant_id column that
--      guardian_eyes_recordings never had -> every insert errored. analyzeRecordings()
--      filters on the same missing column -> the daily analyze cron errored silently.
--   2. AISystemRecorder.saveRecording() inserts rrweb_event_count + recording_url into
--      session_recordings, columns the live table never had -> every insert errored.
-- (system_recordings' broken onConflict upsert is fixed in code, not schema: the table
-- intentionally has no unique constraint on session_id — one row per flush batch.)
--
-- Live state verified via psql before writing (CLAUDE.md rule 18):
--   guardian_eyes_recordings columns: id, timestamp, type, component, action, severity,
--     metadata, state_before, state_after, user_id, session_id, ai_analysis, recorded_at,
--     security_alert_id  (NO tenant_id)
--   session_recordings columns: id, session_id, user_id, start_time, end_time,
--     snapshot_count, ai_summary, metadata, created_at, updated_at, tenant_id
--     (NO rrweb_event_count, NO recording_url)
--   Grants already present: authenticated has INSERT on both tables; RLS insert
--   policies exist (WITH CHECK true) and reads are admin-role-gated. No grant or
--   policy changes required here.

-- 1. Tenant scoping column the edge function has been writing all along
ALTER TABLE public.guardian_eyes_recordings
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

CREATE INDEX IF NOT EXISTS idx_guardian_eyes_recordings_tenant_recorded
  ON public.guardian_eyes_recordings (tenant_id, recorded_at DESC);

COMMENT ON COLUMN public.guardian_eyes_recordings.tenant_id IS
  'Tenant the snapshot belongs to. Added 2026-07-23: guardian-agent recordSnapshot() had been inserting this column since inception, silently failing because it never existed.';

-- 2. Columns the browser-side recorder (AISystemRecorder.saveRecording) writes
ALTER TABLE public.session_recordings
  ADD COLUMN IF NOT EXISTS rrweb_event_count integer,
  ADD COLUMN IF NOT EXISTS recording_url text;

COMMENT ON COLUMN public.session_recordings.rrweb_event_count IS
  'Count of rrweb DOM-replay events captured in the session (events themselves live in the guardian-eyes storage bucket).';
COMMENT ON COLUMN public.session_recordings.recording_url IS
  'Storage path/URL of the session''s rrweb event chunks in the guardian-eyes bucket.';
