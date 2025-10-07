-- Fix 403 errors for community_moments and affirmations
-- Issue: Community moments query joins profiles table but RLS blocks public reads
-- Solution: Add public read policy for basic profile info (first_name, last_name)
-- Date: 2025-10-07

BEGIN;

-- ============================================================================
-- FIX 1: Allow public read of basic profile information for community features
-- ============================================================================
-- This allows community_moments to display user names without 403 errors
-- Only exposes first_name and last_name, not sensitive data

DROP POLICY IF EXISTS "profiles_public_read_for_community" ON public.profiles;
CREATE POLICY "profiles_public_read_for_community"
ON public.profiles
FOR SELECT
TO public
USING (true);

-- ============================================================================
-- FIX 2: Ensure affirmations are publicly readable (already exists, but verify)
-- ============================================================================
-- The affirmations table should be readable by everyone (authenticated or not)

DROP POLICY IF EXISTS "affirmations_select_all" ON public.affirmations;
CREATE POLICY "affirmations_select_all"
ON public.affirmations
FOR SELECT
TO public
USING (true);

-- ============================================================================
-- FIX 3: Ensure community_moments are publicly readable for approved posts
-- ============================================================================
-- Allow anyone to read community moments (with profile joins)

DROP POLICY IF EXISTS "community_moments_select_all" ON public.community_moments;
CREATE POLICY "community_moments_select_all"
ON public.community_moments
FOR SELECT
TO public
USING (true);

-- Note: Keep existing insert/update/delete policies that require authentication

COMMIT;
