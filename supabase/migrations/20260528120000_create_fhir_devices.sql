-- =============================================================================
-- ONC 170.315(a)(14) — Implantable Device List
-- =============================================================================
-- Adds FHIR R4 Device + DeviceUseStatement tables. Captures the implantable
-- devices a patient carries (UDI per FDA UDI Rule, manufacturer, model, lot,
-- serial, implant date, body site).
--
-- Live DB verification (per CLAUDE.md Rule #18):
--   • SELECT table_name FROM information_schema.tables
--     WHERE table_name LIKE 'fhir_device%' → [] (confirmed empty 2026-05-28)
--
-- Pattern parity with fhir_service_requests (ONC-2):
--   • INSERT WITH CHECK enforces tenant_id = get_current_tenant_id()
--   • UPDATE has BOTH USING and WITH CHECK clauses (the gap that almost
--     shipped on api_keys, caught by pre-commit rule #16 and again on ONC-2)
--   • super-admin can SELECT cross-tenant; everyone else is tenant-scoped
-- =============================================================================

-- -----------------------------------------------------------------------------
-- fhir_devices — FHIR R4 Device resource
--   https://hl7.org/fhir/R4/device.html
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fhir_devices (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fhir_id                  TEXT NOT NULL,
  tenant_id                UUID NOT NULL REFERENCES public.tenants(id),
  patient_id               UUID NOT NULL,

  -- FDA UDI Rule fields (the part ONC actually evaluates for (a)(14))
  -- The human-readable form of the UDI is the full barcode string the
  -- clinician scans / types; the DI portion is the manufacturer's catalog
  -- number (lookup key in the FDA AccessGUDID database).
  udi_carrier_hrf          TEXT,
  udi_device_identifier    TEXT,
  udi_issuer               TEXT,
  udi_jurisdiction         TEXT,

  -- Device metadata
  status                   TEXT NOT NULL CHECK (status IN ('active','inactive','entered-in-error','unknown')),

  device_type_system       TEXT,
  device_type_code         TEXT,
  device_type_display      TEXT NOT NULL,

  manufacturer             TEXT,
  model_number             TEXT,
  part_number              TEXT,
  serial_number            TEXT,
  lot_number               TEXT,
  manufacture_date         DATE,
  expiration_date          DATE,

  -- Optional clinician-entered annotation about the device itself
  note                     TEXT,

  -- Sync / external system mapping
  external_id              TEXT,
  last_synced_at           TIMESTAMPTZ,
  sync_source              TEXT,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by               UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.fhir_devices IS
  'FHIR R4 Device — implantable & non-implantable devices linked to a patient. Backs ONC 170.315(a)(14) Implantable Device List.';

COMMENT ON COLUMN public.fhir_devices.udi_carrier_hrf IS
  'Human-readable form of the UDI (full barcode string per FDA UDI Rule). Scanned or manually entered at implant.';

COMMENT ON COLUMN public.fhir_devices.udi_device_identifier IS
  'Device Identifier (DI) portion of the UDI — manufacturer catalog number. Lookup key in FDA AccessGUDID.';

CREATE INDEX IF NOT EXISTS idx_fhir_devices_patient
  ON public.fhir_devices(patient_id);

CREATE INDEX IF NOT EXISTS idx_fhir_devices_tenant
  ON public.fhir_devices(tenant_id);

CREATE INDEX IF NOT EXISTS idx_fhir_devices_udi_di
  ON public.fhir_devices(udi_device_identifier)
  WHERE udi_device_identifier IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fhir_devices_status
  ON public.fhir_devices(status);

-- -----------------------------------------------------------------------------
-- fhir_device_use_statements — FHIR R4 DeviceUseStatement
--   https://hl7.org/fhir/R4/deviceusestatement.html
--
-- Captures the clinical *use* of a device: implant date, body site, reason,
-- recording practitioner. One Device may have multiple DeviceUseStatements
-- over time (revisions, removals, status changes).
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fhir_device_use_statements (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fhir_id                  TEXT NOT NULL,
  tenant_id                UUID NOT NULL REFERENCES public.tenants(id),
  patient_id               UUID NOT NULL,
  device_id                UUID NOT NULL REFERENCES public.fhir_devices(id) ON DELETE CASCADE,

  status                   TEXT NOT NULL CHECK (status IN ('active','completed','entered-in-error','intended','stopped','on-hold')),

  -- When the statement was recorded
  recorded_on              TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- When the device was/will be used (the implant or first-use moment)
  timing_datetime          TIMESTAMPTZ,
  timing_period_start      TIMESTAMPTZ,
  timing_period_end        TIMESTAMPTZ,

  -- Recording practitioner
  source_user_id           UUID REFERENCES auth.users(id),
  source_practitioner_id   UUID,
  source_display           TEXT,

  -- Anatomic site of the device
  body_site_system         TEXT,
  body_site_code           TEXT,
  body_site_display        TEXT,

  -- Why the device was used (ICD-10 / SNOMED — free text array for now)
  reason_code              TEXT[],
  reason_reference         TEXT[],

  -- Free-text clinician note
  note                     TEXT,

  external_id              TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by               UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE public.fhir_device_use_statements IS
  'FHIR R4 DeviceUseStatement — the clinical record of a Device being used by a Patient (implant date, body site, recording practitioner).';

CREATE INDEX IF NOT EXISTS idx_fhir_dus_patient
  ON public.fhir_device_use_statements(patient_id);

CREATE INDEX IF NOT EXISTS idx_fhir_dus_tenant
  ON public.fhir_device_use_statements(tenant_id);

CREATE INDEX IF NOT EXISTS idx_fhir_dus_device
  ON public.fhir_device_use_statements(device_id);

CREATE INDEX IF NOT EXISTS idx_fhir_dus_status
  ON public.fhir_device_use_statements(status);

-- -----------------------------------------------------------------------------
-- Row-Level Security — mirror fhir_service_requests
-- -----------------------------------------------------------------------------

ALTER TABLE public.fhir_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fhir_device_use_statements ENABLE ROW LEVEL SECURITY;

-- fhir_devices
DROP POLICY IF EXISTS fhir_devices_select ON public.fhir_devices;
CREATE POLICY fhir_devices_select ON public.fhir_devices
  FOR SELECT
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS fhir_devices_insert ON public.fhir_devices;
CREATE POLICY fhir_devices_insert ON public.fhir_devices
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS fhir_devices_update ON public.fhir_devices;
CREATE POLICY fhir_devices_update ON public.fhir_devices
  FOR UPDATE
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin())
  WITH CHECK (tenant_id = get_current_tenant_id() AND is_tenant_admin());

DROP POLICY IF EXISTS fhir_devices_delete ON public.fhir_devices;
CREATE POLICY fhir_devices_delete ON public.fhir_devices
  FOR DELETE
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

-- fhir_device_use_statements
DROP POLICY IF EXISTS fhir_dus_select ON public.fhir_device_use_statements;
CREATE POLICY fhir_dus_select ON public.fhir_device_use_statements
  FOR SELECT
  USING (tenant_id = get_current_tenant_id() OR is_super_admin());

DROP POLICY IF EXISTS fhir_dus_insert ON public.fhir_device_use_statements;
CREATE POLICY fhir_dus_insert ON public.fhir_device_use_statements
  FOR INSERT
  WITH CHECK (tenant_id = get_current_tenant_id());

DROP POLICY IF EXISTS fhir_dus_update ON public.fhir_device_use_statements;
CREATE POLICY fhir_dus_update ON public.fhir_device_use_statements
  FOR UPDATE
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin())
  WITH CHECK (tenant_id = get_current_tenant_id() AND is_tenant_admin());

DROP POLICY IF EXISTS fhir_dus_delete ON public.fhir_device_use_statements;
CREATE POLICY fhir_dus_delete ON public.fhir_device_use_statements
  FOR DELETE
  USING (tenant_id = get_current_tenant_id() AND is_tenant_admin());

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tg_fhir_devices_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fhir_devices_updated_at ON public.fhir_devices;
CREATE TRIGGER trg_fhir_devices_updated_at
  BEFORE UPDATE ON public.fhir_devices
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_fhir_devices_set_updated_at();

DROP TRIGGER IF EXISTS trg_fhir_dus_updated_at ON public.fhir_device_use_statements;
CREATE TRIGGER trg_fhir_dus_updated_at
  BEFORE UPDATE ON public.fhir_device_use_statements
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_fhir_devices_set_updated_at();
