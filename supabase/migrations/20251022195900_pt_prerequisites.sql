-- =====================================================
-- PT WORKFLOW PREREQUISITES
-- =====================================================
-- Creates required tables and roles for PT workflow system
-- =====================================================

-- Add PT-related roles to roles table
-- Using IDs 99-110 to avoid conflicts with existing roles
DO $$
BEGIN
    -- Physical Therapist
    IF NOT EXISTS (SELECT 1 FROM roles WHERE id = 99) THEN
        INSERT INTO roles (id, name) VALUES (99, 'Physical Therapist');
    END IF;

    -- Physical Therapist Assistant
    IF NOT EXISTS (SELECT 1 FROM roles WHERE id = 100) THEN
        INSERT INTO roles (id, name) VALUES (100, 'Physical Therapist Assistant');
    END IF;

    -- Doctor of Physical Therapy
    IF NOT EXISTS (SELECT 1 FROM roles WHERE id = 101) THEN
        INSERT INTO roles (id, name) VALUES (101, 'Doctor of Physical Therapy');
    END IF;

    -- Occupational Therapist
    IF NOT EXISTS (SELECT 1 FROM roles WHERE id = 102) THEN
        INSERT INTO roles (id, name) VALUES (102, 'Occupational Therapist');
    END IF;

    -- Speech Language Pathologist
    IF NOT EXISTS (SELECT 1 FROM roles WHERE id = 103) THEN
        INSERT INTO roles (id, name) VALUES (103, 'Speech Language Pathologist');
    END IF;

    -- Rehab Director
    IF NOT EXISTS (SELECT 1 FROM roles WHERE id = 104) THEN
        INSERT INTO roles (id, name) VALUES (104, 'Rehabilitation Director');
    END IF;
END $$;

-- =====================================================
-- PATIENTS TABLE (if not exists)
-- =====================================================
-- PT can work with both hospital_patients (inpatient) and community users (outpatient)
-- This table will be a unified view/table for PT documentation

-- For now, we'll use hospital_patients directly and add support for outpatients later
-- PT assessments can reference hospital_patients.user_id OR auth.users.id directly

-- =====================================================
-- ENCOUNTERS TABLE (if not exists)
-- =====================================================
-- Patient visits/sessions for PT documentation
-- patient_id references auth.users (can be hospital_patients.user_id or community user)

CREATE TABLE IF NOT EXISTS public.encounters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,

    -- Encounter Details
    encounter_type TEXT CHECK (encounter_type IN (
        'initial_evaluation',
        'follow_up',
        'discharge',
        'telehealth',
        'group_therapy',
        'consultation'
    )),
    date_of_service DATE NOT NULL,
    place_of_service TEXT DEFAULT '11', -- 11 = Office, 12 = Home, etc.

    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN (
        'draft',
        'in_progress',
        'completed',
        'cancelled',
        'no_show'
    )),

    -- Clinical
    chief_complaint TEXT,
    clinical_notes TEXT,

    -- Billing
    claim_frequency_code TEXT DEFAULT '1', -- 1 = Original
    subscriber_relation_code TEXT DEFAULT '18', -- 18 = Self

    -- Metadata
    created_by UUID NOT NULL DEFAULT auth.uid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_encounters_patient ON encounters(patient_id);
CREATE INDEX IF NOT EXISTS idx_encounters_provider ON encounters(provider_id);
CREATE INDEX IF NOT EXISTS idx_encounters_service_date ON encounters(date_of_service);
CREATE INDEX IF NOT EXISTS idx_encounters_status ON encounters(status);

-- Enable RLS
ALTER TABLE encounters ENABLE ROW LEVEL SECURITY;

-- Patients can view their own encounters
CREATE POLICY encounters_patient_view ON encounters
    FOR SELECT USING (patient_id = auth.uid());

-- Staff can view and manage encounters
CREATE POLICY encounters_staff_manage ON encounters
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role_id IN (1, 2, 3, 99, 100, 101)
        )
    );

-- =====================================================
-- ENCOUNTER PROCEDURES (CPT codes)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.encounter_procedures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    charge_amount NUMERIC(12,2),
    units NUMERIC(12,2) DEFAULT 1,
    modifiers TEXT[],
    service_date DATE,
    diagnosis_pointers INTEGER[],
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_encounter_procedures_encounter ON encounter_procedures(encounter_id);
CREATE INDEX IF NOT EXISTS idx_encounter_procedures_code ON encounter_procedures(code);

ALTER TABLE encounter_procedures ENABLE ROW LEVEL SECURITY;

CREATE POLICY encounter_procedures_staff_manage ON encounter_procedures
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role_id IN (1, 2, 3, 99, 100, 101)
        )
    );

-- =====================================================
-- ENCOUNTER DIAGNOSES (ICD-10 codes)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.encounter_diagnoses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    sequence INTEGER NOT NULL DEFAULT 1,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_encounter_diagnoses_encounter ON encounter_diagnoses(encounter_id);
CREATE INDEX IF NOT EXISTS idx_encounter_diagnoses_code ON encounter_diagnoses(code);

ALTER TABLE encounter_diagnoses ENABLE ROW LEVEL SECURITY;

CREATE POLICY encounter_diagnoses_staff_manage ON encounter_diagnoses
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role_id IN (1, 2, 3, 99, 100, 101)
        )
    );

-- =====================================================
-- CLINICAL NOTES
-- =====================================================

CREATE TABLE IF NOT EXISTS public.clinical_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id UUID NOT NULL REFERENCES encounters(id) ON DELETE CASCADE,
    note_type TEXT CHECK (note_type IN (
        'assessment',
        'plan',
        'subjective',
        'objective',
        'general',
        'hpi',
        'ros'
    )),
    content TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES profiles(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinical_notes_encounter ON clinical_notes(encounter_id);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_type ON clinical_notes(note_type);

ALTER TABLE clinical_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinical_notes_staff_manage ON clinical_notes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE user_id = auth.uid()
            AND role_id IN (1, 2, 3, 99, 100, 101)
        )
    );

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS encounters_updated_at ON encounters;
CREATE TRIGGER encounters_updated_at
    BEFORE UPDATE ON encounters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS encounter_procedures_updated_at ON encounter_procedures;
CREATE TRIGGER encounter_procedures_updated_at
    BEFORE UPDATE ON encounter_procedures
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS encounter_diagnoses_updated_at ON encounter_diagnoses;
CREATE TRIGGER encounter_diagnoses_updated_at
    BEFORE UPDATE ON encounter_diagnoses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS clinical_notes_updated_at ON clinical_notes;
CREATE TRIGGER clinical_notes_updated_at
    BEFORE UPDATE ON clinical_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT SELECT, INSERT, UPDATE ON encounters TO authenticated;
GRANT SELECT, INSERT, UPDATE ON encounter_procedures TO authenticated;
GRANT SELECT, INSERT, UPDATE ON encounter_diagnoses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON clinical_notes TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE encounters IS 'Patient visits/sessions for PT clinical documentation - patient_id references auth.users';
COMMENT ON TABLE encounter_procedures IS 'CPT procedure codes for encounters';
COMMENT ON TABLE encounter_diagnoses IS 'ICD-10 diagnosis codes for encounters';
COMMENT ON TABLE clinical_notes IS 'SOAP and other clinical documentation';
