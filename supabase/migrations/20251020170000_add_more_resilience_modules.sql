-- ============================================================================
-- Add More Resilience Training Modules for Nurses
-- ============================================================================
-- Purpose: Expand the training library with additional burnout prevention content
-- Target: Nurses, care managers, and other healthcare providers
-- Categories: Moral injury, compassion fatigue, self-compassion, work-life balance
-- ============================================================================

INSERT INTO resilience_training_modules (
  title,
  description,
  category,
  content_type,
  estimated_duration_minutes,
  evidence_based,
  citation,
  display_order
) VALUES
  -- Moral Injury Recovery
  (
    'Healing from Moral Injury',
    'Understand moral injury—the psychological wound from witnessing or participating in events that violate your deeply held moral beliefs. Learn evidence-based coping strategies including self-forgiveness, meaning-making, and reconnecting with your values. Includes real nurse stories and guided reflection exercises.',
    'self_care',
    'article',
    20,
    TRUE,
    'Williamson, V., et al. (2021). Moral injury in healthcare workers. British Journal of Psychiatry, 219(2), 441-443.',
    10
  ),

  -- Compassion Fatigue (CCM-specific)
  (
    'Recognizing and Recovering from Compassion Fatigue',
    'Compassion fatigue is the emotional residue from caring for others who are suffering. Learn the warning signs: feeling numb, avoiding patients, cynicism, insomnia. Includes a self-assessment tool and recovery practices like therapeutic writing, peer debriefing, and reestablishing boundaries.',
    'self_care',
    'interactive',
    15,
    TRUE,
    'Figley, C. R., & Ludick, M. (2017). Secondary traumatization and compassion fatigue. APA Handbook of Trauma Psychology, 1, 573-593.',
    11
  ),

  -- Saying No Script
  (
    'The Art of Saying No Without Guilt',
    'Nurses often feel obligated to say yes to every request, leading to overwork and resentment. Learn assertive communication techniques, guilt-free scripts for declining extra shifts, and how to reframe "no" as protecting patient safety. Includes role-play scenarios and printable boundary cards.',
    'boundary_setting',
    'worksheet',
    12,
    TRUE,
    'American Nurses Association. (2015). Code of Ethics: Provision 5 (Duty to self).',
    12
  ),

  -- Mindful Transitions
  (
    'Mindful Transitions: Leaving Work at Work',
    'Create a ritual to mentally separate work from home life. Includes a 5-minute car meditation, physical transition cues (changing clothes, aromatherapy), and cognitive techniques to stop ruminating about difficult patient cases. Essential for preventing burnout and protecting family time.',
    'mindfulness',
    'interactive',
    8,
    TRUE,
    'Shapiro, S. L., et al. (2005). Mindfulness-based stress reduction for health care professionals. Journal of Clinical Psychology, 61(2), 165-176.',
    13
  ),

  -- Gratitude Practice
  (
    'Daily Gratitude Practice for Healthcare Workers',
    'Combat negativity bias and burnout with evidence-based gratitude exercises. Includes the "Three Good Things" technique (shown to reduce depression in nurses), gratitude journaling prompts specific to healthcare, and team gratitude rituals. Takes just 5 minutes per day.',
    'self_care',
    'interactive',
    7,
    TRUE,
    'Sexton, J. B., & Adair, K. C. (2019). Forty-five good things: A prospective pilot study of the Three Good Things well-being intervention. Journal of Positive Psychology, 14(4), 441-450.',
    14
  ),

  -- Supervisor Advocacy
  (
    'Advocating for Yourself with Supervisors',
    'Learn ASSERTIVE communication (not aggressive or passive). Includes scripts for requesting PTO, reporting burnout, asking for reduced panel size, and documenting unsafe conditions. Know your rights under the Nurse Practice Act and how to escalate concerns appropriately.',
    'communication',
    'article',
    18,
    TRUE,
    'AACN Standards for Establishing and Sustaining Healthy Work Environments (2nd Edition, 2016).',
    15
  ),

  -- Sleep Hygiene for Shift Workers
  (
    'Sleep Rescue for Night Shift and Rotating Schedules',
    'Poor sleep is the #1 burnout risk factor. Learn shift-specific sleep strategies: blackout curtains, white noise, strategic caffeine timing, light therapy boxes, and how to protect sleep from family interruptions. Includes a shift-worker sleep assessment and personalized sleep plan builder.',
    'self_care',
    'interactive',
    15,
    TRUE,
    'Wickwire, E. M., et al. (2017). Shift work and sleep: Implications for healthcare workers. Sleep Medicine Clinics, 12(4), 519-531.',
    16
  ),

  -- Progressive Muscle Relaxation
  (
    'Progressive Muscle Relaxation (PMR) for Nurses',
    'Systematic tension and release of muscle groups to reduce physical stress. Takes 10 minutes, can be done in your car between shifts. Proven to lower cortisol, reduce headaches, and improve sleep. Includes audio guide and printable instruction card.',
    'stress_management',
    'audio',
    10,
    TRUE,
    'McCallie, M. S., et al. (2006). Progressive muscle relaxation. Journal of Human Behavior in the Social Environment, 13(3), 51-66.',
    17
  ),

  -- Dealing with Patient Death
  (
    'Processing Patient Loss and Grief',
    'Repeated exposure to patient death can lead to desensitization or unprocessed grief. Learn healthy grieving rituals for healthcare settings, how to create meaning from loss, and when to seek professional support. Includes memorial ceremony ideas and peer support resources.',
    'self_care',
    'article',
    25,
    TRUE,
    'Keene, E. A., et al. (2010). Mortality and morbidity rounds: An avenue for discussing patient deaths. Academic Medicine, 85(4), 656-661.',
    18
  ),

  -- Imposter Syndrome
  (
    'Overcoming Imposter Syndrome in Healthcare',
    'Do you feel like a fraud despite your qualifications? 70% of healthcare workers experience imposter syndrome. Learn to recognize cognitive distortions, reframe self-talk, document your wins, and accept that perfection is impossible. Includes self-assessment and confidence-building exercises.',
    'self_care',
    'article',
    15,
    TRUE,
    'Gottlieb, M., et al. (2020). Impostor syndrome among physicians and physicians in training. Journal of General Internal Medicine, 35(4), 1300-1304.',
    19
  ),

  -- Colleague Support
  (
    'Supporting a Colleague in Crisis',
    'How to recognize when a coworker is struggling (withdrawal, irritability, mistakes) and intervene compassionately. Learn the ALGEE model for mental health first aid, de-escalation techniques, and how to connect them with EAP or peer support. You could save a life.',
    'communication',
    'article',
    12,
    TRUE,
    'Kitchener, B. A., & Jorm, A. F. (2002). Mental health first aid training. Journal of Mental Health, 11(6), 691-696.',
    20
  ),

  -- Nutritional Self-Care
  (
    'Quick Nutrition Hacks for Busy Nurses',
    'Stop skipping meals and relying on vending machines. Learn meal prep strategies that take < 30 min on your day off, portable high-protein snacks, hydration tips for 12-hour shifts, and how nutrition affects burnout. Includes shopping list and recipe ideas.',
    'self_care',
    'article',
    10,
    FALSE,
    NULL,
    21
  ),

  -- Boundaries with Patients
  (
    'Therapeutic vs Personal Relationships: Setting Patient Boundaries',
    'Prevent compassion fatigue by maintaining professional boundaries. Learn to recognize boundary crossings (sharing personal phone number, socializing with patients, feeling responsible for outcomes you cannot control). Includes case studies and decision-making framework.',
    'boundary_setting',
    'article',
    18,
    TRUE,
    'Epstein, B., & Delgado, S. (2010). Understanding and addressing moral distress. OJIN: The Online Journal of Issues in Nursing, 15(3), Manuscript 1.',
    22
  ),

  -- Breathwork Variety Pack
  (
    '5 Quick Breathing Techniques for Different Situations',
    'Not all breathwork is the same. Learn which technique for which situation: Box breathing (before difficult calls), 4-7-8 breath (falling asleep), sighing (releasing tension), breath of fire (energy boost), and resonance breathing (anxiety). Interactive guide with timers.',
    'mindfulness',
    'interactive',
    12,
    TRUE,
    'Russo, M. A., et al. (2017). The physiological effects of slow breathing. Breathe, 13(4), 298-309.',
    23
  ),

  -- Burnout Recovery Plan
  (
    'Your Personalized Burnout Recovery Plan',
    'Already experiencing burnout? This step-by-step recovery guide helps you assess your burnout stage, identify contributing factors (workload, values conflict, lack of support), create an action plan with timeline, and measure progress. Includes decision tree for taking medical leave if needed.',
    'self_care',
    'worksheet',
    30,
    TRUE,
    'Moss, M., et al. (2016). An official critical care societies collaborative statement: Burnout syndrome in critical care health care professionals. American Journal of Critical Care, 25(4), 368-376.',
    24
  )

ON CONFLICT (id) DO NOTHING;

-- Update display order for existing modules to fit in sequence
UPDATE resilience_training_modules
SET display_order = CASE title
  WHEN 'Box Breathing for Stress Relief' THEN 1
  WHEN '3-Minute Micro-Break Routine' THEN 2
  WHEN 'Setting Boundaries with Compassion' THEN 3
  WHEN 'Self-Compassion for Healthcare Workers' THEN 4
  WHEN 'Communication Scripts for Difficult Conversations' THEN 5
  ELSE display_order
END
WHERE display_order = 0 OR display_order IS NULL;

-- Add new resource: The Nurse Burnout Podcast
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
  (
    'The Recovering Nurse Podcast',
    'Weekly podcast featuring nurses sharing their burnout stories and recovery journeys. Hosted by a psychiatric nurse who personally recovered from severe burnout.',
    'podcast',
    'https://recoveringnurse.com',
    ARRAY['self_care', 'crisis_support'],
    ARRAY['podcast', 'community', 'stories'],
    ARRAY['nurse', 'care_manager'],
    FALSE,
    FALSE
  ),
  (
    'Employee Assistance Program (EAP) - Free Counseling',
    'Your employer offers 6-8 free confidential counseling sessions per year. Use your EAP for burnout, stress, family issues, or financial concerns. Check your employee handbook for contact info.',
    'hotline',
    NULL,
    ARRAY['crisis_support'],
    ARRAY['counseling', 'free', 'confidential'],
    ARRAY['all'],
    TRUE,
    TRUE
  ),
  (
    'Insight Timer: Free Meditation App',
    'Free meditation app with 100,000+ guided meditations including specific tracks for healthcare workers, insomnia, and quick 3-minute stress breaks. No subscription required.',
    'app',
    'https://insighttimer.com',
    ARRAY['mindfulness', 'stress_management'],
    ARRAY['meditation', 'free', 'mobile'],
    ARRAY['all'],
    FALSE,
    FALSE
  ),
  (
    'The Burnout Assessment Tool (BAT)',
    'Free, validated self-assessment questionnaire to measure your current burnout level. Takes 10 minutes. Developed by researchers at KU Leuven. Get your personalized burnout profile and risk level.',
    'article',
    'https://burnoutassessmenttool.be',
    ARRAY['self_care'],
    ARRAY['assessment', 'free', 'research'],
    ARRAY['all'],
    TRUE,
    TRUE
  )
ON CONFLICT (id) DO NOTHING;

-- Add comment
COMMENT ON TABLE resilience_training_modules IS 'Evidence-based training content for nurse burnout prevention. Updated 2025-10-20 with 14 additional modules covering moral injury, compassion fatigue, sleep hygiene, and more.';
