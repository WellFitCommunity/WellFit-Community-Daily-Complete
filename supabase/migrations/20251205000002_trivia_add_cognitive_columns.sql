-- Add cognitive function and brain region columns to memory_lane_trivia
-- These columns are important for the cognitive health tracking features

-- Add the columns if they don't exist
ALTER TABLE memory_lane_trivia
ADD COLUMN IF NOT EXISTS cognitive_function VARCHAR(50),
ADD COLUMN IF NOT EXISTS brain_region VARCHAR(50);

-- Update existing records to have default values if null
UPDATE memory_lane_trivia
SET cognitive_function = 'General Memory', brain_region = 'Multiple Regions'
WHERE cognitive_function IS NULL;
