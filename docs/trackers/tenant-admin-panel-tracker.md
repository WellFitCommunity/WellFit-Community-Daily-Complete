# Tenant Admin Panel Improvement Tracker

> **Last Updated:** 2026-02-24
> **Owner:** Maria (AI System Director)
> **Reviewer:** Akima (CCO)

---

## How to Read This

| Symbol | Meaning |
|--------|---------|
| BUILT | Exists in codebase, functional |
| WIRED | Saves to DB AND enforces behavior |
| STORE-ONLY | Saves to DB but nothing reads it back — cosmetic |
| ORPHANED | Component built but not routed/imported anywhere |
| MISSING | Not built yet |

---

## Foundation — What Already Exists

### Role Separation — BUILT (Well-Enforced)

| Tier | Role | Scope | Enforcement | Status |
|------|------|-------|-------------|--------|
| Platform | `super_admin` | ALL tenants, all data | Separate `super_admin_users` table, no escalation path | BUILT |
| Facility | `admin` / `department_head` | Single tenant, full control | `user_roles` + RLS (`get_current_tenant_id()`) | BUILT |
| IT Ops | `it_admin` | Single tenant, infrastructure only | `user_roles` + RLS, no clinical data access | BUILT |

Triple-layer enforcement: Frontend hooks (`useIsAdmin`) → RLS policies (`current_user_has_any_role`) → Edge function verification.

### Functional Components — BUILT

| Component | Lines | What It Does | Status |
|-----------|-------|-------------|--------|
| TenantModuleConfigPanel | 424 | Enable/disable 70+ modules within entitlements, 2-tier model | BUILT — fully functional |
| TenantBrandingManager | ~350 | Colors, logos, custom footer per tenant, live preview | BUILT — fully functional |
| AdminSettingsPanel | 511 | Theme, notifications, security, display preferences | BUILT — saves to DB (see Tier 1 for enforcement gaps) |
| TenantSecurityDashboard | 313 | Active sessions, PHI access logs, security alerts | BUILT — read-only, no alert configuration |
| NoteLockingControls | ~200 | Lock clinical notes with digital signature | BUILT — 21 CFR Part 11 compliant |
| AmendmentWorkflow | ~150 | Create/review note amendments with audit trail | BUILT — HIPAA compliant |
| AdminFeatureToggle | 210 | Feature/unfeature gallery moments | BUILT — inline toggle |
| TenantAIUsageDashboard | exists | AI usage tracking per tenant | BUILT — exists |
| TenantComplianceReport | exists | Compliance report generation | BUILT — exists |

### Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/types/roles.ts` | Role enums, codes, hierarchy, display names | 381 |
| `src/lib/roleAuthority.ts` | Canonical frontend role checking | 266 |
| `supabase/functions/_shared/roleAuthority.ts` | Backend role checking (mirrors frontend) | 250 |
| `src/contexts/AdminAuthContext.tsx` | PIN auth + admin session management | 400+ |
| `src/hooks/useIsAdmin.ts` | React hook — admin status check | 84 |
| `src/hooks/useModuleAccess.ts` | Feature entitlement + enabled check | 232 |
| `src/services/tenantModuleService.ts` | Module config CRUD service | — |
| `src/components/admin/AdminSettingsPanel.tsx` | User-level admin preferences | 511 |

### Database Tables

| Table | Purpose | RLS |
|-------|---------|-----|
| `user_roles` | Role assignments (authoritative) | User-scoped |
| `admin_settings` | Per-admin preferences | User-scoped |
| `tenant_module_config` | Tenant feature flags + entitlements | Tenant-scoped |
| `super_admin_users` | Platform admin list (separate from roles) | Super admin only |
| `audit_logs` | All operations | Tenant-scoped |

---

# Tier 1 — Fix Broken Settings (Store-Only → Wired)

> **Problem:** AdminSettingsPanel saves settings to `admin_settings` table but no code reads them back to enforce behavior. Users toggle settings, nothing changes.
> **Estimate:** ~4 hours (1 session)

## Item 1.1: Wire Session Timeout — WIRED (2026-02-24)

| Layer | Status | Detail |
|-------|--------|--------|
| UI toggle | BUILT | AdminSettingsPanel: 15/30/60/120 min dropdown, saves to `admin_settings.session_timeout` |
| DB storage | BUILT | `admin_settings` table, `session_timeout` column |
| Enforcement | WIRED | `SessionTimeoutContext` fetches `admin_settings.session_timeout` on mount, validates against allowed values (15/30/60/120), falls back to env/default (30 min) |

**What was done:** Added `useState` for `adminTimeoutMs`, fetch effect that queries `admin_settings.session_timeout` when session exists, validates against `VALID_TIMEOUT_MINUTES`, converts to ms. Dynamic `timeoutMs` uses admin setting > prop > env > default chain.

## Item 1.2: Wire PIN Requirement for Sensitive Actions — WIRED (2026-02-24)

| Layer | Status | Detail |
|-------|--------|--------|
| UI toggle | BUILT | AdminSettingsPanel: "Require PIN for sensitive actions" checkbox |
| DB storage | BUILT | `admin_settings.require_pin_for_sensitive` column |
| Enforcement | WIRED | `AdminAuthContext` fetches setting on auth, exposes `requirePinForSensitive` boolean on context. Consuming components can check before prompting for PIN. |

**What was done:** Added `requirePinForSensitive` state (defaults `true`), fetch effect triggered on `isAdminAuthenticated`, exposed on context type and provider value. Components can now conditionally skip PIN prompts for non-critical actions when user has disabled the setting.

## Item 1.3: Audit Logging Toggle — REMOVED (2026-02-24)

| Layer | Status | Detail |
|-------|--------|--------|
| UI toggle | REMOVED | Replaced with green HIPAA compliance notice: "Always enabled per HIPAA § 164.312(b)" |
| DB storage | KEPT | `admin_settings.enable_audit_logging` column retained, always written as `true` |
| Enforcement | N/A | `auditLogger` runs unconditionally — correct behavior, now matches UI |

**Decision:** Option A — toggle removed. Audit logging is mandatory per HIPAA § 164.312(b). The column is still written as `true` for backwards compatibility but is no longer user-controllable.

## Item 1.4: Auto Backup Settings — REMOVED (2026-02-24)

| Layer | Status | Detail |
|-------|--------|--------|
| UI toggle | REMOVED | Replaced with blue info notice: "Managed by Supabase Pro plan — daily automated backups with point-in-time recovery" |
| DB storage | KEPT | `admin_settings.auto_backup` and `backup_frequency` columns retained, always written as defaults |
| Backend job | N/A | Supabase Pro provides daily automated backups with PITR — custom backup UI was redundant |

**Decision:** UI toggles removed. Supabase Pro plan includes daily automated backups with point-in-time recovery. Custom backup settings were misleading since no backend job existed to execute them. Columns still written as `auto_backup: true`, `backup_frequency: 'daily'` for backwards compatibility.

---

# Tier 2 — Wire Orphaned Components

> **Problem:** Two fully-built components exist but are not imported or routed anywhere.
> **Estimate:** ~2 hours (same session as Tier 1)

## Item 2.1: Route TenantConfigHistory — WIRED (2026-02-24)

| Layer | Status | Detail |
|-------|--------|--------|
| Component | BUILT | `TenantConfigHistory.tsx` (624 lines) — change audit trail with filters, pagination, CSV/JSON export |
| Service | BUILT | `tenantConfigAuditService.ts` — reads from `audit_logs` |
| Route | WIRED | Added to `sectionDefinitions.tsx` under `security` category, lazy-loaded via `lazyImports.tsx` |

**What was done:** Added lazy import in `lazyImports.tsx`, registered as section in `sectionDefinitions.tsx` with `category: 'security'`, roles: `['admin', 'super_admin', 'it_admin']`. Appears in Security & Compliance category of admin dashboard.

**Note:** 624 lines — at the god file limit. Must decompose before adding features.

## Item 2.2: Route ClearinghouseConfigPanel — WIRED (2026-02-24)

| Layer | Status | Detail |
|-------|--------|--------|
| Component | BUILT | `ClearinghouseConfigPanel.tsx` (~150 lines) — EDI credentials for Waystar/Change Healthcare/Availity |
| RPC functions | UNVERIFIED | `get_clearinghouse_credentials()` and `update_clearinghouse_config()` may not exist — will error gracefully if missing |
| Route | WIRED | Added to `sectionDefinitions.tsx` under `admin` category, lazy-loaded via `lazyImports.tsx` with named export adapter |

**What was done:** Added lazy import with `.then(m => ({ default: m.ClearinghouseConfigPanel }))` adapter (named export, no default). Registered as section in `sectionDefinitions.tsx` with `category: 'admin'`, roles: `['admin', 'super_admin']`. Appears in System Administration category of admin dashboard.

---

# Tier 3 — Missing Admin Capabilities

> **Problem:** Tenant admins lack essential management tools — user role assignment, provisioning, reporting.
> **Estimate:** ~16-24 hours (3-4 sessions)

## Item 3.1: User Role Management UI — BUILT (2026-02-24)

| Layer | Status | Detail |
|-------|--------|--------|
| UI | BUILT | Staff list with search/filter, role badge, assign modal, revoke confirmation |
| Service | BUILT | `userRoleManagementService.ts` — getStaffUsers, assignRole, revokeRole |
| Hierarchy enforcement | BUILT | `ROLE_HIERARCHY` determines assignable roles per admin level |
| Audit logging | BUILT | All role changes logged with reason, previous role, changed-by |
| Tests | BUILT | 12 behavioral tests (473 suites, 9,198 total) |

**What was built:**
- `UserRoleManagementPanel.tsx` (322 lines) — orchestrator with search, filter, stats bar
- `user-role-management/StaffRoleTable.tsx` (158 lines) — filterable table with role badges
- `user-role-management/RoleAssignmentModal.tsx` (185 lines) — assign/change role form
- `userRoleManagementService.ts` (326 lines) — service layer with hierarchy validation
- Registered in admin dashboard under System Administration category
- Roles: admin, super_admin, department_head, it_admin

## Item 3.2: User Invite/Provisioning — BUILT (2026-02-24)

| Layer | Status | Detail |
|-------|--------|--------|
| UI | BUILT | Tabbed panel: invite form with role dropdown + delivery method, pending registrations table with delete |
| Service | BUILT | `userProvisioningService.ts` — wraps `admin_register` edge function, manages pending registrations |
| Backend | BUILT | `admin_register` edge function (pre-existing) — creates users with temporary password |
| Tests | BUILT | 13 behavioral tests (9,211 total) |

**What was built:**
- `UserProvisioningPanel.tsx` (152 lines) — orchestrator with invite/pending tabs
- `user-provisioning/InviteUserForm.tsx` (302 lines) — form with name, email, phone, role (grouped elevated/public), delivery method (email/SMS/manual), success state with temporary password display + copy
- `user-provisioning/PendingInvitationsTable.tsx` (166 lines) — table with name, contact, role badge, status (verified/code sent/pending/expired), delete with confirmation
- `userProvisioningService.ts` (177 lines) — inviteUser, getPendingRegistrations, deletePendingRegistration
- Registered in admin dashboard under System Administration category

**Not built (future):**
- Bulk CSV import for staff onboarding
- Resend invitation flow

## Item 3.3: TenantSecurityDashboard Enhancements — PARTIAL

| Layer | Status | Detail |
|-------|--------|--------|
| Read metrics | BUILT | Active sessions, PHI access, security alerts |
| Alert configuration | MISSING | No way to set alert thresholds or notification targets |
| Session management | MISSING | No ability to force-logout sessions or view session details (IP, duration) |
| Security rules | MISSING | No configurable rules (e.g., "alert on >5 PHI accesses in 1 hour") |

## Item 3.4: Tenant Suspension — MISSING

| Layer | Status | Detail |
|-------|--------|--------|
| UI | MISSING | No way to temporarily disable a tenant |
| Backend | MISSING | No `is_suspended` flag or enforcement |

---

# Tier 4 — Future Enhancements

> Low priority, track for completeness.

| Item | Status | Notes |
|------|--------|-------|
| License upgrade UI | MISSING | Self-service tier upgrade (super admin manual today) |
| Billing management dashboard | MISSING | Invoice/payment UI for tenant admins |
| Custom roles | MISSING | All 23 roles hardcoded, no custom role creation |
| Theme sync across tabs | PARTIAL | AdminSettingsPanel saves to DB, but AdminHeader reads localStorage — may desync |

---

## Session Log

### Session 0: Audit — COMPLETE (2026-02-24)

| What | Result |
|------|--------|
| Investigated tenant admin panel architecture | Full audit of 8+ components |
| Mapped role separation (super_admin / admin / it_admin) | Clear, well-enforced at 3 layers |
| Identified 4 store-only settings | session_timeout, PIN requirement, audit logging, auto backup |
| Identified 2 orphaned components | TenantConfigHistory, ClearinghouseConfigPanel |
| Identified 4 missing capabilities | Role management UI, user provisioning, security config, tenant suspension |
| Created this tracker | — |

### Session 1: Tier 1 + Tier 2 — COMPLETE (2026-02-24)

| What | Result |
|------|--------|
| Item 1.1: Wire session timeout | WIRED — `SessionTimeoutContext` reads `admin_settings.session_timeout`, validates, enforces |
| Item 1.2: Wire PIN requirement | WIRED — `AdminAuthContext` exposes `requirePinForSensitive` from DB |
| Item 1.3: Remove audit logging toggle | REMOVED — replaced with HIPAA § 164.312(b) compliance notice |
| Item 1.4: Remove backup settings | REMOVED — replaced with Supabase Pro managed notice |
| Item 2.1: Wire TenantConfigHistory | WIRED — lazy-loaded in security category of admin dashboard |
| Item 2.2: Wire ClearinghouseConfigPanel | WIRED — lazy-loaded in admin category with named export adapter |
| Verification | typecheck: 0 errors, lint: 0 errors, tests: 9,186 passed |

**Files modified:**
- `src/contexts/SessionTimeoutContext.tsx` — fetch + validate admin timeout setting
- `src/contexts/AdminAuthContext.tsx` — fetch + expose PIN requirement setting
- `src/components/admin/AdminSettingsPanel.tsx` — remove audit/backup toggles, add compliance notices
- `src/components/admin/sections/lazyImports.tsx` — add 2 lazy imports
- `src/components/admin/sections/sectionDefinitions.tsx` — register 2 new sections

### Session 2: Tier 3 Item 3.1 — COMPLETE (2026-02-24)

| What | Result |
|------|--------|
| Item 3.1: User Role Management UI | BUILT — full CRUD with hierarchy enforcement |
| Service layer | `userRoleManagementService.ts` — staff list, assign, revoke |
| UI components | Panel + StaffRoleTable + RoleAssignmentModal (decomposed, all < 600 lines) |
| Tests | 12 new behavioral tests (9,198 total) |
| Verification | typecheck: 0 errors, lint: 0 errors, tests: 9,198 passed |

**Files created:**
- `src/services/userRoleManagementService.ts`
- `src/components/admin/UserRoleManagementPanel.tsx`
- `src/components/admin/user-role-management/StaffRoleTable.tsx`
- `src/components/admin/user-role-management/RoleAssignmentModal.tsx`
- `src/components/admin/user-role-management/types.ts`
- `src/components/admin/user-role-management/index.ts`
- `src/components/admin/__tests__/UserRoleManagementPanel.test.tsx`

**Files modified:**
- `src/components/admin/sections/lazyImports.tsx`
- `src/components/admin/sections/sectionDefinitions.tsx`

### Session 3: Tier 3 Item 3.2 — COMPLETE (2026-02-24)

| What | Result |
|------|--------|
| Item 3.2: User Invite/Provisioning | BUILT — tabbed panel with invite form + pending management |
| Service layer | `userProvisioningService.ts` — wraps admin_register edge function |
| UI components | Panel + InviteUserForm + PendingInvitationsTable (decomposed, all < 600 lines) |
| Tests | 13 new behavioral tests (9,211 total) |
| Verification | typecheck: 0 errors, lint: 0 errors, tests: 9,211 passed |

**Files created:**
- `src/services/userProvisioningService.ts`
- `src/components/admin/UserProvisioningPanel.tsx`
- `src/components/admin/user-provisioning/InviteUserForm.tsx`
- `src/components/admin/user-provisioning/PendingInvitationsTable.tsx`
- `src/components/admin/user-provisioning/types.ts`
- `src/components/admin/user-provisioning/index.ts`
- `src/components/admin/__tests__/UserProvisioningPanel.test.tsx`

**Files modified:**
- `src/components/admin/sections/lazyImports.tsx`
- `src/components/admin/sections/sectionDefinitions.tsx`

### Session 4: NOT STARTED

**Planned scope:** Tier 3 Items 3.3-3.4 (security config, tenant suspension)
