-- 1) Column on profiles to mark test accounts
alter table if exists public.profiles
  add column if not exists is_test boolean not null default false,
  add column if not exists test_tag text;

-- 2) Helper: is_super_admin() and is_admin()
create or replace function public.is_super_admin() returns boolean
language sql stable
as $$
  select exists(
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'super_admin'
  );
$$;

create or replace function public.is_admin() returns boolean
language sql stable
as $$
  select exists(
    select 1 from public.profiles p
    where p.user_id = auth.uid() and (p.role = 'admin' or p.role = 'super_admin')
  );
$$;

-- 3) Soft-delete safeguard (optional): prevent deletes on non-test rows
--     If you truly want to block accidental deletes:
create or replace function public.prevent_non_test_delete()
returns trigger
language plpgsql
as $$
begin
  if OLD.is_test is distinct from true then
    raise exception 'Delete blocked: only is_test=true rows may be deleted here.';
  end if;
  return OLD;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'profiles_prevent_non_test_delete_trg'
  ) then
    create trigger profiles_prevent_non_test_delete_trg
    before delete on public.profiles
    for each row execute function public.prevent_non_test_delete();
  end if;
end$$;

-- 4) RLS policies (assumes RLS already enabled on public.profiles)
-- Allow admins to INSERT test users (marking is_test=true)
drop policy if exists profiles_admin_insert_tests on public.profiles;
create policy profiles_admin_insert_tests on public.profiles
for insert
to authenticated
with check (
  public.is_admin() = true
  and is_test = true
);

-- Allow admins to UPDATE only test flags on test rows they created (optional)
-- Relax if you want broader updates. Here we allow any change on test rows by admin.
drop policy if exists profiles_admin_update_tests on public.profiles;
create policy profiles_admin_update_tests on public.profiles
for update
to authenticated
using (public.is_admin() = true and is_test = true)
with check (public.is_admin() = true and is_test = true);

-- Allow super_admin to DELETE test rows (soft delete in profiles table)
drop policy if exists profiles_superadmin_delete_tests on public.profiles;
create policy profiles_superadmin_delete_tests on public.profiles
for delete
to authenticated
using (public.is_super_admin() = true and is_test = true);

-- 5) A view to list candidates that are safe to purge (older than N minutes)
create or replace view public.test_profiles_candidates as
select p.*
from public.profiles p
where p.is_test = true
  and p.created_at <= now() - interval '10 minutes'; -- safety buffer

-- 6) (Optional) pg_cron job to auto-purge old test profiles (Auth delete must happen via Edge Function)
-- Requires: create extension if not exists pg_cron;
-- We’ll schedule a nightly reminder list; actual purge still via Edge Function.
create or replace function public.log_test_candidates() returns void
language plpgsql as $$
declare
  v_count int;
begin
  select count(*) into v_count from public.test_profiles_candidates;
  raise notice 'Test profiles eligible for purge: %', v_count;
end;
$$;

-- schedule at 12:00 (noon) daily as a "reminder" in logs; adjust if you prefer midnight.
-- If pg_cron is enabled:
-- select cron.schedule('log_test_candidates_daily', '0 12 * * *', $$select public.log_test_candidates();$$);
