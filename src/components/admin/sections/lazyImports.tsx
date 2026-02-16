/**
 * Lazy-loaded admin panel component imports
 * Extracted from sectionDefinitions.tsx for 600-line compliance
 */

import { lazy } from 'react';

// Core admin
export const UsersList = lazy(() => import('../UsersList'));
export const ReportsSection = lazy(() => import('../ReportsSection'));
export const ExportCheckIns = lazy(() => import('../ExportCheckIns'));

// FHIR & Clinical Data
export const FhirAiDashboard = lazy(() => import('../FhirAiDashboard'));
export const FHIRFormBuilderEnhanced = lazy(() => import('../FHIRFormBuilderEnhanced'));
export const FHIRDataMapper = lazy(() => import('../FHIRDataMapper'));

// Revenue & Billing
export const BillingDashboard = lazy(() => import('../BillingDashboard'));
export const SmartScribe = lazy(() => import('../../smart/RealTimeSmartScribe'));
export const SDOHCoderAssist = lazy(() => import('../../billing/SDOHCoderAssist'));
export const CCMTimeline = lazy(() => import('../../atlas/CCMTimeline'));
export const RevenueDashboard = lazy(() => import('../../atlas/RevenueDashboard'));
export const ClaimsSubmissionPanel = lazy(() => import('../../atlas/ClaimsSubmissionPanel'));
export const ClaimsAppealsPanel = lazy(() => import('../../atlas/ClaimsAppealsPanel'));
export const PriorAuthDashboard = lazy(() => import('../PriorAuthDashboard'));
export const StaffFinancialSavingsTracker = lazy(() => import('../StaffFinancialSavingsTracker'));
export const SuperbillReviewPanel = lazy(() => import('../SuperbillReviewPanel'));
export const ClaimAgingDashboard = lazy(() => import('../ClaimAgingDashboard'));

// Patient Care
export const AdminTransferLogs = lazy(() => import('../../handoff/AdminTransferLogs'));
export const PatientEngagementDashboard = lazy(() => import('../PatientEngagementDashboard'));
export const HospitalPatientEnrollment = lazy(() => import('../HospitalPatientEnrollment'));
export const PaperFormScanner = lazy(() => import('../PaperFormScanner'));

// Clinical Specialties
export const CardiologyDashboard = lazy(() => import('../../cardiology/CardiologyDashboard'));
export const LaborDeliveryDashboard = lazy(() => import('../../labor-delivery/LaborDeliveryDashboard'));
export const OncologyDashboard = lazy(() => import('../../oncology/OncologyDashboard'));
export const QualityMeasuresDashboard = lazy(() => import('../quality-measures'));
export const PublicHealthReportingDashboard = lazy(() => import('../PublicHealthReportingDashboard'));

// AI & Care Gap
export const CareGapDashboard = lazy(() => import('../CareGapDashboard'));
export const ClinicalNoteSummaryDashboard = lazy(() => import('../ClinicalNoteSummaryDashboard'));
export const AIModelCardsDashboard = lazy(() => import('../AIModelCardsDashboard'));

// Security & Compliance
export const TenantSecurityDashboard = lazy(() => import('../TenantSecurityDashboard'));
export const TenantAuditLogs = lazy(() => import('../TenantAuditLogs'));
export const TenantComplianceReport = lazy(() => import('../TenantComplianceReport'));
export const TenantModuleConfigPanel = lazy(() => import('../TenantModuleConfigPanel').then(m => ({ default: m.TenantModuleConfigPanel })));
export const FacilityManagementPanel = lazy(() => import('../FacilityManagementPanel'));
export const MfaComplianceDashboard = lazy(() => import('../MfaComplianceDashboard'));
export const BreachNotificationDashboard = lazy(() => import('../BreachNotificationDashboard'));
export const BAATrackingDashboard = lazy(() => import('../BAATrackingDashboard'));
export const PatientAmendmentReviewQueue = lazy(() => import('../PatientAmendmentReviewQueue'));
export const TrainingComplianceDashboard = lazy(() => import('../TrainingComplianceDashboard'));

// Phase 1 Clinical Safety (P1-P8)
export const ProviderAssignmentDashboard = lazy(() => import('../ProviderAssignmentDashboard'));
export const UnacknowledgedResultsDashboard = lazy(() => import('../UnacknowledgedResultsDashboard'));
export const ProviderTaskQueueDashboard = lazy(() => import('../ProviderTaskQueueDashboard'));
export const ReferralAgingDashboard = lazy(() => import('../ReferralAgingDashboard'));
export const EncounterAuditTimeline = lazy(() => import('../EncounterAuditTimeline'));
export const ResultEscalationDashboard = lazy(() => import('../ResultEscalationDashboard'));
export const ProviderCoverageDashboard = lazy(() => import('../ProviderCoverageDashboard'));

// Phase 2 Revenue (P4)
export const UndercodingDetectionDashboard = lazy(() => import('../UndercodingDetectionDashboard'));

// Phase 2 Encounter-to-Payment Chain
export const BillingQueueDashboard = lazy(() => import('../BillingQueueDashboard'));
export const EligibilityVerificationPanel = lazy(() => import('../EligibilityVerificationPanel'));
export const ERAPaymentPostingDashboard = lazy(() => import('../ERAPaymentPostingDashboard'));
export const ClaimResubmissionDashboard = lazy(() => import('../ClaimResubmissionDashboard'));
