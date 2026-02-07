/**
 * Barrel re-exports for the readmission dashboard sub-components.
 */

export { ReadmissionMetricCards, MetricCard } from './ReadmissionMetricCards';
export { ReadmissionOverviewTab } from './ReadmissionOverviewTab';
export { ReadmissionMembersTab } from './ReadmissionMembersTab';
export { ReadmissionAlertsTab } from './ReadmissionAlertsTab';
export { ReadmissionSdohTab } from './ReadmissionSdohTab';
export { ReadmissionEngagementTab } from './ReadmissionEngagementTab';
export { MemberDetailModal } from './MemberDetailModal';

export type {
  CommunityMember,
  DashboardMetrics,
  CommunityAlert,
  SDOHSummary,
} from './CommunityReadmission.types';

export {
  getRiskColor,
  getRiskBgColor,
  aggregateSdohFactors,
  parseSdohFactors,
} from './CommunityReadmission.types';
