-- migrate:up
begin;

-- 1) PROFILES: add verification fields if missing
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text unique,
  phone_verified boolean default false not null,
  email_verified boolean default false not null,
  verified_at timestamptz,
  force_password_change boolean default false not null,
  consent boolean default false not null,
  demographics_complete boolean default false not null,
  onboarded boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Trigger to keep updated_at fresh
create or replace function public.tg_profiles_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.tg_profiles_updated_at();

-- Indexes
create index if not exists idx_profiles_phone on public.profiles (phone);

-- RLS
alter table public.profiles enable row level security;

-- Each user can select/update own profile
drop policy if exists "profiles select self" on public.profiles;
create policy "profiles select self"
on public.profiles
for select
using (auth.uid() = user_id);

drop policy if exists "profiles update self" on public.profiles;
create policy "profiles update self"
on public.profiles
for update
using (auth.uid() = user_id);

-- (Optional) allow admins to manage profiles via RPC/edge functions with service role; no extra policy needed.

-- 2) USER ROLES: source of truth for admin/super_admin
create table if not exists public.user_roles (
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','super_admin')),
  created_at timestamptz default now() not null,
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;

-- Allow users to read their own roles (for isAdmin calc in client)
drop policy if exists "user_roles select self" on public.user_roles;
create policy "user_roles select self"
on public.user_roles
for select
using (auth.uid() = user_id);

-- (Optional) Admin assignment should be done by service-role only; no insert/update RLS policies; service key bypasses RLS.

create index if not exists idx_user_roles_user on public.user_roles (user_id);

-- 3) ADMIN PINS: hashed per role
create table if not exists public.admin_pins (
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','super_admin')),
  pin_hash text not null,
  updated_at timestamptz default now() not null,
  updated_by_ip text,
  primary key (user_id, role)
);

alter table public.admin_pins enable row level security;

-- Do NOT allow client to read or write; only service role (edge functions) should access.
-- So no RLS policies here. Service role bypasses RLS.

create index if not exists idx_admin_pins_user_role on public.admin_pins (user_id, role);

-- 4) ADMIN AUDIT LOG (optional but recommended)
create table if not exists public.admin_audit_log (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_role text check (target_role in ('admin','super_admin')),
  ip_address text,
  user_agent text,
  metadata jsonb,
  timestamp timestamptz default now() not null
);

alter table public.admin_audit_log enable row level security;

-- Read access limited to service role / admins via RPC; keep table private (no policies)

-- 5) APPOINTMENT REMINDERS LOG (for Twilio audit)
create table if not exists public.appointment_reminders (
  id bigserial primary key,
  patient_phone text not null,
  patient_name text,
  appointment_date text,
  appointment_time text,
  provider_name text,
  location text,
  message_sent text,
  twilio_sid text,
  sent_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz default now() not null
);

alter table public.appointment_reminders enable row level security;

-- View own reminders (optional). Typically staff/admins send reminders via Edge Function (service role).
drop policy if exists "reminders select self" on public.appointment_reminders;
create policy "reminders select self"
on public.appointment_reminders
for select
using (auth.uid() = sent_by);

create index if not exists idx_reminders_phone on public.appointment_reminders (patient_phone);
create index if not exists idx_reminders_sent_by on public.appointment_reminders (sent_by);

commit;

-- migrate:down
begin;

drop table if exists public.appointment_reminders cascade;
drop table if exists public.admin_audit_log cascade;
drop table if exists public.admin_pins cascade;

-- Keep user_roles/profiles unless you truly want to roll back everything:
-- drop table if exists public.user_roles cascade;
-- drop table if exists public.profiles cascade;

commit;
