# Operational Runbook - WellFit Community Platform

**Purpose:** Day-to-day operational procedures for maintaining WellFit platform
**Audience:** On-call engineers, backup team members, Methodist support staff
**Last Updated:** November 7, 2025

---

## Quick Start - New Team Member Checklist

### Access Required
- [ ] GitHub repository access (read/write)
- [ ] Supabase dashboard access (admin)
- [ ] Vercel dashboard access (admin)
- [ ] Domain registrar access (DNS changes)
- [ ] Password manager access (secrets)
- [ ] Methodist contact list
- [ ] Sentry account (error monitoring) - when set up
- [ ] On-call rotation schedule

### Tools to Install
```bash
# Node.js 18+
node --version  # Should be v18.x or higher

# Git
git --version

# Supabase CLI
npm install -g supabase

# k6 load testing
# (Already installed system-wide)
k6 version

# PostgreSQL client (for DB access)
sudo apt-get install postgresql-client
```

### Key URLs
- **Production:** https://yourdomain.com
- **Supabase Dashboard:** https://app.supabase.com/project/xkybsjnvuohpqpbkikyn
- **Supabase DB:** db.xkybsjnvuohpqpbkikyn.supabase.co
- **GitHub Repo:** https://github.com/your-org/WellFit-Community-Daily-Complete
- **Status Checks:** https://status.supabase.com

---

## Common Issues & Fixes

### Issue 1: "App is slow / High response times"

**Symptoms:**
- Users report sluggish page loads
- Dashboard takes > 5 seconds to load
- Methodist calls complaining about performance

**Diagnosis:**
```bash
# 1. Check Supabase connection pool
# Supabase Dashboard → Database → Connection Pooling
# Look for: "Current connections" near max (450+/500)

# 2. Check database query performance
# Supabase Dashboard → Database → Query Performance
# Look for: Queries taking > 1 second

# 3. Check recent deployments
# Vercel Dashboard → Deployments
# Look for: Deploy within last 24 hours

# 4. Run smoke test
export SUPABASE_ANON_KEY=$(grep REACT_APP_SUPABASE_ANON_KEY .env | cut -d '=' -f2)
k6 run load-tests/smoke-test.js
# Look for: P95 response time > 3 seconds
```

**Common Causes & Fixes:**

**Cause 1: Connection pool exhaustion**
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;
-- If > 400, connections are high

-- Find long-running queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active'
ORDER BY duration DESC;

-- Kill long-running query (use with caution)
SELECT pg_terminate_backend(pid);
```

**Cause 2: Missing database index**
```sql
-- Check slow queries in Supabase Dashboard → Logs
-- If you see full table scans, add index:
CREATE INDEX CONCURRENTLY idx_patients_tenant_id ON patients(tenant_id);
```

**Cause 3: Cache not working**
```typescript
// Check cache hit rate in application
// Look for: Cache misses > 30%
// Fix: Review caching logic in src/utils/cache.ts
```

**Cause 4: Bad deployment**
```bash
# Rollback to previous deployment
# Vercel Dashboard → Deployments → Click "..." on last good deploy → "Promote to Production"
# Or via Git:
git revert HEAD --no-edit
git push origin main
```

**Prevention:**
- Monitor connection pool usage (set alert at 80% = 400 connections)
- Review slow query log weekly
- Load test before major releases

---

### Issue 2: "Users can't log in"

**Symptoms:**
- Login button doesn't work
- "Invalid credentials" for known good passwords
- Multiple tenants reporting login issues

**Diagnosis:**
```bash
# 1. Check Supabase Auth service
# Visit: https://status.supabase.com
# Look for: Auth service issues

# 2. Check rate limiting
# Supabase Dashboard → Logs → Edge Functions
# Search for: "rate limit exceeded"

# 3. Test login yourself
# Go to: https://yourdomain.com/login
# Try: Test account credentials
# Check: Browser console for errors (F12)

# 4. Check auth configuration
# Supabase Dashboard → Authentication → Settings
# Verify: Email confirmations, password policies
```

**Common Causes & Fixes:**

**Cause 1: Supabase Auth down**
```
Fix: Wait for Supabase to restore (check status.supabase.com)
Communication: Email Methodist every 30 minutes with updates
ETA: Typically 15-60 minutes
```

**Cause 2: Rate limiting triggered**
```bash
# Check rate limit tables
psql -h db.xkybsjnvuohpqpbkikyn.supabase.co -U postgres

# View rate limits
SELECT * FROM rate_limit_log
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 20;

# Reset rate limit for specific IP (if legitimate)
DELETE FROM rate_limit_log WHERE ip_address = '1.2.3.4';
```

**Cause 3: Password reset needed**
```bash
# If user's password is corrupted/wrong
# Supabase Dashboard → Authentication → Users
# Find user → Click "..." → "Send Password Reset Email"
```

**Cause 4: Session expired / token invalid**
```javascript
// Users should log out and log back in
// If widespread: May need to invalidate all sessions
// Supabase Dashboard → Authentication → Users → (bulk action if available)
```

**Prevention:**
- Monitor auth error rate (set alert at > 5% failure rate)
- Document rate limit thresholds
- Test login flow daily (automated health check)

---

### Issue 3: "Data looks wrong / Missing data"

**Symptoms:**
- Patient shows in one tenant's view but shouldn't
- Data from yesterday is missing
- Reports show incorrect numbers

**Diagnosis:**
```bash
# 1. Check recent database migrations
cd supabase/migrations
git log --oneline -10
# Look for: Migrations in last 48 hours

# 2. Check RLS policies
# Supabase Dashboard → Database → Policies
# Verify: Each table has tenant_id filter

# 3. Test tenant isolation
psql -h db.xkybsjnvuohpqpbkikyn.supabase.co -U postgres

# As tenant A, try to access tenant B data
SET LOCAL role = 'anon';
SET LOCAL request.jwt.claims = '{"tenant_id": "houston"}';
SELECT * FROM patients WHERE tenant_id = 'miami' LIMIT 1;
-- Should return 0 rows

# 4. Check for data corruption
SELECT COUNT(*) FROM patients;
SELECT COUNT(DISTINCT tenant_id) FROM patients;
-- Should see 4 tenants: houston, miami, dallas, atlanta
```

**Common Causes & Fixes:**

**Cause 1: Bad migration rolled out**
```bash
# Rollback migration
# 1. Identify bad migration file
cd supabase/migrations
ls -lt  # Shows newest first

# 2. Create revert migration
supabase migration new revert_bad_migration

# 3. Write SQL to undo changes
# Edit: supabase/migrations/YYYYMMDDHHMMSS_revert_bad_migration.sql

# 4. Apply migration
supabase db push
```

**Cause 2: RLS policy bug**
```sql
-- Check which policy is failing
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'patients';

-- Fix example: Add missing tenant_id check
DROP POLICY IF EXISTS "policy_name" ON patients;
CREATE POLICY "policy_name" ON patients
  FOR ALL USING (tenant_id = current_setting('request.jwt.claims')::json->>'tenant_id');
```

**Cause 3: Data accidentally deleted**
```bash
# Restore from backup (see DISASTER_RECOVERY_PLAN.md)
# Supabase Dashboard → Database → Backups → Restore
# Choose point-in-time before deletion
```

**Prevention:**
- Review all migrations in pull request
- Test migrations on staging first
- Enable point-in-time recovery (already enabled)
- Audit RLS policies monthly

---

### Issue 4: "Deployment failed"

**Symptoms:**
- Git push succeeded but app not updated
- Build errors in Vercel
- TypeScript errors blocking deploy

**Diagnosis:**
```bash
# 1. Check Vercel deployment logs
# Vercel Dashboard → Project → Deployments → Latest → View Logs

# 2. Check GitHub Actions (if configured)
# GitHub → Actions tab → Latest run

# 3. Test build locally
npm run build
# Look for: TypeScript errors, missing dependencies

# 4. Check TypeScript
npm run typecheck
```

**Common Causes & Fixes:**

**Cause 1: TypeScript errors**
```bash
# Fix TypeScript errors
npm run typecheck

# Common errors:
# - Missing import
# - Type mismatch
# - Undefined property

# Quick fix (temporary): Add @ts-ignore
// @ts-ignore
problematicLine();

# Proper fix: Fix the type error
```

**Cause 2: Missing environment variables**
```bash
# Vercel Dashboard → Project → Settings → Environment Variables
# Verify all required vars are set:
# - REACT_APP_SUPABASE_URL
# - REACT_APP_SUPABASE_ANON_KEY
# - REACT_APP_HCAPTCHA_SITE_KEY

# Add missing variable → Redeploy
```

**Cause 3: Dependency issues**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Or update outdated dependencies
npm outdated
npm update
```

**Prevention:**
- Run `npm run build` before git push
- Set up pre-commit hook to run typecheck
- Keep dependencies updated monthly

---

### Issue 5: "Methodist can't access specific feature"

**Symptoms:**
- Methodist reports feature not working
- Other tenants can access feature fine
- Methodist-specific issue

**Diagnosis:**
```bash
# 1. Check Methodist's tenant configuration
psql -h db.xkybsjnvuohpqpbkikyn.supabase.co -U postgres

SELECT * FROM tenants WHERE subdomain = 'methodist';
# Verify: tenant_id, enabled features, config

# 2. Check Methodist-specific data
SELECT COUNT(*) FROM patients WHERE tenant_id = 'methodist';
SELECT COUNT(*) FROM check_ins WHERE tenant_id = 'methodist';

# 3. Test as Methodist user
# Log in as Methodist test account
# Navigate to problem feature
# Check: Browser console (F12) for errors

# 4. Check Methodist subdomain DNS
nslookup methodist.yourdomain.com
# Should resolve to Vercel IP
```

**Common Causes & Fixes:**

**Cause 1: Feature flag disabled for Methodist**
```sql
-- Check feature flags
SELECT * FROM tenant_features WHERE tenant_id = 'methodist';

-- Enable feature
INSERT INTO tenant_features (tenant_id, feature_name, enabled)
VALUES ('methodist', 'feature_name', true);
```

**Cause 2: Methodist data in wrong format**
```sql
-- Check data schema
SELECT * FROM patients WHERE tenant_id = 'methodist' LIMIT 1;
-- Compare to other tenants
SELECT * FROM patients WHERE tenant_id = 'houston' LIMIT 1;

-- Fix data format if needed
UPDATE patients
SET column_name = correct_value
WHERE tenant_id = 'methodist' AND condition;
```

**Cause 3: Methodist subdomain not configured**
```bash
# Check DNS settings
# Domain Registrar → DNS Records
# Verify CNAME: methodist.yourdomain.com → cname.vercel-dns.com

# Add if missing (propagation takes 5-60 minutes)
```

**Prevention:**
- Test features across all tenants before release
- Document tenant-specific configurations
- Maintain parity between tenants

---

## Daily Operations

### Morning Checklist (5 minutes)

```bash
# 1. Check Supabase status
curl -s https://status.supabase.com | grep "All Systems Operational"

# 2. Check database connection count
psql -h db.xkybsjnvuohpqpbkikyn.supabase.co -U postgres -c "SELECT count(*) FROM pg_stat_activity;"
# Should be < 400

# 3. Check recent errors (when Sentry is set up)
# Sentry Dashboard → Issues → Last 24 hours
# Should see < 10 new issues

# 4. Check recent deployments
# Vercel Dashboard → Deployments
# Verify: Latest deploy succeeded

# 5. Spot check each tenant
open https://houston.yourdomain.com
open https://miami.yourdomain.com
open https://dallas.yourdomain.com
open https://atlanta.yourdomain.com
# Verify: All load successfully
```

### Weekly Checklist (30 minutes)

```bash
# 1. Review slow queries
# Supabase Dashboard → Database → Query Performance
# Optimize queries > 1 second

# 2. Check backup status
# Supabase Dashboard → Database → Backups
# Verify: Daily backups completed

# 3. Review error trends
# Sentry Dashboard → Issues → Last 7 days
# Look for: Patterns, new errors

# 4. Check disk usage
# Supabase Dashboard → Database → Database Size
# Alert if > 80% of plan limit

# 5. Review load test results (if running weekly)
k6 run load-tests/smoke-test.js
# Document: Response times, error rates

# 6. Update Methodist on status
# Email: "Weekly system health report"
# Include: Uptime %, incidents, improvements
```

### Monthly Checklist (2 hours)

```bash
# 1. Test database restore
# See: DISASTER_RECOVERY_PLAN.md Section 3

# 2. Review and update dependencies
npm outdated
npm update
npm audit fix

# 3. Review RLS policies
# Supabase Dashboard → Database → Policies
# Verify: All tables have proper tenant isolation

# 4. Run full load tests
./load-tests/run-all.sh
# Document results

# 5. Review capacity planning
# Check: Connection pool usage trends
# Check: Database storage growth
# Check: API request volume
# Update: CAPACITY_PLANNING.md

# 6. Methodist business review
# Schedule: Monthly check-in call
# Topics: Performance, incidents, roadmap, growth
```

---

## Deployment Procedures

### Standard Deployment (Low Risk)

```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Make changes, commit
git add .
git commit -m "feat: description"

# 3. Push to GitHub
git push origin feature/new-feature

# 4. Create Pull Request
# Review code, get approval

# 5. Merge to main
# GitHub → Pull Request → Merge

# 6. Vercel auto-deploys main branch (2-3 minutes)

# 7. Verify deployment
# Vercel Dashboard → Deployments → Latest
# Check: Build successful, tests passed

# 8. Smoke test
k6 run load-tests/smoke-test.js

# 9. Notify team in Slack/Discord
# "Deployed: New feature X - all systems nominal"
```

### Emergency Hotfix (High Risk)

```bash
# 1. Create hotfix branch from main
git checkout main
git pull
git checkout -b hotfix/critical-bug

# 2. Make minimal fix
# Edit only affected files

# 3. Test locally
npm run build
npm run typecheck

# 4. Commit and push
git add .
git commit -m "hotfix: critical bug description"
git push origin hotfix/critical-bug

# 5. Create PR and merge immediately
# Skip usual review if urgent

# 6. Monitor deployment closely
# Vercel Dashboard → Real-time logs

# 7. Test fix in production
# Verify bug is resolved

# 8. Notify Methodist
# Email: "Critical bug fixed, service restored"
```

### Database Migration Deployment

```bash
# 1. Create migration locally
cd supabase/migrations
supabase migration new add_new_column

# 2. Write SQL
# Edit: supabase/migrations/YYYYMMDDHHMMSS_add_new_column.sql
ALTER TABLE patients ADD COLUMN new_column VARCHAR(255);

# 3. Test migration locally
supabase db reset  # Recreates DB from migrations
npm run dev  # Test app still works

# 4. Commit migration
git add supabase/migrations/
git commit -m "feat: add new_column to patients"
git push

# 5. Apply to production (via Supabase dashboard or CLI)
supabase db push

# 6. Verify migration succeeded
psql -h db.xkybsjnvuohpqpbkikyn.supabase.co -U postgres
\d patients  # Should show new_column

# 7. Deploy application code that uses new column
# Follow standard deployment procedure
```

---

## Monitoring & Alerts

### What to Monitor

**Application Health:**
- Response time (target: P95 < 2s)
- Error rate (target: < 1%)
- Uptime (target: 99.9%)

**Database Health:**
- Connection count (alert at > 400/500)
- Query performance (alert at queries > 2s)
- Storage usage (alert at > 80%)
- Backup status (alert if > 48 hours old)

**Infrastructure:**
- Vercel build status
- Supabase service status
- CDN performance (when configured)

### Current Monitoring Tools

**Manual Checks:**
- Supabase Dashboard → Logs (check daily)
- Vercel Dashboard → Deployments (check after deploy)
- Load tests (run weekly)

**Recommended Setup (not yet implemented):**
- Sentry for error tracking ($26/month)
- Better Uptime for uptime monitoring ($10/month)
- Supabase built-in alerts (free)

---

## Security Procedures

### Handling Security Alerts

**If you receive a security alert:**

1. **Assess severity:**
   - Critical: Data breach, PHI exposure, unauthorized access
   - High: Vulnerability in production code
   - Medium: Vulnerability in dev dependency
   - Low: Outdated dependency with no exploit

2. **For Critical/High:**
   ```bash
   # Immediate action
   - Activate incident response (see DISASTER_RECOVERY_PLAN.md)
   - Notify Methodist within 15 minutes
   - Document everything

   # Investigation
   - Identify affected systems
   - Identify affected data
   - Identify attack vector

   # Remediation
   - Patch vulnerability
   - Force password reset if needed
   - Rotate API keys if compromised
   ```

3. **For Medium/Low:**
   ```bash
   # Update dependency
   npm audit
   npm audit fix

   # Or manually update
   npm install package@latest

   # Test
   npm run build
   npm run typecheck

   # Deploy
   git commit -am "security: update vulnerable dependency"
   git push
   ```

### Access Control Audit

**Quarterly checklist:**
- [ ] Review Supabase user access (remove ex-employees)
- [ ] Review GitHub collaborator access
- [ ] Review Vercel team member access
- [ ] Rotate database passwords
- [ ] Review RLS policies for gaps
- [ ] Test multi-tenant isolation

---

## Troubleshooting Commands

### Database Queries

```sql
-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check connection count by tenant
SELECT
  current_setting('request.jwt.claims')::json->>'tenant_id' as tenant,
  count(*)
FROM pg_stat_activity
GROUP BY tenant;

-- Find bloated tables
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(tablename::regclass)) as size,
  n_dead_tup
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;

-- Kill idle connections (use with caution)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND state_change < now() - interval '1 hour';
```

### Application Debugging

```bash
# Check build output
npm run build 2>&1 | tee build.log
grep -i error build.log

# Check TypeScript errors
npm run typecheck 2>&1 | tee typescript.log
wc -l typescript.log  # Count errors

# Check for console.logs (should remove before production)
grep -r "console.log" src/

# Check bundle size
find build/static/js -name "*.js" -exec wc -c {} + | sort -n

# Test specific feature locally
npm run dev
# Navigate to http://localhost:3000
```

### Network Debugging

```bash
# Test Supabase connectivity
curl -I https://xkybsjnvuohpqpbkikyn.supabase.co

# Test DNS resolution
nslookup methodist.yourdomain.com
dig methodist.yourdomain.com

# Test from Methodist's location (if IP known)
curl --interface methodist-ip https://yourdomain.com

# Check SSL certificate
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
```

---

## Contact Information

### Internal Team
- **Primary On-Call:** [Your Name] - [Phone] - [Email]
- **Backup On-Call:** [Backup Name] - [Phone] - [Email]
- **Team Lead:** [Lead Name] - [Email]

### External Contacts
- **Methodist IT Director:** [Name] - [Phone] - [Email]
- **Methodist After-Hours:** [Phone]
- **Supabase Support:** support@supabase.io
- **Vercel Support:** support@vercel.com

### Emergency Escalation
1. Try primary on-call
2. Try backup on-call (if no response in 15 min)
3. Try team lead (if no response in 30 min)
4. Notify Methodist directly (if service impacting)

---

## Useful Resources

### Documentation
- [Disaster Recovery Plan](DISASTER_RECOVERY_PLAN.md)
- [Capacity Planning](CAPACITY_PLANNING.md)
- [Load Testing Suite](load-tests/README.md)
- [Supabase Docs](https://supabase.com/docs)
- [HIPAA Compliance Guide](docs/HIPAA_SOC2_SECURITY_AUDIT.md)

### Dashboards
- Supabase: https://app.supabase.com/project/xkybsjnvuohpqpbkikyn
- Vercel: https://vercel.com/dashboard
- GitHub: https://github.com/your-org/WellFit-Community-Daily-Complete

### Status Pages
- Supabase: https://status.supabase.com
- Vercel: https://www.vercel-status.com
- AWS: https://status.aws.amazon.com

---

**Last Updated:** November 7, 2025
**Next Review:** February 7, 2026
**Maintained By:** WellFit Engineering Team
