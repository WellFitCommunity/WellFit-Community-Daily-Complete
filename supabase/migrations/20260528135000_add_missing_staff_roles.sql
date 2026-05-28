-- ============================================================================
-- Add missing staff roles to public.roles — code↔DB role reconciliation
-- ============================================================================
--
-- Background (surfaced 2026-05-28): the application role vocabulary in
-- src/types/roles.ts defines staff roles that DO NOT exist as rows in the
-- public.roles table. Because profiles.role_id is a FK to roles.id and the
-- RLS policies resolve authorization through roles.name, a role that has no
-- row here cannot be assigned or enforced at the database layer.
--
-- This migration adds the missing StaffRole names so the full role set is
-- assignable. Names match the EXACT string values in types/roles.ts (the
-- userRoleManagementService resolves role_id by `name = new_role`).
--
-- Idempotent: each insert is guarded by NOT EXISTS, so re-running is a no-op.
-- IDs are assigned by the roles_id_seq sequence (plain serial, max id 105) —
-- we do not hardcode ids (the existing id numbering does NOT correspond to
-- the RoleCode enum, and we are not changing existing ids).
--
-- This is ADDITIVE ONLY. No existing role row, id, or assignment is modified.
-- ============================================================================

BEGIN;

INSERT INTO public.roles (name)
SELECT v.name
FROM (VALUES
  ('it_admin'),
  ('department_head'),
  ('clinical_supervisor'),
  ('doctor'),
  ('physical_therapist'),
  ('pt'),
  ('quality_manager'),
  ('lab_tech'),
  ('pharmacist'),
  ('radiologist'),
  ('billing_specialist')
) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles r WHERE r.name = v.name
);

COMMIT;
