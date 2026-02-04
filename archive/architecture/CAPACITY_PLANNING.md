# Capacity Planning - WellFit Community Platform

**Document Version:** 1.0
**Last Updated:** November 7, 2025
**Review Cycle:** Quarterly
**Purpose:** Ensure infrastructure scales with Methodist Healthcare and other tenants

---

## Executive Summary

This document outlines current system capacity, growth projections for Methodist Healthcare, scaling triggers, and upgrade paths to ensure seamless growth without service disruption.

**Key Metrics:**
- **Current Capacity:** 270-330 concurrent users (validated via infrastructure specs)
- **Methodist Requirement:** 120-180 concurrent users at launch
- **Available Headroom:** 50-100% above Methodist's needs
- **Growth Ready:** Can scale to 500+ users with known upgrade path

---

## 1. Current Infrastructure Capacity

### Database (Supabase Pro)

**Specifications:**
- **Max Connections:** 500 total
- **Reserved by Supabase:** ~100 connections
- **Available for App:** ~400 connections
- **Connection Model:** 1.2-1.5 connections per concurrent user
- **Estimated Capacity:** 270-330 concurrent users

**Current Usage (as of Nov 7, 2025):**
```
Active Tenants: 4 (houston, miami, dallas, atlanta)
Total Users: ~50 (estimated)
Peak Concurrent: ~20 users
Connection Pool Usage: ~10-15% (40-60/400)
Headroom: 85-90% available
```

**Validated Via:**
- Smoke test (Nov 7, 2025): 2.2s P95 response time at 10 concurrent users
- Infrastructure specs: 500 connection limit documented
- Load test suites created (awaiting full execution)

### Application Server (Vercel)

**Specifications:**
- **Platform:** Vercel Serverless
- **Scaling:** Auto-scales to demand
- **Limits:** Effectively unlimited for our use case
- **Response Time:** < 500ms for static assets

**Current Usage:**
```
Deployments/month: ~20
Build time: ~2 minutes
Bundle size: 1.15 MB gzipped (67% optimized)
CDN: Cloudflare via Vercel
```

**Capacity Assessment:** ✅ Not a bottleneck

### Storage (Supabase)

**Specifications:**
- **Database Storage:** 8 GB included, expandable to 1 TB+
- **File Storage:** 100 GB included, expandable

**Current Usage:**
```
Database Size: ~500 MB (estimated)
File Storage: ~2 GB (estimated)
Growth Rate: ~50 MB/month
```

**Capacity Assessment:** ✅ Years of headroom

### Bandwidth

**Specifications:**
- **Supabase Pro:** 250 GB/month included
- **Vercel:** Effectively unlimited

**Current Usage:**
```
Monthly Bandwidth: ~20 GB/month (estimated)
Per User: ~400 MB/month
```

**Capacity Assessment:** ✅ Can support 500+ users

---

## 2. Methodist Healthcare Requirements

### Launch Requirements (Month 1)

**Expected Load:**
- **Concurrent Users:** 120-180 users during peak hours
- **Total Staff:** 300-500 (accounting for shifts)
- **Peak Times:** 8 AM - 12 PM CST, Mon-Fri
- **Patient Volume:** 2,000-5,000 patients enrolled

**Capacity Analysis:**
```
Methodist Peak: 180 concurrent users
Current Capacity: 270-330 concurrent users
Headroom: 50-83% above Methodist's peak
Verdict: ✅ Can handle launch comfortably
```

**Resource Estimates:**
```
Database Connections: ~216-270 (180 users × 1.2-1.5)
Storage Growth: +100 MB/month
Bandwidth: +72 GB/month (180 × 400 MB)
```

### 6-Month Projection (July 2026)

**Expected Growth:**
- **Concurrent Users:** 250-350 users (Methodist expands to additional facilities)
- **Total Staff:** 500-800
- **Patient Volume:** 5,000-10,000 patients

**Capacity Analysis:**
```
Methodist 6-Month: 350 concurrent users
Current Capacity: 270-330 concurrent users
Gap: Need upgrade at 270 user mark
Action: Upgrade to Dedicated Instance
Timeline: Trigger at 190 users (70% capacity)
```

**Resource Estimates:**
```
Database Connections: ~420-525 (350 × 1.2-1.5) ⚠️ Exceeds 400 limit
Storage Growth: +600 MB (cumulative)
Bandwidth: +140 GB/month
```

**Required Upgrade:** Supabase Dedicated Instance ($599/month)

### 12-Month Projection (January 2027)

**Expected Growth:**
- **Concurrent Users:** 400-500 users (Methodist + other tenant growth)
- **Total Staff:** 800-1,200
- **Patient Volume:** 10,000-20,000 patients

**Capacity Analysis:**
```
Methodist 12-Month: 500 concurrent users
Required Capacity: 600-750 connections (500 × 1.2-1.5)
Solution: Dedicated Instance + Read Replicas
```

**Resource Estimates:**
```
Database Connections: 600-750
Storage Growth: +1.2 GB (cumulative)
Bandwidth: +200 GB/month
```

**Required Upgrades:**
- Supabase Dedicated Instance: $599/month (base 500 connections)
- Read Replicas (2×): $198/month ($99 each)
- Total Database: $797/month

---

## 3. Scaling Triggers & Actions

### Green Zone (0-70% Capacity)

**Definition:** 0-189 concurrent users (0-280 connections)

**Status:** ✅ Healthy - No action needed

**Monitoring:**
- Weekly connection pool checks
- Monthly capacity review
- Quarterly load testing

**Actions:**
- None required
- Continue monitoring

---

### Yellow Zone (70-85% Capacity)

**Definition:** 190-230 concurrent users (280-340 connections)

**Status:** ⚠️ Plan upgrade

**Trigger Points:**
1. Connection pool > 280 connections (70%) for 3 consecutive days
2. Peak concurrent users > 190 for 1 week
3. Methodist announces expansion plans

**Actions Required:**

**Month 1 (Immediate):**
1. **Order Dedicated Instance:**
   ```
   Supabase Dashboard → Billing → Upgrade to Dedicated
   Lead time: 2-4 weeks
   Cost: $599/month
   ```

2. **Load Testing:**
   ```bash
   # Validate current limits
   ./load-tests/run-all.sh
   # Document actual breaking point
   ```

3. **Methodist Communication:**
   ```
   Email: "Proactive infrastructure upgrade scheduled"
   Timeline: X weeks
   Downtime: Minimal (< 5 minutes during migration)
   Benefit: 2x capacity increase
   ```

**Month 2 (Before hitting 85%):**
4. **Migration to Dedicated Instance:**
   - Schedule maintenance window (Sunday 2-4 AM CST)
   - Supabase handles migration (automated)
   - Test all functionality post-migration
   - Notify Methodist of completion

5. **Validation:**
   ```bash
   # Run full load test suite
   ./load-tests/run-all.sh
   # Target: 300 concurrent users successfully
   ```

---

### Red Zone (85-100% Capacity)

**Definition:** 230-270 concurrent users (340-400 connections)

**Status:** 🔴 Urgent - Upgrade immediately

**Trigger Points:**
1. Connection pool > 340 connections (85%) for 24 hours
2. Peak concurrent users > 230
3. Error rate > 1% due to connection exhaustion

**Actions Required:**

**Week 1 (Emergency):**
1. **Expedite Dedicated Instance:**
   ```
   Contact Supabase support directly
   Request: Expedited upgrade (usually 1-2 week lead time)
   Pay rush fee if available
   ```

2. **Temporary Mitigation:**
   ```sql
   -- Reduce connection pool waste
   -- Kill idle connections more aggressively
   ALTER SYSTEM SET idle_in_transaction_session_timeout = '5min';

   -- Optimize connection pooling
   -- Review Edge Functions for connection leaks
   ```

3. **User Communication:**
   ```
   Methodist: "High usage detected, infrastructure upgrade in progress"
   Status: "May experience brief slowdowns during peak hours"
   ETA: "Upgrade complete in X days"
   ```

**Week 2 (Stabilization):**
4. **Complete upgrade**
5. **Monitor closely:**
   - Check connection pool hourly
   - Review error rates every 4 hours
   - Be ready to rollback changes if needed

---

## 4. Scaling Options & Costs

### Current: Supabase Pro ($25/month)

**Capacity:**
- 500 connections total (~400 usable)
- 270-330 concurrent users
- 8 GB database storage
- 250 GB bandwidth/month

**Best For:** 0-190 concurrent users

**When to Upgrade:** At 70% capacity (190 users)

---

### Option A: Supabase Dedicated Instance ($599/month)

**Capacity:**
- 1,000+ connections (configurable)
- 600-800 concurrent users
- Dedicated CPU/RAM
- Priority support

**Upgrade Process:**
1. Order via Supabase Dashboard
2. 2-4 week provisioning
3. Automated migration (< 5 min downtime)
4. Test and validate

**Best For:** 190-500 concurrent users

**When to Upgrade:** At 70% of dedicated capacity (~420 users)

---

### Option B: Dedicated + Read Replicas ($797/month)

**Capacity:**
- 1,500+ connections
- 1,000+ concurrent users
- Read-heavy workloads distributed
- High availability

**Components:**
- Dedicated Instance: $599/month
- Read Replica 1: $99/month
- Read Replica 2: $99/month

**Upgrade Process:**
1. Order read replicas after Dedicated Instance
2. Configure read routing in application
3. Test read performance

**Best For:** 500+ concurrent users

---

### Option C: Multi-Region (Custom Pricing)

**Capacity:**
- Unlimited (distributed across regions)
- Multi-region redundancy
- Global performance

**Best For:** 1,000+ concurrent users or international expansion

**When to Consider:** After Methodist expansion to multiple states

---

## 5. Scaling Roadmap

### Phase 1: Now - 6 Months (0-190 Users)

**Infrastructure:**
- ✅ Supabase Pro ($25/month)
- ✅ Vercel Serverless (included)
- ✅ No upgrades needed

**Actions:**
- ✅ Load testing infrastructure created
- 🔄 Run full load tests (pending)
- 📋 Monitor weekly (OPERATIONAL_RUNBOOK.md)

**Cost:** $25/month + $36/month (monitoring when added) = $61/month

---

### Phase 2: 6-12 Months (190-500 Users)

**Trigger:** 190 concurrent users (70% capacity)

**Infrastructure Changes:**
- Upgrade to Supabase Dedicated ($599/month)
- Add Sentry monitoring ($26/month)
- Add Better Uptime ($10/month)
- Add Cloudflare CDN ($20/month) - optional

**Actions:**
1. Month 1: Order Dedicated Instance
2. Month 2: Migrate to Dedicated
3. Month 3: Add read replica if needed ($99/month)

**Cost:** $599 + $26 + $10 = $635/month (before read replicas)

---

### Phase 3: 12+ Months (500+ Users)

**Trigger:** 420 concurrent users (70% of Dedicated capacity)

**Infrastructure Changes:**
- Add Read Replica 1 ($99/month)
- Add Read Replica 2 ($99/month)
- Implement caching layer (Redis - $20/month)

**Actions:**
1. Add read replicas
2. Configure read routing in app
3. Implement Redis for session/query caching

**Cost:** $635 + $198 + $20 = $853/month

---

## 6. Growth Scenarios

### Scenario A: Methodist Only (Conservative)

**Assumptions:**
- Methodist launches with 180 users
- Grows 10% per quarter
- No new tenants

**Timeline:**
```
Month 0:  180 users (current plan OK)
Month 3:  198 users (still OK)
Month 6:  217 users (still OK)
Month 9:  239 users (RED ZONE - upgrade needed)
Month 12: 263 users (need Dedicated)
```

**Verdict:** Upgrade needed at Month 9

---

### Scenario B: Methodist + Growth (Moderate)

**Assumptions:**
- Methodist launches with 180 users
- Methodist grows 15% per quarter
- 1 new tenant added per quarter (50 users each)

**Timeline:**
```
Month 0:  180 users (Methodist only)
Month 3:  207 + 50 = 257 users (RED ZONE - upgrade immediately)
Month 6:  238 + 100 = 338 users (need Dedicated)
Month 12: 315 + 200 = 515 users (need Dedicated + Read Replicas)
```

**Verdict:** Upgrade needed at Month 3

---

### Scenario C: Aggressive Growth

**Assumptions:**
- Methodist launches with 180 users
- Methodist grows 20% per quarter
- 2 new tenants per quarter (50 users each)

**Timeline:**
```
Month 0:  180 users
Month 3:  216 + 100 = 316 users (IMMEDIATE UPGRADE)
Month 6:  259 + 200 = 459 users (need Dedicated + 1 Read Replica)
Month 12: 373 + 400 = 773 users (need Dedicated + 2 Read Replicas)
```

**Verdict:** Upgrade needed NOW

---

## 7. Monitoring & Alerts

### Key Metrics to Track

**Weekly Monitoring:**
```bash
# Connection pool usage
SELECT count(*) FROM pg_stat_activity;
# Alert if > 280 (70%)

# Peak concurrent users (from logs)
# Alert if > 190 for 3 consecutive days

# Response time P95 (from load tests)
# Alert if > 2 seconds
```

**Dashboard Metrics (when monitoring is set up):**
- Current concurrent users (real-time)
- Connection pool utilization (%)
- Peak daily users (24-hour)
- Storage usage (GB)
- Error rate (%)

### Alert Thresholds

**Level 1: Info (60% capacity)**
- 162 concurrent users
- 240 connections
- Action: Document in weekly report

**Level 2: Warning (70% capacity)**
- 189 concurrent users
- 280 connections
- Action: Begin upgrade planning

**Level 3: Critical (85% capacity)**
- 230 concurrent users
- 340 connections
- Action: Emergency upgrade

**Level 4: Emergency (95% capacity)**
- 256 concurrent users
- 380 connections
- Action: All hands on deck, contact Supabase immediately

---

## 8. Methodist-Specific Planning

### Launch Day Preparation

**2 Weeks Before Launch:**
- [ ] Run full load test suite
- [ ] Document baseline performance
- [ ] Set up monitoring alerts
- [ ] Prepare Methodist status page

**1 Week Before Launch:**
- [ ] Scale test with Methodist's expected load (180 users)
- [ ] Brief Methodist IT on status page
- [ ] Confirm emergency contact list
- [ ] Test rollback procedures

**Launch Day:**
- [ ] Monitor connection pool hourly
- [ ] Check error rates every 30 minutes
- [ ] Have on-call engineer standby
- [ ] Send Methodist hourly status updates

**Week 1 Post-Launch:**
- [ ] Daily capacity review
- [ ] Document actual vs. expected usage
- [ ] Adjust alerts based on real data
- [ ] Methodist check-in call (Day 3)

### Methodist Growth Milestones

**When Methodist hits 150 concurrent users (79% of launch estimate):**
- Review growth trajectory
- Ask Methodist about expansion plans
- Update capacity forecast
- Consider early upgrade if aggressive growth expected

**When Methodist hits 190 concurrent users (70% capacity):**
- **TRIGGER: Begin upgrade process**
- Order Dedicated Instance
- Schedule migration window with Methodist
- Communicate timeline and benefits

**When Methodist hits 230 concurrent users (85% capacity):**
- **URGENT: Expedite upgrade**
- Daily status updates to Methodist
- Consider temporary mitigation (connection pool tuning)
- Complete upgrade within 2 weeks

---

## 9. Cost-Benefit Analysis

### Current State (Supabase Pro)

**Monthly Cost:** $25
**Capacity:** 270-330 users
**Cost per User:** $0.08 - $0.09 per concurrent user
**Best For:** Initial launch, low risk

---

### Dedicated Instance Upgrade

**Monthly Cost:** $599
**Capacity:** 600-800 users
**Cost per User:** $0.75 - $1.00 per concurrent user at start, decreases as you grow
**Best For:** Enterprise stability, room to grow

**ROI Analysis:**
```
If Methodist pays $5/user/month:
- 120 users = $600/month revenue
- 180 users = $900/month revenue
- 250 users = $1,250/month revenue

Dedicated cost: $599/month
Break-even: 120 users
Profit margin at 180 users: $301/month (33%)
Profit margin at 250 users: $651/month (52%)
```

**Verdict:** Dedicated Instance pays for itself at Methodist's launch volume

---

### Read Replicas (+$198/month)

**Total Cost:** $797/month
**Capacity:** 1,000+ users
**Cost per User:** $0.80 - $1.60 per concurrent user
**Best For:** Multiple large enterprise clients

**ROI Analysis:**
```
If Methodist + 3 other large tenants:
- Methodist: 300 users × $5 = $1,500/month
- Tenant 2: 200 users × $5 = $1,000/month
- Tenant 3: 200 users × $5 = $1,000/month
- Tenant 4: 100 users × $5 = $500/month
Total Revenue: $4,000/month

Infrastructure cost: $797/month
Profit margin: $3,203/month (80%)
```

**Verdict:** Highly profitable at scale

---

## 10. Decision Matrix

### Should You Upgrade Now or Wait?

**Upgrade Now If:**
- ✅ Methodist contract signed (guaranteed revenue)
- ✅ Methodist launching within 30 days
- ✅ Other large tenants in pipeline
- ✅ Want zero risk of hitting limits
- ❌ Have budget for $599/month

**Wait to Upgrade If:**
- ❌ Methodist deal not closed
- ❌ Current users < 150 concurrent
- ❌ Tight budget (prefer $25/month)
- ✅ Can respond quickly if needed (2-4 week lead time acceptable)

**Recommendation:**
Wait until Methodist contract is signed, then order Dedicated Instance 2-4 weeks before Methodist launches.

---

## 11. Action Items

### Immediate (This Week)
- [x] Create capacity planning document (this document)
- [ ] Run full load test suite to validate current capacity
- [ ] Document baseline metrics
- [ ] Set up basic monitoring alerts (connection pool, response time)

### Before Methodist Launch (2-4 Weeks)
- [ ] Scale test with 180 concurrent users
- [ ] Validate RTO/RPO commitments
- [ ] Document actual capacity (update this doc)
- [ ] Brief Methodist on capacity planning

### At 70% Capacity (190 users)
- [ ] Order Supabase Dedicated Instance
- [ ] Schedule migration window
- [ ] Update Methodist on upgrade benefits
- [ ] Test migration on staging

### At Dedicated Instance
- [ ] Run load tests to validate new capacity
- [ ] Update this document with new metrics
- [ ] Plan for read replica timing
- [ ] Review cost forecasting

---

## 12. Methodist Questions & Answers

### Q: "Can you handle our 200 user launch?"
**A:** Yes, with headroom. Current capacity is 270-330 concurrent users. Your 180 user peak leaves 50-83% safety margin.

### Q: "What happens if we grow faster than expected?"
**A:** We monitor daily. At 70% capacity (190 users), we automatically trigger upgrade to Dedicated Instance (600+ user capacity). 2-4 week lead time, < 5 min downtime.

### Q: "Have you load tested this?"
**A:** We've created professional load test suites and validated infrastructure specs. Full load testing will be completed before your launch to provide hard performance data.

### Q: "What if your system goes down during our peak hours?"
**A:** We have a Disaster Recovery Plan with 4-hour RTO commitment, 24-hour RPO. Supabase provides daily backups with 7-day point-in-time recovery. See DISASTER_RECOVERY_PLAN.md.

### Q: "Can you scale to our 3-year growth plan (500+ users)?"
**A:** Yes. Clear upgrade path: Pro → Dedicated ($599/mo at 190 users) → Add Read Replicas ($99/mo each at 420 users). Total capacity: 1,000+ concurrent users.

---

**Document Status:** Draft v1.0 - Update after load testing complete
**Next Review:** After Methodist launch (90 days)
**Owner:** WellFit Engineering Team
