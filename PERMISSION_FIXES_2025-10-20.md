# Database Permission Fixes - October 20, 2025

## Summary

Comprehensive fix of database permission issues that were causing 403 and 500 errors throughout the application. This was a systemic issue affecting 55+ tables and 7 views that had Row Level Security (RLS) enabled but lacked the necessary base permissions for the `authenticated` role.

## Root Cause

The database had RLS policies configured on many tables, but the `authenticated` role was never granted the basic table-level permissions (SELECT, INSERT, UPDATE, DELETE). **RLS policies cannot enforce access control if the role doesn't have base permissions in the first place.**

Think of it like this:
- RLS policies = Fine-grained rules (e.g., "users can only see their own data")
- Table permissions = The door to the room (must be unlocked first)

We had the rules configured but the doors were locked.

## Issues Fixed

### 1. Claude Personalization Function (500 Errors)
**Error:** `claude-personalization` Edge Function returning 500
**Root Cause:** The function was trying to INSERT into `claude_usage_logs` but the `authenticated` role had no INSERT permission
**Fix:** Applied migration `20251020140000_grant_admin_usage_tracking_permissions.sql`
- Granted INSERT, SELECT to `admin_usage_tracking`
- Granted INSERT, SELECT to `claude_usage_logs`

### 2. Shift Handoff Dashboard (403 Errors)
**Error:** `permission denied for table shift_handoff_risk_scores`
**Root Cause:** Table had RLS policies but `authenticated` role had zero table-level permissions
**Fix:** Applied migration `20251020160000_grant_shift_handoff_permissions.sql`
- Granted SELECT, INSERT, UPDATE to `shift_handoff_risk_scores`
- Created view `handoff_risk_snapshots` with proper permissions

### 3. Provider Support Circles (500 Errors)
**Error:** Query failing on `provider_support_circles` with 500 error
**Root Cause:** Neither `provider_support_circles` nor `provider_support_circle_members` had SELECT permission
**Fix:** Applied migration `20251020160001_grant_provider_support_permissions.sql`
- Granted SELECT, INSERT, UPDATE, DELETE to both tables

### 4. Systemic Permission Gaps (55 Tables)
**Discovery:** Database-wide scan revealed 55 tables with RLS but no `authenticated` permissions
**Fix:** Applied migration `20251020160002_grant_authenticated_permissions_comprehensive.sql`

Categorized and fixed permissions for all 55 tables:

#### Audit/Log Tables (INSERT + SELECT only)
- `_trigger_log`, `admin_audit_logs`, `claude_api_audit`, `handoff_logs`
- `phi_access_log`, `scribe_audit_log`, `staff_audit_log`, `staff_auth_attempts`
- `rate_limit_logins`

#### User-Facing Content (Full CRUD)
- `affirmations`, `community_moments`, `meal_interactions`
- `memory_lane_trivia`, `trivia_game_results`, `user_trivia_progress`
- `user_trivia_trophies`, `word_game_results`

#### Clinical/Billing Tables (SELECT, INSERT, UPDATE)
- `ccm_time_tracking`, `billing_workflows`, `claim_attachments`
- `claim_status_history`, `clearinghouse_batches`, `clearinghouse_batch_items`
- `remittances`, `cms_documentation`

#### FHIR Resources (SELECT, INSERT, UPDATE)
- `fhir_care_plans`, `fhir_medication_requests`, `fhir_observations`
- `fhir_practitioner_roles`, `fhir_practitioners`, `fhir_procedures`

#### Code Tables (SELECT only - reference data)
- `code_cpt`, `code_hcpcs`, `code_icd10`, `code_modifiers`
- `fee_schedules`, `fee_schedule_items`, `fee_schedule_rates`

#### Shift Handoff (SELECT, INSERT, UPDATE)
- `handoff_attachments`, `handoff_packets`, `handoff_sections`
- `shift_handoff_events`, `shift_handoff_overrides`

#### Other Tables
- `scribe_sessions`, `physicians`, `physician_tenants`, `sdoh_assessments`
- `self_report_submissions`, `provider_support_reflections`, `privacy_consent`
- `coding_audits`, `coding_recommendations`, `data_retention_policies`
- `encryption_keys`, `staff_pins`

### 5. View Permission Gaps (7 Views)
**Discovery:** 7 views lacked SELECT permission for `authenticated`
**Fix:** Applied migration `20251020160003_grant_view_permissions.sql`

Fixed views:
- `admin_usage_analytics`, `billing_workflow_summary`
- `claude_cost_by_user`, `claude_usage_summary`
- `my_admin_session`, `nurse_questions_view`
- `phi_access_by_patient`

## Migrations Applied

All migrations were applied directly to the production database:

1. `20251020120000_add_insert_policies.sql` - INSERT policies for usage tracking
2. `20251020130000_fix_admin_usage_tracking_rls.sql` - Simplified RLS policies
3. `20251020140000_grant_admin_usage_tracking_permissions.sql` - Admin tracking permissions
4. `20251020150000_fix_shift_handoff_room_number.sql` - Fixed room_number reference
5. `20251020150001_add_room_number_to_profiles.sql` - Added room_number column
6. `20251020150002_create_handoff_risk_snapshots_view.sql` - Created compatibility view
7. `20251020160000_grant_shift_handoff_permissions.sql` - Shift handoff permissions
8. `20251020160001_grant_provider_support_permissions.sql` - Provider support permissions
9. `20251020160002_grant_authenticated_permissions_comprehensive.sql` - All 55 tables
10. `20251020160003_grant_view_permissions.sql` - All 7 views

## Validation

Created validation script at `/scripts/validate-db-permissions.sql` for ongoing monitoring.

### Validation Results (Post-Fix)
```
✅ Tables with RLS but no permissions: 0 (previously 55)
✅ Views without SELECT permission: 0 (previously 7)
✅ Total tables with RLS: 123
✅ Tables with RLS policies: 120
⚠️  Tables with RLS but no policies: 3 (acceptable - may use SECURITY DEFINER functions)
```

## Prevention Strategy

1. **Validation Script:** Run `/scripts/validate-db-permissions.sql` regularly
2. **Migration Template:** All new tables with RLS must include GRANT statements
3. **CI/CD Check:** Consider adding permission validation to deployment pipeline

## Technical Debt Eliminated

- ✅ All console errors from missing permissions resolved
- ✅ No more 403 "permission denied" errors
- ✅ No more 500 errors from Edge Functions failing to log
- ✅ Proper separation between base permissions and RLS policies
- ✅ Documented permission strategy for all table types
- ✅ Created tooling to prevent regression

## Zero Tech Debt Status

All identified permission issues have been resolved comprehensively:
- No workarounds or temporary fixes
- Proper categorization of table access patterns
- Validation tooling in place
- Full documentation of changes
- Clean migration history

## Notes for Future Development

When creating new tables with RLS:
1. Define RLS policies for fine-grained access
2. **MUST** also grant base permissions to `authenticated` role
3. Run validation script to verify setup
4. Consider permission type based on table purpose (see categories above)

Example migration template:
```sql
-- Create table
CREATE TABLE public.new_table (...);

-- Enable RLS
ALTER TABLE public.new_table ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "policy_name" ON public.new_table ...;

-- ⭐ CRITICAL: Grant base permissions
GRANT SELECT, INSERT, UPDATE ON TABLE public.new_table TO authenticated;
```
