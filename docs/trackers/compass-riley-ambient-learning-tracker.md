# Compass Riley — Ambient Learning & Physician Intuition Engine

> **Purpose:** Transform Riley from a reactive transcription assistant into an intuitive clinical partner that learns each physician's voice, clinical style, documentation patterns, and workflow preferences — then silently adapts without being told.

**Total Estimated Sessions:** 4
**Priority:** After Compass Riley V2 Reasoning Modes (COMPLETE)
**Started:** 2026-03-01
**Design Origin:** Gap analysis 2026-03-01 (Maria + Claude Opus 4.6)

---

## Core Philosophy

> "Riley should feel like a resident who's been working with this attending for six months — they know how the doc thinks, talks, and documents before being told."

- **Reactive learning** (what exists now): Provider teaches corrections manually, Riley memorizes.
- **Intuitive learning** (what this tracker builds): Riley observes patterns silently, adapts output automatically, and gets better at predicting what the physician wants.
- **No prompting required.** The physician never has to say "Riley, I prefer short notes." Riley observes 5 sessions of short note edits and adjusts.
- **Specialty-aware.** A cardiologist's Riley is different from a neurologist's Riley — terminology, documentation style, differential depth all adapt to clinical domain.
- **Progressive confidence.** Riley starts generic, gets specific over time, and shows the physician it's learning (milestone celebrations, accuracy gains).

---

## The Behavioral Contract

1. Riley starts in "generic mode" for new physicians — safe, neutral, balanced.
2. Every session generates learning signals: corrections made, edits to SOAP notes, section interactions, session duration, terminology used.
3. After 5+ sessions, Riley begins silently adapting: terminology predictions, SOAP note structure, assistance level suggestions.
4. After 20+ sessions, Riley feels "tuned" — the physician notices fewer corrections needed, notes match their style.
5. After 50+ sessions, Riley is "fully adapted" — a milestone celebration fires.
6. **The physician can always override.** Adaptive behavior is a suggestion layer, not a mandate.
7. **Learning is transparent.** The physician can see what Riley has learned about them (corrections, style profile, workflow patterns) and delete any of it.

---

## Current State — What Exists

### Working End-to-End
| Feature | Files | Status |
|---------|-------|--------|
| Voice correction learning (manual) | `voiceLearningService.ts`, `VoiceCorrectionModal.tsx`, `audioProcessor.ts` | **Connected** |
| Corrections applied to transcripts | `audioProcessor.ts:218` | **Connected** |
| Assistance level preferences | `useScribePreferences.ts`, `AssistanceLevelControl.tsx` | **Connected** |
| Workflow mode switching | `WorkflowModeSwitcher.tsx`, `physician_workflow_preferences` table | **Connected** |
| Session feedback collection | `SessionFeedback.tsx`, `scribeFeedbackService.ts` | **Connected** |

### Built But Disconnected (Dead Code)
| Feature | Files | Problem |
|---------|-------|---------|
| VoiceLearningProgress UI | `VoiceLearningProgress.tsx` | Never imported/rendered |
| VoiceProfileMaturity UI | `VoiceProfileMaturity.tsx` | Only in transparency dashboard |
| `updateVoiceProfile()` edge function call | `aiTransparencyService.ts:169` | Exported, never called |
| `updateAccuracy()` | `voiceLearningService.ts:353` | Never called |
| `reinforceCorrection()` | `voiceLearningService.ts:326` | Never called |
| `decayOldCorrections()` | `voiceLearningService.ts:290` | Never called |
| Server-side maturity scoring | `update-voice-profile/index.ts` | Edge function never invoked |
| Milestone celebrations | `ai_learning_milestones` table | Computed but never displayed |
| Smart section ordering | `get_smart_section_order()` SQL function | Exists but UI doesn't call it |

### Does Not Exist Yet
| Feature | Why It Matters |
|---------|---------------|
| Clinical style profiling | Riley doesn't know if this doc writes terse or verbose notes |
| Specialty-aware terminology | Cardiology vs neurology corrections treated identically |
| SOAP note style learning | No observation of edit patterns after Riley generates notes |
| Auto-calibrating assistance | Manual Concise/Balanced/Detailed only — no auto-adjustment |
| Dictation cadence adaptation | No learning of speaking speed, pause patterns, dictation vs conversation |
| Session pattern recognition | No learning of typical encounter length per physician |
| Proactive correction suggestions | After seeing same error 3x, Riley should ask instead of waiting |

---

## Session Map

| Session | Focus | Deliverables | Status |
|---------|-------|-------------|--------|
| 1 | Wire Disconnected Features | Connect all dead code, fire `update-voice-profile`, render learning progress, activate milestone celebrations | **DONE** (2026-03-01) |
| 2 | Clinical Style Profiler | Observe SOAP note edits, build physician style profile, specialty-aware terminology | **IN PROGRESS** — code complete, needs migrations + tests |
| 3 | Intuitive Adaptation Engine | Auto-calibrating assistance, proactive correction suggestions, dictation cadence | TODO |
| 4 | Testing & Verification | Behavioral tests, learning progression scenarios, edge cases | TODO |

---

## Session 1: Wire Disconnected Features (~4 hours)

**Goal:** Everything that's built actually runs. No more dead code in the ambient learning pipeline.

### Deliverables

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 1.1 | Call `updateVoiceProfile` edge function at end of each scribe session — send session duration, corrections count, learned phrases, terminology | `useSmartScribe.ts` | **DONE** |
| 1.2 | Call `updateAccuracy()` with session accuracy at recording stop | `useSmartScribe.ts` | **DONE** |
| 1.3 | Call `reinforceCorrection()` when a correction is successfully applied during transcription | `audioProcessor.ts` | **DONE** |
| 1.4 | Call `decayOldCorrections()` on voice profile load (once per session, if last decay > 24 hours) | `useSmartScribe.ts` | **DONE** |
| 1.5 | Render `VoiceLearningProgress` in the scribe UI (compact mode during recording, detailed in session summary) | `RealTimeSmartScribe.tsx` | **DONE** |
| 1.6 | Display milestone celebrations when `update-voice-profile` returns new milestones (toast/confetti/modal) | `RealTimeSmartScribe.tsx` | **DONE** |
| 1.7 | Wire smart section ordering — skipped (dashboard concern, not scribe pipeline) | — | **SKIPPED** |

---

## Session 2: Clinical Style Profiler (~6 hours)

**Goal:** Riley observes how each physician actually documents and builds a style fingerprint.

### Deliverables

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 2.1 | SOAP Note Edit Observer — detect when physician edits a generated SOAP note (diff between generated and final saved version) | `soapNoteEditObserver.ts` (236 lines) | **DONE** |
| 2.2 | Style fingerprint extraction — from edit diffs, extract patterns: verbosity preference (word count delta), section emphasis (which sections get expanded/reduced), terminology replacements (Riley said X, doc changed to Y) | `physicianStyleProfiler.ts` (376 lines) | **DONE** |
| 2.3 | Physician style profile table — store per-provider: preferred_verbosity (measured, not manual), section_emphasis map, terminology_overrides, avg_note_length, documentation_speed | Migration `20260302000001_physician_style_profiles.sql` + `20260302000000_add_physician_edited_soap.sql` | **DONE** (migration files created, NOT yet pushed to DB) |
| 2.4 | Specialty-aware terminology prioritization — tag corrections with medical domain, weight specialty-relevant corrections higher in `applyCorrections()` | `voiceLearningService.ts` | **DONE** |
| 2.5 | Style profile display — show physician what Riley has learned about their documentation style (read-only, transparent) | `PhysicianStyleProfile.tsx` (225 lines), `EditableSOAPNote.tsx` (314 lines) | **DONE** |
| 2.6 | AI SOAP Note Generator decomposition — split god file into focused modules | `ai-soap-note-generator/{types,contextGatherer,promptBuilder,responseNormalizer,usageLogger}.ts` | **DONE** |

---

## Session 3: Intuitive Adaptation Engine (~6 hours)

**Goal:** Riley silently adapts its behavior based on accumulated learning signals.

### Deliverables

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 3.1 | Auto-calibrating assistance — if physician's style profile shows consistent verbosity preference, suggest or auto-adjust assistance level after 10+ sessions (with one-time confirmation) | `useScribePreferences.ts`, `physicianStyleProfiler.ts` | TODO |
| 3.2 | Proactive correction suggestions — if same transcription error appears 3+ times without manual correction, surface a "Did Riley hear this wrong?" prompt | `audioProcessor.ts`, new: `proactiveCorrectionDetector.ts` | TODO |
| 3.3 | Session pattern learning — track average encounter duration per physician, use to optimize when to trigger mid-encounter analysis vs end-of-encounter | `useSmartScribe.ts`, `physician_style_profiles` table | TODO |
| 3.4 | Dictation cadence awareness — detect speaking speed and pause patterns to improve transcript segmentation (metadata only — no audio storage) | `audioProcessor.ts` | TODO |
| 3.5 | Adaptive SOAP note generation — pass physician style profile to SOAP note edge function so generated notes match physician's preferred structure/verbosity from the start | `ai-soap-note-generator` edge function, `reasoningIntegration.ts` | TODO |

---

## Session 4: Testing & Verification (~4 hours)

**Goal:** Comprehensive behavioral tests for the full learning pipeline.

### Deliverables

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 4.1 | Voice learning lifecycle tests — correction learned, applied, reinforced, decayed | New test file | TODO |
| 4.2 | Maturity progression tests — training → maturing → fully_adapted with correct score boundaries | New test file | TODO |
| 4.3 | Style profiler tests — edit diffs produce correct fingerprint, verbosity measured accurately | New test file | TODO |
| 4.4 | Specialty-aware correction tests — domain-tagged corrections weighted appropriately | New test file | TODO |
| 4.5 | Auto-calibration tests — assistance level suggestion triggers at correct thresholds, respects provider override | New test file | TODO |
| 4.6 | Edge cases — new physician (no history), physician switching specialties, profile reset/deletion, cross-device sync | New test file | TODO |
| 4.7 | Verification checkpoint — `npm run typecheck && npm run lint && npm test` | — | TODO |

---

## Database Tables (Existing + New)

### Existing (Used by This Tracker)
| Table | Purpose | Owner |
|-------|---------|-------|
| `voice_profiles` | Maturity scores, session counts, learned terms | Shared |
| `provider_voice_profiles` | Client-side voice corrections (IndexedDB sync target) | Shared |
| `provider_scribe_preferences` | Assistance level, verbosity | Shared |
| `physician_workflow_preferences` | Mode, section order, pinned sections | Clinical |
| `physician_section_interactions` | Interaction logging (view/expand/collapse) | Clinical |
| `ai_learning_milestones` | Achievement tracking + celebration type | Shared |
| `ai_confidence_scores` | Provider validation of AI suggestions | Shared |
| `scribe_session_feedback` | Session quality feedback | Shared |

### New (Session 2)
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `physician_style_profiles` | Learned documentation patterns per provider | `provider_id`, `preferred_verbosity_measured`, `avg_note_word_count`, `section_emphasis JSONB`, `terminology_overrides JSONB`, `specialty_detected`, `sessions_analyzed`, `last_analyzed_at` |

---

## The Intuition Progression

| Sessions | Riley's State | What Changes |
|----------|--------------|-------------|
| 0 | Generic | Default balanced mode, no corrections, no personalization |
| 1-5 | Observing | Learning word corrections, tracking session patterns, building baseline accuracy |
| 5-10 | Adapting | Applying corrections automatically, showing learning progress badge, suggesting terminology |
| 10-20 | Proficient | Style profile active, SOAP notes match physician's preferred structure, assistance level auto-suggested |
| 20-50 | Expert | Proactive correction suggestions, specialty-tuned terminology, workflow optimized |
| 50+ | Fully Adapted | Riley feels like a trained scribe who knows this physician — minimal corrections, notes match style, workflow is automatic |

---

## Dependencies

- Compass Riley V2 Reasoning Modes (COMPLETE)
- `voiceLearningService.ts` (existing)
- `update-voice-profile` edge function (existing)
- `ai-soap-note-generator` edge function (existing — Session 3.5 adds style input)
- `useScribePreferences.ts` (existing)
- `physician_workflow_preferences` table (existing)

---

## Pitch-Ready Summary

> "Riley doesn't just transcribe — Riley learns. After 10 sessions, Riley knows your voice. After 20, Riley knows your documentation style. After 50, Riley is a trained scribe who anticipates how you think, document, and practice medicine. Same system, personalized intelligence."
