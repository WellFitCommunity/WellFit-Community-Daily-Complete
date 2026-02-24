-- ============================================================================
-- Nurse Question System — Backend Foundation
-- ============================================================================
-- Extends user_questions with nurse workflow columns (tenant_id, assignment,
-- escalation). Creates nurse_question_answers and nurse_question_notes tables.
-- Recreates RPC functions dropped in 20251209110000_drop_broken_functions.sql.
-- ============================================================================

begin;

-- ============================================================================
-- PART 1: Extend user_questions with workflow columns
-- ============================================================================

do $$
begin
  -- Tenant isolation (multi-tenant requirement)
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_questions' and column_name = 'tenant_id'
  ) then
    alter table public.user_questions add column tenant_id uuid references public.tenants(id);
  end if;

  -- Nurse assignment for claim workflow
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_questions' and column_name = 'assigned_nurse_id'
  ) then
    alter table public.user_questions add column assigned_nurse_id uuid references auth.users(id);
  end if;

  -- Claim timestamp
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_questions' and column_name = 'claimed_at'
  ) then
    alter table public.user_questions add column claimed_at timestamptz;
  end if;

  -- Escalation timestamp
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_questions' and column_name = 'escalated_at'
  ) then
    alter table public.user_questions add column escalated_at timestamptz;
  end if;

  -- Escalation level (charge_nurse, supervisor, physician)
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_questions' and column_name = 'escalation_level'
  ) then
    alter table public.user_questions add column escalation_level text;
  end if;
end $$;

-- Update status constraint to include 'claimed' and 'escalated'
alter table public.user_questions drop constraint if exists user_questions_status_check;
alter table public.user_questions add constraint user_questions_status_check
  check (status in ('pending', 'claimed', 'answered', 'escalated', 'closed'));

-- Add escalation level constraint
alter table public.user_questions drop constraint if exists user_questions_escalation_level_check;
alter table public.user_questions add constraint user_questions_escalation_level_check
  check (escalation_level is null or escalation_level in ('charge_nurse', 'supervisor', 'physician'));

-- Indexes for nurse workflow queries
create index if not exists idx_user_questions_tenant_id on public.user_questions(tenant_id);
create index if not exists idx_user_questions_assigned_nurse on public.user_questions(assigned_nurse_id);
create index if not exists idx_user_questions_status_tenant on public.user_questions(tenant_id, status);

-- Backfill tenant_id from profiles where possible
update public.user_questions uq
set tenant_id = p.tenant_id
from public.profiles p
where uq.user_id = p.user_id
  and uq.tenant_id is null
  and p.tenant_id is not null;

-- ============================================================================
-- PART 2: nurse_question_answers — nurse responses with AI tracking
-- ============================================================================

create table if not exists public.nurse_question_answers (
  id uuid default gen_random_uuid() primary key,
  question_id uuid not null references public.user_questions(id) on delete cascade,
  nurse_id uuid not null references auth.users(id),
  answer_text text not null,
  used_ai_suggestion boolean default false,
  ai_suggestion_text text,
  ai_confidence numeric(4,2),
  tenant_id uuid references public.tenants(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.nurse_question_answers enable row level security;

create index if not exists idx_nqa_question_id on public.nurse_question_answers(question_id);
create index if not exists idx_nqa_nurse_id on public.nurse_question_answers(nurse_id);
create index if not exists idx_nqa_tenant_id on public.nurse_question_answers(tenant_id);

-- RLS: nurses can see answers in their tenant
drop policy if exists "nurses_view_tenant_answers" on public.nurse_question_answers;
create policy "nurses_view_tenant_answers" on public.nurse_question_answers
  for select using (
    tenant_id = get_current_tenant_id()
    or exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role in ('admin', 'super_admin')
    )
  );

-- RLS: nurses can insert answers
drop policy if exists "nurses_insert_answers" on public.nurse_question_answers;
create policy "nurses_insert_answers" on public.nurse_question_answers
  for insert with check (
    nurse_id = auth.uid()
    and (
      tenant_id = get_current_tenant_id()
      or exists (
        select 1 from public.user_roles
        where user_id = auth.uid() and role in ('admin', 'super_admin')
      )
    )
  );

-- ============================================================================
-- PART 3: nurse_question_notes — internal nurse notes (not patient-visible)
-- ============================================================================

create table if not exists public.nurse_question_notes (
  id uuid default gen_random_uuid() primary key,
  question_id uuid not null references public.user_questions(id) on delete cascade,
  nurse_id uuid not null references auth.users(id),
  note_text text not null,
  tenant_id uuid references public.tenants(id),
  created_at timestamptz default now()
);

alter table public.nurse_question_notes enable row level security;

create index if not exists idx_nqn_question_id on public.nurse_question_notes(question_id);
create index if not exists idx_nqn_tenant_id on public.nurse_question_notes(tenant_id);

-- RLS: nurses can see notes in their tenant
drop policy if exists "nurses_view_tenant_notes" on public.nurse_question_notes;
create policy "nurses_view_tenant_notes" on public.nurse_question_notes
  for select using (
    tenant_id = get_current_tenant_id()
    or exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role in ('admin', 'super_admin')
    )
  );

-- RLS: nurses can insert notes
drop policy if exists "nurses_insert_notes" on public.nurse_question_notes;
create policy "nurses_insert_notes" on public.nurse_question_notes
  for insert with check (
    nurse_id = auth.uid()
    and (
      tenant_id = get_current_tenant_id()
      or exists (
        select 1 from public.user_roles
        where user_id = auth.uid() and role in ('admin', 'super_admin')
      )
    )
  );

-- ============================================================================
-- PART 4: Updated RLS on user_questions for nurse workflow
-- ============================================================================

-- Nurses can view questions in their tenant
drop policy if exists "nurses_view_tenant_questions" on public.user_questions;
create policy "nurses_view_tenant_questions" on public.user_questions
  for select using (
    tenant_id = get_current_tenant_id()
    and exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
      and role in ('nurse', 'charge_nurse', 'admin', 'super_admin')
    )
  );

-- Nurses can update questions they are assigned to (or any in their tenant if admin)
drop policy if exists "nurses_update_assigned_questions" on public.user_questions;
create policy "nurses_update_assigned_questions" on public.user_questions
  for update using (
    (
      assigned_nurse_id = auth.uid()
      and tenant_id = get_current_tenant_id()
    )
    or exists (
      select 1 from public.user_roles
      where user_id = auth.uid()
      and role in ('charge_nurse', 'admin', 'super_admin')
      -- charge_nurse can update any question in the tenant for escalation
    )
  );

-- ============================================================================
-- PART 5: RPC Functions (recreated — previously dropped)
-- ============================================================================

-- Drop existing functions to avoid return type conflicts
drop function if exists public.nurse_open_queue();
drop function if exists public.nurse_claim_question(uuid);
drop function if exists public.nurse_my_questions();
drop function if exists public.nurse_submit_answer(uuid, text, boolean, text, numeric);
drop function if exists public.nurse_add_note(uuid, text);
drop function if exists public.nurse_escalate_question(uuid, text, text);

-- nurse_open_queue: Get unclaimed questions for the nurse's tenant
create or replace function public.nurse_open_queue()
returns table (
  question_id uuid,
  user_id uuid,
  question_text text,
  category text,
  urgency text,
  status text,
  created_at timestamptz,
  patient_name text,
  patient_phone text
)
language sql
security definer
set search_path = public
as $$
  select
    uq.id as question_id,
    uq.user_id,
    uq.question_text,
    uq.category,
    uq.urgency,
    uq.status,
    uq.created_at,
    coalesce(p.first_name || ' ' || p.last_name, 'Unknown') as patient_name,
    coalesce(p.phone, '') as patient_phone
  from public.user_questions uq
  left join public.profiles p on p.user_id = uq.user_id
  where uq.tenant_id = get_current_tenant_id()
    and uq.status = 'pending'
    and uq.assigned_nurse_id is null
  order by
    case uq.urgency
      when 'high' then 1
      when 'medium' then 2
      when 'low' then 3
      else 4
    end,
    uq.created_at asc;
$$;

-- nurse_claim_question: Assign a question to the calling nurse
create or replace function public.nurse_claim_question(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_questions
  set
    assigned_nurse_id = auth.uid(),
    status = 'claimed',
    claimed_at = now(),
    updated_at = now()
  where id = p_question_id
    and tenant_id = get_current_tenant_id()
    and status = 'pending'
    and assigned_nurse_id is null;

  if not found then
    raise exception 'Question not available for claiming (already claimed or not in your tenant)';
  end if;
end;
$$;

-- nurse_my_questions: Get questions assigned to the calling nurse
create or replace function public.nurse_my_questions()
returns table (
  question_id uuid,
  user_id uuid,
  question_text text,
  category text,
  urgency text,
  status text,
  created_at timestamptz,
  claimed_at timestamptz,
  patient_name text,
  patient_phone text,
  answer_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    uq.id as question_id,
    uq.user_id,
    uq.question_text,
    uq.category,
    uq.urgency,
    uq.status,
    uq.created_at,
    uq.claimed_at,
    coalesce(p.first_name || ' ' || p.last_name, 'Unknown') as patient_name,
    coalesce(p.phone, '') as patient_phone,
    (select count(*) from public.nurse_question_answers nqa where nqa.question_id = uq.id) as answer_count
  from public.user_questions uq
  left join public.profiles p on p.user_id = uq.user_id
  where uq.assigned_nurse_id = auth.uid()
    and uq.tenant_id = get_current_tenant_id()
    and uq.status in ('claimed', 'answered')
  order by
    case uq.status when 'claimed' then 1 when 'answered' then 2 else 3 end,
    case uq.urgency
      when 'high' then 1
      when 'medium' then 2
      when 'low' then 3
      else 4
    end,
    uq.created_at asc;
$$;

-- nurse_submit_answer: Submit a nurse answer and mark question answered
create or replace function public.nurse_submit_answer(
  p_question_id uuid,
  p_answer_text text,
  p_used_ai_suggestion boolean default false,
  p_ai_suggestion_text text default null,
  p_ai_confidence numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_answer_id uuid;
  v_tenant_id uuid;
begin
  -- Get tenant_id from the question
  select tenant_id into v_tenant_id
  from public.user_questions
  where id = p_question_id
    and assigned_nurse_id = auth.uid();

  if v_tenant_id is null then
    raise exception 'Question not found or not assigned to you';
  end if;

  -- Insert the answer
  insert into public.nurse_question_answers (
    question_id, nurse_id, answer_text, used_ai_suggestion,
    ai_suggestion_text, ai_confidence, tenant_id
  )
  values (
    p_question_id, auth.uid(), p_answer_text, p_used_ai_suggestion,
    p_ai_suggestion_text, p_ai_confidence, v_tenant_id
  )
  returning id into v_answer_id;

  -- Update question status
  update public.user_questions
  set
    status = 'answered',
    response_text = p_answer_text,
    responded_by = auth.uid(),
    responded_at = now(),
    updated_at = now()
  where id = p_question_id;

  return v_answer_id;
end;
$$;

-- nurse_add_note: Add internal nurse note to a question
create or replace function public.nurse_add_note(
  p_question_id uuid,
  p_note_text text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note_id uuid;
  v_tenant_id uuid;
begin
  -- Verify the nurse has access to this question (same tenant)
  select tenant_id into v_tenant_id
  from public.user_questions
  where id = p_question_id
    and tenant_id = get_current_tenant_id();

  if v_tenant_id is null then
    raise exception 'Question not found in your tenant';
  end if;

  -- Insert the note
  insert into public.nurse_question_notes (
    question_id, nurse_id, note_text, tenant_id
  )
  values (
    p_question_id, auth.uid(), p_note_text, v_tenant_id
  )
  returning id into v_note_id;

  -- Update question updated_at
  update public.user_questions
  set nurse_notes = p_note_text, updated_at = now()
  where id = p_question_id;

  return v_note_id;
end;
$$;

-- nurse_escalate_question: Escalate a question to a higher level
create or replace function public.nurse_escalate_question(
  p_question_id uuid,
  p_escalation_level text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_questions
  set
    status = 'escalated',
    escalation_level = p_escalation_level,
    escalated_at = now(),
    updated_at = now()
  where id = p_question_id
    and tenant_id = get_current_tenant_id()
    and assigned_nurse_id = auth.uid();

  if not found then
    raise exception 'Question not found, not in your tenant, or not assigned to you';
  end if;

  -- Log escalation as a note
  insert into public.nurse_question_notes (
    question_id, nurse_id, note_text, tenant_id
  )
  values (
    p_question_id,
    auth.uid(),
    'ESCALATED to ' || p_escalation_level || coalesce(': ' || p_reason, ''),
    get_current_tenant_id()
  );
end;
$$;

commit;
