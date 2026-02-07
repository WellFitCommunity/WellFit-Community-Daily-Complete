/**
 * Barrel re-exports for the bed-board sub-components.
 */

export { BedBoardHeader } from './BedBoardHeader';
export { BedBoardMetricCards } from './BedBoardMetricCards';
export { BedBoardRealTimeTab } from './BedBoardRealTimeTab';
export { BedBoardForecastsTab } from './BedBoardForecastsTab';
export { BedBoardAiReport } from './BedBoardAiReport';
export { BedBoardLearningTab } from './BedBoardLearningTab';
export { BedDetailModal } from './BedDetailModal';
export { BedDischargeModal } from './BedDischargeModal';

export type {
  TabType,
  UnitTypeCategory,
  BedAffirmationType,
  BedUnitGroup,
  PresenceUser,
  WebSpeechRecognitionEvent,
  WebSpeechRecognitionInstance,
  WebSpeechRecognitionConstructor,
  WindowWithSpeechRecognition,
  BedBoardHeaderProps,
  BedBoardMetricCardsProps,
  BedBoardRealTimeTabProps,
  BedBoardForecastsTabProps,
  BedBoardAiReportProps,
  BedBoardLearningTabProps,
  BedDetailModalProps,
  BedDischargeModalProps,
} from './BedBoard.types';

export {
  UNIT_TYPE_CATEGORIES,
  BED_VOICE_COMMANDS,
  DISCHARGE_DISPOSITIONS,
  getAffirmation,
} from './BedBoard.types';
