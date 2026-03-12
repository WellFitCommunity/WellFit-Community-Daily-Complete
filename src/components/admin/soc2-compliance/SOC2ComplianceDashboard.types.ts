/**
 * SOC2 Compliance Dashboard Types
 *
 * Shared type definitions for the SOC2 compliance dashboard sub-modules.
 */

import type {
  PHIAccessAudit,
  AuditSummaryStats,
  ComplianceStatus,
  SecurityMetrics,
  SecurityEvent,
  IncidentResponseItem,
} from '../../../services/soc2MonitoringService';

export type TabValue = 'audit' | 'security' | 'incidents';

export type FilterRiskLevel = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type FilterSeverity = 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type FilterStatus = 'ALL' | 'OPEN' | 'RESOLVED';

export interface SOC2DashboardState {
  // Tab state
  activeTab: TabValue;
  setActiveTab: (tab: TabValue) => void;

  // Loading states
  loading: boolean;
  refreshing: boolean;
  lastRefresh: Date;

  // Polling state
  pollingPaused: boolean;
  accessDenied: boolean;

  // Audit Trail State
  phiAccess: PHIAccessAudit[];
  auditStats: AuditSummaryStats[];
  complianceStatus: ComplianceStatus[];
  filterRiskLevel: FilterRiskLevel;
  setFilterRiskLevel: (level: FilterRiskLevel) => void;

  // Security Events State
  securityMetrics: SecurityMetrics | null;
  recentEvents: SecurityEvent[];

  // Incident Response State
  incidents: IncidentResponseItem[];
  filterSeverity: FilterSeverity;
  setFilterSeverity: (severity: FilterSeverity) => void;
  filterStatus: FilterStatus;
  setFilterStatus: (status: FilterStatus) => void;
  selectedIncident: IncidentResponseItem | null;
  setSelectedIncident: (incident: IncidentResponseItem | null) => void;
  resolution: string;
  setResolution: (resolution: string) => void;
  submittingResolution: boolean;

  // Actions
  handleRefresh: () => Promise<void>;
  handleResolveIncident: () => Promise<void>;

  // Format helpers
  formatTimestamp: (timestamp: string) => string;
  formatTimeAgo: (timestamp: string) => string;
  formatHoursSince: (hours: number) => string;

  // Computed values
  compliantControls: number;
  totalControls: number;
  complianceScore: number;
  filteredPHIAccess: PHIAccessAudit[];
  filteredIncidents: IncidentResponseItem[];
  slaBreachCount: number;
  criticalOpenCount: number;
  highOpenCount: number;
  totalOpenIncidents: number;
}

// Re-export service types for convenience
export type {
  PHIAccessAudit,
  AuditSummaryStats,
  ComplianceStatus,
  SecurityMetrics,
  SecurityEvent,
  IncidentResponseItem,
};
