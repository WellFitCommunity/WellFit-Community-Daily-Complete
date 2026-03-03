// =====================================================
// Cultural Profile: Veterans
// References: VA/DoD CPGs, PC-PTSD-5, MIRECC guidelines
// =====================================================

import type { CulturalProfile } from "../types.ts";

export const veteransProfile: CulturalProfile = {
  populationKey: "veterans",
  displayName: "Veterans / Military Service Members",
  description:
    "Individuals with current or prior military service. Military culture emphasizes stoicism and self-reliance, which can delay care-seeking. Combat exposures, moral injury, and transition challenges create unique health needs.",
  caveat:
    "Military experience varies widely by era, branch, rank, and deployment history. Not all veterans have combat exposure or PTSD. Avoid assumptions — ask about service history respectfully.",

  communication: {
    languagePreferences: ["Direct, concise language", "Avoid euphemisms — use clear medical terms"],
    formalityLevel: "moderate",
    familyInvolvementNorm:
      "Many veterans prefer to handle medical decisions independently. However, spouses/partners often play key support roles, especially for TBI or PTSD. Ask before involving family.",
    keyPhrases: [
      "Thank you for your service — what branch and era?",
      "Some veterans find that...",
      "You have earned these benefits",
      "Let me help you navigate your options",
    ],
    avoidPhrases: [
      "You must be traumatized",
      "Did you ever kill anyone?",
      "You should talk to someone about that",
      "Just relax",
    ],
    contextSpecific: {
      medication:
        "Discuss medication purpose directly. Many veterans resist psychotropic medications due to stigma — frame as 'tools for performance' rather than 'mental health treatment.' Ask about VA pharmacy access.",
      diagnosis:
        "Use straightforward language. Veterans appreciate honesty over cushioning. If a diagnosis is service-connected, mention VA disability claim eligibility.",
      care_plan:
        "Include VA benefits navigation. Veteran peer support programs (e.g., Vet Centers) are highly effective. Consider telehealth for rural veterans.",
      discharge:
        "Ensure VA enrollment is verified. Coordinate with VA Patient Aligned Care Team (PACT). Provide Veteran Crisis Line: 988 (press 1).",
    },
  },

  clinicalConsiderations: [
    {
      condition: "PTSD / Moral Injury",
      prevalence: "11-20% of OIF/OEF veterans; 30% of Vietnam veterans",
      screeningRecommendation: "PC-PTSD-5 screen at every primary care visit",
      clinicalNote:
        "Moral injury (guilt/shame from war experiences) presents differently from classic PTSD. May manifest as withdrawal, substance use, or spiritual crisis rather than hypervigilance.",
    },
    {
      condition: "Traumatic Brain Injury (TBI)",
      prevalence: "23% of combat veterans have blast-related TBI",
      screeningRecommendation: "VA TBI screening tool for all combat-era veterans",
      clinicalNote:
        "TBI and PTSD frequently co-occur. Headaches, memory issues, and irritability may be attributed to PTSD when TBI is the primary driver.",
    },
    {
      condition: "Toxic Exposures",
      prevalence: "3.5M+ veterans exposed to burn pits (PACT Act eligible)",
      screeningRecommendation: "Toxic Exposure Screening Navigator (TESN) referral",
      clinicalNote:
        "Burn pit exposure linked to respiratory cancers, constrictive bronchiolitis. Agent Orange linked to diabetes, ischemic heart disease, multiple cancers. Gulf War illness presents as multi-symptom chronic fatigue.",
    },
    {
      condition: "Substance Use Disorder",
      prevalence: "1 in 10 veterans seen in VA has SUD diagnosis",
      screeningRecommendation: "AUDIT-C for alcohol; DAST-10 for drugs at intake",
      clinicalNote:
        "Self-medication for pain and PTSD is common. Military culture stigmatizes help-seeking for substance use. Frame treatment as 'mission readiness' not 'weakness.'",
    },
    {
      condition: "Chronic Pain / Musculoskeletal",
      prevalence: "Most common reason for VA healthcare utilization",
      screeningRecommendation: "PEG scale (Pain, Enjoyment, General activity)",
      clinicalNote:
        "Many veterans have service-connected injuries. Opioid stewardship is critical — VA Stepped Care Model for Pain (non-pharm first). Ask about previous pain management approaches.",
    },
  ],

  barriers: [
    {
      barrier: "Stigma around mental health",
      impact: "Delays care-seeking by 6-8 years on average for PTSD",
      mitigation:
        "Normalize help-seeking: 'Many veterans in your situation use these resources.' Use language of strength, not weakness.",
    },
    {
      barrier: "VA system navigation complexity",
      impact: "Veterans may not know what benefits they have earned",
      mitigation:
        "Refer to VA social worker or Patient Advocate. Mention PACT Act expansion of eligibility. Connect with local Vet Center (no VA enrollment required).",
    },
    {
      barrier: "Rural access",
      impact: "33% of veterans live in rural areas with limited VA facilities",
      mitigation:
        "VA telehealth (VA Video Connect), Community Care referrals, mobile vet centers. ATLAS program for remote areas.",
    },
    {
      barrier: "Distrust of government healthcare",
      impact: "Some veterans avoid VA due to negative experiences or wait time issues",
      mitigation:
        "Acknowledge past VA shortcomings honestly. Offer both VA and community care options. Emphasize MISSION Act choice.",
    },
  ],

  culturalPractices: [
    {
      practice: "Veteran peer support groups",
      description:
        "Veterans respond better to peers who share military experience than to civilian clinicians alone.",
      clinicalImplication:
        "Refer to Vet Centers (community-based, no VA enrollment needed) or veteran service organizations (VFW, DAV, Team Red White & Blue).",
    },
    {
      practice: "Physical fitness as coping",
      description:
        "Many veterans use exercise as primary coping mechanism — adaptive when healthy, maladaptive when injury prevents it.",
      clinicalImplication:
        "Incorporate physical activity into care plans. Adaptive sports programs (e.g., Warrior Games) for injured veterans.",
    },
  ],

  trustFactors: [
    {
      factor: "VA wait time scandals (2014+)",
      historicalContext:
        "Phoenix VA scandal revealed falsified wait times and veteran deaths. Eroded trust in VA system for many veterans.",
      trustBuildingStrategy:
        "Acknowledge the history. Demonstrate responsiveness. Offer MISSION Act community care as an alternative when appropriate.",
    },
    {
      factor: "Agent Orange denial (decades-long)",
      historicalContext:
        "Government denied Agent Orange health effects for 20+ years. Created deep distrust of institutional claims about toxic exposures.",
      trustBuildingStrategy:
        "Take environmental exposure concerns seriously. Reference PACT Act as acknowledgment. Do not dismiss symptoms as psychosomatic.",
    },
  ],

  supportSystems: [
    {
      resource: "Veteran Crisis Line",
      description: "24/7 crisis support for veterans and their families",
      accessInfo: "Call 988, press 1. Text 838255. Chat at VeteransCrisisLine.net",
    },
    {
      resource: "Vet Centers",
      description: "Community-based readjustment counseling — no VA enrollment required",
      accessInfo: "300+ locations. Call 1-877-WAR-VETS. Walk-ins welcome.",
    },
    {
      resource: "VA Caregiver Support",
      description: "Support and stipends for caregivers of eligible veterans",
      accessInfo: "Call 1-855-260-3274. Program of Comprehensive Assistance for Family Caregivers.",
    },
  ],

  sdohCodes: [
    {
      code: "Z91.82",
      description: "Personal history of military deployment",
      applicability: "All veterans with deployment history",
    },
    {
      code: "Z56.82",
      description: "Military to civilian transition difficulty",
      applicability: "Recently separated veterans with adjustment issues",
    },
    {
      code: "Z65.8",
      description: "Other specified problems related to psychosocial circumstances",
      applicability: "Veteran-specific stressors (moral injury, reintegration)",
    },
  ],

  culturalRemedies: [
    {
      remedy: "Kratom (Mitragyna speciosa)",
      commonUse: "Self-treatment for chronic pain and PTSD symptoms — prevalent in veteran community",
      potentialInteractions: [
        "Opioid agonist activity — risk with concurrent opioid prescriptions",
        "CYP enzyme inhibition — affects metabolism of many drugs",
        "Serotonergic effects — risk with SSRIs/SNRIs",
      ],
      warningLevel: "warning",
    },
    {
      remedy: "CBD / Cannabis products",
      commonUse: "Pain management, sleep, anxiety — increasingly common among veterans",
      potentialInteractions: [
        "CYP3A4 and CYP2C19 inhibition — affects warfarin, clopidogrel, many others",
        "Additive sedation with benzodiazepines or sleep medications",
        "May affect VA benefits eligibility in some states (check current policy)",
      ],
      warningLevel: "caution",
    },
  ],
};
