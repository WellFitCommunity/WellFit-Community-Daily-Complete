/**
 * Claude & Billing Monitoring Dashboard - Barrel Export
 *
 * Decomposed from a single 666-line file into focused sub-modules.
 * This barrel re-exports the default export for zero breaking changes.
 *
 * @module claude-billing
 */

export { default } from './ClaudeBillingMonitoringDashboard';

// Sub-components (for direct import if needed)
export { default as MetricCard } from './MetricCard';
export { default as ServiceStatusPanel } from './ServiceStatusPanel';
export { default as CostInsightsPanel } from './CostInsightsPanel';
export { default as ClaudeUsageSection } from './ClaudeUsageSection';
export { default as BillingWorkflowSection } from './BillingWorkflowSection';

// Hook
export { useClaudeBillingData } from './useClaudeBillingData';

// Types
export type {
  ClaudeUsageMetrics,
  BillingWorkflowMetrics,
  CostOptimizationInsight,
  ServiceStatus,
  SpendingSummary,
  DateRange,
  MetricCardProps,
} from './ClaudeBillingMonitoringDashboard.types';
