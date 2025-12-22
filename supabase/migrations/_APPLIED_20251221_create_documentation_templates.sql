-- Create documentation_templates table
-- Generic template system for admin, IT, and nursing staff
-- Not tied to any specific AI branding

CREATE TABLE IF NOT EXISTS documentation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Template metadata
  template_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',

  -- Access control
  role TEXT NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE RESTRICT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Template content
  template_type TEXT NOT NULL DEFAULT 'document', -- document, form, letter, note
  content_template TEXT NOT NULL, -- The actual template with placeholders

  -- Field definitions
  required_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  optional_fields JSONB DEFAULT '{}'::jsonb,

  -- Settings
  output_format TEXT NOT NULL DEFAULT 'narrative' CHECK (output_format IN ('narrative', 'form', 'letter', 'structured')),
  ai_assisted BOOLEAN DEFAULT false, -- Whether AI helps fill this template
  ai_model TEXT DEFAULT 'balanced', -- fast, balanced, accurate
  is_active BOOLEAN DEFAULT true,
  is_shared BOOLEAN DEFAULT false, -- Whether template is shared across tenant
  version INTEGER DEFAULT 1,

  -- Soft delete
  deleted_at TIMESTAMPTZ,

  CONSTRAINT unique_template_name_per_role UNIQUE (role, template_name, tenant_id, version)
);

-- Indexes
CREATE INDEX idx_doc_templates_role ON documentation_templates(role, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_doc_templates_category ON documentation_templates(category, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_doc_templates_tenant ON documentation_templates(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_doc_templates_created_by ON documentation_templates(created_by) WHERE deleted_at IS NULL;

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_documentation_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_doc_templates_updated_at
  BEFORE UPDATE ON documentation_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_documentation_templates_updated_at();

-- RLS Policies
ALTER TABLE documentation_templates ENABLE ROW LEVEL SECURITY;

-- Admin, super_admin, and IT can manage all templates
CREATE POLICY "Admins can manage templates" ON documentation_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND (profiles.is_admin = true OR profiles.role IN ('admin', 'super_admin', 'it_admin'))
    )
  );

-- Users can read active templates for their role
CREATE POLICY "Users can read active templates for their role" ON documentation_templates
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND is_active = true
    AND deleted_at IS NULL
  );

-- Nurses can create and edit their own templates
CREATE POLICY "Nurses can manage own templates" ON documentation_templates
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('nurse', 'nurse_practitioner')
    )
    AND created_by = auth.uid()
  );

-- Comments
COMMENT ON TABLE documentation_templates IS 'Stores reusable documentation templates for clinical and administrative staff';
COMMENT ON COLUMN documentation_templates.content_template IS 'Template content with {placeholder} syntax for variable substitution';
COMMENT ON COLUMN documentation_templates.required_fields IS 'JSON object defining required input fields: {"field_name": "field_type"}';
COMMENT ON COLUMN documentation_templates.is_shared IS 'If true, template is available to all users of the same role across tenants';
