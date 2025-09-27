-- Create missing community moments and affirmations tables
-- The CommunityMoments component expects these tables

-- migrate:up
begin;

-- Create community_moments table
create table if not exists public.community_moments (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  file_url text,
  file_path text,
  title text not null,
  description text not null,
  emoji text default '😊',
  tags text,
  is_gallery_high boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Create affirmations table for daily positive messages
create table if not exists public.affirmations (
  id bigserial primary key,
  text text not null,
  author text not null,
  created_at timestamptz default now() not null
);

-- Add some default affirmations
insert into public.affirmations (text, author) values
('Every day is a new beginning. Take a deep breath, smile, and start again.', 'Unknown'),
('The best time to plant a tree was 20 years ago. The second best time is now.', 'Chinese Proverb'),
('Age is merely mind over matter. If you don''t mind, it doesn''t matter.', 'Mark Twain'),
('You are never too old to set another goal or to dream a new dream.', 'C.S. Lewis'),
('Life is what happens when you''re busy making other plans.', 'John Lennon'),
('The secret of getting ahead is getting started.', 'Mark Twain'),
('Believe you can and you''re halfway there.', 'Theodore Roosevelt'),
('It is during our darkest moments that we must focus to see the light.', 'Aristotle'),
('The only impossible journey is the one you never begin.', 'Tony Robbins'),
('In the middle of difficulty lies opportunity.', 'Albert Einstein')
on conflict do nothing;

-- Add indexes for performance
create index if not exists idx_community_moments_user_id on public.community_moments (user_id);
create index if not exists idx_community_moments_created_at on public.community_moments (created_at desc);
create index if not exists idx_community_moments_is_gallery_high on public.community_moments (is_gallery_high) where is_gallery_high = true;
create index if not exists idx_affirmations_id on public.affirmations (id);

-- Add updated_at trigger for community_moments
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists update_community_moments_updated_at on public.community_moments;
create trigger update_community_moments_updated_at
  before update on public.community_moments
  for each row execute function public.update_updated_at_column();

-- Enable RLS
alter table public.community_moments enable row level security;
alter table public.affirmations enable row level security;

-- RLS Policies for community_moments
-- Everyone can view community moments (it's a community feature)
drop policy if exists "community_moments_select_all" on public.community_moments;
create policy "community_moments_select_all"
on public.community_moments
for select
using (true);

-- Users can only insert their own moments
drop policy if exists "community_moments_insert_own" on public.community_moments;
create policy "community_moments_insert_own"
on public.community_moments
for insert
with check (user_id = auth.uid());

-- Users can only update their own moments
drop policy if exists "community_moments_update_own" on public.community_moments;
create policy "community_moments_update_own"
on public.community_moments
for update
using (user_id = auth.uid());

-- Users can only delete their own moments
drop policy if exists "community_moments_delete_own" on public.community_moments;
create policy "community_moments_delete_own"
on public.community_moments
for delete
using (user_id = auth.uid());

-- Admin can do everything with community moments
drop policy if exists "community_moments_admin_all" on public.community_moments;
create policy "community_moments_admin_all"
on public.community_moments
for all
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
    and ur.role in ('admin', 'super_admin')
  )
);

-- RLS Policies for affirmations
-- Everyone can read affirmations
drop policy if exists "affirmations_select_all" on public.affirmations;
create policy "affirmations_select_all"
on public.affirmations
for select
using (true);

-- Only admins can modify affirmations
drop policy if exists "affirmations_admin_only" on public.affirmations;
create policy "affirmations_admin_only"
on public.affirmations
for all
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
    and ur.role in ('admin', 'super_admin')
  )
);

commit;

-- migrate:down
begin;

-- Drop tables
drop table if exists public.community_moments cascade;
drop table if exists public.affirmations cascade;

-- Drop function
drop function if exists public.update_updated_at_column() cascade;

commit;