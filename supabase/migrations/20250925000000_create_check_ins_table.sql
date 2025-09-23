-- Create missing check_ins table
-- The create-checkin function expects this table but it doesn't exist

-- migrate:up
begin;

-- Create the main check_ins table that the function expects
create table if not exists public.check_ins (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  timestamp timestamptz default now() not null,
  label text not null,
  is_emergency boolean default false not null,
  emotional_state text,
  heart_rate integer check (heart_rate > 0 and heart_rate < 300),
  pulse_oximeter integer check (pulse_oximeter >= 0 and pulse_oximeter <= 100),
  bp_systolic integer check (bp_systolic > 0 and bp_systolic < 300),
  bp_diastolic integer check (bp_diastolic > 0 and bp_diastolic < 200),
  glucose_mg_dl integer check (glucose_mg_dl > 0 and glucose_mg_dl < 1000),
  created_at timestamptz default now() not null
);

-- Add indexes for performance
create index if not exists idx_check_ins_user_id on public.check_ins (user_id);
create index if not exists idx_check_ins_timestamp on public.check_ins (timestamp desc);
create index if not exists idx_check_ins_created_at on public.check_ins (created_at desc);
create index if not exists idx_check_ins_emergency on public.check_ins (is_emergency) where is_emergency = true;

-- Enable RLS
alter table public.check_ins enable row level security;

-- RLS Policies - users can only see their own check-ins
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

-- Admin can see all check-ins
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

-- Create trigger to populate check_ins_audit table
create or replace function public.check_ins_audit_trigger()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.check_ins_audit (check_in_id, action, new_row, acted_by, acted_at)
    values (NEW.id, 'INSERT', to_jsonb(NEW), auth.uid(), now());
    return NEW;
  elsif TG_OP = 'UPDATE' then
    insert into public.check_ins_audit (check_in_id, action, old_row, new_row, acted_by, acted_at)
    values (NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid(), now());
    return NEW;
  elsif TG_OP = 'DELETE' then
    insert into public.check_ins_audit (check_in_id, action, old_row, acted_by, acted_at)
    values (OLD.id, 'DELETE', to_jsonb(OLD), auth.uid(), now());
    return OLD;
  end if;
  return null;
end;
$$ language plpgsql security definer;

-- Create the trigger
drop trigger if exists check_ins_audit_trigger on public.check_ins;
create trigger check_ins_audit_trigger
  after insert or update or delete on public.check_ins
  for each row execute function public.check_ins_audit_trigger();

commit;

-- migrate:down
begin;

-- Drop trigger and function
drop trigger if exists check_ins_audit_trigger on public.check_ins;
drop function if exists public.check_ins_audit_trigger();

-- Drop table
drop table if exists public.check_ins cascade;

commit;