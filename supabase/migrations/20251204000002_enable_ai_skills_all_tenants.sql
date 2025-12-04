-- ============================================================================
-- Enable All AI Skills for ALL Tenants
-- ============================================================================

-- Enable skills for all tenants
INSERT INTO public.ai_skill_config (
  tenant_id,
  cultural_health_coach_enabled,
  welfare_check_dispatcher_enabled,
  emergency_intelligence_enabled
)
SELECT
  t.id AS tenant_id,
  true,
  true,
  true
FROM public.tenants t
ON CONFLICT (tenant_id) DO UPDATE SET
  cultural_health_coach_enabled = true,
  welfare_check_dispatcher_enabled = true,
  emergency_intelligence_enabled = true,
  updated_at = now();

-- Verification
DO $$
DECLARE
  enabled_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO enabled_count FROM ai_skill_config WHERE cultural_health_coach_enabled = true;
  RAISE NOTICE 'AI skills enabled for % tenants', enabled_count;
END $$;
