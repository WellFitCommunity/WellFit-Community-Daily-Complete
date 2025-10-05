import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import RequireAdminAuth from 'components/auth/RequireAdminAuth';
import AdminHeader from './AdminHeader';

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
    <section className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-200"
      >
        <div className="flex items-center flex-1">
          <span className="text-2xl mr-3">{icon}</span>
          <div className="text-left">
            <h2 className={`text-xl font-semibold ${headerColor}`}>{title}</h2>
            {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
          </div>
        </div>
        <span className={`text-gray-500 transform transition-transform duration-200 text-xl ${isOpen ? 'rotate-180' : ''}`}>
          ⌄
        </span>
      </button>

      {isOpen && (
        <div className="p-6">
          {children}
        </div>
      )}
    </section>
  );
};

const AdminPanel: React.FC = () => {
  const { adminRole } = useAdminAuth();
  const navigate = useNavigate();

  return (
    <RequireAdminAuth allowedRoles={['admin', 'super_admin']}>
      <div className="min-h-screen bg-gray-50">
        <AdminHeader title="WellFit Admin Dashboard" showRiskAssessment={true} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

          {/* Quick Actions Bar */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl shadow-lg p-6">
            <h2 className="text-white text-xl font-bold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <button
                onClick={() => navigate('/admin/enroll-senior')}
                className="bg-white text-emerald-700 px-6 py-4 rounded-lg font-semibold hover:bg-emerald-50 transition-colors shadow-md flex items-center justify-center"
              >
                <span className="mr-2 text-2xl">➕</span>
                Enroll Senior
              </button>
              <button
                onClick={() => navigate('/admin/bulk-enroll')}
                className="bg-white text-blue-700 px-6 py-4 rounded-lg font-semibold hover:bg-blue-50 transition-colors shadow-md flex items-center justify-center"
              >
                <span className="mr-2 text-2xl">👥</span>
                Bulk Enroll
              </button>
              <button
                onClick={() => navigate('/admin/bulk-export')}
                className="bg-white text-indigo-700 px-6 py-4 rounded-lg font-semibold hover:bg-indigo-50 transition-colors shadow-md flex items-center justify-center"
              >
                <span className="mr-2 text-2xl">📤</span>
                Bulk Export
              </button>
              <button
                onClick={() => navigate('/admin-questions')}
                className="bg-white text-purple-700 px-6 py-4 rounded-lg font-semibold hover:bg-purple-50 transition-colors shadow-md flex items-center justify-center"
              >
                <span className="mr-2 text-2xl">💬</span>
                Questions
              </button>
              <button
                onClick={() => navigate('/admin-profile-editor')}
                className="bg-white text-green-700 px-6 py-4 rounded-lg font-semibold hover:bg-green-50 transition-colors shadow-md flex items-center justify-center"
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
            headerColor="text-indigo-800"
            defaultOpen={true}
          >
            <PatientEngagementDashboard />
          </CollapsibleSection>

          {/* Smart Medical Scribe */}
          <CollapsibleSection
            title="Smart Medical Scribe"
            subtitle="AI-powered medical transcription and coding assistance"
            icon="🎤"
            headerColor="text-purple-800"
          >
            <SmartScribe />
          </CollapsibleSection>

          {/* Project Atlas: CCM Autopilot */}
          <CollapsibleSection
            title="CCM Autopilot - Chronic Care Management"
            subtitle="Automatic tracking of 20+ minute patient interactions for CCM billing"
            icon="⏱️"
            headerColor="text-purple-800"
          >
            <CCMTimeline />
          </CollapsibleSection>

          {/* Project Atlas: Revenue Dashboard */}
          <CollapsibleSection
            title="Revenue Dashboard - Project Atlas"
            subtitle="Real-time revenue analytics and optimization opportunities"
            icon="💰"
            headerColor="text-green-800"
          >
            <RevenueDashboard />
          </CollapsibleSection>

          {/* Project Atlas: Claims Submission */}
          <CollapsibleSection
            title="Claims Submission Center"
            subtitle="Generate and submit 837P claims to clearinghouses"
            icon="📋"
            headerColor="text-blue-800"
          >
            <ClaimsSubmissionPanel />
          </CollapsibleSection>

          {/* Project Atlas: Claims Appeals */}
          <CollapsibleSection
            title="Claims Appeals & Resubmission"
            subtitle="AI-assisted appeal letters for denied claims"
            icon="🔄"
            headerColor="text-red-800"
          >
            <ClaimsAppealsPanel />
          </CollapsibleSection>

          {/* SDOH Billing Encoder */}
          <CollapsibleSection
            title="SDOH Billing Encoder"
            subtitle="Social determinants of health-aware medical coding"
            icon="🏥"
            headerColor="text-indigo-800"
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
            headerColor="text-purple-800"
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
              headerColor="text-blue-800"
            >
              <FHIRFormBuilderEnhanced />
            </CollapsibleSection>

            <CollapsibleSection
              title="FHIR Data Mapper"
              subtitle="Transform legacy data into FHIR-compliant formats"
              icon="🔄"
              headerColor="text-teal-800"
            >
              <FHIRDataMapper />
            </CollapsibleSection>
          </div>

          {/* Billing Dashboard */}
          <CollapsibleSection
            title="Billing & Claims Management"
            subtitle="Monitor claims processing and revenue tracking"
            icon="💳"
            headerColor="text-green-800"
          >
            <BillingDashboard />
          </CollapsibleSection>

          {/* Patient Handoff System */}
          <CollapsibleSection
            title="Patient Handoff System"
            subtitle="Secure transfer of care between facilities - HIPAA compliant audit trail"
            icon="🏥"
            headerColor="text-teal-800"
          >
            <AdminTransferLogs showExportButton={true} />
          </CollapsibleSection>

          {/* Core Admin Functions Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CollapsibleSection
              title="User Management"
              subtitle="Manage patient and staff accounts"
              icon="👥"
              headerColor="text-gray-800"
            >
              <UsersList />
            </CollapsibleSection>

            <CollapsibleSection
              title="Reports & Analytics"
              subtitle="System-wide analytics and insights"
              icon="📊"
              headerColor="text-gray-800"
            >
              <ReportsSection />
            </CollapsibleSection>
          </div>

          {/* Data Export */}
          <CollapsibleSection
            title="Data Export & Advanced Tools"
            subtitle="Export data and access advanced administrative functions"
            icon="📤"
            headerColor="text-gray-800"
          >
            <ExportCheckIns />
          </CollapsibleSection>

          {/* Super Admin Only Features */}
          {adminRole === 'super_admin' && (
            <CollapsibleSection
              title="Super Admin Features"
              subtitle="Advanced system administration and AI testing"
              icon="🔐"
              headerColor="text-blue-800"
            >
              <div className="bg-green-50 rounded-lg p-6">
                <h3 className="text-lg font-medium text-green-700 mb-4 flex items-center">
                  <span className="mr-2">🧠</span>
                  Claude AI Service Test
                </h3>
                <p className="text-green-600 text-sm mb-4">Test and validate AI service integration</p>
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
              headerColor="text-yellow-800"
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