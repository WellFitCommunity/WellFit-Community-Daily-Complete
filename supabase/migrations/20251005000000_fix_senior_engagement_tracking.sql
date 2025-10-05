-- Migration: Fix Senior Engagement Tracking
-- Purpose: Wire all senior interactions to database for admin visibility and risk assessment
-- Date: 2025-10-05

BEGIN;

-- ====================================================================
-- 1. GAME ACTIVITY TRACKING
-- ====================================================================

-- Create table for trivia game results
CREATE TABLE IF NOT EXISTS public.trivia_game_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Game session info
  game_date date NOT NULL DEFAULT CURRENT_DATE,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  completion_time_seconds integer, -- How long it took to complete

  -- Performance metrics
  score integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL,
  difficulty_breakdown jsonb DEFAULT '{}', -- {"Easy": 3, "Medium": 1, "Hard": 1}
  questions_attempted jsonb DEFAULT '[]', -- Array of question IDs

  -- Cognitive engagement indicators
  average_response_time_seconds numeric(10,2),
  completion_status text DEFAULT 'completed' CHECK (completion_status IN ('completed', 'abandoned', 'incomplete')),

  -- Metadata
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_trivia_user_date ON public.trivia_game_results(user_id, game_date DESC);
CREATE INDEX idx_trivia_completed ON public.trivia_game_results(completed_at DESC) WHERE completed_at IS NOT NULL;

-- Create table for word find/puzzle game results
CREATE TABLE IF NOT EXISTS public.word_game_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Game session info
  game_date date NOT NULL DEFAULT CURRENT_DATE,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  completion_time_seconds integer,

  -- Performance metrics
  words_found integer NOT NULL DEFAULT 0,
  total_words integer NOT NULL,
  hints_used integer DEFAULT 0,
  difficulty_level text, -- 'easy', 'medium', 'hard'

  -- Engagement indicators
  completion_status text DEFAULT 'completed' CHECK (completion_status IN ('completed', 'abandoned', 'incomplete')),

  -- Metadata
  puzzle_id text, -- Reference to specific puzzle
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_word_game_user_date ON public.word_game_results(user_id, game_date DESC);
CREATE INDEX idx_word_game_completed ON public.word_game_results(completed_at DESC) WHERE completed_at IS NOT NULL;

-- ====================================================================
-- 2. FIX CHECK_INS TABLE - ADD METADATA COLUMN
-- ====================================================================

-- Add metadata column if it doesn't exist (for dashboard check-ins)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'check_ins'
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.check_ins ADD COLUMN metadata jsonb DEFAULT '{}';
  END IF;
END $$;

-- ====================================================================
-- 3. USER QUESTIONS TABLE (if not exists)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.user_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Question content
  question_text text NOT NULL,
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'health', 'technical', 'account', 'emergency')),
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Response tracking
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'closed', 'escalated')),
  response_text text,
  responded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  responded_at timestamptz,

  -- Metadata
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_user_questions_user ON public.user_questions(user_id, created_at DESC);
CREATE INDEX idx_user_questions_status ON public.user_questions(status, created_at DESC);
CREATE INDEX idx_user_questions_priority ON public.user_questions(priority DESC, created_at DESC) WHERE status = 'pending';

-- ====================================================================
-- 4. SELF-REPORTS ENGAGEMENT TABLE
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.self_report_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Submission tracking
  submission_date date NOT NULL DEFAULT CURRENT_DATE,
  submitted_at timestamptz NOT NULL DEFAULT now(),

  -- Self-report data (flexible schema)
  report_data jsonb NOT NULL DEFAULT '{}',
  -- Example: {"mood": "good", "pain_level": 3, "appetite": "normal", "sleep_quality": 7}

  -- Engagement metrics
  completion_percentage numeric(5,2), -- How much of the form was filled
  time_spent_seconds integer,

  -- Metadata
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX idx_self_reports_user_date ON public.self_report_submissions(user_id, submission_date DESC);

-- ====================================================================
-- 5. ENGAGEMENT SCORING VIEW FOR RISK ASSESSMENT
-- ====================================================================

CREATE OR REPLACE VIEW public.patient_engagement_scores AS
SELECT
  u.id as user_id,
  u.email,

  -- Recent activity indicators (last 30 days)
  COUNT(DISTINCT ci.id) FILTER (WHERE ci.created_at >= now() - interval '30 days') as check_ins_30d,
  COUNT(DISTINCT tg.id) FILTER (WHERE tg.created_at >= now() - interval '30 days') as trivia_games_30d,
  COUNT(DISTINCT wg.id) FILTER (WHERE wg.created_at >= now() - interval '30 days') as word_games_30d,
  COUNT(DISTINCT sr.id) FILTER (WHERE sr.created_at >= now() - interval '30 days') as self_reports_30d,
  COUNT(DISTINCT uq.id) FILTER (WHERE uq.created_at >= now() - interval '30 days') as questions_asked_30d,

  -- Last 7 days
  COUNT(DISTINCT ci.id) FILTER (WHERE ci.created_at >= now() - interval '7 days') as check_ins_7d,
  COUNT(DISTINCT tg.id) FILTER (WHERE tg.created_at >= now() - interval '7 days') as trivia_games_7d,

  -- Last activity timestamps
  MAX(ci.created_at) as last_check_in,
  MAX(tg.created_at) as last_trivia_game,
  MAX(wg.created_at) as last_word_game,
  MAX(sr.created_at) as last_self_report,

  -- Performance indicators
  AVG(tg.score::numeric / NULLIF(tg.total_questions, 0) * 100) FILTER (WHERE tg.created_at >= now() - interval '30 days') as avg_trivia_score_pct,
  AVG(tg.completion_time_seconds) FILTER (WHERE tg.created_at >= now() - interval '30 days' AND tg.completed_at IS NOT NULL) as avg_trivia_completion_time,

  -- Engagement score (0-100)
  LEAST(100, (
    (COUNT(DISTINCT ci.id) FILTER (WHERE ci.created_at >= now() - interval '30 days') * 2) + -- Check-ins worth 2 points each
    (COUNT(DISTINCT tg.id) FILTER (WHERE tg.created_at >= now() - interval '30 days') * 5) + -- Games worth 5 points each
    (COUNT(DISTINCT wg.id) FILTER (WHERE wg.created_at >= now() - interval '30 days') * 5) +
    (COUNT(DISTINCT sr.id) FILTER (WHERE sr.created_at >= now() - interval '30 days') * 3) + -- Self-reports worth 3 points
    (COUNT(DISTINCT uq.id) FILTER (WHERE uq.created_at >= now() - interval '30 days') * 2)   -- Questions worth 2 points
  )) as engagement_score

FROM auth.users u
LEFT JOIN public.check_ins ci ON ci.user_id = u.id
LEFT JOIN public.trivia_game_results tg ON tg.user_id = u.id
LEFT JOIN public.word_game_results wg ON wg.user_id = u.id
LEFT JOIN public.self_report_submissions sr ON sr.user_id = u.id
LEFT JOIN public.user_questions uq ON uq.user_id = u.id
GROUP BY u.id, u.email;

-- ====================================================================
-- 6. ROW LEVEL SECURITY POLICIES
-- ====================================================================

-- Trivia game results
ALTER TABLE public.trivia_game_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trivia results"
  ON public.trivia_game_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trivia results"
  ON public.trivia_game_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all trivia results"
  ON public.trivia_game_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'nurse')
    )
  );

-- Word game results
ALTER TABLE public.word_game_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own word game results"
  ON public.word_game_results FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own word game results"
  ON public.word_game_results FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all word game results"
  ON public.word_game_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'nurse')
    )
  );

-- User questions
ALTER TABLE public.user_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own questions"
  ON public.user_questions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own questions"
  ON public.user_questions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all questions"
  ON public.user_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'nurse')
    )
  );

CREATE POLICY "Admins can update questions (respond)"
  ON public.user_questions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'nurse')
    )
  );

-- Self-report submissions
ALTER TABLE public.self_report_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own self-reports"
  ON public.self_report_submissions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own self-reports"
  ON public.self_report_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all self-reports"
  ON public.self_report_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'nurse')
    )
  );

-- ====================================================================
-- 7. UPDATED_AT TRIGGERS
-- ====================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_trivia_game_results_updated_at
  BEFORE UPDATE ON public.trivia_game_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_word_game_results_updated_at
  BEFORE UPDATE ON public.word_game_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_questions_updated_at
  BEFORE UPDATE ON public.user_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Senior engagement tracking tables created successfully!';
  RAISE NOTICE '   - trivia_game_results';
  RAISE NOTICE '   - word_game_results';
  RAISE NOTICE '   - user_questions';
  RAISE NOTICE '   - self_report_submissions';
  RAISE NOTICE '   - patient_engagement_scores (view)';
  RAISE NOTICE '   All tables have RLS policies enabled.';
END $$;
