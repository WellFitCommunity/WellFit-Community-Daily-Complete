-- =====================================================
-- Restore readmission-prediction AI output columns
-- =====================================================
-- The original readmission_risk_predictions (20251115120000) carried the
-- AI's full output set but was create-then-dropped by the migrate:down
-- footgun; the surviving recreation (20251115160000) lost the 7/90-day
-- probabilities, prediction confidence, and data-sources audit trail that
-- both writers (readmissionRiskPredictor.ts, readmissionRiskPredictionService.ts)
-- and the ReadmissionRiskPanel detail view were built against.
-- plain_language_explanation is additive: the AI generates a patient-facing
-- explanation (HTI-2 transparency) that previously had nowhere to persist.
--
-- All columns nullable — zero impact on existing rows and readers.
-- Maria approved the additive-restore option 2026-07-14.

ALTER TABLE public.readmission_risk_predictions
  ADD COLUMN IF NOT EXISTS readmission_risk_7_day numeric(3,2)
    CHECK (readmission_risk_7_day IS NULL OR (readmission_risk_7_day >= 0.00 AND readmission_risk_7_day <= 1.00)),
  ADD COLUMN IF NOT EXISTS readmission_risk_90_day numeric(3,2)
    CHECK (readmission_risk_90_day IS NULL OR (readmission_risk_90_day >= 0.00 AND readmission_risk_90_day <= 1.00)),
  ADD COLUMN IF NOT EXISTS prediction_confidence numeric(3,2)
    CHECK (prediction_confidence IS NULL OR (prediction_confidence >= 0.00 AND prediction_confidence <= 1.00)),
  ADD COLUMN IF NOT EXISTS data_sources_analyzed jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS plain_language_explanation text;

COMMENT ON COLUMN public.readmission_risk_predictions.readmission_risk_7_day IS '0-1 probability of readmission within 7 days (AI output; restored 20260714)';
COMMENT ON COLUMN public.readmission_risk_predictions.readmission_risk_90_day IS '0-1 probability of readmission within 90 days (AI output; restored 20260714)';
COMMENT ON COLUMN public.readmission_risk_predictions.prediction_confidence IS '0-1 model confidence, scaled by data completeness (AI output; restored 20260714)';
COMMENT ON COLUMN public.readmission_risk_predictions.data_sources_analyzed IS 'Which data domains fed the prediction, e.g. {"readmissionHistory":true} (restored 20260714)';
COMMENT ON COLUMN public.readmission_risk_predictions.plain_language_explanation IS 'Patient/family-facing explanation of the risk (HTI-2 transparency)';

-- Table-level GRANTs already exist and cover new columns; RLS unchanged.
