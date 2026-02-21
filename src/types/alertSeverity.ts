/**
 * Canonical Alert Severity Types
 *
 * This file is the single source of truth for alert severity levels.
 * Import from here instead of defining local copies.
 *
 * Two standard severity scales exist in healthcare:
 * 1. Clinical Alert Severity — for care team notifications, system alerts, guardians
 * 2. Risk Alert Severity — for RPM, SOC dashboards, risk scoring
 *
 * Domain-specific severity types (medication, device) are defined locally
 * in their owning modules with unique names to prevent type confusion.
 */

/** Clinical alert severity — care team notifications, system alerts, guardian alerts */
export type ClinicalAlertSeverity = 'info' | 'warning' | 'critical' | 'emergency';

/** Risk-based severity — RPM vitals, SOC dashboards, risk scoring */
export type RiskAlertSeverity = 'low' | 'medium' | 'high' | 'critical';
