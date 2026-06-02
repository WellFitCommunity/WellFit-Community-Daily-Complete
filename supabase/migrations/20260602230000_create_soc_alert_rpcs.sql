-- Create the 4 SOC-dashboard RPCs that socDashboardService.ts calls but that did not exist
-- in the live DB (RPC drift — found by the codebase-wide .rpc() scan). The SOC dashboard's
-- acknowledge / resolve / assign / add-message actions all errored at runtime until now.
--
-- Tables already exist (security_alerts, soc_alert_messages). status CHECK enum is
-- new|investigating|resolved|false_positive|escalated (no 'acknowledged' → ack maps to
-- 'investigating'). All four are admin-gated, tenant-scoped, SECURITY DEFINER + search_path.
-- auth.uid()/get_current_tenant_id() reflect the CALLER even under SECURITY DEFINER.

-- Acknowledge → mark as being investigated. Returns true if a row in the caller's tenant matched.
CREATE OR REPLACE FUNCTION public.acknowledge_security_alert(p_alert_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (is_super_admin() OR is_tenant_admin()) THEN
    RAISE EXCEPTION 'Not authorized to acknowledge security alerts';
  END IF;
  UPDATE public.security_alerts
     SET status = 'investigating', updated_at = now()
   WHERE id = p_alert_id
     AND (tenant_id = get_current_tenant_id() OR is_super_admin());
  RETURN FOUND;
END;
$$;

-- Resolve → status resolved + resolution note + resolution_time.
CREATE OR REPLACE FUNCTION public.resolve_security_alert(p_alert_id uuid, p_resolution text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (is_super_admin() OR is_tenant_admin()) THEN
    RAISE EXCEPTION 'Not authorized to resolve security alerts';
  END IF;
  UPDATE public.security_alerts
     SET status = 'resolved',
         resolution_notes = p_resolution,
         resolution_time = now(),
         updated_at = now()
   WHERE id = p_alert_id
     AND (tenant_id = get_current_tenant_id() OR is_super_admin());
  RETURN FOUND;
END;
$$;

-- Assign → set assignee + who/when assigned.
CREATE OR REPLACE FUNCTION public.soc_assign_alert(p_alert_id uuid, p_assignee_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (is_super_admin() OR is_tenant_admin()) THEN
    RAISE EXCEPTION 'Not authorized to assign security alerts';
  END IF;
  UPDATE public.security_alerts
     SET assigned_to = p_assignee_id,
         assigned_at = now(),
         assigned_by = auth.uid(),
         updated_at = now()
   WHERE id = p_alert_id
     AND (tenant_id = get_current_tenant_id() OR is_super_admin());
  RETURN FOUND;
END;
$$;

-- Add a message/note to an alert thread. Returns the inserted row (the service uses it).
CREATE OR REPLACE FUNCTION public.soc_add_alert_message(
  p_alert_id uuid,
  p_content text,
  p_message_type text DEFAULT 'comment'
)
RETURNS public.soc_alert_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.soc_alert_messages;
BEGIN
  IF NOT (is_super_admin() OR is_tenant_admin()) THEN
    RAISE EXCEPTION 'Not authorized to comment on security alerts';
  END IF;
  -- Only allow commenting on an alert the caller can see (tenant-scoped / super admin).
  IF NOT EXISTS (
    SELECT 1 FROM public.security_alerts
     WHERE id = p_alert_id
       AND (tenant_id = get_current_tenant_id() OR is_super_admin())
  ) THEN
    RAISE EXCEPTION 'Alert not found in tenant scope';
  END IF;

  INSERT INTO public.soc_alert_messages (alert_id, content, message_type, author_id)
  VALUES (p_alert_id, p_content, COALESCE(p_message_type, 'comment'), auth.uid())
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
