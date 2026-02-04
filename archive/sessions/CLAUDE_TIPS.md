# How to Use Claude Code Effectively

## 1. Use Agents in Parallel

When you have multiple independent tasks, ask for them all at once:

```
"Search for all places we handle login AND find all tables related to billing AND check what RLS policies exist on profiles"
```

Claude can spawn multiple agents simultaneously instead of doing them one at a time. This saves significant time on research and exploration tasks.

---

## 2. Plan Mode for Complex Features

When you want something big, say:

```
"Enter plan mode and design how we should implement [feature]"
```

Claude will:
1. Explore the codebase
2. Write a detailed plan to a file
3. Get your approval BEFORE writing code

This prevents wasted work and ensures alignment on approach.

---

## 3. Add More to CLAUDE.md

Your `CLAUDE.md` file is your leverage - it persists across sessions and trains Claude on your codebase. Things to add:

| Category | Examples |
|----------|----------|
| **Patterns** | How you want forms structured, error handling patterns |
| **Protected Tables** | Tables that are critical and should never be touched |
| **Work in Progress** | Features being built and their current status |
| **Business Rules** | "Seniors always get large fonts", "SDOH applies to everyone" |
| **Naming Conventions** | How you name files, components, database tables |

---

## 4. Ask for Tests

```
"Write unit tests for the seniorDataService"
```

```
"Write integration tests for the registration flow"
```

Tests catch bugs before they hit production and serve as documentation for how things should work.

---

## 5. Request Code Reviews

```
"Review the last 3 commits for security issues and code quality"
```

```
"Audit our RLS policies for any gaps"
```

```
"Check our edge functions for proper error handling"
```

---

## 6. Ask "What Am I Missing?"

Proactive security and architecture questions:

```
"Look at our authentication flow - what security holes exist?"
```

```
"What would break if we had 1000 concurrent users?"
```

```
"What HIPAA requirements are we not meeting?"
```

```
"What's missing from our billing system before it can go live?"
```

---

## 7. Documentation Generation

```
"Generate API documentation for all our edge functions"
```

```
"Create an onboarding doc for a new developer"
```

```
"Document the database schema for the senior care tables"
```

```
"Write user-facing help docs for the caregiver access feature"
```

---

## 8. Batch Requests

Instead of asking one thing at a time:

❌ **Slow way:**
- "Fix the login bug"
- (wait for response)
- "Now add logging"
- (wait for response)
- "Now write a test"

✅ **Fast way:**
```
"Fix the login bug, add audit logging, and write a test for it"
```

Claude will do all three in sequence efficiently.

---

## 9. Share Your Goals

**Tell Claude your weekly/monthly milestones.**

```
"I'm trying to launch the caregiver feature by Friday"
```

```
"This month we need to complete the billing module"
```

When Claude knows your priorities, it can:
- Flag risks proactively
- Prioritize the right work
- Warn you if something will take longer than expected

---

## 10. Use Todo Lists

For complex multi-step tasks, Claude will automatically create a todo list to track progress. You can also ask:

```
"Create a todo list for implementing [feature]"
```

This ensures nothing gets forgotten and you can see progress.

---

## Quick Reference Commands

| Want to... | Say... |
|------------|--------|
| Explore codebase | "Use an explore agent to find..." |
| Plan before coding | "Enter plan mode for..." |
| Run multiple searches | "Search for X AND find Y AND check Z" |
| Get security review | "Audit [feature] for security issues" |
| Generate docs | "Document the [feature/table/API]" |
| Write tests | "Write tests for [service/component]" |
| Batch tasks | "Do X, then Y, then Z" |
| Check what's missing | "What's missing from [feature] before launch?" |

---

## The Key Insight

**You don't need to speak "developer" to build production software.**

Your domain knowledge (healthcare, seniors, community wellness) is MORE valuable than syntax knowledge. Speak plainly about what you want. Push back when the output isn't right. Keep refining CLAUDE.md with lessons learned.

That's how you built a complete healthcare SaaS platform in 7 months.
