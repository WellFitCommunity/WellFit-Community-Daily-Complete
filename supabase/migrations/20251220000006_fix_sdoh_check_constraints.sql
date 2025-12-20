-- Fix CHECK constraints to match form options in DemographicsPage
-- The form options don't match the database constraints, causing 400 errors

-- Fix transportation_access to include 'walk' option
ALTER TABLE senior_sdoh DROP CONSTRAINT IF EXISTS senior_sdoh_transportation_access_check;
ALTER TABLE senior_sdoh ADD CONSTRAINT senior_sdoh_transportation_access_check
  CHECK (transportation_access IS NULL OR transportation_access = ANY (ARRAY[
    'own-car'::text,
    'family-drives'::text,
    'public-transport'::text,
    'rideshare'::text,
    'medical-transport'::text,
    'walk'::text,
    'limited'::text,
    'none'::text
  ]));

-- The senior_health table might also have issues with empty/null values
-- Make hearing_status and vision_status nullable in check constraint
ALTER TABLE senior_health DROP CONSTRAINT IF EXISTS senior_health_hearing_status_check;
ALTER TABLE senior_health ADD CONSTRAINT senior_health_hearing_status_check
  CHECK (hearing_status IS NULL OR hearing_status = ANY (ARRAY[
    'normal'::text,
    'mild-loss'::text,
    'moderate-loss'::text,
    'severe-loss'::text,
    'hearing-aid'::text
  ]));

ALTER TABLE senior_health DROP CONSTRAINT IF EXISTS senior_health_vision_status_check;
ALTER TABLE senior_health ADD CONSTRAINT senior_health_vision_status_check
  CHECK (vision_status IS NULL OR vision_status = ANY (ARRAY[
    'normal'::text,
    'glasses'::text,
    'low-vision'::text,
    'legally-blind'::text
  ]));

-- Fix mobility_level to allow NULL
ALTER TABLE senior_health DROP CONSTRAINT IF EXISTS senior_health_mobility_level_check;
ALTER TABLE senior_health ADD CONSTRAINT senior_health_mobility_level_check
  CHECK (mobility_level IS NULL OR mobility_level = ANY (ARRAY[
    'independent'::text,
    'cane'::text,
    'walker'::text,
    'wheelchair'::text,
    'bedbound'::text
  ]));

-- Fix other senior_health constraints to allow NULL
ALTER TABLE senior_health DROP CONSTRAINT IF EXISTS senior_health_cognitive_status_check;
ALTER TABLE senior_health ADD CONSTRAINT senior_health_cognitive_status_check
  CHECK (cognitive_status IS NULL OR cognitive_status = ANY (ARRAY[
    'intact'::text,
    'mild-impairment'::text,
    'moderate-impairment'::text,
    'severe-impairment'::text
  ]));

ALTER TABLE senior_health DROP CONSTRAINT IF EXISTS senior_health_fall_risk_level_check;
ALTER TABLE senior_health ADD CONSTRAINT senior_health_fall_risk_level_check
  CHECK (fall_risk_level IS NULL OR fall_risk_level = ANY (ARRAY[
    'low'::text,
    'moderate'::text,
    'high'::text
  ]));

ALTER TABLE senior_health DROP CONSTRAINT IF EXISTS senior_health_nutrition_status_check;
ALTER TABLE senior_health ADD CONSTRAINT senior_health_nutrition_status_check
  CHECK (nutrition_status IS NULL OR nutrition_status = ANY (ARRAY[
    'well-nourished'::text,
    'at-risk'::text,
    'malnourished'::text
  ]));

ALTER TABLE senior_health DROP CONSTRAINT IF EXISTS senior_health_sleep_quality_check;
ALTER TABLE senior_health ADD CONSTRAINT senior_health_sleep_quality_check
  CHECK (sleep_quality IS NULL OR sleep_quality = ANY (ARRAY[
    'good'::text,
    'fair'::text,
    'poor'::text
  ]));

ALTER TABLE senior_health DROP CONSTRAINT IF EXISTS senior_health_weight_trend_check;
ALTER TABLE senior_health ADD CONSTRAINT senior_health_weight_trend_check
  CHECK (weight_trend IS NULL OR weight_trend = ANY (ARRAY[
    'stable'::text,
    'gaining'::text,
    'losing'::text
  ]));

-- Fix senior_sdoh constraints to allow NULL
ALTER TABLE senior_sdoh DROP CONSTRAINT IF EXISTS senior_sdoh_food_security_check;
ALTER TABLE senior_sdoh ADD CONSTRAINT senior_sdoh_food_security_check
  CHECK (food_security IS NULL OR food_security = ANY (ARRAY[
    'secure'::text,
    'low-security'::text,
    'very-low-security'::text
  ]));

ALTER TABLE senior_sdoh DROP CONSTRAINT IF EXISTS senior_sdoh_social_isolation_risk_check;
ALTER TABLE senior_sdoh ADD CONSTRAINT senior_sdoh_social_isolation_risk_check
  CHECK (social_isolation_risk IS NULL OR social_isolation_risk = ANY (ARRAY[
    'low'::text,
    'moderate'::text,
    'high'::text
  ]));

ALTER TABLE senior_sdoh DROP CONSTRAINT IF EXISTS senior_sdoh_tech_comfort_level_check;
ALTER TABLE senior_sdoh ADD CONSTRAINT senior_sdoh_tech_comfort_level_check
  CHECK (tech_comfort_level IS NULL OR tech_comfort_level = ANY (ARRAY[
    'comfortable'::text,
    'some-help'::text,
    'needs-assistance'::text,
    'unable'::text
  ]));

ALTER TABLE senior_sdoh DROP CONSTRAINT IF EXISTS senior_sdoh_housing_type_check;
ALTER TABLE senior_sdoh ADD CONSTRAINT senior_sdoh_housing_type_check
  CHECK (housing_type IS NULL OR housing_type = ANY (ARRAY[
    'own-home'::text,
    'rent'::text,
    'senior-housing'::text,
    'assisted-living'::text,
    'family-home'::text,
    'other'::text
  ]));

ALTER TABLE senior_sdoh DROP CONSTRAINT IF EXISTS senior_sdoh_financial_stress_level_check;
ALTER TABLE senior_sdoh ADD CONSTRAINT senior_sdoh_financial_stress_level_check
  CHECK (financial_stress_level IS NULL OR financial_stress_level = ANY (ARRAY[
    'none'::text,
    'mild'::text,
    'moderate'::text,
    'severe'::text
  ]));

ALTER TABLE senior_sdoh DROP CONSTRAINT IF EXISTS senior_sdoh_caregiver_burnout_risk_check;
ALTER TABLE senior_sdoh ADD CONSTRAINT senior_sdoh_caregiver_burnout_risk_check
  CHECK (caregiver_burnout_risk IS NULL OR caregiver_burnout_risk = ANY (ARRAY[
    'low'::text,
    'moderate'::text,
    'high'::text
  ]));
