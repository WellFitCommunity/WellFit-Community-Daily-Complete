-- ============================================================================
-- Fix Security Events Table - Add Missing Columns
-- ============================================================================
-- Purpose: Add columns that the frontend code expects but weren't in the table
--
-- The code at DatabaseAuditLogger.ts tries to insert:
-- - auto_blocked (boolean)
-- - requires_investigation (boolean)
-- - category (text)
--
-- Without these columns, inserts fail with 400 Bad Request
-- ============================================================================

-- Add missing columns
ALTER TABLE public.security_events
ADD COLUMN IF NOT EXISTS auto_blocked BOOLEAN DEFAULT FALSE;

ALTER TABLE public.security_events
ADD COLUMN IF NOT EXISTS requires_investigation BOOLEAN DEFAULT FALSE;

-- Category might already exist but with a constraint - let's be safe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'security_events'
    AND column_name = 'category'
  ) THEN
    ALTER TABLE public.security_events ADD COLUMN category TEXT DEFAULT 'other';
  END IF;
END $$;

-- Create index for investigation queue
CREATE INDEX IF NOT EXISTS idx_security_events_investigation
ON public.security_events(requires_investigation, timestamp DESC)
WHERE requires_investigation = true;

-- Verification
DO $$
BEGIN
  RAISE NOTICE 'security_events columns added successfully';
  RAISE NOTICE '- auto_blocked column added';
  RAISE NOTICE '- requires_investigation column added';
END $$;
