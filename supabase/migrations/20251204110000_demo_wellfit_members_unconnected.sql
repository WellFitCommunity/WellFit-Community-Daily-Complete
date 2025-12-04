-- Demo WellFit Community Members - NOT Connected to Any Hospital
-- 4 demo members showing different engagement levels
-- Demonstrates "slipping through the cracks" risk

-- Temporarily disable the FHIR observation trigger which expects 'weight' column
-- The trigger function references NEW.weight but check_ins table doesn't have that column
ALTER TABLE check_ins DISABLE TRIGGER trg_checkin_to_fhir_observations;

DO $$
DECLARE
  v_senior_role_id INTEGER;
  v_tenant_id UUID := '2b902657-6a20-4435-a78a-576f397517ca';
  v_gloria UUID := 'd1a0b0c0-1111-4000-8000-000000000001';
  v_harold UUID := 'd1a0b0c0-2222-4000-8000-000000000002';
  v_betty UUID := 'd1a0b0c0-3333-4000-8000-000000000003';
  v_marcus UUID := 'd1a0b0c0-4444-4000-8000-000000000004';
BEGIN
  SELECT id INTO v_senior_role_id FROM public.roles WHERE name = 'senior' LIMIT 1;
  IF v_senior_role_id IS NULL THEN v_senior_role_id := 4; END IF;

  -- Create auth.users
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at, instance_id)
  VALUES
    (v_gloria, 'gloria.simmons.demo@wellfitcommunity.com', crypt('DemoPass123!', gen_salt('bf')), NOW(), '{"first_name":"Gloria","last_name":"Simmons"}'::jsonb, NOW() - INTERVAL '6 months', NOW(), '00000000-0000-0000-0000-000000000000'),
    (v_harold, 'harold.washington.demo@wellfitcommunity.com', crypt('DemoPass123!', gen_salt('bf')), NOW(), '{"first_name":"Harold","last_name":"Washington"}'::jsonb, NOW() - INTERVAL '4 months', NOW(), '00000000-0000-0000-0000-000000000000'),
    (v_betty, 'betty.coleman.demo@wellfitcommunity.com', crypt('DemoPass123!', gen_salt('bf')), NOW(), '{"first_name":"Beatrice","last_name":"Coleman"}'::jsonb, NOW() - INTERVAL '3 months', NOW(), '00000000-0000-0000-0000-000000000000'),
    (v_marcus, 'marcus.thompson.demo@wellfitcommunity.com', crypt('DemoPass123!', gen_salt('bf')), NOW(), '{"first_name":"Marcus","last_name":"Thompson"}'::jsonb, NOW() - INTERVAL '8 months', NOW(), '00000000-0000-0000-0000-000000000000')
  ON CONFLICT (id) DO NOTHING;

  -- Create profiles
  INSERT INTO profiles (user_id, first_name, last_name, phone, role, role_code, role_id, enrollment_type, tenant_id, created_at) VALUES
    (v_gloria, 'Gloria', 'Simmons', '713-555-0101', 'senior', 4, v_senior_role_id, 'app', v_tenant_id, NOW() - INTERVAL '6 months'),
    (v_harold, 'Harold', 'Washington', '713-555-0102', 'senior', 4, v_senior_role_id, 'app', v_tenant_id, NOW() - INTERVAL '4 months'),
    (v_betty, 'Beatrice', 'Coleman', '713-555-0103', 'senior', 4, v_senior_role_id, 'app', v_tenant_id, NOW() - INTERVAL '3 months'),
    (v_marcus, 'Marcus', 'Thompson', '713-555-0104', 'senior', 4, v_senior_role_id, 'app', v_tenant_id, NOW() - INTERVAL '8 months')
  ON CONFLICT (user_id) DO NOTHING;

  -- Gloria check-ins (HIGH RISK - declining O2, sparse engagement)
  INSERT INTO check_ins (user_id, timestamp, label, emotional_state, pulse_oximeter, metadata, tenant_id, created_at) VALUES
    (v_gloria, NOW() - INTERVAL '14 days', 'Not Feeling My Best', 'anxious', 95, '{"notes":"Feeling okay"}'::jsonb, v_tenant_id, NOW() - INTERVAL '14 days'),
    (v_gloria, NOW() - INTERVAL '13 days', 'Not Feeling My Best', 'tired', 94, '{"notes":"Tired today"}'::jsonb, v_tenant_id, NOW() - INTERVAL '13 days'),
    (v_gloria, NOW() - INTERVAL '12 days', 'Not Feeling My Best', 'down', 93, '{"notes":"Did not sleep well"}'::jsonb, v_tenant_id, NOW() - INTERVAL '12 days'),
    (v_gloria, NOW() - INTERVAL '10 days', 'Not Feeling My Best', 'worried', 92, '{"notes":"Legs swelling again"}'::jsonb, v_tenant_id, NOW() - INTERVAL '10 days'),
    (v_gloria, NOW() - INTERVAL '9 days', 'Need Help Today', 'very tired', 91, '{"notes":"Hard to breathe"}'::jsonb, v_tenant_id, NOW() - INTERVAL '9 days')
  ON CONFLICT DO NOTHING;

  -- Harold check-ins (MODERATE - sporadic, rising glucose)
  INSERT INTO check_ins (user_id, timestamp, label, emotional_state, glucose_mg_dl, metadata, tenant_id, created_at) VALUES
    (v_harold, NOW() - INTERVAL '14 days', 'Feeling Great Today', 'happy', 142, '{"notes":"Good day"}'::jsonb, v_tenant_id, NOW() - INTERVAL '14 days'),
    (v_harold, NOW() - INTERVAL '10 days', 'Doing Okay', 'neutral', 156, '{"notes":"A bit tired"}'::jsonb, v_tenant_id, NOW() - INTERVAL '10 days'),
    (v_harold, NOW() - INTERVAL '5 days', 'Not Feeling My Best', 'unmotivated', 168, '{"notes":"Hard to get motivated"}'::jsonb, v_tenant_id, NOW() - INTERVAL '5 days'),
    (v_harold, NOW() - INTERVAL '2 days', 'Not Feeling My Best', 'down', 178, '{"notes":"Feeling down"}'::jsonb, v_tenant_id, NOW() - INTERVAL '2 days')
  ON CONFLICT DO NOTHING;

  -- Betty check-ins (RECOVERING - consistent streak, BP improving)
  INSERT INTO check_ins (user_id, timestamp, label, emotional_state, bp_systolic, bp_diastolic, metadata, tenant_id, created_at) VALUES
    (v_betty, NOW() - INTERVAL '14 days', 'Not Feeling My Best', 'sore', 138, 88, '{"notes":"Hip still hurts"}'::jsonb, v_tenant_id, NOW() - INTERVAL '14 days'),
    (v_betty, NOW() - INTERVAL '12 days', 'Doing Okay', 'hopeful', 135, 86, '{"notes":"Slept better"}'::jsonb, v_tenant_id, NOW() - INTERVAL '12 days'),
    (v_betty, NOW() - INTERVAL '10 days', 'Doing Okay', 'content', 132, 84, '{"notes":"Good day"}'::jsonb, v_tenant_id, NOW() - INTERVAL '10 days'),
    (v_betty, NOW() - INTERVAL '8 days', 'Feeling Great Today', 'energized', 130, 82, '{"notes":"Feeling stronger"}'::jsonb, v_tenant_id, NOW() - INTERVAL '8 days'),
    (v_betty, NOW() - INTERVAL '6 days', 'Feeling Great Today', 'proud', 129, 81, '{"notes":"Walked around block"}'::jsonb, v_tenant_id, NOW() - INTERVAL '6 days'),
    (v_betty, NOW() - INTERVAL '4 days', 'Feeling Great Today', 'rested', 128, 80, '{"notes":"Great sleep!"}'::jsonb, v_tenant_id, NOW() - INTERVAL '4 days'),
    (v_betty, NOW() - INTERVAL '2 days', 'Feeling Great Today', 'joyful', 127, 79, '{"notes":"Went to church"}'::jsonb, v_tenant_id, NOW() - INTERVAL '2 days'),
    (v_betty, NOW(), 'Feeling Great Today', 'grateful', 128, 80, '{"notes":"Grateful for WellFit"}'::jsonb, v_tenant_id, NOW())
  ON CONFLICT DO NOTHING;

  -- Marcus check-ins (HEALTHY - 100% compliance, all normal vitals)
  INSERT INTO check_ins (user_id, timestamp, label, emotional_state, bp_systolic, bp_diastolic, pulse_oximeter, metadata, tenant_id, created_at) VALUES
    (v_marcus, NOW() - INTERVAL '14 days', 'Feeling Great Today', 'energized', 122, 78, 98, '{"notes":"Morning walk"}'::jsonb, v_tenant_id, NOW() - INTERVAL '14 days'),
    (v_marcus, NOW() - INTERVAL '12 days', 'Feeling Great Today', 'rested', 120, 76, 99, '{"notes":"Good sleep"}'::jsonb, v_tenant_id, NOW() - INTERVAL '12 days'),
    (v_marcus, NOW() - INTERVAL '10 days', 'Feeling Great Today', 'joyful', 121, 77, 98, '{"notes":"Grandkids visited"}'::jsonb, v_tenant_id, NOW() - INTERVAL '10 days'),
    (v_marcus, NOW() - INTERVAL '8 days', 'Feeling Great Today', 'content', 122, 78, 98, '{"notes":"Regular day"}'::jsonb, v_tenant_id, NOW() - INTERVAL '8 days'),
    (v_marcus, NOW() - INTERVAL '6 days', 'Feeling Great Today', 'active', 120, 76, 98, '{"notes":"Grocery shopping"}'::jsonb, v_tenant_id, NOW() - INTERVAL '6 days'),
    (v_marcus, NOW() - INTERVAL '4 days', 'Feeling Great Today', 'blessed', 119, 75, 99, '{"notes":"Blessed day"}'::jsonb, v_tenant_id, NOW() - INTERVAL '4 days'),
    (v_marcus, NOW() - INTERVAL '2 days', 'Feeling Great Today', 'peaceful', 121, 77, 98, '{"notes":"Church service"}'::jsonb, v_tenant_id, NOW() - INTERVAL '2 days'),
    (v_marcus, NOW(), 'Feeling Great Today', 'optimistic', 120, 76, 98, '{"notes":"Ready for a good week"}'::jsonb, v_tenant_id, NOW())
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Created 4 demo WellFit members: Gloria (HIGH RISK), Harold (MODERATE), Betty (RECOVERING), Marcus (HEALTHY)';
END $$;

-- Re-enable the trigger
ALTER TABLE check_ins ENABLE TRIGGER trg_checkin_to_fhir_observations;
