-- Add Performance Indexes for Nurse OS
-- Optimizes frequent query patterns in shift handoff system

-- 1. Composite index for dashboard query (shift_date + shift_type + nurse_reviewed)
DROP INDEX IF EXISTS public.idx_handoff_risk_active_shift;
CREATE INDEX idx_handoff_risk_active_shift
ON public.shift_handoff_risk_scores(shift_date DESC, shift_type, nurse_reviewed)
WHERE nurse_reviewed = FALSE;

-- 2. Partial index for pending reviews (today's unreviewed scores)
DROP INDEX IF EXISTS public.idx_handoff_risk_pending_today;
CREATE INDEX idx_handoff_risk_pending_today
ON public.shift_handoff_risk_scores(final_risk_level, handoff_priority)
WHERE shift_date = CURRENT_DATE AND nurse_reviewed = FALSE;

-- 3. Index for patient lookups in risk scores
CREATE INDEX IF NOT EXISTS idx_handoff_risk_patient_date
ON public.shift_handoff_risk_scores(patient_id, shift_date DESC);

-- 4. Index for event queries (last 8 hours pattern)
CREATE INDEX IF NOT EXISTS idx_handoff_events_patient_time
ON public.shift_handoff_events(patient_id, event_time DESC);

-- 5. Index for risk_score_id foreign key lookups
CREATE INDEX IF NOT EXISTS idx_handoff_events_risk_score
ON public.shift_handoff_events(risk_score_id);

-- 6. Index for FHIR observations vitals queries
CREATE INDEX IF NOT EXISTS idx_fhir_obs_patient_effective
ON public.fhir_observations(patient_id, effective_datetime DESC)
WHERE status = 'final' AND category @> ARRAY['vital-signs']::TEXT[];

-- 7. Index for LOINC code lookups in observations
CREATE INDEX IF NOT EXISTS idx_fhir_obs_code
ON public.fhir_observations(code, code_system)
WHERE status = 'final';

-- 8. Index for active admissions
CREATE INDEX IF NOT EXISTS idx_patient_admissions_active
ON public.patient_admissions(patient_id, admission_date DESC)
WHERE is_active = TRUE;

-- 9. Index for facility unit queries
CREATE INDEX IF NOT EXISTS idx_patient_admissions_unit
ON public.patient_admissions(facility_unit, admission_date DESC)
WHERE is_active = TRUE;

-- 10. Index for emergency bypass audit queries
CREATE INDEX IF NOT EXISTS idx_handoff_override_log_nurse
ON public.shift_handoff_override_log(nurse_id, created_at DESC);

-- 11. Index for bypass time-based queries
CREATE INDEX IF NOT EXISTS idx_handoff_override_log_recent
ON public.shift_handoff_override_log(created_at DESC, nurse_id)
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

-- 12. Covering index for handoff summary query
CREATE INDEX IF NOT EXISTS idx_handoff_risk_summary
ON public.shift_handoff_risk_scores(
  shift_date,
  shift_type,
  final_risk_level,
  handoff_priority,
  nurse_reviewed
) INCLUDE (patient_id, auto_risk_level, nurse_adjusted);

-- 13. Index for profiles room number lookups
CREATE INDEX IF NOT EXISTS idx_profiles_room_active
ON public.profiles(room_number)
WHERE room_number IS NOT NULL;

-- 14. Index for audit PHI access queries
CREATE INDEX IF NOT EXISTS idx_audit_phi_user_time
ON public.audit_phi_access(user_id, accessed_at DESC);

-- 15. Index for audit PHI resource lookups
CREATE INDEX IF NOT EXISTS idx_audit_phi_resource
ON public.audit_phi_access(resource_type, resource_id, accessed_at DESC);

COMMENT ON INDEX public.idx_handoff_risk_active_shift IS 'Optimizes dashboard query for current shift unreviewed patients';
COMMENT ON INDEX public.idx_handoff_risk_pending_today IS 'Partial index for today''s pending reviews, ordered by priority';
COMMENT ON INDEX public.idx_handoff_events_patient_time IS 'Supports "last 8 hours" event queries';
COMMENT ON INDEX public.idx_fhir_obs_patient_effective IS 'Optimizes vitals retrieval for auto-scoring';
COMMENT ON INDEX public.idx_patient_admissions_active IS 'Fast lookups for currently admitted patients';
COMMENT ON INDEX public.idx_handoff_override_log_nurse IS 'Supports bypass count queries per nurse';
