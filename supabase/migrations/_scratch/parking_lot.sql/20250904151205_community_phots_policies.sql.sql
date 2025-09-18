-- 20250904_community_photos_policies.sql
-- Community Photos RLS + constraints (idempotent)

-- Enable RLS if not already
alter table if exists public.community_photos
  enable row level security;

-- Caption length constraint (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.community_photos'::regclass
      and conname = 'caption_maxlen'
  ) then
    alter table public.community_photos
      add constraint caption_maxlen
      check (caption is null or length(caption) <= 300);
  end if;
end$$;

-- Owner insert policy
drop policy if exists cp_insert_own on public.community_photos;
create policy cp_insert_own
on public.community_photos
for insert
to authenticated
with check (auth.uid() = user_id);

-- Public/owner/mod select policy
drop policy if exists cp_select_public_or_owner_or_mod on public.community_photos;
create policy cp_select_public_or_owner_or_mod
on public.community_photos
for select
using (
  approved = true
  or auth.uid() = user_id
  or public.is_moderator() or public.is_admin()
);

-- Update (approve) policy
drop policy if exists cp_update_mod_only on public.community_photos;
create policy cp_update_mod_only
on public.community_photos
for update
to authenticated
using (public.is_moderator() or public.is_admin())
with check (public.is_moderator() or public.is_admin());

-- Delete policy
drop policy if exists cp_delete_owner_unapproved_or_mod on public.community_photos;
create policy cp_delete_owner_unapproved_or_mod
on public.community_photos
for delete
to authenticated
using (
  (auth.uid() = user_id and approved = false)
  or public.is_moderator() or public.is_admin()
);
