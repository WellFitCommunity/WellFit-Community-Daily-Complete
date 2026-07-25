# React Router v7 → v8 Migration Tracker

**Created:** 2026-07-25 · **Status:** SCHEDULED (Maria approved "later", not urgent)
**Trigger:** GHSA-qwww-vcr4-c8h2 (react-router RSC-mode CSRF, published 2026-07-24, patched only in 8.3.0). NOT applicable to this app (Vite SPA, no RSC/server router mode) — allowlisted in `audit-ci.json` with Maria's approval 2026-07-25. This migration removes the allowlist entry for good.

**Estimate:** 1–2 sessions (size Session 1 first — v7→v8 may be mostly non-breaking for library-mode SPA usage; do NOT assume either way).

---

## Current state (live-verified 2026-07-25)

| Fact | Value |
|---|---|
| Installed | `react-router-dom@7.18.1` (declared `^7.11.0` in package.json) |
| Target | `react-router@8.3.0`+ (latest at authoring: 8.3.0) |
| Usage mode | Library/declarative mode in a Vite SPA — no framework mode, no SSR, no RSC |
| Route registry | `src/routes/routeConfig.ts` (single source, ~line 700 has `/kiosk/check-in`) + `src/routes/lazyComponents.tsx` |
| Renderer | `RouteRenderer` (feature-flag filtering) — find via `grep -rn "RouteRenderer" src` |

## Exit criteria (all required — DONE MEANS DONE)

1. [ ] **Session 1 — size it:** read the official v7→v8 upgrade guide (https://reactrouter.com/upgrading) + CHANGELOG for 8.0–8.3. List every breaking change that touches library-mode APIs we use: `grep -rn "useNavigate\|useParams\|useLocation\|<Link\|<Navigate\|createBrowserRouter\|RouterProvider\|Routes\|Route " src --include="*.tsx" -l | wc -l` and enumerate the API surface actually used. If v8 is non-breaking for our surface, this collapses to a version bump + full regression pass.
2. [ ] Bump `react-router-dom` to `^8.3.0`, fix all typecheck/lint errors (full `npx tsc --noEmit` — routing types are widely imported; scoped typecheck is NOT sufficient per `feedback_scoped_typecheck_misses_transitive_errors`).
3. [ ] Full test suite on routing-adjacent files + `npm run build` green.
4. [ ] **Maria's visual acceptance (#13):** login → dashboard nav, senior check-in flow, My Health Hub sub-routes, admin panel deep links, `/kiosk/check-in`, browser back/forward, and a hard-refresh on a deep URL.
5. [ ] **Remove `GHSA-qwww-vcr4-c8h2` from `audit-ci.json` allowlist** and delete the rationale comment block in `.github/workflows/security-scan.yml` — the exception dies with the migration.
6. [ ] Security Scan green WITHOUT the allowlist entry.

## Standing check (any session, until migrated)

Watch for an upstream 7.x backport: `npm view react-router versions --json | jq '[.[] | select(startswith("7."))] | last'` — if a version > 7.18.1 appears, a patch bump + allowlist removal may close this tracker without the v8 migration (then v8 becomes a normal, unhurried upgrade).
