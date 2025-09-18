-- Update profiles table to support FHIR requirements
-- Adds missing columns needed for AI-enhanced FHIR functionality

-- migrate:up
begin;

-- Add missing columns to profiles table for FHIR Patient resource mapping
alter table public.profiles
add column if not exists first_name text,
add column if not exists last_name text,
add column if not exists email text,
add column if not exists dob date,
add column if not exists address text,
add column if not exists caregiver_email text,
add column if not exists emergency_contact_name text,
add column if not exists role text default 'senior';

-- Add index for role column
create index if not exists idx_profiles_role on public.profiles (role);

-- Add check_ins table if it doesn't exist (for vitals data)
create table if not exists public.check_ins (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  is_emergency boolean default false not null,
  label text,
  notes text,
  mood text,
  activity_level text,
  heart_rate integer check (heart_rate > 0 and heart_rate < 300),
  pulse_oximeter integer check (pulse_oximeter >= 0 and pulse_oximeter <= 100),
  bp_systolic integer check (bp_systolic > 0 and bp_systolic < 300),
  bp_diastolic integer check (bp_diastolic > 0 and bp_diastolic < 200),
  glucose_mg_dl integer check (glucose_mg_dl > 0 and glucose_mg_dl < 1000),
  created_at timestamptz default now() not null
);

-- Add health_entries table if it doesn't exist (for wellness data)
create table if not exists public.health_entries (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  entry_type text not null,
  data jsonb not null default '{}',
  created_at timestamptz default now() not null
);

-- Add meals table if it doesn't exist (referenced in UploadMeal component)
create table if not exists public.meals (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  meal_type text,
  description text,
  image_url text,
  created_at timestamptz default now() not null
);

-- Add privacy_consent table if it doesn't exist
create table if not exists public.privacy_consent (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  consent_type text not null,
  consented boolean default false not null,
  consented_at timestamptz default now() not null
);

-- Add phone_auth table if it doesn't exist
create table if not exists public.phone_auth (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  phone text not null,
  verified boolean default false not null,
  verified_at timestamptz,
  created_at timestamptz default now() not null
);

-- Add community_moments table if it doesn't exist
create table if not exists public.community_moments (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  file_url text,
  file_path text,
  title text,
  description text,
  emoji text,
  tags text[],
  is_gallery_high boolean default false,
  created_at timestamptz default now() not null
);

-- Add community_photos table if it doesn't exist
create table if not exists public.community_photos (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  file_url text not null,
  description text,
  created_at timestamptz default now() not null
);

-- Add admin_notes table if it doesn't exist
create table if not exists public.admin_notes (
  id bigserial primary key,
  patient_id uuid references auth.users(id) on delete cascade not null,
  admin_id uuid references auth.users(id) on delete cascade not null,
  note text not null,
  created_at timestamptz default now() not null
);

-- Add admin_profile_view_logs table if it doesn't exist
create table if not exists public.admin_profile_view_logs (
  id bigserial primary key,
  admin_id uuid references auth.users(id) on delete cascade not null,
  patient_id uuid references auth.users(id) on delete cascade not null,
  accessed_at timestamptz default now() not null
);

-- Add indexes for performance
create index if not exists idx_check_ins_user_id on public.check_ins (user_id);
create index if not exists idx_check_ins_created_at on public.check_ins (created_at desc);
create index if not exists idx_check_ins_emergency on public.check_ins (is_emergency) where is_emergency = true;

create index if not exists idx_health_entries_user_id on public.health_entries (user_id);
create index if not exists idx_health_entries_created_at on public.health_entries (created_at desc);
create index if not exists idx_health_entries_type on public.health_entries (entry_type);

create index if not exists idx_meals_user_id on public.meals (user_id);
create index if not exists idx_meals_created_at on public.meals (created_at desc);

create index if not exists idx_privacy_consent_user_id on public.privacy_consent (user_id);
create index if not exists idx_phone_auth_user_id on public.phone_auth (user_id);
create index if not exists idx_phone_auth_phone on public.phone_auth (phone);

create index if not exists idx_community_moments_user_id on public.community_moments (user_id);
create index if not exists idx_community_moments_created_at on public.community_moments (created_at desc);
create index if not exists idx_community_photos_user_id on public.community_photos (user_id);

create index if not exists idx_admin_notes_patient_id on public.admin_notes (patient_id);
create index if not exists idx_admin_notes_admin_id on public.admin_notes (admin_id);
create index if not exists idx_admin_profile_view_logs_admin_id on public.admin_profile_view_logs (admin_id);
create index if not exists idx_admin_profile_view_logs_patient_id on public.admin_profile_view_logs (patient_id);

-- Enable RLS on all tables
alter table public.check_ins enable row level security;
alter table public.health_entries enable row level security;
alter table public.meals enable row level security;
alter table public.privacy_consent enable row level security;
alter table public.phone_auth enable row level security;
alter table public.community_moments enable row level security;
alter table public.community_photos enable row level security;
alter table public.admin_notes enable row level security;
alter table public.admin_profile_view_logs enable row level security;

-- RLS Policies for check_ins
drop policy if exists "check_ins_select_own" on public.check_ins;
create policy "check_ins_select_own"
on public.check_ins
for select
using (user_id = auth.uid());

drop policy if exists "check_ins_insert_own" on public.check_ins;
create policy "check_ins_insert_own"
on public.check_ins
for insert
with check (user_id = auth.uid());

drop policy if exists "check_ins_admin_all" on public.check_ins;
create policy "check_ins_admin_all"
on public.check_ins
for all
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
    and ur.role in ('admin', 'super_admin')
  )
);

-- RLS Policies for health_entries
drop policy if exists "health_entries_select_own" on public.health_entries;
create policy "health_entries_select_own"
on public.health_entries
for select
using (user_id = auth.uid());

drop policy if exists "health_entries_insert_own" on public.health_entries;
create policy "health_entries_insert_own"
on public.health_entries
for insert
with check (user_id = auth.uid());

drop policy if exists "health_entries_admin_all" on public.health_entries;
create policy "health_entries_admin_all"
on public.health_entries
for all
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
    and ur.role in ('admin', 'super_admin')
  )
);

-- RLS Policies for meals
drop policy if exists "meals_select_own" on public.meals;
create policy "meals_select_own"
on public.meals
for select
using (user_id = auth.uid());

drop policy if exists "meals_insert_own" on public.meals;
create policy "meals_insert_own"
on public.meals
for insert
with check (user_id = auth.uid());

-- RLS Policies for privacy_consent
drop policy if exists "privacy_consent_select_own" on public.privacy_consent;
create policy "privacy_consent_select_own"
on public.privacy_consent
for select
using (user_id = auth.uid());

drop policy if exists "privacy_consent_insert_own" on public.privacy_consent;
create policy "privacy_consent_insert_own"
on public.privacy_consent
for insert
with check (user_id = auth.uid());

-- RLS Policies for phone_auth
drop policy if exists "phone_auth_select_own" on public.phone_auth;
create policy "phone_auth_select_own"
on public.phone_auth
for select
using (user_id = auth.uid());

drop policy if exists "phone_auth_upsert_own" on public.phone_auth;
create policy "phone_auth_upsert_own"
on public.phone_auth
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- RLS Policies for community_moments
drop policy if exists "community_moments_select_all" on public.community_moments;
create policy "community_moments_select_all"
on public.community_moments
for select
using (true); -- Community moments are visible to all users

drop policy if exists "community_moments_insert_own" on public.community_moments;
create policy "community_moments_insert_own"
on public.community_moments
for insert
with check (user_id = auth.uid());

drop policy if exists "community_moments_update_own" on public.community_moments;
create policy "community_moments_update_own"
on public.community_moments
for update
using (user_id = auth.uid());

-- RLS Policies for community_photos
drop policy if exists "community_photos_select_all" on public.community_photos;
create policy "community_photos_select_all"
on public.community_photos
for select
using (true); -- Community photos are visible to all users

drop policy if exists "community_photos_insert_own" on public.community_photos;
create policy "community_photos_insert_own"
on public.community_photos
for insert
with check (user_id = auth.uid());

-- RLS Policies for admin_notes (Admin only)
drop policy if exists "admin_notes_admin_only" on public.admin_notes;
create policy "admin_notes_admin_only"
on public.admin_notes
for all
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
    and ur.role in ('admin', 'super_admin')
  )
);

-- RLS Policies for admin_profile_view_logs (Admin only)
drop policy if exists "admin_profile_view_logs_admin_only" on public.admin_profile_view_logs;
create policy "admin_profile_view_logs_admin_only"
on public.admin_profile_view_logs
for all
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
    and ur.role in ('admin', 'super_admin')
  )
);

-- Create view for profiles with user_id (referenced in ReportsSection)
create or replace view public.profiles_with_user_id as
select
  user_id,
  first_name,
  last_name,
  phone,
  email,
  dob,
  address,
  caregiver_email,
  emergency_contact_name,
  role,
  created_at,
  updated_at
from public.profiles;

-- Grant access to the view
grant select on public.profiles_with_user_id to authenticated;

commit;

-- migrate:down
begin;

-- Drop view
drop view if exists public.profiles_with_user_id;

-- Drop tables (in reverse order of dependencies)
drop table if exists public.admin_profile_view_logs cascade;
drop table if exists public.admin_notes cascade;
drop table if exists public.community_photos cascade;
drop table if exists public.community_moments cascade;
drop table if exists public.phone_auth cascade;
drop table if exists public.privacy_consent cascade;
drop table if exists public.meals cascade;
drop table if exists public.health_entries cascade;
drop table if exists public.check_ins cascade;

-- Remove columns from profiles (be careful with this in production)
-- alter table public.profiles
-- drop column if exists first_name,
-- drop column if exists last_name,
-- drop column if exists email,
-- drop column if exists dob,
-- drop column if exists address,
-- drop column if exists caregiver_email,
-- drop column if exists emergency_contact_name,
-- drop column if exists role;

commit;