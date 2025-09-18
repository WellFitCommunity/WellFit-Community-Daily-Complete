-- Create meals table
CREATE TABLE IF NOT EXISTS public.meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Using UUID for consistency
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  ingredients TEXT[], -- Array of ingredients
  steps TEXT[], -- Array of preparation steps
  calories INTEGER,
  protein_grams INTEGER,
  fat_grams INTEGER,
  carb_grams INTEGER,
  cost_estimate NUMERIC(10, 2), -- e.g., 12.50
  prep_time_minutes INTEGER, -- Preparation time in minutes
  cook_time_minutes INTEGER, -- Cooking time in minutes
  servings INTEGER,
  tags TEXT[], -- e.g., ["breakfast", "low-carb", "quick"]
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Optional: if meals can be user-submitted
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.meals IS 'Stores information about meals and recipes.';
COMMENT ON COLUMN public.meals.name IS 'Name of the meal/recipe.';
COMMENT ON COLUMN public.meals.ingredients IS 'List of ingredients.';
COMMENT ON COLUMN public.meals.steps IS 'Preparation/cooking steps.';
COMMENT ON COLUMN public.meals.tags IS 'Keywords for searching and categorizing meals.';
COMMENT ON COLUMN public.meals.author_id IS 'ID of the user who submitted or created this meal entry, if applicable.';

-- Trigger to automatically update 'updated_at' timestamp
-- (Reusing the function created in admin_notes migration, or create if it doesn't exist globally)
-- Ensure public.trigger_set_timestamp() exists from a previous migration (e.g., admin_notes)
-- If not, uncomment and include its definition here:
/*
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
*/

CREATE TRIGGER set_meals_updated_at
BEFORE UPDATE ON public.meals
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meals_name ON public.meals USING GIN (to_tsvector('english', name)); -- For full-text search on name
CREATE INDEX IF NOT EXISTS idx_meals_tags ON public.meals USING GIN (tags); -- For searching by tags
CREATE INDEX IF NOT EXISTS idx_meals_author_id ON public.meals(author_id);
