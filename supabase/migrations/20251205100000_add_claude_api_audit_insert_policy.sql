-- Migration: Add INSERT policy for claude_api_audit table
-- Date: 2025-12-05
-- Purpose: Allow authenticated users to insert their own audit records
-- This is needed for the claude-chat edge function to log API usage

-- First, check if a policy for INSERT already exists and drop it
DROP POLICY IF EXISTS "Authenticated users can insert their own audit records" ON claude_api_audit;
DROP POLICY IF EXISTS "Users can insert own audit records" ON claude_api_audit;

-- Create INSERT policy: Users can only insert records for themselves
CREATE POLICY "Authenticated users can insert their own audit records"
  ON claude_api_audit
  FOR INSERT
  WITH CHECK (
    -- User can only insert audit records for their own user_id
    user_id = auth.uid()
  );

-- Also ensure users can view their own audit records
DROP POLICY IF EXISTS "Users can view own Claude usage" ON claude_api_audit;

CREATE POLICY "Users can view own Claude usage"
  ON claude_api_audit
  FOR SELECT
  USING (
    user_id = auth.uid()
  );

-- Comment for documentation
COMMENT ON POLICY "Authenticated users can insert their own audit records" ON claude_api_audit IS
  'Allows authenticated users to insert audit records for their own Claude API usage. Used by claude-chat edge function.';

COMMENT ON POLICY "Users can view own Claude usage" ON claude_api_audit IS
  'Allows users to view their own Claude API usage records for transparency and budgeting.';
