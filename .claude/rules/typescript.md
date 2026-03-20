# TypeScript Standards

**The `any` type is forbidden. Use `unknown` + type guards or define interfaces.**

| Situation | Wrong | Right |
|-----------|-------|-------|
| Unknown object shape | `any` | `unknown` then narrow with type guards |
| Database query results | `data: any[]` | Define interface, cast: `data as MyInterface[]` |
| JSON parsing | `JSON.parse(str) as any` | Generic: `parseJSON<T>(str): T` |
| Function parameters | `(data: any)` | `(data: unknown)` or proper interface |
| Third-party data | `response: any` | Define expected interface |
| Error handling | `catch (err: any)` | `catch (err: unknown)` |

**Proper patterns:**

```typescript
// Database results - define interfaces FIRST
interface PatientRecord {
  id: string;
  name: string;
  admission_date: string;
}
const { data } = await supabase.from('patients').select('*');
const patients = (data || []) as PatientRecord[];

// JSON parsing - use generics
function parseJSON<T>(str: string): T | null {
  try {
    return JSON.parse(str) as T;
  } catch {
    return null;
  }
}

// Unknown data - narrow with type guards
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Error handling - always use unknown
catch (err: unknown) {
  const error = err instanceof Error ? err : new Error(String(err));
  await auditLogger.error('OPERATION_FAILED', error, { context });
}
```

**Before using `any`:**
1. STOP - try to define proper types first
2. Create an interface for the data structure
3. Use `unknown` with type guards if truly dynamic
4. If `any` is genuinely the only option, add a comment explaining why
5. Ask Maria if unsure

## Type Cast Boundaries - `as unknown as X`

**The `as unknown as X` pattern is acceptable ONLY at system boundaries:**

| Allowed (Edge) | Forbidden (Interior) |
|----------------|----------------------|
| SDK initialization | Business logic |
| External API adapters | Domain transformations |
| Database row transforms | Service-to-service calls |
| Transport/serialization boundaries | Anywhere types should verify correctness |

**Examples:**
```typescript
// ✅ GOOD - SDK initialization boundary
this.client = new Anthropic(config) as unknown as AIClient;

// ✅ GOOD - Database row transform at query boundary
const patients = data as unknown as PatientRecord[];

// ✅ GOOD - External callback adapter
.on('postgres_changes', {}, (payload) =>
  callback(payload as unknown as TypedPayload)
)

// ❌ BAD - Cast in business logic
function calculateRisk(patient: unknown) {
  const p = patient as unknown as Patient; // NO - fix the caller
  return p.riskScore * 100;
}

// ❌ BAD - Cast to fix type errors in core code
const result = processData(input as unknown as ExpectedType); // NO
```

**Rule: Casts must never move closer to business logic.** If you need a cast inside a function, the problem is upstream - fix the caller or the interface.

**Current lint warning count: 0** (down from 1,671 in January 2026) - all `any` types and React hooks warnings eliminated through cross-AI auditing (Claude Code + ChatGPT).

## Lint Warning Policy - ZERO NEW WARNINGS

**Do NOT introduce new lint warnings unless absolutely necessary for a future build or development course.**

- Every PR/commit must not increase the lint warning count
- If you must add a warning temporarily, document WHY and create a task to fix it
- Before committing: run `npm run lint` and verify warning count did not increase
- New features must be lint-clean from the start
- This is a hard gate - work is not complete if it introduces new warnings
