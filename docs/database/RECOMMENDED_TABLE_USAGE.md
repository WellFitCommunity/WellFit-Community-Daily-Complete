# Question Tables Usage Strategy

## ✅ RECOMMENDED APPROACH

### 🔧 **admin_user_questions** - Technical Support
**Use for:** App issues, technical problems, feature requests
- **Examples:** "I can't log in", "The app is slow", "How do I upload photos?"
- **Handled by:** Technical support team, developers
- **Response time:** 1-3 business days
- **Current fields:** message, status (new/reviewing/answered/closed)

### 🏥 **user_questions** - Medical/Nurse Questions
**Use for:** Health concerns, medical questions, nurse communication
- **Examples:** "I missed my medication", "I'm feeling dizzy", "My blood pressure is high"
- **Handled by:** Nurses, healthcare team
- **Response time:** Same day (urgent), 24 hours (routine)
- **Enhanced fields needed:** urgency, category (health/medication/emergency), ai_suggestions

## 🚀 IMPLEMENTATION PLAN

### 1. Update user_questions table for medical use:
```sql
-- Add medical-specific fields to existing user_questions table
ALTER TABLE public.user_questions
ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'low' CHECK (urgency IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS ai_suggestions JSONB,
ADD COLUMN IF NOT EXISTS nurse_notes TEXT,
ADD COLUMN IF NOT EXISTS patient_context JSONB; -- Store patient conditions, medications

-- Update category check to include medical categories
ALTER TABLE public.user_questions
DROP CONSTRAINT IF EXISTS user_questions_category_check,
ADD CONSTRAINT user_questions_category_check
CHECK (category IN ('general', 'health', 'medication', 'emergency', 'technical'));
```

### 2. Keep admin_user_questions as-is for technical support

### 3. Update your components:
- **EnhancedQuestionsPage** → Connect to `user_questions` (medical)
- **Create TechSupportPage** → Connect to `admin_user_questions` (technical)

## 🎯 USER EXPERIENCE

### For Seniors:
- **"Ask Nurse"** button → Medical questions (user_questions)
- **"App Help"** in settings → Technical questions (admin_user_questions)

### For Admins:
- **"Nurse Questions"** panel → Medical responses (user_questions)
- **"Tech Support"** panel → Technical support (admin_user_questions)

## 📈 BENEFITS

1. **Clear separation** of medical vs technical issues
2. **Different response teams** can focus on their expertise
3. **Different SLAs** - medical urgent, technical standard
4. **Specialized AI** - medical AI for health, tech AI for app issues
5. **Compliance** - medical questions can have HIPAA considerations

## 🔄 MIGRATION STRATEGY

1. **Phase 1:** Use existing tables as-is
2. **Phase 2:** Add medical enhancements to user_questions
3. **Phase 3:** Create separate admin interfaces for each type
4. **Phase 4:** Add AI assistance to both systems