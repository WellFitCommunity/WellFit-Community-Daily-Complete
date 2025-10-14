-- Fee Schedule Tables for Annual Updates
-- Replaces hardcoded reimbursement rates with database-driven fee schedules
-- Critical for CMS rate updates and multi-payer support

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS public.fee_schedule_rates CASCADE;
DROP TABLE IF EXISTS public.fee_schedules CASCADE;

-- Main fee schedules table
CREATE TABLE public.fee_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  payer_type TEXT NOT NULL CHECK (payer_type IN ('medicare', 'medicaid', 'commercial', 'self_pay')),
  effective_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  locality TEXT, -- For Medicare locality adjustments
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(payer_type, effective_date, locality)
);

-- Fee schedule rates for individual codes
CREATE TABLE public.fee_schedule_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fee_schedule_id UUID NOT NULL REFERENCES public.fee_schedules(id) ON DELETE CASCADE,
  code_type TEXT NOT NULL CHECK (code_type IN ('cpt', 'hcpcs', 'icd10')),
  code TEXT NOT NULL,
  description TEXT,
  rate DECIMAL(10, 2) NOT NULL,
  time_required_minutes INTEGER,
  modifier_adjustments JSONB DEFAULT '{}'::jsonb, -- Store modifier rate adjustments
  requires_authorization BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(fee_schedule_id, code_type, code)
);

-- Indexes for performance
CREATE INDEX idx_fee_schedules_payer_active ON public.fee_schedules(payer_type, is_active);
CREATE INDEX idx_fee_schedules_effective_date ON public.fee_schedules(effective_date DESC);
CREATE INDEX idx_fee_schedule_rates_code ON public.fee_schedule_rates(code_type, code);
CREATE INDEX idx_fee_schedule_rates_schedule ON public.fee_schedule_rates(fee_schedule_id);

-- Enable Row Level Security
ALTER TABLE public.fee_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_schedule_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can do anything
CREATE POLICY "Admins full access to fee_schedules" ON public.fee_schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins full access to fee_schedule_rates" ON public.fee_schedule_rates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Healthcare providers can read active fee schedules
CREATE POLICY "Providers read active fee_schedules" ON public.fee_schedules
  FOR SELECT USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('healthcare_provider', 'case_manager', 'admin', 'super_admin')
    )
  );

CREATE POLICY "Providers read fee_schedule_rates" ON public.fee_schedule_rates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('healthcare_provider', 'case_manager', 'admin', 'super_admin')
    )
  );

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_fee_schedules_updated_at BEFORE UPDATE ON public.fee_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fee_schedule_rates_updated_at BEFORE UPDATE ON public.fee_schedule_rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert 2025 Medicare Fee Schedule (National Average)
-- Data source: CMS Physician Fee Schedule 2025
INSERT INTO public.fee_schedules (name, payer_type, effective_date, is_active, notes)
VALUES (
  'Medicare 2025 National Average',
  'medicare',
  '2025-01-01',
  true,
  'CMS Physician Fee Schedule 2025 - National Average Rates'
);

-- Get the ID of the newly created schedule
DO $$
DECLARE
  medicare_2025_id UUID;
BEGIN
  SELECT id INTO medicare_2025_id
  FROM public.fee_schedules
  WHERE name = 'Medicare 2025 National Average';

  -- Insert CCM billing codes with 2025 rates
  INSERT INTO public.fee_schedule_rates (fee_schedule_id, code_type, code, description, rate, time_required_minutes, notes)
  VALUES
    -- Chronic Care Management (CCM) codes
    (medicare_2025_id, 'cpt', '99490', 'Chronic care management services, first 20 minutes', 64.72, 20, 'Standard CCM - requires 2+ chronic conditions'),
    (medicare_2025_id, 'cpt', '99491', 'Chronic care management services, each additional 20 minutes', 58.34, 20, 'Add-on to 99490'),
    (medicare_2025_id, 'cpt', '99487', 'Complex chronic care management services, first 60 minutes', 145.60, 60, 'Complex CCM - requires moderate/high complexity medical decision making'),
    (medicare_2025_id, 'cpt', '99489', 'Complex chronic care management services, each additional 30 minutes', 69.72, 30, 'Add-on to 99487'),

    -- Additional CCM/Care Management codes
    (medicare_2025_id, 'cpt', '99439', 'Chronic care management services, each additional 20 minutes', 31.00, 20, 'Legacy CCM add-on code'),

    -- Common E/M codes for reference
    (medicare_2025_id, 'cpt', '99211', 'Office visit, established patient, minimal', 26.00, 5, 'Level 1 E/M'),
    (medicare_2025_id, 'cpt', '99212', 'Office visit, established patient, low complexity', 57.00, 10, 'Level 2 E/M'),
    (medicare_2025_id, 'cpt', '99213', 'Office visit, established patient, moderate complexity', 93.00, 20, 'Level 3 E/M'),
    (medicare_2025_id, 'cpt', '99214', 'Office visit, established patient, moderate to high complexity', 135.00, 30, 'Level 4 E/M'),
    (medicare_2025_id, 'cpt', '99215', 'Office visit, established patient, high complexity', 185.00, 40, 'Level 5 E/M'),

    -- Telehealth codes
    (medicare_2025_id, 'cpt', '99441', 'Telephone E/M service, 5-10 minutes', 14.00, 10, 'Telehealth'),
    (medicare_2025_id, 'cpt', '99442', 'Telephone E/M service, 11-20 minutes', 27.00, 20, 'Telehealth'),
    (medicare_2025_id, 'cpt', '99443', 'Telephone E/M service, 21-30 minutes', 50.00, 30, 'Telehealth');
END $$;

-- Add comment for documentation
COMMENT ON TABLE public.fee_schedules IS 'Stores fee schedules for different payers and effective dates. Update annually with CMS rate changes.';
COMMENT ON TABLE public.fee_schedule_rates IS 'Individual code rates for each fee schedule. Supports CPT, HCPCS, and ICD-10 codes.';
COMMENT ON COLUMN public.fee_schedule_rates.modifier_adjustments IS 'JSON object storing modifier-specific rate adjustments, e.g., {"25": 1.0, "59": 1.0}';
