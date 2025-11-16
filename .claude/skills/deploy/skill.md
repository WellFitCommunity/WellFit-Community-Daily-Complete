# Deployment Checklist Skill

## Purpose
Comprehensive pre-deployment validation to ensure zero-downtime deployments for production and the Methodist Hospital demo (Dec 5th, 2025).

## What This Skill Does

Validates all deployment prerequisites across multiple layers:
1. **Code Quality** - Linting, types, tests
2. **Database Migrations** - All migrations applied
3. **Environment Variables** - Required secrets configured
4. **Edge Functions** - Supabase functions deployed
5. **MCP Server** - Claude MCP server operational
6. **Security** - GPG signing, encryption keys
7. **HIPAA Compliance** - Audit logs, RLS policies
8. **Performance** - Bundle size, load times
9. **Monitoring** - Alerts configured

## Deployment Validation Steps

### Step 1: Code Quality Validation
```bash
# Run complete validation suite
npm run lint && npm run typecheck && npm test
```

**Success criteria:**
- ✅ 0 linting errors
- ✅ 0 TypeScript errors
- ✅ 625+ tests passing
- ✅ 0 critical warnings

### Step 2: Database Migrations Check

Verify all migrations are applied:
```bash
# Check for unapplied migrations
npx supabase db pull
npx supabase migration list
```

**Validate:**
- All migrations in `supabase/migrations/` are applied
- No pending migrations
- Schema matches production

**Critical tables to verify:**
- `profiles`
- `medications`
- `encounters`
- `fhir_*` tables
- `phi_access_logs`
- `audit_logs`
- `ai_skill_config`

### Step 3: Environment Variables Check

Verify all required environment variables are set:

**Frontend (.env):**
```bash
# Required variables
REACT_APP_SUPABASE_URL
REACT_APP_SUPABASE_ANON_KEY
REACT_APP_HCAPTCHA_SITE_KEY
REACT_APP_PHI_ENCRYPTION_KEY
```

**Supabase Secrets:**
```bash
# Check secrets are configured
npx supabase secrets list
```

**Required secrets:**
- `ANTHROPIC_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MAILERSEND_API_TOKEN` (if email enabled)

### Step 4: Edge Functions Deployment

Verify Supabase Edge Functions are deployed:
```bash
# List deployed functions
npx supabase functions list
```

**Required functions:**
- `mcp-claude-server` (Claude MCP integration)
- `ai-billing-suggester` (if AI skills enabled)
- `ai-readmission-predictor` (if AI skills enabled)

**Test function health:**
```bash
# Test MCP server
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/mcp-claude-server \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"method":"tools/list"}'
```

### Step 5: MCP Server Validation

Test Claude MCP server is operational:

**Check:**
1. MCP server responds to health check
2. Available tools: `analyze-text`, `generate-suggestion`, `summarize`
3. Prompt caching enabled
4. De-identification working
5. Audit logging to `claude_usage_logs`

**Test query:**
```sql
-- Verify recent MCP usage
SELECT * FROM claude_usage_logs
WHERE request_type LIKE 'mcp_%'
ORDER BY created_at DESC
LIMIT 5;
```

### Step 6: Security Validation

Verify security controls:

**GPG Commit Signing:**
```bash
git config --get commit.gpgsign  # Should return "true"
git config --get user.signingkey  # Should return key ID
```

**Encryption Keys:**
- PHI encryption key configured
- Master encryption key secured
- Backup encryption tested

**RLS Policies:**
```sql
-- Count RLS-enabled tables
SELECT COUNT(*) FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = true;
-- Should be 80+
```

### Step 7: HIPAA Compliance Check

Run HIPAA compliance scan:
- No PHI in logs
- All audit logging active
- Encryption enabled
- RLS policies on all PHI tables

Reference: Run `/security-scan` command

### Step 8: Performance Validation

Check bundle size and performance:

```bash
# Build production bundle
npm run build

# Check bundle size
du -sh build/static/js/*.js | sort -h
```

**Targets:**
- Total bundle size: < 2 MB
- Main chunk: < 500 KB
- Vendor chunk: < 800 KB
- Load time (3G): < 3 seconds

### Step 9: Monitoring & Alerts

Verify monitoring is configured:

**Database Monitoring:**
```sql
-- Check security monitoring dashboard
SELECT * FROM security_monitoring_dashboard;
```

**Alerts configured for:**
- Critical security events
- Failed login attempts (>5)
- PHI access anomalies
- Database errors
- API failures

### Step 10: Backup Verification

Verify backups are working:

**Check:**
- Last backup timestamp < 24 hours
- Backup restoration tested (quarterly)
- Encryption keys backed up
- Code signed commits in git history

## Methodist Hospital Demo Checklist

**Additional checks for Dec 5th demo:**

### Demo-Specific Features
- [ ] FHIR integration working
- [ ] Epic sync functional
- [ ] Medication Cabinet AI working
- [ ] Care gap detection active
- [ ] Quality metrics dashboard ready
- [ ] Guardian Agent operational
- [ ] White-label branding configured

### Demo Data
- [ ] Test patient accounts created
- [ ] Sample encounters loaded
- [ ] Medications pre-populated
- [ ] Care plans generated
- [ ] Quality metrics showing

### Demo Environment
- [ ] Production-like environment
- [ ] HTTPS enabled
- [ ] Fast load times
- [ ] Mobile responsive
- [ ] No console errors

## Output Format

```
🚀 DEPLOYMENT READINESS CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/9] Code Quality Validation...
✅ Linting passed (0 errors)
✅ Type checking passed (0 errors)
✅ Tests passed (627 passing)

[2/9] Database Migrations...
✅ All migrations applied (143 total)
✅ Schema matches production

[3/9] Environment Variables...
✅ All 4 frontend variables configured
✅ All 3 Supabase secrets configured

[4/9] Edge Functions Deployment...
✅ MCP server deployed (v1.2.3)
✅ AI billing suggester deployed
✅ AI readmission predictor deployed

[5/9] MCP Server Health...
✅ MCP server responding
✅ 3 tools available
✅ Prompt caching active

[6/9] Security Validation...
✅ GPG signing enabled (Key: D1578B97AFE4D408)
✅ PHI encryption key configured
✅ RLS enabled on 87 tables

[7/9] HIPAA Compliance...
✅ No PHI logging violations
✅ Audit logging active
✅ All security controls passing

[8/9] Performance Check...
✅ Bundle size: 1.4 MB (target: <2 MB)
✅ Main chunk: 423 KB
✅ Load time: 2.1s (target: <3s)

[9/9] Monitoring & Alerts...
✅ Security dashboard active
✅ Alerts configured (5 critical rules)
✅ Last backup: 6 hours ago

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ DEPLOYMENT READY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Summary:
  ✅ Code Quality: Passing
  ✅ Database: 143 migrations applied
  ✅ Security: All controls active
  ✅ Performance: 1.4 MB bundle
  ✅ Monitoring: Configured

🟢 SAFE TO DEPLOY TO PRODUCTION

Next Steps:
  1. Create deployment tag: git tag v1.2.3
  2. Push to production branch
  3. Monitor deployment logs
  4. Run post-deployment smoke tests
```

## Failure Output Format

```
🚀 DEPLOYMENT READINESS CHECK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/9] Code Quality Validation...
✅ Linting passed
✅ Type checking passed
❌ Tests failed (3 failures)

Failed Tests:
  ✗ MedicationService › should encrypt PHI
  ✗ FhirService › should sync with Epic
  ✗ BillingService › should calculate CCM time

[2/9] Database Migrations...
⚠️ WARNING: 2 unapplied migrations

Unapplied:
  - 20251116000000_add_demo_features.sql
  - 20251116120000_update_rls_policies.sql

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ DEPLOYMENT BLOCKED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Critical Issues:
  ❌ 3 failing tests
  ⚠️ 2 unapplied migrations

🔴 DO NOT DEPLOY

Required Actions:
  1. Fix failing tests
  2. Apply pending migrations: npx supabase db push
  3. Re-run deployment check
  4. Get approval before deploying
```

## When to Use This Skill

**Pre-Deployment:**
- Before every production deployment
- Before staging deployments
- Before demo environment setup

**Methodist Demo:**
- Nov 30th - Final validation
- Dec 1st - Demo environment check
- Dec 4th - Pre-demo validation
- Dec 5th - Morning of demo

**Regular Schedule:**
- Weekly deployments
- After major features
- After security updates

## Rollback Plan

If deployment check fails after deployment:

1. **Immediate actions:**
   - Revert to previous version
   - Restore database backup
   - Notify team

2. **Investigation:**
   - Review deployment logs
   - Check error reports
   - Run this skill again

3. **Fix and redeploy:**
   - Address root cause
   - Re-run deployment check
   - Deploy with approval

## Notes for AI Agent

- Run ALL 9 steps (don't skip any)
- Block deployment if ANY critical check fails
- Warnings are okay, errors are not
- Show detailed failure reasons
- Provide clear remediation steps
- Track deployment readiness score
- Suggest rollback plan if needed
- Cross-reference with Methodist demo date
