-- Settings functionality (Session 1): persist display preferences on profiles.
-- Maria approved 2026-07-26 (settings-functionality-tracker.md).
--   preferred_language — language follows the user across devices (was localStorage-only)
--   theme — seniors get a light/dark/auto control persisted like font_size already is
-- Both nullable, no defaults, no backfill: NULL means "no explicit preference,
-- fall back to localStorage/browser/system" in code. Additive + DDL-only, so the
-- profiles no-JWT UPDATE guard trigger is not tripped.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language TEXT
    CHECK (preferred_language IN ('en', 'es', 'vi'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme TEXT
    CHECK (theme IN ('light', 'dark', 'auto'));

COMMENT ON COLUMN public.profiles.preferred_language IS
  'UI language (en/es/vi). NULL = no explicit choice; client falls back to localStorage then browser language.';
COMMENT ON COLUMN public.profiles.theme IS
  'UI theme (light/dark/auto). NULL = no explicit choice; client falls back to localStorage then system preference.';
