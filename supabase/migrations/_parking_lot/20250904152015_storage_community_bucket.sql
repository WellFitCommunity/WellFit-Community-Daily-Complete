-- 20250904_storage_community_bucket.sql
-- Community Moments: storage bucket + RLS policies (idempotent)

-- 1) Ensure bucket exists and is PRIVATE
insert into storage.buckets (id, public)
values ('community-moments-photos', false)
on conflict (id) do update set public = excluded.public;

-- 2) Enable RLS on storage.objects (usually enabled by default, but explicit is fine)
alter table if exists storage.objects enable row level security;

-- 3) Fast lookup from storage.objects.name -> public.community_photos.storage_path
--    (safe to create if not exists)
do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'community_photos_storage_path_idx'
  ) then
    create index community_photos_storage_path_idx
      on public.community_photos (storage_path);
  end if;
end$$;

-- Helpers: treat missing is_moderator() as false to avoid dependency breaks
create or replace function public._is_moderator_or_admin()
returns boolean
language sql
stable
as $$
  select coalesce( (select public.is_admin()), false )
         or coalesce( (select public.is_moderator()), false );
$$;

-- 4) SELECT policies
-- Public: can read ONLY approved images
drop policy if exists cm_select_public on storage.objects;
create policy cm_select_public
on storage.objects
for select
to anon
using (
  bucket_id = 'community-moments-photos'
  and exists (
    select 1
    from public.community_photos cp
    where cp.storage_path = storage.objects.name
      and cp.approved = true
  )
);

-- Authenticated: can read approved, or their own, or if moderator/admin
drop policy if exists cm_select_auth on storage.objects;
create policy cm_select_auth
on storage.objects
for select
to authenticated
using (
  bucket_id = 'community-moments-photos'
  and (
    exists (
      select 1
      from public.community_photos cp
      where cp.storage_path = storage.objects.name
        and (
          cp.approved = true
          or cp.user_id = auth.uid()
        )
    )
    or public._is_moderator_or_admin()
  )
);

-- 5) INSERT policy (uploads): authenticated users can upload ONLY to their own folder
-- Path convention enforced: community/<uid>/... (this matches your app code)
drop policy if exists cm_insert_own on storage.objects;
create policy cm_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'community-moments-photos'
  and name like ('community/' || auth.uid() || '/%')
);

-- 6) UPDATE policy: rename/metadata changes allowed to moderators/admins only
drop policy if exists cm_update_mod_only on storage.objects;
create policy cm_update_mod_only
on storage.objects
for update
to authenticated
using (
  bucket_id = 'community-moments-photos'
  and public._is_moderator_or_admin()
)
with check (
  bucket_id = 'community-moments-photos'
  and public._is_moderator_or_admin()
);

-- 7) DELETE policy: owner can delete if NOT approved; mods/admins can delete anytime
drop policy if exists cm_delete_owner_unapproved_or_mod on storage.objects;
create policy cm_delete_owner_unapproved_or_mod
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'community-moments-photos'
  and (
    public._is_moderator_or_admin()
    or exists (
      select 1
      from public.community_photos cp
      where cp.storage_path = storage.objects.name
        and cp.user_id = auth.uid()
        and cp.approved = false
    )
  )
);
