-- Add user_questions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  question_text TEXT NOT NULL,
  category TEXT DEFAULT 'general' CHECK (category IN ('general', 'health', 'technical', 'account')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'closed')),
  response_text TEXT,
  responded_by UUID REFERENCES auth.users(id),
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE public.user_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own questions" ON public.user_questions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own questions" ON public.user_questions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all questions" ON public.user_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.user_id = auth.uid() 
      AND r.name IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update questions" ON public.user_questions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON p.role_id = r.id
      WHERE p.user_id = auth.uid() 
      AND r.name IN ('admin', 'super_admin')
    )
  );

-- Add rate limiting tables if they don't exist
CREATE TABLE IF NOT EXISTS public.rate_limit_registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rate_limit_logins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_questions_user_id ON public.user_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_questions_status ON public.user_questions(status);
CREATE INDEX IF NOT EXISTS idx_user_questions_created_at ON public.user_questions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_registrations_ip_time ON public.rate_limit_registrations(ip_address, attempted_at);
CREATE INDEX IF NOT EXISTS idx_rate_limit_logins_ip_time ON public.rate_limit_logins(ip_address, attempted_at);

-- Update profiles table to ensure correct schema
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarded BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS consent BOOLEAN DEFAULT FALSE;

-- Ensure profiles has proper constraints
ALTER TABLE public.profiles 
ADD CONSTRAINT IF NOT EXISTS profiles_user_id_unique UNIQUE (user_id);