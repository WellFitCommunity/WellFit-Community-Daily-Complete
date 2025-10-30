-- ============================================================================
-- AUTO-PROCESS MEDICATION PHOTOS TO MEDICATION LIST
-- Automatically create medication entries from successful OCR extractions
-- ============================================================================

BEGIN;

-- ============================================================================
-- FUNCTION: Process medication image extraction to create medication entry
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_create_medication_from_extraction(
  extraction_id UUID
)
RETURNS UUID AS $$
DECLARE
  extraction_record RECORD;
  new_medication_id UUID;
  patient_user_id UUID;
BEGIN
  -- Get extraction record
  SELECT * INTO extraction_record
  FROM public.medication_image_extractions
  WHERE id = extraction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Medication image extraction % not found', extraction_id;
  END IF;

  -- Check if already processed
  IF extraction_record.created_medication_id IS NOT NULL THEN
    RETURN extraction_record.created_medication_id;
  END IF;

  -- Get patient user_id from extraction
  patient_user_id := extraction_record.user_id;

  -- Extract medication data from extraction record
  -- Assuming extraction_record has: medication_name, dosage, frequency, etc.
  INSERT INTO public.medications (
    user_id,
    medication_name,
    dosage_amount,
    dosage_unit,
    frequency,
    route,
    start_date,
    status,
    notes,
    source,
    created_at,
    updated_at
  ) VALUES (
    patient_user_id,
    COALESCE(extraction_record.medication_name, 'Unknown Medication'),
    extraction_record.dosage_value,
    extraction_record.dosage_unit,
    extraction_record.frequency,
    COALESCE(extraction_record.route, 'oral'),
    COALESCE(extraction_record.prescribed_date::TIMESTAMPTZ, NOW()),
    'active',
    'Auto-created from medication photo capture on ' || NOW()::TEXT,
    'ocr_extraction',
    NOW(),
    NOW()
  )
  RETURNING id INTO new_medication_id;

  -- Link back to extraction
  UPDATE public.medication_image_extractions
  SET created_medication_id = new_medication_id,
      processed_at = NOW(),
      updated_at = NOW()
  WHERE id = extraction_id;

  RAISE NOTICE 'Created medication % from extraction %', new_medication_id, extraction_id;

  RETURN new_medication_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION auto_create_medication_from_extraction IS 'Automatically creates medication entry from OCR extraction for patient visibility';

-- ============================================================================
-- TRIGGER: Auto-process high confidence extractions
-- ============================================================================

CREATE OR REPLACE FUNCTION trg_auto_process_medication_extraction()
RETURNS TRIGGER AS $$
BEGIN
  -- Only auto-process if:
  -- 1. Confidence is high (>= 0.8)
  -- 2. Medication name is present
  -- 3. Not already processed
  IF NEW.confidence >= 0.8
     AND NEW.medication_name IS NOT NULL
     AND NEW.medication_name != ''
     AND NEW.created_medication_id IS NULL
  THEN
    BEGIN
      -- Call auto-creation function
      PERFORM auto_create_medication_from_extraction(NEW.id);

      RAISE NOTICE 'Auto-processed medication extraction % with confidence %', NEW.id, NEW.confidence;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the extraction insert
      RAISE WARNING 'Failed to auto-process medication extraction %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS after_medication_extraction_insert ON public.medication_image_extractions;

-- Create trigger
CREATE TRIGGER after_medication_extraction_insert
AFTER INSERT ON public.medication_image_extractions
FOR EACH ROW
EXECUTE FUNCTION trg_auto_process_medication_extraction();

COMMENT ON FUNCTION trg_auto_process_medication_extraction IS 'Automatically processes high-confidence medication extractions to create medication entries';

COMMIT;
