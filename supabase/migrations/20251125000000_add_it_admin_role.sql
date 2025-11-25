-- ============================================================================
-- Add IT Administrator (it_admin) Role to RBAC System
-- ============================================================================
-- Purpose: Add tenant-level IT administrator role for technical operations
--
-- Role Hierarchy:
--   super_admin (Level 1): Envision Platform administrators - manages ALL tenants
--   it_admin    (Level 2): Tenant IT administrators - manages their ORG ONLY
--   admin       (Level 2): Tenant business administrators
--
-- IT Admin Capabilities:
--   - User account management within tenant (password resets, unlocks)
--   - Tenant-scoped audit log viewing
--   - API key management for integrations
--   - System health monitoring (tenant resources only)
--   - Compliance report exports
--   - NO access to clinical data or other tenants
-- ============================================================================

begin;

-- ============================================================================
-- PART 1: UPDATE user_roles TABLE CONSTRAINT
-- ============================================================================

alter table public.user_roles
  drop constraint if exists user_roles_role_check;

alter table public.user_roles
  add constraint user_roles_role_check
  check (role in (
    'admin',
    'super_admin',
    'it_admin',           -- NEW: Tenant IT Administrator
    'nurse',
    'nurse_practitioner',
    'physician',
    'doctor',
    'physician_assistant',
    'clinical_supervisor',
    'department_head',
    'physical_therapist',
    'case_manager',
    'social_worker',
    'community_health_worker',
    'chw'
  ));

comment on column public.user_roles.role is
  'Staff role. it_admin is for tenant IT staff with technical but not clinical access.';

-- ============================================================================
-- PART 2: UPDATE staff_pins TABLE CONSTRAINT
-- ============================================================================

alter table public.staff_pins
  drop constraint if exists staff_pins_role_check;

alter table public.staff_pins
  add constraint staff_pins_role_check
  check (role in (
    'admin',
    'super_admin',
    'it_admin',           -- NEW: Tenant IT Administrator
    'nurse',
    'nurse_practitioner',
    'physician',
    'doctor',
    'physician_assistant',
    'clinical_supervisor',
    'department_head',
    'physical_therapist',
    'case_manager',
    'social_worker',
    'community_health_worker',
    'chw'
  ));

comment on column public.staff_pins.role is
  'Role this PIN is for. it_admin for tenant IT staff.';

-- ============================================================================
-- PART 3: UPDATE staff_auth_attempts TABLE CONSTRAINT
-- ============================================================================

-- First drop the existing constraint
alter table public.staff_auth_attempts
  drop constraint if exists staff_auth_attempts_role_check;

-- Add new constraint with it_admin
alter table public.staff_auth_attempts
  add constraint staff_auth_attempts_role_check
  check (role in (
    'admin',
    'super_admin',
    'it_admin',           -- NEW: Tenant IT Administrator
    'nurse',
    'nurse_practitioner',
    'physician',
    'doctor',
    'physician_assistant',
    'clinical_supervisor',
    'department_head',
    'physical_therapist',
    'case_manager',
    'social_worker',
    'community_health_worker',
    'chw'
  ));

-- ============================================================================
-- PART 4: UPDATE staff_audit_log TABLE CONSTRAINT (if exists)
-- ============================================================================

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
    and table_name = 'staff_audit_log'
  ) then
    alter table public.staff_audit_log
      drop constraint if exists staff_audit_log_target_role_check;

    alter table public.staff_audit_log
      add constraint staff_audit_log_target_role_check
      check (target_role in (
        'admin',
        'super_admin',
        'it_admin',
        'nurse',
        'nurse_practitioner',
        'physician',
        'doctor',
        'physician_assistant',
        'clinical_supervisor',
        'department_head',
        'physical_therapist',
        'case_manager',
        'social_worker',
        'community_health_worker',
        'chw'
      ));
  end if;
end $$;

-- ============================================================================
-- PART 5: UPDATE get_role_access_scopes FUNCTION
-- ============================================================================

create or replace function public.get_role_access_scopes(check_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  user_role text;
  result jsonb;
begin
  -- Get user's role from profiles
  select role into user_role
  from public.profiles
  where user_id = check_user_id;

  -- Return access scopes based on role
  case user_role
    when 'super_admin' then
      result := jsonb_build_object(
        'canViewNurse', true,
        'canViewPhysician', true,
        'canViewAdmin', true,
        'canSupervise', true,
        'canManageDepartment', true,
        'department', null,
        'roles', array['super_admin', 'it_admin', 'admin', 'department_head', 'clinical_supervisor',
                       'nurse_practitioner', 'physician_assistant', 'physician', 'doctor',
                       'nurse', 'case_manager', 'social_worker', 'community_health_worker',
                       'chw', 'physical_therapist']::text[]
      );
    when 'it_admin' then
      -- IT Admin: Technical access, no clinical supervision
      result := jsonb_build_object(
        'canViewNurse', false,
        'canViewPhysician', false,
        'canViewAdmin', true,
        'canSupervise', false,
        'canManageDepartment', false,
        'department', 'administration',
        'roles', array['it_admin', 'admin']::text[]
      );
    when 'department_head' then
      result := jsonb_build_object(
        'canViewNurse', true,
        'canViewPhysician', true,
        'canViewAdmin', true,
        'canSupervise', true,
        'canManageDepartment', true,
        'department', null,
        'roles', array['department_head', 'clinical_supervisor', 'nurse_practitioner',
                       'physician_assistant', 'physician', 'doctor', 'nurse',
                       'case_manager', 'social_worker']::text[]
      );
    when 'clinical_supervisor' then
      result := jsonb_build_object(
        'canViewNurse', true,
        'canViewPhysician', true,
        'canViewAdmin', false,
        'canSupervise', true,
        'canManageDepartment', false,
        'department', null,
        'roles', array['clinical_supervisor', 'nurse_practitioner', 'physician_assistant',
                       'physician', 'doctor', 'nurse', 'case_manager', 'social_worker']::text[]
      );
    when 'admin' then
      result := jsonb_build_object(
        'canViewNurse', true,
        'canViewPhysician', true,
        'canViewAdmin', true,
        'canSupervise', false,
        'canManageDepartment', false,
        'department', null,
        'roles', array['admin']::text[]
      );
    when 'nurse_practitioner' then
      result := jsonb_build_object(
        'canViewNurse', true,
        'canViewPhysician', true,
        'canViewAdmin', false,
        'canSupervise', false,
        'canManageDepartment', false,
        'department', 'nursing',
        'roles', array['nurse_practitioner', 'nurse', 'physician', 'doctor']::text[]
      );
    when 'physician_assistant' then
      result := jsonb_build_object(
        'canViewNurse', true,
        'canViewPhysician', true,
        'canViewAdmin', false,
        'canSupervise', false,
        'canManageDepartment', false,
        'department', 'medical',
        'roles', array['physician_assistant', 'physician', 'doctor', 'nurse']::text[]
      );
    when 'physician', 'doctor' then
      result := jsonb_build_object(
        'canViewNurse', true,
        'canViewPhysician', true,
        'canViewAdmin', false,
        'canSupervise', false,
        'canManageDepartment', false,
        'department', 'medical',
        'roles', array['physician', 'doctor']::text[]
      );
    when 'nurse' then
      result := jsonb_build_object(
        'canViewNurse', true,
        'canViewPhysician', false,
        'canViewAdmin', false,
        'canSupervise', false,
        'canManageDepartment', false,
        'department', 'nursing',
        'roles', array['nurse']::text[]
      );
    when 'case_manager' then
      result := jsonb_build_object(
        'canViewNurse', true,
        'canViewPhysician', true,
        'canViewAdmin', false,
        'canSupervise', false,
        'canManageDepartment', false,
        'department', null,
        'roles', array['case_manager']::text[]
      );
    when 'social_worker' then
      result := jsonb_build_object(
        'canViewNurse', true,
        'canViewPhysician', true,
        'canViewAdmin', false,
        'canSupervise', false,
        'canManageDepartment', false,
        'department', null,
        'roles', array['social_worker']::text[]
      );
    when 'community_health_worker', 'chw' then
      result := jsonb_build_object(
        'canViewNurse', false,
        'canViewPhysician', false,
        'canViewAdmin', false,
        'canSupervise', false,
        'canManageDepartment', false,
        'department', null,
        'roles', array['community_health_worker', 'chw']::text[]
      );
    else
      result := jsonb_build_object(
        'canViewNurse', false,
        'canViewPhysician', false,
        'canViewAdmin', false,
        'canSupervise', false,
        'canManageDepartment', false,
        'department', null,
        'roles', array[]::text[]
      );
  end case;

  return result;
end;
$$;

comment on function public.get_role_access_scopes(uuid) is
  'Returns access scopes for a user based on their role. it_admin has technical but not clinical access.';

-- ============================================================================
-- PART 6: ADD IT ADMIN SPECIFIC RLS POLICIES
-- ============================================================================

-- IT admins can view audit logs for their tenant
do $$
begin
  -- Drop existing policy if it exists
  drop policy if exists "it_admin_view_tenant_audit_logs" on public.audit_logs;

  if exists (select 1 from information_schema.tables where table_name = 'audit_logs' and table_schema = 'public') then
    create policy "it_admin_view_tenant_audit_logs" on public.audit_logs
      for select
      using (
        exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid()
          and p.role in ('it_admin', 'super_admin', 'admin')
          and (
            -- Super admin sees all
            p.role = 'super_admin'
            -- IT admin sees only their tenant
            or p.tenant_id = (
              select tenant_id from public.audit_logs al2
              where al2.id = audit_logs.id
            )
          )
        )
      );
  end if;
end $$;

-- ============================================================================
-- PART 7: ADD ROLE CODE FOR IT_ADMIN (19)
-- ============================================================================

comment on column public.profiles.role_code is
  'Role code: 1=super_admin, 2=admin, 3=nurse, 4=senior, 5=physician, 6=volunteer, 7=staff, 8=nurse_practitioner, 9=physician_assistant, 10=clinical_supervisor, 11=department_head, 12=physical_therapist, 13=caregiver, 14=case_manager, 15=social_worker, 16=patient, 17=community_health_worker, 18=chw, 19=it_admin';

commit;
