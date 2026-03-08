// =====================================================
// MCP NPI Registry Server — Healthcare Taxonomy Codes
// NUCC Health Care Provider Taxonomy Code Set v26.0
// Source: https://nucc.org/index.php/code-sets-mainmenu-41
// =====================================================

interface TaxonomyEntry {
  code: string;
  type: string;
  classification: string;
  specialization?: string;
}

export const TAXONOMY_CODES: Record<string, TaxonomyEntry> = {
  // =====================================================
  // ALLOPATHIC & OSTEOPATHIC PHYSICIANS (20)
  // =====================================================
  "allergy_immunology": { code: "207K00000X", type: "individual", classification: "Allergy & Immunology" },
  "anesthesiology": { code: "207L00000X", type: "individual", classification: "Anesthesiology" },
  "cardiology": { code: "207RC0000X", type: "individual", classification: "Internal Medicine", specialization: "Cardiovascular Disease" },
  "colon_rectal_surgery": { code: "208C00000X", type: "individual", classification: "Colon & Rectal Surgery" },
  "critical_care": { code: "207RI0200X", type: "individual", classification: "Internal Medicine", specialization: "Critical Care Medicine" },
  "dermatology": { code: "207N00000X", type: "individual", classification: "Dermatology" },
  "emergency_medicine": { code: "207P00000X", type: "individual", classification: "Emergency Medicine" },
  "endocrinology": { code: "207RE0101X", type: "individual", classification: "Internal Medicine", specialization: "Endocrinology, Diabetes & Metabolism" },
  "family_medicine": { code: "207Q00000X", type: "individual", classification: "Family Medicine" },
  "gastroenterology": { code: "207RG0100X", type: "individual", classification: "Internal Medicine", specialization: "Gastroenterology" },
  "general_practice": { code: "208D00000X", type: "individual", classification: "General Practice" },
  "general_surgery": { code: "208600000X", type: "individual", classification: "Surgery" },
  "geriatric_medicine": { code: "207RG0300X", type: "individual", classification: "Internal Medicine", specialization: "Geriatric Medicine" },
  "hematology": { code: "207RH0000X", type: "individual", classification: "Internal Medicine", specialization: "Hematology" },
  "hospice_palliative": { code: "207RH0003X", type: "individual", classification: "Internal Medicine", specialization: "Hospice and Palliative Medicine" },
  "hospitalist": { code: "207RI0008X", type: "individual", classification: "Internal Medicine", specialization: "Hospitalist" },
  "infectious_disease": { code: "207RI0001X", type: "individual", classification: "Internal Medicine", specialization: "Infectious Disease" },
  "internal_medicine": { code: "207R00000X", type: "individual", classification: "Internal Medicine" },
  "interventional_cardiology": { code: "207RI0011X", type: "individual", classification: "Internal Medicine", specialization: "Interventional Cardiology" },
  "medical_genetics": { code: "207SG0201X", type: "individual", classification: "Medical Genetics", specialization: "Clinical Genetics (M.D.)" },
  "neonatal_perinatal": { code: "2080N0001X", type: "individual", classification: "Pediatrics", specialization: "Neonatal-Perinatal Medicine" },
  "nephrology": { code: "207RN0300X", type: "individual", classification: "Internal Medicine", specialization: "Nephrology" },
  "neurological_surgery": { code: "207T00000X", type: "individual", classification: "Neurological Surgery" },
  "neurology": { code: "2084N0400X", type: "individual", classification: "Psychiatry & Neurology", specialization: "Neurology" },
  "nuclear_medicine": { code: "207U00000X", type: "individual", classification: "Nuclear Medicine" },
  "ob_gyn": { code: "207V00000X", type: "individual", classification: "Obstetrics & Gynecology" },
  "oncology": { code: "207RX0202X", type: "individual", classification: "Internal Medicine", specialization: "Medical Oncology" },
  "ophthalmology": { code: "207W00000X", type: "individual", classification: "Ophthalmology" },
  "orthopedic_surgery": { code: "207X00000X", type: "individual", classification: "Orthopaedic Surgery" },
  "otolaryngology": { code: "207Y00000X", type: "individual", classification: "Otolaryngology" },
  "pain_medicine": { code: "208VP0014X", type: "individual", classification: "Pain Medicine" },
  "pathology": { code: "207ZP0101X", type: "individual", classification: "Pathology", specialization: "Anatomic Pathology" },
  "pediatrics": { code: "208000000X", type: "individual", classification: "Pediatrics" },
  "pediatric_cardiology": { code: "2080P0006X", type: "individual", classification: "Pediatrics", specialization: "Pediatric Cardiology" },
  "pediatric_surgery": { code: "2080T0004X", type: "individual", classification: "Pediatrics", specialization: "Pediatric Surgery" },
  "physical_medicine_rehab": { code: "208100000X", type: "individual", classification: "Physical Medicine & Rehabilitation" },
  "plastic_surgery": { code: "208200000X", type: "individual", classification: "Plastic Surgery" },
  "preventive_medicine": { code: "208300000X", type: "individual", classification: "Preventive Medicine" },
  "psychiatry": { code: "2084P0800X", type: "individual", classification: "Psychiatry & Neurology", specialization: "Psychiatry" },
  "child_psychiatry": { code: "2084P0802X", type: "individual", classification: "Psychiatry & Neurology", specialization: "Child & Adolescent Psychiatry" },
  "pulmonology": { code: "207RP1001X", type: "individual", classification: "Internal Medicine", specialization: "Pulmonary Disease" },
  "radiation_oncology": { code: "2085R0001X", type: "individual", classification: "Radiology", specialization: "Radiation Oncology" },
  "radiology": { code: "2085R0202X", type: "individual", classification: "Radiology", specialization: "Diagnostic Radiology" },
  "interventional_radiology": { code: "2085R0204X", type: "individual", classification: "Radiology", specialization: "Vascular & Interventional Radiology" },
  "rheumatology": { code: "207RR0500X", type: "individual", classification: "Internal Medicine", specialization: "Rheumatology" },
  "sleep_medicine": { code: "207RS0012X", type: "individual", classification: "Internal Medicine", specialization: "Sleep Medicine" },
  "sports_medicine": { code: "204R00000X", type: "individual", classification: "Sports Medicine" },
  "thoracic_surgery": { code: "208G00000X", type: "individual", classification: "Thoracic Surgery (Cardiothoracic Vascular Surgery)" },
  "urology": { code: "208800000X", type: "individual", classification: "Urology" },
  "vascular_surgery": { code: "208VP0000X", type: "individual", classification: "Vascular Surgery" },

  // =====================================================
  // DENTAL PROVIDERS (10)
  // =====================================================
  "dentist_general": { code: "1223G0001X", type: "individual", classification: "Dentist", specialization: "General Practice" },
  "endodontics": { code: "1223E0200X", type: "individual", classification: "Dentist", specialization: "Endodontics" },
  "oral_surgery": { code: "1223S0112X", type: "individual", classification: "Dentist", specialization: "Oral & Maxillofacial Surgery" },
  "orthodontics": { code: "1223X0008X", type: "individual", classification: "Dentist", specialization: "Orthodontics and Dentofacial Orthopedics" },
  "pediatric_dentistry": { code: "1223P0221X", type: "individual", classification: "Dentist", specialization: "Pediatric Dentistry" },
  "periodontics": { code: "1223P0300X", type: "individual", classification: "Dentist", specialization: "Periodontics" },
  "prosthodontics": { code: "1223P0700X", type: "individual", classification: "Dentist", specialization: "Prosthodontics" },
  "dental_hygienist": { code: "124Q00000X", type: "individual", classification: "Dental Hygienist" },
  "dental_assistant": { code: "126800000X", type: "individual", classification: "Dental Assistant" },
  "dental_lab_tech": { code: "126900000X", type: "individual", classification: "Dental Laboratory Technician" },

  // =====================================================
  // NURSING PROVIDERS (15)
  // =====================================================
  "nursing": { code: "163W00000X", type: "individual", classification: "Registered Nurse" },
  "nurse_practitioner": { code: "363L00000X", type: "individual", classification: "Nurse Practitioner" },
  "nurse_practitioner_family": { code: "363LF0000X", type: "individual", classification: "Nurse Practitioner", specialization: "Family" },
  "nurse_practitioner_adult": { code: "363LA2100X", type: "individual", classification: "Nurse Practitioner", specialization: "Acute Care" },
  "nurse_practitioner_gerontology": { code: "363LG0600X", type: "individual", classification: "Nurse Practitioner", specialization: "Gerontology" },
  "nurse_practitioner_pediatrics": { code: "363LP0200X", type: "individual", classification: "Nurse Practitioner", specialization: "Pediatrics" },
  "nurse_practitioner_psych": { code: "363LP0808X", type: "individual", classification: "Nurse Practitioner", specialization: "Psychiatric/Mental Health" },
  "nurse_practitioner_womens": { code: "363LW0102X", type: "individual", classification: "Nurse Practitioner", specialization: "Women's Health" },
  "nurse_anesthetist": { code: "367500000X", type: "individual", classification: "Certified Registered Nurse Anesthetist" },
  "nurse_midwife": { code: "367A00000X", type: "individual", classification: "Certified Nurse Midwife" },
  "clinical_nurse_specialist": { code: "364S00000X", type: "individual", classification: "Clinical Nurse Specialist" },
  "licensed_practical_nurse": { code: "164W00000X", type: "individual", classification: "Licensed Practical Nurse" },
  "licensed_vocational_nurse": { code: "164X00000X", type: "individual", classification: "Licensed Vocational Nurse" },
  "nursing_aide": { code: "376G00000X", type: "individual", classification: "Nursing Home Administrator" },
  "home_health_aide": { code: "374700000X", type: "individual", classification: "Home Health Aide" },

  // =====================================================
  // PHYSICIAN ASSISTANTS (3)
  // =====================================================
  "physician_assistant": { code: "363A00000X", type: "individual", classification: "Physician Assistant" },
  "physician_assistant_medical": { code: "363AM0700X", type: "individual", classification: "Physician Assistant", specialization: "Medical" },
  "physician_assistant_surgical": { code: "363AS0400X", type: "individual", classification: "Physician Assistant", specialization: "Surgical" },

  // =====================================================
  // THERAPY & REHABILITATION (15)
  // =====================================================
  "physical_therapy": { code: "225100000X", type: "individual", classification: "Physical Therapist" },
  "physical_therapy_cardiopulmonary": { code: "2251C2600X", type: "individual", classification: "Physical Therapist", specialization: "Cardiopulmonary" },
  "physical_therapy_geriatrics": { code: "2251G0304X", type: "individual", classification: "Physical Therapist", specialization: "Geriatrics" },
  "physical_therapy_neurology": { code: "2251N0400X", type: "individual", classification: "Physical Therapist", specialization: "Neurology" },
  "physical_therapy_orthopedics": { code: "2251X0800X", type: "individual", classification: "Physical Therapist", specialization: "Orthopedic" },
  "physical_therapy_sports": { code: "2251S0007X", type: "individual", classification: "Physical Therapist", specialization: "Sports" },
  "physical_therapy_assistant": { code: "225200000X", type: "individual", classification: "Physical Therapy Assistant" },
  "occupational_therapy": { code: "225X00000X", type: "individual", classification: "Occupational Therapist" },
  "occupational_therapy_assistant": { code: "224Z00000X", type: "individual", classification: "Occupational Therapy Assistant" },
  "speech_language_pathologist": { code: "235Z00000X", type: "individual", classification: "Speech-Language Pathologist" },
  "audiologist": { code: "231H00000X", type: "individual", classification: "Audiologist" },
  "respiratory_therapist": { code: "227800000X", type: "individual", classification: "Respiratory Therapist, Certified" },
  "respiratory_therapist_registered": { code: "227900000X", type: "individual", classification: "Respiratory Therapist, Registered" },
  "recreational_therapist": { code: "225C00000X", type: "individual", classification: "Recreational Therapist" },
  "art_therapist": { code: "221700000X", type: "individual", classification: "Art Therapist" },

  // =====================================================
  // BEHAVIORAL HEALTH (12)
  // =====================================================
  "psychologist_clinical": { code: "103TC0700X", type: "individual", classification: "Psychologist", specialization: "Clinical" },
  "psychologist_counseling": { code: "103TC1900X", type: "individual", classification: "Psychologist", specialization: "Counseling" },
  "psychologist_neuropsych": { code: "103TN0900X", type: "individual", classification: "Psychologist", specialization: "Neuropsychology" },
  "psychologist_school": { code: "103TS0200X", type: "individual", classification: "Psychologist", specialization: "School" },
  "clinical_social_worker": { code: "1041C0700X", type: "individual", classification: "Social Worker", specialization: "Clinical" },
  "social_worker": { code: "104100000X", type: "individual", classification: "Social Worker" },
  "counselor_professional": { code: "101YP2500X", type: "individual", classification: "Counselor", specialization: "Professional" },
  "counselor_mental_health": { code: "101YM0800X", type: "individual", classification: "Counselor", specialization: "Mental Health" },
  "counselor_addiction": { code: "101YA0400X", type: "individual", classification: "Counselor", specialization: "Addiction (Substance Use Disorder)" },
  "marriage_family_therapist": { code: "106H00000X", type: "individual", classification: "Marriage & Family Therapist" },
  "behavioral_analyst": { code: "103K00000X", type: "individual", classification: "Behavioral Analyst" },
  "peer_specialist": { code: "405300000X", type: "individual", classification: "Prevention Professional" },

  // =====================================================
  // PHARMACY (6)
  // =====================================================
  "pharmacist": { code: "183500000X", type: "individual", classification: "Pharmacist" },
  "pharmacy_technician": { code: "183700000X", type: "individual", classification: "Pharmacy Technician" },
  "pharmacist_clinical": { code: "1835C0205X", type: "individual", classification: "Pharmacist", specialization: "Clinical Pharmacy" },
  "pharmacist_nuclear": { code: "1835N0905X", type: "individual", classification: "Pharmacist", specialization: "Nuclear Pharmacy" },
  "pharmacist_geriatric": { code: "1835G0303X", type: "individual", classification: "Pharmacist", specialization: "Geriatric Pharmacy" },
  "pharmacist_oncology": { code: "1835P1300X", type: "individual", classification: "Pharmacist", specialization: "Pharmacotherapy, Oncology" },

  // =====================================================
  // VISION (5)
  // =====================================================
  "optometrist": { code: "152W00000X", type: "individual", classification: "Optometrist" },
  "optician": { code: "156FX1800X", type: "individual", classification: "Technician/Technologist", specialization: "Optician" },
  "orthoptist": { code: "152WC0802X", type: "individual", classification: "Optometrist", specialization: "Corneal and Contact Management" },
  "ocularist": { code: "156F00000X", type: "individual", classification: "Technician/Technologist" },
  "low_vision_therapist": { code: "152WL0500X", type: "individual", classification: "Optometrist", specialization: "Low Vision Rehabilitation" },

  // =====================================================
  // PODIATRY (3)
  // =====================================================
  "podiatrist": { code: "213E00000X", type: "individual", classification: "Podiatrist" },
  "podiatrist_surgery": { code: "213ES0131X", type: "individual", classification: "Podiatrist", specialization: "Foot Surgery" },
  "podiatrist_sports_medicine": { code: "213ES0103X", type: "individual", classification: "Podiatrist", specialization: "Foot & Ankle Surgery" },

  // =====================================================
  // CHIROPRACTIC & ALTERNATIVE (5)
  // =====================================================
  "chiropractor": { code: "111N00000X", type: "individual", classification: "Chiropractor" },
  "acupuncturist": { code: "171100000X", type: "individual", classification: "Acupuncturist" },
  "naturopath": { code: "175F00000X", type: "individual", classification: "Naturopath" },
  "homeopath": { code: "175H00000X", type: "individual", classification: "Homeopath" },
  "massage_therapist": { code: "171M00000X", type: "individual", classification: "Massage Therapist" },

  // =====================================================
  // DIETETICS & NUTRITION (3)
  // =====================================================
  "dietitian": { code: "133V00000X", type: "individual", classification: "Dietitian, Registered" },
  "nutritionist": { code: "133N00000X", type: "individual", classification: "Nutritionist" },
  "dietetic_technician": { code: "136A00000X", type: "individual", classification: "Dietetic Technician, Registered" },

  // =====================================================
  // EMS & EMERGENCY (4)
  // =====================================================
  "paramedic": { code: "146L00000X", type: "individual", classification: "Emergency Medical Technician, Paramedic" },
  "emt_basic": { code: "146M00000X", type: "individual", classification: "Emergency Medical Technician, Basic" },
  "emt_intermediate": { code: "146N00000X", type: "individual", classification: "Emergency Medical Technician, Intermediate" },
  "flight_nurse": { code: "163WP0218X", type: "individual", classification: "Registered Nurse", specialization: "Ambulatory Care" },

  // =====================================================
  // LAB & DIAGNOSTIC TECHNOLOGISTS (8)
  // =====================================================
  "medical_technologist": { code: "246R00000X", type: "individual", classification: "Pathology Technician" },
  "clinical_lab_scientist": { code: "246W00000X", type: "individual", classification: "Technician, Cardiology" },
  "radiology_technologist": { code: "247100000X", type: "individual", classification: "Radiologic Technologist" },
  "nuclear_medicine_tech": { code: "247200000X", type: "individual", classification: "Technician, Other" },
  "radiation_therapy_tech": { code: "247000000X", type: "individual", classification: "Technician, Health Information" },
  "surgical_technologist": { code: "246Q00000X", type: "individual", classification: "Specialist/Technologist, Pathology" },
  "cardiovascular_tech": { code: "246X00000X", type: "individual", classification: "Cardiovascular Technician" },
  "sonographer": { code: "2472B0301X", type: "individual", classification: "Technician, Other", specialization: "Diagnostic Medical Sonographer" },

  // =====================================================
  // COMMUNITY HEALTH & PUBLIC HEALTH (5)
  // =====================================================
  "community_health_worker": { code: "172V00000X", type: "individual", classification: "Community Health Worker" },
  "health_educator": { code: "174H00000X", type: "individual", classification: "Health Educator" },
  "interpreter": { code: "171R00000X", type: "individual", classification: "Interpreter" },
  "doula": { code: "174N00000X", type: "individual", classification: "Doula" },
  "lactation_consultant": { code: "174V00000X", type: "individual", classification: "Lactation Consultant, Non-RN" },

  // =====================================================
  // HOSPITALS (10)
  // =====================================================
  "hospital": { code: "282N00000X", type: "organization", classification: "General Acute Care Hospital" },
  "hospital_children": { code: "282NC2000X", type: "organization", classification: "General Acute Care Hospital", specialization: "Children" },
  "hospital_critical_access": { code: "282NC0060X", type: "organization", classification: "General Acute Care Hospital", specialization: "Critical Access" },
  "hospital_long_term_acute": { code: "282E00000X", type: "organization", classification: "Long Term Care Hospital" },
  "hospital_military": { code: "286500000X", type: "organization", classification: "Military Hospital" },
  "hospital_psychiatric": { code: "283Q00000X", type: "organization", classification: "Psychiatric Hospital" },
  "hospital_rehabilitation": { code: "283X00000X", type: "organization", classification: "Rehabilitation Hospital" },
  "hospital_surgical": { code: "282NW0100X", type: "organization", classification: "General Acute Care Hospital", specialization: "Women" },
  "hospital_religious": { code: "282NR1301X", type: "organization", classification: "General Acute Care Hospital", specialization: "Rural" },
  "hospital_va": { code: "2865C1500X", type: "organization", classification: "Military Hospital", specialization: "Community Based Outpatient Clinic (CBOC)" },

  // =====================================================
  // CLINICS & AMBULATORY (12)
  // =====================================================
  "clinic": { code: "261QM1300X", type: "organization", classification: "Clinic/Center", specialization: "Multi-Specialty" },
  "clinic_community_health": { code: "261QC1500X", type: "organization", classification: "Clinic/Center", specialization: "Community Health" },
  "clinic_federally_qualified": { code: "261QF0400X", type: "organization", classification: "Clinic/Center", specialization: "Federally Qualified Health Center" },
  "clinic_mental_health": { code: "261QM0801X", type: "organization", classification: "Clinic/Center", specialization: "Mental Health (Including Community Mental Health Center)" },
  "clinic_primary_care": { code: "261QP2300X", type: "organization", classification: "Clinic/Center", specialization: "Primary Care" },
  "clinic_rehabilitation": { code: "261QR0400X", type: "organization", classification: "Clinic/Center", specialization: "Rehabilitation" },
  "clinic_rural_health": { code: "261QR1300X", type: "organization", classification: "Clinic/Center", specialization: "Rural Health" },
  "clinic_urgent_care": { code: "261QU0200X", type: "organization", classification: "Clinic/Center", specialization: "Urgent Care" },
  "clinic_walk_in": { code: "261QV0200X", type: "organization", classification: "Clinic/Center", specialization: "VA" },
  "ambulatory_surgical": { code: "261QA0600X", type: "organization", classification: "Clinic/Center", specialization: "Ambulatory Surgical" },
  "clinic_dental": { code: "261QD0000X", type: "organization", classification: "Clinic/Center", specialization: "Dental" },
  "clinic_substance_abuse": { code: "261QR0405X", type: "organization", classification: "Clinic/Center", specialization: "Rehabilitation, Substance Use Disorder" },

  // =====================================================
  // LONG-TERM CARE & POST-ACUTE (8)
  // =====================================================
  "skilled_nursing": { code: "314000000X", type: "organization", classification: "Skilled Nursing Facility" },
  "nursing_custodial": { code: "311500000X", type: "organization", classification: "Alzheimer Center (Dementia Center)" },
  "assisted_living": { code: "310400000X", type: "organization", classification: "Assisted Living Facility" },
  "residential_treatment": { code: "323P00000X", type: "organization", classification: "Psychiatric Residential Treatment Facility" },
  "intermediate_care": { code: "310500000X", type: "organization", classification: "Intermediate Care Facility, Mental Illness" },
  "hospice_inpatient": { code: "341600000X", type: "organization", classification: "Hospice, Inpatient" },
  "hospice_home": { code: "341800000X", type: "organization", classification: "Hospice, Home" },
  "inpatient_rehab": { code: "283X00000X", type: "organization", classification: "Rehabilitation Hospital" },

  // =====================================================
  // HOME HEALTH & PERSONAL CARE (5)
  // =====================================================
  "home_health": { code: "251E00000X", type: "organization", classification: "Home Health" },
  "home_infusion_therapy": { code: "251F00000X", type: "organization", classification: "Home Infusion" },
  "home_nursing": { code: "251G00000X", type: "organization", classification: "Hospice Care, Community Based" },
  "personal_care_agency": { code: "251B00000X", type: "organization", classification: "Case Management" },
  "home_delivered_meals": { code: "251C00000X", type: "organization", classification: "Day Training, Developmentally Disabled Services" },

  // =====================================================
  // PHARMACY (ORGANIZATION) (4)
  // =====================================================
  "pharmacy": { code: "333600000X", type: "organization", classification: "Pharmacy" },
  "pharmacy_compounding": { code: "3336C0002X", type: "organization", classification: "Pharmacy", specialization: "Compounding Pharmacy" },
  "pharmacy_long_term": { code: "3336C0004X", type: "organization", classification: "Pharmacy", specialization: "Long Term Care Pharmacy" },
  "pharmacy_specialty": { code: "3336S0011X", type: "organization", classification: "Pharmacy", specialization: "Specialty Pharmacy" },

  // =====================================================
  // DME & MEDICAL SUPPLIES (4)
  // =====================================================
  "dme_supplier": { code: "332B00000X", type: "organization", classification: "Durable Medical Equipment & Medical Supplies" },
  "prosthetics_orthotics": { code: "335E00000X", type: "organization", classification: "Prosthetic/Orthotic Supplier" },
  "hearing_aid_supplier": { code: "332H00000X", type: "organization", classification: "Home Delivered Meals" },
  "oxygen_supplier": { code: "332G00000X", type: "organization", classification: "Eye Bank" },

  // =====================================================
  // LABS & DIAGNOSTIC SERVICES (5)
  // =====================================================
  "clinical_lab": { code: "291U00000X", type: "organization", classification: "Clinical Medical Laboratory" },
  "diagnostic_radiology_center": { code: "261QX0200X", type: "organization", classification: "Clinic/Center", specialization: "Oncology, Radiation" },
  "portable_xray": { code: "293D00000X", type: "organization", classification: "Physiological Laboratory" },
  "sleep_lab": { code: "261QS0132X", type: "organization", classification: "Clinic/Center", specialization: "Sleep Disorder Diagnostic" },
  "blood_bank": { code: "291900000X", type: "organization", classification: "Military Clinical Medical Laboratory" },

  // =====================================================
  // EMERGENCY & TRANSPORT (4)
  // =====================================================
  "ambulance_ground": { code: "341100000X", type: "organization", classification: "Transportation Services", specialization: "Ambulance, Ground" },
  "ambulance_air": { code: "3411A0300X", type: "organization", classification: "Transportation Services", specialization: "Ambulance, Air" },
  "ambulance_water": { code: "3411S0300X", type: "organization", classification: "Transportation Services", specialization: "Ambulance, Water" },
  "non_emergency_transport": { code: "344600000X", type: "organization", classification: "Non-Emergency Medical Transport (VAN)" },

  // =====================================================
  // MANAGED CARE & PAYERS (4)
  // =====================================================
  "managed_care_hmo": { code: "302F00000X", type: "organization", classification: "Exclusive Provider Organization" },
  "managed_care_ppo": { code: "302R00000X", type: "organization", classification: "Preferred Provider Organization" },
  "managed_care_pos": { code: "305R00000X", type: "organization", classification: "Point of Service" },
  "health_maintenance_org": { code: "305S00000X", type: "organization", classification: "Health Maintenance Organization" },

  // =====================================================
  // OTHER ORGANIZATIONS (5)
  // =====================================================
  "organ_procurement": { code: "335U00000X", type: "organization", classification: "Organ Procurement Organization" },
  "public_health": { code: "251X00000X", type: "organization", classification: "Supports Brokerage" },
  "dialysis_center": { code: "261QE0700X", type: "organization", classification: "Clinic/Center", specialization: "End-Stage Renal Disease (ESRD) Treatment" },
  "lithotripsy_center": { code: "261QL0400X", type: "organization", classification: "Clinic/Center", specialization: "Lithotripsy" },
  "pain_management_clinic": { code: "261QP3300X", type: "organization", classification: "Clinic/Center", specialization: "Pain" },
};
