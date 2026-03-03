// =====================================================
// Cultural Profile: Indigenous / Native American / Alaska Native
// References: IHS Clinical Reporting, ADA Diabetes in Native
//             Populations, NIHB Tribal Health Sovereignty,
//             SAMHSA Tribal Training resources
// =====================================================

import type { CulturalProfile } from "../types.ts";

export const indigenousProfile: CulturalProfile = {
  populationKey: "indigenous",
  displayName: "Indigenous / Native American / Alaska Native",
  description:
    "A diverse population encompassing 574 federally recognized tribes, each with distinct languages, traditions, governance structures, and health profiles. Indigenous health is shaped by centuries of colonization, forced assimilation, and ongoing systemic inequities — but also by extraordinary cultural resilience, traditional knowledge systems, and community strength.",
  caveat:
    "There is no single 'Native American culture.' A Navajo elder in Arizona, an Ojibwe teenager in Minnesota, and an Aleut fisherman in Alaska have vastly different cultural contexts. Tribal affiliation, urban vs. reservation residence, and degree of cultural connectedness all matter. Always ask about tribal identity and individual preferences — never assume.",

  communication: {
    languagePreferences: [
      "Ask about preferred language — some elders speak tribal languages primarily",
      "Interpreter services for tribal languages are limited but should be attempted",
      "Silence may be respectful listening, not disengagement — do not rush to fill silence",
    ],
    formalityLevel: "moderate",
    familyInvolvementNorm:
      "Extended family and clan/band structures are central. Elders hold significant authority in health decisions. Grandparents often raise grandchildren. Ask who should be involved in care decisions — the answer may include people outside the nuclear family.",
    keyPhrases: [
      "What tribe or nation are you affiliated with?",
      "Are there traditional practices that are important to your healing?",
      "Would you like to include family or an elder in this conversation?",
      "I want to work together with any traditional healers you see",
    ],
    avoidPhrases: [
      "Indian (unless the patient uses it themselves)",
      "Spirit animal / spirit guide (trivializes sacred concepts)",
      "Your people / your tribe does X (stereotyping)",
      "You should stop using traditional medicine (dismissive)",
    ],
    contextSpecific: {
      medication:
        "Ask about traditional medicines — many patients use both Western and traditional remedies simultaneously. Frame as integration, not competition. Diabetes medication counseling is critical given prevalence. Consider medication access on reservations (IHS pharmacy vs. commercial).",
      diagnosis:
        "Some tribes have cultural protocols around discussing serious illness (especially cancer or terminal diagnoses). Ask the patient how they want to receive difficult news. Some may want a family member or elder present. Respect cultural views on naming diseases.",
      care_plan:
        "Integrate traditional healing goals alongside Western medicine goals. Walking in balance (physical, mental, emotional, spiritual) is a common framework. Include IHS and tribal health resources. Consider distance from reservation to specialty care.",
      discharge:
        "Ensure IHS or tribal health facility can continue care. Transportation from hospitals to remote reservations is a major barrier. Traditional ceremony space may be important during recovery. Coordinate with tribal community health representatives (CHRs).",
    },
  },

  clinicalConsiderations: [
    {
      condition: "Type 2 Diabetes",
      prevalence: "AI/AN adults are 2.5x more likely to be diagnosed than non-Hispanic whites; highest rates of any US racial group",
      screeningRecommendation: "A1C or fasting glucose at age 35+; earlier with any risk factor. Annual diabetic eye/foot/kidney screening",
      clinicalNote:
        "The diabetes epidemic in Indigenous communities is directly linked to colonization — forced dietary changes from traditional foods to commodity foods (high-sugar, high-fat USDA commodities). The 'thrifty gene' hypothesis is contested. Focus on food sovereignty and traditional food programs as intervention alongside medication.",
    },
    {
      condition: "Substance Use Disorders (Alcohol and Methamphetamine)",
      prevalence: "AI/AN have highest rates of SUD of any racial group; alcohol-related death rate 5.3x higher",
      screeningRecommendation: "AUDIT-C; single-question drug screen; ask about methamphetamine specifically in rural areas",
      clinicalNote:
        "Substance use in Indigenous communities must be understood in context of historical trauma, intergenerational grief, and ongoing social stressors. Abstinence-only approaches may not be culturally aligned. Culture-based treatment (sweat lodge, talking circles, traditional ceremonies) has growing evidence base. Medication-assisted treatment (MAT) access is limited on many reservations.",
    },
    {
      condition: "Suicide",
      prevalence: "AI/AN youth (15-24) have highest suicide rate of any demographic group in the US",
      screeningRecommendation: "Columbia Suicide Severity Rating Scale; PHQ-A for adolescents; ask about historical trauma exposure",
      clinicalNote:
        "Suicide clusters occur in tribal communities. Cultural connectedness is a documented protective factor. Ask about cultural identity, language knowledge, and community involvement as strengths. Integrate with tribal behavioral health programs. The crisis line for AI/AN communities is 988 (Suicide & Crisis Lifeline).",
    },
    {
      condition: "Cardiovascular Disease",
      prevalence: "AI/AN have 50% higher heart disease death rate than white population",
      screeningRecommendation: "Lipid panel, BP, A1C per AHA guidelines; Strong Heart Study risk calculator may be more applicable than Framingham",
      clinicalNote:
        "Linked to diabetes prevalence, dietary changes, and limited access to cardiac specialty care on reservations. Traditional diets (wild game, fish, berries, roots) are protective — support food sovereignty programs. Telehealth cardiology has shown promise for remote communities.",
    },
  ],

  barriers: [
    {
      barrier: "Geographic isolation (reservation healthcare)",
      impact: "Many reservations are hours from the nearest hospital or specialist. IHS facilities are chronically underfunded.",
      mitigation:
        "IHS telehealth expansion. Tribal Community Health Representative (CHR) programs for home visits. Contract Health Services (now Purchased/Referred Care) for off-reservation specialty care. Mobile health clinics.",
    },
    {
      barrier: "IHS funding and service gaps",
      impact: "IHS per-capita spending is $4,078 vs. $10,000+ national average. Many services are unavailable or have long waits.",
      mitigation:
        "Verify IHS eligibility and Purchased/Referred Care (PRC) authorization for off-reservation services. Help with Medicaid/Medicare enrollment (many eligible AI/AN are not enrolled). Tribal health programs may supplement IHS.",
    },
    {
      barrier: "Historical trauma and institutional distrust",
      impact: "Forced sterilization (as recently as 1970s), boarding schools, and broken treaties create deep distrust of government healthcare",
      mitigation:
        "Acknowledge history directly when trust is an issue. Support tribal self-determination in health governance. Tribal health programs run by the tribe (under ISDEAA) may be more trusted than direct IHS. Community-based participatory research models.",
    },
    {
      barrier: "Cultural disconnection as health risk",
      impact: "Urban AI/AN may lack tribal community connections, increasing isolation and reducing cultural protective factors",
      mitigation:
        "Connect with urban Indian health organizations (UIHOs). Cultural programming and urban pow-wows. Native-specific AA/NA groups (Red Road to Recovery, Wellbriety). Language revitalization programs.",
    },
  ],

  culturalPractices: [
    {
      practice: "Traditional medicine and ceremony",
      description:
        "Sweat lodge, smudging (sage, cedar, sweetgrass), pipe ceremonies, vision quests, and traditional plant medicines are active healing practices — not historical relics. Traditional healers (medicine people) are respected community authorities.",
      clinicalImplication:
        "Never dismiss or compete with traditional healing. Ask permission before handling sacred objects. Accommodate ceremony requests in hospital settings when possible (smudging, prayer, family gatherings). Integrate traditional and Western treatment plans. Some hospitals have designated ceremonial spaces.",
    },
    {
      practice: "Community-based healing circles",
      description:
        "Talking circles and healing ceremonies involve the community in individual healing. Health is understood as balance among physical, mental, emotional, and spiritual dimensions.",
      clinicalImplication:
        "Group-based therapeutic approaches may be more culturally aligned than individual therapy. Peer recovery programs using cultural frameworks show strong outcomes. The Medicine Wheel framework (4 directions = 4 aspects of health) can structure holistic care plans.",
    },
    {
      practice: "Traditional foods as medicine",
      description:
        "Wild game, salmon, berries, roots, and traditional preparations have nutritional and cultural significance. Food sovereignty movements are reclaiming traditional diets as health interventions.",
      clinicalImplication:
        "Support traditional food access over commodity food dependence. Traditional diets are generally lower glycemic index, higher in lean protein and omega-3s. Food sovereignty programs (tribal gardens, buffalo restoration, traditional food sharing) are evidence-based chronic disease interventions.",
    },
  ],

  trustFactors: [
    {
      factor: "Boarding school era (1860s-1960s+)",
      historicalContext:
        "Government and church-run boarding schools forcibly removed Indigenous children from families. Children were punished for speaking tribal languages or practicing traditions. Physical, sexual, and emotional abuse was widespread. Intergenerational trauma from this era persists.",
      trustBuildingStrategy:
        "Be aware that institutional settings (hospitals, clinics) can trigger boarding school trauma associations for elders. Allow cultural practices. Do not restrict family visiting. Understand that distrust of authority figures in clinical settings has a generational basis.",
    },
    {
      factor: "Forced sterilization (1960s-1970s)",
      historicalContext:
        "IHS sterilized an estimated 25-50% of Native American women during this period, often without informed consent. Some sterilizations were performed during other procedures or on minors.",
      trustBuildingStrategy:
        "Absolute thoroughness in informed consent for any reproductive procedure. Offer tribal advocate presence during consent conversations. This history is within living memory — many patients have family members who were directly affected.",
    },
    {
      factor: "Treaty violations and broken promises",
      historicalContext:
        "Healthcare is a treaty obligation — not a benefit or charity. The US government promised healthcare in exchange for land cessions. Chronic underfunding of IHS is itself a treaty violation.",
      trustBuildingStrategy:
        "Frame healthcare as a right, not a privilege or handout. Respect tribal sovereignty in healthcare decisions. Support tribal self-governance of health programs. Do not require 'gratitude' for providing treaty-obligated services.",
    },
  ],

  supportSystems: [
    {
      resource: "Indian Health Service (IHS)",
      description: "Federal health service for AI/AN — direct care, tribal programs, and urban Indian health",
      accessInfo: "ihs.gov. Eligibility based on tribal membership/descent. Services vary by facility. No cost for eligible patients.",
    },
    {
      resource: "Urban Indian Health Organizations (UIHOs)",
      description: "Health services for AI/AN living in urban areas (70%+ of AI/AN live off-reservation)",
      accessInfo: "34 UIHOs nationally. Find locations at uihi.org. Serve AI/AN regardless of tribal enrollment status.",
    },
    {
      resource: "Tribal Community Health Representatives (CHRs)",
      description: "Community-based health workers who provide home visits, health education, and care coordination within tribal communities",
      accessInfo: "Contact local tribal health department. CHRs are tribe-employed and culturally embedded.",
    },
  ],

  sdohCodes: [
    {
      code: "Z60.5",
      description: "Target of perceived adverse discrimination and persecution",
      applicability: "Systemic discrimination affecting healthcare access and outcomes",
    },
    {
      code: "Z59.1",
      description: "Inadequate housing",
      applicability: "Reservation housing shortages — many homes lack plumbing, electricity, or adequate heating",
    },
    {
      code: "Z59.41",
      description: "Food insecurity",
      applicability: "Food deserts on reservations; dependence on commodity foods; disrupted traditional food systems",
    },
    {
      code: "Z62.819",
      description: "Personal history of unspecified abuse in childhood",
      applicability: "Boarding school survivors and intergenerational trauma",
    },
  ],

  culturalRemedies: [
    {
      remedy: "Sage, cedar, and sweetgrass (smudging)",
      commonUse: "Spiritual cleansing, prayer, ceremony — burned and inhaled in clinical and home settings",
      potentialInteractions: [
        "Smoke exposure concern for respiratory patients (COPD, asthma) — discuss alternatives like sage spray",
        "Generally safe from drug interaction perspective",
        "Accommodate in hospital settings when possible (ventilation, fire safety protocols)",
      ],
      warningLevel: "info",
    },
    {
      remedy: "Traditional herbal preparations (varies by tribe)",
      commonUse: "Echinacea, yarrow, wild cherry bark, bearberry — used for immune support, pain, respiratory, and urinary conditions",
      potentialInteractions: [
        "Echinacea: may interfere with immunosuppressants",
        "Yarrow: anticoagulant properties — caution with blood thinners",
        "Wild cherry bark: contains amygdalin (cyanogenic glycoside) — toxic in large doses",
        "Bearberry (uva ursi): hepatotoxic with prolonged use; contains hydroquinone",
      ],
      warningLevel: "caution",
    },
    {
      remedy: "Peyote (Lophophora williamsii) — ceremonial use",
      commonUse: "Sacred sacrament in Native American Church ceremonies — not recreational use",
      potentialInteractions: [
        "Contains mescaline — serotonergic effects; risk with SSRIs/MAOIs",
        "Cardiovascular stimulant properties",
        "Legally protected for ceremonial use by NAC members (American Indian Religious Freedom Act)",
        "Do not conflate ceremonial use with substance abuse",
      ],
      warningLevel: "caution",
    },
  ],
};
