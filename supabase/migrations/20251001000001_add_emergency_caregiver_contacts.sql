-- Add emergency contact and caregiver information to profiles
-- This supports the crisis intervention features in check-ins
-- Date: 2025-10-01

-- Add missing caregiver and emergency contact fields
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS caregiver_first_name text,
ADD COLUMN IF NOT EXISTS caregiver_last_name text,
ADD COLUMN IF NOT EXISTS caregiver_phone text,
ADD COLUMN IF NOT EXISTS caregiver_relationship text,
ADD COLUMN IF NOT EXISTS emergency_contact_phone text;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_caregiver_first_name ON public.profiles (caregiver_first_name);
CREATE INDEX IF NOT EXISTS idx_profiles_caregiver_last_name ON public.profiles (caregiver_last_name);
CREATE INDEX IF NOT EXISTS idx_profiles_caregiver_phone ON public.profiles (caregiver_phone);
CREATE INDEX IF NOT EXISTS idx_profiles_caregiver_relationship ON public.profiles (caregiver_relationship);
CREATE INDEX IF NOT EXISTS idx_profiles_emergency_contact_phone ON public.profiles (emergency_contact_phone);

COMMENT ON COLUMN public.profiles.emergency_contact_phone IS 'Emergency contact phone number used in crisis situations (e.g., when user is lost)';
COMMENT ON COLUMN public.profiles.caregiver_phone IS 'Primary caregiver phone number';
