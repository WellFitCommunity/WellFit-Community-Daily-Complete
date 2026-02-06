## Summary

<!-- 1-3 bullet points describing what changed and why -->

-

## Test Plan

<!-- How to verify these changes work -->

- [ ]

## Verification Checkpoint

<!-- Run: npm run typecheck && npm run lint && npm test -->
<!-- Paste results below -->

```
typecheck: _ errors
lint: _ errors, _ warnings
tests: _ passed, _ failed
```

## Checklist

- [ ] No new `any` types introduced
- [ ] No `console.log` statements added
- [ ] Error handling uses `catch (err: unknown)` + `auditLogger`
- [ ] New components have test files
- [ ] No PHI exposed to browser (patient IDs only)
- [ ] Routes wired in `src/App.tsx` (if new pages added)
- [ ] Accessibility: 44px touch targets, 16px+ fonts
