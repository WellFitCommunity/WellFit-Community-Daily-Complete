-- Ensure profiles has a stable primary key on user_id (adjust if your schema differs)
-- (Safe: IF NOT EXISTS guards)
alter table if exists public.profiles
  add column if not exists user_id uuid;

do $$
begin
  -- If there's an "id" column that actually is the user's uid, mirror it into user_id once
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'id'
  )
  and not exists (
    select 1 from public.profiles where user_id is not null limit 1
  )
  then
    update public.profiles set user_id = id where user_id is null;
  end if;
end $$;

-- Make user_id the primary key if none exists (skip if you already have a PK)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'p'
  ) then
    alter table public.profiles
      add constraint profiles_pkey primary key (user_id);
  end if;
exception
  when duplicate_table then null;
end $$;

-- Columns AuthGate depends on
alter table public.profiles
  add column if not exists force_password_change boolean not null default false,
  add column if not exists onboarded boolean not null default true;

-- Helpful index if user_id isn’t the PK in your setup
create index if not exists idx_profiles_user_id on public.profiles(user_id);

-- If you use a view `profiles_with_user_id`, keep it in sync
-- (Drop/recreate only if you actually use this view)
-- drop view if exists public.profiles_with_user_id;
-- create view public.profiles_with_user_id as
--   select user_id, first_name, last_name, phone, dob, address, created_at,
--          force_password_change, onboarded
--   from public.profiles;
