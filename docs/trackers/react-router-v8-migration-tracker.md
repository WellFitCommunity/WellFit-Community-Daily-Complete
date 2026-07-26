# React Router v7 → v8 Migration — Plan of Action

**Created:** 2026-07-25 · **Sized:** 2026-07-25 (changelog read, full surface mapped) · **Status:** CODE-COMPLETE 2026-07-26 — all gates green, allowlist deleted; AWAITING frontend deploy + Maria's visual pass (Phase 6 items 2–3)
**Approved:** Maria 2026-07-25 ("do the exception and schedule v8 for later")

## Execution record (2026-07-26)

- Pre-flight: no 7.x backport (latest 7.x = 7.18.1) → v8 proceeded. Node 24.18.0 via nvm (`/usr/local/share/nvm`).
- Phase 1: `react-router@8.3.0`, react/react-dom `19.2.8` (`overrides` block also bumped — npm EOVERRIDE if dependency and override disagree).
- Phase 2: 217 source files renamed (surface had grown from the 199 measured at sizing) — 0 residue.
- Phase 3: all 36 mock files renamed and re-run (629 tests pass). Deletion-test spot-check on PatientAvatar.test.tsx: re-aiming the mock at the dead `'react-router-dom'` specifier made 3 tests fail → mocks are load-bearing, not no-ops.
- **Sizing correction discovered:** the app IS in data-router mode — `createHashRouter` + `RouterProvider` + `errorElement` (`src/routes/createAppRouter.tsx`, `src/index.tsx`). The sizing grep checked `createBrowserRouter` only. No impact: zero loaders/actions/`useLoaderData`/`defer`/`json()` anywhere, so the rename-only verdict held.
- **One unplanned change:** `tsconfig.json` `moduleResolution: "Node"` → `"bundler"` — v8 is an `exports`-only package that classic Node resolution cannot see (TS2307 on every import). `"bundler"` is the canonical Vite setting; full tsc confirmed 0 fallout project-wide. `tsconfig.scripts.json` is independent (no extends).
- Phase 4 gates: full tsc **0 errors**; lint **0/0**; routing tests **660 passed, 0 failed, 0 skipped** (36 mock files + App.test + routes tests); `npm run build` green (1m11s); dev-server boot smoke HTTP 200, no errors.
- Phase 5: allowlist emptied, workflow rationale block deleted, `npx audit-ci --config audit-ci.json` passes with **empty allowlist**.
- Phase 6 remaining: frontend deploy, then Maria's visual checklist below.

---

## Why this exists

GHSA-qwww-vcr4-c8h2 (react-router RSC-mode CSRF, published 2026-07-24, patched only in 8.x) turned the Security Scan red. The advisory is **not applicable** to this Vite SPA (no RSC/server router mode) and is allowlisted in `audit-ci.json` with rationale in `.github/workflows/security-scan.yml`. **This migration's job is to make that exception unnecessary and delete it.**

## Sizing verdict (2026-07-25 — do not re-derive)

The v8.0.0 changelog was read in full and mapped against this codebase. **Zero behavioral/API changes affect us.** Every breaking change is framework-mode/SSR/data-router-only (middleware, pass-through requests, split route modules, `meta`/`hasErrorBoundary` removals) — this app has **0 hits** on `createBrowserRouter`, `useLoaderData`, route loaders, `useRouteError`. Our entire API surface (`BrowserRouter`, `Routes`/`Route`, `useNavigate` ×160 files, `Link` ×73, `Navigate`, `useParams`, `useLocation`, `useSearchParams`) is unchanged in v8.

The migration is **rename-shaped**: the `react-router-dom` package is discontinued; imports move to `react-router`.

| Measured surface (2026-07-25) | Count |
|---|---|
| Files importing `react-router-dom` | **199** |
| Test files mocking `'react-router-dom'` by name | **36** ← the real risk |
| React | `^19.2.0` → needs ≥ **19.2.7** (patch bump) |
| Vite | `^7.3.0` ✓ (v8 needs 7+) |
| Node — CI | 24 ✓ (v8 needs 22.22+) |
| Node — codespace | v20 ✗ → `nvm install 24 && nvm alias default 24` before building |

**No codemod exists upstream; TypeScript errors guide stragglers.** No future-flags prep needed (we set none).

---

## Pre-flight (5 min — run before anything)

1. **Backport check — this may cancel the whole session:**
   `npm view react-router versions --json | jq '[.[] | select(startswith("7."))] | last'`
   If > `7.18.1` exists AND `npm audit` clears with it: patch-bump instead, remove the allowlist entry (Phase 5), done. v8 then becomes leisure.
2. Confirm clean working tree + green CI on HEAD.
3. `nvm install 24 && nvm use 24` in the codespace (v8 engines: Node ≥22.22).

## Phase 1 — Dependency swap (~15 min)

1. `npm uninstall react-router-dom && npm install react-router@^8.3.0` (or latest 8.x — re-check `npm view react-router version`).
2. `npm install react@^19.2.7 react-dom@^19.2.7` (v8 peer minimum).
3. Check for stragglers that also declare it: `grep -rn "react-router" package.json` — expect only `react-router`.

## Phase 2 — Import rename, source files (~30 min, mechanical)

1. Sweep (both quote styles, and deep paths like `react-router-dom/...` if any — check first: `grep -rn "react-router-dom/" src | head`):
   ```bash
   grep -rl "react-router-dom" src --include='*.ts' --include='*.tsx' \
     | xargs sed -i "s|from 'react-router-dom'|from 'react-router'|g; s|from \"react-router-dom\"|from \"react-router\"|g"
   ```
2. Zero-tolerance residue check: `grep -rn "react-router-dom" src | wc -l` → **must be 0** (test mocks included — they're handled in Phase 3 but the sed above already rewrote import lines; mocks use a different syntax).

## Phase 3 — The 36 test mocks (INDIVIDUAL attention, not sed) (~1–2 hrs)

`vi.mock('react-router-dom', ...)` silently stops applying once code imports `'react-router'` — a mock aimed at a module nobody imports is a no-op, and some tests would then exercise the REAL router and pass/fail for wrong reasons. This is the silent-failure class this repo documents (`vi.clearAllMocks` lesson, mock-leakage lesson).

1. List them: `grep -rln "mock('react-router-dom'\|mock(\"react-router-dom\"" src --include='*.test.*'`
2. For EACH file: change the mock specifier to `'react-router'`, then **run that file** and confirm it still passes for the right reason (spot-check one assertion by temporarily breaking the mock — deletion-test spirit).
3. Sweep for partial-mock passthroughs: `importActual('react-router-dom')` → `importActual('react-router')`.
4. Residue gate: `grep -rn "react-router-dom" src` → **0 lines, no exceptions**.

## Phase 4 — Verification gates (in this order)

1. **Full** typecheck (routing types imported everywhere — scoped is insufficient per `feedback_scoped_typecheck_misses_transitive_errors`):
   `NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit` → 0 errors.
2. Routing-adjacent tests (NOT the full 11k suite — `feedback_no_full_test_suite`): the 36 mock files + `src/routes/` tests + App-level tests. All pass, 0 skipped.
3. `npm run lint` → 0 errors, no new warnings.
4. `npm run build` → green; note bundle-size delta.
5. `npm run dev` smoke: app boots, no console router errors.

## Phase 5 — Kill the exception (the point of it all)

1. Remove `"GHSA-qwww-vcr4-c8h2"` from `audit-ci.json` allowlist.
2. Delete the rationale comment block at the audit-ci gate in `.github/workflows/security-scan.yml` (keep the `--config audit-ci.json` invocation — that structural fix stays).
3. `npx audit-ci --config audit-ci.json` locally → passes with **empty allowlist**.

## Phase 6 — Ship + visual acceptance

1. Commit (verification counts in message), push, **watch Security Scan go green without the allowlist**.
2. Frontend deploy (router ships in the bundle — nothing is live until deployed).
3. **⚑ Maria visual acceptance (#13)** — the routing layer sits under every page:
   - [ ] Login → dashboard navigation (both products' entry paths)
   - [ ] Senior daily check-in flow end-to-end
   - [ ] My Health Hub + at least two sub-routes (`/health-observations`, `/medicine-cabinet`)
   - [ ] Admin panel deep link (e.g., `/admin/family-history/:patientId` via PatientChartNavigator)
   - [ ] `/kiosk/check-in` (public route, no auth)
   - [ ] Browser back/forward through 3+ pages
   - [ ] Hard refresh on a deep URL (SPA fallback still routes)
4. Update this tracker → CLOSED, update `PROJECT_STATE.md`.

## Rollback

Single revert commit restores `react-router-dom@7.18.1` + the allowlist entry (keep the allowlist-removal in the same commit as the migration so revert is atomic). No data/schema involvement — frontend-only.

## Explicitly out of scope

- Adopting data routers / loaders / framework mode — separate product decision, never a migration side effect.
- Any route ADDITIONS or reordering (Tier 3, `src/App.tsx`/routeConfig changes beyond import lines).
- Touching the 2 files matching `RouterProvider` without first confirming they're real usages, not test scaffolding.
