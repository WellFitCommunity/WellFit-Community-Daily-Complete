-- Migration: Fix senior table RLS policies that required consent before data could be saved
-- Issue: Demographics page comes BEFORE consent page, but SELECT policies required consent
-- This caused 400 errors on upsert because Supabase needs SELECT to check if row exists

-- Fix senior_health: Allow users to view their own data (consent checked at app layer)
DROP POLICY IF EXISTS "Users can view own health data with consent" ON senior_health;
CREATE POLICY "Users can view own health data" ON senior_health
  FOR SELECT USING (user_id = auth.uid());

-- Fix senior_sdoh: Allow users to view their own SDOH data
DROP POLICY IF EXISTS "Users can view own SDOH with consent" ON senior_sdoh;
CREATE POLICY "Users can view own SDOH data" ON senior_sdoh
  FOR SELECT USING (user_id = auth.uid());

-- Fix senior_demographics: Allow users to view their own demographics
DROP POLICY IF EXISTS "Users can view own demographics with consent" ON senior_demographics;
CREATE POLICY "Users can view own demographics" ON senior_demographics
  FOR SELECT USING (user_id = auth.uid());

-- Note: Privacy consent is still enforced at the application layer for PHI access
-- These tables need to be writable during the registration flow before consent is complete

-- Fix profiles INSERT policy - remove complex tenant check that was blocking upserts
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Remove complex tenant UPDATE policy - keep simple profiles_update_own
DROP POLICY IF EXISTS "profiles_tenant_update" ON profiles;
