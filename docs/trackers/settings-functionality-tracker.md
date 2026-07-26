# Settings Must Actually Work — Theme, Language, Font Size, Notifications

**Created:** 2026-07-26 · **Status:** SESSION 1 IN PROGRESS
**Approved:** Maria 2026-07-26 — "i need settings to actually work light and dark mode and languages amongst other things"
**Scope decisions (Maria, 2026-07-26 via question round):** dark mode = senior surfaces + admin shell first (clinical panels later phase); languages = senior-facing surfaces (clinical stays English); `profiles.preferred_language` column approved (Tier 3 OK).

---

## Diagnosis (live-verified 2026-07-26 — do not re-derive)

Settings SAVE correctly (all columns live-verified via psql `information_schema.columns`) but almost nothing RESPONDS:

| Setting | Persisted where | What actually happens today |
|---|---|---|
| Theme (admin toggle) | `admin_settings.theme` + localStorage `admin_theme`; `dark` class toggled on `<html>` by `useThemeInit` (wired in `RootLayout.tsx:59` + `App.tsx:49`) | **Nothing.** Only 2 files in src use `dark:` variants, and Tailwind v4 has no class-based dark variant configured (`@config ../tailwind.config.cjs` has no `darkMode` key; no `@custom-variant dark` in `src/index.css`) → `dark:` styles follow the OS media query, not the class. Toggle is dead. |
| Theme (seniors) | — | No control exists at all. |
| Language | localStorage `wellfit_language` only. en/es/vi translations exist (`src/i18n/translations.ts`, 630 lines); `LanguageProvider` wraps the app (`index.tsx:146`) | Only **5 consumers**: LanguageSelector, GlobalHeader, SeniorCommunityDashboard, SettingsPage, the context itself. Everything else hardcoded English. Not persisted to DB (`profiles.preferred_language` does NOT exist — verified). |
| Font size | `profiles.font_size` ('small'\|'medium'\|'large'\|'extra-large') | **Zero consumers apply it.** Dead control. |
| Notifications / reminder time / timezone | `profiles.notifications_enabled`, `daily_reminder_time`, `timezone`, `care_team_notifications`, `community_notifications` | Persisted; whether reminder/notification edge functions respect them is UNVERIFIED (Session 3 job). |

Also: `SettingsPage.tsx` is **671 lines** (>600 limit) with **3 silent-swallow catch/error blocks** (lines ~61, ~84, ~116) — fix while in there.

Key files: `src/hooks/useTheme.ts` · `src/contexts/LanguageContext.tsx` · `src/pages/SettingsPage.tsx` · `src/components/admin/AdminSettingsPanel.tsx` · `src/components/LanguageSelector.tsx` · `src/i18n/translations.ts` · `src/index.css` (Tailwind v4, `@import 'tailwindcss'` + legacy `@config`).

---

## Session 1 — Infrastructure: every control mechanically works (✅ DONE 2026-07-26)

**Execution record:** all 8 items below shipped. Gates: full tsc 0 errors · lint 0/0 · 116 tests passed 0 failed (19 new across useTheme/LanguageContext/SettingsPage + all affected suites) · build green · live rolled-back round-trip proven (theme/language/font_size land in profiles under simulated JWT claims; CHECK rejects invalid values; zero residue). Migration `20260726120000_profiles_display_prefs.sql` pushed + live-verified (columns + CHECK constraints). Extra fixes while in there: SettingsPage 671→370 lines (sections decomposed to `src/pages/settings/`), 3 silent-swallow catches now audit-logged with user-visible errors, "Download My Data" button navigated to `/settings` (itself) → now `/health-records-download`, toggle buttons got `role="switch"` + aria labels, label/input `htmlFor`/`id` pairing added, Arizona timezone added. `profiles.theme` column included in the migration under the same rationale as `preferred_language` (font_size precedent) — surfaced to Maria in the Session-1 report. NOTE: db-objects snapshot NOT refreshed — the migration adds only columns; the snapshot tracks tables/views/functions, which are unchanged. **⚑ Maria visual acceptance (#13) pending: settings page in light + dark, text-size change, language switch — one walk covers it.**

1. **Class-based dark variant:** add `@custom-variant dark (&:where(.dark, .dark *));` to `src/index.css` (v4-canonical; composes with legacy `@config`). Acceptance: toggling the `dark` class flips `dark:` styles regardless of OS setting.
2. **Migration `20260726*_profiles_display_prefs.sql`:** `profiles.preferred_language TEXT CHECK (preferred_language IN ('en','es','vi'))` (Maria-approved) + `profiles.theme TEXT CHECK (theme IN ('light','dark','auto'))` (same decision shape — surfaced to Maria in the Session-1 report; nullable, no defaults, no backfill — ADD COLUMN DDL does not trip the profiles guard trigger which blocks no-JWT UPDATEs). Apply + live-verify columns exist (db push footgun memory: verify the live object after push).
3. **`useTheme.ts`:** read order = `profiles.theme` (any signed-in user) → `admin_settings.theme` (legacy admin fallback) → localStorage → system. Export a `setTheme(theme)` helper both settings UIs call (applies class + localStorage + persists to `profiles.theme`). New `useFontSizeInit()` in same file: reads `profiles.font_size`, applies root `documentElement.style.fontSize` (small 87.5% / medium 100% / large 112.5% / extra-large 125% — rem-based Tailwind utilities scale app-wide with zero per-component work). Wire in `RootLayout` (+ `App.tsx` if it's a live entry — verify, don't assume).
4. **`LanguageContext.tsx`:** after auth resolves, read `profiles.preferred_language` and override localStorage; `setLanguage` persists to localStorage + `profiles` (fire-and-forget, auditLogger on error, never console).
5. **SettingsPage repair:** add Theme control to Display section (light/dark/auto, senior-friendly big buttons, translated labels); font-size control now takes visible effect immediately on save AND on change (live preview); fix the 3 silent catches (auditLogger + user-visible failure message); decompose to <600 lines (extract section components to `src/pages/settings/`).
6. **Immediate visible proof surface:** SettingsPage + AdminSettingsPanel + GlobalHeader get `dark:` styling so the toggle visibly does something the moment Session 1 ships.
7. **Tests:** LanguageContext persistence, useTheme read-order + setTheme, font-size application, SettingsPage save round-trip (deletion-test quality; synthetic data).
8. Gates: scoped tsc (+ full tsc — LanguageContext/useTheme are widely imported), lint, scoped tests, build. Live round-trip proof: save theme/language/font in DB as a real user, values land in `profiles` (rolled back or swept per live-proof rules).

## Session 2 — Dark-mode styling coverage (✅ CODE-COMPLETE 2026-07-26, visual pass pending)

**Executed as a consolidated tree sweep** (Maria mid-session: "consolidate and pull it together" — page-by-page cherry-picking was missing the sub-component trees where the real content lives). Method: mechanical light→dark class mapper (`darkify.sh` pattern: each light-only utility gets a WCAG-safe slate-family `dark:` twin; guards prevent matching inside `hover:`/opacity variants; run-once per file) + manual residue scan + hand-fixes.

**Coverage (68 files this session, 77 files with `dark:` total):** entire `src/components/patient/**` (incl. medicine-cabinet/*, ConsentManagement/*, the five My Health managers), `src/components/dashboard/**`, `src/components/check-in/**`, `src/components/community/**`, `src/components/devices/**` + `src/pages/devices/**` (BLE device pages), all My Health Hub pages, Login/Register, CheckInTracker, HealthInsights/HealthTracker/CheckInHistory pages, LanguageSelector, WhatsNewSeniorModal. AdminHeader + DashboardHub inspected — **natively dark-styled already** (slate-900/brand navy), nothing needed. Clinical admin panels untouched (later phase per Maria's scoping).

**Design decisions:** brand gradients on page shells KEPT in dark (cards/tiles go dark on top of them — SettingsPage's S1 overlay treatment is the exception); saturated mid-tone elements (blue/green-500 buttons, status dots) left as-is (identical contrast both themes); light-flash `hover:bg-*-50` icon buttons got dark hovers.

**Gates:** full tsc 0 · lint 0/0 · 226 tests passed 0 failed across all 17 test suites of swept components · build green.

**⚑ Maria visual acceptance (#13) REQUIRED and pending** — dark + light walk of: dashboard, check-in flow, My Health Hub + managers (allergies/conditions/care plans/immunizations/observations), Medicine Cabinet, a BLE device page, login/register, settings. One walk covers Session 1+2.

## Session 3 — Language coverage (senior surfaces) + "other things"

- Translation sweep of the Session-2 senior surface list: every hardcoded string → `t()` key; expand `translations.ts` en/es/vi (split per-domain files if >600 lines; es/vi translations flagged to Maria/Akima for human review before pilot use).
- LanguageSelector reachable from senior settings + registration.
- **Notifications verification:** live-verify `send-checkin-reminders` / `send-check-in-reminder-sms` respect `daily_reminder_time`, `timezone`, `notifications_enabled`, `care_team_notifications`, `community_notifications`. Repair if they ignore them (likely — verify first). Timezone control: confirm the timezone list is real IANA zones.
- Font-size QA on senior surfaces at extra-large (no broken layouts) — part of Maria's visual pass.

## Later phase (explicitly deferred by Maria's scoping, not hidden defects)

- Dark mode on clinical admin panels (~71 components).
- Clinical-surface translation (needs Akima safety review).

## Rollback

Each session ships independently; Session 1 is additive (new columns nullable, dark variant inert until `dark:` classes exist). Single-commit reverts per session.
