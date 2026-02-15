-- Migration: Encounter-to-Superbill Bridge
-- Creates the encounter_superbills linking table to bridge signed encounters
-- to superbill drafts and track the full encounter → superbill → claim lifecycle.
--
-- Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.

-- =============================================================================
-- encounter_superbills — links encounters to superbill lifecycle
-- =============================================================================

CREATE TABLE IF NOT EXISTS encounter_superbills (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
  claim_id     UUID REFERENCES claims(id) ON DELETE SET NULL,
  superbill_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (superbill_status IN ('draft', 'pending_review', 'approved', 'rejected', 'claimed')),
  diagnosis_codes  JSONB NOT NULL DEFAULT '[]',
  procedure_codes  JSONB NOT NULL DEFAULT '[]',
  total_charge     NUMERIC(12,2) NOT NULL DEFAULT 0,
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at      TIMESTAMPTZ,
  approved_by      UUID REFERENCES auth.users(id),
  approved_at      TIMESTAMPTZ,
  rejected_by      UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  notes            TEXT,
  tenant_id        UUID NOT NULL,
  created_by       UUID NOT NULL DEFAULT auth.uid(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_encounter_superbill UNIQUE (encounter_id)
);

COMMENT ON TABLE encounter_superbills IS 'Links signed encounters to superbill drafts for the billing pipeline';
COMMENT ON COLUMN encounter_superbills.superbill_status IS 'draft → pending_review → approved → claimed (or rejected)';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_encounter_superbills_status
  ON encounter_superbills(superbill_status);
CREATE INDEX IF NOT EXISTS idx_encounter_superbills_tenant
  ON encounter_superbills(tenant_id);
CREATE INDEX IF NOT EXISTS idx_encounter_superbills_encounter
  ON encounter_superbills(encounter_id);
CREATE INDEX IF NOT EXISTS idx_encounter_superbills_claim
  ON encounter_superbills(claim_id) WHERE claim_id IS NOT NULL;

-- RLS
ALTER TABLE encounter_superbills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "encounter_superbills_select_tenant"
  ON encounter_superbills FOR SELECT
  USING (tenant_id = (SELECT get_current_tenant_id()));

CREATE POLICY "encounter_superbills_insert_tenant"
  ON encounter_superbills FOR INSERT
  WITH CHECK (tenant_id = (SELECT get_current_tenant_id()));

CREATE POLICY "encounter_superbills_update_tenant"
  ON encounter_superbills FOR UPDATE
  USING (tenant_id = (SELECT get_current_tenant_id()));

-- Updated_at trigger
CREATE OR REPLACE TRIGGER set_encounter_superbills_updated_at
  BEFORE UPDATE ON encounter_superbills
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
