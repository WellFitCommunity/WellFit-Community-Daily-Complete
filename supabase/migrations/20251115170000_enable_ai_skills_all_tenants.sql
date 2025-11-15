-- ============================================================================
-- Enable All AI Skills for ALL Tenants
-- Only updates columns that exist from 20251115140000_ai_skills_6_10_11.sql
-- ============================================================================

BEGIN;

-- Enable skills for all tenants (only updating columns we know exist)
INSERT INTO public.ai_skill_config (
  tenant_id,
  cultural_health_coach_enabled,
  welfare_check_dispatcher_enabled,
  emergency_intelligence_enabled
)
SELECT
  t.id AS tenant_id,
  true, -- cultural_health_coach_enabled
  true, -- welfare_check_dispatcher_enabled
  true  -- emergency_intelligence_enabled
FROM public.tenants t
ON CONFLICT (tenant_id) DO UPDATE SET
  cultural_health_coach_enabled = true,
  welfare_check_dispatcher_enabled = true,
  emergency_intelligence_enabled = true,
  updated_at = now();

COMMIT;
