-- Migration: Feature Engagement Tracking
-- Tracks user interactions with meals, tech tips, and other community features
-- This enables proper reporting in the Admin Reports section

-- Table to track feature engagement events
CREATE TABLE IF NOT EXISTS public.feature_engagement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    feature_type TEXT NOT NULL CHECK (feature_type IN ('meal_view', 'tech_tip_view', 'trivia_play', 'scripture_view', 'affirmation_view', 'weather_check', 'exercise_complete')),
    feature_id TEXT, -- e.g., recipe ID, tech tip index, trivia category
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast querying by tenant and feature type
CREATE INDEX IF NOT EXISTS idx_feature_engagement_tenant_type ON public.feature_engagement(tenant_id, feature_type);
CREATE INDEX IF NOT EXISTS idx_feature_engagement_user ON public.feature_engagement(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_engagement_created ON public.feature_engagement(created_at);

-- Enable RLS
ALTER TABLE public.feature_engagement ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own engagement records
CREATE POLICY "Users can insert own engagement"
    ON public.feature_engagement
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all engagement for their tenant
CREATE POLICY "Admins can view tenant engagement"
    ON public.feature_engagement
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.user_id = auth.uid()
            AND p.tenant_id = feature_engagement.tenant_id
            AND p.is_admin = true
        )
    );

-- Function to get feature engagement stats for admin reports
CREATE OR REPLACE FUNCTION public.get_feature_engagement_stats(
    p_tenant_id UUID DEFAULT NULL,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    feature_type TEXT,
    total_count BIGINT,
    unique_users BIGINT,
    last_engagement TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        fe.feature_type,
        COUNT(*)::BIGINT as total_count,
        COUNT(DISTINCT fe.user_id)::BIGINT as unique_users,
        MAX(fe.created_at) as last_engagement
    FROM public.feature_engagement fe
    WHERE (p_tenant_id IS NULL OR fe.tenant_id = p_tenant_id)
      AND fe.created_at >= NOW() - (p_days || ' days')::INTERVAL
    GROUP BY fe.feature_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_feature_engagement_stats TO authenticated;

-- Comment for documentation
COMMENT ON TABLE public.feature_engagement IS 'Tracks user engagement with community features like meals, tech tips, and trivia';
COMMENT ON FUNCTION public.get_feature_engagement_stats IS 'Returns aggregated feature engagement stats for admin reporting';
