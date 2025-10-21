-- Migration: Conversational Scribe Personality System
-- Creates tables to track provider preferences and enable adaptive, conversational AI scribe

-- Table to store provider-specific scribe preferences and learning data
CREATE TABLE IF NOT EXISTS provider_scribe_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('physician', 'nurse_practitioner', 'physician_assistant')),

  -- Personality preferences
  formality_level TEXT DEFAULT 'relaxed' CHECK (formality_level IN ('formal', 'professional', 'relaxed', 'casual')),
  interaction_style TEXT DEFAULT 'collaborative' CHECK (interaction_style IN ('directive', 'collaborative', 'supportive', 'autonomous')),
  verbosity TEXT DEFAULT 'balanced' CHECK (verbosity IN ('concise', 'balanced', 'detailed')),
  humor_level TEXT DEFAULT 'light' CHECK (humor_level IN ('none', 'light', 'moderate')),

  -- Communication patterns learned over time
  preferred_greeting TEXT DEFAULT 'Hey there!',
  common_phrases JSONB DEFAULT '[]'::jsonb,
  documentation_style TEXT DEFAULT 'SOAP' CHECK (documentation_style IN ('SOAP', 'narrative', 'bullet_points', 'hybrid')),

  -- Learning data
  interaction_count INTEGER DEFAULT 0,
  avg_session_duration_minutes DECIMAL DEFAULT 0,
  preferred_specialties TEXT[] DEFAULT ARRAY[]::TEXT[],
  common_diagnoses TEXT[] DEFAULT ARRAY[]::TEXT[],
  billing_preferences JSONB DEFAULT '{
    "conservative": false,
    "aggressive": false,
    "balanced": true,
    "prefer_preventive_codes": false
  }'::jsonb,

  -- Adaptive behavior flags
  learns_from_corrections BOOLEAN DEFAULT true,
  adapts_tone_to_mood BOOLEAN DEFAULT true,
  proactive_suggestions BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_interaction_at TIMESTAMPTZ,

  UNIQUE(provider_id)
);

-- Table to track scribe interaction history for learning
CREATE TABLE IF NOT EXISTS scribe_interaction_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  session_id UUID REFERENCES scribe_sessions(id) ON DELETE SET NULL,

  -- Interaction details
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'greeting', 'suggestion', 'clarification', 'code_recommendation',
    'documentation_assist', 'correction_received', 'positive_feedback'
  )),

  -- What the scribe said/did
  scribe_message TEXT,
  scribe_action JSONB,

  -- Provider response/reaction
  provider_response TEXT,
  provider_sentiment TEXT CHECK (provider_sentiment IN ('positive', 'neutral', 'negative', 'frustrated', 'appreciative')),

  -- Learning signals
  was_helpful BOOLEAN,
  was_corrected BOOLEAN DEFAULT false,
  correction_details TEXT,

  -- Context
  session_phase TEXT CHECK (session_phase IN ('start', 'active', 'documentation', 'billing', 'end')),
  time_of_day TEXT CHECK (time_of_day IN ('morning', 'afternoon', 'evening', 'night')),
  provider_workload TEXT CHECK (provider_workload IN ('light', 'moderate', 'heavy', 'overwhelmed')),

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table for conversational context in real-time sessions
CREATE TABLE IF NOT EXISTS scribe_conversation_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES scribe_sessions(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,

  -- Current conversation state
  current_mood TEXT CHECK (current_mood IN ('energized', 'focused', 'neutral', 'tired', 'stressed')),
  conversation_flow JSONB DEFAULT '[]'::jsonb, -- Array of recent exchanges

  -- Session-specific adaptations
  session_formality_override TEXT CHECK (session_formality_override IN ('formal', 'professional', 'relaxed', 'casual')),
  detected_urgency_level TEXT CHECK (detected_urgency_level IN ('routine', 'elevated', 'urgent', 'critical')),

  -- Real-time learning
  mentioned_topics TEXT[] DEFAULT ARRAY[]::TEXT[],
  key_concerns TEXT[] DEFAULT ARRAY[]::TEXT[],
  documentation_preferences_this_session JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(session_id)
);

-- Indexes for performance
CREATE INDEX idx_provider_scribe_prefs_provider ON provider_scribe_preferences(provider_id);
CREATE INDEX idx_scribe_interaction_provider ON scribe_interaction_history(provider_id);
CREATE INDEX idx_scribe_interaction_session ON scribe_interaction_history(session_id);
CREATE INDEX idx_scribe_interaction_created ON scribe_interaction_history(created_at DESC);
CREATE INDEX idx_scribe_context_session ON scribe_conversation_context(session_id);
CREATE INDEX idx_scribe_context_provider ON scribe_conversation_context(provider_id);

-- Function to initialize default preferences for new providers
CREATE OR REPLACE FUNCTION initialize_provider_scribe_preferences()
RETURNS TRIGGER AS $$
BEGIN
  -- Only initialize for clinical roles (using role column from profiles)
  IF NEW.role IN ('physician', 'nurse_practitioner', 'physician_assistant', 'doctor', 'nurse', 'np', 'md', 'do') THEN
    INSERT INTO provider_scribe_preferences (provider_id, provider_type)
    VALUES (
      NEW.user_id,
      CASE
        WHEN NEW.role IN ('physician', 'doctor', 'md', 'do') THEN 'physician'
        WHEN NEW.role IN ('nurse_practitioner', 'np') THEN 'nurse_practitioner'
        WHEN NEW.role = 'physician_assistant' THEN 'physician_assistant'
        ELSE 'physician' -- default
      END
    )
    ON CONFLICT (provider_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-initialize preferences
CREATE TRIGGER on_profile_created_init_scribe_prefs
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION initialize_provider_scribe_preferences();

-- Function to update provider preferences based on interactions
CREATE OR REPLACE FUNCTION learn_from_interaction(
  p_provider_id UUID,
  p_interaction_type TEXT,
  p_was_helpful BOOLEAN DEFAULT NULL,
  p_sentiment TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE provider_scribe_preferences
  SET
    interaction_count = interaction_count + 1,
    last_interaction_at = now(),
    updated_at = now()
  WHERE provider_id = p_provider_id;

  -- Adjust formality based on corrections and sentiment
  IF p_sentiment = 'frustrated' AND p_was_helpful = false THEN
    UPDATE provider_scribe_preferences
    SET formality_level = CASE
      WHEN formality_level = 'casual' THEN 'relaxed'
      WHEN formality_level = 'relaxed' THEN 'professional'
      ELSE formality_level
    END
    WHERE provider_id = p_provider_id;
  END IF;

  -- Increase verbosity if provider asks for clarification often
  IF p_interaction_type = 'clarification' THEN
    UPDATE provider_scribe_preferences
    SET verbosity = CASE
      WHEN verbosity = 'concise' THEN 'balanced'
      WHEN verbosity = 'balanced' THEN 'detailed'
      ELSE verbosity
    END
    WHERE provider_id = p_provider_id
    AND (SELECT COUNT(*) FROM scribe_interaction_history
         WHERE provider_id = p_provider_id
         AND interaction_type = 'clarification'
         AND created_at > now() - INTERVAL '7 days') > 5;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get personalized greeting
CREATE OR REPLACE FUNCTION get_personalized_greeting(
  p_provider_id UUID,
  p_time_of_day TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  v_prefs RECORD;
  v_greeting TEXT;
  v_time TEXT;
BEGIN
  -- Get provider preferences
  SELECT * INTO v_prefs
  FROM provider_scribe_preferences
  WHERE provider_id = p_provider_id;

  -- Determine time of day if not provided
  v_time := COALESCE(
    p_time_of_day,
    CASE
      WHEN EXTRACT(HOUR FROM now()) < 12 THEN 'morning'
      WHEN EXTRACT(HOUR FROM now()) < 17 THEN 'afternoon'
      WHEN EXTRACT(HOUR FROM now()) < 21 THEN 'evening'
      ELSE 'night'
    END
  );

  -- Generate greeting based on formality level
  v_greeting := CASE v_prefs.formality_level
    WHEN 'formal' THEN
      CASE v_time
        WHEN 'morning' THEN 'Good morning, Doctor. Ready to document today''s visits.'
        WHEN 'afternoon' THEN 'Good afternoon, Doctor. I''m here to assist with your documentation.'
        WHEN 'evening' THEN 'Good evening, Doctor. Let''s wrap up today''s notes.'
        ELSE 'Hello, Doctor. I''m ready when you are.'
      END
    WHEN 'professional' THEN
      CASE v_time
        WHEN 'morning' THEN 'Morning, Doc! Let''s tackle today''s charts together.'
        WHEN 'afternoon' THEN 'Hey! Ready to document this visit?'
        WHEN 'evening' THEN 'Evening! Let''s finish strong with these notes.'
        ELSE 'Hi there! Ready to get this documented?'
      END
    WHEN 'relaxed' THEN
      CASE v_time
        WHEN 'morning' THEN 'Hey! Coffee kicked in yet? Let''s chart this visit.'
        WHEN 'afternoon' THEN 'What''s up! Ready to capture what just happened?'
        WHEN 'evening' THEN 'Hey! Almost done for the day - let''s nail these notes.'
        ELSE 'Hey there! Let''s document this one together.'
      END
    WHEN 'casual' THEN
      CASE v_time
        WHEN 'morning' THEN 'Morning! ☕ Let''s chart and caffeinate.'
        WHEN 'afternoon' THEN 'Yo! Another one? You got this. I''ll help.'
        WHEN 'evening' THEN 'Almost quitting time! Let''s wrap this up quick.'
        ELSE 'Hey! Ready when you are.'
      END
    ELSE 'Hello! Ready to document this visit?'
  END;

  RETURN v_greeting;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE provider_scribe_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE scribe_interaction_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scribe_conversation_context ENABLE ROW LEVEL SECURITY;

-- Providers can only see their own preferences
CREATE POLICY provider_scribe_prefs_select ON provider_scribe_preferences
  FOR SELECT USING (provider_id = auth.uid());

CREATE POLICY provider_scribe_prefs_update ON provider_scribe_preferences
  FOR UPDATE USING (provider_id = auth.uid());

-- Providers can only see their own interaction history
CREATE POLICY scribe_interaction_select ON scribe_interaction_history
  FOR SELECT USING (provider_id = auth.uid());

-- Providers can see their own conversation context
CREATE POLICY scribe_context_select ON scribe_conversation_context
  FOR SELECT USING (provider_id = auth.uid());

-- Service role can manage all (for Edge Functions)
CREATE POLICY service_role_all_prefs ON provider_scribe_preferences
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY service_role_all_interactions ON scribe_interaction_history
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY service_role_all_context ON scribe_conversation_context
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Grant permissions
GRANT SELECT, UPDATE ON provider_scribe_preferences TO authenticated;
GRANT SELECT ON scribe_interaction_history TO authenticated;
GRANT SELECT ON scribe_conversation_context TO authenticated;
GRANT ALL ON provider_scribe_preferences TO service_role;
GRANT ALL ON scribe_interaction_history TO service_role;
GRANT ALL ON scribe_conversation_context TO service_role;

-- Comments
COMMENT ON TABLE provider_scribe_preferences IS 'Stores provider-specific preferences for conversational AI scribe, enabling personalized and adaptive interactions';
COMMENT ON TABLE scribe_interaction_history IS 'Tracks all scribe-provider interactions for learning and improvement';
COMMENT ON TABLE scribe_conversation_context IS 'Maintains real-time conversation state and session-specific context';
COMMENT ON FUNCTION get_personalized_greeting IS 'Generates a personalized greeting based on provider preferences and time of day';
COMMENT ON FUNCTION learn_from_interaction IS 'Updates provider preferences based on interaction feedback and sentiment';
