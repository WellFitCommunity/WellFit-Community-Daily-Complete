/**
 * PatientChartNavigator - Unified Patient Chart with Tab Navigation
 *
 * Purpose: Single page for navigating all patient chart sections without context loss
 * Used by: Physicians, Nurses, Clinical Staff via /patient-chart/:patientId
 *
 * Solves: Patient selection resets when navigating between chart sections.
 * All tabs share the same patientId from URL — no context loss on tab switch.
 */

import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { usePatientContext } from '../../contexts/PatientContext';
import { auditLogger } from '../../services/auditLogger';

// Lazy-load tab content components (they're large)
const MedicationRequestManager = lazy(() =>
  import('../patient/MedicationRequestManager').then(m => ({ default: m.MedicationRequestManager }))
);
const CarePlanDashboard = lazy(() => import('../patient/CarePlanDashboard'));
const ObservationDashboard = lazy(() => import('../patient/ObservationDashboard'));
const ImmunizationDashboard = lazy(() => import('../patient/ImmunizationDashboard'));
const PatientAvatarPage = lazy(() =>
  import('../patient-avatar/PatientAvatarPage').then(m => ({ default: m.PatientAvatarPage }))
);

// ============================================================================
// TYPES
// ============================================================================

export type ChartTab = 'overview' | 'medications' | 'care-plans' | 'observations' | 'avatar' | 'immunizations';

interface PatientInfo {
  id: string;
  firstName: string;
  lastName: string;
  roomNumber?: string;
  dateOfBirth?: string;
}

interface PatientChartNavigatorProps {
  patientId: string;
}

// ============================================================================
// TAB DEFINITIONS
// ============================================================================

interface TabDef {
  id: ChartTab;
  label: string;
  shortLabel: string;
  icon: string;
}

const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview', shortLabel: 'Overview', icon: '📋' },
  { id: 'medications', label: 'Medications', shortLabel: 'Meds', icon: '💊' },
  { id: 'care-plans', label: 'Care Plans', shortLabel: 'Plans', icon: '🗂️' },
  { id: 'observations', label: 'Labs & Vitals', shortLabel: 'Labs', icon: '🔬' },
  { id: 'immunizations', label: 'Immunizations', shortLabel: 'Vaccines', icon: '💉' },
  { id: 'avatar', label: 'Body Map', shortLabel: 'Avatar', icon: '🧍' },
];

// ============================================================================
// TAB LOADING SPINNER
// ============================================================================

const TabSpinner: React.FC = () => (
  <div className="flex items-center justify-center py-24">
    <div className="text-center">
      <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full mx-auto mb-3" />
      <p className="text-sm text-slate-400">Loading...</p>
    </div>
  </div>
);

// ============================================================================
// OVERVIEW TAB (quick links to other tabs)
// ============================================================================

interface OverviewTabProps {
  patientId: string;
  patient: PatientInfo | null;
  onTabChange: (tab: ChartTab) => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ patient, onTabChange }) => {
  const cards: { tab: ChartTab; icon: string; title: string; description: string; color: string }[] = [
    { tab: 'medications', icon: '💊', title: 'Medications', description: 'E-prescribing, reconciliation & adherence', color: 'border-green-500/30 hover:border-green-500' },
    { tab: 'care-plans', icon: '🗂️', title: 'Care Plans', description: 'Treatment protocols & coordination', color: 'border-purple-500/30 hover:border-purple-500' },
    { tab: 'observations', icon: '🔬', title: 'Labs & Vitals', description: 'LOINC observations, diagnostics & trending', color: 'border-blue-500/30 hover:border-blue-500' },
    { tab: 'immunizations', icon: '💉', title: 'Immunizations', description: 'CVX vaccination records & schedule', color: 'border-pink-500/30 hover:border-pink-500' },
    { tab: 'avatar', icon: '🧍', title: 'Body Map', description: 'Clinical markers & device tracking', color: 'border-teal-500/30 hover:border-teal-500' },
  ];

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-white mb-1">
        Patient Chart {patient ? `— ${patient.lastName}, ${patient.firstName}` : ''}
      </h2>
      <p className="text-sm text-slate-400 mb-6">Select a section to view clinical data</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <button
            key={card.tab}
            onClick={() => onTabChange(card.tab)}
            className={`p-5 rounded-lg bg-slate-800/50 border ${card.color} text-left transition-all hover:bg-slate-800`}
          >
            <div className="text-3xl mb-3">{card.icon}</div>
            <h3 className="font-semibold text-white text-base">{card.title}</h3>
            <p className="text-sm text-slate-400 mt-1">{card.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const PatientChartNavigator: React.FC<PatientChartNavigatorProps> = ({ patientId }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectPatient } = usePatientContext();

  // Active tab from URL
  const activeTab: ChartTab = useMemo(() => {
    const tab = searchParams.get('tab');
    const valid: ChartTab[] = ['overview', 'medications', 'care-plans', 'observations', 'avatar', 'immunizations'];
    if (tab && valid.includes(tab as ChartTab)) return tab as ChartTab;
    return 'overview';
  }, [searchParams]);

  // Patient info
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [loadingPatient, setLoadingPatient] = useState(true);

  // Load patient info and sync to PatientContext
  useEffect(() => {
    const loadPatient = async () => {
      setLoadingPatient(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, room_number, dob')
          .eq('user_id', patientId)
          .single();

        if (error || !data) {
          auditLogger.warn('CHART_NAV_PATIENT_NOT_FOUND', { patientId, error: error?.message });
          setPatient(null);
          return;
        }

        const info: PatientInfo = {
          id: data.user_id as string,
          firstName: (data.first_name as string) || 'Unknown',
          lastName: (data.last_name as string) || 'Unknown',
          roomNumber: data.room_number as string | undefined,
          dateOfBirth: data.dob as string | undefined,
        };

        setPatient(info);

        // Sync to global PatientContext so other components stay in sync
        selectPatient({
          id: info.id,
          firstName: info.firstName,
          lastName: info.lastName,
          roomNumber: info.roomNumber,
          dateOfBirth: info.dateOfBirth,
        });
      } catch (err: unknown) {
        auditLogger.error(
          'CHART_NAV_LOAD_FAILED',
          err instanceof Error ? err : new Error(String(err)),
          { patientId }
        );
      } finally {
        setLoadingPatient(false);
      }
    };

    loadPatient();
  }, [patientId, selectPatient]);

  // Tab change handler — updates URL without full navigation
  const handleTabChange = useCallback((tab: ChartTab) => {
    setSearchParams({ tab }, { replace: true });
  }, [setSearchParams]);

  // Back to dashboard
  const handleBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // Loading state
  if (loadingPatient) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-400">Loading patient chart...</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-2">Patient not found</p>
          <p className="text-sm text-slate-500 mb-4">ID: {patientId}</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* ─── Patient Header Bar ─── */}
      <div className="sticky top-0 z-30 bg-slate-900 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Back + Patient Name */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleBack}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                aria-label="Go back"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h1 className="text-lg font-semibold text-white">
                  {patient.lastName}, {patient.firstName}
                </h1>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  {patient.roomNumber && <span>Room {patient.roomNumber}</span>}
                  {patient.dateOfBirth && <span>DOB: {patient.dateOfBirth}</span>}
                  <span className="text-slate-600">ID: {patientId.slice(0, 8)}...</span>
                </div>
              </div>
            </div>

            {/* Right: Quick actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/patient-avatar/${patientId}`)}
                className="px-3 py-1.5 text-xs bg-slate-800 text-teal-400 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Full Body Map
              </button>
            </div>
          </div>
        </div>

        {/* ─── Tab Bar ─── */}
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-1 overflow-x-auto pb-0 -mb-px" role="tablist">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleTabChange(tab.id)}
                  className={`
                    flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap
                    border-b-2 transition-colors shrink-0
                    ${isActive
                      ? 'border-teal-500 text-teal-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                    }
                  `}
                >
                  <span className="text-base">{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ─── Tab Content ─── */}
      <div className="max-w-7xl mx-auto">
        <Suspense fallback={<TabSpinner />}>
          {activeTab === 'overview' && (
            <OverviewTab
              patientId={patientId}
              patient={patient}
              onTabChange={handleTabChange}
            />
          )}

          {activeTab === 'medications' && (
            <div className="p-4">
              <MedicationRequestManager patientId={patientId} />
            </div>
          )}

          {activeTab === 'care-plans' && (
            <div className="p-4">
              <CarePlanDashboard userId={patientId} />
            </div>
          )}

          {activeTab === 'observations' && (
            <div className="p-4">
              <ObservationDashboard userId={patientId} />
            </div>
          )}

          {activeTab === 'immunizations' && (
            <div className="p-4">
              <ImmunizationDashboard userId={patientId} />
            </div>
          )}

          {activeTab === 'avatar' && (
            <PatientAvatarPage patientId={patientId} />
          )}
        </Suspense>
      </div>
    </div>
  );
};

PatientChartNavigator.displayName = 'PatientChartNavigator';

export default PatientChartNavigator;
