-- user_engagements had RLS policies (INSERT/UPDATE/SELECT, all `auth.uid() = user_id`)
-- but NO table GRANT to `authenticated` — the §2a RLS-without-GRANT footgun. So every
-- client-side engagement write (e.g. TechTip tech-tip feedback) hit
-- `permission denied for table user_engagements` (403) and was swallowed, so no
-- community engagement was ever recorded from the browser.
--
-- Grant exactly the verbs the existing policies cover (no DELETE policy → no DELETE grant).
-- Forward-only; no down block.
GRANT SELECT, INSERT, UPDATE ON public.user_engagements TO authenticated;
