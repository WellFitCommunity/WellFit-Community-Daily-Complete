-- ============================================================================
-- Fix Skill Number Conflict
-- ============================================================================
-- Issue: skill_number 58 was assigned to both:
--   - welfare_check_dispatcher (in 20251226130000_modular_ai_skills_design.sql)
--   - care_team_chat_summarizer (in 20251226140000_add_10_new_ai_skills.sql)
--
-- Resolution: Change care_team_chat_summarizer from skill_number 58 to 61
-- ============================================================================

-- Update care_team_chat_summarizer to use skill_number 61
UPDATE public.ai_skills
SET
  skill_number = 61,
  updated_at = now()
WHERE skill_key = 'care_team_chat_summarizer'
  AND skill_number = 58;

-- Verification
DO $$
DECLARE
  v_welfare_num INTEGER;
  v_chat_num INTEGER;
BEGIN
  SELECT skill_number INTO v_welfare_num FROM public.ai_skills WHERE skill_key = 'welfare_check_dispatcher';
  SELECT skill_number INTO v_chat_num FROM public.ai_skills WHERE skill_key = 'care_team_chat_summarizer';

  IF v_welfare_num = 58 AND v_chat_num = 61 THEN
    RAISE NOTICE '✅ Skill number conflict resolved: welfare_check_dispatcher=#%, care_team_chat_summarizer=#%', v_welfare_num, v_chat_num;
  ELSE
    RAISE WARNING '⚠️ Unexpected skill numbers: welfare_check_dispatcher=#%, care_team_chat_summarizer=#%', v_welfare_num, v_chat_num;
  END IF;
END $$;
