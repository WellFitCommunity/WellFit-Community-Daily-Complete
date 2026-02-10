-- ============================================================================
-- HIPAA Workforce Training Tracking
-- 45 CFR 164.308(a)(5): Security Awareness and Training
-- ============================================================================

-- Training courses table
CREATE TABLE IF NOT EXISTS public.training_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  course_name TEXT NOT NULL,
  course_code TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'hipaa_security'
    CHECK (category IN ('hipaa_security', 'hipaa_privacy', 'cybersecurity', 'compliance', 'clinical_safety', 'emergency_procedures', 'other')),
  required_for_roles TEXT[] DEFAULT '{}',
  recurrence_months INTEGER NOT NULL DEFAULT 12,
  passing_score INTEGER DEFAULT 80,
  duration_minutes INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, course_code)
);

-- Training completions table
CREATE TABLE IF NOT EXISTS public.training_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  employee_id UUID NOT NULL REFERENCES auth.users(id),
  course_id UUID NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  score INTEGER,
  passed BOOLEAN NOT NULL DEFAULT TRUE,
  certificate_url TEXT,
  expires_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Training requirements (which roles need which courses)
CREATE TABLE IF NOT EXISTS public.training_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  course_id UUID NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  role_code TEXT NOT NULL,
  is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  grace_period_days INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, course_id, role_code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_training_courses_tenant ON public.training_courses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_training_courses_active ON public.training_courses(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_training_completions_tenant ON public.training_completions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_training_completions_employee ON public.training_completions(employee_id);
CREATE INDEX IF NOT EXISTS idx_training_completions_course ON public.training_completions(course_id);
CREATE INDEX IF NOT EXISTS idx_training_completions_expires ON public.training_completions(expires_at);
CREATE INDEX IF NOT EXISTS idx_training_requirements_tenant ON public.training_requirements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_training_requirements_role ON public.training_requirements(role_code);

-- RLS
ALTER TABLE public.training_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_requirements ENABLE ROW LEVEL SECURITY;

-- Courses: tenant-scoped read for all, admin insert/update
CREATE POLICY training_courses_tenant_read ON public.training_courses
  FOR SELECT USING (tenant_id = (SELECT get_current_tenant_id()));

CREATE POLICY training_courses_admin_insert ON public.training_courses
  FOR INSERT WITH CHECK (tenant_id = (SELECT get_current_tenant_id()));

CREATE POLICY training_courses_admin_update ON public.training_courses
  FOR UPDATE USING (tenant_id = (SELECT get_current_tenant_id()));

-- Completions: employees see own, admins see all in tenant
CREATE POLICY training_completions_read ON public.training_completions
  FOR SELECT USING (
    employee_id = auth.uid()
    OR tenant_id = (SELECT get_current_tenant_id())
  );

CREATE POLICY training_completions_insert ON public.training_completions
  FOR INSERT WITH CHECK (tenant_id = (SELECT get_current_tenant_id()));

-- Requirements: tenant-scoped read/write
CREATE POLICY training_requirements_read ON public.training_requirements
  FOR SELECT USING (tenant_id = (SELECT get_current_tenant_id()));

CREATE POLICY training_requirements_insert ON public.training_requirements
  FOR INSERT WITH CHECK (tenant_id = (SELECT get_current_tenant_id()));

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.training_courses TO authenticated;
GRANT SELECT, INSERT ON public.training_completions TO authenticated;
GRANT SELECT, INSERT ON public.training_requirements TO authenticated;

-- Updated_at trigger
CREATE TRIGGER set_training_courses_updated_at
  BEFORE UPDATE ON public.training_courses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
