-- ============================================================================
-- Expanded Healthcare Role System
-- ============================================================================
-- Purpose: Add complete healthcare team role hierarchy
-- Roles Added: nurse_practitioner, physician_assistant, physical_therapist,
--              clinical_supervisor, department_head
-- ============================================================================

begin;

-- ============================================================================
-- PART 1: EXPAND USER_ROLES TABLE WITH NEW ROLES
-- ============================================================================

-- Update role constraint to include all healthcare roles
alter table public.user_roles
  drop constraint if exists user_roles_role_check;

alter table public.user_roles
  add constraint user_roles_role_check
  check (role in (
    'admin',
    'super_admin',
    'nurse',
    'physician',
    'doctor',
    'nurse_practitioner',
    'physician_assistant',
    'clinical_supervisor',
    'department_head',
    'physical_therapist'
  ));

-- Add department field for scoped access (department_head uses this)
alter table public.user_roles
  add column if not exists department text;

alter table public.user_roles
  add constraint user_roles_department_check
  check (department is null or department in ('nursing', 'medical', 'therapy', 'administration'));

-- Create index for department filtering
create index if not exists idx_user_roles_department on public.user_roles (department);

comment on table public.user_roles is 'User role assignments for all staff types';
comment on column public.user_roles.role is 'Staff role: admin, super_admin, nurse, physician, nurse_practitioner, physician_assistant, clinical_supervisor, department_head, physical_therapist';
comment on column public.user_roles.department is 'Department scope for department_head role: nursing, medical, therapy, administration, or null for all';

-- ============================================================================
-- PART 2: UPDATE STAFF_PINS TABLE TO SUPPORT NEW ROLES
-- ============================================================================

alter table public.staff_pins
  drop constraint if exists staff_pins_role_check;

alter table public.staff_pins
  add constraint staff_pins_role_check
  check (role in (
    'admin',
    'super_admin',
    'nurse',
    'physician',
    'doctor',
    'nurse_practitioner',
    'physician_assistant',
    'clinical_supervisor',
    'department_head',
    'physical_therapist'
  ));

comment on table public.staff_pins is 'PIN authentication for all staff roles';

-- ============================================================================
-- PART 3: UPDATE STAFF_AUTH_ATTEMPTS TABLE
-- ============================================================================

alter table public.staff_auth_attempts
  drop constraint if exists staff_auth_attempts_role_check;

alter table public.staff_auth_attempts
  add constraint staff_auth_attempts_role_check
  check (role in (
    'admin',
    'super_admin',
    'nurse',
    'physician',
    'doctor',
    'nurse_practitioner',
    'physician_assistant',
    'clinical_supervisor',
    'department_head',
    'physical_therapist'
  ));

-- ============================================================================
-- PART 4: UPDATE STAFF_AUDIT_LOG TABLE
-- ============================================================================

alter table public.staff_audit_log
  drop constraint if exists staff_audit_log_target_role_check;

alter table public.staff_audit_log
  add constraint staff_audit_log_target_role_check
  check (target_role in (
    'admin',
    'super_admin',
    'nurse',
    'physician',
    'doctor',
    'nurse_practitioner',
    'physician_assistant',
    'clinical_supervisor',
    'department_head',
    'physical_therapist'
  ));

-- ============================================================================
-- PART 5: UPDATE PROFILES TABLE ROLE MAPPINGS
-- ============================================================================

-- Update role code mappings:
-- 1  = super_admin
-- 2  = admin
-- 3  = nurse
-- 4  = senior (patient/member)
-- 5  = physician
-- 6  = volunteer
-- 7  = staff
-- 8  = nurse_practitioner (NEW)
-- 9  = physician_assistant (NEW)
-- 10 = clinical_supervisor (NEW)
-- 11 = department_head (NEW)
-- 12 = physical_therapist (NEW)

comment on column public.profiles.role is 'User role: super_admin, admin, nurse, physician, nurse_practitioner, physician_assistant, clinical_supervisor, department_head, physical_therapist, senior, volunteer, staff';
comment on column public.profiles.role_code is 'Role code: 1=super_admin, 2=admin, 3=nurse, 4=senior, 5=physician, 6=volunteer, 7=staff, 8=nurse_practitioner, 9=physician_assistant, 10=clinical_supervisor, 11=department_head, 12=physical_therapist';

-- ============================================================================
-- PART 6: CREATE ROLE HIERARCHY HELPER FUNCTION
-- ============================================================================

create or replace function public.get_role_access_scopes(check_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  user_roles text[];
  user_dept text;
  access_scopes jsonb := '{}'::jsonb;
begin
  -- Get all roles for this user
  select array_agg(role), max(department) into user_roles, user_dept
  from public.user_roles
  where user_id = check_user_id;

  -- Default: no access
  access_scopes := jsonb_build_object(
    'canViewNurse', false,
    'canViewPhysician', false,
    'canViewAdmin', false,
    'canSupervise', false,
    'canManageDepartment', false,
    'department', user_dept,
    'roles', user_roles
  );

  -- super_admin: full access
  if 'super_admin' = any(user_roles) then
    access_scopes := jsonb_build_object(
      'canViewNurse', true,
      'canViewPhysician', true,
      'canViewAdmin', true,
      'canSupervise', true,
      'canManageDepartment', true,
      'department', null,
      'roles', user_roles
    );
    return access_scopes;
  end if;

  -- department_head: department-scoped full access
  if 'department_head' = any(user_roles) then
    access_scopes := jsonb_set(access_scopes, '{canViewAdmin}', 'true'::jsonb);
    access_scopes := jsonb_set(access_scopes, '{canSupervise}', 'true'::jsonb);
    access_scopes := jsonb_set(access_scopes, '{canManageDepartment}', 'true'::jsonb);

    -- Department-specific access
    if user_dept in ('nursing', 'medical') or user_dept is null then
      access_scopes := jsonb_set(access_scopes, '{canViewNurse}', 'true'::jsonb);
      access_scopes := jsonb_set(access_scopes, '{canViewPhysician}', 'true'::jsonb);
    end if;
  end if;

  -- clinical_supervisor: nurse + physician + supervision
  if 'clinical_supervisor' = any(user_roles) then
    access_scopes := jsonb_set(access_scopes, '{canViewNurse}', 'true'::jsonb);
    access_scopes := jsonb_set(access_scopes, '{canViewPhysician}', 'true'::jsonb);
    access_scopes := jsonb_set(access_scopes, '{canSupervise}', 'true'::jsonb);
  end if;

  -- nurse_practitioner: nurse + physician
  if 'nurse_practitioner' = any(user_roles) then
    access_scopes := jsonb_set(access_scopes, '{canViewNurse}', 'true'::jsonb);
    access_scopes := jsonb_set(access_scopes, '{canViewPhysician}', 'true'::jsonb);
  end if;

  -- physician_assistant: physician + limited nurse
  if 'physician_assistant' = any(user_roles) then
    access_scopes := jsonb_set(access_scopes, '{canViewPhysician}', 'true'::jsonb);
    access_scopes := jsonb_set(access_scopes, '{canViewNurse}', 'true'::jsonb);
  end if;

  -- physician: physician only
  if 'physician' = any(user_roles) or 'doctor' = any(user_roles) then
    access_scopes := jsonb_set(access_scopes, '{canViewPhysician}', 'true'::jsonb);
  end if;

  -- nurse: nurse only
  if 'nurse' = any(user_roles) then
    access_scopes := jsonb_set(access_scopes, '{canViewNurse}', 'true'::jsonb);
  end if;

  -- admin: admin panel only
  if 'admin' = any(user_roles) then
    access_scopes := jsonb_set(access_scopes, '{canViewAdmin}', 'true'::jsonb);
  end if;

  return access_scopes;
end;
$$;

comment on function public.get_role_access_scopes is 'Get comprehensive access permissions for a user based on their roles';

-- ============================================================================
-- PART 7: CREATE ENHANCED ROLE CHECK FUNCTION
-- ============================================================================

create or replace function public.user_has_any_role(check_user_id uuid, required_roles text[])
returns boolean
language plpgsql
security definer
as $$
declare
  has_role boolean;
begin
  -- Check if user has any of the required roles
  select exists(
    select 1
    from public.user_roles
    where user_id = check_user_id
    and role = any(required_roles)
  ) into has_role;

  if has_role then
    return true;
  end if;

  -- Check profiles table as fallback
  select exists(
    select 1
    from public.profiles
    where user_id = check_user_id
    and role = any(required_roles)
  ) into has_role;

  return coalesce(has_role, false);
end;
$$;

comment on function public.user_has_any_role is 'Check if user has any role from an array of roles';

-- ============================================================================
-- PART 8: CREATE DEPARTMENT ACCESS CHECK FUNCTION
-- ============================================================================

create or replace function public.user_can_access_department(
  check_user_id uuid,
  target_department text
)
returns boolean
language plpgsql
security definer
as $$
declare
  user_dept text;
  user_roles text[];
begin
  -- Get user's assigned department and roles
  select department, array_agg(role) into user_dept, user_roles
  from public.user_roles
  where user_id = check_user_id
  group by department;

  -- super_admin can access all departments
  if 'super_admin' = any(user_roles) then
    return true;
  end if;

  -- department_head can access their assigned department (or all if null)
  if 'department_head' = any(user_roles) then
    if user_dept is null or user_dept = target_department then
      return true;
    end if;
  end if;

  -- clinical_supervisor can access all clinical departments
  if 'clinical_supervisor' = any(user_roles) then
    if target_department in ('nursing', 'medical') then
      return true;
    end if;
  end if;

  return false;
end;
$$;

comment on function public.user_can_access_department is 'Check if user can access a specific department based on their role and assignment';

-- ============================================================================
-- PART 9: GRANT PERMISSIONS
-- ============================================================================

grant select on public.user_roles to authenticated;
grant select on public.profiles to authenticated;

grant execute on function public.get_user_role to authenticated;
grant execute on function public.user_has_role to authenticated;
grant execute on function public.user_has_any_role to authenticated;
grant execute on function public.get_role_access_scopes to authenticated;
grant execute on function public.user_can_access_department to authenticated;

commit;
