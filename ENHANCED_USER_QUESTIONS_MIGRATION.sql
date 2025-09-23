-- Enhanced user_questions table for medical/nurse questions
-- This builds on your existing user_questions table

-- Add medical-specific columns to existing user_questions table
ALTER TABLE public.user_questions
ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'low' CHECK (urgency IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS ai_suggestions JSONB,
ADD COLUMN IF NOT EXISTS ai_urgency_score DECIMAL(3,2), -- AI confidence 0.00-1.00
ADD COLUMN IF NOT EXISTS nurse_notes TEXT, -- Internal notes not shown to patient
ADD COLUMN IF NOT EXISTS patient_context JSONB; -- Store patient conditions, medications

-- Update category constraint to include medical categories
ALTER TABLE public.user_questions
DROP CONSTRAINT IF EXISTS user_questions_category_check;

ALTER TABLE public.user_questions
ADD CONSTRAINT user_questions_category_check
CHECK (category IN ('general', 'health', 'medication', 'emergency', 'technical'));

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_user_questions_urgency ON public.user_questions(urgency);
CREATE INDEX IF NOT EXISTS idx_user_questions_category ON public.user_questions(category);

-- Add updated_at trigger if it doesn't exist
CREATE OR REPLACE FUNCTION update_user_questions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_questions_updated_at_trigger ON public.user_questions;
CREATE TRIGGER update_user_questions_updated_at_trigger
    BEFORE UPDATE ON public.user_questions
    FOR EACH ROW EXECUTE FUNCTION update_user_questions_updated_at();

-- Insert some medical question templates
INSERT INTO public.question_templates (template_text, category, keywords, suggested_response) VALUES
('I missed my medication this morning. What should I do?', 'medication', ARRAY['missed', 'medication', 'morning'], 'Take your medication as soon as you remember, unless it''s almost time for your next dose. If you''re unsure, contact your pharmacy or healthcare provider.'),
('I''m feeling dizzy when I stand up', 'health', ARRAY['dizzy', 'stand', 'lightheaded'], 'Dizziness when standing can be caused by blood pressure changes. Sit down, drink water, and contact your healthcare team if it continues.'),
('I''m having trouble sleeping', 'health', ARRAY['sleep', 'insomnia', 'tired'], 'Sleep problems are common. Try maintaining a regular bedtime routine, avoiding caffeine late in the day, and speak with your healthcare provider if it persists.'),
('My blood pressure seems high today', 'health', ARRAY['blood pressure', 'high', 'hypertension'], 'If your blood pressure is significantly elevated, contact your healthcare provider. Take your medications as prescribed and monitor regularly.'),
('I can''t remember if I took my pills', 'medication', ARRAY['forgot', 'pills', 'remember'], 'Don''t take a double dose. If it''s close to your next scheduled dose, skip the missed one. Consider using a pill organizer to help track your medications.')
ON CONFLICT DO NOTHING;

-- Add function to get patient context for AI
CREATE OR REPLACE FUNCTION get_patient_context(patient_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    context JSONB;
BEGIN
    SELECT jsonb_build_object(
        'conditions', COALESCE(health_conditions, '[]'::jsonb),
        'medications', medications,
        'age', EXTRACT(YEAR FROM AGE(COALESCE(dob::date, '1950-01-01'::date))),
        'emergency_contact', jsonb_build_object(
            'name', emergency_contact_name,
            'phone', emergency_contact_phone,
            'relationship', emergency_contact_relationship
        )
    ) INTO context
    FROM public.profiles
    WHERE user_id = patient_user_id;

    RETURN COALESCE(context, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION get_patient_context(UUID) TO authenticated;

-- Create view for nurse dashboard with patient context
CREATE OR REPLACE VIEW nurse_questions_view AS
SELECT
    q.*,
    p.first_name,
    p.last_name,
    p.phone,
    get_patient_context(q.user_id) as patient_context
FROM public.user_questions q
LEFT JOIN public.profiles p ON q.user_id = p.user_id
ORDER BY
    CASE q.urgency
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
    END,
    q.created_at DESC;

-- Grant access to the view for admins
GRANT SELECT ON nurse_questions_view TO authenticated;

-- RLS policy for the view (admins only)
CREATE POLICY "admins_can_view_nurse_questions" ON public.user_questions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );