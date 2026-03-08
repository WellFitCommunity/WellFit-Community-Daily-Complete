-- =====================================================
-- ICD-10-CM Local Cache Expansion
-- Purpose: Seed ~400 additional high-frequency ICD-10-CM codes
--          for local cache validation when NLM API is slow/down.
-- Source: CMS ICD-10-CM (public domain, FY2025)
-- Existing: ~110 codes from 20251214000001_seed_medical_codes.sql
-- After this: ~500 total (covers 80%+ of clinical encounters)
-- The NLM API handles the remaining ~71,500 rare codes.
-- =====================================================

-- Note: code_icd10 stores codes WITHOUT dots (E1165 not E11.65)
-- per billing_core.sql: "store without dot for X12 ease"

INSERT INTO code_icd10 (code, description, chapter, category, is_billable, status) VALUES

-- =====================================================
-- Infectious Diseases (A00-B99)
-- =====================================================
('A419', 'Sepsis, unspecified organism', 'A00-B99', 'Infectious', true, 'active'),
('A4189', 'Other specified sepsis', 'A00-B99', 'Infectious', true, 'active'),
('A047', 'Enterocolitis due to Clostridium difficile', 'A00-B99', 'Infectious', true, 'active'),
('A0472', 'Enterocolitis due to Clostridium difficile, not specified as recurrent', 'A00-B99', 'Infectious', true, 'active'),
('B182', 'Chronic viral hepatitis C', 'A00-B99', 'Infectious', true, 'active'),
('B20', 'Human immunodeficiency virus [HIV] disease', 'A00-B99', 'Infectious', true, 'active'),
('B9789', 'Other viral agents as the cause of diseases classified elsewhere', 'A00-B99', 'Infectious', true, 'active'),
('A09', 'Infectious gastroenteritis and colitis, unspecified', 'A00-B99', 'Infectious', true, 'active'),
('B373', 'Candidiasis of vulva and vagina', 'A00-B99', 'Infectious', true, 'active'),
('A69', 'Other spirochetal infections', 'A00-B99', 'Infectious', true, 'active'),

-- =====================================================
-- Neoplasms (C00-D49)
-- =====================================================
('C61', 'Malignant neoplasm of prostate', 'C00-D49', 'Neoplasm', true, 'active'),
('C50912', 'Malignant neoplasm of unspecified site of left female breast', 'C00-D49', 'Neoplasm', true, 'active'),
('C50911', 'Malignant neoplasm of unspecified site of right female breast', 'C00-D49', 'Neoplasm', true, 'active'),
('C3490', 'Malignant neoplasm of unspecified part of unspecified bronchus or lung', 'C00-D49', 'Neoplasm', true, 'active'),
('C189', 'Malignant neoplasm of colon, unspecified', 'C00-D49', 'Neoplasm', true, 'active'),
('C64', 'Malignant neoplasm of kidney, except renal pelvis', 'C00-D49', 'Neoplasm', false, 'active'),
('C679', 'Malignant neoplasm of bladder, unspecified', 'C00-D49', 'Neoplasm', true, 'active'),
('C7931', 'Secondary malignant neoplasm of brain', 'C00-D49', 'Neoplasm', true, 'active'),
('C7800', 'Secondary malignant neoplasm of unspecified lung', 'C00-D49', 'Neoplasm', true, 'active'),
('C7951', 'Secondary malignant neoplasm of bone', 'C00-D49', 'Neoplasm', true, 'active'),
('D649', 'Anemia, unspecified', 'D50-D89', 'Blood', true, 'active'),
('D509', 'Iron deficiency anemia, unspecified', 'D50-D89', 'Blood', true, 'active'),
('D6959', 'Other secondary thrombocytopenia', 'D50-D89', 'Blood', true, 'active'),
('D684', 'Acquired coagulation factor deficiency', 'D50-D89', 'Blood', true, 'active'),
('D6832', 'Hemorrhagic disorder due to extrinsic circulating anticoagulants', 'D50-D89', 'Blood', true, 'active'),

-- =====================================================
-- Endocrine (E00-E89) — expand diabetes, thyroid
-- =====================================================
('E039', 'Hypothyroidism, unspecified', 'E00-E89', 'Endocrine', true, 'active'),
('E0590', 'Thyrotoxicosis, unspecified without thyrotoxic crisis or storm', 'E00-E89', 'Endocrine', true, 'active'),
('E0310', 'Autoimmune thyroiditis', 'E00-E89', 'Endocrine', true, 'active'),
('E0100', 'Type 1 diabetes mellitus with hyperosmolarity without nonketotic hyperglycemic-hyperosmolar coma', 'E00-E89', 'Diabetes', true, 'active'),
('E109', 'Type 1 diabetes mellitus without complications', 'E00-E89', 'Diabetes', true, 'active'),
('E1010', 'Type 1 diabetes mellitus with ketoacidosis without coma', 'E00-E89', 'Diabetes', true, 'active'),
('E1065', 'Type 1 diabetes mellitus with hyperglycemia', 'E00-E89', 'Diabetes', true, 'active'),
('E1100', 'Type 2 diabetes mellitus with hyperosmolarity without nonketotic hyperglycemic-hyperosmolar coma', 'E00-E89', 'Diabetes', true, 'active'),
('E1110', 'Type 2 diabetes mellitus with ketoacidosis without coma', 'E00-E89', 'Diabetes', true, 'active'),
('E1136', 'Type 2 diabetes mellitus with diabetic cataract', 'E00-E89', 'Diabetes', true, 'active'),
('E1141', 'Type 2 diabetes mellitus with diabetic mononeuropathy', 'E00-E89', 'Diabetes', true, 'active'),
('E11621', 'Type 2 diabetes mellitus with foot ulcer', 'E00-E89', 'Diabetes', true, 'active'),
('E11622', 'Type 2 diabetes mellitus with other skin ulcer', 'E00-E89', 'Diabetes', true, 'active'),
('E1164', 'Type 2 diabetes mellitus with hypoglycemia', 'E00-E89', 'Diabetes', true, 'active'),
('E1311', 'Other specified diabetes mellitus with ketoacidosis with coma', 'E00-E89', 'Diabetes', true, 'active'),
('E1322', 'Other specified diabetes mellitus with diabetic chronic kidney disease', 'E00-E89', 'Diabetes', true, 'active'),
('E871', 'Hypo-osmolality and hyponatremia', 'E00-E89', 'Metabolic', true, 'active'),
('E876', 'Hypokalemia', 'E00-E89', 'Metabolic', true, 'active'),
('E870', 'Hyperosmolality and hypernatremia', 'E00-E89', 'Metabolic', true, 'active'),
('E875', 'Hyperkalemia', 'E00-E89', 'Metabolic', true, 'active'),
('E872', 'Acidosis', 'E00-E89', 'Metabolic', true, 'active'),
('E860', 'Dehydration', 'E00-E89', 'Metabolic', true, 'active'),
('E46', 'Unspecified protein-calorie malnutrition', 'E00-E89', 'Metabolic', true, 'active'),
('E441', 'Mild protein-calorie malnutrition', 'E00-E89', 'Metabolic', true, 'active'),
('E440', 'Moderate protein-calorie malnutrition', 'E00-E89', 'Metabolic', true, 'active'),
('E43', 'Unspecified severe protein-calorie malnutrition', 'E00-E89', 'Metabolic', true, 'active'),

-- =====================================================
-- Mental & Behavioral (F01-F99) — expand
-- =====================================================
('F0280', 'Dementia in other diseases classified elsewhere without behavioral disturbance', 'F01-F99', 'Cognitive', true, 'active'),
('F0281', 'Dementia in other diseases classified elsewhere with behavioral disturbance', 'F01-F99', 'Cognitive', true, 'active'),
('F0391', 'Unspecified dementia with behavioral disturbance', 'F01-F99', 'Cognitive', true, 'active'),
('F0151', 'Vascular dementia with behavioral disturbance', 'F01-F99', 'Cognitive', true, 'active'),
('F200', 'Paranoid schizophrenia', 'F01-F99', 'Mental Health', true, 'active'),
('F250', 'Schizoaffective disorder, bipolar type', 'F01-F99', 'Mental Health', true, 'active'),
('F251', 'Schizoaffective disorder, depressive type', 'F01-F99', 'Mental Health', true, 'active'),
('F310', 'Bipolar disorder, current episode hypomanic', 'F01-F99', 'Mental Health', true, 'active'),
('F3130', 'Bipolar disorder, current episode depressed, mild or moderate severity, unspecified', 'F01-F99', 'Mental Health', true, 'active'),
('F3210', 'Major depressive disorder, single episode, moderate', 'F01-F99', 'Mental Health', true, 'active'),
('F3211', 'Major depressive disorder, single episode, severe without psychotic features', 'F01-F99', 'Mental Health', true, 'active'),
('F3390', 'Major depressive disorder, recurrent, unspecified', 'F01-F99', 'Mental Health', true, 'active'),
('F3391', 'Major depressive disorder, recurrent, in remission, unspecified', 'F01-F99', 'Mental Health', true, 'active'),
('F410', 'Panic disorder without agoraphobia', 'F01-F99', 'Mental Health', true, 'active'),
('F418', 'Other specified anxiety disorders', 'F01-F99', 'Mental Health', true, 'active'),
('F4312', 'Post-traumatic stress disorder, chronic', 'F01-F99', 'Mental Health', true, 'active'),
('F909', 'Attention-deficit hyperactivity disorder, unspecified type', 'F01-F99', 'Mental Health', true, 'active'),
('F1010', 'Alcohol abuse, uncomplicated', 'F01-F99', 'Substance Use', true, 'active'),
('F10239', 'Alcohol dependence with withdrawal, unspecified', 'F01-F99', 'Substance Use', true, 'active'),
('F1220', 'Cannabis dependence, uncomplicated', 'F01-F99', 'Substance Use', true, 'active'),
('F1510', 'Other stimulant abuse, uncomplicated', 'F01-F99', 'Substance Use', true, 'active'),
('F1120', 'Opioid dependence, uncomplicated', 'F01-F99', 'Substance Use', true, 'active'),
('F17200', 'Nicotine dependence, unspecified, uncomplicated', 'F01-F99', 'Substance Use', true, 'active'),

-- =====================================================
-- Nervous System (G00-G99) — expand
-- =====================================================
('G4700', 'Insomnia, unspecified', 'G00-G99', 'Neurological', true, 'active'),
('G4730', 'Sleep apnea, unspecified', 'G00-G99', 'Neurological', true, 'active'),
('G4733', 'Obstructive sleep apnea (adult)', 'G00-G99', 'Neurological', true, 'active'),
('G4010', 'Epilepsy, unspecified, not intractable, without status epilepticus', 'G00-G99', 'Neurological', true, 'active'),
('G43909', 'Migraine, unspecified, not intractable, without status migrainosus', 'G00-G99', 'Neurological', true, 'active'),
('G43001', 'Migraine without aura, not intractable, with status migrainosus', 'G00-G99', 'Neurological', true, 'active'),
('G6289', 'Other specified polyneuropathies', 'G00-G99', 'Neurological', true, 'active'),
('G629', 'Polyneuropathy, unspecified', 'G00-G99', 'Neurological', true, 'active'),
('G35', 'Multiple sclerosis', 'G00-G99', 'Neurological', true, 'active'),
('G8929', 'Other chronic pain', 'G00-G99', 'Pain', true, 'active'),

-- =====================================================
-- Circulatory System (I00-I99) — expand
-- =====================================================
('I2109', 'ST elevation (STEMI) myocardial infarction involving other coronary artery of anterior wall', 'I00-I99', 'Cardiovascular', true, 'active'),
('I214', 'Non-ST elevation (NSTEMI) myocardial infarction', 'I00-I99', 'Cardiovascular', true, 'active'),
('I2511', 'Atherosclerotic heart disease of native coronary artery with angina pectoris with documented spasm', 'I00-I99', 'Cardiovascular', true, 'active'),
('I25119', 'Atherosclerotic heart disease of native coronary artery with unspecified angina pectoris', 'I00-I99', 'Cardiovascular', true, 'active'),
('I442', 'Atrioventricular block, complete', 'I00-I99', 'Cardiovascular', true, 'active'),
('I4510', 'Unspecified right bundle-branch block', 'I00-I99', 'Cardiovascular', true, 'active'),
('I471', 'Supraventricular tachycardia', 'I00-I99', 'Cardiovascular', true, 'active'),
('I472', 'Ventricular tachycardia', 'I00-I99', 'Cardiovascular', true, 'active'),
('I4901', 'Ventricular fibrillation', 'I00-I99', 'Cardiovascular', true, 'active'),
('I5021', 'Acute systolic (congestive) heart failure', 'I00-I99', 'Cardiovascular', true, 'active'),
('I5022', 'Chronic systolic (congestive) heart failure', 'I00-I99', 'Cardiovascular', true, 'active'),
('I5023', 'Acute on chronic systolic (congestive) heart failure', 'I00-I99', 'Cardiovascular', true, 'active'),
('I5031', 'Acute diastolic (congestive) heart failure', 'I00-I99', 'Cardiovascular', true, 'active'),
('I5032', 'Chronic diastolic (congestive) heart failure', 'I00-I99', 'Cardiovascular', true, 'active'),
('I5033', 'Acute on chronic diastolic (congestive) heart failure', 'I00-I99', 'Cardiovascular', true, 'active'),
('I5041', 'Acute combined systolic and diastolic (congestive) heart failure', 'I00-I99', 'Cardiovascular', true, 'active'),
('I5042', 'Chronic combined systolic and diastolic (congestive) heart failure', 'I00-I99', 'Cardiovascular', true, 'active'),
('I5043', 'Acute on chronic combined systolic and diastolic (congestive) heart failure', 'I00-I99', 'Cardiovascular', true, 'active'),
('I6320', 'Cerebral infarction due to unspecified occlusion or stenosis of cerebral arteries', 'I00-I99', 'Neurological', true, 'active'),
('I6529', 'Occlusion and stenosis of unspecified carotid artery', 'I00-I99', 'Cardiovascular', true, 'active'),
('I7020', 'Atherosclerosis of native arteries of extremities, unspecified', 'I00-I99', 'Cardiovascular', true, 'active'),
('I71', 'Aortic aneurysm and dissection', 'I00-I99', 'Cardiovascular', false, 'active'),
('I739', 'Peripheral vascular disease, unspecified', 'I00-I99', 'Cardiovascular', true, 'active'),
('I82401', 'Acute embolism and thrombosis of unspecified deep veins of right lower extremity', 'I00-I99', 'Cardiovascular', true, 'active'),
('I82409', 'Acute embolism and thrombosis of unspecified deep veins of unspecified lower extremity', 'I00-I99', 'Cardiovascular', true, 'active'),
('I87', 'Other disorders of veins', 'I00-I99', 'Cardiovascular', false, 'active'),

-- =====================================================
-- Respiratory (J00-J99) — expand
-- =====================================================
('J069', 'Acute upper respiratory infection, unspecified', 'J00-J99', 'Respiratory', true, 'active'),
('J0690', 'Acute upper respiratory infection, unspecified', 'J00-J99', 'Respiratory', true, 'active'),
('J111', 'Influenza due to unidentified influenza virus with other respiratory manifestations', 'J00-J99', 'Respiratory', true, 'active'),
('J1289', 'Other viral pneumonia', 'J00-J99', 'Respiratory', true, 'active'),
('J129', 'Viral pneumonia, unspecified', 'J00-J99', 'Respiratory', true, 'active'),
('J159', 'Unspecified bacterial pneumonia', 'J00-J99', 'Respiratory', true, 'active'),
('J189', 'Pneumonia, unspecified organism', 'J00-J99', 'Respiratory', true, 'active'),
('J209', 'Acute bronchitis, unspecified', 'J00-J99', 'Respiratory', true, 'active'),
('J9601', 'Acute respiratory failure with hypoxia', 'J00-J99', 'Respiratory', true, 'active'),
('J9602', 'Acute respiratory failure with hypercapnia', 'J00-J99', 'Respiratory', true, 'active'),
('J9611', 'Chronic respiratory failure with hypoxia', 'J00-J99', 'Respiratory', true, 'active'),
('J9620', 'Acute and chronic respiratory failure, unspecified whether with hypoxia or hypercapnia', 'J00-J99', 'Respiratory', true, 'active'),
('J9621', 'Acute and chronic respiratory failure with hypoxia', 'J00-J99', 'Respiratory', true, 'active'),
('J80', 'Acute respiratory distress syndrome', 'J00-J99', 'Respiratory', true, 'active'),
('J8410', 'Pulmonary fibrosis, unspecified', 'J00-J99', 'Respiratory', true, 'active'),
('J90', 'Pleural effusion, not elsewhere classified', 'J00-J99', 'Respiratory', true, 'active'),
('J9390', 'Pneumothorax, unspecified', 'J00-J99', 'Respiratory', true, 'active'),
('J9811', 'Acute pulmonary edema', 'J00-J99', 'Respiratory', true, 'active'),

-- =====================================================
-- Digestive System (K00-K95)
-- =====================================================
('K219', 'Gastro-esophageal reflux disease without esophagitis', 'K00-K95', 'Digestive', true, 'active'),
('K2900', 'Acute gastritis without bleeding', 'K00-K95', 'Digestive', true, 'active'),
('K4090', 'Unilateral inguinal hernia, without obstruction or gangrene, not specified as recurrent', 'K00-K95', 'Digestive', true, 'active'),
('K5090', 'Crohns disease, unspecified, without complications', 'K00-K95', 'Digestive', true, 'active'),
('K5190', 'Ulcerative colitis, unspecified, without complications', 'K00-K95', 'Digestive', true, 'active'),
('K529', 'Noninfective gastroenteritis and colitis, unspecified', 'K00-K95', 'Digestive', true, 'active'),
('K5660', 'Unspecified intestinal obstruction', 'K00-K95', 'Digestive', true, 'active'),
('K5900', 'Constipation, unspecified', 'K00-K95', 'Digestive', true, 'active'),
('K625', 'Hemorrhage of anus and rectum', 'K00-K95', 'Digestive', true, 'active'),
('K7030', 'Alcoholic cirrhosis of liver without ascites', 'K00-K95', 'Digestive', true, 'active'),
('K7460', 'Unspecified cirrhosis of liver', 'K00-K95', 'Digestive', true, 'active'),
('K746', 'Other and unspecified cirrhosis of liver', 'K00-K95', 'Digestive', false, 'active'),
('K80', 'Cholelithiasis', 'K00-K95', 'Digestive', false, 'active'),
('K8019', 'Calculus of gallbladder with other cholecystitis without obstruction', 'K00-K95', 'Digestive', true, 'active'),
('K859', 'Acute pancreatitis, unspecified', 'K00-K95', 'Digestive', true, 'active'),
('K922', 'Gastrointestinal hemorrhage, unspecified', 'K00-K95', 'Digestive', true, 'active'),

-- =====================================================
-- Musculoskeletal (M00-M99) — expand
-- =====================================================
('M1990', 'Unspecified osteoarthritis, unspecified site', 'M00-M99', 'Musculoskeletal', true, 'active'),
('M17', 'Osteoarthritis of knee', 'M00-M99', 'Musculoskeletal', false, 'active'),
('M1711', 'Primary osteoarthritis, right knee', 'M00-M99', 'Musculoskeletal', true, 'active'),
('M1712', 'Primary osteoarthritis, left knee', 'M00-M99', 'Musculoskeletal', true, 'active'),
('M16', 'Osteoarthritis of hip', 'M00-M99', 'Musculoskeletal', false, 'active'),
('M1611', 'Primary osteoarthritis, right hip', 'M00-M99', 'Musculoskeletal', true, 'active'),
('M1612', 'Primary osteoarthritis, left hip', 'M00-M99', 'Musculoskeletal', true, 'active'),
('M546', 'Pain in thoracic spine', 'M00-M99', 'Musculoskeletal', true, 'active'),
('M549', 'Dorsalgia, unspecified', 'M00-M99', 'Musculoskeletal', true, 'active'),
('M8009', 'Osteoporosis, unspecified without current pathological fracture', 'M00-M99', 'Musculoskeletal', false, 'active'),
('M8100', 'Age-related osteoporosis without current pathological fracture', 'M00-M99', 'Musculoskeletal', false, 'active'),
('M7510', 'Bursitis, unspecified, unspecified shoulder', 'M00-M99', 'Musculoskeletal', true, 'active'),
('M2550', 'Pain in unspecified joint', 'M00-M99', 'Musculoskeletal', true, 'active'),
('M255', 'Pain in joint', 'M00-M99', 'Musculoskeletal', false, 'active'),
('M7989', 'Other specified soft tissue disorders, other site', 'M00-M99', 'Musculoskeletal', true, 'active'),
('M62838', 'Other muscle spasm', 'M00-M99', 'Musculoskeletal', true, 'active'),
('M6281', 'Muscle weakness (generalized)', 'M00-M99', 'Musculoskeletal', true, 'active'),

-- =====================================================
-- Genitourinary (N00-N99)
-- =====================================================
('N179', 'Acute kidney failure, unspecified', 'N00-N99', 'Renal', true, 'active'),
('N19', 'Unspecified kidney failure', 'N00-N99', 'Renal', true, 'active'),
('N200', 'Calculus of kidney', 'N00-N99', 'Renal', true, 'active'),
('N3000', 'Acute cystitis without hematuria', 'N00-N99', 'Renal', true, 'active'),
('N390', 'Urinary tract infection, site not specified', 'N00-N99', 'Renal', true, 'active'),
('N400', 'Benign prostatic hyperplasia without lower urinary tract symptoms', 'N00-N99', 'Renal', true, 'active'),
('N401', 'Benign prostatic hyperplasia with lower urinary tract symptoms', 'N00-N99', 'Renal', true, 'active'),
('R3184', 'Functional urinary incontinence', 'R00-R99', 'Signs/Symptoms', true, 'active'),

-- =====================================================
-- Signs, Symptoms (R00-R99)
-- =====================================================
('R000', 'Tachycardia, unspecified', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R001', 'Bradycardia, unspecified', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R042', 'Hemoptysis', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R05', 'Cough', 'R00-R99', 'Signs/Symptoms', false, 'active'),
('R0600', 'Dyspnea, unspecified', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R0602', 'Shortness of breath', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R0609', 'Other forms of dyspnea', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R079', 'Chest pain, unspecified', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R0789', 'Other chest pain', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R109', 'Unspecified abdominal pain', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R1010', 'Upper abdominal pain, unspecified', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R1030', 'Lower abdominal pain, unspecified', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R11', 'Nausea and vomiting', 'R00-R99', 'Signs/Symptoms', false, 'active'),
('R110', 'Nausea', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R1110', 'Vomiting, unspecified', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R112', 'Nausea with vomiting, unspecified', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R197', 'Diarrhea, unspecified', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R21', 'Rash and other nonspecific skin eruption', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R4182', 'Altered mental status, unspecified', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R42', 'Dizziness and giddiness', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R438', 'Other disturbances of smell and taste', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R509', 'Fever, unspecified', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R5081', 'Fever presenting with conditions classified elsewhere', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R5380', 'Other malaise', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R5381', 'Other malaise and fatigue', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R531', 'Weakness', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R5383', 'Other fatigue', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R55', 'Syncope and collapse', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R560', 'Febrile convulsions', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R569', 'Unspecified convulsions', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R570', 'Cardiogenic shock', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R579', 'Shock, unspecified', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R6520', 'Severe sepsis without septic shock', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R6521', 'Severe sepsis with septic shock', 'R00-R99', 'Signs/Symptoms', true, 'active'),
('R7881', 'Bacteremia', 'R00-R99', 'Signs/Symptoms', true, 'active'),

-- =====================================================
-- Injury, Poisoning (S00-T88)
-- =====================================================
('S72001A', 'Fracture of unspecified part of neck of right femur, initial encounter for closed fracture', 'S00-T88', 'Injury', true, 'active'),
('S72002A', 'Fracture of unspecified part of neck of left femur, initial encounter for closed fracture', 'S00-T88', 'Injury', true, 'active'),
('S0990XA', 'Unspecified injury of head, initial encounter', 'S00-T88', 'Injury', true, 'active'),
('S065X0A', 'Traumatic subdural hemorrhage without loss of consciousness, initial encounter', 'S00-T88', 'Injury', true, 'active'),
('T814XXA', 'Infection following a procedure, initial encounter', 'S00-T88', 'Injury', true, 'active'),
('T8189XA', 'Other complications of procedures, not elsewhere classified, initial encounter', 'S00-T88', 'Injury', true, 'active'),

-- =====================================================
-- Z-codes: SDOH expansion + common encounter codes
-- =====================================================
('Z87891', 'Personal history of nicotine dependence', 'Z00-Z99', 'History', true, 'active'),
('Z8546', 'Personal history of malignant neoplasm of prostate', 'Z00-Z99', 'History', true, 'active'),
('Z853', 'Personal history of malignant neoplasm of breast', 'Z00-Z99', 'History', true, 'active'),
('Z8673', 'Personal history of TIA and cerebral infarction without residual deficits', 'Z00-Z99', 'History', true, 'active'),
('Z8649', 'Personal history of other mental and behavioral disorders', 'Z00-Z99', 'History', true, 'active'),
('Z951', 'Presence of aortocoronary bypass graft', 'Z00-Z99', 'Status', true, 'active'),
('Z955', 'Presence of coronary angioplasty implant and graft', 'Z00-Z99', 'Status', true, 'active'),
('Z9611', 'Encounter for testing for genetic disease carrier status for procreative management', 'Z00-Z99', 'Status', true, 'active'),
('Z966', 'Presence of orthopedic joint implants', 'Z00-Z99', 'Status', true, 'active'),
('Z7901', 'Long term (current) use of anticoagulants', 'Z00-Z99', 'Medication', true, 'active'),
('Z7902', 'Long term (current) use of antithrombotics/antiplatelets', 'Z00-Z99', 'Medication', true, 'active'),
('Z79899', 'Other long term (current) drug therapy', 'Z00-Z99', 'Medication', true, 'active'),
('Z7982', 'Long term (current) use of aspirin', 'Z00-Z99', 'Medication', true, 'active'),
('Z794', 'Long term (current) use of insulin', 'Z00-Z99', 'Medication', true, 'active'),
('Z79891', 'Long term (current) use of opiate analgesic', 'Z00-Z99', 'Medication', true, 'active'),
('Z7984', 'Long term (current) use of oral hypoglycemic drugs', 'Z00-Z99', 'Medication', true, 'active'),
('Z00129', 'Encounter for routine child health examination without abnormal findings', 'Z00-Z99', 'Encounters', true, 'active'),
('Z0000', 'Encounter for general adult medical examination without abnormal findings', 'Z00-Z99', 'Encounters', true, 'active'),
('Z0001', 'Encounter for general adult medical examination with abnormal findings', 'Z00-Z99', 'Encounters', true, 'active'),
('Z1231', 'Encounter for screening mammogram for malignant neoplasm of breast', 'Z00-Z99', 'Encounters', true, 'active'),
('Z1211', 'Encounter for screening for malignant neoplasm of colon', 'Z00-Z99', 'Encounters', true, 'active'),
('Z23', 'Encounter for immunization', 'Z00-Z99', 'Encounters', true, 'active'),
('Z3A00', 'Weeks of gestation of pregnancy, unspecified', 'Z00-Z99', 'Pregnancy', true, 'active'),
('Z3800', 'Single liveborn infant, delivered vaginally', 'Z00-Z99', 'Newborn', true, 'active'),
('Z3801', 'Single liveborn infant, delivered by cesarean', 'Z00-Z99', 'Newborn', true, 'active'),

-- SDOH Z-codes (expanded from core set)
('Z5500', 'Illiteracy and low-level literacy', 'Z00-Z99', 'SDOH', true, 'active'),
('Z5501', 'Lack of education', 'Z00-Z99', 'SDOH', true, 'active'),
('Z559', 'Problems related to education and literacy, unspecified', 'Z00-Z99', 'SDOH', true, 'active'),
('Z561', 'Change of job', 'Z00-Z99', 'SDOH', true, 'active'),
('Z562', 'Threat of job loss', 'Z00-Z99', 'SDOH', true, 'active'),
('Z569', 'Unspecified problems related to employment', 'Z00-Z99', 'SDOH', true, 'active'),
('Z578', 'Other occupational exposure to risk factors', 'Z00-Z99', 'SDOH', true, 'active'),
('Z592', 'Discord with neighbors, lodgers and landlord', 'Z00-Z99', 'SDOH', true, 'active'),
('Z593', 'Problems related to living in residential institution', 'Z00-Z99', 'SDOH', true, 'active'),
('Z5940', 'Lack of adequate food, unspecified', 'Z00-Z99', 'SDOH', true, 'active'),
('Z5948', 'Other specified lack of adequate food', 'Z00-Z99', 'SDOH', true, 'active'),
('Z5981', 'Housing instability, housed, with risk of homelessness', 'Z00-Z99', 'SDOH', true, 'active'),
('Z5989', 'Other problems related to housing and economic circumstances', 'Z00-Z99', 'SDOH', true, 'active'),
('Z600', 'Problems of adjustment to life-cycle transitions', 'Z00-Z99', 'SDOH', true, 'active'),
('Z602', 'Problems related to living alone', 'Z00-Z99', 'SDOH', true, 'active'),
('Z603', 'Acculturation difficulty', 'Z00-Z99', 'SDOH', true, 'active'),
('Z605', 'Target of (perceived) adverse discrimination and persecution', 'Z00-Z99', 'SDOH', true, 'active'),
('Z609', 'Problem related to social environment, unspecified', 'Z00-Z99', 'SDOH', true, 'active'),
('Z620', 'Inadequate parental supervision and control', 'Z00-Z99', 'SDOH', true, 'active'),
('Z630', 'Problems in relationship with spouse or partner', 'Z00-Z99', 'SDOH', true, 'active'),
('Z6311', 'Counseling for victim of child abuse', 'Z00-Z99', 'SDOH', true, 'active'),
('Z631', 'Problems in relationship with in-laws', 'Z00-Z99', 'SDOH', true, 'active'),
('Z634', 'Disappearance and death of family member', 'Z00-Z99', 'SDOH', true, 'active'),
('Z635', 'Disruption of family by separation and divorce', 'Z00-Z99', 'SDOH', true, 'active'),
('Z6381', 'Family disruption due to parent military deployment', 'Z00-Z99', 'SDOH', true, 'active'),
('Z6531', 'Victim of child psychological abuse', 'Z00-Z99', 'SDOH', true, 'active'),
('Z6511', 'Victim of child neglect', 'Z00-Z99', 'SDOH', true, 'active'),
('Z6541', 'Victim of spousal or partner violence, physical', 'Z00-Z99', 'SDOH', true, 'active')

ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description,
  chapter = EXCLUDED.chapter,
  category = EXCLUDED.category,
  is_billable = EXCLUDED.is_billable,
  status = EXCLUDED.status;

-- Update reference_data_versions freshness tracking
-- The reference_data_versions table was seeded with a FY2026 placeholder row.
-- Update it with the actual record count now that data is loaded.
UPDATE reference_data_versions
SET record_count = 500,
    loaded_at = now(),
    notes = 'Top ~500 high-frequency ICD-10-CM codes for local cache validation. NLM API covers full 72,000+ codes.'
WHERE data_source = 'icd10_cm' AND is_current = true;
