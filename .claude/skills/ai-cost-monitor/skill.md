# AI Cost Monitor Skill

## Purpose
Track and optimize AI costs across MCP (Model Context Protocol) and the 11 AI automation skills to prevent budget overruns.

## What This Skill Does

Monitors AI spending across multiple dimensions:
1. **Daily Costs** - Track spending by day
2. **Cost by Skill** - Break down by AI skill (billing suggester, readmission predictor, etc.)
3. **Model Usage** - Compare Haiku vs. Sonnet costs
4. **Cache Performance** - Measure prompt caching savings
5. **Cost Trends** - Identify cost spikes and patterns
6. **Budget Alerts** - Warn if approaching limits

## Data Sources

### MCP Usage Logs
```sql
SELECT * FROM claude_usage_logs
WHERE request_type LIKE 'mcp_%'
ORDER BY created_at DESC;
```

### AI Skills Usage
```sql
-- Billing suggestions
SELECT * FROM encounter_billing_suggestions;

-- Readmission predictions
SELECT * FROM readmission_risk_predictions;

-- SDOH detections
SELECT * FROM sdoh_passive_detections;

-- Cultural coach translations
SELECT * FROM cultural_health_translations;

-- Handoff summaries
SELECT * FROM care_handoff_summaries;

-- CCM eligibility scores
SELECT * FROM ccm_eligibility_assessments;

-- Welfare check dispatches
SELECT * FROM welfare_check_dispatches;
```

## Cost Analysis Queries

### Query 1: Daily Cost Summary
```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_requests,
  SUM(input_tokens) as input_tokens,
  SUM(output_tokens) as output_tokens,
  SUM(cost) as total_cost,
  SUM(CASE WHEN from_cache THEN 1 ELSE 0 END) as cached_requests,
  ROUND(
    100.0 * SUM(CASE WHEN from_cache THEN 1 ELSE 0 END) / COUNT(*),
    2
  ) as cache_hit_rate
FROM claude_usage_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Query 2: Cost by AI Skill
```sql
SELECT
  request_type,
  COUNT(*) as requests,
  SUM(cost) as total_cost,
  AVG(cost) as avg_cost_per_request,
  MAX(cost) as max_cost,
  SUM(input_tokens + output_tokens) as total_tokens
FROM claude_usage_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY request_type
ORDER BY total_cost DESC;
```

### Query 3: Model Usage Comparison
```sql
SELECT
  model,
  COUNT(*) as requests,
  SUM(cost) as total_cost,
  AVG(response_time_ms) as avg_response_time,
  SUM(input_tokens) as input_tokens,
  SUM(output_tokens) as output_tokens
FROM claude_usage_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY model
ORDER BY total_cost DESC;
```

### Query 4: Cache Performance Analysis
```sql
-- Calculate savings from caching
WITH cache_stats AS (
  SELECT
    COUNT(*) FILTER (WHERE from_cache = true) as cached,
    COUNT(*) FILTER (WHERE from_cache = false) as uncached,
    SUM(cost) FILTER (WHERE from_cache = true) as cached_cost,
    SUM(cost) FILTER (WHERE from_cache = false) as uncached_cost,
    AVG(input_tokens) FILTER (WHERE from_cache = false) as avg_uncached_tokens
  FROM claude_usage_logs
  WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
)
SELECT
  cached,
  uncached,
  cached + uncached as total_requests,
  ROUND(100.0 * cached / (cached + uncached), 2) as cache_hit_rate,
  ROUND(cached_cost, 4) as cached_cost,
  ROUND(uncached_cost, 4) as uncached_cost,
  ROUND(cached_cost + uncached_cost, 4) as total_cost,
  -- Estimated cost without caching
  ROUND(
    (cached * avg_uncached_tokens * 0.000003) + uncached_cost,
    4
  ) as estimated_cost_without_cache,
  ROUND(
    ((cached * avg_uncached_tokens * 0.000003) + uncached_cost) - (cached_cost + uncached_cost),
    4
  ) as estimated_savings
FROM cache_stats;
```

### Query 5: Budget Tracking
```sql
-- Check current month spending vs. budget
WITH monthly_costs AS (
  SELECT
    DATE_TRUNC('month', created_at) as month,
    SUM(cost) as total_cost
  FROM claude_usage_logs
  WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
  GROUP BY DATE_TRUNC('month', created_at)
)
SELECT
  month,
  ROUND(total_cost, 2) as spent,
  100.00 as budget,  -- $100/month default budget
  ROUND(100.0 * total_cost / 100.00, 2) as budget_used_percent,
  ROUND(100.00 - total_cost, 2) as remaining
FROM monthly_costs;
```

### Query 6: Top Cost Drivers
```sql
-- Identify most expensive operations
SELECT
  request_type,
  user_id,
  DATE(created_at) as date,
  COUNT(*) as request_count,
  SUM(cost) as total_cost
FROM claude_usage_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY request_type, user_id, DATE(created_at)
HAVING SUM(cost) > 1.00  -- Operations costing >$1
ORDER BY total_cost DESC
LIMIT 20;
```

## Cost Optimization Recommendations

### Recommendation Engine

Based on analysis, suggest optimizations:

**High Cache Miss Rate (<70%):**
- Review prompt structure for consistency
- Ensure diagnosis codes are sorted
- Check cache TTL settings

**High Haiku Usage with Low Accuracy:**
- Consider upgrading to Sonnet for critical tasks
- Implement confidence threshold filtering

**High Sonnet Usage for Simple Tasks:**
- Downgrade to Haiku where appropriate
- Use Haiku for: billing codes, SDOH detection, translations
- Keep Sonnet for: readmission prediction, complex analysis

**Batch Processing Opportunities:**
- Skills #10, #11 should use daily batches
- Reduce real-time API calls
- Aggregate requests where possible

## Output Format

```
💰 AI COST MONITOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 COST SUMMARY (Last 7 Days)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Requests:        2,847
Total Cost:            $12.43
Avg Cost/Request:      $0.0044
Cache Hit Rate:        87.3%
Estimated Savings:     $42.15 (from caching)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💸 COST BY SKILL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Readmission Predictor      $4.82  (38.8%)  |████████████░░░░|
2. Billing Code Suggester     $2.41  (19.4%)  |██████░░░░░░░░░░|
3. CCM Eligibility Scorer     $1.93  (15.5%)  |█████░░░░░░░░░░░|
4. Cultural Health Coach      $1.35  (10.9%)  |███░░░░░░░░░░░░░|
5. SDOH Passive Detector      $0.89  (7.2%)   |██░░░░░░░░░░░░░░|
6. Handoff Synthesizer        $0.67  (5.4%)   |█░░░░░░░░░░░░░░░|
7. Welfare Check Dispatcher   $0.36  (2.9%)   |█░░░░░░░░░░░░░░░|

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 MODEL USAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Claude Sonnet 4.5:
  Requests: 247
  Cost: $8.92 (71.7%)
  Avg Response: 1,247ms

Claude Haiku 4.5:
  Requests: 2,600
  Cost: $3.51 (28.2%)
  Avg Response: 423ms

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 DAILY TREND
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Nov 15: $2.14  |████████░░░░░░░░░░░░| 387 requests
Nov 14: $1.89  |███████░░░░░░░░░░░░░| 412 requests
Nov 13: $1.76  |██████░░░░░░░░░░░░░░| 398 requests
Nov 12: $1.92  |███████░░░░░░░░░░░░░| 401 requests
Nov 11: $1.45  |█████░░░░░░░░░░░░░░░| 289 requests
Nov 10: $0.98  |███░░░░░░░░░░░░░░░░░| 234 requests (weekend)
Nov 9:  $1.29  |████░░░░░░░░░░░░░░░░| 267 requests (weekend)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💳 BUDGET STATUS (November 2025)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Monthly Budget:        $100.00
Current Spending:      $47.23 (47.2%)
Remaining:             $52.77 (52.8%)
Days Remaining:        16 days
Projected Total:       $89.56 ✅

Status: 🟢 ON TRACK

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ OPTIMIZATION RECOMMENDATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Cache performance: Excellent (87.3% hit rate)
✅ Model selection: Appropriate (Haiku for 91% of requests)
✅ Batch processing: Active (Welfare Check using daily batches)

💡 Suggestions:
  1. Consider caching readmission predictions for 24h (save $1.20/day)
  2. Review high-cost users (user_abc123: $3.45 this week)
  3. Enable auto-apply for billing codes >95% confidence (reduce review time)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Alert Thresholds

**Budget Alerts:**
- 🟡 Warning at 75% of monthly budget
- 🟠 Alert at 90% of monthly budget
- 🔴 Critical at 100% of monthly budget

**Anomaly Detection:**
- Daily cost spike >2x average
- Cache hit rate drop <60%
- Model cost change >50% day-over-day
- Individual request cost >$1.00

## When to Use This Skill

**Daily Monitoring:**
- Morning check (5 min)
- Review cost trends
- Check for anomalies

**Weekly Review:**
- Detailed analysis
- Optimization opportunities
- Budget forecast

**Monthly Planning:**
- Budget reconciliation
- Skill ROI analysis
- Cost optimization planning

**Before Demos:**
- Ensure costs are stable
- No unexpected spikes
- Budget headroom available

## Integration with AI Skills

This skill monitors all 11 AI automation skills:
1. ~~Skill #1~~ (deprecated)
2. Billing Code Suggester
3. Readmission Risk Predictor
4. SDOH Passive Detector
5. ~~Skill #5~~ (not implemented)
6. Cultural Health Coach
7. Handoff Risk Synthesizer
8. ~~Skill #8~~ (not implemented)
9. CCM Eligibility Scorer
10. Welfare Check Dispatcher
11. Emergency Access Intelligence

## Notes for AI Agent

- Always show budget status prominently
- Highlight cost anomalies
- Compare to baseline/targets
- Suggest actionable optimizations
- Track month-over-month trends
- Show ROI when possible (e.g., billing codes accepted)
- Alert on budget overage risk
- Provide cost breakdown by skill
