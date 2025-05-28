-- ✅ Migration Tracking Notes — Manual Migrations Already Applied
-- This file is used only for internal tracking of previously applied changes.
-- These were executed manually in Supabase and should be SKIPPED by CLI.

-- ⚠️ DO NOT DELETE THIS FILE. It prevents duplicate migration errors.
-- ⚠️ This is NOT an actual SQL script. No RLS policies are removed here.

-- 🟢 SKIPPED MIGRATIONS (already applied):
20250527203030_create_api_keys_table.sql             -- already applied
20250527203355_create_user_questions_table.sql       -- already applied
20250528021500_enable_profile_insert_policy.sql      -- already applied
20250528094500_add_city_state_zip_to_profiles.sql    -- already applied

-- 🧠 Dev Notes:
-- Use this file to list manually applied migrations you want the Supabase CLI to ignore.
-- New migrations should follow: `YYYYMMDDHHMMSS_action_description.sql`
-- If rollback logic is needed, add a corresponding `-- migrate:down` block.
-- Run `npx supabase migration repair` after confirming these are skipped.

-- 🔒 KEEP THIS FILE CLEAN AND CLEARLY LABELED TO PREVENT DEPLOYMENT MISTAKES.
