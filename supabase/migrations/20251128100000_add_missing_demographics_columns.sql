-- ============================================================================
-- Add Missing Demographics Columns to Profiles Table
-- ============================================================================
-- Purpose: The DemographicsPage component tries to save data to columns that
-- don't exist in the profiles table. This migration adds all missing columns.
--
-- Date: 2025-11-28
-- ============================================================================

-- Demographics columns from DemographicsPage.tsx that need to exist

-- Step 1: Basic Demographics
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS marital_status TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS living_situation TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS education_level TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS income_range TEXT;

-- Step 3: Health Information
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS insurance_type TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS health_conditions TEXT[];  -- Array of conditions

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS medications TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS mobility_level TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS hearing_status TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS vision_status TEXT;

-- Step 5: Social Support & Resources
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS transportation_access TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS food_security TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS social_support TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS tech_comfort_level TEXT;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS has_smartphone BOOLEAN DEFAULT false;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS has_internet BOOLEAN DEFAULT false;

-- Add helpful comments
COMMENT ON COLUMN public.profiles.marital_status IS 'Marital status: single, married, divorced, widowed, separated, domestic-partner';
COMMENT ON COLUMN public.profiles.living_situation IS 'Living arrangement: alone, spouse, family, roommate, assisted-living, nursing-home, other';
COMMENT ON COLUMN public.profiles.education_level IS 'Highest education: less-than-high-school, high-school, some-college, associate, bachelor, graduate';
COMMENT ON COLUMN public.profiles.income_range IS 'Household income range: under-25k, 25k-50k, 50k-75k, 75k-100k, over-100k';
COMMENT ON COLUMN public.profiles.insurance_type IS 'Health insurance: medicare, medicaid, private, medicare-supplement, va, none, other';
COMMENT ON COLUMN public.profiles.health_conditions IS 'Array of health conditions (Diabetes, High Blood Pressure, etc.)';
COMMENT ON COLUMN public.profiles.medications IS 'Free-text medications description';
COMMENT ON COLUMN public.profiles.mobility_level IS 'Mobility level: excellent, good, fair, poor';
COMMENT ON COLUMN public.profiles.hearing_status IS 'Hearing status';
COMMENT ON COLUMN public.profiles.vision_status IS 'Vision status';
COMMENT ON COLUMN public.profiles.transportation_access IS 'Transportation: own-car, family-drives, public-transport, rideshare, medical-transport, walk, limited';
COMMENT ON COLUMN public.profiles.food_security IS 'Food security concern level: never, rarely, sometimes, often';
COMMENT ON COLUMN public.profiles.social_support IS 'Loneliness/isolation level: never, rarely, sometimes, often, always';
COMMENT ON COLUMN public.profiles.tech_comfort_level IS 'Technology comfort: very-comfortable, somewhat-comfortable, not-very-comfortable, not-comfortable';
COMMENT ON COLUMN public.profiles.has_smartphone IS 'Whether user has access to a smartphone';
COMMENT ON COLUMN public.profiles.has_internet IS 'Whether user has home internet access';

-- Index for SDOH reporting
CREATE INDEX IF NOT EXISTS idx_profiles_food_security ON public.profiles(food_security) WHERE food_security IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_transportation ON public.profiles(transportation_access) WHERE transportation_access IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_social_support ON public.profiles(social_support) WHERE social_support IS NOT NULL;
