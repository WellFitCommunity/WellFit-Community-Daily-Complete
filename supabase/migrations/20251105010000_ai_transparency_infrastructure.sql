-- =====================================================
-- AI TRANSPARENCY INFRASTRUCTURE
-- Created: 2025-11-05
-- Purpose: Track AI learning progress, confidence scores, and personalization
-- =====================================================

-- =====================================================
-- 1. VOICE PROFILE MATURITY TRACKING (Riley Learning Progress)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.voice_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Learning Metrics
    total_sessions INTEGER DEFAULT 0,
    total_corrections INTEGER DEFAULT 0,
    total_transcription_time_seconds INTEGER DEFAULT 0,

    -- Maturity Scoring (0-100%)
    maturity_score INTEGER DEFAULT 0 CHECK (maturity_score >= 0 AND maturity_score <= 100),
    accent_adaptation_score INTEGER DEFAULT 0 CHECK (accent_adaptation_score >= 0 AND accent_adaptation_score <= 100),
    terminology_adaptation_score INTEGER DEFAULT 0 CHECK (terminology_adaptation_score >= 0 AND terminology_adaptation_score <= 100),
    workflow_adaptation_score INTEGER DEFAULT 0 CHECK (workflow_adaptation_score >= 0 AND workflow_adaptation_score <= 100),

    -- Learned Patterns (JSONB for flexibility)
    learned_phrases JSONB DEFAULT '[]'::jsonb,
    learned_terminology JSONB DEFAULT '[]'::jsonb,
    common_corrections JSONB DEFAULT '[]'::jsonb,

    -- Status
    status TEXT DEFAULT 'training' CHECK (status IN ('training', 'maturing', 'fully_adapted')),
    fully_adapted_at TIMESTAMPTZ,

    -- Milestones
    milestones_achieved JSONB DEFAULT '[]'::jsonb,
    last_milestone_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_voice_profiles_user_id ON public.voice_profiles(user_id);
CREATE INDEX idx_voice_profiles_status ON public.voice_profiles(status);
CREATE INDEX idx_voice_profiles_maturity_score ON public.voice_profiles(maturity_score);

-- RLS Policies
ALTER TABLE public.voice_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own voice profile"
    ON public.voice_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "System can manage voice profiles"
    ON public.voice_profiles FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'system')
        )
    );

-- =====================================================
-- 2. AI CONFIDENCE SCORES (Billing Codes, Clinical Suggestions)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ai_confidence_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Context
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    patient_id UUID,  -- Patient profile ID (no FK constraint to avoid circular dependencies)
    encounter_id UUID,  -- Reference to encounter/visit

    -- AI Suggestion Details
    suggestion_type TEXT NOT NULL CHECK (suggestion_type IN (
        'billing_code_icd10',
        'billing_code_cpt',
        'billing_code_hcpcs',
        'soap_note',
        'clinical_recommendation',
        'drug_interaction',
        'risk_assessment'
    )),
    suggested_value TEXT NOT NULL,
    confidence_score NUMERIC(5,2) CHECK (confidence_score >= 0 AND confidence_score <= 100),

    -- Confidence Level (computed at insert time)
    confidence_level TEXT CHECK (confidence_level IN ('high', 'medium', 'low')),

    -- AI Model Info
    model_used TEXT NOT NULL,
    processing_time_ms INTEGER,

    -- Provider Validation
    provider_validated BOOLEAN DEFAULT false,
    provider_accepted BOOLEAN,
    provider_modified_to TEXT,
    validated_at TIMESTAMPTZ,

    -- Reasoning (for "Explain" button)
    reasoning_explanation TEXT,
    supporting_evidence JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ai_confidence_user_id ON public.ai_confidence_scores(user_id);
CREATE INDEX idx_ai_confidence_patient_id ON public.ai_confidence_scores(patient_id);
CREATE INDEX idx_ai_confidence_type ON public.ai_confidence_scores(suggestion_type);
CREATE INDEX idx_ai_confidence_level ON public.ai_confidence_scores(confidence_level);
CREATE INDEX idx_ai_confidence_created_at ON public.ai_confidence_scores(created_at DESC);

-- RLS Policies
ALTER TABLE public.ai_confidence_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Providers can view own suggestions"
    ON public.ai_confidence_scores FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Providers can update own suggestions"
    ON public.ai_confidence_scores FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "System can insert suggestions"
    ON public.ai_confidence_scores FOR INSERT
    WITH CHECK (true);

-- =====================================================
-- 3. DASHBOARD PERSONALIZATION TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS public.dashboard_personalization_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Event Details
    section_name TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('viewed', 'expanded', 'collapsed', 'reordered')),

    -- Context (computed at insert time via trigger or application)
    time_of_day TEXT,  -- 'morning', 'afternoon', 'evening', 'night'
    day_of_week INTEGER,  -- 0-6 (Sunday-Saturday)

    -- Position
    section_position INTEGER,

    -- Session
    session_id UUID,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_dashboard_events_user_id ON public.dashboard_personalization_events(user_id);
CREATE INDEX idx_dashboard_events_section ON public.dashboard_personalization_events(section_name);
CREATE INDEX idx_dashboard_events_action ON public.dashboard_personalization_events(action_type);
CREATE INDEX idx_dashboard_events_time ON public.dashboard_personalization_events(created_at DESC);

-- RLS Policies
ALTER TABLE public.dashboard_personalization_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own events"
    ON public.dashboard_personalization_events FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "System can insert events"
    ON public.dashboard_personalization_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 4. PERSONALIZED GREETINGS & MOTIVATIONAL QUOTES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.motivational_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Quote Details
    quote_text TEXT NOT NULL,
    author TEXT NOT NULL,

    -- Targeting
    role_specific TEXT[] DEFAULT ARRAY['all'],  -- ['all', 'physician', 'nurse', 'admin', etc.]
    specialty_specific TEXT[],  -- ['cardiology', 'neurology', etc.]

    -- Categorization
    theme TEXT CHECK (theme IN ('compassion', 'excellence', 'perseverance', 'innovation', 'healing', 'teamwork', 'leadership')),

    -- Active Status
    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_quotes_active ON public.motivational_quotes(is_active);
CREATE INDEX idx_quotes_theme ON public.motivational_quotes(theme);

-- RLS Policies
ALTER TABLE public.motivational_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active quotes"
    ON public.motivational_quotes FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins can manage quotes"
    ON public.motivational_quotes FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin')
        )
    );

-- =====================================================
-- 5. USER GREETING PREFERENCES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.user_greeting_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Preferences
    show_greeting BOOLEAN DEFAULT true,
    show_quote BOOLEAN DEFAULT true,
    preferred_name TEXT,  -- If different from profile name

    -- Quote History (to avoid repeats)
    last_shown_quote_ids UUID[] DEFAULT ARRAY[]::UUID[],
    quotes_shown_count INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_greeting_prefs_user_id ON public.user_greeting_preferences(user_id);

-- RLS Policies
ALTER TABLE public.user_greeting_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
    ON public.user_greeting_preferences FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
    ON public.user_greeting_preferences FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "System can insert preferences"
    ON public.user_greeting_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 6. AI LEARNING MILESTONES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ai_learning_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Milestone Details
    milestone_type TEXT NOT NULL CHECK (milestone_type IN (
        'voice_profile_10_sessions',
        'voice_profile_50_sessions',
        'voice_profile_fully_adapted',
        'dashboard_personalized',
        'first_confidence_validation',
        'high_accuracy_week',
        'billing_optimization_milestone'
    )),
    milestone_title TEXT NOT NULL,
    milestone_description TEXT,

    -- Achievement
    achieved_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMPTZ,

    -- Reward/Badge
    badge_icon TEXT,
    celebration_type TEXT DEFAULT 'toast' CHECK (celebration_type IN ('toast', 'modal', 'confetti', 'badge')),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_milestones_user_id ON public.ai_learning_milestones(user_id);
CREATE INDEX idx_milestones_type ON public.ai_learning_milestones(milestone_type);
CREATE INDEX idx_milestones_achieved_at ON public.ai_learning_milestones(achieved_at DESC);
CREATE INDEX idx_milestones_acknowledged ON public.ai_learning_milestones(acknowledged);

-- RLS Policies
ALTER TABLE public.ai_learning_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own milestones"
    ON public.ai_learning_milestones FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can acknowledge own milestones"
    ON public.ai_learning_milestones FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can insert milestones"
    ON public.ai_learning_milestones FOR INSERT
    WITH CHECK (true);

-- =====================================================
-- 7. SEED DATA - MOTIVATIONAL QUOTES
-- =====================================================

INSERT INTO public.motivational_quotes (quote_text, author, role_specific, theme) VALUES
    ('The art of medicine consists of amusing the patient while nature cures the disease.', 'Voltaire', ARRAY['physician', 'nurse'], 'healing'),
    ('Wherever the art of medicine is loved, there is also a love of humanity.', 'Hippocrates', ARRAY['all'], 'compassion'),
    ('The good physician treats the disease; the great physician treats the patient who has the disease.', 'William Osler', ARRAY['physician', 'pa', 'np'], 'excellence'),
    ('To cure sometimes, to relieve often, to comfort always.', 'Hippocrates', ARRAY['all'], 'compassion'),
    ('The best way to find yourself is to lose yourself in the service of others.', 'Mahatma Gandhi', ARRAY['all'], 'compassion'),
    ('Medicine is a science of uncertainty and an art of probability.', 'William Osler', ARRAY['physician'], 'excellence'),
    ('Nursing is an art: and if it is to be made an art, it requires an exclusive devotion as hard a preparation as any painter''s or sculptor''s work.', 'Florence Nightingale', ARRAY['nurse'], 'excellence'),
    ('Healthcare is not about treating disease, it''s about caring for people.', 'Unknown', ARRAY['all'], 'compassion'),
    ('Excellence is not a skill, it''s an attitude.', 'Ralph Marston', ARRAY['all'], 'excellence'),
    ('Alone we can do so little; together we can do so much.', 'Helen Keller', ARRAY['all'], 'teamwork'),
    ('The secret of getting ahead is getting started.', 'Mark Twain', ARRAY['all'], 'perseverance'),
    ('Innovation distinguishes between a leader and a follower.', 'Steve Jobs', ARRAY['admin', 'super_admin'], 'innovation'),
    ('Healing is a matter of time, but it is sometimes also a matter of opportunity.', 'Hippocrates', ARRAY['all'], 'healing'),
    ('The greatest wealth is health.', 'Virgil', ARRAY['all'], 'healing'),
    ('Believe you can and you''re halfway there.', 'Theodore Roosevelt', ARRAY['all'], 'perseverance')
ON CONFLICT DO NOTHING;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT, INSERT, UPDATE ON public.voice_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ai_confidence_scores TO authenticated;
GRANT SELECT, INSERT ON public.dashboard_personalization_events TO authenticated;
GRANT SELECT ON public.motivational_quotes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_greeting_preferences TO authenticated;
GRANT SELECT, UPDATE ON public.ai_learning_milestones TO authenticated;
GRANT INSERT ON public.ai_learning_milestones TO service_role;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE public.voice_profiles IS 'Tracks Riley voice profile learning progress for each provider';
COMMENT ON TABLE public.ai_confidence_scores IS 'Stores confidence scores for all AI suggestions (billing codes, clinical recommendations)';
COMMENT ON TABLE public.dashboard_personalization_events IS 'Logs user interactions with dashboard sections for personalization learning';
COMMENT ON TABLE public.motivational_quotes IS 'Database of motivational quotes for personalized greetings';
COMMENT ON TABLE public.user_greeting_preferences IS 'User preferences for greeting display and quote history';
COMMENT ON TABLE public.ai_learning_milestones IS 'Tracks AI learning achievements and milestones for celebration';
