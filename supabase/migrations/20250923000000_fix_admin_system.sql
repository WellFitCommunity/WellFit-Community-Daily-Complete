-- Fix Admin System - Add Missing Tables and Columns
-- migrate:up
begin;

-- 1. Add missing admin_sessions table that verify-admin-pin expects
create table if not exists public.admin_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','super_admin')),
  admin_token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz default now() not null,
  primary key (user_id, role)
);

-- Add missing columns to existing admin_sessions table if they don't exist
do $$
begin
  -- Add admin_token column if missing
  if not exists (select 1 from information_schema.columns where table_name = 'admin_sessions' and column_name = 'admin_token') then
    alter table public.admin_sessions add column admin_token text unique;
  end if;

  -- Add expires_at column if missing
  if not exists (select 1 from information_schema.columns where table_name = 'admin_sessions' and column_name = 'expires_at') then
    alter table public.admin_sessions add column expires_at timestamptz;
  end if;
end $$;

-- Index for token lookups (after ensuring columns exist)
create index if not exists idx_admin_sessions_token on public.admin_sessions (admin_token);
create index if not exists idx_admin_sessions_expires on public.admin_sessions (expires_at);

-- RLS for admin_sessions
alter table public.admin_sessions enable row level security;

-- No policies - only service role should access this table

-- 2. Add missing is_admin column to profiles table
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'profiles'
    and column_name = 'is_admin'
    and table_schema = 'public'
  ) then
    alter table public.profiles add column is_admin boolean default false not null;
  end if;
end$$;

-- 3. Create admin_pins table if it doesn't exist
create table if not exists public.admin_pins (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','super_admin')),
  pin_hash text not null,
  updated_at timestamptz default now() not null,
  primary key (user_id, role)
);

-- Enable RLS on admin_pins
alter table public.admin_pins enable row level security;

-- Add policy that only allows service role access
drop policy if exists "admin_pins_service_only" on public.admin_pins;
create policy "admin_pins_service_only" on public.admin_pins
  for all using (false); -- Only service role can bypass RLS

-- 4. Ensure user_roles table exists (backup admin check)
create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','super_admin')),
  created_at timestamptz default now() not null,
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;

-- Allow users to read their own roles (for client-side admin checks)
drop policy if exists "user_roles_select_self" on public.user_roles;
create policy "user_roles_select_self" on public.user_roles
  for select using (auth.uid() = user_id);

-- 5. Create cleanup function for expired admin sessions
create or replace function public.cleanup_expired_admin_sessions()
returns int language plpgsql security definer as $$
declare
  deleted_count int;
begin
  delete from public.admin_sessions
  where expires_at < now();

  get diagnostics deleted_count = row_count;
  return deleted_count;
end$$;

-- 6. Insert your user as admin if not already (replace with your actual user ID)
-- You'll need to update this with your actual user_id from auth.users
-- Example: insert into public.profiles (user_id, is_admin) values ('your-uuid-here', true) on conflict (user_id) do update set is_admin = true;

commit;

-- migrate:down
begin;

-- Remove cleanup function
drop function if exists public.cleanup_expired_admin_sessions();

-- Remove admin_sessions table
drop table if exists public.admin_sessions cascade;

-- Remove is_admin column (commented out to prevent data loss)
-- alter table public.profiles drop column if exists is_admin;

-- Remove policies
drop policy if exists "admin_pins_service_only" on public.admin_pins;
drop policy if exists "user_roles_select_self" on public.user_roles;

commit;