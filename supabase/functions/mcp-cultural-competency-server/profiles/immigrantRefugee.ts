// =====================================================
// Cultural Profile: Immigrant / Refugee
// References: CDC Immigrant & Refugee Health, WHO Vaccine
//             Schedules, UNHCR Health Guidelines,
//             National Immigrant Women's Advocacy Project
// =====================================================

import type { CulturalProfile } from "../types.ts";

export const immigrantRefugeeProfile: CulturalProfile = {
  populationKey: "immigrant_refugee",
  displayName: "Immigrant / Refugee",
  description:
    "A profoundly diverse population including economic immigrants, asylum seekers, refugees, unaccompanied minors, and undocumented individuals from every region of the world. Health needs are shaped by pre-migration exposures (conflict, persecution, infectious disease), migration journey trauma, and post-migration stressors (documentation fears, language barriers, acculturation stress, discrimination).",
  caveat:
    "Immigrants and refugees are not the same — refugees have legal status and resettlement support; asylum seekers are in process; undocumented individuals have neither. Country of origin, education level, English proficiency, and time in the US vary enormously. A Syrian refugee physician and an unaccompanied Guatemalan minor have very different needs. Ask — never assume.",

  communication: {
    languagePreferences: [
      "Use certified medical interpreters — ALWAYS. Never family members, especially children.",
      "Phone/video interpretation available for 200+ languages (LanguageLine, CYRACOM)",
      "Assess literacy in native language — spoken fluency does not equal health literacy",
    ],
    formalityLevel: "formal",
    familyInvolvementNorm:
      "Family structures vary by culture of origin. Many cultures expect family involvement in all medical decisions. Gender dynamics may mean a male family member speaks for a female patient — ensure you hear the patient's own voice through the interpreter. In refugee families, children may be more acculturated than parents.",
    keyPhrases: [
      "What language are you most comfortable speaking?",
      "We have an interpreter available — would you like to use one?",
      "Your immigration status does not affect your right to care here",
      "Tell me about any medicines or treatments you used in your home country",
    ],
    avoidPhrases: [
      "Where are you really from? (for US-born children of immigrants)",
      "Are you legal? / Do you have papers?",
      "You're lucky to be here (dismisses trauma and loss)",
      "In America, we do it this way (cultural imposition)",
    ],
    contextSpecific: {
      medication:
        "Verify medication history from country of origin — brand names differ, some medications available OTC abroad are prescription-only in the US (and vice versa). Patients may have been taking medications from home country pharmacies or informal sources. Explain US pharmacy system (prescription requirement, insurance, generics).",
      diagnosis:
        "Cultural concepts of disease vary — some cultures attribute illness to spiritual causes, evil eye, or humoral imbalance alongside or instead of biomedical explanation. Both frameworks can coexist. Interpreter must convey nuance, not just words. Allow processing time for distressing diagnoses.",
      care_plan:
        "Consider documentation status when planning: undocumented patients may not have insurance, may fear hospitals, and may not return for follow-up if afraid. Refugee patients have 8-month Refugee Medical Assistance. Build plans that are achievable within the patient's actual circumstances.",
      discharge:
        "Verify the patient understands discharge instructions through interpreter (not family). Provide written instructions in patient's language if available. Ensure follow-up is with a provider who has interpreter access. Refugee resettlement agencies can help coordinate care.",
    },
  },

  clinicalConsiderations: [
    {
      condition: "Infectious disease screening",
      prevalence: "Varies by country of origin — TB, hepatitis B/C, parasites, malaria, HIV",
      screeningRecommendation: "CDC Domestic Screening Guidelines for Newly Arrived Refugees; TB (IGRA), Hep B surface antigen/antibody, Hep C antibody, HIV, stool O&P, malaria smear (if from endemic area), RPR/VDRL, urinalysis",
      clinicalNote:
        "Screen based on country of origin epidemiology, not race or appearance. Latent TB is common — treat per LTBI guidelines. Hepatitis B carrier state may require monitoring. Strongyloides screening for anyone from tropical regions (can reactivate decades later with immunosuppression).",
    },
    {
      condition: "Vaccine catch-up",
      prevalence: "Most refugees and many immigrants have incomplete vaccination records",
      screeningRecommendation: "Review any available records; serologic testing for immunity; follow ACIP catch-up schedule",
      clinicalNote:
        "Vaccination history may be missing, incomplete, or on unfamiliar forms. When in doubt, revaccinate — it is safe. Use the CDC catch-up schedule for age. Some vaccines available abroad are different formulations. Overseas vaccination records from IOM panel exams should be in the medical packet.",
    },
    {
      condition: "PTSD and Trauma",
      prevalence: "30-86% of refugees meet criteria for PTSD (varies by population and study)",
      screeningRecommendation: "Refugee Health Screener-15 (RHS-15); Harvard Trauma Questionnaire; PHQ-9 in appropriate language",
      clinicalNote:
        "Trauma may include war, torture, sexual violence, witnessing death, dangerous migration journeys, and detention. Many patients will not volunteer trauma history — screen systematically. Somatization is common (headaches, body pain, GI symptoms as primary complaints for psychological distress). Culturally adapted trauma therapy (NET, EMDR) has evidence base.",
    },
    {
      condition: "Dental disease",
      prevalence: "Extensive untreated dental caries and periodontal disease common in refugee populations",
      screeningRecommendation: "Dental exam within 90 days of arrival (per refugee screening guidelines)",
      clinicalNote:
        "Dental care may have been unavailable for years. Pain may be the presenting complaint. Connect with FQHC dental programs. Dental disease affects nutrition, employment, and social integration.",
    },
    {
      condition: "Chronic diseases (delayed diagnosis)",
      prevalence: "Diabetes, hypertension, and chronic kidney disease often undiagnosed prior to arrival",
      screeningRecommendation: "Comprehensive metabolic panel, A1C, lipid panel, urinalysis at initial screening",
      clinicalNote:
        "Conditions that would have been caught by routine screening in the US may be advanced at presentation. End-stage renal disease at first presentation is not uncommon. Genetic conditions prevalent in specific populations (sickle cell, thalassemia, G6PD) should be considered based on origin.",
    },
  ],

  barriers: [
    {
      barrier: "Language and interpretation access",
      impact: "Without interpreters, informed consent is impossible and medical errors increase dramatically",
      mitigation:
        "Certified medical interpreters for all clinical encounters (federal requirement for entities receiving federal funding). Phone/video interpretation for uncommon languages. Translated consent forms and discharge instructions. Bilingual staff do not replace certified interpreters unless formally qualified.",
    },
    {
      barrier: "Immigration status and fear",
      impact: "Undocumented patients avoid healthcare due to fear of immigration enforcement, public charge rule implications, or simply not knowing their rights",
      mitigation:
        "Clearly communicate that healthcare is separate from immigration enforcement. Emergency Medicaid covers emergency care regardless of status. FQHCs serve all patients regardless of documentation. Post signage about patient rights in multiple languages. Do not collect immigration status data unnecessarily.",
    },
    {
      barrier: "Insurance gaps",
      impact: "Refugees get 8-month Refugee Medical Assistance, then may be uninsured. Undocumented individuals generally cannot purchase ACA plans.",
      mitigation:
        "Refugee Medical Assistance enrollment within 30 days. Medicaid (in some states, regardless of status for children and pregnant women). FQHC sliding scale. Charity care programs. Community health workers to navigate enrollment.",
    },
    {
      barrier: "Cultural health beliefs incompatible with Western medicine",
      impact: "May delay care-seeking, refuse certain treatments, or follow conflicting advice from traditional healers",
      mitigation:
        "Do not dismiss traditional beliefs. Find common ground: 'I respect your practices — let me explain what this medicine does so we can make sure everything works safely together.' Involve cultural brokers or community leaders when appropriate. Harm reduction approach for practices that conflict with medical advice.",
    },
  ],

  culturalPractices: [
    {
      practice: "Traditional healing systems from country of origin",
      description:
        "Patients may use traditional Chinese medicine, Ayurveda, Unani medicine, cupping (hijama), coining (gua sha/cao gio), or herbal preparations from their home tradition. These are complete medical systems, not 'folk remedies.'",
      clinicalImplication:
        "Ask about ALL treatments and practitioners. Coining and cupping may leave marks that look like abuse — be aware before reporting. Some traditional preparations contain heavy metals (Ayurvedic medicines) or hepatotoxic herbs. Integration is possible and should be the goal.",
    },
    {
      practice: "Community and religious authority in health decisions",
      description:
        "Religious leaders (imams, priests, monks, pastors) and community elders may be consulted for health decisions, especially around reproductive health, end-of-life care, organ donation, and mental health.",
      clinicalImplication:
        "Understand that consulting community authority is not a sign of dependence — it is a culturally appropriate decision-making process. Offer to include religious/community leaders in care conversations when appropriate. Be aware of religious dietary restrictions (halal, kosher, vegetarian) that affect medication formulations and nutrition plans.",
    },
  ],

  trustFactors: [
    {
      factor: "Government persecution in country of origin",
      historicalContext:
        "Many refugees fled governments that used healthcare as a tool of persecution — forced sterilization, denying care to ethnic minorities, medical experimentation, psychiatric imprisonment of dissidents.",
      trustBuildingStrategy:
        "Understand that fear of government-connected healthcare is rational based on lived experience. Clearly explain that US healthcare providers are independent of immigration enforcement. Build trust gradually through consistent, respectful care. Allow patients to bring trusted companions to appointments.",
    },
    {
      factor: "Detention and border experiences",
      historicalContext:
        "Many immigrants and asylum seekers have experienced detention, family separation, inadequate medical care in custody, and traumatic border crossings. Medical professionals in detention settings may be associated with negative experiences.",
      trustBuildingStrategy:
        "Do not ask about immigration journey unless clinically relevant. If patient discloses, listen without judgment. Recognize that clinical settings can trigger detention-related trauma. Provide patient-centered, trauma-informed care.",
    },
  ],

  supportSystems: [
    {
      resource: "Refugee Resettlement Agencies",
      description: "Nine national agencies (e.g., IRC, USCRI, LIRS) and their local affiliates provide initial resettlement services",
      accessInfo: "Contact local resettlement agency for care coordination. Services typically last 90 days-1 year post-arrival.",
    },
    {
      resource: "Federally Qualified Health Centers (FQHCs)",
      description: "Community health centers that serve all patients regardless of immigration status or ability to pay",
      accessInfo: "findahealthcenter.hrsa.gov. Sliding fee scale. Many have on-site interpretation and refugee health programs.",
    },
    {
      resource: "National Immigrant Women's Advocacy Project (NIWAP)",
      description: "Legal and health resources for immigrant women experiencing domestic violence or trafficking",
      accessInfo: "niwap.org. Resources in multiple languages. Connects to legal aid for VAWA and T-visa protections.",
    },
  ],

  sdohCodes: [
    {
      code: "Z60.3",
      description: "Acculturation difficulty",
      applicability: "Immigrants and refugees adjusting to US healthcare and social systems",
    },
    {
      code: "Z60.5",
      description: "Target of perceived adverse discrimination and persecution",
      applicability: "Immigration-related discrimination affecting health access and outcomes",
    },
    {
      code: "Z65.4",
      description: "Victim of crime and terrorism",
      applicability: "Refugees and asylum seekers with persecution, war, or trafficking history",
    },
    {
      code: "Z59.7",
      description: "Insufficient social insurance and welfare support",
      applicability: "Immigration-status-related gaps in insurance coverage",
    },
  ],

  culturalRemedies: [
    {
      remedy: "Cupping (hijama) and coining (cao gio / gua sha)",
      commonUse: "Pain relief, respiratory illness, 'releasing bad blood or wind' — widespread across Middle Eastern, East Asian, and Southeast Asian immigrant communities",
      potentialInteractions: [
        "Leaves circular bruises (cupping) or linear marks (coining) that can be mistaken for abuse",
        "Risk of burn injury from fire cupping if not done properly",
        "Generally safe from drug interaction perspective",
        "Educate ER staff to recognize these marks",
      ],
      warningLevel: "info",
    },
    {
      remedy: "Ayurvedic preparations (South Asian immigrants)",
      commonUse: "Holistic health management — digestive, metabolic, respiratory, skin conditions",
      potentialInteractions: [
        "Some Ayurvedic products contain heavy metals (lead, mercury, arsenic) — FDA has issued multiple warnings",
        "Herbal ingredients may interact with prescribed medications (especially blood thinners and diabetes drugs)",
        "Ask specifically about branded products and have them bring containers to appointments",
      ],
      warningLevel: "warning",
    },
    {
      remedy: "Traditional Chinese medicine (TCM) herbs",
      commonUse: "Widely used by Chinese, Vietnamese, Korean, and other East Asian immigrants for chronic conditions",
      potentialInteractions: [
        "Ma huang (ephedra): cardiovascular stimulant — avoid with hypertension medications, MAOIs",
        "Dang gui (angelica): anticoagulant — risk with warfarin",
        "Some formulas contain multiple herbs with complex interactions",
        "Aristolochic acid (found in some formulas) is nephrotoxic and carcinogenic",
      ],
      warningLevel: "warning",
    },
  ],
};
