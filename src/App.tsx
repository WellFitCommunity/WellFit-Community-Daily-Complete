// src/App.tsx
import React, { useEffect, useState, Suspense } from 'react';
import { Routes, Route, useLocation, useParams } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { SessionTimeoutProvider } from './contexts/SessionTimeoutContext';
import { TimeClockProvider } from './contexts/TimeClockContext';
import { NavigationHistoryProvider } from './contexts/NavigationHistoryContext';
import { PatientProvider } from './contexts/PatientContext';
import { BrandingConfig, getCurrentBranding } from './branding.config';
import { BrandingContext } from './BrandingContext';
import { performanceMonitor } from './services/performanceMonitoring';
import { GuardianErrorBoundary } from './components/GuardianErrorBoundary';
import { GuardianAgent } from './services/guardian-agent/GuardianAgent';
import { smartRecordingStrategy } from './services/guardian-agent/SmartRecordingStrategy';
import { queryClient } from './lib/queryClient';

// ❌ Do NOT import or use AuthProvider here — it lives in index.tsx
// ❌ Do NOT import or use AdminAuthProvider here — it lives in index.tsx

import AppHeader from './components/layout/AppHeader';
import Footer from './components/layout/Footer';

import RequireAuth from './components/auth/RequireAuth';
import RequireAdminAuth from './components/auth/RequireAdminAuth';
import RequireSuperAdmin from './components/auth/RequireSuperAdmin';

import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import NotFoundPage from './components/NotFoundPage';
import AdminLoginPage from './pages/AdminLoginPage';
import LoginPage from './pages/LoginPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
// If your tsconfig doesn't set baseUrl to "src", change this to './pages/Home'
import Home from 'pages/Home';
import MetricsPage from './pages/MetricsPage';

// ✅ Gate wrapper (does not replace AuthProvider)
import AuthGate from './AuthGate';
import { useSupabaseClient } from './contexts/AuthContext';

// Offline indicator
import OfflineIndicator from './components/OfflineIndicator';

// Voice Command Bar - Global speech recognition UI
import { VoiceCommandBar } from './components/admin/VoiceCommandBar';

// AI Transparency - LearningMilestone (global component)
import { LearningMilestone } from './components/ai-transparency';

// Theme initialization
import { useThemeInit } from './hooks/useTheme';

// Feature Flags
import { featureFlags } from './config/featureFlags';

// Lazy-loaded pages/components
const WelcomePage = React.lazy(() => import('./pages/WelcomePage'));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage'));
const VerifyCodePage = React.lazy(() => import('./pages/VerifyCodePage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const HealthTrackerPage = React.lazy(() => import('./pages/HealthTrackerPage'));
const HelpPage = React.lazy(() => import('./pages/AIHelpPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const CheckInPage = React.lazy(() => import('./pages/CheckInPage'));
const WordFindPage = React.lazy(() => import('./pages/WordFindPage'));
const MealDetailPage = React.lazy(() => import('./pages/MealDetailPage'));
const LogoutPage = React.lazy(() => import('./pages/LogoutPage'));
const ConsentPhotoPage = React.lazy(() => import('./pages/ConsentPhotoPage'));
const ConsentPrivacyPage = React.lazy(() => import('./pages/ConsentPrivacyPage'));
const SelfReportingPage = React.lazy(() => import('./pages/SelfReportingPage'));
const DoctorsViewPage = React.lazy(() => import('./pages/DoctorsViewPage'));
const AdminPanel = React.lazy(() => import('./components/admin/IntelligentAdminPanel'));
const AdminProfileEditorPage = React.lazy(() => import('./pages/AdminProfileEditorPage'));
const SuperAdminDashboard = React.lazy(() => import('./components/superAdmin/SuperAdminDashboard'));
const MultiTenantSelector = React.lazy(() => import('./components/superAdmin/MultiTenantSelector'));
const MultiTenantMonitor = React.lazy(() => import('./components/superAdmin/MultiTenantMonitor'));
const NursePanel = React.lazy(() => import('./components/nurse/NursePanel'));
const PhysicianPanel = React.lazy(() => import('./components/physician/PhysicianPanel'));
const CaseManagerPanel = React.lazy(() => import('./components/case-manager/CaseManagerPanel'));
const SocialWorkerPanel = React.lazy(() => import('./components/social-worker/SocialWorkerPanel'));
const BulkEnrollmentPanel = React.lazy(() => import('./components/admin/BulkEnrollmentPanel'));
const BulkExportPanel = React.lazy(() => import('./components/admin/BulkExportPanel'));
const EnrollSeniorPage = React.lazy(() => import('./pages/EnrollSeniorPage'));
const CommunityMoments = React.lazy(() => import('./components/CommunityMoments'));
const DemographicsPage = React.lazy(() => import('./pages/DemographicsPage'));
const DemoPage = React.lazy(() => import('./pages/DemoPage'));
// TriviaGame removed - use Memory Lane Trivia at /memory-lane-trivia instead
const CaregiverDashboardPage = React.lazy(() => import('./pages/CaregiverDashboardPage'));
const SetCaregiverPinPage = React.lazy(() => import('./pages/SetCaregiverPinPage'));
const CaregiverAccessPage = React.lazy(() => import('./pages/CaregiverAccessPage'));
const SeniorViewPage = React.lazy(() => import('./pages/SeniorViewPage'));
const SeniorReportsPage = React.lazy(() => import('./pages/SeniorReportsPage'));
const HealthInsightsPage = React.lazy(() => import('./pages/HealthInsightsPage'));
const QuestionsPage = React.lazy(() => import('./pages/QuestionsPage'));
const EnhancedQuestionsPage = React.lazy(() => import('./pages/EnhancedQuestionsPage'));
const AdminQuestionsPage = React.lazy(() => import('./pages/AdminQuestionsPage'));
const MemoryLaneTriviaPage = React.lazy(() => import('./pages/MemoryLaneTriviaPage'));
const BillingDashboard = React.lazy(() => import('./components/admin/BillingDashboard'));
const AIAccuracyDashboard = React.lazy(() => import('./components/admin/AIAccuracyDashboard'));
const ClinicalAlertsDashboard = React.lazy(() => import('./components/alerts/ClinicalAlertsDashboard'));
const EnvisionLoginPage = React.lazy(() => import('./pages/EnvisionLoginPage'));
const ApiKeyManager = React.lazy(() => import('./components/admin/ApiKeyManager'));
const PhotoApprovalPage = React.lazy(() => import('./pages/PhotoApprovalPage'));
const SmartCallbackPage = React.lazy(() => import('./pages/SmartCallbackPage'));
const SmartBackButton = React.lazy(() => import('./components/ui/SmartBackButton'));
const HealthObservationsPage = React.lazy(() => import('./pages/HealthObservationsPage'));
const ImmunizationsPage = React.lazy(() => import('./pages/ImmunizationsPage'));
const CarePlansPage = React.lazy(() => import('./pages/CarePlansPage'));
const MedicineCabinet = React.lazy(() => import('./components/patient/MedicineCabinet'));
const MedicationManagementPage = React.lazy(() => import('./pages/MedicationManagementPage'));
const WearableDashboard = React.lazy(() => import('./components/patient/WearableDashboard'));
const AllergiesPage = React.lazy(() => import('./pages/AllergiesPage'));
const ConditionsPage = React.lazy(() => import('./pages/ConditionsPage'));
const MyHealthHubPage = React.lazy(() => import('./pages/MyHealthHubPage'));
const TelehealthAppointmentsPage = React.lazy(() => import('./pages/TelehealthAppointmentsPage'));
// Guardian moved to Edge Functions - components removed
const EMSPage = React.lazy(() => import('./pages/EMSPage'));
const ERDashboardPage = React.lazy(() => import('./pages/ERDashboardPage'));
const ConstableDispatchDashboard = React.lazy(() => import('./components/lawEnforcement/ConstableDispatchDashboard'));
const LawEnforcementLandingPage = React.lazy(() => import('./pages/LawEnforcementLandingPage'));
const DentalHealthDashboard = React.lazy(() => import('./components/dental/DentalHealthDashboard'));
const SystemAdministrationPage = React.lazy(() => import('./pages/SystemAdministrationPage'));
const TenantITDashboard = React.lazy(() => import('./pages/TenantITDashboard'));
const AdminSettingsPage = React.lazy(() => import('./pages/AdminSettingsPage'));
const AuditLogsPage = React.lazy(() => import('./pages/AuditLogsPage'));
const HealthcareAlgorithmsDashboard = React.lazy(() => import('./components/ai/HealthcareAlgorithmsDashboard'));
const AIRevenueDashboard = React.lazy(() => import('./components/ai/AIRevenueDashboard'));

// Previously orphaned components - now wired with feature flags
const ReportsPrintPage = React.lazy(() => import('./pages/ReportsPrintPage'));
const MemoryClinicDashboard = React.lazy(() => import('./components/neuro-suite/MemoryClinicDashboard'));
const MentalHealthDashboard = React.lazy(() => import('./components/mental-health/MentalHealthDashboard'));
const FrequentFlyerDashboard = React.lazy(() => import('./components/atlas/FrequentFlyerDashboard'));
const RevenueDashboard = React.lazy(() => import('./components/atlas/RevenueDashboard'));
const ShiftHandoffDashboard = React.lazy(() => import('./components/nurse/ShiftHandoffDashboard'));
const DischargedPatientDashboard = React.lazy(() => import('./components/discharge/DischargedPatientDashboard'));
const BedManagementPanel = React.lazy(() => import('./components/admin/BedManagementPanel'));
const AdminTransferLogs = React.lazy(() => import('./components/handoff/AdminTransferLogs'));
const NeuroSuiteDashboard = React.lazy(() => import('./components/neuro/NeuroSuiteDashboard'));
// StrokeAssessmentDashboard requires patientId - route would need wrapper component
const SpecialistDashboard = React.lazy(() =>
  import('./components/specialist/SpecialistDashboard').then(m => ({ default: m.SpecialistDashboard }))
);
const FieldVisitWorkflow = React.lazy(() =>
  import('./components/specialist/FieldVisitWorkflow').then(m => ({ default: m.FieldVisitWorkflow }))
);
const FHIRConflictResolution = React.lazy(() =>
  import('./components/admin/FHIRConflictResolution').then(m => ({ default: m.FHIRConflictResolution }))
);
const EMSMetricsDashboard = React.lazy(() => import('./components/ems/EMSMetricsDashboard'));
const CoordinatedResponseDashboard = React.lazy(() => import('./components/ems/CoordinatedResponseDashboard'));

// Compass Riley - AI Medical Scribe (for Methodist demo)
const CompassRileyPage = React.lazy(() => import('./components/smart/RealTimeSmartScribe'));

// Web Vital Capture - multi-modal vital sign capture (manual, camera, BLE)
const VitalCapturePage = React.lazy(() => import('./pages/VitalCapturePage'));

// Physical Therapy, Care Coordination, Referrals, Questionnaires - newly wired dashboards
const PhysicalTherapyDashboard = React.lazy(() => import('./components/physicalTherapy/PhysicalTherapyDashboard'));
const CareCoordinationDashboard = React.lazy(() => import('./components/careCoordination/CareCoordinationDashboard'));
const ReferralsDashboard = React.lazy(() => import('./components/referrals/ReferralsDashboard'));
const QuestionnaireAnalyticsDashboard = React.lazy(() => import('./components/questionnaires/QuestionnaireAnalyticsDashboard'));

// Staff Wellness & Burnout Prevention
const StaffWellnessDashboard = React.lazy(() => import('./pages/StaffWellnessDashboard'));

// Hospital-to-Hospital Transfer Portal
const HospitalTransferPortal = React.lazy(() => import('./pages/HospitalTransferPortal'));

// SOC Dashboard - Security Operations Center for super_admins
const SOCDashboard = React.lazy(() => import('./components/soc/SOCDashboard'));

// Guardian Approvals - Pool Report System for healing actions requiring approval
const GuardianApprovalsList = React.lazy(() =>
  import('./components/guardian/GuardianApprovalsList').then(m => ({ default: m.GuardianApprovalsList }))
);
const GuardianApprovalForm = React.lazy(() =>
  import('./components/guardian/GuardianApprovalForm').then(m => ({ default: m.GuardianApprovalForm }))
);

// Healthcare Integrations (Lab, Pharmacy, Imaging, Insurance)
const HealthcareIntegrationsDashboard = React.lazy(() => import('./components/healthcareIntegrations/HealthcareIntegrationsDashboard'));

// Community Readmission Prevention Dashboard
const CommunityReadmissionDashboard = React.lazy(() => import('./components/community/CommunityReadmissionDashboard'));

// CHW (Community Health Worker) Components
const CHWDashboardPage = React.lazy(() => import('./pages/CHWDashboardPage'));
const KioskCheckIn = React.lazy(() => import('./components/chw/KioskCheckIn'));
const CHWVitalsCapture = React.lazy(() => import('./components/chw/CHWVitalsCapture'));
const MedicationPhotoCapture = React.lazy(() => import('./components/chw/MedicationPhotoCapture'));
const SDOHAssessment = React.lazy(() => import('./components/chw/SDOHAssessment'));
const TelehealthLobby = React.lazy(() => import('./components/chw/TelehealthLobby'));
const KioskDashboard = React.lazy(() => import('./components/chw/KioskDashboard'));

// Time Clock
const TimeClockPage = React.lazy(() => import('./components/time-clock/TimeClockPage'));
const TimeClockAdmin = React.lazy(() => import('./components/admin/TimeClockAdmin'));

function Shell() {
  const [branding, setBranding] = useState<BrandingConfig>(getCurrentBranding());
  const location = useLocation();
  const { supabase, user } = useSupabaseClient() as any;

  // Initialize theme from database/localStorage
  useThemeInit();

  // Initialize performance monitoring
  useEffect(() => {
    if (supabase) {
      performanceMonitor.initialize(supabase, user?.id);
    }
  }, [supabase, user?.id]);

  // Initialize Guardian Agent - Self-healing system with Guardian Eyes recording
  useEffect(() => {
    const guardian = GuardianAgent.getInstance({
      autoHealEnabled: true,
      requireApprovalForCritical: false,
      learningEnabled: true,
      hipaaComplianceMode: true
    });

    guardian.start();

    // Start Guardian Eyes smart recording (1% sampling + all errors/security events)
    // This enables session recording for debugging and AI learning
    smartRecordingStrategy.startSmartRecording(user?.id).catch(() => {
      // Silent fail - recording is optional enhancement
    });

    return () => {
      guardian.stop();
      // Stop Guardian Eyes recording on unmount
      smartRecordingStrategy.stopSmartRecording().catch(() => {});
    };
  }, [user?.id]);

  useEffect(() => {
    setBranding(getCurrentBranding());
  }, [location.pathname]);

  const refreshBranding = async () => {
    setBranding(getCurrentBranding());
  };

  return (
    <GuardianErrorBoundary>
      <BrandingContext.Provider value={{ branding, setBranding, loading: false, refreshBranding }}>
        {/* SessionTimeout applies to the whole app */}
        <SessionTimeoutProvider>
          {/* Time Clock - Auto clock-in on login, prompt on logout */}
          <TimeClockProvider>
            {/* Patient Context - Maintain selected patient across dashboards (ATLUS: Unity) */}
            <PatientProvider>
            {/* Navigation History - Track in-app navigation for reliable back button */}
            <NavigationHistoryProvider>
              {/* Global Learning Milestone Celebration Display */}
              <LearningMilestone />

              <AppHeader />

            <AuthGate>
            <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
              <Routes>
              {/* Public */}
              <Route path="/" element={<WelcomePage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/verify" element={<VerifyCodePage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/change-password" element={<ChangePasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/admin-login" element={<AdminLoginPage />} />
              <Route path="/envision" element={<EnvisionLoginPage />} />
              <Route path="/envision/login" element={<EnvisionLoginPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/metrics" element={<MetricsPage />} />
              <Route path="/home" element={<Home />} />

              {/* Protected */}
              <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
              <Route path="/health-insights" element={<RequireAuth><HealthInsightsPage /></RequireAuth>} />
              <Route path="/health-dashboard" element={<RequireAuth><HealthTrackerPage /></RequireAuth>} />
              <Route path="/my-health" element={<RequireAuth><MyHealthHubPage /></RequireAuth>} />
              <Route path="/telehealth-appointments" element={<RequireAuth><TelehealthAppointmentsPage /></RequireAuth>} />
              <Route path="/health-observations" element={<RequireAuth><HealthObservationsPage /></RequireAuth>} />
              <Route path="/immunizations" element={<RequireAuth><ImmunizationsPage /></RequireAuth>} />
              <Route path="/care-plans" element={<RequireAuth><CarePlansPage /></RequireAuth>} />
              <Route path="/medicine-cabinet" element={<RequireAuth><MedicineCabinet /></RequireAuth>} />
              <Route path="/medication-management" element={<RequireAuth><MedicationManagementPage /></RequireAuth>} />
              <Route path="/wearables" element={<RequireAuth><WearableDashboard /></RequireAuth>} />
              <Route path="/allergies" element={<RequireAuth><AllergiesPage /></RequireAuth>} />
              <Route path="/conditions" element={<RequireAuth><ConditionsPage /></RequireAuth>} />
              <Route path="/dental-health" element={<RequireAuth><DentalHealthDashboard /></RequireAuth>} />
              <Route path="/questions" element={<RequireAuth><QuestionsPage /></RequireAuth>} />
              <Route path="/ask-nurse" element={<RequireAuth><EnhancedQuestionsPage /></RequireAuth>} />
              <Route path="/help" element={<RequireAuth><HelpPage /></RequireAuth>} />
              <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
              <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
              <Route path="/check-in" element={<RequireAuth><CheckInPage /></RequireAuth>} />
              <Route path="/vital-capture" element={<RequireAuth><VitalCapturePage /></RequireAuth>} />
              <Route path="/word-find" element={<RequireAuth><WordFindPage /></RequireAuth>} />
              <Route path="/memory-lane-trivia" element={<RequireAuth><MemoryLaneTriviaPage /></RequireAuth>} />
              <Route path="/meals/:id" element={<RequireAuth><MealDetailPage /></RequireAuth>} />
              <Route path="/logout" element={<RequireAuth><LogoutPage /></RequireAuth>} />
              <Route path="/consent-photo" element={<RequireAuth><ConsentPhotoPage /></RequireAuth>} />
              <Route path="/consent-privacy" element={<RequireAuth><ConsentPrivacyPage /></RequireAuth>} />
              <Route path="/self-reporting" element={<RequireAuth><SelfReportingPage /></RequireAuth>} />
              <Route path="/doctors-view" element={<RequireAuth><DoctorsViewPage /></RequireAuth>} />
              <Route path="/community" element={<RequireAuth><CommunityMoments /></RequireAuth>} />
              {/* /trivia-game removed - use /memory-lane-trivia instead */}
              {/* Add this route in your Routes section (in the Protected section) */}
              <Route path="/smart-callback" element={<RequireAuth><SmartCallbackPage /></RequireAuth>} />

              {/* Time Clock - Employee Portal (feature-flagged) */}
              {featureFlags.timeClock && (
                <Route path="/time-clock" element={<RequireAuth><TimeClockPage /></RequireAuth>} />
              )}

              {/* Demo Showcase (public - for Methodist presentation) */}
              <Route path="/demo" element={<DemoPage />} />

              {/* Compass Riley - AI Medical Scribe (Demo route) */}
              <Route
                path="/compass-riley"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'physician', 'doctor', 'nurse', 'nurse_practitioner', 'physician_assistant']}>
                      <CompassRileyPage />
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />

              {/* Readmissions Dashboard (Demo route) */}
              <Route
                path="/readmissions"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'physician', 'doctor', 'nurse', 'case_manager']}>
                      <CommunityReadmissionDashboard />
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />

              {/* Nurse Panel alias for demo (same as /nurse-dashboard) */}
              <Route
                path="/nurse-panel"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'nurse', 'nurse_practitioner', 'clinical_supervisor']}>
                      <NursePanel />
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />

              {/* Caregiver Suite */}
              {/* Public caregiver access (no auth - PIN-based access) */}
              <Route path="/caregiver-access" element={<CaregiverAccessPage />} />
              <Route path="/senior-view/:seniorId" element={<SeniorViewPage />} />
              <Route path="/senior-reports/:seniorId" element={<SeniorReportsPage />} />
              {/* Legacy: Authenticated caregiver dashboard (role_code 6) */}
              <Route path="/caregiver-dashboard" element={<RequireAuth><CaregiverDashboardPage /></RequireAuth>} />
              <Route path="/set-caregiver-pin" element={<RequireAuth><SetCaregiverPinPage /></RequireAuth>} />

              {/* EMS Prehospital Handoff System */}
              <Route path="/ems" element={<RequireAuth><EMSPage /></RequireAuth>} />
              {/* ER Dashboard - Requires physician/provider role for sign-off authority */}
              <Route
                path="/er-dashboard"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'physician', 'doctor', 'nurse_practitioner', 'physician_assistant', 'nurse']}>
                      <ERDashboardPage />
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />

              {/* Law Enforcement "Are You OK?" Welfare Check Program */}
              {featureFlags.lawEnforcement && (
                <>
                  <Route path="/law-enforcement" element={<LawEnforcementLandingPage />} />
                  <Route
                    path="/constable-dispatch"
                    element={
                      <RequireAuth>
                        <RequireAdminAuth>
                          <ConstableDispatchDashboard />
                        </RequireAdminAuth>
                      </RequireAuth>
                    }
                  />
                </>
              )}

              {/* Post-login gated */}
              <Route path="/demographics" element={<RequireAuth><DemographicsPage /></RequireAuth>} />

              {/* Master Admin Panel (Envision - Cross-tenant Platform Management) */}
              {/* SECURITY: RequireSuperAdmin verifies user is in super_admin_users table */}
              <Route
                path="/super-admin"
                element={
                  <RequireSuperAdmin>
                    <SuperAdminDashboard />
                  </RequireSuperAdmin>
                }
              />

              {/* Multi-Tenant Selector (Envision staff) */}
              {/* SECURITY: Only platform super-admins can access tenant selector */}
              <Route
                path="/tenant-selector"
                element={
                  <RequireSuperAdmin>
                    <MultiTenantSelector />
                  </RequireSuperAdmin>
                }
              />

              {/* Multi-Tenant Monitor (Split-screen view) */}
              {/* SECURITY: Only platform super-admins can monitor all tenants */}
              <Route
                path="/multi-tenant-monitor"
                element={
                  <RequireSuperAdmin>
                    <MultiTenantMonitor />
                  </RequireSuperAdmin>
                }
              />

              {/* SOC Dashboard - Security Operations Center */}
              {/* SECURITY: Only platform super-admins can access security monitoring */}
              <Route
                path="/soc-dashboard"
                element={
                  <RequireSuperAdmin>
                    <SOCDashboard />
                  </RequireSuperAdmin>
                }
              />

              {/* Guardian Approvals - Pool Reports for healing actions requiring human approval */}
              {/* SECURITY: Only platform super-admins can approve Guardian actions */}
              <Route
                path="/guardian/approvals"
                element={
                  <RequireSuperAdmin>
                    <GuardianApprovalsList />
                  </RequireSuperAdmin>
                }
              />
              <Route
                path="/guardian/approval/:ticketId"
                element={
                  <RequireSuperAdmin>
                    <GuardianApprovalForm />
                  </RequireSuperAdmin>
                }
              />

              {/* Admin (requires user + admin pin) */}
              <Route
                path="/admin"
                element={
                  <RequireAuth>
                    <RequireAdminAuth>
                      <AdminPanel />
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin-profile-editor"
                element={
                  <RequireAuth>
                    <RequireAdminAuth>
                      <AdminProfileEditorPage />
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />
              <Route
                path="/nurse-dashboard"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'nurse', 'nurse_practitioner', 'clinical_supervisor']}>
                      <NursePanel />
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />
              <Route
                path="/physician-dashboard"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'physician', 'doctor', 'physician_assistant']}>
                      <PhysicianPanel />
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />
              <Route
                path="/case-manager-dashboard"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'case_manager']}>
                      <CaseManagerPanel />
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />
              <Route
                path="/social-worker-dashboard"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'social_worker']}>
                      <SocialWorkerPanel />
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />

              {/* CHW (Community Health Worker) Routes */}
              <Route
                path="/kiosk/check-in"
                element={
                  <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
                    <KioskCheckIn />
                  </Suspense>
                }
              />
              <Route
                path="/chw/vitals-capture"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'nurse', 'community_health_worker', 'chw']}>
                      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
                        <CHWVitalsCapture />
                      </Suspense>
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />
              <Route
                path="/chw/medication-photo"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'nurse', 'community_health_worker', 'chw']}>
                      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
                        <MedicationPhotoCapture />
                      </Suspense>
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />
              <Route
                path="/chw/sdoh-assessment"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'nurse', 'case_manager', 'social_worker', 'community_health_worker', 'chw']}>
                      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
                        <SDOHAssessment />
                      </Suspense>
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />
              <Route
                path="/chw/telehealth-lobby"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'physician', 'nurse', 'community_health_worker', 'chw']}>
                      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
                        <TelehealthLobby />
                      </Suspense>
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />
              {/* CHW Command Center - Unified dashboard */}
              <Route
                path="/chw/dashboard"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'nurse', 'case_manager', 'community_health_worker', 'chw']}>
                      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
                        <CHWDashboardPage />
                      </Suspense>
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />
              {/* Kiosk Status Monitor */}
              <Route
                path="/chw/kiosk-dashboard"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'nurse', 'community_health_worker', 'chw']}>
                      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
                        <KioskDashboard />
                      </Suspense>
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />

              <Route
                path="/admin/enroll-senior"
                element={
                  <RequireAuth>
                    <RequireAdminAuth>
                      <EnrollSeniorPage />
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/bulk-enroll"
                element={
                  <RequireAuth>
                    <RequireAdminAuth>
                      <BulkEnrollmentPanel />
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/bulk-export"
                element={
                  <RequireAuth>
                    <RequireAdminAuth>
                      <BulkExportPanel />
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin-questions"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'nurse']}>
                      <AdminQuestionsPage />
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />
              <Route
                path="/billing"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['admin', 'super_admin']}>
                      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
                        <div className="min-h-screen bg-gray-50 py-8">
                          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="mb-4">
                              <SmartBackButton />
                            </div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-6">Billing & Claims</h1>
                            <BillingDashboard />
                          </div>
                        </div>
                      </Suspense>
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/api-keys"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['super_admin']}>
                      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
                        <div className="min-h-screen bg-gray-50 py-8">
                          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="mb-4">
                              <SmartBackButton />
                            </div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-6">API Key Manager</h1>
                            <ApiKeyManager />
                          </div>
                        </div>
                      </Suspense>
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/ai-accuracy"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['admin', 'super_admin']}>
                      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
                        <div className="min-h-screen bg-slate-900">
                          <AIAccuracyDashboard />
                        </div>
                      </Suspense>
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/photo-approval"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['admin', 'super_admin']}>
                      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
                        <PhotoApprovalPage />
                      </Suspense>
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />

              {/* Time Clock Admin - Manager/HR View (feature-flagged) */}
              {featureFlags.timeClock && (
                <Route
                  path="/admin/time-clock"
                  element={
                    <RequireAuth>
                      <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'department_head', 'clinical_supervisor']}>
                        <TimeClockAdmin />
                      </RequireAdminAuth>
                    </RequireAuth>
                  }
                />
              )}
              <Route
                path="/admin/settings"
                element={
                  <RequireAuth>
                    <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
                      <AdminSettingsPage />
                    </Suspense>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/audit-logs"
                element={
                  <RequireAuth>
                    <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
                      <AuditLogsPage />
                    </Suspense>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin/system"
                element={
                  <RequireAuth>
                    <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
                      <SystemAdministrationPage />
                    </Suspense>
                  </RequireAuth>
                }
              />
              <Route
                path="/it-admin"
                element={
                  <RequireAuth>
                    <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading...</div>}>
                      <TenantITDashboard />
                    </Suspense>
                  </RequireAuth>
                }
              />
              {featureFlags.adminReports && (
                <Route
                  path="/admin/reports"
                  element={
                    <RequireAuth>
                      <RequireAdminAuth>
                        <ReportsPrintPage />
                      </RequireAdminAuth>
                    </RequireAuth>
                  }
                />
              )}

              {/* Guardian Agent Dashboard */}
              <Route
                path="/admin/guardian"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['super_admin', 'admin']}>
                      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Guardian...</div>}>
                        {/* <GuardianAgentDashboard /> */}
                        <div>Guardian Agent moved to Edge Functions</div>
                      </Suspense>
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />

              {/* Healthcare Algorithms Dashboard - AI-powered risk prediction */}
              <Route
                path="/admin/healthcare-algorithms"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['super_admin', 'admin', 'physician', 'nurse', 'case_manager']}>
                      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Healthcare Algorithms...</div>}>
                        <HealthcareAlgorithmsDashboard />
                      </Suspense>
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />

              {/* AI Revenue Dashboard - CCM Eligibility, Billing Codes, Readmission Risk */}
              <Route
                path="/admin/ai-revenue"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['super_admin', 'admin', 'department_head']}>
                      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading AI Revenue Dashboard...</div>}>
                        <AIRevenueDashboard />
                      </Suspense>
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />

              {/* FHIR Conflict Resolution - Admin tool for managing FHIR data sync conflicts */}
              <Route
                path="/admin/fhir-conflicts"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['super_admin', 'admin']}>
                      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading FHIR Conflict Resolution...</div>}>
                        <FHIRConflictResolution />
                      </Suspense>
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />

              {/* Specialist Dashboard - Universal dashboard for all specialist types */}
              <Route
                path="/specialist/dashboard/:specialistType"
                element={
                  <RequireAuth>
                    <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Specialist Dashboard...</div>}>
                      <SpecialistDashboardWrapper />
                    </Suspense>
                  </RequireAuth>
                }
              />

              {/* Field Visit Workflow - Step-by-step workflow execution for specialist visits */}
              <Route
                path="/specialist/visit/:visitId"
                element={
                  <RequireAuth>
                    <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Visit Workflow...</div>}>
                      <FieldVisitWorkflowWrapper />
                    </Suspense>
                  </RequireAuth>
                }
              />

              {/* Clinical Dashboards - Feature Flagged */}
              {featureFlags.memoryClinic && (
                <Route
                  path="/memory-clinic/:patientId"
                  element={
                    <RequireAuth>
                      <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'physician', 'doctor', 'nurse', 'nurse_practitioner']}>
                        <MemoryClinicDashboardWrapper />
                      </RequireAdminAuth>
                    </RequireAuth>
                  }
                />
              )}

              {featureFlags.mentalHealth && (
                <Route
                  path="/mental-health"
                  element={
                    <RequireAuth>
                      <MentalHealthDashboard />
                    </RequireAuth>
                  }
                />
              )}
              {featureFlags.neuroSuite && (
                <Route
                  path="/neuro-suite"
                  element={
                    <RequireAuth>
                      <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'physician', 'doctor', 'nurse']}>
                        <NeuroSuiteDashboard />
                      </RequireAdminAuth>
                    </RequireAuth>
                  }
                />
              )}

              {/* Physical Therapy Dashboard - ICF-based PT workflow management */}
              {featureFlags.physicalTherapy && (
                <Route
                  path="/physical-therapy"
                  element={
                    <RequireAuth>
                      <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'physical_therapist', 'pt', 'physician', 'nurse']}>
                        <PhysicalTherapyDashboard />
                      </RequireAdminAuth>
                    </RequireAuth>
                  }
                />
              )}

              {/* Care Coordination Dashboard - Interdisciplinary care team management */}
              {featureFlags.careCoordination && (
                <Route
                  path="/care-coordination"
                  element={
                    <RequireAuth>
                      <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'case_manager', 'social_worker', 'nurse', 'physician']}>
                        <CareCoordinationDashboard />
                      </RequireAdminAuth>
                    </RequireAuth>
                  }
                />
              )}

              {/* Clinical Alerts Dashboard - AI-filtered alerts with effectiveness tracking */}
              <Route
                path="/clinical-alerts"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'nurse', 'physician', 'doctor', 'case_manager']}>
                      <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Alerts Dashboard...</div>}>
                        <ClinicalAlertsDashboard />
                      </Suspense>
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />

              {/* Referrals Dashboard - External referral management for hospital partnerships */}
              {featureFlags.referralManagement && (
                <Route
                  path="/referrals"
                  element={
                    <RequireAuth>
                      <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'case_manager', 'nurse']}>
                        <ReferralsDashboard />
                      </RequireAdminAuth>
                    </RequireAuth>
                  }
                />
              )}

              {/* Questionnaire Analytics Dashboard - SMART questionnaire deployment & tracking */}
              {featureFlags.questionnaireAnalytics && (
                <Route
                  path="/questionnaire-analytics"
                  element={
                    <RequireAuth>
                      <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'nurse', 'case_manager', 'quality_manager']}>
                        <QuestionnaireAnalyticsDashboard />
                      </RequireAdminAuth>
                    </RequireAuth>
                  }
                />
              )}

              {/* Healthcare Integrations Dashboard - Lab, Pharmacy, Imaging, Insurance */}
              {featureFlags.healthcareIntegrations && (
                <Route
                  path="/healthcare-integrations"
                  element={
                    <RequireAuth>
                      <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'physician', 'nurse', 'lab_tech', 'pharmacist', 'radiologist', 'billing_specialist']}>
                        <HealthcareIntegrationsDashboard />
                      </RequireAdminAuth>
                    </RequireAuth>
                  }
                />
              )}

              {/* NOTE: Stroke Assessment requires patient context - needs wrapper
              {featureFlags.strokeAssessment && (
                <Route path="/stroke-assessment/:patientId" element={...} />
              )} */}

              {/* Population Health - Feature Flagged */}
              {featureFlags.frequentFlyers && (
                <Route
                  path="/frequent-flyers"
                  element={
                    <RequireAuth>
                      <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'case_manager', 'social_worker']}>
                        <FrequentFlyerDashboard />
                      </RequireAdminAuth>
                    </RequireAuth>
                  }
                />
              )}
              {featureFlags.dischargeTracking && (
                <Route
                  path="/discharge-tracking"
                  element={
                    <RequireAuth>
                      <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'case_manager', 'nurse']}>
                        <DischargedPatientDashboard />
                      </RequireAdminAuth>
                    </RequireAuth>
                  }
                />
              )}

              {/* Community Readmission Prevention Dashboard - always enabled for demo */}
              <Route
                path="/community-readmission"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'case_manager', 'social_worker', 'nurse', 'chw']}>
                      <CommunityReadmissionDashboard />
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />

              {/* Financial/Billing - Feature Flagged */}
              {featureFlags.revenueDashboard && (
                <Route
                  path="/revenue-dashboard"
                  element={
                    <RequireAuth>
                      <RequireAdminAuth allowedRoles={['admin', 'super_admin']}>
                        <RevenueDashboard />
                      </RequireAdminAuth>
                    </RequireAuth>
                  }
                />
              )}

              {/* Workflow Features - Feature Flagged */}
              {featureFlags.shiftHandoff && (
                <Route
                  path="/shift-handoff"
                  element={
                    <RequireAuth>
                      <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'nurse', 'nurse_practitioner']}>
                        <ShiftHandoffDashboard />
                      </RequireAdminAuth>
                    </RequireAuth>
                  }
                />
              )}

              {/* Hospital Bed Management & Transfers */}
              <Route
                path="/bed-management"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'nurse', 'nurse_practitioner', 'physician', 'case_manager']}>
                      <BedManagementPanel />
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />
              <Route
                path="/transfer-logs"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'nurse', 'physician', 'case_manager']}>
                      <AdminTransferLogs />
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />

              {/* Hospital-to-Hospital Transfer Portal */}
              <Route
                path="/hospital-transfer"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'nurse', 'physician', 'case_manager']}>
                      <HospitalTransferPortal />
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />

              {/* Staff Wellness & Burnout Prevention Dashboard */}
              <Route
                path="/staff-wellness"
                element={
                  <RequireAuth>
                    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'nurse', 'physician', 'case_manager']}>
                      <StaffWellnessDashboard />
                    </RequireAdminAuth>
                  </RequireAuth>
                }
              />

              {/* Emergency Response - Feature Flagged */}
              {featureFlags.emsMetrics && (
                <Route
                  path="/ems/metrics"
                  element={
                    <RequireAuth>
                      <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'nurse', 'physician']}>
                        <EMSMetricsDashboard />
                      </RequireAdminAuth>
                    </RequireAuth>
                  }
                />
              )}

              {featureFlags.coordinatedResponse && (
                <Route
                  path="/ems/coordinated-response/:handoffId"
                  element={
                    <RequireAuth>
                      <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'nurse', 'physician', 'doctor']}>
                        <CoordinatedResponseDashboardWrapper />
                      </RequireAdminAuth>
                    </RequireAuth>
                  }
                />
              )}

              {/* NOTE: Specialist Dashboard needs proper roles configuration
              <Route path="/specialist-dashboard" element={...} />
              */}

              {/* Fallback */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>

          <Footer />

            {/* Offline indicator for all users */}
            <OfflineIndicator />

            {/* Global Voice Command Bar - compact mic icon that expands when clicked */}
            {/* Note: IntelligentAdminPanel has its own VoiceCommandBar with section scrolling */}
            <VoiceCommandBar />
          </AuthGate>
            </NavigationHistoryProvider>
            </PatientProvider>
          </TimeClockProvider>
        </SessionTimeoutProvider>
    </BrandingContext.Provider>
    </GuardianErrorBoundary>
  );
}

/**
 * Wrapper component for SpecialistDashboard to extract route params
 */
const SpecialistDashboardWrapper: React.FC = () => {
  const { specialistType } = useParams<{ specialistType: string }>();
  const { user } = useSupabaseClient() as any;

  if (!specialistType || !user?.id) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Invalid specialist configuration</p>
      </div>
    );
  }

  return (
    <SpecialistDashboard
      specialistId={user.id}
      specialistType={specialistType}
    />
  );
};

/**
 * Wrapper component for FieldVisitWorkflow to extract route params
 */
const FieldVisitWorkflowWrapper: React.FC = () => {
  const { visitId } = useParams<{ visitId: string }>();

  if (!visitId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">No visit ID provided</p>
      </div>
    );
  }

  return <FieldVisitWorkflow visitId={visitId} />;
};

/**
 * Wrapper component for MemoryClinicDashboard to extract patient ID from route
 */
const MemoryClinicDashboardWrapper: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();

  if (!patientId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">No patient ID provided</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Memory Clinic...</div>}>
      <MemoryClinicDashboard patientId={patientId} />
    </Suspense>
  );
};

/**
 * Wrapper component for CoordinatedResponseDashboard to extract handoff context from route/state
 */
const CoordinatedResponseDashboardWrapper: React.FC = () => {
  const { handoffId } = useParams<{ handoffId: string }>();
  const location = useLocation();

  // Extract additional context from location state (passed from EMS workflow)
  const state = location.state as { chiefComplaint?: string; etaMinutes?: number } | null;
  const chiefComplaint = state?.chiefComplaint || 'Unknown';
  const etaMinutes = state?.etaMinutes || 0;

  if (!handoffId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">No handoff ID provided</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading Coordinated Response...</div>}>
      <CoordinatedResponseDashboard
        handoffId={handoffId}
        chiefComplaint={chiefComplaint}
        etaMinutes={etaMinutes}
      />
    </Suspense>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Shell />
      {/* React Query DevTools - Only visible in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
};

export default App;