// =====================================================
// Cultural Profile: LGBTQ+ Elderly
// References: WPATH Standards of Care 8, Fenway Institute,
//             SAGE (Services & Advocacy for GLBT Elders),
//             NIA Health Disparities in Aging
// =====================================================

import type { CulturalProfile } from "../types.ts";

export const lgbtqElderlyProfile: CulturalProfile = {
  populationKey: "lgbtq_elderly",
  displayName: "LGBTQ+ Elderly",
  description:
    "Older adults (65+) who identify as lesbian, gay, bisexual, transgender, queer, or other sexual/gender minority identities. This generation came of age when homosexuality was classified as a mental illness (DSM until 1973), faced criminalization, and survived the AIDS crisis. Many spent decades hiding their identity from healthcare providers, employers, and family. Their resilience is extraordinary — and their healthcare needs are distinct.",
  caveat:
    "LGBTQ+ elderly are not a monolithic group. A 70-year-old gay man who was out in San Francisco in the 1970s has a very different experience from an 80-year-old bisexual woman in rural Alabama who has never disclosed her identity. Transgender elders face compounded discrimination. Race, class, disability, and geographic location all intersect with LGBTQ+ identity. Ask about identity and relationships respectfully — many patients have never been asked.",

  communication: {
    languagePreferences: [
      "Ask about and use preferred name and pronouns — document in chart",
      "Use inclusive language: 'partner' or 'spouse' rather than assuming gender",
      "Forms should include gender identity and sexual orientation options",
    ],
    formalityLevel: "moderate",
    familyInvolvementNorm:
      "Chosen family (close friends, community members, ex-partners) may be the primary support network. Legal next-of-kin may be an estranged biological family member who does not accept the patient's identity. Ask: 'Who do you consider your family?' and 'Who should make medical decisions if you cannot?'",
    keyPhrases: [
      "What name would you like us to use?",
      "What pronouns do you use?",
      "Do you have a partner or spouse?",
      "Is there anything about your identity that is important for your care?",
    ],
    avoidPhrases: [
      "Assuming heterosexuality or cisgender identity",
      "Lifestyle / sexual preference (use 'sexual orientation' and 'identity')",
      "You don't look transgender / You'd never know",
      "Have you had 'the surgery'? (irrelevant unless clinically necessary)",
    ],
    contextSpecific: {
      medication:
        "For transgender elders: hormone therapy interactions with age-related medications are critical. Estrogen + age increases DVT/stroke risk. Testosterone affects lipids and hematocrit. Review ALL medications with awareness of gender-affirming therapies. Some patients may have self-administered hormones for decades without medical supervision.",
      diagnosis:
        "Delivering diagnoses related to sexual health requires sensitivity. HIV/STI screening should be routine and non-stigmatizing. Cancer screenings must follow organ inventory (transgender patients need screening based on anatomy present, not gender identity). Breast cancer screening for transgender women on estrogen.",
      care_plan:
        "Include chosen family in care planning. Address social isolation proactively — LGBTQ+ elders are 2x more likely to live alone. Consider SAGE-affiliated senior services. Mental health support should be with LGBTQ-affirming providers.",
      discharge:
        "Ensure receiving facility (nursing home, rehab, home health) is LGBTQ-affirming. Many LGBTQ+ elders fear long-term care because of documented discrimination. SAGE provides a Long-Term Care Facility Equality Index. Verify that partner/chosen family has visitation rights.",
    },
  },

  clinicalConsiderations: [
    {
      condition: "HIV / AIDS (long-term survivors)",
      prevalence: "50% of people living with HIV in the US are 50+; many are long-term survivors from the 1980s-90s epidemic",
      screeningRecommendation: "HIV screening regardless of age if not recently tested; CD4/viral load monitoring for known positive patients",
      clinicalNote:
        "Long-term HIV survivors face accelerated aging, early-onset cardiovascular disease, osteoporosis, and neurocognitive decline. Antiretroviral-medication interactions with age-related drugs are complex. Grief from the AIDS crisis is often unprocessed — an entire generation of friends was lost. Survivor guilt is common.",
    },
    {
      condition: "Mental health disparities",
      prevalence: "LGBTQ+ elders have 2x rates of depression and anxiety; 2.5x more likely to live alone",
      screeningRecommendation: "PHQ-9, GAD-7; screen for social isolation (LSNS-6); ask about minority stress",
      clinicalNote:
        "Minority stress model: decades of concealment, discrimination, and hypervigilance create chronic stress that manifests as mental and physical health problems. Many LGBTQ+ elders have never discussed their identity with a healthcare provider. Creating a safe space to disclose can be therapeutic in itself.",
    },
    {
      condition: "Substance use",
      prevalence: "Higher rates of alcohol and tobacco use linked to minority stress, bar-centered social culture, and coping with discrimination",
      screeningRecommendation: "AUDIT-C; smoking assessment; ask about party drug history (poppers, methamphetamine) without judgment",
      clinicalNote:
        "Historically, bars were the only safe social space for LGBTQ+ people — creating cultural association between socializing and drinking. Amyl nitrite (poppers) use may have cardiovascular implications, especially with PDE5 inhibitors (sildenafil). LGBTQ-affirming substance use treatment is more effective than general programs.",
    },
    {
      condition: "Transgender-specific aging concerns",
      prevalence: "Estimated 0.5-1% of elderly population is transgender; many are not out to providers",
      screeningRecommendation: "Organ-inventory-based screening (screen for organs present, not gender identity); hormone level monitoring; bone density",
      clinicalNote:
        "Long-term hormone therapy affects cardiovascular risk, bone density, and cancer screening needs. Transgender women on estrogen: screen for breast cancer, monitor DVT/PE risk. Transgender men on testosterone: may still need cervical cancer screening if cervix is present. Surgical history affects screening needs. Ask respectfully what surgeries have been done.",
    },
    {
      condition: "Cancer screening disparities",
      prevalence: "Lesbian and bisexual women have lower cervical screening rates; gay men have higher anal cancer rates",
      screeningRecommendation: "Cervical screening per guidelines regardless of sexual orientation; anal Pap for MSM with HIV; breast screening for all patients with breast tissue",
      clinicalNote:
        "Lesbian women may incorrectly believe they do not need cervical cancer screening. HPV is relevant regardless of partner gender. Gay and bisexual men with HIV have significantly elevated anal cancer risk. Provider assumptions about sexual behavior can lead to inappropriate or missed screening.",
    },
  ],

  barriers: [
    {
      barrier: "Fear of discrimination in healthcare settings",
      impact: "Many LGBTQ+ elders delay or avoid care, do not disclose identity, or go back into the closet when entering healthcare systems",
      mitigation:
        "Visible indicators of safety: rainbow/pride flags, inclusive intake forms, staff training. LGBTQ-affirming provider directories (GLMA, OutCare). Train all staff — not just clinicians — on respectful interaction. Front desk misgendering can prevent a patient from ever coming back.",
    },
    {
      barrier: "Long-term care discrimination",
      impact: "Documented cases of abuse, neglect, and forced re-closeting of LGBTQ+ people in nursing homes and assisted living",
      mitigation:
        "Refer to facilities with SAGE Equality Index ratings. Advance directives designating chosen family. Legal protections vary by state. Advocate for inclusive policies in long-term care facilities your practice works with.",
    },
    {
      barrier: "Legal and financial vulnerability",
      impact: "Pre-marriage equality survivors may lack spousal benefits, inheritance rights, or Social Security survivor benefits from prior partnerships",
      mitigation:
        "Legal aid referrals for estate planning. Ensure advance directives and healthcare proxies are up to date and name chosen family. SAGE legal resources. Social Security rules for same-sex couples married before Obergefell.",
    },
    {
      barrier: "Social isolation and lack of chosen family support",
      impact: "Higher rates of living alone, childlessness, and estrangement from biological family. AIDS crisis decimated social networks.",
      mitigation:
        "SAGE-affiliated senior centers and programs. LGBTQ+ community centers with elder programs. Friendly visitor programs. LGBTQ-affirming faith communities. Online communities for homebound elders.",
    },
  ],

  culturalPractices: [
    {
      practice: "Chosen family as primary support system",
      description:
        "Many LGBTQ+ elders built 'families of choice' — close friends, ex-partners, community members — who provide the support traditionally associated with biological family. This is not a deficiency; it is an adaptive and resilient social structure.",
      clinicalImplication:
        "Include chosen family in care planning, visitation, and medical decisions. Do not prioritize biological family over chosen family without the patient's explicit direction. Document chosen family members in the chart with patient consent.",
    },
    {
      practice: "Community resilience and activism",
      description:
        "This generation survived criminalization, the AIDS crisis, and fought for civil rights. Many are deeply connected to LGBTQ+ community organizations and have strong mutual support networks.",
      clinicalImplication:
        "Connect patients with LGBTQ+ senior organizations (SAGE is the largest). Community involvement is a health protective factor — support continued engagement. Ask about community connections as a strength assessment.",
    },
  ],

  trustFactors: [
    {
      factor: "Homosexuality as 'mental illness' (DSM I and II, until 1973)",
      historicalContext:
        "Homosexuality was a diagnosable mental disorder. 'Treatment' included electroshock therapy, aversion therapy, institutionalization, and lobotomy. Some elderly LGBTQ+ patients experienced these 'treatments' firsthand.",
      trustBuildingStrategy:
        "Acknowledge this history. Affirm that LGBTQ+ identity is not a disorder. Mental health referrals must be to LGBTQ-affirming therapists. Any suggestion of 'changing' orientation or gender identity is harmful and rejected by every major medical organization.",
    },
    {
      factor: "AIDS crisis response (1981-1996)",
      historicalContext:
        "The US government's delayed response to the AIDS crisis resulted in hundreds of thousands of deaths, primarily among gay and bisexual men. Healthcare workers refused to treat AIDS patients. This is within living memory for most LGBTQ+ elders.",
      trustBuildingStrategy:
        "Acknowledge the impact of the crisis on the patient's generation. Be sensitive to grief and trauma. Provide affirming care that demonstrates the medical system has changed. Do not assume HIV status or suggest screening in a way that implies stereotyping.",
    },
  ],

  supportSystems: [
    {
      resource: "SAGE (Services & Advocacy for GLBT Elders)",
      description: "National organization providing support, advocacy, and community for LGBTQ+ older adults",
      accessInfo: "sageusa.org. SAGEConnect phone line for isolated elders. National LGBTQ+ Elder Hotline: 1-888-234-SAGE.",
    },
    {
      resource: "GLMA: Health Professionals Advancing LGBTQ Equality",
      description: "Provider directory for finding LGBTQ-affirming healthcare providers",
      accessInfo: "glma.org. Provider directory searchable by location and specialty.",
    },
    {
      resource: "National Resource Center on LGBTQ+ Aging",
      description: "Training and resources for aging service providers working with LGBTQ+ older adults",
      accessInfo: "lgbtagingcenter.org. Free online training for providers. Resources for patients and caregivers.",
    },
  ],

  sdohCodes: [
    {
      code: "Z60.5",
      description: "Target of perceived adverse discrimination and persecution",
      applicability: "Discrimination based on sexual orientation or gender identity affecting health outcomes",
    },
    {
      code: "Z60.2",
      description: "Problems related to living alone",
      applicability: "LGBTQ+ elders living alone without family support — 2x more likely than heterosexual peers",
    },
    {
      code: "Z76.5",
      description: "Malingerer (conscious simulation) — DO NOT USE",
      applicability: "NOTE: This code was historically misapplied to transgender patients. Gender dysphoria has its own coding (F64.x). Never code gender identity as malingering.",
    },
  ],

  culturalRemedies: [
    {
      remedy: "Hormone self-administration (transgender elders)",
      commonUse: "Estrogen, testosterone, or anti-androgens obtained outside medical supervision — sometimes for decades. Includes foreign pharmacy purchases, peer sharing, and online ordering.",
      potentialInteractions: [
        "Unmonitored estrogen: DVT/PE risk increases significantly with age, especially combined with smoking or immobility",
        "Unmonitored testosterone: polycythemia risk, liver effects, lipid changes — hematocrit monitoring essential",
        "Spironolactone (anti-androgen): hyperkalemia risk, especially with ACE inhibitors or potassium-sparing diuretics",
        "Silicone injections (non-medical grade): granuloma formation, migration, embolization — may present decades later",
      ],
      warningLevel: "warning",
    },
    {
      remedy: "Poppers (amyl/butyl nitrite)",
      commonUse: "Recreational use for vasodilation — historically associated with gay male social culture; some continued use in older age",
      potentialInteractions: [
        "FATAL interaction with PDE5 inhibitors (sildenafil/Viagra, tadalafil/Cialis) — severe hypotension",
        "Risk of methemoglobinemia, especially with repeated use",
        "Vision changes (poppers maculopathy) — permanent retinal damage possible",
      ],
      warningLevel: "warning",
    },
  ],
};
