-- ============================================================================
-- Role-Based Access Control (RBAC) System
-- ============================================================================
-- Purpose: Implement proper role separation for admin, nurse, and physician
-- Design: Email + Password + PIN auth for nurses and physicians
-- ============================================================================

begin;

-- ============================================================================
-- PART 1: UPDATE USER_ROLES TABLE TO SUPPORT NURSE AND PHYSICIAN
-- ============================================================================

-- Drop existing constraint and recreate with new roles
alter table public.user_roles
  drop constraint if exists user_roles_role_check;

alter table public.user_roles
  add constraint user_roles_role_check
  check (role in ('admin', 'super_admin', 'nurse', 'physician', 'doctor'));

-- Note: 'doctor' and 'physician' are synonyms, both map to physician role

comment on table public.user_roles is 'User role assignments for staff (admin, nurse, physician)';
comment on column public.user_roles.role is 'Role: admin, super_admin, nurse, physician, or doctor (synonym for physician)';

-- ============================================================================
-- PART 2: UPDATE ADMIN_PINS TABLE TO SUPPORT NURSE AND PHYSICIAN PINS
-- ============================================================================

-- Rename table to be more generic
alter table if exists public.admin_pins
  rename to staff_pins;

-- Update constraint to support new roles
alter table public.staff_pins
  drop constraint if exists admin_pins_role_check;

alter table public.staff_pins
  add constraint staff_pins_role_check
  check (role in ('admin', 'super_admin', 'nurse', 'physician', 'doctor'));

-- Rename indexes
drop index if exists idx_admin_pins_user_role;
create index if not exists idx_staff_pins_user_role on public.staff_pins (user_id, role);

comment on table public.staff_pins is 'PIN hashes for staff authentication (admin, nurse, physician)';
comment on column public.staff_pins.role is 'Role this PIN is for: admin, super_admin, nurse, physician, or doctor';

-- ============================================================================
-- PART 3: UPDATE PROFILES TABLE ROLE MAPPINGS
-- ============================================================================

-- Add role_code mappings:
-- 1 = super_admin
-- 2 = admin
-- 3 = nurse
-- 4 = senior (patient/member)
-- 5 = physician/doctor
-- 6 = volunteer
-- 7 = staff

comment on column public.profiles.role is 'User role: super_admin, admin, nurse, senior, physician, doctor, volunteer, or staff';
comment on column public.profiles.role_code is 'Role code: 1=super_admin, 2=admin, 3=nurse, 4=senior, 5=physician, 6=volunteer, 7=staff';

-- ============================================================================
-- PART 4: CREATE STAFF_AUTH_ATTEMPTS TABLE (Rate Limiting + Audit)
-- ============================================================================

create table if not exists public.staff_auth_attempts (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'super_admin', 'nurse', 'physician', 'doctor')),
  attempt_type text not null check (attempt_type in ('pin_success', 'pin_failure', 'password_success', 'password_failure')),
  ip_address text,
  user_agent text,
  metadata jsonb default '{}',
  created_at timestamptz default now() not null
);

create index if not exists idx_staff_auth_attempts_user on public.staff_auth_attempts (user_id, created_at desc);
create index if not exists idx_staff_auth_attempts_email on public.staff_auth_attempts (email, created_at desc);
create index if not exists idx_staff_auth_attempts_ip on public.staff_auth_attempts (ip_address, created_at desc);

alter table public.staff_auth_attempts enable row level security;

-- Only service role can access (no RLS policies = service role only)

comment on table public.staff_auth_attempts is 'Authentication attempt logs for rate limiting and security auditing';

-- ============================================================================
-- PART 5: CREATE HELPER FUNCTION TO CHECK USER ROLE
-- ============================================================================

create or replace function public.get_user_role(check_user_id uuid)
returns text
language plpgsql
security definer
as $$
declare
  user_role text;
begin
  -- Check user_roles table first (for staff: admin, nurse, physician)
  select role into user_role
  from public.user_roles
  where user_id = check_user_id
  limit 1;

  if user_role is not null then
    return user_role;
  end if;

  -- Fall back to profiles table role
  select role into user_role
  from public.profiles
  where user_id = check_user_id;

  return coalesce(user_role, 'senior'); -- Default to senior if not found
end;
$$;

comment on function public.get_user_role is 'Get user role from user_roles or profiles table';

-- ============================================================================
-- PART 6: CREATE HELPER FUNCTION TO CHECK IF USER HAS ROLE
-- ============================================================================

create or replace function public.user_has_role(check_user_id uuid, required_role text)
returns boolean
language plpgsql
security definer
as $$
declare
  has_role boolean;
begin
  -- Check if user has the required role
  select exists(
    select 1
    from public.user_roles
    where user_id = check_user_id
    and role = required_role
  ) into has_role;

  if has_role then
    return true;
  end if;

  -- Check profiles table as fallback
  select exists(
    select 1
    from public.profiles
    where user_id = check_user_id
    and role = required_role
  ) into has_role;

  return coalesce(has_role, false);
end;
$$;

comment on function public.user_has_role is 'Check if user has a specific role';

-- ============================================================================
-- PART 7: UPDATE AUDIT LOG TABLE (OR CREATE IF MISSING)
-- ============================================================================

-- Create the table if it doesn't exist
create table if not exists public.staff_audit_log (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  action text not null,
  target_role text,
  metadata jsonb default '{}',
  created_at timestamptz default now() not null
);

-- Rename if the old table exists
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'admin_audit_log') then
    alter table public.admin_audit_log rename to staff_audit_log;
  end if;
end $$;

-- Update or add constraint
alter table public.staff_audit_log
  drop constraint if exists admin_audit_log_target_role_check;

alter table public.staff_audit_log
  drop constraint if exists staff_audit_log_target_role_check;

alter table public.staff_audit_log
  add constraint staff_audit_log_target_role_check
  check (target_role in ('admin', 'super_admin', 'nurse', 'physician', 'doctor'));

-- Enable RLS
alter table public.staff_audit_log enable row level security;

comment on table public.staff_audit_log is 'Audit log for staff actions (admin, nurse, physician)';

-- ============================================================================
-- PART 8: GRANT PERMISSIONS
-- ============================================================================

-- Grant necessary permissions to authenticated users
grant select on public.user_roles to authenticated;
grant select on public.profiles to authenticated;

-- Functions need to be executable by authenticated users
grant execute on function public.get_user_role to authenticated;
grant execute on function public.user_has_role to authenticated;

commit;
