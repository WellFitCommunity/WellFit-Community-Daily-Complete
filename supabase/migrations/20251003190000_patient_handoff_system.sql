-- Patient Handoff System - HIPAA Compliant Transfer of Care
-- Enables secure patient transfers between healthcare facilities
-- Date: 2025-10-03
-- White-label compatible: tenant-agnostic, user-level isolation via RLS

-- migrate:up
BEGIN;

-- ============================================================================
-- 0. CREATE SEQUENCE FIRST
-- ============================================================================
-- Sequence for packet numbers
CREATE SEQUENCE IF NOT EXISTS handoff_packet_seq START 1;

-- ============================================================================
-- 1. HANDOFF_PACKETS - Core transfer packet record
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.handoff_packets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Packet identification
  packet_number text UNIQUE NOT NULL DEFAULT ('HO-' || to_char(now(), 'YYYYMMDD') || '-' || LPAD(nextval('handoff_packet_seq')::text, 6, '0')),

  -- Patient information (minimal PHI)
  patient_mrn text, -- Medical Record Number (encrypted in application)
  patient_name_encrypted text, -- Encrypted full name
  patient_dob_encrypted text, -- Encrypted date of birth
  patient_gender text CHECK (patient_gender IN ('M', 'F', 'X', 'U')),

  -- Transfer details
  sending_facility text NOT NULL,
  receiving_facility text NOT NULL,
  urgency_level text NOT NULL CHECK (urgency_level IN ('routine', 'urgent', 'emergent', 'critical')),
  reason_for_transfer text NOT NULL,

  -- Clinical snapshot (stored as JSONB for flexibility)
  clinical_data jsonb DEFAULT '{}'::jsonb, -- vitals, meds, allergies structured

  -- Sender information
  sender_provider_name text NOT NULL,
  sender_callback_number text NOT NULL,
  sender_notes text,
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Status tracking
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'acknowledged', 'cancelled')),

  -- Access control
  access_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'base64'), -- Tokenized secure link
  access_expires_at timestamptz NOT NULL DEFAULT (now() + interval '72 hours'), -- 72 hour expiry

  -- Acknowledgement
  acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at timestamptz,
  acknowledgement_notes text,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,

  -- Audit trail
  created_by uuid NOT NULL DEFAULT auth.uid(),
  ip_address inet,
  user_agent text
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_handoff_packets_status ON public.handoff_packets(status);
CREATE INDEX IF NOT EXISTS idx_handoff_packets_sending ON public.handoff_packets(sending_facility);
CREATE INDEX IF NOT EXISTS idx_handoff_packets_receiving ON public.handoff_packets(receiving_facility);
CREATE INDEX IF NOT EXISTS idx_handoff_packets_created ON public.handoff_packets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_handoff_packets_access_token ON public.handoff_packets(access_token) WHERE status = 'sent';
CREATE INDEX IF NOT EXISTS idx_handoff_packets_sender_user ON public.handoff_packets(sender_user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_handoff_packets_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_handoff_packets_updated_at ON public.handoff_packets;
CREATE TRIGGER trg_handoff_packets_updated_at
  BEFORE UPDATE ON public.handoff_packets
  FOR EACH ROW EXECUTE FUNCTION public.update_handoff_packets_updated_at();

-- ============================================================================
-- 2. HANDOFF_SECTIONS - Structured form data storage
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.handoff_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_packet_id uuid NOT NULL REFERENCES public.handoff_packets(id) ON DELETE CASCADE,

  section_type text NOT NULL CHECK (section_type IN (
    'demographics',
    'reason_for_transfer',
    'clinical_snapshot',
    'medications',
    'allergies',
    'vitals',
    'custom'
  )),

  section_data jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_handoff_sections_packet ON public.handoff_sections(handoff_packet_id);
CREATE INDEX IF NOT EXISTS idx_handoff_sections_type ON public.handoff_sections(section_type);

DROP TRIGGER IF EXISTS trg_handoff_sections_updated_at ON public.handoff_sections;
CREATE TRIGGER trg_handoff_sections_updated_at
  BEFORE UPDATE ON public.handoff_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_handoff_packets_updated_at();

-- ============================================================================
-- 3. HANDOFF_ATTACHMENTS - Secure file storage links
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.handoff_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_packet_id uuid NOT NULL REFERENCES public.handoff_packets(id) ON DELETE CASCADE,

  file_name text NOT NULL,
  file_type text NOT NULL, -- PDF, JPG, PNG, DICOM, etc.
  file_size_bytes bigint,

  -- Supabase Storage reference
  storage_bucket text NOT NULL DEFAULT 'handoff-attachments',
  storage_path text NOT NULL,

  -- File metadata
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Encryption info (files encrypted at rest in Supabase Storage)
  is_encrypted boolean DEFAULT true NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_handoff_attachments_packet ON public.handoff_attachments(handoff_packet_id);
CREATE INDEX IF NOT EXISTS idx_handoff_attachments_uploaded ON public.handoff_attachments(uploaded_by);

-- ============================================================================
-- 4. HANDOFF_LOGS - Full audit trail for HIPAA compliance
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.handoff_logs (
  id bigserial PRIMARY KEY,
  handoff_packet_id uuid NOT NULL REFERENCES public.handoff_packets(id) ON DELETE CASCADE,

  event_type text NOT NULL CHECK (event_type IN (
    'created',
    'updated',
    'sent',
    'viewed',
    'acknowledged',
    'cancelled',
    'attachment_uploaded',
    'attachment_viewed',
    'access_token_generated',
    'access_denied'
  )),

  event_description text NOT NULL,

  -- Who performed the action
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  user_role text,

  -- Context
  ip_address inet,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,

  timestamp timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_handoff_logs_packet ON public.handoff_logs(handoff_packet_id);
CREATE INDEX IF NOT EXISTS idx_handoff_logs_event ON public.handoff_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_handoff_logs_timestamp ON public.handoff_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_handoff_logs_user ON public.handoff_logs(user_id);

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.handoff_packets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handoff_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handoff_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handoff_logs ENABLE ROW LEVEL SECURITY;

-- HANDOFF_PACKETS policies
-- Admins can see all packets
DROP POLICY IF EXISTS "handoff_packets_admin_all" ON public.handoff_packets;
CREATE POLICY "handoff_packets_admin_all"
ON public.handoff_packets
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  )
);

-- Senders can see packets they created
DROP POLICY IF EXISTS "handoff_packets_sender_view" ON public.handoff_packets;
CREATE POLICY "handoff_packets_sender_view"
ON public.handoff_packets
FOR SELECT
USING (created_by = auth.uid() OR sender_user_id = auth.uid());

-- Anyone can insert (for tokenized access - lite sender portal)
DROP POLICY IF EXISTS "handoff_packets_insert" ON public.handoff_packets;
CREATE POLICY "handoff_packets_insert"
ON public.handoff_packets
FOR INSERT
WITH CHECK (true); -- Token validation happens in application layer

-- Senders can update their own draft packets
DROP POLICY IF EXISTS "handoff_packets_sender_update" ON public.handoff_packets;
CREATE POLICY "handoff_packets_sender_update"
ON public.handoff_packets
FOR UPDATE
USING (
  (created_by = auth.uid() OR sender_user_id = auth.uid())
  AND status = 'draft'
);

-- HANDOFF_SECTIONS policies (follow packet permissions)
DROP POLICY IF EXISTS "handoff_sections_via_packet" ON public.handoff_sections;
CREATE POLICY "handoff_sections_via_packet"
ON public.handoff_sections
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.handoff_packets hp
    WHERE hp.id = handoff_sections.handoff_packet_id
    AND (
      hp.created_by = auth.uid()
      OR hp.sender_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin')
      )
    )
  )
);

-- HANDOFF_ATTACHMENTS policies (follow packet permissions)
DROP POLICY IF EXISTS "handoff_attachments_via_packet" ON public.handoff_attachments;
CREATE POLICY "handoff_attachments_via_packet"
ON public.handoff_attachments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.handoff_packets hp
    WHERE hp.id = handoff_attachments.handoff_packet_id
    AND (
      hp.created_by = auth.uid()
      OR hp.sender_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin')
      )
    )
  )
);

-- HANDOFF_LOGS policies
-- Admins can view all logs
DROP POLICY IF EXISTS "handoff_logs_admin_view" ON public.handoff_logs;
CREATE POLICY "handoff_logs_admin_view"
ON public.handoff_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  )
);

-- System can insert logs (service role)
DROP POLICY IF EXISTS "handoff_logs_insert" ON public.handoff_logs;
CREATE POLICY "handoff_logs_insert"
ON public.handoff_logs
FOR INSERT
WITH CHECK (true);

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function to validate access token and retrieve packet
CREATE OR REPLACE FUNCTION public.get_handoff_packet_by_token(token text)
RETURNS TABLE (
  packet_id uuid,
  packet_number text,
  status text,
  is_expired boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    hp.id as packet_id,
    hp.packet_number,
    hp.status,
    (hp.access_expires_at < now()) as is_expired
  FROM public.handoff_packets hp
  WHERE hp.access_token = token
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to acknowledge packet receipt
CREATE OR REPLACE FUNCTION public.acknowledge_handoff_packet(
  packet_id uuid,
  acknowledger_id uuid,
  notes text DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  updated_rows int;
BEGIN
  UPDATE public.handoff_packets
  SET
    status = 'acknowledged',
    acknowledged_by = acknowledger_id,
    acknowledged_at = now(),
    acknowledgement_notes = notes
  WHERE id = packet_id
  AND status = 'sent';

  GET DIAGNOSTICS updated_rows = ROW_COUNT;

  IF updated_rows > 0 THEN
    -- Log the acknowledgement
    INSERT INTO public.handoff_logs (
      handoff_packet_id,
      event_type,
      event_description,
      user_id
    ) VALUES (
      packet_id,
      'acknowledged',
      'Packet acknowledged by receiving facility',
      acknowledger_id
    );

    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. STORAGE BUCKET SETUP (via SQL if not using Supabase Dashboard)
-- ============================================================================

-- Note: This is typically done via Supabase Dashboard or supabase CLI
-- Storage bucket 'handoff-attachments' should be created with:
-- - Private access
-- - File size limit: 50MB
-- - Allowed MIME types: application/pdf, image/jpeg, image/png, application/dicom

-- ============================================================================
-- 8. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.handoff_packets IS 'Core patient transfer packets - HIPAA compliant transfer of care documentation';
COMMENT ON TABLE public.handoff_sections IS 'Structured form sections for handoff packets (demographics, vitals, meds, etc)';
COMMENT ON TABLE public.handoff_attachments IS 'Secure file attachments (labs, EKG, imaging) linked to Supabase Storage';
COMMENT ON TABLE public.handoff_logs IS 'Complete audit trail for all handoff events - HIPAA/SOC-2 compliance';

COMMENT ON COLUMN public.handoff_packets.access_token IS 'Tokenized secure link for lite sender portal access (no login required)';
COMMENT ON COLUMN public.handoff_packets.clinical_data IS 'JSONB storage for vitals, medications, allergies - flexible schema';
COMMENT ON COLUMN public.handoff_packets.patient_name_encrypted IS 'Encrypted patient name - decrypt in application layer';
COMMENT ON COLUMN public.handoff_packets.patient_dob_encrypted IS 'Encrypted DOB - decrypt in application layer';

COMMIT;

-- migrate:down
BEGIN;

DROP FUNCTION IF EXISTS public.acknowledge_handoff_packet(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.get_handoff_packet_by_token(text);

DROP TABLE IF EXISTS public.handoff_logs CASCADE;
DROP TABLE IF EXISTS public.handoff_attachments CASCADE;
DROP TABLE IF EXISTS public.handoff_sections CASCADE;
DROP TABLE IF EXISTS public.handoff_packets CASCADE;

DROP SEQUENCE IF EXISTS handoff_packet_seq;

COMMIT;
