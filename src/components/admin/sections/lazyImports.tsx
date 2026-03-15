/**
 * Lazy-loaded admin panel component imports
 * Extracted from sectionDefinitions.tsx for 600-line compliance
 */

import { lazy } from 'react';

// Core admin
export const UsersList = lazy(() => import('../UsersList'));
export const ReportsSection = lazy(() => import('../ReportsSection'));
export const ExportCheckIns = lazy(() => import('../ExportCheckIns'));
export const UserRoleManagementPanel = lazy(() => import('../UserRoleManagementPanel'));
export const UserProvisioningPanel = lazy(() => import('../UserProvisioningPanel'));

// FHIR & Clinical Data
export const FhirAiDashboard = lazy(() => import('../FhirAiDashboard'));
export const FHIRFormBuilderEnhanced = lazy(() => import('../FHIRFormBuilderEnhanced'));
export const FHIRDataMapper = lazy(() => import('../FHIRDataMapper'));
export const HL7MessageTestPanel = lazy(() => import('../HL7MessageTestPanel'));

// Revenue & Billing
export const BillingDashboard = lazy(() => import('../BillingDashboard'));
export const BillingProviderForm = lazy(() => import('../BillingProviderForm'));
export const SmartScribe = lazy(() => import('../../smart/RealTimeSmartScribe'));
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
export const ShiftHandoffDashboard = lazy(() => import('../../nurse/ShiftHandoffDashboard'));

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
export const TenantConfigHistory = lazy(() => import('../TenantConfigHistory'));
export const TenantModuleConfigPanel = lazy(() => import('../TenantModuleConfigPanel').then(m => ({ default: m.TenantModuleConfigPanel })));
export const FacilityManagementPanel = lazy(() => import('../FacilityManagementPanel'));
export const ClearinghouseConfigPanel = lazy(() => import('../ClearinghouseConfigPanel').then(m => ({ default: m.ClearinghouseConfigPanel })));
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
export const ReferralCompletionDashboard = lazy(() => import('../ReferralCompletionDashboard'));
export const EncounterAuditTimeline = lazy(() => import('../EncounterAuditTimeline'));
export const ResultEscalationDashboard = lazy(() => import('../ResultEscalationDashboard'));
export const ProviderCoverageDashboard = lazy(() => import('../ProviderCoverageDashboard'));

// Phase 2 Revenue (P4, P7, P8)
export const UndercodingDetectionDashboard = lazy(() => import('../UndercodingDetectionDashboard'));
export const DocumentationGapDashboard = lazy(() => import('../DocumentationGapDashboard'));
export const HCCOpportunityDashboard = lazy(() => import('../HCCOpportunityDashboard'));

// Phase 2 Encounter-to-Payment Chain
export const BillingQueueDashboard = lazy(() => import('../BillingQueueDashboard'));
export const EligibilityVerificationPanel = lazy(() => import('../EligibilityVerificationPanel'));
export const ERAPaymentPostingDashboard = lazy(() => import('../ERAPaymentPostingDashboard'));
export const ClaimResubmissionDashboard = lazy(() => import('../ClaimResubmissionDashboard'));

// MCP Server Health
export const MCPServerHealthPanel = lazy(() => import('../MCPServerHealthPanel'));

// MCP Key Management
export const MCPKeyManagementPanel = lazy(() => import('../MCPKeyManagementPanel'));

// MCP Chain Orchestration
export const MCPChainManagementPanel = lazy(() => import('../mcp-chains/MCPChainManagementPanel'));

// MCP Edge Function Management
export const EdgeFunctionManagementPanel = lazy(() => import('../EdgeFunctionManagementPanel'));

// MCP Chain Cost Panel
export const MCPChainCostPanel = lazy(() => import('../MCPChainCostPanel'));

// MCP Medical Coding
export const MedicalCodingMCPPanel = lazy(() => import('../medical-coding/MedicalCodingMCPPanel'));

// Clinical Validation
export const ClinicalValidationDashboard = lazy(() => import('../clinical-validation'));

// Claude-in-Claude Triage Intelligence
export const ConsolidatedAlertPanel = lazy(() => import('../ConsolidatedAlertPanel'));
export const EscalationOverrideDashboard = lazy(() => import('../EscalationOverrideDashboard'));
