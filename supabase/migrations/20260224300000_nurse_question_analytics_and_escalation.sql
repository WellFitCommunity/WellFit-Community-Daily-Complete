-- ============================================================================
-- Nurse Question System — Analytics View & Auto-Escalation Support
-- ============================================================================
-- Creates:
--   1. v_nurse_question_analytics — aggregated metrics view
--   2. nurse_question_metrics() — RPC for dashboard stats
--   3. Index support for auto-escalation queries
-- ============================================================================

begin;

-- ============================================================================
-- PART 1: Analytics View — aggregated question metrics by tenant
-- ============================================================================

create or replace view public.v_nurse_question_analytics as
select
  uq.tenant_id,
  count(*) as total_questions,
  count(*) filter (where uq.status = 'pending') as pending_count,
  count(*) filter (where uq.status = 'claimed') as claimed_count,
  count(*) filter (where uq.status = 'answered') as answered_count,
  count(*) filter (where uq.status = 'escalated') as escalated_count,
  count(*) filter (where uq.status = 'closed') as closed_count,

  -- Urgency breakdown
  count(*) filter (where uq.urgency = 'high') as high_urgency_count,
  count(*) filter (where uq.urgency = 'medium') as medium_urgency_count,
  count(*) filter (where uq.urgency = 'low') as low_urgency_count,

  -- Category breakdown
  count(*) filter (where uq.category = 'medication') as medication_category,
  count(*) filter (where uq.category = 'symptoms') as symptoms_category,
  count(*) filter (where uq.category = 'appointment') as appointment_category,
  count(*) filter (where uq.category = 'general') as general_category,

  -- Response time metrics (only for answered questions)
  round(avg(
    extract(epoch from (uq.responded_at - uq.created_at)) / 3600.0
  ) filter (where uq.status = 'answered' and uq.responded_at is not null)::numeric, 2) as avg_response_hours,

  round((
    percentile_cont(0.5) within group (
      order by extract(epoch from (uq.responded_at - uq.created_at)) / 3600.0
    )
  )::numeric, 2) as median_response_hours,

  -- AI suggestion acceptance rate
  count(*) filter (
    where exists (
      select 1 from public.nurse_question_answers nqa
      where nqa.question_id = uq.id and nqa.used_ai_suggestion = true
    )
  ) as ai_suggestions_accepted,

  count(*) filter (
    where exists (
      select 1 from public.nurse_question_answers nqa
      where nqa.question_id = uq.id
    )
  ) as total_answered_with_records,

  -- Escalation stats
  count(*) filter (where uq.escalation_level = 'charge_nurse') as escalated_to_charge_nurse,
  count(*) filter (where uq.escalation_level = 'supervisor') as escalated_to_supervisor,
  count(*) filter (where uq.escalation_level = 'physician') as escalated_to_physician,

  -- Time-based
  count(*) filter (
    where uq.created_at >= now() - interval '24 hours'
  ) as questions_last_24h,
  count(*) filter (
    where uq.created_at >= now() - interval '7 days'
  ) as questions_last_7d

from public.user_questions uq
where uq.tenant_id is not null
group by uq.tenant_id;

comment on view public.v_nurse_question_analytics is
  'Aggregated nurse question metrics by tenant — response times, AI acceptance, escalation rates';

-- ============================================================================
-- PART 2: RPC — nurse_question_metrics() for current tenant
-- ============================================================================

drop function if exists public.nurse_question_metrics();

create or replace function public.nurse_question_metrics()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_result json;
begin
  v_tenant_id := get_current_tenant_id();

  select json_build_object(
    'total_questions', coalesce(total_questions, 0),
    'pending_count', coalesce(pending_count, 0),
    'claimed_count', coalesce(claimed_count, 0),
    'answered_count', coalesce(answered_count, 0),
    'escalated_count', coalesce(escalated_count, 0),
    'high_urgency_count', coalesce(high_urgency_count, 0),
    'medium_urgency_count', coalesce(medium_urgency_count, 0),
    'low_urgency_count', coalesce(low_urgency_count, 0),
    'avg_response_hours', coalesce(avg_response_hours, 0),
    'median_response_hours', coalesce(median_response_hours, 0),
    'ai_acceptance_rate', case
      when coalesce(total_answered_with_records, 0) = 0 then 0
      else round((coalesce(ai_suggestions_accepted, 0)::numeric / total_answered_with_records) * 100, 1)
    end,
    'ai_suggestions_accepted', coalesce(ai_suggestions_accepted, 0),
    'total_answered_with_records', coalesce(total_answered_with_records, 0),
    'escalated_to_charge_nurse', coalesce(escalated_to_charge_nurse, 0),
    'escalated_to_supervisor', coalesce(escalated_to_supervisor, 0),
    'escalated_to_physician', coalesce(escalated_to_physician, 0),
    'questions_last_24h', coalesce(questions_last_24h, 0),
    'questions_last_7d', coalesce(questions_last_7d, 0)
  )
  into v_result
  from public.v_nurse_question_analytics
  where tenant_id = v_tenant_id;

  -- If no data exists for this tenant, return zeroed metrics
  if v_result is null then
    v_result := json_build_object(
      'total_questions', 0,
      'pending_count', 0,
      'claimed_count', 0,
      'answered_count', 0,
      'escalated_count', 0,
      'high_urgency_count', 0,
      'medium_urgency_count', 0,
      'low_urgency_count', 0,
      'avg_response_hours', 0,
      'median_response_hours', 0,
      'ai_acceptance_rate', 0,
      'ai_suggestions_accepted', 0,
      'total_answered_with_records', 0,
      'escalated_to_charge_nurse', 0,
      'escalated_to_supervisor', 0,
      'escalated_to_physician', 0,
      'questions_last_24h', 0,
      'questions_last_7d', 0
    );
  end if;

  return v_result;
end;
$$;

-- ============================================================================
-- PART 3: Indexes for auto-escalation queries
-- ============================================================================

-- Unclaimed questions by creation time (for >2hr threshold)
create index if not exists idx_user_questions_pending_created
  on public.user_questions(created_at)
  where status = 'pending' and assigned_nurse_id is null;

-- Claimed questions by claimed_at (for >4hr threshold)
create index if not exists idx_user_questions_claimed_at
  on public.user_questions(claimed_at)
  where status = 'claimed' and assigned_nurse_id is not null;

-- Escalation level index for quick lookup
create index if not exists idx_user_questions_escalation_level
  on public.user_questions(escalation_level)
  where escalation_level is not null;

commit;
