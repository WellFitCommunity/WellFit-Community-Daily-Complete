-- Register the equity-analytics plain-language translator as an AI skill (ai-services.md).
-- This skill turns a person's English question into a whitelisted aggregate spec. It NEVER sees
-- patient data and NEVER writes SQL — it only chooses fields from the catalog. Model is pinned
-- (no 'latest'); patient_description provided for ONC HTI-2 algorithm transparency.

INSERT INTO public.ai_skills (
  skill_key, skill_number, name, description, category, model, is_active,
  service_path, patient_description
) VALUES (
  'equity_analytics_nl_translator',
  65,
  'Equity Analytics — Plain-Language Translator',
  'Translates a natural-language population-health question into a whitelisted aggregate spec '
    || '(source + measure + dimensions chosen from a server catalog) for the equity-analytics engine. '
    || 'Uses forced tool-use structured output; the model never authors SQL and never sees patient rows. '
    || 'The spec is re-validated against the catalog before the deterministic engine runs it.',
  'decision_support',
  'claude-sonnet-4-5-20250929',
  true,
  'supabase/functions/equity-analytics/nlTranslator.ts',
  'When a staff member types a question like "show food insecurity by race," this tool turns the '
    || 'sentence into a safe request for grouped, de-identified statistics. It only ever works with '
    || 'aggregate counts and percentages — it cannot see, request, or reveal any individual person''s information.'
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
