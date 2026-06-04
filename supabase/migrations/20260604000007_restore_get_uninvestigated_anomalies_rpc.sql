-- ============================================================================
-- Restore get_uninvestigated_anomalies dropped by 20251209110000_drop_broken_functions.sql
-- ============================================================================
-- DB-reference drift triage (rpc:: backlog), batch 9.
--   Caller: src/services/behavioralAnalyticsService.ts:337 (getUninvestigatedAnomalies)
--   Canonical source: 20251106000003_behavioral_anomaly_detection.sql (verbatim body).
--   Forward-only: NO `-- migrate:down` block (systemic root cause #1).
--
-- ⚠️ Name-collision trap (4th in this triage): the tracker guessed the backing
-- table was `behavioral_anomalies` and marked this NEEDS SCHEMA REBUILD. VERIFIED
-- WRONG vs live DB — `behavioral_anomalies` does not exist; the function queries the
-- EXISTING `anomaly_detections` table (also queried directly by securityAutomationService).
-- Sibling RPCs from the same 2025-11-06 migration (detect_impossible_travel,
-- get_user_behavior_baseline, mark_anomaly_investigated) are already live. So this is a
-- verbatim function restore, NOT a schema rebuild.
--
-- Deps verified live before authoring: anomaly_detections has id(uuid), user_id(uuid),
-- aggregate_anomaly_score(numeric), risk_level(text), event_type(text), detected_at(tstz),
-- investigated(bool); user_roles.role(text). The only type fix needed vs the original:
-- `auth.users.email` is varchar(255) but the RETURNS TABLE declares user_email TEXT —
-- the original lacked a cast (would throw at execution). Fixed with `::TEXT` (same latent
-- bug found in get_expiring_consents this session). Hardening: SET search_path=public + GRANT.
--
-- ⚠️ REACHABILITY (surfaced to Maria, not a delete decision): behavioralAnalyticsService
-- currently has NO importer in src/ — this RPC restore fixes the data layer and removes the
-- drift, but the behavioral-anomaly subsystem is not yet surfaced in any UI/edge. Real
-- infrastructure (table + most RPCs live), just unwired. Separate product decision.
-- (Also latent + currently harmless: the caller casts the RPC result to AnomalyDetection,
-- whose fields differ from this function's output shape — no consumer reads it today.)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_uninvestigated_anomalies(
  p_min_score NUMERIC DEFAULT 0.5,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_email TEXT,
  user_role TEXT,
  aggregate_score NUMERIC,
  risk_level TEXT,
  event_type TEXT,
  detected_at TIMESTAMPTZ,
  days_since_detection INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ad.id,
    ad.user_id,
    au.email::TEXT AS user_email,
    COALESCE(ur.role, 'unknown')::TEXT AS user_role,
    ad.aggregate_anomaly_score AS aggregate_score,
    ad.risk_level,
    ad.event_type,
    ad.detected_at,
    EXTRACT(DAY FROM NOW() - ad.detected_at)::INTEGER AS days_since_detection
  FROM public.anomaly_detections ad
  JOIN auth.users au ON au.id = ad.user_id
  LEFT JOIN public.user_roles ur ON ur.user_id = ad.user_id
  WHERE ad.investigated = FALSE
    AND ad.aggregate_anomaly_score >= p_min_score
  ORDER BY ad.aggregate_anomaly_score DESC, ad.detected_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_uninvestigated_anomalies(NUMERIC, INTEGER) TO authenticated;

COMMENT ON FUNCTION public.get_uninvestigated_anomalies(NUMERIC, INTEGER) IS
'List uninvestigated behavioral anomalies above a score threshold (admin investigation queue). Restored 2026-06-04 against existing anomaly_detections (NOT behavioral_anomalies).';
