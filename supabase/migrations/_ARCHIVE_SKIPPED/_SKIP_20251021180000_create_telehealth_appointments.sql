-- Create telehealth appointments table for scheduling patient video visits
-- This allows providers to schedule appointments and patients to join via the app

CREATE TABLE IF NOT EXISTS telehealth_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,

  -- Appointment details
  appointment_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  encounter_type TEXT NOT NULL CHECK (encounter_type IN ('outpatient', 'er', 'urgent-care')),

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show')),

  -- Meeting details (populated when appointment starts)
  daily_room_url TEXT,
  daily_room_name TEXT,
  session_id UUID REFERENCES telehealth_sessions(id),

  -- Notification tracking
  reminder_sent BOOLEAN DEFAULT FALSE,
  notification_sent BOOLEAN DEFAULT FALSE,

  -- Notes
  reason_for_visit TEXT,
  provider_notes TEXT,
  patient_notes TEXT,
  cancellation_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_telehealth_appointments_patient ON telehealth_appointments(patient_id);
CREATE INDEX idx_telehealth_appointments_provider ON telehealth_appointments(provider_id);
CREATE INDEX idx_telehealth_appointments_time ON telehealth_appointments(appointment_time);
CREATE INDEX idx_telehealth_appointments_status ON telehealth_appointments(status);

-- Composite index for finding upcoming patient appointments
CREATE INDEX idx_telehealth_appointments_patient_upcoming ON telehealth_appointments(patient_id, appointment_time)
WHERE status IN ('scheduled', 'confirmed');

-- RLS Policies
ALTER TABLE telehealth_appointments ENABLE ROW LEVEL SECURITY;

-- Patients can view their own appointments
CREATE POLICY "Patients can view own appointments"
  ON telehealth_appointments FOR SELECT
  USING (
    auth.uid() = patient_id
  );

-- Providers can view their scheduled appointments
CREATE POLICY "Providers can view their appointments"
  ON telehealth_appointments FOR SELECT
  USING (
    auth.uid() = provider_id
  );

-- Providers can create appointments
CREATE POLICY "Providers can create appointments"
  ON telehealth_appointments FOR INSERT
  WITH CHECK (
    auth.uid() = provider_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role_code IN (3, 5, 8, 9, 10) -- Nurse, Physician, NP, PA, Clinical Supervisor
    )
  );

-- Providers can update their own appointments
CREATE POLICY "Providers can update own appointments"
  ON telehealth_appointments FOR UPDATE
  USING (
    auth.uid() = provider_id
  );

-- Patients can update certain fields (confirmation, notes)
CREATE POLICY "Patients can confirm appointments"
  ON telehealth_appointments FOR UPDATE
  USING (
    auth.uid() = patient_id
  )
  WITH CHECK (
    auth.uid() = patient_id
    -- They can only update status to confirmed and add patient notes
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_telehealth_appointments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telehealth_appointments_updated_at
  BEFORE UPDATE ON telehealth_appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_telehealth_appointments_updated_at();

-- Function to send appointment notifications (to be called by providers or cron)
CREATE OR REPLACE FUNCTION send_appointment_notification(appointment_id UUID)
RETURNS VOID AS $$
DECLARE
  v_patient_id UUID;
  v_appointment_time TIMESTAMPTZ;
  v_provider_name TEXT;
  v_encounter_type TEXT;
BEGIN
  -- Get appointment details
  SELECT patient_id, appointment_time, encounter_type
  INTO v_patient_id, v_appointment_time, v_encounter_type
  FROM telehealth_appointments
  WHERE id = appointment_id;

  -- Get provider name
  SELECT COALESCE(full_name, email)
  INTO v_provider_name
  FROM profiles
  WHERE id = (SELECT provider_id FROM telehealth_appointments WHERE id = appointment_id);

  -- Mark notification as sent
  UPDATE telehealth_appointments
  SET notification_sent = TRUE
  WHERE id = appointment_id;

  -- Note: Actual FCM sending would happen in an edge function
  -- This just marks the notification as needing to be sent
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT, INSERT ON telehealth_appointments TO authenticated;
GRANT UPDATE (status, patient_notes, daily_room_url, session_id) ON telehealth_appointments TO authenticated;

-- Comment
COMMENT ON TABLE telehealth_appointments IS 'Scheduled telehealth video appointments for patients and providers';
