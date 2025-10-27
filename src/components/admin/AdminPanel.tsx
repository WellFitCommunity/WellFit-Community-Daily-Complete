import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { useUser } from '../../contexts/AuthContext';
import RequireAdminAuth from 'components/auth/RequireAdminAuth';
import AdminHeader from './AdminHeader';
import WhatsNewModal from './WhatsNewModal';

import UsersList from './UsersList';
import ReportsSection from './ReportsSection';
import ExportCheckIns from './ExportCheckIns';
import ClaudeTestWidget from './ClaudeTestWidget';
import FhirAiDashboard from './FhirAiDashboard';
import FHIRFormBuilderEnhanced from './FHIRFormBuilderEnhanced';
import FHIRDataMapper from './FHIRDataMapper';
import BillingDashboard from './BillingDashboard';
import ApiKeyManager from './ApiKeyManager';
import SmartScribe from '../smart/RealTimeSmartScribe';
import SDOHCoderAssist from '../billing/SDOHCoderAssist';
import CCMTimeline from '../atlas/CCMTimeline';
import RevenueDashboard from '../atlas/RevenueDashboard';
import ClaimsSubmissionPanel from '../atlas/ClaimsSubmissionPanel';
import ClaimsAppealsPanel from '../atlas/ClaimsAppealsPanel';
import AdminTransferLogs from '../handoff/AdminTransferLogs';
import PatientEngagementDashboard from './PatientEngagementDashboard';
import PersonalizedGreeting from '../shared/PersonalizedGreeting';
import { SOC2SecurityDashboard } from './SOC2SecurityDashboard';
import { SOC2AuditDashboard } from './SOC2AuditDashboard';
import { SOC2IncidentResponseDashboard } from './SOC2IncidentResponseDashboard';
import { SOC2ExecutiveDashboard } from './SOC2ExecutiveDashboard';
import { SystemAdminDashboard } from './SystemAdminDashboard';
import HospitalAdapterManagementPanel from './HospitalAdapterManagementPanel';

// Collapsible Section Component
interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  headerColor?: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  subtitle,
  icon,
  children,
  defaultOpen = false,
  headerColor = 'text-gray-800'
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="bg-white rounded-xl shadow-lg border border-black overflow-hidden hover:border-2 hover:border-[#1BA39C] transition-all">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between bg-[#E8F8F7] hover:bg-[#D1F2F0] transition-all border-b border-black"
      >
        <div className="flex items-center flex-1">
          <span className="text-2xl mr-3">{icon}</span>
          <div className="text-left">
            <h2 className={`text-xl font-semibold ${headerColor}`}>{title}</h2>
            {subtitle && <p className="text-sm text-[#6B7280] mt-1">{subtitle}</p>}
          </div>
        </div>
        <span className={`text-[#1BA39C] transform transition-transform duration-200 text-xl font-bold ${isOpen ? 'rotate-180' : ''}`}>
          ⌄
        </span>
      </button>

      {isOpen && (
        <div className="p-6 bg-white border-t border-black">
          {children}
        </div>
      )}
    </section>
  );
};

const AdminPanel: React.FC = () => {
  const { adminRole } = useAdminAuth();
  const user = useUser();
  const navigate = useNavigate();
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  useEffect(() => {
    // Auto-show What's New modal if user hasn't seen latest updates
    const lastSeenVersion = localStorage.getItem('whatsNew_lastSeen');
    const permanentlyDismissed = localStorage.getItem('whatsNew_permanentlyDismissed');
    const currentVersion = '2025-10-14'; // Update this when adding new features

    // Don't show if permanently dismissed
    if (permanentlyDismissed === 'true') {
      console.log('[WhatsNew] Modal permanently dismissed by user');
      return;
    }

    if (lastSeenVersion !== currentVersion) {
      // Show after a short delay for better UX
      console.log('[WhatsNew] Showing modal for version:', currentVersion);
      setTimeout(() => setShowWhatsNew(true), 1000);
    }
  }, []);

  return (
    <RequireAdminAuth allowedRoles={['admin', 'super_admin']}>
      <div className="min-h-screen bg-[#E8F8F7]">
        <AdminHeader title="Envision Atlus - Admin Dashboard" showRiskAssessment={true} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

          {/* Personalized Greeting */}
          <PersonalizedGreeting
            userName={user?.email || user?.user_metadata?.full_name}
            userRole="admin"
          />

          {/* What's New Modal */}
          <WhatsNewModal isOpen={showWhatsNew} onClose={() => setShowWhatsNew(false)} />

          {/* Quick Actions Bar - SILVER STATEMENT HERO */}
          <div className="bg-gradient-to-r from-[#C0C5CB] to-[#A8ADB3] rounded-xl shadow-2xl p-6 border-2 border-black">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-black text-xl font-bold flex items-center gap-2">
                <span className="text-[#1BA39C]">⚡</span>
                Quick Actions
              </h2>
              <button
                onClick={() => setShowWhatsNew(true)}
                className="bg-[#C8E63D] hover:bg-[#A8C230] text-black px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-md hover:shadow-lg flex items-center space-x-2 border-2 border-black"
                title="View recent updates"
              >
                <span>✨</span>
                <span>What's New</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <button
                onClick={() => navigate('/admin/enroll-senior')}
                className="bg-white text-black px-6 py-4 rounded-lg font-bold hover:bg-[#E8F8F7] hover:scale-105 transition-all shadow-lg hover:shadow-xl flex items-center justify-center border-2 border-black"
              >
                <span className="mr-2 text-2xl">➕</span>
                Enroll Senior
              </button>
              <button
                onClick={() => navigate('/admin/bulk-enroll')}
                className="bg-white text-black px-6 py-4 rounded-lg font-bold hover:bg-[#E8F8F7] hover:scale-105 transition-all shadow-lg hover:shadow-xl flex items-center justify-center border-2 border-black"
              >
                <span className="mr-2 text-2xl">👥</span>
                Bulk Enroll
              </button>
              <button
                onClick={() => navigate('/admin/bulk-export')}
                className="bg-white text-black px-6 py-4 rounded-lg font-bold hover:bg-[#E8F8F7] hover:scale-105 transition-all shadow-lg hover:shadow-xl flex items-center justify-center border-2 border-black"
              >
                <span className="mr-2 text-2xl">📤</span>
                Bulk Export
              </button>
              <button
                onClick={() => navigate('/admin/photo-approval')}
                className="bg-white text-black px-6 py-4 rounded-lg font-bold hover:bg-[#E8F8F7] hover:scale-105 transition-all shadow-lg hover:shadow-xl flex items-center justify-center border-2 border-black"
              >
                <span className="mr-2 text-2xl">📸</span>
                Approve Photos
              </button>
              <button
                onClick={() => navigate('/admin-questions')}
                className="bg-white text-black px-6 py-4 rounded-lg font-bold hover:bg-[#E8F8F7] hover:scale-105 transition-all shadow-lg hover:shadow-xl flex items-center justify-center border-2 border-black"
              >
                <span className="mr-2 text-2xl">💬</span>
                Questions
              </button>
              <button
                onClick={() => navigate('/admin-profile-editor')}
                className="bg-white text-black px-6 py-4 rounded-lg font-bold hover:bg-[#E8F8F7] hover:scale-105 transition-all shadow-lg hover:shadow-xl flex items-center justify-center border-2 border-black"
              >
                <span className="mr-2 text-2xl">✏️</span>
                Edit Profiles
              </button>
            </div>
          </div>

          {/* Patient Engagement Dashboard - CRITICAL FOR RISK ASSESSMENT */}
          <CollapsibleSection
            title="Patient Engagement & Risk Assessment"
            subtitle="Monitor senior activity levels to identify at-risk patients - includes trivia, games, check-ins, questions"
            icon="📊"
            headerColor="text-[#1BA39C]"
            defaultOpen={false}
          >
            <PatientEngagementDashboard />
          </CollapsibleSection>

          {/* SmartScribe Atlas - Revenue-Critical AI Transcription */}
          <CollapsibleSection
            title="SmartScribe Atlas 💰"
            subtitle="AI-powered transcription with Claude Sonnet 4.5 for maximum billing accuracy"
            icon="🎤"
            headerColor="text-[#C8E63D]"
          >
            <SmartScribe />
          </CollapsibleSection>

          {/* Project Atlas: CCM Autopilot */}
          <CollapsibleSection
            title="CCM Autopilot - Chronic Care Management"
            subtitle="Automatic tracking of 20+ minute patient interactions for CCM billing"
            icon="⏱️"
            headerColor="text-[#1BA39C]"
          >
            <CCMTimeline />
          </CollapsibleSection>

          {/* Project Atlas: Revenue Dashboard */}
          <CollapsibleSection
            title="Revenue Dashboard - Project Atlas"
            subtitle="Real-time revenue analytics and optimization opportunities"
            icon="💰"
            headerColor="text-[#C8E63D]"
          >
            <RevenueDashboard />
          </CollapsibleSection>

          {/* Project Atlas: Claims Submission */}
          <CollapsibleSection
            title="Claims Submission Center"
            subtitle="Generate and submit 837P claims to clearinghouses"
            icon="📋"
            headerColor="text-[#1BA39C]"
          >
            <ClaimsSubmissionPanel />
          </CollapsibleSection>

          {/* Project Atlas: Claims Appeals */}
          <CollapsibleSection
            title="Claims Appeals & Resubmission"
            subtitle="AI-assisted appeal letters for denied claims"
            icon="🔄"
            headerColor="text-[#158A84]"
          >
            <ClaimsAppealsPanel />
          </CollapsibleSection>

          {/* SDOH Billing Encoder */}
          <CollapsibleSection
            title="SDOH Billing Encoder"
            subtitle="Social determinants of health-aware medical coding"
            icon="🏥"
            headerColor="text-[#1BA39C]"
          >
            <SDOHCoderAssist
              encounterId="demo-encounter-id"
              patientId="demo-patient-id"
              onSaved={(data) => console.log('Coding saved:', data)}
            />
          </CollapsibleSection>

          {/* FHIR Analytics Dashboard */}
          <CollapsibleSection
            title="AI-Enhanced FHIR Analytics"
            subtitle="Real-time patient insights and clinical decision support"
            icon="🧠"
            headerColor="text-[#1BA39C]"
          >
            <FhirAiDashboard
              supabaseUrl={process.env.REACT_APP_SUPABASE_URL || ''}
              supabaseKey={process.env.REACT_APP_SUPABASE_ANON_KEY || ''}
            />
          </CollapsibleSection>

          {/* FHIR Tools Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CollapsibleSection
              title="FHIR Questionnaire Builder"
              subtitle="Create standardized clinical questionnaires using AI"
              icon="📝"
              headerColor="text-[#1BA39C]"
            >
              <FHIRFormBuilderEnhanced />
            </CollapsibleSection>

            <CollapsibleSection
              title="FHIR Data Mapper"
              subtitle="Transform legacy data into FHIR-compliant formats"
              icon="🔄"
              headerColor="text-[#158A84]"
            >
              <FHIRDataMapper />
            </CollapsibleSection>

            {/* Hospital EHR/EMR Adapter Management */}
            <CollapsibleSection
              title="Hospital EHR/EMR Integrations"
              subtitle="Connect to Epic, Cerner, Athenahealth, and other hospital systems"
              icon="🏥"
              headerColor="text-[#1BA39C]"
              defaultOpen={false}
            >
              <HospitalAdapterManagementPanel />
            </CollapsibleSection>
          </div>

          {/* Billing Dashboard */}
          <CollapsibleSection
            title="Billing & Claims Management"
            subtitle="Monitor claims processing and revenue tracking"
            icon="💳"
            headerColor="text-[#C8E63D]"
          >
            <BillingDashboard />
          </CollapsibleSection>

          {/* Patient Handoff System */}
          <CollapsibleSection
            title="Patient Handoff System"
            subtitle="Secure transfer of care between facilities - HIPAA compliant audit trail"
            icon="🏥"
            headerColor="text-[#1BA39C]"
          >
            <AdminTransferLogs showExportButton={true} />
          </CollapsibleSection>

          {/* SOC 2 Compliance & Security Monitoring */}
          <CollapsibleSection
            title="SOC 2 Executive Summary"
            subtitle="High-level security posture and compliance overview for leadership"
            icon="📊"
            headerColor="text-[#2D3339]"
            defaultOpen={false}
          >
            <SOC2ExecutiveDashboard />
          </CollapsibleSection>

          <CollapsibleSection
            title="Security Operations Center"
            subtitle="Real-time security monitoring, threat detection, and event tracking"
            icon="🛡️"
            headerColor="text-[#158A84]"
            defaultOpen={false}
          >
            <SOC2SecurityDashboard />
          </CollapsibleSection>

          <CollapsibleSection
            title="Audit & Compliance Center"
            subtitle="PHI access logs, audit trails, and SOC 2 compliance status"
            icon="📋"
            headerColor="text-[#1BA39C]"
            defaultOpen={false}
          >
            <SOC2AuditDashboard />
          </CollapsibleSection>

          <CollapsibleSection
            title="Incident Response Center"
            subtitle="Security incident investigation queue with SLA tracking"
            icon="🚨"
            headerColor="text-[#C8E63D]"
            defaultOpen={false}
          >
            <SOC2IncidentResponseDashboard />
          </CollapsibleSection>

          <CollapsibleSection
            title="System Administration"
            subtitle="Infrastructure health, database monitoring, active sessions, and system metrics"
            icon="⚙️"
            headerColor="text-[#2D3339]"
            defaultOpen={false}
          >
            <SystemAdminDashboard />
          </CollapsibleSection>

          {/* Core Admin Functions Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CollapsibleSection
              title="User Management"
              subtitle="Manage patient and staff accounts"
              icon="👥"
              headerColor="text-[#1BA39C]"
            >
              <UsersList />
            </CollapsibleSection>

            <CollapsibleSection
              title="Reports & Analytics"
              subtitle="System-wide analytics and insights"
              icon="📊"
              headerColor="text-[#1BA39C]"
            >
              <ReportsSection />
            </CollapsibleSection>
          </div>

          {/* Data Export */}
          <CollapsibleSection
            title="Data Export & Advanced Tools"
            subtitle="Export data and access advanced administrative functions"
            icon="📤"
            headerColor="text-[#158A84]"
          >
            <ExportCheckIns />
          </CollapsibleSection>

          {/* Super Admin Only Features */}
          {adminRole === 'super_admin' && (
            <CollapsibleSection
              title="Super Admin Features"
              subtitle="Advanced system administration and AI testing"
              icon="🔐"
              headerColor="text-black"
            >
              <div className="bg-[#E8F8F7] rounded-lg p-6 border border-black">
                <h3 className="text-lg font-bold text-black mb-4 flex items-center">
                  <span className="mr-2">🧠</span>
                  Claude AI Service Test
                </h3>
                <p className="text-[#158A84] text-sm mb-4 font-medium">Test and validate AI service integration</p>
                <ClaudeTestWidget />
              </div>
            </CollapsibleSection>
          )}

          {/* API Key Manager - Moved to Bottom as requested */}
          {adminRole === 'super_admin' && (
            <CollapsibleSection
              title="API Key Manager"
              subtitle="Generate and manage API keys for system integrations"
              icon="🔑"
              headerColor="text-[#C8E63D]"
            >
              <ApiKeyManager />
            </CollapsibleSection>
          )}

        </div>
      </div>
    </RequireAdminAuth>
  );
};

export default AdminPanel;