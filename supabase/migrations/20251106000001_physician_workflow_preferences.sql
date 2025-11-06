-- =====================================================
-- PHYSICIAN WORKFLOW PREFERENCES & COGNITIVE LOAD REDUCTION
-- Purpose: Track workflow modes, section order, and usage patterns
-- Reduces cognitive overload with personalized dashboard
-- =====================================================

-- Create physician workflow preferences table
CREATE TABLE IF NOT EXISTS public.physician_workflow_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Workflow mode preferences
    preferred_mode TEXT DEFAULT 'all' CHECK (preferred_mode IN ('all', 'clinical', 'administrative', 'wellness', 'security', 'it')),
    last_clinical_mode TIMESTAMPTZ,
    last_admin_mode TIMESTAMPTZ,
    last_wellness_mode TIMESTAMPTZ,
    last_security_mode TIMESTAMPTZ,
    last_it_mode TIMESTAMPTZ,

    -- Section ordering and pinning
    section_order TEXT[], -- Array of section IDs in custom order
    pinned_sections TEXT[], -- Array of pinned section IDs
    collapsed_sections TEXT[], -- Array of collapsed section IDs

    -- Command palette history
    recent_commands TEXT[], -- Array of recent command IDs
    favorite_commands TEXT[], -- Array of favorited command IDs
    command_usage_count JSONB DEFAULT '{}', -- {"command_id": count}

    -- Section usage tracking for smart ordering
    section_views JSONB DEFAULT '{}', -- {"section_id": view_count}
    section_last_accessed JSONB DEFAULT '{}', -- {"section_id": timestamp}

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure one preferences row per user
    UNIQUE(user_id)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_physician_workflow_prefs_user
    ON public.physician_workflow_preferences(user_id);

-- Create section interaction tracking table
CREATE TABLE IF NOT EXISTS public.physician_section_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    section_id TEXT NOT NULL,
    interaction_type TEXT NOT NULL CHECK (interaction_type IN ('view', 'expand', 'collapse', 'pin', 'unpin')),
    workflow_mode TEXT CHECK (workflow_mode IN ('all', 'clinical', 'administrative', 'wellness', 'security', 'it')),

    duration_seconds INTEGER, -- How long section was viewed
    timestamp TIMESTAMPTZ DEFAULT NOW(),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for analytics
CREATE INDEX IF NOT EXISTS idx_section_interactions_user_section
    ON public.physician_section_interactions(user_id, section_id);

CREATE INDEX IF NOT EXISTS idx_section_interactions_timestamp
    ON public.physician_section_interactions(timestamp DESC);

-- =====================================================
-- SMART SECTION ORDERING FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_smart_section_order(target_user_id UUID, mode TEXT DEFAULT 'all')
RETURNS TABLE (
    section_id TEXT,
    score INTEGER,
    reason TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH section_stats AS (
        SELECT
            si.section_id,
            COUNT(*) as view_count,
            MAX(si.timestamp) as last_viewed,
            AVG(si.duration_seconds) as avg_duration
        FROM public.physician_section_interactions si
        WHERE si.user_id = target_user_id
            AND si.interaction_type = 'view'
            AND (mode = 'all' OR si.workflow_mode = mode OR si.workflow_mode IS NULL)
            AND si.timestamp >= NOW() - INTERVAL '30 days'
        GROUP BY si.section_id
    ),
    scored_sections AS (
        SELECT
            ss.section_id,
            -- Scoring algorithm: recency (40 points) + frequency (30 points) + duration (30 points)
            CAST(
                -- Recency score (0-40)
                (40 * EXTRACT(EPOCH FROM (NOW() - ss.last_viewed)) / (30 * 24 * 3600)) +
                -- Frequency score (0-30)
                (30 * LEAST(ss.view_count / 10.0, 1.0)) +
                -- Duration score (0-30)
                (30 * LEAST(ss.avg_duration / 300.0, 1.0))
            AS INTEGER) as section_score,
            CASE
                WHEN ss.view_count > 10 AND EXTRACT(EPOCH FROM (NOW() - ss.last_viewed)) < 3600 THEN 'Frequently used, recently accessed'
                WHEN ss.view_count > 10 THEN 'Frequently used'
                WHEN EXTRACT(EPOCH FROM (NOW() - ss.last_viewed)) < 3600 THEN 'Recently accessed'
                WHEN ss.avg_duration > 180 THEN 'High engagement'
                ELSE 'Normal usage'
            END as usage_reason
        FROM section_stats ss
    )
    SELECT
        scored_sections.section_id,
        scored_sections.section_score as score,
        scored_sections.usage_reason as reason
    FROM scored_sections
    ORDER BY section_score DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMAND PALETTE ANALYTICS FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_command_usage_stats(target_user_id UUID)
RETURNS TABLE (
    command_id TEXT,
    usage_count BIGINT,
    last_used TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        command_id::TEXT,
        (command_count->>'count')::BIGINT as usage_count,
        (command_count->>'last_used')::TIMESTAMPTZ as last_used
    FROM public.physician_workflow_preferences p,
        LATERAL jsonb_each(p.command_usage_count) as command_count
    WHERE p.user_id = target_user_id
    ORDER BY (command_count->>'count')::BIGINT DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER: Update timestamp on changes
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_workflow_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_workflow_preferences_timestamp
    BEFORE UPDATE ON public.physician_workflow_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.update_workflow_preferences_timestamp();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

ALTER TABLE public.physician_workflow_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physician_section_interactions ENABLE ROW LEVEL SECURITY;

-- Workflow preferences policies
CREATE POLICY "Users can view their own workflow preferences"
    ON public.physician_workflow_preferences FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own workflow preferences"
    ON public.physician_workflow_preferences FOR ALL
    USING (auth.uid() = user_id);

-- Section interactions policies
CREATE POLICY "Users can view their own section interactions"
    ON public.physician_section_interactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own section interactions"
    ON public.physician_section_interactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Admins can view all for analytics
CREATE POLICY "Admins can view all workflow preferences"
    ON public.physician_workflow_preferences FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can view all section interactions"
    ON public.physician_section_interactions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- CLEANUP FUNCTION
-- =====================================================

-- Function to clean up old interaction logs (keep 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_section_interactions()
RETURNS void AS $$
BEGIN
    DELETE FROM public.physician_section_interactions
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.physician_workflow_preferences IS 'Stores physician workflow mode preferences, section ordering, and command palette history';
COMMENT ON TABLE public.physician_section_interactions IS 'Tracks physician interactions with dashboard sections for smart ordering';
COMMENT ON FUNCTION public.get_smart_section_order IS 'Calculate optimal section order based on usage patterns (recency, frequency, duration)';
COMMENT ON FUNCTION public.get_command_usage_stats IS 'Get most frequently used commands from command palette';
