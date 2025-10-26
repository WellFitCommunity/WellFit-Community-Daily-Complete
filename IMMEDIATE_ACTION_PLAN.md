# IMMEDIATE ACTION PLAN - Priority Fixes for Launch

## TL;DR: You have an A- system. Fix these 4 things and you're production-ready.

---

## PRIORITY 1: Remove Console Logs (FASTEST - Do This First)
**Time:** 4-6 hours | **Risk:** HIPAA violation (PHI in browser console)

### Quick Fix Script:
```bash
# Find all console.log statements
grep -r "console\." src/ --include="*.ts" --include="*.tsx" | wc -l
# Result: 89 instances

# Replace pattern:
# BEFORE: console.log('Patient data:', data);
# AFTER:  // Removed for production (or use auditLogger if needed)
```

### Files to Clean (Top Priority):
- `src/services/claudeService.ts` - 11 console.logs
- `src/services/guardian-agent/*.ts` - 20+ console.logs
- `src/pages/WelcomePage.tsx` - 10 console.logs
- `src/pages/DashboardPage.tsx` - 7 console.logs
- All other files with warnings from build

### Commands:
```bash
# Remove all console.log/error/warn
npm run lint -- --fix

# Manual review needed for:
# - auditLogger.ts (keep these - they're intentional)
# - Development debugging (convert to proper logging)
```

---

## PRIORITY 2: Fix Database Schema Issues
**Time:** 8-12 hours | **Risk:** Data integrity violations

### Issue 1: Duplicate `community_moments` table
**Action:** Run this migration:
```bash
# Copy the migration I created in the assessment
cat > supabase/migrations/20251026000000_schema_reconciliation.sql << 'EOF'
-- Choose canonical schema
DROP TABLE IF EXISTS public.community_moments CASCADE;
CREATE TABLE public.community_moments (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  emoji TEXT DEFAULT '😊',
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_community_moments_user_id ON public.community_moments(user_id);
CREATE INDEX idx_community_moments_created_at ON public.community_moments(created_at DESC);
EOF

# Apply migration
PGPASSWORD="MyDaddyLovesMeToo1" psql \
  -h aws-0-us-west-1.pooler.supabase.com \
  -p 6543 \
  -U postgres.xkybsjnvuohpqpbkikyn \
  -d postgres \
  -f supabase/migrations/20251026000000_schema_reconciliation.sql
```

### Issue 2: Missing Foreign Keys
**Files to fix:**
- `claims` table needs FK to `encounters(id)`
- `scribe_sessions` needs FK to `encounters(id)` (remove conditional logic)
- `lab_results` needs FK to `handoff_packets(id)`

**SQL Fix:**
```sql
ALTER TABLE public.claims
  ADD CONSTRAINT fk_claims_encounter
  FOREIGN KEY (encounter_id) REFERENCES public.encounters(id) ON DELETE CASCADE;

ALTER TABLE public.scribe_sessions
  DROP COLUMN IF EXISTS encounter_id,
  ADD COLUMN encounter_id UUID REFERENCES public.encounters(id) ON DELETE CASCADE;

ALTER TABLE public.lab_results
  ADD CONSTRAINT fk_lab_results_handoff_packet
  FOREIGN KEY (handoff_packet_id) REFERENCES public.handoff_packets(id) ON DELETE SET NULL;
```

### Issue 3: Missing NOT NULL Constraints
```sql
ALTER TABLE public.medications
  ALTER COLUMN instructions SET NOT NULL,
  ALTER COLUMN strength SET NOT NULL;

ALTER TABLE public.handoff_packets
  ADD CONSTRAINT sent_requires_sent_at CHECK (
    (status NOT IN ('sent', 'acknowledged')) OR sent_at IS NOT NULL
  );
```

---

## PRIORITY 3: Physician Review Workflow
**Time:** 12-16 hours | **Risk:** Legal liability (AI notes without attestation)

### Database Changes:
```sql
-- Add review status to encounters
ALTER TABLE public.encounters
  ADD COLUMN scribe_status TEXT DEFAULT 'draft' CHECK (scribe_status IN (
    'draft', 'needs_review', 'reviewed', 'attested'
  )),
  ADD COLUMN reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN reviewed_at TIMESTAMPTZ,
  ADD COLUMN attested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN attested_at TIMESTAMPTZ;

-- Track physician edits
CREATE TABLE public.encounter_review_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  reviewed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Code Changes:
1. Update `src/services/scribeService.ts` to set `scribe_status: 'needs_review'`
2. Create `src/components/physician/EncounterReviewPanel.tsx`
3. Update billing service to require `scribe_status === 'attested'`

---

## PRIORITY 4: Clearinghouse Integration (Optional for Pilot)
**Time:** 20-30 hours | **Risk:** Slow reimbursement (manual claim submission)

### Can Defer Until After Pilot If:
- You're doing a small pilot (< 50 patients)
- Manual claim submission is acceptable initially
- You want to launch faster

### Required Before Full Launch:
- Waystar or Change Healthcare API integration
- Automated 837P submission
- 277 (status) and 835 (payment) response processing

---

## TESTING CHECKLIST BEFORE LAUNCH

### 1. Build & Deploy Test
```bash
# Must pass without warnings
CI=true npm run build

# Check bundle size
ls -lh build/static/js/*.js
# Should be < 2MB for main chunk
```

### 2. Database Integrity Test
```bash
# Verify all foreign keys exist
PGPASSWORD="..." psql ... -c "
  SELECT
    COUNT(*) as foreign_key_count
  FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY'
    AND table_schema = 'public';
"
# Should be 50+ foreign keys
```

### 3. Security Test
```bash
# Run security audit
npm audit --production

# Check for exposed secrets
grep -r "MyDaddyLovesMeToo1" src/
# Should return 0 results (password should only be in .env)
```

### 4. Disaster Recovery Test
```bash
# Test backup restoration
# 1. Create test patient
# 2. Take snapshot
# 3. Delete patient
# 4. Restore from snapshot
# 5. Verify patient exists
```

---

## LAUNCH TIMELINE

### Week 1-2: Critical Fixes
- [ ] Day 1-2: Remove console.logs, fix ESLint
- [ ] Day 3-4: Schema reconciliation migration
- [ ] Day 5-7: Physician review workflow
- [ ] Day 8-10: Testing (build, database, security)

### Week 3-4: UAT & Training
- [ ] Clinical staff testing (nurses, physicians)
- [ ] Admin training (enrollment, support)
- [ ] Bug fixes from UAT
- [ ] Documentation updates

### Week 5-6: Deployment
- [ ] Production Supabase setup
- [ ] EHR integration (Epic/Cerner)
- [ ] Gradual rollout (5 → 20 → 50+ users)
- [ ] Daily monitoring

---

## QUICK DECISION MATRIX

### Option A: Fast Pilot (4 weeks)
**Do:** Priority 1 + Priority 2 + Priority 3
**Skip:** Clearinghouse (manual claims OK for pilot)
**Timeline:** 4 weeks to pilot deployment
**Risk:** Low (controlled environment)

### Option B: Full Enterprise Launch (12 weeks)
**Do:** All 4 priorities + SOC2 audit + penetration test
**Timeline:** 12 weeks to production
**Risk:** Medium (more users, regulatory scrutiny)

---

## WHAT TO DO RIGHT NOW

### Choose One:
1. **"Fix console.logs first"** → I'll create a script to auto-remove them
2. **"Fix database schema first"** → I'll create the reconciliation migration
3. **"Add physician review workflow"** → I'll implement the full workflow
4. **"Just get it working for Monday demo"** → I'll focus on critical blockers only

**Tell me which one and I'll start immediately.**
