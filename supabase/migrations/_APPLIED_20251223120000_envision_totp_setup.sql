-- Envision: pending TOTP enrollment secrets (temporary)
-- Holds secret only until the user confirms with a 6-digit code.
-- Table matches the existing envision-totp-setup Edge Function expectations.

create table if not exists public.envision_totp_setup (
  id uuid primary key default gen_random_uuid(),
  super_admin_id uuid not null references public.super_admin_users(id) on delete cascade,
  temp_secret text not null,
  expires_at timestamptz not null,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

-- Index for cleanup and lookups
create index if not exists envision_totp_setup_super_admin_id_idx
on public.envision_totp_setup (super_admin_id);

create index if not exists envision_totp_setup_expires_at_idx
on public.envision_totp_setup (expires_at);

-- RLS: no client should ever read/write this directly
alter table public.envision_totp_setup enable row level security;

-- No policies = nobody via anon/auth can access. Only service-role (Edge Functions) can.
