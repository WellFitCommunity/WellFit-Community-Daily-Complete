/**
 * Patient Avatar Visualization System
 *
 * Main exports for the avatar component library.
 */

// Main container component
export { PatientAvatar } from './PatientAvatar';
export { default as PatientAvatarComponent } from './PatientAvatar';

// Core display components
export { AvatarBody } from './AvatarBody';
export { AvatarThumbnail } from './AvatarThumbnail';
export { AvatarFullBody } from './AvatarFullBody';
export { AvatarMarker } from './AvatarMarker';
export {
  StatusBadgeRing,
  BadgeLegend,
  BadgeOnboardingTour,
  useBadgeOnboarding,
  BADGE_DESCRIPTIONS,
} from './StatusBadgeRing';

// Page-level components
export { PatientAvatarPage } from './PatientAvatarPage';
export { PatientAvatarProfileSection } from './PatientAvatarProfileSection';
export { CarePlanAvatarView } from './CarePlanAvatarView';

// Form components
export { MarkerForm } from './MarkerForm';
export { MarkerDetailPopover } from './MarkerDetailPopover';
export { AvatarSettingsForm } from './AvatarSettingsForm';

// Hooks
export { usePatientAvatar } from './hooks/usePatientAvatar';
export { usePatientMarkers } from './hooks/usePatientMarkers';
export { useTouchGestures } from './hooks/useTouchGestures';

// Styles (import for side effects)
export * from './styles';

// Utilities
export * from './utils';

// Constants
export { SKIN_TONE_COLORS, SKIN_TONES, SKIN_TONE_LABELS } from './constants/skinTones';
export { ALL_BODY_REGIONS, BODY_REGIONS_FRONT, BODY_REGIONS_BACK, getBodyRegion, findClosestBodyRegion } from './constants/bodyRegions';
export {
  MARKER_TYPE_LIBRARY,
  MARKER_TYPE_GROUPS,
  getMarkerTypeDefinition,
  findMarkerTypeByKeywords,
  calculateMarkerPosition,
  getStatusBadgeTypes,
  getAnatomicalMarkerTypes,
  calculateMarkerPriority,
  getTopPriorityMarkers,
} from './constants/markerTypeLibrary';

// Re-export types
export type {
  SkinTone,
  GenderPresentation,
  BodyView,
  MarkerCategory,
  MarkerSource,
  MarkerStatus,
  MarkerDetails,
  PatientAvatar as PatientAvatarType,
  PatientMarker,
  PatientMarkersResponse,
  PatientMarkerHistory,
  MarkerTypeDefinition,
  MarkerTypeGroup,
  BodyRegion,
  PatientAvatarProps,
  AvatarBodyProps,
  AvatarMarkerProps,
  MarkerDetailPopoverProps,
} from '../../types/patientAvatar';
