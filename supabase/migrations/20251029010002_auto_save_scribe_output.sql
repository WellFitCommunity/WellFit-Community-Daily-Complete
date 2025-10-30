-- ============================================================================
-- AUTO-SAVE SMART SCRIBE OUTPUT TO CLINICAL NOTES AND ENCOUNTERS
-- Automatically creates clinical notes and populates billing codes from scribe sessions
-- ============================================================================

BEGIN;

-- ============================================================================
-- FUNCTION: Auto-save scribe session to clinical note
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_save_scribe_to_clinical_note(
  scribe_session_id UUID
)
RETURNS UUID AS $$
DECLARE
  scribe_record RECORD;
  note_id UUID;
  enc_id UUID;
  suggested_cpt JSONB;
  suggested_icd JSONB;
  cpt_code RECORD;
  icd_code RECORD;
BEGIN
  -- Get scribe session
  SELECT * INTO scribe_record
  FROM public.scribe_sessions
  WHERE id = scribe_session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scribe session % not found', scribe_session_id;
  END IF;

  -- Check if already processed
  IF scribe_record.generated_note_id IS NOT NULL THEN
    RETURN scribe_record.generated_note_id;
  END IF;

  -- Check if transcription is complete
  IF scribe_record.transcription_status != 'completed' THEN
    RAISE NOTICE 'Scribe session % not yet completed (status: %)', scribe_session_id, scribe_record.transcription_status;
    RETURN NULL;
  END IF;

  -- Check if we have note content
  IF scribe_record.soap_note IS NULL OR scribe_record.soap_note = '' THEN
    RAISE NOTICE 'Scribe session % has no SOAP note content', scribe_session_id;
    RETURN NULL;
  END IF;

  -- Get or create encounter
  IF scribe_record.encounter_id IS NOT NULL THEN
    enc_id := scribe_record.encounter_id;
  ELSE
    -- Create encounter for this scribe session
    INSERT INTO public.encounters (
      patient_id,
      provider_id,
      encounter_date,
      encounter_type,
      class,
      status,
      type_display,
      created_at,
      updated_at
    ) VALUES (
      scribe_record.patient_id,
      scribe_record.provider_id,
      COALESCE(scribe_record.session_date, NOW()),
      'OUTPATIENT',
      'ambulatory',
      'finished',
      'Office Visit',
      NOW(),
      NOW()
    )
    RETURNING id INTO enc_id;

    -- Link encounter back to scribe session
    UPDATE public.scribe_sessions
    SET encounter_id = enc_id,
        updated_at = NOW()
    WHERE id = scribe_session_id;
  END IF;

  -- Create clinical note
  INSERT INTO public.clinical_notes (
    encounter_id,
    patient_id,
    provider_id,
    note_type,
    note_content,
    status,
    subjective,
    objective,
    assessment,
    plan,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    enc_id,
    scribe_record.patient_id,
    scribe_record.provider_id,
    'progress_note',
    scribe_record.soap_note,
    'final',
    scribe_record.subjective,
    scribe_record.objective,
    scribe_record.assessment,
    scribe_record.plan,
    scribe_record.provider_id,
    NOW(),
    NOW()
  )
  RETURNING id INTO note_id;

  -- Link note back to scribe session
  UPDATE public.scribe_sessions
  SET generated_note_id = note_id,
      note_saved_at = NOW(),
      updated_at = NOW()
  WHERE id = scribe_session_id;

  -- Process suggested CPT codes (if exists)
  suggested_cpt := scribe_record.suggested_cpt_codes;
  IF suggested_cpt IS NOT NULL AND jsonb_array_length(suggested_cpt) > 0 THEN
    FOR cpt_code IN
      SELECT
        value->>'code' AS code,
        value->>'description' AS description,
        (value->>'confidence')::DECIMAL AS confidence
      FROM jsonb_array_elements(suggested_cpt)
    LOOP
      -- Only add high-confidence codes (>= 0.7)
      IF cpt_code.confidence >= 0.7 THEN
        INSERT INTO public.encounter_procedures (
          encounter_id,
          cpt_code,
          description,
          provider_id,
          procedure_date,
          status,
          source,
          confidence_score,
          created_at,
          updated_at
        ) VALUES (
          enc_id,
          cpt_code.code,
          cpt_code.description,
          scribe_record.provider_id,
          COALESCE(scribe_record.session_date, NOW()),
          'suggested',
          'ai_scribe',
          cpt_code.confidence,
          NOW(),
          NOW()
        )
        ON CONFLICT (encounter_id, cpt_code) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- Process suggested ICD-10 codes (if exists)
  suggested_icd := scribe_record.suggested_icd10_codes;
  IF suggested_icd IS NOT NULL AND jsonb_array_length(suggested_icd) > 0 THEN
    FOR icd_code IN
      SELECT
        value->>'code' AS code,
        value->>'description' AS description,
        (value->>'confidence')::DECIMAL AS confidence,
        (value->>'is_primary')::BOOLEAN AS is_primary
      FROM jsonb_array_elements(suggested_icd)
    LOOP
      -- Only add high-confidence codes (>= 0.7)
      IF icd_code.confidence >= 0.7 THEN
        INSERT INTO public.encounter_diagnoses (
          encounter_id,
          icd10_code,
          description,
          diagnosis_type,
          is_primary,
          provider_id,
          diagnosis_date,
          status,
          source,
          confidence_score,
          created_at,
          updated_at
        ) VALUES (
          enc_id,
          icd_code.code,
          icd_code.description,
          'clinical',
          COALESCE(icd_code.is_primary, false),
          scribe_record.provider_id,
          COALESCE(scribe_record.session_date, NOW()),
          'suggested',
          'ai_scribe',
          icd_code.confidence,
          NOW(),
          NOW()
        )
        ON CONFLICT (encounter_id, icd10_code) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RAISE NOTICE 'Auto-saved scribe session % to clinical note % with encounter %', scribe_session_id, note_id, enc_id;

  RETURN note_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION auto_save_scribe_to_clinical_note IS 'Automatically saves completed scribe session to clinical note and populates billing codes';

-- ============================================================================
-- TRIGGER: Auto-save on scribe session completion
-- ============================================================================

CREATE OR REPLACE FUNCTION trg_auto_save_completed_scribe()
RETURNS TRIGGER AS $$
BEGIN
  -- Only auto-save if:
  -- 1. Status changed to completed
  -- 2. SOAP note exists
  -- 3. Not already saved
  IF NEW.transcription_status = 'completed'
     AND (OLD.transcription_status IS NULL OR OLD.transcription_status != 'completed')
     AND NEW.soap_note IS NOT NULL
     AND NEW.soap_note != ''
     AND NEW.generated_note_id IS NULL
  THEN
    BEGIN
      -- Call auto-save function
      PERFORM auto_save_scribe_to_clinical_note(NEW.id);

      RAISE NOTICE 'Auto-saved scribe session % to clinical note', NEW.id;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the update
      RAISE WARNING 'Failed to auto-save scribe session %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS after_scribe_session_complete ON public.scribe_sessions;

-- Create trigger
CREATE TRIGGER after_scribe_session_complete
AFTER UPDATE ON public.scribe_sessions
FOR EACH ROW
EXECUTE FUNCTION trg_auto_save_completed_scribe();

COMMENT ON FUNCTION trg_auto_save_completed_scribe IS 'Automatically saves completed scribe sessions to clinical notes and billing codes';

-- ============================================================================
-- ADD MISSING COLUMNS TO SCRIBE_SESSIONS (if needed)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scribe_sessions'
    AND column_name = 'note_saved_at'
  ) THEN
    ALTER TABLE public.scribe_sessions
      ADD COLUMN note_saved_at TIMESTAMPTZ;

    COMMENT ON COLUMN public.scribe_sessions.note_saved_at IS 'Timestamp when scribe output was saved to clinical note';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scribe_sessions'
    AND column_name = 'subjective'
  ) THEN
    ALTER TABLE public.scribe_sessions
      ADD COLUMN subjective TEXT;

    COMMENT ON COLUMN public.scribe_sessions.subjective IS 'SOAP note Subjective section';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scribe_sessions'
    AND column_name = 'objective'
  ) THEN
    ALTER TABLE public.scribe_sessions
      ADD COLUMN objective TEXT;

    COMMENT ON COLUMN public.scribe_sessions.objective IS 'SOAP note Objective section';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scribe_sessions'
    AND column_name = 'assessment'
  ) THEN
    ALTER TABLE public.scribe_sessions
      ADD COLUMN assessment TEXT;

    COMMENT ON COLUMN public.scribe_sessions.assessment IS 'SOAP note Assessment section';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scribe_sessions'
    AND column_name = 'plan'
  ) THEN
    ALTER TABLE public.scribe_sessions
      ADD COLUMN plan TEXT;

    COMMENT ON COLUMN public.scribe_sessions.plan IS 'SOAP note Plan section';
  END IF;
END $$;

-- ============================================================================
-- ADD MISSING COLUMNS TO ENCOUNTER_PROCEDURES AND ENCOUNTER_DIAGNOSES
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'encounter_procedures'
    AND column_name = 'source'
  ) THEN
    ALTER TABLE public.encounter_procedures
      ADD COLUMN source TEXT DEFAULT 'manual';

    COMMENT ON COLUMN public.encounter_procedures.source IS 'Source of code: manual, ai_scribe, coding_assist';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'encounter_procedures'
    AND column_name = 'confidence_score'
  ) THEN
    ALTER TABLE public.encounter_procedures
      ADD COLUMN confidence_score DECIMAL(3, 2);

    COMMENT ON COLUMN public.encounter_procedures.confidence_score IS 'AI confidence score (0.00-1.00)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'encounter_diagnoses'
    AND column_name = 'source'
  ) THEN
    ALTER TABLE public.encounter_diagnoses
      ADD COLUMN source TEXT DEFAULT 'manual';

    COMMENT ON COLUMN public.encounter_diagnoses.source IS 'Source of code: manual, ai_scribe, coding_assist';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'encounter_diagnoses'
    AND column_name = 'confidence_score'
  ) THEN
    ALTER TABLE public.encounter_diagnoses
      ADD COLUMN confidence_score DECIMAL(3, 2);

    COMMENT ON COLUMN public.encounter_diagnoses.confidence_score IS 'AI confidence score (0.00-1.00)';
  END IF;
END $$;

COMMIT;
