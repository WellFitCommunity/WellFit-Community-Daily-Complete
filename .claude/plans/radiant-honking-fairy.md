# Plan: Address Demo Gaps (3 of 4)

## Context
Demo readiness check flagged 4 gaps. Maria wants 3 addressed (wearables excluded):
1. **IntelligentAdminPanel** — 679 lines, exceeds 600-line limit
2. **Prior Auth Dashboard** — Backend complete, NO UI/route exists
3. **Telehealth** — Already fully demo-ready (Daily.co integrated, routes wired, UI complete)

Billing/coding seed data already exists: `seed_medical_codes.sql` (CPT, HCPCS, ICD) and `seed_fee_schedule_rates.sql`.

---

## Gap 1: IntelligentAdminPanel (679 → under 600)

The file is already well-decomposed with lazy-loaded categories. The excess comes from personalization logic (behavior tracking, suggestions, milestones) and a large `sectionMap` for suggestion routing.

**Fix:** Extract a custom hook `useAdminPersonalization` that encapsulates:
- `loadPersonalizedDashboard()` (lines 435-511)
- `checkMilestones()` (lines 271-284)
- `handleSuggestionClick()` with its `sectionMap` (lines 287-409)
- State: `aiSuggestions`, `learningEvents`, `behaviorProfile`, `showMilestone`, `milestone`, `isLoading`

**New file:** `src/hooks/useAdminPersonalization.ts` (~200 lines)
**Modified file:** `src/components/admin/IntelligentAdminPanel.tsx` (679 → ~480 lines)

The hook returns: `{ isLoading, aiSuggestions, learningEvents, behaviorProfile, showMilestone, milestone, setShowMilestone, handleSuggestionClick, addLearningEvent }`

---

## Gap 2: Prior Auth Dashboard (NEW — the real work)

Backend is fully implemented in `src/services/fhir/prior-auth/` (just decomposed). MCP server exists. No UI component, no route, no lazy import.

**Create:** `src/components/admin/PriorAuthDashboard.tsx` (~500 lines)

**Features for demo:**
- Pending authorizations list with status badges (draft, submitted, approved, denied)
- Statistics cards (total, approved rate, avg response time, SLA compliance)
- Create new prior auth form (patient, payer, service codes, diagnosis codes, urgency)
- Decision recording (approve/deny with reason)
- Appeal creation for denials
- Approaching-deadline alerts

**Pattern to follow:** Matches existing admin panels (BillingDashboard, PatientEngagementDashboard) — uses Supabase queries, role-based access, auditLogger, responsive grid layout.

**Wire up:**
1. Add route to `routeConfig.ts` in `adminRoutes`:
   ```
   { path: '/admin/prior-auth', component: 'PriorAuthDashboard', auth: 'admin',
     roles: ['admin', 'super_admin', 'case_manager', 'billing_specialist'], category: 'admin' }
   ```
2. Add lazy import to `lazyComponents.tsx`:
   ```
   export const PriorAuthDashboard = React.lazy(() => import('../components/admin/PriorAuthDashboard'));
   ```
3. Add as section in `sectionDefinitions.tsx` under 'revenue' category:
   ```
   { id: 'prior-auth', title: 'Prior Authorization Center', category: 'revenue', priority: 'high' }
   ```

**Data source:** Uses `PriorAuthorizationService` from `src/services/fhir/prior-auth/` (the service we just decomposed).

---

## Gap 3: Telehealth — NO WORK NEEDED

Already fully demo-ready:
- Route: `/telehealth-appointments` → `TelehealthAppointmentsPage.tsx` (413 lines)
- Video: Daily.co integration via `daily_room_url` field
- Join button: Appears 15 min before appointment, lazy-loads `TelehealthConsultation`
- Admin: `/appointment-analytics` for metrics
- CHW: `/chw/telehealth-lobby` for staff
- Real-time: Supabase subscription for live updates

---

## Files Modified
- `src/components/admin/IntelligentAdminPanel.tsx` (extract hook, 679 → ~480)
- `src/components/admin/sections/sectionDefinitions.tsx` (add prior-auth section)
- `src/routes/routeConfig.ts` (add `/admin/prior-auth` route)
- `src/routes/lazyComponents.tsx` (add `PriorAuthDashboard` lazy import)

## Files Created
- `src/hooks/useAdminPersonalization.ts` (~200 lines)
- `src/components/admin/PriorAuthDashboard.tsx` (~500 lines)

## Verification
```bash
wc -l src/components/admin/IntelligentAdminPanel.tsx  # Must be < 600
wc -l src/hooks/useAdminPersonalization.ts             # Must be < 600
wc -l src/components/admin/PriorAuthDashboard.tsx      # Must be < 600
npm run typecheck && npm run lint && npm test
```
