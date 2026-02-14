-- Migration: Referral Follow-Up Scheduler
-- Phase 1 P5: Automated follow-up for aging referrals
--
-- Tables: referral_follow_up_log (immutable audit), referral_aging_config (per-tenant thresholds)
-- Functions: get_aging_referrals, get_referral_aging_stats

-- =============================================================================
-- A. referral_follow_up_log — immutable log of all follow-up attempts
-- =============================================================================

CREATE TABLE IF NOT EXISTS referral_follow_up_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id     UUID NOT NULL REFERENCES patient_referrals(id) ON DELETE CASCADE,
  referral_source_id UUID REFERENCES external_referral_sources(id) ON DELETE SET NULL,
  follow_up_type  TEXT NOT NULL CHECK (follow_up_type IN ('sms', 'email', 'push', 'provider_task', 'escalation')),
  follow_up_reason TEXT NOT NULL CHECK (follow_up_reason IN (
    'pending_no_response',
    'enrolled_no_activity',
    'active_gone_dormant',
    'specialist_no_confirmation'
  )),
  aging_days      INTEGER NOT NULL DEFAULT 0,
  recipient_phone TEXT,
  recipient_email TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'failed', 'bounced')),
  error_message   TEXT,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE referral_follow_up_log IS 'Immutable audit log of all referral follow-up attempts. No deletes allowed.';

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_referral_followup_referral_id ON referral_follow_up_log(referral_id);
CREATE INDEX IF NOT EXISTS idx_referral_followup_created_at ON referral_follow_up_log(created_at);
CREATE INDEX IF NOT EXISTS idx_referral_followup_tenant_id ON referral_follow_up_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_referral_followup_type ON referral_follow_up_log(follow_up_type);

-- RLS
ALTER TABLE referral_follow_up_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY referral_followup_log_admin_read ON referral_follow_up_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY referral_followup_log_service_insert ON referral_follow_up_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);


-- =============================================================================
-- B. referral_aging_config — per-tenant configurable aging thresholds
-- =============================================================================

CREATE TABLE IF NOT EXISTS referral_aging_config (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  day_3_action    TEXT NOT NULL DEFAULT 'sms',
  day_7_action    TEXT NOT NULL DEFAULT 'sms_email',
  day_14_action   TEXT NOT NULL DEFAULT 'escalation',
  cooldown_hours  INTEGER NOT NULL DEFAULT 24,
  max_follow_ups  INTEGER NOT NULL DEFAULT 5,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT referral_aging_config_tenant_unique UNIQUE (tenant_id)
);

COMMENT ON TABLE referral_aging_config IS 'Per-tenant configuration for referral follow-up aging thresholds and actions.';

-- RLS
ALTER TABLE referral_aging_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY referral_aging_config_admin_select ON referral_aging_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY referral_aging_config_admin_update ON referral_aging_config
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY referral_aging_config_service_all ON referral_aging_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_referral_aging_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_referral_aging_config_updated_at
  BEFORE UPDATE ON referral_aging_config
  FOR EACH ROW
  EXECUTE FUNCTION update_referral_aging_config_updated_at();


-- =============================================================================
-- C. get_aging_referrals — returns referrals needing follow-up
-- =============================================================================

CREATE OR REPLACE FUNCTION get_aging_referrals(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE (
  referral_id       UUID,
  referral_source_id UUID,
  source_org_name   TEXT,
  patient_phone     TEXT,
  patient_email     TEXT,
  patient_first_name TEXT,
  patient_last_name TEXT,
  referral_status   TEXT,
  aging_days        INTEGER,
  last_follow_up_at TIMESTAMPTZ,
  follow_up_count   INTEGER,
  tenant_id         UUID
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH follow_up_stats AS (
    SELECT
      fl.referral_id,
      MAX(fl.created_at) AS last_follow_up_at,
      COUNT(*)::INTEGER AS follow_up_count
    FROM referral_follow_up_log fl
    GROUP BY fl.referral_id
  ),
  aging_config AS (
    SELECT
      COALESCE(rac.cooldown_hours, 24) AS cooldown_hours,
      COALESCE(rac.max_follow_ups, 5) AS max_follow_ups,
      rac.tenant_id
    FROM referral_aging_config rac
    WHERE rac.is_active = true
      AND (p_tenant_id IS NULL OR rac.tenant_id = p_tenant_id)
  )
  SELECT
    pr.id AS referral_id,
    pr.referral_source_id,
    ers.organization_name AS source_org_name,
    pr.patient_phone,
    pr.patient_email,
    pr.patient_first_name,
    pr.patient_last_name,
    pr.status AS referral_status,
    EXTRACT(DAY FROM NOW() - pr.created_at)::INTEGER AS aging_days,
    fs.last_follow_up_at,
    COALESCE(fs.follow_up_count, 0) AS follow_up_count,
    pr.tenant_id
  FROM patient_referrals pr
  LEFT JOIN external_referral_sources ers ON ers.id = pr.referral_source_id
  LEFT JOIN follow_up_stats fs ON fs.referral_id = pr.id
  LEFT JOIN aging_config ac ON ac.tenant_id = pr.tenant_id
  WHERE pr.status IN ('pending', 'invited', 'enrolled')
    AND EXTRACT(DAY FROM NOW() - pr.created_at) >= 3
    AND (p_tenant_id IS NULL OR pr.tenant_id = p_tenant_id)
    -- Past cooldown period
    AND (
      fs.last_follow_up_at IS NULL
      OR fs.last_follow_up_at < NOW() - INTERVAL '1 hour' * COALESCE(ac.cooldown_hours, 24)
    )
    -- Under max attempts
    AND COALESCE(fs.follow_up_count, 0) < COALESCE(ac.max_follow_ups, 5)
  ORDER BY EXTRACT(DAY FROM NOW() - pr.created_at) DESC;
$$;

COMMENT ON FUNCTION get_aging_referrals IS 'Returns referrals needing follow-up: status pending/invited/enrolled, past cooldown, under max attempts.';


-- =============================================================================
-- D. get_referral_aging_stats — dashboard counts by aging bucket and status
-- =============================================================================

CREATE OR REPLACE FUNCTION get_referral_aging_stats(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE (
  bucket_0_3   BIGINT,
  bucket_3_7   BIGINT,
  bucket_7_14  BIGINT,
  bucket_14_plus BIGINT,
  status_pending BIGINT,
  status_invited BIGINT,
  status_enrolled BIGINT,
  total_aging  BIGINT
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    COUNT(*) FILTER (WHERE EXTRACT(DAY FROM NOW() - pr.created_at) < 3) AS bucket_0_3,
    COUNT(*) FILTER (WHERE EXTRACT(DAY FROM NOW() - pr.created_at) >= 3 AND EXTRACT(DAY FROM NOW() - pr.created_at) < 7) AS bucket_3_7,
    COUNT(*) FILTER (WHERE EXTRACT(DAY FROM NOW() - pr.created_at) >= 7 AND EXTRACT(DAY FROM NOW() - pr.created_at) < 14) AS bucket_7_14,
    COUNT(*) FILTER (WHERE EXTRACT(DAY FROM NOW() - pr.created_at) >= 14) AS bucket_14_plus,
    COUNT(*) FILTER (WHERE pr.status = 'pending') AS status_pending,
    COUNT(*) FILTER (WHERE pr.status = 'invited') AS status_invited,
    COUNT(*) FILTER (WHERE pr.status = 'enrolled') AS status_enrolled,
    COUNT(*) AS total_aging
  FROM patient_referrals pr
  WHERE pr.status IN ('pending', 'invited', 'enrolled')
    AND (p_tenant_id IS NULL OR pr.tenant_id = p_tenant_id);
$$;

COMMENT ON FUNCTION get_referral_aging_stats IS 'Dashboard counts by aging bucket (0-3d, 3-7d, 7-14d, 14+d) and status.';


-- =============================================================================
-- E. Seed default aging config for existing tenants
-- =============================================================================

INSERT INTO referral_aging_config (tenant_id)
SELECT id FROM tenants
WHERE NOT EXISTS (
  SELECT 1 FROM referral_aging_config rac WHERE rac.tenant_id = tenants.id
)
ON CONFLICT (tenant_id) DO NOTHING;
