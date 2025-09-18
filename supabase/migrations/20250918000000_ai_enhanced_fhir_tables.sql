-- AI-Enhanced FHIR Database Migration
-- Creates tables needed for AI analytics, risk assessments, and enhanced FHIR functionality

-- migrate:up
begin;

-- 1) EMERGENCY ALERTS: Store AI-generated emergency alerts
create table if not exists public.emergency_alerts (
  id bigserial primary key,
  patient_id uuid references auth.users(id) on delete cascade not null,
  alert_type text not null check (alert_type in ('VITAL_ANOMALY', 'MISSED_CHECKINS', 'RISK_ESCALATION', 'EMERGENCY_CONTACT')),
  severity text not null check (severity in ('WARNING', 'URGENT', 'CRITICAL')),
  message text not null,
  suggested_actions text[] not null default '{}',
  probability_score integer check (probability_score >= 0 and probability_score <= 100),
  action_required boolean default false not null,
  resolved boolean default false not null,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 2) AI RISK ASSESSMENTS: Store patient risk scores and factors
create table if not exists public.ai_risk_assessments (
  id bigserial primary key,
  patient_id uuid references auth.users(id) on delete cascade not null,
  risk_level text not null check (risk_level in ('LOW', 'MODERATE', 'HIGH', 'CRITICAL')),
  risk_score integer not null check (risk_score >= 0 and risk_score <= 100),
  risk_factors text[] not null default '{}',
  recommendations text[] not null default '{}',
  priority integer not null check (priority >= 1 and priority <= 5),
  trend_direction text not null check (trend_direction in ('IMPROVING', 'STABLE', 'DECLINING')),
  assessed_at timestamptz default now() not null,
  assessment_version text default '1.0' not null
);

-- 3) CARE RECOMMENDATIONS: AI-generated care recommendations
create table if not exists public.care_recommendations (
  id bigserial primary key,
  patient_id uuid references auth.users(id) on delete cascade not null,
  category text not null check (category in ('MEDICATION', 'LIFESTYLE', 'MONITORING', 'FOLLOW_UP', 'INTERVENTION')),
  priority text not null check (priority in ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  recommendation text not null,
  reasoning text not null,
  estimated_impact text,
  timeline text,
  status text default 'PENDING' check (status in ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED')),
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null,
  completed_at timestamptz,
  due_date timestamptz
);

-- 4) VITALS TRENDS: AI analysis of vital sign trends
create table if not exists public.vitals_trends (
  id bigserial primary key,
  patient_id uuid references auth.users(id) on delete cascade not null,
  metric text not null check (metric in ('bp_systolic', 'bp_diastolic', 'heart_rate', 'glucose_mg_dl', 'pulse_oximeter')),
  current_value numeric,
  previous_value numeric,
  trend text not null check (trend in ('RISING', 'FALLING', 'STABLE')),
  change_percent numeric,
  is_abnormal boolean default false not null,
  normal_range_min numeric,
  normal_range_max numeric,
  recommendation text,
  analyzed_at timestamptz default now() not null
);

-- 5) POPULATION INSIGHTS: Store population-level analytics
create table if not exists public.population_insights (
  id bigserial primary key,
  total_patients integer not null,
  active_patients integer not null,
  high_risk_patients integer not null,
  average_health_score numeric(5,2),
  trending_concerns text[] not null default '{}',
  engagement_rate numeric(5,2),
  common_conditions jsonb,
  risk_distribution jsonb,
  generated_at timestamptz default now() not null,
  period_days integer default 30 not null
);

-- 6) PREDICTIVE OUTCOMES: AI predictions for patient outcomes
create table if not exists public.predictive_outcomes (
  id bigserial primary key,
  patient_id uuid references auth.users(id) on delete cascade not null,
  condition text not null,
  probability integer not null check (probability >= 0 and probability <= 100),
  timeframe text not null,
  confidence_level text not null check (confidence_level in ('LOW', 'MEDIUM', 'HIGH')),
  based_on text[] not null default '{}',
  predicted_at timestamptz default now() not null,
  expires_at timestamptz
);

-- 7) FHIR BUNDLES: Store generated FHIR bundles for caching
create table if not exists public.fhir_bundles (
  id bigserial primary key,
  patient_id uuid references auth.users(id) on delete cascade not null,
  bundle_type text not null check (bundle_type in ('patient_export', 'population_summary', 'quality_report')),
  bundle_data jsonb not null,
  validation_status text default 'PENDING' check (validation_status in ('PENDING', 'VALID', 'INVALID')),
  validation_errors text[],
  generated_at timestamptz default now() not null,
  expires_at timestamptz default (now() + interval '24 hours') not null
);

-- 8) AI CONFIGURATION: Store AI model configurations and thresholds
create table if not exists public.ai_configuration (
  id bigserial primary key,
  config_name text unique not null,
  config_data jsonb not null,
  description text,
  is_active boolean default false not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 9) QUALITY METRICS: Track data and clinical quality over time
create table if not exists public.quality_metrics (
  id bigserial primary key,
  metric_type text not null check (metric_type in ('fhir_compliance', 'data_quality', 'clinical_quality')),
  metric_name text not null,
  metric_value numeric(10,4) not null,
  target_value numeric(10,4),
  measurement_date timestamptz default now() not null,
  period_start timestamptz,
  period_end timestamptz,
  details jsonb,
  trend text check (trend in ('IMPROVING', 'STABLE', 'DECLINING'))
);

-- 10) INTERVENTION QUEUE: Track required interventions
create table if not exists public.intervention_queue (
  id bigserial primary key,
  patient_id uuid references auth.users(id) on delete cascade not null,
  intervention_type text not null check (intervention_type in ('CLINICAL', 'MEDICATION', 'LIFESTYLE', 'MONITORING', 'EMERGENCY', 'FOLLOW_UP', 'INTERVENTION')),
  priority integer not null check (priority >= 1 and priority <= 5),
  description text not null,
  estimated_time text,
  expected_outcome text,
  status text default 'PENDING' check (status in ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  assigned_to uuid references auth.users(id) on delete set null,
  due_date timestamptz,
  created_at timestamptz default now() not null,
  completed_at timestamptz
);

-- Add indexes for performance
create index if not exists idx_emergency_alerts_patient_id on public.emergency_alerts (patient_id);
create index if not exists idx_emergency_alerts_severity on public.emergency_alerts (severity) where not resolved;
create index if not exists idx_emergency_alerts_created_at on public.emergency_alerts (created_at desc);

create index if not exists idx_ai_risk_assessments_patient_id on public.ai_risk_assessments (patient_id);
create index if not exists idx_ai_risk_assessments_risk_level on public.ai_risk_assessments (risk_level);
create index if not exists idx_ai_risk_assessments_assessed_at on public.ai_risk_assessments (assessed_at desc);

create index if not exists idx_care_recommendations_patient_id on public.care_recommendations (patient_id);
create index if not exists idx_care_recommendations_priority on public.care_recommendations (priority) where status = 'PENDING';
create index if not exists idx_care_recommendations_assigned_to on public.care_recommendations (assigned_to) where status in ('PENDING', 'IN_PROGRESS');

create index if not exists idx_vitals_trends_patient_id on public.vitals_trends (patient_id);
create index if not exists idx_vitals_trends_metric on public.vitals_trends (metric);
create index if not exists idx_vitals_trends_analyzed_at on public.vitals_trends (analyzed_at desc);

create index if not exists idx_population_insights_generated_at on public.population_insights (generated_at desc);

create index if not exists idx_predictive_outcomes_patient_id on public.predictive_outcomes (patient_id);
create index if not exists idx_predictive_outcomes_condition on public.predictive_outcomes (condition);
create index if not exists idx_predictive_outcomes_probability on public.predictive_outcomes (probability desc);

create index if not exists idx_fhir_bundles_patient_id on public.fhir_bundles (patient_id);
create index if not exists idx_fhir_bundles_type on public.fhir_bundles (bundle_type);
create index if not exists idx_fhir_bundles_expires_at on public.fhir_bundles (expires_at);

create index if not exists idx_quality_metrics_type on public.quality_metrics (metric_type);
create index if not exists idx_quality_metrics_date on public.quality_metrics (measurement_date desc);

create index if not exists idx_intervention_queue_patient_id on public.intervention_queue (patient_id);
create index if not exists idx_intervention_queue_priority on public.intervention_queue (priority desc) where status = 'PENDING';
create index if not exists idx_intervention_queue_assigned_to on public.intervention_queue (assigned_to) where status in ('PENDING', 'IN_PROGRESS');

-- Add triggers for updated_at timestamps
create or replace function public.tg_ai_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists trg_emergency_alerts_updated_at on public.emergency_alerts;
create trigger trg_emergency_alerts_updated_at
before update on public.emergency_alerts
for each row execute function public.tg_ai_updated_at();

drop trigger if exists trg_ai_configuration_updated_at on public.ai_configuration;
create trigger trg_ai_configuration_updated_at
before update on public.ai_configuration
for each row execute function public.tg_ai_updated_at();

-- Enable RLS on all tables
alter table public.emergency_alerts enable row level security;
alter table public.ai_risk_assessments enable row level security;
alter table public.care_recommendations enable row level security;
alter table public.vitals_trends enable row level security;
alter table public.population_insights enable row level security;
alter table public.predictive_outcomes enable row level security;
alter table public.fhir_bundles enable row level security;
alter table public.ai_configuration enable row level security;
alter table public.quality_metrics enable row level security;
alter table public.intervention_queue enable row level security;

-- RLS Policies for Emergency Alerts
drop policy if exists "emergency_alerts_select_own" on public.emergency_alerts;
create policy "emergency_alerts_select_own"
on public.emergency_alerts
for select
using (patient_id = auth.uid());

drop policy if exists "emergency_alerts_admin_all" on public.emergency_alerts;
create policy "emergency_alerts_admin_all"
on public.emergency_alerts
for all
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
    and ur.role in ('admin', 'super_admin')
  )
);

-- RLS Policies for AI Risk Assessments
drop policy if exists "ai_risk_assessments_select_own" on public.ai_risk_assessments;
create policy "ai_risk_assessments_select_own"
on public.ai_risk_assessments
for select
using (patient_id = auth.uid());

drop policy if exists "ai_risk_assessments_admin_all" on public.ai_risk_assessments;
create policy "ai_risk_assessments_admin_all"
on public.ai_risk_assessments
for all
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
    and ur.role in ('admin', 'super_admin')
  )
);

-- RLS Policies for Care Recommendations
drop policy if exists "care_recommendations_select_own" on public.care_recommendations;
create policy "care_recommendations_select_own"
on public.care_recommendations
for select
using (patient_id = auth.uid() or assigned_to = auth.uid());

drop policy if exists "care_recommendations_admin_all" on public.care_recommendations;
create policy "care_recommendations_admin_all"
on public.care_recommendations
for all
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
    and ur.role in ('admin', 'super_admin')
  )
);

-- RLS Policies for Vitals Trends
drop policy if exists "vitals_trends_select_own" on public.vitals_trends;
create policy "vitals_trends_select_own"
on public.vitals_trends
for select
using (patient_id = auth.uid());

drop policy if exists "vitals_trends_admin_all" on public.vitals_trends;
create policy "vitals_trends_admin_all"
on public.vitals_trends
for all
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
    and ur.role in ('admin', 'super_admin')
  )
);

-- RLS Policies for Population Insights (Admin only)
drop policy if exists "population_insights_admin_only" on public.population_insights;
create policy "population_insights_admin_only"
on public.population_insights
for all
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
    and ur.role in ('admin', 'super_admin')
  )
);

-- RLS Policies for Predictive Outcomes
drop policy if exists "predictive_outcomes_select_own" on public.predictive_outcomes;
create policy "predictive_outcomes_select_own"
on public.predictive_outcomes
for select
using (patient_id = auth.uid());

drop policy if exists "predictive_outcomes_admin_all" on public.predictive_outcomes;
create policy "predictive_outcomes_admin_all"
on public.predictive_outcomes
for all
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
    and ur.role in ('admin', 'super_admin')
  )
);

-- RLS Policies for FHIR Bundles
drop policy if exists "fhir_bundles_select_own" on public.fhir_bundles;
create policy "fhir_bundles_select_own"
on public.fhir_bundles
for select
using (patient_id = auth.uid());

drop policy if exists "fhir_bundles_admin_all" on public.fhir_bundles;
create policy "fhir_bundles_admin_all"
on public.fhir_bundles
for all
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
    and ur.role in ('admin', 'super_admin')
  )
);

-- RLS Policies for AI Configuration (Super Admin only)
drop policy if exists "ai_configuration_super_admin_only" on public.ai_configuration;
create policy "ai_configuration_super_admin_only"
on public.ai_configuration
for all
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
    and ur.role = 'super_admin'
  )
);

-- RLS Policies for Quality Metrics (Admin only)
drop policy if exists "quality_metrics_admin_only" on public.quality_metrics;
create policy "quality_metrics_admin_only"
on public.quality_metrics
for all
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
    and ur.role in ('admin', 'super_admin')
  )
);

-- RLS Policies for Intervention Queue
drop policy if exists "intervention_queue_select_related" on public.intervention_queue;
create policy "intervention_queue_select_related"
on public.intervention_queue
for select
using (patient_id = auth.uid() or assigned_to = auth.uid());

drop policy if exists "intervention_queue_admin_all" on public.intervention_queue;
create policy "intervention_queue_admin_all"
on public.intervention_queue
for all
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
    and ur.role in ('admin', 'super_admin')
  )
);

-- Insert default AI configuration
insert into public.ai_configuration (config_name, config_data, description, is_active)
values (
  'default_risk_thresholds',
  '{
    "riskThresholds": {
      "bloodPressure": {
        "systolic": {"high": 140, "critical": 180},
        "diastolic": {"high": 90, "critical": 120}
      },
      "heartRate": {"low": 50, "high": 100, "critical": 120},
      "glucose": {"low": 70, "high": 180, "critical": 250},
      "oxygenSaturation": {"low": 95, "critical": 88}
    },
    "adherenceSettings": {
      "missedCheckInThreshold": 3,
      "lowAdherenceThreshold": 60
    },
    "alertSettings": {
      "enablePredictiveAlerts": true,
      "alertCooldownPeriod": 4,
      "emergencyContactThreshold": 1
    }
  }',
  'Default AI risk assessment thresholds and settings',
  true
) on conflict (config_name) do nothing;

-- Create function to clean up expired FHIR bundles
create or replace function public.cleanup_expired_fhir_bundles()
returns void language plpgsql as $$
begin
  delete from public.fhir_bundles where expires_at < now();
end$$;

-- Create function to get latest risk assessment for a patient
create or replace function public.get_latest_risk_assessment(patient_uuid uuid)
returns public.ai_risk_assessments language plpgsql as $$
declare
  result public.ai_risk_assessments;
begin
  select * into result
  from public.ai_risk_assessments
  where patient_id = patient_uuid
  order by assessed_at desc
  limit 1;

  return result;
end$$;

-- Create function to get active emergency alerts
create or replace function public.get_active_emergency_alerts()
returns setof public.emergency_alerts language plpgsql as $$
begin
  return query
  select *
  from public.emergency_alerts
  where not resolved
  and severity in ('URGENT', 'CRITICAL')
  order by created_at desc;
end$$;

commit;

-- migrate:down
begin;

-- Drop functions
drop function if exists public.cleanup_expired_fhir_bundles();
drop function if exists public.get_latest_risk_assessment(uuid);
drop function if exists public.get_active_emergency_alerts();

-- Drop tables in reverse order
drop table if exists public.intervention_queue cascade;
drop table if exists public.quality_metrics cascade;
drop table if exists public.ai_configuration cascade;
drop table if exists public.fhir_bundles cascade;
drop table if exists public.predictive_outcomes cascade;
drop table if exists public.population_insights cascade;
drop table if exists public.vitals_trends cascade;
drop table if exists public.care_recommendations cascade;
drop table if exists public.ai_risk_assessments cascade;
drop table if exists public.emergency_alerts cascade;

-- Drop trigger function
drop function if exists public.tg_ai_updated_at();

commit;