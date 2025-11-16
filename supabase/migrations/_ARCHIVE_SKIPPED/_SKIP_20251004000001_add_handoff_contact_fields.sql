-- Add contact fields for Twilio SMS and MailerSend email notifications
-- Date: 2025-10-04

BEGIN;

-- Add receiving facility contact information for notifications
ALTER TABLE public.handoff_packets
  ADD COLUMN IF NOT EXISTS receiver_contact_name text,
  ADD COLUMN IF NOT EXISTS receiver_contact_email text,
  ADD COLUMN IF NOT EXISTS receiver_contact_phone text,
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{
    "send_email": false,
    "send_sms": false,
    "email_sent": false,
    "sms_sent": false,
    "email_sent_at": null,
    "sms_sent_at": null
  }'::jsonb;

-- Add indexes for notification queries
CREATE INDEX IF NOT EXISTS idx_handoff_packets_receiver_email
  ON public.handoff_packets(receiver_contact_email)
  WHERE receiver_contact_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_handoff_packets_receiver_phone
  ON public.handoff_packets(receiver_contact_phone)
  WHERE receiver_contact_phone IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.handoff_packets.receiver_contact_name IS 'Name of receiving facility contact person for notifications';
COMMENT ON COLUMN public.handoff_packets.receiver_contact_email IS 'Email address for MailerSend notifications to receiving facility';
COMMENT ON COLUMN public.handoff_packets.receiver_contact_phone IS 'Phone number (E.164 format) for Twilio SMS notifications to receiving facility';
COMMENT ON COLUMN public.handoff_packets.notification_preferences IS 'Tracks notification delivery status for email and SMS';

COMMIT;
