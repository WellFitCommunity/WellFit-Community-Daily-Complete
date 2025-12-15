-- Migration: Create user_workflow_preferences table
-- This table stores user-specific workflow preferences for the admin panel

-- Create the table
CREATE TABLE IF NOT EXISTS public.user_workflow_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_order text[] DEFAULT ARRAY[]::text[],
    pinned_sections text[] DEFAULT ARRAY[]::text[],
    recent_sections text[] DEFAULT ARRAY[]::text[],
    voice_enabled boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id)
);

-- Add comments
COMMENT ON TABLE public.user_workflow_preferences IS 'Stores user workflow preferences for the admin panel';
COMMENT ON COLUMN public.user_workflow_preferences.category_order IS 'User-defined order of workflow categories';
COMMENT ON COLUMN public.user_workflow_preferences.pinned_sections IS 'Sections pinned to the top by the user';
COMMENT ON COLUMN public.user_workflow_preferences.recent_sections IS 'Recently accessed sections';
COMMENT ON COLUMN public.user_workflow_preferences.voice_enabled IS 'Whether voice commands are enabled';

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_workflow_preferences_user_id
    ON public.user_workflow_preferences(user_id);

-- Enable RLS
ALTER TABLE public.user_workflow_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own preferences
CREATE POLICY "Users can view own workflow preferences"
    ON public.user_workflow_preferences
    FOR SELECT
    USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own preferences
CREATE POLICY "Users can insert own workflow preferences"
    ON public.user_workflow_preferences
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own preferences
CREATE POLICY "Users can update own workflow preferences"
    ON public.user_workflow_preferences
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own preferences
CREATE POLICY "Users can delete own workflow preferences"
    ON public.user_workflow_preferences
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_workflow_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_workflow_preferences_timestamp
    BEFORE UPDATE ON public.user_workflow_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_user_workflow_preferences_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_workflow_preferences TO authenticated;
