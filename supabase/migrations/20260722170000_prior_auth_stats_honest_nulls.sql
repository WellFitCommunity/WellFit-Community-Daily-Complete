-- Honest NULLs for get_prior_auth_statistics (fabricated-compliance-value class)
--
-- Found 2026-07-22 when Maria's browser session crashed PriorAuthDashboard:
-- with zero prior-auth data the RPC returned avg_response_hours = NULL (the
-- .toFixed crash) while FABRICATING approval_rate = 0 and, worse,
-- sla_compliance_rate = 100 — a dashboard claiming perfect SLA compliance
-- with no data, same class as the killed 85% adherence (20260714110000) and
-- fabricated-50 member scores (20260714120000). Rates are now NULL when the
-- denominator is zero; the UI renders "—".
--
-- Forward-only; no `-- migrate:down` block (db push executes down blocks — documented footgun).

CREATE OR REPLACE FUNCTION public.get_prior_auth_statistics(
  p_tenant_id uuid,
  p_start_date date DEFAULT (CURRENT_DATE - '30 days'::interval),
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  total_submitted bigint,
  total_approved bigint,
  total_denied bigint,
  total_pending bigint,
  approval_rate numeric,
  avg_response_hours numeric,
  sla_compliance_rate numeric,
  by_urgency jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(*) FILTER (WHERE status != 'draft') AS submitted,
      COUNT(*) FILTER (WHERE status = 'approved') AS approved,
      COUNT(*) FILTER (WHERE status = 'denied') AS denied,
      COUNT(*) FILTER (WHERE status IN ('submitted', 'pending_review', 'pending_additional_info')) AS pending,
      AVG(response_time_hours) FILTER (WHERE response_time_hours IS NOT NULL) AS avg_response,
      COUNT(*) FILTER (WHERE sla_met = true) AS sla_met_count,
      COUNT(*) FILTER (WHERE sla_met IS NOT NULL) AS sla_total
    FROM prior_authorizations
    WHERE tenant_id = p_tenant_id
      AND created_at >= p_start_date
      AND created_at <= p_end_date + INTERVAL '1 day'
  ),
  urgency_stats AS (
    SELECT jsonb_object_agg(
      urgency::TEXT,
      jsonb_build_object(
        'total', total,
        'approved', approved,
        'denied', denied
      )
    ) AS by_urgency
    FROM (
      SELECT
        urgency,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'approved') AS approved,
        COUNT(*) FILTER (WHERE status = 'denied') AS denied
      FROM prior_authorizations
      WHERE tenant_id = p_tenant_id
        AND created_at >= p_start_date
        AND created_at <= p_end_date + INTERVAL '1 day'
      GROUP BY urgency
    ) u
  )
  SELECT
    s.submitted,
    s.approved,
    s.denied,
    s.pending,
    -- NULL (not 0) when nothing was submitted — no data is not a 0% approval rate
    CASE WHEN s.submitted > 0 THEN ROUND((s.approved::NUMERIC / s.submitted) * 100, 2) ELSE NULL END,
    ROUND(s.avg_response, 2),
    -- NULL (not 100) when no SLA outcomes exist — never fabricate perfect compliance
    CASE WHEN s.sla_total > 0 THEN ROUND((s.sla_met_count::NUMERIC / s.sla_total) * 100, 2) ELSE NULL END,
    COALESCE(u.by_urgency, '{}'::JSONB)
  FROM stats s
  CROSS JOIN urgency_stats u;
END;
$function$;
