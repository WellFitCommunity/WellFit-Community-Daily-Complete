// src/routes/routeConfig.ts
// Route configuration organized by category

export type RouteCategory =
  | 'public'
  | 'protected'
  | 'caregiver'
  | 'admin'
  | 'superAdmin'
  | 'clinical'
  | 'chw'
  | 'ems'
  | 'workflow';

export interface RouteConfig {
  path: string;
  component: string; // Lazy import key
  auth?: 'none' | 'user' | 'admin' | 'superAdmin';
  roles?: string[];
  featureFlag?: string;
  category: RouteCategory;
  wrapper?: string; // Custom page wrapper
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES (no auth required)
// ─────────────────────────────────────────────────────────────────────────────
export const publicRoutes: RouteConfig[] = [
  { path: '/', component: 'WelcomePage', auth: 'none', category: 'public' },
  { path: '/register', component: 'RegisterPage', auth: 'none', category: 'public' },
  { path: '/verify', component: 'VerifyCodePage', auth: 'none', category: 'public' },
  { path: '/privacy-policy', component: 'PrivacyPolicy', auth: 'none', category: 'public' },
  { path: '/terms', component: 'TermsOfService', auth: 'none', category: 'public' },
  { path: '/change-password', component: 'ChangePasswordPage', auth: 'none', category: 'public' },
  { path: '/reset-password', component: 'ResetPasswordPage', auth: 'none', category: 'public' },
  { path: '/admin-login', component: 'AdminLoginPage', auth: 'none', category: 'public' },
  { path: '/envision', component: 'EnvisionLoginPage', auth: 'none', category: 'public' },
  { path: '/envision/login', component: 'EnvisionLoginPage', auth: 'none', category: 'public' },
  { path: '/envision-2fa-setup', component: 'EnvisionTotpSetupPage', auth: 'none', category: 'public' },
  { path: '/login', component: 'LoginPage', auth: 'none', category: 'public' },
  { path: '/metrics', component: 'MetricsPage', auth: 'none', category: 'public' },
  { path: '/home', component: 'Home', auth: 'none', category: 'public' },
  { path: '/demo', component: 'DemoPage', auth: 'none', category: 'public' },
  { path: '/law-enforcement', component: 'LawEnforcementLandingPage', auth: 'none', category: 'public', featureFlag: 'lawEnforcement' },
];

// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED ROUTES (user auth required)
// ─────────────────────────────────────────────────────────────────────────────
export const protectedRoutes: RouteConfig[] = [
  // Health & Wellness
  { path: '/dashboard', component: 'DashboardPage', auth: 'user', category: 'protected' },
  { path: '/health-insights', component: 'HealthInsightsPage', auth: 'user', category: 'protected' },
  { path: '/health-dashboard', component: 'HealthTrackerPage', auth: 'user', category: 'protected' },
  { path: '/my-health', component: 'MyHealthHubPage', auth: 'user', category: 'protected' },
  { path: '/health-observations', component: 'HealthObservationsPage', auth: 'user', category: 'protected' },
  { path: '/immunizations', component: 'ImmunizationsPage', auth: 'user', category: 'protected' },
  { path: '/care-plans', component: 'CarePlansPage', auth: 'user', category: 'protected' },
  { path: '/medicine-cabinet', component: 'MedicineCabinet', auth: 'user', category: 'protected' },
  { path: '/medication-management', component: 'MedicationManagementPage', auth: 'user', category: 'protected' },
  { path: '/wearables', component: 'WearableDashboard', auth: 'user', category: 'protected' },
  { path: '/allergies', component: 'AllergiesPage', auth: 'user', category: 'protected' },
  { path: '/conditions', component: 'ConditionsPage', auth: 'user', category: 'protected' },
  { path: '/dental-health', component: 'DentalHealthDashboard', auth: 'user', category: 'protected' },
  { path: '/telehealth-appointments', component: 'TelehealthAppointmentsPage', auth: 'user', category: 'protected' },
  { path: '/vital-capture', component: 'VitalCapturePage', auth: 'user', category: 'protected' },

  // Activities & Engagement
  { path: '/questions', component: 'QuestionsPage', auth: 'user', category: 'protected' },
  { path: '/ask-nurse', component: 'EnhancedQuestionsPage', auth: 'user', category: 'protected' },
  { path: '/check-in', component: 'CheckInPage', auth: 'user', category: 'protected' },
  { path: '/word-find', component: 'WordFindPage', auth: 'user', category: 'protected' },
  { path: '/memory-lane-trivia', component: 'MemoryLaneTriviaPage', auth: 'user', category: 'protected' },
  { path: '/community', component: 'CommunityMoments', auth: 'user', category: 'protected' },

  // User Settings & Profile
  { path: '/help', component: 'HelpPage', auth: 'user', category: 'protected' },
  { path: '/settings', component: 'SettingsPage', auth: 'user', category: 'protected' },
  { path: '/profile', component: 'ProfilePage', auth: 'user', category: 'protected' },
  { path: '/demographics', component: 'DemographicsPage', auth: 'user', category: 'protected' },
  { path: '/logout', component: 'LogoutPage', auth: 'user', category: 'protected' },

  // Consent & Reporting
  { path: '/consent-photo', component: 'ConsentPhotoPage', auth: 'user', category: 'protected' },
  { path: '/consent-privacy', component: 'ConsentPrivacyPage', auth: 'user', category: 'protected' },
  { path: '/consent-management', component: 'ConsentManagementPage', auth: 'user', category: 'protected' },
  { path: '/self-reporting', component: 'SelfReportingPage', auth: 'user', category: 'protected' },
  { path: '/doctors-view', component: 'DoctorsViewPage', auth: 'user', category: 'protected' },

  // Dynamic routes
  { path: '/meals/:id', component: 'MealDetailPage', auth: 'user', category: 'protected' },
  { path: '/smart-callback', component: 'SmartCallbackPage', auth: 'user', category: 'protected' },
  { path: '/ems', component: 'EMSPage', auth: 'user', category: 'protected' },

  // Feature-flagged
  { path: '/time-clock', component: 'TimeClockPage', auth: 'user', category: 'protected', featureFlag: 'timeClock' },
  { path: '/mental-health', component: 'MentalHealthDashboard', auth: 'user', category: 'protected', featureFlag: 'mentalHealth' },
];

// ─────────────────────────────────────────────────────────────────────────────
// CAREGIVER ROUTES (PIN-based or role-based)
// ─────────────────────────────────────────────────────────────────────────────
export const caregiverRoutes: RouteConfig[] = [
  // PIN-based (no auth)
  { path: '/caregiver-access', component: 'CaregiverAccessPage', auth: 'none', category: 'caregiver' },
  { path: '/senior-view/:seniorId', component: 'SeniorViewPage', auth: 'none', category: 'caregiver' },
  { path: '/senior-reports/:seniorId', component: 'SeniorReportsPage', auth: 'none', category: 'caregiver' },
  // Authenticated caregiver
  { path: '/caregiver-dashboard', component: 'CaregiverDashboardPage', auth: 'user', category: 'caregiver' },
  { path: '/set-caregiver-pin', component: 'SetCaregiverPinPage', auth: 'user', category: 'caregiver' },
];

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTES (requires admin auth + roles)
// ─────────────────────────────────────────────────────────────────────────────
export const adminRoutes: RouteConfig[] = [
  // Core Admin
  { path: '/admin', component: 'AdminPanel', auth: 'admin', category: 'admin' },
  { path: '/admin-profile-editor', component: 'AdminProfileEditorPage', auth: 'admin', category: 'admin' },
  { path: '/admin/enroll-senior', component: 'EnrollSeniorPage', auth: 'admin', category: 'admin' },
  { path: '/admin/bulk-enroll', component: 'BulkEnrollmentPanel', auth: 'admin', category: 'admin' },
  { path: '/admin/bulk-export', component: 'BulkExportPanel', auth: 'admin', category: 'admin' },
  { path: '/admin/settings', component: 'AdminSettingsPage', auth: 'user', category: 'admin' },
  { path: '/admin/audit-logs', component: 'AuditLogsPage', auth: 'user', category: 'admin' },
  { path: '/admin/system', component: 'SystemAdministrationPage', auth: 'user', category: 'admin' },
  { path: '/it-admin', component: 'TenantITDashboard', auth: 'user', category: 'admin' },
  {
    path: '/template-maker',
    component: 'TemplateMaker',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'it_admin', 'nurse', 'nurse_practitioner', 'department_head'],
    category: 'admin',
  },

  // Role-specific admin routes
  {
    path: '/admin-questions',
    component: 'AdminQuestionsPage',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'nurse'],
    category: 'admin',
  },
  {
    path: '/billing',
    component: 'BillingDashboard',
    auth: 'admin',
    roles: ['admin', 'super_admin'],
    category: 'admin',
    wrapper: 'billingWrapper',
  },
  {
    path: '/admin/api-keys',
    component: 'ApiKeyManager',
    auth: 'admin',
    roles: ['super_admin'],
    category: 'admin',
    wrapper: 'apiKeyWrapper',
  },
  {
    path: '/admin/ai-accuracy',
    component: 'AIAccuracyDashboard',
    auth: 'admin',
    roles: ['admin', 'super_admin'],
    category: 'admin',
    wrapper: 'darkWrapper',
  },
  {
    path: '/admin/ai-cost',
    component: 'AICostDashboard',
    auth: 'superAdmin',
    roles: ['super_admin'],
    category: 'superAdmin',
    wrapper: 'darkWrapper',
  },
  {
    path: '/admin/photo-approval',
    component: 'PhotoApprovalPage',
    auth: 'admin',
    roles: ['admin', 'super_admin'],
    category: 'admin',
  },
  {
    path: '/admin/time-clock',
    component: 'TimeClockAdmin',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'department_head', 'clinical_supervisor'],
    category: 'admin',
    featureFlag: 'timeClock',
  },
  {
    path: '/admin/reports',
    component: 'ReportsPrintPage',
    auth: 'admin',
    category: 'admin',
    featureFlag: 'adminReports',
  },
  // Guardian Agent Dashboard moved to superAdminRoutes for Envision-only access
  {
    path: '/admin/healthcare-algorithms',
    component: 'HealthcareAlgorithmsDashboard',
    auth: 'admin',
    roles: ['super_admin', 'admin', 'physician', 'nurse', 'case_manager'],
    category: 'admin',
  },
  {
    path: '/admin/ai-revenue',
    component: 'AIRevenueDashboard',
    auth: 'admin',
    roles: ['super_admin', 'admin', 'department_head'],
    category: 'admin',
  },
  {
    path: '/admin/fhir-conflicts',
    component: 'FHIRConflictResolution',
    auth: 'admin',
    roles: ['super_admin', 'admin'],
    category: 'admin',
  },
  {
    path: '/billing/review',
    component: 'BillingReviewDashboard',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'billing_specialist'],
    category: 'admin',
    featureFlag: 'billingReview',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN ROUTES (platform-level access)
// ─────────────────────────────────────────────────────────────────────────────
export const superAdminRoutes: RouteConfig[] = [
  { path: '/super-admin', component: 'SuperAdminDashboard', auth: 'superAdmin', category: 'superAdmin' },
  { path: '/tenant-selector', component: 'MultiTenantSelector', auth: 'superAdmin', category: 'superAdmin' },
  { path: '/multi-tenant-monitor', component: 'MultiTenantMonitor', auth: 'superAdmin', category: 'superAdmin' },
  { path: '/soc-dashboard', component: 'SOCDashboard', auth: 'superAdmin', category: 'superAdmin' },
  { path: '/enterprise-migration', component: 'EnterpriseMigrationDashboard', auth: 'superAdmin', category: 'superAdmin' },
  // Guardian Agent - Envision VirtualEdge Group only
  { path: '/guardian/dashboard', component: 'GuardianAgentDashboard', auth: 'superAdmin', category: 'superAdmin', wrapper: 'darkWrapper' },
  { path: '/guardian/approvals', component: 'GuardianApprovalsList', auth: 'superAdmin', category: 'superAdmin' },
  { path: '/guardian/approval/:ticketId', component: 'GuardianApprovalForm', auth: 'superAdmin', category: 'superAdmin' },
];

// ─────────────────────────────────────────────────────────────────────────────
// CLINICAL ROUTES (clinical staff with specific roles)
// ─────────────────────────────────────────────────────────────────────────────
export const clinicalRoutes: RouteConfig[] = [
  // Nurse
  {
    path: '/nurse-dashboard',
    component: 'NursePanel',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'nurse', 'nurse_practitioner', 'clinical_supervisor'],
    category: 'clinical',
  },
  {
    path: '/nurse-panel',
    component: 'NursePanel',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'nurse', 'nurse_practitioner', 'clinical_supervisor'],
    category: 'clinical',
  },
  // Physician
  {
    path: '/physician-dashboard',
    component: 'PhysicianPanel',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'physician', 'doctor', 'physician_assistant'],
    category: 'clinical',
  },
  // Case Manager
  {
    path: '/case-manager-dashboard',
    component: 'CaseManagerPanel',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'case_manager'],
    category: 'clinical',
  },
  // Social Worker
  {
    path: '/social-worker-dashboard',
    component: 'SocialWorkerPanel',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'social_worker'],
    category: 'clinical',
  },
  // ER Dashboard
  {
    path: '/er-dashboard',
    component: 'ERDashboardPage',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'physician', 'doctor', 'nurse_practitioner', 'physician_assistant', 'nurse'],
    category: 'clinical',
  },
  // Clinical Alerts
  {
    path: '/clinical-alerts',
    component: 'ClinicalAlertsDashboard',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'nurse', 'physician', 'doctor', 'case_manager'],
    category: 'clinical',
  },
  // Medication Manager (Admin-level medication oversight)
  {
    path: '/medication-manager',
    component: 'MedicationManager',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'nurse', 'physician', 'doctor', 'pharmacist', 'nurse_practitioner'],
    category: 'clinical',
  },
  // Compass Riley (AI Scribe)
  {
    path: '/compass-riley',
    component: 'CompassRileyPage',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'physician', 'doctor', 'nurse', 'nurse_practitioner', 'physician_assistant'],
    category: 'clinical',
  },
  // Readmissions
  {
    path: '/readmissions',
    component: 'CommunityReadmissionDashboard',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'physician', 'doctor', 'nurse', 'case_manager'],
    category: 'clinical',
  },
  // Community Readmission
  {
    path: '/community-readmission',
    component: 'CommunityReadmissionDashboard',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'case_manager', 'social_worker', 'nurse', 'chw'],
    category: 'clinical',
  },
  // Neuro Suite
  {
    path: '/neuro-suite',
    component: 'NeuroSuiteDashboard',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'physician', 'doctor', 'nurse'],
    category: 'clinical',
    featureFlag: 'neuroSuite',
  },
  // Memory Clinic (requires patient ID)
  {
    path: '/memory-clinic/:patientId',
    component: 'MemoryClinicDashboardWrapper',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'physician', 'doctor', 'nurse', 'nurse_practitioner'],
    category: 'clinical',
    featureFlag: 'memoryClinic',
  },
  // Physical Therapy
  {
    path: '/physical-therapy',
    component: 'PhysicalTherapyDashboard',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'physical_therapist', 'pt', 'physician', 'nurse'],
    category: 'clinical',
    featureFlag: 'physicalTherapy',
  },
  // Care Coordination
  {
    path: '/care-coordination',
    component: 'CareCoordinationDashboard',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'case_manager', 'social_worker', 'nurse', 'physician'],
    category: 'clinical',
    featureFlag: 'careCoordination',
  },
  // Referrals
  {
    path: '/referrals',
    component: 'ReferralsDashboard',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'case_manager', 'nurse'],
    category: 'clinical',
    featureFlag: 'referralManagement',
  },
  // Questionnaire Analytics
  {
    path: '/questionnaire-analytics',
    component: 'QuestionnaireAnalyticsDashboard',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'nurse', 'case_manager', 'quality_manager'],
    category: 'clinical',
    featureFlag: 'questionnaireAnalytics',
  },
  // Healthcare Integrations
  {
    path: '/healthcare-integrations',
    component: 'HealthcareIntegrationsDashboard',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'physician', 'nurse', 'lab_tech', 'pharmacist', 'radiologist', 'billing_specialist'],
    category: 'clinical',
    featureFlag: 'healthcareIntegrations',
  },
  // Frequent Flyers
  {
    path: '/frequent-flyers',
    component: 'FrequentFlyerDashboard',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'case_manager', 'social_worker'],
    category: 'clinical',
    featureFlag: 'frequentFlyers',
  },
  // Discharge Tracking
  {
    path: '/discharge-tracking',
    component: 'DischargedPatientDashboard',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'case_manager', 'nurse'],
    category: 'clinical',
    featureFlag: 'dischargeTracking',
  },
  // Revenue Dashboard
  {
    path: '/revenue-dashboard',
    component: 'RevenueDashboard',
    auth: 'admin',
    roles: ['admin', 'super_admin'],
    category: 'clinical',
    featureFlag: 'revenueDashboard',
  },
  // Specialist Dashboard
  {
    path: '/specialist/dashboard/:specialistType',
    component: 'SpecialistDashboardWrapper',
    auth: 'user',
    category: 'clinical',
  },
  // Field Visit Workflow
  {
    path: '/specialist/visit/:visitId',
    component: 'FieldVisitWorkflowWrapper',
    auth: 'user',
    category: 'clinical',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CHW (Community Health Worker) ROUTES
// ─────────────────────────────────────────────────────────────────────────────
export const chwRoutes: RouteConfig[] = [
  // Kiosk (public)
  { path: '/kiosk/check-in', component: 'KioskCheckIn', auth: 'none', category: 'chw' },
  // CHW Staff Routes
  {
    path: '/chw/vitals-capture',
    component: 'CHWVitalsCapture',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'nurse', 'community_health_worker', 'chw'],
    category: 'chw',
  },
  {
    path: '/chw/medication-photo',
    component: 'MedicationPhotoCapture',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'nurse', 'community_health_worker', 'chw'],
    category: 'chw',
  },
  {
    path: '/chw/sdoh-assessment',
    component: 'SDOHAssessment',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'nurse', 'case_manager', 'social_worker', 'community_health_worker', 'chw'],
    category: 'chw',
  },
  {
    path: '/chw/telehealth-lobby',
    component: 'TelehealthLobby',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'physician', 'nurse', 'community_health_worker', 'chw'],
    category: 'chw',
  },
  {
    path: '/chw/dashboard',
    component: 'CHWDashboardPage',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'nurse', 'case_manager', 'community_health_worker', 'chw'],
    category: 'chw',
  },
  {
    path: '/chw/kiosk-dashboard',
    component: 'KioskDashboard',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'nurse', 'community_health_worker', 'chw'],
    category: 'chw',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW ROUTES (shift handoff, bed management, transfers)
// ─────────────────────────────────────────────────────────────────────────────
export const workflowRoutes: RouteConfig[] = [
  // Shift Handoff
  {
    path: '/shift-handoff',
    component: 'ShiftHandoffDashboard',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'nurse', 'nurse_practitioner'],
    category: 'workflow',
    featureFlag: 'shiftHandoff',
  },
  // Bed Management
  {
    path: '/bed-management',
    component: 'BedManagementPanel',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'nurse', 'nurse_practitioner', 'physician', 'case_manager'],
    category: 'workflow',
  },
  // Transfer Logs
  {
    path: '/transfer-logs',
    component: 'AdminTransferLogs',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'nurse', 'physician', 'case_manager'],
    category: 'workflow',
  },
  // Hospital Transfer Portal
  {
    path: '/hospital-transfer',
    component: 'HospitalTransferPortal',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'nurse', 'physician', 'case_manager'],
    category: 'workflow',
  },
  // Receiving Dashboard (for incoming transfers)
  {
    path: '/handoff/receiving',
    component: 'ReceivingDashboardWrapper',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'nurse', 'physician', 'case_manager'],
    category: 'workflow',
  },
  // Staff Wellness
  {
    path: '/staff-wellness',
    component: 'StaffWellnessDashboard',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'nurse', 'physician', 'case_manager'],
    category: 'workflow',
  },
  // Law Enforcement (Constable)
  {
    path: '/constable-dispatch',
    component: 'ConstableDispatchDashboard',
    auth: 'admin',
    category: 'workflow',
    featureFlag: 'lawEnforcement',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// EMS ROUTES
// ─────────────────────────────────────────────────────────────────────────────
export const emsRoutes: RouteConfig[] = [
  {
    path: '/ems/metrics',
    component: 'EMSMetricsDashboard',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'nurse', 'physician'],
    category: 'ems',
    featureFlag: 'emsMetrics',
  },
  {
    path: '/ems/coordinated-response/:handoffId',
    component: 'CoordinatedResponseDashboardWrapper',
    auth: 'admin',
    roles: ['admin', 'super_admin', 'nurse', 'physician', 'doctor'],
    category: 'ems',
    featureFlag: 'coordinatedResponse',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ALL ROUTES (combined for easy iteration)
// ─────────────────────────────────────────────────────────────────────────────
export const allRoutes: RouteConfig[] = [
  ...publicRoutes,
  ...protectedRoutes,
  ...caregiverRoutes,
  ...adminRoutes,
  ...superAdminRoutes,
  ...clinicalRoutes,
  ...chwRoutes,
  ...workflowRoutes,
  ...emsRoutes,
];
