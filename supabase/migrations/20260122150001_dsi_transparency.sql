-- =====================================================
-- DSI Transparency (AI Model Cards) Migration
-- HTI-1 Decision Support Intervention Requirements
-- Created: January 22, 2026
-- =====================================================

-- This migration creates infrastructure for AI/ML model transparency
-- per HTI-1 requirements (Decision Support Interventions)

-- =====================================================
-- AI MODEL REGISTRY
-- =====================================================
-- Central registry of all AI/ML models used in the system

CREATE TABLE IF NOT EXISTS ai_model_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Model identification
  model_key VARCHAR(100) NOT NULL UNIQUE,
  model_name VARCHAR(255) NOT NULL,
  model_version VARCHAR(50) NOT NULL,

  -- Model type
  model_type VARCHAR(50) NOT NULL, -- predictive, classification, generation, extraction, scoring
  intervention_type VARCHAR(100), -- clinical_decision_support, administrative, documentation, etc.

  -- Provider information
  provider_name VARCHAR(255) NOT NULL, -- Anthropic, OpenAI, internal, etc.
  provider_model_id VARCHAR(255), -- claude-3-opus, gpt-4, etc.

  -- Purpose and description
  purpose TEXT NOT NULL,
  intended_use TEXT NOT NULL,
  clinical_domain VARCHAR(100), -- diagnosis, treatment, screening, monitoring, etc.

  -- Risk classification (per FDA/ONC)
  risk_level VARCHAR(50) NOT NULL, -- low, moderate, high
  is_fda_cleared BOOLEAN DEFAULT FALSE,
  fda_clearance_number VARCHAR(50),

  -- Data and training
  training_data_description TEXT,
  training_data_sources TEXT[],
  training_data_date_range VARCHAR(100),

  -- Performance metrics
  accuracy_metrics JSONB, -- {metric_name: value, confidence_interval: [low, high]}
  validation_dataset_description TEXT,
  known_limitations TEXT[],

  -- Demographic performance
  demographic_performance JSONB, -- Performance broken down by demographics
  bias_evaluation_summary TEXT,

  -- Update and maintenance
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  update_frequency VARCHAR(50), -- quarterly, annually, as_needed
  maintenance_contact VARCHAR(255),

  -- Transparency requirements
  explainability_method VARCHAR(100), -- SHAP, LIME, attention_weights, rule_based
  user_facing_explanation_available BOOLEAN DEFAULT TRUE,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  deployment_date DATE,
  retirement_date DATE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed existing AI services from ai_skills table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_skills') THEN
    INSERT INTO ai_model_registry (
      model_key,
      model_name,
      model_version,
      model_type,
      intervention_type,
      provider_name,
      provider_model_id,
      purpose,
      intended_use,
      clinical_domain,
      risk_level,
      explainability_method,
      user_facing_explanation_available,
      is_active
    )
    SELECT
      skill_key,
      REPLACE(REPLACE(skill_key, '_', ' '), 'ai ', ''),
      '1.0',
      CASE
        WHEN skill_key LIKE '%predictor%' THEN 'predictive'
        WHEN skill_key LIKE '%scorer%' THEN 'scoring'
        WHEN skill_key LIKE '%detector%' THEN 'classification'
        WHEN skill_key LIKE '%generator%' THEN 'generation'
        WHEN skill_key LIKE '%summarizer%' THEN 'extraction'
        ELSE 'generation'
      END,
      CASE
        WHEN skill_key LIKE '%clinical%' OR skill_key LIKE '%care%' OR skill_key LIKE '%fall%' OR skill_key LIKE '%risk%' THEN 'clinical_decision_support'
        WHEN skill_key LIKE '%billing%' OR skill_key LIKE '%audit%' THEN 'administrative'
        WHEN skill_key LIKE '%note%' OR skill_key LIKE '%summary%' OR skill_key LIKE '%letter%' THEN 'documentation'
        ELSE 'general'
      END,
      'Anthropic',
      model,
      description,
      'Support clinical decision-making with AI-generated insights',
      CASE
        WHEN skill_key LIKE '%fall%' THEN 'safety'
        WHEN skill_key LIKE '%medication%' THEN 'pharmacology'
        WHEN skill_key LIKE '%discharge%' THEN 'transitions_of_care'
        WHEN skill_key LIKE '%care_plan%' THEN 'care_planning'
        ELSE 'general'
      END,
      CASE
        WHEN skill_key LIKE '%predictor%' OR skill_key LIKE '%risk%' THEN 'moderate'
        WHEN skill_key LIKE '%medication%' OR skill_key LIKE '%contraindication%' THEN 'high'
        ELSE 'low'
      END,
      'attention_weights',
      TRUE,
      is_active
    FROM ai_skills
    WHERE NOT EXISTS (
      SELECT 1 FROM ai_model_registry WHERE model_key = ai_skills.skill_key
    );
  END IF;
END $$;

-- =====================================================
-- MODEL CARD ATTRIBUTES
-- =====================================================
-- Detailed model card per HTI-1 31-attribute requirement

CREATE TABLE IF NOT EXISTS ai_model_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES ai_model_registry(id) ON DELETE CASCADE,

  -- Section 1: Model Details
  model_details JSONB NOT NULL DEFAULT '{}',
  -- {
  --   "name": "",
  --   "version": "",
  --   "type": "",
  --   "architecture": "",
  --   "framework": "",
  --   "license": ""
  -- }

  -- Section 2: Intended Use
  intended_use JSONB NOT NULL DEFAULT '{}',
  -- {
  --   "primary_use_cases": [],
  --   "primary_users": [],
  --   "out_of_scope_uses": []
  -- }

  -- Section 3: Factors
  factors JSONB NOT NULL DEFAULT '{}',
  -- {
  --   "relevant_factors": [],
  --   "evaluation_factors": []
  -- }

  -- Section 4: Metrics
  metrics JSONB NOT NULL DEFAULT '{}',
  -- {
  --   "performance_metrics": [],
  --   "decision_thresholds": {},
  --   "variation_approaches": []
  -- }

  -- Section 5: Evaluation Data
  evaluation_data JSONB NOT NULL DEFAULT '{}',
  -- {
  --   "datasets": [],
  --   "motivation": "",
  --   "preprocessing": ""
  -- }

  -- Section 6: Training Data
  training_data JSONB NOT NULL DEFAULT '{}',
  -- {
  --   "datasets": [],
  --   "motivation": "",
  --   "preprocessing": ""
  -- }

  -- Section 7: Quantitative Analyses
  quantitative_analyses JSONB NOT NULL DEFAULT '{}',
  -- {
  --   "unitary_results": {},
  --   "intersectional_results": {}
  -- }

  -- Section 8: Ethical Considerations
  ethical_considerations JSONB NOT NULL DEFAULT '{}',
  -- {
  --   "data_concerns": [],
  --   "human_life_impact": "",
  --   "mitigations": [],
  --   "risks_and_harms": [],
  --   "use_cases": []
  -- }

  -- Section 9: Caveats and Recommendations
  caveats_recommendations JSONB NOT NULL DEFAULT '{}',
  -- {
  --   "caveats": [],
  --   "recommendations": [],
  --   "additional_concerns": []
  -- }

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  is_published BOOLEAN DEFAULT FALSE,
  published_by UUID
);

-- =====================================================
-- MODEL TRANSPARENCY LOG
-- =====================================================
-- Track when users view model transparency info

CREATE TABLE IF NOT EXISTS ai_transparency_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  model_id UUID NOT NULL,
  user_id UUID,

  -- Event details
  event_type VARCHAR(50) NOT NULL, -- viewed_card, viewed_explanation, requested_details
  context VARCHAR(100), -- where the transparency info was accessed

  -- Metadata
  event_timestamp TIMESTAMPTZ DEFAULT NOW(),
  session_id VARCHAR(255)
);

-- RLS
ALTER TABLE ai_transparency_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for ai_transparency_log"
  ON ai_transparency_log FOR ALL
  USING (tenant_id = get_current_tenant_id());

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_ai_model_registry_key ON ai_model_registry(model_key);
CREATE INDEX IF NOT EXISTS idx_ai_model_registry_type ON ai_model_registry(model_type);
CREATE INDEX IF NOT EXISTS idx_ai_model_registry_risk ON ai_model_registry(risk_level);
CREATE INDEX IF NOT EXISTS idx_ai_model_cards_model ON ai_model_cards(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_transparency_log_model ON ai_transparency_log(model_id);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to get model transparency summary for UI
CREATE OR REPLACE FUNCTION get_model_transparency(p_model_key VARCHAR)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'model_name', r.model_name,
    'model_version', r.model_version,
    'provider', r.provider_name,
    'purpose', r.purpose,
    'intended_use', r.intended_use,
    'risk_level', r.risk_level,
    'is_fda_cleared', r.is_fda_cleared,
    'known_limitations', r.known_limitations,
    'explainability_method', r.explainability_method,
    'last_updated', r.last_updated,
    'has_detailed_card', EXISTS(SELECT 1 FROM ai_model_cards WHERE model_id = r.id)
  )
  INTO v_result
  FROM ai_model_registry r
  WHERE r.model_key = p_model_key;

  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE ai_model_registry IS 'HTI-1: Central registry of AI/ML models for DSI transparency';
COMMENT ON TABLE ai_model_cards IS 'HTI-1: Detailed model cards with 31 required attributes';
COMMENT ON TABLE ai_transparency_log IS 'HTI-1: Audit log of transparency information access';
