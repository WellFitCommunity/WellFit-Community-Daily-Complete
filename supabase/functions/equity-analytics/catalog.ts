// Equity-analytics catalog — the typed, whitelisted API surface for the engine.
// This MIRRORS the server-side allowlist baked into the equity_aggregate() SQL function. The SQL
// function is the ultimate security boundary (it re-validates every token); this catalog provides
// request validation at the edge AND is served to the UI so the dashboard never hardcodes fields.
//
// Adding a dimension/measure here WITHOUT adding it to equity_aggregate() will simply be rejected by
// SQL — defense in depth, not a single point of trust.

export interface CatalogField {
  key: string;
  label: string;
  /** 'count' | 'percent' | 'average' | 'category' — drives UI formatting. */
  kind?: "count" | "percent" | "average" | "category";
  unit?: string;
}

export interface CatalogSource {
  key: string;
  label: string;
  description: string;
  /** Whether this source carries a timestamp (enables time-trend grouping). */
  timeSeries: boolean;
  dimensions: CatalogField[];
  measures: CatalogField[];
}

// Shared demographic dimensions reachable from the profiles spine on every source.
const DEMOGRAPHIC_DIMS: CatalogField[] = [
  { key: "race_omb", label: "Race (OMB)", kind: "category" },
  { key: "ethnicity_omb", label: "Ethnicity (OMB)", kind: "category" },
  { key: "gender", label: "Gender", kind: "category" },
  { key: "age_band", label: "Age band", kind: "category" },
  { key: "zcta3", label: "ZIP region (3-digit)", kind: "category" },
  { key: "income_range", label: "Income range", kind: "category" },
  { key: "insurance_type", label: "Insurance type", kind: "category" },
  { key: "preferred_language", label: "Preferred language", kind: "category" },
  { key: "veteran_status", label: "Veteran status", kind: "category" },
];

export const CATALOG: Record<string, CatalogSource> = {
  members: {
    key: "members",
    label: "Members",
    description: "Enrolled members (seniors/patients) and their demographics + social determinants of health.",
    timeSeries: false,
    dimensions: [
      ...DEMOGRAPHIC_DIMS,
      { key: "requires_interpreter", label: "Requires interpreter", kind: "category" },
      { key: "marital_status", label: "Marital status", kind: "category" },
      { key: "living_situation", label: "Living situation", kind: "category" },
      { key: "education_level", label: "Education level", kind: "category" },
      { key: "food_security", label: "Food security", kind: "category" },
      { key: "transportation_access", label: "Transportation access", kind: "category" },
      { key: "social_support", label: "Social support", kind: "category" },
      { key: "mobility_level", label: "Mobility level", kind: "category" },
      { key: "lives_alone", label: "Lives alone", kind: "category" },
      { key: "housing_type", label: "Housing type", kind: "category" },
      { key: "social_isolation_risk", label: "Social isolation risk", kind: "category" },
      { key: "financial_stress_level", label: "Financial stress level", kind: "category" },
      { key: "needs_financial_assistance", label: "Needs financial assistance", kind: "category" },
      { key: "caregiver_burnout_risk", label: "Caregiver burnout risk", kind: "category" },
      { key: "has_internet", label: "Has internet (digital access)", kind: "category" },
    ],
    measures: [
      { key: "member_count", label: "Member count", kind: "count" },
      { key: "avg_age", label: "Average age", kind: "average", unit: "yrs" },
      { key: "pct_lives_alone", label: "% living alone", kind: "percent", unit: "%" },
      { key: "pct_requires_interpreter", label: "% requiring interpreter", kind: "percent", unit: "%" },
      { key: "pct_needs_financial_assistance", label: "% needing financial assistance", kind: "percent", unit: "%" },
      { key: "pct_has_internet", label: "% with internet access", kind: "percent", unit: "%" },
      { key: "pct_uses_medical_alert_device", label: "% using medical alert device", kind: "percent", unit: "%" },
      { key: "pct_socially_isolated", label: "% at social isolation risk", kind: "percent", unit: "%" },
    ],
  },
  checkins: {
    key: "checkins",
    label: "Check-ins & vitals",
    description: "Daily community check-ins and self-reported vitals, by demographic group and over time.",
    timeSeries: true,
    dimensions: [
      ...DEMOGRAPHIC_DIMS,
      { key: "food_security", label: "Food security", kind: "category" },
      { key: "transportation_access", label: "Transportation access", kind: "category" },
    ],
    measures: [
      { key: "total_checkins", label: "Total check-ins", kind: "count" },
      { key: "avg_bp_systolic", label: "Avg systolic BP", kind: "average", unit: "mmHg" },
      { key: "avg_bp_diastolic", label: "Avg diastolic BP", kind: "average", unit: "mmHg" },
      { key: "avg_heart_rate", label: "Avg heart rate", kind: "average", unit: "bpm" },
      { key: "avg_glucose", label: "Avg glucose", kind: "average", unit: "mg/dL" },
    ],
  },
  readmission: {
    key: "readmission",
    label: "Readmission risk",
    description: "Readmission risk predictions by demographic group — surfaces disparities in risk.",
    timeSeries: true,
    dimensions: [
      ...DEMOGRAPHIC_DIMS,
      { key: "risk_category", label: "Risk category", kind: "category" },
    ],
    measures: [
      { key: "prediction_count", label: "Prediction count", kind: "count" },
      { key: "avg_readmission_risk", label: "Avg readmission risk score", kind: "average" },
    ],
  },
  sdoh_detections: {
    key: "sdoh_detections",
    label: "SDOH detections",
    description: "Passively-detected social-determinant needs (Z-codes) by demographic group.",
    timeSeries: true,
    dimensions: [
      ...DEMOGRAPHIC_DIMS,
      { key: "sdoh_category", label: "SDOH category", kind: "category" },
      { key: "z_code", label: "Z-code (Z55–Z65)", kind: "category" },
      { key: "detection_risk_level", label: "Detection risk level", kind: "category" },
    ],
    measures: [
      { key: "detection_count", label: "Detection count", kind: "count" },
      { key: "avg_confidence", label: "Avg detection confidence", kind: "average" },
    ],
  },
};

export const TIME_GRAINS = ["month", "quarter", "year"] as const;
export const MAX_DIMENSIONS = 3;

export type CatalogValidation = { ok: true } | { ok: false; error: string };

/** Validate a spec's source/measure/dimensions/filters against the catalog. */
export function validateAgainstCatalog(spec: {
  source: string;
  measure: string;
  dimensions: string[];
  filters?: { dimension: string; value: string }[];
  timeGrain?: string | null;
}): CatalogValidation {
  const src = CATALOG[spec.source];
  if (!src) return { ok: false, error: `Unknown source "${spec.source}"` };

  const dimKeys = new Set(src.dimensions.map((d) => d.key));
  const measKeys = new Set(src.measures.map((m) => m.key));

  if (!measKeys.has(spec.measure)) {
    return { ok: false, error: `Measure "${spec.measure}" is not available for source "${spec.source}"` };
  }
  if (spec.dimensions.length > MAX_DIMENSIONS) {
    return { ok: false, error: `At most ${MAX_DIMENSIONS} dimensions allowed` };
  }
  for (const d of spec.dimensions) {
    if (!dimKeys.has(d)) return { ok: false, error: `Dimension "${d}" is not available for source "${spec.source}"` };
  }
  for (const f of spec.filters ?? []) {
    if (!dimKeys.has(f.dimension)) {
      return { ok: false, error: `Filter dimension "${f.dimension}" is not available for source "${spec.source}"` };
    }
  }
  if (spec.timeGrain) {
    if (!src.timeSeries) return { ok: false, error: `Source "${spec.source}" does not support time trends` };
    if (!(TIME_GRAINS as readonly string[]).includes(spec.timeGrain)) {
      return { ok: false, error: `Invalid time grain "${spec.timeGrain}"` };
    }
  }
  return { ok: true };
}
