-- Migration: Add scribe_session_feedback table
-- Purpose: Store thumbs up/down feedback for transcription quality
-- Author: Claude Code
-- Date: 2026-01-06

-- Create feedback table for scribe session quality tracking
CREATE TABLE IF NOT EXISTS public.scribe_session_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.scribe_sessions(id) ON DELETE SET NULL,
    rating TEXT NOT NULL CHECK (rating IN ('positive', 'negative')),
    issues TEXT[] DEFAULT NULL,
    comment TEXT DEFAULT NULL,
    scribe_mode TEXT NOT NULL CHECK (scribe_mode IN ('smartscribe', 'compass-riley')),
    session_duration_seconds INTEGER DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for provider lookups
CREATE INDEX IF NOT EXISTS idx_scribe_session_feedback_provider
    ON public.scribe_session_feedback(provider_id);

-- Create index for rating analysis
CREATE INDEX IF NOT EXISTS idx_scribe_session_feedback_rating
    ON public.scribe_session_feedback(rating);

-- Create index for time-based queries
CREATE INDEX IF NOT EXISTS idx_scribe_session_feedback_created
    ON public.scribe_session_feedback(created_at DESC);

-- Enable RLS
ALTER TABLE public.scribe_session_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Providers can insert their own feedback
CREATE POLICY scribe_session_feedback_insert_own ON public.scribe_session_feedback
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = provider_id);

-- RLS Policy: Providers can view their own feedback
CREATE POLICY scribe_session_feedback_select_own ON public.scribe_session_feedback
    FOR SELECT
    TO authenticated
    USING (auth.uid() = provider_id);

-- RLS Policy: Admins can view all feedback (for analytics)
CREATE POLICY scribe_session_feedback_admin_select ON public.scribe_session_feedback
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.user_id = auth.uid()
            AND p.role IN ('super_admin', 'admin', 'tenant_admin')
        )
    );

-- Grant permissions
GRANT SELECT, INSERT ON public.scribe_session_feedback TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE public.scribe_session_feedback IS
    'Stores thumbs up/down feedback for scribe transcription quality. Used to track DeepGram accuracy and identify users who may need voice training.';

COMMENT ON COLUMN public.scribe_session_feedback.rating IS
    'User rating: positive (thumbs up) or negative (thumbs down)';

COMMENT ON COLUMN public.scribe_session_feedback.issues IS
    'Array of issue categories when negative: missed_words, wrong_medical_terms, accent_issues, background_noise, other';

COMMENT ON COLUMN public.scribe_session_feedback.scribe_mode IS
    'Mode used: smartscribe (nurses) or compass-riley (physicians)';
