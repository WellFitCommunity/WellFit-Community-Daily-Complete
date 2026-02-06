-- AI Avatar Entity Extractor Skill Registration
-- Skill #37: SmartScribe → Avatar marker extraction using Claude Haiku 4.5
-- Idempotent: ON CONFLICT DO UPDATE

INSERT INTO ai_skills (
  skill_number,
  skill_key,
  description,
  model,
  is_active,
  category,
  created_at,
  updated_at
) VALUES (
  37,
  'smartscribe_avatar_extractor',
  'Extracts medical entities (device insertions, removals, conditions) from SmartScribe transcription text for automatic avatar marker creation. Uses Claude Haiku 4.5 for fast, context-aware parsing with dynamic confidence scoring. Falls back to regex extraction on failure.',
  'claude-haiku-4-5-20251001',
  true,
  'clinical',
  NOW(),
  NOW()
)
ON CONFLICT (skill_key) DO UPDATE SET
  description = EXCLUDED.description,
  model = EXCLUDED.model,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
