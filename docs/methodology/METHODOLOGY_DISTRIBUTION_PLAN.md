# Methodology Distribution Plan

> **Purpose:** Turn the CLAUDE.md governance methodology into something other people can pick up and use with one click/command. Prepared 2026-04-21 during strategic planning for the Anthropic pivot.
>
> **Context:** Claude recommended Maria make the methodology "accessible" so it could be called from somewhere. This document spells out three concrete paths, ranked easiest to hardest.

---

## The key insight

**The seed prompt IS the reproducibility key.**

When Maria tells Claude (Opus):

> *"This is a TypeScript + Supabase + Vercel project. Write down all the frequent AI errors and mistakes you make for this stack, and the proper way to do each. Here are my core rules: I have time to do it right but not time to do it twice. No skimming. Do not hallucinate. Do not fabricate information. Do not fake citations. Do not do workarounds. Absolutely no shortcuts."*

…Claude self-generates a stack-aware `CLAUDE.md` + rules library from that seed. That's why the methodology works across domains (healthcare, construction, ministry, consumer wellness) — Maria isn't hardcoding rules for a domain, she's scaffolding a framework that auto-generates rules for any stack.

So "making it accessible" is really just: package the seed prompt, the core rules, and the template files so anyone can pick them up with one click.

---

## The three ways, easiest to hardest

### 1. GitHub Template Repository — ~1 hour of work

**Recommended starting point.**

Structure:

```
envision-governance-starter/
├── SEED_PROMPT.md          # The actual seed prompt, ready to paste into Opus
├── CORE_RULES.md           # Time-to-do-it-right / no-skimming / no-hallucinating / no-workarounds
├── CLAUDE.md               # Template with placeholders for stack-specific content
├── .claude/
│   ├── settings.json       # Hooks pre-wired
│   └── rules/
│       └── README.md       # What goes here, what the seed prompt generates
├── docs/
│   └── PROJECT_STATE.md    # Session-handoff template
└── README.md               # Usage instructions
```

**Setup:**
1. Create the repo on GitHub (can be done entirely from the GitHub web UI)
2. Commit the file structure above
3. Settings → check "Template repository"
4. Share the URL

**How users use it:**
1. Click "Use this template" button on the repo
2. Get their own copy of the repo, pre-populated
3. Paste `SEED_PROMPT.md` into Claude Opus
4. Opus generates stack-specific `CLAUDE.md` + rules files
5. Commit the generated files
6. Start building with Claude Code — governance active from turn one

**Effort:** Afternoon of work. Zero infrastructure. Shareable immediately.

---

### 2. NPX Installer — ~half day of work

For people who prefer command-line scaffolding.

```bash
npx create-envision-governance my-new-project
```

Prompts for:
- Project name
- Stack (TypeScript + Supabase + Vercel, Python + Django + Postgres, etc.)
- Whether to initialize git + push to a new GitHub repo
- Whether to include hooks (yes by default)

Scaffolds the files into the target directory. Claude Code can build this for you in a few hours.

**Distribution:** Publish to npm registry (free, public). One command anywhere.

---

### 3. MCP Server — 1–2 days of work

**Most Anthropic-aligned option.** Uses MCP (Anthropic's protocol) to distribute the governance pattern.

An MCP server exposing tools like:
- `init_governance_project(stack, project_name)` — scaffolds governance files into a directory
- `generate_rules_for_stack(stack)` — generates stack-specific rule files
- `add_rule_to_project(project_path, rule_name, content)` — extends existing project

Any Claude instance (Claude Desktop, Claude Code, Claude API) can call these tools. The user says *"initialize a governance-protected TypeScript Supabase project"* and Claude does it via the MCP call.

**Distribution:** Published to a public MCP server registry (if/when one exists) or distributed via GitHub + install instructions.

---

## Recommended sequence

| Step | When | Effort | Output |
|------|------|--------|--------|
| 1. Ship GitHub Template Repo | Next week (or this weekend if time) | 1 hour | Public URL to share |
| 2. Post about it on LinkedIn | Day of launch | 30 min | Early signal / first users |
| 3. Build NPX installer | Once template gets positive response | ~half day | More polished distribution |
| 4. Build MCP server | For Anthropic hackathon OR as follow-up to the cold outreach | 1–2 days | Killer demo for Anthropic audience |

---

## The hackathon bonus

The dorm-room app is the hackathon's primary deliverable. But if the MCP server is built in advance, Maria can use it to bootstrap the project ON STAGE in ~30 seconds:

> *"Before I write a line of code, my governance MCP server is going to spin up the project with enterprise-grade rules in place."*
>
> *[runs command — files scaffold in real time]*
>
> *"Now Claude Code starts with governance active from turn one. That's how I built a HIPAA-grade platform in nine months for $645 with no engineering staff. This pattern is reproducible."*

That's two demos in one project:
- **The what:** a working dorm-room app
- **The how:** the governance methodology, distributable to anyone

---

## Why nobody else has shipped this yet

Structural reasons, not a mystery:

1. **The frame is still new.** Most developers treat Claude as autocomplete, not as a system to govern. The idea of a control structure *over* the AI hasn't sunk in yet at scale.

2. **Rare skill combination required.** Domain expertise + AI experience + systems thinking + documentation discipline. Most people have one or two of those. Rarely all four in one person.

3. **Engineers have "not invented here" syndrome.** They'll acknowledge the pattern and then reinvent it for themselves instead of adopting someone else's template. So the market isn't primarily "engineers" — it's *non-engineers who want to build* AND *engineers under time pressure*.

4. **Early-mover risk.** Some builders hesitate to ship a canonical governance framework because Anthropic hasn't officially endorsed one. Being first is an advantage if you move before they publish their own answer.

5. **We're still early in Claude Code adoption.** Widely used since 2024–2025. Best practices are still being discovered. The codification phase hasn't happened yet. Maria is trying to do the codification — that's the gap.

**Conclusion:** Being first here is an advantage, not a risk. The GitHub template is 1 hour of work. Ship it when you're next at your desk.

---

## Action items (for Maria when back at desk)

- [ ] Create `envision-governance-starter` repo on GitHub (public)
- [ ] Copy SEED_PROMPT.md content — the TS/Supabase/Vercel seed you already use verbatim
- [ ] Copy CORE_RULES.md — the time-to-do-it-right / no-skimming / no-hallucinating list you use verbatim
- [ ] Adapt CLAUDE.md template — generic version with placeholders (NOT the healthcare-specific one)
- [ ] Add `.claude/settings.json` with hooks (copy from current project, genericize)
- [ ] Write README.md with clear usage steps
- [ ] Enable "Template repository" in GitHub settings
- [ ] Share URL on LinkedIn with short story of why
- [ ] (Later) decide whether to build NPX + MCP server

---

*Prepared 2026-04-21 by Claude Opus 4.7 (1M context) during a mobile session with Maria. Saved to disk, not committed. Reference back when ready.*
