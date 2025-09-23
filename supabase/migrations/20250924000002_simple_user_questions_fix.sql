-- Simple fix for user_questions table - only add what's missing
-- This migration is idempotent and safe to run multiple times

begin;

-- Create the base user_questions table if it doesn't exist
create table if not exists public.user_questions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  user_email text,
  question_text text not null,
  category text default 'general',
  status text default 'pending',
  response_text text,
  responded_by uuid references auth.users(id),
  responded_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.user_questions enable row level security;

-- Add new columns if they don't exist
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'user_questions' and column_name = 'urgency') then
    alter table public.user_questions add column urgency text default 'low';
  end if;

  if not exists (select 1 from information_schema.columns where table_name = 'user_questions' and column_name = 'ai_suggestions') then
    alter table public.user_questions add column ai_suggestions jsonb;
  end if;

  if not exists (select 1 from information_schema.columns where table_name = 'user_questions' and column_name = 'nurse_notes') then
    alter table public.user_questions add column nurse_notes text;
  end if;

  if not exists (select 1 from information_schema.columns where table_name = 'user_questions' and column_name = 'updated_at') then
    alter table public.user_questions add column updated_at timestamptz default now();
  end if;
end $$;

-- Update constraints safely (just add new ones, ignore if they exist)
alter table public.user_questions drop constraint if exists user_questions_category_check;
alter table public.user_questions add constraint user_questions_category_check
  check (category in ('general', 'health', 'medication', 'emergency', 'technical', 'account'));

alter table public.user_questions drop constraint if exists user_questions_urgency_check;
alter table public.user_questions add constraint user_questions_urgency_check
  check (urgency in ('low', 'medium', 'high'));

alter table public.user_questions drop constraint if exists user_questions_status_check;
alter table public.user_questions add constraint user_questions_status_check
  check (status in ('pending', 'answered', 'closed'));

-- Create indexes if they don't exist
create index if not exists idx_user_questions_user_id on public.user_questions(user_id);
create index if not exists idx_user_questions_status on public.user_questions(status);
create index if not exists idx_user_questions_created_at on public.user_questions(created_at desc);
create index if not exists idx_user_questions_urgency on public.user_questions(urgency);

-- Create or replace policies (safe to run multiple times)
drop policy if exists "users_can_insert_own_questions" on public.user_questions;
create policy "users_can_insert_own_questions" on public.user_questions
  for insert with check (auth.uid() = user_id);

drop policy if exists "users_can_view_own_questions" on public.user_questions;
create policy "users_can_view_own_questions" on public.user_questions
  for select using (auth.uid() = user_id);

drop policy if exists "admins_can_view_all_questions" on public.user_questions;
create policy "admins_can_view_all_questions" on public.user_questions
  for select using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
      and role in ('admin', 'super_admin')
    )
  );

drop policy if exists "admins_can_update_questions" on public.user_questions;
create policy "admins_can_update_questions" on public.user_questions
  for update using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
      and role in ('admin', 'super_admin')
    )
  );

-- Create question templates table
create table if not exists public.question_templates (
    id uuid primary key default gen_random_uuid(),
    template_text text not null,
    category text not null,
    keywords text[],
    suggested_response text,
    usage_count integer default 0,
    active boolean default true,
    created_at timestamptz default now()
);

alter table public.question_templates enable row level security;

-- Template policies
drop policy if exists "users_can_view_active_templates" on public.question_templates;
create policy "users_can_view_active_templates" on public.question_templates
    for select using (active = true);

-- Insert templates if none exist
insert into public.question_templates (template_text, category, keywords, suggested_response)
select * from (values
    ('I missed my medication this morning. What should I do?', 'medication', array['missed', 'medication', 'morning'], 'Take your medication as soon as you remember, unless it''s almost time for your next dose.'),
    ('I''m feeling dizzy when I stand up', 'health', array['dizzy', 'stand', 'lightheaded'], 'Dizziness when standing can be caused by blood pressure changes. Sit down and contact your healthcare team.'),
    ('I''m having trouble sleeping', 'health', array['sleep', 'insomnia', 'tired'], 'Sleep problems are common. Try maintaining a regular bedtime routine and speak with your healthcare provider.'),
    ('My blood pressure seems high today', 'health', array['blood pressure', 'high', 'hypertension'], 'If your blood pressure is elevated, contact your healthcare provider and take medications as prescribed.'),
    ('I can''t remember if I took my pills', 'medication', array['forgot', 'pills', 'remember'], 'Don''t take a double dose. Consider using a pill organizer to help track your medications.')
) as templates(template_text, category, keywords, suggested_response)
where not exists (select 1 from public.question_templates limit 1);

commit;