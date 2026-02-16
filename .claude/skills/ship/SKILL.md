# /ship — Verify, Commit, and Push

Run the full quality gate, then commit and push. No shortcuts.

## Steps

1. **Typecheck** — Run `npm run typecheck`. If errors, fix them before continuing.
2. **Lint** — Run `npm run lint`. If errors or warnings, fix them before continuing.
3. **Tests** — Run `npm test`. If failures, fix them before continuing.
4. **Stage** — `git add` only the files you changed. Never `git add -A`.
5. **Commit** — Write a descriptive conventional commit message (feat/fix/refactor/docs). Include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`.
6. **Push** — `git push origin` to the current branch.
7. **Report** — Output this summary:

```
✅ typecheck: 0 errors
✅ lint: 0 errors, 0 warnings
✅ tests: X passed, 0 failed
📦 commit: <hash> — <message>
🚀 pushed to: <branch>
```

## Rules

- If ANY gate fails after 2 fix attempts, STOP AND ASK Maria.
- Never skip a gate. Never use `--no-verify`.
- Never commit files that contain secrets (.env, credentials).
- Do NOT start planning the next feature — stop after the push.
