import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RequireAdminAuth from '../auth/RequireAdminAuth';
import AdminHeader from '../admin/AdminHeader';
import SmartScribe from '../smart/RealTimeSmartScribe';
import RiskAssessmentManager from '../admin/RiskAssessmentManager';
import ReportsSection from '../admin/ReportsSection';
import CCMTimeline from '../atlas/CCMTimeline';
import ResilienceHubDashboard from '../nurseos/ResilienceHubDashboard';
import ShiftHandoffDashboard from './ShiftHandoffDashboard';
import TelehealthScheduler from '../telehealth/TelehealthScheduler';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../../services/auditLogger';
import ClaudeCareAssistantPanel from '../claude-care/ClaudeCareAssistantPanel';
import PasswordGenerator from '../shared/PasswordGenerator';
import { PersonalizedGreeting } from '../ai-transparency';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import NurseQuestionManager from '../admin/NurseQuestionManager';

// Tab type for navigation
type NurseTab = 'clinical' | 'telehealth' | 'documentation' | 'wellness';

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

// Enrollment Section for Nurses
const NurseEnrollPatientSection: React.FC = () => {
  const { invokeAdminFunction } = useAdminAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); // ← NEW: Store generated password
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleEnroll = async () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }

    // Validate password was generated
    if (!password) {
      setMessage({ type: 'error', text: 'Please generate a password for the patient' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Use invokeAdminFunction to properly authenticate with X-Admin-Token header
      const { data, error } = await invokeAdminFunction('enrollClient', {
        phone,
        password: password, // ← Use the password from the generator
        first_name: firstName,
        last_name: lastName,
        email: email || undefined
      });

      // Check if user_id returned (success) even if error present
      if (data?.user_id) {
        // enrollClient returns {success: true, user_id: string}
        const enrolledUserId = data.user_id;

        // HIPAA Audit: Log successful enrollment
        await auditLogger.auth('REGISTRATION', true, {
          enrolledUserId,
          enrolledBy: 'nurse',
          patientName: `${firstName} ${lastName}`,
          phone
        });

        setMessage({
          type: 'success',
          text: `✅ ${firstName} ${lastName} enrolled successfully! Patient can now log in with the generated password.`
        });

        // Reset form
        setFirstName('');
        setLastName('');
        setPhone('');
        setEmail('');
        setPassword(''); // ← Clear password
      } else {
        // ACTUAL FAILURE
        throw new Error(error?.message || 'No user ID returned - enrollment failed');
      }
    } catch (error: any) {
      // HIPAA Audit: Log enrollment failure (CRITICAL - uses proper audit logging)
      await auditLogger.error('NURSE_ENROLLMENT_FAILED', error, {
        attemptedPhone: phone,
        patientName: `${firstName} ${lastName}`
      });

      setMessage({
        type: 'error',
        text: `❌ Enrollment failed: ${error.message || 'Unknown error. Please try again.'}`
      });
    } finally {
      setLoading(false);
    }
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

      {/* PASSWORD GENERATOR - THE KEY COMPONENT YOU NEEDED! */}
      <div className="mb-4">
        <PasswordGenerator
          onPasswordGenerated={(generatedPassword) => setPassword(generatedPassword)}
          showPassword={true}
          autoGenerate={false}
        />
      </div>

      <button
        onClick={handleEnroll}
        disabled={loading}
        className="bg-[#C8E63D] text-[#2D3339] px-6 py-3 rounded-lg hover:bg-[#D9F05C] disabled:opacity-50 transition-all font-bold shadow-md hover:shadow-lg"
      >
        {loading ? 'Enrolling...' : '➕ Enroll Patient'}
      </button>
    </div>
  );
};

/**
 * Lighthouse - Nurse Panel
 * "Vigilant care around the clock"
 * 24/7 patient monitoring and care coordination hub
 *
 * Consolidated interface with tabbed navigation to reduce clicks.
 * Quick actions at top for frequent tasks.
 */
const NursePanel: React.FC = () => {
  const navigate = useNavigate();

  // Active tab for main content
  const [activeTab, setActiveTab] = useState<NurseTab>('clinical');

  // Patient selection for documentation (similar to PhysicianPanel)
  const [selectedPatient, setSelectedPatient] = useState<{
    user_id: string;
    first_name: string;
    last_name: string;
  } | null>(null);
  const [myPatients, setMyPatients] = useState<any[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);

  // Load nurse's assigned patients (from care_team table)
  React.useEffect(() => {
    const loadMyPatients = async () => {
      setLoadingPatients(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get patients assigned to this nurse via care_team
        const { data: assignments } = await supabase
          .from('care_team')
          .select(`
            patient_id,
            profiles!care_team_patient_id_fkey (
              user_id,
              first_name,
              last_name,
              date_of_birth,
              room_number
            )
          `)
          .eq('nurse_id', user.id);

        if (assignments) {
          const patients = assignments
            .map(a => a.profiles)
            .filter(p => p !== null);
          setMyPatients(patients as any[]);
        }
      } catch (error) {
        auditLogger.error('NURSE_LOAD_PATIENTS_FAILED', error instanceof Error ? error : new Error('Failed to load patients'));
      } finally {
        setLoadingPatients(false);
      }
    };

    loadMyPatients();
  }, []);

  // Tab definitions
  const tabs: { id: NurseTab; label: string; icon: string }[] = [
    { id: 'clinical', label: 'Clinical Tools', icon: '🏥' },
    { id: 'telehealth', label: 'Telehealth', icon: '📹' },
    { id: 'documentation', label: 'Documentation', icon: '📝' },
    { id: 'wellness', label: 'Wellness', icon: '🧘' },
  ];

  return (
    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'nurse']}>
      <div className="min-h-screen bg-slate-900">
        {/* Header */}
        <AdminHeader title="Nurse Dashboard" showRiskAssessment={true} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

          {/* Personalized Greeting */}
          <PersonalizedGreeting />

          {/* Quick Actions Bar */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <span>⚡</span> Quick Actions
              </h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <button
                onClick={() => navigate('/er-dashboard')}
                className="p-3 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all text-center"
              >
                <div className="text-xl mb-1">🚑</div>
                <div className="text-xs font-medium">ER Dashboard</div>
              </button>
              <button
                onClick={() => navigate('/bed-management')}
                className="p-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-all text-center"
              >
                <div className="text-xl mb-1">🛏️</div>
                <div className="text-xs font-medium">Bed Board</div>
              </button>
              <button
                onClick={() => setActiveTab('telehealth')}
                className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all text-center"
              >
                <div className="text-xl mb-1">📹</div>
                <div className="text-xs font-medium">Telehealth</div>
              </button>
              <button
                onClick={() => setActiveTab('documentation')}
                className="p-3 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-all text-center"
              >
                <div className="text-xl mb-1">📝</div>
                <div className="text-xs font-medium">Documentation</div>
              </button>
              <button
                onClick={() => navigate('/chw/dashboard')}
                className="p-3 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-all text-center"
              >
                <div className="text-xl mb-1">🏘️</div>
                <div className="text-xs font-medium">CHW Dashboard</div>
              </button>
              <button
                onClick={() => setActiveTab('wellness')}
                className="p-3 bg-pink-600 hover:bg-pink-500 text-white rounded-lg transition-all text-center"
              >
                <div className="text-xl mb-1">🧘</div>
                <div className="text-xs font-medium">Wellness</div>
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 bg-slate-800 p-2 rounded-xl border border-slate-700">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Patient Selection (shown when relevant) */}
          {(activeTab === 'documentation' || activeTab === 'clinical') && (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <span>👤</span> Select Patient
              </h3>
              {loadingPatients ? (
                <div className="text-center py-4 text-slate-400">Loading patients...</div>
              ) : myPatients.length === 0 ? (
                <div className="text-center py-4 text-slate-500">
                  No patients assigned. Use care team to assign patients.
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {myPatients.map((patient: any) => (
                    <button
                      key={patient.user_id}
                      onClick={() => setSelectedPatient(patient)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        selectedPatient?.user_id === patient.user_id
                          ? 'border-teal-500 bg-teal-500/20'
                          : 'border-slate-600 bg-slate-700 hover:border-teal-400'
                      }`}
                    >
                      <div className="font-medium text-white text-sm">
                        {patient.first_name} {patient.last_name}
                      </div>
                      {patient.room_number && (
                        <div className="text-xs text-slate-400">Room {patient.room_number}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {selectedPatient && (
                <div className="mt-3 p-3 bg-teal-500/20 border border-teal-500 rounded-lg flex items-center justify-between">
                  <span className="text-teal-300">
                    Selected: <strong className="text-white">{selectedPatient.first_name} {selectedPatient.last_name}</strong>
                  </span>
                  <button
                    onClick={() => setSelectedPatient(null)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab Content */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            {/* Clinical Tools Tab */}
            {activeTab === 'clinical' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span>🔄</span> Shift Handoff & Patient Prioritization
                  </h2>
                  <ShiftHandoffDashboard />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span>🤖</span> Claude Care Assistant
                  </h2>
                  <p className="text-slate-400 text-sm mb-4">
                    AI-powered automation for incident reports, supply justifications, handoff notes, and patient education.
                  </p>
                  <ClaudeCareAssistantPanel
                    userRole="nurse"
                    patientId={selectedPatient?.user_id}
                    userId={selectedPatient?.user_id}
                  />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span>⏱️</span> CCM Autopilot - Chronic Care Management
                  </h2>
                  <CCMTimeline />
                </div>
              </div>
            )}

            {/* Telehealth Tab */}
            {activeTab === 'telehealth' && (
              <div>
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span>📹</span> Telehealth Video Appointments
                </h2>
                <p className="text-slate-400 text-sm mb-4">
                  Schedule video appointments, chronic care check-ins, and follow-up visits. Patients get SMS notifications.
                </p>
                <TelehealthScheduler />
              </div>
            )}

            {/* Documentation Tab */}
            {activeTab === 'documentation' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span>🎤</span> Smart Medical Scribe
                  </h2>
                  {selectedPatient ? (
                    <SmartScribe
                      selectedPatientId={selectedPatient.user_id}
                      selectedPatientName={`${selectedPatient.first_name} ${selectedPatient.last_name}`}
                      onSessionComplete={(sessionId) => {
                        auditLogger.clinical('NURSE_SCRIBE_SESSION_COMPLETED', true, {
                          sessionId,
                          patientId: selectedPatient.user_id,
                        });
                      }}
                    />
                  ) : (
                    <div className="text-center py-8 bg-slate-700 rounded-xl">
                      <div className="text-4xl mb-3">👆</div>
                      <p className="text-slate-300">Select a patient above to start documentation</p>
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span>🤖</span> AI Patient Questions Manager
                  </h2>
                  <NurseQuestionManager />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span>📋</span> Risk Assessment
                  </h2>
                  <RiskAssessmentManager />
                </div>

                <CollapsibleSection title="Enroll Patient" icon="➕" defaultOpen={false}>
                  <NurseEnrollPatientSection />
                </CollapsibleSection>

                <CollapsibleSection title="Reports & Analytics" icon="📊" defaultOpen={false}>
                  <ReportsSection />
                </CollapsibleSection>
              </div>
            )}

            {/* Wellness Tab */}
            {activeTab === 'wellness' && (
              <div>
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span>🧘</span> Emotional Resilience Hub
                </h2>
                <p className="text-slate-400 text-sm mb-4">
                  Track stress, manage burnout, and access support resources for nurses.
                </p>
                <ResilienceHubDashboard />
              </div>
            )}
          </div>
        </div>
      </div>
    </RequireAdminAuth>
  );
};

export default NursePanel;