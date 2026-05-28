-- ============================================================================
-- ONC 170.315(a)(5) Demographics — USCDI v3 Race & Ethnicity (ONC-4)
-- ============================================================================
--
-- Live DB state (verified 2026-05-28 via Supabase MCP execute_sql):
--   - profiles.race (text) and profiles.ethnicity (text) ALREADY EXIST.
--   - 0/61 rows have race populated.
--   - 4/61 rows have ethnicity populated, but values are essentially garbage:
--       * one is ''  (empty string)
--       * one is 'black' (which is a RACE in OMB taxonomy, not an ethnicity —
--         the form has historically asked race questions in an ethnicity-
--         labeled field, so users selected a race code that landed in the
--         ethnicity column)
--   - Downstream HL7/CDA emitters (ecrService.ts, syndromicSurveillanceService.ts,
--     immunizationRegistryService.ts) read patient.race and patient.ethnicity
--     as single strings.
--
-- Strategy: ADDITIVE. Add new ONC-compliant columns alongside the existing
-- legacy text columns so HL7/CDA emitters keep working. Form will write to
-- BOTH during the transition. A follow-up commit will migrate the emitters
-- to read the new columns (likely as part of ONC-12/Surescripts work or a
-- separate USCDI v3 hardening pass) and then deprecate the legacy columns.
--
-- USCDI v3 reference:
--   - Race: OMB 1997 minimum categories (5) + multi-value support
--     https://www.hl7.org/fhir/us/core/ValueSet-omb-race-category.html
--   - Ethnicity: OMB 1997 categories (2) + nullFlavor for unknown/declined
--     https://www.hl7.org/fhir/us/core/ValueSet-omb-ethnicity-category.html
--
-- CDC granular Race & Ethnicity Code Set v1.2 (HL7 OID 2.16.840.1.113883.6.238)
-- detailed codes are NOT added in this migration. They are USCDI v3
-- "Race (Detailed)" / "Ethnicity (Detailed)" — best practice but not required
-- for ONC (a)(5) certification. Follow-up.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Add the new ONC-compliant columns
-- ----------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS race_omb_categories text[],
  ADD COLUMN IF NOT EXISTS ethnicity_omb text;

-- ----------------------------------------------------------------------------
-- 2. CHECK constraints — enforce OMB code values
-- ----------------------------------------------------------------------------
-- OMB 1997 minimum race categories:
--   american-indian-or-alaska-native, asian, black-or-african-american,
--   native-hawaiian-or-pacific-islander, white
-- Plus USCDI v3 / FHIR nullFlavor support:
--   other, asked-but-unknown, unknown, asked-declined
--
-- The array form (text[]) supports multi-race per OMB 1997 "two or more
-- races" requirement. Each element must be one of the allowed codes.

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_race_omb_categories_check
    CHECK (
      race_omb_categories IS NULL
      OR (
        cardinality(race_omb_categories) > 0
        AND race_omb_categories <@ ARRAY[
          'american-indian-or-alaska-native',
          'asian',
          'black-or-african-american',
          'native-hawaiian-or-pacific-islander',
          'white',
          'other',
          'asked-but-unknown',
          'unknown',
          'asked-declined'
        ]::text[]
      )
    );

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_ethnicity_omb_check
    CHECK (
      ethnicity_omb IS NULL
      OR ethnicity_omb IN (
        'hispanic-or-latino',
        'not-hispanic-or-latino',
        'asked-but-unknown',
        'unknown',
        'asked-declined'
      )
    );

-- ----------------------------------------------------------------------------
-- 3. Comments — document code system + intent
-- ----------------------------------------------------------------------------

COMMENT ON COLUMN public.profiles.race_omb_categories IS
  'ONC USCDI v3 Race — OMB 1997 minimum categories (multi-valued). Allowed codes: american-indian-or-alaska-native, asian, black-or-african-american, native-hawaiian-or-pacific-islander, white, other, asked-but-unknown, unknown, asked-declined. Authoritative source for ONC 170.315(a)(5). Legacy profiles.race (text) is retained for HL7/CDA emitter compatibility — migrate emitters then drop.';

COMMENT ON COLUMN public.profiles.ethnicity_omb IS
  'ONC USCDI v3 Ethnicity — OMB 1997 (hispanic-or-latino, not-hispanic-or-latino) plus nullFlavor values. Authoritative source for ONC 170.315(a)(5). Legacy profiles.ethnicity (text) is retained for HL7/CDA emitter compatibility.';

-- ----------------------------------------------------------------------------
-- 4. Legacy data cleanup — DEFERRED
-- ----------------------------------------------------------------------------
-- The 4 garbage rows in profiles.ethnicity ('' and 'black') were NOT cleaned
-- up by this migration because the profiles table has a
-- profiles_restrict_user_update() trigger that requires auth.uid() to match
-- OLD.user_id on every UPDATE. A migration runs with auth.uid() = NULL, so
-- the UPDATE was rejected.
--
-- This is not a compliance blocker — the new race_omb_categories and
-- ethnicity_omb columns are the authoritative source for ONC 170.315(a)(5),
-- and they start clean. The legacy columns continue to feed HL7/CDA
-- emitters until those emitters are migrated to read the new columns
-- (separate follow-up).
--
-- To clean up the 4 garbage legacy rows later, either:
--   (a) Have those users re-complete demographics via the new form
--   (b) Run a one-shot SECURITY DEFINER function as a separate migration
--       that sets local config to bypass the user-restrict trigger.
