-- Data Retention and Cleanup System
-- Simple, automated data management for compliance

-- migrate:up
begin;

-- Create data retention policy table
create table if not exists public.data_retention_policies (
  id bigserial primary key,
  table_name text not null,
  retention_days integer not null,
  description text,
  last_cleanup timestamptz,
  enabled boolean default true,
  created_at timestamptz default now()
);

-- Insert default retention policies
insert into public.data_retention_policies (table_name, retention_days, description) values
  ('check_ins', 2555, 'Health check-ins retained for 7 years (medical records standard)'),
  ('community_moments', 1825, 'Community posts retained for 5 years'),
  ('admin_audit_log', 2555, 'Audit logs retained for 7 years (compliance requirement)'),
  ('admin_profile_view_logs', 2555, 'Admin access logs retained for 7 years'),
  ('profiles', 1095, 'Delete inactive user profiles after 3 years of no login')
on conflict do nothing;

-- Function to clean up old check-ins
create or replace function cleanup_old_checkins()
returns integer language plpgsql security definer as $$
declare
  retention_days integer;
  deleted_count integer;
begin
  -- Get retention period for check_ins
  select p.retention_days into retention_days
  from public.data_retention_policies p
  where p.table_name = 'check_ins' and p.enabled = true;

  if retention_days is null then
    return 0;
  end if;

  -- Archive old check-ins to a separate table first (optional)
  insert into public.archived_check_ins (
    select * from public.check_ins
    where created_at < now() - interval '1 day' * retention_days
  ) on conflict do nothing;

  -- Delete old records
  delete from public.check_ins
  where created_at < now() - interval '1 day' * retention_days;

  get diagnostics deleted_count = row_count;

  -- Update last cleanup timestamp
  update public.data_retention_policies
  set last_cleanup = now()
  where table_name = 'check_ins';

  return deleted_count;
end$$;

-- Function to clean up inactive user profiles
create or replace function cleanup_inactive_profiles()
returns integer language plpgsql security definer as $$
declare
  retention_days integer;
  deleted_count integer;
begin
  -- Get retention period for profiles
  select p.retention_days into retention_days
  from public.data_retention_policies p
  where p.table_name = 'profiles' and p.enabled = true;

  if retention_days is null then
    return 0;
  end if;

  -- Mark profiles for deletion (soft delete approach)
  update public.profiles
  set
    deleted_at = now(),
    phone = null,
    email_verified = false,
    phone_verified = false
  where
    deleted_at is null
    and updated_at < now() - interval '1 day' * retention_days
    and user_id not in (
      -- Don't delete profiles with recent activity
      select distinct user_id from public.check_ins
      where created_at > now() - interval '1 day' * 90
    );

  get diagnostics deleted_count = row_count;

  -- Update last cleanup timestamp
  update public.data_retention_policies
  set last_cleanup = now()
  where table_name = 'profiles';

  return deleted_count;
end$$;

-- Function to clean up old audit logs
create or replace function cleanup_old_audit_logs()
returns integer language plpgsql security definer as $$
declare
  retention_days integer;
  deleted_count integer;
begin
  -- Get retention period for audit logs
  select p.retention_days into retention_days
  from public.data_retention_policies p
  where p.table_name = 'admin_audit_log' and p.enabled = true;

  if retention_days is null then
    return 0;
  end if;

  -- Delete old audit logs
  delete from public.admin_audit_log
  where timestamp < now() - interval '1 day' * retention_days;

  get diagnostics deleted_count = row_count;

  -- Also cleanup admin profile view logs
  delete from public.admin_profile_view_logs
  where viewed_at < now() - interval '1 day' * retention_days;

  -- Update last cleanup timestamp
  update public.data_retention_policies
  set last_cleanup = now()
  where table_name = 'admin_audit_log';

  return deleted_count;
end$$;

-- Master cleanup function
create or replace function run_data_retention_cleanup()
returns json language plpgsql security definer as $$
declare
  checkins_deleted integer;
  profiles_deleted integer;
  logs_deleted integer;
  result json;
begin
  -- Run all cleanup functions
  select cleanup_old_checkins() into checkins_deleted;
  select cleanup_inactive_profiles() into profiles_deleted;
  select cleanup_old_audit_logs() into logs_deleted;

  -- Return summary
  result := json_build_object(
    'timestamp', now(),
    'checkins_deleted', checkins_deleted,
    'profiles_deleted', profiles_deleted,
    'logs_deleted', logs_deleted,
    'total_deleted', checkins_deleted + profiles_deleted + logs_deleted
  );

  return result;
end$$;

-- Create archived_check_ins table for long-term storage
create table if not exists public.archived_check_ins (
  like public.check_ins including all
);

-- Add deleted_at column to profiles for soft deletes
alter table public.profiles
add column if not exists deleted_at timestamptz;

-- Create data retention log table
create table if not exists public.data_retention_log (
  id bigserial primary key,
  cleanup_type text not null,
  records_deleted integer default 0,
  execution_time interval,
  details json,
  created_at timestamptz default now()
);

-- Function to log retention activities
create or replace function log_retention_activity(
  cleanup_type text,
  records_deleted integer,
  details json default null
)
returns void language plpgsql security definer as $$
begin
  insert into public.data_retention_log (cleanup_type, records_deleted, details)
  values (cleanup_type, records_deleted, details);
end$$;

-- Create view for data retention status
create or replace view public.data_retention_status as
select
  p.table_name,
  p.retention_days,
  p.description,
  p.last_cleanup,
  p.enabled,
  case
    when p.last_cleanup is null then 'Never run'
    when p.last_cleanup < now() - interval '35 days' then 'Overdue'
    when p.last_cleanup < now() - interval '25 days' then 'Due soon'
    else 'Current'
  end as status,
  extract(days from now() - p.last_cleanup)::integer as days_since_cleanup
from public.data_retention_policies p
order by p.table_name;

-- Set up RLS
alter table public.data_retention_policies enable row level security;
alter table public.data_retention_log enable row level security;
alter table public.archived_check_ins enable row level security;

-- Only allow service role and super admins to manage retention
create policy "retention_policies_admin_only" on public.data_retention_policies
for all to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'super_admin'
  )
);

create policy "retention_log_admin_read" on public.data_retention_log
for select to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role in ('admin', 'super_admin')
  )
);

-- Allow archived data to be read by same rules as regular check_ins
create policy "archived_checkins_policy" on public.archived_check_ins
for select to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role in ('admin', 'super_admin')
  )
);

commit;

-- migrate:down
begin;

drop view if exists public.data_retention_status;
drop function if exists log_retention_activity(text, integer, json);
drop table if exists public.data_retention_log cascade;
drop table if exists public.archived_check_ins cascade;
drop function if exists run_data_retention_cleanup();
drop function if exists cleanup_old_audit_logs();
drop function if exists cleanup_inactive_profiles();
drop function if exists cleanup_old_checkins();
drop table if exists public.data_retention_policies cascade;

alter table public.profiles drop column if exists deleted_at;

commit;