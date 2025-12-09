-- ============================================================================
-- ADD AI PREDICTION TRACKING COLUMNS
-- ============================================================================
-- Purpose: Add ai_prediction_tracking_id to tables that need accuracy tracking
-- Tables: passive_sdoh_detections, encounter_billing_suggestions
-- ============================================================================

-- Add tracking column to passive_sdoh_detections
ALTER TABLE IF EXISTS passive_sdoh_detections
    ADD COLUMN IF NOT EXISTS ai_prediction_tracking_id UUID REFERENCES ai_predictions(id);

-- Add tracking column to encounter_billing_suggestions
ALTER TABLE IF EXISTS encounter_billing_suggestions
    ADD COLUMN IF NOT EXISTS ai_prediction_tracking_id UUID REFERENCES ai_predictions(id);

-- Create indexes for efficient lookups (only if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'passive_sdoh_detections') THEN
        CREATE INDEX IF NOT EXISTS idx_sdoh_detections_tracking
            ON passive_sdoh_detections(ai_prediction_tracking_id)
            WHERE ai_prediction_tracking_id IS NOT NULL;
        COMMENT ON COLUMN passive_sdoh_detections.ai_prediction_tracking_id IS 'Links to ai_predictions for accuracy tracking';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'encounter_billing_suggestions') THEN
        CREATE INDEX IF NOT EXISTS idx_billing_suggestions_tracking
            ON encounter_billing_suggestions(ai_prediction_tracking_id)
            WHERE ai_prediction_tracking_id IS NOT NULL;
        COMMENT ON COLUMN encounter_billing_suggestions.ai_prediction_tracking_id IS 'Links to ai_predictions for accuracy tracking';
    END IF;
END $$;
