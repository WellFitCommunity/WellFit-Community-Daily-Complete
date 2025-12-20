-- Seed Fee Schedule Rates
-- Medicare 2025 National Averages for CCM and common billing codes
-- These rates make the feeScheduleService functional

BEGIN;

-- Get the Medicare 2025 fee schedule ID
DO $$
DECLARE
  v_schedule_id UUID;
BEGIN
  -- Get or create the Medicare 2025 schedule
  SELECT id INTO v_schedule_id
  FROM public.fee_schedules
  WHERE payer_type = 'medicare' AND is_active = true
  ORDER BY effective_date DESC
  LIMIT 1;

  IF v_schedule_id IS NULL THEN
    INSERT INTO public.fee_schedules (name, payer_type, is_active, effective_date)
    VALUES ('Medicare 2025 National Average', 'medicare', true, '2025-01-01')
    RETURNING id INTO v_schedule_id;
  END IF;

  -- Insert CCM (Chronic Care Management) codes
  INSERT INTO public.fee_schedule_rates (fee_schedule_id, code_type, code, description, rate, time_required_minutes)
  VALUES
    (v_schedule_id, 'cpt', '99490', 'CCM services, at least 20 minutes clinical staff time', 64.72, 20),
    (v_schedule_id, 'cpt', '99491', 'CCM services, at least 30 minutes physician/QHP time', 58.34, 30),
    (v_schedule_id, 'cpt', '99487', 'Complex CCM, first 60 minutes clinical staff time', 145.60, 60),
    (v_schedule_id, 'cpt', '99489', 'Complex CCM, each additional 30 minutes', 69.72, 30),
    (v_schedule_id, 'cpt', '99439', 'CCM, each additional 20 minutes', 31.00, 20)
  ON CONFLICT (fee_schedule_id, code_type, code) DO UPDATE SET
    rate = EXCLUDED.rate,
    description = EXCLUDED.description,
    time_required_minutes = EXCLUDED.time_required_minutes;

  -- Insert Principal Care Management codes
  INSERT INTO public.fee_schedule_rates (fee_schedule_id, code_type, code, description, rate, time_required_minutes)
  VALUES
    (v_schedule_id, 'cpt', '99424', 'Principal care management services, first 30 minutes', 85.00, 30),
    (v_schedule_id, 'cpt', '99425', 'Principal care management, each additional 30 minutes', 42.00, 30),
    (v_schedule_id, 'cpt', '99426', 'Principal care management, initial, first 30 minutes', 75.00, 30),
    (v_schedule_id, 'cpt', '99427', 'Principal care management, initial, additional 30 minutes', 40.00, 30)
  ON CONFLICT (fee_schedule_id, code_type, code) DO UPDATE SET
    rate = EXCLUDED.rate,
    description = EXCLUDED.description,
    time_required_minutes = EXCLUDED.time_required_minutes;

  -- Insert Remote Patient Monitoring codes
  INSERT INTO public.fee_schedule_rates (fee_schedule_id, code_type, code, description, rate, time_required_minutes)
  VALUES
    (v_schedule_id, 'cpt', '99453', 'Remote patient monitoring setup/education', 19.00, NULL),
    (v_schedule_id, 'cpt', '99454', 'Remote patient monitoring device supply', 65.00, NULL),
    (v_schedule_id, 'cpt', '99457', 'Remote physiologic monitoring, first 20 minutes', 54.00, 20),
    (v_schedule_id, 'cpt', '99458', 'Remote physiologic monitoring, additional 20 minutes', 42.00, 20),
    (v_schedule_id, 'cpt', '99091', 'Collection and interpretation of patient data', 57.00, 30)
  ON CONFLICT (fee_schedule_id, code_type, code) DO UPDATE SET
    rate = EXCLUDED.rate,
    description = EXCLUDED.description,
    time_required_minutes = EXCLUDED.time_required_minutes;

  -- Insert E/M Office Visit codes
  INSERT INTO public.fee_schedule_rates (fee_schedule_id, code_type, code, description, rate, time_required_minutes)
  VALUES
    (v_schedule_id, 'cpt', '99211', 'Office visit, established patient, minimal', 26.00, 5),
    (v_schedule_id, 'cpt', '99212', 'Office visit, established patient, low complexity', 57.00, 15),
    (v_schedule_id, 'cpt', '99213', 'Office visit, established patient, moderate', 93.00, 20),
    (v_schedule_id, 'cpt', '99214', 'Office visit, established patient, moderate-high', 135.00, 30),
    (v_schedule_id, 'cpt', '99215', 'Office visit, established patient, high complexity', 185.00, 40),
    (v_schedule_id, 'cpt', '99201', 'Office visit, new patient, straightforward', 65.00, 15),
    (v_schedule_id, 'cpt', '99202', 'Office visit, new patient, low complexity', 94.00, 20),
    (v_schedule_id, 'cpt', '99203', 'Office visit, new patient, moderate', 130.00, 30),
    (v_schedule_id, 'cpt', '99204', 'Office visit, new patient, moderate-high', 195.00, 45),
    (v_schedule_id, 'cpt', '99205', 'Office visit, new patient, high complexity', 250.00, 60)
  ON CONFLICT (fee_schedule_id, code_type, code) DO UPDATE SET
    rate = EXCLUDED.rate,
    description = EXCLUDED.description,
    time_required_minutes = EXCLUDED.time_required_minutes;

  -- Insert Telehealth codes
  INSERT INTO public.fee_schedule_rates (fee_schedule_id, code_type, code, description, rate, time_required_minutes)
  VALUES
    (v_schedule_id, 'cpt', '99441', 'Telephone E/M, 5-10 minutes', 14.00, 10),
    (v_schedule_id, 'cpt', '99442', 'Telephone E/M, 11-20 minutes', 27.00, 20),
    (v_schedule_id, 'cpt', '99443', 'Telephone E/M, 21-30 minutes', 50.00, 30)
  ON CONFLICT (fee_schedule_id, code_type, code) DO UPDATE SET
    rate = EXCLUDED.rate,
    description = EXCLUDED.description,
    time_required_minutes = EXCLUDED.time_required_minutes;

  -- Insert Behavioral Health Integration codes
  INSERT INTO public.fee_schedule_rates (fee_schedule_id, code_type, code, description, rate, time_required_minutes)
  VALUES
    (v_schedule_id, 'cpt', '99484', 'General behavioral health integration care management', 48.00, 20),
    (v_schedule_id, 'cpt', '99492', 'Initial psychiatric collaborative care, first 70 minutes', 140.00, 70),
    (v_schedule_id, 'cpt', '99493', 'Subsequent psychiatric collaborative care, first 60 minutes', 115.00, 60),
    (v_schedule_id, 'cpt', '99494', 'Initial/subsequent psychiatric care, additional 30 minutes', 50.00, 30)
  ON CONFLICT (fee_schedule_id, code_type, code) DO UPDATE SET
    rate = EXCLUDED.rate,
    description = EXCLUDED.description,
    time_required_minutes = EXCLUDED.time_required_minutes;

  -- Insert AWV (Annual Wellness Visit) codes
  INSERT INTO public.fee_schedule_rates (fee_schedule_id, code_type, code, description, rate, time_required_minutes)
  VALUES
    (v_schedule_id, 'cpt', 'G0438', 'Annual wellness visit, first visit (IPPE)', 175.00, 60),
    (v_schedule_id, 'cpt', 'G0439', 'Annual wellness visit, subsequent', 125.00, 45),
    (v_schedule_id, 'cpt', 'G0442', 'Alcohol misuse screening', 17.00, NULL),
    (v_schedule_id, 'cpt', 'G0443', 'Alcohol misuse counseling', 26.00, 15),
    (v_schedule_id, 'cpt', 'G0444', 'Depression screening', 18.00, NULL),
    (v_schedule_id, 'cpt', 'G0446', 'Intensive behavioral therapy for CVD', 27.00, 15)
  ON CONFLICT (fee_schedule_id, code_type, code) DO UPDATE SET
    rate = EXCLUDED.rate,
    description = EXCLUDED.description,
    time_required_minutes = EXCLUDED.time_required_minutes;

  -- Insert SDOH-related HCPCS codes
  INSERT INTO public.fee_schedule_rates (fee_schedule_id, code_type, code, description, rate, time_required_minutes)
  VALUES
    (v_schedule_id, 'hcpcs', 'G0136', 'SDOH risk assessment', 15.00, NULL),
    (v_schedule_id, 'hcpcs', 'G0019', 'Community health worker services, first 30 minutes', 30.00, 30),
    (v_schedule_id, 'hcpcs', 'G0022', 'Community health worker services, additional 30 minutes', 25.00, 30),
    (v_schedule_id, 'hcpcs', 'T1016', 'Case management services, per 15 minutes', 16.00, 15),
    (v_schedule_id, 'hcpcs', 'T1017', 'Targeted case management, per month', 210.00, NULL)
  ON CONFLICT (fee_schedule_id, code_type, code) DO UPDATE SET
    rate = EXCLUDED.rate,
    description = EXCLUDED.description,
    time_required_minutes = EXCLUDED.time_required_minutes;

  RAISE NOTICE 'Seeded % fee schedule rates for Medicare 2025', (
    SELECT COUNT(*) FROM public.fee_schedule_rates WHERE fee_schedule_id = v_schedule_id
  );
END $$;

-- Add unique constraint if not exists
ALTER TABLE public.fee_schedule_rates
  DROP CONSTRAINT IF EXISTS fee_schedule_rates_unique_code;

ALTER TABLE public.fee_schedule_rates
  ADD CONSTRAINT fee_schedule_rates_unique_code
  UNIQUE (fee_schedule_id, code_type, code);

COMMIT;
