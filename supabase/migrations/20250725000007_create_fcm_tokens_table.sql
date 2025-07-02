-- Create fcm_tokens table to store FCM registration tokens for users
CREATE TABLE IF NOT EXISTS public.fcm_tokens (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_used_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    device_info TEXT, -- Optional: Store basic device info (e.g., user agent)
    PRIMARY KEY (user_id, token) -- Composite primary key to prevent duplicate tokens per user
);

COMMENT ON TABLE public.fcm_tokens IS 'Stores Firebase Cloud Messaging (FCM) registration tokens for users to enable push notifications.';
COMMENT ON COLUMN public.fcm_tokens.user_id IS 'The ID of the user associated with this FCM token.';
COMMENT ON COLUMN public.fcm_tokens.token IS 'The FCM registration token.';
COMMENT ON COLUMN public.fcm_tokens.created_at IS 'Timestamp when the token was first added.';
COMMENT ON COLUMN public.fcm_tokens.last_used_at IS 'Timestamp when the token was last confirmed or used (e.g. app open).';
COMMENT ON COLUMN public.fcm_tokens.device_info IS 'Optional information about the device associated with the token.';

-- Enable RLS for fcm_tokens table
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own FCM tokens
CREATE POLICY "Allow users to manage their own FCM tokens"
ON public.fcm_tokens
FOR ALL -- Covers SELECT, INSERT, UPDATE, DELETE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "Allow users to manage their own FCM tokens" ON public.fcm_tokens IS 'Users can manage their own FCM registration tokens (e.g., add new ones, delete old ones).';

-- Index for querying tokens by user_id
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON public.fcm_tokens(user_id);
-- Index for potentially querying by token (e.g., if needing to find user by token, though less common)
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_token ON public.fcm_tokens(token);
