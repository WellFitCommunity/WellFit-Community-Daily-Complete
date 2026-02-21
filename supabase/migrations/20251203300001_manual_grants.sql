-- Run these GRANT statements manually in the Supabase SQL Editor
-- These were blocked because the migration partially ran

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_conditions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_phi_access(text, uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_provider_burnout_risk(uuid) TO authenticated;
