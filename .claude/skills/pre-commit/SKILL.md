# Pre-Commit Validation Skill

## Purpose
Automatically validate code quality before commits to prevent broken builds and maintain HIPAA compliance standards.

## What This Skill Does

This skill runs a comprehensive pre-commit validation suite that includes:

1. **Code Linting** - Check code style compliance
2. **Type Checking** - Verify TypeScript types are correct
3. **Test Suite** - Run all tests to ensure no breaking changes
4. **PHI Security Check** - Scan for console.log() in PHI-handling code
5. **GPG Signing** - Verify commit signing is enabled

## Execution Steps

### Step 1: Run Linting
```bash
npm run lint
```
- If errors found: Report issues and STOP
- If warnings only: Continue with warning message
- If clean: Proceed to next step

### Step 2: Type Checking
```bash
npm run typecheck
```
- If errors found: Report type errors and STOP
- If clean: Proceed to next step

### Step 3: Run Tests
```bash
npm test
```
- If tests fail: Report failures and STOP
- Track test count (should maintain 625+ passing tests)
- If all pass: Proceed to next step

### Step 4: PHI Security Scan
Scan for potential PHI logging violations:
```bash
# Check for console.log in PHI-handling directories
grep -r "console\.log\|console\.error\|console\.warn" \
  src/services/phi* \
  src/utils/phi* \
  src/services/fhir* \
  src/api/medications* 2>/dev/null || echo "Clean"
```
- Exclude: `__tests__/`, `*.test.ts`, `.skip` files
- If violations found: List files and STOP
- If clean: Proceed to next step

### Step 5: Verify GPG Signing
```bash
git config --get commit.gpgsign
git config --get user.signingkey
```
- If not enabled: Warn user (don't block, just warn)
- Show signing key ID if configured

## Success Criteria

All checks must pass for commit to proceed:
- ✅ Linting: 0 errors
- ✅ Type checking: 0 errors
- ✅ Tests: All passing (625+ tests)
- ✅ PHI security: No violations
- ⚠️ GPG signing: Enabled (warning only)

## Output Format

```
🔍 PRE-COMMIT VALIDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/5] Running linter...
✅ Linting passed (0 errors, 0 warnings)

[2/5] Type checking...
✅ Type check passed (0 errors)

[3/5] Running test suite...
✅ Tests passed (627 passing, 2 skipped)

[4/5] Scanning for PHI logging violations...
✅ No PHI logging violations found

[5/5] Verifying GPG commit signing...
✅ GPG signing enabled (Key: D1578B97AFE4D408)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ ALL CHECKS PASSED - Ready to commit
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Failure Output Format

```
🔍 PRE-COMMIT VALIDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/5] Running linter...
❌ Linting failed (3 errors)

Errors:
  src/components/Test.tsx:15:3 - Unexpected var, use let or const instead
  src/services/api.ts:42:10 - Missing semicolon
  src/utils/helper.ts:8:1 - Line exceeds 120 characters

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ VALIDATION FAILED - Fix errors before committing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run: npm run lint -- --fix
```

## When to Use This Skill

- **Before every commit** - Run this skill before committing code
- **Before creating PRs** - Ensure PR is ready for review
- **After major refactoring** - Validate no regressions introduced
- **CI/CD pipeline checks** - Use in automated pipelines

## Notes for AI Agent

- Run all steps sequentially (don't skip steps)
- Stop at first failure and report clearly
- Don't auto-fix issues - report them to user
- Track execution time for each step
- Always show final summary (passed or failed)
