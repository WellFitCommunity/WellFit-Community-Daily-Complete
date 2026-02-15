-- Migration: Eligibility Verification Fields on Encounters
-- Adds coverage verification tracking to the encounter lifecycle so
-- eligibility can be checked before billing.
--
-- Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.

-- =============================================================================
-- Add coverage verification columns to encounters
-- =============================================================================

ALTER TABLE encounters
  ADD COLUMN IF NOT EXISTS coverage_verified_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS coverage_status       TEXT DEFAULT 'unverified'
    CHECK (coverage_status IN ('unverified', 'active', 'inactive', 'expired', 'error')),
  ADD COLUMN IF NOT EXISTS coverage_details      JSONB;

COMMENT ON COLUMN encounters.coverage_verified_at IS 'When the 270/271 eligibility check was last run';
COMMENT ON COLUMN encounters.coverage_status IS 'Result of eligibility verification: unverified, active, inactive, expired, error';
COMMENT ON COLUMN encounters.coverage_details IS 'Parsed eligibility response (copay, coinsurance, deductible, plan info)';

-- Index for filtering unverified encounters
CREATE INDEX IF NOT EXISTS idx_encounters_coverage_status
  ON encounters(coverage_status) WHERE coverage_status = 'unverified';
