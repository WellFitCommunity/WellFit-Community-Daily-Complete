-- Register NurseOS AI Skills in ai_skills table
-- P4-1: Burnout advisor, module recommendations, stress narrative
-- Tracker: docs/trackers/nurseos-completion-tracker.md

-- Skill 1: Burnout Advisor (primary skill — analyzes assessment + recommends interventions)
INSERT INTO public.ai_skills (
  skill_key, skill_number, name, description, patient_description,
  category, model, monthly_cost_estimate, is_active,
  service_path
) VALUES (
  'nurseos_burnout_advisor',
  61,
  'NurseOS Burnout Advisor',
  'Analyzes MBI burnout assessment scores, daily check-in patterns, and workload factors to generate personalized intervention recommendations for healthcare providers experiencing burnout.',
  'This tool helps your healthcare team stay well by analyzing workplace stress patterns and recommending support resources when a provider may be experiencing burnout.',
  'provider_wellness',
  'claude-sonnet-4-5-20250929',
  25.00,
  true,
  'supabase/functions/ai-nurseos-burnout-advisor'
) ON CONFLICT (skill_key) DO NOTHING;

-- Skill 2: Module Recommendations (suggests resilience training based on patterns)
INSERT INTO public.ai_skills (
  skill_key, skill_number, name, description, patient_description,
  category, model, monthly_cost_estimate, is_active,
  service_path
) VALUES (
  'nurseos_module_recommendations',
  62,
  'NurseOS Module Recommendations',
  'Analyzes provider check-in patterns, burnout dimensions, and training completion history to recommend specific resilience modules that address their current stress profile.',
  'This tool suggests wellness activities and training modules tailored to your healthcare provider''s current needs, helping them build resilience skills.',
  'provider_wellness',
  'claude-haiku-4-5-20250929',
  15.00,
  true,
  'supabase/functions/ai-nurseos-module-recommendations'
) ON CONFLICT (skill_key) DO NOTHING;

-- Skill 3: Stress Trend Narrative (generates plain-language trend summary)
INSERT INTO public.ai_skills (
  skill_key, skill_number, name, description, patient_description,
  category, model, monthly_cost_estimate, is_active,
  service_path
) VALUES (
  'nurseos_stress_narrative',
  63,
  'NurseOS Stress Trend Narrative',
  'Generates a plain-language narrative summarizing a provider''s stress trends over 7 and 30 days, correlating stress spikes with workload factors like patient census, overtime, and shift type.',
  'This tool creates easy-to-understand summaries of your healthcare provider''s stress patterns over time, helping identify what workplace factors may be contributing to burnout.',
  'provider_wellness',
  'claude-haiku-4-5-20250929',
  10.00,
  true,
  'supabase/functions/ai-nurseos-stress-narrative'
) ON CONFLICT (skill_key) DO NOTHING;
