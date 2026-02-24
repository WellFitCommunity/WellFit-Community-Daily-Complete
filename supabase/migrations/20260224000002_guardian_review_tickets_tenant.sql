-- Add tenant_id to guardian_review_tickets for multi-tenant isolation.
-- Previously, all tickets were visible to all SOC operators regardless of tenant.

-- 1. Add column
ALTER TABLE guardian_review_tickets
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- 2. Backfill from detection_context if available
UPDATE guardian_review_tickets
SET tenant_id = (detection_context->>'tenantId')::uuid
WHERE tenant_id IS NULL
  AND detection_context->>'tenantId' IS NOT NULL;

-- 3. Index
CREATE INDEX IF NOT EXISTS idx_guardian_tickets_tenant
  ON guardian_review_tickets(tenant_id);

-- 4. Update RLS policies to be tenant-scoped
DROP POLICY IF EXISTS "soc_view_guardian_tickets" ON guardian_review_tickets;
CREATE POLICY "soc_view_guardian_tickets"
ON guardian_review_tickets
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('super_admin', 'system_admin')
    AND (
      -- Super admins see all tenants, tenant admins see their own
      profiles.role = 'super_admin'
      OR profiles.tenant_id = guardian_review_tickets.tenant_id
    )
  )
);

DROP POLICY IF EXISTS "soc_update_guardian_tickets" ON guardian_review_tickets;
CREATE POLICY "soc_update_guardian_tickets"
ON guardian_review_tickets
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('super_admin', 'system_admin')
    AND (
      profiles.role = 'super_admin'
      OR profiles.tenant_id = guardian_review_tickets.tenant_id
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('super_admin', 'system_admin')
    AND (
      profiles.role = 'super_admin'
      OR profiles.tenant_id = guardian_review_tickets.tenant_id
    )
  )
);

-- 5. Update get_pending_guardian_tickets to filter by caller's tenant
CREATE OR REPLACE FUNCTION public.get_pending_guardian_tickets()
RETURNS TABLE (
  id UUID,
  issue_id TEXT,
  issue_category TEXT,
  issue_severity TEXT,
  issue_description TEXT,
  affected_component TEXT,
  healing_strategy TEXT,
  healing_description TEXT,
  sandbox_passed BOOLEAN,
  status TEXT,
  created_at TIMESTAMPTZ,
  security_alert_id UUID
) AS $$
DECLARE
  v_tenant_id UUID;
  v_is_super_admin BOOLEAN;
BEGIN
  -- Resolve caller's tenant
  SELECT p.tenant_id, (p.role = 'super_admin')
  INTO v_tenant_id, v_is_super_admin
  FROM profiles p WHERE p.user_id = auth.uid();

  RETURN QUERY
  SELECT
    t.id,
    t.issue_id,
    t.issue_category,
    t.issue_severity,
    t.issue_description,
    t.affected_component,
    t.healing_strategy,
    t.healing_description,
    t.sandbox_passed,
    t.status,
    t.created_at,
    t.security_alert_id
  FROM guardian_review_tickets t
  WHERE t.status IN ('pending', 'in_review')
    AND (v_is_super_admin OR t.tenant_id = v_tenant_id)
  ORDER BY
    CASE t.issue_severity
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
      ELSE 5
    END,
    t.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
