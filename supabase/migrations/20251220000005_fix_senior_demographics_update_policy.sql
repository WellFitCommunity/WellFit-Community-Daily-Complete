-- Fix senior_demographics UPDATE policy
-- Previously required has_valid_privacy_consent() which blocks updates BEFORE consent flow
-- Demographics page comes BEFORE consent page, so consent can't exist yet
-- Solution: Allow users to update their own demographics without consent requirement

-- Drop the problematic policy that requires consent for UPDATE
DROP POLICY IF EXISTS "Users can update own demographics with consent" ON senior_demographics;

-- Create a simpler policy that allows users to update their own demographics
-- The consent check was too restrictive since demographics is filled out BEFORE consent
CREATE POLICY "Users can update own demographics" ON senior_demographics
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Also fix senior_health table if it has similar policy
DROP POLICY IF EXISTS "Users can update own health with consent" ON senior_health;

CREATE POLICY "Users can update own health" ON senior_health
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Fix senior_sdoh table if it has similar policy
DROP POLICY IF EXISTS "Users can update own sdoh with consent" ON senior_sdoh;

CREATE POLICY "Users can update own sdoh" ON senior_sdoh
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Fix senior_emergency_contacts table if it has similar policy
DROP POLICY IF EXISTS "Users can update own emergency contacts with consent" ON senior_emergency_contacts;

CREATE POLICY "Users can update own emergency contacts" ON senior_emergency_contacts
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
