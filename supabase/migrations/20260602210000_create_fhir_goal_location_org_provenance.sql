-- Create the four FHIR R4 resource tables whose services existed but whose tables did NOT
-- (surfaced by scripts/check-fhir-service-schema.py, clinical adversarial audit Tier-1).
-- Per Maria 2026-06-02: CREATE the missing tables, do NOT delete the services
-- ("tables that exist are FEATURES"; same call as AV-2/fhir_medications).
--
-- Columns match each service's .select()/.insert() exactly so the existing
-- GoalService / LocationService / OrganizationService / ProvenanceService work unchanged.
--
-- RLS mirrors the established patterns verified against live policies:
--   * Patient PHI (fhir_goals, fhir_provenance)        -> like fhir_conditions (tenant-scoped)
--   * Catalog/global (fhir_locations, fhir_organizations) -> like fhir_medications (global read, admin write)
-- The PHI tables default tenant_id to get_current_tenant_id() so the services (which do not
-- pass tenant_id) still satisfy the INSERT WITH CHECK.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. fhir_goals — FHIR R4 Goal (patient-scoped)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fhir_goals (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id           uuid NOT NULL,
  lifecycle_status     text NOT NULL DEFAULT 'proposed',
  achievement_status   text,
  category             text[],
  priority             text,
  priority_code        text,
  description_code     text,
  description_display  text,
  description_text     text,
  start_date           date,
  target               jsonb,
  status_date          timestamptz,
  status_reason        text,
  expressed_by_id      uuid,
  expressed_by_display text,
  addresses            jsonb,
  note                 jsonb,
  tenant_id            uuid NOT NULL DEFAULT get_current_tenant_id(),
  created_by           uuid DEFAULT auth.uid(),
  updated_by           uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fhir_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY fhir_goals_select ON public.fhir_goals
  FOR SELECT USING ((tenant_id = get_current_tenant_id()) OR is_super_admin());
CREATE POLICY fhir_goals_insert ON public.fhir_goals
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());
CREATE POLICY fhir_goals_update ON public.fhir_goals
  FOR UPDATE USING ((tenant_id = get_current_tenant_id()) AND is_tenant_admin())
  WITH CHECK ((tenant_id = get_current_tenant_id()) AND is_tenant_admin());
CREATE POLICY fhir_goals_delete ON public.fhir_goals
  FOR DELETE USING ((tenant_id = get_current_tenant_id()) AND is_tenant_admin());
CREATE INDEX IF NOT EXISTS idx_fhir_goals_patient  ON public.fhir_goals(patient_id);
CREATE INDEX IF NOT EXISTS idx_fhir_goals_tenant   ON public.fhir_goals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fhir_goals_category ON public.fhir_goals USING gin(category);
CREATE TRIGGER trg_fhir_goals_updated_at BEFORE UPDATE ON public.fhir_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
COMMENT ON TABLE public.fhir_goals IS 'FHIR R4 Goal — patient health goals/targets. Created 2026-06-02 (clinical audit Tier-1: GoalService queried a non-existent table).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. fhir_provenance — FHIR R4 Provenance (patient-scoped audit trail)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fhir_provenance (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_references     text[],
  target_types          text[],
  target_patient_id     uuid,
  recorded              timestamptz NOT NULL DEFAULT now(),
  occurred_datetime     timestamptz,
  occurred_period_start timestamptz,
  occurred_period_end   timestamptz,
  activity              jsonb,
  agent                 jsonb,
  reason                jsonb,
  policy                jsonb,
  location              jsonb,
  entity                jsonb,
  signature             jsonb,
  tenant_id             uuid NOT NULL DEFAULT get_current_tenant_id(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fhir_provenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY fhir_provenance_select ON public.fhir_provenance
  FOR SELECT USING ((tenant_id = get_current_tenant_id()) OR is_super_admin());
CREATE POLICY fhir_provenance_insert ON public.fhir_provenance
  FOR INSERT WITH CHECK (tenant_id = get_current_tenant_id());
CREATE POLICY fhir_provenance_update ON public.fhir_provenance
  FOR UPDATE USING ((tenant_id = get_current_tenant_id()) AND is_tenant_admin())
  WITH CHECK ((tenant_id = get_current_tenant_id()) AND is_tenant_admin());
CREATE POLICY fhir_provenance_delete ON public.fhir_provenance
  FOR DELETE USING ((tenant_id = get_current_tenant_id()) AND is_tenant_admin());
CREATE INDEX IF NOT EXISTS idx_fhir_provenance_patient  ON public.fhir_provenance(target_patient_id);
CREATE INDEX IF NOT EXISTS idx_fhir_provenance_tenant   ON public.fhir_provenance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fhir_provenance_recorded ON public.fhir_provenance(recorded DESC);
CREATE INDEX IF NOT EXISTS idx_fhir_provenance_targets  ON public.fhir_provenance USING gin(target_references);
CREATE INDEX IF NOT EXISTS idx_fhir_provenance_agent    ON public.fhir_provenance USING gin(agent);
CREATE TRIGGER trg_fhir_provenance_updated_at BEFORE UPDATE ON public.fhir_provenance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
COMMENT ON TABLE public.fhir_provenance IS 'FHIR R4 Provenance — data-provenance/audit trail. Created 2026-06-02 (clinical audit Tier-1: ProvenanceService queried a non-existent table).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. fhir_locations — FHIR R4 Location (catalog/global)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fhir_locations (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status                      text NOT NULL DEFAULT 'active',
  name                        text NOT NULL,
  alias                       text[],
  description                 text,
  mode                        text,
  type                        text[],
  telecom                     jsonb,
  address                     jsonb,
  physical_type               text,
  position                    jsonb,
  managing_organization_id    uuid,
  managing_organization_display text,
  part_of_location_id         uuid,
  part_of_location_display    text,
  hours_of_operation          jsonb,
  availability_exceptions     text,
  tenant_id                   uuid DEFAULT get_current_tenant_id(),
  created_by                  uuid DEFAULT auth.uid(),
  updated_by                  uuid,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fhir_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY fhir_locations_select ON public.fhir_locations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY fhir_locations_insert ON public.fhir_locations
  FOR INSERT TO authenticated WITH CHECK (is_tenant_admin());
CREATE POLICY fhir_locations_update ON public.fhir_locations
  FOR UPDATE TO authenticated USING (is_tenant_admin()) WITH CHECK (is_tenant_admin());
CREATE POLICY fhir_locations_delete ON public.fhir_locations
  FOR DELETE TO authenticated USING (is_tenant_admin());
CREATE INDEX IF NOT EXISTS idx_fhir_locations_name   ON public.fhir_locations(name);
CREATE INDEX IF NOT EXISTS idx_fhir_locations_status ON public.fhir_locations(status);
CREATE INDEX IF NOT EXISTS idx_fhir_locations_type   ON public.fhir_locations USING gin(type);
CREATE TRIGGER trg_fhir_locations_updated_at BEFORE UPDATE ON public.fhir_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
COMMENT ON TABLE public.fhir_locations IS 'FHIR R4 Location — facility/location catalog. Created 2026-06-02 (clinical audit Tier-1: LocationService queried a non-existent table).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. fhir_organizations — FHIR R4 Organization (catalog/global)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fhir_organizations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  npi                 text,
  tax_id              text,
  ccn                 text,
  active              boolean NOT NULL DEFAULT true,
  type                text[],
  name                text NOT NULL,
  alias               text[],
  telecom             jsonb,
  address             jsonb,
  part_of_id          uuid,
  part_of_display     text,
  contact             jsonb,
  endpoint_references text[],
  tenant_id           uuid DEFAULT get_current_tenant_id(),
  created_by          uuid DEFAULT auth.uid(),
  updated_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fhir_organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY fhir_organizations_select ON public.fhir_organizations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY fhir_organizations_insert ON public.fhir_organizations
  FOR INSERT TO authenticated WITH CHECK (is_tenant_admin());
CREATE POLICY fhir_organizations_update ON public.fhir_organizations
  FOR UPDATE TO authenticated USING (is_tenant_admin()) WITH CHECK (is_tenant_admin());
CREATE POLICY fhir_organizations_delete ON public.fhir_organizations
  FOR DELETE TO authenticated USING (is_tenant_admin());
CREATE INDEX IF NOT EXISTS idx_fhir_organizations_name   ON public.fhir_organizations(name);
CREATE INDEX IF NOT EXISTS idx_fhir_organizations_npi    ON public.fhir_organizations(npi);
CREATE INDEX IF NOT EXISTS idx_fhir_organizations_active ON public.fhir_organizations(active);
CREATE TRIGGER trg_fhir_organizations_updated_at BEFORE UPDATE ON public.fhir_organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
COMMENT ON TABLE public.fhir_organizations IS 'FHIR R4 Organization — organization catalog. Created 2026-06-02 (clinical audit Tier-1: OrganizationService queried a non-existent table).';
