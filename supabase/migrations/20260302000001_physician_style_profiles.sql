-- Physician Style Profiles — Learned documentation patterns per provider
-- Part of Compass Riley Ambient Learning Session 2: Clinical Style Profiler

CREATE TABLE IF NOT EXISTS public.physician_style_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id),

  -- Measured verbosity preference (not manual setting)
  preferred_verbosity text NOT NULL DEFAULT 'moderate'
    CHECK (preferred_verbosity IN ('terse', 'moderate', 'verbose')),
  verbosity_score numeric NOT NULL DEFAULT 0,

  -- Section emphasis map — per-section expansion/condensation tendency (-1 to +1)
  section_emphasis jsonb NOT NULL DEFAULT '{
    "subjective": 0, "objective": 0, "assessment": 0,
    "plan": 0, "hpi": 0, "ros": 0
  }'::jsonb,

  -- Terminology overrides — AI term to physician preferred term
  terminology_overrides jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Aggregate metrics
  avg_note_word_count numeric NOT NULL DEFAULT 0,
  avg_edit_time_seconds numeric NOT NULL DEFAULT 0,
  specialty_detected text,

  -- Tracking
  sessions_analyzed integer NOT NULL DEFAULT 0,
  last_analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_provider_style UNIQUE (provider_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_physician_style_profiles_provider
  ON public.physician_style_profiles(provider_id);
CREATE INDEX IF NOT EXISTS idx_physician_style_profiles_tenant
  ON public.physician_style_profiles(tenant_id);

-- RLS
ALTER TABLE public.physician_style_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "providers_read_own_style_profile"
  ON public.physician_style_profiles FOR SELECT
  USING (provider_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "providers_write_own_style_profile"
  ON public.physician_style_profiles FOR INSERT
  WITH CHECK (provider_id = auth.uid());

CREATE POLICY "providers_update_own_style_profile"
  ON public.physician_style_profiles FOR UPDATE
  USING (provider_id = auth.uid())
  WITH CHECK (provider_id = auth.uid());

CREATE POLICY "service_role_full_access_style_profiles"
  ON public.physician_style_profiles FOR ALL
  USING (auth.role() = 'service_role');
