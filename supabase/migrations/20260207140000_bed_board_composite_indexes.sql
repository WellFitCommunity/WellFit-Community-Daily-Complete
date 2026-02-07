-- ============================================================================
-- Phase 4.1 — Bed Board Performance Indexes
-- ============================================================================
-- Adds composite indexes for common join patterns in bed management queries.
-- Single-column indexes already exist; composites improve multi-column lookups.
-- ============================================================================

-- 1. hospital_units(tenant_id, facility_id)
--    Queries frequently filter units by tenant + facility together.
--    Separate indexes on each column exist but the planner can't merge them
--    as efficiently as a single composite B-tree.
CREATE INDEX IF NOT EXISTS idx_hospital_units_tenant_facility
  ON hospital_units (tenant_id, facility_id);

-- 2. shift_handoff_risk_scores(patient_id, shift_date)
--    Shift handoff queries look up a patient's risk scores for a given shift.
--    Individual indexes exist but the composite lets the planner satisfy
--    both predicates in a single index scan.
CREATE INDEX IF NOT EXISTS idx_handoff_risk_patient_shift
  ON shift_handoff_risk_scores (patient_id, shift_date DESC);
