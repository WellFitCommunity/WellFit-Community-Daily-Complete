# Envision Atlus — Clinical Visual Identity Direction

> **Status:** Direction captured 2026-07-11 (conversation with Maria). **Not yet executed.** This is the "what we're going for" doc to revisit. Top of Maria's list.
>
> **Governance rules for this are already written but HELD (uncommitted)** — see "State of Work" at the bottom. Nothing was committed; nothing in the product UI was changed yet.

---

## The problem Maria named

The **clinical side (Envision Atlus / System B)** currently looks childish and scattered:

- **Childish:** decorative emojis are baked into clinical screens — e.g. `RiskAssessmentForm.tsx` has section headers like `🚽 Bathroom Independence`, `🍽️ Daily Living Activities`, `🏥 Medical Risk`; dashboards use `StatCard icon="🚨"`. A nurse documenting fall risk should not be looking at a toilet emoji.
- **Scattered ("like an AI built it"):** every screen was generated in a different session, each reaching for its own defaults — its own spacing, headers, colors, emoji habit. The result is ~47 "electrified views" that each look okay alone but don't agree with each other. That patchwork *is* the AI-built tell.

**Root cause (both symptoms, one disease):** screens were built *individually* instead of *from one enforced design system*. The EA design system exists (`src/components/envision-atlus/`) but isn't enforced, so half the admin screens freelance their own look and bypass it. Emojis appear *because* they were hand-added on screens that skipped the system.

**Scope (measured 2026-07-11):** ~300 emoji lines across **47 non-test clinical files**, concentrated in `src/components/admin/` dashboards and forms. `bed-board/` and `smart-app/` are essentially clean.

---

## The distinction that must not get lost

Emojis are **not banned everywhere.** They are a **WellFit Community (System A) design element** and stay there — seniors, engagement, gamification, warmth. That's a deliberate product choice, not a mistake.

The ban is **only on the clinical side (System B).**

And even on the clinical side, there's a finer line (Maria, 2026-07-11):

| Keep | Remove |
|---|---|
| Deliberate, **designed moments of delight at a real milestone** — e.g. the celebratory animation nurses see when a **shift handoff completes**. A scoped UX reward on a workflow event. | **Decorative emoji glyphs baked into the data/instrument face** — StatCard icons, metric tiles, section headers, form labels, buttons. |

**The line:** *decoration on the data = no; a chosen animation at a completion milestone = yes.*

---

## The design target (Maria's words)

Three-way target — the hard, valuable middle, not either extreme:

1. **Not childish** — no toys on the instrument.
2. **Mature / grown / healthcare-grade** — a clinician and a compliance officer look at it and trust it. "Serious contenders. Not just playing around. This is not a game."
3. **Not everybody else's** — NOT the cold, sterile, gray Epic/Cerner sameness. Distinctive. Has its own identity.

The feeling Maria wants (as articulated so far):
> "Warm, but professional. Not childish, but not over-sterile."

The **alive middle** — human, not cartoon and not corpse. Warmth that comes from *color temperature, breathing room, plain language, and earned moments* — not from decoration.

**⚠️ OPEN — needs Maria's word:** the north-star *feeling word* didn't come through clean in transcription ("a lot of **lieutenant**, but professional"). Maria to confirm the actual word. That word is the north star everything else gets built to serve. → **FILL THIS IN:** ____________

---

## The trap to avoid

Most teams reach "serious/mature" by **subtraction** — strip the color, flatten to gray tables and blue links. That gets you #1 and #2 but lands straight in #3's problem: you look like every other hospital system. Indistinguishable. Forgettable.

Serious **and** distinctive does **not** come from removing decoration. It comes from a **designed point of view** that decoration was standing in for — craft: deliberate typography, a disciplined color system, generous spacing, purposeful iconography (not emoji), and motion used rarely and meaningfully (which the handoff animation already does right).

---

## Uniformity = the same fix as maturity

"Envision needs to have **a look**. The dashboards, in whatever deployment, need that look — not scattered."

You don't achieve a uniform, grown look **screen-by-screen.** You achieve it by making **one design system the mandatory single source of visual truth**, and every screen is forced through it:

- one color system
- one type scale
- one spacing rhythm
- one badge, one alert, one card
- one way to show "critical"

When everything routes through that, the whole thing snaps into a single voice automatically, and the emojis disappear because they were never *in* the system.

**The vehicle already exists:** the EA design system (`src/components/envision-atlus/`). It isn't missing — it's **unenforced.** "Envision having a look" = making EA the required source of visual truth so no screen freelances.

---

## The through-line: this is literally the product's name

**ATLUS = Accountable Technology Leading in Unity and Service.**

- **Unity** → one look, every deployment. "Leading in Unity" is the design mandate made visible.
- **Accountable** → every number traceable, every state legible.
- **Service** → built for the person using it, not to impress a demo.

The design goal and the product's own name are the same statement. The distinctiveness comes from being *principled*, not decorated.

---

## Next steps (when Maria picks this back up)

1. **Confirm the north-star feeling word** (the "lieutenant" transcription gap above).
2. **Decide what the single "Envision look" is actually defined by** — the concrete tokens: color palette (warm off-whites vs stark white, the signature accent vs default hospital blue), type scale, spacing rhythm, iconography set, motion rules. *Not yet decided — this is the real design work.*
3. **Audit where EA is vs isn't enforced** across the 47 clinical files — which screens bypass the design system.
4. **Cleanup pass** — swap emoji glyphs → EA badge/icon components, screen by screen. Est. ~1–2 sessions. Per the visual-acceptance rule, **each screen needs Maria's eyes** after.
5. **Then** commit the governance rules + the cleanup together.

---

## State of Work (as of 2026-07-11 — all HELD, nothing committed)

Written but **not committed** (per Maria: "hold on to it"):

- `CLAUDE.md` → **Commandment #22**: no decorative emojis on clinical surfaces, *with* the milestone-animation exception.
- `.claude/rules/governance-boundaries.md` → new **"Aesthetic Boundary — Emojis Are a System A Design Element"** section + a Forbidden-table row. Names where the ban applies (System B: `admin/`, `bed-board/`, `smart-app/`, `sections/`, shared EA components) and where emojis stay (System A: `community/`, `check-in/`).

**No product UI code has been changed. No commits made.** Resume by confirming direction, then decide: land the governance rules alone, or hold them to ride with the cleanup.
