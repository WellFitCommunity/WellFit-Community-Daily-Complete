# Building With AI: The Class They Don't Teach

## 6-Week Lesson Plans — Instructor Guide

> **Instructor:** Maria Torres, AI System Director — Envision Virtual Edge Group LLC
> **Format:** Live workshop (in-person or Zoom), 90 minutes per session
> **Class Size:** 15 developers (selected cohort)
> **Price Point:** $2,000 per seat
> **Prerequisite:** Students must already write code (any language). This class teaches them how to use AI as an engineering partner, not how to code.

---

## Course Arc

| Week | Theme | What They Walk Away With |
|------|-------|--------------------------|
| 1 | Why Your AI Code Sucks | Understanding the 15 failure patterns AI makes and why |
| 2 | Stop Prompting, Start Structuring | Replacing clever prompts with structured inputs and constraints |
| 3 | Trust Nothing, Verify Everything | Quality control system: verification, the 2-strike rule, making AI explain itself |
| 4 | The Governance Revolution | Building the control document that replaces prompt engineering forever |
| 5 | Advanced Techniques | Role-shifting, speed recalibration, adversarial checking, cross-AI auditing |
| 6 | The Complete System | Memory, session management, discipline, and putting it all together |

---

## Session Format (Every Week)

| Time | Block | Purpose |
|------|-------|---------|
| 0:00 - 0:10 | Intro / Icebreaker | Set the tone, connect the group |
| 0:10 - 0:30 | Pain Points Discussion | Homework review (week 2+) + new concept teaching |
| 0:30 - 0:50 | Exercise / Application | Hands-on practice with the technique |
| 0:50 - 1:10 | Q&A / Group Discussion | Students share results, troubleshoot, debate |
| 1:10 - 1:15 | Homework Assignment | One technique to try on their real project this week |
| 1:15 - 1:20 | Wrap-Up | Key takeaway, preview next week |

---

## Pre-Course Setup (Send 1 Week Before Class Starts)

### Welcome Email to Students

```
Subject: Building With AI — Pre-Course Setup

Welcome to the cohort. Before Week 1, please:

1. PICK YOUR PROJECT
   Choose a real project you're actively building (or starting).
   Every exercise and homework will use YOUR codebase, not toy examples.
   This class is practical — you'll leave with real improvements to real code.

2. SET UP YOUR AI TOOL
   Have at least one AI coding assistant ready to use:
   - Claude Code (CLI) — recommended
   - Cursor
   - GitHub Copilot
   - ChatGPT with code interpreter
   - Any AI coding tool you currently use

3. SCREENSHOT YOUR WORST AI MOMENT
   Find one example where AI gave you code that was wrong, broken,
   or caused you to waste time. Screenshot or copy it. We'll use
   these in Week 1.

4. TRACK YOUR AI TIME THIS WEEK
   Before the class teaches you anything, use AI normally for one
   week. Note: How many times did you have to correct it? How many
   times did you accept code without checking it? How much time did
   you spend debugging AI-generated code?

See you in class.
— Maria
```

---

# WEEK 1: Why Your AI Code Sucks

**Theme:** Understanding the predictable failure patterns so you stop being surprised by them.

**Lessons Covered:** Lesson 1 (AI Frequent Mistakes), Lesson 8 (You Are the Architect, AI Is the Builder)

**Materials Needed:**
- Projector/screen share
- Students need their AI tool + a project open
- Whiteboard or shared doc for collecting patterns

---

### 0:00 - 0:10 | Intro / Icebreaker

**Instructor opens with:**

> "Welcome. This is not a prompt engineering class. If you came here to learn magic words that make AI write perfect code — wrong class. You're here to learn how to build a system that makes AI consistently produce what you need. That's harder. It's also worth $100,000 more to your career."

**Icebreaker — "Your Worst AI Moment"**

Go around the room (or Zoom). Each person shares their screenshot/story from the pre-work:
- What did you ask the AI to do?
- What did it actually do?
- How long did it take you to fix it?

*Instructor tip: Write each failure on the whiteboard as they share. You'll categorize them later.*

**Key framing statement:**

> "Every one of these failures was predictable. AI makes the same 15 categories of mistakes, every time, in every codebase. By the end of today, you'll recognize all of them."

---

### 0:10 - 0:30 | Pain Points Discussion — "The Failure Taxonomy"

**Teach: The 15 Predictable AI Mistakes**

Walk through the failure table from Lesson 1. For each one, ask: "Did anyone experience this one?" Connect their icebreaker stories to the categories.

**The 15 Patterns (present on slides or shared screen):**

| # | AI Mistake | One-Line Explanation |
|---|---|---|
| 1 | Legacy API patterns | Uses old framework syntax because training data has more old code |
| 2 | Deprecated functions | Calls functions that worked 2 versions ago |
| 3 | Sloppy error handling | `catch (e) { console.log(e) }` — swallows errors silently |
| 4 | Creates files instead of editing | Starting fresh is easier than understanding your code |
| 5 | "Temporary" workarounds | "For now" becomes forever |
| 6 | Deletes code it thinks is unused | AI has cleanup instinct without full context |
| 7 | Tests that test nothing | Passes for an empty div — tests the framework, not your code |
| 8 | Over-engineering | Asked for a button, got a design system |
| 9 | Leftover imports/variables | Forgets to clean up after refactoring |
| 10 | Hardcoded values | Config in code instead of environment variables |
| 11 | Invents file paths | "Remembers" paths from training data that don't exist in your project |
| 12 | Skims instead of reads | Assumes what a type/function looks like without actually reading it |
| 13 | Sees intent, not reality | "I verified" means "I intended to verify" |
| 14 | First answer bias | Gives the most common pattern, not the best one for your project |
| 15 | Confident when wrong | States hallucinated function names with the same certainty as correct ones |

**Key teaching moment — "The Skim vs. Ingest Problem":**

> "Pattern #12 is the one that will cost you the most time. AI doesn't read your code the way you do. It skims it looking for what it expects to find. If your type is called `ServiceError` but AI expects `Error`, it'll write code using `Error` and wonder why it breaks. This is not a bug — it's how pattern matching works. The fix is forcing AI to read definitions before writing code that depends on them."

**Transition to Lesson 8 — The Mindset:**

> "Now here's the uncomfortable truth. Every one of these mistakes is the AI's fault. But catching them is YOUR job. Because..."

**The Architect/Builder Framework:**

| Your Job (Architect) | AI's Job (Builder) |
|---|---|
| Decide what to build | Write the code |
| Define what "correct" means | Implement the definition |
| Know the domain | Know the syntax |
| Verify the output | Generate output quickly |
| Own the quality | Follow the rules you set |

> "AI doesn't replace thinking. It replaces typing. If you delegate the thinking, you get a beautiful building on the wrong foundation. The architect decides. The builder builds."

---

### 0:30 - 0:50 | Exercise — "Catch the Mistakes"

**Live exercise — do this together as a class:**

1. **Everyone opens their AI tool + their project**
2. **Give the AI a moderately complex task** (each student picks one from their own project — a function to write, a bug to fix, or a feature to add)
3. **Before accepting the output, identify:**
   - Which of the 15 patterns might be present?
   - Did the AI use your project's actual patterns or its training data patterns?
   - Did it create new files or edit existing ones?
   - Is the error handling real or sloppy?
   - Are there any hardcoded values?
   - If it wrote tests, do the tests pass the "Deletion Test"? (Would they fail if you replaced the component with an empty div?)

4. **Students score their AI output** — how many of the 15 patterns did they catch?

**Expected result:** Most students will find 2-5 issues they would have previously accepted without checking. This is the "oh no" moment that sells the rest of the course.

**Instructor circulates** (or monitors screen shares on Zoom), pointing out patterns students miss.

---

### 0:50 - 1:10 | Q&A / Group Discussion

**Discussion prompts:**

1. "How many of you found issues in code you would have accepted before today?" (show of hands — this validates the class)
2. "Which pattern surprised you the most?"
3. "How much time do you estimate you've lost to these patterns in the past month?"
4. "Who here has accepted AI code without running a single verification step?" (be gentle — most hands will go up)

**Anticipated questions and answers:**

*"Isn't catching all 15 patterns going to slow me down?"*
> "Yes, for about two weeks. Then it becomes automatic and you're faster than before — because you stop spending 30 minutes debugging code you could have caught in 30 seconds."

*"Doesn't the AI improve over time? Won't these patterns go away?"*
> "The models get better, but these patterns are structural. They come from how AI generates code — pattern matching against training data. Better models still pattern match. They just do it more subtly. You'll still need to verify."

*"Which AI tool has the fewest of these problems?"*
> "None of them. Different tools have different strengths, but all of them make these categories of mistakes. The fix isn't a better tool — it's a better system around the tool."

---

### 1:10 - 1:15 | Homework Assignment

**This Week's Assignment: The AI Failure Journal**

> "This week, every time you use AI for coding, keep a log. For each interaction, record:
>
> 1. What you asked AI to do
> 2. What it actually produced
> 3. Which of the 15 patterns were present (use the number)
> 4. How long it took you to catch/fix them
>
> Format: Simple spreadsheet or notes doc. One row per interaction.
>
> Next week, you'll bring your journal to class. We'll compare patterns — I guarantee you'll see the same 5-6 patterns dominating everyone's logs. That's the data that tells you where to focus."

**Template to share with students:**

```
| Date | Task | AI Output Quality (1-10) | Patterns Found (#) | Time to Fix | Notes |
|------|------|--------------------------|---------------------|-------------|-------|
| | | | | | |
```

---

### 1:15 - 1:20 | Wrap-Up

**Key takeaway (say this exactly):**

> "AI makes 15 predictable categories of mistakes. You learned all 15 today. From this moment forward, you have no excuse for accepting broken code — because now you know what to look for. Next week, we stop catching mistakes after the fact and start preventing them with how we communicate with AI."

**Preview Week 2:**

> "Next week is called 'Stop Prompting, Start Structuring.' We're going to completely change HOW you give instructions to AI. No more paragraphs of hope. Structured inputs, explicit constraints, and the most powerful technique in this entire course — telling AI what NOT to do."

---

# WEEK 2: Stop Prompting, Start Structuring

**Theme:** The words and format of your input literally change the quality of the output. Structure beats cleverness.

**Lessons Covered:** Lesson 3 (Don't Talk Dirty to AI), Lesson 4 (Not Better Prompts — Structured Inputs), Lesson 5 (Recalibrate AI Speed)

**Materials Needed:**
- Students bring their AI Failure Journal from Week 1
- Students need their AI tool + project open
- Shared doc for before/after examples

---

### 0:00 - 0:10 | Intro / Icebreaker

**Homework Review Opener:**

> "Welcome back. Let's start with your homework. Who found a pattern they saw 3 or more times in one week?"

Quick round — each student shares their top recurring pattern (by number) and one specific example. Write the pattern numbers on the board with tally marks.

**Expected result:** Patterns #1 (legacy APIs), #3 (sloppy errors), #8 (over-engineering), and #12 (skim vs ingest) will dominate. This validates the framework and builds group trust.

**Bridge to today's lesson:**

> "Last week we learned to recognize the problems. This week we learn to prevent them — not with better prompts, but with a completely different way of communicating with AI."

---

### 0:10 - 0:30 | Pain Points Discussion — "The Communication Problem"

**Teach: Three Techniques That Change AI Output**

**Technique 1: "Don't Talk Dirty" — Negative Constraints**

Show side-by-side:

| Dirty (Vague) | Clean (Specific) |
|---|---|
| "Write clean code" | "Do NOT add comments to code you didn't change. Do NOT refactor functions you weren't asked about." |
| "Handle errors properly" | "Do NOT use `catch (e: any)`. Do NOT swallow errors silently. Every catch must log and return an error result." |
| "Add tests" | "Add tests for: login success, invalid email, network error, empty form. Do NOT write tests that would pass for an empty div." |

**Key teaching moment:**

> "Notice what happened. I didn't tell the AI what 'clean code' means — I told it what 'dirty code' looks like. AI follows 'don't' instructions more reliably than 'do' instructions. 'Do' is open-ended — infinite ways to comply. 'Don't' is specific — clear pass/fail."

**Technique 2: Structured Inputs Beat Paragraphs**

Live demonstration — same request, two formats:

**Format A (what most developers write):**
> "Create a user profile component that shows the user's name and email and avatar and has a loading state and error state and uses our design system and has proper TypeScript types and includes tests for the main functionality"

**Format B (structured):**
```
Create a user profile component:
- Display: name, email, avatar
- States: loading (skeleton), error (retry button), success
- Design system: use [your project's component library]
- Types: define ProfileProps interface
- Tests required:
  - Renders user data correctly
  - Shows loading skeleton while fetching
  - Shows error message with retry on failure
  - Does NOT test: CSS classes, snapshot, "renders without crashing"
```

> "Same information. Format B gets followed correctly on the first attempt. Format A gets partially followed with gaps you discover 10 minutes later."

**Technique 3: Words That Slow AI Down**

> "AI defaults to fast and confident. You can literally change the quality by changing the speed."

| Say This | AI Does This |
|---|---|
| "Think step by step" | Forces sequential reasoning instead of jumping to conclusions |
| "Be careful — this is subtle" | Activates more cautious generation |
| "Before writing code, explain your approach" | Catches logic errors before they become code errors |
| "What could go wrong?" | Activates adversarial self-checking |
| "What assumptions are you making?" | Surfaces silent assumptions |

**The anti-pattern:**

> "Quick fix for..." / "Just do..." / "Hurry and..." — these words literally lower code quality. They signal urgency, and AI cuts corners when it senses urgency. Replace with neutral language: "Implement...", "Carefully handle...", "I need a correct fix for..."

---

### 0:30 - 0:50 | Exercise — "The Rewrite Challenge"

**Exercise structure:**

1. **Each student pulls up one request from their AI Failure Journal** — specifically one where the AI output was bad or required significant correction.

2. **Rewrite the request using all three techniques:**
   - Add "Do NOT" constraints (at least 3)
   - Convert from paragraph to structured format (bullets, tables)
   - Add a speed-control phrase ("think step by step", "be careful", etc.)

3. **Submit the rewritten request to their AI tool on the same task**

4. **Compare the outputs** — original request vs. rewritten request. Score both (1-10).

**Students share their before/after in the group chat or on screen.** Class votes on the most improved.

**Expected result:** Dramatic improvement. Most students will see a 3-5 point improvement in output quality from restructuring alone. This is the "aha" moment for Week 2.

**Instructor tip:** Look for students who add too many constraints (overspecification makes AI rigid). The balance is: constrain what matters, leave room for implementation details.

---

### 0:50 - 1:10 | Q&A / Group Discussion

**Discussion prompts:**

1. "How much did the output improve just from restructuring? Anyone see worse results?" (Discuss why — usually overspecification)
2. "Which technique had the biggest impact — the 'don'ts', the structure, or the speed control?"
3. "Has anyone tried telling AI to explain its approach before writing code? What happened?"

**Anticipated questions:**

*"Isn't all this structure more work than just fixing the code?"*
> "The first time, yes. But these structured inputs become templates. You rewrite them once, then reuse them for every similar task. The time investment is front-loaded."

*"Does 'think step by step' really work or is it placebo?"*
> "It genuinely changes processing. But it's not magic — it works best for complex logic, debugging, and architecture decisions. For simple 'add a button' tasks, it's unnecessary overhead."

*"How many 'do NOT' constraints is too many?"*
> "More than 5-7 per task becomes counterproductive. The AI spends more effort avoiding violations than actually building. Focus on the constraints that prevent YOUR most common issues."

---

### 1:10 - 1:15 | Homework Assignment

**This Week's Assignment: Build Your "Do NOT" List**

> "This week, you're going to write a reusable 'Do NOT' list for your project. Not for one task — for EVERY task.
>
> Based on your AI Failure Journal from Week 1, identify the top 5 mistakes AI makes repeatedly in your codebase. Write each one as a 'Do NOT' statement.
>
> Example from my project:
> ```
> 1. Do NOT use `any` type — use `unknown` + type guards
> 2. Do NOT use console.log — use our audit logger
> 3. Do NOT create new files when editing existing ones would work
> 4. Do NOT add features beyond what was requested
> 5. Do NOT use forwardRef — React 19 passes ref as prop
> ```
>
> Your list will be different because your project is different. But you'll have one.
>
> Next week, we're going to use these lists to build something much bigger."

---

### 1:15 - 1:20 | Wrap-Up

**Key takeaway:**

> "The AI industry is obsessed with 'better prompts.' You just proved that structured inputs with explicit constraints outperform clever prompts every time. Stop writing paragraphs of hope. Start writing structured specifications."

**Preview Week 3:**

> "Next week: 'Trust Nothing, Verify Everything.' You're going to learn how to catch AI when it lies to you — because it does, and it doesn't even know it's doing it. We'll also cover the most underrated technique in this course: making AI explain WHY it did something, and using that answer to prevent the mistake forever."

---

# WEEK 3: Trust Nothing, Verify Everything

**Theme:** AI confidence is not a signal. Only verification is a signal. Learn to verify, challenge, and extract decision logic.

**Lessons Covered:** Lesson 10 (Make AI Explain Itself), Lesson 11 (The 2-Strike Rule), Lesson 12 (Verification Is the Only Signal)

**Materials Needed:**
- Students bring their "Do NOT" list from Week 2 homework
- AI tool + project open
- Shared doc for collecting governance rules from the "Why?" exercise

---

### 0:00 - 0:10 | Intro / Icebreaker

**Homework Review Opener:**

> "Let's see your 'Do NOT' lists. Everyone share your top 3 in the chat."

Quick scan of the lists. Instructor highlights:
- Common patterns across the cohort (proof the failure taxonomy is universal)
- Project-specific patterns (unique constraints worth discussing)
- Any that are too vague ("Do NOT write bad code" — not actionable)

**Icebreaker — "The Lie Detector Test"**

> "I'm going to show you 5 statements an AI made about code it wrote. Raise your hand for each one you think is actually true."

Show these on screen:
1. "I've verified the types compile correctly." (FALSE — it didn't run the compiler)
2. "This handles all edge cases." (FALSE — it handles the happy path and one error)
3. "The existing tests will continue to pass." (PROBABLY FALSE — it didn't run them)
4. "I only changed the file you asked about." (CHECK THE DIFF — often false)
5. "This follows your project's existing patterns." (MAYBE — did it read the patterns or assume them?)

> "Here's the uncomfortable truth: you cannot tell from the AI's language whether it's certain or guessing. It uses the same confident tone for both. That's what today is about."

---

### 0:10 - 0:30 | Pain Points Discussion — "The Three Pillars of Trust Control"

**Pillar 1: Make AI Explain Itself**

> "This is the technique that will improve your governance document every single week for the rest of your career."

**The pattern:**
```
AI does something unexpected → You ask "WHY did you do that?" →
  → Good reason? You learned something. Keep it.
  → Bad reason (training data habit)? Add a rule. Prevent it forever.
  → No real reason (just a default)? Add a constraint. Prevent it forever.
```

**Live demonstration:**

Give AI a task in a live coding project. When it produces output, identify one decision it made silently and ask "Why?" out loud for the class.

Example exchange:
```
You: "Add error handling to this function"
AI: [wraps everything in try/catch with console.error]

You: "Why did you use console.error instead of our logging system?"
AI: "I used console.error as a quick way to surface errors during
     development."

You: "That's a training data habit, not a real reason. In this project,
     all logging goes through our audit system."
```

> "Now I add to my governance doc: 'Do NOT use console.error — use the audit logger. AI uses console methods because they're the fastest output during generation.' That question took 10 seconds. It prevents the mistake in every future session."

**Pillar 2: The 2-Strike Rule**

> "When AI fails to fix the same error twice — STOP. Do not let it try a third time."

Why:
- AI sees what it *intended* to write, not what it *actually* wrote
- More attempts with the same blind spot don't help
- After 2 failures, the fastest path is: stop, analyze, change approach

What to do instead:
- "Stop trying to fix this. Tell me what you've tried and what assumption might be wrong."
- Get a second opinion (different AI or your own eyes)
- Change the approach entirely

**Real example from production:**

> "I had an AI try to fix a database function 4 times. Each attempt changed the function logic. The actual problem? A type mismatch in the column declaration — VARCHAR(255) vs TEXT. The AI was looking at the code. The problem was in the schema. More code attempts would never find a schema issue. One step back, read the actual error message, fix applied in 30 seconds."

**Pillar 3: Verification Is the Only Signal**

| Real Verification | Fake Verification |
|---|---|
| Ran the compiler — 0 errors | "The types look correct" |
| Ran tests — 47 passed, 0 failed | "The tests should pass" |
| Checked the diff — only intended changes | "I only changed what was needed" |
| Saw the UI in a browser | "The component renders properly" |

**The required proof format:**
```
typecheck: X errors
lint: X warnings
tests: X passed, X failed
```

> "Numbers, not adjectives. If the AI can't give you numbers, it didn't actually verify."

---

### 0:30 - 0:50 | Exercise — "The Interrogation"

**This is the most important exercise in the entire course.**

1. **Each student gives their AI a task** (use their real project — a function, component, or bug fix)

2. **When AI returns the output, interrogate it:**
   - Pick 2-3 decisions the AI made silently
   - Ask "Why did you do that?" for each one
   - Classify each answer: Good reason / Training data habit / No real reason

3. **For every "training data habit" or "no real reason" answer:**
   - Write a governance rule that prevents it
   - Format: `"Do NOT [action] — [why AI does it]"`

4. **Share your new rules in the group chat**

5. **Run verification on the AI output:**
   - Run the compiler/type checker
   - Run tests (if applicable)
   - Check the diff
   - Report the numbers

**Expected result:** Each student will generate 2-4 new governance rules from this exercise. The class collectively will produce 30-60 rules. Many will overlap — proving these patterns are universal.

**Instructor collects all rules in a shared document.** This becomes a class resource.

---

### 0:50 - 1:10 | Q&A / Group Discussion

**Discussion prompts:**

1. "What was the most surprising answer when you asked 'why'?"
2. "Did anyone discover the AI had a GOOD reason they didn't know about?"
3. "How many of you found issues when you ran verification that the AI didn't mention?"
4. "Who had a 2-strike moment this week? What was the AI blind to?"

**Anticipated questions:**

*"Isn't asking 'why' after every decision going to slow me down?"*
> "Only for the first 2-3 weeks. You're building a governance document. Once a rule is in the document, you never have to ask that 'why' again — the AI follows the rule. Front-load the investment."

*"What if the AI gives a good reason every time?"*
> "Then your AI is well-calibrated for your project. That's rare but possible. More likely, you'll find 70% good reasons and 30% training data habits. The 30% is where your governance doc earns its keep."

*"How do I know if the AI is giving me a real reason or just making one up?"*
> "Test it. If the AI says 'I used forwardRef for focus management,' check — does the parent actually need focus management? AI will sometimes rationalize its default behavior. Challenge the explanation."

---

### 1:10 - 1:15 | Homework Assignment

**This Week's Assignment: The Verification Habit**

> "This week, every time you accept AI code, run three verification steps BEFORE accepting:
>
> 1. Run the compiler/type checker — record the error count
> 2. Check the diff — note any unexpected changes
> 3. Ask 'why?' for at least one AI decision per session
>
> Track your results:
>
> ```
> | Date | Task | Compiler Errors | Unexpected Diff Changes | 'Why?' Rule Generated |
> |------|------|-----------------|------------------------|-----------------------|
> ```
>
> Bring your 'Do NOT' list from Week 2 PLUS the new rules from today's exercise. Next week, we're combining everything into the document that will change how you work with AI forever."

---

### 1:15 - 1:20 | Wrap-Up

**Key takeaway:**

> "AI confidence is not a signal. Verification is the only signal. From today forward, you have three tools: ask 'why' to extract decision logic, stop at two strikes to avoid rabbit holes, and verify with numbers instead of trusting adjectives. These three habits alone will cut your debugging time in half."

**Preview Week 4:**

> "Next week is the biggest lesson in this course. It's called 'The Governance Revolution.' You've been collecting rules for three weeks — your 'Do NOT' list, your interrogation rules, your failure journal patterns. Next week, we assemble them into the document that replaces prompt engineering. Bring everything."

---

# WEEK 4: The Governance Revolution

**Theme:** Building the governance document that replaces prompt engineering forever. The single most valuable asset in AI-assisted development.

**Lessons Covered:** Lesson 7 (The Governance Document You Never Knew You Needed)

**Materials Needed:**
- Students bring ALL previous homework: failure journal, "Do NOT" list, interrogation rules, verification logs
- Laptop with text editor
- This is a BUILD session — students will leave with a working governance document

---

### 0:00 - 0:10 | Intro / Icebreaker

**Homework Review:**

Quick round — each student shares one verification surprise from the week:
- "I found X compiler errors in code the AI said was clean"
- "The diff showed the AI changed 3 files when I asked it to change 1"
- "When I asked 'why', the AI admitted it was guessing"

**Frame the session:**

> "For three weeks, you've been collecting data. Your failure journal from Week 1. Your 'Do NOT' list from Week 2. Your interrogation rules from Week 3. Your verification logs. Today, we assemble all of it into one document. This document will be the single most valuable thing you take from this course. It's not instructions to AI — it's a control system over AI."

---

### 0:10 - 0:30 | Pain Points Discussion — "Why Governance Beats Prompting"

**The core insight:**

| Prompting | Governance |
|---|---|
| Works for one conversation | Works for every conversation |
| Depends on your memory | Automated enforcement |
| "Please use TypeScript" | "TypeScript mandatory. `any` forbidden. Violations rejected." |
| Polite requests | Non-negotiable rules |
| Degrades as conversation gets longer | Loaded fresh every session |
| Differs by mood and memory | Consistent every time |

**Live demonstration — "Same AI, Different Governance"**

Give the same coding task to the AI twice:

**Round 1:** No governance document. Just the task description.
- Point out the issues in the output

**Round 2:** Load a governance document first, then the same task.
- Show how the issues from Round 1 are prevented

> "Same AI. Same task. Different output. The only variable was the governance document. That's the power of this approach."

**The Governance Feedback Loop:**

Draw this on the whiteboard:

```
AI does something wrong
    ↓
You ask "why?"
    ↓
AI explains (training data habit / no real reason)
    ↓
You write a rule
    ↓
Rule goes in governance document
    ↓
AI reads governance document every session
    ↓
AI never makes that mistake again
    ↓
(repeat for every new mistake)
```

> "The document gets smarter every week. After 3 months, it's so complete that AI produces correct output on the first try 90% of the time. After 6 months, it's nearly 100%. That's not prompt engineering — that's engineering."

**Why rules need the "Why AI Does This" column:**

```markdown
| Rule | Why AI Violates This |
|------|---------------------|
| No `any` type | AI takes shortcuts with complex types |
| No console.log | AI uses quick output during generation |
| No new files unless necessary | Starting fresh feels easier than understanding existing code |
```

> "When the AI reads a rule AND understands WHY it tends to break it, compliance goes up. The AI recognizes the pattern in itself."

---

### 0:30 - 0:50 | Exercise — "Build Your Governance Document"

**This is a construction session. Students build their actual governance document.**

**Step 1 (5 min): Gather materials**
Pull up all previous homework:
- Failure journal (Week 1) — which patterns appeared most?
- "Do NOT" list (Week 2) — your project-specific constraints
- Interrogation rules (Week 3) — rules generated from asking "why?"
- Verification logs (Week 3 homework) — what verification revealed

**Step 2 (5 min): Create the document structure**

Everyone creates a file in their project (name it for their tool — `CLAUDE.md`, `.cursorrules`, `AI_RULES.md`, or whatever their tool reads):

```markdown
# AI Governance — [Project Name]

## Quick Rules (Non-Negotiable)
| # | Rule | Violation | Why AI Does This |
|---|------|-----------|------------------|

## Common AI Mistakes in This Project
| Mistake | Correct Pattern |
|---------|----------------|

## Code Patterns (Do This / Not That)
| Do This | Not That |
|---------|----------|

## Quality Gates
Before work is done, AI must run and report:
1.
2.
3.
```

**Step 3 (10 min): Fill it in**

Using all collected homework data, populate each section:
- Top 5-10 rules in the Quick Rules table
- Top 5 mistakes from the failure journal
- Code patterns from the "Do NOT" list and interrogation rules
- Verification commands for their specific project

**Instructor circulates** and reviews documents in real-time. Common feedback:
- "This rule is too vague — make it specific with a code example"
- "Add the 'Why AI Does This' column — it increases compliance"
- "Your quality gates need specific commands, not 'make sure tests pass'"

---

### 0:50 - 1:10 | Q&A / Group Discussion

**Testing the documents live:**

Ask 2-3 volunteers to share their screen and test their governance document:
1. Load the document in their AI tool
2. Give the AI a task
3. Class evaluates: did the governance rules get followed?

**Discussion prompts:**

1. "Did the governance document change the AI's output compared to your normal workflow?"
2. "Which rules were most effective? Which ones did the AI still violate?"
3. "How long did it take you to build the document? How long do you think it saves per week?"

**Anticipated questions:**

*"How many rules is too many?"*
> "There's no hard limit, but keep the Quick Rules table to 10-15 maximum. The AI scans the top rules first. Put the ones that prevent the most common mistakes at the top. You can have deeper sections for patterns and examples below."

*"Should I share my governance doc with my team?"*
> "Absolutely. One person's governance doc helps the whole team. And when multiple developers contribute their failure patterns, the doc gets better faster."

*"What if the AI tool doesn't support a governance document?"*
> "Every major tool has a way: Claude Code reads CLAUDE.md, Cursor reads .cursorrules, GitHub Copilot can use system prompts. If nothing else, paste the top 10 rules at the start of every conversation. It's less elegant but still effective."

---

### 1:10 - 1:15 | Homework Assignment

**This Week's Assignment: Live Test the Governance Document**

> "Your governance document is built. Now test it in production.
>
> This week, use your governance document for every AI coding session. Track:
>
> 1. Did the AI follow the rules? Which ones did it violate?
> 2. Did the output quality improve compared to pre-governance sessions?
> 3. What new rules did you discover need to be added?
>
> **At the end of each session, ask the AI:** 'Which rules from the governance document did you follow? Which did you struggle with?'
>
> Update the document with any new rules you discover. By next week, you should have a v2 that's noticeably better than the v1 you built today."

---

### 1:15 - 1:20 | Wrap-Up

**Key takeaway:**

> "You just built the most valuable file in your project. Not the code — the governance document. Code can be regenerated. The rules that make the code correct? Those took you four weeks of real data to build. Protect this document like you protect your source code. Update it every week. It's a living system, not a static file."

**Preview Week 5:**

> "Next week: 'Advanced Techniques.' You've got the foundation — failure recognition, structured communication, verification, and governance. Now we go deeper: role-shifting to audit your own code, cross-AI checking, and techniques most developers never discover."

---

# WEEK 5: Advanced Techniques

**Theme:** Power techniques that multiply your effectiveness — role-shifting, adversarial checking, cross-AI auditing.

**Lessons Covered:** Lesson 6 (Change Roles for Fresh Perspective), Lesson 5 revisited (advanced speed recalibration), cross-AI auditing

**Materials Needed:**
- Students bring updated governance documents (v2 from homework)
- Students need TWO AI tools for the cross-AI exercise (e.g., Claude + ChatGPT, Cursor + Copilot)
- Project open for live exercises

---

### 0:00 - 0:10 | Intro / Icebreaker

**Homework Review — Governance in Practice:**

> "How did the governance document perform? Quick round — tell us one rule it enforced well and one it failed on."

Collect the failures — these become discussion material for improving governance docs.

**Frame the session:**

> "You've got the fundamentals. Rules, structure, verification, governance. Today we add the power tools. These are techniques I've seen cut debugging time by 70% — but almost nobody uses them because they feel 'weird.' They ask you to make the AI pretend to be someone else. It sounds silly. It works."

---

### 0:10 - 0:30 | Pain Points Discussion — "The Self-Confirmation Problem"

**The core insight:**

> "When AI writes code and then reviews its own code, it sees what it intended — not what it actually wrote. Asking 'is this good?' after AI just wrote it will always get 'yes.' This is the same reason you can't proofread your own writing effectively."

**Technique 1: The Role Shift**

After AI writes code, give it a new identity:

| Role | What It Catches |
|---|---|
| "Senior code reviewer" | Code quality, patterns, maintainability |
| "Security auditor" | Injection, exposure, missing auth checks |
| "Performance engineer" | N+1 queries, unnecessary re-renders, memory leaks |
| "QA engineer with malicious intent" | Edge cases, boundary conditions, unexpected inputs |
| "Junior developer reading this for the first time" | Unclear naming, confusing flow |
| "The person who has to maintain this in 6 months" | Documentation gaps, hidden complexity |

**Live demonstration:**

1. Ask AI to write a function
2. Accept the output
3. Say: "Now pretend you're a senior engineer doing a code review. Find at least 3 issues with what you just wrote."
4. Watch it find REAL issues in its own code

> "It just criticized its own work — and found real problems. This is not theater. The role shift activates different evaluation patterns. As the author, it's biased toward its own output. As a reviewer, it applies standards it was ignoring while writing."

**Technique 2: The Build-Attack-Fix Pattern**

```
Step 1: "Build this feature."
[AI writes the code]

Step 2: "Now try to break it. What inputs cause unexpected behavior?
         What happens with null data? Empty arrays? Network timeout?
         Someone submitting the form 100 times per second?"
[AI finds real vulnerabilities]

Step 3: "Fix every issue you just identified."
[AI produces significantly more robust code]
```

> "Three steps instead of one. The output from step 3 is dramatically better than the output from step 1. The 'attack' step is what makes the difference."

**Technique 3: Cross-AI Auditing**

> "The ultimate role shift: use a different AI entirely."

- Write code with Claude → Review with ChatGPT
- Write code with Cursor → Review with Claude Code
- Write code with Copilot → Review with Claude

Each AI has different training data and different blind spots. What one misses, the other catches.

> "I used cross-AI auditing to eliminate 1,400 type violations and 1,671 lint warnings in one codebase. One AI alone couldn't find them all. Two AIs checking each other found everything."

---

### 0:30 - 0:50 | Exercise — "The Adversarial Audit"

**Two-part exercise:**

**Part 1: Role-Shift Review (10 min)**

1. Each student pulls up a piece of AI-generated code from their project (something they accepted recently)
2. Give the AI this exact prompt:
   > "Pretend you are a senior engineer reviewing this code for a production deployment to a healthcare system. Find at least 5 issues — including security, performance, maintainability, and edge cases. Be harsh."
3. Record what the AI finds
4. Fix the top 3 issues

**Part 2: Cross-AI Audit (10 min)**

1. Take the SAME code from Part 1
2. Copy it into a DIFFERENT AI tool
3. Ask the second AI:
   > "Review this code. Find issues the original author might have missed. Focus on: type safety, error handling, edge cases, and whether this follows best practices for [their framework]."
4. Compare what AI #1 found vs what AI #2 found
5. How many issues were unique to each?

**Students share results:** How much overlap between the two AIs? How many unique issues did each find?

**Expected result:** 40-60% overlap, with each AI finding 2-4 unique issues the other missed. This proves the value of cross-AI auditing.

---

### 0:50 - 1:10 | Q&A / Group Discussion

**Discussion prompts:**

1. "What surprised you most about the role-shift review? Did AI find real issues in its own code?"
2. "How different were the reviews between the two AI tools?"
3. "Would you have caught these issues on your own?"
4. "How could you integrate this into your daily workflow without it being too slow?"

**Practical workflow discussion:**

> "You don't have to do a full adversarial audit on every function. But for anything that's: security-sensitive, data-critical, user-facing, or complex — the 3-minute investment of a role-shift review catches bugs that would take 30 minutes to debug in production."

**When to use each technique:**

| Situation | Technique | Time Cost |
|---|---|---|
| Quick function or fix | Skip — just verify with compiler/tests | 0 min |
| Medium feature | Role-shift review ("find 3 issues") | 3 min |
| Security-sensitive code | Security auditor role + build-attack-fix | 10 min |
| Major feature or architecture | Cross-AI audit with 2 tools | 15 min |
| Before deployment | Full adversarial audit (all techniques) | 30 min |

---

### 1:10 - 1:15 | Homework Assignment

**This Week's Assignment: The Weekly Audit**

> "This week, integrate ONE adversarial technique into your workflow:
>
> **Option A (Minimum):** After every AI coding session, do a role-shift review on the most important piece of code. 'Review this as a senior engineer. Find 3 issues.'
>
> **Option B (Recommended):** Pick one significant feature or fix from your week and run the full build-attack-fix cycle.
>
> **Option C (Advanced):** Do a cross-AI audit on one piece of critical code.
>
> Track what the adversarial review found that you would have missed.
>
> Also: Update your governance document (v3) with anything new you discovered.
>
> Next week is the final session. Bring your governance document, your tracking data, and a list of what changed in your workflow since Week 1."

---

### 1:15 - 1:20 | Wrap-Up

**Key takeaway:**

> "AI can't audit its own work from the same perspective that created it. But it CAN audit its own work from a different perspective. The role shift is real — it activates different patterns. Use it for anything that matters. And when one AI isn't enough, use two."

**Preview Week 6:**

> "Final session next week. We're putting the complete system together: governance, memory, session management, and discipline. You'll leave with a framework you can use for the rest of your AI-assisted development career."

---

# WEEK 6: The Complete System

**Theme:** Assembling everything into a repeatable, sustainable system. Memory management, session discipline, and long-term maintenance.

**Lessons Covered:** Lesson 2 (Build AI Memory), Lesson 9 (Tips and Tricks That Make AI Disciplined), Lesson 13 (Session Management)

**Materials Needed:**
- Students bring: governance document (v3), all tracking data, before/after examples
- Whiteboard for system diagram
- This is the synthesis session — connecting all previous lessons into one workflow

---

### 0:00 - 0:10 | Intro / Icebreaker

**Final Homework Review:**

> "Last week you integrated adversarial techniques into your workflow. Quick round: what did the adversarial review catch that you would have shipped?"

Brief shares. Instructor highlights the most impactful finds.

**Reflection:**

> "Think back to Week 1 when you shared your 'worst AI moment.' Now think about the last two weeks with governance, verification, and adversarial checking. How different is your experience?"

---

### 0:10 - 0:30 | Pain Points Discussion — "The Long Game"

**The problem with short-term thinking:**

> "Everything we've covered works great for a single session. But the real power comes from persistence — making each session better than the last. That requires three things: memory, discipline, and session management."

**Memory Architecture:**

Draw this on the whiteboard:

```
Your AI System
├── Rules Memory (governance doc)         → Always loaded
│   "What to always/never do"
├── Learned Memory (notes, patterns)      → Updated weekly
│   "What we've discovered"
├── Session Memory (state file)           → Updated every session
│   "Where we left off"
└── Verification Logs (tracking data)     → Reference as needed
    "How the system is performing"
```

> "Rules Memory is your governance document. You built that in Week 4. Learned Memory is patterns you discover — 'this API returns dates as strings, not Date objects.' Session Memory is the handoff between sessions — 'we finished the login form, next is the dashboard.' Without all three, every session starts from scratch."

**Session Management:**

| Session Phase | What Happens | Time |
|---|---|---|
| **Start** | AI reads state file → reads governance doc → gives status summary | 5 min |
| **Core** | Work in small, verifiable steps. Verify each step. | 30-60 min |
| **Refresh** | Every 10-15 messages, restate critical constraints | 30 sec |
| **End** | AI summarizes what's done, what's remaining, updates state file | 5 min |

> "Context is a resource that depletes. After 60-90 minutes, your governance rules lose weight in the AI's memory. The refresh technique — restating your top 3 rules every 10-15 messages — keeps them active. The state file ensures the next session starts sharp instead of confused."

**Discipline Techniques:**

Quick-fire review of the discipline toolkit:

| Technique | What It Prevents |
|---|---|
| Parameter limits ("max 20 lines") | Over-engineering, god files |
| Scope locks ("ONLY change file X") | AI touching things it shouldn't |
| Pre-flight checklists ("read the type def before writing") | Skim-vs-ingest errors |
| Required verification format ("report numbers, not adjectives") | Fake verification |
| Session boundaries ("wrap up at 60 min") | Context degradation |
| The 2-strike rule ("stop after 2 failed fixes") | Rabbit holes |
| "Why?" interrogation | Training data habits → governance rules |

---

### 0:30 - 0:50 | Exercise — "The Complete System Blueprint"

**Final exercise: Design your personal AI development system.**

Each student creates a one-page "AI Workflow Blueprint" that combines everything from the course:

```markdown
# My AI Development System — [Name]

## Session Start
1. AI reads: [governance doc path]
2. AI reads: [state file path]
3. AI reports: status summary
4. I confirm: what to work on

## During Work
- Input format: [structured / bullets / templates]
- Constraint style: [my top 3 "Do NOT" rules]
- Speed control: [phrases I use for complex tasks]
- Scope control: [how I limit AI's changes]

## Quality Control
- Verification commands: [specific to my stack]
- Role-shift trigger: [when I use adversarial review]
- 2-strike rule: [what I do when AI is stuck]
- Cross-AI audit: [when I use a second AI tool]

## Session End
- AI summarizes: what's done
- AI updates: state file
- I update: governance doc (new rules from this session)

## Weekly Maintenance
- Review governance doc: add new rules, remove outdated ones
- Review tracking data: which mistakes are decreasing? increasing?
- Update learned memory: patterns discovered this week
```

**Students fill this in using their specific tools, projects, and lessons learned.** This is their take-home framework.

**Instructor circulates** reviewing blueprints. Common feedback:
- "Your verification step needs specific commands, not 'check that it works'"
- "Add the refresh technique — restate rules every 10-15 messages"
- "Your session start is missing the state file — you'll lose context between sessions"

---

### 0:50 - 1:10 | Q&A / Final Discussion

**The Full Circle:**

> "Six weeks ago, you walked in with an AI tool and good intentions. You had no failure taxonomy, no structured inputs, no governance, no verification habit, and no adversarial checking. Now you have all of them."

**Metrics check:**

Ask each student to estimate (or report from tracking data):
- How much has your debugging time decreased since Week 1?
- How much has your first-attempt quality improved?
- How many rules are in your governance document now?
- How many hours per week do you estimate this saves?

**Group discussion prompts:**

1. "What was the single most valuable technique from this course?"
2. "What changed your mental model of how AI works?"
3. "What do you wish you'd known 6 months ago?"
4. "How will you explain this to someone who thinks AI coding is just 'prompting'?"

**The meta-lesson:**

> "The AI industry is focused on making models smarter — bigger context windows, better reasoning, faster output. None of that matters as much as what you built in this course. A mediocre AI with great governance will outperform a brilliant AI with no governance. Every single time."
>
> "The skill is not prompting. The skill is not coding. The skill is building the system that makes AI consistently produce what you need. That's a leadership skill, not a technical skill. And you just learned it."

---

### 1:10 - 1:15 | Final Assignment — The Ongoing Practice

> "There's no homework this week. But there is a practice:
>
> **Every Friday, spend 15 minutes updating your governance document.** Review the week's AI sessions. What mistakes appeared? What rules need to be added? What rules are working well?
>
> In 3 months, your governance document will be so complete that AI produces correct output on the first try 90% of the time. In 6 months, you'll barely remember what it was like to debug AI-generated code.
>
> That's the compound return on what you built here."

---

### 1:15 - 1:20 | Wrap-Up — Course Close

**Closing statement:**

> "I built a HIPAA-compliant healthcare platform with 248 database tables, 144 server functions, and 8,400 tests. Total cost: $645. No engineering team. Just AI tools and the system you now have.
>
> I'm not a developer. I have a degree in Social and Behavioral Science. What I am is an architect who built a governance system that makes AI work for me.
>
> You are developers. You have the technical knowledge I don't. Now you have the governance system too. Imagine what you can build.
>
> Go build it."

---

## Appendix: Instructor Notes

### Timing Flexibility

If discussion runs long (it will in Weeks 1, 3, and 4), take time from Q&A. The exercises are non-negotiable — hands-on practice is what justifies the price point.

### Managing Different Skill Levels

Even among developers, experience varies:
- **Junior devs** will struggle with governance document structure — pair them with seniors during the Week 4 exercise
- **Senior devs** will resist "slowing down" with verification — the Week 1 exercise usually converts them when they find issues in code they would have accepted
- **AI-experienced devs** will think they already know this — the Week 3 interrogation exercise usually reveals how much their AI is getting away with

### The Cohort Effect

15 students sharing failure patterns, governance rules, and adversarial findings creates a knowledge multiplier. By Week 4, the collective governance wisdom exceeds what any individual would develop alone. Encourage students to share their governance docs with each other after the course.

### Post-Course Revenue Opportunities

- **Governance document review service** — $500/hour to review and improve a team's AI governance doc
- **Advanced cohort** (Weeks 7-12) — deeper on cross-AI auditing, team-level governance, CI/CD integration
- **Corporate workshops** — adapted for engineering teams, 2-day intensive format, $5,000-15,000 per team
- **1:1 consulting** — help companies build their governance systems, $2,000-5,000 per engagement

### Handling Skeptics

Some students will arrive thinking "I just need better prompts." The Week 1 exercise (finding issues in their accepted AI code) is the conversion moment. If they don't find issues in Week 1, they're either not looking hard enough or they're already using governance techniques without knowing it.

---

## Appendix: Session Supplies Checklist

### Every Week
- [ ] Projector / screen share capability
- [ ] Shared document for class notes (Google Doc, Notion, etc.)
- [ ] Timer visible to instructor (strict timing builds trust)
- [ ] Students have AI tools ready before session starts

### Week 1 Specific
- [ ] Whiteboard/virtual whiteboard for failure taxonomy
- [ ] AI Failure Journal template to share with students
- [ ] Pre-course survey responses reviewed

### Week 4 Specific
- [ ] Governance document template ready to share
- [ ] Students reminded to bring ALL previous homework
- [ ] Extra time budgeted — this session often runs long

### Week 5 Specific
- [ ] Students confirmed they have access to TWO AI tools
- [ ] If some students only have one tool, pair them with someone who has a different tool

### Week 6 Specific
- [ ] AI Workflow Blueprint template ready to share
- [ ] Course evaluation form ready
- [ ] Post-course resource list (recommended reading, community links)
