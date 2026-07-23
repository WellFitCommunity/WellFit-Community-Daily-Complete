-- Register the vital-image vision OCR as an AI skill (ai-services.md).
-- Server-side extraction of vital-sign readings from photos of home medical
-- device displays (BP cuffs, glucometers, scales, thermometers, pulse oximeters).
-- The model is a TRANSCRIPTION boundary only: it reports the digits visible on
-- the device screen as labeled text; deterministic physiological-range parsers
-- in the edge function validate before any value reaches the client.
-- Model pinned (no 'latest'); patient_description provided for ONC HTI-2.
-- Live-verified 2026-07-23: max skill_number was 65; no existing vital/ocr/image skill.

INSERT INTO public.ai_skills (
  skill_key, skill_number, name, description, category, model, is_active,
  service_path, patient_description
) VALUES (
  'vital_image_ocr',
  66,
  'Vital Sign Photo Reader',
  'Transcribes the numbers shown on a photographed home medical device display '
    || '(blood pressure monitor, glucometer, scale, thermometer, pulse oximeter) into labeled text. '
    || 'The model never interprets or invents values — it reports only digits visible on the screen, '
    || 'and every value is re-validated against physiological ranges by deterministic parsers '
    || 'before being returned. Unreadable or non-device images are rejected, falling back to manual entry.',
  'patient_engagement',
  'claude-sonnet-5',
  true,
  'supabase/functions/process-vital-image/index.ts',
  'When you take a photo of your blood pressure monitor, glucose meter, scale, or thermometer, '
    || 'this tool reads the numbers on the screen so you don''t have to type them in. '
    || 'It only reads what is actually shown on your device — if the photo is unclear, '
    || 'it will ask you to enter the numbers yourself instead of guessing. '
    || 'You always see and confirm the numbers before they are saved.'
)
ON CONFLICT (skill_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  model = EXCLUDED.model,
  is_active = EXCLUDED.is_active,
  service_path = EXCLUDED.service_path,
  patient_description = EXCLUDED.patient_description,
  updated_at = now();
