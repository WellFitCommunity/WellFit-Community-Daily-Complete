// ============================================================================
// Social Worker Panel - Psychosocial Support & Crisis Intervention
// ============================================================================

import React, { useState } from 'react';
import AdminHeader from '../admin/AdminHeader';
import ClaudeCareAssistantPanel from '../claude-care/ClaudeCareAssistantPanel';
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

const SocialWorkerPanel: React.FC = () => {
  const [selectedPatient, setSelectedPatient] = useState<{
    user_id: string;
    first_name: string;
    last_name: string;
  } | null>(null);

  return (
    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'social_worker']}>
      <div className="min-h-screen bg-[#E8F8F7]">
        <AdminHeader title="🤝 Envision Atlus - Social Worker Dashboard" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
          {/* Hero Header */}
          <div className="bg-gradient-to-r from-pink-600 to-purple-600 rounded-2xl shadow-2xl p-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                  🤝 Social Work Hub
                </h1>
                <p className="text-white/90 text-lg font-medium">
                  Psychosocial Assessments, Crisis Intervention & Community Support
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-xl p-4 border border-black">
              <div className="text-sm text-gray-600 font-bold">Active Cases</div>
              <div className="text-2xl font-bold text-black">18</div>
            </div>
            <div className="bg-white rounded-lg shadow-xl p-4 border border-black">
              <div className="text-sm text-gray-600 font-bold">Crisis Interventions</div>
              <div className="text-2xl font-bold text-black">3</div>
            </div>
            <div className="bg-white rounded-lg shadow-xl p-4 border border-black">
              <div className="text-sm text-gray-600 font-bold">Benefits Applications</div>
              <div className="text-2xl font-bold text-black">7</div>
            </div>
            <div className="bg-white rounded-lg shadow-xl p-4 border border-black">
              <div className="text-sm text-gray-600 font-bold">Resource Referrals</div>
              <div className="text-2xl font-bold text-black">15</div>
            </div>
          </div>

          {/* Claude Care Assistant - Primary Tool */}
          <CollapsibleSection
            title="Claude Care Assistant - AI Admin Automation"
            icon="🤖"
            defaultOpen={true}
          >
            <div className="mb-4 p-4 bg-pink-50 border border-pink-200 rounded-lg">
              <p className="text-pink-800 text-sm">
                <strong>Social Work Automation:</strong> Generate psychosocial assessments,
                crisis intervention documentation, safety plans, benefits applications, and
                housing assistance referrals with AI. Translate in 50+ languages for diverse
                patient populations. Collaborate with medical and nursing teams.
              </p>
              <div className="mt-2 flex gap-2 flex-wrap">
                <span className="text-xs bg-pink-600 text-white px-2 py-1 rounded">Psychosocial Assessment</span>
                <span className="text-xs bg-pink-600 text-white px-2 py-1 rounded">Crisis Intervention</span>
                <span className="text-xs bg-pink-600 text-white px-2 py-1 rounded">Safety Plans</span>
                <span className="text-xs bg-pink-600 text-white px-2 py-1 rounded">Benefits Applications</span>
                <span className="text-xs bg-pink-600 text-white px-2 py-1 rounded">Translation (50+ Languages)</span>
              </div>
            </div>
            <ClaudeCareAssistantPanel
              userRole="social_worker"
              patientId={selectedPatient?.user_id}
              userId={selectedPatient?.user_id}
            />
          </CollapsibleSection>

          {/* Crisis Intervention Dashboard */}
          <CollapsibleSection
            title="Crisis Intervention Dashboard"
            icon="🚨"
            defaultOpen={false}
          >
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">
                Track active crisis interventions, safety assessments, and emergency referrals.
                Document interventions with evidence-based protocols. Coordinate with psychiatric
                services and community crisis teams.
              </p>
            </div>
            <div className="mt-4 text-center text-gray-500">
              Crisis intervention dashboard coming soon...
            </div>
          </CollapsibleSection>

          {/* Benefits & Resources */}
          <CollapsibleSection
            title="Benefits & Resource Navigation"
            icon="📋"
            defaultOpen={false}
          >
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800">
                Help patients apply for Medicaid, SSI/SSDI, SNAP, housing assistance, and other
                social services. Track application status and follow-up deadlines. Generate
                supporting documentation.
              </p>
            </div>
            <div className="mt-4 text-center text-gray-500">
              Benefits navigation tools coming soon...
            </div>
          </CollapsibleSection>

          {/* Psychosocial Assessments */}
          <CollapsibleSection
            title="Psychosocial Assessment Tracker"
            icon="📊"
            defaultOpen={false}
          >
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800">
                Complete comprehensive psychosocial assessments including mental health screening,
                substance use history, social support systems, financial stressors, and housing
                stability. Track assessment completion and recommendations.
              </p>
            </div>
            <div className="mt-4 text-center text-gray-500">
              Assessment tracker coming soon...
            </div>
          </CollapsibleSection>

          {/* Community Resources */}
          <CollapsibleSection
            title="Community Resource Directory"
            icon="🏘️"
            defaultOpen={false}
          >
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-purple-800">
                Access comprehensive directory of community resources including food banks,
                homeless shelters, domestic violence services, mental health programs, substance
                abuse treatment, and support groups.
              </p>
            </div>
            <div className="mt-4 text-center text-gray-500">
              Resource directory coming soon...
            </div>
          </CollapsibleSection>
        </div>
      </div>
    </RequireAdminAuth>
  );
};

export default SocialWorkerPanel;
