-- Add integration fields to handoff_packets
-- Links hospital transfer packets to patient records and encounters
-- Mirrors EMS integration (20251027000001_ems_integration_fields.sql)

BEGIN;

-- Add patient linkage fields to handoff_packets
ALTER TABLE public.handoff_packets
  ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS integrated_at TIMESTAMPTZ;

-- Add receiver contact fields if they don't exist (from _SKIP migration)
ALTER TABLE public.handoff_packets
  ADD COLUMN IF NOT EXISTS receiver_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS receiver_contact_email TEXT,
  ADD COLUMN IF NOT EXISTS receiver_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}'::jsonb;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_handoff_packets_patient
  ON public.handoff_packets(patient_id) WHERE patient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_handoff_packets_encounter
  ON public.handoff_packets(encounter_id) WHERE encounter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_handoff_packets_integrated
  ON public.handoff_packets(integrated_at) WHERE integrated_at IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.handoff_packets.patient_id IS 'Patient profile ID (linked after acknowledgement)';
COMMENT ON COLUMN public.handoff_packets.encounter_id IS 'Encounter ID (created during integration)';
COMMENT ON COLUMN public.handoff_packets.integrated_at IS 'Timestamp when packet was integrated into patient chart';

COMMIT;
