-- Add missing caregiver contact columns to profiles table
-- These columns are referenced by EmergencyContact component

-- migrate:up
begin;

-- Add missing caregiver contact columns to profiles table
alter table public.profiles
add column if not exists caregiver_first_name text,
add column if not exists caregiver_last_name text,
add column if not exists caregiver_phone text,
add column if not exists caregiver_relationship text;

-- Add indexes for performance
create index if not exists idx_profiles_caregiver_first_name on public.profiles (caregiver_first_name);
create index if not exists idx_profiles_caregiver_last_name on public.profiles (caregiver_last_name);
create index if not exists idx_profiles_caregiver_phone on public.profiles (caregiver_phone);
create index if not exists idx_profiles_caregiver_relationship on public.profiles (caregiver_relationship);

commit;

-- migrate:down
begin;

-- Remove caregiver contact columns from profiles table
alter table public.profiles
drop column if exists caregiver_first_name,
drop column if exists caregiver_last_name,
drop column if exists caregiver_phone,
drop column if exists caregiver_relationship;

commit;