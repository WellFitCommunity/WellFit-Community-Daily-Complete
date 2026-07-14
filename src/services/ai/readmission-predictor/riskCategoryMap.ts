/**
 * riskCategoryMap - Translates readmission risk categories between the
 * app convention and the database convention.
 *
 * The live readmission_risk_predictions.risk_category CHECK constraint
 * accepts ('low','medium','high','critical'), while the AI prompt, the
 * deterministic model, and every UI surface use 'moderate'. This is the
 * single boundary where the two vocabularies meet — do not hand-map
 * category strings anywhere else.
 */

export type AppRiskCategory = 'low' | 'moderate' | 'high' | 'critical';
export type DbRiskCategory = 'low' | 'medium' | 'high' | 'critical';

export function toDbRiskCategory(category: string): DbRiskCategory {
  const normalized = category.toLowerCase();
  if (normalized === 'moderate') return 'medium';
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high' || normalized === 'critical') {
    return normalized;
  }
  return 'low';
}

export function fromDbRiskCategory(category: string | null | undefined): AppRiskCategory {
  const normalized = (category ?? '').toLowerCase();
  if (normalized === 'medium') return 'moderate';
  if (normalized === 'moderate' || normalized === 'high' || normalized === 'critical') {
    return normalized;
  }
  return 'low';
}
