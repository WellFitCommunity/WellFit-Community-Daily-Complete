-- Tenant-derive triggers for the handoff-packet family
-- (tracker: docs/trackers/ems-and-hospital-transfer-repair-tracker-2026-07-22.md)
--
-- LIVE-PROBE FINDING (2026-07-22, authenticated-role round-trip probe): INSERT
-- into handoff_packets is RLS-rejected for every clinician. The table's two
-- permissive policies are admin_all (requires a user_roles admin row) OR
-- tenant match (tenant_id = get_current_tenant_id()) — but tenant_id is
-- nullable with NO default and NO writer sets it (HandoffService.createPacket
-- omits it), so the tenant gate can never pass. handoff_attachments and
-- handoff_logs have the same tenant-policy shape with the same unset column.
-- This is why the sender flow could never have worked even after the routes
-- were wired. Same defect class + same fix as the EMS tables (20260722120000).
--
-- Forward-only; no `-- migrate:down` block (db push executes down blocks — documented footgun).

-- Packets: tenant from the creating user
CREATE OR REPLACE FUNCTION public.derive_tenant_handoff_packet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := get_current_tenant_id();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.derive_tenant_handoff_packet() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_derive_tenant_handoff_packet ON public.handoff_packets;
CREATE TRIGGER trg_derive_tenant_handoff_packet
BEFORE INSERT ON public.handoff_packets
FOR EACH ROW EXECUTE FUNCTION public.derive_tenant_handoff_packet();

-- Attachments + logs: tenant from the parent packet (SECURITY DEFINER so the
-- parent read is not itself RLS-blocked), falling back to the caller's tenant
CREATE OR REPLACE FUNCTION public.derive_tenant_from_handoff_packet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM public.handoff_packets
    WHERE id = NEW.handoff_packet_id;
    IF NEW.tenant_id IS NULL THEN
      NEW.tenant_id := get_current_tenant_id();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.derive_tenant_from_handoff_packet() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_derive_tenant_handoff_attachment ON public.handoff_attachments;
CREATE TRIGGER trg_derive_tenant_handoff_attachment
BEFORE INSERT ON public.handoff_attachments
FOR EACH ROW EXECUTE FUNCTION public.derive_tenant_from_handoff_packet();

DROP TRIGGER IF EXISTS trg_derive_tenant_handoff_log ON public.handoff_logs;
CREATE TRIGGER trg_derive_tenant_handoff_log
BEFORE INSERT ON public.handoff_logs
FOR EACH ROW EXECUTE FUNCTION public.derive_tenant_from_handoff_packet();
