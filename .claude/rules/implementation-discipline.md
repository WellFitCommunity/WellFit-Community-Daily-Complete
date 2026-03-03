# Implementation Discipline

## Plan In Your Head, Not On Screen

When asked to implement a feature:
- **Start writing the first file within 5 minutes.** Do not produce lengthy analysis.
- Plan internally. Do not output multi-page plans unless the user calls `/plan` or explicitly asks for a written plan.
- Only produce a written plan if the task requires extensive rewrites across many files and the user needs to approve the approach first.
- Minimize token usage in responses — no walls of code output, no verbose explanations. Be concise.

## Time Estimation — REQUIRED

**Before starting any feature implementation, provide a time estimate** so the user can assess scope and session planning.

Use this scale (based on the user's proven AI session cadence):

| Estimate | Sessions Needed | What It Means |
|----------|----------------|---------------|
| < 4 hours | 1 session | Fully complete in one pass, no compaction |
| 4–16 hours | 2 sessions | Will compact once, needs a follow-up session |
| 16–48 hours | 3–4 sessions | Multi-session build, checkpoint after each |
| 2 weeks | ~5 sessions | Major feature, plan session boundaries |

**Rules:**
- State the estimate at the start: *"This is a ~16 hour effort across 2-3 sessions."*
- If declaring work "complete" but the estimate was multi-session, explicitly say what's done and what remains.
- Never say "complete" when only one session of a multi-session feature is finished.
- When a session is about to compact, summarize: what's done, what's next, estimated sessions remaining.

## Pre-Push Checks — REQUIRED

### New files with healthcare URIs

Before pushing any new file that contains `http://` URIs, check `.github/workflows/security-scan.yml` for the exclusion list. Healthcare standard URIs (`http://nucc.org`, `http://hl7.org`, etc.) are identifiers, not insecure protocols — but the security scan doesn't know that unless they're excluded.

- If the URI's domain is already excluded: no action needed.
- If the URI's domain is NOT excluded: add it to the `grep -v` chain in the insecure protocol scan step before pushing.
- **Never assume a healthcare URI is already excluded.** Read the actual exclusion list.

### Test timing resilience

Every test that clicks a button which triggers a React state update (e.g., toggling a panel, opening a modal) must use `await screen.findByText()` or `await waitFor()` before interacting with the newly rendered content. `fireEvent.click` followed by an immediate `screen.getByText` on conditional content is a flaky test — it passes locally and fails in CI.

Pattern:
```typescript
// ❌ Flaky — works locally, fails in CI
fireEvent.click(screen.getByText('Escalate'));
fireEvent.click(screen.getByText('Charge Nurse')); // DOM may not have updated yet

// ✅ Resilient — waits for state update to render
fireEvent.click(screen.getByText('Escalate'));
const chargeNurseBtn = await screen.findByText('Charge Nurse');
fireEvent.click(chargeNurseBtn);
```
