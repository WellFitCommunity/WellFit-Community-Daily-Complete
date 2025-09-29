// Apply community_moments migration directly
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const migrationSQL = `
-- Add missing caregiver contact columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS caregiver_first_name text,
ADD COLUMN IF NOT EXISTS caregiver_last_name text,
ADD COLUMN IF NOT EXISTS caregiver_phone text,
ADD COLUMN IF NOT EXISTS caregiver_relationship text;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_caregiver_first_name ON public.profiles (caregiver_first_name);
CREATE INDEX IF NOT EXISTS idx_profiles_caregiver_last_name ON public.profiles (caregiver_last_name);
CREATE INDEX IF NOT EXISTS idx_profiles_caregiver_phone ON public.profiles (caregiver_phone);
CREATE INDEX IF NOT EXISTS idx_profiles_caregiver_relationship ON public.profiles (caregiver_relationship);

-- Create community_moments table
CREATE TABLE IF NOT EXISTS public.community_moments (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  file_url text,
  file_path text,
  title text not null,
  description text not null,
  emoji text default '😊',
  tags text,
  is_gallery_high boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Create affirmations table for daily positive messages
CREATE TABLE IF NOT EXISTS public.affirmations (
  id bigserial primary key,
  text text not null,
  author text not null,
  created_at timestamptz default now() not null
);

-- Add some default affirmations
INSERT INTO public.affirmations (text, author) VALUES
('Every day is a new beginning. Take a deep breath, smile, and start again.', 'Unknown'),
('The best time to plant a tree was 20 years ago. The second best time is now.', 'Chinese Proverb'),
('Age is merely mind over matter. If you don''t mind, it doesn''t matter.', 'Mark Twain'),
('You are never too old to set another goal or to dream a new dream.', 'C.S. Lewis'),
('Life is what happens when you''re busy making other plans.', 'John Lennon'),
('The secret of getting ahead is getting started.', 'Mark Twain'),
('Believe you can and you''re halfway there.', 'Theodore Roosevelt'),
('It is during our darkest moments that we must focus to see the light.', 'Aristotle'),
('The only impossible journey is the one you never begin.', 'Tony Robbins'),
('In the middle of difficulty lies opportunity.', 'Albert Einstein')
ON CONFLICT DO NOTHING;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_community_moments_user_id ON public.community_moments (user_id);
CREATE INDEX IF NOT EXISTS idx_community_moments_created_at ON public.community_moments (created_at desc);
CREATE INDEX IF NOT EXISTS idx_community_moments_is_gallery_high ON public.community_moments (is_gallery_high) WHERE is_gallery_high = true;
CREATE INDEX IF NOT EXISTS idx_affirmations_id ON public.affirmations (id);

-- Add updated_at trigger for community_moments
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_community_moments_updated_at ON public.community_moments;
CREATE TRIGGER update_community_moments_updated_at
  BEFORE UPDATE ON public.community_moments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.community_moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affirmations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for community_moments
DROP POLICY IF EXISTS "community_moments_select_all" ON public.community_moments;
CREATE POLICY "community_moments_select_all"
ON public.community_moments
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "community_moments_insert_own" ON public.community_moments;
CREATE POLICY "community_moments_insert_own"
ON public.community_moments
FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "community_moments_update_own" ON public.community_moments;
CREATE POLICY "community_moments_update_own"
ON public.community_moments
FOR UPDATE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "community_moments_delete_own" ON public.community_moments;
CREATE POLICY "community_moments_delete_own"
ON public.community_moments
FOR DELETE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "community_moments_admin_all" ON public.community_moments;
CREATE POLICY "community_moments_admin_all"
ON public.community_moments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  )
);

-- RLS Policies for affirmations
DROP POLICY IF EXISTS "affirmations_select_all" ON public.affirmations;
CREATE POLICY "affirmations_select_all"
ON public.affirmations
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "affirmations_admin_only" ON public.affirmations;
CREATE POLICY "affirmations_admin_only"
ON public.affirmations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'super_admin')
  )
);
`;

async function applyMigration() {
  console.log('📦 Applying community features migration...\n');

  try {
    // Execute the migration SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // Try alternative approach using REST API
      console.log('Trying alternative approach...');

      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ sql: migrationSQL })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      console.log('✅ Migration applied successfully via REST API!');
    } else {
      console.log('✅ Migration applied successfully!');
    }

    // Verify tables exist
    console.log('\n🔍 Verifying tables...');

    const { error: momentsError } = await supabase
      .from('community_moments')
      .select('count', { count: 'exact', head: true });

    const { error: affirmError } = await supabase
      .from('affirmations')
      .select('count', { count: 'exact', head: true });

    if (momentsError || affirmError) {
      console.error('❌ Verification failed. Tables may not be accessible yet.');
      console.error('   You may need to apply the migration manually via Supabase dashboard.');
    } else {
      console.log('✅ Tables verified and accessible!');
    }

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.log('\n💡 Manual steps:');
    console.log('1. Go to Supabase Dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Run the migration file: supabase/migrations/20250923150000_add_missing_community_features.sql');
  }
}

applyMigration();