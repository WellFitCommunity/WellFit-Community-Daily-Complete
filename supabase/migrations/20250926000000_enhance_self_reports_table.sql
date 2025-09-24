-- Migration: Enhance self_reports table with missing columns for comprehensive health tracking
-- This adds the missing health metrics that are currently in SelfReportingPage

-- migrate:up
begin;

-- Add missing columns to self_reports table
alter table public.self_reports
  add column if not exists blood_sugar integer check (blood_sugar >= 50 and blood_sugar <= 500),
  add column if not exists blood_oxygen integer check (blood_oxygen >= 70 and blood_oxygen <= 100),
  add column if not exists weight decimal(5,1) check (weight >= 50 and weight <= 500),
  add column if not exists physical_activity text,
  add column if not exists social_engagement text,
  add column if not exists activity_description text;

-- Add indexes for better query performance
create index if not exists idx_self_reports_user_id on public.self_reports (user_id);
create index if not exists idx_self_reports_created_at on public.self_reports (created_at desc);

-- Add RLS policies if they don't exist
create policy if not exists "self_reports_select_own"
  on public.self_reports
  for select
  using (auth.uid() = user_id);

create policy if not exists "self_reports_insert_own"
  on public.self_reports
  for insert
  with check (auth.uid() = user_id);

create policy if not exists "self_reports_update_own"
  on public.self_reports
  for update
  using (auth.uid() = user_id);

-- Admin policies for staff access
create policy if not exists "self_reports_admin_select"
  on public.self_reports
  for select
  to authenticated
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
      and ur.role in ('admin', 'super_admin')
    )
  );

commit;