# ZERO TECH DEBT CHECKLIST ⚠️

**Principle:** Someone has to pay the debt, and it won't be me.

This document contains **non-negotiable requirements** for the Emotional Resilience Hub implementation. Every item must be checked before considering any work "complete."

---

## Database Schema Requirements ✅

### Foreign Keys (No Orphaned Data)

- [ ] **Every `practitioner_id` column** has a foreign key constraint to `fhir_practitioners(id)` with `ON DELETE CASCADE`
- [ ] **Every `user_id` column** has a foreign key constraint to `auth.users(id)` with `ON DELETE CASCADE`
- [ ] **Every relationship** uses foreign keys (no "soft" references via untyped UUID columns)
- [ ] **No circular dependencies** in foreign keys
- [ ] **Cascade rules** are intentional:
  - Use `ON DELETE CASCADE` for child records that should be deleted with parent (e.g., burnout assessments when practitioner deleted)
  - Use `ON DELETE SET NULL` for optional references (e.g., anonymous support reflections)
  - Use `ON DELETE RESTRICT` when deletion should be prevented if dependencies exist

**Why:** Without foreign keys, orphaned records accumulate, data integrity fails, and joins break silently.

**Test:**
```sql
-- This should FAIL if foreign keys are missing:
INSERT INTO provider_burnout_assessments (practitioner_id, user_id, assessment_date, emotional_exhaustion_score)
VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', NOW(), 50);
-- Expected error: violates foreign key constraint
```

---

### Indexes (No Slow Queries)

- [ ] **Primary key** on every table (UUID with `gen_random_uuid()`)
- [ ] **Foreign key columns** have indexes:
  - `idx_provider_burnout_practitioner` on `provider_burnout_assessments(practitioner_id)`
  - `idx_provider_checkin_practitioner` on `provider_daily_checkins(practitioner_id)`
  - `idx_training_completions_practitioner` on `provider_training_completions(practitioner_id)`
  - All other FK columns indexed
- [ ] **Date/timestamp columns** used in queries have indexes:
  - `idx_provider_burnout_date` on `provider_burnout_assessments(assessment_date DESC)`
  - `idx_provider_checkin_date` on `provider_daily_checkins(checkin_date DESC)`
- [ ] **Enum/status columns** used in WHERE clauses have indexes:
  - `idx_provider_burnout_risk` on `provider_burnout_assessments(risk_level)`
  - `idx_resilience_resources_active` on `resilience_resources(is_active)`
- [ ] **Uniqueness constraints** exist where needed:
  - `UNIQUE(user_id, checkin_date)` on `provider_daily_checkins` (one check-in per day)
  - `UNIQUE(user_id, module_id)` on `provider_training_completions` (one completion per module)
  - `UNIQUE(circle_id, user_id)` on `provider_support_circle_members` (no duplicate memberships)

**Why:** Missing indexes cause queries to scan entire tables. This is fine with 100 rows but catastrophic with 100,000 rows.

**Test:**
```sql
-- Check query performance:
EXPLAIN ANALYZE
SELECT * FROM provider_daily_checkins
WHERE practitioner_id = 'some-uuid'
ORDER BY checkin_date DESC
LIMIT 10;

-- Should see "Index Scan using idx_provider_checkin_practitioner"
-- NOT "Seq Scan on provider_daily_checkins"
```

---

### Data Types (Precision Matters)

- [ ] **Numeric scores** use `DECIMAL(5,2)` NOT `FLOAT` or `REAL`:
  - `emotional_exhaustion_score DECIMAL(5,2)` (0.00 to 100.00)
  - `composite_burnout_score DECIMAL(5,2)`
  - `patient_acuity_score DECIMAL(5,2)`
  - `overtime_hours DECIMAL(4,2)` (0.00 to 99.99 hours)
- [ ] **Money/currency** uses `NUMERIC` NOT `FLOAT` (if billing integration added later)
- [ ] **Dates** use `DATE` for calendar dates (e.g., `checkin_date DATE`)
- [ ] **Timestamps** use `TIMESTAMPTZ` (timezone-aware) NOT `TIMESTAMP`:
  - `created_at TIMESTAMPTZ`
  - `updated_at TIMESTAMPTZ`
  - `assessment_date TIMESTAMPTZ`
- [ ] **Booleans** use `BOOLEAN` NOT `INTEGER` (0/1)
- [ ] **Enums/categories** use `TEXT` with `CHECK` constraints:
  ```sql
  product_line TEXT CHECK (product_line IN ('clarity', 'shield', 'both'))
  ```
- [ ] **Arrays** use native PostgreSQL arrays `TEXT[]` NOT JSON strings
- [ ] **JSONB** for structured but flexible data (not TEXT storing JSON strings)

**Why:** FLOAT has rounding errors (0.1 + 0.2 ≠ 0.3). DECIMAL is exact. Timestamps without timezone cause "works on my machine" bugs.

**Test:**
```sql
-- This should work correctly:
SELECT 0.1::DECIMAL(5,2) + 0.2::DECIMAL(5,2);  -- Returns 0.30

-- FLOAT would return 0.30000000000000004 (rounding error)
```

---

### Constraints & Validation (Prevent Bad Data)

- [ ] **NOT NULL** on required fields:
  - All primary keys
  - All foreign keys
  - Core fields (e.g., `stress_level NOT NULL`)
- [ ] **CHECK constraints** on numeric ranges:
  ```sql
  stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 10)
  completion_percentage INTEGER CHECK (completion_percentage >= 0 AND completion_percentage <= 100)
  ```
- [ ] **CHECK constraints** on enums:
  ```sql
  product_line TEXT CHECK (product_line IN ('clarity', 'shield', 'both'))
  assessment_type TEXT CHECK (assessment_type IN ('MBI-HSS', 'MBI-ES', 'custom'))
  ```
- [ ] **DEFAULT values** set appropriately:
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - `is_active BOOLEAN DEFAULT TRUE`
  - `product_line TEXT DEFAULT 'clarity'`
- [ ] **GENERATED columns** for computed values:
  ```sql
  composite_burnout_score DECIMAL(5,2) GENERATED ALWAYS AS (...) STORED
  risk_level TEXT GENERATED ALWAYS AS (...) STORED
  ```

**Why:** Database constraints prevent invalid data at the source. Relying on application validation alone is tech debt (apps can be bypassed, databases can't).

**Test:**
```sql
-- This should FAIL:
INSERT INTO provider_daily_checkins (user_id, checkin_date, stress_level)
VALUES ('valid-uuid', CURRENT_DATE, 11);  -- stress_level > 10
-- Expected error: violates check constraint
```

---

### Row-Level Security (RLS) Policies (HIPAA Compliance)

- [ ] **RLS enabled** on every table with PHI (protected health information):
  ```sql
  ALTER TABLE provider_burnout_assessments ENABLE ROW LEVEL SECURITY;
  ```
- [ ] **Provider SELECT policy** (providers can view own data):
  ```sql
  CREATE POLICY "Providers can view own burnout assessments"
    ON provider_burnout_assessments FOR SELECT
    USING (auth.uid() = user_id);
  ```
- [ ] **Provider INSERT policy** (providers can create own data):
  ```sql
  CREATE POLICY "Providers can create own burnout assessments"
    ON provider_burnout_assessments FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  ```
- [ ] **Provider UPDATE policy** (providers can update own data):
  ```sql
  CREATE POLICY "Providers can update own daily checkins"
    ON provider_daily_checkins FOR UPDATE
    USING (auth.uid() = user_id);
  ```
- [ ] **Admin SELECT policy** (admins/care managers can view all for intervention):
  ```sql
  CREATE POLICY "Admins can view all burnout assessments"
    ON provider_burnout_assessments FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin', 'care_manager')
      )
    );
  ```
- [ ] **NO ADMIN WRITE POLICIES** (admins can read for dashboards, but can't manipulate individual provider data)
- [ ] **Public tables** (content that all users can view):
  ```sql
  CREATE POLICY "Authenticated users can view active modules"
    ON resilience_training_modules FOR SELECT
    USING (is_active = TRUE AND auth.role() = 'authenticated');
  ```
- [ ] **Test policies** with different user roles

**Why:** RLS is HIPAA's "minimum necessary" principle enforced at the database level. Without RLS, any SQL injection or logic bug exposes all data.

**Test:**
```sql
-- Log in as Provider A (user_id = 'aaaa-aaaa')
SET ROLE authenticated;
SET SESSION "request.jwt.claims.sub" = 'aaaa-aaaa';

SELECT * FROM provider_burnout_assessments;
-- Should only return Provider A's assessments, not Provider B's
```

---

## TypeScript Type Safety Requirements ✅

### Type Definitions

- [ ] **All database tables** have corresponding TypeScript interfaces in `src/types/nurseos.ts`
- [ ] **Field names match database** (snake_case for consistency with SQL)
- [ ] **Optional fields** use `?` if column is nullable:
  ```typescript
  provider_notes?: string | null;  // nullable in DB
  stress_level: number;  // NOT NULL in DB
  ```
- [ ] **Enums** defined as union types:
  ```typescript
  export type BurnoutRiskLevel = 'low' | 'moderate' | 'high' | 'critical' | 'unknown';
  export type ProductLine = 'clarity' | 'shield' | 'both';
  ```
- [ ] **Date/timestamp fields** use `string` (ISO 8601) NOT `Date` objects:
  ```typescript
  created_at: string;  // "2025-10-18T14:30:00Z"
  checkin_date: string;  // "2025-10-18"
  ```
- [ ] **UUIDs** use `string` type with JSDoc comments:
  ```typescript
  /** UUID primary key */
  id: string;
  ```
- [ ] **JSONB fields** have typed interfaces:
  ```typescript
  questionnaire_responses?: MBIQuestionnaireResponse[];  // NOT `any`
  ```

**Why:** `any` is tech debt. Runtime type errors are production bugs.

**Test:**
```typescript
// This should show type error:
const checkin: ProviderDailyCheckin = {
  id: 'uuid',
  stress_level: '7',  // ERROR: Type 'string' is not assignable to type 'number'
  // ...
};
```

---

### Service Layer Type Safety

- [ ] **All service functions** have explicit return types:
  ```typescript
  // ✅ GOOD
  export async function submitDailyCheckin(
    data: Partial<ProviderDailyCheckin>
  ): Promise<ProviderDailyCheckin> {
    // ...
  }

  // ❌ BAD (no return type)
  export async function submitDailyCheckin(data) {
    // ...
  }
  ```
- [ ] **All parameters** have types (no implicit `any`):
  ```typescript
  // ✅ GOOD
  function calculateBurnoutRisk(score: number): BurnoutRiskLevel { ... }

  // ❌ BAD
  function calculateBurnoutRisk(score) { ... }
  ```
- [ ] **Error handling** typed:
  ```typescript
  try {
    // ...
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(error.message);
    }
  }
  ```
- [ ] **No `@ts-ignore` or `@ts-expect-error`** (fix type errors, don't suppress them)
- [ ] **Strict mode enabled** in `tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "strict": true,
      "noImplicitAny": true,
      "strictNullChecks": true,
      "strictFunctionTypes": true
    }
  }
  ```

**Why:** Type errors caught at compile time don't become runtime bugs.

**Test:**
```bash
npm run typecheck  # Should pass with 0 errors
```

---

## React Component Quality Requirements ✅

### Component Structure

- [ ] **Functional components** with TypeScript (no class components):
  ```typescript
  export function DailyCheckinForm(): JSX.Element {
    // ...
  }
  ```
- [ ] **Props interface** defined for every component:
  ```typescript
  interface DailyCheckinFormProps {
    onSubmit: (data: DailyCheckinFormData) => Promise<void>;
    onCancel: () => void;
    defaultValues?: Partial<DailyCheckinFormData>;
  }

  export function DailyCheckinForm({ onSubmit, onCancel, defaultValues }: DailyCheckinFormProps) {
    // ...
  }
  ```
- [ ] **No prop drilling** (use Context or state management if passing props > 2 levels)
- [ ] **Extract reusable components** (e.g., `BurnoutRiskBadge`, `StressLevelSlider`)

---

### State Management

- [ ] **useState** for local component state
- [ ] **useEffect** has dependency array (no missing deps warnings):
  ```typescript
  useEffect(() => {
    fetchData(userId);
  }, [userId]);  // ✅ Dependency listed

  // ❌ BAD: useEffect(() => { fetchData(userId); }, []);  // Missing dep
  ```
- [ ] **Custom hooks** for reusable logic:
  ```typescript
  function useResilienceHubStats() {
    const [stats, setStats] = useState<ResilienceHubDashboardStats | null>(null);
    // ...
    return { stats, loading, error };
  }
  ```
- [ ] **No prop mutation** (state is immutable):
  ```typescript
  // ✅ GOOD
  setFormData({ ...formData, stress_level: 7 });

  // ❌ BAD
  formData.stress_level = 7;
  ```

---

### Error Handling & Loading States

- [ ] **Loading states** for async operations:
  ```typescript
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await submitCheckin(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };
  ```
- [ ] **Error boundaries** for component crashes:
  ```typescript
  <ErrorBoundary fallback={<ErrorFallback />}>
    <ResilienceHubDashboard />
  </ErrorBoundary>
  ```
- [ ] **User-friendly error messages** (not raw error codes):
  ```tsx
  {error && (
    <Alert variant="error">
      Failed to save check-in. Please try again or contact support.
    </Alert>
  )}
  ```

---

### Accessibility (A11y)

- [ ] **ARIA labels** on interactive elements:
  ```tsx
  <button aria-label="Submit daily check-in" onClick={handleSubmit}>
    Submit
  </button>
  ```
- [ ] **Keyboard navigation** works (Tab, Enter, Space, Escape):
  - Forms can be submitted with Enter
  - Modals close with Escape
  - All interactive elements reachable by Tab
- [ ] **Focus management** in modals:
  ```typescript
  useEffect(() => {
    if (isOpen) {
      modalRef.current?.focus();
    }
  }, [isOpen]);
  ```
- [ ] **Color contrast** meets WCAG AA (4.5:1 for text):
  - Use tools like [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [ ] **Screen reader tested** (NVDA on Windows, VoiceOver on Mac)

**Why:** 15% of nurses have disabilities. Inaccessible UI = lost revenue + lawsuit risk.

**Test:**
```bash
# Install axe DevTools browser extension
# Run accessibility audit on every page
# Fix all violations before shipping
```

---

## Testing Requirements ✅

### Unit Tests (Service Layer)

- [ ] **Every service function** has unit tests:
  ```typescript
  // src/services/__tests__/resilienceHubService.test.ts
  describe('ResilienceHubService', () => {
    describe('submitDailyCheckin', () => {
      it('creates new check-in successfully', async () => {
        const result = await ResilienceHubService.submitDailyCheckin({...});
        expect(result.id).toBeDefined();
      });

      it('throws error for invalid stress level', async () => {
        await expect(
          ResilienceHubService.submitDailyCheckin({ stress_level: 11 })
        ).rejects.toThrow();
      });
    });
  });
  ```
- [ ] **Helper functions tested**:
  ```typescript
  describe('calculateCompositeBurnoutScore', () => {
    it('returns 70 for critical burnout (85, 75, 20)', () => {
      expect(calculateCompositeBurnoutScore(85, 75, 20)).toBeCloseTo(70, 1);
    });
  });
  ```
- [ ] **Edge cases tested**:
  - Null/undefined inputs
  - Empty arrays
  - Boundary values (0, 100, -1, 101)
- [ ] **Code coverage** > 80%:
  ```bash
  npm test -- --coverage
  # All services should show >80% coverage
  ```

---

### Integration Tests (Component + Service)

- [ ] **Critical user flows** have integration tests:
  ```typescript
  // src/components/nurseos/__tests__/DailyCheckin.integration.test.tsx
  it('allows user to complete daily check-in end-to-end', async () => {
    render(<DailyCheckinForm />);

    fireEvent.change(screen.getByLabelText('Stress Level'), { target: { value: 7 } });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(screen.getByText('Check-in saved!')).toBeInTheDocument();
    });

    // Verify data persisted to database
    const checkin = await ResilienceHubService.getMyCheckins(new Date(), new Date());
    expect(checkin[0].stress_level).toBe(7);
  });
  ```
- [ ] **RLS policies tested**:
  ```typescript
  it('prevents Provider A from seeing Provider B data', async () => {
    // Log in as Provider A
    const { data } = await supabase.from('provider_burnout_assessments').select('*');
    expect(data).toHaveLength(1);  // Only Provider A's data
  });
  ```

---

### Database Tests

- [ ] **Foreign key constraints tested**:
  ```sql
  -- Test: Deleting practitioner cascades to burnout assessments
  BEGIN;
    DELETE FROM fhir_practitioners WHERE id = 'test-uuid';
    SELECT * FROM provider_burnout_assessments WHERE practitioner_id = 'test-uuid';
    -- Should return 0 rows (cascaded delete)
  ROLLBACK;
  ```
- [ ] **CHECK constraints tested**:
  ```sql
  -- Test: Invalid stress level rejected
  INSERT INTO provider_daily_checkins (stress_level) VALUES (11);
  -- Should fail with CHECK constraint violation
  ```
- [ ] **RLS policies tested** (see above)

---

## Performance Requirements ✅

### Query Performance

- [ ] **All frequently used queries** have EXPLAIN ANALYZE run:
  ```sql
  EXPLAIN ANALYZE
  SELECT * FROM provider_daily_checkins
  WHERE practitioner_id = 'uuid'
  ORDER BY checkin_date DESC
  LIMIT 10;
  ```
- [ ] **Index Scan** used (not Seq Scan) for queries with WHERE clauses
- [ ] **Query time < 100ms** for dashboard queries (p95)
- [ ] **Materialized view refresh < 5 seconds** for 1,000+ providers:
  ```sql
  \timing
  SELECT refresh_provider_workload_metrics();
  ```

---

### Frontend Performance

- [ ] **Lazy loading** for heavy components:
  ```typescript
  const BurnoutAssessmentForm = React.lazy(() => import('./BurnoutAssessmentForm'));
  ```
- [ ] **Memoization** for expensive calculations:
  ```typescript
  const chartData = useMemo(() => {
    return processCheckins(checkins);
  }, [checkins]);
  ```
- [ ] **Pagination** for long lists (reflections, resources):
  ```typescript
  const PAGE_SIZE = 20;
  const [page, setPage] = useState(1);
  // Fetch only PAGE_SIZE items per page
  ```
- [ ] **Image optimization** (compress thumbnails, lazy load images)
- [ ] **Bundle size < 500KB** (uncompressed) for Resilience Hub module:
  ```bash
  npm run build
  npx vite-bundle-visualizer
  # Check dist/assets/*.js size
  ```

---

### Caching

- [ ] **React Query** (or SWR) for data fetching with cache:
  ```typescript
  const { data, error, isLoading } = useQuery(
    ['dailyCheckins', userId],
    () => ResilienceHubService.getMyCheckins(startDate, endDate),
    { staleTime: 5 * 60 * 1000 }  // Cache for 5 minutes
  );
  ```
- [ ] **Materialized views** refreshed on schedule (nightly) not on every query

---

## Security Requirements ✅

### Authentication & Authorization

- [ ] **All API endpoints** check authentication:
  ```typescript
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  ```
- [ ] **Role-based access** enforced:
  ```typescript
  <RequireAdminAuth allowedRoles={['nurse', 'admin']}>
    <ResilienceHubDashboard />
  </RequireAdminAuth>
  ```
- [ ] **RLS policies** enforce data access (see above)

---

### Input Validation

- [ ] **Client-side validation** (Zod, Yup, or similar):
  ```typescript
  import { z } from 'zod';

  const dailyCheckinSchema = z.object({
    stress_level: z.number().min(1).max(10),
    energy_level: z.number().min(1).max(10),
    // ...
  });

  // In form submit:
  dailyCheckinSchema.parse(formData);  // Throws if invalid
  ```
- [ ] **Server-side validation** (database CHECK constraints, RPC function validation)
- [ ] **Sanitize user input** (prevent XSS):
  ```typescript
  // Use React's built-in XSS protection (JSX auto-escapes)
  <p>{userProvidedText}</p>  // Safe
  <div dangerouslySetInnerHTML={{__html: userProvidedText}} />  // NEVER DO THIS
  ```

---

### SQL Injection Prevention

- [ ] **Parameterized queries ALWAYS**:
  ```typescript
  // ✅ GOOD (Supabase handles parameterization)
  const { data } = await supabase
    .from('provider_daily_checkins')
    .select('*')
    .eq('user_id', userId);

  // ❌ BAD (string concatenation = SQL injection)
  const query = `SELECT * FROM provider_daily_checkins WHERE user_id = '${userId}'`;
  ```
- [ ] **Never use `sql` template literals** without proper escaping
- [ ] **Database user permissions** limited (app user can't DROP tables)

---

## Documentation Requirements ✅

### Code Documentation

- [ ] **JSDoc comments** on all exported functions:
  ```typescript
  /**
   * Submits a daily emotional check-in for the current provider
   * @param data - Partial check-in data (stress, energy, mood, workload)
   * @returns Promise resolving to the created check-in record
   * @throws {Error} If user is not authenticated or data is invalid
   */
  export async function submitDailyCheckin(
    data: Partial<ProviderDailyCheckin>
  ): Promise<ProviderDailyCheckin> {
    // ...
  }
  ```
- [ ] **README** in every major directory:
  - `src/components/nurseos/README.md`
  - `src/services/README.md`
- [ ] **Inline comments** for complex logic:
  ```typescript
  // Calculate composite burnout score using MBI weighting:
  // Emotional Exhaustion (40%), Depersonalization (30%), Personal Accomplishment inverted (30%)
  const composite = ee * 0.4 + dp * 0.3 + (100 - pa) * 0.3;
  ```

---

### User Documentation

- [ ] **User guide** (`docs/nurseos/user-guide.md`) - How nurses use Resilience Hub
- [ ] **Admin guide** (`docs/nurseos/admin-guide.md`) - How to enable, configure, monitor
- [ ] **FAQ** - Common questions answered
- [ ] **Screenshots/videos** - Visual walkthrough of key features

---

### Developer Documentation

- [ ] **ADR** (`docs/nurseos/ADR-001-resilience-hub-architecture.md`) - Architectural decisions
- [ ] **Implementation roadmap** (`docs/nurseos/IMPLEMENTATION_ROADMAP.md`) - Week-by-week plan
- [ ] **TypeScript types spec** (`docs/nurseos/typescript-types-spec.md`) - All type definitions
- [ ] **Developer handoff** (`docs/nurseos/developer-handoff.md`) - Onboarding for new engineers
- [ ] **Database ERD** - Visual diagram of all tables and relationships

---

## Git & Deployment Requirements ✅

### Version Control

- [ ] **Meaningful commit messages**:
  ```
  ✅ GOOD:
  feat(nurseos): add daily check-in form with Clarity-specific fields
  fix(resilience): prevent duplicate check-ins for same day
  docs(nurseos): add user guide for burnout assessments

  ❌ BAD:
  update stuff
  WIP
  fix bug
  ```
- [ ] **Small, focused commits** (one feature/fix per commit)
- [ ] **No committed secrets** (.env files in .gitignore)
- [ ] **No commented-out code blocks** (delete old code, use git history to retrieve)

---

### Database Migrations

- [ ] **Sequential migration files** with timestamps:
  - `20251018000000_resilience_hub.sql`
  - `20251019000000_add_shield_fields.sql` (if needed later)
- [ ] **Idempotent migrations** (can run multiple times without breaking):
  ```sql
  CREATE TABLE IF NOT EXISTS provider_burnout_assessments (...);
  INSERT INTO ... ON CONFLICT (feature_key) DO NOTHING;
  ```
- [ ] **Rollback scripts** for destructive changes:
  ```sql
  -- up.sql
  ALTER TABLE provider_daily_checkins ADD COLUMN compassion_fatigue_level INTEGER;

  -- down.sql (rollback)
  ALTER TABLE provider_daily_checkins DROP COLUMN compassion_fatigue_level;
  ```
- [ ] **Test migrations locally** before deploying:
  ```bash
  supabase db reset  # Drops DB and re-runs all migrations
  # Verify no errors
  ```

---

### Deployment Checklist

- [ ] **Feature flag disabled** by default (gradual rollout):
  ```sql
  UPDATE nurseos_feature_flags
  SET is_enabled_globally = FALSE
  WHERE feature_key = 'resilience_hub';
  ```
- [ ] **Database migration runs** before deploying new code
- [ ] **Zero-downtime deployment**:
  - Add new columns as nullable first
  - Deploy code that handles both old and new schemas
  - Then make columns NOT NULL in second migration
- [ ] **Rollback plan documented** (how to undo deployment if it fails)
- [ ] **Monitoring in place** (error tracking, performance metrics)

---

## Final Pre-Launch Checklist ✅

### Code Quality

- [ ] **All unit tests pass** (`npm test`)
- [ ] **All integration tests pass**
- [ ] **Type checking passes** (`npm run typecheck`)
- [ ] **Linting passes** (`npm run lint`)
- [ ] **Code coverage > 80%**
- [ ] **No console.log or debugger statements** in production code
- [ ] **No TODO comments** without GitHub issues linked

---

### Security

- [ ] **RLS policies tested** (providers can't see others' data)
- [ ] **SQL injection prevention verified** (parameterized queries only)
- [ ] **XSS prevention verified** (no dangerouslySetInnerHTML with user input)
- [ ] **HIPAA compliance reviewed** (PHI encrypted, audit logging, minimum necessary)

---

### Performance

- [ ] **Dashboard loads < 200ms** (p95)
- [ ] **All queries use indexes** (no sequential scans)
- [ ] **Images optimized** (compressed, lazy loaded)
- [ ] **Bundle size < 500KB** for Resilience Hub module

---

### Accessibility

- [ ] **Axe DevTools audit** passes (0 violations)
- [ ] **Keyboard navigation works** (Tab, Enter, Escape)
- [ ] **Screen reader tested** (NVDA or VoiceOver)
- [ ] **Color contrast WCAG AA** (4.5:1 for text)

---

### Documentation

- [ ] **User guide published**
- [ ] **Admin guide published**
- [ ] **Developer handoff doc complete**
- [ ] **All code has JSDoc comments**

---

### User Experience

- [ ] **Loading states** for all async operations
- [ ] **Error messages** user-friendly
- [ ] **Empty states** designed (no data yet)
- [ ] **Success messages** after actions (check-in saved)
- [ ] **Mobile responsive** (tested on iPhone, Android)

---

## Zero Tech Debt Pledge 📝

By completing this checklist, we commit to:

1. **No orphaned data** (foreign keys enforce relationships)
2. **No slow queries** (indexes on all FK and filter columns)
3. **No type errors** (strict TypeScript, 100% type coverage)
4. **No accessibility debt** (WCAG AA compliance from day 1)
5. **No security debt** (RLS policies, parameterized queries, input validation)
6. **No test debt** (>80% coverage before shipping)
7. **No documentation debt** (user guide + developer docs complete)

**If ANY item on this checklist is unchecked, the feature is NOT complete.**

---

## How to Use This Checklist

1. **Copy to GitHub Issues** - Create one issue per section (Database, TypeScript, React, etc.)
2. **Check boxes as you complete** - Update issue with ✅ when verified
3. **Code review requirement** - Reviewer must verify checklist before approving PR
4. **Pre-deployment gate** - Deployment blocked unless all boxes checked

---

**Remember:** Someone has to pay the debt. By following this checklist, that someone WON'T be you.

**Last Updated:** 2025-10-18
**Maintained By:** Engineering team
**Review Frequency:** After every sprint
