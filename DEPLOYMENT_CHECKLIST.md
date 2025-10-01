# Deployment Checklist - October 2025 Updates

## Pre-Deployment

### 1. Review Changes
- [ ] Read [QUICK_REFERENCE_CHANGES.md](QUICK_REFERENCE_CHANGES.md)
- [ ] Read [MIGRATION_AND_MULTITENANCY_NOTES.md](MIGRATION_AND_MULTITENANCY_NOTES.md)
- [ ] Review migration files in `supabase/migrations/202510010000*.sql`

### 2. Local Verification
- [x] Run verification script: `./scripts/verify-migrations.sh`
- [x] All checks passed ✓
- [x] TypeScript compiles without errors
- [x] Linting passes (warnings only)

### 3. Test Locally
- [ ] Test Community Moments page loads
- [ ] Test crisis intervention flow (988/911/emergency contact)
- [ ] Test doctor's view shows health data
- [ ] Test multiple user accounts

---

## Staging Deployment

### 4. Database Backup
```bash
# Backup staging database before changes
supabase db dump --db-url $STAGING_DB_URL > backup-staging-$(date +%Y%m%d).sql
```

### 5. Apply Migrations to Staging
```bash
# Option 1: Using Supabase CLI
supabase link --project-ref your-staging-project
supabase db push

# Option 2: Via SQL Editor
# Copy and run each migration file in Supabase dashboard
```

### 6. Verify Staging
```bash
# Run verification script
./scripts/verify-migrations.sh $STAGING_DB_URL

# Should output: "✓ All checks passed!"
```

### 7. Test on Each Tenant
Test on all subdomains:

**Houston Tenant** (houston.yourdomain.com)
- [ ] Community Moments loads
- [ ] Crisis intervention shows Houston branding
- [ ] Check-in buttons use Houston colors
- [ ] 988 call link works
- [ ] 911 call link works

**Miami Tenant** (miami.yourdomain.com)
- [ ] Community Moments loads
- [ ] Crisis intervention shows Miami branding
- [ ] Check-in buttons use Miami colors
- [ ] Emergency contact link works

**Phoenix Tenant** (phoenix.yourdomain.com)
- [ ] All features work with Phoenix branding

**Seattle Tenant** (seattle.yourdomain.com)
- [ ] All features work with Seattle branding

**Default** (yourdomain.com)
- [ ] All features work with WellFit branding

### 8. User Acceptance Testing
- [ ] Test as regular user (patient)
- [ ] Test as caregiver
- [ ] Test as nurse/staff
- [ ] Test as admin
- [ ] Verify RLS - users can't see others' data

---

## Production Deployment

### 9. Database Backup (CRITICAL)
```bash
# ALWAYS backup production before changes
supabase db dump --db-url $PRODUCTION_DB_URL > backup-production-$(date +%Y%m%d-%H%M).sql

# Store backup in secure location
aws s3 cp backup-production-*.sql s3://your-backups-bucket/
```

### 10. Schedule Maintenance Window
- [ ] Notify users of brief maintenance
- [ ] Choose low-traffic time
- [ ] Estimated downtime: 5-10 minutes

### 11. Deploy Code Changes
```bash
# Deploy CheckInTracker.tsx changes
git add src/components/CheckInTracker.tsx
git commit -m "feat: Add crisis intervention flow with 988/911 support"
git push origin main

# Your CI/CD should handle deployment
# Or deploy manually to your hosting provider
```

### 12. Apply Database Migrations
```bash
# Link to production project
supabase link --project-ref your-production-project

# Apply migrations
supabase db push

# Verify
./scripts/verify-migrations.sh $PRODUCTION_DB_URL
```

### 13. Smoke Test Production
Immediately after deployment:

- [ ] Community Moments page loads
- [ ] Check-in page loads
- [ ] Doctor's view loads
- [ ] No JavaScript errors in console
- [ ] No 500 errors in logs

### 14. Test Critical Paths
- [ ] User can create account
- [ ] User can log in
- [ ] User can do daily check-in
- [ ] Crisis intervention flow works
- [ ] Admin dashboard loads

---

## Post-Deployment

### 15. Monitor
First 24 hours:
- [ ] Check error logs every 2 hours
- [ ] Monitor Supabase dashboard for issues
- [ ] Watch for user support tickets
- [ ] Check RLS policy errors

### 16. User Communication
- [ ] Announce new features to users
- [ ] Update help documentation
- [ ] Train support team on crisis intervention features

### 17. Metrics to Track
- [ ] Community moments created (should increase)
- [ ] Check-ins completed (should remain steady)
- [ ] Crisis intervention triggers (monitor for patterns)
- [ ] Error rate (should remain low)

---

## Rollback Plan

### If Issues Occur

**Minor Issues (keep changes, fix forward)**
- Log the issue
- Create bug fix ticket
- Deploy fix ASAP

**Major Issues (rollback required)**

#### Rollback Code
```bash
git revert HEAD
git push origin main
```

#### Rollback Database
```bash
# Only if absolutely necessary
psql $PRODUCTION_DB_URL < backup-production-[timestamp].sql
```

#### Or Selective Rollback
```sql
-- Remove only the new features
DROP TABLE IF EXISTS community_moments CASCADE;
DROP TABLE IF EXISTS affirmations CASCADE;
DROP TABLE IF EXISTS check_ins CASCADE;

-- Keep the new columns (they don't hurt anything)
-- Rollback code only if needed
```

---

## Support Resources

### Common Issues

**Issue: Migrations fail**
- Check database connection
- Verify Supabase project permissions
- Look for conflicting table names
- Check migration order

**Issue: RLS blocks users**
```sql
-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'community_moments';

-- Test as user
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims.sub = 'user-uuid';
```

**Issue: Storage bucket access denied**
```sql
-- Check bucket policies
SELECT * FROM storage.objects WHERE bucket_id = 'community-moments';
```

### Contact Information
- Database issues: Check Supabase dashboard
- Application issues: Check hosting logs
- User issues: Support ticket system

---

## Success Criteria

Deployment is successful when:

- [x] All migrations applied ✓
- [ ] Verification script passes on production
- [ ] All tenant sites load correctly
- [ ] No critical errors in logs
- [ ] Users can use new features
- [ ] Crisis intervention flow works
- [ ] Doctor's view shows health data
- [ ] No RLS policy violations
- [ ] Performance remains acceptable
- [ ] Support team trained

---

## Next Steps After Deployment

### Week 1
- Monitor metrics daily
- Address any bug reports
- Collect user feedback

### Week 2-4
- Analyze feature usage
- Plan improvements based on feedback
- Consider tenant-specific affirmations (if requested)

### Future Enhancements
- [ ] International crisis line numbers
- [ ] Tenant-specific affirmations
- [ ] Enhanced health data visualizations
- [ ] Care team collaboration features

---

## Notes

**Date Applied to Local:** 2025-10-01
**Date Applied to Staging:** _____________
**Date Applied to Production:** _____________

**Applied By:** _____________
**Verified By:** _____________

**Issues Encountered:**


**Resolution:**


---

## Final Checklist

Before closing this deployment:

- [ ] All environments verified
- [ ] Users notified of new features
- [ ] Documentation updated
- [ ] Support team trained
- [ ] Backups stored securely
- [ ] Metrics baseline recorded
- [ ] This checklist filed for future reference

**Deployment Status:** ⬜ NOT STARTED | ⬜ IN PROGRESS | ⬜ COMPLETE | ⬜ ROLLED BACK
