import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
// Optimized imports for tree-shaking (saves ~18KB)
import Activity from 'lucide-react/dist/esm/icons/activity';
import Heart from 'lucide-react/dist/esm/icons/heart';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import Users from 'lucide-react/dist/esm/icons/users';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import Stethoscope from 'lucide-react/dist/esm/icons/stethoscope';
import Pill from 'lucide-react/dist/esm/icons/pill';
import ClipboardList from 'lucide-react/dist/esm/icons/clipboard-list';
import Brain from 'lucide-react/dist/esm/icons/brain';
import Award from 'lucide-react/dist/esm/icons/award';
import Video from 'lucide-react/dist/esm/icons/video';
import AdminHeader from '../admin/AdminHeader';
import UserQuestions from '../UserQuestions';
import SmartScribe from '../smart/RealTimeSmartScribe';
import RiskAssessmentManager from '../admin/RiskAssessmentManager';
import ReportsSection from '../admin/ReportsSection';
import CCMTimeline from '../atlas/CCMTimeline';
import { useSupabaseClient } from '../../contexts/AuthContext';
import { usePatientContext, SelectedPatient } from '../../contexts/PatientContext';
import { FHIRService } from '../../services/fhirResourceService';
import { SDOHBillingService } from '../../services/sdohBillingService';
import { PhysicianWellnessHub } from './PhysicianWellnessHub';
// Lazy-load TelehealthConsultation (313 kB) - only downloaded when physician starts a call
const TelehealthConsultation = lazy(() => import('../telehealth/TelehealthConsultation'));
import TelehealthScheduler from '../telehealth/TelehealthScheduler';
import PhysicianClinicalResources from './PhysicianClinicalResources';
import ClaudeCareAssistantPanel from '../claude-care/ClaudeCareAssistantPanel';
import CHWAlertsWidget from '../chw/CHWAlertsWidget';

// Import extracted components
import { CollapsibleSection } from './components/CollapsibleSection';
import { PatientSelector } from './components/PatientSelector';
import { PatientSummaryCard } from './components/PatientSummaryCard';
import type { PatientListItem, PatientVitals, PatientSummary, QuickStat } from './components/types';

// Import AI Transparency components
import { PersonalizedGreeting, DashboardPersonalizationIndicator, VoiceProfileMaturity } from '../ai-transparency';

// Import Cognitive Load Reduction components
import { CommandPalette, type CommandAction } from './CommandPalette';
import { WorkflowModeSwitcher, type WorkflowMode } from './WorkflowModeSwitcher';

// ============================================================================
// MAIN PHYSICIAN PANEL COMPONENT - SAFE HARBOR
// "First, do no harm"
// Protected clinical decision-making workspace for physicians
// ============================================================================

const PhysicianPanel: React.FC = () => {
  const supabase = useSupabaseClient();
  const navigate = useNavigate();
  const { selectPatient: setGlobalPatient } = usePatientContext();

  const [selectedPatient, setSelectedPatient] = useState<PatientListItem | null>(null);
  const [patientSummary, setPatientSummary] = useState<PatientSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({
    totalPatients: 0,
    ccmEligible: 0,
    pendingReviews: 0
  });
  const [telehealthActive, setTelehealthActive] = useState(false);
  const [telehealthEncounterType, setTelehealthEncounterType] = useState<'outpatient' | 'er' | 'urgent-care'>('outpatient');

  // Cognitive load reduction state
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('all');
  const [recentCommands, setRecentCommands] = useState<string[]>([]);
  const [pinnedCommands, _setPinnedCommands] = useState<string[]>([]);

  const loadDashboardStats = useCallback(async () => {
    try {
      // Get total patient count
      const { count: patientCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .or('role.eq.senior,role.eq.patient');

      setDashboardStats({
        totalPatients: patientCount || 0,
        ccmEligible: 0, // Will be calculated from SDOH assessments
        pendingReviews: 0
      });
    } catch (error) {

    }
  }, [supabase]);

  // Load dashboard statistics
  useEffect(() => {
    loadDashboardStats();
  }, [loadDashboardStats]);

  // Load patient summary when patient is selected
  const handlePatientSelect = useCallback(async (patient: PatientListItem) => {
    setSelectedPatient(patient);
    setLoading(true);

    // ATLUS: Unity - Update global PatientContext for cross-dashboard persistence
    const riskLevel = patient.risk_score && patient.risk_score >= 80 ? 'critical'
      : patient.risk_score && patient.risk_score >= 60 ? 'high'
      : patient.risk_score && patient.risk_score >= 40 ? 'medium'
      : 'low' as const;

    const globalPatient: SelectedPatient = {
      id: patient.user_id,
      firstName: patient.first_name,
      lastName: patient.last_name,
      riskLevel,
      snapshot: {
        unit: 'Physician Panel',
      },
    };
    setGlobalPatient(globalPatient);

    try {
      // Fetch comprehensive patient data in parallel
      const [
        vitalsData,
        conditionsData,
        medicationsData,
        sdohAssessment
      ] = await Promise.all([
        FHIRService.Observation.getVitalSigns(patient.user_id, 7),
        FHIRService.Condition.getActive(patient.user_id),
        FHIRService.MedicationRequest.getActive(patient.user_id),
        SDOHBillingService.assessSDOHComplexity(patient.user_id).catch(() => null)
      ]);

      // Parse latest vitals from RPC response (simplified format)
      const latestVitals: PatientVitals = {};
      if (vitalsData && vitalsData.data && vitalsData.data.length > 0) {
        const vitals = vitalsData.data;

        // Group vitals by code and get most recent of each type
        const vitalsByCode: { [key: string]: any } = {};
        vitals.forEach((obs: any) => {
          if (!vitalsByCode[obs.code] || new Date(obs.effective_datetime) > new Date(vitalsByCode[obs.code].effective_datetime)) {
            vitalsByCode[obs.code] = obs;
          }
        });

        // Map LOINC codes to vital types
        // Heart rate
        if (vitalsByCode['8867-4']) {
          latestVitals.heartRate = vitalsByCode['8867-4'].value;
        }

        // Oxygen saturation (multiple possible codes)
        if (vitalsByCode['2708-6']) {
          latestVitals.oxygenSaturation = vitalsByCode['2708-6'].value;
        } else if (vitalsByCode['59408-5']) {
          latestVitals.oxygenSaturation = vitalsByCode['59408-5'].value;
        }

        // Temperature
        if (vitalsByCode['8310-5']) {
          latestVitals.temperature = vitalsByCode['8310-5'].value;
        }

        // Weight
        if (vitalsByCode['29463-7']) {
          latestVitals.weight = vitalsByCode['29463-7'].value;
        }

        // BMI
        if (vitalsByCode['39156-5']) {
          latestVitals.bmi = vitalsByCode['39156-5'].value;
        }

        // Blood Pressure (might come as components in full FHIR or separate observations)
        // Check for systolic and diastolic separately
        if (vitalsByCode['8480-6'] && vitalsByCode['8462-4']) {
          latestVitals.bloodPressure = `${vitalsByCode['8480-6'].value}/${vitalsByCode['8462-4'].value}`;
        }
      }

      // Fallback to check_ins table if no FHIR data exists
      if (Object.keys(latestVitals).length === 0) {
        const { data: checkInData } = await supabase
          .from('check_ins')
          .select('bp_systolic, bp_diastolic, heart_rate, pulse_oximeter, created_at')
          .eq('user_id', patient.user_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (checkInData) {
          if (checkInData.bp_systolic && checkInData.bp_diastolic) {
            latestVitals.bloodPressure = `${checkInData.bp_systolic}/${checkInData.bp_diastolic}`;
          }
          if (checkInData.heart_rate) {
            latestVitals.heartRate = checkInData.heart_rate;
          }
          if (checkInData.pulse_oximeter) {
            latestVitals.oxygenSaturation = checkInData.pulse_oximeter;
          }
        }
      }

      const conditionsList = conditionsData?.data || [];
      const chronicConditions = conditionsList.filter((c: any) =>
        c.clinical_status === 'active' && c.category?.[0]?.coding?.[0]?.code === 'problem-list-item'
      ).length || 0;

      const summary: PatientSummary = {
        demographics: patient,
        vitals: latestVitals,
        activeConditions: chronicConditions,
        activeMedications: medicationsData?.data?.length || 0,
        upcomingAppointments: 0,
        pendingLabs: 0,
        sdohComplexity: sdohAssessment?.overallComplexityScore || 0,
        ccmEligible: sdohAssessment?.ccmEligible || false
      };

      setPatientSummary(summary);
    } catch (error) {

    } finally {
      setLoading(false);
    }
  }, [supabase, setGlobalPatient]);

  // Command palette actions
  const commandActions: CommandAction[] = [
    {
      id: 'select-patient',
      label: 'Select Patient',
      description: 'Choose a patient from the list',
      icon: Users,
      category: 'quick-access',
      keywords: ['patient', 'select', 'choose', 'pick'],
      action: () => {
        const selector = document.querySelector('[data-patient-selector]');
        if (selector) (selector as HTMLElement).focus();
      },
      gradient: 'from-blue-400 to-cyan-500',
    },
    {
      id: 'start-scribe',
      label: 'Start Smart Scribe',
      description: 'Begin clinical documentation',
      icon: FileText,
      category: 'clinical',
      keywords: ['scribe', 'note', 'documentation', 'record'],
      action: () => {
        document.getElementById('smart-scribe')?.scrollIntoView({ behavior: 'smooth' });
      },
      gradient: 'from-green-400 to-emerald-500',
    },
    {
      id: 'telehealth-outpatient',
      label: 'Start Telehealth (Outpatient)',
      description: 'Launch video consultation',
      icon: Video,
      category: 'clinical',
      keywords: ['telehealth', 'video', 'call', 'consultation', 'virtual'],
      action: () => {
        if (selectedPatient) {
          setTelehealthEncounterType('outpatient');
          setTelehealthActive(true);
        }
      },
      gradient: 'from-purple-400 to-pink-500',
      badge: selectedPatient ? undefined : 'Select patient first',
    },
    {
      id: 'view-medications',
      label: 'View Medications',
      description: 'See patient medication list',
      icon: Pill,
      category: 'clinical',
      keywords: ['medications', 'drugs', 'prescriptions', 'meds'],
      action: () => {
        document.getElementById('medications')?.scrollIntoView({ behavior: 'smooth' });
      },
      gradient: 'from-amber-400 to-orange-500',
    },
    {
      id: 'risk-assessment',
      label: 'Risk Assessment',
      description: 'View patient risk scores',
      icon: AlertTriangle,
      category: 'clinical',
      keywords: ['risk', 'assessment', 'score', 'alert'],
      action: () => {
        document.getElementById('risk-assessment')?.scrollIntoView({ behavior: 'smooth' });
      },
      gradient: 'from-red-400 to-rose-500',
    },
    {
      id: 'wellness-hub',
      label: 'Wellness Hub',
      description: 'Community wellness programs',
      icon: Heart,
      category: 'wellness',
      keywords: ['wellness', 'community', 'sdoh', 'social'],
      action: () => {
        document.getElementById('physician-wellness')?.scrollIntoView({ behavior: 'smooth' });
      },
      gradient: 'from-green-400 to-teal-500',
    },
    {
      id: 'reports',
      label: 'View Reports',
      description: 'Quality metrics and analytics',
      icon: Activity,
      category: 'admin',
      keywords: ['reports', 'analytics', 'metrics', 'quality'],
      action: () => {
        document.getElementById('reports')?.scrollIntoView({ behavior: 'smooth' });
      },
      gradient: 'from-indigo-400 to-blue-500',
    },
  ];

  const quickStats: QuickStat[] = [
    {
      label: 'Total Patients',
      value: dashboardStats.totalPatients,
      icon: <Users className="w-6 h-6" />,
      color: 'bg-blue-600'
    },
    {
      label: 'CCM Eligible',
      value: dashboardStats.ccmEligible,
      icon: <Award className="w-6 h-6" />,
      color: 'bg-green-600'
    },
    {
      label: 'Pending Reviews',
      value: dashboardStats.pendingReviews,
      icon: <AlertTriangle className="w-6 h-6" />,
      color: 'bg-yellow-600'
    }
  ];

  return (
    <div className="min-h-screen bg-[#E8F8F7]">
      <AdminHeader title="🩺 Envision Atlus - Physician Dashboard" />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Personalized Greeting with Motivational Quote */}
          <PersonalizedGreeting />

          {/* Workflow Mode Switcher - Reduces Cognitive Overload */}
          <WorkflowModeSwitcher
            currentMode={workflowMode}
            onModeChange={setWorkflowMode}
          />

          {/* Command Palette - Always Available (Cmd+K) */}
          <CommandPalette
            actions={commandActions}
            recentActions={recentCommands}
            pinnedActions={pinnedCommands}
            onActionExecute={(actionId) => {
              setRecentCommands((prev) => [actionId, ...prev.filter((id) => id !== actionId).slice(0, 4)]);
            }}
          />

          {/* Hero Header - SILVER STATEMENT */}
          <div className="bg-linear-to-r from-[#C0C5CB] to-[#A8ADB3] rounded-2xl shadow-2xl p-8 text-black border-2 border-black">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                  <Stethoscope className="w-10 h-10 text-[#1BA39C]" />
                  Physician Command Center
                </h1>
                <p className="text-black/80 text-lg font-medium">AI-Powered Clinical Intelligence & Revenue Optimization Platform</p>
              </div>
              <div className="flex items-center gap-3">
                <Brain className="w-16 h-16 text-[#1BA39C] opacity-50" />
              </div>
            </div>
          </div>

          {/* Quick Stats Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickStats.map((stat, index) => (
              <div key={index} className="bg-white rounded-lg shadow-xl p-4 hover:shadow-2xl transition-all cursor-pointer border border-black hover:border-2 hover:border-[#1BA39C]">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-[#6B7280] font-bold">{stat.label}</div>
                  <div className={`p-2 rounded-lg ${stat.color} text-white shadow-md border border-black`}>
                    {stat.icon}
                  </div>
                </div>
                <div className="text-2xl font-bold text-black">{stat.value}</div>
                {stat.trend && (
                  <div className={`flex items-center gap-1 mt-1 text-xs ${stat.trend.positive ? 'text-green-600' : 'text-red-600'}`}>
                    <TrendingUp className={`w-3 h-3 ${stat.trend.positive ? '' : 'rotate-180'}`} />
                    {stat.trend.value}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* CHW Field Alerts */}
          <CHWAlertsWidget userRole="physician" userId={localStorage.getItem('userId') || ''} maxAlerts={5} />

          {/* Dashboard Personalization Indicator */}
          <DashboardPersonalizationIndicator variant="compact" showAdaptationDetails={true} />

          {/* Patient Selection & Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <PatientSelector
                onSelectPatient={handlePatientSelect}
                selectedPatient={selectedPatient}
              />
            </div>
            <div className="lg:col-span-2">
              <PatientSummaryCard summary={patientSummary} loading={loading} />
            </div>
          </div>

          {/* AI Smart Scribe - REAL-TIME DOCUMENTATION */}
          <CollapsibleSection
            title="AI Smart Scribe - Real-Time Clinical Documentation"
            icon="🎤"
            defaultOpen={true}
            category="revenue"
            badge="Auto-Billing"
          >
            {/* Riley Voice Profile Maturity */}
            <div className="mb-4">
              <VoiceProfileMaturity variant="compact" showDetails={false} />
            </div>

            <div className="bg-linear-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <Brain className="w-6 h-6 text-amber-600 mt-1" />
                <div>
                  <h3 className="font-bold text-amber-900">Intelligent Revenue Capture</h3>
                  <p className="text-sm text-amber-800 mt-1">
                    SmartScribe automatically captures CPT codes, ICD-10 diagnoses, HCPCS codes, SDOH Z-codes, and CCM billing opportunities in real-time during patient encounters.
                    Revenue opportunities are highlighted instantly with estimated reimbursement amounts.
                  </p>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <span className="text-xs bg-amber-600 text-white px-2 py-1 rounded-sm">CPT Codes</span>
                    <span className="text-xs bg-amber-600 text-white px-2 py-1 rounded-sm">ICD-10 Diagnoses</span>
                    <span className="text-xs bg-amber-600 text-white px-2 py-1 rounded-sm">SDOH Z-Codes</span>
                    <span className="text-xs bg-amber-600 text-white px-2 py-1 rounded-sm">CCM 99490/99487</span>
                    <span className="text-xs bg-amber-600 text-white px-2 py-1 rounded-sm">HCPCS Codes</span>
                  </div>
                </div>
              </div>
            </div>
            {selectedPatient ? (
              <SmartScribe
                selectedPatientId={selectedPatient.user_id}
                selectedPatientName={`${selectedPatient.first_name} ${selectedPatient.last_name}`}
                onSessionComplete={(_sessionId) => {

                }}
              />
            ) : (
              <div className="text-center py-12 bg-yellow-50 rounded-xl border-2 border-yellow-200">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Patient Selection Required</h3>
                <p className="text-gray-600 mb-4">
                  Please select a patient from the list above before starting a scribe session.
                </p>
                <p className="text-sm text-gray-500">
                  The scribe needs to know which patient chart to document.
                </p>
              </div>
            )}
          </CollapsibleSection>

          {/* Telehealth Appointment Scheduler */}
          <CollapsibleSection
            title="Telehealth Video Appointments"
            icon="📹"
            defaultOpen={false}
            category="clinical"
            badge="Schedule"
          >
            <div className="bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <Video className="w-6 h-6 text-blue-600 mt-1" />
                <div>
                  <h3 className="font-bold text-blue-900">Virtual Care Platform</h3>
                  <p className="text-sm text-blue-800 mt-1">
                    Schedule video appointments with patients. They'll receive SMS notifications and can join directly from their app - no links needed.
                    Perfect for follow-ups, chronic care management, and urgent consultations.
                  </p>
                </div>
              </div>
            </div>
            <TelehealthScheduler />
          </CollapsibleSection>

          {/* Claude Care Assistant - AI-Powered Administrative Automation */}
          <CollapsibleSection
            title="Claude Care Assistant - AI Admin Automation"
            icon="🤖"
            defaultOpen={false}
            category="administrative"
            badge="AI-Powered"
          >
            <div className="bg-linear-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <Brain className="w-6 h-6 text-purple-600 mt-1" />
                <div>
                  <h3 className="font-bold text-purple-900">Reduce Administrative Burden with AI</h3>
                  <p className="text-sm text-purple-800 mt-1">
                    Automate prior authorizations, insurance appeals, peer review prep, and referral letters with AI.
                    Translate patient communications in 50+ languages with cultural context. Save hours every day.
                  </p>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-sm">Prior Auth</span>
                    <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-sm">Insurance Appeals</span>
                    <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-sm">Translation (50+ Languages)</span>
                    <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-sm">Voice Input</span>
                    <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-sm">Team Collaboration</span>
                  </div>
                </div>
              </div>
            </div>
            <ClaudeCareAssistantPanel
              userRole="physician"
              patientId={selectedPatient?.user_id}
              userId={selectedPatient?.user_id}
            />
          </CollapsibleSection>

          {/* Medical Practice Tools Grid */}
          <div className="bg-white rounded-xl p-6 border border-black shadow-xl">
            <h2 className="text-2xl font-bold text-black mb-4 flex items-center gap-3">
              <Stethoscope className="w-7 h-7 text-[#1BA39C]" />
              Clinical Tools & Medical Records
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Patient Records */}
              <button
                onClick={() => {
                  if (!selectedPatient) {
                    alert('Please select a patient first');
                    return;
                  }
                  navigate(`/my-health?patientId=${selectedPatient.user_id}`);
                }}
                disabled={!selectedPatient}
                className={`p-5 rounded-lg shadow transition-all border group text-left ${
                  selectedPatient
                    ? 'bg-white border-blue-200 hover:border-blue-400 hover:shadow-xl cursor-pointer'
                    : 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">📋</div>
                  <Activity className={`w-6 h-6 transition-transform ${selectedPatient ? 'text-blue-600 group-hover:scale-110' : 'text-gray-400'}`} />
                </div>
                <h3 className={`font-bold text-lg ${selectedPatient ? 'text-gray-900' : 'text-gray-500'}`}>Patient Records</h3>
                <p className={`text-sm mt-1 ${selectedPatient ? 'text-gray-600' : 'text-gray-400'}`}>
                  {selectedPatient ? 'FHIR-compliant health records with complete medical history' : 'Select a patient first'}
                </p>
              </button>

              {/* Medications */}
              <button
                onClick={() => {
                  if (!selectedPatient) {
                    alert('Please select a patient first');
                    return;
                  }
                  navigate(`/medication-management?patientId=${selectedPatient.user_id}`);
                }}
                disabled={!selectedPatient}
                className={`p-5 rounded-lg shadow transition-all border group text-left ${
                  selectedPatient
                    ? 'bg-white border-green-200 hover:border-green-400 hover:shadow-xl cursor-pointer'
                    : 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">💊</div>
                  <Pill className={`w-6 h-6 transition-transform ${selectedPatient ? 'text-green-600 group-hover:scale-110' : 'text-gray-400'}`} />
                </div>
                <h3 className={`font-bold text-lg ${selectedPatient ? 'text-gray-900' : 'text-gray-500'}`}>Medications</h3>
                <p className={`text-sm mt-1 ${selectedPatient ? 'text-gray-600' : 'text-gray-400'}`}>
                  {selectedPatient ? 'E-prescribing, medication reconciliation & adherence tracking' : 'Select a patient first'}
                </p>
              </button>

              {/* Care Plans */}
              <button
                onClick={() => {
                  if (!selectedPatient) {
                    alert('Please select a patient first');
                    return;
                  }
                  navigate(`/care-plans?patientId=${selectedPatient.user_id}`);
                }}
                disabled={!selectedPatient}
                className={`p-5 rounded-lg shadow transition-all border group text-left ${
                  selectedPatient
                    ? 'bg-white border-purple-200 hover:border-purple-400 hover:shadow-xl cursor-pointer'
                    : 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">🗂️</div>
                  <ClipboardList className={`w-6 h-6 transition-transform ${selectedPatient ? 'text-purple-600 group-hover:scale-110' : 'text-gray-400'}`} />
                </div>
                <h3 className={`font-bold text-lg ${selectedPatient ? 'text-gray-900' : 'text-gray-500'}`}>Care Plans</h3>
                <p className={`text-sm mt-1 ${selectedPatient ? 'text-gray-600' : 'text-gray-400'}`}>
                  {selectedPatient ? 'Evidence-based treatment protocols & care coordination' : 'Select a patient first'}
                </p>
              </button>

              {/* Lab Results */}
              <button
                onClick={() => {
                  if (!selectedPatient) {
                    alert('Please select a patient first');
                    return;
                  }
                  navigate(`/health-observations?patientId=${selectedPatient.user_id}`);
                }}
                disabled={!selectedPatient}
                className={`p-5 rounded-lg shadow transition-all border group text-left ${
                  selectedPatient
                    ? 'bg-white border-indigo-200 hover:border-indigo-400 hover:shadow-xl cursor-pointer'
                    : 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">🔬</div>
                  <FileText className={`w-6 h-6 transition-transform ${selectedPatient ? 'text-indigo-600 group-hover:scale-110' : 'text-gray-400'}`} />
                </div>
                <h3 className={`font-bold text-lg ${selectedPatient ? 'text-gray-900' : 'text-gray-500'}`}>Lab Results</h3>
                <p className={`text-sm mt-1 ${selectedPatient ? 'text-gray-600' : 'text-gray-400'}`}>
                  {selectedPatient ? 'LOINC-coded observations, diagnostics & trending' : 'Select a patient first'}
                </p>
              </button>

              {/* Immunizations */}
              <button
                onClick={() => {
                  if (!selectedPatient) {
                    alert('Please select a patient first');
                    return;
                  }
                  navigate(`/immunizations?patientId=${selectedPatient.user_id}`);
                }}
                disabled={!selectedPatient}
                className={`p-5 rounded-lg shadow transition-all border group text-left ${
                  selectedPatient
                    ? 'bg-white border-pink-200 hover:border-pink-400 hover:shadow-xl cursor-pointer'
                    : 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">💉</div>
                  <CheckCircle className={`w-6 h-6 transition-transform ${selectedPatient ? 'text-pink-600 group-hover:scale-110' : 'text-gray-400'}`} />
                </div>
                <h3 className={`font-bold text-lg ${selectedPatient ? 'text-gray-900' : 'text-gray-500'}`}>Immunizations</h3>
                <p className={`text-sm mt-1 ${selectedPatient ? 'text-gray-600' : 'text-gray-400'}`}>
                  {selectedPatient ? 'CVX-coded vaccination records & schedule gaps' : 'Select a patient first'}
                </p>
              </button>

              {/* Billing & Claims */}
              <button
                onClick={() => {
                  if (!selectedPatient) {
                    alert('Please select a patient first');
                    return;
                  }
                  navigate(`/billing?patientId=${selectedPatient.user_id}`);
                }}
                disabled={!selectedPatient}
                className={`p-5 rounded-lg shadow transition-all border group text-left ${
                  selectedPatient
                    ? 'bg-white border-amber-200 hover:border-amber-400 hover:shadow-xl cursor-pointer'
                    : 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">📋</div>
                  <FileText className={`w-6 h-6 transition-transform ${selectedPatient ? 'text-blue-600 group-hover:scale-110' : 'text-gray-400'}`} />
                </div>
                <h3 className={`font-bold text-lg ${selectedPatient ? 'text-gray-900' : 'text-gray-500'}`}>Billing & Claims</h3>
                <p className={`text-sm mt-1 ${selectedPatient ? 'text-gray-600' : 'text-gray-400'}`}>
                  {selectedPatient ? 'X12 EDI claims processing and tracking' : 'Select a patient first'}
                </p>
              </button>

              {/* Telehealth - Outpatient */}
              <button
                onClick={() => {
                  if (!selectedPatient) {
                    alert('Please select a patient first');
                    return;
                  }
                  setTelehealthEncounterType('outpatient');
                  setTelehealthActive(true);
                }}
                disabled={!selectedPatient}
                className={`p-5 rounded-lg shadow transition-all border group text-left ${
                  selectedPatient
                    ? 'bg-white border-teal-200 hover:border-teal-400 hover:shadow-xl cursor-pointer'
                    : 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">📹</div>
                  <Video className={`w-6 h-6 transition-transform ${selectedPatient ? 'text-teal-600 group-hover:scale-110' : 'text-gray-400'}`} />
                </div>
                <h3 className={`font-bold text-lg ${selectedPatient ? 'text-gray-900' : 'text-gray-500'}`}>Telehealth Visit</h3>
                <p className={`text-sm mt-1 ${selectedPatient ? 'text-gray-600' : 'text-gray-400'}`}>
                  {selectedPatient ? 'HIPAA-compliant video consultations with SmartScribe' : 'Select a patient first'}
                </p>
              </button>

              {/* Telehealth - ER */}
              <button
                onClick={() => {
                  if (!selectedPatient) {
                    alert('Please select a patient first');
                    return;
                  }
                  setTelehealthEncounterType('er');
                  setTelehealthActive(true);
                }}
                disabled={!selectedPatient}
                className={`p-5 rounded-lg shadow transition-all border group text-left ${
                  selectedPatient
                    ? 'bg-white border-red-300 hover:border-red-500 hover:shadow-xl cursor-pointer'
                    : 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">🚨</div>
                  <AlertTriangle className={`w-6 h-6 transition-transform ${selectedPatient ? 'text-red-600 group-hover:scale-110 animate-pulse' : 'text-gray-400'}`} />
                </div>
                <h3 className={`font-bold text-lg ${selectedPatient ? 'text-gray-900' : 'text-gray-500'}`}>ER Telehealth</h3>
                <p className={`text-sm mt-1 ${selectedPatient ? 'text-gray-600' : 'text-gray-400'}`}>
                  {selectedPatient ? 'Emergency remote consultation with stethoscope support' : 'Select a patient first'}
                </p>
              </button>

              {/* Telehealth - Urgent Care */}
              <button
                onClick={() => {
                  if (!selectedPatient) {
                    alert('Please select a patient first');
                    return;
                  }
                  setTelehealthEncounterType('urgent-care');
                  setTelehealthActive(true);
                }}
                disabled={!selectedPatient}
                className={`p-5 rounded-lg shadow transition-all border group text-left ${
                  selectedPatient
                    ? 'bg-white border-orange-200 hover:border-orange-400 hover:shadow-xl cursor-pointer'
                    : 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">⚡</div>
                  <Activity className={`w-6 h-6 transition-transform ${selectedPatient ? 'text-orange-600 group-hover:scale-110' : 'text-gray-400'}`} />
                </div>
                <h3 className={`font-bold text-lg ${selectedPatient ? 'text-gray-900' : 'text-gray-500'}`}>Urgent Care Visit</h3>
                <p className={`text-sm mt-1 ${selectedPatient ? 'text-gray-600' : 'text-gray-400'}`}>
                  {selectedPatient ? 'Same-day telehealth for urgent but non-emergency care' : 'Select a patient first'}
                </p>
              </button>
            </div>
          </div>

          {/* Physician Wellness & Burnout Prevention */}
          <CollapsibleSection
            title="Physician Wellness & Burnout Prevention"
            icon="🧘"
            defaultOpen={false}
            category="medical"
            badge="Wellness"
          >
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <Heart className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-900">Provider Wellness Hub</h4>
                  <p className="text-sm text-blue-800 mt-1">
                    Monitor your burnout risk, track stress levels, access resilience training modules, and connect with peer support circles.
                    Your wellbeing directly impacts patient care quality.
                  </p>
                </div>
              </div>
            </div>
            <PhysicianWellnessHub />
          </CollapsibleSection>

          {/* Patient Communication */}
          <CollapsibleSection
            title="Patient Messages & Questions"
            icon="💬"
            defaultOpen={false}
            category="clinical"
          >
            <UserQuestions />
          </CollapsibleSection>

          {/* Risk Assessment & Clinical Alerts */}
          <CollapsibleSection
            title="Risk Assessment & Clinical Decision Support"
            icon="⚠️"
            defaultOpen={false}
            category="medical"
          >
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-900">Clinical Alerts & Risk Stratification</h4>
                  <p className="text-sm text-red-800 mt-1">
                    AI-powered risk assessment identifies high-risk patients, potential readmissions, and clinical deterioration patterns.
                  </p>
                </div>
              </div>
            </div>
            <RiskAssessmentManager />
          </CollapsibleSection>

          {/* Chronic Care Management */}
          <CollapsibleSection
            title="Chronic Care Management (CCM) Timeline"
            icon="🏥"
            defaultOpen={false}
            category="clinical"
          >
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <Heart className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-green-900">CCM Care Coordination</h4>
                  <p className="text-sm text-green-800 mt-1">
                    Track time spent on non-face-to-face care coordination for patients with chronic conditions. Ensures comprehensive care management.
                  </p>
                </div>
              </div>
            </div>
            <CCMTimeline />
          </CollapsibleSection>

          {/* Reports & Analytics */}
          <CollapsibleSection
            title="Medical Reports & Quality Metrics"
            icon="📊"
            defaultOpen={false}
            category="administrative"
          >
            <ReportsSection />
          </CollapsibleSection>

          {/* Clinical Resources Library */}
          <CollapsibleSection
            title="Clinical Resources & Quick Reference"
            icon="📚"
            defaultOpen={false}
            category="clinical"
          >
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-900">Evidence-Based Clinical Resources</h4>
                  <p className="text-sm text-blue-800 mt-1">
                    Quick access to emergency protocols, clinical guidelines, drug references, and specialist directories.
                    Curated evidence-based resources from trusted medical organizations.
                  </p>
                </div>
              </div>
            </div>
            <PhysicianClinicalResources />
          </CollapsibleSection>

          {/* System Info Footer */}
          <div className="text-center text-gray-500 text-sm py-6 border-t border-gray-200">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <p className="font-semibold text-gray-700">⚓ Safe Harbor - Physician Panel</p>
            </div>
            <p>First, do no harm • HIPAA-Compliant • FHIR R4 • AI-Powered Clinical Intelligence</p>
          </div>

        </div>
      </div>

      {/* Telehealth Modal (lazy-loaded) */}
      {telehealthActive && selectedPatient && (
        <div className="fixed inset-0 z-50">
          <Suspense
            fallback={
              <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
                  <div className="text-lg text-white">Loading video call...</div>
                </div>
              </div>
            }
          >
            <TelehealthConsultation
              patientId={selectedPatient.user_id}
              patientName={`${selectedPatient.first_name} ${selectedPatient.last_name}`}
              encounterType={telehealthEncounterType}
              onEndCall={() => {
                setTelehealthActive(false);
                // Refresh patient summary after call ends
                if (selectedPatient) {
                  handlePatientSelect(selectedPatient);
                }
              }}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
};

export default PhysicianPanel;
