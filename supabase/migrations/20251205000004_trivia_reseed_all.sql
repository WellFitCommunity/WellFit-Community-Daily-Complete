-- ============================================================================
-- Memory Lane Trivia - Re-Seed All Questions
-- ============================================================================
-- This migration re-applies the trivia question seed data because the original
-- seed migrations ran BEFORE the table was created. This consolidates all seed data.
-- Includes cognitive_function and brain_region for cognitive health tracking.
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
('What disco song told you to do the hustle?', '1970s', 'easy', 'Stayin Alive', 'The Hustle', 'Disco Inferno', 'Le Freak', 'B', 'Procedural Memory', 'Basal Ganglia', 'Remembering popular songs and their titles'),
('What type of pants with wide legs were popular in the 1970s?', '1970s', 'easy', 'Skinny Jeans', 'Bell Bottoms', 'Cargo Pants', 'Straight Leg', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling fashion trends'),
('What skateboard-like toy became popular in the 1970s?', '1970s', 'easy', 'Hoverboard', 'Pet Rock', 'Mood Ring', 'Roller Skates', 'D', 'Episodic Memory', 'Hippocampus', 'Remembering toy and recreation trends'),
('What popular video game featured a yellow character eating dots?', '1970s', 'easy', 'Space Invaders', 'Pac-Man', 'Donkey Kong', 'Asteroids', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling iconic video game characters'),
('What TV show featured the Fonz?', '1970s', 'easy', 'Laverne & Shirley', 'Happy Days', 'Mork & Mindy', 'Three Company', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering TV shows and popular characters'),
('What type of shoe had very high platform soles?', '1970s', 'easy', 'Flip Flops', 'Platform Shoes', 'Crocs', 'Sneakers', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling distinctive footwear styles'),
('What band sang Stayin Alive?', '1970s', 'easy', 'ABBA', 'The Bee Gees', 'Donna Summer', 'The Village People', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering musical artists and their songs'),
('What type of collar was popular on mens shirts in the 1970s?', '1970s', 'easy', 'Mandarin Collar', 'Wide Pointed Collar', 'Button-Down Collar', 'Turtleneck', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling fashion details'),
('What was the popular dance floor style of the 1970s?', '1970s', 'easy', 'Line Dancing', 'Disco Dancing', 'Breakdancing', 'Square Dancing', 'B', 'Procedural Memory', 'Basal Ganglia', 'Remembering dance styles'),
('What movie featured John Travolta dancing in a white suit?', '1970s', 'easy', 'Grease', 'Saturday Night Fever', 'Dirty Dancing', 'Footloose', 'B', 'Episodic Memory', 'Hippocampus', 'Recalling iconic movie scenes'),
('What handheld electronic game featured a ship shooting aliens?', '1970s', 'easy', 'Tetris', 'Space Invaders', 'Pac-Man', 'Game Boy', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering early electronic games'),
('What type of jewelry changed color with body heat?', '1970s', 'easy', 'Charm Bracelet', 'Mood Ring', 'Friendship Bracelet', 'Locket', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling novelty jewelry'),
('What exercise craze involved jogging for health?', '1970s', 'easy', 'Crossfit', 'Jogging Boom', 'Pilates', 'Zumba', 'B', 'Episodic Memory', 'Hippocampus', 'Remembering fitness trends'),
('What food item became popular at parties on a fondue pot?', '1970s', 'easy', 'Pizza', 'Cheese Fondue', 'Sushi', 'Tacos', 'B', 'Episodic Memory', 'Hippocampus', 'Recalling social food trends'),

-- 1980s Easy Questions (14 questions)
('What toy could you train to speak?', '1980s', 'easy', 'Teddy Ruxpin', 'Cabbage Patch Kid', 'Care Bear', 'My Little Pony', 'A', 'Semantic Memory', 'Temporal Lobe', 'Remembering innovative toys'),
('What colorful bears each had a special symbol on their tummy?', '1980s', 'easy', 'Gummy Bears', 'Care Bears', 'Teddy Ruxpin', 'Pound Puppies', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling toy characters and their features'),
('What TV show featured a talking car named KITT?', '1980s', 'easy', 'The A-Team', 'Knight Rider', 'Magnum P.I.', 'Miami Vice', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering TV shows with unique elements'),
('What hairstyle involved lots of hairspray and volume?', '1980s', 'easy', 'The Rachel', 'Big Hair', 'The Pixie', 'The Bob', 'B', 'Visual Memory', 'Occipital Lobe', 'Recalling distinctive styling trends'),
('What music channel launched in 1981 showing music videos?', '1980s', 'easy', 'VH1', 'MTV', 'BET', 'CMT', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering media innovations'),
('What exercise trend featured aerobics with leg warmers?', '1980s', 'easy', 'Yoga', 'Jazzercise', 'Crossfit', 'Pilates', 'B', 'Procedural Memory', 'Basal Ganglia', 'Recalling fitness fashion and trends'),
('What handheld game featured falling blocks?', '1980s', 'easy', 'Pac-Man', 'Tetris', 'Space Invaders', 'Donkey Kong', 'B', 'Spatial Memory', 'Parietal Lobe', 'Remembering puzzle games'),
('What dolls came with adoption papers?', '1980s', 'easy', 'Barbie', 'Cabbage Patch Kids', 'American Girl', 'Strawberry Shortcake', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling toy marketing features'),
('What type of jacket was popular with teens in the 1980s?', '1980s', 'easy', 'Denim Jacket', 'Members Only Jacket', 'Peacoat', 'Blazer', 'B', 'Visual Memory', 'Occipital Lobe', 'Remembering brand-specific fashion'),
('What movie featured a boy befriending an alien?', '1980s', 'easy', 'Star Wars', 'E.T. the Extra-Terrestrial', 'Close Encounters', 'Alien', 'B', 'Episodic Memory', 'Hippocampus', 'Recalling iconic movie plots'),
('What bright-colored plastic shoes became a beach staple?', '1980s', 'easy', 'Flip Flops', 'Jelly Shoes', 'Crocs', 'Sandals', 'B', 'Visual Memory', 'Occipital Lobe', 'Remembering footwear trends'),
('What toy line featured robots that transformed into vehicles?', '1980s', 'easy', 'G.I. Joe', 'Transformers', 'He-Man', 'ThunderCats', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling toy concepts'),
('What arcade game featured a plumber rescuing a princess?', '1980s', 'easy', 'Pac-Man', 'Donkey Kong', 'Space Invaders', 'Galaga', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering video game characters'),
('What slap-on wristband was popular with kids?', '1980s', 'easy', 'Friendship Bracelet', 'Slap Bracelet', 'Charm Bracelet', 'Rubber Band', 'B', 'Episodic Memory', 'Hippocampus', 'Recalling novelty accessories'),

-- 1990s Easy Questions (14 questions)
('What virtual pet needed constant care?', '1990s', 'easy', 'Furby', 'Tamagotchi', 'Giga Pet', 'Nano Pet', 'B', 'Procedural Memory', 'Basal Ganglia', 'Remembering digital pet toys'),
('What TV show featured six friends at a coffee shop?', '1990s', 'easy', 'Seinfeld', 'Friends', 'Frasier', 'Cheers', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling sitcom settings'),
('What furry robot toy could learn words?', '1990s', 'easy', 'Teddy Ruxpin', 'Furby', 'Tickle Me Elmo', 'Hatchimals', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering interactive toys'),
('What cartoon featured characters from Nickelodeon in a playground?', '1990s', 'easy', 'Hey Arnold', 'Rugrats', 'Doug', 'Recess', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling cartoon settings'),
('What movie featured dinosaurs in a theme park?', '1990s', 'easy', 'The Lost World', 'Jurassic Park', 'Godzilla', 'King Kong', 'B', 'Episodic Memory', 'Hippocampus', 'Remembering blockbuster movies'),
('What handheld game device was made by Nintendo?', '1990s', 'easy', 'PlayStation', 'Game Boy', 'Sega Genesis', 'Xbox', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling gaming devices'),
('What dance song asked everyone to slide to the left?', '1990s', 'easy', 'Macarena', 'Cha Cha Slide', 'Electric Slide', 'Cotton Eye Joe', 'B', 'Procedural Memory', 'Basal Ganglia', 'Remembering line dance songs'),
('What TV show featured a Fresh Prince moving to Bel-Air?', '1990s', 'easy', 'Martin', 'Fresh Prince of Bel-Air', 'Family Matters', 'Living Single', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling sitcom premises'),
('What boy band wanted it that way?', '1990s', 'easy', 'NSYNC', 'Backstreet Boys', '98 Degrees', 'New Kids on the Block', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering pop groups'),
('What animated movie featured a lion cub named Simba?', '1990s', 'easy', 'Aladdin', 'The Lion King', 'Beauty and the Beast', 'Pocahontas', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling Disney movies'),
('What colorful stuffed animals became a collecting craze?', '1990s', 'easy', 'Cabbage Patch Kids', 'Beanie Babies', 'Build-A-Bear', 'Webkinz', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering collectible toys'),
('What shoe brand featured a pump for a custom fit?', '1990s', 'easy', 'Nike', 'Reebok Pump', 'Adidas', 'Converse', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling sneaker innovations'),
('What talk show host gave away cars?', '1990s', 'easy', 'Jerry Springer', 'Oprah Winfrey', 'Sally Jesse Raphael', 'Montel Williams', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering media personalities'),
('What dance craze had everyone doing the Macarena?', '1990s', 'easy', 'Electric Slide', 'The Macarena', 'Cotton Eye Joe', 'Cha Cha Slide', 'B', 'Procedural Memory', 'Basal Ganglia', 'Recalling dance crazes');

-- ============================================================================
-- MEDIUM QUESTIONS (50 questions)
-- ============================================================================

INSERT INTO memory_lane_trivia (question, era, difficulty, option_a, option_b, option_c, option_d, correct_answer, cognitive_function, brain_region, explanation) VALUES

-- 1950s Medium Questions (10 questions)
('What was the name of the first successful polio vaccine developer?', '1950s', 'medium', 'Albert Sabin', 'Jonas Salk', 'Alexander Fleming', 'Louis Pasteur', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling medical breakthroughs'),
('What year did Disneyland open in California?', '1950s', 'medium', '1953', '1955', '1957', '1959', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering cultural landmark dates'),
('What was the name of the first American satellite launched into space?', '1950s', 'medium', 'Apollo', 'Explorer 1', 'Pioneer', 'Mercury', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling space race milestones'),
('What comedian was known for saying A funny thing happened on the way to the forum?', '1950s', 'medium', 'Jack Benny', 'Milton Berle', 'Bob Hope', 'Jackie Gleason', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering comedians and their catchphrases'),
('What was the name of the treaty organization formed in 1949?', '1950s', 'medium', 'United Nations', 'NATO', 'Warsaw Pact', 'SEATO', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling political alliances'),
('What actress married Joe DiMaggio in 1954?', '1950s', 'medium', 'Elizabeth Taylor', 'Marilyn Monroe', 'Audrey Hepburn', 'Grace Kelly', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering celebrity marriages'),
('What was the first credit card widely accepted by merchants?', '1950s', 'medium', 'Visa', 'Diners Club', 'American Express', 'MasterCard', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling financial innovations'),
('What quiz show scandal rocked television in the late 1950s?', '1950s', 'medium', 'Jeopardy', 'Twenty-One', 'The Price is Right', 'Wheel of Fortune', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering TV controversies'),
('What was the name of the doo-wop group that sang Earth Angel?', '1950s', 'medium', 'The Platters', 'The Penguins', 'The Drifters', 'The Coasters', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling musical groups'),
('What highway system was authorized under Eisenhower?', '1950s', 'medium', 'Route 66', 'Interstate Highway', 'Pacific Highway', 'Atlantic Route', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering infrastructure developments'),

-- 1960s Medium Questions (10 questions)
('What was the name of the first American to orbit Earth?', '1960s', 'medium', 'Alan Shepard', 'John Glenn', 'Neil Armstrong', 'Buzz Aldrin', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling space exploration firsts'),
('What British model became the face of the 1960s mod look?', '1960s', 'medium', 'Jean Shrimpton', 'Twiggy', 'Veruschka', 'Penelope Tree', 'B', 'Visual Memory', 'Occipital Lobe', 'Remembering fashion icons'),
('What TV series featured the phrase Live long and prosper?', '1960s', 'medium', 'Lost in Space', 'Star Trek', 'The Twilight Zone', 'The Outer Limits', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling TV catchphrases'),
('What civil rights leader gave the I Have a Dream speech?', '1960s', 'medium', 'Malcolm X', 'Martin Luther King Jr.', 'Jesse Jackson', 'John Lewis', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering civil rights milestones'),
('What band performed at Shea Stadium in 1965?', '1960s', 'medium', 'The Rolling Stones', 'The Beatles', 'The Who', 'The Beach Boys', 'B', 'Episodic Memory', 'Hippocampus', 'Recalling concert history'),
('What TV show featured a genie in a bottle?', '1960s', 'medium', 'Bewitched', 'I Dream of Jeannie', 'The Flying Nun', 'My Favorite Martian', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering fantasy sitcoms'),
('What company introduced the first handheld calculator?', '1960s', 'medium', 'IBM', 'Texas Instruments', 'Hewlett-Packard', 'Sharp', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling technological innovations'),
('What puppet show taught children letters and numbers?', '1960s', 'medium', 'Mister Rogers', 'Sesame Street', 'Electric Company', 'Zoom', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering educational TV'),
('What car company introduced the Mustang in 1964?', '1960s', 'medium', 'Chevrolet', 'Ford', 'Dodge', 'Plymouth', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling automotive history'),
('What protest song asked Where have all the flowers gone?', '1960s', 'medium', 'Bob Dylan', 'Pete Seeger', 'Joan Baez', 'Peter Paul and Mary', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering protest music'),

-- 1970s Medium Questions (10 questions)
('What scandal forced President Nixon to resign?', '1970s', 'medium', 'Iran-Contra', 'Watergate', 'Teapot Dome', 'Whitewater', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling political scandals'),
('What movie shark terrorized beachgoers?', '1970s', 'medium', 'The Deep', 'Jaws', 'Orca', 'Piranha', 'B', 'Episodic Memory', 'Hippocampus', 'Remembering blockbuster movies'),
('What punk rock band featured Johnny Rotten?', '1970s', 'medium', 'The Clash', 'Sex Pistols', 'The Ramones', 'The Damned', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling music history'),
('What space mission had the famous line Houston we have a problem?', '1970s', 'medium', 'Apollo 11', 'Apollo 13', 'Skylab', 'Gemini', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering space exploration'),
('What game show featured contestants spinning a big wheel?', '1970s', 'medium', 'Jeopardy', 'Wheel of Fortune', 'The Price is Right', 'Family Feud', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling game show features'),
('What terrorist group took hostages at the 1972 Olympics?', '1970s', 'medium', 'IRA', 'Black September', 'Red Brigade', 'Baader-Meinhof', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering tragic events'),
('What sitcom featured Archie Bunker?', '1970s', 'medium', 'Good Times', 'All in the Family', 'The Jeffersons', 'Sanford and Son', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling TV characters'),
('What Swedish pop group won Eurovision in 1974?', '1970s', 'medium', 'The Carpenters', 'ABBA', 'Fleetwood Mac', 'The Bee Gees', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering music competitions'),
('What crisis caused long gas station lines in 1973?', '1970s', 'medium', 'Gulf War', 'Oil Embargo', 'Iranian Revolution', 'Suez Crisis', 'B', 'Episodic Memory', 'Hippocampus', 'Recalling economic events'),
('What boxing match was called The Rumble in the Jungle?', '1970s', 'medium', 'Tyson vs Holyfield', 'Ali vs Foreman', 'Leonard vs Duran', 'Frazier vs Ali', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering sports history'),

-- 1980s Medium Questions (10 questions)
('What was the name of the Space Shuttle that exploded in 1986?', '1980s', 'medium', 'Columbia', 'Challenger', 'Discovery', 'Atlantis', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling tragic events'),
('What video game company created the Nintendo Entertainment System?', '1980s', 'medium', 'Sega', 'Nintendo', 'Atari', 'Sony', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering gaming history'),
('What British princess married Prince Charles in 1981?', '1980s', 'medium', 'Sarah Ferguson', 'Diana Spencer', 'Camilla Parker', 'Sophie Rhys-Jones', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling royal weddings'),
('What TV show featured J.R. Ewing?', '1980s', 'medium', 'Dynasty', 'Dallas', 'Falcon Crest', 'Knots Landing', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering TV characters'),
('What band sang Sweet Child O Mine?', '1980s', 'medium', 'Bon Jovi', 'Guns N Roses', 'Def Leppard', 'Motley Crue', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling rock bands'),
('What wall came down in 1989?', '1980s', 'medium', 'Great Wall', 'Berlin Wall', 'Hadrians Wall', 'Western Wall', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering historical events'),
('What movie featured a DeLorean time machine?', '1980s', 'medium', 'The Terminator', 'Back to the Future', 'Blade Runner', 'Total Recall', 'B', 'Episodic Memory', 'Hippocampus', 'Recalling movie plots'),
('What disease was first identified in 1981?', '1980s', 'medium', 'Ebola', 'AIDS', 'SARS', 'Mad Cow', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering medical history'),
('What British singer had a hit with Careless Whisper?', '1980s', 'medium', 'Boy George', 'George Michael', 'Phil Collins', 'Sting', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling music artists'),
('What fast food restaurant introduced Chicken McNuggets?', '1980s', 'medium', 'Burger King', 'McDonalds', 'Wendys', 'KFC', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering food innovations'),

-- 1990s Medium Questions (10 questions)
('What trial captivated America in 1995?', '1990s', 'medium', 'Rodney King', 'O.J. Simpson', 'McVeigh', 'Menendez Brothers', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling major trials'),
('What grunge band was fronted by Kurt Cobain?', '1990s', 'medium', 'Pearl Jam', 'Nirvana', 'Soundgarden', 'Alice in Chains', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering music history'),
('What popular website was founded by Jeff Bezos?', '1990s', 'medium', 'eBay', 'Amazon', 'Yahoo', 'Google', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling tech history'),
('What British boy band featured Robbie Williams?', '1990s', 'medium', 'Westlife', 'Take That', 'Boyzone', '5ive', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering pop groups'),
('What video game featured a hedgehog named Sonic?', '1990s', 'medium', 'Nintendo', 'Sega', 'PlayStation', 'Atari', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling video game characters'),
('What TV show featured FBI agents investigating aliens?', '1990s', 'medium', 'Twin Peaks', 'The X-Files', 'Millennium', 'Dark Skies', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering TV premises'),
('What princess died in a Paris car crash in 1997?', '1990s', 'medium', 'Princess Grace', 'Princess Diana', 'Princess Caroline', 'Princess Anne', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling tragic events'),
('What browser was the first widely used internet browser?', '1990s', 'medium', 'Internet Explorer', 'Netscape Navigator', 'Firefox', 'Chrome', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering internet history'),
('What girl group told you what they really really wanted?', '1990s', 'medium', 'TLC', 'Spice Girls', 'Destiny Child', 'En Vogue', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling pop groups'),
('What building was bombed in Oklahoma City in 1995?', '1990s', 'medium', 'World Trade Center', 'Murrah Federal Building', 'Pentagon', 'Capitol Building', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering tragic events');

-- ============================================================================
-- HARD QUESTIONS (30 questions)
-- ============================================================================

INSERT INTO memory_lane_trivia (question, era, difficulty, option_a, option_b, option_c, option_d, correct_answer, cognitive_function, brain_region, explanation) VALUES

-- 1950s Hard Questions (6 questions)
('What was the name of the dog that was the first animal to orbit Earth?', '1950s', 'hard', 'Strelka', 'Laika', 'Belka', 'Mushka', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling specific space history details'),
('What artist painted Number 1A in the abstract expressionist style?', '1950s', 'hard', 'Willem de Kooning', 'Jackson Pollock', 'Mark Rothko', 'Franz Kline', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering art history'),
('What was the official name of the hydrogen bomb test at Bikini Atoll in 1954?', '1950s', 'hard', 'Ivy Mike', 'Castle Bravo', 'Trinity', 'Fat Man', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling nuclear history'),
('What philosopher wrote The Second Sex published in 1949?', '1950s', 'hard', 'Hannah Arendt', 'Simone de Beauvoir', 'Jean-Paul Sartre', 'Albert Camus', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering intellectual history'),
('What was the first commercial jet airliner to enter service?', '1950s', 'hard', 'Boeing 707', 'de Havilland Comet', 'Douglas DC-8', 'Convair 880', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling aviation history'),
('What beat poet wrote Howl in 1956?', '1950s', 'hard', 'Jack Kerouac', 'Allen Ginsberg', 'William Burroughs', 'Lawrence Ferlinghetti', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering literary history'),

-- 1960s Hard Questions (6 questions)
('What was the name of the ship that carried the first Beatles to America?', '1960s', 'hard', 'Queen Mary', 'SS France', 'SS United States', 'RMS Queen Elizabeth', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling music history details'),
('What architect designed the TWA Flight Center at JFK Airport?', '1960s', 'hard', 'Frank Lloyd Wright', 'Eero Saarinen', 'I.M. Pei', 'Philip Johnson', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering architectural history'),
('What was the code name for the Bay of Pigs invasion?', '1960s', 'hard', 'Operation Mongoose', 'Operation Zapata', 'Operation Northwoods', 'Operation PBSUCCESS', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling Cold War operations'),
('What novel by Ken Kesey was published in 1962?', '1960s', 'hard', 'Catch-22', 'One Flew Over the Cuckoos Nest', 'Slaughterhouse-Five', 'A Clockwork Orange', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering literary history'),
('What spacecraft was used for the Gemini program?', '1960s', 'hard', 'Mercury', 'Gemini capsule', 'Apollo', 'Skylab', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling space program details'),
('What photographer captured the famous image of the Vietnam execution?', '1960s', 'hard', 'Robert Capa', 'Eddie Adams', 'Nick Ut', 'Larry Burrows', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering photojournalism history'),

-- 1970s Hard Questions (6 questions)
('What was the name of the computer company Steve Jobs and Steve Wozniak founded?', '1970s', 'hard', 'Microsoft', 'Apple', 'Commodore', 'Atari', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling tech history'),
('What novel by Alex Haley traced his family history?', '1970s', 'hard', 'The Color Purple', 'Roots', 'Beloved', 'Native Son', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering literary works'),
('What treaty limited strategic nuclear weapons between the US and USSR?', '1970s', 'hard', 'START', 'SALT', 'INF', 'ABM', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling arms control history'),
('What director made Mean Streets before making Taxi Driver?', '1970s', 'hard', 'Francis Ford Coppola', 'Martin Scorsese', 'Brian De Palma', 'William Friedkin', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering film history'),
('What was the name of the last American to walk on the moon?', '1970s', 'hard', 'Buzz Aldrin', 'Eugene Cernan', 'Alan Shepard', 'John Young', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling space exploration details'),
('What punk venue in New York launched many careers?', '1970s', 'hard', 'The Fillmore', 'CBGB', 'Max Kansas City', 'The Mudd Club', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering music venue history'),

-- 1980s Hard Questions (6 questions)
('What was the name of the Soviet leader who introduced glasnost?', '1980s', 'hard', 'Andropov', 'Gorbachev', 'Chernenko', 'Brezhnev', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling political history'),
('What band recorded The Joshua Tree album?', '1980s', 'hard', 'R.E.M.', 'U2', 'The Smiths', 'Depeche Mode', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering album history'),
('What was the name of the nuclear reactor that exploded in 1986?', '1980s', 'hard', 'Three Mile Island', 'Chernobyl', 'Fukushima', 'Sellafield', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling nuclear disasters'),
('What director made Blue Velvet and Twin Peaks?', '1980s', 'hard', 'Tim Burton', 'David Lynch', 'John Waters', 'Wes Craven', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering film history'),
('What computer introduced the graphical user interface to consumers?', '1980s', 'hard', 'IBM PC', 'Apple Macintosh', 'Commodore 64', 'Atari ST', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling computer history'),
('What Act deregulated the savings and loan industry?', '1980s', 'hard', 'Glass-Steagall', 'Garn-St. Germain', 'Gramm-Leach', 'Dodd-Frank', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering economic policy'),

-- 1990s Hard Questions (6 questions)
('What protocol created the World Wide Web?', '1990s', 'hard', 'FTP', 'HTTP', 'TCP/IP', 'SMTP', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling internet history'),
('What novel by Cormac McCarthy was set on the border?', '1990s', 'hard', 'Blood Meridian', 'All the Pretty Horses', 'The Road', 'No Country for Old Men', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering literary works'),
('What treaty created the European Union?', '1990s', 'hard', 'Treaty of Rome', 'Maastricht Treaty', 'Treaty of Lisbon', 'Single European Act', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling political history'),
('What director made Reservoir Dogs before Pulp Fiction?', '1990s', 'hard', 'Robert Rodriguez', 'Quentin Tarantino', 'Kevin Smith', 'Richard Linklater', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering film history'),
('What was the name of the Mars rover that landed in 1997?', '1990s', 'hard', 'Spirit', 'Sojourner', 'Opportunity', 'Curiosity', 'B', 'Semantic Memory', 'Temporal Lobe', 'Recalling space exploration'),
('What genomics company was founded to map the human genome?', '1990s', 'hard', 'Genentech', 'Celera Genomics', '23andMe', 'Illumina', 'B', 'Semantic Memory', 'Temporal Lobe', 'Remembering scientific milestones');
