// =====================================================
// Cultural Profile: Unhoused / Homeless
// References: NHCHC Adapting Your Practice, HCH Clinician's Network
// =====================================================

import type { CulturalProfile } from "../types.ts";

export const unhousedProfile: CulturalProfile = {
  populationKey: "unhoused",
  displayName: "Unhoused / Experiencing Homelessness",
  description:
    "Individuals without stable housing, including those in shelters, transitional housing, unsheltered on the street, or 'doubling up' with others. Housing instability is a health condition — it affects every aspect of care delivery, medication adherence, and follow-up.",
  caveat:
    "Homelessness is not a personality trait. People experience homelessness due to economic, medical, and systemic factors. Avoid assumptions about substance use, mental illness, or personal responsibility. Ask about current living situation without judgment.",

  communication: {
    languagePreferences: ["Dignity-first language", "Plain language — avoid medical jargon"],
    formalityLevel: "informal",
    familyInvolvementNorm:
      "Traditional family structures may be absent. 'Street family' or shelter community may serve as support network. Ask who the patient trusts for health decisions.",
    keyPhrases: [
      "Where are you staying right now?",
      "What would make it easier for you to follow this plan?",
      "Is there a safe place you can store medications?",
      "Do you have a phone number where I can reach you?",
    ],
    avoidPhrases: [
      "Homeless person (use 'person experiencing homelessness')",
      "Non-compliant (they may lack the means, not the will)",
      "You need to come back in 2 weeks (may not be feasible)",
      "Take this with food three times a day (may not have regular meals)",
    ],
    contextSpecific: {
      medication:
        "Ask about storage: no refrigeration rules out insulin pens, many biologics. Ask about meal regularity for meds requiring food. Simplify regimens to once-daily when possible. Consider long-acting injectables over daily oral.",
      diagnosis:
        "Prioritize conditions that are immediately dangerous or cause pain. The patient may not return — treat what you can today. Write diagnoses in plain language on a card they can carry.",
      care_plan:
        "Build plans around the patient's reality: shelter hours, meal programs, transportation. Set achievable goals for 1-2 days, not 1-2 weeks. Include harm reduction, not just abstinence.",
      discharge:
        "Do NOT discharge to 'home' if there is none. Coordinate with shelter, medical respite, or street outreach team. Provide written discharge instructions they can carry. Include a map to follow-up locations.",
    },
  },

  clinicalConsiderations: [
    {
      condition: "Foot and skin conditions",
      prevalence: "Extremely common — immersion foot, cellulitis, frostbite, infestations",
      screeningRecommendation: "Foot exam at every encounter",
      clinicalNote:
        "Walking all day in ill-fitting shoes, sleeping in wet conditions. Trench foot still occurs. Provide clean socks as part of care. Check for tinea, cellulitis, peripheral vascular disease.",
    },
    {
      condition: "Respiratory illness",
      prevalence: "TB incidence 20-50x higher than general population",
      screeningRecommendation: "TB screening (IGRA preferred over TST) at intake and annually",
      clinicalNote:
        "Shelter crowding increases respiratory infection transmission. COPD common from environmental and smoking exposure. COVID-19 vaccination status often incomplete.",
    },
    {
      condition: "Mental health conditions",
      prevalence: "30-40% have serious mental illness; 50-70% have any mental health condition",
      screeningRecommendation: "PHQ-2/PHQ-9 for depression; Columbia Suicide Severity Rating Scale",
      clinicalNote:
        "Mental illness is often a cause AND consequence of homelessness. Do not assume it is the primary driver. Treat mental health and housing as interconnected, not sequential.",
    },
    {
      condition: "Substance use disorders",
      prevalence: "38% have alcohol use disorder; 26% report other drug use",
      screeningRecommendation: "AUDIT-C and single-question drug screening",
      clinicalNote:
        "Harm reduction approach is essential. Abstinence-only requirements for housing/services create barriers. Naloxone distribution should be routine. Ask about injection drug use for Hep C/HIV screening.",
    },
    {
      condition: "Dental disease",
      prevalence: "Untreated dental caries in majority; dental pain is common chief complaint",
      screeningRecommendation: "Oral exam at every primary care visit",
      clinicalNote:
        "Dental care is the most common unmet health need among unhoused individuals. Tooth pain drives ER visits. Connect to FQHC dental programs.",
    },
    {
      condition: "Trauma / Violence exposure",
      prevalence: "High rates of physical assault, sexual violence, witnessing violence",
      screeningRecommendation: "Trauma-informed universal precautions",
      clinicalNote:
        "Ask about safety, not just health. Women and LGBTQ+ individuals face disproportionate violence. Use trauma-informed care principles — predictability, transparency, choice.",
    },
  ],

  barriers: [
    {
      barrier: "No refrigeration for medications",
      impact: "Rules out insulin pens, many biologics, some antibiotics requiring cold storage",
      mitigation:
        "Prescribe room-temperature stable formulations. Long-acting injectables (e.g., Invega Sustenna, Sublocade, buprenorphine implant). Coordinate with pharmacies for daily dispensing.",
    },
    {
      barrier: "No stable address for follow-up",
      impact: "Cannot receive mail, appointment reminders, lab results",
      mitigation:
        "Use shelter address or clinic address as mailing address. Cell phone text reminders (many have phones). Drop-in hours instead of scheduled appointments.",
    },
    {
      barrier: "No identification documents",
      impact: "Cannot enroll in insurance, access many services",
      mitigation:
        "Connect with social worker for ID recovery. Many FQHCs and HCH programs serve patients without ID. Presumptive Medicaid eligibility in some states.",
    },
    {
      barrier: "Transportation",
      impact: "Cannot reach specialty appointments, imaging, pharmacy",
      mitigation:
        "Prescribe at on-site pharmacy when possible. Mobile health units. Medicaid non-emergency medical transportation (NEMT). Bus tokens or ride vouchers.",
    },
    {
      barrier: "Competing survival priorities",
      impact: "Finding food, shelter, and safety takes precedence over medical appointments",
      mitigation:
        "Co-locate services: medical care at shelters, food banks, day centers. Address immediate needs first — a sandwich and socks build more trust than a lecture on blood pressure.",
    },
  ],

  culturalPractices: [
    {
      practice: "Street community mutual aid",
      description:
        "Unhoused individuals often form tight-knit communities that share resources, watch out for each other's health, and provide emotional support.",
      clinicalImplication:
        "Ask who in their community helps with health. Peer health workers from the unhoused community are highly effective outreach. Do not disrupt these networks.",
    },
    {
      practice: "Harm reduction as self-care",
      description:
        "Supervised consumption, naloxone carrying, needle exchange, and safer use practices are active health-seeking behaviors.",
      clinicalImplication:
        "Affirm harm reduction efforts. Provide naloxone kits. Do not withhold care based on substance use status. Fentanyl test strips save lives.",
    },
  ],

  trustFactors: [
    {
      factor: "Institutional trauma",
      historicalContext:
        "Many unhoused individuals have experienced forced institutionalization, foster care, incarceration, or involuntary holds. Medical settings can trigger these memories.",
      trustBuildingStrategy:
        "Explain what you are doing and why before doing it. Offer choices wherever possible. Do not threaten involuntary holds as leverage. Let the patient leave if they need to.",
    },
    {
      factor: "Judgmental healthcare experiences",
      historicalContext:
        "Many report being treated dismissively, accused of drug-seeking, or denied care in emergency rooms. This creates avoidance of healthcare.",
      trustBuildingStrategy:
        "Treat pain seriously. Do not require sobriety as a condition of care. Use the same clinical language you would use with any patient. Dignity is the minimum standard.",
    },
  ],

  supportSystems: [
    {
      resource: "Health Care for the Homeless (HCH) Programs",
      description: "Federally funded programs providing comprehensive healthcare to unhoused individuals",
      accessInfo: "Find locations at nhchc.org. No ID, insurance, or appointment required at most sites.",
    },
    {
      resource: "211 Hotline",
      description: "Connect to local shelter, food, and social services",
      accessInfo: "Call 211 or text ZIP code to 898211. Available 24/7.",
    },
    {
      resource: "Coordinated Entry System",
      description: "Standardized assessment and prioritization for housing placement",
      accessInfo: "Contact local Continuum of Care (CoC). Often accessed through shelters or outreach workers.",
    },
  ],

  sdohCodes: [
    {
      code: "Z59.00",
      description: "Homelessness, unspecified",
      applicability: "All individuals currently experiencing homelessness",
    },
    {
      code: "Z59.01",
      description: "Sheltered homelessness",
      applicability: "Individuals staying in emergency shelters or transitional housing",
    },
    {
      code: "Z59.02",
      description: "Unsheltered homelessness",
      applicability: "Individuals sleeping outside, in vehicles, or in places not meant for habitation",
    },
    {
      code: "Z59.1",
      description: "Inadequate housing",
      applicability: "Doubling up, substandard housing, or at imminent risk of homelessness",
    },
    {
      code: "Z59.41",
      description: "Food insecurity",
      applicability: "Most unhoused individuals — affects medication timing and nutrition",
    },
  ],

  culturalRemedies: [
    {
      remedy: "Alcohol as self-medication",
      commonUse: "Pain management, sleep aid, anxiety reduction, warmth in cold weather",
      potentialInteractions: [
        "Hepatotoxicity with acetaminophen",
        "Sedation potentiation with benzodiazepines, opioids, antihistamines",
        "Hypoglycemia risk with diabetes medications",
        "GI bleeding risk with NSAIDs",
      ],
      warningLevel: "warning",
    },
    {
      remedy: "Shared/street-obtained medications",
      commonUse: "Antibiotics, pain medications, psychiatric medications obtained from peers or street purchase",
      potentialInteractions: [
        "Unknown dosing and formulation — verify what they are actually taking",
        "Counterfeit pills may contain fentanyl",
        "Drug-drug interactions with prescribed medications",
      ],
      warningLevel: "warning",
    },
  ],
};
