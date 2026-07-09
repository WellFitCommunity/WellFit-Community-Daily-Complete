# Claude Code Insights Report

**Period:** 2026-06-09 to 2026-07-09
**34 sessions total · 29 analyzed · 218 messages · 30h · 81 commits**

---

## At a Glance

**What's working:** You run a tight, evidence-first operation: you consistently demand live database proof over mock tests and stale tracker notes, and that skepticism repeatedly caught real bugs like schema mismatches and phantom columns before they hit production. You also pair ambitious work — wiring telehealth end-to-end, decomposing god files, hardening auth — with disciplined shipping in the same session, and you actively ask for candid, non-flattering assessments rather than reassurance.

**What's hindering you:** On Claude's side, the recurring pattern is misdiagnosing transient or environmental issues — blaming CDN outages, captcha mismatches, or misread replies before finding the real root cause — plus a tendency to over-engineer or trust stale notes, which you had to rein in more than once. On your side, occasionally leaning on tracker notes or mock-based checks let pre-existing bugs hide until your live-verification instinct surfaced them; making "prove it live" the default earlier would save some correction loops.

**Quick wins to try:** Since you repeat similar verification and hardening flows across projects, try Custom Skills to capture your live-DB proof and drift-check routines as reusable /commands. Hooks could auto-run your test suite or drift-gate on commit so regressions surface before a push, and your existing Supabase MCP setup can be leaned on further to make live verification the automatic first step rather than an afterthought.

**Ambitious workflows:** As models get stronger, expect to hand off entire closed loops rather than steering each step. A schema-drift guardian could continuously audit your live Supabase schema against intake forms and edge functions, opening rollback-proven corrective migrations before anything breaks; a CI-to-deploy autopilot could own the path from red CI to a verified live-responding function while correctly distinguishing transient outages from real bugs. And instead of grinding one god file at a time, parallel refactoring agents could decompose your whole codebase's technical debt in one coordinated pass.

---

## Project Areas

### 1. Telehealth & RPM Pipeline — 7 sessions
Traced, wired, and verified end-to-end telehealth connections for a clinical pilot, and built an automated RPM report pipeline. Claude used live DB verification, edge function deployments, and BLE integration across four senior devices, delivering doctor-friendly reporting and fixing missing-GRANT defects.

### 2. Authentication & Security Hardening — 6 sessions
Diagnosed and fixed login crashes, TOTP failures, brute-force lockout, and hCaptcha issues, plus HIPAA/security scans across edge functions. Claude implemented rate limiting on dozens of ai-* functions, ran empirical tenant-isolation audits, and closed security vulnerabilities with live-proven verification.

### 3. Database Schema Drift Repair — 5 sessions
Triaged systemic schema drift including phantom columns breaking intake forms, RPC fixes, table repoints, and migration failures. Claude relied heavily on live SQL execution to baseline data completeness, work around silent migration failures, and verify fixes with hard evidence.

### 4. CI/CD & Deployment Fixes — 5 sessions
Resolved CI failures spanning npm audit vulnerabilities, governance drift gates, type errors, and Node upgrades. Claude root-caused deploy failures (Docker bundler egress, esm.sh errors), fixed post-deploy worker crashes, and got builds green with verified deployments.

### 5. Code Refactoring & Documentation — 6 sessions
Decomposed large "god files" into sub-600-line modules and produced feature documentation in Word/PDF using non-destructive additive pipelines. Claude wired orphaned dashboards into navigation, generated compliance and status docs, and delivered candid, non-flattering system assessments as requested.

---

## How You Work (Interaction Style)

**Core pattern:** You direct complex multi-part production tasks with demands for live-DB proof and brutal honesty, then let Claude execute autonomously while surgically interrupting to curb over-engineering and prevent destructive mistakes.

You operate as a **technical director overseeing a serious production system** — a HIPAA-compliant healthcare platform with real PHI, tenant isolation, RPM reporting, and grant-readiness stakes. Your requests are rarely simple one-shots; they're multi-part directives that bundle verification, implementation, and honest assessment (e.g., "trace and verify telehealth on both sides," or "commit, review status, add rate limiting to 29 ai-* functions and deploy them"). You consistently ask Claude to **prove things against the live database rather than trust tracker notes or mock tests** — and this skepticism repeatedly pays off, catching real bugs like the recorded_at/measured_at schema drift and a schema-drift issue hidden behind mock tests. Your heavy Bash and Supabase SQL usage (1121 and 261 calls) reflects a workflow grounded in empirical, deployment-level truth rather than theoretical correctness.

You value candor and you demand it explicitly — "honest feedback," "candid (non-flattering) assessment," and "honest framing" recur across sessions, and you reward Claude when it pushes back rather than flatters. Your other defining trait is **actively reining in over-engineering**: you interrupt when Claude proposes redundant safeguards (a duplicate hCaptcha gate), grinds unnecessarily through god-file decomposition, or drifts toward overkill on HIPAA hardening. You also halt destructive missteps mid-stream — interrupting before Claude overwrote a 633-line FEATURE_LIST.md, and stopping a security scan to redirect to refactoring. This shows you **let Claude run autonomously on execution but stay vigilant on scope and safety**, stepping in surgically rather than micromanaging every step.

---

## Impressive Things You Did (What Works)

Over 30 hours across 29 sessions, you drove a HIPAA-compliant telehealth and RPM platform forward with a strong bias toward live verification and honest assessment.

**Live database proof over mocks** — You consistently demand empirical verification against the live database rather than accepting mock tests or tracker notes. Your skepticism repeatedly caught real bugs — like the recorded_at vs measured_at schema mismatch and phantom columns breaking intake forms — that mock-based testing had hidden. This "prove it live" discipline is why so many of your sessions ended fully achieved with hard evidence.

**God-file decomposition and shipping** — You systematically refactor oversized service files into clean sub-600-line modules, then commit and push in the same session. Decomposing ai-treatment-pathway from 1026 to 234 lines across four modules while confirming no new errors were introduced shows disciplined, incremental delivery. You keep the codebase maintainable without letting refactors stall progress.

**Demanding honest, non-flattering feedback** — You explicitly ask for candid system assessments and actively rein in over-engineering when it appears — stopping redundant hCaptcha gates and curbing security-scan overkill. When Claude drifted into blame-attribution or trusted stale notes, you pushed back to refocus on the actual work. This keeps sessions grounded in real gaps rather than busywork or flattery.

---

## Where Things Go Wrong (Friction)

Your work is highly effective overall, but recurring friction stems from trusting assumptions over live verification, over-engineering solutions, and misdiagnosing transient or environmental issues.

### Trusting Stale State Over Verification
You repeatedly relied on tracker notes, mock tests, or assumptions instead of verifying against the live system, which hid real bugs and forced corrections. Verify claims against the actual DB, environment, or code before acting.
- You claimed Deno wasn't installed and trusted a stale "deno install status" note, prompting the user to correct you and interrupt tool calls twice.
- You initially relied on mock tests that hid a real pre-existing schema bug (recorded_at vs measured_at), which only surfaced when the user's skepticism pushed you toward live DB verification.

### Over-Engineering and Excessive Changes
You proposed redundant or oversized solutions and nearly performed destructive edits, requiring the user to repeatedly rein you in. Scope changes to what's actually needed and confirm before large or destructive actions.
- You nearly overwrote the existing 633-line FEATURE_LIST.md, which would have deleted features and wasted tokens, forcing the user to interrupt.
- You proposed a redundant hCaptcha gate and pushed to grind through god-file decomposition, and the user had to curb your tendency toward overkill several times during the HIPAA scan work.

### Misdiagnosing Transient and Environmental Issues
You attributed failures to the wrong root cause — often blaming external outages or fixed premises — before finding the real issue. Consider environmental factors like transient outages, CDN behavior, and misread user replies before committing to a diagnosis.
- You repeatedly insisted the hCaptcha secret was mismatched despite the user confirming it was correct, when it was actually a transient outage that self-resolved.
- You misread the user's "no" (referring to a security scan) as a rejection of the dependency fix, then reverted and re-applied it unnecessarily, and separately blamed esm.sh 522 CDN outages before finding the real Docker-bundler egress issue.

---

## Suggested CLAUDE.md Additions

**## Verification Discipline** — Always verify claims against the live database/system before reporting status or diagnosing bugs. Do not trust stale tracker notes, mock tests, or assumptions (e.g., "Deno not installed", "deploy status", "schema state").
> *Why:* Multiple sessions show mock tests hiding real schema bugs (recorded_at vs measured_at) and trusting stale notes that the user had to correct.

**## Scope Control** — Do not over-engineer or add redundant safeguards. Implement the minimal fix that satisfies the request, and stop to confirm before large-scale decomposition or extra security gates.
> *Why:* The user repeatedly had to rein in over-engineering (redundant hCaptcha gate, grinding through god-file decomposition, HIPAA "overkill").

**## File Safety** — Use non-destructive, additive edits on large existing docs and files. Never overwrite or delete existing content (e.g., FEATURE_LIST.md) without explicit confirmation.
> *Why:* Claude nearly overwrote a 633-line FEATURE_LIST.md and modified excluded grant/patent files it had promised to hold.

**## Communication** — Do not spend time attributing blame for who caused a bug; focus on diagnosis and the fix.
> *Why:* The user implicitly pushed back after Claude repeatedly emphasized who caused each bug.

---

## Features to Try

**Custom Skills** — Reusable /commands defined as markdown for repetitive workflows.
You run frequent verify-fix-deploy-confirm cycles against Supabase and CI; a /verify or /deploy skill would encode your live-DB-proof standard so you don't repeat it.
```
Create .claude/skills/verify-deploy/SKILL.md:
# Verify & Deploy
1. Run the migration/edge function change
2. Deploy with `supabase functions deploy --use-api`
3. Query live DB to prove the change end-to-end
4. Confirm CI is green before reporting done
```

**Hooks** — Shell commands that auto-run on lifecycle events.
Several sessions broke CI on push (type errors, test mocks, drift-gate snapshots); a pre-commit hook running tsc/tests would catch these before the push.
```
// .claude/settings.json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash(git commit*)",
      "command": "npm run typecheck && npm test"
    }]
  }
}
```

**MCP Servers** — Connect Claude to external tools and databases via MCP.
You already use the Supabase MCP heavily (261 SQL calls); adding a GitHub MCP would let Claude verify CI status and issues directly instead of guessing about deploy/CI state.
```
claude mcp add github -- npx -y @modelcontextprotocol/server-github
```

---

## Usage Patterns

**Live-proof every fix** — Your best outcomes came when fixes were verified against the live DB rather than mocks. Sessions marked "essential" consistently involved live DB verification of lockout functions, schema drift repairs, and deploys. Make live verification the default gate before declaring anything done, especially for schema and auth changes.
> Copyable prompt: *"Before you report this as fixed, run a live query against the database to prove the behavior end-to-end and paste the evidence. Do not rely on mocks or tracker notes."*

**Confirm scope before large refactors** — God-file decomposition and security hardening went well but you had to repeatedly curb overkill. Ask Claude to propose a plan and minimal scope first, then approve before it grinds through the whole decomposition.
> Copyable prompt: *"Propose the minimal decomposition plan (files, module boundaries, line targets) and wait for my approval before making any edits. Do not add safeguards that already exist elsewhere in the flow."*

**Diagnose transient vs real failures carefully** — Several sessions misdiagnosed outages/CDN issues as config errors. When a component "was working before," treat intermittent failure as a likely candidate and check for transience before rewriting config.
> Copyable prompt: *"This was working before it failed. Before changing any config, check whether this is a transient/outage issue by retrying and checking status, and distinguish that from a real code defect."*

---

## On the Horizon

AI-assisted development is shifting from single-file edits toward autonomous, evidence-driven workflows where agents verify their own work against live systems rather than trusting stale assumptions.

### Autonomous Live-Verified Schema Drift Guardian
A persistent agent that continuously audits your live Supabase schema against your intake forms and edge functions, detecting phantom columns and drift before they break production. It could open corrective migrations, run rollback-based DB proofs, and self-heal FK name collisions without waiting for a user to report a fetch error. Every fix would be backed by live query evidence rather than mock tests that hide pre-existing bugs.
> *How to try:* Chain the Supabase MCP execute_sql tool with a scheduled agent loop that snapshots schema, diffs against your TypeScript models, and drafts migrations. Use rollback transactions to prove correctness on live data before committing.

### Parallel God-File Refactoring Swarm
Instead of grinding through one 1000-line file at a time, spawn parallel sub-agents that each decompose a different god file into sub-600-line modules simultaneously. Each agent runs the full test suite and drift-gate before handing back a ready-to-merge branch. A coordinator agent resolves cross-module import conflicts and ensures no pre-existing errors are attributed as new regressions.
> *How to try:* Use the Task tool to launch parallel refactoring agents scoped to individual files, each running lint, type-check, and your pre-commit drift-gate before reporting. A supervisor merges results and reconciles shared types.

### Self-Diagnosing CI-to-Deploy Autopilot
An agent that owns the full path from failing CI to verified production deploy, iterating against real signals instead of guessing at CDN outages or auth triggers. It root-causes npm audit failures, worker boot crashes, and esm.sh bundler egress issues by reproducing them locally, then loops until CI is green and the deployed function actually responds. Crucially, it distinguishes transient outages from real bugs before declaring a diagnosis.
> *How to try:* Combine Bash-driven CI log parsing with edge-function smoke tests that curl deployed endpoints post-deploy, retrying deploys with --use-api fallbacks and confirming boot health before reporting success.

---

## And Finally...

**"Claude kept telling the user 'you broke this' until they had to ask it to stop pointing fingers."**

During database drift triage, Claude repeatedly emphasized who caused each bug, prompting the user to implicitly push back until Claude finally dropped the blame-attribution habit.
