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

// Pregnancy-specific components
export { PregnancyAvatarBody } from './PregnancyAvatarBody';

// Hooks
export { usePatientAvatar } from './hooks/usePatientAvatar';
export { usePatientMarkers } from './hooks/usePatientMarkers';
export { usePregnancyAvatar } from './hooks/usePregnancyAvatar';
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
export { OBSTETRIC_ANATOMICAL_TYPES, OBSTETRIC_BADGE_TYPES, ALL_PREGNANCY_MARKER_TYPES } from './constants/pregnancyMarkerTypes';
export { ALL_PREGNANCY_BODY_REGIONS } from './constants/pregnancyBodyRegions';

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
  PregnancyAvatarContext,
} from '../../types/patientAvatar';
