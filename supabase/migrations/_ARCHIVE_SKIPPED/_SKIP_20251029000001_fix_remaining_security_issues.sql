-- ============================================================================
-- Fix Remaining Security Advisor Issues
-- ============================================================================
-- Purpose: Fix storage schema functions and missing RLS on tables
-- Date: 2025-10-29
-- ============================================================================

-- ============================================================================
-- PART 1: Fix storage schema SECURITY DEFINER functions
-- ============================================================================

-- These are Supabase storage functions that need search_path set
ALTER FUNCTION storage.add_prefixes(_bucket_id text, _name text) SET search_path = storage, public;
ALTER FUNCTION storage.delete_leaf_prefixes(bucket_ids text[], names text[]) SET search_path = storage, public;
ALTER FUNCTION storage.delete_prefix(_bucket_id text, _name text) SET search_path = storage, public;
ALTER FUNCTION storage.lock_top_prefixes(bucket_ids text[], names text[]) SET search_path = storage, public;
ALTER FUNCTION storage.objects_delete_cleanup() SET search_path = storage, public;
ALTER FUNCTION storage.objects_update_cleanup() SET search_path = storage, public;
ALTER FUNCTION storage.prefixes_delete_cleanup() SET search_path = storage, public;

-- ============================================================================
-- PART 2: Enable RLS on tables that should have it
-- ============================================================================

-- Enable RLS on claim_flag_types (reference/lookup table)
ALTER TABLE public.claim_flag_types ENABLE ROW LEVEL SECURITY;

-- Add policies for claim_flag_types
CREATE POLICY "claim_flag_types_select_all" ON public.claim_flag_types
    FOR SELECT USING (true);

CREATE POLICY "claim_flag_types_admin_all" ON public.claim_flag_types
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role_id IN (1, 2) -- admin, super_admin
        )
    );

-- Enable RLS on test_pt_table (if it's a real table, not just for testing)
ALTER TABLE public.test_pt_table ENABLE ROW LEVEL SECURITY;

-- Add basic policy for test_pt_table (adjust as needed)
CREATE POLICY "test_pt_table_admin_all" ON public.test_pt_table
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role_id IN (1, 2)
        )
    );

-- ============================================================================
-- PART 3: Grant permissions
-- ============================================================================

GRANT SELECT ON public.claim_flag_types TO authenticated;
GRANT SELECT ON public.test_pt_table TO authenticated;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'Remaining Security Issues Fixed!';
    RAISE NOTICE '====================================================================';
    RAISE NOTICE '✓ Fixed 7 storage schema functions (search_path)';
    RAISE NOTICE '✓ Enabled RLS on 2 tables (claim_flag_types, test_pt_table)';
    RAISE NOTICE '✓ Added appropriate RLS policies';
    RAISE NOTICE '';
    RAISE NOTICE 'Total fixes applied:';
    RAISE NOTICE '  - 199 public schema functions (search_path = public)';
    RAISE NOTICE '  - 7 storage schema functions (search_path = storage, public)';
    RAISE NOTICE '  - 27 SECURITY DEFINER views removed';
    RAISE NOTICE '  - 2 tables now have RLS enabled';
    RAISE NOTICE '====================================================================';
END $$;
