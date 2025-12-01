-- ============================================================================
-- PREDICTIVE BED MANAGEMENT SYSTEM
-- ============================================================================
-- Purpose: Intelligent hospital bed tracking with predictive availability
-- Features:
--   - Real-time bed status tracking (source of truth + ADT consumer)
--   - Daily census snapshots for historical analysis
--   - ML-ready forecasting with LOS benchmarks
--   - Acuity-aware bed matching
--   - Multi-facility support within tenant
--
-- Target Users: Bed Control, Charge Nurses, Hospital Administrators
-- Product: Envision Atlus Only (enrollment_type = 'hospital')
--
-- Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: HOSPITAL UNITS (Care Units / Nursing Units)
-- ============================================================================
-- Represents physical care units: ICU, Med-Surg, Telemetry, L&D, etc.

CREATE TABLE IF NOT EXISTS public.hospital_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.hospital_departments(id) ON DELETE SET NULL,

  -- Unit identification
  unit_code TEXT NOT NULL,  -- e.g., "ICU-A", "3N", "L&D"
  unit_name TEXT NOT NULL,  -- e.g., "Medical ICU", "3rd Floor North", "Labor & Delivery"
  unit_type TEXT NOT NULL CHECK (unit_type IN (
    'icu', 'step_down', 'telemetry', 'med_surg', 'oncology',
    'cardiac', 'neuro', 'ortho', 'rehab', 'psych', 'peds',
    'nicu', 'picu', 'labor_delivery', 'postpartum', 'nursery',
    'ed', 'ed_holding', 'or', 'pacu', 'observation', 'other'
  )),

  -- Location
  floor_number TEXT,
  building TEXT,

  -- Capacity
  total_beds INTEGER NOT NULL DEFAULT 0,
  operational_beds INTEGER,  -- May be less than total if some blocked
  target_census INTEGER,     -- Ideal occupancy target
  max_census INTEGER,        -- Hard cap

  -- Staffing model
  nurse_patient_ratio TEXT,  -- e.g., "1:2" for ICU, "1:5" for med-surg
  charge_nurse_required BOOLEAN DEFAULT true,

  -- Acuity levels this unit handles
  min_acuity_level INTEGER DEFAULT 1,  -- 1 = lowest acuity
  max_acuity_level INTEGER DEFAULT 5,  -- 5 = highest (ICU)

  -- Operational status
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_accepting_patients BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unique unit code per facility
  CONSTRAINT uq_unit_code_facility UNIQUE (facility_id, unit_code)
);

CREATE INDEX idx_hospital_units_tenant ON public.hospital_units(tenant_id);
CREATE INDEX idx_hospital_units_facility ON public.hospital_units(facility_id);
CREATE INDEX idx_hospital_units_type ON public.hospital_units(unit_type);
CREATE INDEX idx_hospital_units_active ON public.hospital_units(is_active) WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_hospital_units_updated_at ON public.hospital_units;
CREATE TRIGGER trg_hospital_units_updated_at
  BEFORE UPDATE ON public.hospital_units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.hospital_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hospital_units_tenant_read" ON public.hospital_units;
CREATE POLICY "hospital_units_tenant_read" ON public.hospital_units
  FOR SELECT USING (tenant_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "hospital_units_admin_write" ON public.hospital_units;
CREATE POLICY "hospital_units_admin_write" ON public.hospital_units
  FOR ALL USING (
    tenant_id = public.get_current_tenant_id()
    AND (public.is_admin(auth.uid()) OR public.is_super_admin())
  )
  WITH CHECK (
    tenant_id = public.get_current_tenant_id()
    AND (public.is_admin(auth.uid()) OR public.is_super_admin())
  );

COMMENT ON TABLE public.hospital_units IS 'Physical nursing/care units within a hospital facility';
COMMENT ON COLUMN public.hospital_units.unit_type IS 'Type of care unit (icu, med_surg, telemetry, etc.)';
COMMENT ON COLUMN public.hospital_units.nurse_patient_ratio IS 'Target staffing ratio e.g. "1:2" for ICU';

-- ============================================================================
-- PART 2: BEDS (Physical Bed Inventory)
-- ============================================================================

-- Enum for bed status workflow
CREATE TYPE bed_status AS ENUM (
  'available',      -- Ready for patient
  'occupied',       -- Has patient assigned
  'dirty',          -- Patient discharged, needs cleaning
  'cleaning',       -- EVS in progress
  'blocked',        -- Temporarily unavailable (equipment issue, etc.)
  'maintenance',    -- Under repair
  'reserved'        -- Held for incoming patient
);

CREATE TABLE IF NOT EXISTS public.beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.hospital_units(id) ON DELETE CASCADE,

  -- Location
  room_number TEXT NOT NULL,
  bed_position TEXT DEFAULT 'A',  -- A, B, Window, Door, etc.
  bed_label TEXT GENERATED ALWAYS AS (room_number || '-' || bed_position) STORED,

  -- Bed characteristics
  bed_type TEXT NOT NULL DEFAULT 'standard' CHECK (bed_type IN (
    'standard', 'bariatric', 'pediatric', 'nicu', 'icu',
    'labor_delivery', 'stretcher', 'recliner', 'crib', 'bassinet'
  )),

  -- Equipment/capabilities (for smart matching)
  has_telemetry BOOLEAN DEFAULT false,
  has_isolation_capability BOOLEAN DEFAULT false,
  has_negative_pressure BOOLEAN DEFAULT false,
  is_bariatric_capable BOOLEAN DEFAULT false,
  has_special_equipment TEXT[],  -- Array of equipment codes

  -- Current status
  status bed_status NOT NULL DEFAULT 'available',
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status_changed_by UUID REFERENCES auth.users(id),
  status_notes TEXT,  -- e.g., "Blocked - waiting for bed frame repair"

  -- If reserved, for whom
  reserved_for_patient_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reserved_until TIMESTAMPTZ,

  -- Operational
  is_active BOOLEAN NOT NULL DEFAULT true,  -- False if bed removed from service

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unique bed label per unit
  CONSTRAINT uq_bed_label_unit UNIQUE (unit_id, room_number, bed_position)
);

CREATE INDEX idx_beds_tenant ON public.beds(tenant_id);
CREATE INDEX idx_beds_unit ON public.beds(unit_id);
CREATE INDEX idx_beds_status ON public.beds(status);
CREATE INDEX idx_beds_available ON public.beds(unit_id, status) WHERE status = 'available' AND is_active = true;
CREATE INDEX idx_beds_room ON public.beds(room_number);
CREATE INDEX idx_beds_type ON public.beds(bed_type);

DROP TRIGGER IF EXISTS trg_beds_updated_at ON public.beds;
CREATE TRIGGER trg_beds_updated_at
  BEFORE UPDATE ON public.beds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.beds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "beds_tenant_read" ON public.beds;
CREATE POLICY "beds_tenant_read" ON public.beds
  FOR SELECT USING (tenant_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "beds_staff_write" ON public.beds;
CREATE POLICY "beds_staff_write" ON public.beds
  FOR ALL USING (
    tenant_id = public.get_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'nurse', 'care_manager', 'bed_control')
    )
  )
  WITH CHECK (
    tenant_id = public.get_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'nurse', 'care_manager', 'bed_control')
    )
  );

COMMENT ON TABLE public.beds IS 'Physical bed inventory with real-time status tracking';
COMMENT ON COLUMN public.beds.bed_label IS 'Auto-generated label like "101-A"';
COMMENT ON COLUMN public.beds.has_special_equipment IS 'Array of equipment codes like {vent, bipap, wound_vac}';

-- ============================================================================
-- PART 3: BED ASSIGNMENTS (Patient ↔ Bed Relationship)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bed_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bed_id UUID NOT NULL REFERENCES public.beds(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Assignment timing
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id),

  -- Expected discharge (for predictions)
  expected_discharge_date DATE,
  expected_discharge_time TIME,
  discharge_disposition TEXT,  -- Home, SNF, Rehab, AMA, Expired, etc.

  -- Actual discharge
  discharged_at TIMESTAMPTZ,
  discharged_by UUID REFERENCES auth.users(id),
  actual_disposition TEXT,

  -- Transfer tracking
  transferred_from_bed_id UUID REFERENCES public.beds(id),
  transfer_reason TEXT,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,  -- False when discharged/transferred

  -- ADT integration
  adt_event_id TEXT,  -- External ADT message ID if sourced from HL7/FHIR
  adt_source TEXT,    -- 'manual', 'hl7', 'fhir', 'api'

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Only one active assignment per bed
  CONSTRAINT uq_active_bed_assignment UNIQUE (bed_id, is_active)
    DEFERRABLE INITIALLY DEFERRED
);

-- Partial unique index for active assignments
DROP INDEX IF EXISTS idx_bed_assignments_active_bed;
CREATE UNIQUE INDEX idx_bed_assignments_active_bed ON public.bed_assignments(bed_id) WHERE is_active = true;

CREATE INDEX idx_bed_assignments_tenant ON public.bed_assignments(tenant_id);
CREATE INDEX idx_bed_assignments_patient ON public.bed_assignments(patient_id);
CREATE INDEX idx_bed_assignments_active ON public.bed_assignments(is_active) WHERE is_active = true;
CREATE INDEX idx_bed_assignments_expected_discharge ON public.bed_assignments(expected_discharge_date) WHERE is_active = true;
CREATE INDEX idx_bed_assignments_dates ON public.bed_assignments(assigned_at, discharged_at);

DROP TRIGGER IF EXISTS trg_bed_assignments_updated_at ON public.bed_assignments;
CREATE TRIGGER trg_bed_assignments_updated_at
  BEFORE UPDATE ON public.bed_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.bed_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bed_assignments_tenant_read" ON public.bed_assignments;
CREATE POLICY "bed_assignments_tenant_read" ON public.bed_assignments
  FOR SELECT USING (tenant_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "bed_assignments_staff_write" ON public.bed_assignments;
CREATE POLICY "bed_assignments_staff_write" ON public.bed_assignments
  FOR ALL USING (
    tenant_id = public.get_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'nurse', 'care_manager', 'bed_control')
    )
  )
  WITH CHECK (
    tenant_id = public.get_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'nurse', 'care_manager', 'bed_control')
    )
  );

COMMENT ON TABLE public.bed_assignments IS 'Patient bed assignments with admission/discharge tracking';
COMMENT ON COLUMN public.bed_assignments.expected_discharge_date IS 'Predicted discharge date for forecasting';
COMMENT ON COLUMN public.bed_assignments.adt_source IS 'Source of assignment: manual, hl7, fhir, api';

-- ============================================================================
-- PART 4: BED STATUS HISTORY (Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bed_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bed_id UUID NOT NULL REFERENCES public.beds(id) ON DELETE CASCADE,

  -- Status change
  previous_status bed_status,
  new_status bed_status NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID REFERENCES auth.users(id),

  -- Context
  reason TEXT,
  related_assignment_id UUID REFERENCES public.bed_assignments(id),

  -- Duration in previous status (calculated on insert)
  duration_minutes INTEGER,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bed_status_history_bed ON public.bed_status_history(bed_id);
CREATE INDEX idx_bed_status_history_changed_at ON public.bed_status_history(changed_at DESC);
CREATE INDEX idx_bed_status_history_status ON public.bed_status_history(new_status);
CREATE INDEX idx_bed_status_history_tenant ON public.bed_status_history(tenant_id);

ALTER TABLE public.bed_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bed_status_history_tenant_read" ON public.bed_status_history;
CREATE POLICY "bed_status_history_tenant_read" ON public.bed_status_history
  FOR SELECT USING (tenant_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "bed_status_history_system_insert" ON public.bed_status_history;
CREATE POLICY "bed_status_history_system_insert" ON public.bed_status_history
  FOR INSERT WITH CHECK (tenant_id = public.get_current_tenant_id());

COMMENT ON TABLE public.bed_status_history IS 'Audit trail of bed status changes for analytics';

-- ============================================================================
-- PART 5: DAILY CENSUS SNAPSHOTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.daily_census_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.hospital_units(id) ON DELETE CASCADE,
  census_date DATE NOT NULL,

  -- Midnight snapshot
  midnight_census INTEGER NOT NULL DEFAULT 0,
  midnight_available INTEGER NOT NULL DEFAULT 0,

  -- Daily activity
  admissions_count INTEGER DEFAULT 0,
  discharges_count INTEGER DEFAULT 0,
  transfers_in INTEGER DEFAULT 0,
  transfers_out INTEGER DEFAULT 0,

  -- Peak metrics
  peak_census INTEGER,
  peak_time TIME,

  -- End of day
  eod_census INTEGER,
  eod_available INTEGER,

  -- Occupied bed hours (for accurate occupancy calculation)
  occupied_bed_hours DECIMAL(10,2),

  -- Acuity
  average_acuity DECIMAL(4,2),
  critical_patients INTEGER DEFAULT 0,
  high_acuity_patients INTEGER DEFAULT 0,

  -- Variance from predictions
  predicted_census INTEGER,
  census_variance INTEGER GENERATED ALWAYS AS (eod_census - predicted_census) STORED,
  prediction_accuracy DECIMAL(5,2),  -- Percentage accuracy

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_daily_census_unit_date UNIQUE (unit_id, census_date)
);

CREATE INDEX idx_daily_census_tenant ON public.daily_census_snapshots(tenant_id);
CREATE INDEX idx_daily_census_unit ON public.daily_census_snapshots(unit_id);
CREATE INDEX idx_daily_census_date ON public.daily_census_snapshots(census_date DESC);
CREATE INDEX idx_daily_census_unit_date ON public.daily_census_snapshots(unit_id, census_date DESC);

DROP TRIGGER IF EXISTS trg_daily_census_updated_at ON public.daily_census_snapshots;
CREATE TRIGGER trg_daily_census_updated_at
  BEFORE UPDATE ON public.daily_census_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.daily_census_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_census_tenant_read" ON public.daily_census_snapshots;
CREATE POLICY "daily_census_tenant_read" ON public.daily_census_snapshots
  FOR SELECT USING (tenant_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "daily_census_system_write" ON public.daily_census_snapshots;
CREATE POLICY "daily_census_system_write" ON public.daily_census_snapshots
  FOR ALL USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

COMMENT ON TABLE public.daily_census_snapshots IS 'Daily census metrics per unit for trending and forecast validation';
COMMENT ON COLUMN public.daily_census_snapshots.occupied_bed_hours IS 'Total occupied bed hours for accurate occupancy rate';

-- ============================================================================
-- PART 6: LOS BENCHMARKS (Length of Stay Reference Data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.los_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,  -- NULL = global benchmark

  -- Diagnosis/DRG basis
  drg_code TEXT,
  icd10_code TEXT,
  diagnosis_group TEXT,  -- Simplified grouping like "CHF", "Hip Replacement", "Pneumonia"

  -- Unit type adjustment
  unit_type TEXT,  -- NULL = all units

  -- LOS metrics (in days)
  mean_los DECIMAL(5,2) NOT NULL,
  median_los DECIMAL(5,2),
  los_std_dev DECIMAL(5,2),
  percentile_25 DECIMAL(5,2),
  percentile_75 DECIMAL(5,2),
  percentile_90 DECIMAL(5,2),

  -- Sample info
  sample_size INTEGER,
  data_period_start DATE,
  data_period_end DATE,
  source TEXT,  -- 'cms', 'internal', 'vendor', etc.

  -- Active
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_los_benchmarks_drg ON public.los_benchmarks(drg_code);
CREATE INDEX idx_los_benchmarks_icd10 ON public.los_benchmarks(icd10_code);
CREATE INDEX idx_los_benchmarks_diagnosis ON public.los_benchmarks(diagnosis_group);
CREATE INDEX idx_los_benchmarks_tenant ON public.los_benchmarks(tenant_id);

ALTER TABLE public.los_benchmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "los_benchmarks_read" ON public.los_benchmarks;
CREATE POLICY "los_benchmarks_read" ON public.los_benchmarks
  FOR SELECT USING (
    tenant_id IS NULL  -- Global benchmarks
    OR tenant_id = public.get_current_tenant_id()
  );

COMMENT ON TABLE public.los_benchmarks IS 'Length of Stay benchmarks by DRG/diagnosis for discharge prediction';

-- ============================================================================
-- PART 7: SCHEDULED ARRIVALS (Known Incoming Demand)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.scheduled_arrivals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL,

  -- Patient info (may not have auth.users record yet)
  patient_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  patient_name TEXT,
  patient_mrn TEXT,

  -- Arrival details
  arrival_type TEXT NOT NULL CHECK (arrival_type IN (
    'scheduled_surgery', 'planned_admission', 'transfer_in',
    'ed_boarding', 'observation', 'direct_admit', 'other'
  )),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,

  -- Destination
  target_unit_id UUID REFERENCES public.hospital_units(id),
  target_unit_type TEXT,  -- Fallback if unit_id not specified
  required_bed_type TEXT,

  -- Requirements
  required_equipment TEXT[],
  isolation_required BOOLEAN DEFAULT false,
  acuity_level INTEGER,

  -- Expected LOS
  expected_los_days INTEGER,
  expected_discharge_date DATE,

  -- Status
  status TEXT DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'confirmed', 'arrived', 'cancelled', 'no_show'
  )),
  actual_arrival_time TIMESTAMPTZ,
  assigned_bed_id UUID REFERENCES public.beds(id),

  -- Source
  source_system TEXT,  -- 'surgery_schedule', 'transfer_center', 'ed', etc.
  external_reference TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_arrivals_tenant ON public.scheduled_arrivals(tenant_id);
CREATE INDEX idx_scheduled_arrivals_date ON public.scheduled_arrivals(scheduled_date);
CREATE INDEX idx_scheduled_arrivals_unit ON public.scheduled_arrivals(target_unit_id);
CREATE INDEX idx_scheduled_arrivals_status ON public.scheduled_arrivals(status);
CREATE INDEX idx_scheduled_arrivals_upcoming ON public.scheduled_arrivals(scheduled_date, status)
  WHERE status IN ('scheduled', 'confirmed');

DROP TRIGGER IF EXISTS trg_scheduled_arrivals_updated_at ON public.scheduled_arrivals;
CREATE TRIGGER trg_scheduled_arrivals_updated_at
  BEFORE UPDATE ON public.scheduled_arrivals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.scheduled_arrivals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scheduled_arrivals_tenant_read" ON public.scheduled_arrivals;
CREATE POLICY "scheduled_arrivals_tenant_read" ON public.scheduled_arrivals
  FOR SELECT USING (tenant_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "scheduled_arrivals_staff_write" ON public.scheduled_arrivals;
CREATE POLICY "scheduled_arrivals_staff_write" ON public.scheduled_arrivals
  FOR ALL USING (
    tenant_id = public.get_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'nurse', 'care_manager', 'bed_control')
    )
  )
  WITH CHECK (
    tenant_id = public.get_current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'nurse', 'care_manager', 'bed_control')
    )
  );

COMMENT ON TABLE public.scheduled_arrivals IS 'Known incoming patient demand for bed forecasting';

-- ============================================================================
-- PART 8: BED AVAILABILITY FORECASTS (ML Predictions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bed_availability_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.hospital_units(id) ON DELETE CASCADE,

  -- Forecast target
  forecast_date DATE NOT NULL,

  -- Predictions
  predicted_census INTEGER NOT NULL,
  predicted_available INTEGER NOT NULL,
  predicted_discharges INTEGER,
  predicted_admissions INTEGER,

  -- Confidence
  confidence_level DECIMAL(4,2),  -- 0.00 to 1.00
  lower_bound INTEGER,
  upper_bound INTEGER,

  -- Factors used in prediction
  factors_json JSONB,  -- Captured inputs for audit/debugging
  /*
    Example factors_json:
    {
      "current_census": 28,
      "expected_discharges": 5,
      "scheduled_arrivals": 3,
      "day_of_week_adjustment": 0.95,
      "historical_avg_los": 4.2,
      "weather_factor": null
    }
  */

  -- Model metadata
  model_version TEXT DEFAULT 'v1.0',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Validation (filled in after the fact)
  actual_census INTEGER,
  actual_available INTEGER,
  forecast_error INTEGER GENERATED ALWAYS AS (actual_census - predicted_census) STORED,
  error_percentage DECIMAL(5,2),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_forecast_unit_date UNIQUE (unit_id, forecast_date, generated_at)
);

CREATE INDEX idx_forecasts_tenant ON public.bed_availability_forecasts(tenant_id);
CREATE INDEX idx_forecasts_unit ON public.bed_availability_forecasts(unit_id);
CREATE INDEX idx_forecasts_date ON public.bed_availability_forecasts(forecast_date);
CREATE INDEX idx_forecasts_generated ON public.bed_availability_forecasts(generated_at DESC);

ALTER TABLE public.bed_availability_forecasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "forecasts_tenant_read" ON public.bed_availability_forecasts;
CREATE POLICY "forecasts_tenant_read" ON public.bed_availability_forecasts
  FOR SELECT USING (tenant_id = public.get_current_tenant_id());

DROP POLICY IF EXISTS "forecasts_system_write" ON public.bed_availability_forecasts;
CREATE POLICY "forecasts_system_write" ON public.bed_availability_forecasts
  FOR ALL USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

COMMENT ON TABLE public.bed_availability_forecasts IS 'Predictive bed availability forecasts by unit and date';
COMMENT ON COLUMN public.bed_availability_forecasts.factors_json IS 'Captured prediction inputs for model transparency';

-- ============================================================================
-- PART 9: HELPER FUNCTIONS
-- ============================================================================

-- Function: Get current unit census
CREATE OR REPLACE FUNCTION public.get_unit_census(
  p_unit_id UUID,
  p_as_of TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  unit_id UUID,
  unit_name TEXT,
  total_beds INTEGER,
  occupied INTEGER,
  available INTEGER,
  dirty INTEGER,
  blocked INTEGER,
  occupancy_rate DECIMAL(5,2),
  critical_patients INTEGER,
  high_acuity_patients INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS unit_id,
    u.unit_name,
    u.total_beds,
    COALESCE(SUM(CASE WHEN b.status = 'occupied' THEN 1 ELSE 0 END)::INTEGER, 0) AS occupied,
    COALESCE(SUM(CASE WHEN b.status = 'available' THEN 1 ELSE 0 END)::INTEGER, 0) AS available,
    COALESCE(SUM(CASE WHEN b.status IN ('dirty', 'cleaning') THEN 1 ELSE 0 END)::INTEGER, 0) AS dirty,
    COALESCE(SUM(CASE WHEN b.status IN ('blocked', 'maintenance') THEN 1 ELSE 0 END)::INTEGER, 0) AS blocked,
    CASE WHEN u.total_beds > 0 THEN
      ROUND((SUM(CASE WHEN b.status = 'occupied' THEN 1 ELSE 0 END)::DECIMAL / u.total_beds) * 100, 2)
    ELSE 0 END AS occupancy_rate,
    COALESCE(SUM(CASE
      WHEN b.status = 'occupied' AND hrs.final_risk_level = 'CRITICAL' THEN 1
      ELSE 0
    END)::INTEGER, 0) AS critical_patients,
    COALESCE(SUM(CASE
      WHEN b.status = 'occupied' AND hrs.final_risk_level = 'HIGH' THEN 1
      ELSE 0
    END)::INTEGER, 0) AS high_acuity_patients
  FROM public.hospital_units u
  LEFT JOIN public.beds b ON b.unit_id = u.id AND b.is_active = true
  LEFT JOIN public.bed_assignments ba ON ba.bed_id = b.id AND ba.is_active = true
  LEFT JOIN public.shift_handoff_risk_scores hrs ON hrs.patient_id = ba.patient_id
    AND hrs.shift_date = p_as_of::DATE
  WHERE u.id = p_unit_id
  GROUP BY u.id, u.unit_name, u.total_beds;
END;
$$;

COMMENT ON FUNCTION public.get_unit_census IS 'Returns current census and bed status breakdown for a unit';

-- Function: Get available beds matching criteria
CREATE OR REPLACE FUNCTION public.find_available_beds(
  p_unit_id UUID DEFAULT NULL,
  p_bed_type TEXT DEFAULT NULL,
  p_requires_telemetry BOOLEAN DEFAULT false,
  p_requires_isolation BOOLEAN DEFAULT false,
  p_requires_negative_pressure BOOLEAN DEFAULT false,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  bed_id UUID,
  bed_label TEXT,
  unit_id UUID,
  unit_name TEXT,
  room_number TEXT,
  bed_type TEXT,
  has_telemetry BOOLEAN,
  has_isolation_capability BOOLEAN,
  has_negative_pressure BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id AS bed_id,
    b.bed_label,
    b.unit_id,
    u.unit_name,
    b.room_number,
    b.bed_type,
    b.has_telemetry,
    b.has_isolation_capability,
    b.has_negative_pressure
  FROM public.beds b
  JOIN public.hospital_units u ON u.id = b.unit_id
  WHERE b.status = 'available'
    AND b.is_active = true
    AND u.is_active = true
    AND u.is_accepting_patients = true
    AND b.tenant_id = public.get_current_tenant_id()
    AND (p_unit_id IS NULL OR b.unit_id = p_unit_id)
    AND (p_bed_type IS NULL OR b.bed_type = p_bed_type)
    AND (p_requires_telemetry = false OR b.has_telemetry = true)
    AND (p_requires_isolation = false OR b.has_isolation_capability = true)
    AND (p_requires_negative_pressure = false OR b.has_negative_pressure = true)
  ORDER BY u.unit_name, b.room_number, b.bed_position
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.find_available_beds IS 'Find available beds matching equipment/capability requirements';

-- Function: Assign patient to bed
CREATE OR REPLACE FUNCTION public.assign_patient_to_bed(
  p_patient_id UUID,
  p_bed_id UUID,
  p_expected_los_days INTEGER DEFAULT NULL,
  p_adt_source TEXT DEFAULT 'manual',
  p_adt_event_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assignment_id UUID;
  v_tenant_id UUID;
  v_old_bed_id UUID;
  v_expected_discharge DATE;
BEGIN
  -- Get tenant from bed
  SELECT tenant_id INTO v_tenant_id FROM public.beds WHERE id = p_bed_id;

  -- Check bed is available
  IF NOT EXISTS (
    SELECT 1 FROM public.beds
    WHERE id = p_bed_id AND status = 'available' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Bed is not available for assignment';
  END IF;

  -- Check for existing active assignment for this patient
  SELECT bed_id INTO v_old_bed_id
  FROM public.bed_assignments
  WHERE patient_id = p_patient_id AND is_active = true;

  -- Calculate expected discharge
  IF p_expected_los_days IS NOT NULL THEN
    v_expected_discharge := CURRENT_DATE + p_expected_los_days;
  END IF;

  -- If patient has existing assignment, this is a transfer
  IF v_old_bed_id IS NOT NULL THEN
    -- End old assignment
    UPDATE public.bed_assignments
    SET is_active = false,
        discharged_at = NOW(),
        actual_disposition = 'Transfer',
        updated_at = NOW()
    WHERE patient_id = p_patient_id AND is_active = true;

    -- Update old bed status
    UPDATE public.beds
    SET status = 'dirty',
        status_changed_at = NOW(),
        status_changed_by = auth.uid()
    WHERE id = v_old_bed_id;
  END IF;

  -- Create new assignment
  INSERT INTO public.bed_assignments (
    tenant_id, bed_id, patient_id, assigned_by,
    expected_discharge_date, transferred_from_bed_id,
    adt_source, adt_event_id
  )
  VALUES (
    v_tenant_id, p_bed_id, p_patient_id, auth.uid(),
    v_expected_discharge, v_old_bed_id,
    p_adt_source, p_adt_event_id
  )
  RETURNING id INTO v_assignment_id;

  -- Update bed status to occupied
  UPDATE public.beds
  SET status = 'occupied',
      status_changed_at = NOW(),
      status_changed_by = auth.uid(),
      reserved_for_patient_id = NULL,
      reserved_until = NULL
  WHERE id = p_bed_id;

  RETURN v_assignment_id;
END;
$$;

COMMENT ON FUNCTION public.assign_patient_to_bed IS 'Assign a patient to a bed (handles transfers automatically)';

-- Function: Discharge patient (release bed)
-- Drop existing function if it has different signature
DROP FUNCTION IF EXISTS public.discharge_patient(UUID, TEXT);
DROP FUNCTION IF EXISTS public.discharge_patient(UUID);
CREATE OR REPLACE FUNCTION public.discharge_patient(
  p_patient_id UUID,
  p_disposition TEXT DEFAULT 'Home'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bed_id UUID;
BEGIN
  -- Find active assignment
  SELECT bed_id INTO v_bed_id
  FROM public.bed_assignments
  WHERE patient_id = p_patient_id AND is_active = true;

  IF v_bed_id IS NULL THEN
    RETURN false;
  END IF;

  -- End assignment
  UPDATE public.bed_assignments
  SET is_active = false,
      discharged_at = NOW(),
      discharged_by = auth.uid(),
      actual_disposition = p_disposition,
      updated_at = NOW()
  WHERE patient_id = p_patient_id AND is_active = true;

  -- Set bed to dirty (needs cleaning)
  UPDATE public.beds
  SET status = 'dirty',
      status_changed_at = NOW(),
      status_changed_by = auth.uid()
  WHERE id = v_bed_id;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.discharge_patient IS 'Discharge a patient and release their bed';

-- Function: Update bed status with history tracking
CREATE OR REPLACE FUNCTION public.update_bed_status(
  p_bed_id UUID,
  p_new_status bed_status,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_status bed_status;
  v_tenant_id UUID;
  v_old_status_changed_at TIMESTAMPTZ;
  v_duration_minutes INTEGER;
BEGIN
  -- Get current status
  SELECT status, tenant_id, status_changed_at
  INTO v_old_status, v_tenant_id, v_old_status_changed_at
  FROM public.beds
  WHERE id = p_bed_id;

  IF v_old_status IS NULL THEN
    RETURN false;
  END IF;

  -- Calculate duration in previous status
  v_duration_minutes := EXTRACT(EPOCH FROM (NOW() - v_old_status_changed_at)) / 60;

  -- Record history
  INSERT INTO public.bed_status_history (
    tenant_id, bed_id, previous_status, new_status,
    changed_by, reason, duration_minutes
  )
  VALUES (
    v_tenant_id, p_bed_id, v_old_status, p_new_status,
    auth.uid(), p_reason, v_duration_minutes
  );

  -- Update bed
  UPDATE public.beds
  SET status = p_new_status,
      status_changed_at = NOW(),
      status_changed_by = auth.uid(),
      status_notes = p_reason
  WHERE id = p_bed_id;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.update_bed_status IS 'Update bed status with automatic history tracking';

-- Function: Predict discharges for a unit/date
CREATE OR REPLACE FUNCTION public.predict_unit_discharges(
  p_unit_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  patient_id UUID,
  patient_name TEXT,
  bed_label TEXT,
  days_in_hospital INTEGER,
  expected_discharge_date DATE,
  discharge_likelihood TEXT,  -- High, Medium, Low
  los_remaining_days INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ba.patient_id,
    COALESCE(p.first_name || ' ' || p.last_name, 'Unknown') AS patient_name,
    b.bed_label,
    (p_date - ba.assigned_at::DATE) AS days_in_hospital,
    ba.expected_discharge_date,
    CASE
      WHEN ba.expected_discharge_date <= p_date THEN 'High'
      WHEN ba.expected_discharge_date <= p_date + 1 THEN 'Medium'
      ELSE 'Low'
    END AS discharge_likelihood,
    GREATEST(0, ba.expected_discharge_date - p_date) AS los_remaining_days
  FROM public.bed_assignments ba
  JOIN public.beds b ON b.id = ba.bed_id
  JOIN public.profiles p ON p.id = ba.patient_id
  WHERE ba.is_active = true
    AND b.unit_id = p_unit_id
    AND ba.expected_discharge_date IS NOT NULL
  ORDER BY ba.expected_discharge_date ASC, days_in_hospital DESC;
END;
$$;

COMMENT ON FUNCTION public.predict_unit_discharges IS 'List patients with expected discharge dates for forecasting';

-- Function: Generate forecast for a unit
CREATE OR REPLACE FUNCTION public.generate_bed_forecast(
  p_unit_id UUID,
  p_forecast_date DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_forecast_id UUID;
  v_tenant_id UUID;
  v_current_census INTEGER;
  v_total_beds INTEGER;
  v_expected_discharges INTEGER;
  v_scheduled_arrivals INTEGER;
  v_predicted_census INTEGER;
  v_predicted_available INTEGER;
  v_factors JSONB;
BEGIN
  -- Get tenant and total beds
  SELECT tenant_id, total_beds INTO v_tenant_id, v_total_beds
  FROM public.hospital_units WHERE id = p_unit_id;

  -- Current census (occupied beds)
  SELECT COUNT(*) INTO v_current_census
  FROM public.beds b
  JOIN public.bed_assignments ba ON ba.bed_id = b.id AND ba.is_active = true
  WHERE b.unit_id = p_unit_id AND b.status = 'occupied';

  -- Expected discharges
  SELECT COUNT(*) INTO v_expected_discharges
  FROM public.bed_assignments ba
  JOIN public.beds b ON b.id = ba.bed_id
  WHERE b.unit_id = p_unit_id
    AND ba.is_active = true
    AND ba.expected_discharge_date <= p_forecast_date;

  -- Scheduled arrivals
  SELECT COUNT(*) INTO v_scheduled_arrivals
  FROM public.scheduled_arrivals
  WHERE target_unit_id = p_unit_id
    AND scheduled_date = p_forecast_date
    AND status IN ('scheduled', 'confirmed');

  -- Calculate prediction
  v_predicted_census := GREATEST(0, v_current_census - v_expected_discharges + v_scheduled_arrivals);
  v_predicted_available := GREATEST(0, v_total_beds - v_predicted_census);

  -- Build factors JSON
  v_factors := jsonb_build_object(
    'current_census', v_current_census,
    'total_beds', v_total_beds,
    'expected_discharges', v_expected_discharges,
    'scheduled_arrivals', v_scheduled_arrivals,
    'days_ahead', p_forecast_date - CURRENT_DATE,
    'day_of_week', EXTRACT(DOW FROM p_forecast_date)
  );

  -- Insert forecast
  INSERT INTO public.bed_availability_forecasts (
    tenant_id, unit_id, forecast_date,
    predicted_census, predicted_available,
    predicted_discharges, predicted_admissions,
    confidence_level, factors_json
  )
  VALUES (
    v_tenant_id, p_unit_id, p_forecast_date,
    v_predicted_census, v_predicted_available,
    v_expected_discharges, v_scheduled_arrivals,
    0.75,  -- Base confidence
    v_factors
  )
  RETURNING id INTO v_forecast_id;

  RETURN v_forecast_id;
END;
$$;

COMMENT ON FUNCTION public.generate_bed_forecast IS 'Generate bed availability forecast for a unit/date';

-- ============================================================================
-- PART 10: VIEWS
-- ============================================================================

-- View: Current bed board
CREATE OR REPLACE VIEW public.v_bed_board AS
SELECT
  b.id AS bed_id,
  b.bed_label,
  b.room_number,
  b.bed_position,
  b.bed_type,
  b.status,
  b.status_changed_at,
  b.has_telemetry,
  b.has_isolation_capability,
  b.has_negative_pressure,
  u.id AS unit_id,
  u.unit_code,
  u.unit_name,
  u.unit_type,
  u.floor_number,
  f.id AS facility_id,
  f.name AS facility_name,
  ba.patient_id,
  p.first_name || ' ' || p.last_name AS patient_name,
  p.mrn AS patient_mrn,
  ba.assigned_at,
  ba.expected_discharge_date,
  hrs.final_risk_level AS patient_acuity,
  b.tenant_id
FROM public.beds b
JOIN public.hospital_units u ON u.id = b.unit_id
LEFT JOIN public.facilities f ON f.id = u.facility_id
LEFT JOIN public.bed_assignments ba ON ba.bed_id = b.id AND ba.is_active = true
LEFT JOIN public.profiles p ON p.id = ba.patient_id
LEFT JOIN public.shift_handoff_risk_scores hrs ON hrs.patient_id = ba.patient_id
  AND hrs.shift_date = CURRENT_DATE
WHERE b.is_active = true;

COMMENT ON VIEW public.v_bed_board IS 'Real-time bed board with patient assignments and acuity';

-- View: Unit capacity summary
CREATE OR REPLACE VIEW public.v_unit_capacity AS
SELECT
  u.id AS unit_id,
  u.unit_code,
  u.unit_name,
  u.unit_type,
  u.total_beds,
  u.target_census,
  u.max_census,
  f.name AS facility_name,
  COUNT(b.id) FILTER (WHERE b.is_active = true) AS active_beds,
  COUNT(b.id) FILTER (WHERE b.status = 'occupied') AS occupied,
  COUNT(b.id) FILTER (WHERE b.status = 'available') AS available,
  COUNT(b.id) FILTER (WHERE b.status IN ('dirty', 'cleaning')) AS pending_clean,
  COUNT(b.id) FILTER (WHERE b.status IN ('blocked', 'maintenance')) AS out_of_service,
  CASE WHEN u.total_beds > 0 THEN
    ROUND((COUNT(b.id) FILTER (WHERE b.status = 'occupied')::DECIMAL / u.total_beds) * 100, 1)
  ELSE 0 END AS occupancy_pct,
  u.tenant_id
FROM public.hospital_units u
LEFT JOIN public.facilities f ON f.id = u.facility_id
LEFT JOIN public.beds b ON b.unit_id = u.id
WHERE u.is_active = true
GROUP BY u.id, u.unit_code, u.unit_name, u.unit_type, u.total_beds,
         u.target_census, u.max_census, f.name, u.tenant_id;

COMMENT ON VIEW public.v_unit_capacity IS 'Summary of bed capacity and occupancy by unit';

-- ============================================================================
-- PART 11: TRIGGERS FOR BED STATUS HISTORY
-- ============================================================================

-- Automatically record bed status changes
CREATE OR REPLACE FUNCTION public.trg_record_bed_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_duration_minutes INTEGER;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Calculate duration in previous status
    v_duration_minutes := EXTRACT(EPOCH FROM (NOW() - OLD.status_changed_at)) / 60;

    INSERT INTO public.bed_status_history (
      tenant_id, bed_id, previous_status, new_status,
      changed_by, duration_minutes
    )
    VALUES (
      NEW.tenant_id, NEW.id, OLD.status, NEW.status,
      NEW.status_changed_by, v_duration_minutes
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bed_status_change ON public.beds;
CREATE TRIGGER trg_bed_status_change
  AFTER UPDATE OF status ON public.beds
  FOR EACH ROW EXECUTE FUNCTION public.trg_record_bed_status_change();

-- ============================================================================
-- PART 12: SAMPLE DATA COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.assign_patient_to_bed IS
'Usage: SELECT assign_patient_to_bed(
  p_patient_id := ''uuid-of-patient'',
  p_bed_id := ''uuid-of-bed'',
  p_expected_los_days := 3
);';

COMMENT ON FUNCTION public.discharge_patient IS
'Usage: SELECT discharge_patient(
  p_patient_id := ''uuid-of-patient'',
  p_disposition := ''Home''
);';

-- ============================================================================
-- DONE
-- ============================================================================

COMMIT;
