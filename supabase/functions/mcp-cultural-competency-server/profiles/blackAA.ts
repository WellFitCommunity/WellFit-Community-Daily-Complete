// =====================================================
// Cultural Profile: Black / African American
// References: AHA CVD Disparities, ACOG Maternal Mortality,
//             NIH/NIMHD Health Disparities Research
// =====================================================

import type { CulturalProfile } from "../types.ts";

export const blackAAProfile: CulturalProfile = {
  populationKey: "black_aa",
  displayName: "Black / African American",
  description:
    "A diverse population including multi-generational African Americans, Caribbean immigrants, African immigrants, and mixed-race individuals. Historical and ongoing systemic racism in healthcare creates unique challenges that clinicians must understand and actively address.",
  caveat:
    "Black/African American is not a monolithic identity. A Haitian immigrant, a third-generation Chicagoan, and a Nigerian-American have different cultural contexts. The shared experience is navigating a healthcare system with documented racial bias. Do not treat race as a clinical variable — treat the disparities it creates.",

  communication: {
    languagePreferences: [
      "Standard professional communication — do not alter speech patterns",
      "For Caribbean or African immigrants, assess language needs (Haitian Creole, French, Amharic, etc.)",
    ],
    formalityLevel: "moderate",
    familyInvolvementNorm:
      "Extended family and faith community often play significant support roles. Matriarchs frequently coordinate family health decisions. Ask who the patient wants involved — do not assume.",
    keyPhrases: [
      "I want to make sure you get the same quality of care as every patient",
      "Tell me what has worked and what has not worked for you in the past",
      "I hear you — let me address that concern",
      "Would you like to include anyone in this conversation?",
    ],
    avoidPhrases: [
      "You people (never appropriate)",
      "Pain tolerance / drug-seeking assumptions",
      "Suggesting race-based clinical decisions without evidence-based rationale",
      "Dismissing concerns as anxiety or non-compliance",
    ],
    contextSpecific: {
      medication:
        "Acknowledge historical context if medication hesitancy arises: 'I understand there are reasons for concern. Let me explain exactly what this medication does and why I recommend it.' Note: race-based prescribing differences (e.g., avoiding ACE inhibitors in Black patients) are being re-evaluated — follow current evidence-based guidelines.",
      diagnosis:
        "Deliver diagnoses with empathy and time. Many Black patients report feeling rushed or dismissed. Provide clear next steps and ensure the patient feels heard before ending the encounter.",
      care_plan:
        "Include culturally relevant diet guidance — soul food is not inherently unhealthy, but preparation methods matter. Baking vs. frying, seasoning without excess salt. Incorporate church-based health programs when available.",
      discharge:
        "Ensure follow-up appointments are scheduled before discharge (don't say 'call to schedule'). Provide direct contact numbers. Black patients experience higher readmission rates — proactive follow-up reduces this disparity.",
    },
  },

  clinicalConsiderations: [
    {
      condition: "Hypertension",
      prevalence: "56% of Black adults vs. 48% of white adults; earlier onset, more severe",
      screeningRecommendation: "Blood pressure at every visit; ambulatory BP monitoring for white-coat hypertension",
      clinicalNote:
        "Salt sensitivity is more prevalent but is a physiological phenotype, not a racial trait. Current guidelines (AHA 2023) no longer recommend race-based first-line therapy. Thiazides and CCBs remain effective; ACE/ARB effectiveness varies by individual, not by race. Address social stressors (racism, discrimination) as drivers of hypertension.",
    },
    {
      condition: "Sickle Cell Disease / Trait",
      prevalence: "1 in 365 Black births (SCD); 1 in 13 has sickle cell trait",
      screeningRecommendation: "Newborn screening is universal; trait counseling for carriers",
      clinicalNote:
        "Sickle cell pain crises are frequently undertreated due to bias. Pain is real and severe — treat per evidence-based protocols (NHLBI guidelines). Sickle cell trait is usually benign but has rare complications (exertional sickling, renal medullary carcinoma).",
    },
    {
      condition: "Maternal Mortality",
      prevalence: "Black women are 2.6x more likely to die from pregnancy-related causes",
      screeningRecommendation: "Enhanced prenatal monitoring; postpartum follow-up within 3 weeks (not 6)",
      clinicalNote:
        "Disparity persists across ALL income and education levels — this is not explained by poverty. Preeclampsia, cardiomyopathy, and hemorrhage are leading causes. Listen to patient-reported symptoms — dismissal of pain and symptoms is a documented contributor to maternal deaths.",
    },
    {
      condition: "Diabetes (Type 2)",
      prevalence: "Black adults are 60% more likely to be diagnosed than white adults",
      screeningRecommendation: "A1C at age 35+; earlier if overweight with risk factors",
      clinicalNote:
        "A1C may overestimate glucose in some Black patients due to hemoglobin variants. Use fructosamine or continuous glucose monitoring if A1C seems discordant with fingerstick readings. Dietary counseling should respect food traditions while addressing preparation methods.",
    },
    {
      condition: "Dermatological conditions",
      prevalence: "Keloids, dermatosis papulosa nigra, traction alopecia, pseudofolliculitis barbae",
      screeningRecommendation: "Skin assessment requires training on darker skin tones",
      clinicalNote:
        "Many clinical images in training materials show conditions only on light skin. Cyanosis, jaundice, and rashes present differently on dark skin. Erythema appears as darkening rather than reddening. Pulse oximetry may overestimate O2 saturation in darker-skinned patients (FDA advisory).",
    },
    {
      condition: "Mental health stigma",
      prevalence: "Black adults are 20% more likely to report psychological distress but less likely to receive treatment",
      screeningRecommendation: "PHQ-2/PHQ-9; normalize screening as routine",
      clinicalNote:
        "Stigma around mental health is significant in many Black communities. 'Strength' narratives can delay help-seeking. Community-based approaches (church mental health programs, peer support) may be more acceptable than traditional therapy initially.",
    },
  ],

  barriers: [
    {
      barrier: "Medical mistrust rooted in historical harm",
      impact: "Lower participation in clinical trials, vaccine hesitancy, delayed care-seeking",
      mitigation:
        "Acknowledge the history directly when relevant. Build trust through consistency, transparency, and follow-through. Do not dismiss mistrust as irrational — it is evidence-based from the patient's perspective.",
    },
    {
      barrier: "Provider bias (implicit and explicit)",
      impact: "Black patients receive less pain medication, fewer referrals, shorter visit times",
      mitigation:
        "Institutional bias training (not just awareness). Standardized pain protocols. Audit prescribing patterns by race. Diversify clinical staff.",
    },
    {
      barrier: "Insurance and access disparities",
      impact: "In non-expansion Medicaid states, Black adults have higher uninsured rates",
      mitigation:
        "Screen for Medicaid eligibility. Connect with patient navigators. FQHC sliding scale. Community health worker programs.",
    },
    {
      barrier: "Food environment (food deserts/swamps)",
      impact: "Limited access to fresh foods in many Black neighborhoods; abundant fast food",
      mitigation:
        "Practical nutrition counseling based on available foods. Community garden programs. Mobile food markets. WIC and SNAP enrollment assistance.",
    },
  ],

  culturalPractices: [
    {
      practice: "Faith-based healing and prayer",
      description:
        "The Black church is a central institution for health, social support, and community organizing. Many patients incorporate prayer into their health management. 'Laying on of hands' and anointing with oil are common practices.",
      clinicalImplication:
        "Respect and incorporate faith. Church-based health programs (health ministries, walking groups, screening events) are evidence-based interventions. Do not position medicine against faith — 'God and medicine can work together.'",
    },
    {
      practice: "Traditional food practices (soul food)",
      description:
        "Deep-fried foods, salt pork seasoning, collard greens with ham hocks, sweet tea, and cornbread have cultural significance tied to family, celebration, and African American history.",
      clinicalImplication:
        "Do not tell patients to stop eating soul food. Teach healthier preparation methods: baking instead of frying, smoked turkey instead of pork, reducing added salt and sugar. Acknowledge the emotional and cultural importance of food traditions.",
    },
    {
      practice: "Hair and scalp care",
      description:
        "Hair care practices (protective styles, chemical treatments, wigs/weaves) are culturally significant and can affect scalp health. Traction alopecia from tight hairstyles is a medical concern.",
      clinicalImplication:
        "Ask about hair care practices when relevant to scalp complaints. Central centrifugal cicatricial alopecia (CCCA) is more common in Black women. Respectful examination of hair and scalp is important — ask permission, explain why.",
    },
  ],

  trustFactors: [
    {
      factor: "Tuskegee Syphilis Study (1932-1972)",
      historicalContext:
        "US Public Health Service deliberately withheld treatment from 399 Black men with syphilis for 40 years to study disease progression. The study continued long after penicillin became available.",
      trustBuildingStrategy:
        "Acknowledge this history when discussing clinical trials or new treatments. Informed consent must be thorough and unhurried. Provide written information. Allow time for questions and family consultation.",
    },
    {
      factor: "Henrietta Lacks and tissue exploitation",
      historicalContext:
        "HeLa cells were taken without consent in 1951 and commercialized for decades. Family received no compensation or acknowledgment until recently. Represents broader pattern of extracting from Black bodies without consent.",
      trustBuildingStrategy:
        "Transparent informed consent for any tissue, blood, or genetic sampling. Explain exactly how samples will be used, stored, and shared. Offer opt-out for research use.",
    },
    {
      factor: "J. Marion Sims and gynecological experimentation",
      historicalContext:
        "The 'father of modern gynecology' developed surgical techniques by experimenting on enslaved Black women without anesthesia. This foundational violence persists in disparate pain treatment today.",
      trustBuildingStrategy:
        "Take pain seriously. Do not under-treat. Use standardized pain assessment tools. Believe patient-reported symptoms. The legacy of dismissing Black pain is a clinical safety issue, not just a historical one.",
    },
  ],

  supportSystems: [
    {
      resource: "Black church health ministries",
      description: "Church-based health education, screening events, and wellness programs",
      accessInfo: "Connect with local Black churches and faith-based organizations. Many partner with health departments for community health worker programs.",
    },
    {
      resource: "National Black Nurses Association",
      description: "Professional organization promoting health equity and connecting Black patients with culturally competent care",
      accessInfo: "nbna.org — resources for both providers and patients.",
    },
    {
      resource: "Sickle Cell Disease Association of America",
      description: "Education, advocacy, and support for SCD patients and families",
      accessInfo: "sicklecelldisease.org. Local chapters provide direct support services.",
    },
  ],

  sdohCodes: [
    {
      code: "Z60.5",
      description: "Target of perceived adverse discrimination and persecution",
      applicability: "Patients reporting racial discrimination affecting health outcomes or care-seeking",
    },
    {
      code: "Z63.4",
      description: "Disappearance and death of family member (historical trauma context)",
      applicability: "Intergenerational trauma, community violence exposure",
    },
    {
      code: "Z59.41",
      description: "Food insecurity",
      applicability: "Food desert/swamp environments affecting nutrition and chronic disease management",
    },
  ],

  culturalRemedies: [
    {
      remedy: "Castor oil (oral use)",
      commonUse: "Constipation, 'cleansing,' labor induction (traditional use)",
      potentialInteractions: [
        "Stimulant laxative — electrolyte imbalance risk with chronic use",
        "May stimulate uterine contractions — avoid in pregnancy unless supervised",
        "Can reduce absorption of oral medications",
      ],
      warningLevel: "caution",
    },
    {
      remedy: "Turpentine (oral or topical, traditional use)",
      commonUse: "Traditional remedy for colds, parasites, chest congestion",
      potentialInteractions: [
        "Toxic if ingested — nephrotoxicity, CNS depression, pneumonitis",
        "Skin irritant and sensitizer",
        "No safe oral dose — discourage ingestion completely",
      ],
      warningLevel: "warning",
    },
    {
      remedy: "Sassafras tea",
      commonUse: "Spring tonic, blood purifier, cold remedy",
      potentialInteractions: [
        "Contains safrole — FDA banned as food additive (carcinogenic in animal studies)",
        "Hepatotoxic potential with chronic use",
        "Generally safe in occasional small amounts as traditional tea",
      ],
      warningLevel: "caution",
    },
  ],
};
