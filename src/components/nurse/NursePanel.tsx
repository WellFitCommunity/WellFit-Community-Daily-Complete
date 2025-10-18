import React, { useState } from 'react';
import RequireAdminAuth from '../auth/RequireAdminAuth';
import AdminHeader from '../admin/AdminHeader';
import UserQuestions from '../UserQuestions';
import SmartScribe from '../smart/RealTimeSmartScribe';
import RiskAssessmentManager from '../admin/RiskAssessmentManager';
import ReportsSection from '../admin/ReportsSection';
import CCMTimeline from '../atlas/CCMTimeline';
import RevenueDashboard from '../atlas/RevenueDashboard';
import ResilienceHubDashboard from '../nurseos/ResilienceHubDashboard';
import ShiftHandoffDashboard from './ShiftHandoffDashboard';
import { supabase } from '../../lib/supabaseClient';

// Collapsible Section Component
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
    <section className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center">
          <span className="text-2xl mr-3">{icon}</span>
          <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
        </div>
        <span className={`text-gray-500 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="px-6 py-4 border-t border-gray-200">
          {children}
        </div>
      )}
    </section>
  );
};

// Enrollment Section for Nurses
const NurseEnrollPatientSection: React.FC = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleEnroll = async () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const tempPassword = generateTempPassword();

      const { error } = await supabase.functions.invoke('enrollClient', {
        body: {
          phone,
          password: tempPassword,
          first_name: firstName,
          last_name: lastName,
          email: email || undefined
        }
      });

      if (error) throw error;

      setMessage({
        type: 'success',
        text: `${firstName} ${lastName} enrolled successfully! Temp password: ${tempPassword}`
      });

      // Reset form
      setFirstName('');
      setLastName('');
      setPhone('');
      setEmail('');
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: `Enrollment failed: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  const generateTempPassword = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  return (
    <div className="max-w-2xl">
      {message && (
        <div className={`mb-4 p-3 rounded-lg ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500"
            placeholder="First name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500"
            placeholder="Last name"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500"
            placeholder="+15551234567"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email (Optional)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500"
            placeholder="email@example.com"
          />
        </div>
      </div>

      <button
        onClick={handleEnroll}
        disabled={loading}
        className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
      >
        {loading ? 'Enrolling...' : 'Enroll Patient'}
      </button>
    </div>
  );
};

const NursePanel: React.FC = () => {
  return (
    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'nurse']}>
      <div className="min-h-screen bg-gray-50">
        {/* Header without API Key Manager */}
        <AdminHeader title="Nurse Dashboard" showRiskAssessment={true} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">

          {/* ============================================================ */}
          {/* HOSPITAL NURSING TOOLS */}
          {/* ============================================================ */}
          <section>
            <div className="mb-4 pb-2 border-b-2 border-blue-500">
              <h2 className="text-2xl font-bold text-blue-800 flex items-center gap-2">
                🏥 Hospital Nursing Tools
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                For acute care, ICU, ER, and med/surg nurses
              </p>
            </div>

            <div className="space-y-6">
              {/* Smart Shift Handoff - AI-Assisted Patient Prioritization */}
              <CollapsibleSection title="Smart Shift Handoff - Patient Prioritization" icon="🔄" defaultOpen={true}>
                <ShiftHandoffDashboard />
              </CollapsibleSection>

              {/* Emotional Resilience Hub - Hospital Nurses */}
              <CollapsibleSection title="Emotional Resilience Hub - Prevent Burnout" icon="🧘" defaultOpen={false}>
                <div className="mb-4 p-4 bg-teal-50 border border-teal-200 rounded-lg">
                  <p className="text-teal-800 text-sm">
                    <strong>For Hospital Nurses:</strong> Track shift-related stress, manage emotional exhaustion
                    from high-acuity patients, and access support resources tailored for acute care settings.
                  </p>
                </div>
                <ResilienceHubDashboard />
              </CollapsibleSection>
            </div>
          </section>

          {/* ============================================================ */}
          {/* COMMUNITY CARE MANAGEMENT (CCM) TOOLS */}
          {/* ============================================================ */}
          <section>
            <div className="mb-4 pb-2 border-b-2 border-green-500">
              <h2 className="text-2xl font-bold text-green-800 flex items-center gap-2">
                🏡 Community Care Management (CCM) Tools
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                For telehealth, home health, and chronic care nurses
              </p>
            </div>

            <div className="space-y-6">
              {/* Emotional Resilience Hub - CCM Nurses */}
              <CollapsibleSection title="Emotional Resilience Hub - Prevent Burnout" icon="🧘" defaultOpen={false}>
                <div className="mb-4 p-4 bg-teal-50 border border-teal-200 rounded-lg">
                  <p className="text-teal-800 text-sm">
                    <strong>For CCM Nurses:</strong> Track compassion fatigue, manage call volume stress,
                    and access resources for remote care providers dealing with isolation and boundary challenges.
                  </p>
                </div>
                <ResilienceHubDashboard />
              </CollapsibleSection>

              {/* Project Atlas: CCM Autopilot */}
              <CollapsibleSection title="CCM Autopilot - Chronic Care Management" icon="⏱️">
                <CCMTimeline />
              </CollapsibleSection>

              {/* Project Atlas: Revenue Dashboard */}
              <CollapsibleSection title="Revenue Dashboard - Project Atlas" icon="💰">
                <RevenueDashboard />
              </CollapsibleSection>
            </div>
          </section>

          {/* ============================================================ */}
          {/* SHARED TOOLS (All Nurses) */}
          {/* ============================================================ */}
          <section>
            <div className="mb-4 pb-2 border-b-2 border-purple-500">
              <h2 className="text-2xl font-bold text-purple-800 flex items-center gap-2">
                🛠️ Shared Tools - All Nurses
              </h2>
            </div>

            <div className="space-y-6">

          {/* Patient Questions - Default Open for Quick Access */}
          <CollapsibleSection title="Patient Questions & Responses" icon="💬" defaultOpen={false}>
            <UserQuestions
              isAdmin={true}
              onSubmitQuestion={async (data) => {
                const { error } = await supabase
                  .from('user_questions')
                  .insert({
                    question_text: data.question_text,
                    category: data.category,
                    status: 'pending'
                  });

                if (error) {
                  throw new Error(`Failed to submit question: ${error.message}`);
                }
              }}
              onSubmitResponse={async (questionId, responseText) => {
                const { error } = await supabase
                  .from('user_questions')
                  .update({
                    response_text: responseText,
                    status: 'answered',
                    answered_at: new Date().toISOString()
                  })
                  .eq('id', questionId);

                if (error) {
                  throw new Error(`Failed to submit response: ${error.message}`);
                }
              }}
              onLoadQuestions={async () => {
                const { data, error } = await supabase
                  .from('user_questions')
                  .select('*')
                  .order('created_at', { ascending: false })
                  .limit(50);

                if (error) {
                  // Return empty array on error - component will handle error state
                  return [];
                }

                return data || [];
              }}
            />
          </CollapsibleSection>

          {/* Smart Medical Scribe */}
          <CollapsibleSection title="Smart Medical Scribe" icon="🎤">
            <SmartScribe />
          </CollapsibleSection>

          {/* Risk Assessment */}
          <CollapsibleSection title="Risk Assessment" icon="📋">
            <RiskAssessmentManager />
          </CollapsibleSection>

          {/* Enroll Patient */}
          <CollapsibleSection title="Enroll Patient" icon="➕">
            <NurseEnrollPatientSection />
          </CollapsibleSection>

          {/* Reports */}
          <CollapsibleSection title="Reports & Analytics" icon="📊">
            <ReportsSection />
          </CollapsibleSection>
            </div>
          </section>

        </div>
      </div>
    </RequireAdminAuth>
  );
};

export default NursePanel;