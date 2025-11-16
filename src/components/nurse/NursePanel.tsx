import React, { useState } from 'react';
import RequireAdminAuth from '../auth/RequireAdminAuth';
import AdminHeader from '../admin/AdminHeader';
import UserQuestions from '../UserQuestions';
import SmartScribe from '../smart/RealTimeSmartScribe';
import RiskAssessmentManager from '../admin/RiskAssessmentManager';
import ReportsSection from '../admin/ReportsSection';
import CCMTimeline from '../atlas/CCMTimeline';
import ResilienceHubDashboard from '../nurseos/ResilienceHubDashboard';
import ShiftHandoffDashboard from './ShiftHandoffDashboard';
import TelehealthScheduler from '../telehealth/TelehealthScheduler';
import ERIncomingPatientBoard from '../ems/ERIncomingPatientBoard';
import { supabase } from '../../lib/supabaseClient';
import { auditLogger } from '../../services/auditLogger';
import ClaudeCareAssistantPanel from '../claude-care/ClaudeCareAssistantPanel';
import CHWAlertsWidget from '../chw/CHWAlertsWidget';
import PasswordGenerator from '../shared/PasswordGenerator';
import { PersonalizedGreeting } from '../ai-transparency';
import { useAdminAuth } from '../../contexts/AdminAuthContext';

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
 */
const NursePanel: React.FC = () => {
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

  return (
    <RequireAdminAuth allowedRoles={['admin', 'super_admin', 'nurse']}>
      <div className="min-h-screen bg-[#E8F8F7]">
        {/* Header without API Key Manager */}
        <AdminHeader title="🏮 Envision Atlus - Nurse Dashboard" showRiskAssessment={true} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">

          {/* Personalized Greeting with Stats */}
          <PersonalizedGreeting />

          {/* CHW Field Alerts */}
          <CHWAlertsWidget userRole="nurse" userId={localStorage.getItem('userId') || ''} maxAlerts={5} />

          {/* Patient Selection for Documentation */}
          <div className="bg-white rounded-xl shadow-xl border border-black p-6">
            <h3 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
              <span className="text-[#1BA39C]">👤</span>
              Select Patient for Documentation
            </h3>

            {loadingPatients ? (
              <div className="text-center py-4 text-gray-600">Loading your assigned patients...</div>
            ) : myPatients.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                No patients currently assigned. Patients will appear here when assigned via care team.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {myPatients.map((patient: any) => (
                  <button
                    key={patient.user_id}
                    onClick={() => setSelectedPatient(patient)}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      selectedPatient?.user_id === patient.user_id
                        ? 'border-[#1BA39C] bg-[#E8F8F7] shadow-lg'
                        : 'border-black hover:border-[#1BA39C] hover:bg-[#E8F8F7]'
                    }`}
                  >
                    <div className="font-bold text-gray-900">
                      {patient.first_name} {patient.last_name}
                    </div>
                    {patient.room_number && (
                      <div className="text-sm text-gray-600 mt-1">Room: {patient.room_number}</div>
                    )}
                    {patient.date_of_birth && (
                      <div className="text-xs text-gray-500 mt-1">
                        DOB: {new Date(patient.date_of_birth).toLocaleDateString()}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {selectedPatient && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-blue-700 font-medium">Currently Selected:</div>
                    <div className="text-lg font-bold text-blue-900">
                      {selectedPatient.first_name} {selectedPatient.last_name}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPatient(null)}
                    className="px-3 py-1 bg-white border border-blue-300 rounded-lg text-blue-700 hover:bg-blue-100 text-sm"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}
          </div>

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
              {/* EMS Incoming Patients - Ambulance Handoffs */}
              <CollapsibleSection title="EMS Incoming Patients - Ambulance Handoffs" icon="🚑" defaultOpen={true}>
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">
                    <strong>ER/Ambulance Communication:</strong> View incoming patients from ambulances in real-time.
                    Paramedics send alerts with chief complaint, vitals, ETA, and critical alerts (STEMI, Stroke, Trauma).
                    Prepare your team and complete handoff when patient arrives.
                  </p>
                </div>
                <ERIncomingPatientBoard hospitalName="Your Hospital Name" />
              </CollapsibleSection>

              {/* Smart Shift Handoff - AI-Assisted Patient Prioritization */}
              <CollapsibleSection title="Smart Shift Handoff - Patient Prioritization" icon="🔄" defaultOpen={false}>
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

              {/* Claude Care Assistant - AI Administrative Automation for Nurses */}
              <CollapsibleSection title="Claude Care Assistant - AI Admin Automation" icon="🤖" defaultOpen={false}>
                <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-purple-800 text-sm">
                    <strong>Reduce Administrative Burden:</strong> Automate incident reports, supply justifications,
                    handoff notes, and patient education materials with AI. Translate in 50+ languages.
                    Use voice input for hands-free documentation. Save time for patient care.
                  </p>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">Incident Reports</span>
                    <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">Supply Justification</span>
                    <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">Handoff Notes</span>
                    <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">Translation (50+ Languages)</span>
                    <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">Voice Input</span>
                  </div>
                </div>
                <ClaudeCareAssistantPanel
                  userRole="nurse"
                  patientId={selectedPatient?.user_id}
                  userId={selectedPatient?.user_id}
                />
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
              {/* Telehealth Appointment Scheduler */}
              <CollapsibleSection title="Telehealth Video Appointments" icon="📹" defaultOpen={false}>
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-blue-800 text-sm">
                    <strong>Virtual Care Platform:</strong> Schedule video appointments with patients for remote consultations,
                    chronic care check-ins, and follow-up visits. Patients receive SMS notifications and can join directly from their app.
                  </p>
                </div>
                <TelehealthScheduler />
              </CollapsibleSection>

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

              {/* Project Atlus: CCM Autopilot */}
              <CollapsibleSection title="CCM Autopilot - Chronic Care Management" icon="⏱️">
                <CCMTimeline />
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
          <CollapsibleSection title="Smart Medical Scribe - Nursing Documentation" icon="🎤">
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 text-sm">
                <strong>Nursing Documentation AI:</strong> Record nursing assessments, patient observations,
                care interventions, and shift notes. AI captures clinical details for accurate documentation
                and helps identify billable nursing activities (wound care, patient education, medication administration, etc.).
              </p>
            </div>
            {selectedPatient ? (
              <SmartScribe
                selectedPatientId={selectedPatient.user_id}
                selectedPatientName={`${selectedPatient.first_name} ${selectedPatient.last_name}`}
                onSessionComplete={(sessionId) => {

                  auditLogger.clinical('NURSE_SCRIBE_SESSION_COMPLETED', true, {
                    sessionId,
                    patientId: selectedPatient.user_id,
                    nurseId: selectedPatient.user_id
                  });
                }}
              />
            ) : (
              <div className="text-center py-12 bg-yellow-50 rounded-xl border-2 border-yellow-200">
                <div className="text-6xl mb-4">👆</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Patient Selection Required</h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  Please select a patient from the list above before starting a nursing documentation session.
                  This ensures your notes are properly linked to the correct patient chart.
                </p>
              </div>
            )}
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