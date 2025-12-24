// ============================================================================
// Case Manager Panel - Discharge Planning & Resource Coordination
// ============================================================================

import React, { useState } from 'react';
import AdminHeader from '../admin/AdminHeader';
import ClaudeCareAssistantPanel from '../claude-care/ClaudeCareAssistantPanel';
import CHWAlertsWidget from '../chw/CHWAlertsWidget';
import RequireAdminAuth from '../auth/RequireAdminAuth';

interface CollapsibleSectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  children,
  defaultOpen = false
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="bg-white rounded-xl shadow-lg border border-black overflow-hidden hover:border-2 hover:border-[#1BA39C] transition-all">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between bg-[#E8F8F7] hover:bg-[#D1F2F0] transition-all border-b border-black"
      >
        <div className="flex items-center">
          <span className="text-2xl mr-3">{icon}</span>
          <h2 className="text-xl font-bold text-black">{title}</h2>
        </div>
        <span className={`text-[#1BA39C] font-bold transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="px-6 py-4 bg-white">
          {children}
        </div>
      )}
    </section>
  );
};

const CaseManagerPanel: React.FC = () => {
  const [selectedPatient, _setSelectedPatient] = useState<{
    user_id: string;
    first_name: string;
    last_name: string;
  } | null>(null);

  return (
    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'case_manager']}>
      <div className="min-h-screen bg-[#E8F8F7]">
        <AdminHeader title="📋 Envision Atlus - Case Manager Dashboard" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
          {/* Hero Header */}
          <div className="bg-linear-to-r from-purple-600 to-blue-600 rounded-2xl shadow-2xl p-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                  📋 Case Management Hub
                </h1>
                <p className="text-white/90 text-lg font-medium">
                  Discharge Planning, Resource Coordination & Insurance Verification
                </p>
              </div>
            </div>
          </div>

          {/* CHW Field Alerts */}
          <CHWAlertsWidget userRole="case_manager" userId={localStorage.getItem('userId') || ''} maxAlerts={5} />

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-xl p-4 border border-black">
              <div className="text-sm text-gray-600 font-bold">Active Cases</div>
              <div className="text-2xl font-bold text-black">24</div>
            </div>
            <div className="bg-white rounded-lg shadow-xl p-4 border border-black">
              <div className="text-sm text-gray-600 font-bold">Pending Discharges</div>
              <div className="text-2xl font-bold text-black">8</div>
            </div>
            <div className="bg-white rounded-lg shadow-xl p-4 border border-black">
              <div className="text-sm text-gray-600 font-bold">Insurance Verifications</div>
              <div className="text-2xl font-bold text-black">5</div>
            </div>
            <div className="bg-white rounded-lg shadow-xl p-4 border border-black">
              <div className="text-sm text-gray-600 font-bold">Resource Referrals</div>
              <div className="text-2xl font-bold text-black">12</div>
            </div>
          </div>

          {/* Claude Care Assistant - Primary Tool */}
          <CollapsibleSection
            title="Claude Care Assistant - AI Admin Automation"
            icon="🤖"
            defaultOpen={true}
          >
            <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-purple-800 text-sm">
                <strong>Case Management Automation:</strong> Generate discharge planning summaries,
                insurance verification letters, length-of-stay justifications, skilled nursing
                recommendations, and resource coordination documents with AI. Collaborate with
                nurses, physicians, and social workers in real-time.
              </p>
              <div className="mt-2 flex gap-2 flex-wrap">
                <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-sm">Discharge Planning</span>
                <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-sm">Insurance Verification</span>
                <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-sm">LOS Justification</span>
                <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-sm">Resource Coordination</span>
                <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-sm">Team Collaboration</span>
              </div>
            </div>
            <ClaudeCareAssistantPanel
              userRole="case_manager"
              patientId={selectedPatient?.user_id}
              userId={selectedPatient?.user_id}
            />
          </CollapsibleSection>

          {/* Discharge Planning Dashboard */}
          <CollapsibleSection
            title="Discharge Planning Dashboard"
            icon="🏠"
            defaultOpen={false}
          >
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800">
                Track discharge planning progress, coordinate with skilled nursing facilities,
                home health agencies, and outpatient services. Ensure smooth transitions of care.
              </p>
            </div>
            <div className="mt-4 text-center text-gray-500">
              Discharge planning dashboard coming soon...
            </div>
          </CollapsibleSection>

          {/* Resource Directory */}
          <CollapsibleSection
            title="Community Resource Directory"
            icon="🗂️"
            defaultOpen={false}
          >
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800">
                Access comprehensive directory of community resources including skilled nursing
                facilities, home health agencies, DME suppliers, transportation services,
                and social support programs.
              </p>
            </div>
            <div className="mt-4 text-center text-gray-500">
              Resource directory coming soon...
            </div>
          </CollapsibleSection>

          {/* Insurance Verification */}
          <CollapsibleSection
            title="Insurance Verification Tracker"
            icon="💳"
            defaultOpen={false}
          >
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">
                Track insurance verifications, prior authorizations, and benefit confirmations.
                Automated letters and follow-up reminders.
              </p>
            </div>
            <div className="mt-4 text-center text-gray-500">
              Insurance verification tracker coming soon...
            </div>
          </CollapsibleSection>
        </div>
      </div>
    </RequireAdminAuth>
  );
};

export default CaseManagerPanel;
