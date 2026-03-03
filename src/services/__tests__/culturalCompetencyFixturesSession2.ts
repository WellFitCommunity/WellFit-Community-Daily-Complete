/**
 * Cultural Competency MCP Server — Session 2 Test Fixtures
 *
 * Profiles: isolated_elderly, indigenous, immigrant_refugee, lgbtq_elderly
 * Split from main fixtures to stay under 600 lines per file.
 */

import type { CulturalProfile } from './culturalCompetencyFixtures';

export const SESSION_2_PROFILES: Record<string, CulturalProfile> = {
  isolated_elderly: {
    populationKey: 'isolated_elderly',
    displayName: 'Isolated Elderly / Socially Disconnected Seniors',
    description: 'Older adults (65+) living with limited social contact.',
    caveat: 'Not all elderly people are isolated, and not all isolated people are elderly.',
    communication: {
      languagePreferences: ['Speak clearly and slowly — not loudly or condescendingly'],
      formalityLevel: 'formal',
      familyInvolvementNorm: 'Family may be absent, distant, or estranged.',
      keyPhrases: ['Who do you talk to most often?'],
      avoidPhrases: ["Don't you have family who can help?", 'Just use the patient portal'],
      contextSpecific: {
        medication: 'Polypharmacy is the #1 medication risk.',
        discharge: 'Never discharge to an empty home without confirming food and medication capacity.',
      },
    },
    clinicalConsiderations: [
      {
        condition: 'Social Isolation (as clinical condition)',
        prevalence: '24% of community-dwelling adults 65+ are socially isolated',
        screeningRecommendation: 'LSNS-6 (Lubben Social Network Scale)',
        clinicalNote: 'Social isolation increases risk of dementia by 50%.',
      },
      {
        condition: 'Falls',
        prevalence: '1 in 4 adults 65+ falls each year',
        screeningRecommendation: 'Timed Up and Go (TUG) test; Morse Fall Scale',
        clinicalNote: 'Isolated elderly who fall may not be found for hours or days.',
      },
      {
        condition: 'Polypharmacy',
        prevalence: '40% of adults 65+ take 5+ medications',
        screeningRecommendation: 'AGS Beers Criteria review at every visit',
        clinicalNote: 'Isolated patients may not have anyone to help manage complex regimens.',
      },
    ],
    barriers: [
      {
        barrier: 'Technology barriers',
        impact: 'Cannot use patient portals, telehealth, or digital tools',
        mitigation: 'Phone-based follow-up as default.',
      },
      {
        barrier: 'Transportation',
        impact: 'Cannot drive, no family to drive',
        mitigation: 'Medicaid NEMT. Area Agency on Aging transit programs.',
      },
      {
        barrier: 'No emergency contact or health advocate',
        impact: 'Falls or medication errors may go unnoticed for days',
        mitigation: 'Medical alert devices. Daily check-in programs.',
      },
    ],
    trustFactors: [
      {
        factor: 'Loss of agency in healthcare decisions',
        historicalContext: 'Many elderly patients have been talked over or treated as incompetent.',
        trustBuildingStrategy: 'Always address the patient directly, not their companion.',
      },
      {
        factor: 'Nursing home fears',
        historicalContext: 'COVID-19 nursing home deaths intensified institutional placement fears.',
        trustBuildingStrategy: 'Emphasize home-based care options first.',
      },
    ],
    sdohCodes: [
      { code: 'Z60.2', description: 'Problems related to living alone', applicability: 'Elderly patients living alone' },
      { code: 'Z63.4', description: 'Disappearance and death of family member', applicability: 'Recently widowed elderly' },
      { code: 'Z74.2', description: 'Need for assistance at home', applicability: 'Elderly without in-home support' },
    ],
    culturalRemedies: [
      {
        remedy: 'Over-the-counter medication accumulation',
        commonUse: 'Self-treatment of pain, sleep, digestion — multiple overlapping products',
        potentialInteractions: ['Acetaminophen toxicity from multiple products', 'Anticholinergic burden — confusion and fall risk'],
        warningLevel: 'warning',
      },
    ],
  },
  indigenous: {
    populationKey: 'indigenous',
    displayName: 'Indigenous / Native American / Alaska Native',
    description: 'A diverse population encompassing 574 federally recognized tribes.',
    caveat: "There is no single 'Native American culture.' Tribal affiliation, urban vs. reservation, and cultural connectedness all matter. Always ask — never assume.",
    communication: {
      languagePreferences: ['Ask about preferred language — some elders speak tribal languages primarily'],
      formalityLevel: 'moderate',
      familyInvolvementNorm: 'Extended family and clan structures are central. Elders hold significant authority.',
      keyPhrases: ['What tribe or nation are you affiliated with?'],
      avoidPhrases: ['Spirit animal', 'Your people do X'],
      contextSpecific: {
        medication: 'Ask about traditional medicines. Consider IHS pharmacy access.',
        discharge: 'Ensure IHS or tribal health facility can continue care.',
      },
    },
    clinicalConsiderations: [
      {
        condition: 'Type 2 Diabetes',
        prevalence: 'AI/AN adults are 2.5x more likely to be diagnosed; highest rates of any US racial group',
        screeningRecommendation: 'A1C or fasting glucose at age 35+',
        clinicalNote: 'Diabetes epidemic is linked to colonization and forced dietary changes.',
      },
      {
        condition: 'Substance Use Disorders',
        prevalence: 'AI/AN have highest rates of SUD; alcohol-related death rate 5.3x higher',
        screeningRecommendation: 'AUDIT-C; ask about methamphetamine in rural areas',
        clinicalNote: 'Must be understood in context of historical trauma.',
      },
      {
        condition: 'Suicide',
        prevalence: 'AI/AN youth (15-24) have highest suicide rate of any demographic group',
        screeningRecommendation: 'Columbia Suicide Severity Rating Scale',
        clinicalNote: 'Cultural connectedness is a documented protective factor.',
      },
    ],
    barriers: [
      {
        barrier: 'Geographic isolation (reservation healthcare)',
        impact: 'Many reservations are hours from the nearest hospital',
        mitigation: 'IHS telehealth. Tribal CHR programs.',
      },
      {
        barrier: 'IHS funding and service gaps',
        impact: 'IHS per-capita spending is $4,078 vs. $10,000+ national average',
        mitigation: 'Help with Medicaid/Medicare enrollment.',
      },
      {
        barrier: 'Historical trauma and institutional distrust',
        impact: 'Forced sterilization, boarding schools, and broken treaties create deep distrust',
        mitigation: 'Acknowledge history directly. Support tribal self-determination.',
      },
    ],
    trustFactors: [
      {
        factor: 'Boarding school era (1860s-1960s+)',
        historicalContext: 'Government boarding schools forcibly removed Indigenous children from families.',
        trustBuildingStrategy: 'Allow cultural practices. Do not restrict family visiting.',
      },
      {
        factor: 'Forced sterilization (1960s-1970s)',
        historicalContext: 'IHS sterilized an estimated 25-50% of Native American women without informed consent.',
        trustBuildingStrategy: 'Absolute thoroughness in informed consent for reproductive procedures.',
      },
    ],
    sdohCodes: [
      { code: 'Z60.5', description: 'Target of perceived adverse discrimination', applicability: 'Systemic discrimination affecting healthcare' },
      { code: 'Z59.1', description: 'Inadequate housing', applicability: 'Reservation housing shortages' },
      { code: 'Z59.41', description: 'Food insecurity', applicability: 'Food deserts on reservations' },
    ],
    culturalRemedies: [
      {
        remedy: 'Sage, cedar, and sweetgrass (smudging)',
        commonUse: 'Spiritual cleansing, prayer, ceremony',
        potentialInteractions: ['Smoke exposure concern for respiratory patients'],
        warningLevel: 'info',
      },
      {
        remedy: 'Peyote (ceremonial use)',
        commonUse: 'Sacred sacrament in Native American Church',
        potentialInteractions: ['Serotonergic effects — risk with SSRIs/MAOIs', 'Cardiovascular stimulant'],
        warningLevel: 'caution',
      },
    ],
  },
  immigrant_refugee: {
    populationKey: 'immigrant_refugee',
    displayName: 'Immigrant / Refugee',
    description: 'A profoundly diverse population from every region of the world.',
    caveat: 'Immigrants and refugees are not the same. Country of origin, education, and time in the US vary enormously.',
    communication: {
      languagePreferences: ['Use certified medical interpreters — ALWAYS. Never family members.'],
      formalityLevel: 'formal',
      familyInvolvementNorm: 'Family structures vary by culture of origin.',
      keyPhrases: ['What language are you most comfortable speaking?'],
      avoidPhrases: ['Are you legal?', "You're lucky to be here"],
      contextSpecific: {
        medication: 'Verify medication history — brand names differ by country.',
        discharge: 'Provide written instructions in patient language via interpreter.',
      },
    },
    clinicalConsiderations: [
      {
        condition: 'Infectious disease screening',
        prevalence: 'Varies by country of origin — TB, hepatitis B/C, parasites',
        screeningRecommendation: 'CDC Domestic Screening Guidelines for Newly Arrived Refugees',
        clinicalNote: 'Screen based on country of origin epidemiology, not race.',
      },
      {
        condition: 'PTSD and Trauma',
        prevalence: '30-86% of refugees meet criteria for PTSD',
        screeningRecommendation: 'Refugee Health Screener-15 (RHS-15)',
        clinicalNote: 'Somatization is common — headaches, body pain as primary complaints.',
      },
      {
        condition: 'Vaccine catch-up',
        prevalence: 'Most refugees have incomplete vaccination records',
        screeningRecommendation: 'Review records; serologic testing; ACIP catch-up schedule',
        clinicalNote: 'When in doubt, revaccinate — it is safe.',
      },
    ],
    barriers: [
      {
        barrier: 'Language and interpretation access',
        impact: 'Without interpreters, informed consent is impossible',
        mitigation: 'Certified medical interpreters for all clinical encounters.',
      },
      {
        barrier: 'Immigration status and fear',
        impact: 'Undocumented patients avoid healthcare due to fear',
        mitigation: 'Communicate that healthcare is separate from immigration enforcement.',
      },
    ],
    trustFactors: [
      {
        factor: 'Government persecution in country of origin',
        historicalContext: 'Many refugees fled governments that used healthcare as a tool of persecution.',
        trustBuildingStrategy: 'Clearly explain US provider independence from immigration enforcement.',
      },
      {
        factor: 'Detention and border experiences',
        historicalContext: 'Many have experienced detention, family separation, inadequate medical care in custody.',
        trustBuildingStrategy: 'Do not ask about immigration journey unless clinically relevant.',
      },
    ],
    sdohCodes: [
      { code: 'Z60.3', description: 'Acculturation difficulty', applicability: 'Immigrants adjusting to US healthcare' },
      { code: 'Z65.4', description: 'Victim of crime and terrorism', applicability: 'Refugees with persecution history' },
    ],
    culturalRemedies: [
      {
        remedy: 'Cupping (hijama) and coining (cao gio)',
        commonUse: 'Pain relief, respiratory illness',
        potentialInteractions: ['Leaves marks that can be mistaken for abuse', 'Generally safe'],
        warningLevel: 'info',
      },
      {
        remedy: 'Ayurvedic preparations',
        commonUse: 'Holistic health management',
        potentialInteractions: ['Some contain heavy metals (lead, mercury)', 'Herbal interactions with blood thinners'],
        warningLevel: 'warning',
      },
    ],
  },
  lgbtq_elderly: {
    populationKey: 'lgbtq_elderly',
    displayName: 'LGBTQ+ Elderly',
    description: 'Older adults who identify as sexual/gender minorities. Survived criminalization and the AIDS crisis.',
    caveat: 'LGBTQ+ elderly are not a monolithic group. Race, class, geography, and specific identity all intersect.',
    communication: {
      languagePreferences: ['Ask about and use preferred name and pronouns'],
      formalityLevel: 'moderate',
      familyInvolvementNorm: 'Chosen family may be the primary support network. Legal next-of-kin may be estranged biological family.',
      keyPhrases: ['What name would you like us to use?', 'What pronouns do you use?'],
      avoidPhrases: ['Lifestyle / sexual preference', "You don't look transgender"],
      contextSpecific: {
        medication: 'For transgender elders: hormone therapy interactions with age-related medications are critical.',
        discharge: 'Ensure receiving facility is LGBTQ-affirming.',
      },
    },
    clinicalConsiderations: [
      {
        condition: 'HIV / AIDS (long-term survivors)',
        prevalence: '50% of people living with HIV in the US are 50+',
        screeningRecommendation: 'HIV screening regardless of age if not recently tested',
        clinicalNote: 'Long-term survivors face accelerated aging. Grief from AIDS crisis is often unprocessed.',
      },
      {
        condition: 'Mental health disparities',
        prevalence: 'LGBTQ+ elders have 2x rates of depression and anxiety',
        screeningRecommendation: 'PHQ-9, GAD-7; screen for social isolation',
        clinicalNote: 'Decades of concealment and discrimination create chronic minority stress.',
      },
      {
        condition: 'Transgender-specific aging concerns',
        prevalence: 'Estimated 0.5-1% of elderly population is transgender',
        screeningRecommendation: 'Organ-inventory-based screening; hormone level monitoring',
        clinicalNote: 'Long-term hormone therapy affects cardiovascular risk and cancer screening needs.',
      },
    ],
    barriers: [
      {
        barrier: 'Fear of discrimination in healthcare settings',
        impact: 'Many delay care, do not disclose identity, or go back into the closet',
        mitigation: 'Visible indicators of safety. LGBTQ-affirming provider directories.',
      },
      {
        barrier: 'Long-term care discrimination',
        impact: 'Documented abuse and forced re-closeting in nursing homes',
        mitigation: 'Refer to facilities with SAGE Equality Index ratings.',
      },
      {
        barrier: 'Social isolation',
        impact: 'Higher rates of living alone, childlessness, estrangement from biological family',
        mitigation: 'SAGE-affiliated senior centers. LGBTQ+ community programs.',
      },
    ],
    trustFactors: [
      {
        factor: "Homosexuality as 'mental illness' (DSM until 1973)",
        historicalContext: 'Treatment included electroshock therapy, aversion therapy, and institutionalization.',
        trustBuildingStrategy: 'Affirm that LGBTQ+ identity is not a disorder.',
      },
      {
        factor: 'AIDS crisis response (1981-1996)',
        historicalContext: 'Delayed government response resulted in hundreds of thousands of deaths.',
        trustBuildingStrategy: "Acknowledge the impact on the patient's generation.",
      },
    ],
    sdohCodes: [
      { code: 'Z60.5', description: 'Target of perceived adverse discrimination', applicability: 'Discrimination based on sexual orientation or gender identity' },
      { code: 'Z60.2', description: 'Problems related to living alone', applicability: 'LGBTQ+ elders living alone — 2x more likely than heterosexual peers' },
    ],
    culturalRemedies: [
      {
        remedy: 'Hormone self-administration (transgender elders)',
        commonUse: 'Estrogen, testosterone obtained outside medical supervision — sometimes for decades',
        potentialInteractions: ['Unmonitored estrogen: DVT/PE risk', 'Unmonitored testosterone: polycythemia risk'],
        warningLevel: 'warning',
      },
      {
        remedy: 'Poppers (amyl/butyl nitrite)',
        commonUse: 'Recreational vasodilation — associated with gay male social culture',
        potentialInteractions: ['FATAL interaction with PDE5 inhibitors (Viagra/Cialis)', 'Methemoglobinemia risk'],
        warningLevel: 'warning',
      },
    ],
  },
};
