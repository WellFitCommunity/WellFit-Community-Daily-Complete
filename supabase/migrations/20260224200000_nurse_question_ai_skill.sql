-- Register nurse question responder AI skill
-- Provides AI-generated response suggestions for patient questions
-- Used by NurseQuestionManager AISuggestionPanel

INSERT INTO ai_skills (
  skill_key,
  skill_number,
  name,
  description,
  patient_description,
  category,
  model,
  is_active,
  icon_name,
  color_class,
  service_path
) VALUES (
  'nurse_question_responder',
  62,
  'Nurse Question AI Assistant',
  'Generates evidence-based response suggestions for patient health questions submitted through the nurse dashboard. Uses patient context (conditions, medications, demographics) to provide compassionate, clinically appropriate draft responses for nurse review.',
  'When you send a health question to your care team, this tool helps nurses draft a response by reviewing your health information. A nurse always reviews and may edit the suggestion before sending it to you.',
  'clinical',
  'claude-haiku-4-5-20250929',
  true,
  'MessageCircle',
  'text-purple-600 bg-purple-100',
  'src/components/admin/nurse-questions/AISuggestionPanel.tsx'
) ON CONFLICT (skill_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  patient_description = EXCLUDED.patient_description,
  model = EXCLUDED.model;
