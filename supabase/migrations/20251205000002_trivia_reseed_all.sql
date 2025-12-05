-- ============================================================================
-- Memory Lane Trivia - Re-Seed All Questions
-- ============================================================================
-- This migration re-applies the trivia question seed data because the original
-- seed migrations (20251016000003, 20251016000004) ran BEFORE the table was
-- created in 20251017000003. This consolidates all seed data.
-- ============================================================================

-- Clear existing data to avoid duplicates (safe since this is seed data)
DELETE FROM memory_lane_trivia;

-- ============================================================================
-- EASY QUESTIONS (70 questions)
-- ============================================================================

INSERT INTO memory_lane_trivia (question, era, difficulty, option_a, option_b, option_c, option_d, correct_answer, cognitive_function, brain_region, explanation) VALUES

-- 1950s Easy Questions (14 questions)
('What color was the iconic 1950s kitchen appliance, the refrigerator?', '1950s', 'easy', 'Avocado Green', 'Harvest Gold', 'Pastel Pink or Blue', 'Stainless Steel', 'C', 'Episodic Memory', 'Hippocampus', 'Recalls visual memories of home environments from the 1950s era'),
('What dance craze swept America in the 1950s?', '1950s', 'easy', 'The Twist', 'The Jitterbug', 'The Moonwalk', 'The Electric Slide', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering cultural facts and social movements from the 1950s'),
('Who was known as the King of Rock and Roll?', '1950s', 'easy', 'Chuck Berry', 'Little Richard', 'Elvis Presley', 'Buddy Holly', 'C', 'Semantic Memory', 'Temporal Lobe', 'Recalling famous cultural figures and their titles'),
('What was a popular TV dinner brand in the 1950s?', '1950s', 'easy', 'Lean Cuisine', 'Swanson', 'Hungry-Man', 'Marie Callender', 'B', 'Episodic Memory', 'Hippocampus', 'Remembering everyday products and brand names from personal experience'),
('What hairstyle was popular for women in the 1950s?', '1950s', 'easy', 'The Bob', 'The Beehive', 'The Poodle Cut', 'The Pixie', 'C', 'Visual Memory', 'Occipital Lobe', 'Recalling visual fashion trends and styles'),
('What iconic toy was introduced in 1959?', '1950s', 'easy', 'Barbie Doll', 'G.I. Joe', 'Cabbage Patch Kids', 'Transformers', 'A', 'Semantic Memory', 'Temporal Lobe', 'Remembering significant product launches and cultural milestones'),
('What was the popular skirt style of the 1950s?', '1950s', 'easy', 'Mini Skirt', 'Poodle Skirt', 'Pencil Skirt', 'Maxi Skirt', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling distinctive fashion items'),
('What soda shop treat was popular in the 1950s?', '1950s', 'easy', 'Smoothies', 'Malted Milkshakes', 'Frozen Yogurt', 'Bubble Tea', 'B', 'Episodic Memory', 'Hippocampus', 'Remembering social experiences and favorite treats'),
('Who was President of the United States for most of the 1950s?', '1950s', 'easy', 'Harry Truman', 'Dwight D. Eisenhower', 'John F. Kennedy', 'Lyndon B. Johnson', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling historical facts and political leaders'),
('What type of music did teenagers dance to at sock hops?', '1950s', 'easy', 'Disco', 'Rock and Roll', 'Hip Hop', 'Country', 'B', 'Episodic Memory', 'Hippocampus', 'Remembering social events and music associated with them'),
('What was a popular car style in the 1950s?', '1950s', 'easy', 'Compact Cars', 'Cars with Tail Fins', 'SUVs', 'Hybrid Cars', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling distinctive visual designs of era-specific objects'),
('What television show featured Lucy and Ricky Ricardo?', '1950s', 'easy', 'The Honeymooners', 'I Love Lucy', 'Leave It to Beaver', 'Father Knows Best', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering popular media and character names'),
('What was a popular outdoor activity for families in the 1950s?', '1950s', 'easy', 'Video Gaming', 'Drive-In Movies', 'Internet Surfing', 'Skateboarding', 'B', 'Episodic Memory', 'Hippocampus', 'Recalling family activities and social experiences'),
('What kitchen appliance became common in American homes in the 1950s?', '1950s', 'easy', 'Microwave', 'Electric Mixer', 'Air Fryer', 'Instant Pot', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering technological adoption in households'),

-- 1960s Easy Questions (14 questions)
('What British band became wildly popular in America in the 1960s?', '1960s', 'easy', 'The Rolling Stones', 'The Who', 'The Beatles', 'The Kinks', 'C', 'Semantic Memory', 'Temporal Lobe', 'Recalling major cultural phenomena and music groups'),
('What dance was named after a popular twist snack?', '1960s', 'easy', 'The Twist', 'The Mashed Potato', 'The Pretzel', 'The Cookie', 'A', 'Semantic Memory', 'Temporal Lobe', 'Remembering popular dances and their origins'),
('What type of pants became fashionable in the late 1960s?', '1960s', 'easy', 'Skinny Jeans', 'Bell Bottoms', 'Cargo Pants', 'Jeggings', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling fashion trends and clothing styles'),
('What major space achievement happened in 1969?', '1960s', 'easy', 'First Satellite', 'Moon Landing', 'Mars Rover', 'Space Station', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering significant historical events'),
('What popular doll had a little sister named Skipper?', '1960s', 'easy', 'Chatty Cathy', 'Barbie', 'Raggedy Ann', 'Betsy Wetsy', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling toy products and their variations'),
('What TV show featured a magical housewife who wiggled her nose?', '1960s', 'easy', 'I Dream of Jeannie', 'Bewitched', 'The Addams Family', 'The Munsters', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering TV shows and their distinctive features'),
('What colorful art style was popular in the 1960s?', '1960s', 'easy', 'Minimalism', 'Pop Art', 'Cubism', 'Impressionism', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling artistic movements and visual styles'),
('What outdoor music festival became legendary in 1969?', '1960s', 'easy', 'Lollapalooza', 'Coachella', 'Woodstock', 'Bonnaroo', 'C', 'Semantic Memory', 'Temporal Lobe', 'Remembering major cultural events'),
('What was a popular hairstyle for women in the 1960s?', '1960s', 'easy', 'The Rachel', 'The Beehive', 'The Shag', 'The Mullet', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling distinctive hairstyles'),
('Who was the President assassinated in 1963?', '1960s', 'easy', 'Abraham Lincoln', 'John F. Kennedy', 'William McKinley', 'James Garfield', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering tragic historical events'),
('What type of boots became fashionable in the 1960s?', '1960s', 'easy', 'Cowboy Boots', 'Go-Go Boots', 'Ugg Boots', 'Combat Boots', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling fashion footwear trends'),
('What car became an icon of the 1960s counterculture?', '1960s', 'easy', 'Ford Mustang', 'Volkswagen Bus', 'Corvette', 'Cadillac', 'B', 'Visual Memory', 'Occipital Lobe', 'Associating vehicles with cultural movements'),
('What breakfast cereal featured a cartoon tiger?', '1960s', 'easy', 'Frosted Flakes', 'Fruit Loops', 'Lucky Charms', 'Trix', 'A', 'Semantic Memory', 'Temporal Lobe', 'Remembering brand mascots and products'),
('What type of lights became popular home decor in the 1960s?', '1960s', 'easy', 'String Lights', 'Lava Lamps', 'Neon Signs', 'LED Strips', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling distinctive home decor items'),

-- 1970s Easy Questions (14 questions)
('What dance style was popular in the 1970s?', '1970s', 'easy', 'Hip Hop', 'Disco', 'Break Dancing', 'Line Dancing', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering popular dance movements'),
('What type of pants were tight on top and wide at the bottom?', '1970s', 'easy', 'Skinny Jeans', 'Bell Bottoms', 'Straight Leg', 'Bootcut', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling clothing styles and shapes'),
('What iconic movie featured a shark terrorizing a beach town?', '1970s', 'easy', 'The Poseidon Adventure', 'Jaws', 'Deep Blue Sea', 'Piranha', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering blockbuster films'),
('What popular toy could solve itself if you knew the algorithm?', '1970s', 'easy', 'Rubik''s Cube', 'Simon', 'Lite-Brite', 'Etch A Sketch', 'A', 'Semantic Memory', 'Temporal Lobe', 'Recalling popular toys and puzzles'),
('What music group sang "Dancing Queen"?', '1970s', 'easy', 'The Bee Gees', 'ABBA', 'Fleetwood Mac', 'The Eagles', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering songs and their artists'),
('What shoe style had a thick platform sole?', '1970s', 'easy', 'Stilettos', 'Platform Shoes', 'Ballet Flats', 'Sneakers', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling footwear fashion'),
('What TV show featured the Fonz?', '1970s', 'easy', 'Laverne & Shirley', 'Happy Days', 'Welcome Back, Kotter', 'The Brady Bunch', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering TV characters and shows'),
('What hairstyle was worn by Farrah Fawcett?', '1970s', 'easy', 'Pixie Cut', 'Feathered Hair', 'Afro', 'Bowl Cut', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling celebrity hairstyles'),
('What movie featured John Travolta in a white suit?', '1970s', 'easy', 'Grease', 'Saturday Night Fever', 'Urban Cowboy', 'Staying Alive', 'B', 'Visual Memory', 'Occipital Lobe', 'Remembering iconic movie scenes'),
('What handheld electronic game had four colored buttons?', '1970s', 'easy', 'Game Boy', 'Simon', 'Atari', 'Nintendo', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling game appearance and features'),
('What CB radio phrase meant "yes"?', '1970s', 'easy', 'Roger That', 'Ten-Four', 'Copy That', 'Affirmative', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering CB radio lingo'),
('What type of jeans were faded and worn-looking?', '1970s', 'easy', 'Dark Wash', 'Distressed Denim', 'Black Jeans', 'White Jeans', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling denim styles'),
('What TV family lived in a split-level home?', '1970s', 'easy', 'The Waltons', 'The Brady Bunch', 'The Partridge Family', 'Eight is Enough', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering TV families'),
('What exercise trend involved jumping and aerobics?', '1970s', 'easy', 'Pilates', 'Jazzercise', 'CrossFit', 'Zumba', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling fitness trends'),

-- 1980s Easy Questions (14 questions)
('What portable music player was popular in the 1980s?', '1980s', 'easy', 'iPod', 'Walkman', 'MP3 Player', 'Discman', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering technology and products'),
('What colorful puzzle cube became a craze?', '1980s', 'easy', 'Puzzle Ball', 'Rubik''s Cube', 'Tangram', 'Sudoku', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling popular toys and puzzles'),
('What hairstyle was characterized by lots of volume and curls?', '1980s', 'easy', 'Bowl Cut', 'Big Hair/Perm', 'Pixie Cut', 'Bob', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling hairstyle trends'),
('What video game console was released by Nintendo in the 1980s?', '1980s', 'easy', 'PlayStation', 'NES (Nintendo Entertainment System)', 'Xbox', 'Sega Genesis', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering gaming systems'),
('What style of jacket was popular for men and women?', '1980s', 'easy', 'Leather Jacket', 'Members Only Jacket', 'Denim Jacket', 'Puffer Jacket', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling fashion items'),
('What movie series featured a time-traveling DeLorean?', '1980s', 'easy', 'The Terminator', 'Back to the Future', 'Bill & Ted', 'Time Bandits', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering movie plots'),
('What was the name of the valley girl expression?', '1980s', 'easy', 'Totally Awesome', 'Like, For Sure', 'Gag Me With a Spoon', 'All of the Above', 'D', 'Semantic Memory', 'Temporal Lobe', 'Recalling cultural slang'),
('What TV show featured the Huxtables?', '1980s', 'easy', 'Family Ties', 'The Cosby Show', 'Growing Pains', 'Who''s the Boss', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering TV families'),
('What toy allowed kids to record their voices?', '1980s', 'easy', 'Speak & Spell', 'Teddy Ruxpin', 'Furby', 'Tamagotchi', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling interactive toys'),
('What type of legwear was worn over pants?', '1980s', 'easy', 'Stockings', 'Leg Warmers', 'Knee Socks', 'Tights', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling fashion accessories'),
('What music channel launched in 1981?', '1980s', 'easy', 'VH1', 'MTV', 'BET', 'CMT', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering media launches'),
('What workout video was hosted by Jane Fonda?', '1980s', 'easy', 'Sweatin'' to the Oldies', 'Jane Fonda''s Workout', 'Tae Bo', '8 Minute Abs', 'B', 'Associative Memory', 'Hippocampus', 'Connecting celebrities with products'),
('What video game featured a plumber named Mario?', '1980s', 'easy', 'Pac-Man', 'Donkey Kong', 'Space Invaders', 'Asteroids', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering video game characters'),
('What type of sunglasses were popular in the 1980s?', '1980s', 'easy', 'Cat Eye', 'Aviators', 'Round', 'Square', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling eyewear trends'),

-- 1990s Easy Questions (14 questions)
('What portable device allowed you to play CDs on the go?', '1990s', 'easy', 'Walkman', 'Discman', 'iPod', 'Zune', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering technology products'),
('What fashion trend involved wearing jeans backwards?', '1990s', 'easy', 'Grunge', 'Kris Kross Style', 'Hip Hop', 'Preppy', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling fashion trends'),
('What TV show featured six friends in New York?', '1990s', 'easy', 'Seinfeld', 'Friends', 'Mad About You', 'Living Single', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering TV shows'),
('What virtual pet was popular in the late 1990s?', '1990s', 'easy', 'Furby', 'Tamagotchi', 'Teddy Ruxpin', 'Giga Pet', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling toy fads'),
('What boy band sang "I Want It That Way"?', '1990s', 'easy', 'NSYNC', 'Backstreet Boys', 'New Kids on the Block', '98 Degrees', 'B', 'Associative Memory', 'Hippocampus', 'Connecting songs with artists'),
('What hairstyle was known as "The Rachel"?', '1990s', 'easy', 'Pixie Cut', 'Jennifer Aniston''s Haircut', 'Crimped Hair', 'High Ponytail', 'B', 'Associative Memory', 'Hippocampus', 'Connecting celebrities with trends'),
('What movie featured a sinking ship?', '1990s', 'easy', 'The Perfect Storm', 'Titanic', 'Waterworld', 'Deep Impact', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering blockbuster films'),
('What type of shoes were worn with everything?', '1990s', 'easy', 'Combat Boots', 'Platform Sneakers', 'Flip Flops', 'Loafers', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling footwear trends'),
('What cartoon featured babies having adventures?', '1990s', 'easy', 'Doug', 'Rugrats', 'Hey Arnold', 'Dexter''s Laboratory', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering animated shows'),
('What choker style was popular in the 1990s?', '1990s', 'easy', 'Pearl Necklace', 'Tattoo Choker', 'Chain Necklace', 'Pendant', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling jewelry trends'),
('What type of jeans were baggy and low-rise?', '1990s', 'easy', 'Skinny Jeans', 'JNCO Jeans', 'Mom Jeans', 'Flare Jeans', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling denim styles'),
('What website launched in 1995 for online auctions?', '1990s', 'easy', 'Amazon', 'eBay', 'Craigslist', 'Etsy', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering internet milestones'),
('What girl group sang "Wannabe"?', '1990s', 'easy', 'Destiny''s Child', 'Spice Girls', 'TLC', 'En Vogue', 'B', 'Associative Memory', 'Hippocampus', 'Connecting songs with artists'),
('What flannel-wearing music genre was popular in the early 1990s?', '1990s', 'easy', 'Pop', 'Grunge', 'Disco', 'Punk', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering music genres');

-- ============================================================================
-- MEDIUM QUESTIONS (50 questions)
-- ============================================================================

INSERT INTO memory_lane_trivia (question, era, difficulty, option_a, option_b, option_c, option_d, correct_answer, cognitive_function, brain_region, explanation) VALUES

-- 1950s Medium Questions (10 questions)
('What year did the Soviet Union launch Sputnik, starting the Space Race?', '1950s', 'medium', '1955', '1957', '1959', '1961', 'B', 'Temporal Sequencing', 'Prefrontal Cortex', 'Recalling specific dates and ordering historical events'),
('Which actress starred in "Rebel Without a Cause" alongside James Dean?', '1950s', 'medium', 'Marilyn Monroe', 'Grace Kelly', 'Natalie Wood', 'Audrey Hepburn', 'C', 'Associative Memory', 'Hippocampus', 'Connecting actors with films and co-stars'),
('What was the name of the first artificial satellite launched into space?', '1950s', 'medium', 'Apollo 1', 'Sputnik', 'Explorer 1', 'Vanguard', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling significant technological achievements'),
('Who invented the polio vaccine that was widely distributed in the 1950s?', '1950s', 'medium', 'Louis Pasteur', 'Jonas Salk', 'Albert Sabin', 'Edward Jenner', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering scientific contributors'),
('What was the name of the highway system started by President Eisenhower?', '1950s', 'medium', 'Route 66', 'Interstate Highway System', 'Lincoln Highway', 'National Road', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling infrastructure projects'),
('What Supreme Court case ended school segregation in 1954?', '1950s', 'medium', 'Plessy v. Ferguson', 'Brown v. Board of Education', 'Miranda v. Arizona', 'Roe v. Wade', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling landmark legal cases'),
('What toy company introduced Mr. Potato Head in 1952?', '1950s', 'medium', 'Mattel', 'Hasbro', 'Fisher-Price', 'Playskool', 'B', 'Associative Memory', 'Hippocampus', 'Connecting products with companies'),
('Which TV western featured Marshal Matt Dillon?', '1950s', 'medium', 'Bonanza', 'Gunsmoke', 'Rawhide', 'The Rifleman', 'B', 'Associative Memory', 'Hippocampus', 'Linking characters with shows'),
('What comic strip dog was created by Charles Schulz in 1950?', '1950s', 'medium', 'Marmaduke', 'Snoopy', 'Odie', 'Scooby-Doo', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering cultural creations'),
('What automobile company introduced the Corvette in 1953?', '1950s', 'medium', 'Ford', 'Chevrolet', 'Dodge', 'Buick', 'B', 'Associative Memory', 'Hippocampus', 'Connecting products with manufacturers'),

-- 1960s Medium Questions (10 questions)
('What year did the Berlin Wall go up?', '1960s', 'medium', '1959', '1961', '1963', '1965', 'B', 'Temporal Sequencing', 'Prefrontal Cortex', 'Ordering major historical events'),
('Who sang "Respect" which became an anthem of the civil rights movement?', '1960s', 'medium', 'Diana Ross', 'Aretha Franklin', 'Etta James', 'Nina Simone', 'B', 'Associative Memory', 'Hippocampus', 'Connecting songs with artists and movements'),
('What car was introduced by Ford in 1964 and became a sports car icon?', '1960s', 'medium', 'Thunderbird', 'Mustang', 'Camaro', 'Corvette', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling product launches'),
('Which British model was known as "The Face of the 60s"?', '1960s', 'medium', 'Jean Shrimpton', 'Twiggy', 'Veruschka', 'Penelope Tree', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering cultural icons'),
('What was the name of the first American to orbit the Earth?', '1960s', 'medium', 'Alan Shepard', 'John Glenn', 'Neil Armstrong', 'Buzz Aldrin', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling space program achievements'),
('Which TV show featured Secret Agent Maxwell Smart?', '1960s', 'medium', 'The Man from U.N.C.L.E.', 'Get Smart', 'Mission: Impossible', 'The Avengers', 'B', 'Associative Memory', 'Hippocampus', 'Connecting characters with shows'),
('Who wrote "To Kill a Mockingbird" published in 1960?', '1960s', 'medium', 'Harper Lee', 'Truman Capote', 'John Steinbeck', 'F. Scott Fitzgerald', 'A', 'Semantic Memory', 'Temporal Lobe', 'Remembering authors and works'),
('What was the name of the doctor on "Star Trek"?', '1960s', 'medium', 'Dr. Smith', 'Dr. McCoy', 'Dr. Crusher', 'Dr. Bashir', 'B', 'Associative Memory', 'Hippocampus', 'Recalling TV characters'),
('Which company introduced the first handheld calculator in 1967?', '1960s', 'medium', 'IBM', 'Texas Instruments', 'Hewlett-Packard', 'Canon', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering technology milestones'),
('What phrase did Neil Armstrong say when stepping on the moon?', '1960s', 'medium', 'Houston, we have a problem', 'One small step for man', 'The Eagle has landed', 'Mission accomplished', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling famous quotes'),

-- 1970s Medium Questions (10 questions)
('What year did President Nixon resign from office?', '1970s', 'medium', '1972', '1974', '1976', '1978', 'B', 'Temporal Sequencing', 'Prefrontal Cortex', 'Ordering political events'),
('What was the name of the scandal that led to Nixon''s resignation?', '1970s', 'medium', 'Teapot Dome', 'Watergate', 'Iran-Contra', 'Whitewater', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering political scandals'),
('Which band released "Hotel California" in 1976?', '1970s', 'medium', 'Fleetwood Mac', 'The Eagles', 'Led Zeppelin', 'Pink Floyd', 'B', 'Associative Memory', 'Hippocampus', 'Connecting songs with bands'),
('What was the name of the first home video game console by Atari?', '1970s', 'medium', 'Atari 5200', 'Atari 2600', 'Atari 7800', 'Atari Jaguar', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling gaming history'),
('Who became the first female Prime Minister of Israel in the 1970s?', '1970s', 'medium', 'Indira Gandhi', 'Golda Meir', 'Margaret Thatcher', 'Benazir Bhutto', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering world leaders'),
('What was the name of the ship in the TV series "The Love Boat"?', '1970s', 'medium', 'SS Minnow', 'Pacific Princess', 'USS Enterprise', 'Poseidon', 'B', 'Associative Memory', 'Hippocampus', 'Recalling TV show details'),
('Which company released the first Sony Walkman in 1979?', '1970s', 'medium', 'Panasonic', 'Sony', 'JVC', 'Sanyo', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering product releases'),
('What sporting event was marred by tragedy in Munich in 1972?', '1970s', 'medium', 'World Cup', 'Olympics', 'Super Bowl', 'World Series', 'B', 'Contextual Memory', 'Hippocampus', 'Recalling historical events with context'),
('Who sang "I Will Survive" which became a disco anthem?', '1970s', 'medium', 'Donna Summer', 'Gloria Gaynor', 'Diana Ross', 'Chaka Khan', 'B', 'Associative Memory', 'Hippocampus', 'Connecting songs with artists'),
('What was the highest-grossing movie of the 1970s?', '1970s', 'medium', 'Jaws', 'Star Wars', 'The Godfather', 'Rocky', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling box office records'),

-- 1980s Medium Questions (10 questions)
('What year did the Space Shuttle Challenger disaster occur?', '1980s', 'medium', '1984', '1986', '1988', '1990', 'B', 'Temporal Sequencing', 'Prefrontal Cortex', 'Ordering tragic events'),
('Who shot President Ronald Reagan in 1981?', '1980s', 'medium', 'Lee Harvey Oswald', 'John Hinckley Jr.', 'Sirhan Sirhan', 'James Earl Ray', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling historical events'),
('Which company introduced the Macintosh computer in 1984?', '1980s', 'medium', 'IBM', 'Apple', 'Microsoft', 'Commodore', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering tech launches'),
('What was the year the Berlin Wall fell?', '1980s', 'medium', '1987', '1989', '1990', '1991', 'B', 'Temporal Sequencing', 'Prefrontal Cortex', 'Ordering world events'),
('Which movie featured the line "Nobody puts Baby in a corner"?', '1980s', 'medium', 'Footloose', 'Dirty Dancing', 'Flashdance', 'Fame', 'B', 'Associative Memory', 'Hippocampus', 'Connecting quotes with movies'),
('Who was known as the "Material Girl"?', '1980s', 'medium', 'Cyndi Lauper', 'Madonna', 'Whitney Houston', 'Janet Jackson', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling celebrity nicknames'),
('What was the name of the oil tanker that had a major spill in 1989?', '1980s', 'medium', 'Prestige', 'Exxon Valdez', 'Amoco Cadiz', 'Torrey Canyon', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering environmental disasters'),
('Which TV show featured a talking car named KITT?', '1980s', 'medium', 'The A-Team', 'Knight Rider', 'Airwolf', 'Magnum P.I.', 'B', 'Associative Memory', 'Hippocampus', 'Connecting shows with characters'),
('What arcade game featured a yellow circle eating dots?', '1980s', 'medium', 'Space Invaders', 'Pac-Man', 'Donkey Kong', 'Asteroids', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling video game visuals'),
('Who was the lead singer of U2?', '1980s', 'medium', 'Sting', 'Bono', 'Michael Stipe', 'Morrissey', 'B', 'Associative Memory', 'Hippocampus', 'Connecting band members'),

-- 1990s Medium Questions (10 questions)
('What year did the World Wide Web become publicly available?', '1990s', 'medium', '1989', '1991', '1993', '1995', 'B', 'Temporal Sequencing', 'Prefrontal Cortex', 'Ordering technological milestones'),
('Who won the 1999 Women''s World Cup for the United States?', '1990s', 'medium', 'US Men''s Team', 'US Women''s Soccer Team', 'US Basketball Team', 'US Hockey Team', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling sports achievements'),
('What was the name of the sheep cloned in 1996?', '1990s', 'medium', 'Molly', 'Dolly', 'Polly', 'Sally', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering scientific breakthroughs'),
('Which sitcom featured a coffee shop called Central Perk?', '1990s', 'medium', 'Seinfeld', 'Friends', 'Frasier', 'Mad About You', 'B', 'Associative Memory', 'Hippocampus', 'Connecting show details'),
('What handheld gaming device did Nintendo release in 1989?', '1990s', 'medium', 'Game Gear', 'Game Boy', 'PSP', 'Neo Geo Pocket', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling gaming history'),
('Who starred in "The Sixth Sense" and could see dead people?', '1990s', 'medium', 'Haley Joel Osment', 'Macaulay Culkin', 'Elijah Wood', 'Frankie Muniz', 'A', 'Associative Memory', 'Hippocampus', 'Connecting actors with roles'),
('What search engine was founded by Larry Page and Sergey Brin?', '1990s', 'medium', 'Yahoo', 'Google', 'AltaVista', 'Lycos', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering tech founders'),
('What was the name of Princess Diana''s car crash location?', '1990s', 'medium', 'London', 'Paris', 'Monaco', 'Rome', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling tragic events'),
('Who was the NBA Finals MVP in 1998?', '1990s', 'medium', 'Shaquille O''Neal', 'Michael Jordan', 'Scottie Pippen', 'Karl Malone', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering sports achievements'),
('What animated movie featured toys that came to life?', '1990s', 'medium', 'A Bug''s Life', 'Toy Story', 'Shrek', 'Finding Nemo', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling animated films');

-- ============================================================================
-- HARD QUESTIONS (30 questions)
-- ============================================================================

INSERT INTO memory_lane_trivia (question, era, difficulty, option_a, option_b, option_c, option_d, correct_answer, cognitive_function, brain_region, explanation) VALUES

-- 1950s Hard Questions (6 questions)
('What was the name of the TV quiz show scandal of 1958?', '1950s', 'hard', 'The $64,000 Question', 'Twenty-One', 'Dotto', 'Name That Tune', 'B', 'Contextual Memory', 'Hippocampus', 'Recalling specific scandals and their details'),
('Who was the architect who designed the Guggenheim Museum, completed in 1959?', '1950s', 'hard', 'I.M. Pei', 'Frank Lloyd Wright', 'Louis Kahn', 'Mies van der Rohe', 'B', 'Associative Memory', 'Hippocampus', 'Connecting architects with their famous works'),
('What was the name of Rosa Parks'' act of civil disobedience in 1955?', '1950s', 'hard', 'March on Washington', 'Montgomery Bus Boycott', 'Sit-in Movement', 'Freedom Rides', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering civil rights events'),
('Which pharmaceutical company first marketed Valium in 1963?', '1950s', 'hard', 'Pfizer', 'Roche', 'Merck', 'Eli Lilly', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling pharmaceutical history'),
('What was the first credit card introduced for general use in 1950?', '1950s', 'hard', 'American Express', 'Diners Club', 'Visa', 'MasterCard', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering financial innovations'),
('Who composed the score for "West Side Story" which premiered in 1957?', '1950s', 'hard', 'Richard Rodgers', 'Leonard Bernstein', 'Cole Porter', 'Irving Berlin', 'B', 'Associative Memory', 'Hippocampus', 'Connecting composers with their works'),

-- 1960s Hard Questions (6 questions)
('What was the name of the first American satellite launched in 1958?', '1960s', 'hard', 'Vanguard 1', 'Explorer 1', 'Pioneer 1', 'Telstar 1', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling space program details'),
('Who was the Secretary of Defense under Kennedy and Johnson?', '1960s', 'hard', 'Dean Rusk', 'Robert McNamara', 'Henry Kissinger', 'Melvin Laird', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering political appointments'),
('What was the name of the first James Bond film released in 1962?', '1960s', 'hard', 'Goldfinger', 'Dr. No', 'From Russia with Love', 'Thunderball', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling film franchises'),
('Who wrote "Silent Spring" in 1962, sparking the environmental movement?', '1960s', 'hard', 'Barry Commoner', 'Rachel Carson', 'Paul Ehrlich', 'Stewart Brand', 'B', 'Associative Memory', 'Hippocampus', 'Connecting authors with influential works'),
('What was the name of the Cuban leader who allied with the Soviet Union?', '1960s', 'hard', 'Che Guevara', 'Fidel Castro', 'Raul Castro', 'Batista', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering Cold War figures'),
('Who was the civil rights leader assassinated in Memphis in 1968?', '1960s', 'hard', 'Malcolm X', 'Martin Luther King Jr.', 'Medgar Evers', 'Fred Hampton', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling civil rights history'),

-- 1970s Hard Questions (6 questions)
('What was the name of the treaty that ended US involvement in Vietnam?', '1970s', 'hard', 'Geneva Accords', 'Paris Peace Accords', 'Camp David Accords', 'Helsinki Accords', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering diplomatic agreements'),
('Who was the FBI director who died in 1972 after 48 years in office?', '1970s', 'hard', 'William Sessions', 'J. Edgar Hoover', 'Clarence Kelley', 'William Webster', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling government officials'),
('What was the name of the nuclear accident at Three Mile Island?', '1970s', 'hard', 'Meltdown', 'Partial Core Meltdown', 'Explosion', 'Radiation Leak', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering technical details'),
('Who directed "The Godfather" released in 1972?', '1970s', 'hard', 'Martin Scorsese', 'Francis Ford Coppola', 'Steven Spielberg', 'Brian De Palma', 'B', 'Associative Memory', 'Hippocampus', 'Connecting directors with films'),
('What was the name of the hostage crisis location in 1979?', '1970s', 'hard', 'Lebanon', 'Iran', 'Libya', 'Syria', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling international crises'),
('Who was the first woman appointed to the Supreme Court (nominated 1981)?', '1970s', 'hard', 'Ruth Bader Ginsburg', 'Sandra Day O''Connor', 'Sonia Sotomayor', 'Elena Kagan', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering judicial appointments'),

-- 1980s Hard Questions (6 questions)
('What was the name of the economic policy known as "Reaganomics"?', '1980s', 'hard', 'Keynesian Economics', 'Supply-Side Economics', 'Monetarism', 'Laissez-faire', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling economic policies'),
('Who was the leader of Poland''s Solidarity movement?', '1980s', 'hard', 'Vaclav Havel', 'Lech Walesa', 'Mikhail Gorbachev', 'Pope John Paul II', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering political figures'),
('What was the name of the treaty that reduced nuclear weapons?', '1980s', 'hard', 'SALT II', 'INF Treaty', 'START', 'ABM Treaty', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling arms agreements'),
('Who was the Soviet leader who introduced Glasnost and Perestroika?', '1980s', 'hard', 'Leonid Brezhnev', 'Mikhail Gorbachev', 'Yuri Andropov', 'Konstantin Chernenko', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering world leaders'),
('What was the name of the stock market crash day in October 1987?', '1980s', 'hard', 'Black Tuesday', 'Black Monday', 'Black Thursday', 'Black Friday', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling financial events'),
('Who was the dictator of Panama removed by US forces in 1989?', '1980s', 'hard', 'Augusto Pinochet', 'Manuel Noriega', 'Jorge Videla', 'Alfredo Stroessner', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering military interventions'),

-- 1990s Hard Questions (6 questions)
('What was the name of the peace agreement signed in 1993 between Israel and PLO?', '1990s', 'hard', 'Camp David Accords', 'Oslo Accords', 'Madrid Conference', 'Wye River Memorandum', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling diplomatic agreements'),
('Who was the Unabomber arrested in 1996?', '1990s', 'hard', 'Eric Rudolph', 'Ted Kaczynski', 'Timothy McVeigh', 'Terry Nichols', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering criminal cases'),
('What was the name of the treaty that created the European Union?', '1990s', 'hard', 'Treaty of Rome', 'Maastricht Treaty', 'Lisbon Treaty', 'Amsterdam Treaty', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling international agreements'),
('Who was the President of South Africa released from prison in 1990?', '1990s', 'hard', 'Desmond Tutu', 'Nelson Mandela', 'F.W. de Klerk', 'Steve Biko', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering world leaders'),
('What was the name of the conflict in Rwanda in 1994?', '1990s', 'hard', 'Civil War', 'Genocide', 'Coup', 'Rebellion', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling humanitarian crises'),
('Who was the Independent Counsel who investigated President Clinton?', '1990s', 'hard', 'Robert Mueller', 'Kenneth Starr', 'Lawrence Walsh', 'Patrick Fitzgerald', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering political investigations');

-- Verify the data was inserted
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM memory_lane_trivia;
  RAISE NOTICE 'Total trivia questions loaded: %', v_count;
END $$;
