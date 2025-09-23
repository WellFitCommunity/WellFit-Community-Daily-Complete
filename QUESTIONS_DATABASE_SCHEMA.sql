-- Database Schema for AI-Powered Nurse Questions System
-- Add this to your Supabase migrations

-- 1. User Questions Table
CREATE TABLE IF NOT EXISTS public.user_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('general', 'health', 'medication', 'emergency', 'technical')),
    urgency TEXT NOT NULL DEFAULT 'low' CHECK (urgency IN ('low', 'medium', 'high')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'closed')),

    -- AI Analysis
    ai_urgency_score DECIMAL(3,2), -- AI confidence in urgency (0.00-1.00)
    ai_category_suggestions TEXT[], -- AI suggested categories
    ai_keywords TEXT[], -- Extracted keywords for matching

    -- Response Data
    response_text TEXT,
    nurse_notes TEXT, -- Internal notes not shown to patient
    ai_suggestions JSONB, -- AI response suggestions for nurse
    responded_by UUID REFERENCES auth.users(id),
    responded_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.user_questions ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Users can see their own questions
CREATE POLICY "users_can_view_own_questions" ON public.user_questions
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own questions
CREATE POLICY "users_can_insert_own_questions" ON public.user_questions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins/nurses can see all questions (for admin panel)
CREATE POLICY "admins_can_view_all_questions" ON public.user_questions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- Admins/nurses can update all questions (for responses)
CREATE POLICY "admins_can_update_all_questions" ON public.user_questions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- 4. Indexes for performance
CREATE INDEX idx_user_questions_user_id ON public.user_questions(user_id);
CREATE INDEX idx_user_questions_status ON public.user_questions(status);
CREATE INDEX idx_user_questions_urgency ON public.user_questions(urgency);
CREATE INDEX idx_user_questions_category ON public.user_questions(category);
CREATE INDEX idx_user_questions_created_at ON public.user_questions(created_at DESC);

-- 5. Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_questions_updated_at
    BEFORE UPDATE ON public.user_questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Question Analytics Table (optional)
CREATE TABLE IF NOT EXISTS public.question_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES public.user_questions(id) ON DELETE CASCADE,

    -- Response metrics
    response_time_minutes INTEGER, -- How long to respond
    patient_satisfaction_score INTEGER CHECK (patient_satisfaction_score BETWEEN 1 AND 5),
    ai_suggestion_used BOOLEAN DEFAULT false,
    ai_suggestion_helpful BOOLEAN,

    -- Pattern tracking
    common_keywords TEXT[],
    category_accuracy DECIMAL(3,2), -- How accurate was auto-categorization
    urgency_accuracy DECIMAL(3,2), -- How accurate was urgency detection

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on analytics
ALTER TABLE public.question_analytics ENABLE ROW LEVEL SECURITY;

-- Only admins can view analytics
CREATE POLICY "admins_can_view_analytics" ON public.question_analytics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- 7. AI Training Data Table (for improving responses)
CREATE TABLE IF NOT EXISTS public.question_ai_training (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_pattern TEXT NOT NULL,
    category TEXT NOT NULL,
    urgency TEXT NOT NULL,
    suggested_response TEXT,
    nurse_approved BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    success_rate DECIMAL(3,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for AI training data
ALTER TABLE public.question_ai_training ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_can_manage_ai_training" ON public.question_ai_training
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- 8. Common Questions Template Table
CREATE TABLE IF NOT EXISTS public.question_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_text TEXT NOT NULL,
    category TEXT NOT NULL,
    keywords TEXT[],
    suggested_response TEXT,
    usage_count INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for templates
ALTER TABLE public.question_templates ENABLE ROW LEVEL SECURITY;

-- Everyone can view active templates (for suggestions)
CREATE POLICY "users_can_view_active_templates" ON public.question_templates
    FOR SELECT USING (active = true);

-- Only admins can manage templates
CREATE POLICY "admins_can_manage_templates" ON public.question_templates
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- 9. Insert some default question templates
INSERT INTO public.question_templates (template_text, category, keywords, suggested_response) VALUES
('I missed my medication this morning. What should I do?', 'medication', ARRAY['missed', 'medication', 'morning'], 'Take your medication as soon as you remember, unless it''s almost time for your next dose. If you''re unsure, contact your pharmacy or healthcare provider.'),
('I''m feeling dizzy when I stand up', 'health', ARRAY['dizzy', 'stand', 'lightheaded'], 'Dizziness when standing can be caused by blood pressure changes. Sit down, drink water, and contact your healthcare team if it continues.'),
('I''m having trouble sleeping', 'health', ARRAY['sleep', 'insomnia', 'tired'], 'Sleep problems are common. Try maintaining a regular bedtime routine, avoiding caffeine late in the day, and speak with your healthcare provider if it persists.'),
('My blood pressure seems high today', 'health', ARRAY['blood pressure', 'high', 'hypertension'], 'If your blood pressure is significantly elevated, contact your healthcare provider. Take your medications as prescribed and monitor regularly.'),
('I can''t remember if I took my pills', 'medication', ARRAY['forgot', 'pills', 'remember'], 'Don''t take a double dose. If it''s close to your next scheduled dose, skip the missed one. Consider using a pill organizer to help track your medications.'),
('I need help understanding my test results', 'general', ARRAY['test results', 'lab', 'confused'], 'I''d be happy to help explain your test results. Your healthcare provider can provide detailed explanations and answer any specific questions you have.');