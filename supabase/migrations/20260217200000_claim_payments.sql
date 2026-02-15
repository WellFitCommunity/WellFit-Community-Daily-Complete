-- Migration: Claim Payments (ERA-to-Claim Posting)
-- Creates the claim_payments table to store ERA/835 payment postings
-- that close the encounter → payment revenue cycle.
--
-- Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.

-- =============================================================================
-- claim_payments — records ERA payments matched to claims
-- =============================================================================

CREATE TABLE IF NOT EXISTS claim_payments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id                UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  remittance_id           UUID REFERENCES remittances(id) ON DELETE SET NULL,
  paid_amount             NUMERIC(12,2) NOT NULL DEFAULT 0,
  adjustment_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  patient_responsibility  NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowed_amount          NUMERIC(12,2),
  adjustment_reason_codes JSONB DEFAULT '[]',
  check_number            TEXT,
  payment_date            DATE,
  payer_claim_number      TEXT,
  match_confidence        NUMERIC(3,2) DEFAULT 1.00
    CHECK (match_confidence >= 0 AND match_confidence <= 1),
  match_method            TEXT NOT NULL DEFAULT 'manual'
    CHECK (match_method IN ('auto', 'manual', 'override')),
  posted_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_by               UUID NOT NULL DEFAULT auth.uid(),
  tenant_id               UUID NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE claim_payments IS 'ERA/835 payment postings matched to claims to close the revenue cycle';
COMMENT ON COLUMN claim_payments.match_confidence IS 'How confidently the ERA was matched to the claim (1.0 = exact)';
COMMENT ON COLUMN claim_payments.match_method IS 'auto = system-matched, manual = user-matched, override = forced';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_claim_payments_claim
  ON claim_payments(claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_payments_remittance
  ON claim_payments(remittance_id) WHERE remittance_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_claim_payments_tenant
  ON claim_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_claim_payments_posted
  ON claim_payments(posted_at);

-- RLS
ALTER TABLE claim_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "claim_payments_select_tenant"
  ON claim_payments FOR SELECT
  USING (tenant_id = (SELECT get_current_tenant_id()));

CREATE POLICY "claim_payments_insert_tenant"
  ON claim_payments FOR INSERT
  WITH CHECK (tenant_id = (SELECT get_current_tenant_id()));

CREATE POLICY "claim_payments_update_tenant"
  ON claim_payments FOR UPDATE
  USING (tenant_id = (SELECT get_current_tenant_id()));

-- Updated_at trigger
CREATE OR REPLACE TRIGGER set_claim_payments_updated_at
  BEFORE UPDATE ON claim_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
