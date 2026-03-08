-- =====================================================
-- Expand CPT and HCPCS Code Tables
-- Purpose: Add commonly used procedure codes beyond E/M
-- Covers: Surgery, Radiology, Lab, Cardiology, GI,
--         Orthopedics, Neurology, Pulmonary, Urology,
--         OB/GYN, Ophthalmology, Pathology, Anesthesia
-- Note: CPT codes are AMA-licensed. These are code
--       identifiers only (no proprietary descriptions).
--       Short descriptions are CMS-published HCPCS short
--       descriptors (public domain).
-- =====================================================

-- =====================================================
-- EXPANDED CPT CODES (~200 additional high-frequency)
-- =====================================================

INSERT INTO code_cpt (code, short_description, long_description, category, work_rvu, status)
VALUES
-- SURGERY - General (10)
('10021', 'FNA w/o image', 'Fine needle aspiration biopsy without imaging guidance', 'Surgery', 1.27, 'active'),
('10060', 'Drain skin abscess', 'Incision and drainage of abscess', 'Surgery', 2.20, 'active'),
('10120', 'Remove foreign body', 'Incision and removal of foreign body, subcutaneous', 'Surgery', 2.78, 'active'),
('10140', 'Drain hematoma', 'Incision and drainage of hematoma', 'Surgery', 2.39, 'active'),
('11042', 'Debride skin/subq', 'Debridement, subcutaneous tissue, first 20 sq cm', 'Surgery', 2.20, 'active'),
('11102', 'Tangential biopsy', 'Tangential biopsy of skin, single lesion', 'Surgery', 0.81, 'active'),
('11200', 'Removal skin tags', 'Removal of skin tags, up to 15', 'Surgery', 0.85, 'active'),
('12001', 'Simple repair 2.5cm', 'Simple repair of superficial wounds 2.5 cm or less', 'Surgery', 1.51, 'active'),
('12002', 'Simple repair 2.6-7.5cm', 'Simple repair of superficial wounds 2.6 to 7.5 cm', 'Surgery', 2.00, 'active'),
('12011', 'Simple repair face 2.5cm', 'Simple repair face/ears/eyelids/nose/lips 2.5 cm or less', 'Surgery', 1.80, 'active'),

-- SURGERY - Musculoskeletal (15)
('20610', 'Drain/inj major joint', 'Arthrocentesis, aspiration and/or injection, major joint', 'Surgery', 1.30, 'active'),
('20550', 'Inj tendon sheath', 'Injection(s), single tendon sheath or ligament', 'Surgery', 0.94, 'active'),
('23350', 'Inj shoulder joint', 'Injection procedure for shoulder arthrography', 'Surgery', 1.15, 'active'),
('27447', 'Total knee replacement', 'Arthroplasty, knee, condyle and plateau', 'Surgery', 22.75, 'active'),
('27130', 'Total hip replacement', 'Arthroplasty, acetabular and proximal femoral prosthetic replacement', 'Surgery', 22.13, 'active'),
('29881', 'Knee arthroscopy', 'Arthroscopy, knee, surgical; with meniscectomy', 'Surgery', 7.66, 'active'),
('29826', 'Shoulder arthroscopy', 'Arthroscopy, shoulder, surgical; decompression subacromial', 'Surgery', 9.28, 'active'),
('27245', 'Treat thigh fracture', 'Treatment of intertrochanteric fracture with plate/screw', 'Surgery', 14.68, 'active'),
('27236', 'Treat hip fracture', 'Open treatment femoral fracture, proximal end, neck', 'Surgery', 15.24, 'active'),
('25600', 'Treat wrist fracture', 'Closed treatment of distal radial fracture', 'Surgery', 3.58, 'active'),
('28470', 'Treat metatarsal fx', 'Closed treatment of metatarsal fracture without manipulation', 'Surgery', 1.62, 'active'),
('22551', 'Cervical spine fusion', 'Arthrodesis, anterior interbody, cervical below C2', 'Surgery', 25.00, 'active'),
('22612', 'Lumbar spine fusion', 'Arthrodesis, posterior or posterolateral technique, lumbar', 'Surgery', 24.00, 'active'),
('63030', 'Lumbar laminotomy', 'Laminotomy, single interspace, lumbar', 'Surgery', 13.18, 'active'),
('62322', 'Lumbar epidural inj', 'Injection, including indwelling catheter placement; lumbar/sacral', 'Surgery', 1.90, 'active'),

-- SURGERY - Cardiovascular (10)
('33533', 'CABG single', 'Coronary artery bypass, single arterial graft', 'Surgery', 33.75, 'active'),
('92928', 'Stent placement', 'Percutaneous transcatheter stent, single vessel', 'Surgery', 11.04, 'active'),
('92920', 'Coronary angioplasty', 'Percutaneous transluminal coronary angioplasty, single vessel', 'Surgery', 8.29, 'active'),
('36556', 'Insert CVP catheter', 'Insertion of non-tunneled centrally inserted central venous catheter', 'Surgery', 2.50, 'active'),
('36620', 'Arterial line', 'Arterial catheterization for sampling, monitoring, or transfusion', 'Surgery', 1.30, 'active'),
('33208', 'Pacemaker insert', 'Insertion of new permanent pacemaker', 'Surgery', 9.64, 'active'),
('34802', 'Endovascular AAA repair', 'Endovascular repair of infrarenal abdominal aortic aneurysm', 'Surgery', 25.00, 'active'),
('37228', 'Tibial angioplasty', 'Revascularization, tibial/peroneal artery, angioplasty', 'Surgery', 9.00, 'active'),
('93000', 'Electrocardiogram', 'Electrocardiogram, routine ECG with at least 12 leads', 'Cardiology', 0.17, 'active'),
('93010', 'ECG interpretation', 'Electrocardiogram, routine, interpretation and report only', 'Cardiology', 0.17, 'active'),

-- CARDIOLOGY - Diagnostic (12)
('93303', 'Echo transthoracic', 'Transthoracic echocardiography for congenital cardiac anomalies', 'Cardiology', 1.30, 'active'),
('93306', 'Echo TTE complete', 'Echocardiography, transthoracic, real-time with image documentation', 'Cardiology', 1.30, 'active'),
('93312', 'Echo transesophageal', 'Echocardiography, transesophageal, real-time with image documentation', 'Cardiology', 2.83, 'active'),
('93350', 'Echo stress', 'Echocardiography, transthoracic, during rest and cardiovascular stress test', 'Cardiology', 0.71, 'active'),
('93015', 'Stress test cardio', 'Cardiovascular stress test using maximal or submaximal treadmill', 'Cardiology', 0.75, 'active'),
('93451', 'Right heart cath', 'Right heart catheterization', 'Cardiology', 4.22, 'active'),
('93452', 'Left heart cath', 'Left heart catheterization', 'Cardiology', 6.00, 'active'),
('93224', 'Holter monitor 24hr', 'External electrocardiographic recording up to 48 hours', 'Cardiology', 0.52, 'active'),
('93880', 'Duplex carotid', 'Duplex scan of extracranial arteries', 'Cardiology', 0.50, 'active'),
('93970', 'Duplex venous extremity', 'Duplex scan of extremity veins', 'Cardiology', 0.45, 'active'),
('93971', 'Duplex venous unilat', 'Duplex scan of extremity veins, unilateral', 'Cardiology', 0.40, 'active'),
('93922', 'Extremity ABI study', 'Limited bilateral noninvasive physiologic studies of upper or lower extremity', 'Cardiology', 0.25, 'active'),

-- SURGERY - GI/Endoscopy (12)
('43239', 'Upper GI endoscopy bx', 'Esophagogastroduodenoscopy with biopsy', 'GI/Endoscopy', 3.13, 'active'),
('43235', 'Upper GI endoscopy dx', 'Esophagogastroduodenoscopy, diagnostic', 'GI/Endoscopy', 2.39, 'active'),
('45378', 'Colonoscopy dx', 'Colonoscopy, flexible, diagnostic', 'GI/Endoscopy', 3.69, 'active'),
('45380', 'Colonoscopy w biopsy', 'Colonoscopy, flexible, with biopsy', 'GI/Endoscopy', 4.43, 'active'),
('45385', 'Colonoscopy w polyp', 'Colonoscopy, flexible, with removal of polyp by snare', 'GI/Endoscopy', 5.30, 'active'),
('47562', 'Laparoscopic cholecystectomy', 'Laparoscopy, surgical, cholecystectomy', 'Surgery', 10.07, 'active'),
('44970', 'Laparoscopic appendectomy', 'Laparoscopy, surgical, appendectomy', 'Surgery', 9.27, 'active'),
('49505', 'Inguinal hernia repair', 'Repair initial inguinal hernia, age 5 or older', 'Surgery', 7.04, 'active'),
('49650', 'Lap inguinal hernia', 'Laparoscopy, surgical, repair initial inguinal hernia', 'Surgery', 8.67, 'active'),
('44180', 'Laparoscopic enterolysis', 'Laparoscopy, surgical, enterolysis', 'Surgery', 10.84, 'active'),
('43280', 'Laparoscopic fundoplasty', 'Laparoscopy, surgical, esophagogastric fundoplasty', 'Surgery', 13.50, 'active'),
('43246', 'EGD with PEG tube', 'Esophagogastroduodenoscopy with PEG tube placement', 'GI/Endoscopy', 4.00, 'active'),

-- SURGERY - OB/GYN (8)
('58558', 'Hysteroscopy biopsy', 'Hysteroscopy, surgical, with sampling of endometrium', 'OB/GYN', 4.30, 'active'),
('58571', 'Lap hysterectomy', 'Laparoscopy, surgical, with total hysterectomy', 'OB/GYN', 18.69, 'active'),
('59400', 'Routine OB care vaginal', 'Routine obstetric care including vaginal delivery', 'OB/GYN', 25.25, 'active'),
('59510', 'Routine OB care cesarean', 'Routine obstetric care including cesarean delivery', 'OB/GYN', 27.87, 'active'),
('59025', 'Fetal non-stress test', 'Fetal non-stress test', 'OB/GYN', 0.48, 'active'),
('76801', 'OB ultrasound 1st tri', 'Ultrasound, pregnant uterus, first trimester', 'OB/GYN', 1.20, 'active'),
('76805', 'OB ultrasound complete', 'Ultrasound, pregnant uterus, after first trimester', 'OB/GYN', 1.23, 'active'),
('76815', 'OB ultrasound limited', 'Ultrasound, pregnant uterus, limited', 'OB/GYN', 0.64, 'active'),

-- SURGERY - Urology (6)
('52000', 'Cystoscopy', 'Cystourethroscopy', 'Urology', 2.23, 'active'),
('52310', 'Cystoscopy w stent', 'Cystourethroscopy, with removal of foreign body or stent', 'Urology', 3.10, 'active'),
('55700', 'Prostate biopsy', 'Biopsy, prostate; needle or punch', 'Urology', 3.22, 'active'),
('50590', 'Lithotripsy', 'Lithotripsy, extracorporeal shock wave', 'Urology', 8.55, 'active'),
('52601', 'TURP', 'Transurethral electrosurgical resection of prostate', 'Urology', 15.26, 'active'),
('52648', 'Laser prostate', 'Laser vaporization of prostate', 'Urology', 12.00, 'active'),

-- RADIOLOGY - Diagnostic (15)
('71046', 'Chest X-ray 2 views', 'Radiologic examination, chest, 2 views', 'Radiology', 0.18, 'active'),
('71045', 'Chest X-ray 1 view', 'Radiologic examination, chest, single view', 'Radiology', 0.15, 'active'),
('73030', 'Shoulder X-ray', 'Radiologic examination, shoulder, complete', 'Radiology', 0.17, 'active'),
('73560', 'Knee X-ray', 'Radiologic examination, knee, 1 or 2 views', 'Radiology', 0.14, 'active'),
('73610', 'Ankle X-ray', 'Radiologic examination, ankle, complete', 'Radiology', 0.15, 'active'),
('72100', 'Spine L-S X-ray', 'Radiologic examination, spine, lumbosacral, 2 or 3 views', 'Radiology', 0.20, 'active'),
('70553', 'Brain MRI w/wo contrast', 'Magnetic resonance imaging, brain, without contrast then with contrast', 'Radiology', 1.52, 'active'),
('72148', 'Lumbar MRI w/o contrast', 'Magnetic resonance imaging, spinal canal lumbar, without contrast', 'Radiology', 1.36, 'active'),
('72141', 'Cervical MRI w/o contrast', 'Magnetic resonance imaging, spinal canal cervical, without contrast', 'Radiology', 1.36, 'active'),
('74177', 'CT abdomen/pelvis w contrast', 'Computed tomography, abdomen and pelvis, with contrast', 'Radiology', 1.74, 'active'),
('74176', 'CT abdomen/pelvis w/o contrast', 'CT abdomen and pelvis without contrast', 'Radiology', 1.40, 'active'),
('70551', 'Brain MRI w/o contrast', 'Magnetic resonance imaging, brain, without contrast', 'Radiology', 1.28, 'active'),
('71250', 'CT chest w/o contrast', 'Computed tomography, thorax, without contrast', 'Radiology', 1.24, 'active'),
('71260', 'CT chest w contrast', 'Computed tomography, thorax, with contrast', 'Radiology', 1.38, 'active'),
('77067', 'Screening mammography', 'Screening mammography, bilateral, including computer-aided detection', 'Radiology', 0.70, 'active'),

-- RADIOLOGY - Ultrasound (6)
('76700', 'US abdomen complete', 'Ultrasound, abdominal, real time, complete', 'Radiology', 0.81, 'active'),
('76856', 'US pelvis complete', 'Ultrasound, pelvic, real time, complete', 'Radiology', 0.69, 'active'),
('76536', 'US soft tissue head/neck', 'Ultrasound, soft tissues of head and neck', 'Radiology', 0.56, 'active'),
('93976', 'US duplex aorta/iliac', 'Duplex scan of arterial inflow and venous outflow of abdominal organs', 'Radiology', 0.45, 'active'),
('76830', 'US transvaginal', 'Ultrasound, transvaginal', 'Radiology', 0.69, 'active'),
('76770', 'US retroperitoneal', 'Ultrasound, retroperitoneal, real time, complete', 'Radiology', 0.74, 'active'),

-- LABORATORY - Common (20)
('80048', 'BMP', 'Basic metabolic panel', 'Lab', 0.00, 'active'),
('80053', 'CMP', 'Comprehensive metabolic panel', 'Lab', 0.00, 'active'),
('85025', 'CBC w diff', 'Complete blood count with automated differential', 'Lab', 0.00, 'active'),
('85027', 'CBC w/o diff', 'Complete blood count, automated', 'Lab', 0.00, 'active'),
('80061', 'Lipid panel', 'Lipid panel', 'Lab', 0.00, 'active'),
('84443', 'TSH', 'Thyroid stimulating hormone (TSH)', 'Lab', 0.00, 'active'),
('83036', 'HbA1c', 'Hemoglobin; glycosylated (A1c)', 'Lab', 0.00, 'active'),
('82947', 'Glucose', 'Glucose, quantitative, blood', 'Lab', 0.00, 'active'),
('82565', 'Creatinine', 'Creatinine; blood', 'Lab', 0.00, 'active'),
('84132', 'Potassium', 'Potassium, serum', 'Lab', 0.00, 'active'),
('85610', 'PT/INR', 'Prothrombin time', 'Lab', 0.00, 'active'),
('85730', 'PTT', 'Thromboplastin time, partial (PTT)', 'Lab', 0.00, 'active'),
('82550', 'CK/CPK', 'Creatine kinase (CK)', 'Lab', 0.00, 'active'),
('83540', 'Iron', 'Iron', 'Lab', 0.00, 'active'),
('82248', 'Bilirubin direct', 'Bilirubin, direct', 'Lab', 0.00, 'active'),
('82040', 'Albumin', 'Albumin, serum, plasma, or whole blood', 'Lab', 0.00, 'active'),
('84153', 'PSA', 'Prostate specific antigen (PSA), total', 'Lab', 0.00, 'active'),
('86850', 'Antibody screen RBC', 'Antibody screen, RBC, each serum technique', 'Lab', 0.00, 'active'),
('87086', 'Urine culture', 'Culture, bacterial; quantitative colony count, urine', 'Lab', 0.00, 'active'),
('87081', 'Culture screen', 'Culture, presumptive, pathogenic organisms, screening only', 'Lab', 0.00, 'active'),

-- LABORATORY - Specialized (10)
('80076', 'Hepatic function panel', 'Hepatic function panel', 'Lab', 0.00, 'active'),
('82306', 'Vitamin D 25-OH', 'Vitamin D; 25 hydroxy', 'Lab', 0.00, 'active'),
('82728', 'Ferritin', 'Ferritin', 'Lab', 0.00, 'active'),
('84439', 'Free T4', 'Thyroxine; free', 'Lab', 0.00, 'active'),
('86140', 'C-reactive protein', 'C-reactive protein', 'Lab', 0.00, 'active'),
('82785', 'Gammaglobulin IgE', 'Gammaglobulin (immunoglobulin); IgE', 'Lab', 0.00, 'active'),
('84550', 'Uric acid blood', 'Uric acid; blood', 'Lab', 0.00, 'active'),
('82670', 'Estradiol', 'Estradiol', 'Lab', 0.00, 'active'),
('84402', 'Testosterone free', 'Testosterone; free', 'Lab', 0.00, 'active'),
('86235', 'Nuclear antigen antibody', 'Nuclear antigen antibody (ANA)', 'Lab', 0.00, 'active'),

-- PATHOLOGY (5)
('88305', 'Tissue exam by pathologist', 'Level IV - Surgical pathology, gross and microscopic examination', 'Pathology', 1.10, 'active'),
('88312', 'Special stain group 1', 'Special stain including interpretation and report; Group I', 'Pathology', 0.78, 'active'),
('88342', 'Immunohistochem stain', 'Immunohistochemistry or immunocytochemistry, per specimen', 'Pathology', 1.10, 'active'),
('88307', 'Tissue exam complex', 'Level V - Surgical pathology, gross and microscopic examination', 'Pathology', 2.05, 'active'),
('88108', 'Cytopathology smear', 'Cytopathology, concentration technique, smears and interpretation', 'Pathology', 0.48, 'active'),

-- NEUROLOGY (8)
('95819', 'EEG awake/asleep', 'Electroencephalogram, including recording awake and asleep', 'Neurology', 1.56, 'active'),
('95907', 'NCV 1-2 nerves', 'Nerve conduction studies; 1-2 studies', 'Neurology', 0.94, 'active'),
('95910', 'NCV 5-6 nerves', 'Nerve conduction studies; 5-6 studies', 'Neurology', 1.76, 'active'),
('95861', 'EMG 2 extremities', 'Needle electromyography; 2 extremities with or without related paraspinal areas', 'Neurology', 1.53, 'active'),
('95816', 'EEG awake/drowsy', 'Electroencephalogram, including recording awake and drowsy', 'Neurology', 1.35, 'active'),
('95004', 'Allergy skin test', 'Percutaneous tests (scratch, puncture, prick) with allergenic extracts', 'Allergy', 0.02, 'active'),
('96116', 'Neurobehavioral exam', 'Neurobehavioral status exam, first hour', 'Neurology', 2.32, 'active'),
('96132', 'Neuropsych testing', 'Neuropsychological testing evaluation services, first hour', 'Neurology', 3.18, 'active'),

-- PULMONARY (5)
('94010', 'Spirometry', 'Spirometry, including graphic record', 'Pulmonary', 0.17, 'active'),
('94060', 'Bronchodilation study', 'Bronchodilation responsiveness, spirometry pre and post', 'Pulmonary', 0.28, 'active'),
('94660', 'CPAP/BiPAP initiation', 'Continuous positive airway pressure ventilation, initiation', 'Pulmonary', 1.99, 'active'),
('94761', 'Pulse oximetry', 'Pulse oximetry; multiple determinations', 'Pulmonary', 0.00, 'active'),
('94726', 'Plethysmography', 'Plethysmography for determination of lung volumes', 'Pulmonary', 0.27, 'active'),

-- OPHTHALMOLOGY (6)
('92004', 'Comprehensive eye exam new', 'Ophthalmological services: comprehensive, new patient', 'Ophthalmology', 1.67, 'active'),
('92014', 'Comprehensive eye exam est', 'Ophthalmological services: comprehensive, established patient', 'Ophthalmology', 1.10, 'active'),
('92250', 'Fundus photography', 'Fundus photography with interpretation and report', 'Ophthalmology', 0.25, 'active'),
('66984', 'Cataract removal', 'Extracapsular cataract removal with insertion of intraocular lens', 'Ophthalmology', 10.26, 'active'),
('67028', 'Intravitreal injection', 'Intravitreal injection of a pharmacologic agent', 'Ophthalmology', 1.44, 'active'),
('92083', 'Visual field exam', 'Visual field examination, unilateral or bilateral', 'Ophthalmology', 0.50, 'active'),

-- ANESTHESIA SUPPORT (4)
('36415', 'Venipuncture', 'Collection of venous blood by venipuncture', 'Lab', 0.00, 'active'),
('36416', 'Capillary blood draw', 'Collection of capillary blood specimen', 'Lab', 0.00, 'active'),
('96360', 'IV infusion hydration init', 'Intravenous infusion, hydration; initial, 31 min to 1 hr', 'Infusion', 0.17, 'active'),
('96365', 'IV infusion therapy init', 'Intravenous infusion, for therapy, prophylaxis, or diagnosis; initial, up to 1 hr', 'Infusion', 0.21, 'active'),

-- WOUND CARE (5)
('97597', 'Debridement 20 sq cm', 'Debridement, open wound, selective, first 20 sq cm', 'Wound Care', 0.95, 'active'),
('97598', 'Debridement addl 20 sq cm', 'Debridement, open wound, each additional 20 sq cm', 'Wound Care', 0.38, 'active'),
('97602', 'Wound care non-selective', 'Removal of devitalized tissue from wound(s), non-selective debridement', 'Wound Care', 0.00, 'active'),
('97605', 'Neg pressure wound tx', 'Negative pressure wound therapy, surface area less than 50 sq cm', 'Wound Care', 0.60, 'active'),
('97610', 'Low freq US wound tx', 'Low frequency, non-contact, non-thermal ultrasound wound management', 'Wound Care', 0.30, 'active')

ON CONFLICT (code) DO UPDATE SET
  short_description = COALESCE(EXCLUDED.short_description, code_cpt.short_description),
  long_description = COALESCE(EXCLUDED.long_description, code_cpt.long_description),
  category = COALESCE(EXCLUDED.category, code_cpt.category),
  work_rvu = COALESCE(EXCLUDED.work_rvu, code_cpt.work_rvu),
  status = COALESCE(EXCLUDED.status, code_cpt.status);

-- =====================================================
-- EXPANDED HCPCS CODES (~100 additional high-frequency)
-- =====================================================

INSERT INTO code_hcpcs (code, short_description, long_description, status)
VALUES
-- DRUGS - Injectable/Infusion (20)
('J0171', 'Adrenalin epinephrin inj', 'Injection, adrenalin, epinephrine, 0.1 mg', 'active'),
('J0878', 'Daptomycin injection', 'Injection, daptomycin, 1 mg', 'active'),
('J1030', 'Methylprednisolone 40mg', 'Injection, methylprednisolone acetate, 40 mg', 'active'),
('J1040', 'Methylprednisolone 80mg', 'Injection, methylprednisolone acetate, 80 mg', 'active'),
('J1100', 'Dexamethasone inject', 'Injection, dexamethasone sodium phosphate, 1 mg', 'active'),
('J1200', 'Diphenhydramine 50mg', 'Injection, diphenhydramine HCl, up to 50 mg', 'active'),
('J1644', 'Heparin per 1000 units', 'Injection, heparin sodium, per 1000 units', 'active'),
('J1885', 'Ketorolac per 15mg', 'Injection, ketorolac tromethamine, per 15 mg', 'active'),
('J2001', 'Lidocaine injection', 'Injection, lidocaine HCl for intravenous infusion, 10 mg', 'active'),
('J2060', 'Lorazepam injection', 'Injection, lorazepam, 2 mg', 'active'),
('J2175', 'Meperidine per 100mg', 'Injection, meperidine hydrochloride, per 100 mg', 'active'),
('J2250', 'Midazolam injection', 'Injection, midazolam hydrochloride, per 1 mg', 'active'),
('J2270', 'Morphine sulfate inj', 'Injection, morphine sulfate, up to 10 mg', 'active'),
('J2405', 'Ondansetron inject', 'Injection, ondansetron hydrochloride, per 1 mg', 'active'),
('J2550', 'Promethazine inject', 'Injection, promethazine HCl, up to 50 mg', 'active'),
('J2765', 'Metoclopramide inj', 'Injection, metoclopramide HCl, up to 10 mg', 'active'),
('J2920', 'Methylprednisolone IV', 'Injection, methylprednisolone sodium succinate, up to 40 mg', 'active'),
('J2930', 'Methylprednisolone IV 125mg', 'Injection, methylprednisolone sodium succinate, up to 125 mg', 'active'),
('J3010', 'Fentanyl citrate inj', 'Injection, fentanyl citrate, 0.1 mg', 'active'),
('J3301', 'Triamcinolone 10mg', 'Injection, triamcinolone acetonide, per 10 mg', 'active'),

-- DRUGS - Biologics/Specialty (10)
('J0135', 'Adalimumab injection', 'Injection, adalimumab, 20 mg', 'active'),
('J0717', 'Certolizumab pegol', 'Injection, certolizumab pegol, 1 mg', 'active'),
('J1300', 'Eculizumab injection', 'Injection, eculizumab, 10 mg', 'active'),
('J1745', 'Infliximab injection', 'Injection, infliximab, 10 mg', 'active'),
('J2350', 'Ocrelizumab injection', 'Injection, ocrelizumab, 1 mg', 'active'),
('J2507', 'Pegloticase injection', 'Injection, pegloticase, 1 mg', 'active'),
('J9035', 'Bevacizumab injection', 'Injection, bevacizumab, 10 mg', 'active'),
('J9041', 'Bortezomib injection', 'Injection, bortezomib, 0.1 mg', 'active'),
('J9271', 'Pembrolizumab inj', 'Injection, pembrolizumab, 1 mg', 'active'),
('J9299', 'Nivolumab injection', 'Injection, nivolumab, 1 mg', 'active'),

-- IMMUNIZATIONS (10)
('90658', 'Flu vaccine IM', 'Influenza virus vaccine, trivalent, split virus, IM', 'active'),
('90670', 'Pneumococcal vaccine PCV13', 'Pneumococcal conjugate vaccine, 13 valent, IM', 'active'),
('90732', 'Pneumococcal vaccine PPSV23', 'Pneumococcal polysaccharide vaccine, 23 valent, SC/IM', 'active'),
('90746', 'Hep B vaccine adult', 'Hepatitis B vaccine, adult dosage, IM', 'active'),
('90707', 'MMR vaccine', 'Measles, mumps, rubella virus vaccine, SC', 'active'),
('90715', 'Tdap vaccine', 'Tetanus, diphtheria, acellular pertussis vaccine, IM', 'active'),
('90750', 'Zoster vaccine recomb', 'Zoster (shingles) vaccine, recombinant, adjuvanted, IM', 'active'),
('90651', 'HPV vaccine 9-valent', 'Human papillomavirus vaccine, 9 valent, IM', 'active'),
('90460', 'Immunization admin 1st', 'Immunization administration first/only component, each vaccine', 'active'),
('90471', 'Immunization admin inject', 'Immunization administration, injection, 1 vaccine', 'active'),

-- DME - Respiratory (8)
('E0424', 'Stationary compressed O2', 'Stationary compressed gaseous oxygen system, rental', 'active'),
('E0431', 'Portable O2 gaseous', 'Portable gaseous oxygen system, rental', 'active'),
('E0260', 'Hospital bed semi-elec', 'Hospital bed, semi-electric, rental', 'active'),
('E0601', 'CPAP device', 'Continuous positive airway pressure (CPAP) device', 'active'),
('E0470', 'RAD device BiPAP', 'Respiratory assist device, bi-level without backup rate', 'active'),
('A7034', 'CPAP nasal mask', 'Nasal interface for positive airway pressure device', 'active'),
('A7035', 'Headgear for CPAP', 'Headgear used with positive airway pressure device', 'active'),
('A7037', 'CPAP tubing', 'Tubing used with positive airway pressure device', 'active'),

-- DME - Mobility (8)
('E0143', 'Walker folding', 'Walker, folding, wheeled, adjustable', 'active'),
('E0105', 'Cane quad/tripod', 'Cane, quad or three prong', 'active'),
('E0110', 'Crutches forearm', 'Crutches, forearm, includes crutches of various materials', 'active'),
('E0130', 'Walker rigid', 'Walker, rigid, adjustable or fixed height', 'active'),
('K0001', 'Standard wheelchair', 'Standard wheelchair', 'active'),
('K0003', 'Lightweight wheelchair', 'Lightweight wheelchair', 'active'),
('K0004', 'High strength wheelchair', 'High strength, lightweight wheelchair', 'active'),
('K0823', 'Power wheelchair GP', 'Power wheelchair, group 2, patient weight capacity up to and including 300 lbs', 'active'),

-- DME - Orthotic/Prosthetic (8)
('L0180', 'Cervical collar', 'Cervical, semi-rigid, adjustable', 'active'),
('L0220', 'Thoraco-lumbar-sacral', 'Thoraco-lumbar-sacral orthosis (TLSO), custom fabricated', 'active'),
('L0631', 'Lumbar-sacral orthosis', 'Lumbar-sacral orthosis, sagittal control, rigid posterior frame', 'active'),
('L1832', 'Knee orthosis', 'Knee orthosis, adjustable knee joints, rigid', 'active'),
('L3000', 'Foot insert', 'Foot insert, removable, molded to patient model', 'active'),
('L3020', 'Heel/sole insert', 'Foot, insert, removable, formed to patient foot, longitudinal arch support', 'active'),
('L3908', 'Wrist hand orthosis', 'Wrist hand orthosis, includes fitting and adjustment', 'active'),
('L5301', 'Below knee prosthesis', 'Below knee, molded socket, shin, SACH foot, endoskeletal system', 'active'),

-- SUPPLIES - General (10)
('A4253', 'Blood glucose strips', 'Blood glucose test or reagent strips for home blood glucose monitor, per 50 strips', 'active'),
('A4259', 'Lancets per box', 'Lancets, per box of 100', 'active'),
('A6216', 'Gauze pad 4x4 sterile', 'Gauze, non-impregnated, sterile, pad size 16 sq in or less, each dressing', 'active'),
('A6250', 'Skin sealant', 'Skin sealants, protectants, moisturizers, ointments, per oz', 'active'),
('A4550', 'Surgical trays', 'Surgical trays', 'active'),
('A4649', 'Surgical supply misc', 'Surgical supply; miscellaneous', 'active'),
('A4206', 'Syringe/needle sterile', 'Syringe with needle, sterile, 1 cc or less, each', 'active'),
('A4217', 'Sterile water/saline 500ml', 'Sterile water/saline, 500 ml', 'active'),
('A4310', 'Insertion tray w/o bag', 'Insertion tray without drainage bag and without catheter', 'active'),
('A4338', 'Indwelling catheter', 'Indwelling catheter; Foley type, two-way latex', 'active'),

-- TRANSPORT & AMBULANCE (6)
('A0425', 'Ground mileage', 'Ground mileage, per statute mile', 'active'),
('A0427', 'ALS1 emergency', 'Ambulance service, advanced life support, level 1 (ALS 1), emergency', 'active'),
('A0429', 'BLS emergency', 'Ambulance service, basic life support (BLS), emergency', 'active'),
('A0428', 'BLS non-emergency', 'Ambulance service, basic life support (BLS), non-emergency transport', 'active'),
('A0426', 'ALS1 non-emergency', 'Ambulance service, advanced life support, level 1 (ALS 1), non-emergency', 'active'),
('A0433', 'ALS2', 'Ambulance service, advanced life support, level 2 (ALS 2)', 'active'),

-- TELEHEALTH & REMOTE MONITORING (6)
('G2012', 'Virtual check-in', 'Brief communication technology-based service, 5-10 min', 'active'),
('G2010', 'Remote eval patient', 'Remote evaluation of recorded video and/or images', 'active'),
('G0071', 'Virtual visit FQHC', 'Payment for communication technology-based services for 5 min or more, FQHC', 'active'),
('G2250', 'Remote therapeutic monitor setup', 'Remote therapeutic monitoring, initial setup and patient education', 'active'),
('G2251', 'Remote therapeutic monitor', 'Brief communication technology-based service, remote therapeutic monitoring', 'active'),
('G0108', 'Diabetes outpt self-mgmt', 'Diabetes outpatient self-management training services, individual, per 30 min', 'active')

ON CONFLICT (code) DO UPDATE SET
  short_description = COALESCE(EXCLUDED.short_description, code_hcpcs.short_description),
  long_description = COALESCE(EXCLUDED.long_description, code_hcpcs.long_description),
  status = COALESCE(EXCLUDED.status, code_hcpcs.status);

-- =====================================================
-- UPDATE REFERENCE DATA VERSIONS
-- =====================================================

UPDATE reference_data_versions
SET record_count = (SELECT COUNT(*) FROM code_cpt WHERE status = 'active'),
    loaded_at = now(),
    notes = 'CMS CPT codes seeded. Includes E/M, surgery, radiology, lab, cardiology, GI, orthopedics, OB/GYN, urology, neurology, pulmonary, ophthalmology, pathology, wound care.'
WHERE data_source = 'cpt';

UPDATE reference_data_versions
SET record_count = (SELECT COUNT(*) FROM code_hcpcs WHERE status = 'active'),
    loaded_at = now(),
    notes = 'CMS HCPCS Level II codes seeded. Includes injectable drugs, biologics, immunizations, DME (respiratory, mobility, orthotics), supplies, transport, telehealth.'
WHERE data_source = 'hcpcs';
