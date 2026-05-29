-- =============================================================================
-- ONC 170.315(a)(12) — Family Health History (FHIR FamilyMemberHistory)
-- =============================================================================
-- Adds FHIR R4 FamilyMemberHistory. Captures structured genealogical data:
-- the family member's relationship to the patient, sex, deceased status, and
-- one or more conditions with age at onset (the data ONC evaluates for (a)(12)).
--
-- Live DB verification (per CLAUDE.md Rule #18):
--   • SELECT table_name FROM information_schema.tables
--     WHERE table_name = 'fhir_family_member_history' → [] (confirmed 2026-05-29)
--
-- Modeled as a parent + child pair, exactly like fhir_devices +
-- fhir_device_use_statements (ONC-5): the member record is the parent, and
-- each member can carry 0..* conditions (FHIR FamilyMemberHistory.condition is
-- a 0..* backbone element). CASCADE so deleting a member removes its conditions.
--
-- RLS parity with fhir_devices:
--   • SELECT: own-tenant OR super_admin
--   • INSERT: WITH CHECK tenant_id = get_current_tenant_id()
--   • UPDATE/DELETE: tenant + is_tenant_admin(), BOTH USING and WITH CHECK
-- =============================================================================

-- -----------------------------------------------------------------------------
-- fhir_family_member_history — FHIR R4 FamilyMemberHistory (the member)
--   https://hl7.org/fhir/R4/familymemberhistory.html
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fhir_family_member_history (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fhir_id                  TEXT NOT NULL,
  tenant_id                UUID NOT NULL REFERENCES public.tenants(id),
  patient_id               UUID NOT NULL,

  status                   TEXT NOT NULL CHECK (status IN ('partial','completed','entered-in-error','health-unknown')),

  -- Relationship to the patient (FHIR uses v3-RoleCode: MTH, FTH, SIS, BRO, ...)
  relationship_system      TEXT,
  relationship_code        TEXT,
  relationship_display     TEXT NOT NULL,

  -- Optional free-text label for the member (e.g., "Maternal grandmother")
  name                     TEXT,

  -- Administrative gender of the member
  sex_code                 TEXT CHECK (sex_code IS NULL OR sex_code IN ('male','female','other','unknown')),
  sex_display              TEXT,

  -- Birth (one of date / string per FHIR born[x])
  born_date                DATE,
  born_string              TEXT,

  -- Current age (FHIR age[x]) — kept as a display string (e.g., "72 yr")
  age_string               TEXT,

  -- Deceased status (FHIR deceased[x])
  deceased_boolean         BOOLEAN,
  deceased_age_string      TEXT,
  deceased_date            DATE,

  note                     TEXT,

  external_id              TEXT,
  last_synced_at           TIMESTAMPTZ,
  sync_source              TEXT,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by               UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.fhir_family_member_history IS
  'FHIR R4 FamilyMemberHistory — a single family member''s health history for a patient. Backs ONC 170.315(a)(12) Family Health History.';

CREATE INDEX IF NOT EXISTS idx_fhir_fmh_patient
  ON public.fhir_family_member_history(patient_id);

CREATE INDEX IF NOT EXISTS idx_fhir_fmh_tenant
  ON public.fhir_family_member_history(tenant_id);

CREATE INDEX IF NOT EXISTS idx_fhir_fmh_status
  ON public.fhir_family_member_history(status);

-- -----------------------------------------------------------------------------
-- fhir_family_member_history_conditions — FHIR FamilyMemberHistory.condition
--
-- Each condition a family member had: code, outcome, whether it contributed to
-- death, and onset (age at onset is the ONC (a)(12) focus).
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fhir_family_member_history_conditions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fhir_id                  TEXT NOT NULL,
  tenant_id                UUID NOT NULL REFERENCES public.tenants(id),
  patient_id               UUID NOT NULL,
  family_member_history_id UUID NOT NULL REFERENCES public.fhir_family_member_history(id) ON DELETE CASCADE,

  -- The condition (ICD-10 / SNOMED). Display required.
  condition_system         TEXT,
  condition_code           TEXT,
  condition_display        TEXT NOT NULL,

  -- Outcome of the condition for the family member (e.g., "deceased", "remission")
  outcome_code             TEXT,
  outcome_display          TEXT,

  -- Did this condition contribute to the member's death?
  contributed_to_death     BOOLEAN,

  -- Onset (FHIR onset[x]) — age at onset is the ONC-evaluated field.
  onset_age_string         TEXT,
  onset_date               DATE,
  onset_string             TEXT,

  note                     TEXT,

  external_id              TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by               UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.fhir_family_member_history_conditions IS
  'FHIR R4 FamilyMemberHistory.condition — a condition (with age at onset) attributed to a family member.';

CREATE INDEX IF NOT EXISTS idx_fhir_fmhc_patient
  ON public.fhir_family_member_history_conditions(patient_id);

CREATE INDEX IF NOT EXISTS idx_fhir_fmhc_tenant
  ON public.fhir_family_member_history_conditions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_fhir_fmhc_member
  ON public.fhir_family_member_history_conditions(family_member_history_id);

-- -----------------------------------------------------------------------------
-- Row-Level Security — mirror fhir_devices
-- -----------------------------------------------------------------------------

ALTER TABLE public.fhir_family_member_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fhir_family_member_history_conditions ENABLE ROW LEVEL SECURITY;

-- fhir_family_member_history
DROP POLICY IF EXISTS fhir_fmh_select ON public.fhir_family_member_history;
CREATE POLICY fhir_fmh_select ON public.fhir_family_member_history
  FOR SELECT
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS fhir_fmh_insert ON public.fhir_family_member_history;
CREATE POLICY fhir_fmh_insert ON public.fhir_family_member_history
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS fhir_fmh_update ON public.fhir_family_member_history;
CREATE POLICY fhir_fmh_update ON public.fhir_family_member_history
  FOR UPDATE
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin())
  WITH CHECK (tenant_id = get_current_tenant_id() AND is_tenant_admin());

DROP POLICY IF EXISTS fhir_fmh_delete ON public.fhir_family_member_history;
CREATE POLICY fhir_fmh_delete ON public.fhir_family_member_history
  FOR DELETE
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

-- fhir_family_member_history_conditions
DROP POLICY IF EXISTS fhir_fmhc_select ON public.fhir_family_member_history_conditions;
CREATE POLICY fhir_fmhc_select ON public.fhir_family_member_history_conditions
  FOR SELECT
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS fhir_fmhc_insert ON public.fhir_family_member_history_conditions;
CREATE POLICY fhir_fmhc_insert ON public.fhir_family_member_history_conditions
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS fhir_fmhc_update ON public.fhir_family_member_history_conditions;
CREATE POLICY fhir_fmhc_update ON public.fhir_family_member_history_conditions
  FOR UPDATE
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin())
  WITH CHECK (tenant_id = get_current_tenant_id() AND is_tenant_admin());

DROP POLICY IF EXISTS fhir_fmhc_delete ON public.fhir_family_member_history_conditions;
CREATE POLICY fhir_fmhc_delete ON public.fhir_family_member_history_conditions
  FOR DELETE
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tg_fhir_fmh_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fhir_fmh_updated_at ON public.fhir_family_member_history;
CREATE TRIGGER trg_fhir_fmh_updated_at
  BEFORE UPDATE ON public.fhir_family_member_history
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_fhir_fmh_set_updated_at();

DROP TRIGGER IF EXISTS trg_fhir_fmhc_updated_at ON public.fhir_family_member_history_conditions;
CREATE TRIGGER trg_fhir_fmhc_updated_at
  BEFORE UPDATE ON public.fhir_family_member_history_conditions
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_fhir_fmh_set_updated_at();
