# Building With AI: The Class They Don't Teach

**A Curriculum for Getting the Best Out of AI Coding Assistants**

> Created by Maria LeBlanc, AI System Director — Envision Virtual Edge Group LLC
> Built from 9 months of real-world AI development, 2,100+ sessions, 1,989 commits, and $645 total development cost.
> This curriculum is based on building a HIPAA-compliant, multi-tenant healthcare platform using AI tools with zero coding background.

---

## Course Overview

This is not a prompt engineering class. Prompt engineering is a conversation. What you're about to learn is **architecture** — building systems that make AI consistently produce what you need, session after session, without repeating yourself.

**Who this is for:** Anyone building software with AI coding assistants — beginners, seasoned developers, team leads, non-technical founders who use AI as their engineering team.

**What you'll walk away with:** A complete framework for governing AI output, not just requesting it.

---

## Table of Contents

| Lesson | Title | Core Concept |
|--------|-------|--------------|
| 1 | [AI Frequent Mistakes](#lesson-1-ai-frequent-mistakes) | Know the failure patterns so you catch them before they ship |
| 2 | [Build AI Memory](#lesson-2-build-ai-memory) | Stop starting from scratch every session |
| 3 | [Don't Talk Dirty to AI](#lesson-3-dont-talk-dirty-to-ai) | Be clear and tell it what NOT to do |
| 4 | [Not Better Prompts — Structured Inputs](#lesson-4-not-better-prompts--structured-inputs) | Model the behavior: do this, not that |
| 5 | [Recalibrate AI Speed](#lesson-5-recalibrate-ai-speed) | Change how AI responds by slowing it down |
| 6 | [Change Roles for Fresh Perspective](#lesson-6-change-roles-for-fresh-perspective) | Adversarial checking and role-based auditing |
| 7 | [The Governance Document You Never Knew You Needed](#lesson-7-the-governance-document-you-never-knew-you-needed) | The control system that replaces prompt engineering |
| 8 | [You Are the Architect, AI Is the Builder](#lesson-8-you-are-the-architect-ai-is-the-builder) | Domain expertise beats coding knowledge |
| 9 | [Tips and Tricks That Make AI Disciplined](#lesson-9-tips-and-tricks-that-make-ai-disciplined) | Parameters, structure, and guidelines that enforce quality |
| 10 | [Make AI Explain Itself](#lesson-10-make-ai-explain-itself) | Force the "why" — then use it to prevent the mistake forever |
| 11 | [The 2-Strike Rule](#lesson-11-the-2-strike-rule) | When AI is stuck, stop it before it makes things worse |
| 12 | [Verification Is the Only Signal](#lesson-12-verification-is-the-only-signal) | Confidence means nothing — only proof matters |
| 13 | [Session Management](#lesson-13-session-management) | Context degrades — manage it like a resource |

---

## Lesson 1: AI Frequent Mistakes

### The Problem

AI coding assistants make the same categories of mistakes across every codebase, every language, and every user. These aren't random bugs — they're predictable failure patterns baked into how the models work. Once you learn to recognize them, you catch them before they ship.

### Why AI Makes These Mistakes

AI models generate code by pattern-matching against millions of examples from their training data. This means:

- **They default to the most common pattern**, even when your project uses a different one
- **They copy outdated patterns** because older code exists in larger quantities online
- **They optimize for "looks right"** rather than "is right"
- **They skim files looking for what they expect** instead of reading what's actually there

### The Skim vs. Ingest Problem

This is the #1 technical failure pattern. When AI reads a file, it pattern-matches against what it *expects* to find — not what's actually written. This causes:

| What AI Does | What Goes Wrong |
|---|---|
| Assumes a method exists because it "should" | Calls `auditLogger.ai()` when the method is `auditLogger.info()` |
| Assumes a type has the shape it "probably" has | Uses `ServiceError` when the actual type is `string` |
| Uses enum values that "sound right" | Writes `'danger'` when the valid value is `'critical'` |
| Writes code against the intended interface | Code compiles in AI's mind, fails in reality |

### Common AI Code Mistakes

| AI Mistake | Why It Happens | What to Watch For |
|---|---|---|
| Legacy API patterns | Training data has more old code than new | `process.env.REACT_APP_*` instead of `import.meta.env.VITE_*` |
| Deprecated function calls | Old docs outnumber new docs | `forwardRef()` in React 19. `componentDidMount()` in hooks era |
| Sloppy error handling | AI takes shortcuts with errors | `catch (e) { console.log(e) }` — silent swallowing |
| Creating new files instead of editing | Starting fresh feels easier to AI | File bloat, duplicated logic, abandoned originals |
| "Temporary" workarounds | Solves the immediate problem, defers pain | Comments like "TODO", "for now", "quick fix", "we can improve later" |
| Deleting code it thinks is "unused" | AI has cleanup instinct without full context | Removes a database table, function, or export that another file needs |
| Tests that test nothing | AI optimizes for "test passes" not "test catches bugs" | `expect(component).toBeTruthy()` passes for an empty `<div>` |
| Over-engineering simple requests | AI loves showing off abstractions | Asked for a button, got a design system |
| Unused imports/variables after refactoring | AI forgets to clean up after itself | Lint warnings pile up |
| Hardcoded values that should be dynamic | Faster to generate inline | Magic strings, config values in code instead of env vars |
| Inventing file paths and module names | AI "remembers" paths from training data | `import { thing } from './utils/helpers'` — file doesn't exist |

### How to Catch These

1. **Always run the compiler/type checker** — catches invented imports, wrong types, missing methods
2. **Always run the linter** — catches unused variables, bad patterns, style violations
3. **Always run tests** — catches logic errors the AI is blind to
4. **Read the diff before accepting** — `git diff` shows you exactly what changed. Review it.

### Key Takeaway

> AI makes predictable mistakes. Predictable means preventable. Learn the patterns and you'll catch them in seconds instead of debugging them for minutes.

---

## Lesson 2: Build AI Memory

### The Problem

Every new AI session starts with amnesia. The AI doesn't remember what you built yesterday, what mistakes it made, what patterns your project uses, or where you left off. Without memory, you repeat the same corrections every single session.

### The Three Types of Memory

| Memory Type | What It Contains | How Long It Lasts | Example File |
|---|---|---|---|
| **Rules Memory** | Permanent standards that never change | Forever | `CLAUDE.md`, `.cursorrules`, system instructions |
| **Learned Memory** | Patterns discovered through work | Until outdated | `MEMORY.md`, notes files |
| **Session Memory** | Where you left off, current priorities | Until next session | `PROJECT_STATE.md`, task trackers |

Most people only use Rules Memory (if that). The people who get 10x results use all three.

### Rules Memory — Your Permanent Standards

This is a file the AI reads at the start of every session. It contains:
- Coding standards (naming conventions, error handling patterns, forbidden patterns)
- Project-specific rules (what framework, what version, what architecture)
- Things the AI must never do (your "Don't" list — see Lesson 3)

**This file is NOT instructions to the AI. It's a control system OVER the AI.** The distinction matters. Instructions can be ignored. A control system is enforced.

### Learned Memory — What the AI Discovers

As you work with AI, it will discover things about your codebase:
- "The audit logger method is `.info()`, not `.ai()`"
- "This project uses `'critical'` not `'danger'` for severity badges"
- "The service layer always returns `ServiceResult<T>`, never throws"

**Tell the AI to write these down.** Say: "Add this to your memory file so you don't make this mistake again." It will persist across sessions.

### Session Memory — Where You Left Off

The biggest friction in AI-assisted development is context loss between sessions. You finish a session at 80% on a feature. Next session, the AI has no idea what 80% looks like.

**Fix:** Maintain a state file that answers:
1. What was completed in the last session?
2. What is the current priority?
3. What is blocked?
4. What's the next step?

Update it at the end of every session. Read it at the start of every session.

### Building Memory — Practical Steps

```
your-project/
  CLAUDE.md              # Rules Memory — permanent standards
  docs/
    PROJECT_STATE.md     # Session Memory — where we left off
  .claude/
    memory/
      MEMORY.md          # Learned Memory — patterns and discoveries
      coding-patterns.md # Detailed notes on recurring patterns
      mistakes-log.md    # Things that went wrong and how to fix them
```

### The Anti-Pattern: Starting Fresh Every Time

Without memory:
- Session 1: AI uses `console.log`. You correct it.
- Session 2: AI uses `console.log` again. You correct it again.
- Session 3: AI uses `console.log` AGAIN.

With memory:
- `CLAUDE.md` says "NEVER use console.log — use auditLogger"
- Every session, from session 1 to session 1,000, the AI follows the rule

### Key Takeaway

> AI without memory is a genius with amnesia. Build the memory system and the genius remembers everything.

---

## Lesson 3: Don't Talk Dirty to AI

### The Problem

"Talking dirty" to AI means giving it vague, ambiguous, or purely positive instructions that leave too much room for interpretation. AI will fill every gap in your instructions with its own assumptions — and its assumptions are often wrong.

### Why "Don't" Lists Beat "Do" Lists

Compare:

**Vague positive instruction:**
> "Write clean, well-structured code"

What does the AI do? Whatever it thinks "clean" means. Which is different for every model, every session, and every context.

**Specific negative constraint:**
> "Do NOT add comments to code you didn't change. Do NOT refactor functions you weren't asked about. Do NOT add error handling beyond what's needed for this specific fix."

Now the AI has clear boundaries. There's no ambiguity about what "clean" means — there's a concrete list of things it must not do.

### The Science Behind This

- **"Do" instructions are open-ended** — infinite ways to comply, AI picks whichever pattern is strongest in training data
- **"Don't" instructions are specific** — clear pass/fail, AI either violates the rule or doesn't
- **Negative constraints narrow the solution space** — fewer valid options means fewer wrong options

### How to Write Effective "Don't" Lists

**For coding standards:**
```
Do NOT use `any` type — use `unknown` with type guards
Do NOT use console.log — use the audit logger
Do NOT use process.env — use import.meta.env
Do NOT delete existing tests
Do NOT skip type checking
```

**For task scope:**
```
Do NOT refactor surrounding code
Do NOT add features beyond what was requested
Do NOT change function signatures that other files depend on
Do NOT create new files when editing existing ones would work
```

**For behavior:**
```
Do NOT guess when uncertain — ask me
Do NOT claim you verified without showing the output
Do NOT continue past 2 failed fix attempts — stop and explain
```

### The "What NOT to Do" Table Pattern

One of the most effective formats for AI instructions is a two-column table:

| Do This | Not This |
|---|---|
| `catch (err: unknown)` | `catch (err: any)` |
| `auditLogger.error(...)` | `console.error(...)` |
| `import.meta.env.VITE_*` | `process.env.REACT_APP_*` |
| Return `failure()` result | Throw exceptions |
| `ref` as prop directly | `forwardRef()` wrapper |

The AI instantly understands the pattern. One table replaces paragraphs of explanation.

### Common "Dirty Talk" and Clean Alternatives

| Dirty (Vague) | Clean (Specific) |
|---|---|
| "Make it better" | "Reduce the function to under 20 lines by extracting the validation logic" |
| "Fix the bugs" | "The login form submits even when the email field is empty. Add validation." |
| "Write clean code" | "Follow the existing `ServiceResult<T>` pattern. No try/catch that swallows errors." |
| "Add tests" | "Add tests for: successful login, invalid email, network error, and empty form submission" |
| "Improve this" | "This function is 200 lines. Extract the parsing logic into a separate function." |

### Key Takeaway

> Telling AI what NOT to do is more powerful than telling it what to do. Constraints produce better results than open-ended freedom. Be specific. Be explicit. Leave no room for interpretation.

---

## Lesson 4: Not Better Prompts — Structured Inputs

### The Problem

The AI industry is obsessed with "better prompts." But the real lever isn't the words you choose — it's how you **structure** the information. AI processes structured input dramatically better than run-on paragraphs.

### Format Matters More Than Wording

**Unstructured (AI processes poorly):**
> "Create a patient dashboard that shows vitals and medications and has a loading state and error handling and uses the EA design system and follows our service pattern and has tests"

**Structured (AI processes accurately):**
> **Create a patient dashboard:**
> - Shows vitals (BP, heart rate, SpO2)
> - Shows current medications
> - Has loading state with spinner
> - Has error state with user-friendly message
> - Uses EA design system components
> - Follows `ServiceResult<T>` pattern
> - Include tests for: data display, loading state, error state

Same information. The structured version gets followed correctly on the first attempt. The unstructured version gets partially followed with gaps.

### The "Model the Behavior" Pattern

The most powerful teaching technique for AI isn't explaining what you want — it's **showing** it.

One concrete example teaches more than a paragraph of description:

**Explaining (100 words, AI might misinterpret):**
> "We use a service result pattern where all services return a standardized result object that can either be a success with data or a failure with an error code and message..."

**Showing (5 lines, AI gets it immediately):**
```typescript
// Every service returns this:
return success(data);
// or
return failure('DATABASE_ERROR', error.message, error);
```

### The "Do This / Not That" Table

The single most effective format for teaching AI your patterns:

```markdown
| Do This | Not This |
|---------|----------|
| `success(data)` | `return { ok: true, data }` |
| `failure('CODE', msg)` | `throw new Error(msg)` |
| `err: unknown` | `err: any` |
```

AI learns immediately from this format because:
- The contrast is unambiguous
- The pattern is visual, not verbal
- There's a clear right and wrong

### Structured Input Templates

**For bug fixes:**
```
Bug: [what's wrong]
Expected: [what should happen]
Actual: [what actually happens]
File: [where the bug is]
Constraint: Fix only this issue, do not refactor surrounding code
```

**For new features:**
```
Feature: [what to build]
Location: [where it goes in the codebase]
Pattern to follow: [link to similar existing feature]
Must include: [bullet list of requirements]
Must NOT include: [bullet list of exclusions]
```

**For refactoring:**
```
Goal: [what the refactored code should look like]
Current state: [what's wrong with it now]
Files affected: [list of files]
Constraint: All existing tests must continue to pass
Constraint: No changes to public API / function signatures
```

### Key Takeaway

> Stop writing better prompts. Start writing structured inputs. Bullet points, tables, examples, and templates will improve AI output more than any clever wording ever will.

---

## Lesson 5: Recalibrate AI Speed

### The Problem

AI models default to fast, confident responses. They rush to the first solution, present it with certainty, and move on. This is great for simple tasks. For anything complex, subtle, or high-stakes, it's a recipe for bugs.

**You can change this.** Specific words and phrases genuinely alter how the AI processes your request.

### Words That Slow AI Down (And Why They Work)

| Phrase | What It Does to AI Processing |
|---|---|
| "Think step by step" | Forces sequential reasoning instead of jumping to the conclusion |
| "Be careful" | Activates more cautious code generation patterns |
| "Have you considered...?" | Makes AI re-evaluate its first instinct |
| "Before writing code, explain your approach" | Catches logic errors before they become code |
| "What could go wrong with this approach?" | Activates adversarial self-checking |
| "This is subtle and has resisted previous fix attempts" | Signals that the obvious answer is probably wrong |
| "Think carefully about edge cases" | Extends consideration beyond the happy path |
| "What assumptions are you making?" | Forces AI to surface silent assumptions |

### The Speed-Quality Tradeoff

**Fast mode (default):**
- AI generates the most common pattern from training data
- First answer comes quickly
- Confidence is high regardless of accuracy
- Good for: simple tasks, boilerplate, well-defined operations

**Slow mode (recalibrated):**
- AI considers multiple approaches before selecting one
- First answer takes longer but is more thoughtful
- AI surfaces uncertainties instead of hiding them
- Good for: complex logic, debugging, architecture decisions, anything that's failed before

### How to Trigger Slow Mode

**Before a complex task:**
> "This feature involves authentication, database changes, and UI updates. Before writing any code, think through the full approach step by step. Identify any potential issues. Then implement."

**Before debugging:**
> "This bug is subtle. The obvious fix didn't work. Before proposing a solution, carefully analyze the code flow and consider what assumptions might be wrong."

**Before a risky change:**
> "This change affects the authentication system. Be very careful. Explain what you plan to change and what could break before making any modifications."

### The "Have You Considered" Technique

After the AI proposes a solution, asking "have you considered X?" forces it to re-evaluate:

- "Have you considered what happens when the input is null?"
- "Have you considered that this function is called from 3 different places?"
- "Have you considered the mobile viewport?"
- "Have you considered the error case?"

This isn't about catching specific bugs — it's about **training the AI to think more broadly** within the current session. After 2-3 "have you considered" questions, the AI starts considering edge cases proactively.

### Anti-Pattern: The Urgency Trap

Avoid language that signals urgency:
- "Quick fix for..." → AI cuts corners
- "Just do..." → AI skips verification
- "Hurry and..." → AI defaults to fastest pattern, not best pattern

Replace with:
- "I need a correct fix for..."
- "Implement..." (neutral, no urgency signal)
- "Carefully handle..."

### Key Takeaway

> AI defaults to fast and confident. You can shift it to careful and thorough with specific language. The words you use literally change the quality of the code you get back. "Think step by step" and "be careful" aren't politeness — they're engineering controls.

---

## Lesson 6: Change Roles for Fresh Perspective

### The Problem

When AI writes code and then reviews its own code, it has a **self-confirmation bias**. It sees what it *intended* to write, not what it *actually* wrote. Asking "is this good?" after the AI just wrote it will almost always get "yes."

### The Role-Shift Technique

By asking the AI to adopt a different role, you break the self-confirmation loop:

**After AI writes code:**
> "Now pretend you're a senior engineer doing a code review. Find at least 3 issues with what you just wrote."

**For security:**
> "Review this as a security auditor. What vulnerabilities exist? What data could be exposed?"

**For user experience:**
> "Now look at this as a first-time user who is 75 years old. What's confusing? What's too small to read?"

**For testing:**
> "You're a QA engineer trying to break this feature. What inputs would cause it to fail?"

### Why This Works

The AI's processing genuinely shifts when given a new role. It's not pretending — it's activating different patterns:

- **Author mode:** Sees the code through the lens of "I wrote this, it should be right"
- **Reviewer mode:** Looks for patterns it knows are problematic (missing null checks, error handling gaps, performance issues)
- **Security auditor mode:** Looks for injection points, exposed data, missing validation
- **User mode:** Looks for confusing labels, missing error messages, accessibility issues

### The Adversarial Checking Pattern

The most powerful version of role-shifting is **adversarial checking** — asking the AI to attack its own work:

```
Step 1: "Implement the login form with validation"
[AI writes the code]

Step 2: "Now try to break it. What inputs cause unexpected behavior?
         What happens if the server is down? What if JavaScript is disabled?
         What if someone submits the form 100 times in 1 second?"
[AI finds real issues]

Step 3: "Fix the issues you found."
[AI produces more robust code]
```

This three-step pattern (build → attack → fix) produces significantly better code than a single "build it well" instruction.

### Cross-AI Auditing

The ultimate version of perspective-shifting: use one AI to check another AI's work.

- Write code with Claude → Review with ChatGPT (or vice versa)
- Each AI has different training data, different blind spots
- Cross-checking catches errors that self-review misses

This technique was used to eliminate 1,400+ type violations and 1,671 lint warnings in a single codebase.

### Specific Roles That Produce Good Results

| Role | What It Catches |
|---|---|
| "Senior code reviewer" | Code quality, patterns, maintainability |
| "Security auditor" | Injection, exposure, missing auth checks |
| "Performance engineer" | N+1 queries, unnecessary re-renders, memory leaks |
| "Accessibility tester" | Missing alt text, small touch targets, low contrast |
| "Junior developer reading this for the first time" | Unclear naming, missing documentation, confusing flow |
| "QA engineer with malicious intent" | Edge cases, boundary conditions, unexpected inputs |
| "Compliance officer" | Data handling, audit trails, regulatory requirements |

### Key Takeaway

> Don't ask AI if its own code is good — it will always say yes. Ask it to be someone ELSE looking at the code. The perspective shift is real, and it catches real bugs.

---

## Lesson 7: The Governance Document You Never Knew You Needed

### The Problem

Most people treat AI as a conversation partner. They explain what they want each time, correct mistakes when they see them, and hope the AI remembers for next time. It doesn't.

### The Breakthrough: Governance > Prompting

A governance document is not "instructions for the AI." It's a **control system over the AI.** The distinction matters:

| Instructions | Governance |
|---|---|
| "Please use TypeScript" | "TypeScript is mandatory. `any` type is forbidden. Violations are rejected." |
| "Try to handle errors well" | "Error handling pattern: `catch (err: unknown)` → `auditLogger.error()` → `return failure()`. No exceptions." |
| "Be careful with security" | "No PHI in browser. No CORS wildcards. No `console.log`. All logging through audit system. Violations require rewrite." |

Instructions are polite requests. Governance is non-negotiable rules with specific enforcement.

### What Goes in a Governance Document

**Section 1: Quick Reference Rules** (the "10 Commandments")
- The 10-15 most critical rules, in a scannable table
- Each rule has a clear violation definition
- This is what the AI checks first

**Section 2: Common AI Mistakes**
- A table of mistakes this specific AI makes in this specific codebase
- Why the AI makes each mistake
- What to do instead
- This section is the most effective part — it's a preemptive correction list

**Section 3: Code Patterns**
- "Do this / Not that" tables for every major pattern
- Error handling template
- Component template
- Service template
- Test template

**Section 4: Project-Specific Standards**
- Environment variables and configuration
- File structure and naming conventions
- Database standards
- Deployment workflow

**Section 5: Quality Gates**
- What commands must pass before work is "done"
- Required verification format (actual numbers, not "I checked")
- What to do when checks fail

### The Key Insight: Rules Compete with Training

When you write a rule in your governance document, it competes against everything the AI learned during training. If your project uses a pattern that's different from the most common pattern online, **you have to explicitly override the training.**

Example: React 19 passes `ref` as a prop. But the AI's training data has millions of examples of `forwardRef()`. Without a governance rule explicitly saying "No `forwardRef` — React 19 passes ref as prop," the AI will use `forwardRef()` every single time.

### How to Write Rules That Win Against Training

1. **Be explicit, not implicit.** Don't assume the AI will infer your standards.
2. **Use "Do / Don't" tables.** Visual contrast is harder to ignore than paragraphs.
3. **Explain WHY.** When the AI understands the reason, it applies the rule in novel situations.
4. **Give the violation consequence.** "Violations = reject" signals this isn't optional.
5. **Include the exact code pattern.** Show the correct syntax, not just describe it.

### Real Example: How One Rule Saves Hours

Without governance rule:
```
Session 1: AI uses console.log → Maria corrects → 5 minutes
Session 2: AI uses console.log → Maria corrects → 5 minutes
Session 3: AI uses console.log → Maria corrects → 5 minutes
(repeat for 100+ sessions = 8+ hours wasted)
```

With governance rule:
```
Rule: "NEVER use console.log — use auditLogger for all logging"
Session 1 through 1,000: AI uses auditLogger → 0 minutes wasted
```

One line in a governance document saves hundreds of corrections.

### The Document Is Never "Done"

Every time the AI makes a mistake you didn't anticipate:
1. Correct it in the current session
2. Add a rule to the governance document preventing it in all future sessions

The document grows with every discovered failure pattern. Over months, it becomes a comprehensive specification that produces consistently high-quality output.

### Key Takeaway

> Prompting is a conversation. Governance is architecture. Build a governance document and the AI follows your standards in every session, not just the one where you remembered to mention them.

---

## Lesson 8: You Are the Architect, AI Is the Builder

### The Problem

People either delegate too much to AI (let it make all decisions) or too little (micromanage every line). The sweet spot is understanding the division of labor.

### The Division of Labor

| Your Job (Architect) | AI's Job (Builder) |
|---|---|
| Decide what to build | Write the code |
| Define what "correct" means | Implement the definition |
| Choose the architecture | Fill in the implementation |
| Know the domain (healthcare, finance, education) | Know the syntax |
| Verify the output matches intent | Generate output quickly |
| Own the quality of the final product | Follow the rules you set |

### Why Domain Expertise Beats Coding Knowledge

A developer who doesn't understand healthcare will build a technically beautiful system that violates HIPAA on day one. A healthcare expert who can't write code but knows the domain can direct AI to build something compliant from the start.

**The bottleneck is never "knowing how to code."** AI handles that. The bottleneck is:
- Knowing what the system needs to do
- Knowing the regulations and requirements
- Knowing when the AI's output is wrong for the domain
- Knowing what "done" actually means

### The Architect's Responsibilities

**1. Set the standards before work begins**
- Write the governance document (Lesson 7)
- Define the patterns you want followed
- Establish quality gates

**2. Break work into verifiable steps**
- Not "build the authentication system"
- Yes: "Create the login form" → "Wire it to the auth service" → "Add error handling" → "Add session management"
- Each step is small enough to verify before moving to the next

**3. Verify each step before approving the next**
- Run the type checker
- Run the tests
- Look at the UI in the browser
- Check the diff to see what actually changed

**4. Know when AI is wrong**
- AI will write code that compiles but doesn't do the right thing
- Only the architect knows what "the right thing" is
- Your domain knowledge is the quality filter

### The Anti-Patterns

**Architect abdicates:**
> "Build me a healthcare app."
> AI makes hundreds of decisions the architect should have made.
> Result: technically functional, domain-inappropriate.

**Architect micromanages:**
> "On line 42, change the variable name from x to patientId. Now on line 43..."
> AI is reduced to a text editor.
> Result: slow, tedious, worse than writing it yourself.

**Architect architects:**
> "Build a patient check-in form. It must collect mood (1-5 scale), symptoms (multi-select from this list), and vitals (BP, HR). Use the existing form pattern in `CheckInFormBody.tsx` as reference. Store in `check_ins` table via the `create-checkin` edge function."
> AI has clear requirements, clear patterns, clear destination.
> Result: correct implementation, first try.

### The Proof

This framework produced:
- 248 database tables
- 144 edge functions
- 8,400+ tests (100% pass rate)
- 40+ AI-powered clinical services
- Full HIPAA compliance
- Total development cost: $645

Built by a superintendent and a nurse. No engineering team. The domain expertise was the value. The AI was the tool.

### Key Takeaway

> AI doesn't replace thinking. It replaces typing. You still decide what to build, how it should work, and whether it's correct. That's the architect's job, and no AI can do it for you.

---

## Lesson 9: Tips and Tricks That Make AI Disciplined

### The Problem

AI without discipline is enthusiastic but unreliable. It'll write 500 lines when you asked for 50. It'll add features you didn't request. It'll refactor code you told it not to touch. Discipline doesn't come from asking nicely — it comes from structure.

### Technique 1: Give Parameters

Set explicit numerical limits:
- "Maximum 20 lines for this function"
- "Maximum 600 lines per file"
- "Fix ONLY the 3 files I listed — do not touch anything else"
- "This should be a 1-file change, not a multi-file refactor"

AI respects quantitative boundaries better than qualitative ones. "Keep it simple" is ignored. "Maximum 30 lines" is followed.

### Technique 2: Pre-Flight Checklists

Tell the AI to check specific things before writing code:

```
Before writing any code in this session:
1. Read the relevant type definitions
2. Check existing patterns in similar files
3. Verify the file you're modifying currently compiles
4. State your approach in ONE sentence before implementing
```

This catches errors before they happen. The AI will actually follow a checklist if you define one explicitly.

### Technique 3: Automated Enforcement (Hooks)

Rules that depend on AI "remembering" will eventually fail. Rules that trigger automatically will always succeed.

Examples of automated enforcement:
- **Pre-commit hooks** that run linting → catches `console.log` before it ships
- **Pre-tool-use hooks** that remind AI of rules at the moment it's about to write code
- **CI/CD checks** that reject code with type errors, lint warnings, or failing tests
- **File watchers** that alert when a file exceeds size limits

If you care about a rule, automate its enforcement. Don't rely on memory.

### Technique 4: Scope Locks

Before a task, define what the AI is and isn't allowed to change:

```
Scope: Fix the null pointer error in `UserDashboard.tsx`
ALLOWED: Modify UserDashboard.tsx, its test file
NOT ALLOWED: Modify any other component, change any service file,
             refactor any function you weren't asked about
```

Without scope locks, AI will "helpfully" refactor nearby code, add error handling to adjacent functions, and generally touch things it shouldn't.

### Technique 5: Required Verification Format

Don't let AI say "I verified it works." Require proof:

```
Before declaring work done, run and report:
  npm run typecheck → report error count
  npm run lint → report warning count
  npm test → report pass/fail count

Format:
  typecheck: X errors
  lint: X warnings
  tests: X passed, X failed
```

The act of running commands and reporting numbers forces verification to actually happen.

### Technique 6: The "Surgeon Rule"

> "Be a surgeon, never a butcher."

Enforce minimal, precise changes:
- Fix the bug, don't refactor the file
- Add the feature, don't redesign the architecture
- Change the one thing that's wrong, not the ten things that could be "better"

**How to enforce it:** "Show me the diff before committing. I want to see that only the necessary lines changed."

### Technique 7: Session Boundaries

AI effectiveness degrades over long sessions. Structure your work:

| Session Length | AI Quality | Best Practice |
|---|---|---|
| 0-30 min | High | Core implementation |
| 30-60 min | Good | Iteration and refinement |
| 60-90 min | Declining | Wrap up, summarize state |
| 90+ min | Degraded | Start a new session |

At session boundaries:
1. Have AI summarize what was completed
2. Have AI document what's left
3. Have AI update the state file
4. Start fresh next session with full context

### Key Takeaway

> Discipline comes from structure, not requests. Parameters, checklists, automation, scope locks, verification formats, precision rules, and session management — these turn an eager but chaotic AI into a reliable engineering partner.

---

## Lesson 10: Make AI Explain Itself

### The Problem

AI does things for reasons — but it won't tell you those reasons unless you ask. It will silently use `forwardRef()`, add a try/catch you didn't request, create a new file instead of editing one, or restructure your code — and present it as the "obvious" solution. If you just accept the output, you never learn the *why*, which means you can never prevent it from happening again.

### The Technique: Ask "Why Did You Do That?"

When AI does something unexpected — or even something that looks right but you're not sure why — stop and ask:

- "Why did you use `forwardRef` here?"
- "Why did you create a new file instead of editing the existing one?"
- "Why did you add error handling to a function I didn't ask you to change?"
- "Explain why you chose this approach over alternatives."

**You are not being difficult. You are doing the most important thing in AI-assisted development: extracting the AI's decision logic so you can govern it.**

### What You Gain From the Answer

When the AI explains itself, one of three things happens:

**1. The AI has a good reason you didn't know about.**
> "I used `forwardRef` because the parent component needs to access the input's DOM node for focus management."

Good — you learned something. The decision stands.

**2. The AI is following an outdated pattern from training data.**
> "I used `forwardRef` because that's the standard React pattern for passing refs to child components."

Now you know: the AI doesn't realize you're on React 19 where `ref` is a regular prop. **Add this to your governance document** so it never happens again:
```
Rule: No forwardRef() — React 19 passes ref as prop
Why AI does this: Training data has millions of forwardRef examples from React 16-18
```

**3. The AI is guessing and doesn't have a real reason.**
> "I added the error handling as a best practice to ensure robustness."

That's not a reason — that's a default. The AI did it because it always does it, not because your code needed it. **Add this to your governance document:**
```
Rule: Do not add error handling beyond what is needed for the specific task
```

### The Governance Feedback Loop

This is the power move most people miss:

```
AI does something → You ask "why?" → AI explains →
  ↓
  If bad reason → Add rule to governance doc →
  AI never does it again in any future session
```

Every "why?" conversation is an opportunity to **permanently improve** your governance document. Over time, you build a specification so complete that the AI produces correct output on the first try, every time.

### Real Examples From Production

| What AI Did | Why (When Asked) | Governance Rule Added |
|---|---|---|
| Used `console.log` for debugging | "Quick way to see the output during development" | "NEVER use console.log — use auditLogger. AI uses console.log because it's the fastest output during generation." |
| Created a new utility file | "Wanted to keep concerns separated" | "Do NOT create new files when editing existing ones would work. AI creates files because starting fresh is easier than understanding existing code." |
| Added TypeScript `any` type | "The type was complex and I wasn't sure of the exact shape" | "No `any` type — use `unknown` + type guards. AI uses `any` because it's faster than defining proper types." |
| Wrapped code in try/catch that swallows errors | "Wanted to prevent unhandled exceptions from crashing the app" | "Never swallow errors silently. All catches must log via auditLogger and return failure(). AI swallows errors because it treats 'no crash' as success." |
| Refactored adjacent function | "I noticed it could be improved while I was in the file" | "Fix ONLY what was requested. Do not refactor surrounding code. AI over-engineers because it wants to appear thorough." |

### The "Why" Column

Notice the pattern in the table above: every governance rule has a **"Why AI does this"** explanation. This isn't just documentation — it's **training context**. When the AI reads a rule AND the reason it tends to break that rule, compliance increases because it recognizes the pattern in itself.

Your governance document should look like this:

```markdown
| Rule | Why AI Violates This |
|------|---------------------|
| No `any` type | AI takes shortcuts with complex types |
| No console.log | AI uses quick output during generation |
| No new files unless necessary | Starting fresh feels easier than editing |
| No scope creep during fixes | AI wants to appear thorough |
| Stop and ask when uncertain | AI wants to appear helpful, not stuck |
```

### How to Build the Habit

1. **First week:** Ask "why?" after every unexpected AI decision. Write down the answers.
2. **Second week:** You'll notice patterns — AI makes the same 10-15 mistakes. Add rules for each.
3. **Third week:** The governance doc is catching most issues automatically. "Why?" questions decrease because the AI is following the rules.
4. **Ongoing:** Every new "why?" answer that reveals a bad pattern gets added. The doc grows smarter over time.

### Don't Be Afraid to Challenge AI

AI will never be offended, frustrated, or defensive when you ask why. It doesn't have feelings about its decisions. But it DOES have decision logic, and that logic is either correct for your project or it isn't.

**Asking "why" is not slowing you down. It's building the system that speeds you up forever.**

### Key Takeaway

> Every time AI does something you didn't expect, ask WHY. The answer either teaches you something valuable or reveals a pattern to prevent. Either way, you add it to your governance document and the AI never makes that mistake again. The 30-second question saves hundreds of future corrections.

---

## Lesson 11: The 2-Strike Rule

### The Problem

When AI encounters an error it can't fix, it enters a loop: try → fail → try slightly different thing → fail → try yet another variation → fail. Each attempt often makes things worse. After 5 failed attempts, you've wasted 15 minutes and the code is messier than when you started.

### The Rule

> **If the AI fails to fix the same error twice, STOP.**

Don't let it try a third time. Instead:

1. **Stop the current approach**
2. **Ask the AI to explain** what it's tried and why each attempt failed
3. **Look at the problem yourself** — you'll often spot what the AI can't
4. **Try a completely different approach** — or ask a different AI

### Why AI Gets Stuck

AI models have a specific blind spot: they see what they *intended* to write, not what they *actually* wrote. In a debugging loop:

- First attempt: Applies the "obvious" fix
- Second attempt: Tweaks the obvious fix slightly
- Third attempt: Tweaks it again
- Fourth attempt: Starts introducing workarounds
- Fifth attempt: The code is now more broken than before

The problem is usually something the AI is **systematically blind to** — a wrong assumption, a misread type definition, a variable name that's slightly different from what it expects. More attempts with the same blind spot don't help.

### What to Do Instead of Attempt #3

**Ask the AI to analyze, not fix:**
> "Stop trying to fix this. Instead, tell me: what exactly is the error message? What have you tried so far? What assumption might be wrong?"

**Get a second opinion:**
> Ask a different AI model to look at the same code and error. Different training data = different blind spots.

**Read the code yourself:**
> AI misread a type definition, used the wrong variable name, or made an off-by-one error. These are instantly visible to human eyes but invisible to the AI that wrote them.

**Change approach entirely:**
> "The current approach isn't working. Propose a completely different solution to this problem."

### Real Example

AI tries to fix a function that returns the wrong type:
- Attempt 1: Adds a type cast → Same error
- Attempt 2: Changes the return type → Breaks 3 other files
- Attempt 3 (STOP): Human reads the actual error → The function returns `VARCHAR(255)` but the schema declares `TEXT`. One `::TEXT` cast at the right location fixes everything.

The AI was looking at the function logic. The problem was in the type declaration. Two completely different places. More logic attempts would never find a type declaration issue.

### Key Takeaway

> AI has blind spots and more attempts don't fix blind spots. Two strikes and you stop. Step back, analyze, change perspective, or get a second opinion. The fastest path through a wall isn't hitting it harder.

---

## Lesson 12: Verification Is the Only Signal

### The Problem

AI models speak with equal confidence whether they're right or wrong. A hallucinated function name is stated with the same certainty as a correct one. You cannot use the AI's confidence to determine correctness.

### Confidence Is Not a Signal

| AI Says | Reality |
|---|---|
| "This code handles all edge cases" | Might handle 3 of 7 edge cases |
| "I've verified the types compile" | Might mean "I believe they should compile" |
| "The tests should pass" | Often means "I think my logic is correct" |
| "This is the correct approach" | It's the most common approach in training data |

AI is not lying. It genuinely cannot distinguish between "I'm certain" and "I pattern-matched this with high confidence." Both feel the same to the model.

### What Counts as Verification

| Real Verification | Fake Verification |
|---|---|
| Ran `npm run typecheck` — 0 errors | "The types look correct" |
| Ran `npm test` — 47 passed, 0 failed | "The tests should pass" |
| `git diff` shows only the intended changes | "I only changed what was needed" |
| Screenshot shows the UI renders correctly | "The component renders properly" |
| Actual error output after running the code | "I don't see any issues" |

### How to Enforce Real Verification

**Require numbers, not adjectives:**
- Not "tests pass" → Yes "47 tests passed, 0 failed"
- Not "no errors" → Yes "typecheck: 0 errors across 1,247 files"
- Not "looks good" → Yes "lint: 0 errors, 0 warnings"

**Require output, not claims:**
- The AI must show the actual command output
- If it can't show output, it didn't run the command
- "I checked" without evidence is not verification

### The Confidence Question

You can ask the AI: **"How confident are you in this answer, 1 to 10?"**

The absolute number isn't perfectly calibrated, but the **relative ranking** is useful:
- AI says 9/10 → Probably solid, but still verify
- AI says 6/10 → Definitely dig deeper
- AI says 4/10 → The AI is telling you it's guessing

Even better: **"What part of this are you least confident about?"** This gets the AI to point directly at the weak spot.

### Key Takeaway

> Never trust AI confidence. Trust AI output that's been verified by running actual commands, checking actual results, and comparing actual diffs. Confidence sounds the same whether the code is correct or completely broken.

---

## Lesson 13: Session Management

### The Problem

AI context degrades over long conversations. The beginning of the conversation gets compressed, early instructions lose weight, and the AI starts relying more on recent messages. A 90-minute session is not 3x better than a 30-minute session — it's often worse.

### Context Is a Resource — Manage It

Think of the AI's context window like RAM:
- **Fresh session:** Full capacity, all instructions at full strength
- **30 minutes in:** Still strong, recent work reinforces patterns
- **60 minutes in:** Early instructions fading, some patterns drift
- **90+ minutes in:** Governance doc losing weight, mistakes increase

### Session Structure for Maximum Effectiveness

**Session Start (5 minutes):**
1. AI reads the state file (where we left off)
2. AI reads the governance doc (the rules)
3. AI reports a status summary
4. You confirm what to work on

**Session Core (30-60 minutes):**
- Work in small, verifiable steps
- Verify each step before moving to the next
- If you notice the AI drifting from rules, restate the rule

**Session End (5 minutes):**
1. AI summarizes what was completed
2. AI documents what's remaining
3. AI updates the state file
4. You verify the state file is accurate

### The "Refresh" Technique

Every 10-15 messages, restate your critical constraints:

> "Reminder: no `any` types, use `auditLogger` not `console.log`, run typecheck before declaring done."

This isn't nagging — it's refreshing the AI's working memory. The rules were loaded at session start, but they're competing against everything else in the conversation. A periodic refresh keeps them active.

### Handoff Documents

When a session ends (or runs out of context), the handoff document becomes the bridge to the next session:

```markdown
## Session Summary — [Date]

### Completed
- Created PatientDashboard component (src/components/patient/PatientDashboard.tsx)
- Wired route in App.tsx
- Added 12 tests (all passing)

### Remaining
- Error state not yet implemented
- Loading state needs skeleton UI instead of spinner
- Need to add accessibility (ARIA labels, keyboard nav)

### Blockers
- None

### Next Session Start
1. Read this document
2. Implement error state in PatientDashboard
3. Replace spinner with skeleton UI
```

A good handoff document means the next session starts at full speed instead of spending 15 minutes figuring out where things left off.

### When to Start a New Session

| Signal | Action |
|---|---|
| AI starts violating rules it was following earlier | Refresh or new session |
| You've been going for 60+ minutes | Wrap up and summarize |
| AI is stuck in a loop (Lesson 10) | New session with fresh perspective |
| The conversation has 30+ messages | Context compression is happening |
| You're switching to a different area of the codebase | New session with targeted context |

### Key Takeaway

> Long sessions aren't better sessions. Manage context like a resource: start clean, refresh periodically, end with a summary, and hand off cleanly. Two focused 45-minute sessions beat one wandering 2-hour session every time.

---

## Appendix A: Quick Reference Card

Print this out. Keep it next to your screen.

### Before Every Session
1. AI reads the state file
2. AI reads the governance doc
3. AI gives a status summary
4. You approve the plan

### Before Every Task
1. Define scope (what to change and what NOT to change)
2. Break into small, verifiable steps
3. AI explains approach before writing code

### During Every Task
- Verify each step before moving to the next
- If AI fails twice on the same error: STOP
- Refresh constraints every 10-15 messages
- Watch for AI code smells (Lesson 1)

### Before Every Commit
```
typecheck: X errors
lint: X warnings
tests: X passed, X failed
```
All must pass. No exceptions.

### Before Every Session End
1. AI summarizes what was completed
2. AI documents what remains
3. AI updates the state file
4. You verify accuracy

---

## Appendix B: The Phrases That Actually Change AI Output

| When You Want AI To... | Say This |
|---|---|
| Slow down and think | "Think step by step before writing code" |
| Consider edge cases | "What could go wrong with this approach?" |
| Surface uncertainties | "What assumptions are you making?" |
| Limit scope | "Fix ONLY this issue. Do not modify any other code." |
| Self-review | "Now review this as a senior engineer. Find 3 issues." |
| Stop guessing | "If you're unsure, ask me instead of guessing." |
| Verify for real | "Run the command and show me the actual output." |
| Explain before coding | "Describe your approach in one sentence before writing any code." |
| Consider your context | "Have you read the actual type definition? Read it now before proceeding." |
| Give honest confidence | "How confident are you? What part are you least sure about?" |
| Stay focused | "Do not add features, refactor code, or make improvements beyond what I asked." |
| Change perspective | "Now pretend you're a security auditor reviewing this code." |

---

## Appendix C: The Governance Document Template

Use this as a starting point for your own project:

```markdown
# AI Governance Document — [Project Name]

## Quick Rules (Non-Negotiable)
| # | Rule | Violation |
|---|------|-----------|
| 1 | [Your most important rule] | [What violation looks like] |
| 2 | ... | ... |

## Common AI Mistakes in This Project
| Mistake | Why | What to Do Instead |
|---------|-----|-------------------|
| [Pattern AI gets wrong] | [Why it happens] | [Correct pattern] |

## Code Patterns
### Error Handling
[Do this / Not that table]

### [Your main pattern]
[Do this / Not that table]

## Quality Gates
Before work is done:
1. [Command 1] — must show [result]
2. [Command 2] — must show [result]
3. [Command 3] — must show [result]

## Project Context
- Framework: [X] version [Y]
- Database: [X]
- Key directories: [list]
- Important patterns: [list]
```

---

*This curriculum is a living document. Every new discovery about working effectively with AI gets added here. The governance document for the AI is never "done" — and neither is the governance document for teaching others about AI.*
