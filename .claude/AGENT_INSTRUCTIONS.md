# Instructions for Future AI Agents Working on WellFit

## CRITICAL: Read This First

This codebase is **not a hobby project**. It's being built for a father's sons' legacy and has **real hospital pilot meetings** (Methodist Houston, Dec 5th, 2025). Every change you make must be:

1. **Surgical, not reckless** - You are a surgeon, not a butcher
2. **Safe and tested** - Always run tests before committing
3. **Backwards compatible** - Zero breaking changes unless explicitly requested
4. **Professional grade** - This competes with Epic MyChart

---

## Architecture Philosophy

### **Intentional Dual Architecture (B2B2C)**

This system has **TWO SEPARATE but intentional architectures**:

1. **Community Platform** (B2C) - Standalone wellness app
2. **Enterprise Guardian System** (B2B) - Hospital security layer

**DO NOT consolidate these as "duplicates":**
- Separate audit loggers (Guardian + HIPAA) - INTENTIONAL
- Separate PHI encryption modules - INTENTIONAL for modularity
- Hospitals can buy one or both - this is **product strategy**, not tech debt

---

## Refactoring Standards

### **The Strangler Fig Pattern (Always Use This)**

When refactoring large files:

1. **Never delete the original file immediately**
2. **Extract to new modules first**
3. **Create barrel export (index.ts)**
4. **Convert original to re-export file**
5. **Run TypeScript check** - Must pass with 0 errors
6. **Run tests** - Must maintain passing count
7. **Test both old and new import paths**
8. **Commit with detailed message**

### **File Size Limits**

- ✅ **Maximum 500 lines per file** (ideal: 150-300)
- ❌ **Files over 1,000 lines** need refactoring

### **Example Refactoring (medications.ts)**

**Before:** 1,113 lines monolithic file
**After:**
```
/src/api/medications/
├── types.ts (87 lines) - Shared interfaces
├── MedicationCrud.ts (197 lines)
├── MedicationExtraction.ts (173 lines)
├── MedicationReminders.ts (118 lines)
├── MedicationAdherence.ts (120 lines)
├── PillIdentification.ts (182 lines)
├── PsychMedManagement.ts (191 lines)
└── index.ts (92 lines) - Barrel export
```
**Original file:** 95 lines (re-export only)

**Result:** Zero breaking changes, all imports work

---

## Git Workflow

### **NEVER skip these steps:**

1. **Before ANY commit:**
   ```bash
   npm run lint
   npm run typecheck
   npm test
   ```

2. **Commit message format:**
   ```
   type: description (file size change)

   DETAILED explanation of what changed and WHY

   - List specific changes
   - Include file size reduction stats
   - Note backwards compatibility

   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>
   ```

3. **Always push after commit:**
   ```bash
   git push
   ```

### **Git Commit Rules:**

- ✅ Only commit when user explicitly asks
- ❌ NEVER use `--amend` unless user requests
- ❌ NEVER force push to main/master
- ❌ NEVER skip pre-commit hooks
- ❌ NEVER commit without running tests first

---

## Edge Functions (Supabase)

### **CRITICAL: URL Format Changed**

**OLD (Broken):**
```typescript
const functionsUrl = SB_URL.replace('.supabase.co', '.functions.supabase.co');
await fetch(`${functionsUrl}/function-name`);
```

**NEW (Correct):**
```typescript
const functionsUrl = `${SB_URL}/functions/v1`;
await fetch(`${functionsUrl}/function-name`);
```

**Always use the new format!** The old subdomain pattern causes 401 errors.

---

## Testing Requirements

### **Before Any Refactoring:**

```bash
# 1. Count current passing tests
npm test 2>&1 | grep "Tests.*passed"
# Example: "Tests: 625 passed"

# 2. After refactoring, MUST maintain same count
npm test 2>&1 | grep "Tests.*passed"
# Must still show: "Tests: 625 passed"
```

### **TypeScript Must Pass:**

```bash
npx tsc --noEmit
# Exit code MUST be 0 (no errors)
```

---

## Database Migrations

### **Migration Safety Rules:**

1. **Check if migration already applied:**
   ```bash
   npx supabase db pull
   ```

2. **Use IF NOT EXISTS for everything:**
   ```sql
   CREATE TABLE IF NOT EXISTS table_name (...);
   CREATE INDEX IF NOT EXISTS idx_name ON table_name(column);
   ```

3. **Test migrations locally before pushing:**
   ```bash
   npx supabase db push --dry-run
   ```

4. **NEVER drop production tables without explicit user approval**

---

## FHIR Standards

This system is **FHIR R4 compliant** with **US Core profiles**:

- All FHIR resources must follow HL7 FHIR R4 spec
- Use proper FHIR resource types (Observation, MedicationRequest, etc.)
- Include proper LOINC/SNOMED/CVX codes
- RLS (Row-Level Security) on all FHIR tables
- Audit logs for all PHI access

---

## Security & Compliance

### **HIPAA Requirements:**

- ✅ All PHI must be encrypted at rest
- ✅ Audit logs for all data access
- ✅ Row-Level Security (RLS) enabled
- ✅ No PHI in console.log statements
- ✅ Soft deletes (never hard delete patient data)

### **Pre-commit Hook:**

The codebase has a HIPAA compliance check that scans for active console statements. **Do not disable this.**

---

## Common Mistakes to Avoid

### **❌ DON'T DO THIS:**

1. **Creating "duplicate" code without understanding B2B2C architecture**
   - Separate audit systems are intentional
   - Separate encryption modules are for modularity

2. **Fast refactoring without testing**
   - This breaks production code
   - Always test both old and new import paths

3. **Consolidating files into new monoliths**
   - Extract to small, focused modules (150-300 lines)
   - Don't create 1,000+ line "service" files

4. **Breaking changes without approval**
   - Always maintain backwards compatibility
   - Use Strangler Fig Pattern

5. **Committing without running tests**
   - Tests must pass BEFORE commit
   - User has 625+ tests for a reason

---

## Recommended Refactoring Order (for Methodist Dec 5th)

1. ✅ **medications.ts** (DONE - 1,113 → 95 lines)
2. ⏳ **PhysicianPanel.tsx** (1,114 lines) - CRITICAL for demo
3. ⏳ **fhirResourceService.ts** (1,711 lines) - Finish extraction
4. ⏳ **FhirIntegrationService.ts** (1,269 lines) - Epic integration
5. ⏳ **claudeService.ts** (1,043 lines) - AI features
6. FhirAiService.ts (1,344 lines) - Post-Methodist
7. LiteSenderPortal.tsx (1,165 lines) - Post-Methodist
8. RealTimeSmartScribe.tsx (1,008 lines) - Post-Methodist

---

## Methodist Hospital Demo (Dec 5th)

### **What They'll Ask About:**

1. **Epic Integration** - Show FHIR interoperability system
2. **Medication Management** - Medicine Cabinet with AI label reading
3. **Care Coordination** - Unified patient view across specialties
4. **Quality Metrics** - Care gap detection (vaccines, chronic conditions)
5. **Security** - HIPAA compliance, RLS, audit logs

### **Demo-Ready Features:**

- ✅ FHIR R4 compliance
- ✅ US Core profiles (Immunizations, CarePlans, Observations)
- ✅ Care gap detection (vaccine gaps, chronic conditions)
- ✅ External EHR sync (Epic/Cerner ready)
- ✅ Guardian Agent (autonomous error healing)
- ✅ 625+ passing tests

---

## How to Be Like the "Good Agent"

### **Communication Style:**

- ✅ Professional, not cheesy
- ✅ Real feedback, not fake praise
- ✅ Honest about limitations
- ✅ Explain technical decisions clearly
- ❌ Don't use excessive emojis unless requested
- ❌ Don't give false confidence

### **Work Ethic:**

- ✅ Take time to do it right (surgeon, not butcher)
- ✅ Test thoroughly before committing
- ✅ Document what you changed and why
- ✅ Maintain backwards compatibility
- ✅ Ask clarifying questions when unsure

### **Technical Standards:**

- ✅ Use TodoWrite tool to track complex tasks
- ✅ Run lint/typecheck/test before commits
- ✅ Follow Strangler Fig Pattern for refactoring
- ✅ Maintain 500-line max file size rule
- ✅ Create comprehensive commit messages

---

## Emergency Recovery

### **If You Break Something:**

1. **Don't panic - there are backups:**
   ```bash
   ls -la src/api/*.backup.ts
   ls -la src/services/*.backup.ts
   ```

2. **Check git history:**
   ```bash
   git log --oneline -10
   git show <commit-hash>
   ```

3. **Restore from backup:**
   ```bash
   cp src/api/medications.backup.ts src/api/medications.ts
   ```

4. **Run tests to verify:**
   ```bash
   npm test
   ```

---

## Final Words

This codebase represents a father's commitment to his sons' future. Every line of code matters. Every refactoring should make the system **better, not just different**.

**Be a surgeon, not a butcher.**

When in doubt:
- Test first
- Ask questions
- Maintain backwards compatibility
- Document your changes
- Respect the existing architecture

**The user knows what they built. Listen to them.**

---

## Contact & Support

- **GitHub:** https://github.com/WellFitCommunity/WellFit-Community-Daily-Complete
- **Meeting:** Methodist Houston - Dec 5th, 2025
- **Current Status:** 625+ tests passing, registration flow working, FHIR locked in

**Make the user proud. This is for their sons.**
