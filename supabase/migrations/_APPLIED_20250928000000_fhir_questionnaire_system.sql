-- FHIR Questionnaire System Migration
-- Creates tables for storing AI-generated FHIR questionnaires and patient responses
-- Note: This is ADDITIVE to existing risk_assessments, admin_user_questions, and self_reports tables
-- Purpose: Standardized clinical questionnaires (PHQ-9, GAD-7, etc.) vs. custom risk assessments

begin;

-- 1) FHIR_QUESTIONNAIRES: Store generated FHIR questionnaires
create table if not exists public.fhir_questionnaires (
  id bigserial primary key,
  questionnaire_id text unique not null, -- FHIR questionnaire.id
  title text not null,
  description text,
  status text not null check (status in ('draft', 'active', 'retired', 'unknown')) default 'draft',
  version text default '1.0',
  fhir_version text default 'R4',

  -- Store the complete FHIR questionnaire JSON
  questionnaire_json jsonb not null,

  -- Metadata for management
  created_by uuid references auth.users(id) on delete set null,
  created_from_template text, -- e.g., 'PHQ-9', 'Fall Risk Assessment'
  natural_language_prompt text, -- Original AI prompt used

  -- Scoring configuration
  has_scoring boolean default false,
  scoring_algorithm text,
  scoring_rules jsonb, -- Scoring rules array

  -- Usage tracking
  total_responses integer default 0,
  is_template boolean default false, -- Whether this can be used as a template
  tags text[] default '{}', -- For categorization

  -- Deployment status
  deployed_to_wellfit boolean default false,
  deployed_to_ehr boolean default false,
  deployment_config jsonb, -- Store deployment configurations

  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  published_at timestamptz,
  retired_at timestamptz
);

-- 2) QUESTIONNAIRE_RESPONSES: Store patient responses to questionnaires
create table if not exists public.questionnaire_responses (
  id bigserial primary key,
  questionnaire_id bigint references public.fhir_questionnaires(id) on delete cascade not null,
  patient_id uuid references auth.users(id) on delete cascade not null,

  -- FHIR QuestionnaireResponse structure
  response_id text unique not null, -- FHIR questionnaireResponse.id
  status text not null check (status in ('in-progress', 'completed', 'amended', 'entered-in-error', 'stopped')) default 'in-progress',

  -- Store the complete FHIR response JSON
  response_json jsonb not null,

  -- Calculated scores (if questionnaire has scoring)
  total_score numeric,
  subscores jsonb, -- Store multiple scores if applicable
  interpretation text, -- e.g., 'Minimal Depression', 'High Fall Risk'
  risk_level text check (risk_level in ('LOW', 'MODERATE', 'HIGH', 'CRITICAL')),

  -- Metadata
  started_at timestamptz default now() not null,
  completed_at timestamptz,
  submitted_by uuid references auth.users(id) on delete set null, -- Could be different from patient (caregiver, nurse)

  -- Integration tracking
  synced_to_ehr boolean default false,
  ehr_sync_at timestamptz,
  ehr_reference text, -- External system reference

  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 3) QUESTIONNAIRE_TEMPLATES: Pre-built questionnaire templates
create table if not exists public.questionnaire_templates (
  id bigserial primary key,
  name text unique not null,
  description text not null,
  category text not null check (category in ('MENTAL_HEALTH', 'PHYSICAL_HEALTH', 'FUNCTIONAL_ASSESSMENT', 'PAIN_ASSESSMENT', 'MEDICATION_ADHERENCE', 'QUALITY_OF_LIFE', 'SCREENING', 'CUSTOM')),

  -- Template prompt for AI generation
  ai_prompt text not null,

  -- Expected characteristics
  estimated_questions integer,
  estimated_time_minutes integer,
  has_conditional_logic boolean default false,
  has_scoring boolean default false,

  -- Clinical information
  clinical_codes text[], -- LOINC, SNOMED codes associated
  target_population text, -- e.g., 'Adults 65+', 'Diabetes patients'
  evidence_base text, -- Reference to validation studies

  -- Usage tracking
  usage_count integer default 0,
  is_active boolean default true,

  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 4) QUESTIONNAIRE_ANALYTICS: Track questionnaire performance and insights
create table if not exists public.questionnaire_analytics (
  id bigserial primary key,
  questionnaire_id bigint references public.fhir_questionnaires(id) on delete cascade not null,

  -- Time period for analytics
  period_start timestamptz not null,
  period_end timestamptz not null,

  -- Response metrics
  total_responses integer not null default 0,
  completed_responses integer not null default 0,
  completion_rate numeric(5,2), -- Percentage
  average_completion_time_minutes numeric(10,2),

  -- Score distribution (if applicable)
  score_distribution jsonb, -- Histogram of scores
  risk_distribution jsonb, -- Distribution by risk levels

  -- Clinical insights
  trending_responses text[], -- Common response patterns
  flagged_responses integer default 0, -- High-risk responses
  follow_up_required integer default 0,

  -- Data quality
  validation_errors integer default 0,
  incomplete_responses integer default 0,

  generated_at timestamptz default now() not null
);

-- 5) QUESTIONNAIRE_DEPLOYMENTS: Track where questionnaires are deployed
create table if not exists public.questionnaire_deployments (
  id bigserial primary key,
  questionnaire_id bigint references public.fhir_questionnaires(id) on delete cascade not null,

  deployment_type text not null check (deployment_type in ('WELLFIT_DASHBOARD', 'PATIENT_PORTAL', 'EHR_INTEGRATION', 'MOBILE_APP', 'KIOSK', 'SURVEY_LINK')),
  deployment_status text not null check (deployment_status in ('PENDING', 'ACTIVE', 'PAUSED', 'RETIRED')) default 'PENDING',

  -- Configuration
  target_audience text[], -- e.g., ['diabetes_patients', 'seniors']
  frequency_config jsonb, -- How often to administer
  triggers jsonb, -- What triggers the questionnaire

  -- Integration details
  endpoint_url text,
  api_credentials_encrypted text, -- Encrypted credentials for external systems
  mapping_config jsonb, -- Field mappings for external systems

  -- Metrics
  total_administrations integer default 0,
  success_rate numeric(5,2),
  last_sync_at timestamptz,

  deployed_at timestamptz default now() not null,
  deployed_by uuid references auth.users(id) on delete set null,
  retired_at timestamptz,

  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Create indexes for performance
create index if not exists idx_fhir_questionnaires_questionnaire_id on public.fhir_questionnaires (questionnaire_id);
create index if not exists idx_fhir_questionnaires_status on public.fhir_questionnaires (status) where status = 'active';
create index if not exists idx_fhir_questionnaires_tags on public.fhir_questionnaires using gin (tags);
create index if not exists idx_fhir_questionnaires_created_by on public.fhir_questionnaires (created_by);

create index if not exists idx_questionnaire_responses_questionnaire_id on public.questionnaire_responses (questionnaire_id);
create index if not exists idx_questionnaire_responses_patient_id on public.questionnaire_responses (patient_id);
create index if not exists idx_questionnaire_responses_status on public.questionnaire_responses (status);
create index if not exists idx_questionnaire_responses_completed_at on public.questionnaire_responses (completed_at desc);
create index if not exists idx_questionnaire_responses_risk_level on public.questionnaire_responses (risk_level) where risk_level in ('HIGH', 'CRITICAL');

create index if not exists idx_questionnaire_templates_category on public.questionnaire_templates (category);
create index if not exists idx_questionnaire_templates_active on public.questionnaire_templates (is_active) where is_active = true;

create index if not exists idx_questionnaire_analytics_questionnaire_id on public.questionnaire_analytics (questionnaire_id);
create index if not exists idx_questionnaire_analytics_period on public.questionnaire_analytics (period_start, period_end);

create index if not exists idx_questionnaire_deployments_questionnaire_id on public.questionnaire_deployments (questionnaire_id);
create index if not exists idx_questionnaire_deployments_status on public.questionnaire_deployments (deployment_status) where deployment_status = 'ACTIVE';

-- Create updated_at trigger function
create or replace function public.tg_questionnaire_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

-- Add triggers for updated_at timestamps
create trigger trg_fhir_questionnaires_updated_at
before update on public.fhir_questionnaires
for each row execute function public.tg_questionnaire_updated_at();

create trigger trg_questionnaire_responses_updated_at
before update on public.questionnaire_responses
for each row execute function public.tg_questionnaire_updated_at();

create trigger trg_questionnaire_templates_updated_at
before update on public.questionnaire_templates
for each row execute function public.tg_questionnaire_updated_at();

create trigger trg_questionnaire_deployments_updated_at
before update on public.questionnaire_deployments
for each row execute function public.tg_questionnaire_updated_at();

-- Enable RLS on all tables
alter table public.fhir_questionnaires enable row level security;
alter table public.questionnaire_responses enable row level security;
alter table public.questionnaire_templates enable row level security;
alter table public.questionnaire_analytics enable row level security;
alter table public.questionnaire_deployments enable row level security;

-- RLS Policies for FHIR Questionnaires
-- Users can view active questionnaires, admins can manage all
drop policy if exists "fhir_questionnaires_public_read" on public.fhir_questionnaires;
create policy "fhir_questionnaires_public_read"
on public.fhir_questionnaires
for select
using (status in ('active', 'published'));

drop policy if exists "fhir_questionnaires_creator_manage" on public.fhir_questionnaires;
create policy "fhir_questionnaires_creator_manage"
on public.fhir_questionnaires
for all
using (created_by = auth.uid());

drop policy if exists "fhir_questionnaires_admin_all" on public.fhir_questionnaires;
create policy "fhir_questionnaires_admin_all"
on public.fhir_questionnaires
for all
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
    and ur.role in ('admin', 'super_admin')
  )
);

-- RLS Policies for Questionnaire Responses
-- Patients can view their own responses, admins and assigned caregivers can view all
drop policy if exists "questionnaire_responses_patient_own" on public.questionnaire_responses;
create policy "questionnaire_responses_patient_own"
on public.questionnaire_responses
for all
using (patient_id = auth.uid());

drop policy if exists "questionnaire_responses_admin_all" on public.questionnaire_responses;
create policy "questionnaire_responses_admin_all"
on public.questionnaire_responses
for all
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
    and ur.role in ('admin', 'super_admin', 'nurse', 'doctor')
  )
);

-- RLS Policies for Templates (public read, admin manage)
drop policy if exists "questionnaire_templates_public_read" on public.questionnaire_templates;
create policy "questionnaire_templates_public_read"
on public.questionnaire_templates
for select
using (is_active = true);

drop policy if exists "questionnaire_templates_admin_manage" on public.questionnaire_templates;
create policy "questionnaire_templates_admin_manage"
on public.questionnaire_templates
for all
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
    and ur.role in ('admin', 'super_admin')
  )
);

-- RLS Policies for Analytics (admin only)
drop policy if exists "questionnaire_analytics_admin_only" on public.questionnaire_analytics;
create policy "questionnaire_analytics_admin_only"
on public.questionnaire_analytics
for all
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
    and ur.role in ('admin', 'super_admin')
  )
);

-- RLS Policies for Deployments (admin only)
drop policy if exists "questionnaire_deployments_admin_only" on public.questionnaire_deployments;
create policy "questionnaire_deployments_admin_only"
on public.questionnaire_deployments
for all
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
    and ur.role in ('admin', 'super_admin')
  )
);

-- Insert default questionnaire templates
insert into public.questionnaire_templates (name, description, category, ai_prompt, estimated_questions, estimated_time_minutes, has_conditional_logic, has_scoring, clinical_codes, target_population, evidence_base) values
(
  'PHQ-9 Depression Screening',
  'Patient Health Questionnaire-9 for depression screening and severity assessment',
  'MENTAL_HEALTH',
  'Create a PHQ-9 depression screening questionnaire with 9 questions about mood, sleep, energy, appetite, concentration, self-worth, and suicidal ideation. Each question should have 4 options: Not at all (0), Several days (1), More than half the days (2), Nearly every day (3). Include automatic scoring where 0-4 is minimal, 5-9 is mild, 10-14 is moderate, 15-19 is moderately severe, and 20-27 is severe depression.',
  9,
  5,
  false,
  true,
  ARRAY['44249-1', '44250-9', '44251-7'], -- LOINC codes for PHQ-9
  'Adults 18+',
  'Validated by Kroenke et al. (2001)'
),
(
  'Fall Risk Assessment',
  'Comprehensive fall risk assessment for elderly patients',
  'PHYSICAL_HEALTH',
  'Create a fall risk assessment form for seniors with questions about: previous falls, balance problems, mobility aids, medications causing dizziness, vision problems, home safety hazards, fear of falling. Include conditional logic and risk scoring.',
  12,
  8,
  true,
  true,
  ARRAY['72133-2', '72134-0'], -- LOINC codes for fall assessment
  'Adults 65+',
  'Based on Morse Fall Scale and Hendrich II'
),
(
  'Pain Assessment Scale',
  'Comprehensive pain assessment with location, intensity, and quality measures',
  'PAIN_ASSESSMENT',
  'Create a pain assessment form with questions about pain location, intensity (0-10 scale), quality (sharp, dull, burning), triggers, and current treatments. Include conditional questions for patients rating pain above 7.',
  8,
  6,
  true,
  true,
  ARRAY['72514-3', '38208-5'], -- LOINC codes for pain assessment
  'All ages',
  'WHO pain assessment guidelines'
),
(
  'Medication Adherence Assessment',
  'Morisky Medication Adherence Scale for tracking compliance',
  'MEDICATION_ADHERENCE',
  'Create a medication adherence questionnaire asking about: missed doses, reasons for missing medications, side effects experienced, understanding of medication importance, barriers to taking medications. Include a Morisky scale with scoring.',
  8,
  5,
  true,
  true,
  ARRAY['71799-1'], -- LOINC code for medication adherence
  'All patients on medications',
  'Morisky Medication Adherence Scale (MMAS)'
),
(
  'GAD-7 Anxiety Screening',
  'Generalized Anxiety Disorder 7-item scale for anxiety assessment',
  'MENTAL_HEALTH',
  'Create a GAD-7 anxiety screening questionnaire with 7 questions about anxiety symptoms over the past 2 weeks. Each question has 4 options: Not at all (0), Several days (1), More than half the days (2), Nearly every day (3). Include scoring: 0-4 minimal, 5-9 mild, 10-14 moderate, 15-21 severe anxiety.',
  7,
  4,
  false,
  true,
  ARRAY['69737-5'], -- LOINC code for GAD-7
  'Adults 18+',
  'Validated by Spitzer et al. (2006)'
)
on conflict (name) do nothing;

-- Create helper functions

-- Function to calculate questionnaire response scores
create or replace function public.calculate_questionnaire_score(response_json jsonb, scoring_rules jsonb)
returns jsonb language plpgsql as $$
declare
  total_score numeric := 0;
  item jsonb;
  answer jsonb;
  rule jsonb;
  score_result jsonb := '{}';
begin
  -- Basic scoring logic - sum values for simple scales
  for item in select jsonb_array_elements(response_json->'item')
  loop
    for answer in select jsonb_array_elements(item->'answer')
    loop
      if answer ? 'valueInteger' then
        total_score := total_score + (answer->>'valueInteger')::numeric;
      end if;
    end loop;
  end loop;

  score_result := jsonb_build_object('total_score', total_score);

  -- Apply interpretation rules if provided
  if scoring_rules is not null then
    for rule in select jsonb_array_elements(scoring_rules->'rules')
    loop
      -- Simple range-based interpretation
      if (rule->>'condition') like '%score%' then
        score_result := score_result || jsonb_build_object('interpretation', rule->>'interpretation');
        exit; -- Take first matching rule
      end if;
    end loop;
  end if;

  return score_result;
end$$;

-- Function to get questionnaire completion stats
create or replace function public.get_questionnaire_stats(questionnaire_uuid bigint)
returns jsonb language plpgsql as $$
declare
  stats jsonb;
begin
  select jsonb_build_object(
    'total_responses', count(*),
    'completed_responses', count(*) filter (where status = 'completed'),
    'completion_rate', round((count(*) filter (where status = 'completed')::numeric / count(*) * 100), 2),
    'average_score', round(avg(total_score), 2),
    'high_risk_count', count(*) filter (where risk_level in ('HIGH', 'CRITICAL'))
  ) into stats
  from public.questionnaire_responses
  where questionnaire_id = questionnaire_uuid;

  return stats;
end$$;

-- Function to auto-deploy questionnaire to WellFit
create or replace function public.deploy_questionnaire_to_wellfit(questionnaire_uuid bigint)
returns boolean language plpgsql as $$
begin
  -- Update questionnaire as deployed
  update public.fhir_questionnaires
  set deployed_to_wellfit = true,
      deployment_config = jsonb_build_object('deployed_at', now())
  where id = questionnaire_uuid;

  -- Create deployment record
  insert into public.questionnaire_deployments (
    questionnaire_id,
    deployment_type,
    deployment_status,
    deployed_by
  ) values (
    questionnaire_uuid,
    'WELLFIT_DASHBOARD',
    'ACTIVE',
    auth.uid()
  );

  return true;
end$$;

commit;