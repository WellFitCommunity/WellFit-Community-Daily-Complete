-- Create trivia_questions table for Memory Lane game
CREATE TABLE IF NOT EXISTS trivia_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text TEXT NOT NULL,
  difficulty VARCHAR(10) NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  cognitive_label VARCHAR(50) NOT NULL,
  correct_answer TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  era VARCHAR(20), -- e.g., '1940s', '1950s', '1960s', etc.
  category VARCHAR(50), -- e.g., 'History', 'Music', 'Movies', 'Sports', etc.
  positive_affirmation TEXT, -- Positive message shown regardless of answer
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Create index for faster queries by difficulty
CREATE INDEX idx_trivia_difficulty ON trivia_questions(difficulty) WHERE is_active = TRUE;

-- Create index for era-based queries
CREATE INDEX idx_trivia_era ON trivia_questions(era) WHERE is_active = TRUE;

-- Create index for category queries
CREATE INDEX idx_trivia_category ON trivia_questions(category) WHERE is_active = TRUE;

-- Enable RLS
ALTER TABLE trivia_questions ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read trivia questions
CREATE POLICY "Anyone can read active trivia questions"
  ON trivia_questions FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

-- Only admins can insert/update/delete trivia questions
CREATE POLICY "Only admins can modify trivia questions"
  ON trivia_questions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_trivia_questions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_trivia_questions_timestamp
  BEFORE UPDATE ON trivia_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_trivia_questions_updated_at();

-- Insert initial senior-friendly trivia questions
-- Easy Questions (1940s-1960s Era)
INSERT INTO trivia_questions (question_text, difficulty, cognitive_label, correct_answer, option_a, option_b, option_c, option_d, era, category, positive_affirmation) VALUES
('Who was known as "The King of Rock and Roll"?', 'Easy', 'Music Memory', 'Elvis Presley', 'Frank Sinatra', 'Elvis Presley', 'Dean Martin', 'Bing Crosby', '1950s', 'Music', 'Wonderful! Music from your era brings back great memories! 🎵'),
('What popular dance craze swept America in the 1960s?', 'Easy', 'Cultural Memory', 'The Twist', 'The Waltz', 'The Twist', 'The Tango', 'The Foxtrot', '1960s', 'Culture', 'Fantastic! You remember the dance floor well! 💃'),
('What was the most popular family TV show in the 1950s?', 'Easy', 'TV Memory', 'I Love Lucy', 'I Love Lucy', 'Bonanza', 'The Ed Sullivan Show', 'Gunsmoke', '1950s', 'Television', 'Great job! Those were golden days of television! 📺'),
('Which president served during most of the 1950s?', 'Easy', 'History Recall', 'Dwight Eisenhower', 'Harry Truman', 'John F. Kennedy', 'Dwight Eisenhower', 'Lyndon Johnson', '1950s', 'History', 'Excellent! You lived through important history! 🇺🇸'),
('What year did man first walk on the moon?', 'Easy', 'Historical Events', '1969', '1965', '1967', '1969', '1971', '1960s', 'History', 'Perfect! You witnessed one of humanity''s greatest achievements! 🌙'),
('What popular soda was introduced as a "mixer" in the 1940s?', 'Easy', 'Food Memory', '7-Up', 'Coca-Cola', 'Pepsi', '7-Up', 'Dr Pepper', '1940s', 'Food', 'Terrific! Those were simpler, sweeter times! 🥤'),
('Which baseball legend hit 714 home runs?', 'Easy', 'Sports Memory', 'Babe Ruth', 'Mickey Mantle', 'Joe DiMaggio', 'Babe Ruth', 'Willie Mays', '1940s', 'Sports', 'Home run! Your sports knowledge is amazing! ⚾'),
('What was the popular hairstyle for women in the 1940s?', 'Easy', 'Fashion Memory', 'Victory Rolls', 'Victory Rolls', 'Beehive', 'Pixie Cut', 'Bob', '1940s', 'Fashion', 'Stylish answer! You remember the trends well! 💇‍♀️'),
('Which actress starred in "Singin'' in the Rain"?', 'Easy', 'Movie Memory', 'Debbie Reynolds', 'Debbie Reynolds', 'Doris Day', 'Grace Kelly', 'Audrey Hepburn', '1950s', 'Movies', 'Bravo! Classic cinema at its finest! 🎬'),
('What popular toy was introduced in 1959?', 'Easy', 'Toy Memory', 'Barbie Doll', 'Hula Hoop', 'Frisbee', 'Barbie Doll', 'Mr. Potato Head', '1950s', 'Toys', 'Splendid! Those toys brought so much joy! 🎀'),
('Which war ended in 1945?', 'Easy', 'Historical Events', 'World War II', 'Korean War', 'World War I', 'World War II', 'Vietnam War', '1940s', 'History', 'Absolutely right! You lived through historic times! 🕊️'),
('What was the most popular car in the 1950s?', 'Easy', 'Automotive Memory', 'Chevrolet Bel Air', 'Ford Model T', 'Chevrolet Bel Air', 'Volkswagen Beetle', 'Cadillac Eldorado', '1950s', 'Automobiles', 'Fantastic! Those cars were true classics! 🚗');

-- Medium Questions (1940s-1960s Era)
INSERT INTO trivia_questions (question_text, difficulty, cognitive_label, correct_answer, option_a, option_b, option_c, option_d, era, category, positive_affirmation) VALUES
('Which actress won an Oscar for "Roman Holiday" in 1953?', 'Medium', 'Movie Knowledge', 'Audrey Hepburn', 'Grace Kelly', 'Audrey Hepburn', 'Elizabeth Taylor', 'Marilyn Monroe', '1950s', 'Movies', 'Excellent recall! Classic Hollywood at its best! 🏆'),
('What was the name of the first artificial satellite launched in 1957?', 'Medium', 'Space History', 'Sputnik', 'Apollo', 'Sputnik', 'Explorer', 'Vanguard', '1950s', 'Science', 'Outstanding! The space race was thrilling! 🚀'),
('Which musical debuted on Broadway in 1943 and featured "Oh, What a Beautiful Mornin''"?', 'Medium', 'Theater Memory', 'Oklahoma!', 'Carousel', 'South Pacific', 'The King and I', 'Oklahoma!', '1940s', 'Theater', 'Bravo! Broadway''s golden age was spectacular! 🎭'),
('Who wrote "To Kill a Mockingbird" published in 1960?', 'Medium', 'Literature', 'Harper Lee', 'Harper Lee', 'John Steinbeck', 'Ernest Hemingway', 'F. Scott Fitzgerald', '1960s', 'Books', 'Wonderful! Great literature never fades! 📚'),
('What popular kitchen appliance became common in homes in the 1940s?', 'Medium', 'Home Life', 'Electric Refrigerator', 'Microwave', 'Electric Refrigerator', 'Dishwasher', 'Blender', '1940s', 'Technology', 'Terrific! Home life was changing fast! 🏠'),
('Which boxer was known as "The Brown Bomber"?', 'Medium', 'Sports History', 'Joe Louis', 'Muhammad Ali', 'Joe Louis', 'Sugar Ray Robinson', 'Rocky Marciano', '1940s', 'Sports', 'Knockout answer! Boxing history is rich! 🥊'),
('What year did Alaska become the 49th state?', 'Medium', 'US Geography', '1959', '1955', '1957', '1959', '1961', '1950s', 'History', 'Perfect! You remember American expansion! 🗺️'),
('Which TV Western featured the Cartwright family?', 'Medium', 'Television', 'Bonanza', 'Gunsmoke', 'Rawhide', 'Bonanza', 'The Rifleman', '1960s', 'TV Shows', 'Great memory! Westerns were must-watch TV! 🤠'),
('Who sang "Unforgettable" in 1951?', 'Medium', 'Music History', 'Nat King Cole', 'Frank Sinatra', 'Nat King Cole', 'Dean Martin', 'Tony Bennett', '1950s', 'Music', 'Unforgettable answer! What a voice! 🎤'),
('What was the popular teen hangout spot in the 1950s?', 'Medium', 'Social Memory', 'Soda Fountain', 'Drive-in Theater', 'Bowling Alley', 'Soda Fountain', 'Roller Rink', '1950s', 'Culture', 'Spot on! Those were fun times! 🍦'),
('Which Supreme Court case ended school segregation in 1954?', 'Medium', 'Civil Rights', 'Brown v. Board of Education', 'Plessy v. Ferguson', 'Brown v. Board of Education', 'Roe v. Wade', 'Miranda v. Arizona', '1950s', 'History', 'Important memory! Historic moment for justice! ⚖️'),
('What popular dance was named after a city in South Carolina?', 'Medium', 'Dance History', 'The Charleston', 'The Charleston', 'The Twist', 'The Jitterbug', 'The Lindy Hop', '1940s', 'Dance', 'You''ve got rhythm! Dancing through the decades! 🕺');

-- Hard Questions (1940s-1960s Era)
INSERT INTO trivia_questions (question_text, difficulty, cognitive_label, correct_answer, option_a, option_b, option_c, option_d, era, category, positive_affirmation) VALUES
('Which 1946 film won the Oscar for Best Picture and featured returning WWII veterans?', 'Hard', 'Cinema History', 'The Best Years of Our Lives', 'Going My Way', 'The Best Years of Our Lives', 'Gentleman''s Agreement', 'All About Eve', '1940s', 'Movies', 'Remarkable! Your film knowledge is exceptional! 🎬'),
('What was the name of the hydrogen bomb test at Bikini Atoll in 1954?', 'Hard', 'Historical Events', 'Castle Bravo', 'Trinity', 'Crossroads', 'Castle Bravo', 'Ivy Mike', '1950s', 'History', 'Impressive recall! You lived through pivotal moments! 💡'),
('Which composer wrote "Rhapsody in Blue" and died in 1937?', 'Hard', 'Music Composition', 'George Gershwin', 'George Gershwin', 'Cole Porter', 'Irving Berlin', 'Duke Ellington', '1940s', 'Music', 'Brilliant! American music at its finest! 🎹'),
('What was the name of the famous 1947 UFO incident in New Mexico?', 'Hard', 'Pop Culture', 'Roswell Incident', 'Area 51', 'Roswell Incident', 'Phoenix Lights', 'Rendlesham Forest', '1940s', 'Mystery', 'Fascinating! Those were mysterious times! 👽'),
('Which civil rights activist refused to give up her bus seat in 1955?', 'Hard', 'Civil Rights', 'Rosa Parks', 'Rosa Parks', 'Ruby Bridges', 'Claudette Colvin', 'Fannie Lou Hamer', '1950s', 'History', 'Powerful memory! Heroes who changed history! ✊'),
('What was the name of the first credit card, introduced in 1950?', 'Hard', 'Financial History', 'Diners Club', 'American Express', 'Visa', 'MasterCard', 'Diners Club', '1950s', 'Business', 'Sharp mind! The modern economy was born! 💳'),
('Which 1942 film featured the song "White Christmas"?', 'Hard', 'Film & Music', 'Holiday Inn', 'Going My Way', 'Holiday Inn', 'The Bells of St. Mary''s', 'White Christmas', '1940s', 'Entertainment', 'Splendid! Classic entertainment at its best! 🎄'),
('What year did the Korean War begin?', 'Hard', 'Military History', '1950', '1948', '1950', '1952', '1953', '1950s', 'History', 'Accurate! You remember important world events! 🌍'),
('Which quiz show scandal rocked television in 1958?', 'Hard', 'TV History', 'Twenty-One', 'The $64,000 Question', 'Twenty-One', 'Dotto', 'Tic-Tac-Dough', '1950s', 'Television', 'Excellent! You followed the news closely! 📰'),
('Who was the Secretary of State who developed the European Recovery Plan in 1947?', 'Hard', 'Political History', 'George Marshall', 'Dean Acheson', 'George Marshall', 'John Foster Dulles', 'Henry Kissinger', '1940s', 'Politics', 'Outstanding! Historical knowledge at its peak! 🏛️'),
('What was the name of the first US nuclear-powered submarine launched in 1954?', 'Hard', 'Naval History', 'USS Nautilus', 'USS Enterprise', 'USS Nautilus', 'USS Thresher', 'USS George Washington', '1950s', 'Military', 'Impressive! Naval history runs deep! ⚓'),
('Which author wrote "1984" published in 1949?', 'Hard', 'Literature', 'George Orwell', 'Aldous Huxley', 'Ray Bradbury', 'George Orwell', 'Arthur C. Clarke', '1940s', 'Books', 'Brilliant! Timeless literature endures! 📖');

-- Add more diverse questions for variety
INSERT INTO trivia_questions (question_text, difficulty, cognitive_label, correct_answer, option_a, option_b, option_c, option_d, era, category, positive_affirmation) VALUES
-- Additional Easy Questions
('What breakfast cereal featured Tony the Tiger?', 'Easy', 'Advertising Memory', 'Frosted Flakes', 'Corn Flakes', 'Frosted Flakes', 'Rice Krispies', 'Cheerios', '1950s', 'Food', 'They''re Gr-r-reat! You remember well! 🐯'),
('Which candy bar was marketed as "two for me, none for you"?', 'Easy', 'Food Memory', 'Twix', 'Snickers', 'Milky Way', 'Twix', 'Kit Kat', '1960s', 'Food', 'Sweet memory! Candy was simple joy! 🍫'),
('What popular toy consisted of colored plastic bricks?', 'Easy', 'Toy History', 'Lego', 'Lincoln Logs', 'Tinker Toys', 'Lego', 'Erector Set', '1960s', 'Toys', 'Building great memories! Perfect! 🧱'),

-- Additional Medium Questions
('Which First Lady promoted highway beautification in the 1960s?', 'Medium', 'Political Memory', 'Lady Bird Johnson', 'Jackie Kennedy', 'Pat Nixon', 'Lady Bird Johnson', 'Mamie Eisenhower', '1960s', 'Politics', 'Lovely! You remember the gracious First Ladies! 🌸'),
('What was the popular hairstyle for men in the 1950s?', 'Medium', 'Fashion Memory', 'Pompadour', 'Crew Cut', 'Pompadour', 'Bowl Cut', 'Mullet', '1950s', 'Fashion', 'Cool! You remember the styles! 💇‍♂️'),
('Which fast food chain opened its first franchise in 1955?', 'Medium', 'Business History', 'McDonald''s', 'Burger King', 'McDonald''s', 'KFC', 'Wendy''s', '1950s', 'Food', 'Golden answer! Fast food was born! 🍔'),

-- Additional Hard Questions
('What was the name of the 1948 presidential election upset?', 'Hard', 'Political History', 'Dewey Defeats Truman', 'Dewey Defeats Truman', 'Roosevelt Wins Fourth', 'Eisenhower Landslide', 'Kennedy Victory', '1940s', 'Politics', 'Historic recall! What a surprise that was! 🗳️'),
('Which 1954 Supreme Court Chief Justice presided over Brown v. Board?', 'Hard', 'Legal History', 'Earl Warren', 'Earl Warren', 'Warren Burger', 'William Rehnquist', 'Fred Vinson', '1950s', 'Law', 'Exceptional! Legal history expert! ⚖️'),
('What year did Alaska and Hawaii both achieve statehood?', 'Hard', 'US History', '1959', '1957', '1958', '1959', '1960', '1950s', 'Geography', 'Perfect! The union was completing! 🌺');

-- Grant SELECT permissions to authenticated users
GRANT SELECT ON trivia_questions TO authenticated;

COMMENT ON TABLE trivia_questions IS 'Trivia questions for Memory Lane senior game - era-appropriate questions with positive affirmations';
