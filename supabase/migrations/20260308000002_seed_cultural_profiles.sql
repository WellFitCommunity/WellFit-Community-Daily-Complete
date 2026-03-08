-- Seed Cultural Competency Profiles
-- Populates the cultural_profiles table with 8 built-in population profiles.
-- These are global profiles (tenant_id IS NULL) available to all tenants.
-- Idempotent: deletes existing global profiles before re-inserting.
-- Source: supabase/functions/mcp-cultural-competency-server/profiles/

BEGIN;

-- Remove existing global profiles (tenant-specific ones are preserved)
DELETE FROM cultural_profiles WHERE tenant_id IS NULL;

-- 1. Veterans
INSERT INTO cultural_profiles (population_key, display_name, description, caveat, profile_data, tenant_id, is_active)
VALUES (
  'veterans',
  'Veterans / Military Service Members',
  'Individuals with current or prior military service. Military culture emphasizes stoicism and self-reliance, which can delay care-seeking. Combat exposures, moral injury, and transition challenges create unique health needs.',
  'Military experience varies widely by era, branch, rank, and deployment history. Not all veterans have combat exposure or PTSD. Avoid assumptions — ask about service history respectfully.',
  '{
    "communication": {
      "languagePreferences": ["Direct, concise language", "Avoid euphemisms — use clear medical terms"],
      "formalityLevel": "moderate",
      "familyInvolvementNorm": "Many veterans prefer to handle medical decisions independently. However, spouses/partners often play key support roles, especially for TBI or PTSD. Ask before involving family.",
      "keyPhrases": ["Thank you for your service — what branch and era?", "Some veterans find that...", "You have earned these benefits", "Let me help you navigate your options"],
      "avoidPhrases": ["You must be traumatized", "Did you ever kill anyone?", "You should talk to someone about that", "Just relax"],
      "contextSpecific": {
        "medication": "Discuss medication purpose directly. Many veterans resist psychotropic medications due to stigma — frame as ''tools for performance'' rather than ''mental health treatment.'' Ask about VA pharmacy access.",
        "diagnosis": "Use straightforward language. Veterans appreciate honesty over cushioning. If a diagnosis is service-connected, mention VA disability claim eligibility.",
        "care_plan": "Include VA benefits navigation. Veteran peer support programs (e.g., Vet Centers) are highly effective. Consider telehealth for rural veterans.",
        "discharge": "Ensure VA enrollment is verified. Coordinate with VA Patient Aligned Care Team (PACT). Provide Veteran Crisis Line: 988 (press 1)."
      }
    },
    "clinicalConsiderations": [
      {"condition": "PTSD / Moral Injury", "prevalence": "11-20% of OIF/OEF veterans; 30% of Vietnam veterans", "screeningRecommendation": "PC-PTSD-5 screen at every primary care visit", "clinicalNote": "Moral injury (guilt/shame from war experiences) presents differently from classic PTSD. May manifest as withdrawal, substance use, or spiritual crisis rather than hypervigilance."},
      {"condition": "Traumatic Brain Injury (TBI)", "prevalence": "23% of combat veterans have blast-related TBI", "screeningRecommendation": "VA TBI screening tool for all combat-era veterans", "clinicalNote": "TBI and PTSD frequently co-occur. Headaches, memory issues, and irritability may be attributed to PTSD when TBI is the primary driver."},
      {"condition": "Toxic Exposures", "prevalence": "3.5M+ veterans exposed to burn pits (PACT Act eligible)", "screeningRecommendation": "Toxic Exposure Screening Navigator (TESN) referral", "clinicalNote": "Burn pit exposure linked to respiratory cancers, constrictive bronchiolitis. Agent Orange linked to diabetes, ischemic heart disease, multiple cancers. Gulf War illness presents as multi-symptom chronic fatigue."},
      {"condition": "Substance Use Disorder", "prevalence": "1 in 10 veterans seen in VA has SUD diagnosis", "screeningRecommendation": "AUDIT-C for alcohol; DAST-10 for drugs at intake", "clinicalNote": "Self-medication for pain and PTSD is common. Military culture stigmatizes help-seeking for substance use. Frame treatment as ''mission readiness'' not ''weakness.''"},
      {"condition": "Chronic Pain / Musculoskeletal", "prevalence": "Most common reason for VA healthcare utilization", "screeningRecommendation": "PEG scale (Pain, Enjoyment, General activity)", "clinicalNote": "Many veterans have service-connected injuries. Opioid stewardship is critical — VA Stepped Care Model for Pain (non-pharm first). Ask about previous pain management approaches."}
    ],
    "barriers": [
      {"barrier": "Stigma around mental health", "impact": "Delays care-seeking by 6-8 years on average for PTSD", "mitigation": "Normalize help-seeking: ''Many veterans in your situation use these resources.'' Use language of strength, not weakness."},
      {"barrier": "VA system navigation complexity", "impact": "Veterans may not know what benefits they have earned", "mitigation": "Refer to VA social worker or Patient Advocate. Mention PACT Act expansion of eligibility. Connect with local Vet Center (no VA enrollment required)."},
      {"barrier": "Rural access", "impact": "33% of veterans live in rural areas with limited VA facilities", "mitigation": "VA telehealth (VA Video Connect), Community Care referrals, mobile vet centers. ATLAS program for remote areas."},
      {"barrier": "Distrust of government healthcare", "impact": "Some veterans avoid VA due to negative experiences or wait time issues", "mitigation": "Acknowledge past VA shortcomings honestly. Offer both VA and community care options. Emphasize MISSION Act choice."}
    ],
    "culturalPractices": [
      {"practice": "Veteran peer support groups", "description": "Veterans respond better to peers who share military experience than to civilian clinicians alone.", "clinicalImplication": "Refer to Vet Centers (community-based, no VA enrollment needed) or veteran service organizations (VFW, DAV, Team Red White & Blue)."},
      {"practice": "Physical fitness as coping", "description": "Many veterans use exercise as primary coping mechanism — adaptive when healthy, maladaptive when injury prevents it.", "clinicalImplication": "Incorporate physical activity into care plans. Adaptive sports programs (e.g., Warrior Games) for injured veterans."}
    ],
    "trustFactors": [
      {"factor": "VA wait time scandals (2014+)", "historicalContext": "Phoenix VA scandal revealed falsified wait times and veteran deaths. Eroded trust in VA system for many veterans.", "trustBuildingStrategy": "Acknowledge the history. Demonstrate responsiveness. Offer MISSION Act community care as an alternative when appropriate."},
      {"factor": "Agent Orange denial (decades-long)", "historicalContext": "Government denied Agent Orange health effects for 20+ years. Created deep distrust of institutional claims about toxic exposures.", "trustBuildingStrategy": "Take environmental exposure concerns seriously. Reference PACT Act as acknowledgment. Do not dismiss symptoms as psychosomatic."}
    ],
    "supportSystems": [
      {"resource": "Veteran Crisis Line", "description": "24/7 crisis support for veterans and their families", "accessInfo": "Call 988, press 1. Text 838255. Chat at VeteransCrisisLine.net"},
      {"resource": "Vet Centers", "description": "Community-based readjustment counseling — no VA enrollment required", "accessInfo": "300+ locations. Call 1-877-WAR-VETS. Walk-ins welcome."},
      {"resource": "VA Caregiver Support", "description": "Support and stipends for caregivers of eligible veterans", "accessInfo": "Call 1-855-260-3274. Program of Comprehensive Assistance for Family Caregivers."}
    ],
    "sdohCodes": [
      {"code": "Z91.82", "description": "Personal history of military deployment", "applicability": "All veterans with deployment history"},
      {"code": "Z56.82", "description": "Military to civilian transition difficulty", "applicability": "Recently separated veterans with adjustment issues"},
      {"code": "Z65.8", "description": "Other specified problems related to psychosocial circumstances", "applicability": "Veteran-specific stressors (moral injury, reintegration)"}
    ],
    "culturalRemedies": [
      {"remedy": "Kratom (Mitragyna speciosa)", "commonUse": "Self-treatment for chronic pain and PTSD symptoms — prevalent in veteran community", "potentialInteractions": ["Opioid agonist activity — risk with concurrent opioid prescriptions", "CYP enzyme inhibition — affects metabolism of many drugs", "Serotonergic effects — risk with SSRIs/SNRIs"], "warningLevel": "warning"},
      {"remedy": "CBD / Cannabis products", "commonUse": "Pain management, sleep, anxiety — increasingly common among veterans", "potentialInteractions": ["CYP3A4 and CYP2C19 inhibition — affects warfarin, clopidogrel, many others", "Additive sedation with benzodiazepines or sleep medications", "May affect VA benefits eligibility in some states (check current policy)"], "warningLevel": "caution"}
    ]
  }'::jsonb,
  NULL,
  true
);

-- 2. Unhoused
INSERT INTO cultural_profiles (population_key, display_name, description, caveat, profile_data, tenant_id, is_active)
VALUES (
  'unhoused',
  'Unhoused / Experiencing Homelessness',
  'Individuals without stable housing, including those in shelters, transitional housing, unsheltered on the street, or ''doubling up'' with others. Housing instability is a health condition — it affects every aspect of care delivery, medication adherence, and follow-up.',
  'Homelessness is not a personality trait. People experience homelessness due to economic, medical, and systemic factors. Avoid assumptions about substance use, mental illness, or personal responsibility. Ask about current living situation without judgment.',
  '{
    "communication": {
      "languagePreferences": ["Dignity-first language", "Plain language — avoid medical jargon"],
      "formalityLevel": "informal",
      "familyInvolvementNorm": "Traditional family structures may be absent. ''Street family'' or shelter community may serve as support network. Ask who the patient trusts for health decisions.",
      "keyPhrases": ["Where are you staying right now?", "What would make it easier for you to follow this plan?", "Is there a safe place you can store medications?", "Do you have a phone number where I can reach you?"],
      "avoidPhrases": ["Homeless person (use ''person experiencing homelessness'')", "Non-compliant (they may lack the means, not the will)", "You need to come back in 2 weeks (may not be feasible)", "Take this with food three times a day (may not have regular meals)"],
      "contextSpecific": {
        "medication": "Ask about storage: no refrigeration rules out insulin pens, many biologics. Ask about meal regularity for meds requiring food. Simplify regimens to once-daily when possible. Consider long-acting injectables over daily oral.",
        "diagnosis": "Prioritize conditions that are immediately dangerous or cause pain. The patient may not return — treat what you can today. Write diagnoses in plain language on a card they can carry.",
        "care_plan": "Build plans around the patient''s reality: shelter hours, meal programs, transportation. Set achievable goals for 1-2 days, not 1-2 weeks. Include harm reduction, not just abstinence.",
        "discharge": "Do NOT discharge to ''home'' if there is none. Coordinate with shelter, medical respite, or street outreach team. Provide written discharge instructions they can carry. Include a map to follow-up locations."
      }
    },
    "clinicalConsiderations": [
      {"condition": "Foot and skin conditions", "prevalence": "Extremely common — immersion foot, cellulitis, frostbite, infestations", "screeningRecommendation": "Foot exam at every encounter", "clinicalNote": "Walking all day in ill-fitting shoes, sleeping in wet conditions. Trench foot still occurs. Provide clean socks as part of care. Check for tinea, cellulitis, peripheral vascular disease."},
      {"condition": "Respiratory illness", "prevalence": "TB incidence 20-50x higher than general population", "screeningRecommendation": "TB screening (IGRA preferred over TST) at intake and annually", "clinicalNote": "Shelter crowding increases respiratory infection transmission. COPD common from environmental and smoking exposure. COVID-19 vaccination status often incomplete."},
      {"condition": "Mental health conditions", "prevalence": "30-40% have serious mental illness; 50-70% have any mental health condition", "screeningRecommendation": "PHQ-2/PHQ-9 for depression; Columbia Suicide Severity Rating Scale", "clinicalNote": "Mental illness is often a cause AND consequence of homelessness. Do not assume it is the primary driver. Treat mental health and housing as interconnected, not sequential."},
      {"condition": "Substance use disorders", "prevalence": "38% have alcohol use disorder; 26% report other drug use", "screeningRecommendation": "AUDIT-C and single-question drug screening", "clinicalNote": "Harm reduction approach is essential. Abstinence-only requirements for housing/services create barriers. Naloxone distribution should be routine. Ask about injection drug use for Hep C/HIV screening."},
      {"condition": "Dental disease", "prevalence": "Untreated dental caries in majority; dental pain is common chief complaint", "screeningRecommendation": "Oral exam at every primary care visit", "clinicalNote": "Dental care is the most common unmet health need among unhoused individuals. Tooth pain drives ER visits. Connect to FQHC dental programs."},
      {"condition": "Trauma / Violence exposure", "prevalence": "High rates of physical assault, sexual violence, witnessing violence", "screeningRecommendation": "Trauma-informed universal precautions", "clinicalNote": "Ask about safety, not just health. Women and LGBTQ+ individuals face disproportionate violence. Use trauma-informed care principles — predictability, transparency, choice."}
    ],
    "barriers": [
      {"barrier": "No refrigeration for medications", "impact": "Rules out insulin pens, many biologics, some antibiotics requiring cold storage", "mitigation": "Prescribe room-temperature stable formulations. Long-acting injectables (e.g., Invega Sustenna, Sublocade, buprenorphine implant). Coordinate with pharmacies for daily dispensing."},
      {"barrier": "No stable address for follow-up", "impact": "Cannot receive mail, appointment reminders, lab results", "mitigation": "Use shelter address or clinic address as mailing address. Cell phone text reminders (many have phones). Drop-in hours instead of scheduled appointments."},
      {"barrier": "No identification documents", "impact": "Cannot enroll in insurance, access many services", "mitigation": "Connect with social worker for ID recovery. Many FQHCs and HCH programs serve patients without ID. Presumptive Medicaid eligibility in some states."},
      {"barrier": "Transportation", "impact": "Cannot reach specialty appointments, imaging, pharmacy", "mitigation": "Prescribe at on-site pharmacy when possible. Mobile health units. Medicaid non-emergency medical transportation (NEMT). Bus tokens or ride vouchers."},
      {"barrier": "Competing survival priorities", "impact": "Finding food, shelter, and safety takes precedence over medical appointments", "mitigation": "Co-locate services: medical care at shelters, food banks, day centers. Address immediate needs first — a sandwich and socks build more trust than a lecture on blood pressure."}
    ],
    "culturalPractices": [
      {"practice": "Street community mutual aid", "description": "Unhoused individuals often form tight-knit communities that share resources, watch out for each other''s health, and provide emotional support.", "clinicalImplication": "Ask who in their community helps with health. Peer health workers from the unhoused community are highly effective outreach. Do not disrupt these networks."},
      {"practice": "Harm reduction as self-care", "description": "Supervised consumption, naloxone carrying, needle exchange, and safer use practices are active health-seeking behaviors.", "clinicalImplication": "Affirm harm reduction efforts. Provide naloxone kits. Do not withhold care based on substance use status. Fentanyl test strips save lives."}
    ],
    "trustFactors": [
      {"factor": "Institutional trauma", "historicalContext": "Many unhoused individuals have experienced forced institutionalization, foster care, incarceration, or involuntary holds. Medical settings can trigger these memories.", "trustBuildingStrategy": "Explain what you are doing and why before doing it. Offer choices wherever possible. Do not threaten involuntary holds as leverage. Let the patient leave if they need to."},
      {"factor": "Judgmental healthcare experiences", "historicalContext": "Many report being treated dismissively, accused of drug-seeking, or denied care in emergency rooms. This creates avoidance of healthcare.", "trustBuildingStrategy": "Treat pain seriously. Do not require sobriety as a condition of care. Use the same clinical language you would use with any patient. Dignity is the minimum standard."}
    ],
    "supportSystems": [
      {"resource": "Health Care for the Homeless (HCH) Programs", "description": "Federally funded programs providing comprehensive healthcare to unhoused individuals", "accessInfo": "Find locations at nhchc.org. No ID, insurance, or appointment required at most sites."},
      {"resource": "211 Hotline", "description": "Connect to local shelter, food, and social services", "accessInfo": "Call 211 or text ZIP code to 898211. Available 24/7."},
      {"resource": "Coordinated Entry System", "description": "Standardized assessment and prioritization for housing placement", "accessInfo": "Contact local Continuum of Care (CoC). Often accessed through shelters or outreach workers."}
    ],
    "sdohCodes": [
      {"code": "Z59.00", "description": "Homelessness, unspecified", "applicability": "All individuals currently experiencing homelessness"},
      {"code": "Z59.01", "description": "Sheltered homelessness", "applicability": "Individuals staying in emergency shelters or transitional housing"},
      {"code": "Z59.02", "description": "Unsheltered homelessness", "applicability": "Individuals sleeping outside, in vehicles, or in places not meant for habitation"},
      {"code": "Z59.1", "description": "Inadequate housing", "applicability": "Doubling up, substandard housing, or at imminent risk of homelessness"},
      {"code": "Z59.41", "description": "Food insecurity", "applicability": "Most unhoused individuals — affects medication timing and nutrition"}
    ],
    "culturalRemedies": [
      {"remedy": "Alcohol as self-medication", "commonUse": "Pain management, sleep aid, anxiety reduction, warmth in cold weather", "potentialInteractions": ["Hepatotoxicity with acetaminophen", "Sedation potentiation with benzodiazepines, opioids, antihistamines", "Hypoglycemia risk with diabetes medications", "GI bleeding risk with NSAIDs"], "warningLevel": "warning"},
      {"remedy": "Shared/street-obtained medications", "commonUse": "Antibiotics, pain medications, psychiatric medications obtained from peers or street purchase", "potentialInteractions": ["Unknown dosing and formulation — verify what they are actually taking", "Counterfeit pills may contain fentanyl", "Drug-drug interactions with prescribed medications"], "warningLevel": "warning"}
    ]
  }'::jsonb,
  NULL,
  true
);

-- 3. Latino / Hispanic
INSERT INTO cultural_profiles (population_key, display_name, description, caveat, profile_data, tenant_id, is_active)
VALUES (
  'latino',
  'Spanish-Speaking / Latino / Hispanic',
  'A diverse population encompassing people from 20+ countries of origin with distinct cultural, linguistic, and health profiles. Shared cultural values include familismo (family-centered decisions), respeto (respectful communication), and personalismo (warm personal relationships in professional settings).',
  'Latino/Hispanic is not a monolithic identity. A Cuban-American in Miami, a recent Guatemalan immigrant, and a fifth-generation Tejano family have very different experiences. Country of origin, generation, acculturation level, and indigenous heritage all matter. Ask — do not assume.',
  '{
    "communication": {
      "languagePreferences": ["Assess language preference at every visit — do not assume from name or appearance", "Use certified medical interpreters, not family members (especially not children)", "Offer written materials in Spanish at appropriate literacy level"],
      "formalityLevel": "formal",
      "familyInvolvementNorm": "Familismo: family is central to health decisions. Expect and welcome family members at appointments. The patient may defer to an elder or spouse for major decisions. This is not a lack of autonomy — it is a cultural value.",
      "keyPhrases": ["Would you like to include family in this conversation?", "Let me explain this in a way that is easy to share with your family", "We have a Spanish-speaking interpreter available", "Tell me about any home remedies you use — I want to make sure everything works safely together"],
      "avoidPhrases": ["Can your child translate? (violation of interpreter standards)", "You need to make this decision yourself (may conflict with familismo)", "Just Google it in Spanish (health literacy varies widely)", "Are you legal? / Do you have papers? (irrelevant to care, creates fear)"],
      "contextSpecific": {
        "medication": "Explain purpose clearly — ''para que sirve.'' Many patients take medications only when symptomatic. Emphasize continuing even when feeling better. Ask about herbal teas and remedios caseros (home remedies) for interaction screening.",
        "diagnosis": "Use the term ''condition'' rather than ''disease'' when possible — less stigmatizing. For diabetes: address fatalism (''es mi destino'') with empowerment messaging. Involve family in education.",
        "care_plan": "Include family in goal-setting. Consider diet modifications that respect traditional foods rather than replacing them. Tortillas are not the enemy — portion guidance is more effective than elimination.",
        "discharge": "Provide instructions in Spanish with pictures. Verify understanding with teach-back (not ''do you understand?''). Include family contact for follow-up reminders."
      }
    },
    "clinicalConsiderations": [
      {"condition": "Type 2 Diabetes", "prevalence": "Latino adults are 70% more likely to be diagnosed than non-Hispanic whites", "screeningRecommendation": "A1C or fasting glucose at age 35+ (ADA); earlier if overweight with risk factors", "clinicalNote": "Dietary counseling should incorporate traditional foods. Rice and beans are nutritious — focus on cooking methods and portions. Atole, aguas frescas, and pan dulce are significant sugar sources. Metformin education in preferred language is critical."},
      {"condition": "Obesity", "prevalence": "47% of Hispanic adults have obesity (vs. 42% overall)", "screeningRecommendation": "BMI at every visit; waist circumference for metabolic risk", "clinicalNote": "Weight stigma exists in healthcare. Body ideals vary culturally — ''gordito/a'' may be affectionate, not medical. Focus on health outcomes, not appearance. Physical activity programs should be culturally relevant (dance, walking groups)."},
      {"condition": "Chronic Liver Disease / Hepatitis", "prevalence": "Hispanic men have highest rates of liver disease-related death in the US", "screeningRecommendation": "Hep B/C screening per USPSTF; liver function tests if risk factors", "clinicalNote": "Alcohol use patterns vary by country of origin. NAFLD/NASH prevalence is high, linked to metabolic syndrome. Traditional herbal preparations may have hepatotoxic potential — ask specifically."},
      {"condition": "Depression / Anxiety (Culture-Bound Syndromes)", "prevalence": "Higher rates of depression among immigrant Latinos vs. US-born", "screeningRecommendation": "PHQ-9 in Spanish (validated version); ask about nervios, susto", "clinicalNote": "Nervios (chronic anxiety/distress) and susto (soul loss from fright) are recognized culture-bound syndromes. They are real experiences with real symptoms — do not dismiss. They may overlap with clinical anxiety, PTSD, or depression."},
      {"condition": "Cervical Cancer", "prevalence": "Hispanic women have highest incidence of cervical cancer in the US", "screeningRecommendation": "Cervical screening per ACS guidelines; HPV vaccination outreach", "clinicalNote": "Barriers include modesty concerns, lack of female providers, and immigration-related fears. Ensure culturally sensitive exam protocols. HPV vaccine education should address parental concerns in culturally appropriate terms."}
    ],
    "barriers": [
      {"barrier": "Language barrier", "impact": "Medical errors 2x more likely when professional interpreters are not used", "mitigation": "Certified medical interpreters (in-person or phone/video). Never use children as interpreters. Bilingual staff do not replace interpreters unless certified. Use teach-back method."},
      {"barrier": "Immigration status fears", "impact": "Undocumented patients avoid care due to fear of deportation, reporting, or public charge rule", "mitigation": "Post ''safe space'' signage. Train staff on confidentiality protections. EMTALA guarantees emergency care regardless of status. FQHCs serve all regardless of immigration status. Do not ask about documentation unless directly relevant to benefits enrollment."},
      {"barrier": "Health literacy", "impact": "41% of Hispanic adults have below-basic health literacy (NAAL)", "mitigation": "Use plain language in preferred language. Visual aids and pictograms for medication instructions. Teach-back verification (not ''do you understand?''). Culturally adapted patient education materials."},
      {"barrier": "Insurance gaps", "impact": "19% of Hispanic people are uninsured (highest rate of any racial/ethnic group)", "mitigation": "Screen for Medicaid eligibility (varies by state and immigration status). FQHC sliding scale. Emergency Medicaid for qualifying conditions. Community health worker (promotora) enrollment assistance."}
    ],
    "culturalPractices": [
      {"practice": "Remedios caseros (home remedies)", "description": "Herbal teas, poultices, and traditional preparations are widely used. Manzanilla (chamomile), yerba buena (mint), ruda (rue), and sabila (aloe vera) are common. Some families use sobadores (traditional massage therapists).", "clinicalImplication": "Ask about all home remedies — patients may not mention them unless asked directly. Most herbal teas are safe, but some (e.g., ruda in pregnancy) have contraindications. Frame as ''I want to make sure everything works safely together.''"},
      {"practice": "Curanderismo (traditional healing)", "description": "Traditional healing system using prayer, herbs, massage, and spiritual cleansing (limpia). Curanderos/as are respected community healers.", "clinicalImplication": "Do not dismiss or compete with curanderismo. It addresses spiritual and social dimensions that biomedicine may not. Ask if the patient is seeing a curandero/a and what treatments they recommend. Identify potential interactions."},
      {"practice": "Religious faith and healing", "description": "Strong Catholic or evangelical Christian faith. Prayer, saints, promises (mandas), and pilgrimage may be part of healing. Some may attribute illness to God''s will (destino).", "clinicalImplication": "Respect faith-based coping. Address fatalism with empowerment, not dismissal: ''God gave us medicine as a tool too.'' Chaplain or faith leader involvement can increase treatment adherence."}
    ],
    "trustFactors": [
      {"factor": "Immigration enforcement in healthcare settings", "historicalContext": "ICE operations near clinics and hospitals have occurred, creating fear that seeking care leads to deportation. The public charge rule (even after narrowing) created lasting hesitancy.", "trustBuildingStrategy": "Clearly communicate confidentiality policies. Display signage in Spanish about patient rights. Train all staff — front desk to clinicians — on immigration-neutral protocols. Partner with trusted community organizations."},
      {"factor": "Forced sterilization history", "historicalContext": "Documented forced sterilization of Latina women in California prisons (2006-2010) and ICE detention (2020). Historical eugenic sterilization programs targeted Mexican-American women.", "trustBuildingStrategy": "Thorough informed consent for any reproductive procedure. Offer interpreter for consent conversations. Do not pressure family planning discussions. Respect reproductive autonomy absolutely."}
    ],
    "supportSystems": [
      {"resource": "Promotoras de salud (community health workers)", "description": "Trusted community members trained to provide health education and navigation", "accessInfo": "Available through FQHCs, health departments, and community organizations serving Latino populations."},
      {"resource": "SAMHSA National Helpline (Spanish)", "description": "Free, confidential mental health and substance use referral service", "accessInfo": "1-800-662-4357 (oprima 2 para espanol). Available 24/7."},
      {"resource": "NAMI Latino resources", "description": "Mental health education and support groups in Spanish", "accessInfo": "nami.org/Your-Journey/Identity-and-Cultural-Dimensions/Hispanic-Latinx"}
    ],
    "sdohCodes": [
      {"code": "Z60.3", "description": "Acculturation difficulty", "applicability": "Recent immigrants adapting to US healthcare system and culture"},
      {"code": "Z60.5", "description": "Target of perceived adverse discrimination and persecution", "applicability": "Patients reporting immigration-related discrimination affecting health"},
      {"code": "Z59.7", "description": "Insufficient social insurance and welfare support", "applicability": "Immigration-status-related insurance gaps"}
    ],
    "culturalRemedies": [
      {"remedy": "Manzanilla (chamomile tea)", "commonUse": "Digestive issues, anxiety, sleep, colic in infants", "potentialInteractions": ["Mild anticoagulant properties — caution with warfarin", "Possible allergic reaction in ragweed-allergic patients"], "warningLevel": "info"},
      {"remedy": "Ruda (rue / Ruta graveolens)", "commonUse": "Menstrual regulation, spiritual cleansing, stomach pain", "potentialInteractions": ["ABORTIFACIENT — contraindicated in pregnancy", "Phototoxic — causes severe burns with sun exposure", "Hepatotoxic in large doses"], "warningLevel": "warning"},
      {"remedy": "Epazote (Dysphania ambrosioides)", "commonUse": "Digestive aid, added to beans to reduce gas, antiparasitic", "potentialInteractions": ["Essential oil form (oil of chenopodium) is toxic — liver and kidney damage", "Safe as culinary herb in food quantities", "Contraindicated in pregnancy in medicinal doses"], "warningLevel": "caution"},
      {"remedy": "Sabila (aloe vera, ingested)", "commonUse": "Digestive health, diabetes management, wound healing", "potentialInteractions": ["Aloe latex is a stimulant laxative — electrolyte imbalance risk", "May lower blood glucose — additive with diabetes medications", "Can reduce absorption of oral medications if taken simultaneously"], "warningLevel": "caution"}
    ]
  }'::jsonb,
  NULL,
  true
);

-- 4. Black / African American
INSERT INTO cultural_profiles (population_key, display_name, description, caveat, profile_data, tenant_id, is_active)
VALUES (
  'black_aa',
  'Black / African American',
  'A diverse population including multi-generational African Americans, Caribbean immigrants, African immigrants, and mixed-race individuals. Historical and ongoing systemic racism in healthcare creates unique challenges that clinicians must understand and actively address.',
  'Black/African American is not a monolithic identity. A Haitian immigrant, a third-generation Chicagoan, and a Nigerian-American have different cultural contexts. The shared experience is navigating a healthcare system with documented racial bias. Do not treat race as a clinical variable — treat the disparities it creates.',
  '{
    "communication": {
      "languagePreferences": ["Standard professional communication — do not alter speech patterns", "For Caribbean or African immigrants, assess language needs (Haitian Creole, French, Amharic, etc.)"],
      "formalityLevel": "moderate",
      "familyInvolvementNorm": "Extended family and faith community often play significant support roles. Matriarchs frequently coordinate family health decisions. Ask who the patient wants involved — do not assume.",
      "keyPhrases": ["I want to make sure you get the same quality of care as every patient", "Tell me what has worked and what has not worked for you in the past", "I hear you — let me address that concern", "Would you like to include anyone in this conversation?"],
      "avoidPhrases": ["You people (never appropriate)", "Pain tolerance / drug-seeking assumptions", "Suggesting race-based clinical decisions without evidence-based rationale", "Dismissing concerns as anxiety or non-compliance"],
      "contextSpecific": {
        "medication": "Acknowledge historical context if medication hesitancy arises. Note: race-based prescribing differences (e.g., avoiding ACE inhibitors in Black patients) are being re-evaluated — follow current evidence-based guidelines.",
        "diagnosis": "Deliver diagnoses with empathy and time. Many Black patients report feeling rushed or dismissed. Provide clear next steps and ensure the patient feels heard before ending the encounter.",
        "care_plan": "Include culturally relevant diet guidance — soul food is not inherently unhealthy, but preparation methods matter. Baking vs. frying, seasoning without excess salt. Incorporate church-based health programs when available.",
        "discharge": "Ensure follow-up appointments are scheduled before discharge (don''t say ''call to schedule''). Provide direct contact numbers. Black patients experience higher readmission rates — proactive follow-up reduces this disparity."
      }
    },
    "clinicalConsiderations": [
      {"condition": "Hypertension", "prevalence": "56% of Black adults vs. 48% of white adults; earlier onset, more severe", "screeningRecommendation": "Blood pressure at every visit; ambulatory BP monitoring for white-coat hypertension", "clinicalNote": "Salt sensitivity is more prevalent but is a physiological phenotype, not a racial trait. Current guidelines (AHA 2023) no longer recommend race-based first-line therapy. Address social stressors (racism, discrimination) as drivers of hypertension."},
      {"condition": "Sickle Cell Disease / Trait", "prevalence": "1 in 365 Black births (SCD); 1 in 13 has sickle cell trait", "screeningRecommendation": "Newborn screening is universal; trait counseling for carriers", "clinicalNote": "Sickle cell pain crises are frequently undertreated due to bias. Pain is real and severe — treat per evidence-based protocols (NHLBI guidelines)."},
      {"condition": "Maternal Mortality", "prevalence": "Black women are 2.6x more likely to die from pregnancy-related causes", "screeningRecommendation": "Enhanced prenatal monitoring; postpartum follow-up within 3 weeks (not 6)", "clinicalNote": "Disparity persists across ALL income and education levels — this is not explained by poverty. Listen to patient-reported symptoms — dismissal of pain and symptoms is a documented contributor to maternal deaths."},
      {"condition": "Diabetes (Type 2)", "prevalence": "Black adults are 60% more likely to be diagnosed than white adults", "screeningRecommendation": "A1C at age 35+; earlier if overweight with risk factors", "clinicalNote": "A1C may overestimate glucose in some Black patients due to hemoglobin variants. Use fructosamine or continuous glucose monitoring if A1C seems discordant with fingerstick readings."},
      {"condition": "Dermatological conditions", "prevalence": "Keloids, dermatosis papulosa nigra, traction alopecia, pseudofolliculitis barbae", "screeningRecommendation": "Skin assessment requires training on darker skin tones", "clinicalNote": "Cyanosis, jaundice, and rashes present differently on dark skin. Erythema appears as darkening rather than reddening. Pulse oximetry may overestimate O2 saturation in darker-skinned patients (FDA advisory)."},
      {"condition": "Mental health stigma", "prevalence": "Black adults are 20% more likely to report psychological distress but less likely to receive treatment", "screeningRecommendation": "PHQ-2/PHQ-9; normalize screening as routine", "clinicalNote": "Stigma around mental health is significant in many Black communities. Community-based approaches (church mental health programs, peer support) may be more acceptable than traditional therapy initially."}
    ],
    "barriers": [
      {"barrier": "Medical mistrust rooted in historical harm", "impact": "Lower participation in clinical trials, vaccine hesitancy, delayed care-seeking", "mitigation": "Acknowledge the history directly when relevant. Build trust through consistency, transparency, and follow-through. Do not dismiss mistrust as irrational — it is evidence-based from the patient''s perspective."},
      {"barrier": "Provider bias (implicit and explicit)", "impact": "Black patients receive less pain medication, fewer referrals, shorter visit times", "mitigation": "Institutional bias training (not just awareness). Standardized pain protocols. Audit prescribing patterns by race. Diversify clinical staff."},
      {"barrier": "Insurance and access disparities", "impact": "In non-expansion Medicaid states, Black adults have higher uninsured rates", "mitigation": "Screen for Medicaid eligibility. Connect with patient navigators. FQHC sliding scale. Community health worker programs."},
      {"barrier": "Food environment (food deserts/swamps)", "impact": "Limited access to fresh foods in many Black neighborhoods; abundant fast food", "mitigation": "Practical nutrition counseling based on available foods. Community garden programs. Mobile food markets. WIC and SNAP enrollment assistance."}
    ],
    "culturalPractices": [
      {"practice": "Faith-based healing and prayer", "description": "The Black church is a central institution for health, social support, and community organizing.", "clinicalImplication": "Respect and incorporate faith. Church-based health programs are evidence-based interventions. Do not position medicine against faith — ''God and medicine can work together.''"},
      {"practice": "Traditional food practices (soul food)", "description": "Deep-fried foods, salt pork seasoning, collard greens with ham hocks, sweet tea, and cornbread have cultural significance.", "clinicalImplication": "Do not tell patients to stop eating soul food. Teach healthier preparation methods: baking instead of frying, smoked turkey instead of pork."},
      {"practice": "Hair and scalp care", "description": "Hair care practices (protective styles, chemical treatments, wigs/weaves) are culturally significant and can affect scalp health.", "clinicalImplication": "Ask about hair care practices when relevant to scalp complaints. CCCA is more common in Black women. Respectful examination of hair and scalp is important."}
    ],
    "trustFactors": [
      {"factor": "Tuskegee Syphilis Study (1932-1972)", "historicalContext": "US Public Health Service deliberately withheld treatment from 399 Black men with syphilis for 40 years.", "trustBuildingStrategy": "Acknowledge this history when discussing clinical trials or new treatments. Informed consent must be thorough and unhurried."},
      {"factor": "Henrietta Lacks and tissue exploitation", "historicalContext": "HeLa cells were taken without consent in 1951 and commercialized for decades.", "trustBuildingStrategy": "Transparent informed consent for any tissue, blood, or genetic sampling. Explain exactly how samples will be used."},
      {"factor": "J. Marion Sims and gynecological experimentation", "historicalContext": "Developed surgical techniques by experimenting on enslaved Black women without anesthesia.", "trustBuildingStrategy": "Take pain seriously. Do not under-treat. Use standardized pain assessment tools. Believe patient-reported symptoms."}
    ],
    "supportSystems": [
      {"resource": "Black church health ministries", "description": "Church-based health education, screening events, and wellness programs", "accessInfo": "Connect with local Black churches and faith-based organizations."},
      {"resource": "National Black Nurses Association", "description": "Professional organization promoting health equity", "accessInfo": "nbna.org — resources for both providers and patients."},
      {"resource": "Sickle Cell Disease Association of America", "description": "Education, advocacy, and support for SCD patients and families", "accessInfo": "sicklecelldisease.org. Local chapters provide direct support services."}
    ],
    "sdohCodes": [
      {"code": "Z60.5", "description": "Target of perceived adverse discrimination and persecution", "applicability": "Patients reporting racial discrimination affecting health outcomes"},
      {"code": "Z63.4", "description": "Disappearance and death of family member", "applicability": "Intergenerational trauma, community violence exposure"},
      {"code": "Z59.41", "description": "Food insecurity", "applicability": "Food desert/swamp environments affecting nutrition"}
    ],
    "culturalRemedies": [
      {"remedy": "Castor oil (oral use)", "commonUse": "Constipation, cleansing, labor induction", "potentialInteractions": ["Stimulant laxative — electrolyte imbalance risk with chronic use", "May stimulate uterine contractions — avoid in pregnancy unless supervised", "Can reduce absorption of oral medications"], "warningLevel": "caution"},
      {"remedy": "Turpentine (oral or topical)", "commonUse": "Traditional remedy for colds, parasites, chest congestion", "potentialInteractions": ["Toxic if ingested — nephrotoxicity, CNS depression, pneumonitis", "Skin irritant and sensitizer", "No safe oral dose — discourage ingestion completely"], "warningLevel": "warning"},
      {"remedy": "Sassafras tea", "commonUse": "Spring tonic, blood purifier, cold remedy", "potentialInteractions": ["Contains safrole — FDA banned as food additive (carcinogenic in animal studies)", "Hepatotoxic potential with chronic use", "Generally safe in occasional small amounts as traditional tea"], "warningLevel": "caution"}
    ]
  }'::jsonb,
  NULL,
  true
);

-- 5. Isolated Elderly
INSERT INTO cultural_profiles (population_key, display_name, description, caveat, profile_data, tenant_id, is_active)
VALUES (
  'isolated_elderly',
  'Isolated Elderly / Socially Disconnected Seniors',
  'Older adults (65+) living with limited social contact, often due to loss of spouse, mobility limitations, geographic distance from family, or technology barriers. Social isolation is an independent health risk factor — the mortality impact is equivalent to smoking 15 cigarettes per day.',
  'Not all elderly people are isolated, and not all isolated people are elderly. Some seniors prefer solitude and are not lonely. Ask about social connections without assuming deficit. Rural elderly, LGBTQ+ elders without family, and recently widowed individuals are at highest risk.',
  '{
    "communication": {
      "languagePreferences": ["Speak clearly and slowly — not loudly or condescendingly", "Use simple sentences; avoid medical jargon", "Repeat key information and provide written summaries in large print"],
      "formalityLevel": "formal",
      "familyInvolvementNorm": "Family may be absent, distant, or estranged. Do not assume family involvement is possible. Ask: ''Is there someone you trust who helps with your health decisions?''",
      "keyPhrases": ["Who do you talk to most often?", "How are you getting to your appointments?", "Do you have someone who can help with your medications?", "Would you like us to connect you with a senior companion program?"],
      "avoidPhrases": ["Don''t you have family who can help?", "You should get out more", "Just use the patient portal / download the app", "Can your children help with this?"],
      "contextSpecific": {
        "medication": "Polypharmacy is the #1 medication risk. Review ALL medications at every visit. Use pill organizers. Simplify regimens — once-daily preferred. Consider blister packs from pharmacy.",
        "diagnosis": "Deliver slowly with written backup. Ensure teach-back. Cognitive screening may be needed before complex treatment decisions. Ask about advance directives.",
        "care_plan": "Build around actual support resources, not assumed family. Include meal delivery, transportation, and social connection goals. Falls prevention is always relevant.",
        "discharge": "Never discharge to an empty home without confirming: food availability, medication management capacity, fall risk assessment, ability to call for help. Social work referral should be automatic."
      }
    },
    "clinicalConsiderations": [
      {"condition": "Social Isolation (as clinical condition)", "prevalence": "24% of community-dwelling adults 65+ are socially isolated (NASEM 2020)", "screeningRecommendation": "LSNS-6 (Lubben Social Network Scale) or UCLA Loneliness Scale", "clinicalNote": "Social isolation increases risk of dementia by 50%, heart disease by 29%, stroke by 32%, and all-cause mortality by 26%. It is as dangerous as obesity or physical inactivity."},
      {"condition": "Falls", "prevalence": "1 in 4 adults 65+ falls each year; leading cause of injury death in elderly", "screeningRecommendation": "Timed Up and Go (TUG) test; Morse Fall Scale; annual fall risk assessment", "clinicalNote": "Isolated elderly who fall may not be found for hours or days. Assess for medical alert devices. Review medications for fall-risk contributors."},
      {"condition": "Polypharmacy", "prevalence": "40% of adults 65+ take 5+ medications; 20% take 10+", "screeningRecommendation": "AGS Beers Criteria review at every visit; medication reconciliation", "clinicalNote": "Isolated patients may not have anyone to help manage complex regimens. Check for duplicate prescriptions from multiple providers."},
      {"condition": "Depression and Cognitive Decline", "prevalence": "Late-life depression affects 7% of elderly; isolation doubles dementia risk", "screeningRecommendation": "PHQ-2/GDS; Mini-Cog or MMSE for cognition", "clinicalNote": "Depression and early dementia can look similar (pseudodementia). Isolation accelerates both. Social prescribing has evidence base for both."},
      {"condition": "Malnutrition and Dehydration", "prevalence": "15-50% of elderly in community settings are malnourished or at risk", "screeningRecommendation": "MNA (Mini Nutritional Assessment); weight at every visit", "clinicalNote": "People who eat alone eat less and eat worse. Meals on Wheels addresses social AND nutritional needs simultaneously."}
    ],
    "barriers": [
      {"barrier": "Technology barriers", "impact": "Cannot use patient portals, telehealth, online scheduling", "mitigation": "Phone-based follow-up as default. Simple telehealth platforms with printed instructions. Tablet loan programs. Tech-savvy volunteer pairing."},
      {"barrier": "Transportation", "impact": "Cannot drive, no family to drive, public transit may be inaccessible", "mitigation": "Medicaid NEMT. Area Agency on Aging transit programs. Home-based primary care for homebound patients. Telehealth for follow-ups when possible."},
      {"barrier": "No emergency contact or health advocate", "impact": "Falls, medication errors, or acute symptoms may go unnoticed for days", "mitigation": "Medical alert devices (PERS). Daily check-in programs. Community health worker home visits. Utility company medical necessity lists."},
      {"barrier": "Fixed income / financial constraints", "impact": "Cannot afford medications, copays, nutritious food, or home modifications", "mitigation": "Extra Help (Medicare Part D subsidy). SNAP/food assistance. LIHEAP for utilities. State pharmaceutical assistance programs."}
    ],
    "culturalPractices": [
      {"practice": "Faith and church community", "description": "For many elderly, church or faith community is the primary social connection. Regular attendance may decline with mobility loss.", "clinicalImplication": "Ask about faith community involvement. Church-based health ministries can provide wellness checks. Chaplain referral for spiritual distress."},
      {"practice": "Routines and independence", "description": "Many isolated elderly maintain strict daily routines as a coping mechanism. Independence is deeply valued.", "clinicalImplication": "Frame assistance as ''tools for independence'' not ''signs of decline.'' Preserve autonomy. Small, incremental support is better received than major changes."}
    ],
    "trustFactors": [
      {"factor": "Loss of agency in healthcare decisions", "historicalContext": "Many elderly patients have experienced being talked over, decisions made without their input, or being treated as incompetent.", "trustBuildingStrategy": "Always address the patient directly, not their companion. Ask for their preferences. Include them in every decision. Do not assume cognitive impairment — assess it."},
      {"factor": "Nursing home fears", "historicalContext": "COVID-19 nursing home deaths intensified fear of institutional placement.", "trustBuildingStrategy": "Emphasize home-based care options first. Frame interventions as keeping them independent at home longer. Be transparent about when institutional care might be needed."}
    ],
    "supportSystems": [
      {"resource": "Area Agency on Aging (AAA)", "description": "Federal network providing services for older adults — meals, transportation, caregiver support", "accessInfo": "eldercare.acl.gov or 1-800-677-1116 (Eldercare Locator). No income requirement for most services."},
      {"resource": "Meals on Wheels", "description": "Home-delivered meals + daily wellness check", "accessInfo": "mealsonwheelsamerica.org. No strict income requirement. Also provides pet food programs."},
      {"resource": "AARP Community Connections", "description": "Volunteer-driven phone and video companionship for isolated older adults", "accessInfo": "aarpcommunityconnections.org. Free. Weekly companion calls."}
    ],
    "sdohCodes": [
      {"code": "Z60.2", "description": "Problems related to living alone", "applicability": "Elderly patients living alone without regular social contact"},
      {"code": "Z63.4", "description": "Disappearance and death of family member", "applicability": "Recently widowed or bereaved elderly"},
      {"code": "Z74.2", "description": "Need for assistance at home and no other household member able to render care", "applicability": "Elderly without in-home support for ADLs or medication management"},
      {"code": "Z59.41", "description": "Food insecurity", "applicability": "Isolated elderly with limited access to nutritious food"}
    ],
    "culturalRemedies": [
      {"remedy": "Over-the-counter medication accumulation", "commonUse": "Self-treatment of pain, sleep, digestion — often multiple OTC products with overlapping ingredients", "potentialInteractions": ["Acetaminophen toxicity from multiple products containing it", "Anticholinergic burden from diphenhydramine — increased confusion and fall risk", "NSAID GI bleeding risk, especially with concurrent anticoagulants", "Drug-drug interactions with prescribed medications unknown to prescriber"], "warningLevel": "warning"},
      {"remedy": "Herbal supplements for memory and energy", "commonUse": "Ginkgo biloba, ginseng, B-vitamin megadoses", "potentialInteractions": ["Ginkgo: anticoagulant properties — risk with warfarin, aspirin", "Ginseng: may affect blood glucose and blood pressure medications", "High-dose B vitamins: generally safe but can mask B12 deficiency symptoms"], "warningLevel": "caution"}
    ]
  }'::jsonb,
  NULL,
  true
);

-- 6. Indigenous / Native American / Alaska Native
INSERT INTO cultural_profiles (population_key, display_name, description, caveat, profile_data, tenant_id, is_active)
VALUES (
  'indigenous',
  'Indigenous / Native American / Alaska Native',
  'A diverse population encompassing 574 federally recognized tribes, each with distinct languages, traditions, governance structures, and health profiles. Indigenous health is shaped by centuries of colonization, forced assimilation, and ongoing systemic inequities — but also by extraordinary cultural resilience, traditional knowledge systems, and community strength.',
  'There is no single ''Native American culture.'' A Navajo elder in Arizona, an Ojibwe teenager in Minnesota, and an Aleut fisherman in Alaska have vastly different cultural contexts. Tribal affiliation, urban vs. reservation residence, and degree of cultural connectedness all matter. Always ask about tribal identity and individual preferences — never assume.',
  '{
    "communication": {
      "languagePreferences": ["Ask about preferred language — some elders speak tribal languages primarily", "Interpreter services for tribal languages are limited but should be attempted", "Silence may be respectful listening, not disengagement — do not rush to fill silence"],
      "formalityLevel": "moderate",
      "familyInvolvementNorm": "Extended family and clan/band structures are central. Elders hold significant authority in health decisions. Grandparents often raise grandchildren. Ask who should be involved.",
      "keyPhrases": ["What tribe or nation are you affiliated with?", "Are there traditional practices that are important to your healing?", "Would you like to include family or an elder in this conversation?", "I want to work together with any traditional healers you see"],
      "avoidPhrases": ["Indian (unless the patient uses it themselves)", "Spirit animal / spirit guide (trivializes sacred concepts)", "Your people / your tribe does X (stereotyping)", "You should stop using traditional medicine (dismissive)"],
      "contextSpecific": {
        "medication": "Ask about traditional medicines — many patients use both Western and traditional remedies simultaneously. Frame as integration, not competition. Consider medication access on reservations (IHS pharmacy vs. commercial).",
        "diagnosis": "Some tribes have cultural protocols around discussing serious illness. Ask how the patient wants to receive difficult news. Some may want a family member or elder present.",
        "care_plan": "Integrate traditional healing goals alongside Western medicine goals. Walking in balance (physical, mental, emotional, spiritual) is a common framework. Include IHS and tribal health resources.",
        "discharge": "Ensure IHS or tribal health facility can continue care. Transportation from hospitals to remote reservations is a major barrier. Coordinate with tribal community health representatives (CHRs)."
      }
    },
    "clinicalConsiderations": [
      {"condition": "Type 2 Diabetes", "prevalence": "AI/AN adults are 2.5x more likely to be diagnosed than non-Hispanic whites; highest rates of any US racial group", "screeningRecommendation": "A1C or fasting glucose at age 35+; earlier with any risk factor", "clinicalNote": "The diabetes epidemic is directly linked to colonization — forced dietary changes from traditional foods to commodity foods. Focus on food sovereignty and traditional food programs as intervention."},
      {"condition": "Substance Use Disorders", "prevalence": "AI/AN have highest rates of SUD of any racial group; alcohol-related death rate 5.3x higher", "screeningRecommendation": "AUDIT-C; single-question drug screen; ask about methamphetamine", "clinicalNote": "Substance use must be understood in context of historical trauma. Culture-based treatment (sweat lodge, talking circles) has growing evidence base. MAT access is limited on many reservations."},
      {"condition": "Suicide", "prevalence": "AI/AN youth (15-24) have highest suicide rate of any demographic group", "screeningRecommendation": "Columbia Suicide Severity Rating Scale; PHQ-A for adolescents", "clinicalNote": "Cultural connectedness is a documented protective factor. Ask about cultural identity, language knowledge, and community involvement as strengths."},
      {"condition": "Cardiovascular Disease", "prevalence": "AI/AN have 50% higher heart disease death rate than white population", "screeningRecommendation": "Lipid panel, BP, A1C per AHA guidelines", "clinicalNote": "Traditional diets (wild game, fish, berries, roots) are protective — support food sovereignty programs. Telehealth cardiology has shown promise for remote communities."}
    ],
    "barriers": [
      {"barrier": "Geographic isolation (reservation healthcare)", "impact": "Many reservations are hours from the nearest hospital or specialist. IHS facilities are chronically underfunded.", "mitigation": "IHS telehealth expansion. Tribal CHR programs for home visits. Purchased/Referred Care for off-reservation specialty care. Mobile health clinics."},
      {"barrier": "IHS funding and service gaps", "impact": "IHS per-capita spending is $4,078 vs. $10,000+ national average", "mitigation": "Verify IHS eligibility and PRC authorization. Help with Medicaid/Medicare enrollment. Tribal health programs may supplement IHS."},
      {"barrier": "Historical trauma and institutional distrust", "impact": "Forced sterilization, boarding schools, and broken treaties create deep distrust", "mitigation": "Acknowledge history directly. Support tribal self-determination. Tribal health programs run by the tribe may be more trusted."},
      {"barrier": "Cultural disconnection as health risk", "impact": "Urban AI/AN may lack tribal community connections", "mitigation": "Connect with urban Indian health organizations (UIHOs). Cultural programming. Native-specific recovery groups (Wellbriety). Language revitalization programs."}
    ],
    "culturalPractices": [
      {"practice": "Traditional medicine and ceremony", "description": "Sweat lodge, smudging (sage, cedar, sweetgrass), pipe ceremonies, vision quests, and traditional plant medicines are active healing practices.", "clinicalImplication": "Never dismiss traditional healing. Accommodate ceremony requests in hospital settings when possible. Integrate traditional and Western treatment plans."},
      {"practice": "Community-based healing circles", "description": "Talking circles and healing ceremonies involve the community in individual healing. Health is balance among physical, mental, emotional, and spiritual dimensions.", "clinicalImplication": "Group-based therapeutic approaches may be more culturally aligned. The Medicine Wheel framework can structure holistic care plans."},
      {"practice": "Traditional foods as medicine", "description": "Wild game, salmon, berries, roots, and traditional preparations have nutritional and cultural significance.", "clinicalImplication": "Support traditional food access over commodity food dependence. Traditional diets are generally lower glycemic index, higher in lean protein and omega-3s."}
    ],
    "trustFactors": [
      {"factor": "Boarding school era (1860s-1960s+)", "historicalContext": "Government and church-run boarding schools forcibly removed Indigenous children from families. Physical, sexual, and emotional abuse was widespread.", "trustBuildingStrategy": "Institutional settings can trigger boarding school trauma associations for elders. Allow cultural practices. Do not restrict family visiting."},
      {"factor": "Forced sterilization (1960s-1970s)", "historicalContext": "IHS sterilized an estimated 25-50% of Native American women, often without informed consent.", "trustBuildingStrategy": "Absolute thoroughness in informed consent for any reproductive procedure. This history is within living memory."},
      {"factor": "Treaty violations and broken promises", "historicalContext": "Healthcare is a treaty obligation — not a benefit or charity. Chronic underfunding of IHS is itself a treaty violation.", "trustBuildingStrategy": "Frame healthcare as a right, not a privilege. Respect tribal sovereignty. Do not require gratitude for treaty-obligated services."}
    ],
    "supportSystems": [
      {"resource": "Indian Health Service (IHS)", "description": "Federal health service for AI/AN — direct care, tribal programs, and urban Indian health", "accessInfo": "ihs.gov. No cost for eligible patients."},
      {"resource": "Urban Indian Health Organizations (UIHOs)", "description": "Health services for AI/AN living in urban areas (70%+ of AI/AN live off-reservation)", "accessInfo": "34 UIHOs nationally. uihi.org. Serve AI/AN regardless of tribal enrollment status."},
      {"resource": "Tribal Community Health Representatives (CHRs)", "description": "Community-based health workers providing home visits and care coordination", "accessInfo": "Contact local tribal health department. CHRs are tribe-employed and culturally embedded."}
    ],
    "sdohCodes": [
      {"code": "Z60.5", "description": "Target of perceived adverse discrimination and persecution", "applicability": "Systemic discrimination affecting healthcare access and outcomes"},
      {"code": "Z59.1", "description": "Inadequate housing", "applicability": "Reservation housing shortages — many homes lack plumbing, electricity, or adequate heating"},
      {"code": "Z59.41", "description": "Food insecurity", "applicability": "Food deserts on reservations; disrupted traditional food systems"},
      {"code": "Z62.819", "description": "Personal history of unspecified abuse in childhood", "applicability": "Boarding school survivors and intergenerational trauma"}
    ],
    "culturalRemedies": [
      {"remedy": "Sage, cedar, and sweetgrass (smudging)", "commonUse": "Spiritual cleansing, prayer, ceremony", "potentialInteractions": ["Smoke exposure concern for respiratory patients — discuss alternatives like sage spray", "Generally safe from drug interaction perspective", "Accommodate in hospital settings when possible"], "warningLevel": "info"},
      {"remedy": "Traditional herbal preparations (varies by tribe)", "commonUse": "Echinacea, yarrow, wild cherry bark, bearberry — immune support, pain, respiratory, urinary", "potentialInteractions": ["Echinacea: may interfere with immunosuppressants", "Yarrow: anticoagulant properties", "Wild cherry bark: contains amygdalin — toxic in large doses", "Bearberry: hepatotoxic with prolonged use"], "warningLevel": "caution"},
      {"remedy": "Peyote (Lophophora williamsii) — ceremonial use", "commonUse": "Sacred sacrament in Native American Church ceremonies", "potentialInteractions": ["Contains mescaline — serotonergic effects; risk with SSRIs/MAOIs", "Cardiovascular stimulant properties", "Legally protected for NAC members", "Do not conflate ceremonial use with substance abuse"], "warningLevel": "caution"}
    ]
  }'::jsonb,
  NULL,
  true
);

-- 7. Immigrant / Refugee
INSERT INTO cultural_profiles (population_key, display_name, description, caveat, profile_data, tenant_id, is_active)
VALUES (
  'immigrant_refugee',
  'Immigrant / Refugee',
  'A profoundly diverse population including economic immigrants, asylum seekers, refugees, unaccompanied minors, and undocumented individuals from every region of the world. Health needs are shaped by pre-migration exposures, migration journey trauma, and post-migration stressors.',
  'Immigrants and refugees are not the same — refugees have legal status and resettlement support; asylum seekers are in process; undocumented individuals have neither. Country of origin, education level, English proficiency, and time in the US vary enormously. Ask — never assume.',
  '{
    "communication": {
      "languagePreferences": ["Use certified medical interpreters — ALWAYS. Never family members, especially children.", "Phone/video interpretation available for 200+ languages", "Assess literacy in native language — spoken fluency does not equal health literacy"],
      "formalityLevel": "formal",
      "familyInvolvementNorm": "Family structures vary by culture of origin. Many cultures expect family involvement in all medical decisions. In refugee families, children may be more acculturated than parents.",
      "keyPhrases": ["What language are you most comfortable speaking?", "We have an interpreter available — would you like to use one?", "Your immigration status does not affect your right to care here", "Tell me about any medicines or treatments you used in your home country"],
      "avoidPhrases": ["Where are you really from?", "Are you legal? / Do you have papers?", "You''re lucky to be here (dismisses trauma and loss)", "In America, we do it this way (cultural imposition)"],
      "contextSpecific": {
        "medication": "Verify medication history from country of origin — brand names differ. Patients may have been taking medications from home country pharmacies. Explain US pharmacy system.",
        "diagnosis": "Cultural concepts of disease vary — some cultures attribute illness to spiritual causes alongside biomedical explanation. Both frameworks can coexist. Allow processing time for distressing diagnoses.",
        "care_plan": "Consider documentation status when planning: undocumented patients may not have insurance. Refugee patients have 8-month Refugee Medical Assistance. Build achievable plans.",
        "discharge": "Verify understanding through interpreter (not family). Provide written instructions in patient''s language. Refugee resettlement agencies can help coordinate care."
      }
    },
    "clinicalConsiderations": [
      {"condition": "Infectious disease screening", "prevalence": "Varies by country — TB, hepatitis B/C, parasites, malaria, HIV", "screeningRecommendation": "CDC Domestic Screening Guidelines for Newly Arrived Refugees; TB (IGRA), Hep B, Hep C, HIV, stool O&P, RPR", "clinicalNote": "Screen based on country of origin epidemiology, not race or appearance. Strongyloides screening for anyone from tropical regions."},
      {"condition": "Vaccine catch-up", "prevalence": "Most refugees and many immigrants have incomplete vaccination records", "screeningRecommendation": "Review records; serologic testing; follow ACIP catch-up schedule", "clinicalNote": "When in doubt, revaccinate — it is safe. Use the CDC catch-up schedule for age."},
      {"condition": "PTSD and Trauma", "prevalence": "30-86% of refugees meet criteria for PTSD", "screeningRecommendation": "Refugee Health Screener-15 (RHS-15); Harvard Trauma Questionnaire; PHQ-9", "clinicalNote": "Trauma may include war, torture, sexual violence, witnessing death, dangerous migration journeys. Somatization is common. Culturally adapted trauma therapy (NET, EMDR) has evidence base."},
      {"condition": "Dental disease", "prevalence": "Extensive untreated dental caries and periodontal disease", "screeningRecommendation": "Dental exam within 90 days of arrival", "clinicalNote": "Dental care may have been unavailable for years. Connect to FQHC dental programs."},
      {"condition": "Chronic diseases (delayed diagnosis)", "prevalence": "Diabetes, hypertension, CKD often undiagnosed prior to arrival", "screeningRecommendation": "Comprehensive metabolic panel, A1C, lipid panel, urinalysis at initial screening", "clinicalNote": "Conditions may be advanced at presentation. Genetic conditions prevalent in specific populations should be considered based on origin."}
    ],
    "barriers": [
      {"barrier": "Language and interpretation access", "impact": "Without interpreters, informed consent is impossible and medical errors increase", "mitigation": "Certified medical interpreters for all clinical encounters. Phone/video for uncommon languages. Translated consent forms."},
      {"barrier": "Immigration status and fear", "impact": "Undocumented patients avoid healthcare due to fear of enforcement", "mitigation": "Emergency Medicaid covers emergency care regardless of status. FQHCs serve all patients. Post signage about patient rights in multiple languages."},
      {"barrier": "Insurance gaps", "impact": "Refugees get 8-month Refugee Medical Assistance, then may be uninsured", "mitigation": "Refugee Medical Assistance enrollment. Medicaid in some states. FQHC sliding scale. Community health workers to navigate enrollment."},
      {"barrier": "Cultural health beliefs incompatible with Western medicine", "impact": "May delay care-seeking or refuse certain treatments", "mitigation": "Do not dismiss traditional beliefs. Find common ground. Involve cultural brokers. Harm reduction approach."}
    ],
    "culturalPractices": [
      {"practice": "Traditional healing systems from country of origin", "description": "Patients may use traditional Chinese medicine, Ayurveda, Unani medicine, cupping (hijama), coining (gua sha/cao gio), or herbal preparations.", "clinicalImplication": "Ask about ALL treatments. Coining and cupping marks may look like abuse — be aware before reporting. Some traditional preparations contain heavy metals."},
      {"practice": "Community and religious authority in health decisions", "description": "Religious leaders and community elders may be consulted for health decisions.", "clinicalImplication": "Consulting community authority is a culturally appropriate decision-making process. Be aware of religious dietary restrictions affecting medication formulations and nutrition plans."}
    ],
    "trustFactors": [
      {"factor": "Government persecution in country of origin", "historicalContext": "Many refugees fled governments that used healthcare as a tool of persecution.", "trustBuildingStrategy": "Explain that US healthcare providers are independent of immigration enforcement. Build trust gradually through consistent, respectful care."},
      {"factor": "Detention and border experiences", "historicalContext": "Many have experienced detention, family separation, and inadequate medical care in custody.", "trustBuildingStrategy": "Do not ask about immigration journey unless clinically relevant. Recognize that clinical settings can trigger detention-related trauma."}
    ],
    "supportSystems": [
      {"resource": "Refugee Resettlement Agencies", "description": "Nine national agencies and local affiliates provide initial resettlement services", "accessInfo": "Contact local resettlement agency. Services typically last 90 days-1 year post-arrival."},
      {"resource": "Federally Qualified Health Centers (FQHCs)", "description": "Serve all patients regardless of immigration status or ability to pay", "accessInfo": "findahealthcenter.hrsa.gov. Sliding fee scale. Many have on-site interpretation."},
      {"resource": "National Immigrant Women''s Advocacy Project (NIWAP)", "description": "Legal and health resources for immigrant women experiencing domestic violence or trafficking", "accessInfo": "niwap.org. Resources in multiple languages. VAWA and T-visa protections."}
    ],
    "sdohCodes": [
      {"code": "Z60.3", "description": "Acculturation difficulty", "applicability": "Immigrants and refugees adjusting to US systems"},
      {"code": "Z60.5", "description": "Target of perceived adverse discrimination and persecution", "applicability": "Immigration-related discrimination"},
      {"code": "Z65.4", "description": "Victim of crime and terrorism", "applicability": "Refugees with persecution, war, or trafficking history"},
      {"code": "Z59.7", "description": "Insufficient social insurance and welfare support", "applicability": "Immigration-status-related insurance gaps"}
    ],
    "culturalRemedies": [
      {"remedy": "Cupping (hijama) and coining (cao gio / gua sha)", "commonUse": "Pain relief, respiratory illness — widespread across Middle Eastern, East Asian, and Southeast Asian communities", "potentialInteractions": ["Leaves bruises/marks that can be mistaken for abuse", "Risk of burn injury from fire cupping", "Generally safe from drug interaction perspective", "Educate ER staff to recognize these marks"], "warningLevel": "info"},
      {"remedy": "Ayurvedic preparations (South Asian immigrants)", "commonUse": "Holistic health management", "potentialInteractions": ["Some products contain heavy metals (lead, mercury, arsenic) — FDA warnings", "Herbal ingredients may interact with blood thinners and diabetes drugs", "Ask patients to bring containers to appointments"], "warningLevel": "warning"},
      {"remedy": "Traditional Chinese medicine (TCM) herbs", "commonUse": "Widely used by East Asian immigrants for chronic conditions", "potentialInteractions": ["Ma huang (ephedra): cardiovascular stimulant", "Dang gui (angelica): anticoagulant", "Some formulas contain multiple herbs with complex interactions", "Aristolochic acid is nephrotoxic and carcinogenic"], "warningLevel": "warning"}
    ]
  }'::jsonb,
  NULL,
  true
);

-- 8. LGBTQ+ Elderly
INSERT INTO cultural_profiles (population_key, display_name, description, caveat, profile_data, tenant_id, is_active)
VALUES (
  'lgbtq_elderly',
  'LGBTQ+ Elderly',
  'Older adults (65+) who identify as lesbian, gay, bisexual, transgender, queer, or other sexual/gender minority identities. This generation came of age when homosexuality was classified as a mental illness (DSM until 1973), faced criminalization, and survived the AIDS crisis. Many spent decades hiding their identity from healthcare providers.',
  'LGBTQ+ elderly are not a monolithic group. A 70-year-old gay man who was out in San Francisco in the 1970s has a very different experience from an 80-year-old bisexual woman in rural Alabama who has never disclosed her identity. Transgender elders face compounded discrimination. Race, class, disability, and geography all intersect.',
  '{
    "communication": {
      "languagePreferences": ["Ask about and use preferred name and pronouns — document in chart", "Use inclusive language: ''partner'' or ''spouse'' rather than assuming gender", "Forms should include gender identity and sexual orientation options"],
      "formalityLevel": "moderate",
      "familyInvolvementNorm": "Chosen family (close friends, community members, ex-partners) may be the primary support network. Legal next-of-kin may be an estranged biological family member. Ask: ''Who do you consider your family?''",
      "keyPhrases": ["What name would you like us to use?", "What pronouns do you use?", "Do you have a partner or spouse?", "Is there anything about your identity that is important for your care?"],
      "avoidPhrases": ["Assuming heterosexuality or cisgender identity", "Lifestyle / sexual preference (use ''sexual orientation'' and ''identity'')", "You don''t look transgender / You''d never know", "Have you had ''the surgery''? (irrelevant unless clinically necessary)"],
      "contextSpecific": {
        "medication": "For transgender elders: hormone therapy interactions with age-related medications are critical. Estrogen + age increases DVT/stroke risk. Testosterone affects lipids and hematocrit. Some patients may have self-administered hormones for decades without medical supervision.",
        "diagnosis": "HIV/STI screening should be routine and non-stigmatizing. Cancer screenings must follow organ inventory (screen based on anatomy present, not gender identity).",
        "care_plan": "Include chosen family. Address social isolation proactively — LGBTQ+ elders are 2x more likely to live alone. Consider SAGE-affiliated services. Mental health support should be with LGBTQ-affirming providers.",
        "discharge": "Ensure receiving facility is LGBTQ-affirming. SAGE provides a Long-Term Care Facility Equality Index. Verify that partner/chosen family has visitation rights."
      }
    },
    "clinicalConsiderations": [
      {"condition": "HIV / AIDS (long-term survivors)", "prevalence": "50% of people living with HIV in the US are 50+", "screeningRecommendation": "HIV screening regardless of age; CD4/viral load monitoring for known positive", "clinicalNote": "Long-term survivors face accelerated aging, early-onset cardiovascular disease, osteoporosis. Antiretroviral interactions with age-related drugs are complex. Grief from the AIDS crisis is often unprocessed."},
      {"condition": "Mental health disparities", "prevalence": "2x rates of depression and anxiety; 2.5x more likely to live alone", "screeningRecommendation": "PHQ-9, GAD-7; LSNS-6; ask about minority stress", "clinicalNote": "Minority stress model: decades of concealment, discrimination, and hypervigilance create chronic stress. Creating a safe space to disclose can be therapeutic in itself."},
      {"condition": "Substance use", "prevalence": "Higher rates of alcohol and tobacco use linked to minority stress", "screeningRecommendation": "AUDIT-C; smoking assessment; ask about party drug history without judgment", "clinicalNote": "Bars were historically the only safe social space. Amyl nitrite (poppers) may have cardiovascular implications with PDE5 inhibitors. LGBTQ-affirming treatment is more effective."},
      {"condition": "Transgender-specific aging concerns", "prevalence": "Estimated 0.5-1% of elderly population is transgender", "screeningRecommendation": "Organ-inventory-based screening; hormone level monitoring; bone density", "clinicalNote": "Long-term hormone therapy affects cardiovascular risk, bone density, and cancer screening needs. Ask respectfully what surgeries have been done."},
      {"condition": "Cancer screening disparities", "prevalence": "Lesbian/bisexual women have lower cervical screening rates; gay men have higher anal cancer rates", "screeningRecommendation": "Cervical screening regardless of sexual orientation; anal Pap for MSM with HIV", "clinicalNote": "Provider assumptions about sexual behavior can lead to inappropriate or missed screening."}
    ],
    "barriers": [
      {"barrier": "Fear of discrimination in healthcare settings", "impact": "Many delay or avoid care, do not disclose identity, or re-closet when entering healthcare systems", "mitigation": "Visible safety indicators: rainbow flags, inclusive forms, staff training. LGBTQ-affirming provider directories (GLMA, OutCare)."},
      {"barrier": "Long-term care discrimination", "impact": "Documented abuse, neglect, and forced re-closeting in nursing homes", "mitigation": "Refer to SAGE Equality Index rated facilities. Advance directives designating chosen family. Advocate for inclusive policies."},
      {"barrier": "Legal and financial vulnerability", "impact": "Pre-marriage equality survivors may lack spousal benefits or Social Security survivor benefits", "mitigation": "Legal aid referrals for estate planning. Ensure advance directives name chosen family. SAGE legal resources."},
      {"barrier": "Social isolation and lack of chosen family support", "impact": "AIDS crisis decimated social networks. Higher rates of living alone and childlessness.", "mitigation": "SAGE-affiliated senior centers. LGBTQ+ community centers with elder programs. Friendly visitor programs. LGBTQ-affirming faith communities."}
    ],
    "culturalPractices": [
      {"practice": "Chosen family as primary support system", "description": "Many LGBTQ+ elders built families of choice — close friends, ex-partners, community members — who provide the support traditionally associated with biological family.", "clinicalImplication": "Include chosen family in care planning and visitation. Do not prioritize biological family over chosen family without patient direction. Document chosen family in chart."},
      {"practice": "Community resilience and activism", "description": "This generation survived criminalization, the AIDS crisis, and fought for civil rights.", "clinicalImplication": "Connect with LGBTQ+ senior organizations (SAGE). Community involvement is a health protective factor. Ask about community connections as a strength assessment."}
    ],
    "trustFactors": [
      {"factor": "Homosexuality as mental illness (DSM until 1973)", "historicalContext": "''Treatment'' included electroshock therapy, aversion therapy, institutionalization, and lobotomy. Some elderly patients experienced these firsthand.", "trustBuildingStrategy": "Acknowledge this history. Affirm that LGBTQ+ identity is not a disorder. Mental health referrals must be to LGBTQ-affirming therapists."},
      {"factor": "AIDS crisis response (1981-1996)", "historicalContext": "The US government''s delayed response resulted in hundreds of thousands of deaths. Healthcare workers refused to treat AIDS patients.", "trustBuildingStrategy": "Acknowledge the impact on the patient''s generation. Provide affirming care. Do not assume HIV status or suggest screening in a stereotyping way."}
    ],
    "supportSystems": [
      {"resource": "SAGE (Services & Advocacy for GLBT Elders)", "description": "National organization for LGBTQ+ older adults", "accessInfo": "sageusa.org. National LGBTQ+ Elder Hotline: 1-888-234-SAGE."},
      {"resource": "GLMA: Health Professionals Advancing LGBTQ Equality", "description": "Provider directory for LGBTQ-affirming healthcare providers", "accessInfo": "glma.org. Searchable by location and specialty."},
      {"resource": "National Resource Center on LGBTQ+ Aging", "description": "Training and resources for aging service providers", "accessInfo": "lgbtagingcenter.org. Free online training."}
    ],
    "sdohCodes": [
      {"code": "Z60.5", "description": "Target of perceived adverse discrimination and persecution", "applicability": "Discrimination based on sexual orientation or gender identity"},
      {"code": "Z60.2", "description": "Problems related to living alone", "applicability": "LGBTQ+ elders living alone — 2x more likely than heterosexual peers"},
      {"code": "Z76.5", "description": "Malingerer — DO NOT USE for gender identity", "applicability": "NOTE: This code was historically misapplied to transgender patients. Gender dysphoria has its own coding (F64.x). Never code gender identity as malingering."}
    ],
    "culturalRemedies": [
      {"remedy": "Hormone self-administration (transgender elders)", "commonUse": "Estrogen, testosterone, or anti-androgens obtained outside medical supervision — sometimes for decades", "potentialInteractions": ["Unmonitored estrogen: DVT/PE risk increases with age, especially with smoking", "Unmonitored testosterone: polycythemia risk, liver effects, lipid changes", "Spironolactone: hyperkalemia risk with ACE inhibitors or potassium-sparing diuretics", "Silicone injections (non-medical grade): granuloma formation, migration, embolization"], "warningLevel": "warning"},
      {"remedy": "Poppers (amyl/butyl nitrite)", "commonUse": "Recreational vasodilation — historically associated with gay male social culture", "potentialInteractions": ["FATAL interaction with PDE5 inhibitors (sildenafil, tadalafil) — severe hypotension", "Risk of methemoglobinemia", "Vision changes (poppers maculopathy) — permanent retinal damage possible"], "warningLevel": "warning"}
    ]
  }'::jsonb,
  NULL,
  true
);

COMMIT;

-- Verify seed count
-- SELECT count(*) as seeded_profiles FROM cultural_profiles WHERE tenant_id IS NULL;
-- Expected: 8
