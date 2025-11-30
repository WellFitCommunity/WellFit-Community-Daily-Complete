-- ============================================================================
-- RESTORE: Senior-specific tables for geriatric care
-- ============================================================================
-- Seniors (role_code 4) require different care tracking than regular patients.
-- Geriatric care involves:
-- - SDOH (Social Determinants of Health) - food security, transportation, isolation
-- - Emergency contacts with specific relationships
-- - Health conditions specific to aging
-- - Demographics relevant to senior services
-- ============================================================================

-- Senior Demographics - age-specific information
CREATE TABLE IF NOT EXISTS senior_demographics (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    date_of_birth DATE,
    age_at_enrollment INTEGER,
    preferred_language TEXT DEFAULT 'en',
    requires_interpreter BOOLEAN DEFAULT false,
    veteran_status BOOLEAN DEFAULT false,
    marital_status TEXT CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed', 'separated', 'domestic-partner')),
    living_situation TEXT CHECK (living_situation IN ('alone', 'spouse', 'family', 'roommate', 'assisted-living', 'nursing-home', 'other')),
    education_level TEXT,
    primary_caregiver_name TEXT,
    primary_caregiver_phone TEXT,
    primary_caregiver_relationship TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

-- Senior Health - geriatric-specific health tracking
CREATE TABLE IF NOT EXISTS senior_health (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    primary_diagnosis TEXT[],
    chronic_conditions TEXT[],
    allergies TEXT[],
    current_medications TEXT[],
    mobility_level TEXT CHECK (mobility_level IN ('independent', 'cane', 'walker', 'wheelchair', 'bedbound')),
    fall_risk_level TEXT CHECK (fall_risk_level IN ('low', 'moderate', 'high')),
    fall_history TEXT,
    cognitive_status TEXT CHECK (cognitive_status IN ('intact', 'mild-impairment', 'moderate-impairment', 'severe-impairment')),
    hearing_status TEXT CHECK (hearing_status IN ('normal', 'mild-loss', 'moderate-loss', 'severe-loss', 'hearing-aid')),
    vision_status TEXT CHECK (vision_status IN ('normal', 'glasses', 'low-vision', 'legally-blind')),
    dental_status TEXT,
    nutrition_status TEXT CHECK (nutrition_status IN ('well-nourished', 'at-risk', 'malnourished')),
    weight_trend TEXT CHECK (weight_trend IN ('stable', 'gaining', 'losing')),
    pain_level INTEGER CHECK (pain_level >= 0 AND pain_level <= 10),
    sleep_quality TEXT CHECK (sleep_quality IN ('good', 'fair', 'poor')),
    adl_score INTEGER, -- Activities of Daily Living score
    iadl_score INTEGER, -- Instrumental ADL score
    last_hospitalization DATE,
    hospitalization_reason TEXT,
    primary_care_physician TEXT,
    specialist_providers TEXT[],
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

-- Senior SDOH - Social Determinants of Health (critical for geriatric care)
CREATE TABLE IF NOT EXISTS senior_sdoh (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Food Security
    food_security TEXT CHECK (food_security IN ('secure', 'low-security', 'very-low-security')),
    meals_per_day INTEGER,
    needs_meal_assistance BOOLEAN DEFAULT false,
    meal_delivery_enrolled BOOLEAN DEFAULT false,
    -- Transportation
    transportation_access TEXT CHECK (transportation_access IN ('own-car', 'family-drives', 'public-transport', 'rideshare', 'medical-transport', 'limited', 'none')),
    can_drive BOOLEAN,
    needs_transport_assistance BOOLEAN DEFAULT false,
    -- Housing
    housing_type TEXT CHECK (housing_type IN ('own-home', 'rent', 'senior-housing', 'assisted-living', 'family-home', 'other')),
    housing_safe BOOLEAN DEFAULT true,
    home_modifications_needed TEXT[],
    -- Social Support
    social_isolation_risk TEXT CHECK (social_isolation_risk IN ('low', 'moderate', 'high')),
    has_regular_social_contact BOOLEAN DEFAULT true,
    attends_senior_center BOOLEAN DEFAULT false,
    attends_religious_services BOOLEAN DEFAULT false,
    has_pets BOOLEAN DEFAULT false,
    -- Financial
    income_source TEXT[],
    has_medicare BOOLEAN DEFAULT false,
    has_medicaid BOOLEAN DEFAULT false,
    has_supplemental_insurance BOOLEAN DEFAULT false,
    financial_stress_level TEXT CHECK (financial_stress_level IN ('none', 'mild', 'moderate', 'severe')),
    needs_financial_assistance BOOLEAN DEFAULT false,
    -- Technology
    has_smartphone BOOLEAN DEFAULT false,
    has_internet BOOLEAN DEFAULT false,
    tech_comfort_level TEXT CHECK (tech_comfort_level IN ('comfortable', 'some-help', 'needs-assistance', 'unable')),
    uses_medical_alert_device BOOLEAN DEFAULT false,
    -- Caregiver Burden (if has caregiver)
    caregiver_burnout_risk TEXT CHECK (caregiver_burnout_risk IN ('low', 'moderate', 'high')),
    caregiver_needs_respite BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

-- Senior Emergency Contacts - multiple contacts with priority
CREATE TABLE IF NOT EXISTS senior_emergency_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    contact_name TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    contact_relationship TEXT NOT NULL,
    contact_priority INTEGER DEFAULT 1, -- 1 = primary, 2 = secondary, etc.
    is_healthcare_proxy BOOLEAN DEFAULT false,
    is_power_of_attorney BOOLEAN DEFAULT false,
    has_key_to_home BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_senior_demographics_tenant ON senior_demographics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_senior_health_tenant ON senior_health(tenant_id);
CREATE INDEX IF NOT EXISTS idx_senior_sdoh_tenant ON senior_sdoh(tenant_id);
CREATE INDEX IF NOT EXISTS idx_senior_emergency_contacts_user ON senior_emergency_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_senior_emergency_contacts_tenant ON senior_emergency_contacts(tenant_id);

-- Enable RLS
ALTER TABLE senior_demographics ENABLE ROW LEVEL SECURITY;
ALTER TABLE senior_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE senior_sdoh ENABLE ROW LEVEL SECURITY;
ALTER TABLE senior_emergency_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies - users can see their own data, admins can see tenant data
CREATE POLICY "senior_demographics_own" ON senior_demographics
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "senior_demographics_admin" ON senior_demographics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
            AND p.is_admin = true
            AND p.tenant_id = senior_demographics.tenant_id
        )
    );

CREATE POLICY "senior_health_own" ON senior_health
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "senior_health_admin" ON senior_health
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
            AND p.is_admin = true
            AND p.tenant_id = senior_health.tenant_id
        )
    );

CREATE POLICY "senior_sdoh_own" ON senior_sdoh
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "senior_sdoh_admin" ON senior_sdoh
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
            AND p.is_admin = true
            AND p.tenant_id = senior_sdoh.tenant_id
        )
    );

CREATE POLICY "senior_emergency_contacts_own" ON senior_emergency_contacts
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "senior_emergency_contacts_admin" ON senior_emergency_contacts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
            AND p.is_admin = true
            AND p.tenant_id = senior_emergency_contacts.tenant_id
        )
    );

-- Comments
COMMENT ON TABLE senior_demographics IS 'Geriatric-specific demographic information for seniors (role_code 4)';
COMMENT ON TABLE senior_health IS 'Health tracking specific to geriatric care - mobility, cognition, ADLs';
COMMENT ON TABLE senior_sdoh IS 'Social Determinants of Health - critical for senior wellness programs';
COMMENT ON TABLE senior_emergency_contacts IS 'Multiple emergency contacts with healthcare proxy/POA tracking';

DO $$
BEGIN
    RAISE NOTICE 'Senior tables restored for geriatric care tracking';
END $$;
