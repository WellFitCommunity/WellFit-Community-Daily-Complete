-- scripts/tenant-isolation-audit.sql
--
-- T6 tenant-isolation audit (Pool model). Run against the live DB
-- (Supabase MCP execute_sql, or `psql "$DATABASE_URL" -f`).
--
-- For every public table that carries a `tenant_id` column, reports whether its
-- RLS policies actually scope reads by tenant. A tenant_id column with RLS but
-- NO tenant-scoped policy is a candidate cross-tenant leak — UNLESS it is scoped
-- purely by the user's own id (user_id/patient_id/provider_id = auth.uid()),
-- which is implicitly single-tenant.
--
-- ⚠️ Role-based grants (is_admin(), role IN ('admin','super_admin')) that DON'T
-- also check tenant_id let a TENANT-level admin read OTHER tenants' rows.
-- super_admin crossing tenants is by design; tenant admin crossing is the leak.
-- Each flagged table needs an Akima/Maria call: super-admin-only vs tenant-scoped
-- vs reference data.

WITH tenant_tables AS (
  SELECT c.oid, c.relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'tenant_id'
       AND a.attnum > 0 AND NOT a.attisdropped
  WHERE n.nspname = 'public' AND c.relkind = 'r'
),
pol AS (
  SELECT p.polrelid,
    bool_or(pg_get_expr(p.polqual, p.polrelid) ILIKE '%tenant_id%'
         OR pg_get_expr(p.polqual, p.polrelid) ILIKE '%get_current_tenant_id%') AS tenant_scoped,
    bool_or(pg_get_expr(p.polqual, p.polrelid) = 'true')                        AS permissive_true,
    bool_or(pg_get_expr(p.polqual, p.polrelid) ILIKE '%admin%'
         AND pg_get_expr(p.polqual, p.polrelid) NOT ILIKE '%super_admin%')       AS grants_tenant_admin,
    string_agg(DISTINCT left(pg_get_expr(p.polqual, p.polrelid), 200), ' || ')   AS quals
  FROM pg_policy p
  GROUP BY p.polrelid
)
SELECT
  t.relname,
  (t.oid IN (SELECT oid FROM pg_class WHERE relrowsecurity))                     AS rls_enabled,
  CASE
    WHEN COALESCE(pol.tenant_scoped, false)      THEN 'OK_tenant_scoped'
    WHEN COALESCE(pol.permissive_true, false)    THEN 'REVIEW_permissive_true'
    WHEN COALESCE(pol.grants_tenant_admin, false) THEN 'LEAK_RISK_role_no_tenant'
    WHEN pol.quals ILIKE '%auth.uid()%'          THEN 'OK_user_scoped'
    ELSE 'REVIEW_other'
  END AS classification,
  pol.quals
FROM tenant_tables t
LEFT JOIN pol ON pol.polrelid = t.oid
ORDER BY
  CASE
    WHEN COALESCE(pol.permissive_true, false) THEN 0
    WHEN COALESCE(pol.grants_tenant_admin, false) THEN 1
    WHEN COALESCE(pol.tenant_scoped, false) THEN 3
    ELSE 2
  END,
  t.relname;

-- Summary counts (run separately if you just want the headline):
--   OK_tenant_scoped / OK_user_scoped  = fine
--   LEAK_RISK_role_no_tenant           = tenant admin may cross tenants — Akima triage
--   REVIEW_permissive_true / _other    = manual review
