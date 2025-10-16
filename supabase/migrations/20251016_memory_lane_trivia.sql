-- Memory Lane Trivia System for Seniors
-- Era-based trivia questions (1950s-1990s) with cognitive function tracking

-- Table for trivia questions
CREATE TABLE IF NOT EXISTS memory_lane_trivia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  era VARCHAR(10) NOT NULL CHECK (era IN ('1950s', '1960s', '1970s', '1980s', '1990s')),
  difficulty VARCHAR(10) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),

  -- Answer options (4 choices)
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_answer VARCHAR(1) NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),

  -- Cognitive tracking
  cognitive_function VARCHAR(50) NOT NULL,
  brain_region VARCHAR(50) NOT NULL,
  explanation TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Table for user trivia progress
CREATE TABLE IF NOT EXISTS user_trivia_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Daily tracking
  play_date DATE NOT NULL DEFAULT CURRENT_DATE,
  questions_attempted JSONB NOT NULL DEFAULT '[]', -- Array of question IDs
  correct_answers INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 5,

  -- Trophy tracking
  perfect_score BOOLEAN DEFAULT FALSE,
  trophy_earned BOOLEAN DEFAULT FALSE,

  -- Cognitive metrics
  cognitive_functions_trained JSONB, -- Array of functions trained today

  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Constraints
  UNIQUE(user_id, play_date),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for user trophies
CREATE TABLE IF NOT EXISTS user_trivia_trophies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  earned_date DATE NOT NULL,
  trophy_type VARCHAR(20) DEFAULT 'perfect_score',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, earned_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trivia_difficulty_era ON memory_lane_trivia(difficulty, era, is_active);
CREATE INDEX IF NOT EXISTS idx_user_progress_date ON user_trivia_progress(user_id, play_date);
CREATE INDEX IF NOT EXISTS idx_user_trophies ON user_trivia_trophies(user_id, earned_date);

-- RLS Policies
ALTER TABLE memory_lane_trivia ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_trivia_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_trivia_trophies ENABLE ROW LEVEL SECURITY;

-- Trivia questions are readable by all authenticated users
CREATE POLICY "Trivia questions are viewable by authenticated users"
  ON memory_lane_trivia FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

-- Users can view their own progress
CREATE POLICY "Users can view their own trivia progress"
  ON user_trivia_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own progress
CREATE POLICY "Users can insert their own trivia progress"
  ON user_trivia_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own progress
CREATE POLICY "Users can update their own trivia progress"
  ON user_trivia_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can view their own trophies
CREATE POLICY "Users can view their own trophies"
  ON user_trivia_trophies FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own trophies
CREATE POLICY "Users can insert their own trophies"
  ON user_trivia_trophies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Function to get daily questions for a user
CREATE OR REPLACE FUNCTION get_daily_trivia_questions(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  question TEXT,
  era VARCHAR(10),
  difficulty VARCHAR(10),
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  cognitive_function VARCHAR(50),
  brain_region VARCHAR(50)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_seed FLOAT;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Use deterministic seed based on user_id and date for consistent daily questions
  v_seed := (EXTRACT(EPOCH FROM v_today) + EXTRACT(EPOCH FROM (p_user_id::TEXT)::UUID))::FLOAT;
  PERFORM setseed(v_seed / 1000000000000);

  -- Return 3 easy, 1 medium, 1 hard (randomized but consistent per day per user)
  RETURN QUERY
  (
    SELECT q.id, q.question, q.era, q.difficulty, q.option_a, q.option_b, q.option_c, q.option_d, q.cognitive_function, q.brain_region
    FROM memory_lane_trivia q
    WHERE q.difficulty = 'easy' AND q.is_active = TRUE
    ORDER BY random()
    LIMIT 3
  )
  UNION ALL
  (
    SELECT q.id, q.question, q.era, q.difficulty, q.option_a, q.option_b, q.option_c, q.option_d, q.cognitive_function, q.brain_region
    FROM memory_lane_trivia q
    WHERE q.difficulty = 'medium' AND q.is_active = TRUE
    ORDER BY random()
    LIMIT 1
  )
  UNION ALL
  (
    SELECT q.id, q.question, q.era, q.difficulty, q.option_a, q.option_b, q.option_c, q.option_d, q.cognitive_function, q.brain_region
    FROM memory_lane_trivia q
    WHERE q.difficulty = 'hard' AND q.is_active = TRUE
    ORDER BY random()
    LIMIT 1
  );
END;
$$;

COMMENT ON TABLE memory_lane_trivia IS 'Trivia questions from 1950s-1990s for senior cognitive engagement';
COMMENT ON TABLE user_trivia_progress IS 'Daily trivia progress and scores for users';
COMMENT ON TABLE user_trivia_trophies IS 'Trophy collection for perfect trivia scores';
