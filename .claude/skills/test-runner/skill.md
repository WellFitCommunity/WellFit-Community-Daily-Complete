# Test Runner Skill

## Purpose
Intelligently run tests with smart detection of changed files to provide faster feedback during development.

## What This Skill Does

Provides multiple test execution modes:
1. **Smart Mode** - Run only tests affected by recent changes
2. **Full Mode** - Run complete test suite (625+ tests)
3. **Coverage Mode** - Run tests with coverage reporting
4. **Watch Mode** - Run tests in watch mode for active development
5. **Failed Only** - Re-run only previously failed tests

## Execution Modes

### Mode 1: Smart Test Execution (Default)

Detect changed files and run related tests only:

```bash
# Get changed files since last commit
git diff --name-only HEAD

# For each changed file, find related test files
# Example: src/services/medications.ts → medications.test.ts
```

**Smart Detection Rules:**
- `src/services/X.ts` → `src/services/__tests__/X.test.ts`
- `src/components/X.tsx` → `src/components/__tests__/X.test.tsx`
- `src/api/X.ts` → `src/api/__tests__/X.test.ts`
- `src/utils/X.ts` → `src/utils/__tests__/X.test.ts`

**Execution:**
```bash
npm test -- path/to/test1.test.ts path/to/test2.test.ts
```

### Mode 2: Full Test Suite

Run all tests (use for pre-commit or CI/CD):

```bash
npm test
```

**Expected baseline:** 625+ tests passing

### Mode 3: Coverage Mode

Run tests with coverage report:

```bash
npm test -- --coverage --watchAll=false
```

**Coverage targets:**
- Statements: >80%
- Branches: >75%
- Functions: >80%
- Lines: >80%

### Mode 4: Watch Mode

Run tests in watch mode for active development:

```bash
npm test -- --watch
```

Useful when actively developing a feature.

### Mode 5: Failed Only

Re-run only failed tests from previous run:

```bash
npm test -- --onlyFailures
```

## Smart Mode Algorithm

```
1. Get list of changed files (git diff)
2. For each changed file:
   a. Identify test file pattern
   b. Check if test file exists
   c. Add to test queue
3. Also include:
   - Integration tests if multiple services changed
   - E2E tests if UI components changed
4. Run collected tests
5. Report results with delta from baseline
```

## Output Format

### Smart Mode Output
```
🧪 SMART TEST RUNNER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Detecting changed files...
✓ Found 3 changed files

Changed Files:
  src/services/medications.ts
  src/components/PatientProfile.tsx
  src/utils/phiEncryption.ts

Related Tests:
  src/services/__tests__/medications.test.ts (47 tests)
  src/components/__tests__/PatientProfile.test.tsx (23 tests)
  src/utils/__tests__/phiEncryption.test.ts (15 tests)

Running 85 tests across 3 test suites...

Test Suites: 3 passed, 3 total
Tests:       85 passed, 85 total
Snapshots:   0 total
Time:        4.231 s

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ ALL TESTS PASSED (85/85)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Time saved: ~45s (vs. full suite)
```

### Full Mode Output
```
🧪 FULL TEST SUITE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Running complete test suite...

Test Suites: 124 passed, 124 total
Tests:       627 passed, 2 skipped, 629 total
Snapshots:   0 total
Time:        52.847 s

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ ALL TESTS PASSED (627/629)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Test Count Delta: +2 (baseline: 625)
Skipped: 2 tests (.skip)
```

### Coverage Mode Output
```
🧪 TEST COVERAGE REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Running tests with coverage...

Test Suites: 124 passed, 124 total
Tests:       627 passed, 627 total

Coverage Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
File        % Stmts  % Branch  % Funcs  % Lines  Uncovered
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
All files     87.23    82.15    89.47    87.19
services/     91.45    85.32    93.21    91.38
utils/        89.12    80.45    88.76    89.04
components/   84.67    79.23    86.34    84.59
api/          88.91    83.67    90.12    88.87
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Coverage targets met (>80% all categories)

Detailed report: coverage/lcov-report/index.html
```

## Failure Output Format

```
🧪 SMART TEST RUNNER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Detecting changed files...
✓ Found 2 changed files

Running 43 tests across 2 test suites...

Test Suites: 1 failed, 1 passed, 2 total
Tests:       2 failed, 41 passed, 43 total

FAIL src/services/__tests__/medications.test.ts
  ● MedicationService › should create medication

    expect(received).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Aspirin",
        dosage: "100mg"
      })
    )

    Expected: objectContaining({"dosage": "100mg", "name": "Aspirin"})
    Received: {"dosage": "81mg", "name": "Aspirin", "frequency": "daily"}

      145 |   await service.createMedication(mockData);
      146 |
    > 147 |   expect(supabase.from).toHaveBeenCalledWith(
          |                        ^
      148 |     expect.objectContaining({
      149 |       name: "Aspirin",
      150 |       dosage: "100mg"

    at Object.<anonymous> (src/services/__tests__/medications.test.ts:147:24)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ TESTS FAILED (2/43)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Failed Tests:
  ✗ MedicationService › should create medication
  ✗ MedicationService › should validate dosage format

Fix these tests before committing.
```

## When to Use This Skill

**Smart Mode (Default):**
- During active development
- After making small changes
- Quick feedback loop

**Full Mode:**
- Before commits
- Before creating PRs
- Before deployments
- In CI/CD pipeline

**Coverage Mode:**
- Before releases
- After adding new features
- During code reviews

**Watch Mode:**
- While writing tests (TDD)
- Active feature development

**Failed Only:**
- After fixing failed tests
- Quick validation of fixes

## Performance Optimization

**Baseline Performance:**
- Full suite: ~50-60 seconds (625+ tests)
- Smart mode: ~4-10 seconds (20-100 tests)
- Single file: ~1-3 seconds

**Speed Improvement:**
- Smart mode: 85-92% faster than full suite
- Failed only: 95% faster (when few failures)

## Integration with Pre-Commit

This skill integrates with the pre-commit skill:
- Pre-commit runs **full test suite**
- Development uses **smart mode**
- CI/CD uses **full mode** + **coverage**

## Notes for AI Agent

- Default to smart mode unless user requests full mode
- Show test count delta vs. baseline (625 tests)
- Report skipped tests (*.skip files)
- If smart mode finds 0 tests, suggest running full suite
- Track test execution time
- Highlight any new test failures
- Suggest running coverage mode if coverage drops
- Don't automatically fix test failures - report them
