# Claude Instructions for WellFit-Community-Daily-Complete

## Project Overview
This is a WellFit community application with daily features. The project uses TypeScript/React and includes user registration with hCaptcha integration. This is a healthcare EHR application that must maintain strict HIPAA and SOC2 compliance at all times.

## 🎯 Priority #1: ZERO TECH DEBT
**This is the top priority for all development work.**
- Address technical debt immediately when discovered
- Refactor code that doesn't meet quality standards
- Never leave TODOs or FIXMEs without resolution
- Maintain clean, maintainable code at all times
- Document all architectural decisions

## Core Development Principles

### 2. Respect Codebase and Schema
- **ALWAYS** follow existing patterns and conventions
- **NEVER** modify database schema without careful review
- Understand existing code before making changes
- Maintain consistency with current architecture
- Preserve naming conventions and structure

### 3. Database Expertise Required
- Be proficient in SQL best practices
- Expert-level knowledge of Supabase Postgres 17 required
- Always use parameterized queries to prevent SQL injection
- Optimize queries for performance
- Use proper indexing strategies
- Follow Supabase Row Level Security (RLS) policies

## 🔒 Security and Compliance (CRITICAL)

### Never Commit Secrets
- **NEVER** commit `.env` files to git
- **ONLY** commit `.env.example` with placeholder values
- Keep all API keys, tokens, and credentials out of version control
- Use Supabase secrets management for sensitive configuration

### SOC2 and HIPAA Compliance
- **ALL code must be SOC2 and HIPAA compliant**
- Protected Health Information (PHI) must be encrypted at rest and in transit
- Implement proper access controls and audit trails
- Follow principle of least privilege
- Ensure data integrity and availability

### Logging Requirements
- **NEVER use `console.log()` in production code**
- Use proper logging frameworks with appropriate log levels
- **When introducing PHI to the browser:**
  - **MUST** use the HIPAA-compliant audit logger
  - Log all access to PHI
  - Include user ID, timestamp, and action type
  - Never log actual PHI data in plain text

## Testing and Quality Assurance

### Before Considering Any Work Complete:
1. **Test all working components** after any adjustments or moves
2. Run `npm run lint` - Ensure code style compliance
3. Run `npm run typecheck` - Verify TypeScript types
4. Run `npm test` - Run test suite
5. Manually test the feature in the UI if applicable
6. Verify no regressions in related functionality

## Database Migration and Deployment

### Migrations
- **ALWAYS run any new migrations you create**
- Test migrations in development before applying
- Ensure migrations are reversible when possible
- Document migration purpose and impact

### Supabase Functions
- **ANY new functions created or adjusted MUST be deployed to Supabase**
- Test functions locally before deployment
- Update function documentation
- Verify proper error handling and logging
- Deploy using: `supabase functions deploy <function-name>`

## Healthcare/Clinical EHR Best Practices

### Data Handling
- Validate all patient data inputs
- Implement proper data sanitization
- Maintain data integrity through referential constraints
- Use transactions for multi-step operations
- Implement soft deletes for audit trail purposes

### Access Control
- Implement role-based access control (RBAC)
- Use Row Level Security (RLS) policies
- Log all access to patient records
- Implement session management with appropriate timeouts
- Enforce strong authentication requirements

### Audit Trail
- Log all create, read, update, delete operations on PHI
- Include: user ID, timestamp, action, resource, IP address
- Store audit logs securely and separately
- Ensure audit logs are immutable
- Retain logs per compliance requirements (typically 6+ years)

### Clinical Safety
- Validate critical data with appropriate checks
- Implement confirmation steps for high-risk operations
- Display clear error messages without exposing system details
- Ensure data consistency across related records
- Implement proper version control for clinical documents

## Development Commands
- `npm run dev` - Start development server
- `npm run build` - Build the project
- `npm run lint` - Run linting
- `npm run typecheck` - Run TypeScript type checking
- `npm test` - Run tests
- `supabase start` - Start local Supabase instance
- `supabase db push` - Push database changes
- `supabase functions deploy <name>` - Deploy edge functions

## Key Files and Directories
- `src/components/` - React components
- `src/services/` - Service layer for API calls and business logic
- `src/lib/` - Utility functions and helpers
- `supabase/migrations/` - Database migration files
- `supabase/functions/` - Edge functions
- `docs/` - Project documentation
- Registration flow includes hCaptcha widget integration

## Git Workflow
- Main branch: `main`
- Development branches: `claude/*` pattern
- **Only commit when explicitly requested by the user**
- Follow existing commit message patterns from git log
- Never force push to main/master
- Always create descriptive commit messages
- Reference issue numbers in commits when applicable

## Error Handling
- Always implement proper try-catch blocks
- Provide meaningful error messages to users
- Log errors appropriately (without exposing sensitive data)
- Handle edge cases and validation errors
- Use TypeScript strict mode for type safety

## Code Quality Standards
- Use TypeScript strict mode
- Implement proper error boundaries in React
- Follow React hooks best practices
- Use proper dependency arrays in useEffect
- Implement loading and error states
- Write self-documenting code with clear variable names
- Add JSDoc comments for complex functions
- Keep functions small and single-purpose

## Performance Considerations
- Optimize database queries (use indexes, avoid N+1)
- Implement proper caching strategies
- Use React.memo and useMemo appropriately
- Lazy load components and routes when beneficial
- Monitor bundle size
- Implement proper pagination for large datasets

## Accessibility (A11y)
- Follow WCAG 2.1 AA standards minimum
- Implement proper ARIA labels
- Ensure keyboard navigation works
- Maintain proper contrast ratios
- Test with screen readers

---

**Remember: Healthcare data is sensitive. Every decision should prioritize patient safety, data security, and regulatory compliance.**
