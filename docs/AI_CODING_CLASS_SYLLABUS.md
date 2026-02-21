# Building With AI: The Class They Don't Teach

## Course Syllabus

---

**Instructor:** Maria Torres, AI System Director — Envision Virtual Edge Group LLC

**Format:** Live Workshop (In-Person / Zoom)

**Duration:** 6 Weeks | 90 Minutes Per Session

**Cohort Size:** 15 (Selected Enrollment)

**Tuition:** $2,000

---

## Instructor Background

Maria Torres is the AI System Director at Envision Virtual Edge Group LLC, where she built a HIPAA-compliant, multi-tenant healthcare platform using AI coding assistants — with no prior software engineering background. The platform includes 248 database tables, 144 server functions, 8,400+ automated tests, 40+ AI-powered clinical services, and full interoperability with hospital systems (HL7, FHIR, X12 claims). Total development cost: $645. Total engineering staff: zero.

Through 2,100+ AI coding sessions and 1,989 commits over 9 months, Maria developed the AI Development Methodology — a governance-first approach to AI-assisted software engineering that prioritizes system design over prompt engineering. This course teaches that methodology.

---

## Course Description

This is not a prompt engineering course. Prompt engineering is a conversation. This course teaches you to build a **system** — a persistent, enforceable, self-improving framework that makes AI coding assistants produce consistently correct, production-grade code.

You will learn why AI makes predictable mistakes, how to prevent them with governance documents, how to verify AI output with discipline instead of trust, and how to build a workflow that improves with every session. Every exercise uses your real codebase — not toy examples.

By the end of this course, you will have a working governance document, a verification workflow, and an adversarial checking practice tailored to your specific project and technology stack.

---

## Who This Course Is For

- Software developers who use AI coding assistants (Claude Code, Cursor, GitHub Copilot, ChatGPT, or similar) and want to get consistently better output
- Tech leads responsible for code quality on teams that use AI tools
- Engineers who have experienced AI-generated technical debt and want to eliminate it
- Developers at any experience level who want production-grade results from AI, not "good enough" results

---

## What This Course Is NOT

- This is not a coding bootcamp — you must already write code
- This is not a prompt engineering tutorial — we go far beyond prompts
- This is not a sales pitch for any specific AI tool — techniques apply to all of them
- This is not theoretical — every session includes hands-on exercises using your real projects

---

## Learning Objectives

By the end of this course, students will be able to:

1. **Identify** the 15 predictable failure patterns AI coding assistants produce across all tools and languages
2. **Construct** structured inputs that produce higher-quality AI output than unstructured prompts
3. **Write** effective negative constraints ("Do NOT" lists) that prevent project-specific AI mistakes
4. **Build** a governance document that enforces coding standards across every AI session without re-explaining rules
5. **Implement** a verification workflow that catches AI errors before they reach production
6. **Apply** the 2-strike rule to prevent debugging rabbit holes when AI is stuck
7. **Use** role-shifting and adversarial checking techniques to audit AI-generated code from multiple perspectives
8. **Conduct** cross-AI audits using two different AI tools to catch errors neither would find alone
9. **Design** a memory system (rules, learned patterns, session state) that eliminates context loss between sessions
10. **Manage** AI session context as a depletable resource with structured start, refresh, and handoff protocols

---

## Required Materials

- **A real software project** — active or in planning. Every exercise and homework assignment uses your codebase, not examples. If you don't have one, contact the instructor before Week 1.
- **At least one AI coding assistant** — Claude Code (CLI), Cursor, GitHub Copilot, ChatGPT with code interpreter, or equivalent. Must be set up and functional before the first session.
- **A second AI coding tool** (required for Week 5) — any tool different from your primary. Free tiers are sufficient.
- **A text editor** — for building your governance document during class.
- **A tracking spreadsheet or notes document** — for homework logging.

---

## Weekly Schedule

### Week 1: Why Your AI Code Sucks

**Date:** [TBD]

**Focus:** Understanding the 15 predictable failure patterns AI produces and establishing the architect/builder mindset.

| Block | Time | Activity |
|-------|------|----------|
| Intro | 10 min | Icebreaker: share your worst AI coding moment |
| Teaching | 20 min | The 15 failure patterns + the skim-vs-ingest problem + architect vs. builder framework |
| Exercise | 20 min | Live: give AI a task from your project, identify failure patterns in the output before accepting |
| Q&A | 20 min | Group discussion: which patterns surprised you, time lost estimates |
| Homework | 5 min | Assignment: keep an AI Failure Journal for one week |
| Wrap-Up | 5 min | Key takeaway + preview Week 2 |

**Homework:** AI Failure Journal — log every AI interaction this week. Record: task, output quality (1-10), failure patterns found (by number), time to fix.

**Reading:** AI_CODING_CLASS_CURRICULUM.md — Lesson 1 and Lesson 8

---

### Week 2: Stop Prompting, Start Structuring

**Date:** [TBD]

**Focus:** Replacing vague prompts with structured inputs, negative constraints, and speed recalibration.

| Block | Time | Activity |
|-------|------|----------|
| Intro | 10 min | Homework review: share your top recurring failure pattern from the journal |
| Teaching | 20 min | Three techniques: "Don't" lists, structured input formats, speed-control phrases |
| Exercise | 20 min | The Rewrite Challenge: take a bad request from your journal, restructure it, resubmit, compare outputs |
| Q&A | 20 min | Group discussion: which technique had the biggest impact |
| Homework | 5 min | Assignment: build your project-specific "Do NOT" list (top 5 rules) |
| Wrap-Up | 5 min | Key takeaway + preview Week 3 |

**Homework:** Write a reusable "Do NOT" list for your project — 5 rules based on your most common AI failure patterns.

**Reading:** AI_CODING_CLASS_CURRICULUM.md — Lessons 3, 4, and 5

---

### Week 3: Trust Nothing, Verify Everything

**Date:** [TBD]

**Focus:** Making AI explain itself, the 2-strike rule, and replacing trust with verification.

| Block | Time | Activity |
|-------|------|----------|
| Intro | 10 min | Icebreaker: "The Lie Detector Test" — which AI claims are actually true? |
| Teaching | 20 min | Three pillars: make AI explain itself (the governance feedback loop), the 2-strike rule, verification with numbers |
| Exercise | 20 min | The Interrogation: give AI a task, interrogate 2-3 silent decisions with "Why?", generate governance rules from bad answers |
| Q&A | 20 min | Group sharing: what did the AI admit when you asked "why"? New rules generated. |
| Homework | 5 min | Assignment: verification habit — run compiler + check diff + ask "why" once per session for one week |
| Wrap-Up | 5 min | Key takeaway + preview Week 4 |

**Homework:** The Verification Habit — track compiler errors found, unexpected diff changes, and new governance rules generated from "Why?" questions.

**Reading:** AI_CODING_CLASS_CURRICULUM.md — Lessons 10, 11, and 12

---

### Week 4: The Governance Revolution

**Date:** [TBD]

**Focus:** Building the governance document — the control system that replaces prompt engineering.

| Block | Time | Activity |
|-------|------|----------|
| Intro | 10 min | Homework review: share one verification surprise from the week |
| Teaching | 20 min | Governance vs. prompting, the feedback loop, why rules need the "Why AI Does This" column, live demo |
| Exercise | 20 min | BUILD SESSION: assemble your governance document using all previous homework (failure journal, "Do NOT" list, interrogation rules, verification logs) |
| Q&A | 20 min | Live testing: 2-3 volunteers test their governance doc with AI in front of the class |
| Homework | 5 min | Assignment: use governance doc for every AI session this week, track what it catches and what it misses, update to v2 |
| Wrap-Up | 5 min | Key takeaway + preview Week 5 |

**Homework:** Live-test your governance document for one week. Track: rules followed, rules violated, new rules added. Produce v2 by next session.

**Reading:** AI_CODING_CLASS_CURRICULUM.md — Lesson 7

**Note:** Bring ALL previous homework materials to this session. You will need them for the build exercise.

---

### Week 5: Advanced Techniques

**Date:** [TBD]

**Focus:** Role-shifting, adversarial checking, cross-AI auditing — the power tools for critical code.

| Block | Time | Activity |
|-------|------|----------|
| Intro | 10 min | Homework review: how did the governance document perform in production this week? |
| Teaching | 20 min | The self-confirmation problem, role-shift technique, build-attack-fix pattern, cross-AI auditing |
| Exercise | 20 min | Part 1 (10 min): role-shift review on recently accepted AI code. Part 2 (10 min): cross-AI audit using a second tool. Compare findings. |
| Q&A | 20 min | Group discussion: what did the adversarial review catch? How different were the two AI tools' reviews? |
| Homework | 5 min | Assignment: integrate one adversarial technique into your daily workflow this week. Update governance doc to v3. |
| Wrap-Up | 5 min | Key takeaway + preview Week 6 |

**Homework:** The Weekly Audit — use at least one adversarial technique on your most important code this week. Track what it found that you would have missed.

**Reading:** AI_CODING_CLASS_CURRICULUM.md — Lesson 6

**Note:** You must have access to TWO different AI coding tools for this session. If your primary tool is Claude, bring ChatGPT (or vice versa). Free tiers are sufficient.

---

### Week 6: The Complete System

**Date:** [TBD]

**Focus:** Memory architecture, session management, discipline techniques, and assembling the complete AI development workflow.

| Block | Time | Activity |
|-------|------|----------|
| Intro | 10 min | Final homework review + reflection: Week 1 vs. now |
| Teaching | 20 min | Three types of AI memory, session lifecycle (start/core/refresh/end), discipline toolkit overview |
| Exercise | 20 min | Build your AI Workflow Blueprint: one-page system combining governance, memory, verification, adversarial checking, session management |
| Q&A | 20 min | Final discussion: most valuable technique, what changed your mental model, how to explain this to someone who thinks AI coding is "just prompting" |
| Final Assignment | 5 min | The ongoing practice: 15-minute weekly governance doc update |
| Wrap-Up | 5 min | Course close |

**Ongoing Practice:** Every Friday, spend 15 minutes updating your governance document. Review the week's AI sessions. Add new rules. Remove outdated ones. In 3 months, AI will produce correct output on the first try 90%+ of the time.

**Reading:** AI_CODING_CLASS_CURRICULUM.md — Lessons 2, 9, and 13

---

## Deliverables

By course completion, each student will have produced:

| Deliverable | Created In | Purpose |
|-------------|-----------|---------|
| AI Failure Journal | Week 1 | Baseline data on your specific AI failure patterns |
| "Do NOT" List | Week 2 | Project-specific constraints (minimum 5 rules) |
| Governance Document (v3+) | Weeks 3-5 | The control system for your AI workflow — rules, patterns, quality gates |
| AI Workflow Blueprint | Week 6 | One-page personal system: session start, work, verification, session end |
| Verification Habit | Weeks 3-6 | Integrated practice of compiler checks, diff reviews, and "Why?" interrogation |
| Adversarial Checking Practice | Weeks 5-6 | Role-shifting and/or cross-AI auditing integrated into workflow |

---

## Course Policies

### Attendance

This is a 15-person cohort. Your participation contributes to everyone's learning. If you must miss a session:
- Notify the instructor at least 24 hours in advance
- Review the session materials and complete the homework before the next session
- Missing more than 2 sessions may impact your ability to complete the course deliverables

### Participation

This is a workshop, not a lecture. You will be sharing code, AI interactions, failure patterns, and governance rules with the cohort. You are not required to share proprietary code, but you must actively participate in exercises and discussions. The collective knowledge of 15 developers sharing patterns is more valuable than any individual could produce alone.

### Confidentiality

Code, failure patterns, and governance documents shared during class sessions are confidential to the cohort. Do not share another student's code, project details, or specific failure examples outside the class without their permission.

### Completion

There is no formal exam or grade. Course completion requires:
- Attendance at a minimum of 4 out of 6 sessions
- Submission of all 6 homework assignments
- A completed governance document (v3 or later)
- A completed AI Workflow Blueprint

Students who complete all requirements will receive a certificate of completion.

---

## Pre-Course Checklist

Complete before Week 1:

- [ ] Choose a real software project to use throughout the course
- [ ] Set up your primary AI coding assistant (Claude Code, Cursor, Copilot, or equivalent)
- [ ] Identify a second AI tool for Week 5 (free tier is fine)
- [ ] Find one example of a time AI gave you bad code — screenshot or copy it
- [ ] Use AI normally for one week before the course starts and notice: how often you correct it, how often you accept code without checking, how much time you spend debugging AI-generated code

---

## Recommended Reading

These are not required, but provide additional context:

- **AI Development Methodology** — `docs/architecture/AI_DEVELOPMENT_METHODOLOGY.md` (available upon request; the methodology this course is based on)
- **Anthropic's Claude Documentation** — anthropic.com/claude (understanding model capabilities and limitations)
- **The Pragmatic Programmer** by Hunt & Thomas (the "broken windows" and "don't live with broken windows" philosophy applies directly to AI governance)

---

## Contact

**Instructor:** Maria Torres
**Email:** maria@wellfitcommunity.com
**Office Hours:** By appointment (Zoom)

For technical setup issues before the course, email with subject line: "AI Class — Setup Help"

---

## About Envision Virtual Edge Group LLC

Envision Virtual Edge Group builds AI-powered healthcare technology for community organizations and clinical facilities. Our flagship products — WellFit (community wellness) and Envision Atlus (clinical care management) — demonstrate that domain expertise combined with AI governance can produce enterprise-grade software without traditional engineering teams. This course shares the methodology that made that possible.

---

*Syllabus version 1.0 — Subject to minor adjustments based on cohort needs.*
*Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.*
