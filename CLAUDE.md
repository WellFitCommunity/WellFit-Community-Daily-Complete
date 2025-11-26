# Claude Instructions for WellFit-Community-Daily-Complete

## Project Overview
This is a WellFit community application with daily features. The project uses TypeScript/React and includes user registration with hCaptcha integration.

## Critical Development Principles

### Zero Technical Debt
- Do NOT introduce technical debt with quick fixes or workarounds
- Always implement proper, maintainable solutions
- Refactor when necessary to maintain code quality
- Document any temporary solutions with clear TODO comments and tracking

### HIPAA Compliance & PHI Protection
- **NEVER introduce PHI (Protected Health Information) to the browser**
- All PHI must remain server-side only
- Use patient IDs/tokens for client-side operations, never names, SSN, DOB, etc.
- Use audit logger for all logging - **NEVER use console.log**
- All security-sensitive operations must be logged via the audit system

### Database Standards
- This project uses **PostgreSQL 17**
- Always be proficient with Postgres 17 features and best practices
- Respect the existing database schema - review before making changes
- Use proper migrations for any schema changes
- Leverage Postgres 17 features (JSONB, CTEs, window functions, etc.)

### Code Quality Standards
- **Be a surgeon, never a butcher** - make precise, targeted changes
- Respect the existing codebase architecture and patterns
- Do not refactor unrelated code when making targeted fixes
- Only modify what is necessary to complete the task
- Preserve existing functionality unless explicitly asked to change it

### UI/UX Requirements
- **Always ensure UI/UX remains in working order** after any changes
- Test visual components after modifications
- Maintain responsive design principles
- Preserve accessibility features
- Do not break existing user workflows

### Context & Code Review Protocol
Before starting ANY work, ALWAYS:
1. Review the last 3 commits using `git log --oneline -3` and `git show` for context
2. Understand recent changes and their purpose
3. Check for related branches that might provide context
4. Review the affected schema/database tables
5. Understand the full scope of the change before implementing

## Development Commands
- `npm run dev` - Start development server
- `npm run build` - Build the project
- `npm run lint` - Run linting
- `npm run typecheck` - Run TypeScript type checking
- `npm test` - Run tests

## Key Files and Directories
- `src/components/` - React components
- `src/services/` - Service layer for API calls and business logic
- `supabase/` - Database schema, migrations, and functions
- Registration flow includes hCaptcha widget integration

## Testing and Quality Assurance
Always run the following before considering work complete:
1. `npm run lint` - Ensure code style compliance (must pass with 0 errors)
2. `npm run typecheck` - Verify TypeScript types
3. `npm test` - Run test suite if available
4. Visual inspection - Ensure UI/UX functions correctly
5. Schema review - Verify no unintended database changes

## Git Workflow
- Main branch: `main`
- Only commit when explicitly requested by the user
- Follow existing commit message patterns from git log
- Always review last 3 commits before starting work

## Audit Logging Requirements
- Use the audit logger service for all application logging
- Never use `console.log`, `console.error`, etc. in production code
- Audit logs must include:
  - User ID (when applicable)
  - Action taken
  - Timestamp
  - Relevant context (without PHI)
  - Security-sensitive operations

## Security Reminders
- All authentication must use secure tokens
- Rate limiting on sensitive endpoints
- Input validation on all user inputs
- SQL injection prevention via parameterized queries
- XSS prevention via proper output encoding
- CSRF protection on state-changing operations

## Architecture Patterns

### Module Access (Feature Flags)
- Use `useModuleAccess(moduleName)` hook - the ONE way to check module access
- Two-tier system: entitlements (paid for) + enabled (turned on)
- See `src/hooks/useModuleAccess.ts` for implementation
- See `src/types/tenantModules.ts` for module definitions

### Service Layer Standards
- All services should use `ServiceResult<T>` return type from `src/services/_base/`
- Never throw exceptions - return errors in the result
- Always log errors via `auditLogger`
- Use `success()` and `failure()` helpers for consistent responses

Example:
```typescript
import { ServiceResult, success, failure } from './_base';

async function getData(id: string): Promise<ServiceResult<Data>> {
  try {
    const { data, error } = await supabase.from('table').select().eq('id', id).single();
    if (error) return failure('DATABASE_ERROR', error.message, error);
    return success(data);
  } catch (err) {
    return failure('UNKNOWN_ERROR', 'Failed to get data', err);
  }
}
```

## Current Status
- Latest commit: Platform unification Phase 1-2
- Focus: Consolidating architecture, removing technical debt
- Database: PostgreSQL 17 via Supabase
- Recent work: Unified feature flags, service layer standards
