# Contributing to WellFit Community

Thank you for your interest in contributing to WellFit Community. This document outlines the standards and process for contributing to this codebase.

## Code of Conduct

This is a healthcare platform handling Protected Health Information (PHI). All contributors must understand and comply with HIPAA requirements. Careless code can harm patients.

## Before You Start

1. **Read [CLAUDE.md](CLAUDE.md)** - This is the engineering governance document. Every rule exists because of a real production incident or compliance requirement.
2. **Read the [Security Policy](SECURITY.md)** - Understand our security posture.
3. **Review recent commits** - `git log --oneline -10` to understand current work.

## Development Setup

```bash
# Install dependencies
npm install

# Set up environment variables (see README.md)
cp .env.example .env

# Verify everything works
npm run typecheck && npm run lint && npm test
```

## Code Standards

### Non-Negotiable Rules

These are enforced by CI and code review. PRs that violate them will be rejected.

| Rule | Details |
|------|---------|
| No `any` type | Use `unknown` + type guards or define interfaces |
| No `console.log` | Use `auditLogger` for all logging |
| No CORS wildcards | Use explicit `ALLOWED_ORIGINS` |
| No PHI in frontend | Patient IDs only, data stays server-side |
| Vite environment only | `import.meta.env.VITE_*`, never `process.env` |
| React 19 patterns | `ref` as prop (no `forwardRef`), `use()` hook |
| All tests must pass | No `.skip()`, no `.only()`, no deleting tests |

### Error Handling

```typescript
catch (err: unknown) {
  const error = err instanceof Error ? err : new Error(String(err));
  await auditLogger.error('OPERATION_FAILED', error, { context });
  return failure('OPERATION_FAILED', 'User-friendly message');
}
```

### Service Layer

All services return `ServiceResult<T>` - never throw exceptions.

```typescript
import { ServiceResult, success, failure } from '@/services/_base';
```

## Pull Request Process

### 1. Branch Naming

```
claude/{feature-description}-{unique-id}
feat/{feature-description}
fix/{bug-description}
docs/{what-changed}
```

### 2. Before Submitting

Run the full verification checkpoint:

```bash
npm run typecheck && npm run lint && npm test
```

Report the results in your PR description:

```
typecheck: 0 errors
lint: 0 errors, 0 warnings
tests: 7,490 passed, 0 failed
```

### 3. PR Description

Every PR must include:
- **Summary**: What changed and why (1-3 bullet points)
- **Test plan**: How to verify the changes work
- **Verification checkpoint**: Typecheck/lint/test pass counts

### 4. Review Criteria

Reviewers will check:
- [ ] No new `any` types introduced
- [ ] No `console.log` statements
- [ ] Error handling follows the `unknown` + `auditLogger` pattern
- [ ] New components have corresponding test files
- [ ] Routes are wired in `src/App.tsx` (if applicable)
- [ ] No PHI exposed to the browser
- [ ] Accessibility: 44px touch targets, 16px+ fonts, WCAG AA contrast

## Testing Requirements

- **All existing tests must pass** before any PR is merged
- **New components must include tests** in `__tests__/` directories
- **Minimum test coverage**: Rendering, loading states, data display, error handling
- Test location: `src/components/{feature}/__tests__/{Component}.test.tsx`

## Commit Messages

Follow conventional commit format:

```
feat: add patient risk dashboard
fix: resolve null pointer in care plan service
docs: update deployment guide for v1.0
refactor: extract shared validation logic
test: add coverage for caregiver PIN flow
```

## Architecture Decisions

If your change involves:
- A new database table or migration
- A new service pattern or abstraction
- Changing an existing API contract
- Adding a new dependency

**Stop and discuss first.** Open an issue or reach out before writing code.

## Questions?

Contact: maria@wellfitcommunity.com
