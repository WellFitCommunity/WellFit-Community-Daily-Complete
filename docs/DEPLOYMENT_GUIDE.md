# WellFit Community Daily - Comprehensive Deployment Guide

**Last Updated:** October 2025
**Deployment Platform:** Vercel
**Status:** Production Ready

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Pre-Deployment Checklist](#pre-deployment-checklist)
4. [Deployment Steps](#deployment-steps)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Multi-Tenant Configuration](#multi-tenant-configuration)
7. [Offline Mode Deployment](#offline-mode-deployment)
8. [Troubleshooting](#troubleshooting)
9. [Rollback Procedures](#rollback-procedures)
10. [Monitoring and Maintenance](#monitoring-and-maintenance)

---

## Prerequisites

### Required

- **Node.js** (v18 or later)
- **npm** or **yarn** package manager
- **Supabase CLI** for database migrations - [Installation Guide](https://supabase.com/docs/guides/cli)
- **Vercel account** (free or paid tier)
- **Git repository** connected to Vercel
- **HTTPS-enabled domain** (provided automatically by Vercel)
- **SSL/TLS certificate** (provided automatically by Vercel)

### Recommended

- **HIPAA compliance review** completed
- **Security assessment** performed
- **User training materials** prepared
- **Device security policy** established
- **Backup procedures** documented

### Service Accounts

Ensure you have access to:
- Supabase project (admin access)
- Firebase project (for push notifications)
- Twilio account (for SMS)
- MailerSend account (for email)
- OpenWeatherMap API key (for weather widget)

---

## Environment Variables

All environment variables must be configured in your Vercel project settings before deployment.

### Client-Side Variables (REACT_APP_ prefix)

These are embedded in the build and exposed to the browser:

```env
# Supabase Configuration
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key

# Weather API
REACT_APP_WEATHER_API_KEY=your_openweathermap_api_key

# Firebase (Push Notifications)
REACT_APP_FIREBASE_API_KEY=your_firebase_web_api_key
REACT_APP_FIREBASE_VAPID_KEY=your_firebase_vapid_key_for_push_notifications

# Email Endpoint
REACT_APP_SUPABASE_EMAIL_ENDPOINT=https://your-app.vercel.app/api/send-email

# App Configuration
REACT_APP_APP_URL=https://your-app.vercel.app
PUBLIC_URL=https://your-app.vercel.app

# Offline Mode
REACT_APP_OFFLINE_ENABLED=true

# Demo Mode (optional)
REACT_APP_DEMO_ENABLED=false
```

### Server-Side Variables (for Vercel Functions)

These remain secure and are only accessible to serverless functions:

```env
# Supabase (Backend)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Email Service (MailerSend)
MAILERSEND_API_KEY=your_mailersend_api_key
MAILERSEND_FROM_EMAIL=noreply@yourdomain.com

# SMS Service (Twilio)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# Security
INTERNAL_API_KEY=your_secure_internal_api_key
ADMIN_PANEL_PIN=your_admin_panel_pin

# Firebase Admin SDK (if using Firebase Functions)
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_service_account_client_email
FIREBASE_PRIVATE_KEY="your_firebase_service_account_private_key"
```

**Important Notes:**
- Never commit `.env` files to Git
- For multi-line variables like `FIREBASE_PRIVATE_KEY`, use Base64 encoding in Vercel
- All `REACT_APP_` variables are public and embedded in the client bundle
- Service role keys should NEVER be prefixed with `REACT_APP_`

---

## Pre-Deployment Checklist

### 1. Code Review and Verification

Run these commands locally before deploying:

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Run tests (if available)
npm test

# Build verification
npm run build

# Verify build output
ls -la build/
```

**Expected Results:**
- TypeScript compiles without errors
- Linting passes (warnings are acceptable)
- Build completes successfully
- `build/` directory contains static assets

### 2. Review Recent Changes

Review documentation for recent updates:
- Read `QUICK_REFERENCE_CHANGES.md` (if exists)
- Read `MIGRATION_AND_MULTITENANCY_NOTES.md` (if exists)
- Review git commit history: `git log --oneline -20`

### 3. Database Preparation

#### Local Database Verification

```bash
# Verify migrations locally
./scripts/verify-migrations.sh

# Expected output: "✓ All checks passed!"
```

#### Backup Production Database (CRITICAL)

```bash
# ALWAYS backup before deployment
supabase db dump --db-url $PRODUCTION_DB_URL > backup-production-$(date +%Y%m%d-%H%M).sql

# Store backup securely
aws s3 cp backup-production-*.sql s3://your-backups-bucket/
# or another secure location
```

### 4. Local Testing

Test these critical paths locally:

- [ ] Test Community Moments page loads
- [ ] Test crisis intervention flow (988/911/emergency contact)
- [ ] Test doctor's view shows health data
- [ ] Test user registration with SMS verification
- [ ] Test admin panel login and features
- [ ] Test offline mode functionality
- [ ] Test multi-tenant branding (if applicable)

---

## Deployment Steps

### Step 1: Prepare for Deployment

```bash
# Ensure you're on the main branch
git checkout main

# Pull latest changes
git pull origin main

# Verify git status is clean
git status
```

### Step 2: Set Up Vercel Project (First-Time Only)

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Link your project
vercel link
```

### Step 3: Configure Environment Variables in Vercel

**Option A: Using Vercel CLI**

```bash
# Set environment variables
vercel env add REACT_APP_SUPABASE_URL
vercel env add REACT_APP_SUPABASE_ANON_KEY
# ... (repeat for all variables)
```

**Option B: Using Vercel Dashboard**

1. Go to your project on vercel.com
2. Navigate to Settings → Environment Variables
3. Add all variables from the [Environment Variables](#environment-variables) section
4. Select appropriate environments (Production, Preview, Development)

**Important:** For `FIREBASE_PRIVATE_KEY`, encode it as Base64:
```bash
echo -n "$FIREBASE_PRIVATE_KEY" | base64
```

### Step 4: Apply Database Migrations

#### For Staging Environment

```bash
# Link to staging project
supabase link --project-ref your-staging-project

# Apply migrations
supabase db push

# Verify migrations
./scripts/verify-migrations.sh $STAGING_DB_URL
```

#### For Production Environment

```bash
# Link to production project
supabase link --project-ref your-production-project

# Apply migrations
supabase db push

# Verify migrations
./scripts/verify-migrations.sh $PRODUCTION_DB_URL
```

**Database Migration Files:**
- Review files in `supabase/migrations/`
- Migrations run in chronological order by filename
- Each migration should be idempotent

### Step 5: Deploy to Vercel

```bash
# Deploy to production
vercel --prod

# Or simply push to main branch (if auto-deploy is enabled)
git push origin main
```

**Vercel will automatically:**
- Install dependencies
- Run `npm run build`
- Deploy static assets to CDN
- Deploy serverless functions to edge network
- Provide HTTPS certificate
- Generate deployment URL

### Step 6: Verify Deployment URL

After deployment completes:

```bash
# Get deployment URL
vercel ls

# Test HTTPS
curl -I https://your-app.vercel.app

# Expected: 200 OK
```

---

## Post-Deployment Verification

### Immediate Smoke Tests

Within 5 minutes of deployment:

```bash
# Check deployment health
curl https://your-app.vercel.app/health
```

**Manual Verification:**

- [ ] Homepage loads without errors
- [ ] No JavaScript errors in browser console
- [ ] No 500 errors in Vercel logs
- [ ] Service Worker registers (check browser console)
- [ ] Community Moments page loads
- [ ] Check-in page loads
- [ ] Doctor's view loads

### Critical Path Testing

Test these user journeys:

#### 1. New User Registration
- [ ] User can create account
- [ ] SMS verification code is sent
- [ ] Email welcome message is sent
- [ ] User is assigned correct role (seniors get role_code: 4)

#### 2. Daily Check-In Flow
- [ ] User can log in
- [ ] User can complete daily check-in
- [ ] Health data saves to database
- [ ] Data appears in user dashboard

#### 3. Crisis Intervention
- [ ] Crisis intervention flow triggers correctly
- [ ] 988 and 911 call links work
- [ ] Emergency contact information displays

#### 4. Admin Functions
- [ ] Admin panel login works
- [ ] Admin can view user data
- [ ] FHIR analytics dashboard loads
- [ ] Admin can export reports

#### 5. Offline Functionality
- [ ] Service Worker installs successfully
- [ ] App works offline after initial load
- [ ] Offline data syncs when back online
- [ ] Pulse oximeter works offline

### Multi-Tenant Verification (If Applicable)

Test on all configured subdomains:

**Houston Tenant** (houston.yourdomain.com):
- [ ] Community Moments loads
- [ ] Correct Houston branding (red/gold colors)
- [ ] Houston-specific content displays
- [ ] Crisis intervention shows Houston resources

**Miami Tenant** (miami.yourdomain.com):
- [ ] Correct Miami branding (teal/coral colors)
- [ ] Miami-specific content displays

**Phoenix Tenant** (phoenix.yourdomain.com):
- [ ] Correct Phoenix branding (desert orange/brown)
- [ ] Phoenix-specific content displays

**Seattle Tenant** (seattle.yourdomain.com):
- [ ] Correct Seattle branding (evergreen/blue)
- [ ] Seattle-specific content displays

**Default Tenant** (yourdomain.com):
- [ ] Default WellFit branding
- [ ] All core features work

### Security Verification

- [ ] HTTPS enforced (HTTP redirects to HTTPS)
- [ ] Service role keys not exposed in client bundle
- [ ] Rate limiting works on sensitive endpoints
- [ ] RLS policies prevent unauthorized data access
- [ ] Admin PIN verification works
- [ ] Session management enforces timeouts

### Performance Checks

```bash
# Check page load time
curl -w "@curl-format.txt" -o /dev/null -s https://your-app.vercel.app

# Monitor Vercel analytics
# Check Vercel dashboard for performance metrics
```

Expected Performance:
- First Contentful Paint: < 2s
- Time to Interactive: < 4s
- Lighthouse Performance Score: > 85

---

## Multi-Tenant Configuration

### DNS Setup (If Using Custom Domains)

For each tenant, configure DNS:

```
Type: CNAME
Name: houston (or subdomain)
Value: cname.vercel-dns.com
```

### Add Domains in Vercel

1. Go to Vercel project → Settings → Domains
2. Add each domain:
   - `houston.yourdomain.com`
   - `miami.yourdomain.com`
   - `phoenix.yourdomain.com`
   - `seattle.yourdomain.com`
3. Vercel will automatically provision SSL certificates

### Upload Tenant Assets

Upload client logos to public directory:

```bash
# Upload logos
cp client-logos/houston-logo.png public/logos/houston-logo.png
cp client-logos/miami-logo.png public/logos/miami-logo.png
# ... repeat for all tenants

# Commit and deploy
git add public/logos/
git commit -m "Add tenant logos"
git push origin main
```

### Tenant Configuration

Review tenant configurations in code:
- `src/config/tenants.ts` (or similar)
- Verify color schemes
- Verify contact information
- Verify crisis resources

---

## Offline Mode Deployment

### Service Worker Configuration

Verify these files are included in your build:

```bash
# Check build output
ls -la build/service-worker.js
ls -la build/manifest.json
```

### HTTPS Requirement

**Critical:** Service Workers ONLY work over HTTPS.

Vercel automatically provides HTTPS, so this is handled by default.

### Cache Headers Configuration

Vercel automatically sets appropriate cache headers, but verify in `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/service-worker.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-cache, no-store, must-revalidate"
        }
      ]
    },
    {
      "source": "/static/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

### Testing Offline Mode

1. Open app in browser
2. Open DevTools → Console
3. Look for: "✅ WellFit is now available offline!"
4. Check Application tab → Service Workers
5. Verify: "activated and running"
6. Test offline:
   - DevTools → Network → Offline
   - Refresh page (should still load)
   - Fill out health check-in
   - Verify "💾 Saved offline!" message

### Mobile Device Setup

**iOS Instructions:**
1. Open Safari
2. Navigate to your app URL
3. Tap Share → Add to Home Screen
4. Icon appears on home screen
5. Tap to open (works like native app)

**Android Instructions:**
1. Open Chrome
2. Navigate to your app URL
3. Tap menu (three dots)
4. Tap "Add to Home screen"
5. Icon appears on home screen

---

## Troubleshooting

### Common Deployment Issues

#### Build Fails

**Symptom:** Vercel build fails with errors

**Solutions:**
```bash
# Test build locally first
npm run build

# Check for TypeScript errors
npm run typecheck

# Check for linting errors
npm run lint

# Verify all dependencies are in package.json
npm install
```

#### Environment Variables Not Working

**Symptom:** App can't connect to Supabase or other services

**Solutions:**
1. Verify variables are set in Vercel dashboard
2. Ensure `REACT_APP_` prefix for client-side variables
3. Redeploy after adding variables: `vercel --prod`
4. Check Vercel function logs for errors

#### Service Worker Not Registering

**Symptom:** No offline functionality

**Solutions:**
```bash
# Verify HTTPS is enabled
curl -I https://your-app.vercel.app | grep "200\|301\|302"

# Check service-worker.js is accessible
curl https://your-app.vercel.app/service-worker.js

# Clear browser cache and retry
# Check browser console for registration errors
```

#### Database Connection Errors

**Symptom:** "Failed to fetch" or database timeout errors

**Solutions:**
1. Verify Supabase URL is correct
2. Check Supabase project is not paused
3. Verify anon key is correct
4. Check RLS policies aren't blocking access
5. Review Supabase logs for errors

#### RLS Policy Violations

**Symptom:** Users can't access their own data

**Solutions:**
```sql
-- Check policies for a table
SELECT * FROM pg_policies WHERE tablename = 'community_moments';

-- Test as specific user
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims.sub = 'user-uuid';
SELECT * FROM community_moments;
```

#### SMS/Email Not Sending

**Symptom:** Verification codes not received

**Solutions:**
1. Check Twilio/MailerSend API keys in Vercel
2. Verify phone number/email format
3. Check Vercel function logs for errors
4. Test API endpoints directly
5. Verify service account has sufficient credits

#### Migrations Fail

**Symptom:** Database migrations error out

**Solutions:**
```bash
# Check database connection
supabase db ping

# Verify Supabase project permissions
supabase projects list

# Look for conflicting table names
# Review migration files for syntax errors

# Check migration order (chronological by filename)
ls -la supabase/migrations/
```

#### Storage/Bucket Access Denied

**Symptom:** File uploads fail

**Solutions:**
```sql
-- Check bucket policies
SELECT * FROM storage.buckets WHERE id = 'community-moments';

-- Check object permissions
SELECT * FROM storage.objects WHERE bucket_id = 'community-moments' LIMIT 10;

-- Verify bucket is public (if needed)
UPDATE storage.buckets
SET public = true
WHERE id = 'community-moments';
```

### Performance Issues

#### Slow Page Load

**Solutions:**
1. Check Vercel Analytics for bottlenecks
2. Optimize images (use WebP format)
3. Implement lazy loading for components
4. Review bundle size: `npm run build` (check for large chunks)
5. Use Vercel Image Optimization

#### High Database Load

**Solutions:**
1. Add database indexes for frequently queried columns
2. Review slow queries in Supabase dashboard
3. Implement pagination for large result sets
4. Use database connection pooling
5. Consider caching frequently accessed data

---

## Rollback Procedures

### When to Rollback

**Minor Issues** (fix forward):
- Small UI bugs
- Non-critical feature issues
- Performance degradation

**Major Issues** (rollback required):
- Critical security vulnerabilities
- Data corruption
- Complete service outage
- Authentication failures

### Rollback Code (Vercel)

#### Option 1: Redeploy Previous Version

```bash
# View deployment history
vercel ls

# Promote a previous deployment to production
vercel promote <deployment-url>
```

#### Option 2: Git Revert

```bash
# Revert last commit
git revert HEAD

# Push to trigger redeploy
git push origin main

# Vercel will automatically deploy reverted code
```

### Rollback Database

**Only if absolutely necessary (last resort):**

```bash
# Restore from backup
psql $PRODUCTION_DB_URL < backup-production-[timestamp].sql
```

**Selective Rollback:**

```sql
-- Remove only new features (if safe)
DROP TABLE IF EXISTS community_moments CASCADE;
DROP TABLE IF EXISTS affirmations CASCADE;

-- Revert specific columns (if safe)
ALTER TABLE profiles DROP COLUMN IF EXISTS new_column;
```

### Post-Rollback Actions

1. Notify users of temporary service restoration
2. Document the issue and cause
3. Create bug report and action plan
4. Test fix in staging environment
5. Prepare hotfix deployment

---

## Monitoring and Maintenance

### First 24 Hours After Deployment

Monitor these metrics closely:

```bash
# Check Vercel logs continuously
vercel logs --follow

# Watch for errors
vercel logs | grep -i "error\|fail"
```

**Checklist:**
- [ ] Check error logs every 2 hours
- [ ] Monitor Supabase dashboard for issues
- [ ] Watch for user support tickets
- [ ] Check RLS policy errors
- [ ] Verify sync functionality (offline reports)
- [ ] Monitor API rate limits
- [ ] Check service worker registration rate

### Key Performance Indicators

#### Offline Adoption Metrics

```sql
-- Service worker registration rate
SELECT
  COUNT(DISTINCT user_id) as users_with_offline,
  COUNT(DISTINCT user_id) * 100.0 / (SELECT COUNT(*) FROM profiles) as percentage
FROM user_sessions
WHERE metadata->>'service_worker_registered' = 'true';

-- Offline reports created
SELECT
  DATE(created_at) as date,
  COUNT(*) as offline_reports
FROM self_reports
WHERE metadata->>'source' = 'offline_sync'
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 7;
```

#### Sync Performance

```sql
-- Average sync delay
SELECT
  AVG(
    EXTRACT(EPOCH FROM (synced_at - created_at))
  ) / 60 as avg_delay_minutes
FROM self_reports
WHERE metadata->>'source' = 'offline_sync'
  AND synced_at IS NOT NULL;

-- Sync success rate
SELECT
  COUNT(CASE WHEN synced_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) as success_rate
FROM self_reports
WHERE metadata->>'source' = 'offline_sync';
```

#### User Engagement

```sql
-- Daily active users
SELECT
  DATE(last_sign_in_at) as date,
  COUNT(DISTINCT id) as daily_active_users
FROM auth.users
WHERE last_sign_in_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(last_sign_in_at)
ORDER BY date DESC;

-- Feature usage
SELECT
  'Check-ins' as feature,
  COUNT(*) as usage_count,
  COUNT(DISTINCT user_id) as unique_users
FROM check_ins
WHERE created_at >= NOW() - INTERVAL '7 days'

UNION ALL

SELECT
  'Community Moments' as feature,
  COUNT(*) as usage_count,
  COUNT(DISTINCT user_id) as unique_users
FROM community_moments
WHERE created_at >= NOW() - INTERVAL '7 days';
```

### Regular Maintenance Tasks

#### Daily
- [ ] Review error logs
- [ ] Check database performance
- [ ] Monitor API usage and rate limits
- [ ] Verify backup completion

#### Weekly
- [ ] Review user feedback and support tickets
- [ ] Analyze feature usage metrics
- [ ] Check for security updates
- [ ] Review and optimize slow queries

#### Monthly
- [ ] Database maintenance (vacuum, analyze)
- [ ] Review and update dependencies
- [ ] Security audit
- [ ] Performance optimization review
- [ ] Backup retention cleanup

### User Communication

#### Post-Deployment Announcement

Template email/notification:

```
Subject: WellFit Updates - New Features Available

Dear WellFit Community,

We've just updated the WellFit Community Daily app with new features:

- [List key features from deployment]
- Improved offline functionality
- Enhanced health tracking
- Better performance and reliability

If you experience any issues, please contact support at [contact info].

Thank you for being part of the WellFit community!
```

#### Documentation Updates

- [ ] Update user help documentation
- [ ] Update training materials
- [ ] Train support team on new features
- [ ] Update FAQ with common questions

---

## Success Criteria

Deployment is considered successful when:

- [ ] All migrations applied without errors
- [ ] Verification script passes on production
- [ ] All tenant sites load correctly (if multi-tenant)
- [ ] No critical errors in logs (first 24 hours)
- [ ] Users can register and log in
- [ ] Users can complete daily check-ins
- [ ] Crisis intervention flow works
- [ ] Doctor's view displays health data
- [ ] Offline mode functions correctly
- [ ] Service Worker registration > 90%
- [ ] Data sync success rate > 95%
- [ ] No RLS policy violations
- [ ] Performance metrics within acceptable range
- [ ] Support team trained on new features
- [ ] User documentation updated

---

## Next Steps After Successful Deployment

### Week 1
- [ ] Monitor metrics daily
- [ ] Address any bug reports immediately
- [ ] Collect user feedback
- [ ] Document any issues encountered
- [ ] Create hotfix plan if needed

### Week 2-4
- [ ] Analyze feature usage patterns
- [ ] Review performance trends
- [ ] Plan improvements based on feedback
- [ ] Consider A/B testing for new features
- [ ] Prepare for next deployment cycle

### Future Enhancements

Potential roadmap items:
- [ ] International crisis line numbers
- [ ] Tenant-specific affirmations and content
- [ ] Enhanced health data visualizations
- [ ] Care team collaboration features
- [ ] Voice navigation for accessibility
- [ ] Additional language support (Vietnamese, Chinese)
- [ ] Expanded trivia questions (50+ questions)
- [ ] Data retention policy automation

---

## Support and Contact

### Technical Support

- **Vercel Issues:** Check Vercel status page and support
- **Supabase Issues:** Check Supabase dashboard and support
- **Database Issues:** Review Supabase logs and connection strings
- **Application Issues:** Check Vercel function logs

### Emergency Contacts

- **On-Call Engineer:** [Contact information]
- **Database Admin:** [Contact information]
- **Security Team:** [Contact information]

### Resources

- **Vercel Documentation:** https://vercel.com/docs
- **Supabase Documentation:** https://supabase.com/docs
- **WellFit User Documentation:** `/OFFLINE_MODE.md`
- **HIPAA Compliance:** `/docs/HIPAA_COMPLIANCE.md`
- **Project Repository:** [GitHub/GitLab URL]

---

## Appendix: Deployment Timeline Example

### Pre-Deployment (Day -7 to -1)
- Review all code changes
- Complete security audit
- Test in staging environment
- Prepare backup procedures
- Schedule maintenance window
- Notify users of upcoming update

### Deployment Day (Day 0)
- **Hour 0:** Backup production database
- **Hour 0.5:** Deploy to Vercel
- **Hour 1:** Verify deployment successful
- **Hour 1-2:** Run smoke tests
- **Hour 2-4:** Critical path testing
- **Hour 4-8:** Monitor error logs
- **Hour 8-24:** Continuous monitoring

### Post-Deployment (Day 1-7)
- **Day 1:** Intensive monitoring, address critical issues
- **Day 2-3:** Analyze metrics, collect feedback
- **Day 4-7:** Address non-critical bugs, plan improvements
- **Day 7:** Post-deployment review meeting

---

**Deployment Status:** [ ] NOT STARTED | [ ] IN PROGRESS | [ ] COMPLETE | [ ] ROLLED BACK

**Deployed By:** _____________
**Deployment Date:** _____________
**Verified By:** _____________
**Verification Date:** _____________

**Notes:**

---

*This deployment guide is a living document. Update it after each deployment with lessons learned and improved procedures.*
