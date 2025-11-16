# AI Cost Analysis Command

Quick analysis of AI costs across MCP and the 11 AI automation skills.

## What This Command Does

Runs the **AI Cost Monitor skill** to show:
1. Current spending (daily/weekly/monthly)
2. Cost breakdown by AI skill
3. Model usage (Haiku vs. Sonnet)
4. Cache performance and savings
5. Budget status and projections
6. Optimization recommendations

## Execution

Invoke the AI Cost Monitor skill with default parameters (last 7 days analysis).

## Expected Output

```
💰 AI COST ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 QUICK SUMMARY (Last 7 Days)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Spent:           $12.43
Total Requests:        2,847
Avg Cost/Request:      $0.0044
Cache Hit Rate:        87.3%
Savings from Cache:    $42.15

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💸 TOP 5 COST DRIVERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Readmission Predictor      $4.82  (38.8%)
2. Billing Code Suggester     $2.41  (19.4%)
3. CCM Eligibility Scorer     $1.93  (15.5%)
4. Cultural Health Coach      $1.35  (10.9%)
5. SDOH Passive Detector      $0.89  (7.2%)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💳 MONTHLY BUDGET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Budget:                $100.00
Current Spending:      $47.23  (47.2%)
Remaining:             $52.77  (52.8%)
Days Remaining:        16 days
Projected Total:       $89.56 ✅

Status: 🟢 ON TRACK

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ QUICK WINS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Cache performance: Excellent (87% hit rate)
✅ Model usage: Optimized (Haiku for 91% of requests)

💡 Suggestion: Consider batch processing for readmission predictor (save ~$1.20/day)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Use Cases

**Daily Check (2 minutes):**
```
/cost-check
```
Quick glance at spending and budget status

**Before Demo:**
- Ensure costs are stable
- No unexpected spikes
- Budget headroom available

**Monthly Planning:**
- Review spending trends
- Adjust budgets
- Optimize high-cost operations

## Related Commands

- `/demo-ready` - Includes cost check as part of demo validation
- Full analysis - Use the **AI Cost Monitor skill** directly for detailed reports

## Notes

This is a quick summary command. For detailed analysis including:
- Daily cost trends
- Per-user cost breakdown
- Cache performance deep dive
- Model comparison analysis

Use the **AI Cost Monitor skill** directly instead of this command.
