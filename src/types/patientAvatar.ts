/**
 * Patient Avatar Visualization System - Type Definitions
 *
 * Types for avatar display, markers (devices, conditions, wounds),
 * and SmartScribe integration.
 */

// ============================================================================
// SKIN TONES & GENDER
// ============================================================================

export type SkinTone = 'light' | 'mediumLight' | 'medium' | 'mediumDark' | 'dark';
export type GenderPresentation = 'male' | 'female' | 'neutral';
export type BodyView = 'front' | 'back';

// ============================================================================
// MARKER CATEGORIES
// ============================================================================

/**
 * Marker category determines color coding:
 * - critical (red): Central lines, chest tubes, drains
 * - moderate (yellow): PICC lines, IVs, catheters
 * - informational (blue): Surgical sites, healed wounds, implants
 * - monitoring (purple): CGMs, cardiac monitors
 * - chronic (green): CHF, COPD, diabetes, etc.
 * - neurological (orange): Stroke, Parkinson's, Alzheimer's, etc.
 */
export type MarkerCategory =
  | 'critical'
  | 'moderate'
  | 'informational'
  | 'monitoring'
  | 'chronic'
  | 'neurological';

/**
 * How the marker was created
 */
export type MarkerSource = 'manual' | 'smartscribe' | 'import';

/**
 * Confirmation status for SmartScribe-detected markers
 */
export type MarkerStatus = 'pending_confirmation' | 'confirmed' | 'rejected';

// ============================================================================
// MARKER DETAILS (JSONB content)
// ============================================================================

/**
 * Extended details stored in the `details` JSONB column
 */
export interface MarkerDetails {
  // Dates
  onset_date?: string;
  insertion_date?: string;
  last_assessed?: string;
  expected_removal?: string;

  // Provider info
  assessed_by?: string;
  diagnosing_provider?: string;

  // Care instructions
  care_instructions?: string;
  specifications?: string;

  // Clinical data
  complications_watch?: string[];
  symptoms_monitor?: string[];
  severity_stage?: string;
  related_medications?: string[];
  icd10_code?: string;

  // Notes
  notes?: string;

  // SmartScribe data
  raw_smartscribe_text?: string;
}

// ============================================================================
// PATIENT AVATAR
// ============================================================================

/**
 * Patient avatar display preferences
 */
export interface PatientAvatar {
  id: string;
  patient_id: string;
  skin_tone: SkinTone;
  gender_presentation: GenderPresentation;
  created_at: string;
  updated_at: string;
}

/**
 * Request to update avatar preferences
 */
export interface UpdatePatientAvatarRequest {
  skin_tone?: SkinTone;
  gender_presentation?: GenderPresentation;
}

// ============================================================================
// PATIENT MARKER
// ============================================================================

/**
 * A marker on the patient avatar (device, condition, wound)
 */
export interface PatientMarker {
  id: string;
  patient_id: string;

  // Classification
  category: MarkerCategory;
  marker_type: string;
  display_name: string;

  // Positioning
  body_region: string;
  position_x: number; // 0-100 percentage
  position_y: number; // 0-100 percentage
  body_view: BodyView;

  // SmartScribe integration
  source: MarkerSource;
  source_transcription_id?: string;
  status: MarkerStatus;
  confidence_score?: number;

  // Extended details
  details: MarkerDetails;

  // Status flags
  is_active: boolean;
  requires_attention: boolean;

  // Audit
  created_by?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Request to create a new marker
 */
export interface CreateMarkerRequest {
  patient_id: string;
  category: MarkerCategory;
  marker_type: string;
  display_name: string;
  body_region: string;
  position_x: number;
  position_y: number;
  body_view: BodyView;
  source?: MarkerSource;
  source_transcription_id?: string;
  status?: MarkerStatus;
  confidence_score?: number;
  details?: MarkerDetails;
  requires_attention?: boolean;
}

/**
 * Request to update a marker
 */
export interface UpdateMarkerRequest {
  category?: MarkerCategory;
  marker_type?: string;
  display_name?: string;
  body_region?: string;
  position_x?: number;
  position_y?: number;
  body_view?: BodyView;
  details?: Partial<MarkerDetails>;
  requires_attention?: boolean;
}

// ============================================================================
// MARKER HISTORY
// ============================================================================

export type MarkerHistoryAction =
  | 'created'
  | 'updated'
  | 'deactivated'
  | 'reactivated'
  | 'confirmed'
  | 'rejected'
  | 'position_changed';

/**
 * Audit record for marker changes
 */
export interface PatientMarkerHistory {
  id: string;
  marker_id: string;
  action: MarkerHistoryAction;
  changed_by?: string;
  previous_values?: Partial<PatientMarker>;
  new_values?: Partial<PatientMarker>;
  notes?: string;
  created_at: string;
}

// ============================================================================
// SMARTSCRIBE INTEGRATION
// ============================================================================

export type SmartScribeEntityType = 'device_insertion' | 'device_removal' | 'condition_mention';
export type Laterality = 'left' | 'right' | 'bilateral';

/**
 * Entity detected by SmartScribe from provider dictation
 */
export interface SmartScribeAvatarEntity {
  entity_type: SmartScribeEntityType;
  raw_text: string;
  normalized_type: string;
  confidence: number;
  body_region?: string;
  laterality?: Laterality;
  severity_stage?: string;
  icd10_suggestion?: string;
}

/**
 * SmartScribe output with detected avatar entities
 */
export interface SmartScribeOutputWithEntities {
  transcription_id: string;
  patient_id: string;
  provider_id: string;
  transcript_text: string;
  detected_avatar_entities: SmartScribeAvatarEntity[];
}

// ============================================================================
// MARKER TYPE LIBRARY
// ============================================================================

/**
 * Definition of a marker type in the library
 */
export interface MarkerTypeDefinition {
  type: string;
  display_name: string;
  category: MarkerCategory;
  default_body_region: string;
  default_body_view: BodyView;
  default_position: { x: number; y: number };
  keywords: string[];
  icd10?: string;
  laterality_adjustments?: {
    left?: { x: number; y: number };
    right?: { x: number; y: number };
  };
  /** If true, displayed as badge around avatar instead of on body */
  is_status_badge?: boolean;
  /** Custom badge color (hex) for status badges */
  badge_color?: string;
  /** Icon identifier for badge display */
  badge_icon?: string;
}

/**
 * Grouped marker types for UI display
 */
export interface MarkerTypeGroup {
  label: string;
  category: MarkerCategory;
  types: MarkerTypeDefinition[];
}

// ============================================================================
// BODY REGIONS
// ============================================================================

/**
 * Anatomical body region definition
 */
export interface BodyRegion {
  id: string;
  label: string;
  view: BodyView;
  center: { x: number; y: number };
  bounds?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

// ============================================================================
// COMPONENT PROPS
// ============================================================================

/**
 * Props for the main PatientAvatar component
 */
export interface PatientAvatarProps {
  patientId: string;
  patientName?: string;
  /** Start in compact (thumbnail) or expanded (full-body) mode */
  initialMode?: 'compact' | 'expanded';
  /** Whether to allow editing markers */
  editable?: boolean;
  /** Callback when a marker is clicked */
  onMarkerClick?: (marker: PatientMarker) => void;
  /** Callback when modal is closed */
  onClose?: () => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * Props for the AvatarBody SVG component
 */
export interface AvatarBodyProps {
  skinTone: SkinTone;
  genderPresentation: GenderPresentation;
  view: BodyView;
  size?: 'thumbnail' | 'full';
  className?: string;
}

/**
 * Props for the AvatarMarker component
 */
export interface AvatarMarkerProps {
  marker: PatientMarker;
  isPending?: boolean;
  isHighlighted?: boolean;
  onClick?: (marker: PatientMarker) => void;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Props for the MarkerDetailPopover component
 */
export interface MarkerDetailPopoverProps {
  marker: PatientMarker;
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
  onDeactivate?: () => void;
  anchorPosition?: { x: number; y: number };
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Response from get_patient_markers_with_pending_count RPC
 */
export interface PatientMarkersResponse {
  markers: PatientMarker[];
  pending_count: number;
  attention_count: number;
}

// ============================================================================
// CATEGORY COLORS
// ============================================================================

/**
 * Color mapping for marker categories
 */
export const CATEGORY_COLORS: Record<MarkerCategory, { bg: string; border: string; text: string; pulse: string }> = {
  critical: {
    bg: 'bg-red-500',
    border: 'border-red-400',
    text: 'text-red-400',
    pulse: 'animate-pulse',
  },
  moderate: {
    bg: 'bg-yellow-500',
    border: 'border-yellow-400',
    text: 'text-yellow-400',
    pulse: '',
  },
  informational: {
    bg: 'bg-blue-500',
    border: 'border-blue-400',
    text: 'text-blue-400',
    pulse: '',
  },
  monitoring: {
    bg: 'bg-purple-500',
    border: 'border-purple-400',
    text: 'text-purple-400',
    pulse: '',
  },
  chronic: {
    bg: 'bg-green-500',
    border: 'border-green-400',
    text: 'text-green-400',
    pulse: '',
  },
  neurological: {
    bg: 'bg-orange-500',
    border: 'border-orange-400',
    text: 'text-orange-400',
    pulse: '',
  },
};

/**
 * Category display names
 */
export const CATEGORY_LABELS: Record<MarkerCategory, string> = {
  critical: 'Critical',
  moderate: 'Moderate',
  informational: 'Informational',
  monitoring: 'Monitoring',
  chronic: 'Chronic Condition',
  neurological: 'Neurological',
};
