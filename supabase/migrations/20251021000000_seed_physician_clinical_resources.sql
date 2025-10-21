-- ============================================================================
-- Seed Physician Clinical Resources
-- ============================================================================
-- Purpose: Populate resilience_resources with evidence-based clinical resources
-- for physicians across 4 categories:
-- 1. Emergency Protocols
-- 2. Clinical Guidelines
-- 3. Formulary (Drug References)
-- 4. Specialist Directory (Templates & Resources)
-- ============================================================================

-- CATEGORY 1: EMERGENCY PROTOCOLS
-- ============================================================================

INSERT INTO resilience_resources (
  title,
  description,
  resource_type,
  url,
  categories,
  tags,
  target_audience,
  is_evidence_based,
  is_active,
  featured
) VALUES
(
  'ACLS (Advanced Cardiac Life Support) Guidelines - AHA',
  'American Heart Association evidence-based guidelines for adult cardiac arrest, stroke, and acute coronary syndromes.',
  'article',
  'https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines',
  ARRAY['emergency_protocols'],
  ARRAY['cardiac_arrest', 'acls', 'resuscitation', 'aha'],
  ARRAY['physician', 'all_providers'],
  true,
  true,
  true
),
(
  'PALS (Pediatric Advanced Life Support) Guidelines - AHA',
  'Evidence-based algorithms for pediatric cardiac arrest, shock, and respiratory emergencies.',
  'article',
  'https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines',
  ARRAY['emergency_protocols'],
  ARRAY['pediatric', 'pals', 'resuscitation', 'emergency'],
  ARRAY['physician', 'all_providers'],
  true,
  true,
  true
),
(
  'NIH Stroke Scale (NIHSS)',
  'Standardized neurological assessment tool for acute stroke evaluation and severity measurement.',
  'article',
  'https://www.ninds.nih.gov/health-information/public-education/know-stroke/health-professionals/nih-stroke-scale',
  ARRAY['emergency_protocols'],
  ARRAY['stroke', 'neurology', 'assessment', 'nih'],
  ARRAY['physician', 'all_providers'],
  true,
  true,
  false
),
(
  'Sepsis-3 & qSOFA Criteria',
  'Third International Consensus Definitions for Sepsis and Septic Shock with quick SOFA scoring.',
  'article',
  'https://www.survivingsepsis.org',
  ARRAY['emergency_protocols'],
  ARRAY['sepsis', 'infection', 'icu', 'critical_care'],
  ARRAY['physician', 'all_providers'],
  true,
  true,
  false
),
(
  'Trauma ATLS Guidelines - ACS',
  'American College of Surgeons Advanced Trauma Life Support systematic approach to trauma patients.',
  'article',
  'https://www.facs.org/quality-programs/trauma/education/atls',
  ARRAY['emergency_protocols'],
  ARRAY['trauma', 'emergency', 'atls', 'surgery'],
  ARRAY['physician', 'all_providers'],
  true,
  true,
  false
);

-- CATEGORY 2: CLINICAL GUIDELINES
-- ============================================================================

INSERT INTO resilience_resources (
  title,
  description,
  resource_type,
  url,
  categories,
  tags,
  target_audience,
  is_evidence_based,
  is_active,
  featured
) VALUES
(
  'CDC Clinical Guidelines & Recommendations',
  'Centers for Disease Control evidence-based clinical practice guidelines across all medical specialties.',
  'article',
  'https://www.cdc.gov/clinicians/guidelines-recommendations.html',
  ARRAY['clinical_guidelines'],
  ARRAY['cdc', 'evidence_based', 'guidelines', 'public_health'],
  ARRAY['physician', 'all_providers'],
  true,
  true,
  true
),
(
  'USPSTF Preventive Services Recommendations',
  'U.S. Preventive Services Task Force Grade A and B recommendations for screening and prevention.',
  'article',
  'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation-topics',
  ARRAY['clinical_guidelines'],
  ARRAY['prevention', 'screening', 'uspstf', 'primary_care'],
  ARRAY['physician', 'all_providers'],
  true,
  true,
  true
),
(
  'AHA/ACC Cardiovascular Guidelines',
  'American Heart Association and American College of Cardiology comprehensive cardiovascular practice guidelines.',
  'article',
  'https://www.acc.org/guidelines',
  ARRAY['clinical_guidelines'],
  ARRAY['cardiology', 'heart', 'aha', 'acc'],
  ARRAY['physician', 'all_providers'],
  true,
  true,
  false
),
(
  'ADA Diabetes Standards of Care',
  'American Diabetes Association annual comprehensive diabetes management guidelines.',
  'article',
  'https://diabetesjournals.org/care/issue/47/Supplement_1',
  ARRAY['clinical_guidelines'],
  ARRAY['diabetes', 'endocrinology', 'ada', 'chronic_disease'],
  ARRAY['physician', 'all_providers'],
  true,
  true,
  false
),
(
  'IDSA Infectious Disease Guidelines',
  'Infectious Diseases Society of America evidence-based antimicrobial and infection management guidelines.',
  'article',
  'https://www.idsociety.org/practice-guideline/practice-guidelines',
  ARRAY['clinical_guidelines'],
  ARRAY['infectious_disease', 'antibiotics', 'idsa', 'antimicrobial'],
  ARRAY['physician', 'all_providers'],
  true,
  true,
  false
),
(
  'CHEST Pulmonary & Critical Care Guidelines',
  'American College of Chest Physicians evidence-based guidelines for respiratory and critical care.',
  'article',
  'https://www.chestnet.org/Guidelines-and-Resources',
  ARRAY['clinical_guidelines'],
  ARRAY['pulmonary', 'critical_care', 'respiratory', 'chest'],
  ARRAY['physician', 'all_providers'],
  true,
  true,
  false
);

-- CATEGORY 3: FORMULARY (DRUG REFERENCES)
-- ============================================================================

INSERT INTO resilience_resources (
  title,
  description,
  resource_type,
  url,
  categories,
  tags,
  target_audience,
  is_evidence_based,
  is_active,
  featured
) VALUES
(
  'FDA Drugs Database - Official Drug Information',
  'FDA-approved drug labeling, indications, warnings, and black box alerts. The authoritative source.',
  'app',
  'https://www.fda.gov/drugs/drug-approvals-and-databases/drugsfda-data-files',
  ARRAY['formulary'],
  ARRAY['fda', 'medications', 'prescribing', 'drug_information'],
  ARRAY['physician', 'all_providers'],
  true,
  true,
  true
),
(
  'Epocrates Drug Reference (Free)',
  'Point-of-care drug reference with dosing, interactions, safety alerts, and pill identification.',
  'app',
  'https://www.epocrates.com',
  ARRAY['formulary'],
  ARRAY['drug_reference', 'dosing', 'interactions', 'epocrates'],
  ARRAY['physician', 'all_providers'],
  true,
  true,
  true
),
(
  'Beers Criteria - Potentially Inappropriate Medications in Older Adults',
  'AGS Beers Criteria for avoiding harmful medications in geriatric patients.',
  'article',
  'https://www.guidelinecentral.com/guideline/394',
  ARRAY['formulary'],
  ARRAY['geriatrics', 'elderly', 'polypharmacy', 'beers_criteria'],
  ARRAY['physician', 'all_providers'],
  true,
  true,
  false
),
(
  'Lexicomp Drug Interactions Checker',
  'Comprehensive drug-drug interaction database with clinical significance ratings.',
  'app',
  'https://www.wolterskluwer.com/en/solutions/lexicomp',
  ARRAY['formulary'],
  ARRAY['drug_interactions', 'pharmacology', 'lexicomp'],
  ARRAY['physician', 'all_providers'],
  true,
  true,
  false
),
(
  'NIH LactMed - Drugs and Lactation Database',
  'Evidence-based information on drug safety during breastfeeding.',
  'article',
  'https://www.ncbi.nlm.nih.gov/books/NBK501922',
  ARRAY['formulary'],
  ARRAY['lactation', 'breastfeeding', 'pregnancy', 'pediatrics'],
  ARRAY['physician', 'all_providers'],
  true,
  true,
  false
),
(
  'CDC Antibiotic Prescribing & Stewardship Guidelines',
  'Evidence-based antibiotic prescribing guidelines to combat resistance.',
  'article',
  'https://www.cdc.gov/antibiotic-use/hcp/index.html',
  ARRAY['formulary'],
  ARRAY['antibiotics', 'stewardship', 'resistance', 'antimicrobial'],
  ARRAY['physician', 'all_providers'],
  true,
  true,
  false
);

-- CATEGORY 4: SPECIALIST DIRECTORY (Templates & Referral Resources)
-- ============================================================================

INSERT INTO resilience_resources (
  title,
  description,
  resource_type,
  url,
  categories,
  tags,
  target_audience,
  is_evidence_based,
  is_active,
  featured
) VALUES
(
  'ABMS Board Certification Verification',
  'Verify specialist board certification through the American Board of Medical Specialties.',
  'app',
  'https://www.certificationmatters.org/find-my-doctor',
  ARRAY['specialist_directory'],
  ARRAY['board_certification', 'abms', 'credentialing', 'verification'],
  ARRAY['physician', 'all_providers'],
  true,
  true,
  true
),
(
  'AMA Physician Masterfile - Find a Doctor',
  'American Medical Association directory for physician lookup and credential verification.',
  'app',
  'https://www.ama-assn.org/practice-management/physician-data',
  ARRAY['specialist_directory'],
  ARRAY['physician_lookup', 'ama', 'credentials', 'directory'],
  ARRAY['physician', 'all_providers'],
  true,
  true,
  false
),
(
  'NPPES NPI Registry - Provider Lookup',
  'National Plan and Provider Enumeration System for NPI number verification and provider information.',
  'app',
  'https://npiregistry.cms.hhs.gov',
  ARRAY['specialist_directory'],
  ARRAY['npi', 'provider_lookup', 'cms', 'credentials'],
  ARRAY['physician', 'all_providers'],
  true,
  true,
  false
),
(
  'Subspecialty Referral Template',
  'Best practices for specialist referrals: required information, indications, and communication protocols.',
  'article',
  'https://www.aafp.org/family-physician/patient-care/care-resources/referrals.html',
  ARRAY['specialist_directory'],
  ARRAY['referrals', 'coordination', 'communication', 'aafp'],
  ARRAY['physician', 'all_providers'],
  true,
  true,
  false
);

-- ============================================================================
-- Verification Query
-- ============================================================================

-- To verify insertion:
-- SELECT title, categories, tags, target_audience, is_evidence_based
-- FROM resilience_resources
-- WHERE 'physician' = ANY(target_audience)
-- ORDER BY categories, featured DESC, title;
