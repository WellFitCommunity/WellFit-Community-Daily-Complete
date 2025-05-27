-- SQL for creating the community_moments table

CREATE TABLE IF NOT EXISTS public.community_moments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Or ON DELETE CASCADE if moments should be deleted with profile
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('meal_photo', 'story_text', 'gallery_image', 'quote', 'activity_log')), -- Added 'activity_log' as a potential type
    title TEXT,
    description TEXT,
    media_url TEXT, -- URL to media in Supabase Storage, e.g., 'user_uploads/user_id/image.png'
    tags TEXT[], -- Array of text for tags
    is_gallery_highlight BOOLEAN DEFAULT false NOT NULL,

    -- Future enhancements:
    -- reactions JSONB, -- For likes, emojis, etc.
    -- comments_count INTEGER DEFAULT 0,
    -- location TEXT -- If relevant for certain moments
    CONSTRAINT media_url_if_media_type CHECK (
        (type IN ('meal_photo', 'gallery_image') AND media_url IS NOT NULL) OR
        (type NOT IN ('meal_photo', 'gallery_image'))
    )
);

-- Optional: Add indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_community_moments_user_id ON public.community_moments(user_id);
CREATE INDEX IF NOT EXISTS idx_community_moments_type ON public.community_moments(type);
CREATE INDEX IF NOT EXISTS idx_community_moments_tags ON public.community_moments USING GIN (tags); -- GIN index for array searching
CREATE INDEX IF NOT EXISTS idx_community_moments_is_gallery_highlight ON public.community_moments(is_gallery_highlight) WHERE is_gallery_highlight = true;

-- Comments on Row Level Security (RLS) Policies:
-- RLS should be enabled for this table.
-- The following are conceptual policies. Actual implementation might vary.

-- 1. Enable RLS for the table
-- ALTER TABLE public.community_moments ENABLE ROW LEVEL SECURITY;

-- 2. Users can insert their own moments.
-- CREATE POLICY "Users can insert their own moments"
-- ON public.community_moments
-- FOR INSERT
-- TO authenticated
-- WITH CHECK (auth.uid() = user_id);

-- 3. Users can update their own moments.
-- CREATE POLICY "Users can update their own moments"
-- ON public.community_moments
-- FOR UPDATE
-- TO authenticated
-- USING (auth.uid() = user_id) -- The user can only update rows where they are the user_id
-- WITH CHECK (auth.uid() = user_id); -- The user_id cannot be changed to someone else's

-- 4. Users can delete their own moments.
-- CREATE POLICY "Users can delete their own moments"
-- ON public.community_moments
-- FOR DELETE
-- TO authenticated
-- USING (auth.uid() = user_id);

-- 5. All authenticated users can select/read moments.
--    This policy can be adjusted based on privacy requirements.
--    For example, if some moments should only be visible to the owner or specific groups.
-- CREATE POLICY "Authenticated users can view all moments"
-- ON public.community_moments
-- FOR SELECT
-- TO authenticated
-- USING (true); -- Allows selection of all rows

--    Alternative: Only allow users to see their own moments unless it's a gallery highlight
-- CREATE POLICY "Users can view their own moments and gallery highlights"
-- ON public.community_moments
-- FOR SELECT
-- TO authenticated
-- USING (auth.uid() = user_id OR is_gallery_highlight = true);

-- 6. Admin Role: Admins should have unrestricted access.
--    This is typically handled by creating a specific admin role (e.g., 'service_role' or a custom 'admin' role)
--    and granting it permissions that bypass RLS, or by defining a policy that grants full access to admins.
--    If using a role that bypasses RLS (like service_role key), no specific policy might be needed for admin FROM THE PERSPECTIVE OF RLS.
--    However, if you have a user-based admin role from your 'profiles' table (e.g. profile.role = 'admin'):
-- CREATE POLICY "Admins have full access"
-- ON public.community_moments
-- FOR ALL
-- TO authenticated -- Or to a specific admin role if you have one
-- USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')) -- Adjust 'role' column and value as needed
-- WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Ensure the 'public' schema is used if not explicitly stated in table references (e.g., public.profiles).
-- Consider default privileges for roles on this new table. For example:
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_moments TO authenticated;
-- GRANT ALL ON public.community_moments TO service_role;

COMMENT ON COLUMN public.community_moments.type IS 'Type of community moment, e.g., "meal_photo", "story_text", "gallery_image", "quote", "activity_log".';
COMMENT ON COLUMN public.community_moments.media_url IS 'URL to media in Supabase Storage, e.g., for photos or videos.';
COMMENT ON COLUMN public.community_moments.tags IS 'Array of text tags for categorization and search.';
COMMENT ON COLUMN public.community_moments.is_gallery_highlight IS 'If true, this moment is curated for public gallery display.';
COMMENT ON TABLE public.community_moments IS 'Stores user-generated content like photos, stories, and quotes shared by the community.';
