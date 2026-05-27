// ============================================================================
// Burnout Threshold Config — Tenant-Configurable Clinical Thresholds
// ============================================================================
// Source of truth for the JSONB shape stored at
// tenant_module_config.burnout_thresholds. Used by AdminBurnoutRadar.
//
// Defaults match the previously hardcoded values in AdminBurnoutRadar so
// behavior is unchanged when a tenant has not overridden them or when the
// column is missing/NULL.
// ============================================================================

export interface BurnoutThresholds {
  /** avg team stress >= this triggers HIGH ALERT (scale 1-10) */
  stress_high: number;
  /** avg team energy <= this is the low-energy threshold (scale 1-10) */
  energy_low: number;
  /** avg team mood/morale <= this is the low-mood threshold (scale 1-10) */
  mood_low: number;
  /** percentage of staff at high/critical burnout risk above which the
   *  dashboard escalates the overall risk label to HIGH ALERT */
  high_risk_percent_alert: number;
}

export const DEFAULT_BURNOUT_THRESHOLDS: BurnoutThresholds = {
  stress_high: 7,
  energy_low: 4,
  mood_low: 4,
  high_risk_percent_alert: 30,
};

/** Type guard for JSONB payloads read from the database. */
export function isBurnoutThresholds(value: unknown): value is Partial<BurnoutThresholds> {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.stress_high === undefined || typeof v.stress_high === 'number') &&
    (v.energy_low === undefined || typeof v.energy_low === 'number') &&
    (v.mood_low === undefined || typeof v.mood_low === 'number') &&
    (v.high_risk_percent_alert === undefined || typeof v.high_risk_percent_alert === 'number')
  );
}
