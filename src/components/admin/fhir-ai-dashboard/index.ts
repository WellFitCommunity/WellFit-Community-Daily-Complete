// Barrel re-export for FhirAiDashboard decomposition
// All sub-modules are re-exported from here

export { default } from './FhirAiDashboardMain';
export { default as QuickActionCard } from './QuickActionCard';
export { default as RiskMatrix } from './RiskMatrix';
export { default as PopulationMetrics } from './PopulationMetrics';
export { default as PredictiveAlerts } from './PredictiveAlerts';
export { default as AIPatientList } from './AIPatientList';
export { default as QualityMetrics } from './QualityMetrics';

// Re-export types
export type {
  DashboardProps,
  PopulationOverview,
  RiskMatrixData,
  PredictiveAlert,
  InterventionQueueItem,
  ResourceAllocationItem,
  PopulationDashboard,
  QualityMetricsData,
  AIPatientData,
  EnhancedPatientData,
  AutomatedReports,
  DashboardState,
  AlertConfig,
  QuickActionContext,
} from './FhirAiDashboard.types';
