// =====================================================
// Cultural Profile: Isolated Elderly
// References: NIA Social Isolation Research, AGS Beers Criteria,
//             AARP Social Connectedness Survey, CDC Loneliness
// =====================================================

import type { CulturalProfile } from "../types.ts";

export const isolatedElderlyProfile: CulturalProfile = {
  populationKey: "isolated_elderly",
  displayName: "Isolated Elderly / Socially Disconnected Seniors",
  description:
    "Older adults (65+) living with limited social contact, often due to loss of spouse, mobility limitations, geographic distance from family, or technology barriers. Social isolation is an independent health risk factor — the mortality impact is equivalent to smoking 15 cigarettes per day (Holt-Lunstad 2015). This is not just loneliness — it is a clinical condition with measurable physiological consequences.",
  caveat:
    "Not all elderly people are isolated, and not all isolated people are elderly. Isolation can affect any age, race, or socioeconomic group. Some seniors prefer solitude and are not lonely. Ask about social connections without assuming deficit. Rural elderly, LGBTQ+ elders without family, and recently widowed individuals are at highest risk.",

  communication: {
    languagePreferences: [
      "Speak clearly and slowly — not loudly or condescendingly",
      "Use simple sentences; avoid medical jargon",
      "Repeat key information and provide written summaries in large print",
    ],
    formalityLevel: "formal",
    familyInvolvementNorm:
      "Family may be absent, distant, or estranged. Do not assume family involvement is possible. Ask: 'Is there someone you trust who helps with your health decisions?' If no one, connect with social services proactively.",
    keyPhrases: [
      "Who do you talk to most often?",
      "How are you getting to your appointments?",
      "Do you have someone who can help with your medications?",
      "Would you like us to connect you with a senior companion program?",
    ],
    avoidPhrases: [
      "Don't you have family who can help?",
      "You should get out more",
      "Just use the patient portal / download the app",
      "Can your children help with this?",
    ],
    contextSpecific: {
      medication:
        "Polypharmacy is the #1 medication risk. Review ALL medications (including OTC, supplements) at every visit. Use pill organizers. Simplify regimens — once-daily preferred. Ask who helps manage medications. Consider blister packs from pharmacy.",
      diagnosis:
        "Deliver slowly with written backup. Ensure the patient can repeat back key information (teach-back). Cognitive screening may be needed before complex treatment decisions. Ask about advance directives.",
      care_plan:
        "Build around actual support resources, not assumed family. Include meal delivery, transportation, and social connection goals alongside medical goals. Falls prevention is always relevant. Consider home health assessment.",
      discharge:
        "Never discharge to an empty home without confirming: food availability, medication management capacity, fall risk assessment, ability to call for help. Social work referral should be automatic for isolated elderly patients.",
    },
  },

  clinicalConsiderations: [
    {
      condition: "Social Isolation (as clinical condition)",
      prevalence: "24% of community-dwelling adults 65+ are socially isolated (NASEM 2020)",
      screeningRecommendation: "LSNS-6 (Lubben Social Network Scale) or UCLA Loneliness Scale",
      clinicalNote:
        "Social isolation increases risk of dementia by 50%, heart disease by 29%, stroke by 32%, and all-cause mortality by 26%. It is as dangerous as obesity or physical inactivity. Document as a clinical finding and intervene.",
    },
    {
      condition: "Falls",
      prevalence: "1 in 4 adults 65+ falls each year; leading cause of injury death in elderly",
      screeningRecommendation: "Timed Up and Go (TUG) test; Morse Fall Scale; annual fall risk assessment",
      clinicalNote:
        "Isolated elderly who fall may not be found for hours or days. Assess for medical alert devices. Review medications for fall-risk contributors (sedatives, antihypertensives, anticholinergics). Home safety assessment is critical.",
    },
    {
      condition: "Polypharmacy",
      prevalence: "40% of adults 65+ take 5+ medications; 20% take 10+",
      screeningRecommendation: "AGS Beers Criteria review at every visit; medication reconciliation",
      clinicalNote:
        "Isolated patients may not have anyone to help manage complex regimens. Check for duplicate prescriptions from multiple providers. Ask about OTC medications and supplements. Cognitive decline may impair medication self-management.",
    },
    {
      condition: "Depression and Cognitive Decline",
      prevalence: "Late-life depression affects 7% of elderly; isolation doubles dementia risk",
      screeningRecommendation: "PHQ-2/GDS (Geriatric Depression Scale); Mini-Cog or MMSE for cognition",
      clinicalNote:
        "Depression and early dementia can look similar (pseudodementia). Isolation accelerates both. Treatment of depression can improve cognitive function. Social prescribing (structured social activities) has evidence base for both.",
    },
    {
      condition: "Malnutrition and Dehydration",
      prevalence: "15-50% of elderly in community settings are malnourished or at risk",
      screeningRecommendation: "MNA (Mini Nutritional Assessment); weight at every visit; albumin if concern",
      clinicalNote:
        "People who eat alone eat less and eat worse. Loss of appetite is common in grief and depression. Dental problems, difficulty cooking, and poverty all contribute. Meals on Wheels and congregate dining programs address social AND nutritional needs simultaneously.",
    },
  ],

  barriers: [
    {
      barrier: "Technology barriers",
      impact: "Cannot use patient portals, telehealth, online scheduling, or digital health tools",
      mitigation:
        "Phone-based follow-up as default, not web portal. If telehealth needed, use simple platforms and provide step-by-step printed instructions. Consider tablet loan programs with pre-configured connections. Tech-savvy volunteer pairing.",
    },
    {
      barrier: "Transportation",
      impact: "Cannot drive, no family to drive, public transit may be inaccessible",
      mitigation:
        "Medicaid NEMT (non-emergency medical transportation). Area Agency on Aging transit programs. Home-based primary care for homebound patients. Schedule appointments to align with available rides. Telehealth for follow-ups when possible.",
    },
    {
      barrier: "No emergency contact or health advocate",
      impact: "Falls, medication errors, or acute symptoms may go unnoticed for days",
      mitigation:
        "Medical alert devices (PERS). Daily check-in programs (phone or automated). Community health worker home visits. Neighbor wellness check agreements. Utility company medical necessity lists (prevents shutoffs).",
    },
    {
      barrier: "Fixed income / financial constraints",
      impact: "Cannot afford medications, copays, nutritious food, or home modifications",
      mitigation:
        "Extra Help (Medicare Part D subsidy). SNAP/food assistance. LIHEAP for utilities. State pharmaceutical assistance programs. Area Agency on Aging benefit enrollment. Prescription discount programs (GoodRx, manufacturer programs).",
    },
  ],

  culturalPractices: [
    {
      practice: "Faith and church community",
      description:
        "For many elderly, church or faith community is the primary social connection. Regular attendance may decline with mobility loss, creating a cascade of isolation.",
      clinicalImplication:
        "Ask about faith community involvement. Church-based health ministries can provide wellness checks, transportation, and social contact. Some churches have homebound member programs. Chaplain referral for spiritual distress.",
    },
    {
      practice: "Routines and independence",
      description:
        "Many isolated elderly maintain strict daily routines as a coping mechanism. Independence is deeply valued — accepting help can feel like losing autonomy.",
      clinicalImplication:
        "Frame assistance as 'tools for independence' not 'signs of decline.' Preserve autonomy in care decisions. Small, incremental support is better received than major changes. Respect the patient's right to make their own decisions, even imperfect ones.",
    },
  ],

  trustFactors: [
    {
      factor: "Loss of agency in healthcare decisions",
      historicalContext:
        "Many elderly patients have experienced being talked over, decisions made without their input, or being treated as incompetent by healthcare providers and family members alike.",
      trustBuildingStrategy:
        "Always address the patient directly, not their companion. Ask for their preferences. Include them in every decision. Do not assume cognitive impairment — assess it. Informed consent must be genuinely informed.",
    },
    {
      factor: "Nursing home fears",
      historicalContext:
        "Institutional placement is a deep fear for many elderly. COVID-19 nursing home deaths intensified this fear. Any suggestion of 'placement' can trigger disengagement from care.",
      trustBuildingStrategy:
        "Emphasize home-based care options first. Frame interventions as keeping them independent at home longer. Be transparent about when institutional care might be needed, but do not use it as a threat.",
    },
  ],

  supportSystems: [
    {
      resource: "Area Agency on Aging (AAA)",
      description: "Federal network providing services for older adults — meals, transportation, caregiver support, benefits enrollment",
      accessInfo: "Find local AAA at eldercare.acl.gov or call 1-800-677-1116 (Eldercare Locator). No income requirement for most services.",
    },
    {
      resource: "Meals on Wheels",
      description: "Home-delivered meals + daily wellness check (the visit is as important as the meal)",
      accessInfo: "mealsonwheelsamerica.org. Most programs have no strict income requirement. Also provides pet food programs.",
    },
    {
      resource: "AARP Community Connections",
      description: "Volunteer-driven phone and video companionship for isolated older adults",
      accessInfo: "aarpcommunityconnections.org. Free. Can be matched with regular companion for weekly calls.",
    },
  ],

  sdohCodes: [
    {
      code: "Z60.2",
      description: "Problems related to living alone",
      applicability: "Elderly patients living alone, especially without regular social contact",
    },
    {
      code: "Z63.4",
      description: "Disappearance and death of family member",
      applicability: "Recently widowed or bereaved elderly experiencing grief-related isolation",
    },
    {
      code: "Z74.2",
      description: "Need for assistance at home and no other household member able to render care",
      applicability: "Elderly without in-home support for ADLs or medication management",
    },
    {
      code: "Z59.41",
      description: "Food insecurity",
      applicability: "Isolated elderly with limited access to nutritious food or inability to cook",
    },
  ],

  culturalRemedies: [
    {
      remedy: "Over-the-counter medication accumulation",
      commonUse: "Self-treatment of pain, sleep, digestion — often multiple OTC products with overlapping ingredients",
      potentialInteractions: [
        "Acetaminophen toxicity from multiple products containing it (cold meds + pain relief + PM formulas)",
        "Anticholinergic burden from diphenhydramine (Benadryl), ranitidine — increased confusion and fall risk",
        "NSAID GI bleeding risk, especially with concurrent anticoagulants",
        "Drug-drug interactions with prescribed medications unknown to prescriber",
      ],
      warningLevel: "warning",
    },
    {
      remedy: "Herbal supplements for memory and energy",
      commonUse: "Ginkgo biloba, ginseng, B-vitamin megadoses — marketed for cognitive health",
      potentialInteractions: [
        "Ginkgo: anticoagulant properties — risk with warfarin, aspirin",
        "Ginseng: may affect blood glucose and blood pressure medications",
        "High-dose B vitamins: generally safe but can mask B12 deficiency symptoms",
      ],
      warningLevel: "caution",
    },
  ],
};
