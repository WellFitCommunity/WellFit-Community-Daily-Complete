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
const AdminTransferLogs = lazy(() => import('../../handoff/AdminTransferLogs'));
const PatientEngagementDashboard = lazy(() => import('../PatientEngagementDashboard'));
const HospitalPatientEnrollment = lazy(() => import('../HospitalPatientEnrollment'));
const PaperFormScanner = lazy(() => import('../PaperFormScanner'));
const TenantSecurityDashboard = lazy(() => import('../TenantSecurityDashboard'));
const TenantAuditLogs = lazy(() => import('../TenantAuditLogs'));
const TenantComplianceReport = lazy(() => import('../TenantComplianceReport'));

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
    subtitle: 'AI transcription with Claude Sonnet 4.5 for maximum billing accuracy',
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

  // ==================== CLINICAL DATA ====================
  {
    id: 'fhir-analytics',
    title: 'AI-Enhanced FHIR Analytics',
    subtitle: 'Real-time patient insights and clinical decision support',
    icon: '🧠',
    headerColor: 'text-purple-800',
    component: (
      <Suspense fallback={<SectionLoadingFallback />}>
        <FhirAiDashboard
          supabaseUrl={process.env.REACT_APP_SUPABASE_URL || ''}
          supabaseKey={process.env.REACT_APP_SUPABASE_ANON_KEY || ''}
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

  // ==================== SECURITY & COMPLIANCE ====================
  {
    id: 'tenant-security',
    title: 'Facility Security Dashboard',
    subtitle: 'Real-time security monitoring for your facility',
    icon: '🛡️',
    headerColor: 'text-red-900',
    component: <Suspense fallback={<SectionLoadingFallback />}><TenantSecurityDashboard /></Suspense>,
    category: 'security',
    priority: 'medium',
    roles: ['admin', 'super_admin'],
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
    roles: ['admin', 'super_admin'],
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
    roles: ['admin', 'super_admin'],
  },

  // ==================== SYSTEM ADMINISTRATION ====================
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
