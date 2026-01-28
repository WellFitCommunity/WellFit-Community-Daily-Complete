// src/routes/lazyComponents.tsx
// Organized lazy imports for all route components
import React from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC PAGES
// ═══════════════════════════════════════════════════════════════════════════════
export const WelcomePage = React.lazy(() => import('../pages/WelcomePage'));
export const RegisterPage = React.lazy(() => import('../pages/RegisterPage'));
export const VerifyCodePage = React.lazy(() => import('../pages/VerifyCodePage'));
export const LoginPage = React.lazy(() => import('../pages/LoginPage'));
export const AdminLoginPage = React.lazy(() => import('../pages/AdminLoginPage'));
export const EnvisionLoginPage = React.lazy(() => import('../pages/EnvisionLoginPage'));
export const EnvisionTotpSetupPage = React.lazy(() => import('../pages/EnvisionTotpSetupPage'));
export const MetricsPage = React.lazy(() => import('../pages/MetricsPage'));
export const DemoPage = React.lazy(() => import('../pages/DemoPage'));

// Legal/Static
export const PrivacyPolicy = React.lazy(() => import('../pages/PrivacyPolicy'));
export const TermsOfService = React.lazy(() => import('../pages/TermsOfService'));

// Auth Flow
export const ChangePasswordPage = React.lazy(() => import('../pages/ChangePasswordPage'));
export const ResetPasswordPage = React.lazy(() => import('../pages/ResetPasswordPage'));

// ═══════════════════════════════════════════════════════════════════════════════
// PROTECTED USER PAGES
// ═══════════════════════════════════════════════════════════════════════════════
export const Home = React.lazy(() => import('../pages/Home'));
export const DashboardPage = React.lazy(() => import('../pages/DashboardPage'));
export const HealthTrackerPage = React.lazy(() => import('../pages/HealthTrackerPage'));
export const HealthInsightsPage = React.lazy(() => import('../pages/HealthInsightsPage'));
export const MyHealthHubPage = React.lazy(() => import('../pages/MyHealthHubPage'));
export const HealthObservationsPage = React.lazy(() => import('../pages/HealthObservationsPage'));
export const ImmunizationsPage = React.lazy(() => import('../pages/ImmunizationsPage'));
export const CarePlansPage = React.lazy(() => import('../pages/CarePlansPage'));
export const AllergiesPage = React.lazy(() => import('../pages/AllergiesPage'));
export const ConditionsPage = React.lazy(() => import('../pages/ConditionsPage'));
export const MedicationManagementPage = React.lazy(() => import('../pages/MedicationManagementPage'));
export const TelehealthAppointmentsPage = React.lazy(() => import('../pages/TelehealthAppointmentsPage'));
export const VitalCapturePage = React.lazy(() => import('../pages/VitalCapturePage'));

// Activities & Engagement
export const QuestionsPage = React.lazy(() => import('../pages/QuestionsPage'));
export const EnhancedQuestionsPage = React.lazy(() => import('../pages/EnhancedQuestionsPage'));
export const CheckInPage = React.lazy(() => import('../pages/CheckInPage'));
export const WordFindPage = React.lazy(() => import('../pages/WordFindPage'));
export const MemoryLaneTriviaPage = React.lazy(() => import('../pages/MemoryLaneTriviaPage'));
export const MealDetailPage = React.lazy(() => import('../pages/MealDetailPage'));

// Profile & Settings
export const HelpPage = React.lazy(() => import('../pages/AIHelpPage'));
export const SettingsPage = React.lazy(() => import('../pages/SettingsPage'));
export const ProfilePage = React.lazy(() => import('../pages/ProfilePage'));
export const DemographicsPage = React.lazy(() => import('../pages/DemographicsPage'));
export const LogoutPage = React.lazy(() => import('../pages/LogoutPage'));

// Consent
export const ConsentPhotoPage = React.lazy(() => import('../pages/ConsentPhotoPage'));
export const ConsentPrivacyPage = React.lazy(() => import('../pages/ConsentPrivacyPage'));
export const ConsentManagementPage = React.lazy(() => import('../pages/ConsentManagementPage'));
export const SelfReportingPage = React.lazy(() => import('../pages/SelfReportingPage'));
export const DoctorsViewPage = React.lazy(() => import('../pages/DoctorsViewPage'));
export const SmartCallbackPage = React.lazy(() => import('../pages/SmartCallbackPage'));

// ═══════════════════════════════════════════════════════════════════════════════
// CAREGIVER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
export const CaregiverDashboardPage = React.lazy(() => import('../pages/CaregiverDashboardPage'));
export const SetCaregiverPinPage = React.lazy(() => import('../pages/SetCaregiverPinPage'));
export const CaregiverAccessPage = React.lazy(() => import('../pages/CaregiverAccessPage'));
export const SeniorViewPage = React.lazy(() => import('../pages/SeniorViewPage'));
export const SeniorReportsPage = React.lazy(() => import('../pages/SeniorReportsPage'));

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
export const AdminPanel = React.lazy(() => import('../components/admin/IntelligentAdminPanel'));
export const AdminProfileEditorPage = React.lazy(() => import('../pages/AdminProfileEditorPage'));
export const AdminQuestionsPage = React.lazy(() => import('../pages/AdminQuestionsPage'));
export const AdminSettingsPage = React.lazy(() => import('../pages/AdminSettingsPage'));
export const AuditLogsPage = React.lazy(() => import('../pages/AuditLogsPage'));
export const SystemAdministrationPage = React.lazy(() => import('../pages/SystemAdministrationPage'));
export const TenantITDashboard = React.lazy(() => import('../pages/TenantITDashboard'));
export const EnrollSeniorPage = React.lazy(() => import('../pages/EnrollSeniorPage'));
export const BulkEnrollmentPanel = React.lazy(() => import('../components/admin/BulkEnrollmentPanel'));
export const BulkExportPanel = React.lazy(() => import('../components/admin/BulkExportPanel'));
export const PhotoApprovalPage = React.lazy(() => import('../pages/PhotoApprovalPage'));
export const ApiKeyManager = React.lazy(() => import('../components/admin/ApiKeyManager'));
export const ReportsPrintPage = React.lazy(() => import('../pages/ReportsPrintPage'));
export const TemplateMaker = React.lazy(() =>
  import('../components/admin/TemplateMaker').then(m => ({ default: m.TemplateMaker }))
);

// Billing & Finance
export const BillingDashboard = React.lazy(() => import('../components/admin/BillingDashboard'));
export const BillingReviewDashboard = React.lazy(() =>
  import('../components/billing/BillingReviewDashboard').then(m => ({ default: m.BillingReviewDashboard }))
);
export const AIAccuracyDashboard = React.lazy(() => import('../components/admin/AIAccuracyDashboard'));
export const AICostDashboard = React.lazy(() => import('../components/admin/AICostDashboard'));
export const RevenueDashboard = React.lazy(() => import('../components/atlas/RevenueDashboard'));
export const AIRevenueDashboard = React.lazy(() => import('../components/ai/AIRevenueDashboard'));

// Consolidated Dashboards (H3 Remediation)
export const AIFinancialDashboard = React.lazy(() => import('../components/admin/AIFinancialDashboard'));
export const SOC2ComplianceDashboard = React.lazy(() => import('../components/admin/SOC2ComplianceDashboard'));

// SAFER Guides (ONC Certification)
export const SaferGuidesAssessment = React.lazy(() => import('../components/admin/SaferGuidesAssessment'));

// Healthcare Algorithms
export const HealthcareAlgorithmsDashboard = React.lazy(() => import('../components/ai/HealthcareAlgorithmsDashboard'));
export const FHIRConflictResolution = React.lazy(() =>
  import('../components/admin/FHIRConflictResolution').then(m => ({ default: m.FHIRConflictResolution }))
);

// Time Clock
export const TimeClockPage = React.lazy(() => import('../components/time-clock/TimeClockPage'));
export const TimeClockAdmin = React.lazy(() => import('../components/admin/TimeClockAdmin'));

// Guardian Agent
export const GuardianAgentDashboard = React.lazy(() => import('../components/admin/GuardianAgentDashboard'));

// SMART on FHIR
export const SmartAppManagementPanel = React.lazy(() => import('../components/admin/SmartAppManagementPanel'));

// ═══════════════════════════════════════════════════════════════════════════════
// SUPER ADMIN COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
export const SuperAdminDashboard = React.lazy(() => import('../components/superAdmin/SuperAdminDashboard'));
export const MultiTenantSelector = React.lazy(() => import('../components/superAdmin/MultiTenantSelector'));
export const MultiTenantMonitor = React.lazy(() => import('../components/superAdmin/MultiTenantMonitor'));
export const SOCDashboard = React.lazy(() => import('../components/soc/SOCDashboard'));
export const EnterpriseMigrationDashboard = React.lazy(() => import('../components/migration/EnterpriseMigrationDashboard'));
export const GuardianApprovalsList = React.lazy(() =>
  import('../components/guardian/GuardianApprovalsList').then(m => ({ default: m.GuardianApprovalsList }))
);
export const GuardianApprovalForm = React.lazy(() =>
  import('../components/guardian/GuardianApprovalForm').then(m => ({ default: m.GuardianApprovalForm }))
);

// ═══════════════════════════════════════════════════════════════════════════════
// CLINICAL DASHBOARDS
// ═══════════════════════════════════════════════════════════════════════════════
export const NursePanel = React.lazy(() => import('../components/nurse/NursePanel'));
export const PhysicianPanel = React.lazy(() => import('../components/physician/PhysicianPanel'));
export const CaseManagerPanel = React.lazy(() => import('../components/case-manager/CaseManagerPanel'));
export const SocialWorkerPanel = React.lazy(() => import('../components/social-worker/SocialWorkerPanel'));
export const ERDashboardPage = React.lazy(() => import('../pages/ERDashboardPage'));
export const ClinicalAlertsDashboard = React.lazy(() => import('../components/alerts/ClinicalAlertsDashboard'));
export const CommunityReadmissionDashboard = React.lazy(() => import('../components/community/CommunityReadmissionDashboard'));

// AI Medical Scribe
export const CompassRileyPage = React.lazy(() => import('../components/smart/RealTimeSmartScribe'));

// Neuro Suite
export const NeuroSuiteDashboard = React.lazy(() => import('../components/neuro/NeuroSuiteDashboard'));
export const MemoryClinicDashboard = React.lazy(() => import('../components/neuro-suite/MemoryClinicDashboard'));
export const MentalHealthDashboard = React.lazy(() => import('../components/mental-health/MentalHealthDashboard'));

// Medication Management (Admin)
export const MedicationManager = React.lazy(() => import('../components/admin/MedicationManager'));

// Specialty Care
export const PhysicalTherapyDashboard = React.lazy(() => import('../components/physicalTherapy/PhysicalTherapyDashboard'));
export const CareCoordinationDashboard = React.lazy(() => import('../components/careCoordination/CareCoordinationDashboard'));
export const ReferralsDashboard = React.lazy(() => import('../components/referrals/ReferralsDashboard'));
export const QuestionnaireAnalyticsDashboard = React.lazy(() => import('../components/questionnaires/QuestionnaireAnalyticsDashboard'));
export const HealthcareIntegrationsDashboard = React.lazy(() => import('../components/healthcareIntegrations/HealthcareIntegrationsDashboard'));

// Population Health
export const FrequentFlyerDashboard = React.lazy(() => import('../components/atlas/FrequentFlyerDashboard'));
export const DischargedPatientDashboard = React.lazy(() => import('../components/discharge/DischargedPatientDashboard'));

// Specialist
export const SpecialistDashboard = React.lazy(() =>
  import('../components/specialist/SpecialistDashboard').then(m => ({ default: m.SpecialistDashboard }))
);
export const FieldVisitWorkflow = React.lazy(() =>
  import('../components/specialist/FieldVisitWorkflow').then(m => ({ default: m.FieldVisitWorkflow }))
);

// Patient Components
export const MedicineCabinet = React.lazy(() => import('../components/patient/MedicineCabinet'));
export const WearableDashboard = React.lazy(() => import('../components/patient/WearableDashboard'));
export const CommunityMoments = React.lazy(() => import('../components/CommunityMoments'));
export const DentalHealthDashboard = React.lazy(() => import('../components/dental/DentalHealthDashboard'));

// Connected Devices & Health Records
export const SmartScalePage = React.lazy(() => import('../pages/devices/SmartScalePage'));
export const BloodPressureMonitorPage = React.lazy(() => import('../pages/devices/BloodPressureMonitorPage'));
export const GlucometerPage = React.lazy(() => import('../pages/devices/GlucometerPage'));
export const PulseOximeterPage = React.lazy(() => import('../pages/devices/PulseOximeterPage'));
export const HealthRecordsDownloadPage = React.lazy(() => import('../pages/HealthRecordsDownloadPage'));

// ═══════════════════════════════════════════════════════════════════════════════
// CHW (Community Health Worker) COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
export const CHWDashboardPage = React.lazy(() => import('../pages/CHWDashboardPage'));
export const KioskCheckIn = React.lazy(() => import('../components/chw/KioskCheckIn'));
export const CHWVitalsCapture = React.lazy(() => import('../components/chw/CHWVitalsCapture'));
export const MedicationPhotoCapture = React.lazy(() => import('../components/chw/MedicationPhotoCapture'));
export const SDOHAssessment = React.lazy(() => import('../components/chw/SDOHAssessment'));
export const TelehealthLobby = React.lazy(() => import('../components/chw/TelehealthLobby'));
export const ProviderAvailabilityEditor = React.lazy(() => import('../components/telehealth/ProviderAvailabilityEditor'));
export const AppointmentAnalyticsDashboard = React.lazy(() => import('../components/telehealth/AppointmentAnalyticsDashboard'));
export const KioskDashboard = React.lazy(() => import('../components/chw/KioskDashboard'));

// ═══════════════════════════════════════════════════════════════════════════════
// WORKFLOW COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
export const ShiftHandoffDashboard = React.lazy(() => import('../components/nurse/ShiftHandoffDashboard'));
export const BedManagementPanel = React.lazy(() => import('../components/admin/BedManagementPanel'));
export const AdminTransferLogs = React.lazy(() => import('../components/handoff/AdminTransferLogs'));
export const ReceivingDashboard = React.lazy(() => import('../components/handoff/ReceivingDashboard'));
export const HospitalTransferPortal = React.lazy(() => import('../pages/HospitalTransferPortal'));
export const StaffWellnessDashboard = React.lazy(() => import('../pages/StaffWellnessDashboard'));

// Law Enforcement
export const LawEnforcementLandingPage = React.lazy(() => import('../pages/LawEnforcementLandingPage'));
export const ConstableDispatchDashboard = React.lazy(() => import('../components/lawEnforcement/ConstableDispatchDashboard'));

// ═══════════════════════════════════════════════════════════════════════════════
// EMS COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
export const EMSPage = React.lazy(() => import('../pages/EMSPage'));
export const EMSMetricsDashboard = React.lazy(() => import('../components/ems/EMSMetricsDashboard'));
export const CoordinatedResponseDashboard = React.lazy(() => import('../components/ems/CoordinatedResponseDashboard'));

// ═══════════════════════════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
export const SmartBackButton = React.lazy(() => import('../components/ui/SmartBackButton'));

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT MAP (for dynamic route rendering)
// ═══════════════════════════════════════════════════════════════════════════════
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Component registry accepts varied prop types
export const componentMap: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  // Public
  WelcomePage,
  RegisterPage,
  VerifyCodePage,
  LoginPage,
  AdminLoginPage,
  EnvisionLoginPage,
  EnvisionTotpSetupPage,
  MetricsPage,
  DemoPage,
  PrivacyPolicy,
  TermsOfService,
  ChangePasswordPage,
  ResetPasswordPage,
  Home,

  // Protected User
  DashboardPage,
  HealthTrackerPage,
  HealthInsightsPage,
  MyHealthHubPage,
  HealthObservationsPage,
  ImmunizationsPage,
  CarePlansPage,
  AllergiesPage,
  ConditionsPage,
  MedicationManagementPage,
  TelehealthAppointmentsPage,
  VitalCapturePage,
  QuestionsPage,
  EnhancedQuestionsPage,
  CheckInPage,
  WordFindPage,
  MemoryLaneTriviaPage,
  MealDetailPage,
  HelpPage,
  SettingsPage,
  ProfilePage,
  DemographicsPage,
  LogoutPage,
  ConsentPhotoPage,
  ConsentPrivacyPage,
  ConsentManagementPage,
  SelfReportingPage,
  DoctorsViewPage,
  SmartCallbackPage,

  // Caregiver
  CaregiverDashboardPage,
  SetCaregiverPinPage,
  CaregiverAccessPage,
  SeniorViewPage,
  SeniorReportsPage,

  // Admin
  AdminPanel,
  AdminProfileEditorPage,
  AdminQuestionsPage,
  AdminSettingsPage,
  AuditLogsPage,
  SystemAdministrationPage,
  TenantITDashboard,
  EnrollSeniorPage,
  BulkEnrollmentPanel,
  BulkExportPanel,
  PhotoApprovalPage,
  ApiKeyManager,
  ReportsPrintPage,
  BillingDashboard,
  BillingReviewDashboard,
  AIAccuracyDashboard,
  AICostDashboard,
  RevenueDashboard,
  AIRevenueDashboard,
  AIFinancialDashboard,
  SOC2ComplianceDashboard,
  SaferGuidesAssessment,
  HealthcareAlgorithmsDashboard,
  FHIRConflictResolution,
  TimeClockPage,
  TimeClockAdmin,
  GuardianAgentDashboard,
  SmartAppManagementPanel,

  // Super Admin
  SuperAdminDashboard,
  MultiTenantSelector,
  MultiTenantMonitor,
  SOCDashboard,
  GuardianApprovalsList,
  GuardianApprovalForm,

  // Clinical
  NursePanel,
  PhysicianPanel,
  CaseManagerPanel,
  SocialWorkerPanel,
  ERDashboardPage,
  ClinicalAlertsDashboard,
  CommunityReadmissionDashboard,
  CompassRileyPage,
  NeuroSuiteDashboard,
  MemoryClinicDashboard,
  MentalHealthDashboard,
  PhysicalTherapyDashboard,
  CareCoordinationDashboard,
  ReferralsDashboard,
  QuestionnaireAnalyticsDashboard,
  HealthcareIntegrationsDashboard,
  FrequentFlyerDashboard,
  DischargedPatientDashboard,
  SpecialistDashboard,
  FieldVisitWorkflow,
  MedicineCabinet,
  WearableDashboard,
  CommunityMoments,
  DentalHealthDashboard,
  SmartScalePage,
  BloodPressureMonitorPage,
  GlucometerPage,
  PulseOximeterPage,
  HealthRecordsDownloadPage,

  // CHW
  CHWDashboardPage,
  KioskCheckIn,
  CHWVitalsCapture,
  MedicationPhotoCapture,
  SDOHAssessment,
  TelehealthLobby,
  ProviderAvailabilityEditor,
  AppointmentAnalyticsDashboard,
  KioskDashboard,

  // Workflow
  ShiftHandoffDashboard,
  BedManagementPanel,
  AdminTransferLogs,
  ReceivingDashboard,
  HospitalTransferPortal,
  StaffWellnessDashboard,
  LawEnforcementLandingPage,
  ConstableDispatchDashboard,

  // EMS
  EMSPage,
  EMSMetricsDashboard,
  CoordinatedResponseDashboard,
};
