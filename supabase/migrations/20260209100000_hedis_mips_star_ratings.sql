-- =====================================================
-- HEDIS / MIPS / Star Ratings Extension
-- Extends existing eCQM system for multi-program quality reporting
-- ONC Criteria: 170.315(c)(1), (c)(2), (c)(3)
-- =====================================================

-- -------------------------------------------------------
-- 2a. Extend ecqm_measure_definitions with program columns
-- -------------------------------------------------------
ALTER TABLE ecqm_measure_definitions
  ADD COLUMN IF NOT EXISTS program_types TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hedis_measure_id VARCHAR(20),
  ADD COLUMN IF NOT EXISTS hedis_subdomain VARCHAR(100),
  ADD COLUMN IF NOT EXISTS mips_quality_id VARCHAR(20),
  ADD COLUMN IF NOT EXISTS mips_high_priority BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS star_domain VARCHAR(100),
  ADD COLUMN IF NOT EXISTS star_weight DECIMAL(3,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS star_cut_points JSONB,
  ADD COLUMN IF NOT EXISTS is_inverse_measure BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_source VARCHAR(50) DEFAULT 'clinical';

CREATE INDEX IF NOT EXISTS idx_ecqm_definitions_program_types
  ON ecqm_measure_definitions USING GIN (program_types);

CREATE INDEX IF NOT EXISTS idx_ecqm_definitions_hedis_id
  ON ecqm_measure_definitions (hedis_measure_id)
  WHERE hedis_measure_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ecqm_definitions_mips_id
  ON ecqm_measure_definitions (mips_quality_id)
  WHERE mips_quality_id IS NOT NULL;

COMMENT ON COLUMN ecqm_measure_definitions.program_types IS 'Quality programs this measure belongs to: ecqm, hedis, mips, stars';
COMMENT ON COLUMN ecqm_measure_definitions.hedis_measure_id IS 'NCQA HEDIS measure abbreviation (e.g. CDC, CBP)';
COMMENT ON COLUMN ecqm_measure_definitions.hedis_subdomain IS 'HEDIS domain grouping (e.g. Effectiveness of Care)';
COMMENT ON COLUMN ecqm_measure_definitions.mips_quality_id IS 'CMS MIPS quality measure ID (e.g. Q001)';
COMMENT ON COLUMN ecqm_measure_definitions.mips_high_priority IS 'Whether this is a MIPS high-priority measure';
COMMENT ON COLUMN ecqm_measure_definitions.star_domain IS 'CMS Star Ratings domain';
COMMENT ON COLUMN ecqm_measure_definitions.star_weight IS 'Relative weight within star domain (0.00-1.00)';
COMMENT ON COLUMN ecqm_measure_definitions.star_cut_points IS 'Star rating cut points: {"1":0,"2":0.40,"3":0.60,"4":0.75,"5":0.90}';
COMMENT ON COLUMN ecqm_measure_definitions.is_inverse_measure IS 'True if lower performance rate is better (e.g. CMS122 HbA1c poor control)';
COMMENT ON COLUMN ecqm_measure_definitions.data_source IS 'Data source: clinical, claims, survey, hybrid';

-- -------------------------------------------------------
-- 2b. MIPS composite scores table
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS mips_composite_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reporting_year INTEGER NOT NULL,

  -- Four MIPS categories (each 0-100 points)
  quality_score DECIMAL(5,2) DEFAULT 0,
  quality_weight DECIMAL(3,2) DEFAULT 0.30,
  cost_score DECIMAL(5,2) DEFAULT 0,
  cost_weight DECIMAL(3,2) DEFAULT 0.30,
  improvement_activities_score DECIMAL(5,2) DEFAULT 0,
  improvement_activities_weight DECIMAL(3,2) DEFAULT 0.15,
  promoting_interoperability_score DECIMAL(5,2) DEFAULT 0,
  promoting_interoperability_weight DECIMAL(3,2) DEFAULT 0.25,

  -- Composite
  final_composite_score DECIMAL(5,2) DEFAULT 0,
  payment_adjustment_percent DECIMAL(5,2) DEFAULT 0,
  benchmark_decile INTEGER CHECK (benchmark_decile BETWEEN 1 AND 10),

  -- Quality category detail
  quality_measure_scores JSONB DEFAULT '[]',
  quality_measures_reported INTEGER DEFAULT 0,
  quality_bonus_points DECIMAL(5,2) DEFAULT 0,

  -- Metadata
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  calculated_by UUID REFERENCES auth.users(id),
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, reporting_year)
);

CREATE INDEX IF NOT EXISTS idx_mips_composite_tenant
  ON mips_composite_scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mips_composite_year
  ON mips_composite_scores(reporting_year);

COMMENT ON TABLE mips_composite_scores IS 'MIPS composite scores: 4-category weighted scoring with payment adjustment';

-- -------------------------------------------------------
-- 2c. Star rating scores table
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS star_rating_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reporting_year INTEGER NOT NULL,
  rating_type VARCHAR(10) NOT NULL DEFAULT 'part_c' CHECK (rating_type IN ('part_c', 'part_d')),

  -- Domain scores (each 1.0-5.0)
  domain_scores JSONB DEFAULT '{}',

  -- Domain weights (must sum to 1.0)
  domain_weights JSONB DEFAULT '{}',

  -- Overall star rating (1-5, half-stars stored as decimals)
  overall_star_rating DECIMAL(2,1) CHECK (overall_star_rating BETWEEN 1.0 AND 5.0),

  -- Measure-level detail
  measure_star_details JSONB DEFAULT '[]',

  -- Trend (year-over-year)
  previous_year_rating DECIMAL(2,1),
  trend_direction VARCHAR(10) CHECK (trend_direction IN ('up', 'down', 'stable')),

  -- Summary metrics
  total_measures_rated INTEGER DEFAULT 0,
  measures_at_4_plus INTEGER DEFAULT 0,
  measures_below_3 INTEGER DEFAULT 0,

  -- Metadata
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  calculated_by UUID REFERENCES auth.users(id),
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, reporting_year, rating_type)
);

CREATE INDEX IF NOT EXISTS idx_star_ratings_tenant
  ON star_rating_scores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_star_ratings_year
  ON star_rating_scores(reporting_year);

COMMENT ON TABLE star_rating_scores IS 'CMS Star Ratings (1-5): domain-weighted overall rating with trend tracking';

-- -------------------------------------------------------
-- 2d. MIPS improvement activities table
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS mips_improvement_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reporting_year INTEGER NOT NULL,

  -- Activity identification
  activity_id VARCHAR(20) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category VARCHAR(50),
  subcategory VARCHAR(50),

  -- Weight: medium = 10pts, high = 20pts
  weight VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (weight IN ('medium', 'high')),
  points INTEGER NOT NULL DEFAULT 10,

  -- Attestation
  is_attested BOOLEAN DEFAULT false,
  attestation_date DATE,
  attested_by UUID REFERENCES auth.users(id),
  evidence_notes TEXT,
  evidence_document_ids UUID[] DEFAULT '{}',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, reporting_year, activity_id)
);

CREATE INDEX IF NOT EXISTS idx_mips_ia_tenant
  ON mips_improvement_activities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mips_ia_year
  ON mips_improvement_activities(reporting_year);
CREATE INDEX IF NOT EXISTS idx_mips_ia_attested
  ON mips_improvement_activities(is_attested)
  WHERE is_attested = true;

COMMENT ON TABLE mips_improvement_activities IS 'MIPS Improvement Activities attestation tracking';

-- -------------------------------------------------------
-- 2e. RLS policies on new tables
-- -------------------------------------------------------
ALTER TABLE mips_composite_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE star_rating_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE mips_improvement_activities ENABLE ROW LEVEL SECURITY;

-- MIPS composite scores: tenant-scoped
CREATE POLICY "mips_composite_tenant_select"
  ON mips_composite_scores FOR SELECT TO authenticated
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "mips_composite_tenant_insert"
  ON mips_composite_scores FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "mips_composite_tenant_update"
  ON mips_composite_scores FOR UPDATE TO authenticated
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

-- Star rating scores: tenant-scoped
CREATE POLICY "star_ratings_tenant_select"
  ON star_rating_scores FOR SELECT TO authenticated
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "star_ratings_tenant_insert"
  ON star_rating_scores FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "star_ratings_tenant_update"
  ON star_rating_scores FOR UPDATE TO authenticated
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

-- MIPS improvement activities: tenant-scoped
CREATE POLICY "mips_ia_tenant_select"
  ON mips_improvement_activities FOR SELECT TO authenticated
  USING (tenant_id = get_current_tenant_id());

CREATE POLICY "mips_ia_tenant_insert"
  ON mips_improvement_activities FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_current_tenant_id());

CREATE POLICY "mips_ia_tenant_update"
  ON mips_improvement_activities FOR UPDATE TO authenticated
  USING (tenant_id = get_current_tenant_id())
  WITH CHECK (tenant_id = get_current_tenant_id());

-- -------------------------------------------------------
-- 2f. Seed existing 8 measures with program_types, HEDIS IDs, Star domains, cut points
-- -------------------------------------------------------

-- CMS122: Diabetes HbA1c Poor Control — inverse measure (lower is better)
UPDATE ecqm_measure_definitions
SET
  program_types = ARRAY['ecqm', 'hedis', 'mips', 'stars'],
  hedis_measure_id = 'CDC',
  hedis_subdomain = 'Effectiveness of Care',
  mips_quality_id = 'Q001',
  mips_high_priority = true,
  star_domain = 'Managing Chronic Conditions',
  star_weight = 1.00,
  star_cut_points = '{"1": 1.00, "2": 0.60, "3": 0.40, "4": 0.25, "5": 0.15}'::JSONB,
  is_inverse_measure = true,
  data_source = 'clinical'
WHERE measure_id = 'CMS122v12';

-- CMS134: Diabetes Nephropathy
UPDATE ecqm_measure_definitions
SET
  program_types = ARRAY['ecqm', 'hedis', 'mips'],
  hedis_measure_id = 'CDC',
  hedis_subdomain = 'Effectiveness of Care',
  mips_quality_id = 'Q119',
  mips_high_priority = false,
  star_domain = NULL,
  star_weight = 0.00,
  star_cut_points = NULL,
  is_inverse_measure = false,
  data_source = 'clinical'
WHERE measure_id = 'CMS134v12';

-- CMS165: Controlling High Blood Pressure
UPDATE ecqm_measure_definitions
SET
  program_types = ARRAY['ecqm', 'hedis', 'mips', 'stars'],
  hedis_measure_id = 'CBP',
  hedis_subdomain = 'Effectiveness of Care',
  mips_quality_id = 'Q236',
  mips_high_priority = true,
  star_domain = 'Managing Chronic Conditions',
  star_weight = 1.00,
  star_cut_points = '{"1": 0.00, "2": 0.50, "3": 0.65, "4": 0.75, "5": 0.85}'::JSONB,
  is_inverse_measure = false,
  data_source = 'clinical'
WHERE measure_id = 'CMS165v12';

-- CMS127: Pneumococcal Vaccination
UPDATE ecqm_measure_definitions
SET
  program_types = ARRAY['ecqm', 'hedis', 'mips', 'stars'],
  hedis_measure_id = 'PNU',
  hedis_subdomain = 'Effectiveness of Care',
  mips_quality_id = 'Q111',
  mips_high_priority = false,
  star_domain = 'Staying Healthy',
  star_weight = 0.50,
  star_cut_points = '{"1": 0.00, "2": 0.40, "3": 0.60, "4": 0.75, "5": 0.90}'::JSONB,
  is_inverse_measure = false,
  data_source = 'clinical'
WHERE measure_id = 'CMS127v12';

-- CMS147: Influenza Immunization
UPDATE ecqm_measure_definitions
SET
  program_types = ARRAY['ecqm', 'hedis', 'mips', 'stars'],
  hedis_measure_id = 'FVO',
  hedis_subdomain = 'Effectiveness of Care',
  mips_quality_id = 'Q110',
  mips_high_priority = false,
  star_domain = 'Staying Healthy',
  star_weight = 0.50,
  star_cut_points = '{"1": 0.00, "2": 0.35, "3": 0.55, "4": 0.70, "5": 0.85}'::JSONB,
  is_inverse_measure = false,
  data_source = 'clinical'
WHERE measure_id = 'CMS147v13';

-- CMS159: Depression Remission
UPDATE ecqm_measure_definitions
SET
  program_types = ARRAY['ecqm', 'mips'],
  hedis_measure_id = NULL,
  hedis_subdomain = NULL,
  mips_quality_id = 'Q370',
  mips_high_priority = true,
  star_domain = 'Managing Chronic Conditions',
  star_weight = 0.50,
  star_cut_points = '{"1": 0.00, "2": 0.10, "3": 0.20, "4": 0.30, "5": 0.40}'::JSONB,
  is_inverse_measure = false,
  data_source = 'clinical'
WHERE measure_id = 'CMS159v12';

-- CMS130: Colorectal Cancer Screening
UPDATE ecqm_measure_definitions
SET
  program_types = ARRAY['ecqm', 'hedis', 'mips', 'stars'],
  hedis_measure_id = 'COL',
  hedis_subdomain = 'Effectiveness of Care',
  mips_quality_id = 'Q113',
  mips_high_priority = false,
  star_domain = 'Staying Healthy',
  star_weight = 1.00,
  star_cut_points = '{"1": 0.00, "2": 0.45, "3": 0.60, "4": 0.72, "5": 0.82}'::JSONB,
  is_inverse_measure = false,
  data_source = 'clinical'
WHERE measure_id = 'CMS130v12';

-- CMS125: Breast Cancer Screening
UPDATE ecqm_measure_definitions
SET
  program_types = ARRAY['ecqm', 'hedis', 'mips', 'stars'],
  hedis_measure_id = 'BCS',
  hedis_subdomain = 'Effectiveness of Care',
  mips_quality_id = 'Q112',
  mips_high_priority = false,
  star_domain = 'Staying Healthy',
  star_weight = 1.00,
  star_cut_points = '{"1": 0.00, "2": 0.50, "3": 0.65, "4": 0.76, "5": 0.85}'::JSONB,
  is_inverse_measure = false,
  data_source = 'clinical'
WHERE measure_id = 'CMS125v12';
