-- Migration: medical_synonyms table + seed data
-- Purpose: Map common medical terms to canonical terms for search expansion
-- Tracker: docs/trackers/chatgpt-audit-gaps-tracker.md (S3-1)

CREATE TABLE IF NOT EXISTS public.medical_synonyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_term TEXT NOT NULL,
  synonym TEXT NOT NULL,
  code_system TEXT CHECK (code_system IN ('ICD-10', 'CPT', 'SNOMED', 'HCPCS', 'RxNorm', NULL)),
  code TEXT,
  category TEXT NOT NULL CHECK (category IN ('condition', 'procedure', 'medication', 'symptom', 'anatomy')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent duplicate synonym→canonical pairs
  UNIQUE (canonical_term, synonym)
);

-- RLS: public read for all authenticated users (search expansion is non-PHI)
ALTER TABLE public.medical_synonyms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read medical synonyms"
  ON public.medical_synonyms FOR SELECT
  USING (auth.role() = 'authenticated');

-- Full-text search index on synonym and canonical_term
CREATE INDEX IF NOT EXISTS idx_medical_synonyms_synonym ON public.medical_synonyms USING gin(to_tsvector('english', synonym));
CREATE INDEX IF NOT EXISTS idx_medical_synonyms_canonical ON public.medical_synonyms USING gin(to_tsvector('english', canonical_term));
CREATE INDEX IF NOT EXISTS idx_medical_synonyms_category ON public.medical_synonyms(category);
CREATE INDEX IF NOT EXISTS idx_medical_synonyms_code ON public.medical_synonyms(code) WHERE code IS NOT NULL;

COMMENT ON TABLE public.medical_synonyms IS
  'Maps common/lay medical terms to canonical clinical terms. Used by GlobalSearchBar to expand search queries (e.g., "heart attack" → "myocardial infarction").';

-- =============================================================================
-- Seed data: 80+ high-value clinical synonym mappings
-- =============================================================================

INSERT INTO public.medical_synonyms (canonical_term, synonym, code_system, code, category) VALUES
-- Cardiovascular conditions
('myocardial infarction', 'heart attack', 'ICD-10', 'I21', 'condition'),
('myocardial infarction', 'MI', 'ICD-10', 'I21', 'condition'),
('hypertension', 'high blood pressure', 'ICD-10', 'I10', 'condition'),
('hypertension', 'HTN', 'ICD-10', 'I10', 'condition'),
('hypertension', 'elevated blood pressure', 'ICD-10', 'I10', 'condition'),
('congestive heart failure', 'CHF', 'ICD-10', 'I50', 'condition'),
('congestive heart failure', 'heart failure', 'ICD-10', 'I50', 'condition'),
('congestive heart failure', 'weak heart', 'ICD-10', 'I50', 'condition'),
('atrial fibrillation', 'AFib', 'ICD-10', 'I48', 'condition'),
('atrial fibrillation', 'A-fib', 'ICD-10', 'I48', 'condition'),
('atrial fibrillation', 'irregular heartbeat', 'ICD-10', 'I48', 'condition'),
('cerebrovascular accident', 'stroke', 'ICD-10', 'I63', 'condition'),
('cerebrovascular accident', 'CVA', 'ICD-10', 'I63', 'condition'),
('cerebrovascular accident', 'brain attack', 'ICD-10', 'I63', 'condition'),
('deep vein thrombosis', 'DVT', 'ICD-10', 'I82', 'condition'),
('deep vein thrombosis', 'blood clot in leg', 'ICD-10', 'I82', 'condition'),
('pulmonary embolism', 'PE', 'ICD-10', 'I26', 'condition'),
('pulmonary embolism', 'blood clot in lung', 'ICD-10', 'I26', 'condition'),

-- Endocrine/metabolic
('diabetes mellitus type 2', 'type 2 diabetes', 'ICD-10', 'E11', 'condition'),
('diabetes mellitus type 2', 'T2DM', 'ICD-10', 'E11', 'condition'),
('diabetes mellitus type 2', 'adult onset diabetes', 'ICD-10', 'E11', 'condition'),
('diabetes mellitus type 2', 'sugar diabetes', 'ICD-10', 'E11', 'condition'),
('diabetes mellitus type 1', 'type 1 diabetes', 'ICD-10', 'E10', 'condition'),
('diabetes mellitus type 1', 'T1DM', 'ICD-10', 'E10', 'condition'),
('diabetes mellitus type 1', 'juvenile diabetes', 'ICD-10', 'E10', 'condition'),
('hyperlipidemia', 'high cholesterol', 'ICD-10', 'E78', 'condition'),
('hypothyroidism', 'underactive thyroid', 'ICD-10', 'E03', 'condition'),
('hyperthyroidism', 'overactive thyroid', 'ICD-10', 'E05', 'condition'),
('obesity', 'overweight', 'ICD-10', 'E66', 'condition'),

-- Respiratory
('chronic obstructive pulmonary disease', 'COPD', 'ICD-10', 'J44', 'condition'),
('chronic obstructive pulmonary disease', 'emphysema', 'ICD-10', 'J44', 'condition'),
('chronic obstructive pulmonary disease', 'chronic bronchitis', 'ICD-10', 'J44', 'condition'),
('asthma', 'reactive airway disease', 'ICD-10', 'J45', 'condition'),
('pneumonia', 'lung infection', 'ICD-10', 'J18', 'condition'),

-- Musculoskeletal
('osteoarthritis', 'arthritis', 'ICD-10', 'M19', 'condition'),
('osteoarthritis', 'OA', 'ICD-10', 'M19', 'condition'),
('osteoarthritis', 'degenerative joint disease', 'ICD-10', 'M19', 'condition'),
('osteoarthritis', 'DJD', 'ICD-10', 'M19', 'condition'),
('osteoporosis', 'brittle bones', 'ICD-10', 'M81', 'condition'),
('rheumatoid arthritis', 'RA', 'ICD-10', 'M06', 'condition'),
('low back pain', 'lumbago', 'ICD-10', 'M54.5', 'condition'),
('low back pain', 'LBP', 'ICD-10', 'M54.5', 'condition'),

-- Neurological
('alzheimer disease', 'alzheimers', 'ICD-10', 'G30', 'condition'),
('alzheimer disease', 'dementia', 'ICD-10', 'G30', 'condition'),
('parkinson disease', 'parkinsons', 'ICD-10', 'G20', 'condition'),
('epilepsy', 'seizure disorder', 'ICD-10', 'G40', 'condition'),
('migraine', 'severe headache', 'ICD-10', 'G43', 'condition'),
('transient ischemic attack', 'TIA', 'ICD-10', 'G45', 'condition'),
('transient ischemic attack', 'mini stroke', 'ICD-10', 'G45', 'condition'),

-- Renal
('chronic kidney disease', 'CKD', 'ICD-10', 'N18', 'condition'),
('chronic kidney disease', 'kidney failure', 'ICD-10', 'N18', 'condition'),
('chronic kidney disease', 'renal failure', 'ICD-10', 'N18', 'condition'),
('urinary tract infection', 'UTI', 'ICD-10', 'N39.0', 'condition'),
('urinary tract infection', 'bladder infection', 'ICD-10', 'N39.0', 'condition'),

-- GI
('gastroesophageal reflux disease', 'GERD', 'ICD-10', 'K21', 'condition'),
('gastroesophageal reflux disease', 'acid reflux', 'ICD-10', 'K21', 'condition'),
('gastroesophageal reflux disease', 'heartburn', 'ICD-10', 'K21', 'condition'),

-- Mental health
('major depressive disorder', 'depression', 'ICD-10', 'F33', 'condition'),
('major depressive disorder', 'MDD', 'ICD-10', 'F33', 'condition'),
('generalized anxiety disorder', 'anxiety', 'ICD-10', 'F41.1', 'condition'),
('generalized anxiety disorder', 'GAD', 'ICD-10', 'F41.1', 'condition'),
('post traumatic stress disorder', 'PTSD', 'ICD-10', 'F43.1', 'condition'),
('bipolar disorder', 'manic depression', 'ICD-10', 'F31', 'condition'),

-- Common medications (lay name → generic)
('metformin', 'glucophage', 'RxNorm', NULL, 'medication'),
('lisinopril', 'zestril', 'RxNorm', NULL, 'medication'),
('lisinopril', 'prinivil', 'RxNorm', NULL, 'medication'),
('atorvastatin', 'lipitor', 'RxNorm', NULL, 'medication'),
('amlodipine', 'norvasc', 'RxNorm', NULL, 'medication'),
('omeprazole', 'prilosec', 'RxNorm', NULL, 'medication'),
('levothyroxine', 'synthroid', 'RxNorm', NULL, 'medication'),
('warfarin', 'coumadin', 'RxNorm', NULL, 'medication'),
('warfarin', 'blood thinner', 'RxNorm', NULL, 'medication'),
('acetaminophen', 'tylenol', 'RxNorm', NULL, 'medication'),
('ibuprofen', 'advil', 'RxNorm', NULL, 'medication'),
('ibuprofen', 'motrin', 'RxNorm', NULL, 'medication'),
('albuterol', 'ventolin', 'RxNorm', NULL, 'medication'),
('albuterol', 'proventil', 'RxNorm', NULL, 'medication'),
('insulin glargine', 'lantus', 'RxNorm', NULL, 'medication'),
('hydrocodone', 'vicodin', 'RxNorm', NULL, 'medication'),
('losartan', 'cozaar', 'RxNorm', NULL, 'medication'),
('gabapentin', 'neurontin', 'RxNorm', NULL, 'medication'),

-- Common symptoms
('dyspnea', 'shortness of breath', NULL, NULL, 'symptom'),
('dyspnea', 'SOB', NULL, NULL, 'symptom'),
('dyspnea', 'difficulty breathing', NULL, NULL, 'symptom'),
('syncope', 'fainting', NULL, NULL, 'symptom'),
('syncope', 'passing out', NULL, NULL, 'symptom'),
('edema', 'swelling', NULL, NULL, 'symptom'),
('pyrexia', 'fever', NULL, NULL, 'symptom'),
('emesis', 'vomiting', NULL, NULL, 'symptom'),
('cephalgia', 'headache', NULL, NULL, 'symptom'),
('myalgia', 'muscle pain', NULL, NULL, 'symptom'),
('arthralgia', 'joint pain', NULL, NULL, 'symptom'),
('nausea', 'feeling sick', NULL, NULL, 'symptom'),
('vertigo', 'dizziness', NULL, NULL, 'symptom'),
('tachycardia', 'fast heart rate', NULL, NULL, 'symptom'),
('tachycardia', 'rapid heartbeat', NULL, NULL, 'symptom'),
('bradycardia', 'slow heart rate', NULL, NULL, 'symptom')
ON CONFLICT (canonical_term, synonym) DO NOTHING;

-- PostgreSQL function for synonym expansion
CREATE OR REPLACE FUNCTION public.expand_medical_synonyms(p_query TEXT)
RETURNS TABLE (
  term TEXT,
  is_canonical BOOLEAN,
  code_system TEXT,
  code TEXT,
  category TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
BEGIN
  -- Return canonical terms where the query matches a synonym
  RETURN QUERY
  SELECT DISTINCT
    ms.canonical_term AS term,
    true AS is_canonical,
    ms.code_system,
    ms.code,
    ms.category
  FROM public.medical_synonyms ms
  WHERE ms.synonym ILIKE '%' || p_query || '%'
     OR ms.canonical_term ILIKE '%' || p_query || '%';

  -- Also return all synonyms for matched canonical terms
  RETURN QUERY
  SELECT DISTINCT
    ms2.synonym AS term,
    false AS is_canonical,
    ms2.code_system,
    ms2.code,
    ms2.category
  FROM public.medical_synonyms ms2
  WHERE ms2.canonical_term IN (
    SELECT ms3.canonical_term
    FROM public.medical_synonyms ms3
    WHERE ms3.synonym ILIKE '%' || p_query || '%'
       OR ms3.canonical_term ILIKE '%' || p_query || '%'
  )
  AND ms2.synonym NOT ILIKE '%' || p_query || '%';
END;
$$;

COMMENT ON FUNCTION public.expand_medical_synonyms IS
  'Returns canonical terms + all related synonyms for a given search query. Used by GlobalSearchBar to expand medical term searches.';
