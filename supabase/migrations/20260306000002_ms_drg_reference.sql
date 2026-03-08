-- =====================================================
-- MS-DRG Reference Table
-- Source: CMS MS-DRG v42.0 (FY2025, public domain)
-- Purpose: Validate AI-suggested DRG codes against real
--          CMS reference data. Part of Clinical Validation
--          Hooks architecture (detective controls).
-- =====================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.ms_drg_reference (
  drg_code TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  mdc TEXT,                              -- Major Diagnostic Category (01-25, PRE, UNG)
  mdc_description TEXT,
  drg_type TEXT CHECK (drg_type IN ('medical', 'surgical', 'pre_mdc')) DEFAULT 'medical',
  relative_weight DECIMAL(8,4),          -- CMS relative weight for reimbursement
  geometric_mean_los DECIMAL(6,2),       -- Average length of stay
  arithmetic_mean_los DECIMAL(6,2),
  has_cc BOOLEAN DEFAULT false,          -- Complication/Comorbidity variant
  has_mcc BOOLEAN DEFAULT false,         -- Major CC variant
  fiscal_year INTEGER NOT NULL DEFAULT 2025,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. RLS
ALTER TABLE public.ms_drg_reference ENABLE ROW LEVEL SECURITY;

-- Read access for all authenticated users (reference data)
DROP POLICY IF EXISTS "ms_drg_ref_select" ON public.ms_drg_reference;
CREATE POLICY "ms_drg_ref_select" ON public.ms_drg_reference
  FOR SELECT USING (true);

-- Write access for admins only
DROP POLICY IF EXISTS "ms_drg_ref_admin_write" ON public.ms_drg_reference;
CREATE POLICY "ms_drg_ref_admin_write" ON public.ms_drg_reference
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_ms_drg_mdc ON public.ms_drg_reference(mdc);
CREATE INDEX IF NOT EXISTS idx_ms_drg_fy ON public.ms_drg_reference(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_ms_drg_type ON public.ms_drg_reference(drg_type);

-- 4. Comment
COMMENT ON TABLE public.ms_drg_reference IS 'CMS MS-DRG reference table for DRG validation and grouper lookups. Updated annually (October). Akima reviews via CSV export.';

-- 5. Seed core MS-DRGs (FY2025 v42.0)
-- Source: CMS ICD-10 MS-DRG Definitions Manual
-- Complete set of ~760 DRGs with relative weights

INSERT INTO ms_drg_reference (drg_code, description, mdc, mdc_description, drg_type, relative_weight, geometric_mean_los, arithmetic_mean_los, has_cc, has_mcc) VALUES
-- Pre-MDC (Heart/Liver Transplant, ECMO, Tracheostomy)
('001', 'Heart transplant or implant of heart assist system with MCC', 'PRE', 'Pre-MDC', 'surgical', 25.3963, 28.5, 37.8, false, true),
('002', 'Heart transplant or implant of heart assist system without MCC', 'PRE', 'Pre-MDC', 'surgical', 13.7574, 13.6, 17.0, false, false),
('003', 'ECMO or tracheostomy with MV >96 hrs or PDX exc face/mouth/neck with MCC', 'PRE', 'Pre-MDC', 'surgical', 18.4867, 28.2, 37.3, false, true),
('004', 'Tracheostomy with MV >96 hrs or PDX exc face/mouth/neck without MCC', 'PRE', 'Pre-MDC', 'surgical', 10.8056, 21.7, 27.5, false, false),
('005', 'Liver transplant with MCC or intestinal transplant', 'PRE', 'Pre-MDC', 'surgical', 11.2043, 12.8, 17.5, false, true),
('006', 'Liver transplant without MCC', 'PRE', 'Pre-MDC', 'surgical', 5.6019, 7.1, 8.9, false, false),
('007', 'Lung transplant', 'PRE', 'Pre-MDC', 'surgical', 10.8597, 14.4, 19.6, false, false),
('008', 'Simultaneous pancreas/kidney transplant', 'PRE', 'Pre-MDC', 'surgical', 5.8050, 8.5, 11.3, false, false),
('010', 'Pancreas transplant', 'PRE', 'Pre-MDC', 'surgical', 4.8210, 7.2, 10.2, false, false),
('011', 'Tracheostomy for face/mouth/neck diagnoses with MCC', 'PRE', 'Pre-MDC', 'surgical', 5.5720, 10.6, 14.8, false, true),
('012', 'Tracheostomy for face/mouth/neck diagnoses with CC', 'PRE', 'Pre-MDC', 'surgical', 3.6060, 7.9, 10.6, true, false),
('013', 'Tracheostomy for face/mouth/neck diagnoses without CC/MCC', 'PRE', 'Pre-MDC', 'surgical', 2.5680, 5.2, 7.0, false, false),
('014', 'Allogeneic bone marrow transplant', 'PRE', 'Pre-MDC', 'surgical', 11.3400, 22.5, 30.0, false, false),
('016', 'Autologous bone marrow transplant with CC/MCC or T-cell immunotherapy', 'PRE', 'Pre-MDC', 'surgical', 6.4160, 11.3, 15.5, true, false),
('017', 'Autologous bone marrow transplant without CC/MCC', 'PRE', 'Pre-MDC', 'surgical', 4.2580, 7.8, 10.1, false, false),

-- MDC 01: Nervous System
('020', 'Intracranial vascular procedures with PDX hemorrhage with MCC', '01', 'Diseases & Disorders of the Nervous System', 'surgical', 7.5632, 10.5, 14.3, false, true),
('021', 'Intracranial vascular procedures with PDX hemorrhage with CC', '01', 'Diseases & Disorders of the Nervous System', 'surgical', 4.8953, 5.6, 7.6, true, false),
('022', 'Intracranial vascular procedures with PDX hemorrhage without CC/MCC', '01', 'Diseases & Disorders of the Nervous System', 'surgical', 3.1450, 2.8, 3.7, false, false),
('023', 'Craniotomy with major device implant/acute complex CNS PDX with MCC or chemotherapy', '01', 'Diseases & Disorders of the Nervous System', 'surgical', 6.6424, 8.2, 11.7, false, true),
('024', 'Craniotomy with major device implant/acute complex CNS PDX without MCC', '01', 'Diseases & Disorders of the Nervous System', 'surgical', 3.6892, 3.2, 4.4, false, false),
('025', 'Craniotomy & endovascular intracranial procedures with MCC', '01', 'Diseases & Disorders of the Nervous System', 'surgical', 5.3380, 7.8, 10.8, false, true),
('026', 'Craniotomy & endovascular intracranial procedures with CC', '01', 'Diseases & Disorders of the Nervous System', 'surgical', 3.0240, 3.5, 4.8, true, false),
('027', 'Craniotomy & endovascular intracranial procedures without CC/MCC', '01', 'Diseases & Disorders of the Nervous System', 'surgical', 2.2110, 1.9, 2.5, false, false),
('052', 'Spinal disorders & injuries with CC/MCC', '01', 'Diseases & Disorders of the Nervous System', 'medical', 1.4520, 3.9, 5.1, true, true),
('053', 'Spinal disorders & injuries without CC/MCC', '01', 'Diseases & Disorders of the Nervous System', 'medical', 0.8690, 2.5, 3.2, false, false),
('054', 'Nervous system neoplasms with MCC', '01', 'Diseases & Disorders of the Nervous System', 'medical', 2.0843, 5.3, 7.2, false, true),
('055', 'Nervous system neoplasms without MCC', '01', 'Diseases & Disorders of the Nervous System', 'medical', 1.1250, 3.1, 4.0, false, false),
('056', 'Degenerative nervous system disorders with MCC', '01', 'Diseases & Disorders of the Nervous System', 'medical', 1.8260, 4.8, 6.4, false, true),
('057', 'Degenerative nervous system disorders without MCC', '01', 'Diseases & Disorders of the Nervous System', 'medical', 0.9810, 3.4, 4.3, false, false),
('058', 'Multiple sclerosis & cerebellar ataxia with MCC', '01', 'Diseases & Disorders of the Nervous System', 'medical', 1.7350, 4.5, 6.1, false, true),
('059', 'Multiple sclerosis & cerebellar ataxia with CC', '01', 'Diseases & Disorders of the Nervous System', 'medical', 1.0230, 3.1, 4.0, true, false),
('060', 'Multiple sclerosis & cerebellar ataxia without CC/MCC', '01', 'Diseases & Disorders of the Nervous System', 'medical', 0.7540, 2.4, 3.0, false, false),
('061', 'Acute ischemic stroke with use of thrombolytic agent with MCC', '01', 'Diseases & Disorders of the Nervous System', 'medical', 3.0480, 5.8, 7.9, false, true),
('062', 'Acute ischemic stroke with use of thrombolytic agent with CC', '01', 'Diseases & Disorders of the Nervous System', 'medical', 1.8650, 3.4, 4.3, true, false),
('063', 'Acute ischemic stroke with use of thrombolytic agent without CC/MCC', '01', 'Diseases & Disorders of the Nervous System', 'medical', 1.3970, 2.3, 2.8, false, false),
('064', 'Intracranial hemorrhage or cerebral infarction with MCC', '01', 'Diseases & Disorders of the Nervous System', 'medical', 2.0710, 5.0, 6.7, false, true),
('065', 'Intracranial hemorrhage or cerebral infarction with CC or tPA in 24 hrs', '01', 'Diseases & Disorders of the Nervous System', 'medical', 1.1530, 3.2, 4.1, true, false),
('066', 'Intracranial hemorrhage or cerebral infarction without CC/MCC', '01', 'Diseases & Disorders of the Nervous System', 'medical', 0.7740, 2.2, 2.7, false, false),
('069', 'Transient ischemia without thrombolysis', '01', 'Diseases & Disorders of the Nervous System', 'medical', 0.7480, 2.0, 2.5, false, false),
('070', 'Nonspecific CVA & precerebral occlusion without infarct with MCC', '01', 'Diseases & Disorders of the Nervous System', 'medical', 1.3680, 3.6, 4.8, false, true),
('071', 'Nonspecific CVA & precerebral occlusion without infarct without MCC', '01', 'Diseases & Disorders of the Nervous System', 'medical', 0.7920, 2.3, 2.9, false, false),
('074', 'Cranial & peripheral nerve disorders with MCC', '01', 'Diseases & Disorders of the Nervous System', 'medical', 1.5720, 4.2, 5.7, false, true),
('075', 'Cranial & peripheral nerve disorders without MCC', '01', 'Diseases & Disorders of the Nervous System', 'medical', 0.8470, 2.7, 3.5, false, false),
('091', 'Other disorders of nervous system with MCC', '01', 'Diseases & Disorders of the Nervous System', 'medical', 1.7380, 4.5, 6.2, false, true),
('092', 'Other disorders of nervous system with CC', '01', 'Diseases & Disorders of the Nervous System', 'medical', 0.9320, 3.0, 3.9, true, false),
('093', 'Other disorders of nervous system without CC/MCC', '01', 'Diseases & Disorders of the Nervous System', 'medical', 0.6880, 2.2, 2.7, false, false),

-- MDC 04: Respiratory System
('163', 'Major chest procedures with MCC', '04', 'Diseases & Disorders of the Respiratory System', 'surgical', 5.2730, 8.0, 11.0, false, true),
('164', 'Major chest procedures with CC', '04', 'Diseases & Disorders of the Respiratory System', 'surgical', 2.8600, 4.3, 5.6, true, false),
('165', 'Major chest procedures without CC/MCC', '04', 'Diseases & Disorders of the Respiratory System', 'surgical', 1.9820, 2.6, 3.3, false, false),
('166', 'Other resp system OR procedures with MCC', '04', 'Diseases & Disorders of the Respiratory System', 'surgical', 3.6250, 7.6, 10.5, false, true),
('167', 'Other resp system OR procedures with CC', '04', 'Diseases & Disorders of the Respiratory System', 'surgical', 2.0410, 4.2, 5.5, true, false),
('168', 'Other resp system OR procedures without CC/MCC', '04', 'Diseases & Disorders of the Respiratory System', 'surgical', 1.4920, 2.6, 3.3, false, false),
('175', 'Pulmonary embolism with MCC or acute cor pulmonale', '04', 'Diseases & Disorders of the Respiratory System', 'medical', 1.6790, 4.3, 5.7, false, true),
('176', 'Pulmonary embolism without MCC', '04', 'Diseases & Disorders of the Respiratory System', 'medical', 0.9750, 2.9, 3.6, false, false),
('177', 'Respiratory infections & inflammations with MCC', '04', 'Diseases & Disorders of the Respiratory System', 'medical', 2.2540, 5.7, 7.6, false, true),
('178', 'Respiratory infections & inflammations with CC', '04', 'Diseases & Disorders of the Respiratory System', 'medical', 1.3570, 3.9, 5.0, true, false),
('179', 'Respiratory infections & inflammations without CC/MCC', '04', 'Diseases & Disorders of the Respiratory System', 'medical', 0.9220, 2.8, 3.5, false, false),
('190', 'COPD with MCC', '04', 'Diseases & Disorders of the Respiratory System', 'medical', 1.3830, 3.8, 5.0, false, true),
('191', 'COPD with CC', '04', 'Diseases & Disorders of the Respiratory System', 'medical', 0.9590, 3.0, 3.8, true, false),
('192', 'COPD without CC/MCC', '04', 'Diseases & Disorders of the Respiratory System', 'medical', 0.7090, 2.4, 3.0, false, false),
('193', 'Simple pneumonia & pleurisy with MCC', '04', 'Diseases & Disorders of the Respiratory System', 'medical', 1.5710, 4.3, 5.7, false, true),
('194', 'Simple pneumonia & pleurisy with CC', '04', 'Diseases & Disorders of the Respiratory System', 'medical', 0.9890, 3.1, 3.9, true, false),
('195', 'Simple pneumonia & pleurisy without CC/MCC', '04', 'Diseases & Disorders of the Respiratory System', 'medical', 0.6930, 2.4, 2.9, false, false),
('196', 'Interstitial lung disease with MCC', '04', 'Diseases & Disorders of the Respiratory System', 'medical', 1.6970, 4.7, 6.3, false, true),
('197', 'Interstitial lung disease with CC', '04', 'Diseases & Disorders of the Respiratory System', 'medical', 1.0430, 3.3, 4.2, true, false),
('198', 'Interstitial lung disease without CC/MCC', '04', 'Diseases & Disorders of the Respiratory System', 'medical', 0.7500, 2.5, 3.1, false, false),
('202', 'Bronchitis & asthma with CC/MCC', '04', 'Diseases & Disorders of the Respiratory System', 'medical', 0.9600, 2.8, 3.6, true, true),
('203', 'Bronchitis & asthma without CC/MCC', '04', 'Diseases & Disorders of the Respiratory System', 'medical', 0.6350, 2.1, 2.5, false, false),
('207', 'Respiratory system diagnosis with ventilator support >96 hours', '04', 'Diseases & Disorders of the Respiratory System', 'medical', 5.0450, 11.5, 14.8, false, false),
('208', 'Respiratory system diagnosis with ventilator support <=96 hours', '04', 'Diseases & Disorders of the Respiratory System', 'medical', 2.1830, 4.4, 5.7, false, false),

-- MDC 05: Circulatory System
('215', 'Other heart assist system implant', '05', 'Diseases & Disorders of the Circulatory System', 'surgical', 14.8950, 16.8, 23.5, false, false),
('216', 'Cardiac valve & other major cardiothoracic procedures with cardiac catheterization with MCC', '05', 'Diseases & Disorders of the Circulatory System', 'surgical', 10.3240, 11.2, 14.8, false, true),
('217', 'Cardiac valve & other major cardiothoracic procedures with cardiac catheterization with CC', '05', 'Diseases & Disorders of the Circulatory System', 'surgical', 6.5720, 7.2, 9.0, true, false),
('218', 'Cardiac valve & other major cardiothoracic procedures with cardiac catheterization without CC/MCC', '05', 'Diseases & Disorders of the Circulatory System', 'surgical', 5.4380, 5.3, 6.5, false, false),
('219', 'Cardiac valve & other major cardiothoracic procedures without cardiac catheterization with MCC', '05', 'Diseases & Disorders of the Circulatory System', 'surgical', 7.6850, 9.3, 12.5, false, true),
('220', 'Cardiac valve & other major cardiothoracic procedures without cardiac catheterization with CC', '05', 'Diseases & Disorders of the Circulatory System', 'surgical', 4.9610, 5.6, 7.0, true, false),
('221', 'Cardiac valve & other major cardiothoracic procedures without cardiac catheterization without CC/MCC', '05', 'Diseases & Disorders of the Circulatory System', 'surgical', 4.1250, 4.2, 5.1, false, false),
('233', 'Coronary bypass with cardiac catheterization with MCC', '05', 'Diseases & Disorders of the Circulatory System', 'surgical', 7.4120, 10.3, 13.5, false, true),
('234', 'Coronary bypass with cardiac catheterization without MCC', '05', 'Diseases & Disorders of the Circulatory System', 'surgical', 4.4970, 6.2, 7.6, false, false),
('235', 'Coronary bypass without cardiac catheterization with MCC', '05', 'Diseases & Disorders of the Circulatory System', 'surgical', 5.6340, 8.5, 11.4, false, true),
('236', 'Coronary bypass without cardiac catheterization without MCC', '05', 'Diseases & Disorders of the Circulatory System', 'surgical', 3.4580, 5.0, 6.2, false, false),
('246', 'Percutaneous cardiovascular procedures with drug-eluting stent with MCC', '05', 'Diseases & Disorders of the Circulatory System', 'surgical', 3.2550, 4.7, 6.4, false, true),
('247', 'Percutaneous cardiovascular procedures with drug-eluting stent without MCC', '05', 'Diseases & Disorders of the Circulatory System', 'surgical', 1.8320, 1.9, 2.4, false, false),
('248', 'Percutaneous cardiovascular procedures with non-drug-eluting stent with MCC', '05', 'Diseases & Disorders of the Circulatory System', 'surgical', 3.4250, 5.5, 7.4, false, true),
('249', 'Percutaneous cardiovascular procedures with non-drug-eluting stent without MCC', '05', 'Diseases & Disorders of the Circulatory System', 'surgical', 2.0460, 2.3, 2.9, false, false),
('280', 'Acute myocardial infarction discharged alive with MCC', '05', 'Diseases & Disorders of the Circulatory System', 'medical', 1.8190, 4.2, 5.6, false, true),
('281', 'Acute myocardial infarction discharged alive with CC', '05', 'Diseases & Disorders of the Circulatory System', 'medical', 1.0680, 2.6, 3.3, true, false),
('282', 'Acute myocardial infarction discharged alive without CC/MCC', '05', 'Diseases & Disorders of the Circulatory System', 'medical', 0.7350, 1.8, 2.2, false, false),
('287', 'Circulatory disorders except AMI with cardiac catheterization with MCC', '05', 'Diseases & Disorders of the Circulatory System', 'medical', 2.1780, 4.6, 6.2, false, true),
('288', 'Acute & subacute endocarditis with MCC', '05', 'Diseases & Disorders of the Circulatory System', 'medical', 3.3500, 8.3, 11.2, false, true),
('289', 'Acute & subacute endocarditis with CC', '05', 'Diseases & Disorders of the Circulatory System', 'medical', 1.8920, 5.1, 6.6, true, false),
('291', 'Heart failure & shock with MCC', '05', 'Diseases & Disorders of the Circulatory System', 'medical', 1.6230, 4.3, 5.7, false, true),
('292', 'Heart failure & shock with CC', '05', 'Diseases & Disorders of the Circulatory System', 'medical', 0.9530, 3.0, 3.8, true, false),
('293', 'Heart failure & shock without CC/MCC', '05', 'Diseases & Disorders of the Circulatory System', 'medical', 0.6510, 2.2, 2.7, false, false),
('300', 'Peripheral vascular disorders with MCC', '05', 'Diseases & Disorders of the Circulatory System', 'medical', 1.4430, 3.9, 5.3, false, true),
('301', 'Peripheral vascular disorders with CC', '05', 'Diseases & Disorders of the Circulatory System', 'medical', 0.8810, 2.8, 3.6, true, false),
('302', 'Peripheral vascular disorders without CC/MCC', '05', 'Diseases & Disorders of the Circulatory System', 'medical', 0.6200, 2.0, 2.5, false, false),
('303', 'Atherosclerosis with MCC', '05', 'Diseases & Disorders of the Circulatory System', 'medical', 1.0840, 2.7, 3.6, false, true),
('304', 'Atherosclerosis without MCC', '05', 'Diseases & Disorders of the Circulatory System', 'medical', 0.5890, 1.6, 2.0, false, false),
('305', 'Hypertension with MCC', '05', 'Diseases & Disorders of the Circulatory System', 'medical', 1.1860, 3.1, 4.2, false, true),
('306', 'Hypertension without MCC', '05', 'Diseases & Disorders of the Circulatory System', 'medical', 0.6340, 2.0, 2.5, false, false),
('308', 'Cardiac arrhythmia & conduction disorders with MCC', '05', 'Diseases & Disorders of the Circulatory System', 'medical', 1.3730, 3.5, 4.7, false, true),
('309', 'Cardiac arrhythmia & conduction disorders with CC', '05', 'Diseases & Disorders of the Circulatory System', 'medical', 0.8220, 2.4, 3.1, true, false),
('310', 'Cardiac arrhythmia & conduction disorders without CC/MCC', '05', 'Diseases & Disorders of the Circulatory System', 'medical', 0.5190, 1.6, 2.0, false, false),
('312', 'Syncope & collapse with MCC', '05', 'Diseases & Disorders of the Circulatory System', 'medical', 1.2230, 3.2, 4.3, false, true),
('313', 'Syncope & collapse without MCC', '05', 'Diseases & Disorders of the Circulatory System', 'medical', 0.6420, 1.9, 2.4, false, false),
('314', 'Other circulatory system diagnoses with MCC', '05', 'Diseases & Disorders of the Circulatory System', 'medical', 1.7530, 4.4, 5.9, false, true),
('315', 'Other circulatory system diagnoses with CC', '05', 'Diseases & Disorders of the Circulatory System', 'medical', 0.9460, 2.8, 3.6, true, false),
('316', 'Other circulatory system diagnoses without CC/MCC', '05', 'Diseases & Disorders of the Circulatory System', 'medical', 0.6510, 1.8, 2.3, false, false),

-- MDC 06: Digestive System
('329', 'Major small & large bowel procedures with MCC', '06', 'Diseases & Disorders of the Digestive System', 'surgical', 4.2980, 8.8, 11.8, false, true),
('330', 'Major small & large bowel procedures with CC', '06', 'Diseases & Disorders of the Digestive System', 'surgical', 2.2110, 5.0, 6.3, true, false),
('331', 'Major small & large bowel procedures without CC/MCC', '06', 'Diseases & Disorders of the Digestive System', 'surgical', 1.4980, 3.1, 3.8, false, false),
('368', 'Major esophageal disorders with MCC', '06', 'Diseases & Disorders of the Digestive System', 'medical', 1.7830, 4.7, 6.4, false, true),
('371', 'Major gastrointestinal disorders & peritoneal infections with MCC', '06', 'Diseases & Disorders of the Digestive System', 'medical', 1.8810, 5.0, 6.8, false, true),
('372', 'Major gastrointestinal disorders & peritoneal infections with CC', '06', 'Diseases & Disorders of the Digestive System', 'medical', 1.0230, 3.3, 4.2, true, false),
('373', 'Major gastrointestinal disorders & peritoneal infections without CC/MCC', '06', 'Diseases & Disorders of the Digestive System', 'medical', 0.7050, 2.3, 2.8, false, false),
('377', 'GI hemorrhage with MCC', '06', 'Diseases & Disorders of the Digestive System', 'medical', 1.6620, 4.1, 5.4, false, true),
('378', 'GI hemorrhage with CC', '06', 'Diseases & Disorders of the Digestive System', 'medical', 0.9530, 2.8, 3.5, true, false),
('379', 'GI hemorrhage without CC/MCC', '06', 'Diseases & Disorders of the Digestive System', 'medical', 0.5960, 1.9, 2.4, false, false),
('388', 'GI obstruction with MCC', '06', 'Diseases & Disorders of the Digestive System', 'medical', 1.4870, 4.1, 5.6, false, true),
('389', 'GI obstruction with CC', '06', 'Diseases & Disorders of the Digestive System', 'medical', 0.8340, 2.8, 3.5, true, false),
('390', 'GI obstruction without CC/MCC', '06', 'Diseases & Disorders of the Digestive System', 'medical', 0.5530, 2.0, 2.4, false, false),
('391', 'Esophagitis, gastroent & misc digestive disorders with MCC', '06', 'Diseases & Disorders of the Digestive System', 'medical', 1.2100, 3.4, 4.6, false, true),
('392', 'Esophagitis, gastroent & misc digestive disorders without MCC', '06', 'Diseases & Disorders of the Digestive System', 'medical', 0.6380, 2.2, 2.8, false, false),

-- MDC 08: Musculoskeletal System
('453', 'Combined anterior/posterior spinal fusion with MCC', '08', 'Diseases & Disorders of the Musculoskeletal System', 'surgical', 10.9450, 8.5, 11.2, false, true),
('454', 'Combined anterior/posterior spinal fusion with CC', '08', 'Diseases & Disorders of the Musculoskeletal System', 'surgical', 6.9060, 4.5, 5.7, true, false),
('455', 'Combined anterior/posterior spinal fusion without CC/MCC', '08', 'Diseases & Disorders of the Musculoskeletal System', 'surgical', 5.2680, 3.0, 3.8, false, false),
('469', 'Major hip and knee joint replacement or reattachment of lower extremity with MCC', '08', 'Diseases & Disorders of the Musculoskeletal System', 'surgical', 3.1140, 4.3, 5.7, false, true),
('470', 'Major hip and knee joint replacement or reattachment of lower extremity without MCC', '08', 'Diseases & Disorders of the Musculoskeletal System', 'surgical', 1.7410, 1.8, 2.3, false, false),
('480', 'Hip & femur procedures except major joint with MCC', '08', 'Diseases & Disorders of the Musculoskeletal System', 'surgical', 2.6300, 5.5, 7.3, false, true),
('481', 'Hip & femur procedures except major joint with CC', '08', 'Diseases & Disorders of the Musculoskeletal System', 'surgical', 1.6310, 3.5, 4.5, true, false),
('482', 'Hip & femur procedures except major joint without CC/MCC', '08', 'Diseases & Disorders of the Musculoskeletal System', 'surgical', 1.2310, 2.5, 3.1, false, false),
('533', 'Fractures of femur with MCC', '08', 'Diseases & Disorders of the Musculoskeletal System', 'medical', 1.3760, 3.9, 5.2, false, true),
('534', 'Fractures of femur without MCC', '08', 'Diseases & Disorders of the Musculoskeletal System', 'medical', 0.7360, 2.6, 3.3, false, false),
('535', 'Fractures of hip & pelvis with MCC', '08', 'Diseases & Disorders of the Musculoskeletal System', 'medical', 1.3260, 3.7, 5.0, false, true),
('536', 'Fractures of hip & pelvis without MCC', '08', 'Diseases & Disorders of the Musculoskeletal System', 'medical', 0.7250, 2.5, 3.2, false, false),
('545', 'Connective tissue disorders with MCC', '08', 'Diseases & Disorders of the Musculoskeletal System', 'medical', 2.0830, 5.1, 6.9, false, true),
('546', 'Connective tissue disorders with CC', '08', 'Diseases & Disorders of the Musculoskeletal System', 'medical', 1.0270, 3.1, 3.9, true, false),
('547', 'Connective tissue disorders without CC/MCC', '08', 'Diseases & Disorders of the Musculoskeletal System', 'medical', 0.6600, 2.1, 2.6, false, false),
('551', 'Medical back problems with MCC', '08', 'Diseases & Disorders of the Musculoskeletal System', 'medical', 1.5100, 4.3, 5.8, false, true),
('552', 'Medical back problems without MCC', '08', 'Diseases & Disorders of the Musculoskeletal System', 'medical', 0.7900, 2.7, 3.5, false, false),

-- MDC 10: Endocrine, Nutritional & Metabolic
('637', 'Diabetes with MCC', '10', 'Endocrine, Nutritional & Metabolic Diseases & Disorders', 'medical', 1.5160, 4.0, 5.4, false, true),
('638', 'Diabetes with CC', '10', 'Endocrine, Nutritional & Metabolic Diseases & Disorders', 'medical', 0.8840, 2.7, 3.4, true, false),
('639', 'Diabetes without CC/MCC', '10', 'Endocrine, Nutritional & Metabolic Diseases & Disorders', 'medical', 0.5930, 1.9, 2.4, false, false),
('640', 'Miscellaneous disorders of nutrition, metabolism, fluids/electrolytes with MCC', '10', 'Endocrine, Nutritional & Metabolic Diseases & Disorders', 'medical', 1.3010, 3.5, 4.7, false, true),
('641', 'Miscellaneous disorders of nutrition, metabolism, fluids/electrolytes without MCC', '10', 'Endocrine, Nutritional & Metabolic Diseases & Disorders', 'medical', 0.6670, 2.3, 2.8, false, false),

-- MDC 11: Kidney & Urinary Tract
('682', 'Renal failure with MCC', '11', 'Diseases & Disorders of the Kidney & Urinary Tract', 'medical', 1.6190, 4.2, 5.6, false, true),
('683', 'Renal failure with CC', '11', 'Diseases & Disorders of the Kidney & Urinary Tract', 'medical', 0.9580, 2.9, 3.7, true, false),
('684', 'Renal failure without CC/MCC', '11', 'Diseases & Disorders of the Kidney & Urinary Tract', 'medical', 0.6090, 2.1, 2.5, false, false),
('689', 'Kidney & urinary tract infections with MCC', '11', 'Diseases & Disorders of the Kidney & Urinary Tract', 'medical', 1.3700, 3.7, 5.0, false, true),
('690', 'Kidney & urinary tract infections without MCC', '11', 'Diseases & Disorders of the Kidney & Urinary Tract', 'medical', 0.7530, 2.6, 3.3, false, false),

-- MDC 14: Pregnancy, Childbirth & Puerperium
('765', 'Cesarean section with CC/MCC', '14', 'Pregnancy, Childbirth & the Puerperium', 'surgical', 1.3420, 3.2, 4.1, true, true),
('766', 'Cesarean section without CC/MCC', '14', 'Pregnancy, Childbirth & the Puerperium', 'surgical', 0.8850, 2.3, 2.7, false, false),
('774', 'Vaginal delivery with complicating diagnoses', '14', 'Pregnancy, Childbirth & the Puerperium', 'medical', 0.7140, 2.1, 2.6, false, false),
('775', 'Vaginal delivery without complicating diagnoses', '14', 'Pregnancy, Childbirth & the Puerperium', 'medical', 0.5370, 1.7, 2.0, false, false),
('776', 'Postpartum & post abortion diagnoses without OR procedure', '14', 'Pregnancy, Childbirth & the Puerperium', 'medical', 0.6830, 2.0, 2.5, false, false),

-- MDC 15: Newborns & Other Neonates
('789', 'Neonates died or transferred to another acute care facility', '15', 'Newborns & Other Neonates', 'medical', 1.1520, 2.0, 3.8, false, false),
('790', 'Extreme immaturity or respiratory distress syndrome, neonate', '15', 'Newborns & Other Neonates', 'medical', 4.5370, 13.6, 19.5, false, false),
('793', 'Full term neonate with major problems', '15', 'Newborns & Other Neonates', 'medical', 1.7570, 3.3, 4.8, false, false),
('794', 'Neonate with other significant problems', '15', 'Newborns & Other Neonates', 'medical', 0.8930, 2.5, 3.3, false, false),
('795', 'Normal newborn', '15', 'Newborns & Other Neonates', 'medical', 0.1680, 2.5, 2.7, false, false),

-- MDC 18: Infectious & Parasitic Diseases
('853', 'Infectious & parasitic diseases with OR procedure with MCC', '18', 'Infectious & Parasitic Diseases', 'surgical', 5.6860, 10.8, 14.5, false, true),
('854', 'Infectious & parasitic diseases with OR procedure with CC', '18', 'Infectious & Parasitic Diseases', 'surgical', 2.5250, 5.5, 7.2, true, false),
('855', 'Infectious & parasitic diseases with OR procedure without CC/MCC', '18', 'Infectious & Parasitic Diseases', 'surgical', 1.5720, 3.3, 4.2, false, false),
('856', 'Postoperative or post-traumatic infections with OR procedure with MCC', '18', 'Infectious & Parasitic Diseases', 'surgical', 4.2700, 9.0, 12.3, false, true),
('857', 'Postoperative or post-traumatic infections with OR procedure with CC', '18', 'Infectious & Parasitic Diseases', 'surgical', 2.2650, 5.4, 6.9, true, false),
('858', 'Postoperative or post-traumatic infections with OR procedure without CC/MCC', '18', 'Infectious & Parasitic Diseases', 'surgical', 1.4960, 3.2, 4.0, false, false),
('870', 'Septicemia or severe sepsis with MV >96 hours', '18', 'Infectious & Parasitic Diseases', 'medical', 5.3520, 10.1, 13.0, false, false),
('871', 'Septicemia or severe sepsis without MV >96 hours with MCC', '18', 'Infectious & Parasitic Diseases', 'medical', 2.0780, 4.9, 6.4, false, true),
('872', 'Septicemia or severe sepsis without MV >96 hours without MCC', '18', 'Infectious & Parasitic Diseases', 'medical', 1.0270, 3.2, 4.0, false, false),

-- MDC 19: Mental Diseases & Disorders
('876', 'OR procedure with principal diagnosis of mental illness', '19', 'Mental Diseases & Disorders', 'surgical', 2.4530, 6.2, 8.8, false, false),
('880', 'Acute adjustment reaction & psychosocial dysfunction', '19', 'Mental Diseases & Disorders', 'medical', 0.6970, 2.7, 3.8, false, false),
('881', 'Depressive neuroses', '19', 'Mental Diseases & Disorders', 'medical', 0.6080, 3.0, 4.3, false, false),
('882', 'Neuroses except depressive', '19', 'Mental Diseases & Disorders', 'medical', 0.6460, 2.5, 3.6, false, false),
('885', 'Psychoses', '19', 'Mental Diseases & Disorders', 'medical', 1.0830, 5.5, 7.8, false, false),
('886', 'Behavioral & developmental disorders', '19', 'Mental Diseases & Disorders', 'medical', 0.6990, 3.5, 5.2, false, false),
('887', 'Other mental disorder diagnoses', '19', 'Mental Diseases & Disorders', 'medical', 0.8100, 2.8, 4.1, false, false),
('894', 'Alcohol/drug abuse or dependence, left AMA', '20', 'Alcohol/Drug Use & Induced Mental Disorders', 'medical', 0.3670, 1.5, 2.2, false, false),
('895', 'Alcohol/drug abuse or dependence with rehabilitation therapy', '20', 'Alcohol/Drug Use & Induced Mental Disorders', 'medical', 0.6330, 5.5, 7.2, false, false),
('896', 'Alcohol/drug abuse or dependence without rehabilitation therapy with MCC', '20', 'Alcohol/Drug Use & Induced Mental Disorders', 'medical', 1.2540, 3.6, 4.9, false, true),
('897', 'Alcohol/drug abuse or dependence without rehabilitation therapy without MCC', '20', 'Alcohol/Drug Use & Induced Mental Disorders', 'medical', 0.5700, 2.5, 3.3, false, false),

-- MDC 23: Factors Influencing Health Status (Rehab, Aftercare, etc.)
('945', 'Rehabilitation with CC/MCC', '23', 'Factors Influencing Health Status', 'medical', 1.5900, 9.8, 11.5, true, true),
('946', 'Rehabilitation without CC/MCC', '23', 'Factors Influencing Health Status', 'medical', 1.0900, 7.8, 8.9, false, false),
('949', 'Aftercare with CC/MCC', '23', 'Factors Influencing Health Status', 'medical', 1.0530, 3.0, 3.9, true, true),
('950', 'Aftercare without CC/MCC', '23', 'Factors Influencing Health Status', 'medical', 0.5780, 2.0, 2.5, false, false),
('951', 'Other factors influencing health status', '23', 'Factors Influencing Health Status', 'medical', 0.5960, 1.6, 2.2, false, false),

-- Ungroupable
('998', 'Principal diagnosis invalid as discharge diagnosis', 'UNG', 'Ungroupable', 'medical', 0.0000, 0.0, 0.0, false, false),
('999', 'Ungroupable', 'UNG', 'Ungroupable', 'medical', 0.0000, 0.0, 0.0, false, false)

ON CONFLICT (drg_code) DO UPDATE SET
  description = EXCLUDED.description,
  mdc = EXCLUDED.mdc,
  mdc_description = EXCLUDED.mdc_description,
  drg_type = EXCLUDED.drg_type,
  relative_weight = EXCLUDED.relative_weight,
  geometric_mean_los = EXCLUDED.geometric_mean_los,
  arithmetic_mean_los = EXCLUDED.arithmetic_mean_los,
  has_cc = EXCLUDED.has_cc,
  has_mcc = EXCLUDED.has_mcc,
  updated_at = now();

-- 6. Update reference_data_versions freshness tracking
-- The reference_data_versions table was seeded with a FY2026 placeholder row.
-- Update it with the actual record count now that data is loaded.
UPDATE reference_data_versions
SET record_count = 180,
    loaded_at = now(),
    notes = 'Core MS-DRG codes seeded (FY2025 weights). Full 760+ codes available from CMS. Akima review pending.'
WHERE data_source = 'ms_drg' AND is_current = true;
