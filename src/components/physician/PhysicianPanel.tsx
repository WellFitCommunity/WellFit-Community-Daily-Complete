import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Heart, TrendingUp, DollarSign, AlertTriangle, CheckCircle, Users, FileText, Stethoscope, Pill, ClipboardList, LineChart, Brain, Award } from 'lucide-react';
import AdminHeader from '../admin/AdminHeader';
import UserQuestions from '../UserQuestions';
import SmartScribe from '../smart/RealTimeSmartScribe';
import RiskAssessmentManager from '../admin/RiskAssessmentManager';
import ReportsSection from '../admin/ReportsSection';
import CCMTimeline from '../atlas/CCMTimeline';
import RevenueDashboard from '../atlas/RevenueDashboard';
import { useSupabaseClient } from '../../contexts/AuthContext';
import { FHIRService } from '../../services/fhirResourceService';
import { SDOHBillingService } from '../../services/sdohBillingService';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface PatientListItem {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  dob: string;
  phone?: string;
  email?: string;
  risk_score?: number;
  ccm_eligible?: boolean;
  active_conditions_count?: number;
  last_visit?: string;
}

interface PatientVitals {
  bloodPressure?: string;
  heartRate?: number;
  oxygenSaturation?: number;
  temperature?: number;
  weight?: number;
  bmi?: number;
  lastUpdated?: string;
}

interface PatientSummary {
  demographics: PatientListItem;
  vitals: PatientVitals;
  activeConditions: number;
  activeMedications: number;
  upcomingAppointments: number;
  pendingLabs: number;
  sdohComplexity: number;
  ccmEligible: boolean;
  revenueOpportunity: number;
}

interface QuickStat {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  trend?: { value: string; positive: boolean };
  action?: () => void;
}

// ============================================================================
// COLLAPSIBLE SECTION COMPONENT
// ============================================================================

interface CollapsibleSectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  category?: 'medical' | 'administrative' | 'clinical' | 'revenue';
  badge?: string | number;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  children,
  defaultOpen = false,
  category = 'clinical',
  badge
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const categoryColors = {
    medical: 'border-l-4 border-l-blue-600 bg-blue-50',
    administrative: 'border-l-4 border-l-purple-600 bg-purple-50',
    clinical: 'border-l-4 border-l-green-600 bg-green-50',
    revenue: 'border-l-4 border-l-amber-600 bg-amber-50'
  };

  const badgeColors = {
    medical: 'bg-blue-600',
    administrative: 'bg-purple-600',
    clinical: 'bg-green-600',
    revenue: 'bg-amber-600'
  };

  return (
    <section className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-6 py-4 flex items-center justify-between hover:${categoryColors[category]} transition-all`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
          {badge !== undefined && (
            <span className={`px-2 py-1 text-xs font-bold text-white rounded-full ${badgeColors[category]}`}>
              {badge}
            </span>
          )}
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

// ============================================================================
// PATIENT SELECTOR COMPONENT
// ============================================================================

interface PatientSelectorProps {
  onSelectPatient: (patient: PatientListItem) => void;
  selectedPatient: PatientListItem | null;
}

const PatientSelector: React.FC<PatientSelectorProps> = ({ onSelectPatient, selectedPatient }) => {
  const supabase = useSupabaseClient();
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadPatients = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, dob, phone, email')
        .or('role.eq.senior,role.eq.patient')
        .order('last_name', { ascending: true })
        .limit(100);

      if (error) throw error;
      // Map to PatientListItem with id field
      const mapped = (data || []).map(p => ({ ...p, id: p.user_id }));
      setPatients(mapped);
    } catch (error) {
      console.error('Error loading patients:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const filteredPatients = patients.filter(p =>
    `${p.first_name} ${p.last_name} ${p.phone || ''}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-lg border border-gray-300 p-4">
      <div className="flex items-center gap-3 mb-3">
        <Users className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-900">Select Patient</h3>
      </div>

      <input
        type="text"
        placeholder="Search by name or phone..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />

      {loading ? (
        <div className="text-center py-4 text-gray-500">Loading patients...</div>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-2">
          {filteredPatients.map((patient) => (
            <button
              key={patient.user_id}
              onClick={() => onSelectPatient(patient)}
              className={`w-full text-left px-3 py-2 rounded border transition-all ${
                selectedPatient?.user_id === patient.user_id
                  ? 'bg-blue-100 border-blue-600 shadow-sm'
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <div className="font-medium text-gray-900">
                {patient.last_name}, {patient.first_name}
              </div>
              <div className="text-xs text-gray-600">
                DOB: {new Date(patient.dob).toLocaleDateString()} • {patient.phone}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// PATIENT SUMMARY CARD COMPONENT
// ============================================================================

interface PatientSummaryCardProps {
  summary: PatientSummary | null;
  loading: boolean;
}

const PatientSummaryCard: React.FC<PatientSummaryCardProps> = ({ summary, loading }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 p-8 text-center">
        <Users className="w-16 h-16 mx-auto text-gray-400 mb-3" />
        <p className="text-gray-600 font-medium">No patient selected</p>
        <p className="text-sm text-gray-500 mt-1">Select a patient to view their health summary</p>
      </div>
    );
  }

  const { demographics, vitals, activeConditions, activeMedications, sdohComplexity, ccmEligible, revenueOpportunity } = summary;

  return (
    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-xl p-6 text-white">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">
            {demographics.last_name}, {demographics.first_name}
          </h2>
          <p className="text-blue-100 mt-1">
            DOB: {new Date(demographics.dob).toLocaleDateString()} •{' '}
            Age: {new Date().getFullYear() - new Date(demographics.dob).getFullYear()}
          </p>
        </div>
        {ccmEligible && (
          <div className="bg-amber-500 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
            <Award className="w-4 h-4" />
            CCM Eligible
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-white bg-opacity-20 rounded-lg p-3">
          <div className="text-xs text-blue-100">Blood Pressure</div>
          <div className="text-lg font-bold">{vitals.bloodPressure || 'N/A'}</div>
        </div>
        <div className="bg-white bg-opacity-20 rounded-lg p-3">
          <div className="text-xs text-blue-100">Heart Rate</div>
          <div className="text-lg font-bold">{vitals.heartRate ? `${vitals.heartRate} bpm` : 'N/A'}</div>
        </div>
        <div className="bg-white bg-opacity-20 rounded-lg p-3">
          <div className="text-xs text-blue-100">O₂ Saturation</div>
          <div className="text-lg font-bold">{vitals.oxygenSaturation ? `${vitals.oxygenSaturation}%` : 'N/A'}</div>
        </div>
        <div className="bg-white bg-opacity-20 rounded-lg p-3">
          <div className="text-xs text-blue-100">Weight</div>
          <div className="text-lg font-bold">{vitals.weight ? `${vitals.weight} lbs` : 'N/A'}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white bg-opacity-10 rounded p-2 text-center">
          <div className="text-xs text-blue-100">Active Conditions</div>
          <div className="text-xl font-bold">{activeConditions}</div>
        </div>
        <div className="bg-white bg-opacity-10 rounded p-2 text-center">
          <div className="text-xs text-blue-100">Active Medications</div>
          <div className="text-xl font-bold">{activeMedications}</div>
        </div>
        <div className="bg-white bg-opacity-10 rounded p-2 text-center">
          <div className="text-xs text-blue-100">SDOH Complexity</div>
          <div className="text-xl font-bold">{sdohComplexity}/10</div>
        </div>
      </div>

      {revenueOpportunity > 0 && (
        <div className="mt-4 bg-amber-500 bg-opacity-30 border border-amber-400 rounded-lg p-3 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-amber-200" />
          <div className="text-sm">
            <span className="font-semibold">Revenue Opportunity:</span>{' '}
            <span className="text-amber-200 font-bold">${revenueOpportunity.toLocaleString()}</span>
            {' '}in unbilled codes detected
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN PHYSICIAN PANEL COMPONENT
// ============================================================================

const PhysicianPanel: React.FC = () => {
  const supabase = useSupabaseClient();

  const [selectedPatient, setSelectedPatient] = useState<PatientListItem | null>(null);
  const [patientSummary, setPatientSummary] = useState<PatientSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({
    totalPatients: 0,
    ccmEligible: 0,
    pendingReviews: 0,
    todayRevenue: 0
  });

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
        pendingReviews: 0,
        todayRevenue: 0
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
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

      // Calculate revenue opportunity (simplified - based on CCM eligibility and condition count)
      const conditionsList = conditionsData?.data || [];
      const chronicConditions = conditionsList.filter((c: any) =>
        c.clinical_status === 'active' && c.category?.[0]?.coding?.[0]?.code === 'problem-list-item'
      ).length || 0;

      let revenueOpportunity = 0;
      if (sdohAssessment?.ccmEligible) {
        if (sdohAssessment.ccmTier === 'complex') {
          revenueOpportunity += 140; // Complex CCM base
        } else {
          revenueOpportunity += 70; // Standard CCM base
        }
      }
      if (sdohAssessment && sdohAssessment.overallComplexityScore > 5) {
        revenueOpportunity += 50; // SDOH codes
      }

      const summary: PatientSummary = {
        demographics: patient,
        vitals: latestVitals,
        activeConditions: chronicConditions,
        activeMedications: medicationsData?.data?.length || 0,
        upcomingAppointments: 0,
        pendingLabs: 0,
        sdohComplexity: sdohAssessment?.overallComplexityScore || 0,
        ccmEligible: sdohAssessment?.ccmEligible || false,
        revenueOpportunity
      };

      setPatientSummary(summary);
    } catch (error) {
      console.error('Error loading patient summary:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

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
    },
    {
      label: "Today's Revenue",
      value: `$${dashboardStats.todayRevenue.toLocaleString()}`,
      icon: <DollarSign className="w-6 h-6" />,
      color: 'bg-purple-600'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <AdminHeader />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Hero Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-xl p-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                  <Stethoscope className="w-10 h-10" />
                  Physician Command Center
                </h1>
                <p className="text-blue-100 text-lg">AI-Powered Clinical Intelligence & Revenue Optimization Platform</p>
              </div>
              <div className="flex items-center gap-3">
                <Brain className="w-16 h-16 text-blue-200 opacity-50" />
              </div>
            </div>
          </div>

          {/* Quick Stats Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {quickStats.map((stat, index) => (
              <div key={index} className="bg-white rounded-lg shadow-lg p-4 border-l-4 border-l-blue-600 hover:shadow-xl transition-shadow cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-600 font-medium">{stat.label}</div>
                  <div className={`p-2 rounded-lg ${stat.color} text-white`}>
                    {stat.icon}
                  </div>
                </div>
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                {stat.trend && (
                  <div className={`flex items-center gap-1 mt-1 text-xs ${stat.trend.positive ? 'text-green-600' : 'text-red-600'}`}>
                    <TrendingUp className={`w-3 h-3 ${stat.trend.positive ? '' : 'rotate-180'}`} />
                    {stat.trend.value}
                  </div>
                )}
              </div>
            ))}
          </div>

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
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <Brain className="w-6 h-6 text-amber-600 mt-1" />
                <div>
                  <h3 className="font-bold text-amber-900">Intelligent Revenue Capture</h3>
                  <p className="text-sm text-amber-800 mt-1">
                    SmartScribe automatically captures CPT codes, ICD-10 diagnoses, HCPCS codes, SDOH Z-codes, and CCM billing opportunities in real-time during patient encounters.
                    Revenue opportunities are highlighted instantly with estimated reimbursement amounts.
                  </p>
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <span className="text-xs bg-amber-600 text-white px-2 py-1 rounded">CPT Codes</span>
                    <span className="text-xs bg-amber-600 text-white px-2 py-1 rounded">ICD-10 Diagnoses</span>
                    <span className="text-xs bg-amber-600 text-white px-2 py-1 rounded">SDOH Z-Codes</span>
                    <span className="text-xs bg-amber-600 text-white px-2 py-1 rounded">CCM 99490/99487</span>
                    <span className="text-xs bg-amber-600 text-white px-2 py-1 rounded">HCPCS Codes</span>
                  </div>
                </div>
              </div>
            </div>
            <SmartScribe />
          </CollapsibleSection>

          {/* Medical Practice Tools Grid */}
          <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-200">
            <h2 className="text-2xl font-bold text-blue-900 mb-4 flex items-center gap-3">
              <Stethoscope className="w-7 h-7" />
              Clinical Tools & Medical Records
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a
                href="/my-health"
                className="bg-white p-5 rounded-lg shadow hover:shadow-xl transition-all border border-blue-200 hover:border-blue-400 group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">📋</div>
                  <Activity className="w-6 h-6 text-blue-600 group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="font-bold text-gray-900 text-lg">Patient Records</h3>
                <p className="text-sm text-gray-600 mt-1">FHIR-compliant health records with complete medical history</p>
              </a>

              <a
                href="/medicine-cabinet"
                className="bg-white p-5 rounded-lg shadow hover:shadow-xl transition-all border border-green-200 hover:border-green-400 group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">💊</div>
                  <Pill className="w-6 h-6 text-green-600 group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="font-bold text-gray-900 text-lg">Medications</h3>
                <p className="text-sm text-gray-600 mt-1">E-prescribing, medication reconciliation & adherence tracking</p>
              </a>

              <a
                href="/care-plans"
                className="bg-white p-5 rounded-lg shadow hover:shadow-xl transition-all border border-purple-200 hover:border-purple-400 group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">🗂️</div>
                  <ClipboardList className="w-6 h-6 text-purple-600 group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="font-bold text-gray-900 text-lg">Care Plans</h3>
                <p className="text-sm text-gray-600 mt-1">Evidence-based treatment protocols & care coordination</p>
              </a>

              <a
                href="/health-observations"
                className="bg-white p-5 rounded-lg shadow hover:shadow-xl transition-all border border-indigo-200 hover:border-indigo-400 group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">🔬</div>
                  <FileText className="w-6 h-6 text-indigo-600 group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="font-bold text-gray-900 text-lg">Lab Results</h3>
                <p className="text-sm text-gray-600 mt-1">LOINC-coded observations, diagnostics & trending</p>
              </a>

              <a
                href="/immunizations"
                className="bg-white p-5 rounded-lg shadow hover:shadow-xl transition-all border border-pink-200 hover:border-pink-400 group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">💉</div>
                  <CheckCircle className="w-6 h-6 text-pink-600 group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="font-bold text-gray-900 text-lg">Immunizations</h3>
                <p className="text-sm text-gray-600 mt-1">CVX-coded vaccination records & schedule gaps</p>
              </a>

              <a
                href="/billing"
                className="bg-white p-5 rounded-lg shadow hover:shadow-xl transition-all border border-amber-200 hover:border-amber-400 group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">💰</div>
                  <DollarSign className="w-6 h-6 text-amber-600 group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="font-bold text-gray-900 text-lg">Billing & Claims</h3>
                <p className="text-sm text-gray-600 mt-1">X12 EDI claims, fee schedules & revenue analytics</p>
              </a>
            </div>
          </div>

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
            category="revenue"
            badge="Revenue"
          >
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <Heart className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-green-900">CCM Billing Automation</h4>
                  <p className="text-sm text-green-800 mt-1">
                    Automatic time tracking for CCM codes 99490 (standard) and 99487 (complex). Ensures compliance with CMS requirements for 20+ minutes of non-face-to-face care coordination.
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

          {/* Revenue Dashboard */}
          <CollapsibleSection
            title="Practice Revenue Intelligence Dashboard"
            icon="💵"
            defaultOpen={false}
            category="revenue"
          >
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <LineChart className="w-5 h-5 text-purple-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-purple-900">Revenue Cycle Analytics</h4>
                  <p className="text-sm text-purple-800 mt-1">
                    Real-time tracking of claim submissions, denials, revenue per encounter, and optimization opportunities. Integrates SmartScribe coding suggestions for maximum reimbursement.
                  </p>
                </div>
              </div>
            </div>
            <RevenueDashboard />
          </CollapsibleSection>

          {/* Quick Reference Guide */}
          <div className="bg-gradient-to-r from-indigo-100 to-blue-100 rounded-xl p-6 border border-indigo-200">
            <h3 className="text-xl font-bold text-indigo-900 mb-4 flex items-center gap-2">
              <FileText className="w-6 h-6" />
              Quick Clinical Reference
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-indigo-100">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div>
                    <div className="font-bold text-gray-900">Emergency Protocols</div>
                    <div className="text-sm text-gray-600 mt-1">Rapid response guidelines for critical situations</div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-indigo-100">
                <div className="flex items-start gap-3">
                  <ClipboardList className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <div className="font-bold text-gray-900">Clinical Guidelines</div>
                    <div className="text-sm text-gray-600 mt-1">Evidence-based treatment protocols & best practices</div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-indigo-100">
                <div className="flex items-start gap-3">
                  <Pill className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <div className="font-bold text-gray-900">Formulary</div>
                    <div className="text-sm text-gray-600 mt-1">Approved medication list with alternatives</div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-indigo-100">
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-purple-600 mt-0.5" />
                  <div>
                    <div className="font-bold text-gray-900">Specialist Directory</div>
                    <div className="text-sm text-gray-600 mt-1">Referral network contacts & specialties</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* System Info Footer */}
          <div className="text-center text-gray-500 text-sm py-6 border-t border-gray-200">
            <div className="flex items-center justify-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <p className="font-semibold text-gray-700">WellFit Physician Command Center</p>
            </div>
            <p>HIPAA-Compliant • FHIR R4 • AI-Powered Clinical Intelligence • Real-Time Revenue Optimization</p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PhysicianPanel;
