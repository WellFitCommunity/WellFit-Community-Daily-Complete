-- ============================================================================
-- Add Culturally Competent and Inclusive Resources for ALL Nurses
-- ============================================================================
-- Purpose: Ensure ALL nurses feel seen, supported, and respected
-- Target: Male nurses, LGBTQ+ nurses, BIPOC nurses, immigrant nurses, all backgrounds
-- Principle: Healthcare providers deserve culturally affirming mental health support
-- ============================================================================

INSERT INTO resilience_resources (
  title,
  description,
  resource_type,
  url,
  categories,
  tags,
  target_audience,
  is_evidence_based,
  featured
) VALUES
  -- LGBTQ+ Specific Resources
  (
    'The Trevor Project - Crisis Support for LGBTQ+ Healthcare Workers',
    '24/7 crisis intervention and suicide prevention for LGBTQ+ individuals. Call 1-866-488-7386, text START to 678-678, or chat online. Trained counselors understand unique stressors facing LGBTQ+ nurses.',
    'hotline',
    'https://www.thetrevorproject.org',
    ARRAY['crisis_support'],
    ARRAY['lgbtq', 'crisis', 'suicide_prevention', 'inclusive'],
    ARRAY['all'],
    TRUE,
    TRUE
  ),
  (
    'National Queer and Trans Therapists of Color Network (NQTTCN)',
    'Directory of mental health providers who are queer, trans, and/or people of color. Find a therapist who understands intersectional identities and healthcare workplace discrimination.',
    'article',
    'https://www.nqttcn.com/directory',
    ARRAY['self_care', 'crisis_support'],
    ARRAY['lgbtq', 'bipoc', 'therapy', 'mental_health'],
    ARRAY['all'],
    FALSE,
    TRUE
  ),

  -- Black/African American Nurse Resources
  (
    'Therapy for Black Girls - Mental Health for Black Women in Healthcare',
    'Podcast and therapist directory specifically for Black women and femmes. Addresses racism in healthcare, microaggressions, and unique burnout factors. Over 5,000 vetted therapists.',
    'app',
    'https://therapyforblackgirls.com',
    ARRAY['self_care', 'stress_management'],
    ARRAY['black', 'african_american', 'women', 'therapy', 'podcast'],
    ARRAY['nurse'],
    FALSE,
    TRUE
  ),
  (
    'Black Emotional and Mental Health Collective (BEAM)',
    'Training, grants, and healing-centered resources for Black communities. Includes workplace wellness resources and community care practices rooted in African diaspora traditions.',
    'article',
    'https://beam.community',
    ARRAY['self_care'],
    ARRAY['black', 'african_american', 'healing', 'community'],
    ARRAY['all'],
    TRUE,
    FALSE
  ),
  (
    'National Black Nurses Association - Wellness Resources',
    'Professional organization offering mentorship, advocacy, and wellness programs specifically for Black nurses. Addresses systemic racism in healthcare workplaces.',
    'article',
    'https://nbna.org',
    ARRAY['self_care', 'communication'],
    ARRAY['black', 'african_american', 'professional_development', 'advocacy'],
    ARRAY['nurse'],
    FALSE,
    FALSE
  ),

  -- Hispanic/Latinx Nurse Resources
  (
    'National Alliance for Hispanic Health - Línea de Vida (Lifeline)',
    'Spanish-language crisis support and mental health resources. Call 1-888-628-9454 for bilingual counselors who understand cultural values and family dynamics. Available 24/7.',
    'hotline',
    'https://www.healthyamericas.org',
    ARRAY['crisis_support'],
    ARRAY['hispanic', 'latinx', 'spanish', 'bilingual', 'crisis'],
    ARRAY['all'],
    TRUE,
    TRUE
  ),
  (
    'Latinx Therapy - Culturally Responsive Mental Health',
    'Directory of Latinx therapists who provide services in Spanish and English. Addresses immigration stress, family separation, and workplace discrimination in healthcare.',
    'app',
    'https://latinxtherapy.com',
    ARRAY['self_care'],
    ARRAY['hispanic', 'latinx', 'spanish', 'therapy', 'bilingual'],
    ARRAY['all'],
    FALSE,
    FALSE
  ),
  (
    'National Association of Hispanic Nurses - Burnout Prevention',
    'Professional organization offering mentorship, networking, and burnout prevention programs for Hispanic/Latinx nurses. Resources in English and Spanish.',
    'article',
    'https://nahnnet.org',
    ARRAY['self_care', 'communication'],
    ARRAY['hispanic', 'latinx', 'professional_development'],
    ARRAY['nurse'],
    FALSE,
    FALSE
  ),

  -- Asian American/Pacific Islander Resources
  (
    'Asian Mental Health Collective',
    'Therapist directory and mental health resources for Asian Americans and Pacific Islanders. Addresses model minority myth, family pressure, and anti-Asian racism in healthcare.',
    'article',
    'https://asianmhc.org',
    ARRAY['self_care', 'crisis_support'],
    ARRAY['asian', 'aapi', 'pacific_islander', 'therapy'],
    ARRAY['all'],
    FALSE,
    FALSE
  ),
  (
    'South Asian Mental Health Initiative & Network (SAMHIN)',
    'Peer support and resources for South Asian healthcare workers. Addresses cultural stigma around mental health and unique workplace stressors.',
    'article',
    'https://www.samhin.org',
    ARRAY['self_care'],
    ARRAY['south_asian', 'indian', 'pakistani', 'bengali', 'mental_health'],
    ARRAY['all'],
    FALSE,
    FALSE
  ),

  -- Male Nurse Resources
  (
    'American Assembly for Men in Nursing (AAMN)',
    'Professional organization for male nurses addressing gender stereotypes, isolation, and unique challenges in female-majority profession. Mentorship and advocacy programs.',
    'article',
    'https://aamn.org',
    ARRAY['self_care', 'communication'],
    ARRAY['men', 'male_nurses', 'gender', 'professional_development'],
    ARRAY['nurse'],
    FALSE,
    FALSE
  ),
  (
    'Men in Nursing - Support and Advocacy',
    'Resources addressing sexual harassment, gender discrimination, and professional advancement barriers faced by male nurses. Peer support community.',
    'article',
    'https://minoritynurse.com/men-in-nursing',
    ARRAY['communication', 'self_care'],
    ARRAY['men', 'male_nurses', 'discrimination', 'advocacy'],
    ARRAY['nurse'],
    FALSE,
    FALSE
  ),

  -- Immigrant/Refugee Nurse Resources
  (
    'International Nurses Support Network',
    'Resources for immigrant nurses navigating US healthcare system, cultural adjustment, and workplace discrimination. Includes visa support and credential verification help.',
    'article',
    NULL,
    ARRAY['communication', 'self_care'],
    ARRAY['immigrant', 'international', 'refugee', 'esl'],
    ARRAY['nurse'],
    FALSE,
    FALSE
  ),
  (
    'National Immigrant Family Services - Mental Health Support',
    'Multilingual mental health support for immigrants and refugees. Addresses family separation, acculturation stress, and workplace exploitation.',
    'hotline',
    'https://www.immigrantfamilyservices.org',
    ARRAY['crisis_support', 'self_care'],
    ARRAY['immigrant', 'refugee', 'multilingual', 'family'],
    ARRAY['all'],
    TRUE,
    FALSE
  ),

  -- Indigenous/Native American Resources
  (
    'Strong Hearts Native Helpline',
    'Culturally-grounded crisis support for Native Americans. Call 1-844-762-8483. Understands historical trauma, tribal community dynamics, and cultural healing practices.',
    'hotline',
    'https://strongheartshelpline.org',
    ARRAY['crisis_support'],
    ARRAY['native_american', 'indigenous', 'tribal', 'cultural'],
    ARRAY['all'],
    TRUE,
    TRUE
  ),

  -- Veterans (Many Nurses Are Veterans)
  (
    'Veterans Crisis Line for Healthcare Workers',
    'Crisis support for veterans working in healthcare. Call 988 then press 1, text 838255, or chat online. Understands military trauma and healthcare PTSD.',
    'hotline',
    'https://www.veteranscrisisline.net',
    ARRAY['crisis_support'],
    ARRAY['veterans', 'military', 'ptsd', 'crisis'],
    ARRAY['all'],
    TRUE,
    TRUE
  ),

  -- Neurodivergent/Disability Resources
  (
    'Disability Visibility Project - Healthcare Workers with Disabilities',
    'Advocacy and community for disabled healthcare workers. Addresses ableism, accommodations, and burnout unique to neurodivergent/disabled nurses.',
    'article',
    'https://disabilityvisibilityproject.com',
    ARRAY['self_care', 'communication'],
    ARRAY['disability', 'neurodivergent', 'adhd', 'autism', 'advocacy'],
    ARRAY['all'],
    FALSE,
    FALSE
  ),

  -- General Inclusive Resources
  (
    'Inclusive Therapists - Identity-Affirming Mental Health Directory',
    'Therapist directory searchable by identity (race, gender, sexuality, disability, religion). Find providers who understand your intersectional experiences as a healthcare worker.',
    'app',
    'https://www.inclusivetherapists.com',
    ARRAY['self_care', 'crisis_support'],
    ARRAY['inclusive', 'diversity', 'therapy', 'intersectional'],
    ARRAY['all'],
    TRUE,
    TRUE
  ),
  (
    'Open Path Collective - Affordable Therapy ($30-$80/session)',
    'Nationwide network of therapists offering reduced-fee sessions. No insurance required. Many therapists specialize in BIPOC, LGBTQ+, and immigrant mental health.',
    'app',
    'https://openpathcollective.org',
    ARRAY['self_care'],
    ARRAY['affordable', 'therapy', 'sliding_scale', 'inclusive'],
    ARRAY['all'],
    FALSE,
    TRUE
  ),

  -- Anti-Racism and Workplace Discrimination Resources
  (
    'Confronting Racism in Healthcare - Toolkit for Nurses',
    'Evidence-based strategies for addressing microaggressions, reporting discrimination, and advocating for equity. Includes bystander intervention scripts.',
    'article',
    NULL,
    ARRAY['communication'],
    ARRAY['anti_racism', 'discrimination', 'advocacy', 'equity'],
    ARRAY['all'],
    TRUE,
    FALSE
  ),
  (
    'EEOC - Filing Workplace Discrimination Complaints (Healthcare)',
    'Legal resource for filing discrimination complaints based on race, gender, sexuality, disability, or religion. Know your rights under Title VII and ADA.',
    'article',
    'https://www.eeoc.gov/filing-charge-discrimination',
    ARRAY['communication'],
    ARRAY['legal', 'discrimination', 'rights', 'eeoc'],
    ARRAY['all'],
    TRUE,
    FALSE
  ),

  -- Religious/Spiritual Diversity
  (
    'Faith-Based Counseling Networks - Multifaith Directory',
    'Find counselors who integrate your faith tradition (Muslim, Jewish, Hindu, Buddhist, Christian, etc.) with mental health support. Respectful of religious values.',
    'article',
    NULL,
    ARRAY['self_care'],
    ARRAY['faith', 'religion', 'spiritual', 'counseling'],
    ARRAY['all'],
    FALSE,
    FALSE
  ),

  -- Body Size Inclusivity
  (
    'HAES (Health At Every Size) - Anti-Weight Stigma Resources',
    'Resources for nurses experiencing weight stigma or eating disorders. Promotes body-positive, evidence-based health practices.',
    'article',
    'https://asdah.org/health-at-every-size-haes-approach',
    ARRAY['self_care'],
    ARRAY['body_positive', 'eating_disorders', 'weight_stigma'],
    ARRAY['all'],
    TRUE,
    FALSE
  )

ON CONFLICT (id) DO NOTHING;

-- Add tags to existing resources to make them more inclusive
UPDATE resilience_resources
SET tags = ARRAY_APPEND(tags, 'all_backgrounds')
WHERE title IN (
  'National Suicide Prevention Lifeline (988)',
  'Employee Assistance Program (EAP) - Free Counseling',
  'Headspace for Healthcare Workers',
  'Insight Timer: Free Meditation App'
);

-- Add descriptive comment
COMMENT ON TABLE resilience_resources IS 'Culturally competent mental health resources for ALL nurses: LGBTQ+, BIPOC, male nurses, immigrants, veterans, disabled, all faiths, all backgrounds. Updated 2025-10-20 with inclusive resources.';
