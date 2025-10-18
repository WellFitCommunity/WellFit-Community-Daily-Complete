-- ============================================================================
-- ENSURE FHIR PROCEDURES TABLE EXISTS
-- ============================================================================
-- This migration ensures the fhir_procedures table exists in the remote database
-- Migration 20251017100003 was marked as applied but the table doesn't exist
-- This is a defensive migration to create it if missing
-- ============================================================================

BEGIN;

-- Check if table exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables
                   WHERE table_schema = 'public'
                   AND table_name = 'fhir_procedures') THEN

        RAISE NOTICE 'fhir_procedures table does not exist - creating now...';

        -- Create the table
        CREATE TABLE public.fhir_procedures (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

          -- FHIR Resource Metadata
          fhir_id TEXT UNIQUE NOT NULL DEFAULT 'Procedure/' || gen_random_uuid()::text,

          -- Status (required)
          status TEXT NOT NULL CHECK (status IN (
            'preparation', 'in-progress', 'not-done', 'on-hold', 'stopped',
            'completed', 'entered-in-error', 'unknown'
          )),

          -- Status Reason
          status_reason_code TEXT,
          status_reason_display TEXT,

          -- Category
          category_code TEXT,
          category_display TEXT,
          category_system TEXT DEFAULT 'http://snomed.info/sct',

          -- Procedure Code (required) - CPT, SNOMED CT, ICD-10-PCS
          code_system TEXT NOT NULL,
          code TEXT NOT NULL,
          code_display TEXT NOT NULL,
          code_text TEXT,

          -- Patient Reference (required)
          patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

          -- Encounter Context
          encounter_id UUID,

          -- Performed Time
          performed_datetime TIMESTAMPTZ,
          performed_period_start TIMESTAMPTZ,
          performed_period_end TIMESTAMPTZ,
          performed_string TEXT,
          performed_age_value DECIMAL,
          performed_age_unit TEXT,

          -- Recorder
          recorder_type TEXT CHECK (recorder_type IN ('Patient', 'RelatedPerson', 'Practitioner', 'PractitionerRole')),
          recorder_id UUID,
          recorder_display TEXT,

          -- Asserter
          asserter_type TEXT,
          asserter_id UUID,
          asserter_display TEXT,

          -- Performers
          performer_function_code TEXT[],
          performer_function_display TEXT[],
          performer_actor_type TEXT[],
          performer_actor_id UUID[],
          performer_actor_display TEXT[],
          performer_on_behalf_of_id UUID[],

          -- Location
          location_id UUID,
          location_display TEXT,

          -- Reason
          reason_code TEXT[],
          reason_code_display TEXT[],
          reason_reference_type TEXT[],
          reason_reference_id UUID[],

          -- Body Site
          body_site_code TEXT,
          body_site_display TEXT,
          body_site_system TEXT DEFAULT 'http://snomed.info/sct',
          body_site_text TEXT,

          -- Outcome
          outcome_code TEXT,
          outcome_display TEXT,
          outcome_text TEXT,

          -- Report
          report_type TEXT[],
          report_id UUID[],

          -- Complications
          complication_code TEXT[],
          complication_display TEXT[],
          complication_detail_id UUID[],

          -- Follow Up
          follow_up_code TEXT[],
          follow_up_display TEXT[],

          -- Notes
          note TEXT,

          -- Used (devices, medications, substances)
          used_reference_type TEXT[],
          used_reference_id UUID[],
          used_code TEXT[],
          used_display TEXT[],

          -- Based On
          based_on_type TEXT[],
          based_on_id UUID[],

          -- Part Of
          part_of_type TEXT,
          part_of_id UUID,

          -- Billing
          billing_code TEXT,
          billing_modifier TEXT[],
          billing_charge_amount DECIMAL,
          billing_units INTEGER DEFAULT 1,

          -- Timestamps
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

          -- Sync tracking
          last_synced_at TIMESTAMPTZ,
          sync_source TEXT,
          external_id TEXT
        );

        -- Create indexes
        CREATE INDEX idx_fhir_procedures_patient_id ON public.fhir_procedures(patient_id);
        CREATE INDEX idx_fhir_procedures_status ON public.fhir_procedures(status);
        CREATE INDEX idx_fhir_procedures_code ON public.fhir_procedures(code);
        CREATE INDEX idx_fhir_procedures_code_system ON public.fhir_procedures(code_system);
        CREATE INDEX idx_fhir_procedures_encounter_id ON public.fhir_procedures(encounter_id) WHERE encounter_id IS NOT NULL;
        CREATE INDEX idx_fhir_procedures_performed ON public.fhir_procedures(performed_datetime DESC) WHERE performed_datetime IS NOT NULL;
        CREATE INDEX idx_fhir_procedures_category ON public.fhir_procedures(category_code) WHERE category_code IS NOT NULL;
        CREATE INDEX idx_fhir_procedures_fhir_id ON public.fhir_procedures(fhir_id);
        CREATE INDEX idx_fhir_procedures_external_id ON public.fhir_procedures(external_id) WHERE external_id IS NOT NULL;
        CREATE INDEX idx_fhir_procedures_billing ON public.fhir_procedures(patient_id, billing_code) WHERE billing_code IS NOT NULL;

        -- Create trigger for updated_at
        CREATE OR REPLACE FUNCTION public.update_fhir_procedure_updated_at()
        RETURNS TRIGGER AS $trigger$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $trigger$ LANGUAGE plpgsql;

        CREATE TRIGGER update_fhir_procedure_updated_at
          BEFORE UPDATE ON public.fhir_procedures
          FOR EACH ROW
          EXECUTE FUNCTION public.update_fhir_procedure_updated_at();

        -- Enable RLS
        ALTER TABLE public.fhir_procedures ENABLE ROW LEVEL SECURITY;

        -- RLS Policies
        CREATE POLICY "fhir_procedures_user_select"
          ON public.fhir_procedures FOR SELECT
          USING (patient_id = auth.uid());

        CREATE POLICY "fhir_procedures_staff_select"
          ON public.fhir_procedures FOR SELECT
          USING (
            EXISTS (
              SELECT 1 FROM public.user_roles
              WHERE user_id = auth.uid()
              AND role IN ('admin', 'super_admin', 'caregiver', 'doctor', 'nurse')
            )
          );

        CREATE POLICY "fhir_procedures_staff_insert"
          ON public.fhir_procedures FOR INSERT
          WITH CHECK (
            EXISTS (
              SELECT 1 FROM public.user_roles
              WHERE user_id = auth.uid()
              AND role IN ('admin', 'super_admin', 'doctor', 'nurse')
            )
          );

        CREATE POLICY "fhir_procedures_staff_update"
          ON public.fhir_procedures FOR UPDATE
          USING (
            EXISTS (
              SELECT 1 FROM public.user_roles
              WHERE user_id = auth.uid()
              AND role IN ('admin', 'super_admin', 'doctor', 'nurse')
            )
          );

        CREATE POLICY "fhir_procedures_admin_delete"
          ON public.fhir_procedures FOR DELETE
          USING (
            EXISTS (
              SELECT 1 FROM public.user_roles
              WHERE user_id = auth.uid()
              AND role IN ('admin', 'super_admin')
            )
          );

        -- Create helper functions
        CREATE OR REPLACE FUNCTION public.get_recent_procedures(
          patient_id_param UUID,
          limit_param INTEGER DEFAULT 20
        )
        RETURNS SETOF public.fhir_procedures
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $func$
        BEGIN
          RETURN QUERY
          SELECT * FROM public.fhir_procedures
          WHERE patient_id = patient_id_param
            AND status IN ('completed', 'in-progress')
          ORDER BY COALESCE(performed_datetime, performed_period_start, created_at) DESC
          LIMIT limit_param;
        END;
        $func$;

        RAISE NOTICE 'fhir_procedures table created successfully';
    ELSE
        RAISE NOTICE 'fhir_procedures table already exists - skipping';
    END IF;
END $$;

-- Now add the practitioner foreign key if table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables
               WHERE table_schema = 'public'
               AND table_name = 'fhir_procedures') THEN

        -- Add practitioner FK if it doesn't exist
        IF NOT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'fhir_procedures'
            AND column_name = 'primary_performer_practitioner_id'
        ) THEN
            ALTER TABLE fhir_procedures
            ADD COLUMN primary_performer_practitioner_id UUID REFERENCES fhir_practitioners(id) ON DELETE SET NULL;

            COMMENT ON COLUMN fhir_procedures.primary_performer_practitioner_id IS 'Primary practitioner who performed the procedure';

            CREATE INDEX idx_procedures_performer_practitioner
            ON fhir_procedures(primary_performer_practitioner_id) WHERE primary_performer_practitioner_id IS NOT NULL;

            RAISE NOTICE 'Added primary_performer_practitioner_id to fhir_procedures';
        ELSE
            RAISE NOTICE 'primary_performer_practitioner_id already exists in fhir_procedures';
        END IF;
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
