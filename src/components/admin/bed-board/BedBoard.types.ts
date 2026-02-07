/**
 * BedBoard.types.ts — Shared types, constants, and props for bed board sub-components.
 */

import type { BedBoardEntry, UnitCapacity, BedForecast, BedStatus, UnitType, HospitalUnit, PredictionAccuracySummary } from '../../../types/bed';
import type { OptimizationReport } from '../../../services/ai';
import type { AffirmationCategory } from '../../../services/providerAffirmations';
import { getProviderAffirmation } from '../../../services/providerAffirmations';
import type { PresenceUser } from '../../../hooks/usePresence';

// ============================================================================
// WEB SPEECH API TYPES (browser API boundary)
// ============================================================================

export interface WebSpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

export interface WebSpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: WebSpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export interface WebSpeechRecognitionConstructor {
  new(): WebSpeechRecognitionInstance;
}

export type WindowWithSpeechRecognition = Window & {
  webkitSpeechRecognition?: WebSpeechRecognitionConstructor;
  SpeechRecognition?: WebSpeechRecognitionConstructor;
};

// ============================================================================
// TAB & FILTER TYPES
// ============================================================================

export type TabType = 'real-time' | 'forecasts-ai' | 'learning';

export type UnitTypeCategory = 'all' | 'icu' | 'step_down' | 'telemetry' | 'med_surg' | 'emergency' | 'labor_delivery' | 'pediatric' | 'specialty' | 'other';

export const UNIT_TYPE_CATEGORIES: { id: UnitTypeCategory; label: string; types: UnitType[] }[] = [
  { id: 'all', label: 'All Beds', types: [] },
  { id: 'icu', label: 'ICU', types: ['icu', 'picu', 'nicu'] },
  { id: 'step_down', label: 'Step Down', types: ['step_down'] },
  { id: 'telemetry', label: 'Telemetry', types: ['telemetry'] },
  { id: 'med_surg', label: 'Med-Surg', types: ['med_surg'] },
  { id: 'emergency', label: 'ER', types: ['ed', 'ed_holding'] },
  { id: 'labor_delivery', label: 'L&D', types: ['labor_delivery', 'postpartum', 'nursery'] },
  { id: 'pediatric', label: 'Peds', types: ['peds', 'picu', 'nicu'] },
  { id: 'specialty', label: 'Specialty', types: ['cardiac', 'neuro', 'oncology', 'ortho', 'rehab', 'psych'] },
  { id: 'other', label: 'Other', types: ['or', 'pacu', 'observation', 'other'] },
];

// ============================================================================
// VOICE COMMANDS
// ============================================================================

export const BED_VOICE_COMMANDS = [
  { pattern: /mark\s+(?:bed\s+)?(.+?)\s+(?:as\s+)?ready/i, action: 'mark_ready' },
  { pattern: /start\s+cleaning\s+(?:bed\s+)?(.+)/i, action: 'start_cleaning' },
  { pattern: /discharge\s+(?:bed\s+)?(.+?)\s+(?:to\s+)?(.+)?/i, action: 'discharge' },
  { pattern: /show\s+(?:me\s+)?available\s+(?:beds\s+)?(?:in\s+)?(.+)?/i, action: 'filter_available' },
  { pattern: /show\s+(?:me\s+)?(?:all\s+)?(.+?)\s+beds/i, action: 'filter_unit' },
  { pattern: /refresh|update/i, action: 'refresh' },
];

// ============================================================================
// AFFIRMATIONS (ATLUS: Service)
// ============================================================================

export type BedAffirmationType = 'bed_ready' | 'cleaning_started' | 'discharge_complete' | 'admit_complete' | 'bulk_action';

const BED_AFFIRMATION_MAP: Record<BedAffirmationType, AffirmationCategory> = {
  bed_ready: 'task_completed',
  cleaning_started: 'task_completed',
  discharge_complete: 'discharge_complete',
  admit_complete: 'admission_complete',
  bulk_action: 'milestone_reached',
};

export const getAffirmation = (type: BedAffirmationType): string => {
  const category = BED_AFFIRMATION_MAP[type];
  return getProviderAffirmation(category);
};

// ============================================================================
// DISCHARGE DISPOSITIONS
// ============================================================================

export const DISCHARGE_DISPOSITIONS = [
  { value: 'Home', label: 'Home', isPostAcute: false },
  { value: 'Home with Home Health', label: 'Home with Home Health', isPostAcute: false },
  { value: 'Skilled Nursing Facility', label: 'Skilled Nursing Facility (SNF)', isPostAcute: true },
  { value: 'Inpatient Rehab', label: 'Inpatient Rehabilitation', isPostAcute: true },
  { value: 'Long-Term Acute Care', label: 'Long-Term Acute Care (LTAC)', isPostAcute: true },
  { value: 'Hospice', label: 'Hospice Care', isPostAcute: true },
  { value: 'Against Medical Advice', label: 'Against Medical Advice (AMA)', isPostAcute: false },
  { value: 'Expired', label: 'Expired', isPostAcute: false },
  { value: 'Transfer to Another Hospital', label: 'Transfer to Another Hospital', isPostAcute: true },
];

// ============================================================================
// BED GROUP TYPE
// ============================================================================

export interface BedUnitGroup {
  unitId: string;
  unitName: string;
  unitCode: string;
  beds: BedBoardEntry[];
}

// ============================================================================
// SUB-COMPONENT PROPS
// ============================================================================

export type { PresenceUser } from '../../../hooks/usePresence';

export interface BedBoardHeaderProps {
  isVoiceListening: boolean;
  voiceSupported: boolean;
  voiceTranscript: string;
  loading: boolean;
  otherUsers: PresenceUser[];
  onToggleVoice: () => void;
  onRefresh: () => void;
  onNavigateTransferLogs: () => void;
}

export interface BedBoardMetricCardsProps {
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  pendingClean: number;
  overallOccupancy: number;
}

export interface BedBoardRealTimeTabProps {
  bedBoard: BedBoardEntry[];
  bedsByUnit: Record<string, BedUnitGroup>;
  unitCapacity: UnitCapacity[];
  units: HospitalUnit[];
  selectedUnit: string;
  selectedStatus: BedStatus | '';
  searchQuery: string;
  selectedUnitTypeCategory: UnitTypeCategory;
  expandedUnit: string | null;
  onSetUnit: (unit: string) => void;
  onSetStatus: (status: BedStatus | '') => void;
  onSetSearch: (query: string) => void;
  onSetUnitTypeCategory: (cat: UnitTypeCategory) => void;
  onSetExpandedUnit: (unitId: string | null) => void;
  onSelectBed: (bed: BedBoardEntry) => void;
  onUpdateStatus: (bedId: string, status: BedStatus) => void;
  onGenerateForecast: (unitId: string) => void;
  onSetEditing: (editing: boolean, field?: string) => void;
}

export interface BedBoardForecastsTabProps {
  forecasts: BedForecast[];
  aiReport: OptimizationReport | null;
  loadingAiReport: boolean;
  aiError: string | null;
  onGenerateAiReport: () => void;
}

export interface BedBoardAiReportProps {
  aiReport: OptimizationReport;
}

export interface BedBoardLearningTabProps {
  accuracy: PredictionAccuracySummary | null;
  units: HospitalUnit[];
  feedbackUnit: string;
  feedbackDate: string;
  actualCensus: string;
  feedbackNotes: string;
  submittingFeedback: boolean;
  onSetFeedbackUnit: (unit: string) => void;
  onSetFeedbackDate: (date: string) => void;
  onSetActualCensus: (census: string) => void;
  onSetFeedbackNotes: (notes: string) => void;
  onSubmitFeedback: () => void;
}

export interface BedDetailModalProps {
  bed: BedBoardEntry;
  onClose: () => void;
  onUpdateStatus: (bedId: string, status: BedStatus) => void;
  onDischarge: () => void;
  onSetEditing: (editing: boolean, field?: string) => void;
}

export interface BedDischargeModalProps {
  bed: BedBoardEntry;
  dischargeDisposition: string;
  discharging: boolean;
  onSetDisposition: (disposition: string) => void;
  onDischarge: () => void;
  onClose: () => void;
}
