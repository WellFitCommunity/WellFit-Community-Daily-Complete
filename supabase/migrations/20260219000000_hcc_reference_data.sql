-- HCC (Hierarchical Condition Category) Reference Data
-- Supports HCC opportunity detection for Medicare Advantage risk adjustment.
-- CMS-HCC V28 model categories, ICD-10 crosswalk, and hierarchy suppressions.
--
-- Copyright (c) 2025-2026 Envision Virtual Edge Group LLC. All rights reserved.

BEGIN;

-- =============================================================================
-- 1. HCC Categories — CMS-HCC V28 definitions with RAF coefficients
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.hcc_categories (
  hcc_code TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  coefficient NUMERIC(6,3) NOT NULL DEFAULT 0.000,
  model_version TEXT NOT NULL DEFAULT 'V28',
  payment_year INTEGER NOT NULL DEFAULT 2026,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hcc_categories_active ON public.hcc_categories(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_hcc_categories_payment_year ON public.hcc_categories(payment_year);

ALTER TABLE public.hcc_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hcc_categories_read" ON public.hcc_categories;
CREATE POLICY "hcc_categories_read" ON public.hcc_categories
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "hcc_categories_admin_write" ON public.hcc_categories;
CREATE POLICY "hcc_categories_admin_write" ON public.hcc_categories
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- =============================================================================
-- 2. ICD-10 to HCC Mappings — Crosswalk from diagnosis codes to HCC categories
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.icd10_hcc_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  icd10_code TEXT NOT NULL,
  hcc_code TEXT NOT NULL REFERENCES public.hcc_categories(hcc_code) ON DELETE CASCADE,
  payment_year INTEGER NOT NULL DEFAULT 2026,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(icd10_code, hcc_code, payment_year)
);

CREATE INDEX IF NOT EXISTS idx_icd10_hcc_mappings_icd10 ON public.icd10_hcc_mappings(icd10_code);
CREATE INDEX IF NOT EXISTS idx_icd10_hcc_mappings_hcc ON public.icd10_hcc_mappings(hcc_code);
CREATE INDEX IF NOT EXISTS idx_icd10_hcc_mappings_year ON public.icd10_hcc_mappings(payment_year);

ALTER TABLE public.icd10_hcc_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "icd10_hcc_mappings_read" ON public.icd10_hcc_mappings;
CREATE POLICY "icd10_hcc_mappings_read" ON public.icd10_hcc_mappings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "icd10_hcc_mappings_admin_write" ON public.icd10_hcc_mappings;
CREATE POLICY "icd10_hcc_mappings_admin_write" ON public.icd10_hcc_mappings
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- =============================================================================
-- 3. HCC Hierarchies — Suppression rules (higher HCC suppresses lower)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.hcc_hierarchies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  higher_hcc TEXT NOT NULL REFERENCES public.hcc_categories(hcc_code) ON DELETE CASCADE,
  suppressed_hcc TEXT NOT NULL REFERENCES public.hcc_categories(hcc_code) ON DELETE CASCADE,
  model_version TEXT NOT NULL DEFAULT 'V28',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(higher_hcc, suppressed_hcc, model_version)
);

CREATE INDEX IF NOT EXISTS idx_hcc_hierarchies_higher ON public.hcc_hierarchies(higher_hcc);
CREATE INDEX IF NOT EXISTS idx_hcc_hierarchies_suppressed ON public.hcc_hierarchies(suppressed_hcc);

ALTER TABLE public.hcc_hierarchies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hcc_hierarchies_read" ON public.hcc_hierarchies;
CREATE POLICY "hcc_hierarchies_read" ON public.hcc_hierarchies
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "hcc_hierarchies_admin_write" ON public.hcc_hierarchies;
CREATE POLICY "hcc_hierarchies_admin_write" ON public.hcc_hierarchies
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );

-- =============================================================================
-- 4. Seed Data — High-value HCC categories (CMS-HCC V28 2026)
-- =============================================================================

-- Diabetes
INSERT INTO public.hcc_categories (hcc_code, description, coefficient) VALUES
  ('HCC37', 'Diabetes with Acute Complications', 0.368),
  ('HCC38', 'Diabetes with Chronic Complications', 0.318)
ON CONFLICT (hcc_code) DO NOTHING;

-- Heart Failure
INSERT INTO public.hcc_categories (hcc_code, description, coefficient) VALUES
  ('HCC85', 'Congestive Heart Failure', 0.368),
  ('HCC86', 'Acute Myocardial Infarction', 0.262)
ON CONFLICT (hcc_code) DO NOTHING;

-- COPD / Lung Disease
INSERT INTO public.hcc_categories (hcc_code, description, coefficient) VALUES
  ('HCC111', 'Chronic Obstructive Pulmonary Disease', 0.335),
  ('HCC112', 'Fibrosis of Lung and Other Chronic Lung Disorders', 0.279)
ON CONFLICT (hcc_code) DO NOTHING;

-- Chronic Kidney Disease
INSERT INTO public.hcc_categories (hcc_code, description, coefficient) VALUES
  ('HCC326', 'Chronic Kidney Disease, Stage 5', 0.289),
  ('HCC327', 'Chronic Kidney Disease, Stage 4', 0.237),
  ('HCC328', 'Chronic Kidney Disease, Stage 3', 0.069),
  ('HCC329', 'Chronic Kidney Disease, Stage 1-2 or Unspecified', 0.069)
ON CONFLICT (hcc_code) DO NOTHING;

-- Vascular Disease
INSERT INTO public.hcc_categories (hcc_code, description, coefficient) VALUES
  ('HCC238', 'Specified Heart Arrhythmias', 0.273),
  ('HCC263', 'Atherosclerosis of Arteries of the Extremities', 0.288)
ON CONFLICT (hcc_code) DO NOTHING;

-- Mental Health
INSERT INTO public.hcc_categories (hcc_code, description, coefficient) VALUES
  ('HCC155', 'Major Depression, Moderate or Severe, without Psychosis', 0.309)
ON CONFLICT (hcc_code) DO NOTHING;

-- Dementia
INSERT INTO public.hcc_categories (hcc_code, description, coefficient) VALUES
  ('HCC51', 'Dementia with Complications', 0.529),
  ('HCC52', 'Dementia without Complication', 0.357)
ON CONFLICT (hcc_code) DO NOTHING;

-- Obesity
INSERT INTO public.hcc_categories (hcc_code, description, coefficient) VALUES
  ('HCC48', 'Morbid Obesity', 0.250)
ON CONFLICT (hcc_code) DO NOTHING;

-- Parkinson's
INSERT INTO public.hcc_categories (hcc_code, description, coefficient) VALUES
  ('HCC78', 'Parkinson''s Disease', 0.606)
ON CONFLICT (hcc_code) DO NOTHING;

-- Stroke
INSERT INTO public.hcc_categories (hcc_code, description, coefficient) VALUES
  ('HCC100', 'Ischemic or Unspecified Stroke', 0.262),
  ('HCC101', 'Cerebral Hemorrhage', 0.344)
ON CONFLICT (hcc_code) DO NOTHING;

-- Rheumatoid Arthritis
INSERT INTO public.hcc_categories (hcc_code, description, coefficient) VALUES
  ('HCC40', 'Rheumatoid Arthritis and Inflammatory Connective Tissue Disease', 0.370)
ON CONFLICT (hcc_code) DO NOTHING;

-- Peripheral Vascular Disease
INSERT INTO public.hcc_categories (hcc_code, description, coefficient) VALUES
  ('HCC106', 'Peripheral Vascular Disease', 0.288)
ON CONFLICT (hcc_code) DO NOTHING;

-- Seizure Disorders
INSERT INTO public.hcc_categories (hcc_code, description, coefficient) VALUES
  ('HCC79', 'Seizure Disorders and Convulsions', 0.167)
ON CONFLICT (hcc_code) DO NOTHING;

-- Liver Disease
INSERT INTO public.hcc_categories (hcc_code, description, coefficient) VALUES
  ('HCC35', 'End-Stage Liver Disease', 0.950),
  ('HCC36', 'Cirrhosis of Liver', 0.390)
ON CONFLICT (hcc_code) DO NOTHING;

-- Cancer
INSERT INTO public.hcc_categories (hcc_code, description, coefficient) VALUES
  ('HCC17', 'Cancer, Metastatic to Lung, Liver, Brain', 2.484),
  ('HCC18', 'Cancer, Metastatic to Other Locations', 0.809),
  ('HCC22', 'Lung, Upper Digestive Tract, and Other Severe Cancers', 0.486)
ON CONFLICT (hcc_code) DO NOTHING;

-- HIV/AIDS
INSERT INTO public.hcc_categories (hcc_code, description, coefficient) VALUES
  ('HCC1', 'HIV/AIDS', 0.293)
ON CONFLICT (hcc_code) DO NOTHING;

-- =============================================================================
-- 5. Seed Data — ICD-10 to HCC mappings (common diagnoses)
-- =============================================================================

-- Diabetes mappings
INSERT INTO public.icd10_hcc_mappings (icd10_code, hcc_code) VALUES
  ('E11.65', 'HCC37'),  -- Type 2 diabetes with hyperglycemia
  ('E11.69', 'HCC37'),  -- Type 2 diabetes with other specified complication
  ('E11.21', 'HCC37'),  -- Type 2 diabetes with diabetic nephropathy
  ('E11.40', 'HCC38'),  -- Type 2 diabetes with diabetic neuropathy, unspecified
  ('E11.41', 'HCC38'),  -- Type 2 diabetes with diabetic mononeuropathy
  ('E11.42', 'HCC38'),  -- Type 2 diabetes with diabetic polyneuropathy
  ('E11.51', 'HCC38'),  -- Type 2 diabetes with diabetic peripheral angiopathy
  ('E11.52', 'HCC38')   -- Type 2 diabetes with diabetic peripheral angiopathy with gangrene
ON CONFLICT DO NOTHING;

-- Heart failure mappings
INSERT INTO public.icd10_hcc_mappings (icd10_code, hcc_code) VALUES
  ('I50.20', 'HCC85'),  -- Unspecified systolic heart failure
  ('I50.22', 'HCC85'),  -- Chronic systolic heart failure
  ('I50.30', 'HCC85'),  -- Unspecified diastolic heart failure
  ('I50.32', 'HCC85'),  -- Chronic diastolic heart failure
  ('I50.42', 'HCC85'),  -- Chronic combined systolic and diastolic heart failure
  ('I21.0', 'HCC86'),   -- ST elevation MI of anterior wall
  ('I21.11', 'HCC86'),  -- ST elevation MI of inferior wall
  ('I21.4', 'HCC86')    -- Non-ST elevation MI
ON CONFLICT DO NOTHING;

-- COPD mappings
INSERT INTO public.icd10_hcc_mappings (icd10_code, hcc_code) VALUES
  ('J44.0', 'HCC111'),  -- COPD with acute lower respiratory infection
  ('J44.1', 'HCC111'),  -- COPD with acute exacerbation
  ('J44.9', 'HCC111'),  -- COPD, unspecified
  ('J84.10', 'HCC112'), -- Pulmonary fibrosis, unspecified
  ('J84.112', 'HCC112') -- Idiopathic pulmonary fibrosis
ON CONFLICT DO NOTHING;

-- CKD mappings
INSERT INTO public.icd10_hcc_mappings (icd10_code, hcc_code) VALUES
  ('N18.5', 'HCC326'),  -- CKD stage 5
  ('N18.4', 'HCC327'),  -- CKD stage 4
  ('N18.3', 'HCC328'),  -- CKD stage 3
  ('N18.30', 'HCC328'), -- CKD stage 3 unspecified
  ('N18.31', 'HCC328'), -- CKD stage 3a
  ('N18.32', 'HCC328'), -- CKD stage 3b
  ('N18.1', 'HCC329'),  -- CKD stage 1
  ('N18.2', 'HCC329')   -- CKD stage 2
ON CONFLICT DO NOTHING;

-- Vascular disease mappings
INSERT INTO public.icd10_hcc_mappings (icd10_code, hcc_code) VALUES
  ('I48.0', 'HCC238'),  -- Paroxysmal atrial fibrillation
  ('I48.1', 'HCC238'),  -- Persistent atrial fibrillation
  ('I48.2', 'HCC238'),  -- Chronic atrial fibrillation
  ('I48.91', 'HCC238'), -- Unspecified atrial fibrillation
  ('I70.201', 'HCC263'),-- Atherosclerosis of native arteries of extremities, unspec
  ('I70.211', 'HCC263') -- Atherosclerosis of native arteries of extremities with intermittent claudication
ON CONFLICT DO NOTHING;

-- Depression
INSERT INTO public.icd10_hcc_mappings (icd10_code, hcc_code) VALUES
  ('F32.1', 'HCC155'),  -- Major depressive disorder, single episode, moderate
  ('F32.2', 'HCC155'),  -- Major depressive disorder, single episode, severe
  ('F33.1', 'HCC155'),  -- Major depressive disorder, recurrent, moderate
  ('F33.2', 'HCC155')   -- Major depressive disorder, recurrent, severe
ON CONFLICT DO NOTHING;

-- Dementia
INSERT INTO public.icd10_hcc_mappings (icd10_code, hcc_code) VALUES
  ('F01.50', 'HCC51'),  -- Vascular dementia without behavioral disturbance
  ('F01.51', 'HCC51'),  -- Vascular dementia with behavioral disturbance
  ('F03.90', 'HCC52'),  -- Unspecified dementia without behavioral disturbance
  ('G30.9', 'HCC52')    -- Alzheimer's disease, unspecified
ON CONFLICT DO NOTHING;

-- Obesity
INSERT INTO public.icd10_hcc_mappings (icd10_code, hcc_code) VALUES
  ('E66.01', 'HCC48')   -- Morbid (severe) obesity due to excess calories
ON CONFLICT DO NOTHING;

-- Parkinson's
INSERT INTO public.icd10_hcc_mappings (icd10_code, hcc_code) VALUES
  ('G20', 'HCC78')      -- Parkinson's disease
ON CONFLICT DO NOTHING;

-- Stroke
INSERT INTO public.icd10_hcc_mappings (icd10_code, hcc_code) VALUES
  ('I63.9', 'HCC100'),  -- Cerebral infarction, unspecified
  ('I63.50', 'HCC100'), -- Cerebral infarction due to unspecified occlusion
  ('I61.9', 'HCC101'),  -- Nontraumatic intracerebral hemorrhage, unspecified
  ('I61.0', 'HCC101')   -- Nontraumatic intracerebral hemorrhage in hemisphere, subcortical
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 6. Seed Data — Hierarchy suppressions
-- =============================================================================

-- Higher-severity diabetes suppresses lower
INSERT INTO public.hcc_hierarchies (higher_hcc, suppressed_hcc) VALUES
  ('HCC37', 'HCC38')    -- Acute complications suppress chronic complications
ON CONFLICT DO NOTHING;

-- Dementia with complications suppresses without
INSERT INTO public.hcc_hierarchies (higher_hcc, suppressed_hcc) VALUES
  ('HCC51', 'HCC52')    -- Dementia with complications suppresses without
ON CONFLICT DO NOTHING;

-- CKD hierarchy
INSERT INTO public.hcc_hierarchies (higher_hcc, suppressed_hcc) VALUES
  ('HCC326', 'HCC327'), -- Stage 5 suppresses Stage 4
  ('HCC326', 'HCC328'), -- Stage 5 suppresses Stage 3
  ('HCC326', 'HCC329'), -- Stage 5 suppresses Stage 1-2
  ('HCC327', 'HCC328'), -- Stage 4 suppresses Stage 3
  ('HCC327', 'HCC329'), -- Stage 4 suppresses Stage 1-2
  ('HCC328', 'HCC329')  -- Stage 3 suppresses Stage 1-2
ON CONFLICT DO NOTHING;

-- Cancer hierarchy
INSERT INTO public.hcc_hierarchies (higher_hcc, suppressed_hcc) VALUES
  ('HCC17', 'HCC18'),   -- Metastatic to lung/liver/brain suppresses other locations
  ('HCC17', 'HCC22'),   -- Metastatic to lung/liver/brain suppresses severe cancers
  ('HCC18', 'HCC22')    -- Metastatic other suppresses severe cancers
ON CONFLICT DO NOTHING;

-- Liver disease hierarchy
INSERT INTO public.hcc_hierarchies (higher_hcc, suppressed_hcc) VALUES
  ('HCC35', 'HCC36')    -- End-stage liver suppresses cirrhosis
ON CONFLICT DO NOTHING;

-- Stroke hierarchy
INSERT INTO public.hcc_hierarchies (higher_hcc, suppressed_hcc) VALUES
  ('HCC101', 'HCC100')  -- Cerebral hemorrhage suppresses ischemic stroke
ON CONFLICT DO NOTHING;

COMMIT;
