// ============================================================================
// Shift Handoff Dashboard - Shared Types
// ============================================================================

import type {
  ShiftHandoffSummary,
  HandoffDashboardMetrics,
  ShiftType,
  RiskLevel,
} from '../../../types/shiftHandoff';
import type { AIShiftSummary } from '../../../services/shiftHandoffService';
import type { PresenceUser } from '../../../hooks/usePresence';

export type RiskFilter = 'high' | 'critical' | 'all';

export interface PatientCardActions {
  onConfirm: (riskScoreId: string, patientId: string) => void;
  onEscalate: (riskScoreId: string, patientId: string) => void;
  onDeEscalate: (riskScoreId: string, patientId: string) => void;
  onSelect: (patient: ShiftHandoffSummary) => void;
  onToggleSelection: (patientId: string) => void;
}

export interface HandoffHeaderProps {
  shiftType: ShiftType;
  riskFilter: RiskFilter;
  metrics: HandoffDashboardMetrics | null;
  selectedCount: number;
  unitFilter: string;
  availableUnits: string[];
  otherUsers: PresenceUser[];
  onShiftChange: (shift: ShiftType) => void;
  onRiskFilterChange: (filter: RiskFilter) => void;
  onAcceptHandoff: () => void;
  onBulkConfirm: () => void;
  onClearSelection: () => void;
  onUnitFilterChange: (unit: string) => void;
}

export interface PatientCardListProps {
  patients: ShiftHandoffSummary[];
  selectedPatients: Set<string>;
  actions: PatientCardActions;
}

export interface AISummaryPanelProps {
  summary: AIShiftSummary | null;
  loading: boolean;
}

// Re-export commonly used types
export type { ShiftHandoffSummary, HandoffDashboardMetrics, ShiftType, RiskLevel, AIShiftSummary };
