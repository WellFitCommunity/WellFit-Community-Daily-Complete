-- Fix user_questions.status CHECK-constraint drift (found live 2026-07-10 while
-- live-proving the nurse-question-auto-escalate cron).
--
-- SYMPTOM: nurse-question-auto-escalate ran (authed 200) but EVERY escalation failed
--   with: new row for relation "user_questions" violates check constraint
--   "user_questions_status_check1".
--
-- ROOT CAUSE: user_questions.status carried TWO CHECK constraints simultaneously:
--   - user_questions_status_check   -> ('pending','claimed','answered','escalated','closed')  [correct]
--   - user_questions_status_check1  -> ('pending','answered','closed')                          [stale drift]
--   A row must satisfy BOTH, so the effective domain was the intersection
--   ('pending','answered','closed') — 'claimed' and 'escalated' could NEVER be written.
--
-- IMPACT (broader than the cron): the authoritative nurse-question system migration
--   (20260224100000_nurse_question_system.sql) explicitly defines the 5-value constraint
--   ("include 'claimed' and 'escalated'") and its RPCs write those statuses —
--   claim_question sets status='claimed', escalate_question sets status='escalated'.
--   The stale check1 silently broke the ENTIRE nurse claim + escalate workflow live,
--   not just the auto-escalation cron.
--
-- The stale check1 is not defined by any current forward migration that owns the
-- status domain; it is leftover drift (an unnamed inline CHECK added while
-- user_questions_status_check already existed -> Postgres auto-suffixed it _check1).
--
-- FIX: drop the stale duplicate; re-assert the authoritative 5-value constraint
-- idempotently so this file is the single source of truth for the status domain.
-- Zero row impact: all live rows are 'pending' or 'answered' (verified 2026-07-10),
-- both permitted by the retained constraint. Fully reversible (re-add check1) if ever
-- needed, but check1 is objectively wrong for this feature.
--
-- Forward-only; no `-- migrate:down` block (db push executes down blocks — documented footgun).

ALTER TABLE public.user_questions
  DROP CONSTRAINT IF EXISTS user_questions_status_check1;

-- Re-assert the authoritative domain (matches 20260224100000_nurse_question_system.sql).
ALTER TABLE public.user_questions
  DROP CONSTRAINT IF EXISTS user_questions_status_check;
ALTER TABLE public.user_questions
  ADD CONSTRAINT user_questions_status_check
  CHECK (status IN ('pending', 'claimed', 'answered', 'escalated', 'closed'));
