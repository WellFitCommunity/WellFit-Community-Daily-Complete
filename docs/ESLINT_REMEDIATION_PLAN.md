# ESLint Security & Code Quality Remediation Plan

**Status:** Active
**Created:** 2025-11-03
**Owner:** WellFit Engineering Team
**Goal:** Zero tech debt in security-critical code paths

## Executive Summary

After configuring ESLint to suppress false positives and style-only issues, we've reduced findings from **2,915 to 1,012** (65% reduction). This document outlines a systematic plan to address the remaining **real security and code quality issues**.

## Current State (Post-Configuration)

### Issues Breakdown
- **Total Issues:** 1,012 (down from 2,915)
- **Security Issues:** ~587 (58%)
- **TypeScript Quality:** ~224 (22%)
- **Testing Issues:** ~51 (5%)
- **Other:** ~150 (15%)

### Top Issues by Count
1. **262** - `security/detect-object-injection` (Generic) - **MOSTLY FALSE POSITIVES**
2. **178** - `@typescript-eslint/no-non-null-assertion` - **REAL ISSUE**
3. **39** - `security/detect-object-injection` (Variable) - **NEEDS REVIEW**
4. **36** - `@typescript-eslint/ban-ts-comment` - **REAL ISSUE**
5. **23** - Testing Library best practices - **LOW PRIORITY**

## Prioritized Remediation Plan

### Phase 1: Critical Security Issues (Week 1)
**Goal:** Eliminate actual security vulnerabilities

#### Task 1.1: Fix Non-Null Assertions (178 instances)
**Priority:** HIGH
**Risk:** Runtime errors, potential crashes in production
**Location:** Throughout codebase

**Issue:**
```typescript
// Bad - crashes if user is null
const email = user!.email;

// Good - safe access
const email = user?.email ?? 'unknown';
```

**Action Plan:**
1. Run: `npx eslint --config .eslintrc.security.js src/ --format json | jq '.[] | select(.messages[].ruleId == "@typescript-eslint/no-non-null-assertion")'`
2. Replace `!` assertions with optional chaining `?.`
3. Add proper null checks for PHI access paths
4. Priority files:
   - `src/contexts/AuthContext.tsx`
   - `src/services/*` (API layer)
   - `src/components/patient/*` (PHI handling)

**Estimated Effort:** 2-3 days
**Success Metric:** 0 non-null assertions in PHI-handling code

---

#### Task 1.2: Review Object Injection (39 variable assignments)
**Priority:** HIGH
**Risk:** Potential injection if user input flows to bracket notation
**Location:** Dynamic property access

**Issue:**
```typescript
// Potentially unsafe if `key` comes from user input
const value = obj[key];

// Safe if validated
const allowedKeys = ['name', 'email', 'phone'];
const value = allowedKeys.includes(key) ? obj[key] : null;
```

**Action Plan:**
1. Identify the 39 variable assignment instances
2. Review each for user input flow
3. Add validation for user-controlled keys
4. Use `Object.hasOwn()` for safe property checks

**Estimated Effort:** 1-2 days
**Success Metric:** All user-input bracket access validated

---

#### Task 1.3: Eliminate @ts-ignore Comments (36 instances)
**Priority:** MEDIUM
**Risk:** Hidden TypeScript errors, type safety bypassed
**Location:** Throughout codebase

**Issue:**
```typescript
// Bad - hides type errors
// @ts-ignore
user.invalidProperty = value;

// Good - fix the type
interface User {
  invalidProperty?: string;
}
```

**Action Plan:**
1. Find all 36 instances: `grep -r "@ts-ignore" src/`
2. For each:
   - Fix the underlying type issue, OR
   - Replace with `@ts-expect-error` with explanation
3. Add ESLint rule to prevent new @ts-ignore

**Estimated Effort:** 2 days
**Success Metric:** 0 @ts-ignore, <5 @ts-expect-error with docs

---

#### Task 1.4: Fix Script URLs (5 instances)
**Priority:** CRITICAL
**Risk:** XSS vulnerability
**Location:** Likely in legacy code or third-party integrations

**Issue:**
```typescript
// DANGEROUS - XSS vulnerability
<a href="javascript:doSomething()">Click</a>

// Safe alternative
<button onClick={doSomething}>Click</button>
```

**Action Plan:**
1. Find all 5 instances: `npx eslint --config .eslintrc.security.js src/ | grep "no-script-url"`
2. Replace with proper event handlers
3. Review for XSS vectors

**Estimated Effort:** 2 hours
**Success Metric:** 0 script URLs

---

#### Task 1.5: Fix Non-Literal RegExp (5 instances)
**Priority:** MEDIUM
**Risk:** ReDoS attacks if user input flows to RegExp
**Location:** Search/validation logic

**Issue:**
```typescript
// Potentially unsafe if `pattern` from user input
const regex = new RegExp(pattern);

// Safe - validate/sanitize first
const safePattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const regex = new RegExp(safePattern);
```

**Action Plan:**
1. Find 5 instances
2. Review if pattern comes from user input
3. Add input validation/sanitization
4. Use literal RegExp where possible

**Estimated Effort:** 4 hours
**Success Metric:** All dynamic RegExp validated

---

### Phase 2: Code Quality Improvements (Week 2)
**Goal:** Improve maintainability and reduce technical debt

#### Task 2.1: Fix Unused Variables (25 instances)
**Priority:** LOW
**Risk:** Dead code, confusion

**Action Plan:**
1. Remove unused imports: `handleOptions`, `corsFromRequest` duplicates
2. Prefix unused vars with `_` for callbacks: `_data`, `_error`
3. Remove dead code

**Estimated Effort:** 4 hours
**Success Metric:** <5 unused vars

---

#### Task 2.2: Fix Duplicate Declarations (12 instances)
**Priority:** LOW
**Risk:** Build errors in strict mode

**Action Plan:**
1. Fix duplicate `handleOptions` and `corsFromRequest` imports
2. Likely caused by recent CORS refactor

**Estimated Effort:** 1 hour
**Success Metric:** 0 duplicates

---

#### Task 2.3: Improve Test Quality (51 instances)
**Priority:** LOW
**Location:** Test files only

**Action Plan:**
1. Remove unnecessary `act()` wrappers (23)
2. Fix `waitFor` assertions (13)
3. Use Testing Library queries properly (11)

**Estimated Effort:** 1 day
**Success Metric:** All tests follow best practices

---

### Phase 3: Generic Object Injection Review (Week 3)
**Goal:** Review 262 "false positive" object injection warnings

#### Task 3.1: Categorize Object Injection Warnings
**Action Plan:**
1. Export full list with context
2. Categorize:
   - **Safe:** TypeScript interfaces, config objects
   - **Needs Review:** User input flow
   - **Needs Fix:** Unvalidated user input
3. Fix "Needs Fix" category
4. Document "Safe" category for future reference

**Estimated Effort:** 2-3 days
**Success Metric:** All user-input paths validated

---

## Implementation Strategy

### Week-by-Week Rollout

**Week 1: Critical Security**
- Days 1-2: Non-null assertions in PHI code
- Day 3: Script URLs + Non-literal RegExp
- Days 4-5: Object injection review (39 instances)

**Week 2: Code Quality**
- Day 1: @ts-ignore elimination
- Days 2-3: Unused vars, duplicates, imports
- Days 4-5: Test improvements

**Week 3: Comprehensive Review**
- Days 1-3: Generic object injection categorization
- Days 4-5: Documentation and final fixes

### Success Metrics

| Metric | Current | Week 1 | Week 2 | Week 3 | Target |
|--------|---------|--------|--------|--------|--------|
| Total Issues | 1,012 | 800 | 600 | 300 | <100 |
| Critical Security | 49 | 0 | 0 | 0 | 0 |
| Non-null assertions | 178 | 50 | 20 | 0 | 0 |
| @ts-ignore | 36 | 36 | 0 | 0 | 0 |
| Script URLs | 5 | 0 | 0 | 0 | 0 |

## Automation & Prevention

### Pre-commit Hooks
```bash
# Add to .husky/pre-commit
npx eslint --config .eslintrc.security.js --ext .ts,.tsx \
  --rule '@typescript-eslint/no-non-null-assertion: error' \
  --rule 'no-script-url: error' \
  $(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$')
```

### CI/CD Gates
- Block PRs with new critical security issues
- Allow warnings for tracked tech debt
- Weekly report on remediation progress

### Education
- Team training on TypeScript null safety
- Brown bag: "Common ESLint Security Issues"
- Code review checklist update

## Quick Wins (Do First)

These can be done immediately for fast impact:

1. **Fix duplicate imports** (12 issues, 1 hour)
   ```bash
   # Find duplicates
   grep -r "import.*corsFromRequest.*from" supabase/functions/
   ```

2. **Fix script URLs** (5 issues, 2 hours)
   ```bash
   npx eslint src/ --config .eslintrc.security.js --rule 'no-script-url: error'
   ```

3. **Prefix unused vars** (25 issues, 4 hours)
   ```typescript
   // Change: const data = ...
   // To:     const _data = ...
   ```

**Total Quick Wins:** 42 issues fixed in ~7 hours

## Long-term Strategy

### Gradual TypeScript Strictness
```json
// tsconfig.json - enable incrementally
{
  "compilerOptions": {
    "strictNullChecks": true,        // Week 4
    "noImplicitAny": true,           // Week 8
    "strictFunctionTypes": true,     // Week 12
    "strict": true                   // Week 16
  }
}
```

### Codebase Health Dashboard
- Weekly ESLint metrics
- Tech debt burndown chart
- Security issue trend line
- Team velocity on fixes

## Resources

### Useful Commands

```bash
# Count issues by rule
npx eslint --config .eslintrc.security.js src/ --format json | \
  jq -r '.[] | .messages[] | .ruleId' | sort | uniq -c | sort -rn

# Find specific rule violations
npx eslint src/ --config .eslintrc.security.js --rule 'no-script-url: error' --format compact

# Fix auto-fixable issues
npx eslint src/ --config .eslintrc.security.js --fix

# Generate report for specific directory
npx eslint src/components/patient/ --config .eslintrc.security.js --format html > patient-report.html
```

### Documentation
- [ESLint Security Plugin](https://github.com/eslint-community/eslint-plugin-security)
- [TypeScript Null Safety](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [OWASP Code Review Guide](https://owasp.org/www-project-code-review-guide/)

## Ownership & Accountability

| Phase | Owner | Reviewer | Due Date |
|-------|-------|----------|----------|
| Phase 1 | TBD | Tech Lead | Week 1 |
| Phase 2 | TBD | Senior Dev | Week 2 |
| Phase 3 | TBD | Security Team | Week 3 |

---

## Summary

**Immediate Actions (This Week):**
1. ✅ Configure ESLint to suppress false positives (DONE)
2. 🔄 Fix 5 script URLs (CRITICAL - 2 hours)
3. 🔄 Fix duplicate imports (QUICK WIN - 1 hour)
4. 🔄 Start non-null assertion fixes in PHI code (HIGH - ongoing)

**Expected Outcomes:**
- Week 1: 800 issues (21% reduction)
- Week 2: 600 issues (41% reduction)
- Week 3: 300 issues (70% reduction)
- **Final: <100 issues (90% reduction)**

**This plan balances:**
- ⚡ Quick wins for morale
- 🔒 Security-first prioritization
- 📊 Measurable progress
- 🎯 Achievable milestones

---

**Next Steps:**
1. Review and approve this plan
2. Assign owners for each phase
3. Create tracking board/tickets
4. Start with Quick Wins (7 hours for 42 issues)
5. Begin Phase 1 Week 1 Monday morning
