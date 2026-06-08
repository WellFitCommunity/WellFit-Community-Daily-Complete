# `ml/analysis/` — Read-Only Scoped Analysis Harness (Phase 1)

Reads features from Supabase **through the same RLS boundary the app uses** (anon/user
key, never service-role bypass — `.claude/rules/python.md` §4), minimum-necessary +
de-identified columns, writes nothing, logs via the audit shim and never logs PHI.

Produces the **data-readiness report** that gates Phase 2 (how much labeled outcome
data actually exists). Empty until Phase 1 starts.
