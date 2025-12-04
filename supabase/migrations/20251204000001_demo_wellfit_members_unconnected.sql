-- ============================================================================
-- Demo WellFit Community Members - NOT Connected to Any Hospital
-- ============================================================================
-- Purpose: Create 4 demo members showing different engagement levels
-- These members demonstrate the risk of people "slipping through the cracks"
-- when not connected to a hospital's care coordination system.
--
-- The value prop for Methodist: "Partner with WellFit to catch these at-risk
-- community members BEFORE they show up in your ER"
-- ============================================================================

-- Demo User 1: HIGH RISK - Gloria Simmons
-- 78yo, CHF history, missed check-ins, declining mood, low medication adherence
-- Story: She's going to end up in the ER soon if someone doesn't intervene
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at
) VALUES (
    'demo-gloria-simmons-001',
    'gloria.simmons.demo@wellfitcommunity.com',
    crypt('DemoPass123!', gen_salt('bf')),
    NOW(),
    jsonb_build_object(
        'first_name', 'Gloria',
        'last_name', 'Simmons',
        'phone', '713-555-0101',
        'role', 'senior'
    ),
    NOW() - INTERVAL '6 months',
    NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (
    user_id,
    first_name,
    last_name,
    phone,
    role,
    role_code,
    is_active,
    enrollment_type,
    tenant_id,
    created_at
) VALUES (
    'demo-gloria-simmons-001',
    'Gloria',
    'Simmons',
    '713-555-0101',
    'senior',
    4,
    true,
    'app',
    '2b902657-6a20-4435-a78a-576f397517ca', -- WF-0001 (WellFit default, NO hospital connection)
    NOW() - INTERVAL '6 months'
) ON CONFLICT (user_id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name;

-- Gloria's declining check-in history (last 14 days)
INSERT INTO daily_checkins (user_id, check_in_date, mood_score, energy_level, pain_level, sleep_quality, notes, created_at)
VALUES
    ('demo-gloria-simmons-001', CURRENT_DATE - 14, 3, 3, 6, 2, 'Feeling okay', NOW() - INTERVAL '14 days'),
    ('demo-gloria-simmons-001', CURRENT_DATE - 13, 3, 2, 7, 2, 'Tired today', NOW() - INTERVAL '13 days'),
    ('demo-gloria-simmons-001', CURRENT_DATE - 12, 2, 2, 7, 1, 'Did not sleep well', NOW() - INTERVAL '12 days'),
    -- Missed day 11
    ('demo-gloria-simmons-001', CURRENT_DATE - 10, 2, 2, 8, 2, 'Legs swelling again', NOW() - INTERVAL '10 days'),
    ('demo-gloria-simmons-001', CURRENT_DATE - 9, 2, 1, 8, 1, 'Hard to breathe when walking', NOW() - INTERVAL '9 days'),
    -- Missed days 8, 7, 6
    ('demo-gloria-simmons-001', CURRENT_DATE - 5, 1, 1, 9, 1, 'Very tired, stayed in bed', NOW() - INTERVAL '5 days'),
    -- Missed days 4, 3, 2, 1, 0 (today)
ON CONFLICT DO NOTHING;

-- Gloria's health data showing warning signs
INSERT INTO health_data (user_id, measurement_type, value, unit, recorded_at, created_at)
VALUES
    ('demo-gloria-simmons-001', 'weight', 187.5, 'lbs', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
    ('demo-gloria-simmons-001', 'weight', 189.2, 'lbs', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
    ('demo-gloria-simmons-001', 'weight', 192.8, 'lbs', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'), -- 5lb gain = CHF warning!
    ('demo-gloria-simmons-001', 'blood_pressure_systolic', 158, 'mmHg', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
    ('demo-gloria-simmons-001', 'blood_pressure_diastolic', 94, 'mmHg', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
    ('demo-gloria-simmons-001', 'oxygen_saturation', 91, '%', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days') -- Low O2!
ON CONFLICT DO NOTHING;


-- Demo User 2: MODERATE RISK - Harold Washington
-- 72yo, diabetes, sporadic engagement, starting to disengage
-- Story: He was doing well but is starting to slip - needs outreach
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at
) VALUES (
    'demo-harold-washington-002',
    'harold.washington.demo@wellfitcommunity.com',
    crypt('DemoPass123!', gen_salt('bf')),
    NOW(),
    jsonb_build_object(
        'first_name', 'Harold',
        'last_name', 'Washington',
        'phone', '713-555-0102',
        'role', 'senior'
    ),
    NOW() - INTERVAL '4 months',
    NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (
    user_id,
    first_name,
    last_name,
    phone,
    role,
    role_code,
    is_active,
    enrollment_type,
    tenant_id,
    created_at
) VALUES (
    'demo-harold-washington-002',
    'Harold',
    'Washington',
    '713-555-0102',
    'senior',
    4,
    true,
    'app',
    '2b902657-6a20-4435-a78a-576f397517ca',
    NOW() - INTERVAL '4 months'
) ON CONFLICT (user_id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name;

-- Harold's sporadic check-ins (every other day, then dropping off)
INSERT INTO daily_checkins (user_id, check_in_date, mood_score, energy_level, pain_level, sleep_quality, notes, created_at)
VALUES
    ('demo-harold-washington-002', CURRENT_DATE - 14, 4, 4, 3, 4, 'Good day', NOW() - INTERVAL '14 days'),
    ('demo-harold-washington-002', CURRENT_DATE - 12, 4, 3, 4, 3, 'Okay', NOW() - INTERVAL '12 days'),
    ('demo-harold-washington-002', CURRENT_DATE - 10, 3, 3, 4, 3, 'A bit tired', NOW() - INTERVAL '10 days'),
    ('demo-harold-washington-002', CURRENT_DATE - 8, 3, 3, 5, 3, 'Knee hurting', NOW() - INTERVAL '8 days'),
    ('demo-harold-washington-002', CURRENT_DATE - 5, 3, 2, 5, 2, 'Hard to get motivated', NOW() - INTERVAL '5 days'),
    ('demo-harold-washington-002', CURRENT_DATE - 2, 2, 2, 6, 2, 'Feeling down', NOW() - INTERVAL '2 days')
ON CONFLICT DO NOTHING;

-- Harold's health data - blood sugar creeping up
INSERT INTO health_data (user_id, measurement_type, value, unit, recorded_at, created_at)
VALUES
    ('demo-harold-washington-002', 'blood_glucose', 142, 'mg/dL', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
    ('demo-harold-washington-002', 'blood_glucose', 156, 'mg/dL', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
    ('demo-harold-washington-002', 'blood_glucose', 178, 'mg/dL', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'), -- Rising!
    ('demo-harold-washington-002', 'weight', 224, 'lbs', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
    ('demo-harold-washington-002', 'blood_pressure_systolic', 148, 'mmHg', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days')
ON CONFLICT DO NOTHING;


-- Demo User 3: RECOVERING - Beatrice "Betty" Coleman
-- 81yo, was high risk after hip surgery, now improving with WellFit engagement
-- Story: SUCCESS - WellFit helped her recover and stay out of the hospital
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at
) VALUES (
    'demo-betty-coleman-003',
    'betty.coleman.demo@wellfitcommunity.com',
    crypt('DemoPass123!', gen_salt('bf')),
    NOW(),
    jsonb_build_object(
        'first_name', 'Beatrice',
        'last_name', 'Coleman',
        'phone', '713-555-0103',
        'role', 'senior'
    ),
    NOW() - INTERVAL '3 months',
    NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (
    user_id,
    first_name,
    last_name,
    phone,
    role,
    role_code,
    is_active,
    enrollment_type,
    tenant_id,
    created_at
) VALUES (
    'demo-betty-coleman-003',
    'Beatrice',
    'Coleman',
    '713-555-0103',
    'senior',
    4,
    true,
    'app',
    '2b902657-6a20-4435-a78a-576f397517ca',
    NOW() - INTERVAL '3 months'
) ON CONFLICT (user_id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name;

-- Betty's improving check-ins (daily, mood improving)
INSERT INTO daily_checkins (user_id, check_in_date, mood_score, energy_level, pain_level, sleep_quality, notes, created_at)
VALUES
    ('demo-betty-coleman-003', CURRENT_DATE - 14, 2, 2, 7, 2, 'Hip still hurts', NOW() - INTERVAL '14 days'),
    ('demo-betty-coleman-003', CURRENT_DATE - 13, 2, 2, 6, 2, 'PT exercises helping', NOW() - INTERVAL '13 days'),
    ('demo-betty-coleman-003', CURRENT_DATE - 12, 3, 2, 6, 3, 'Slept better', NOW() - INTERVAL '12 days'),
    ('demo-betty-coleman-003', CURRENT_DATE - 11, 3, 3, 5, 3, 'Walked to mailbox!', NOW() - INTERVAL '11 days'),
    ('demo-betty-coleman-003', CURRENT_DATE - 10, 3, 3, 5, 3, 'Good day', NOW() - INTERVAL '10 days'),
    ('demo-betty-coleman-003', CURRENT_DATE - 9, 3, 3, 5, 4, 'Daughter visited', NOW() - INTERVAL '9 days'),
    ('demo-betty-coleman-003', CURRENT_DATE - 8, 4, 3, 4, 4, 'Feeling stronger', NOW() - INTERVAL '8 days'),
    ('demo-betty-coleman-003', CURRENT_DATE - 7, 4, 4, 4, 4, 'Did all my exercises', NOW() - INTERVAL '7 days'),
    ('demo-betty-coleman-003', CURRENT_DATE - 6, 4, 4, 4, 4, 'Walked around block', NOW() - INTERVAL '6 days'),
    ('demo-betty-coleman-003', CURRENT_DATE - 5, 4, 4, 3, 4, 'Hip much better', NOW() - INTERVAL '5 days'),
    ('demo-betty-coleman-003', CURRENT_DATE - 4, 4, 4, 3, 5, 'Great sleep!', NOW() - INTERVAL '4 days'),
    ('demo-betty-coleman-003', CURRENT_DATE - 3, 5, 4, 3, 4, 'Feeling happy', NOW() - INTERVAL '3 days'),
    ('demo-betty-coleman-003', CURRENT_DATE - 2, 5, 4, 2, 5, 'Went to church', NOW() - INTERVAL '2 days'),
    ('demo-betty-coleman-003', CURRENT_DATE - 1, 5, 5, 2, 5, 'Best day in weeks!', NOW() - INTERVAL '1 day'),
    ('demo-betty-coleman-003', CURRENT_DATE, 5, 5, 2, 5, 'Grateful for WellFit', NOW())
ON CONFLICT DO NOTHING;

-- Betty's improving health data
INSERT INTO health_data (user_id, measurement_type, value, unit, recorded_at, created_at)
VALUES
    ('demo-betty-coleman-003', 'blood_pressure_systolic', 138, 'mmHg', NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days'),
    ('demo-betty-coleman-003', 'blood_pressure_systolic', 132, 'mmHg', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),
    ('demo-betty-coleman-003', 'blood_pressure_systolic', 128, 'mmHg', NOW(), NOW()), -- Improving!
    ('demo-betty-coleman-003', 'blood_pressure_diastolic', 82, 'mmHg', NOW(), NOW()),
    ('demo-betty-coleman-003', 'weight', 156, 'lbs', NOW(), NOW()),
    ('demo-betty-coleman-003', 'oxygen_saturation', 97, '%', NOW(), NOW())
ON CONFLICT DO NOTHING;


-- Demo User 4: HEALTHY ENGAGED - Marcus Thompson
-- 69yo, proactive health management, daily engagement, model member
-- Story: This is what success looks like - consistent engagement = no ER visits
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at
) VALUES (
    'demo-marcus-thompson-004',
    'marcus.thompson.demo@wellfitcommunity.com',
    crypt('DemoPass123!', gen_salt('bf')),
    NOW(),
    jsonb_build_object(
        'first_name', 'Marcus',
        'last_name', 'Thompson',
        'phone', '713-555-0104',
        'role', 'senior'
    ),
    NOW() - INTERVAL '8 months',
    NOW()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (
    user_id,
    first_name,
    last_name,
    phone,
    role,
    role_code,
    is_active,
    enrollment_type,
    tenant_id,
    created_at
) VALUES (
    'demo-marcus-thompson-004',
    'Marcus',
    'Thompson',
    '713-555-0104',
    'senior',
    4,
    true,
    'app',
    '2b902657-6a20-4435-a78a-576f397517ca',
    NOW() - INTERVAL '8 months'
) ON CONFLICT (user_id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name;

-- Marcus's consistent daily check-ins (all 14 days)
INSERT INTO daily_checkins (user_id, check_in_date, mood_score, energy_level, pain_level, sleep_quality, notes, created_at)
VALUES
    ('demo-marcus-thompson-004', CURRENT_DATE - 14, 4, 4, 2, 4, 'Morning walk', NOW() - INTERVAL '14 days'),
    ('demo-marcus-thompson-004', CURRENT_DATE - 13, 5, 4, 2, 4, 'Played dominoes', NOW() - INTERVAL '13 days'),
    ('demo-marcus-thompson-004', CURRENT_DATE - 12, 4, 4, 2, 5, 'Good sleep', NOW() - INTERVAL '12 days'),
    ('demo-marcus-thompson-004', CURRENT_DATE - 11, 4, 5, 1, 4, 'Energetic today', NOW() - INTERVAL '11 days'),
    ('demo-marcus-thompson-004', CURRENT_DATE - 10, 5, 4, 2, 4, 'Grandkids visited', NOW() - INTERVAL '10 days'),
    ('demo-marcus-thompson-004', CURRENT_DATE - 9, 4, 4, 2, 4, 'Bible study', NOW() - INTERVAL '9 days'),
    ('demo-marcus-thompson-004', CURRENT_DATE - 8, 4, 4, 2, 4, 'Regular day', NOW() - INTERVAL '8 days'),
    ('demo-marcus-thompson-004', CURRENT_DATE - 7, 5, 5, 1, 5, 'Feeling great!', NOW() - INTERVAL '7 days'),
    ('demo-marcus-thompson-004', CURRENT_DATE - 6, 4, 4, 2, 4, 'Grocery shopping', NOW() - INTERVAL '6 days'),
    ('demo-marcus-thompson-004', CURRENT_DATE - 5, 4, 4, 2, 4, 'Lunch with friends', NOW() - INTERVAL '5 days'),
    ('demo-marcus-thompson-004', CURRENT_DATE - 4, 5, 4, 1, 5, 'Blessed day', NOW() - INTERVAL '4 days'),
    ('demo-marcus-thompson-004', CURRENT_DATE - 3, 4, 4, 2, 4, 'Walked 2 miles', NOW() - INTERVAL '3 days'),
    ('demo-marcus-thompson-004', CURRENT_DATE - 2, 4, 4, 2, 4, 'Church service', NOW() - INTERVAL '2 days'),
    ('demo-marcus-thompson-004', CURRENT_DATE - 1, 5, 5, 1, 5, 'Doctor said I look great', NOW() - INTERVAL '1 day'),
    ('demo-marcus-thompson-004', CURRENT_DATE, 5, 5, 1, 5, 'Ready for a good week', NOW())
ON CONFLICT DO NOTHING;

-- Marcus's excellent health data
INSERT INTO health_data (user_id, measurement_type, value, unit, recorded_at, created_at)
VALUES
    ('demo-marcus-thompson-004', 'blood_pressure_systolic', 122, 'mmHg', NOW(), NOW()),
    ('demo-marcus-thompson-004', 'blood_pressure_diastolic', 78, 'mmHg', NOW(), NOW()),
    ('demo-marcus-thompson-004', 'weight', 182, 'lbs', NOW(), NOW()),
    ('demo-marcus-thompson-004', 'blood_glucose', 98, 'mg/dL', NOW(), NOW()), -- Normal!
    ('demo-marcus-thompson-004', 'oxygen_saturation', 98, '%', NOW(), NOW()),
    ('demo-marcus-thompson-004', 'heart_rate', 68, 'bpm', NOW(), NOW())
ON CONFLICT DO NOTHING;


-- ============================================================================
-- Summary of Demo Members (for reference in presentation)
-- ============================================================================
--
-- 1. GLORIA SIMMONS (HIGH RISK) - demo-gloria-simmons-001
--    - 5 missed check-ins in last week
--    - Mood declining (3→1)
--    - 5lb weight gain (CHF warning sign)
--    - Low O2 saturation (91%)
--    - STORY: "She's going to end up in your ER if no one intervenes"
--
-- 2. HAROLD WASHINGTON (MODERATE RISK) - demo-harold-washington-002
--    - Sporadic check-ins (every other day → dropping off)
--    - Blood sugar rising (142→178)
--    - Mood declining
--    - STORY: "He was engaged but is starting to slip"
--
-- 3. BEATRICE "BETTY" COLEMAN (RECOVERING) - demo-betty-coleman-003
--    - Daily check-ins (14 day streak!)
--    - Mood improving (2→5)
--    - Pain decreasing (7→2)
--    - BP normalizing
--    - STORY: "WellFit helped her stay OUT of the hospital"
--
-- 4. MARCUS THOMPSON (HEALTHY ENGAGED) - demo-marcus-thompson-004
--    - 100% check-in compliance
--    - Consistently high mood (4-5)
--    - All vitals normal
--    - Active lifestyle
--    - STORY: "This is what success looks like"
--
-- NONE of these members are connected to a hospital.
-- The pitch: "Methodist, if you partner with WellFit, you'd see Gloria's
-- warning signs and intervene BEFORE she shows up in your ER."
-- ============================================================================
