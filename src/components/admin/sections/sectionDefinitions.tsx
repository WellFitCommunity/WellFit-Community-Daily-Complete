/**
 * Admin Panel Section Definitions
 * Extracted from IntelligentAdminPanel for code splitting
 */

import React, { Suspense, lazy } from 'react';
import { DashboardSection } from './types';
import { auditLogger } from '../../../services/auditLogger';

// Lazy-load all dashboard components for code splitting
const UsersList = lazy(() => import('../UsersList'));
const ReportsSection = lazy(() => import('../ReportsSection'));
const ExportCheckIns = lazy(() => import('../ExportCheckIns'));
const FhirAiDashboard = lazy(() => import('../FhirAiDashboard'));
const FHIRFormBuilderEnhanced = lazy(() => import('../FHIRFormBuilderEnhanced'));
const FHIRDataMapper = lazy(() => import('../FHIRDataMapper'));
const BillingDashboard = lazy(() => import('../BillingDashboard'));
const SmartScribe = lazy(() => import('../../smart/RealTimeSmartScribe'));
const SDOHCoderAssist = lazy(() => import('../../billing/SDOHCoderAssist'));
const CCMTimeline = lazy(() => import('../../atlas/CCMTimeline'));
const RevenueDashboard = lazy(() => import('../../atlas/RevenueDashboard'));
const ClaimsSubmissionPanel = lazy(() => import('../../atlas/ClaimsSubmissionPanel'));
const ClaimsAppealsPanel = lazy(() => import('../../atlas/ClaimsAppealsPanel'));
const PriorAuthDashboard = lazy(() => import('../PriorAuthDashboard'));
const AdminTransferLogs = lazy(() => import('../../handoff/AdminTransferLogs'));
const PatientEngagementDashboard = lazy(() => import('../PatientEngagementDashboard'));
const HospitalPatientEnrollment = lazy(() => import('../HospitalPatientEnrollment'));
const PaperFormScanner = lazy(() => import('../PaperFormScanner'));
const TenantSecurityDashboard = lazy(() => import('../TenantSecurityDashboard'));
const TenantAuditLogs = lazy(() => import('../TenantAuditLogs'));
const TenantComplianceReport = lazy(() => import('../TenantComplianceReport'));
const TenantModuleConfigPanel = lazy(() => import('../TenantModuleConfigPanel').then(m => ({ default: m.TenantModuleConfigPanel })));
const FacilityManagementPanel = lazy(() => import('../FacilityManagementPanel'));
const StaffFinancialSavingsTracker = lazy(() => import('../StaffFinancialSavingsTracker'));
const MfaComplianceDashboard = lazy(() => import('../MfaComplianceDashboard'));
const QualityMeasuresDashboard = lazy(() => import('../quality-measures'));
const CardiologyDashboard = lazy(() => import('../../cardiology/CardiologyDashboard'));
const LaborDeliveryDashboard = lazy(() => import('../../labor-delivery/LaborDeliveryDashboard'));
const OncologyDashboard = lazy(() => import('../../oncology/OncologyDashboard'));

// Claude for Healthcare Gap Tracker (Tasks 12-14)
const CareGapDashboard = lazy(() => import('../CareGapDashboard'));
const ClinicalNoteSummaryDashboard = lazy(() => import('../ClinicalNoteSummaryDashboard'));
const AIModelCardsDashboard = lazy(() => import('../AIModelCardsDashboard'));

// Provider Assignment Dashboard (P1 Clinical Safety)
const ProviderAssignmentDashboard = lazy(() => import('../ProviderAssignmentDashboard'));

// Unacknowledged Results Dashboard (P2 Clinical Safety)
const UnacknowledgedResultsDashboard = lazy(() => import('../UnacknowledgedResultsDashboard'));

// Provider Task Queue Dashboard (P3 Clinical Safety)
const ProviderTaskQueueDashboard = lazy(() => import('../ProviderTaskQueueDashboard'));

// Superbill Provider Sign-Off (P1 Revenue Gate)
const SuperbillReviewPanel = lazy(() => import('../SuperbillReviewPanel'));

// Public Health Reporting (ONC f-criteria)
const PublicHealthReportingDashboard = lazy(() => import('../PublicHealthReportingDashboard'));

// Regulatory Compliance (Gap Remediation)
const BreachNotificationDashboard = lazy(() => import('../BreachNotificationDashboard'));
const BAATrackingDashboard = lazy(() => import('../BAATrackingDashboard'));
const PatientAmendmentReviewQueue = lazy(() => import('../PatientAmendmentReviewQueue'));
const TrainingComplianceDashboard = lazy(() => import('../TrainingComplianceDashboard'));

// Loading fallback for lazy-loaded sections
export const SectionLoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    <span className="ml-3 text-gray-600">Loading section...</span>
  </div>
);

/**
 * All available admin panel sections
 * Organized by category for easy maintenance
 */
export const getAllSections = (): DashboardSection[] => [
  // ==================== REVENUE & BILLING ====================
  {
    id: 'smartscribe-atlus',
    title: 'SmartScribe Atlus 💰',
    subtitle: 'AI transcription for maximum billing accuracy',
    icon: '🎤',
    headerColor: 'text-purple-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><SmartScribe /></Suspense>,
    category: 'revenue',
    priority: 'high',
  },
  {
    id: 'revenue-dashboard',
    title: 'Revenue Dashboard',
    subtitle: 'Real-time revenue analytics and optimization opportunities',
    icon: '💰',
    headerColor: 'text-green-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><RevenueDashboard /></Suspense>,
    category: 'revenue',
    priority: 'high',
  },
  {
    id: 'ccm-autopilot',
    title: 'CCM Autopilot',
    subtitle: 'Automatic tracking of 20+ minute patient interactions for CCM billing',
    icon: '⏱️',
    headerColor: 'text-purple-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><CCMTimeline /></Suspense>,
    category: 'revenue',
    priority: 'medium',
  },
  {
    id: 'claims-submission',
    title: 'Claims Submission Center',
    subtitle: 'Generate and submit 837P claims to clearinghouses',
    icon: '📋',
    headerColor: 'text-blue-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><ClaimsSubmissionPanel /></Suspense>,
    category: 'revenue',
    priority: 'medium',
  },
  {
    id: 'claims-appeals',
    title: 'Claims Appeals & Resubmission',
    subtitle: 'AI-assisted appeal letters for denied claims',
    icon: '🔄',
    headerColor: 'text-red-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><ClaimsAppealsPanel /></Suspense>,
    category: 'revenue',
    priority: 'medium',
  },
  {
    id: 'prior-auth',
    title: 'Prior Authorization Center',
    subtitle: 'CMS-0057-F compliant prior auth requests, decisions, and appeals',
    icon: '🛡️',
    headerColor: 'text-indigo-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><PriorAuthDashboard /></Suspense>,
    category: 'revenue',
    priority: 'high',
    roles: ['admin', 'super_admin', 'case_manager', 'billing_specialist'],
  },
  {
    id: 'sdoh-billing',
    title: 'SDOH Billing Encoder',
    subtitle: 'Social determinants of health-aware medical coding',
    icon: '🏥',
    headerColor: 'text-indigo-800',
    component: (
      <Suspense fallback={<SectionLoadingFallback />}>
        <SDOHCoderAssist
          encounterId="demo-encounter-id"
          patientId="demo-patient-id"
          onSaved={(data) => auditLogger.debug('SDOH coding saved', data)}
        />
      </Suspense>
    ),
    category: 'revenue',
    priority: 'low',
  },
  {
    id: 'billing-dashboard',
    title: 'Billing & Claims Management',
    subtitle: 'Monitor claims processing and revenue tracking',
    icon: '💳',
    headerColor: 'text-green-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><BillingDashboard /></Suspense>,
    category: 'revenue',
    priority: 'medium',
  },
  {
    id: 'staff-financial-savings',
    title: 'Staff Financial Savings Tracker',
    subtitle: 'Track cost savings by nurse, position, and department for budgetary analysis',
    icon: '💵',
    headerColor: 'text-emerald-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><StaffFinancialSavingsTracker /></Suspense>,
    category: 'revenue',
    priority: 'high',
    roles: ['admin', 'super_admin', 'finance', 'billing_specialist'],
  },
  {
    id: 'superbill-review',
    title: 'Superbill Provider Sign-Off',
    subtitle: 'Review and approve superbills before clearinghouse submission',
    icon: '✅',
    headerColor: 'text-green-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><SuperbillReviewPanel /></Suspense>,
    category: 'revenue',
    priority: 'high',
    roles: ['admin', 'super_admin', 'physician', 'billing_specialist'],
  },

  // ==================== PATIENT CARE ====================
  {
    id: 'patient-engagement',
    title: 'Patient Engagement & Risk Assessment',
    subtitle: 'Monitor senior activity levels to identify at-risk patients',
    icon: '📊',
    headerColor: 'text-indigo-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><PatientEngagementDashboard /></Suspense>,
    category: 'patient-care',
    priority: 'high',
  },
  {
    id: 'provider-assignment',
    title: 'Encounter Provider Assignments',
    subtitle: 'Assign attending, supervising, and consulting providers to clinical encounters',
    icon: '👨‍⚕️',
    headerColor: 'text-blue-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><ProviderAssignmentDashboard /></Suspense>,
    category: 'patient-care',
    priority: 'high',
    roles: ['admin', 'super_admin', 'physician', 'nurse'],
  },
  {
    id: 'unacknowledged-results',
    title: 'Unacknowledged Results',
    subtitle: 'Track and acknowledge critical lab and imaging results requiring clinician review',
    icon: '🔬',
    headerColor: 'text-red-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><UnacknowledgedResultsDashboard /></Suspense>,
    category: 'patient-care',
    priority: 'high',
    roles: ['admin', 'super_admin', 'physician', 'nurse', 'lab_tech'],
  },
  {
    id: 'provider-task-queue',
    title: 'Provider Task Queue',
    subtitle: 'Inbox routing with SLA deadlines, escalation tracking, and task lifecycle management',
    icon: '📋',
    headerColor: 'text-orange-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><ProviderTaskQueueDashboard /></Suspense>,
    category: 'patient-care',
    priority: 'high',
    roles: ['admin', 'super_admin', 'physician', 'nurse', 'case_manager'],
  },
  {
    id: 'patient-handoff',
    title: 'Patient Handoff System',
    subtitle: 'Secure transfer of care between facilities - HIPAA compliant',
    icon: '🏥',
    headerColor: 'text-teal-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><AdminTransferLogs showExportButton={true} /></Suspense>,
    category: 'patient-care',
    priority: 'medium',
  },
  {
    id: 'user-management',
    title: 'User Management',
    subtitle: 'Manage patient and staff accounts',
    icon: '👥',
    headerColor: 'text-gray-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><UsersList /></Suspense>,
    category: 'patient-care',
    priority: 'medium',
  },
  {
    id: 'hospital-enrollment',
    title: 'Hospital Patient Enrollment',
    subtitle: 'Create test patients for backend testing (Physician/Nurse panels, handoffs, clinical workflows)',
    icon: '🏥',
    headerColor: 'text-blue-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><HospitalPatientEnrollment /></Suspense>,
    category: 'admin',
    priority: 'high',
    defaultOpen: false,
  },
  {
    id: 'paper-form-scanner',
    title: 'Paper Form Scanner (AI-Powered OCR)',
    subtitle: 'Upload photos of paper forms - AI extracts data automatically. Perfect for rural hospitals during outages. 50x faster than manual entry!',
    icon: '📸',
    headerColor: 'text-green-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><PaperFormScanner /></Suspense>,
    category: 'admin',
    priority: 'high',
    defaultOpen: false,
  },

  // ==================== CLINICAL SPECIALTIES ====================
  {
    id: 'cardiology',
    title: 'Cardiology Dashboard',
    subtitle: 'ECG, echocardiography, heart failure management, cardiac rehab, and device monitoring',
    icon: '🫀',
    headerColor: 'text-red-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><CardiologyDashboard /></Suspense>,
    category: 'clinical',
    priority: 'high',
    roles: ['admin', 'super_admin', 'physician', 'case_manager'],
  },
  {
    id: 'labor-delivery',
    title: 'Labor & Delivery Dashboard',
    subtitle: 'Prenatal care, labor tracking, fetal monitoring, delivery records, and postpartum assessments',
    icon: '👶',
    headerColor: 'text-pink-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><LaborDeliveryDashboard /></Suspense>,
    category: 'clinical',
    priority: 'high',
    roles: ['admin', 'super_admin', 'physician', 'case_manager'],
  },
  {
    id: 'oncology',
    title: 'Oncology Dashboard',
    subtitle: 'Cancer registry, TNM staging, chemotherapy/radiation tracking, CTCAE side effects, and survivorship',
    icon: '🎗️',
    headerColor: 'text-purple-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><OncologyDashboard /></Suspense>,
    category: 'clinical',
    priority: 'high',
    roles: ['admin', 'super_admin', 'physician', 'case_manager'],
  },

  // ==================== CARE GAP DETECTION ====================
  {
    id: 'care-gap-detection',
    title: 'Care Gap Detection',
    subtitle: 'Identify and close preventive care gaps across your patient panel',
    icon: '🔍',
    headerColor: 'text-orange-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><CareGapDashboard /></Suspense>,
    category: 'patient-care',
    priority: 'high',
    roles: ['admin', 'super_admin', 'physician', 'nurse', 'case_manager'],
  },

  // ==================== CLINICAL NOTE SUMMARIZATION ====================
  {
    id: 'clinical-note-summary',
    title: 'Clinical Note Summarization',
    subtitle: 'Review and approve AI-generated SOAP notes, progress notes, and discharge summaries',
    icon: '📝',
    headerColor: 'text-cyan-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><ClinicalNoteSummaryDashboard /></Suspense>,
    category: 'clinical',
    priority: 'high',
    roles: ['admin', 'super_admin', 'physician', 'nurse'],
  },

  // ==================== CLINICAL DATA ====================
  {
    id: 'quality-measures',
    title: 'Quality Measures Dashboard',
    subtitle: 'eCQM, HEDIS, MIPS, and Star Ratings performance tracking',
    icon: '📊',
    headerColor: 'text-cyan-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><QualityMeasuresDashboard tenantId="" /></Suspense>,
    category: 'clinical',
    priority: 'high',
    roles: ['admin', 'super_admin', 'case_manager', 'physician'],
  },
  {
    id: 'public-health-reporting',
    title: 'Public Health Reporting',
    subtitle: 'Monitor syndromic surveillance, immunization registry, and eCR transmissions',
    icon: '📡',
    headerColor: 'text-teal-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><PublicHealthReportingDashboard /></Suspense>,
    category: 'clinical',
    priority: 'high',
    roles: ['admin', 'super_admin', 'compliance_officer', 'physician'],
  },
  {
    id: 'fhir-analytics',
    title: 'AI-Enhanced FHIR Analytics',
    subtitle: 'Real-time patient insights and clinical decision support',
    icon: '🧠',
    headerColor: 'text-purple-800',
    component: (
      <Suspense fallback={<SectionLoadingFallback />}>
        <FhirAiDashboard
          supabaseUrl={import.meta.env.VITE_SUPABASE_URL || ''}
          supabaseKey={import.meta.env.VITE_SUPABASE_ANON_KEY || ''}
        />
      </Suspense>
    ),
    category: 'clinical',
    priority: 'medium',
  },
  {
    id: 'fhir-questionnaire',
    title: 'FHIR Questionnaire Builder',
    subtitle: 'Create standardized clinical questionnaires using AI',
    icon: '📝',
    headerColor: 'text-blue-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><FHIRFormBuilderEnhanced /></Suspense>,
    category: 'clinical',
    priority: 'low',
  },
  {
    id: 'fhir-mapper',
    title: 'FHIR Data Mapper',
    subtitle: 'Transform legacy data into FHIR-compliant formats',
    icon: '🔄',
    headerColor: 'text-teal-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><FHIRDataMapper /></Suspense>,
    category: 'clinical',
    priority: 'low',
  },
  {
    id: 'reports-analytics',
    title: 'Reports & Analytics',
    subtitle: 'System-wide analytics and insights',
    icon: '📊',
    headerColor: 'text-gray-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><ReportsSection /></Suspense>,
    category: 'clinical',
    priority: 'low',
  },

  // ==================== DSI TRANSPARENCY ====================
  {
    id: 'ai-model-cards',
    title: 'DSI Transparency — AI Model Cards',
    subtitle: 'HTI-1 compliant AI/ML model documentation, risk classification, and transparency',
    icon: '🤖',
    headerColor: 'text-indigo-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><AIModelCardsDashboard /></Suspense>,
    category: 'security',
    priority: 'high',
    roles: ['admin', 'super_admin'],
  },

  // ==================== SECURITY & COMPLIANCE ====================
  {
    id: 'mfa-compliance',
    title: 'MFA Compliance Dashboard',
    subtitle: 'Monitor multi-factor authentication enrollment across admin and clinical staff',
    icon: '🔐',
    headerColor: 'text-blue-900',
    component: <Suspense fallback={<SectionLoadingFallback />}><MfaComplianceDashboard /></Suspense>,
    category: 'security',
    priority: 'high',
    roles: ['admin', 'super_admin', 'it_admin'],
  },
  {
    id: 'tenant-security',
    title: 'Facility Security Dashboard',
    subtitle: 'Real-time security monitoring for your facility',
    icon: '🛡️',
    headerColor: 'text-red-900',
    component: <Suspense fallback={<SectionLoadingFallback />}><TenantSecurityDashboard /></Suspense>,
    category: 'security',
    priority: 'medium',
    roles: ['admin', 'super_admin', 'it_admin'],
  },
  {
    id: 'tenant-audit-logs',
    title: 'Audit Logs',
    subtitle: 'PHI access logs and administrative actions for your facility',
    icon: '📋',
    headerColor: 'text-indigo-900',
    component: <Suspense fallback={<SectionLoadingFallback />}><TenantAuditLogs /></Suspense>,
    category: 'security',
    priority: 'medium',
    roles: ['admin', 'super_admin', 'it_admin'],
  },
  {
    id: 'tenant-compliance',
    title: 'Compliance Report',
    subtitle: 'HIPAA and security compliance status for your facility',
    icon: '✅',
    headerColor: 'text-green-900',
    component: <Suspense fallback={<SectionLoadingFallback />}><TenantComplianceReport /></Suspense>,
    category: 'security',
    priority: 'low',
    roles: ['admin', 'super_admin', 'it_admin'],
  },
  {
    id: 'breach-notification',
    title: 'Breach Notification Engine',
    subtitle: 'HIPAA breach incident tracking, risk assessment, and 60-day notification compliance',
    icon: '🚨',
    headerColor: 'text-red-900',
    component: <Suspense fallback={<SectionLoadingFallback />}><BreachNotificationDashboard /></Suspense>,
    category: 'security',
    priority: 'high',
    roles: ['admin', 'super_admin', 'compliance_officer'],
  },
  {
    id: 'baa-tracking',
    title: 'BAA Tracking Dashboard',
    subtitle: 'Business associate agreement lifecycle management and renewal tracking',
    icon: '📄',
    headerColor: 'text-blue-900',
    component: <Suspense fallback={<SectionLoadingFallback />}><BAATrackingDashboard /></Suspense>,
    category: 'security',
    priority: 'medium',
    roles: ['admin', 'super_admin', 'compliance_officer'],
  },
  {
    id: 'patient-amendment-review',
    title: 'Patient Amendment Review Queue',
    subtitle: 'Review and respond to patient requests to amend their health records (45 CFR 164.526)',
    icon: '✏️',
    headerColor: 'text-orange-900',
    component: <Suspense fallback={<SectionLoadingFallback />}><PatientAmendmentReviewQueue /></Suspense>,
    category: 'security',
    priority: 'medium',
    roles: ['admin', 'super_admin', 'physician', 'nurse', 'compliance_officer'],
  },
  {
    id: 'training-compliance',
    title: 'Workforce Training Compliance',
    subtitle: 'HIPAA workforce security awareness training tracking and compliance rates',
    icon: '🎓',
    headerColor: 'text-violet-900',
    component: <Suspense fallback={<SectionLoadingFallback />}><TrainingComplianceDashboard /></Suspense>,
    category: 'security',
    priority: 'medium',
    roles: ['admin', 'super_admin', 'compliance_officer'],
  },

  // ==================== SYSTEM ADMINISTRATION ====================
  {
    id: 'facility-management',
    title: 'Facility Management',
    subtitle: 'Manage hospitals, clinics, and other facilities in your organization',
    icon: '🏥',
    headerColor: 'text-blue-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><FacilityManagementPanel /></Suspense>,
    category: 'admin',
    priority: 'high',
    roles: ['admin', 'super_admin', 'system_admin'],
  },
  {
    id: 'module-configuration',
    title: 'Module Configuration',
    subtitle: 'Enable or disable platform modules for your organization',
    icon: '⚙️',
    headerColor: 'text-teal-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><TenantModuleConfigPanel /></Suspense>,
    category: 'admin',
    priority: 'high',
    roles: ['admin', 'super_admin', 'system_admin'],
  },
  {
    id: 'data-export',
    title: 'Data Export & Advanced Tools',
    subtitle: 'Export data and access advanced administrative functions',
    icon: '📤',
    headerColor: 'text-gray-800',
    component: <Suspense fallback={<SectionLoadingFallback />}><ExportCheckIns /></Suspense>,
    category: 'admin',
    priority: 'low',
  },
];

/**
 * Get sections filtered by category
 */
export const getSectionsByCategory = (category: DashboardSection['category']): DashboardSection[] => {
  return getAllSections().filter(section => section.category === category);
};
