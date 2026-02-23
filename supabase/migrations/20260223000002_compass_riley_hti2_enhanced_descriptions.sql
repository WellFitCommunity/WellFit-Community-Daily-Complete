-- ============================================================================
-- HTI-2 Transparency Update: Compass Riley Enhanced Capabilities
-- Session 10, Task 10.7 of Compass Riley Clinical Reasoning Hardening
--
-- Updates patient_description for Riley-related AI skills to reflect
-- the enhanced capabilities added in Sessions 1-9:
--   - Anti-hallucination grounding (Session 1)
--   - Progressive clinical reasoning (Session 2)
--   - Conversation drift protection (Session 3)
--   - Evidence-based reasoning with PubMed (Session 4)
--   - Clinical guideline matching (Session 5)
--   - Treatment pathway references (Session 6)
--   - Physician consultation mode (Sessions 7-8)
-- ============================================================================

-- Riley Smart Scribe — updated to reflect Sessions 1-6 enhancements
UPDATE public.ai_skills
SET patient_description = 'Helps your doctor write clinical notes about your visit. Every detail in the note comes directly from what was said during your appointment — nothing is made up or assumed. The system checks your conditions against current medical guidelines and can look up research articles if your doctor needs them.'
WHERE skill_key = 'riley_smart_scribe';

-- Clinical guideline matcher — updated to reflect Session 5 real-time matching
UPDATE public.ai_skills
SET patient_description = 'Checks if your treatment follows current medical guidelines from organizations like the ADA, AHA, and GOLD. During your visit, it alerts your doctor if any recommended screenings or tests are missing based on your conditions.'
WHERE skill_key = 'clinical_guideline_matcher';

-- Treatment pathway — updated to reflect Session 6 real-time pathway display
UPDATE public.ai_skills
SET patient_description = 'Shows your doctor the recommended treatment steps for your condition, from first-line to advanced options, based on current clinical guidelines. Includes information about potential side effects and cost considerations.'
WHERE skill_key = 'treatment_pathway';

-- SOAP note generator — updated to reflect grounding rules
UPDATE public.ai_skills
SET patient_description = 'Writes a structured medical note about your visit for your health record. Each section is labeled to show whether the information was directly stated during your visit, reasonably concluded, or needs your doctor to verify.'
WHERE skill_key = 'soap_note_generator';

-- Add description column to ai_skills if not present (safety net)
ALTER TABLE public.ai_skills
ADD COLUMN IF NOT EXISTS description TEXT;

-- Update technical descriptions for Riley-related skills (developer/auditor facing)
UPDATE public.ai_skills
SET description = 'Real-time medical scribe with anti-hallucination grounding, progressive clinical reasoning, conversation drift protection, PubMed evidence retrieval, clinical guideline matching, treatment pathway references, and physician consultation mode. Sessions 1-9 of Compass Riley Clinical Reasoning Hardening.'
WHERE skill_key = 'riley_smart_scribe';
