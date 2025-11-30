-- ============================================================================
-- Populate affirmations and motivational_quotes tables
-- 50 affirmations + 50 motivational quotes for healthcare workers and seniors
-- ============================================================================

-- Default tenant ID (WellFit Community)
DO $$
DECLARE
  default_tenant UUID := '2b902657-6a20-4435-a78a-576f397517ca';
BEGIN

-- ============================================================================
-- AFFIRMATIONS (50) - For seniors/patients
-- ============================================================================
INSERT INTO affirmations (id, text, author, tenant_id) VALUES
(1, 'Every day is a new opportunity to feel better and stronger.', 'WellFit Community', default_tenant),
(2, 'My health journey is unique, and I celebrate every small victory.', 'WellFit Community', default_tenant),
(3, 'I am worthy of love, care, and attention at every age.', 'WellFit Community', default_tenant),
(4, 'My experiences and wisdom are valuable gifts to share.', 'WellFit Community', default_tenant),
(5, 'I choose to focus on what I can do, not what I cannot.', 'WellFit Community', default_tenant),
(6, 'Rest is not giving up; it is taking care of myself.', 'WellFit Community', default_tenant),
(7, 'I am grateful for this moment and the breath in my lungs.', 'WellFit Community', default_tenant),
(8, 'My body has carried me through many years, and I honor it.', 'WellFit Community', default_tenant),
(9, 'Connection with others enriches my life and theirs.', 'WellFit Community', default_tenant),
(10, 'I deserve compassion from myself and others.', 'WellFit Community', default_tenant),
(11, 'Today I will do what I can with what I have.', 'WellFit Community', default_tenant),
(12, 'My story matters, and my voice deserves to be heard.', 'WellFit Community', default_tenant),
(13, 'I am resilient and have overcome challenges before.', 'WellFit Community', default_tenant),
(14, 'Joy can be found in the simplest moments.', 'WellFit Community', default_tenant),
(15, 'I am more than my health conditions.', 'WellFit Community', default_tenant),
(16, 'Taking things one day at a time is a sign of wisdom.', 'WellFit Community', default_tenant),
(17, 'I welcome help because it shows strength, not weakness.', 'WellFit Community', default_tenant),
(18, 'My mind is sharp, and I continue to learn and grow.', 'WellFit Community', default_tenant),
(19, 'I choose peace over worry today.', 'WellFit Community', default_tenant),
(20, 'The love I have given lives on in everyone I have touched.', 'WellFit Community', default_tenant),
(21, 'I am patient with myself as I navigate changes.', 'WellFit Community', default_tenant),
(22, 'My presence brings comfort to those around me.', 'WellFit Community', default_tenant),
(23, 'I honor my need for rest and renewal.', 'WellFit Community', default_tenant),
(24, 'Every challenge I face makes me stronger.', 'WellFit Community', default_tenant),
(25, 'I am surrounded by people who care about me.', 'WellFit Community', default_tenant),
(26, 'My feelings are valid and deserve acknowledgment.', 'WellFit Community', default_tenant),
(27, 'I bring unique perspective shaped by years of living.', 'WellFit Community', default_tenant),
(28, 'Asking for help is an act of courage.', 'WellFit Community', default_tenant),
(29, 'I focus on progress, not perfection.', 'WellFit Community', default_tenant),
(30, 'My life has meaning and purpose every single day.', 'WellFit Community', default_tenant),
(31, 'I trust my body to tell me what it needs.', 'WellFit Community', default_tenant),
(32, 'Laughter and joy are healing medicine.', 'WellFit Community', default_tenant),
(33, 'I am grateful for modern medicine and caring providers.', 'WellFit Community', default_tenant),
(34, 'My independence is precious, and I protect it wisely.', 'WellFit Community', default_tenant),
(35, 'I find beauty in each day, even difficult ones.', 'WellFit Community', default_tenant),
(36, 'My memories are treasures that no one can take away.', 'WellFit Community', default_tenant),
(37, 'I am capable of adapting to new situations.', 'WellFit Community', default_tenant),
(38, 'Today I choose hope over fear.', 'WellFit Community', default_tenant),
(39, 'I deserve quality healthcare and respect.', 'WellFit Community', default_tenant),
(40, 'My daily routines bring me comfort and stability.', 'WellFit Community', default_tenant),
(41, 'I am thankful for technology that keeps me connected.', 'WellFit Community', default_tenant),
(42, 'Movement, however small, is a celebration of life.', 'WellFit Community', default_tenant),
(43, 'I release what I cannot control and focus on what I can.', 'WellFit Community', default_tenant),
(44, 'My faith and beliefs give me strength.', 'WellFit Community', default_tenant),
(45, 'I appreciate the caregivers who support my journey.', 'WellFit Community', default_tenant),
(46, 'Each morning is a gift I choose to embrace.', 'WellFit Community', default_tenant),
(47, 'I am proud of the life I have built.', 'WellFit Community', default_tenant),
(48, 'My health goals are achievable with patience.', 'WellFit Community', default_tenant),
(49, 'I nurture my mind, body, and spirit with kindness.', 'WellFit Community', default_tenant),
(50, 'Today is another chance to make meaningful connections.', 'WellFit Community', default_tenant)
ON CONFLICT (id) DO UPDATE SET text = EXCLUDED.text, author = EXCLUDED.author, tenant_id = EXCLUDED.tenant_id;

RAISE NOTICE 'Inserted 50 affirmations';

END $$;

-- ============================================================================
-- MOTIVATIONAL QUOTES (50) - For healthcare workers
-- ============================================================================
INSERT INTO motivational_quotes (quote_text, author, theme, role_specific, tenant_id) VALUES
-- Compassion theme
('The best way to find yourself is to lose yourself in the service of others.', 'Mahatma Gandhi', 'compassion', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Caring for others is an expression of what it means to be fully human.', 'Hillary Clinton', 'compassion', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Too often we underestimate the power of a touch, a smile, a kind word.', 'Leo Buscaglia', 'compassion', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Where there is love there is life.', 'Mahatma Gandhi', 'compassion', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Compassion is the basis of morality.', 'Arthur Schopenhauer', 'compassion', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Be kind, for everyone you meet is fighting a hard battle.', 'Plato', 'compassion', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('The simple act of caring is heroic.', 'Edward Albert', 'compassion', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),

-- Excellence theme
('Excellence is not a skill. It is an attitude.', 'Ralph Marston', 'excellence', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('The quality of a person''s life is in direct proportion to their commitment to excellence.', 'Vince Lombardi', 'excellence', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Strive not to be a success, but rather to be of value.', 'Albert Einstein', 'excellence', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('We are what we repeatedly do. Excellence, then, is not an act, but a habit.', 'Aristotle', 'excellence', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('The pursuit of excellence is gratifying and healthy.', 'Pat Riley', 'excellence', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Excellence is doing ordinary things extraordinarily well.', 'John W. Gardner', 'excellence', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Quality means doing it right when no one is looking.', 'Henry Ford', 'excellence', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),

-- Perseverance theme
('It does not matter how slowly you go as long as you do not stop.', 'Confucius', 'perseverance', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Success is not final, failure is not fatal: it is the courage to continue that counts.', 'Winston Churchill', 'perseverance', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('The only impossible journey is the one you never begin.', 'Tony Robbins', 'perseverance', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Perseverance is not a long race; it is many short races one after the other.', 'Walter Elliot', 'perseverance', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Courage doesn''t always roar. Sometimes it''s the quiet voice saying I will try again tomorrow.', 'Mary Anne Radmacher', 'perseverance', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Fall seven times, stand up eight.', 'Japanese Proverb', 'perseverance', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Difficult roads often lead to beautiful destinations.', 'Zig Ziglar', 'perseverance', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),

-- Innovation theme
('Innovation distinguishes between a leader and a follower.', 'Steve Jobs', 'innovation', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('The only way to do great work is to love what you do.', 'Steve Jobs', 'innovation', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Stay hungry, stay foolish.', 'Steve Jobs', 'innovation', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Think different.', 'Apple Inc.', 'innovation', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('The best time to plant a tree was 20 years ago. The second best time is now.', 'Chinese Proverb', 'innovation', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Change is the law of life.', 'John F. Kennedy', 'innovation', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Progress is impossible without change.', 'George Bernard Shaw', 'innovation', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),

-- Healing theme
('The art of healing comes from nature, not from the physician.', 'Paracelsus', 'healing', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Healing takes courage, and we all have courage, even if we have to dig a little to find it.', 'Tori Amos', 'healing', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('The wound is the place where the Light enters you.', 'Rumi', 'healing', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Healing is a matter of time, but it is sometimes also a matter of opportunity.', 'Hippocrates', 'healing', ARRAY['physician', 'nurse'], '2b902657-6a20-4435-a78a-576f397517ca'),
('The greatest healing therapy is friendship and love.', 'Hubert H. Humphrey', 'healing', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('To heal a wound you need to stop touching it.', 'Unknown', 'healing', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Rest when you''re weary. Refresh and renew yourself.', 'Ralph Marston', 'healing', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),

-- Teamwork theme
('Alone we can do so little; together we can do so much.', 'Helen Keller', 'teamwork', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Coming together is a beginning, staying together is progress, working together is success.', 'Henry Ford', 'teamwork', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Teamwork makes the dream work.', 'Bang Gae', 'teamwork', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('None of us is as smart as all of us.', 'Ken Blanchard', 'teamwork', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Unity is strength. When there is teamwork, wonderful things can be achieved.', 'Mattie Stepanek', 'teamwork', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('The strength of the team is each individual member.', 'Phil Jackson', 'teamwork', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Talent wins games, but teamwork wins championships.', 'Michael Jordan', 'teamwork', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),

-- Leadership theme
('A leader is one who knows the way, goes the way, and shows the way.', 'John C. Maxwell', 'leadership', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Leadership is not about being in charge. It is about taking care of those in your charge.', 'Simon Sinek', 'leadership', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('The greatest leader is not necessarily one who does the greatest things, but gets people to do the greatest things.', 'Ronald Reagan', 'leadership', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Before you are a leader, success is all about growing yourself. When you become a leader, success is all about growing others.', 'Jack Welch', 'leadership', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Leadership and learning are indispensable to each other.', 'John F. Kennedy', 'leadership', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('The task of leadership is not to put greatness into people, but to elicit it.', 'John Buchan', 'leadership', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca'),
('Be the change you wish to see in the world.', 'Mahatma Gandhi', 'leadership', ARRAY['all'], '2b902657-6a20-4435-a78a-576f397517ca')
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  quote_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO quote_count FROM motivational_quotes;
  RAISE NOTICE 'Total motivational quotes: %', quote_count;
END $$;
