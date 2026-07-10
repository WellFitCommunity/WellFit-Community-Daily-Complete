-- Caregiver-contacts boundary-layer view (B1 fix for the 2026-07-10 MCP schema
-- drift triage — docs/trackers/mcp-schema-drift-triage-2026-07-10.md).
--
-- The patient-context spine's contacts fetcher queried caregiver_view_grants for
-- contact columns it does NOT have. Two distinct concepts were conflated:
--   * caregiver_view_grants = the ACCESS-GRANT edge (caregiver_user_id,
--     senior_user_id, expires_at, last_used_at) — the caregiver's own login /
--     read-only monitoring grant. NOT a contact record.
--   * profiles.caregiver_* = the senior's PRIMARY emergency caregiver contact.
--
-- This view gives "more than one way to reach caregiver info" as a single
-- surface, per the caregiver model:
--   (1) the senior's own profile primary caregiver, and
--   (2) every caregiver who holds an ACTIVE view-grant, resolved to that
--       caregiver's own profile (name/phone/email).
--
-- security_invoker = on: the caller's RLS on profiles + caregiver_view_grants is
-- enforced (tenant isolation + role gating travel with the read). Governance §3
-- (views are the boundary layer) + §2a (RLS does NOT grant — GRANT is below).
-- Forward-only; no `-- migrate:down` block (db push executes down blocks).

CREATE OR REPLACE VIEW public.v_patient_caregiver_contacts
WITH (security_invoker = on) AS
-- (1) Primary caregiver from the senior's own profile.
SELECT
  p.user_id                                                                        AS senior_user_id,
  p.tenant_id                                                                      AS tenant_id,
  NULLIF(TRIM(CONCAT_WS(' ', p.caregiver_first_name, p.caregiver_last_name)), '')  AS caregiver_name,
  p.caregiver_relationship                                                         AS relationship,
  p.caregiver_phone                                                                AS phone,
  p.caregiver_email                                                                AS email,
  true                                                                             AS is_primary
FROM public.profiles p
WHERE COALESCE(p.caregiver_first_name, p.caregiver_last_name,
               p.caregiver_phone, p.caregiver_email) IS NOT NULL

UNION ALL

-- (2) Additional caregivers holding an ACTIVE view-grant, resolved to their own profile.
SELECT
  g.senior_user_id                                                                 AS senior_user_id,
  g.tenant_id                                                                      AS tenant_id,
  NULLIF(TRIM(CONCAT_WS(' ', cg.first_name, cg.last_name)), '')                    AS caregiver_name,
  NULL::text                                                                       AS relationship,
  cg.phone                                                                         AS phone,
  cg.email                                                                         AS email,
  false                                                                            AS is_primary
FROM public.caregiver_view_grants g
JOIN public.profiles cg ON cg.user_id = g.caregiver_user_id
WHERE g.expires_at IS NULL OR g.expires_at > now();

COMMENT ON VIEW public.v_patient_caregiver_contacts IS
  'Caregiver contacts per senior: profile primary (is_primary=true) + active view-grant holders (is_primary=false). security_invoker; filter by senior_user_id.';

-- GRANT (mandatory — RLS does NOT grant privileges; supabase.md §2a).
GRANT SELECT ON public.v_patient_caregiver_contacts TO authenticated;
