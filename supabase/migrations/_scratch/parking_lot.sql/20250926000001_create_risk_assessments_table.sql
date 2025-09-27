-- Migration: Create risk assessments table for healthcare professional assessments
-- This table stores risk assessments conducted by nurses/admins/healthcare workers

-- migrate:up
begin;

-- Create risk assessments table
create table if not exists public.risk_assessments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references auth.users(id) on delete cascade not null,
  assessor_id uuid references auth.users(id) on delete cascade not null,

  -- Risk Assessment Data
  risk_level text not null check (risk_level in ('LOW', 'MODERATE', 'HIGH', 'CRITICAL')),
  priority text not null check (priority in ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),

  -- Assessment Categories
  medical_risk_score integer check (medical_risk_score >= 1 and medical_risk_score <= 10),
  mobility_risk_score integer check (mobility_risk_score >= 1 and mobility_risk_score <= 10),
  cognitive_risk_score integer check (cognitive_risk_score >= 1 and cognitive_risk_score <= 10),
  social_risk_score integer check (social_risk_score >= 1 and social_risk_score <= 10),

  -- Overall Assessment
  overall_score decimal(3,1) check (overall_score >= 1.0 and overall_score <= 10.0),

  -- Clinical Notes
  assessment_notes text,
  risk_factors text[], -- Array of identified risk factors
  recommended_actions text[], -- Array of recommended interventions

  -- Follow-up Information
  next_assessment_due date,
  review_frequency text check (review_frequency in ('weekly', 'biweekly', 'monthly', 'quarterly')),

  -- Metadata
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  -- Assessment validity period
  valid_until timestamptz default (now() + interval '30 days') not null
);

-- Create indexes for better query performance
create index if not exists idx_risk_assessments_patient_id on public.risk_assessments (patient_id);
create index if not exists idx_risk_assessments_assessor_id on public.risk_assessments (assessor_id);
create index if not exists idx_risk_assessments_created_at on public.risk_assessments (created_at desc);
create index if not exists idx_risk_assessments_risk_level on public.risk_assessments (risk_level);
create index if not exists idx_risk_assessments_valid_until on public.risk_assessments (valid_until);

-- Add updated_at trigger
create or replace function public.tg_risk_assessments_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

drop trigger if exists trg_risk_assessments_updated_at on public.risk_assessments;
create trigger trg_risk_assessments_updated_at
  before update on public.risk_assessments
  for each row execute function public.tg_risk_assessments_updated_at();

-- Enable RLS
alter table public.risk_assessments enable row level security;

-- RLS Policies
-- Patients can view their own assessments
create policy "risk_assessments_select_own"
  on public.risk_assessments
  for select
  using (auth.uid() = patient_id);

-- Healthcare staff can view all assessments
create policy "risk_assessments_healthcare_select_all"
  on public.risk_assessments
  for select
  to authenticated
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
      and ur.role in ('admin', 'super_admin', 'nurse', 'healthcare_worker')
    )
  );

-- Healthcare staff can insert assessments
create policy "risk_assessments_healthcare_insert"
  on public.risk_assessments
  for insert
  to authenticated
  with check (
    auth.uid() = assessor_id and
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
      and ur.role in ('admin', 'super_admin', 'nurse', 'healthcare_worker')
    )
  );

-- Healthcare staff can update assessments they created
create policy "risk_assessments_healthcare_update_own"
  on public.risk_assessments
  for update
  to authenticated
  using (
    auth.uid() = assessor_id and
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
      and ur.role in ('admin', 'super_admin', 'nurse', 'healthcare_worker')
    )
  );

commit;