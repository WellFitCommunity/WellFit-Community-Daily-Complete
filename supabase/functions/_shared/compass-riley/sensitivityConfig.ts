// Sensitivity Config — Compass Riley V2
//
// Resolves tree_sensitivity from tenant_ai_skill_config.settings JSONB
// and returns confidence thresholds for CoT/Caution/ToT output zones.
// Defaults to 'balanced' if unset or invalid.
//
// Thresholds (0-100 scale):
//   conservative: chain >= 90, caution 70-89, tree < 70
//   balanced:     chain >= 80, caution 60-79, tree < 60
//   aggressive:   chain >= 65, caution 50-64, tree < 50

import type { TreeSensitivity, ConfidenceThresholds } from './types.ts';

const THRESHOLD_MAP: Record<TreeSensitivity, ConfidenceThresholds> = {
  conservative: { chainThreshold: 90, treeThreshold: 70 },
  balanced:     { chainThreshold: 80, treeThreshold: 60 },
  aggressive:   { chainThreshold: 65, treeThreshold: 50 },
};

const DEFAULT_SENSITIVITY: TreeSensitivity = 'balanced';

const VALID_SENSITIVITIES: readonly string[] = ['conservative', 'balanced', 'aggressive'];

/**
 * Get confidence thresholds for a given sensitivity level.
 */
export function getThresholds(sensitivity: TreeSensitivity): ConfidenceThresholds {
  return THRESHOLD_MAP[sensitivity] ?? THRESHOLD_MAP[DEFAULT_SENSITIVITY];
}

/**
 * Resolve TreeSensitivity from tenant_ai_skill_config.settings JSONB.
 * Returns 'balanced' if settings is null, missing, or invalid.
 *
 * @param tenantSettings The settings JSONB from tenant_ai_skill_config
 */
export function resolveSensitivity(
  tenantSettings: Record<string, unknown> | null | undefined
): TreeSensitivity {
  if (!tenantSettings) return DEFAULT_SENSITIVITY;

  const value = tenantSettings['tree_sensitivity'];
  if (typeof value === 'string' && VALID_SENSITIVITIES.includes(value)) {
    return value as TreeSensitivity;
  }

  return DEFAULT_SENSITIVITY;
}

/**
 * Convenience: resolve sensitivity AND return thresholds in one call.
 */
export function resolveSensitivityWithThresholds(
  tenantSettings: Record<string, unknown> | null | undefined
): { sensitivity: TreeSensitivity; thresholds: ConfidenceThresholds } {
  const sensitivity = resolveSensitivity(tenantSettings);
  return { sensitivity, thresholds: getThresholds(sensitivity) };
}
