-- =====================================================
-- MCP COST TRACKING INFRASTRUCTURE
-- Purpose: Track MCP usage, costs, and cache efficiency
-- =====================================================

-- Create MCP cost metrics table
CREATE TABLE IF NOT EXISTS public.mcp_cost_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Call metrics
    total_calls INTEGER DEFAULT 0,
    cached_calls INTEGER DEFAULT 0,
    haiku_calls INTEGER DEFAULT 0,
    sonnet_calls INTEGER DEFAULT 0,

    -- Cost metrics
    total_cost DECIMAL(10, 6) DEFAULT 0,
    saved_cost DECIMAL(10, 6) DEFAULT 0,
    cache_hit_rate DECIMAL(5, 2) DEFAULT 0, -- Percentage

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    period_start TIMESTAMPTZ DEFAULT NOW(),
    period_end TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 day'
);

-- Create index on user_id and time range
CREATE INDEX IF NOT EXISTS idx_mcp_cost_metrics_user_period
    ON public.mcp_cost_metrics(user_id, period_start, period_end);

-- Create MCP cache performance table
CREATE TABLE IF NOT EXISTS public.mcp_cache_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Cache stats
    prompt_hash TEXT NOT NULL,
    hit_count INTEGER DEFAULT 1,
    miss_count INTEGER DEFAULT 0,
    total_savings DECIMAL(10, 6) DEFAULT 0,

    -- Metadata
    task_type TEXT, -- 'billing', 'soap_note', 'medication', etc.
    model_used TEXT,
    average_cost_per_call DECIMAL(10, 6),

    -- Timestamps
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on prompt_hash for fast lookups
CREATE INDEX IF NOT EXISTS idx_mcp_cache_prompt_hash
    ON public.mcp_cache_performance(prompt_hash);

-- Create index on task_type for analytics
CREATE INDEX IF NOT EXISTS idx_mcp_cache_task_type
    ON public.mcp_cache_performance(task_type);

-- Create MCP cost savings view
CREATE OR REPLACE VIEW public.mcp_cost_savings_summary AS
SELECT
    user_id,
    SUM(total_calls) as total_calls,
    SUM(cached_calls) as total_cached_calls,
    SUM(total_cost) as total_spent,
    SUM(saved_cost) as total_saved,
    AVG(cache_hit_rate) as avg_cache_hit_rate,
    SUM(haiku_calls) as total_haiku_calls,
    SUM(sonnet_calls) as total_sonnet_calls,
    COUNT(*) as reporting_periods
FROM public.mcp_cost_metrics
GROUP BY user_id;

-- Create function to calculate daily cost savings
CREATE OR REPLACE FUNCTION public.calculate_mcp_daily_savings(target_user_id UUID)
RETURNS TABLE (
    date DATE,
    total_cost DECIMAL,
    saved_cost DECIMAL,
    cache_hit_rate DECIMAL,
    efficiency_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        DATE(period_start) as date,
        SUM(m.total_cost) as total_cost,
        SUM(m.saved_cost) as saved_cost,
        AVG(m.cache_hit_rate) as cache_hit_rate,
        CASE
            WHEN SUM(m.total_cost) > 0 THEN
                CAST(((SUM(m.saved_cost) / (SUM(m.total_cost) + SUM(m.saved_cost))) * 100) AS INTEGER)
            ELSE 0
        END as efficiency_score
    FROM public.mcp_cost_metrics m
    WHERE m.user_id = target_user_id
        AND m.period_start >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(period_start)
    ORDER BY date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get top cached queries
CREATE OR REPLACE FUNCTION public.get_top_cached_queries(target_user_id UUID, limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    task_type TEXT,
    hit_count INTEGER,
    total_savings DECIMAL,
    average_cost DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.task_type,
        c.hit_count,
        c.total_savings,
        c.average_cost_per_call
    FROM public.mcp_cache_performance c
    WHERE c.user_id = target_user_id
    ORDER BY c.hit_count DESC, c.total_savings DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

ALTER TABLE public.mcp_cost_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_cache_performance ENABLE ROW LEVEL SECURITY;

-- MCP Cost Metrics policies
CREATE POLICY "Users can view their own MCP cost metrics"
    ON public.mcp_cost_metrics FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own MCP cost metrics"
    ON public.mcp_cost_metrics FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all MCP cost metrics"
    ON public.mcp_cost_metrics FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- MCP Cache Performance policies
CREATE POLICY "Users can view their own cache performance"
    ON public.mcp_cache_performance FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own cache performance"
    ON public.mcp_cache_performance FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all cache performance"
    ON public.mcp_cache_performance FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- AUTOMATIC CLEANUP
-- =====================================================

-- Function to clean up old metrics (keep 90 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_mcp_metrics()
RETURNS void AS $$
BEGIN
    DELETE FROM public.mcp_cost_metrics
    WHERE created_at < NOW() - INTERVAL '90 days';

    DELETE FROM public.mcp_cache_performance
    WHERE last_accessed_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE public.mcp_cost_metrics IS 'Tracks MCP API usage costs and cache efficiency metrics per user and time period';
COMMENT ON TABLE public.mcp_cache_performance IS 'Tracks individual cached prompt performance and savings';
COMMENT ON VIEW public.mcp_cost_savings_summary IS 'Aggregated view of total cost savings per user';
COMMENT ON FUNCTION public.calculate_mcp_daily_savings IS 'Calculate daily cost savings and efficiency scores for a user';
COMMENT ON FUNCTION public.get_top_cached_queries IS 'Get the most frequently cached queries and their savings';
