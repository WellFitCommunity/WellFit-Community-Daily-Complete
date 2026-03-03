// =====================================================
// Cultural Profile: Spanish-Speaking / Latino / Hispanic
// References: CDC Hispanic/Latino Health, AHRQ Health Literacy,
//             SAMHSA Cultural Competence resources
// =====================================================

import type { CulturalProfile } from "../types.ts";

export const latinoProfile: CulturalProfile = {
  populationKey: "latino",
  displayName: "Spanish-Speaking / Latino / Hispanic",
  description:
    "A diverse population encompassing people from 20+ countries of origin with distinct cultural, linguistic, and health profiles. Shared cultural values include familismo (family-centered decisions), respeto (respectful communication), and personalismo (warm personal relationships in professional settings).",
  caveat:
    "Latino/Hispanic is not a monolithic identity. A Cuban-American in Miami, a recent Guatemalan immigrant, and a fifth-generation Tejano family have very different experiences. Country of origin, generation, acculturation level, and indigenous heritage all matter. Ask — do not assume.",

  communication: {
    languagePreferences: [
      "Assess language preference at every visit — do not assume from name or appearance",
      "Use certified medical interpreters, not family members (especially not children)",
      "Offer written materials in Spanish at appropriate literacy level",
    ],
    formalityLevel: "formal",
    familyInvolvementNorm:
      "Familismo: family is central to health decisions. Expect and welcome family members at appointments. The patient may defer to an elder or spouse for major decisions. This is not a lack of autonomy — it is a cultural value.",
    keyPhrases: [
      "Would you like to include family in this conversation?",
      "Let me explain this in a way that is easy to share with your family",
      "We have a Spanish-speaking interpreter available",
      "Tell me about any home remedies you use — I want to make sure everything works safely together",
    ],
    avoidPhrases: [
      "Can your child translate? (violation of interpreter standards)",
      "You need to make this decision yourself (may conflict with familismo)",
      "Just Google it in Spanish (health literacy varies widely)",
      "Are you legal? / Do you have papers? (irrelevant to care, creates fear)",
    ],
    contextSpecific: {
      medication:
        "Explain purpose clearly — 'para que sirve.' Many patients take medications only when symptomatic. Emphasize continuing even when feeling better. Ask about herbal teas and remedios caseros (home remedies) for interaction screening.",
      diagnosis:
        "Use the term 'condition' rather than 'disease' when possible — less stigmatizing. For diabetes: address fatalism ('es mi destino') with empowerment messaging. Involve family in education.",
      care_plan:
        "Include family in goal-setting. Consider diet modifications that respect traditional foods rather than replacing them. Tortillas are not the enemy — portion guidance is more effective than elimination.",
      discharge:
        "Provide instructions in Spanish with pictures. Verify understanding with teach-back (not 'do you understand?'). Include family contact for follow-up reminders.",
    },
  },

  clinicalConsiderations: [
    {
      condition: "Type 2 Diabetes",
      prevalence: "Latino adults are 70% more likely to be diagnosed than non-Hispanic whites",
      screeningRecommendation: "A1C or fasting glucose at age 35+ (ADA); earlier if overweight with risk factors",
      clinicalNote:
        "Dietary counseling should incorporate traditional foods. Rice and beans are nutritious — focus on cooking methods and portions. Atole, aguas frescas, and pan dulce are significant sugar sources. Metformin education in preferred language is critical.",
    },
    {
      condition: "Obesity",
      prevalence: "47% of Hispanic adults have obesity (vs. 42% overall)",
      screeningRecommendation: "BMI at every visit; waist circumference for metabolic risk",
      clinicalNote:
        "Weight stigma exists in healthcare. Body ideals vary culturally — 'gordito/a' may be affectionate, not medical. Focus on health outcomes, not appearance. Physical activity programs should be culturally relevant (dance, walking groups).",
    },
    {
      condition: "Chronic Liver Disease / Hepatitis",
      prevalence: "Hispanic men have highest rates of liver disease-related death in the US",
      screeningRecommendation: "Hep B/C screening per USPSTF; liver function tests if risk factors",
      clinicalNote:
        "Alcohol use patterns vary by country of origin. NAFLD/NASH prevalence is high, linked to metabolic syndrome. Traditional herbal preparations may have hepatotoxic potential — ask specifically.",
    },
    {
      condition: "Depression / Anxiety (Culture-Bound Syndromes)",
      prevalence: "Higher rates of depression among immigrant Latinos vs. US-born",
      screeningRecommendation: "PHQ-9 in Spanish (validated version); ask about nervios, susto",
      clinicalNote:
        "Nervios (chronic anxiety/distress) and susto (soul loss from fright) are recognized culture-bound syndromes. They are real experiences with real symptoms — do not dismiss. They may overlap with clinical anxiety, PTSD, or depression.",
    },
    {
      condition: "Cervical Cancer",
      prevalence: "Hispanic women have highest incidence of cervical cancer in the US",
      screeningRecommendation: "Cervical screening per ACS guidelines; HPV vaccination outreach",
      clinicalNote:
        "Barriers include modesty concerns, lack of female providers, and immigration-related fears. Ensure culturally sensitive exam protocols. HPV vaccine education should address parental concerns in culturally appropriate terms.",
    },
  ],

  barriers: [
    {
      barrier: "Language barrier",
      impact: "Medical errors 2x more likely when professional interpreters are not used",
      mitigation:
        "Certified medical interpreters (in-person or phone/video). Never use children as interpreters. Bilingual staff do not replace interpreters unless certified. Use teach-back method.",
    },
    {
      barrier: "Immigration status fears",
      impact: "Undocumented patients avoid care due to fear of deportation, reporting, or public charge rule",
      mitigation:
        "Post 'safe space' signage. Train staff on confidentiality protections. EMTALA guarantees emergency care regardless of status. FQHCs serve all regardless of immigration status. Do not ask about documentation unless directly relevant to benefits enrollment.",
    },
    {
      barrier: "Health literacy",
      impact: "41% of Hispanic adults have below-basic health literacy (NAAL)",
      mitigation:
        "Use plain language in preferred language. Visual aids and pictograms for medication instructions. Teach-back verification (not 'do you understand?'). Culturally adapted patient education materials.",
    },
    {
      barrier: "Insurance gaps",
      impact: "19% of Hispanic people are uninsured (highest rate of any racial/ethnic group)",
      mitigation:
        "Screen for Medicaid eligibility (varies by state and immigration status). FQHC sliding scale. Emergency Medicaid for qualifying conditions. Community health worker (promotora) enrollment assistance.",
    },
  ],

  culturalPractices: [
    {
      practice: "Remedios caseros (home remedies)",
      description:
        "Herbal teas, poultices, and traditional preparations are widely used. Manzanilla (chamomile), yerba buena (mint), ruda (rue), and sábila (aloe vera) are common. Some families use sobadores (traditional massage therapists).",
      clinicalImplication:
        "Ask about all home remedies — patients may not mention them unless asked directly. Most herbal teas are safe, but some (e.g., ruda in pregnancy) have contraindications. Frame as 'I want to make sure everything works safely together.'",
    },
    {
      practice: "Curanderismo (traditional healing)",
      description:
        "Traditional healing system using prayer, herbs, massage, and spiritual cleansing (limpia). Curanderos/as are respected community healers.",
      clinicalImplication:
        "Do not dismiss or compete with curanderismo. It addresses spiritual and social dimensions that biomedicine may not. Ask if the patient is seeing a curandero/a and what treatments they recommend. Identify potential interactions.",
    },
    {
      practice: "Religious faith and healing",
      description:
        "Strong Catholic or evangelical Christian faith. Prayer, saints, promises (mandas), and pilgrimage may be part of healing. Some may attribute illness to God's will (destino).",
      clinicalImplication:
        "Respect faith-based coping. Address fatalism with empowerment, not dismissal: 'God gave us medicine as a tool too.' Chaplain or faith leader involvement can increase treatment adherence.",
    },
  ],

  trustFactors: [
    {
      factor: "Immigration enforcement in healthcare settings",
      historicalContext:
        "ICE operations near clinics and hospitals have occurred, creating fear that seeking care leads to deportation. The public charge rule (even after narrowing) created lasting hesitancy.",
      trustBuildingStrategy:
        "Clearly communicate confidentiality policies. Display signage in Spanish about patient rights. Train all staff — front desk to clinicians — on immigration-neutral protocols. Partner with trusted community organizations.",
    },
    {
      factor: "Forced sterilization history",
      historicalContext:
        "Documented forced sterilization of Latina women in California prisons (2006-2010) and ICE detention (2020). Historical eugenic sterilization programs targeted Mexican-American women.",
      trustBuildingStrategy:
        "Thorough informed consent for any reproductive procedure. Offer interpreter for consent conversations. Do not pressure family planning discussions. Respect reproductive autonomy absolutely.",
    },
  ],

  supportSystems: [
    {
      resource: "Promotoras de salud (community health workers)",
      description: "Trusted community members trained to provide health education and navigation",
      accessInfo: "Available through FQHCs, health departments, and community organizations serving Latino populations.",
    },
    {
      resource: "SAMHSA National Helpline (Spanish)",
      description: "Free, confidential mental health and substance use referral service",
      accessInfo: "1-800-662-4357 (oprima 2 para español). Available 24/7.",
    },
    {
      resource: "National Alliance on Mental Illness (NAMI) Latino resources",
      description: "Mental health education and support groups in Spanish",
      accessInfo: "nami.org/Your-Journey/Identity-and-Cultural-Dimensions/Hispanic-Latinx",
    },
  ],

  sdohCodes: [
    {
      code: "Z60.3",
      description: "Acculturation difficulty",
      applicability: "Recent immigrants adapting to US healthcare system and culture",
    },
    {
      code: "Z60.5",
      description: "Target of perceived adverse discrimination and persecution",
      applicability: "Patients reporting immigration-related discrimination affecting health",
    },
    {
      code: "Z59.7",
      description: "Insufficient social insurance and welfare support",
      applicability: "Immigration-status-related insurance gaps",
    },
  ],

  culturalRemedies: [
    {
      remedy: "Manzanilla (chamomile tea)",
      commonUse: "Digestive issues, anxiety, sleep, colic in infants",
      potentialInteractions: [
        "Mild anticoagulant properties — caution with warfarin",
        "Possible allergic reaction in ragweed-allergic patients",
      ],
      warningLevel: "info",
    },
    {
      remedy: "Ruda (rue / Ruta graveolens)",
      commonUse: "Menstrual regulation, spiritual cleansing, stomach pain",
      potentialInteractions: [
        "ABORTIFACIENT — contraindicated in pregnancy",
        "Phototoxic — causes severe burns with sun exposure",
        "Hepatotoxic in large doses",
      ],
      warningLevel: "warning",
    },
    {
      remedy: "Epazote (Dysphania ambrosioides)",
      commonUse: "Digestive aid, added to beans to reduce gas, antiparasitic",
      potentialInteractions: [
        "Essential oil form (oil of chenopodium) is toxic — liver and kidney damage",
        "Safe as culinary herb in food quantities",
        "Contraindicated in pregnancy in medicinal doses",
      ],
      warningLevel: "caution",
    },
    {
      remedy: "Sábila (aloe vera, ingested)",
      commonUse: "Digestive health, diabetes management, wound healing",
      potentialInteractions: [
        "Aloe latex is a stimulant laxative — electrolyte imbalance risk",
        "May lower blood glucose — additive with diabetes medications",
        "Can reduce absorption of oral medications if taken simultaneously",
      ],
      warningLevel: "caution",
    },
  ],
};
