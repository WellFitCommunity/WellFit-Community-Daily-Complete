import React, { useState } from 'react';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import RequireAdminAuth from '../auth/RequireAdminAuth';
import AdminHeader from '../admin/AdminHeader';
import UserQuestions from '../UserQuestions';
import SmartScribe from '../smart/SmartScribe';
import RiskAssessmentManager from '../admin/RiskAssessmentManager';
import ReportsSection from '../admin/ReportsSection';
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

      const { data, error } = await supabase.functions.invoke('enrollClient', {
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

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

          {/* Patient Questions - Default Open for Quick Access */}
          <CollapsibleSection title="Patient Questions & Responses" icon="💬" defaultOpen={true}>
            <UserQuestions
              isAdmin={true}
              onSubmitQuestion={async (data) => {
                console.log('Question submitted:', data);
              }}
              onSubmitResponse={async (questionId, responseText) => {
                console.log('Response submitted:', questionId, responseText);
              }}
              onLoadQuestions={async () => {
                // Load questions from your database
                return [];
              }}
            />
          </CollapsibleSection>

          {/* Smart Medical Scribe */}
          <CollapsibleSection title="Smart Medical Scribe" icon="🎤">
            <SmartScribe
              sessionType="consultation"
              className="w-full"
            />
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
      </div>
    </RequireAdminAuth>
  );
};

export default NursePanel;