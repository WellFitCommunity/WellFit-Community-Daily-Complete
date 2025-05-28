-- migrate:skip
-- SQL for user_questions table
-- Please save this content as a new Supabase migration file,
-- for example: supabase/migrations/YYYYMMDDHHMMSS_create_user_questions_table.sql
-- Then run 'supabase db push' to apply it.

CREATE TABLE IF NOT EXISTS public.user_questions (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL, -- Added ON DELETE CASCADE
    user_email TEXT, -- Denormalized for easier access by care team
    message_content TEXT DEFAULT 'User has a question from Doctor''s View.' NOT NULL,
    status TEXT DEFAULT 'new' NOT NULL, -- e.g., 'new', 'in_progress', 'resolved', 'archived'
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    
    CONSTRAINT check_message_content_length CHECK (char_length(message_content) <= 1000), -- Optional: limit message length
    CONSTRAINT check_status_values CHECK (status IN ('new', 'in_progress', 'resolved', 'archived')) -- Ensure status is one of the defined values
);

-- Add comments for clarity
COMMENT ON TABLE public.user_questions IS 'Stores questions submitted by users, typically from the Doctor''s View section.';
COMMENT ON COLUMN public.user_questions.id IS 'Unique identifier for the question.';
COMMENT ON COLUMN public.user_questions.user_id IS 'Foreign key referencing the user who submitted the question.';
COMMENT ON COLUMN public.user_questions.user_email IS 'The email of the user at the time of question submission (denormalized).';
COMMENT ON COLUMN public.user_questions.message_content IS 'The content of the question or a predefined message.';
COMMENT ON COLUMN public.user_questions.status IS 'The current status of the question (e.g., new, in_progress, resolved, archived).';
COMMENT ON COLUMN public.user_questions.created_at IS 'Timestamp when the question was submitted.';

-- Enable Row Level Security
ALTER TABLE public.user_questions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow users to insert their own questions"
ON public.user_questions
FOR INSERT
TO authenticated -- Specify the role, 'authenticated' is common
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to view their own questions"
ON public.user_questions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- This policy allows users to update the status of their own questions if needed in the future,
-- or perhaps add more details. For now, it's restrictive.
-- Consider if users should be able to update/delete. Generally, they shouldn't delete support tickets.
CREATE POLICY "Allow users to update their own questions (restricted)"
ON public.user_questions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND status <> 'resolved' AND status <> 'archived'); -- Example: prevent update if resolved/archived


-- Policy for service_role (typically used by backend functions, or admin operations from a secure context)
CREATE POLICY "Allow service_role full access"
ON public.user_questions
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Optional: Policy for a specific 'care_team' or 'admin' role if you have one.
-- This would require a custom role and a way to assign users to it.
-- Example for a custom role 'care_team_member':
-- CREATE POLICY "Allow care team to read and update questions"
-- ON public.user_questions
-- FOR ALL
-- USING (
--   auth.role() = 'authenticated' AND
--   get_my_claim('user_role') = '"care_team_member"'::jsonb -- Assuming you have a custom claim 'user_role'
-- )
-- WITH CHECK (
--   auth.role() = 'authenticated' AND
--   get_my_claim('user_role') = '"care_team_member"'::jsonb
-- );


-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_questions_user_id ON public.user_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_questions_status ON public.user_questions(status);
CREATE INDEX IF NOT EXISTS idx_user_questions_created_at ON public.user_questions(created_at);

-- Ensure the uuid-ossp extension is available if not already
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
-- This is often enabled by default in Supabase projects.

SELECT 'user_questions table migration script executed.';
