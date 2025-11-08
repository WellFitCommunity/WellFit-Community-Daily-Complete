# Methodist Healthcare Load Testing Suite

Comprehensive load testing for Methodist Healthcare multi-tenant deployment.

## Prerequisites

- k6 installed (already done)
- Supabase project URL and anon key
- 26 minutes total test time (all tests)

## Test Suite Overview

### 1. Methodist Baseline Test (`methodist-baseline.js`)
**Purpose:** Validate 120-180 concurrent user capacity
**Duration:** 26 minutes
**Key Metrics:**
- Mixed workload: 30% registration, 20% login, 20% check-ins, 15% FHIR, 15% queries
- Target: P95 < 2s, error rate < 1%
- Tests all critical Methodist workflows

**Run:**
```bash
export SUPABASE_ANON_KEY="your-anon-key"
k6 run load-tests/methodist-baseline.js --out json=load-tests/results/baseline-results.json
```

### 2. Multi-Tenant Isolation Test (`multi-tenant-isolation.js`)
**Purpose:** Verify 4 tenants can run simultaneously without interference
**Duration:** 11 minutes
**Key Metrics:**
- Tests: houston (40%), miami (30%), dallas (20%), atlanta (10%)
- Validates Row-Level Security (RLS)
- Ensures fair resource allocation
- Target: Zero cross-tenant data leakage

**Run:**
```bash
export SUPABASE_ANON_KEY="your-anon-key"
k6 run load-tests/multi-tenant-isolation.js --out json=load-tests/results/isolation-results.json
```

### 3. Database Connection Stress (`db-connection-stress.js`)
**Purpose:** Test Supabase Pro 500 connection limit
**Duration:** 16 minutes
**Key Metrics:**
- Pushes to 250 concurrent users (~375 connections)
- Tests connection pool exhaustion
- Target: < 20 connection errors, < 5 pool exhaustion events
- Validates Methodist's 180 user requirement (~270 connections)

**Run:**
```bash
export SUPABASE_ANON_KEY="your-anon-key"
k6 run load-tests/db-connection-stress.js --out json=load-tests/results/db-stress-results.json
```

## Quick Start

### Run All Tests (Recommended for full assessment)
```bash
# Set your Supabase anon key
export SUPABASE_ANON_KEY="your-anon-key-here"

# Run baseline test
echo "Running Methodist baseline test..."
k6 run load-tests/methodist-baseline.js --out json=load-tests/results/baseline-$(date +%Y%m%d-%H%M%S).json

# Run multi-tenant isolation
echo "Running multi-tenant isolation test..."
k6 run load-tests/multi-tenant-isolation.js --out json=load-tests/results/isolation-$(date +%Y%m%d-%H%M%S).json

# Run database stress test
echo "Running database connection stress test..."
k6 run load-tests/db-connection-stress.js --out json=load-tests/results/db-stress-$(date +%Y%m%d-%H%M%S).json

echo "All tests complete! Check load-tests/results/ for detailed metrics."
```

### Run Single Test (Quick validation)
```bash
export SUPABASE_ANON_KEY="your-anon-key-here"
k6 run load-tests/methodist-baseline.js
```

## Get Supabase Anon Key

```bash
# From your .env file
grep REACT_APP_SUPABASE_ANON_KEY .env | cut -d '=' -f2

# Or from Supabase dashboard:
# Project Settings > API > anon public key
```

## Understanding Results

### Success Criteria

**Methodist Baseline:**
- ✅ P95 response time < 2 seconds
- ✅ Error rate < 1%
- ✅ Zero enrollment failures
- ✅ Zero database errors

**Multi-Tenant Isolation:**
- ✅ Zero cross-tenant data leaks (CRITICAL)
- ✅ All tenants maintain < 2s response time
- ✅ No resource starvation (fairness)

**Database Stress:**
- ✅ Handle 180 users without pool exhaustion
- ✅ Connection errors < 20 total
- ✅ Pool exhaustion events < 5
- ✅ P95 query time < 3s (under stress)

### Reading k6 Output

**Key Sections:**
```
checks.........................: 95.00%  ✅ Good (target: >95%)
http_req_duration..............: avg=850ms p(95)=1.8s  ✅ Under 2s
http_req_failed................: 0.50%   ✅ Under 1%
```

**Custom Metrics:**
```
enrollment_errors..............: 0       ✅ No failures
cross_tenant_data_leaks........: 0       ✅ Isolation maintained
pool_exhaustion_events.........: 2       ⚠️  Monitor connection management
```

## Interpreting Results

### Green Light (Methodist Ready)
- All thresholds passed
- Zero cross-tenant leaks
- No connection pool exhaustion
- P95 < 2s at 180 concurrent users

### Yellow Light (Address Before Demo)
- 1-3 pool exhaustion events (monitor)
- P95 between 2-3s (acceptable but optimize)
- < 5 fairness violations (minor)

### Red Light (Needs Work)
- Cross-tenant data leaks detected (CRITICAL - fix immediately)
- Pool exhaustion > 5 events (review connection management)
- P95 > 3s (optimize queries/indexes)
- Error rate > 1% (investigate failures)

## Troubleshooting

### "too many clients" Error
**Cause:** Connection pool exhausted
**Fix:**
1. Check Edge Functions close connections properly
2. Review pgBouncer configuration
3. Reduce connection hold time
4. Consider Supabase tier upgrade

### High P95 Response Times
**Cause:** Slow queries under load
**Fix:**
1. Review database indexes: `EXPLAIN ANALYZE` on slow queries
2. Add caching for frequent queries
3. Optimize N+1 query patterns
4. Use database performance insights

### Cross-Tenant Data Leaks
**Cause:** RLS policy gaps (CRITICAL)
**Fix:**
1. Review all RLS policies
2. Ensure `tenant_id` filter in all queries
3. Test RLS with `SET LOCAL role` in psql
4. Add integration tests for isolation

## Results Location

All test results saved to:
```
load-tests/results/
├── baseline-20251107-143022.json
├── isolation-20251107-144520.json
└── db-stress-20251107-150145.json
```

## Methodist Demo Checklist

Before presenting to Methodist:

- [ ] Run all 3 load tests
- [ ] Verify zero cross-tenant leaks
- [ ] Confirm 180 user capacity
- [ ] Document P95 response times
- [ ] Review connection pool health
- [ ] Prepare bottleneck mitigation plan (if any)
- [ ] Have results JSON files ready

## Cost Estimate

**Load testing time investment:**
- Initial setup: 1 hour (already done)
- Running tests: 26 minutes
- Analyzing results: 1-2 hours
- Fixing issues (if found): 4-8 hours

**Total:** 1-2 days for full load testing cycle

## Next Steps After Testing

1. **If all tests pass:** Proceed with Methodist demo
2. **If yellow flags:** Document monitoring plan, proceed with caution
3. **If red flags:** Address critical issues before demo

## Support

For questions or issues:
- Review test output and metrics
- Check `load-tests/results/` JSON files
- Consult Supabase performance docs
- Review database query logs
