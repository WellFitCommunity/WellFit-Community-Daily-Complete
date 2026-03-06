-- Reference Data Version Tracking
-- Tracks CMS/AMA reference data versions used by MCP servers
-- Enables freshness monitoring and hard-fail when data is stale
--
-- P1-9: CMS Update Monitoring — Reference Data Freshness

CREATE TABLE IF NOT EXISTS public.reference_data_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data_source TEXT NOT NULL,                    -- 'ms_drg', 'icd10_cm', 'cpt', 'hcpcs', 'lcd_ncd', 'fee_schedule', 'nucc_taxonomy'
  fiscal_year INTEGER NOT NULL,                 -- e.g. 2026
  version_label TEXT NOT NULL,                  -- e.g. 'FY2026 v43.1', 'CY2026 Q1'
  source_url TEXT,                              -- URL where the data was downloaded from
  record_count INTEGER DEFAULT 0,               -- Number of rows loaded
  loaded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  loaded_by UUID REFERENCES auth.users(id),
  expected_update_date DATE,                    -- When CMS typically releases the next version
  update_frequency TEXT NOT NULL DEFAULT 'annual', -- 'annual', 'quarterly', 'ongoing'
  is_current BOOLEAN DEFAULT true,              -- Only one version per data_source should be current
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(data_source, fiscal_year, version_label)
);

-- Only one current version per data source
CREATE UNIQUE INDEX idx_reference_data_current
  ON public.reference_data_versions (data_source)
  WHERE is_current = true;

CREATE INDEX idx_reference_data_source ON public.reference_data_versions(data_source);
CREATE INDEX idx_reference_data_expected_update ON public.reference_data_versions(expected_update_date);

-- Enable RLS
ALTER TABLE public.reference_data_versions ENABLE ROW LEVEL SECURITY;

-- Admins can manage reference data versions
CREATE POLICY "Admins full access to reference_data_versions"
  ON public.reference_data_versions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Service role full access (edge functions)
CREATE POLICY "Service role access to reference_data_versions"
  ON public.reference_data_versions
  FOR ALL USING (auth.role() = 'service_role');

-- Providers can read
CREATE POLICY "Providers read reference_data_versions"
  ON public.reference_data_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('healthcare_provider', 'case_manager', 'admin', 'super_admin')
    )
  );

-- Seed known reference data sources with expected update schedules
INSERT INTO public.reference_data_versions (data_source, fiscal_year, version_label, update_frequency, expected_update_date, record_count, notes)
VALUES
  ('ms_drg', 2026, 'FY2026 v43', 'annual', '2026-10-01', 0, 'MS-DRG definitions and weights. Updated annually with IPPS Final Rule (Oct 1).'),
  ('icd10_cm', 2026, 'FY2026', 'annual', '2026-10-01', 0, 'ICD-10-CM diagnosis codes. Updated annually (Oct 1) with quarterly addenda.'),
  ('cpt', 2026, 'CY2026', 'annual', '2027-01-01', 0, 'CPT procedure codes. Updated annually (Jan 1). Requires AMA license for full set.'),
  ('hcpcs', 2026, 'CY2026 Q1', 'quarterly', '2026-04-01', 0, 'HCPCS Level II codes. Updated quarterly by CMS.'),
  ('fee_schedule', 2026, 'MPFS CY2026', 'annual', '2027-01-01', 0, 'Medicare Physician Fee Schedule. Updated annually with MPFS Final Rule (Jan 1).'),
  ('nucc_taxonomy', 2026, 'v26.0', 'annual', '2026-07-01', 24, 'NUCC provider taxonomy codes. Updated ~annually. Currently 24 of 600+ loaded.'),
  ('lcd_ncd', 2026, 'Ongoing', 'ongoing', NULL, 0, 'LCD/NCD coverage determinations. Updated on rolling basis — no fixed schedule.')
ON CONFLICT (data_source, fiscal_year, version_label) DO NOTHING;

-- Trigger for updated_at
CREATE TRIGGER update_reference_data_versions_updated_at
  BEFORE UPDATE ON public.reference_data_versions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.reference_data_versions IS 'Tracks CMS/AMA reference data versions for freshness monitoring. Stale data = wrong DRG, wrong codes, wrong coverage decisions.';
COMMENT ON COLUMN public.reference_data_versions.expected_update_date IS 'When CMS typically publishes the next version. Alerts fire 30 days past this date.';
