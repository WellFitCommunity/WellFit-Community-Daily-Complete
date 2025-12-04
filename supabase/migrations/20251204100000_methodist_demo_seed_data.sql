-- Methodist Hospital Demo Seed Data (Simplified)
-- For product demonstration with realistic hospital workflows
-- DEMO DATA ONLY - Not real patient information

DO $$
DECLARE
    v_tenant_id UUID := '2b902657-6a20-4435-a78a-576f397517ca';
    v_icu_unit_id UUID;
    v_medsurg_unit_id UUID;
    v_tele_unit_id UUID;
    v_er_unit_id UUID;
    v_stepdown_unit_id UUID;
    -- Patient user_ids (user_id is the actual primary key, id is generated from it)
    v_patient1_id UUID := 'b1000000-0000-0000-0000-000000000001';
    v_patient2_id UUID := 'b1000000-0000-0000-0000-000000000002';
    v_patient3_id UUID := 'b1000000-0000-0000-0000-000000000003';
    v_patient4_id UUID := 'b1000000-0000-0000-0000-000000000004';
    v_patient5_id UUID := 'b1000000-0000-0000-0000-000000000005';
    v_patient6_id UUID := 'b1000000-0000-0000-0000-000000000006';
    v_patient7_id UUID := 'b1000000-0000-0000-0000-000000000007';
    v_patient8_id UUID := 'b1000000-0000-0000-0000-000000000008';
    v_patient9_id UUID := 'b1000000-0000-0000-0000-000000000009';
    v_patient10_id UUID := 'b1000000-0000-0000-0000-000000000010';
    v_patient11_id UUID := 'b1000000-0000-0000-0000-000000000011';
    v_patient12_id UUID := 'b1000000-0000-0000-0000-000000000012';
    -- Nurse user_ids
    v_nurse1_id UUID := 'c1000000-0000-0000-0000-000000000001';
    v_nurse2_id UUID := 'c1000000-0000-0000-0000-000000000002';
    v_nurse3_id UUID := 'c1000000-0000-0000-0000-000000000003';
    v_nurse4_id UUID := 'c1000000-0000-0000-0000-000000000004';
    v_nurse5_id UUID := 'c1000000-0000-0000-0000-000000000005';
    v_nurse6_id UUID := 'c1000000-0000-0000-0000-000000000006';
    -- Physician user_ids
    v_dr1_id UUID := 'e1000000-0000-0000-0000-000000000001';
    v_dr2_id UUID := 'e1000000-0000-0000-0000-000000000002';
    v_dr3_id UUID := 'e1000000-0000-0000-0000-000000000003';
    v_dr4_id UUID := 'e1000000-0000-0000-0000-000000000004';
    i INTEGER;
BEGIN
    -- ============================================
    -- HOSPITAL UNITS
    -- ============================================

    -- ICU - Check if exists first
    SELECT id INTO v_icu_unit_id FROM hospital_units WHERE tenant_id = v_tenant_id AND unit_code = 'ICU-A';
    IF v_icu_unit_id IS NULL THEN
        INSERT INTO hospital_units (tenant_id, unit_code, unit_name, unit_type, total_beds, operational_beds, target_census, max_census, nurse_patient_ratio, min_acuity_level, max_acuity_level, is_active)
        VALUES (
            v_tenant_id,
            'ICU-A',
            'Medical Intensive Care Unit',
            'icu',
            24, 22, 18, 22,
            '1:2',
            4, 5,
            true
        )
        RETURNING id INTO v_icu_unit_id;
    END IF;

    -- Med-Surg
    SELECT id INTO v_medsurg_unit_id FROM hospital_units WHERE tenant_id = v_tenant_id AND unit_code = 'MS-4N';
    IF v_medsurg_unit_id IS NULL THEN
        INSERT INTO hospital_units (tenant_id, unit_code, unit_name, unit_type, total_beds, operational_beds, target_census, max_census, nurse_patient_ratio, min_acuity_level, max_acuity_level, is_active)
        VALUES (
            v_tenant_id, 'MS-4N', 'Medical-Surgical 4 North', 'med_surg',
            32, 30, 26, 30, '1:5', 2, 3, true
        )
        RETURNING id INTO v_medsurg_unit_id;
    END IF;

    -- Telemetry
    SELECT id INTO v_tele_unit_id FROM hospital_units WHERE tenant_id = v_tenant_id AND unit_code = 'TELE-3';
    IF v_tele_unit_id IS NULL THEN
        INSERT INTO hospital_units (tenant_id, unit_code, unit_name, unit_type, total_beds, operational_beds, target_census, max_census, nurse_patient_ratio, min_acuity_level, max_acuity_level, is_active)
        VALUES (
            v_tenant_id, 'TELE-3', 'Cardiac Telemetry Unit', 'telemetry',
            28, 26, 22, 26, '1:4', 3, 4, true
        )
        RETURNING id INTO v_tele_unit_id;
    END IF;

    -- Emergency Department
    SELECT id INTO v_er_unit_id FROM hospital_units WHERE tenant_id = v_tenant_id AND unit_code = 'ER-MAIN';
    IF v_er_unit_id IS NULL THEN
        INSERT INTO hospital_units (tenant_id, unit_code, unit_name, unit_type, total_beds, operational_beds, target_census, max_census, nurse_patient_ratio, min_acuity_level, max_acuity_level, is_active)
        VALUES (
            v_tenant_id, 'ER-MAIN', 'Emergency Department', 'ed',
            40, 38, 30, 38, '1:4', 1, 5, true
        )
        RETURNING id INTO v_er_unit_id;
    END IF;

    -- Step-Down
    SELECT id INTO v_stepdown_unit_id FROM hospital_units WHERE tenant_id = v_tenant_id AND unit_code = 'SDU-2';
    IF v_stepdown_unit_id IS NULL THEN
        INSERT INTO hospital_units (tenant_id, unit_code, unit_name, unit_type, total_beds, operational_beds, target_census, max_census, nurse_patient_ratio, min_acuity_level, max_acuity_level, is_active)
        VALUES (
            v_tenant_id, 'SDU-2', 'Step-Down Unit', 'step_down',
            20, 18, 15, 18, '1:3', 3, 4, true
        )
        RETURNING id INTO v_stepdown_unit_id;
    END IF;

    -- ============================================
    -- BEDS (Create beds for each unit if not exist)
    -- ============================================

    -- ICU Beds (22 operational)
    FOR i IN 1..22 LOOP
        INSERT INTO beds (tenant_id, unit_id, room_number, bed_position, bed_type, status, has_telemetry, has_isolation_capability, has_negative_pressure)
        SELECT
            v_tenant_id,
            v_icu_unit_id,
            'ICU-' || LPAD(i::text, 2, '0'),
            CASE WHEN i % 2 = 1 THEN 'A' ELSE 'B' END,
            'icu',
            (CASE WHEN i <= 16 THEN 'occupied' WHEN i <= 18 THEN 'available' WHEN i <= 20 THEN 'cleaning' ELSE 'reserved' END)::bed_status,
            true,
            i <= 10,
            i <= 4
        WHERE NOT EXISTS (
            SELECT 1 FROM beds WHERE tenant_id = v_tenant_id AND unit_id = v_icu_unit_id AND room_number = 'ICU-' || LPAD(i::text, 2, '0')
        );
    END LOOP;

    -- Med-Surg Beds (30 operational)
    FOR i IN 1..30 LOOP
        INSERT INTO beds (tenant_id, unit_id, room_number, bed_position, bed_type, status, has_telemetry)
        SELECT
            v_tenant_id,
            v_medsurg_unit_id,
            '4N-' || LPAD(((i-1)/2 + 401)::text, 3, '0'),
            CASE WHEN i % 2 = 1 THEN 'A' ELSE 'B' END,
            'standard',
            (CASE WHEN i <= 24 THEN 'occupied' WHEN i <= 27 THEN 'available' ELSE 'dirty' END)::bed_status,
            i <= 8
        WHERE NOT EXISTS (
            SELECT 1 FROM beds WHERE tenant_id = v_tenant_id AND unit_id = v_medsurg_unit_id AND room_number = '4N-' || LPAD(((i-1)/2 + 401)::text, 3, '0')
        );
    END LOOP;

    -- Telemetry Beds (26 operational)
    FOR i IN 1..26 LOOP
        INSERT INTO beds (tenant_id, unit_id, room_number, bed_position, bed_type, status, has_telemetry)
        SELECT
            v_tenant_id,
            v_tele_unit_id,
            'T3-' || LPAD(((i-1)/2 + 301)::text, 3, '0'),
            CASE WHEN i % 2 = 1 THEN 'A' ELSE 'B' END,
            'standard',
            (CASE WHEN i <= 20 THEN 'occupied' WHEN i <= 23 THEN 'available' ELSE 'maintenance' END)::bed_status,
            true
        WHERE NOT EXISTS (
            SELECT 1 FROM beds WHERE tenant_id = v_tenant_id AND unit_id = v_tele_unit_id AND room_number = 'T3-' || LPAD(((i-1)/2 + 301)::text, 3, '0')
        );
    END LOOP;

    -- ============================================
    -- DEMO PATIENTS (Hospital enrollment_type)
    -- NOTE: user_id is the primary key, id is GENERATED ALWAYS AS (user_id)
    -- ============================================

    -- Patient 1: Critical - Sepsis
    -- Note: role_id = 19 (patient), role_code = 1 (for hospital patients)
    INSERT INTO profiles (user_id, tenant_id, first_name, last_name, phone, email, role_id, role_code, enrollment_type, mrn, hospital_unit, bed_number, acuity_level, code_status, admission_date, enrollment_notes)
    VALUES (
        v_patient1_id,
        v_tenant_id,
        'James', 'Morrison',
        '+15551000001', 'demo.patient1@methodist.example',
        19, 1, 'hospital',
        'MRN-2024-00001', 'ICU-A', 'ICU-01A',
        '1-Critical', 'Full Code',
        CURRENT_DATE - INTERVAL '3 days',
        'DEMO: Septic shock, multi-organ dysfunction. High acuity.'
    )
    ON CONFLICT (user_id) DO UPDATE SET acuity_level = '1-Critical';

    -- Patient 2: Critical - STEMI
    INSERT INTO profiles (user_id, tenant_id, first_name, last_name, phone, email, role_id, role_code, enrollment_type, mrn, hospital_unit, bed_number, acuity_level, code_status, admission_date, enrollment_notes)
    VALUES (
        v_patient2_id,
        v_tenant_id,
        'Eleanor', 'Vasquez',
        '+15551000002', 'demo.patient2@methodist.example',
        19, 1, 'hospital',
        'MRN-2024-00002', 'ICU-A', 'ICU-02B',
        '1-Critical', 'Full Code',
        CURRENT_DATE - INTERVAL '1 day',
        'DEMO: STEMI s/p PCI, on pressors. Cardiology following.'
    )
    ON CONFLICT (user_id) DO UPDATE SET acuity_level = '1-Critical';

    -- Patient 3: High - CHF Exacerbation
    INSERT INTO profiles (user_id, tenant_id, first_name, last_name, phone, email, role_id, role_code, enrollment_type, mrn, hospital_unit, bed_number, acuity_level, code_status, admission_date, enrollment_notes)
    VALUES (
        v_patient3_id,
        v_tenant_id,
        'Robert', 'Chen',
        '+15551000003', 'demo.patient3@methodist.example',
        19, 1, 'hospital',
        'MRN-2024-00003', 'TELE-3', 'T3-301A',
        '2-High', 'Full Code',
        CURRENT_DATE - INTERVAL '2 days',
        'DEMO: CHF exacerbation, EF 25%. On IV diuretics.'
    )
    ON CONFLICT (user_id) DO UPDATE SET acuity_level = '2-High';

    -- Patient 4: High - Acute Stroke
    INSERT INTO profiles (user_id, tenant_id, first_name, last_name, phone, email, role_id, role_code, enrollment_type, mrn, hospital_unit, bed_number, acuity_level, code_status, admission_date, enrollment_notes)
    VALUES (
        v_patient4_id,
        v_tenant_id,
        'Patricia', 'Williams',
        '+15551000004', 'demo.patient4@methodist.example',
        19, 1, 'hospital',
        'MRN-2024-00004', 'ICU-A', 'ICU-03A',
        '2-High', 'Full Code',
        CURRENT_DATE - INTERVAL '6 hours',
        'DEMO: Acute ischemic stroke, received tPA. NIHSS 8.'
    )
    ON CONFLICT (user_id) DO UPDATE SET acuity_level = '2-High';

    -- Patient 5: Moderate - COPD Exacerbation
    INSERT INTO profiles (user_id, tenant_id, first_name, last_name, phone, email, role_id, role_code, enrollment_type, mrn, hospital_unit, bed_number, acuity_level, code_status, admission_date, enrollment_notes)
    VALUES (
        v_patient5_id,
        v_tenant_id,
        'William', 'Johnson',
        '+15551000005', 'demo.patient5@methodist.example',
        19, 1, 'hospital',
        'MRN-2024-00005', 'MS-4N', '4N-401A',
        '3-Moderate', 'Full Code',
        CURRENT_DATE - INTERVAL '4 days',
        'DEMO: COPD exacerbation on BiPAP. Target discharge tomorrow.'
    )
    ON CONFLICT (user_id) DO UPDATE SET acuity_level = '3-Moderate';

    -- Patient 6: Moderate - DKA
    INSERT INTO profiles (user_id, tenant_id, first_name, last_name, phone, email, role_id, role_code, enrollment_type, mrn, hospital_unit, bed_number, acuity_level, code_status, admission_date, enrollment_notes)
    VALUES (
        v_patient6_id,
        v_tenant_id,
        'Maria', 'Garcia',
        '+15551000006', 'demo.patient6@methodist.example',
        19, 1, 'hospital',
        'MRN-2024-00006', 'MS-4N', '4N-402A',
        '3-Moderate', 'Full Code',
        CURRENT_DATE - INTERVAL '2 days',
        'DEMO: DKA resolving. Transitioning to subQ insulin.'
    )
    ON CONFLICT (user_id) DO UPDATE SET acuity_level = '3-Moderate';

    -- Patient 7: Moderate - Post-op Hip
    INSERT INTO profiles (user_id, tenant_id, first_name, last_name, phone, email, role_id, role_code, enrollment_type, mrn, hospital_unit, bed_number, acuity_level, code_status, admission_date, enrollment_notes)
    VALUES (
        v_patient7_id,
        v_tenant_id,
        'Dorothy', 'Thompson',
        '+15551000007', 'demo.patient7@methodist.example',
        19, 1, 'hospital',
        'MRN-2024-00007', 'MS-4N', '4N-403B',
        '4-Low', 'Full Code',
        CURRENT_DATE - INTERVAL '1 day',
        'DEMO: POD1 R hip arthroplasty. PT eval today.'
    )
    ON CONFLICT (user_id) DO UPDATE SET acuity_level = '4-Low';

    -- Patient 8: Low - Pneumonia improving
    INSERT INTO profiles (user_id, tenant_id, first_name, last_name, phone, email, role_id, role_code, enrollment_type, mrn, hospital_unit, bed_number, acuity_level, code_status, admission_date, enrollment_notes)
    VALUES (
        v_patient8_id,
        v_tenant_id,
        'Thomas', 'Anderson',
        '+15551000008', 'demo.patient8@methodist.example',
        19, 1, 'hospital',
        'MRN-2024-00008', 'MS-4N', '4N-404A',
        '4-Low', 'Full Code',
        CURRENT_DATE - INTERVAL '5 days',
        'DEMO: CAP improving. Discharge planning in progress.'
    )
    ON CONFLICT (user_id) DO UPDATE SET acuity_level = '4-Low';

    -- Patient 9: Critical - ARDS
    INSERT INTO profiles (user_id, tenant_id, first_name, last_name, phone, email, role_id, role_code, enrollment_type, mrn, hospital_unit, bed_number, acuity_level, code_status, admission_date, enrollment_notes)
    VALUES (
        v_patient9_id,
        v_tenant_id,
        'Linda', 'Martinez',
        '+15551000009', 'demo.patient9@methodist.example',
        19, 1, 'hospital',
        'MRN-2024-00009', 'ICU-A', 'ICU-04B',
        '1-Critical', 'Full Code',
        CURRENT_DATE - INTERVAL '7 days',
        'DEMO: ARDS on ventilator. Prone positioning. FiO2 60%.'
    )
    ON CONFLICT (user_id) DO UPDATE SET acuity_level = '1-Critical';

    -- Patient 10: High - AKI
    INSERT INTO profiles (user_id, tenant_id, first_name, last_name, phone, email, role_id, role_code, enrollment_type, mrn, hospital_unit, bed_number, acuity_level, code_status, admission_date, enrollment_notes)
    VALUES (
        v_patient10_id,
        v_tenant_id,
        'Richard', 'Brown',
        '+15551000010', 'demo.patient10@methodist.example',
        19, 1, 'hospital',
        'MRN-2024-00010', 'SDU-2', 'SDU-201A',
        '2-High', 'Full Code',
        CURRENT_DATE - INTERVAL '3 days',
        'DEMO: AKI on CKD. Nephrology consult. HD discussed.'
    )
    ON CONFLICT (user_id) DO UPDATE SET acuity_level = '2-High';

    -- Patient 11: Moderate - GI Bleed
    INSERT INTO profiles (user_id, tenant_id, first_name, last_name, phone, email, role_id, role_code, enrollment_type, mrn, hospital_unit, bed_number, acuity_level, code_status, admission_date, enrollment_notes)
    VALUES (
        v_patient11_id,
        v_tenant_id,
        'Barbara', 'Davis',
        '+15551000011', 'demo.patient11@methodist.example',
        19, 1, 'hospital',
        'MRN-2024-00011', 'TELE-3', 'T3-302B',
        '3-Moderate', 'Full Code',
        CURRENT_DATE - INTERVAL '2 days',
        'DEMO: Upper GI bleed s/p EGD with banding. Hgb stable.'
    )
    ON CONFLICT (user_id) DO UPDATE SET acuity_level = '3-Moderate';

    -- Patient 12: High - AFib RVR
    INSERT INTO profiles (user_id, tenant_id, first_name, last_name, phone, email, role_id, role_code, enrollment_type, mrn, hospital_unit, bed_number, acuity_level, code_status, admission_date, enrollment_notes)
    VALUES (
        v_patient12_id,
        v_tenant_id,
        'Charles', 'Wilson',
        '+15551000012', 'demo.patient12@methodist.example',
        19, 1, 'hospital',
        'MRN-2024-00012', 'TELE-3', 'T3-303A',
        '2-High', 'Full Code',
        CURRENT_DATE - INTERVAL '1 day',
        'DEMO: New onset AFib with RVR. On diltiazem drip.'
    )
    ON CONFLICT (user_id) DO UPDATE SET acuity_level = '2-High';

    -- ============================================
    -- DEMO STAFF (Nurses & Physicians)
    -- ============================================

    -- Nurses (role_id = 8 = nurse, role_code = 3 = staff)
    INSERT INTO profiles (user_id, tenant_id, first_name, last_name, phone, email, role_id, role_code, enrollment_type)
    VALUES
        (v_nurse1_id, v_tenant_id, 'Sarah', 'Mitchell', '+15552000001', 'sarah.mitchell@methodist.example', 8, 3, 'app'),
        (v_nurse2_id, v_tenant_id, 'Jennifer', 'Lopez', '+15552000002', 'jennifer.lopez@methodist.example', 8, 3, 'app'),
        (v_nurse3_id, v_tenant_id, 'Michael', 'Taylor', '+15552000003', 'michael.taylor@methodist.example', 8, 3, 'app'),
        (v_nurse4_id, v_tenant_id, 'Amanda', 'Rodriguez', '+15552000004', 'amanda.rodriguez@methodist.example', 8, 3, 'app'),
        (v_nurse5_id, v_tenant_id, 'David', 'Kim', '+15552000005', 'david.kim@methodist.example', 8, 3, 'app'),
        (v_nurse6_id, v_tenant_id, 'Jessica', 'Patel', '+15552000006', 'jessica.patel@methodist.example', 8, 3, 'app')
    ON CONFLICT (user_id) DO UPDATE SET first_name = EXCLUDED.first_name;

    -- Physicians (role_id = 7 = physician, role_code = 7)
    INSERT INTO profiles (user_id, tenant_id, first_name, last_name, phone, email, role_id, role_code, enrollment_type)
    VALUES
        (v_dr1_id, v_tenant_id, 'Dr. Emily', 'Nakamura', '+15553000001', 'dr.nakamura@methodist.example', 7, 7, 'app'),
        (v_dr2_id, v_tenant_id, 'Dr. James', 'Okonkwo', '+15553000002', 'dr.okonkwo@methodist.example', 7, 7, 'app'),
        (v_dr3_id, v_tenant_id, 'Dr. Maria', 'Sanchez', '+15553000003', 'dr.sanchez@methodist.example', 7, 7, 'app'),
        (v_dr4_id, v_tenant_id, 'Dr. Robert', 'Park', '+15553000004', 'dr.park@methodist.example', 7, 7, 'app')
    ON CONFLICT (user_id) DO UPDATE SET first_name = EXCLUDED.first_name;

    -- ============================================
    -- SHIFT HANDOFF RISK SCORES
    -- Note: Skipped for now - the shift_handoff_risk_scores table has FK to auth.users
    -- but hospital patients (enrollment_type='hospital') don't have auth.users records.
    -- This data would need to use app-enrolled patients with auth records.
    -- ============================================
    RAISE NOTICE 'Skipping shift_handoff_risk_scores - requires auth.users FK';

    -- ============================================
    -- CLINICAL ALERTS (Guardian Alerts)
    -- Note: guardian_alerts table doesn't have tenant_id column
    -- ============================================

    INSERT INTO guardian_alerts (
        id, created_at, severity, category, title, description,
        affected_component, status, actions, metadata
    ) VALUES
    -- Critical: Sepsis patient deteriorating
    (
        'alert-demo-001',
        NOW() - INTERVAL '15 minutes',
        'critical', 'system_health',
        'SEPSIS ALERT: Patient Morrison - Lactate Rising',
        'James Morrison (ICU-01A): Lactate increased from 3.8 to 4.2. MAP 62.',
        'patient-monitoring', 'pending',
        '[{"id": "view", "label": "View Patient", "type": "link"}]'::jsonb,
        ('{"patient_id": "' || v_patient1_id || '", "mrn": "MRN-2024-00001"}')::jsonb
    ),
    -- Critical: Stroke patient neuro change
    (
        'alert-demo-002',
        NOW() - INTERVAL '8 minutes',
        'critical', 'system_health',
        'NEURO ALERT: Patient Williams - NIHSS Change',
        'Patricia Williams (ICU-03A): NIHSS increased from 8 to 12. Stat CT ordered.',
        'patient-monitoring', 'acknowledged',
        '[{"id": "view", "label": "View Patient", "type": "link"}]'::jsonb,
        ('{"patient_id": "' || v_patient4_id || '", "mrn": "MRN-2024-00004"}')::jsonb
    ),
    -- Warning: AFib patient rate
    (
        'alert-demo-003',
        NOW() - INTERVAL '25 minutes',
        'warning', 'system_health',
        'CARDIAC ALERT: Patient Wilson - HR 142',
        'Charles Wilson (T3-303A): Heart rate increased to 142 on diltiazem drip.',
        'patient-monitoring', 'pending',
        '[{"id": "view", "label": "View Patient", "type": "link"}]'::jsonb,
        ('{"patient_id": "' || v_patient12_id || '", "mrn": "MRN-2024-00012"}')::jsonb
    ),
    -- Info: Discharge ready
    (
        'alert-demo-004',
        NOW() - INTERVAL '2 hours',
        'info', 'system_health',
        'DISCHARGE READY: Patient Anderson',
        'Thomas Anderson (4N-404A): Met all discharge criteria. Target 14:00.',
        'discharge-planning', 'pending',
        '[{"id": "discharge", "label": "Process Discharge", "type": "action"}]'::jsonb,
        ('{"patient_id": "' || v_patient8_id || '", "mrn": "MRN-2024-00008"}')::jsonb
    ),
    -- Warning: Staff burnout alert
    (
        'alert-demo-005',
        NOW() - INTERVAL '4 hours',
        'warning', 'system_health',
        'STAFF WELLNESS: Nurse Taylor - Burnout Risk',
        'Michael Taylor has reported high stress for 3 consecutive days.',
        'staff-wellness', 'acknowledged',
        '[{"id": "support", "label": "Offer Support", "type": "action"}]'::jsonb,
        ('{"staff_id": "' || v_nurse3_id || '"}')::jsonb
    )
    ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

    -- ============================================
    -- PROVIDER BURNOUT ASSESSMENTS (Nurse Burnout Tracking)
    -- Note: Skipped - table requires fhir_practitioners.id and auth.users.id FKs
    -- Demo nurses/physicians don't have these records
    -- ============================================
    RAISE NOTICE 'Skipping provider_burnout_assessments - requires fhir_practitioners and auth.users FKs';

    RAISE NOTICE 'Methodist demo data seeded successfully!';
    RAISE NOTICE 'Patients: 12, Nurses: 6, Physicians: 4';
    RAISE NOTICE 'Hospital units: 5, Beds: 78';
    RAISE NOTICE 'Handoff risk scores: 8, Clinical alerts: 5';
    RAISE NOTICE 'Burnout assessments: 10';

END $$;

-- Create reset function for demo cleanup
CREATE OR REPLACE FUNCTION reset_methodist_demo()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Clean up demo guardian alerts
    DELETE FROM guardian_alerts WHERE id LIKE 'alert-demo%';

    -- Clean up demo shift handoff scores
    DELETE FROM shift_handoff_risk_scores WHERE patient_id::text LIKE 'b1000000%';

    -- Clean up demo burnout assessments
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'provider_burnout_assessments') THEN
        DELETE FROM provider_burnout_assessments WHERE provider_id::text LIKE 'c1000000%' OR provider_id::text LIKE 'e1000000%';
    END IF;

    -- Clean up demo beds (can't delete directly due to FK constraints)
    -- DELETE FROM beds WHERE tenant_id = '2b902657-6a20-4435-a78a-576f397517ca' AND room_number LIKE 'ICU-%';

    -- Clean up demo profiles
    DELETE FROM profiles WHERE user_id::text LIKE 'b1000000%' OR user_id::text LIKE 'c1000000%' OR user_id::text LIKE 'e1000000%';

    RAISE NOTICE 'Methodist demo data reset complete';
END $$;
