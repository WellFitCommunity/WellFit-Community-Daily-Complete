# Claude Code Skills & Commands Reference

## Overview

This document describes all Claude Code skills and slash commands configured for the WellFit project.

**Created:** November 16, 2025
**Purpose:** Accelerate development, ensure code quality, and maintain compliance for Methodist Hospital demo (Dec 5th, 2025)

---

## 📁 Directory Structure

```
.claude/
├── AGENT_INSTRUCTIONS.md          # Core agent instructions
├── SKILLS_AND_COMMANDS.md         # This file
├── skills/                        # Reusable automation skills
│   ├── pre-commit/
│   │   └── skill.md              # Pre-commit validation
│   ├── hipaa-check/
│   │   └── skill.md              # HIPAA compliance scanner
│   ├── test-runner/
│   │   └── skill.md              # Smart test execution
│   ├── deploy/
│   │   └── skill.md              # Deployment checklist
│   └── ai-cost-monitor/
│       └── skill.md              # AI cost tracking
└── commands/                      # Quick slash commands
    ├── demo-ready.md             # Methodist demo validation
    ├── cost-check.md             # AI cost quick check
    └── security-scan.md          # HIPAA security scan
```

---

## 🛠️ Skills (Detailed Automation)

### 1. Pre-Commit Validation Skill
**Location:** `.claude/skills/pre-commit/skill.md`

**Purpose:** Validate code quality before commits

**What it checks:**
- ✅ Linting (0 errors)
- ✅ Type checking (0 errors)
- ✅ Tests (625+ passing)
- ✅ PHI security (no console.log violations)
- ✅ GPG signing (commit signing enabled)

**When to use:**
- Before every commit
- Before creating PRs
- After major refactoring

**Success criteria:** All 5 checks must pass

---

### 2. HIPAA Compliance Checker Skill
**Location:** `.claude/skills/hipaa-check/skill.md`

**Purpose:** Scan for HIPAA compliance violations

**What it scans:**
- 🔍 PHI logging violations
- 🔍 Missing RLS policies
- 🔍 Unencrypted PHI fields
- 🔍 Missing audit logging
- 🔍 Hardcoded credentials

**When to use:**
- Before demos
- Weekly security review
- Before SOC2 audit
- After adding PHI fields

**Compliance coverage:** HIPAA § 164.312 (Technical Safeguards)

---

### 3. Test Runner Skill
**Location:** `.claude/skills/test-runner/skill.md`

**Purpose:** Intelligently run tests with change detection

**Execution modes:**
- **Smart mode:** Run only affected tests (85-92% faster)
- **Full mode:** Complete test suite (625+ tests)
- **Coverage mode:** Generate coverage reports
- **Watch mode:** Active development
- **Failed only:** Re-run failures

**When to use:**
- **Smart mode:** During development
- **Full mode:** Pre-commit, CI/CD
- **Coverage mode:** Before releases

**Performance:** Smart mode: 4-10s vs. Full suite: 50-60s

---

### 4. Deployment Checklist Skill
**Location:** `.claude/skills/deploy/skill.md`

**Purpose:** Comprehensive pre-deployment validation

**What it validates (9 steps):**
1. Code quality (lint, types, tests)
2. Database migrations (all applied)
3. Environment variables (all configured)
4. Edge functions (deployed & operational)
5. MCP server (health check)
6. Security (GPG, encryption, RLS)
7. HIPAA compliance (scan)
8. Performance (bundle size, load time)
9. Monitoring (alerts configured)

**When to use:**
- Before production deployments
- Before staging deployments
- Before demo environment setup
- Nov 30th - Methodist demo final check

**Success criteria:** All 9 validations must pass

---

### 5. AI Cost Monitor Skill
**Location:** `.claude/skills/ai-cost-monitor/skill.md`

**Purpose:** Track and optimize AI spending

**What it monitors:**
- 💰 Daily/weekly/monthly costs
- 💰 Cost by AI skill (11 skills)
- 💰 Model usage (Haiku vs. Sonnet)
- 💰 Cache performance (hit rate)
- 💰 Budget tracking
- 💰 Cost anomaly detection

**When to use:**
- Daily monitoring (5 min)
- Weekly review (detailed analysis)
- Monthly planning (budget reconciliation)
- Before demos (ensure stable costs)

**Data sources:**
- `claude_usage_logs` (MCP calls)
- 11 AI skill tables (billing, readmission, SDOH, etc.)

---

## ⚡ Slash Commands (Quick Actions)

### 1. `/demo-ready` - Methodist Hospital Demo Validation
**Location:** `.claude/commands/demo-ready.md`

**Purpose:** Validate everything is ready for Dec 5th demo

**What it checks (10 validations):**
1. Code quality
2. FHIR integration (Epic sync)
3. AI features (5 demo features)
4. Security & compliance
5. Care coordination (Guardian Agent)
6. Performance (bundle size, load time)
7. Demo data (test accounts, sample data)
8. White-label configuration
9. Mobile responsiveness
10. Browser console (no errors)

**When to run:**
- Daily starting Nov 25th
- Dec 1st - Full rehearsal
- Dec 4th - Final validation
- Dec 5th Morning - Last check

**Output:** Detailed readiness report with demo talking points

---

### 2. `/cost-check` - AI Cost Quick Analysis
**Location:** `.claude/commands/cost-check.md`

**Purpose:** Quick summary of AI spending

**What it shows:**
- Total spending (last 7 days)
- Top 5 cost drivers
- Monthly budget status
- Quick optimization wins

**When to use:**
- Daily check (2 min)
- Before demo
- Monthly planning

**Output:** Concise cost summary with budget status

---

### 3. `/security-scan` - HIPAA Security Scan
**Location:** `.claude/commands/security-scan.md`

**Purpose:** Run HIPAA compliance checks

**What it scans:**
- PHI logging violations
- RLS policies (87 tables)
- Field encryption (12 fields)
- Audit logging (15 services)
- Hardcoded secrets

**When to use:**
- Before every commit
- Before demos
- Weekly security review
- Before SOC2 audit

**Output:** Compliance report with remediation steps

---

## 📊 Usage Examples

### Before Committing Code

```bash
# Run pre-commit validation
# (Invokes Pre-Commit Validation Skill)
# Automatically checks lint, types, tests, PHI security, GPG signing
```

### Before Methodist Demo

```bash
# Check demo readiness
/demo-ready

# Expected output: 10/10 validations passing
# Shows demo talking points and highlights
```

### Daily Cost Monitoring

```bash
# Quick cost check
/cost-check

# Shows spending, budget status, top cost drivers
```

### Weekly Security Review

```bash
# Run HIPAA compliance scan
/security-scan

# Validates all security controls
# Reports violations with remediation steps
```

### Before Deployment

```bash
# Run deployment checklist
# (Invokes Deployment Checklist Skill)
# Validates 9 deployment prerequisites
```

---

## 🎯 Integration with Existing Workflows

### Git Workflow Integration

**Pre-commit:**
- Automatically validates code quality
- Blocks commits if checks fail
- Ensures GPG signing enabled

**Pre-push:**
- Can add security scan
- Can add cost check

### CI/CD Integration

**On Pull Request:**
- Run full test suite
- Run security scan
- Check code quality

**Before Deployment:**
- Run deployment checklist
- Validate HIPAA compliance
- Check AI costs

### Methodist Demo Preparation

**Timeline:**
- **Nov 25th:** Start daily `/demo-ready` checks
- **Dec 1st:** Full rehearsal with `/demo-ready`
- **Dec 4th:** Final validation
- **Dec 5th AM:** Last check before demo

---

## 💡 Tips & Best Practices

### For Development

1. **Use smart test mode** during active development (85-92% faster)
2. **Run pre-commit validation** before every commit
3. **Check costs daily** with `/cost-check` (2 min)
4. **Run security scan weekly** to catch issues early

### For Demos

1. **Run `/demo-ready` daily** starting 10 days before demo
2. **Practice demo script** with `/demo-ready` checklist
3. **Verify all features** listed in demo validation
4. **Have backup environment** ready

### For Deployments

1. **Run deployment checklist** before every deploy
2. **Validate all 9 steps** (don't skip any)
3. **Block deployment** if ANY critical check fails
4. **Monitor post-deployment** with security scan

### For Cost Optimization

1. **Monitor cache hit rate** (target: >80%)
2. **Use Haiku for high-volume tasks** (75% cheaper)
3. **Use Sonnet for critical accuracy** (readmission prediction)
4. **Enable batch processing** for skills #10, #11

---

## 🚀 Quick Start

### First Time Setup

1. **Verify skills are loaded:**
   ```bash
   ls .claude/skills/
   # Should show: pre-commit, hipaa-check, test-runner, deploy, ai-cost-monitor
   ```

2. **Verify commands are loaded:**
   ```bash
   ls .claude/commands/
   # Should show: demo-ready.md, cost-check.md, security-scan.md
   ```

3. **Test a command:**
   ```bash
   /demo-ready
   # Should run Methodist demo validation
   ```

### Daily Workflow

**Morning:**
```bash
/cost-check              # 2 min - Check AI spending
```

**During Development:**
```bash
# Smart test mode automatically runs affected tests
# Pre-commit skill runs before commits
```

**Before Demo (Nov 25 - Dec 5):**
```bash
/demo-ready              # 5 min - Comprehensive demo check
```

**Weekly:**
```bash
/security-scan           # 5 min - HIPAA compliance audit
```

---

## 📈 Success Metrics

### Code Quality
- **Linting errors:** 0 (enforced by pre-commit)
- **Type errors:** 0 (enforced by pre-commit)
- **Passing tests:** 625+ (tracked by test runner)

### Security & Compliance
- **PHI logging violations:** 0 (scanned weekly)
- **RLS coverage:** 87/87 tables (100%)
- **Encrypted PHI fields:** 12/12 (100%)
- **GPG signing:** Enabled (verified pre-commit)

### Performance
- **Bundle size:** <2 MB (validated pre-deploy)
- **Load time:** <3s (validated pre-deploy)
- **Test execution:** 85-92% faster (smart mode)

### AI Costs
- **Monthly budget:** $100
- **Cache hit rate:** >80%
- **Cost per request:** ~$0.004
- **Estimated savings:** $42+/month (from caching)

---

## 🔧 Troubleshooting

### Skill Not Found

**Problem:** Skill doesn't execute
**Solution:** Check `.claude/skills/` directory exists and contains skill.md file

### Command Not Found

**Problem:** Slash command doesn't work
**Solution:** Check `.claude/commands/` directory contains command.md file

### Pre-Commit Failing

**Problem:** Pre-commit validation blocks commit
**Solution:** Fix reported issues (lint, types, tests) before committing

### Cost Check Shows High Spending

**Problem:** AI costs exceeding budget
**Solution:**
1. Check cache hit rate (should be >80%)
2. Review model usage (use Haiku for simple tasks)
3. Enable batch processing for skills #10, #11

---

## 📚 Related Documentation

- **Agent Instructions:** `.claude/AGENT_INSTRUCTIONS.md`
- **Project Instructions:** `CLAUDE.md`
- **MCP Integration:** `docs/MCP_INTEGRATION.md`
- **AI Skills Guide:** `docs/AI_SKILLS_CONFIGURATION_GUIDE.md`
- **HIPAA Compliance:** `docs/HIPAA_SOC2_SECURITY_AUDIT.md`
- **Security Controls:** `docs/SOC2_SECURITY_CONTROLS.md`

---

## 🎯 Methodist Hospital Demo Checklist

Use `/demo-ready` command for full validation. Key items:

- [ ] All tests passing (625+)
- [ ] FHIR integration working
- [ ] Epic sync functional
- [ ] AI features operational (5 demo features)
- [ ] HIPAA compliance clean
- [ ] GPG signing verified
- [ ] Bundle size <2 MB
- [ ] Demo data loaded
- [ ] No browser console errors

**Demo Date:** December 5th, 2025
**Run `/demo-ready` daily starting Nov 25th**

---

## 🤝 Contributing

When creating new skills or commands:

1. **Create skill in `.claude/skills/SKILL_NAME/skill.md`**
2. **Create command in `.claude/commands/COMMAND_NAME.md`**
3. **Document in this file** (SKILLS_AND_COMMANDS.md)
4. **Test thoroughly** before committing
5. **Add to relevant workflows** (pre-commit, CI/CD)

---

**Last Updated:** November 16, 2025
**Version:** 1.0.0
**Status:** ✅ Production Ready
