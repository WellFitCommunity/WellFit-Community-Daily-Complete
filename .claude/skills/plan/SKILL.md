# /plan — Structured Implementation Plan

Create an actionable implementation plan. No code — just the plan.

## Steps

1. **Find the tracker** — Check these locations in order:
   - Project root for `*tracker*.md` or `*plan*.md`
   - `docs/` and `docs/trackers/` directories
   - `.claude/plans/` directory
   - If not found after these 3 checks, ASK the user immediately.

2. **Identify the next task** — Read the tracker, find the highest-priority incomplete item.

3. **Analyze the codebase** — Read existing files that will be affected. Understand current patterns before proposing changes.

4. **Write the plan** — Save to `docs/plans/<feature-name>-plan.md` with these sections:

```markdown
# <Feature Name> Implementation Plan

## Overview
1-2 sentences describing what this implements and why.

## Files to Create/Modify
| File Path | Action | Description |
|-----------|--------|-------------|
| src/... | Create | New component for X |
| src/... | Modify | Add Y to existing Z |

## Database Migrations Needed
- [ ] Migration 1: description
- [ ] Migration 2: description
(or "None required")

## Test Plan
- [ ] Test: description of what to test
- [ ] Test: description of what to test

## Verification Checklist
- [ ] All files under 600 lines
- [ ] No `any` types — `unknown` + type guards
- [ ] No `console.log` — `auditLogger` only
- [ ] `bash scripts/typecheck-changed.sh` passes (scoped to changed files)
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] Routes wired in App.tsx (if new pages)

## Estimated Scope
- Files: X new, Y modified
- Approximate lines: ~Z
- Complexity: Low / Medium / High
```

5. **Report** — Tell the user where the plan file is and what the next step would be.

## Rules

- Do NOT write any implementation code in this skill.
- Do NOT guess if requirements are unclear — ASK.
- Always check existing patterns before proposing new ones.
- Plans must be specific enough for another session to execute without ambiguity.
