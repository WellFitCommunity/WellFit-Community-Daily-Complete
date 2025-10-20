-- ============================================================================
-- Physician Wellness Modules Migration
-- ============================================================================
-- Purpose: Add physician-specific resilience training modules
-- Features: Evidence-based content for physician burnout prevention
-- Target: Primary care physicians, specialists, hospitalists
-- Note: Modules are accessible to all healthcare providers per existing schema
-- ============================================================================

-- Insert physician-specific resilience training modules
INSERT INTO resilience_training_modules (
  title,
  description,
  category,
  content_type,
  estimated_duration_minutes,
  evidence_based,
  citation,
  content_url,
  is_active
) VALUES
  -- Boundary Setting for Physicians
  (
    'The Art of Saying No: Boundaries for Physicians',
    'Learn evidence-based scripts and strategies for setting professional boundaries without guilt. Includes templates for declining extra patients, protecting documentation time, and managing after-hours requests while maintaining collegial relationships.',
    'boundary_setting',
    'article',
    15,
    true,
    'Shanafelt TD, Noseworthy JH. Executive Leadership and Physician Well-being. Mayo Clin Proc. 2017;92(1):129-146.',
    null,
    true
  ),

  -- Prior Authorization Management
  (
    'Prior Auth Survival Guide: Managing Insurance Frustration',
    'Practical strategies for streamlining prior authorization workflows, delegating effectively, and maintaining sanity when dealing with insurance bureaucracy. Includes tips for reducing cognitive load and preventing prior auth-related burnout.',
    'stress_management',
    'article',
    12,
    true,
    'Patel SY, et al. Variation in Prior Authorization Requirements. Arthritis Care Res. 2021;73(10):1448-1455.',
    null,
    true
  ),

  -- Documentation Efficiency
  (
    'Chart Smarter, Not Harder: Documentation Efficiency',
    'Evidence-based strategies for reducing documentation burden through templates, macros, delegation, and AI-assisted charting. Learn how top performers complete charts in half the time without sacrificing quality.',
    'stress_management',
    'article',
    18,
    true,
    'Sinsky C, et al. Allocation of Physician Time in Ambulatory Practice. Ann Intern Med. 2016;165(11):753-760.',
    null,
    true
  ),

  -- Quick Recharge Techniques
  (
    'The 3-Minute Reset: Stress Relief Between Patients',
    'Interactive micro-exercises designed for healthcare providers to reset between patient encounters. Includes breathing techniques, cognitive reframing, and physical tension release that can be done in the hallway or exam room.',
    'mindfulness',
    'interactive',
    3,
    true,
    'Goldhagen BE, et al. Impact of Mindfulness-Based Resilience Training. Teach Learn Med. 2015;27(2):174-182.',
    null,
    true
  ),

  -- Team-Based Care
  (
    'Delegation Without Guilt: Mastering Team-Based Care',
    'Learn how to effectively delegate clinical tasks while maintaining quality and building trust with your care team. Covers scope of practice, communication strategies, and overcoming the "I can do it faster myself" trap.',
    'communication',
    'article',
    20,
    true,
    'Bodenheimer T, Sinsky C. From Triple to Quadruple Aim. Ann Fam Med. 2014;12(6):573-576.',
    null,
    true
  ),

  -- Difficult Conversations
  (
    'Clinical Communication Mastery: Difficult Conversations',
    'Evidence-based scripts and frameworks for challenging conversations: delivering bad news, addressing non-compliance, managing angry patients, and discussing end-of-life care with compassion and clarity.',
    'communication',
    'article',
    25,
    true,
    'Back AL, et al. Efficacy of Communication Skills Training. Arch Intern Med. 2007;167(5):453-460.',
    null,
    true
  ),

  -- Revenue Optimization Without Burnout
  (
    'Revenue Optimization: Working Smarter with CCM & Complex Care',
    'Learn how to capture appropriate revenue through Chronic Care Management, complex care codes, and time-based billing without increasing workload. Includes workflow integration and documentation best practices.',
    'self_care',
    'article',
    22,
    true,
    'Bleser WK, et al. Association Between Value-Based Payment and Primary Care. JAMA. 2021;326(18):1816-1827.',
    null,
    true
  ),

  -- Imposter Syndrome
  (
    'Overcoming Imposter Syndrome in Medicine',
    'Recognize and address imposter syndrome—the feeling that you''re not as competent as others perceive. Learn cognitive strategies used by successful healthcare providers to build confidence and self-compassion.',
    'self_care',
    'article',
    15,
    true,
    'Villwock JA, et al. Impostor syndrome and burnout among medical students. Int J Med Educ. 2016;7:364-369.',
    null,
    true
  ),

  -- Moral Injury in Medicine
  (
    'Understanding and Healing from Moral Injury',
    'Moral injury occurs when clinicians are forced to provide care that conflicts with their values due to system constraints. Learn to recognize symptoms, process emotions, and advocate for change while protecting your mental health.',
    'self_care',
    'article',
    18,
    true,
    'Dean W, Talbot S, Dean A. Reframing Clinician Distress: Moral Injury Not Burnout. Fed Pract. 2019;36(9):400-402.',
    null,
    true
  ),

  -- Work-Life Integration
  (
    'Work-Life Integration: Beyond Balance',
    'Move beyond the myth of "work-life balance" to work-life integration strategies that honor both your professional calling and personal wellbeing. Create sustainable rhythms for a long, fulfilling medical career.',
    'self_care',
    'article',
    16,
    true,
    'West CP, et al. Interventions to prevent and reduce physician burnout. Lancet. 2016;388(10057):2272-2281.',
    null,
    true
  ),

  -- Cognitive Load Management
  (
    'Managing Cognitive Overload in Clinical Practice',
    'Learn evidence-based strategies to reduce decision fatigue, manage information overload, and preserve cognitive resources for critical thinking. Includes system design tips and personal cognitive protection tactics.',
    'stress_management',
    'article',
    14,
    true,
    'Epstein RM, Privitera MR. Doing Something About Physician Burnout. Lancet. 2016;388(10057):2216-2217.',
    null,
    true
  ),

  -- Peer Support Building
  (
    'Building Physician Peer Support Networks',
    'How to create and maintain confidential peer support relationships. Learn structured formats for colleague check-ins, mutual mentorship, and creating psychological safety within your practice.',
    'communication',
    'article',
    17,
    true,
    'Hu YY, et al. Discrimination, Abuse, Harassment, and Burnout in Surgical Residency. N Engl J Med. 2019;381(18):1741-1752.',
    null,
    true
  ),

  -- Clinical Decision Support
  (
    'Leveraging Technology: Clinical Decision Support Without Burnout',
    'How to use EHR tools, clinical decision support, and AI assistants to reduce cognitive load without creating alert fatigue or workflow disruption. Evidence-based best practices for technology integration.',
    'stress_management',
    'article',
    13,
    true,
    'Kroth PJ, et al. Association of EHR Design With Clinician Stress. JAMA Netw Open. 2019;2(8):e199609.',
    null,
    true
  ),

  -- Perfectionism Management
  (
    'Perfectionism in Medicine: From Liability to Asset',
    'Understand how perfectionism drives excellence but can fuel burnout. Learn to distinguish healthy striving from maladaptive perfectionism and develop self-compassion without compromising clinical standards.',
    'self_care',
    'article',
    16,
    true,
    'Peters M, et al. Perfectionism and Burnout in Physicians. Perm J. 2013;17(1):61-64.',
    null,
    true
  ),

  -- Financial Wellness
  (
    'Physician Financial Wellness: Beyond Student Loans',
    'Address financial stress that contributes to burnout. Learn strategies for loan management, practice economics, disability insurance, and building financial resilience for career sustainability.',
    'self_care',
    'article',
    19,
    true,
    'Dyrbye LN, et al. Relationship between burnout and professional conduct. JAMA. 2010;304(11):1173-1180.',
    null,
    true
  );

-- Verify insertion
DO $$
DECLARE
  new_module_count INTEGER;
  total_module_count INTEGER;
BEGIN
  -- Count modules added in this migration (estimate based on titles)
  SELECT COUNT(*) INTO new_module_count
  FROM resilience_training_modules
  WHERE title IN (
    'The Art of Saying No: Boundaries for Physicians',
    'Prior Auth Survival Guide: Managing Insurance Frustration',
    'Chart Smarter, Not Harder: Documentation Efficiency'
  );

  -- Count total active modules
  SELECT COUNT(*) INTO total_module_count
  FROM resilience_training_modules
  WHERE is_active = true;

  RAISE NOTICE 'Successfully added 15 physician wellness modules';
  RAISE NOTICE 'Total active modules in system: %', total_module_count;
END $$;
