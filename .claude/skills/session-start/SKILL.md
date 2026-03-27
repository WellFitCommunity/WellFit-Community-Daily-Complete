# /session-start — New Session Initialization

Read project state, check codebase health, and report a 5-line status summary per CLAUDE.md Session Start Protocol.

## Steps

### Step 1: Read Project State

```
Read docs/PROJECT_STATE.md (first 100 lines)
```

Extract: last session date, what was completed, current priority, blocked items.

### Step 2: Recent Commits

```bash
git log --oneline -5
```

Understand what changed since last session.

### Step 3: Quick Health Check

```bash
npm run lint 2>&1 | tail -3
```

Do NOT run full typecheck or tests at session start — those run after work is done.

### Step 4: Report Status

Output exactly this format:

```
1. Last session: [date] — [what was completed]
2. Current priority: [tracker name] — [next item]
3. Codebase health: [lint status from step 3, test count from PROJECT_STATE]
4. Blocked: [items or "None"]
5. Estimated remaining: [sessions for current priority]
```

### Step 5: Confirm

Ask Maria: "Ready to start on [current priority], or do you have something else in mind?"

Do NOT start any work until Maria confirms.
