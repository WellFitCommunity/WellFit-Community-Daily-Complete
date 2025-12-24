/**
 * Mental Health Intervention Dashboard
 * Real-time monitoring and coordination for mental health support
 *
 * Clinical Standards: Joint Commission, CMS CoP
 * Purpose: Life-saving intervention coordination
 */

import React, { useEffect, useState } from 'react';
import { useUser } from '../../contexts/AuthContext';
import { MentalHealthService } from '../../services/mentalHealthService';
import type {
  MentalHealthDashboardSummary,
  ActiveMentalHealthPatient,
  PendingMentalHealthSession,
  DischargeBlocker,
  RiskLevel,
  Priority,
} from '../../types/mentalHealth';
import {
  RISK_LEVEL_COLORS,
  RISK_LEVEL_BG_COLORS,
  RISK_LEVEL_ICONS,
  RISK_LEVEL_DISPLAY,
  PRIORITY_COLORS,
  PRIORITY_DISPLAY,
  SESSION_STATUS_DISPLAY,
  sortPatientsByPriority,
} from '../../types/mentalHealth';
import { Card } from '../ui/card';

export const MentalHealthDashboard: React.FC = () => {
  const user = useUser();
  const [summary, setSummary] = useState<MentalHealthDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'pending' | 'blockers' | 'escalations'>('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Load dashboard data
  const loadDashboard = async () => {
    try {
      setError(null);
      const response = await MentalHealthService.getDashboardSummary();

      if (response.success && response.data) {
        setSummary(response.data);
      } else {
        setError(response.error || 'Failed to load dashboard');
      }
    } catch (err) {

      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadDashboard();
    }
  }, [user]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadDashboard();
    }, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🧠</div>
            <div className="text-xl font-semibold text-gray-700">Loading Mental Health Dashboard...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="p-6 bg-red-50 border-red-200">
            <div className="flex items-center">
              <span className="text-3xl mr-4">⚠️</span>
              <div>
                <h3 className="text-lg font-semibold text-red-800">Error Loading Dashboard</h3>
                <p className="text-red-600">{error}</p>
                <button
                  onClick={loadDashboard}
                  className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Retry
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const sortedPatients = sortPatientsByPriority(summary.patients);

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#003865] mb-2">
                🧠 Mental Health Intervention Dashboard
              </h1>
              <p className="text-gray-600">
                Real-time monitoring and coordination for patients experiencing acute medical trauma
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={loadDashboard}
                className="px-4 py-2 bg-[#003865] text-white rounded-lg hover:bg-[#8cc63f] transition"
              >
                🔄 Refresh
              </button>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded-sm"
                />
                Auto-refresh
              </label>
            </div>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            title="Active Patients"
            value={summary.active_patients}
            icon="👥"
            color="bg-blue-500"
          />
          <MetricCard
            title="Pending Sessions"
            value={summary.pending_sessions}
            icon="📅"
            color="bg-purple-500"
          />
          <MetricCard
            title="Discharge Blockers"
            value={summary.discharge_blockers}
            icon="🚫"
            color="bg-orange-500"
            urgent={summary.discharge_blockers > 0}
          />
          <MetricCard
            title="High Risk Alerts"
            value={summary.high_risk_count}
            icon="🚨"
            color="bg-red-500"
            urgent={summary.high_risk_count > 0}
          />
        </div>

        {/* Risk Distribution */}
        <Card className="p-6 mb-8">
          <h3 className="text-lg font-semibold text-[#003865] mb-4">Risk Level Distribution</h3>
          <div className="grid grid-cols-3 gap-4">
            <RiskCard
              level="high"
              count={summary.high_risk_count}
            />
            <RiskCard
              level="moderate"
              count={summary.moderate_risk_count}
            />
            <RiskCard
              level="low"
              count={summary.low_risk_count}
            />
          </div>
        </Card>

        {/* Today's Activity */}
        <Card className="p-6 mb-8">
          <h3 className="text-lg font-semibold text-[#003865] mb-4">📊 Today's Activity</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{summary.sessions_completed_today}</div>
              <div className="text-sm text-gray-600">Sessions Completed</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{summary.escalations_today}</div>
              <div className="text-sm text-gray-600">Escalations</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {summary.avg_session_duration_today ? `${Math.round(summary.avg_session_duration_today)} min` : 'N/A'}
              </div>
              <div className="text-sm text-gray-600">Avg Session Duration</div>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <div className="mb-4">
          <div className="flex gap-2 border-b border-gray-300">
            <TabButton
              active={selectedTab === 'overview'}
              onClick={() => setSelectedTab('overview')}
              label="Active Patients"
              count={summary.active_patients}
            />
            <TabButton
              active={selectedTab === 'pending'}
              onClick={() => setSelectedTab('pending')}
              label="Pending Sessions"
              count={summary.pending_sessions}
            />
            <TabButton
              active={selectedTab === 'blockers'}
              onClick={() => setSelectedTab('blockers')}
              label="Discharge Blockers"
              count={summary.discharge_blockers}
              urgent={summary.discharge_blockers > 0}
            />
          </div>
        </div>

        {/* Tab Content */}
        {selectedTab === 'overview' && (
          <ActivePatientsTable patients={sortedPatients} />
        )}

        {selectedTab === 'pending' && (
          <PendingSessionsTable sessions={summary.pending_sessions_list} />
        )}

        {selectedTab === 'blockers' && (
          <DischargeBlockersTable blockers={summary.discharge_blockers_list} />
        )}

      </div>
    </div>
  );
};

// ============================================================================
// METRIC CARD
// ============================================================================

interface MetricCardProps {
  title: string;
  value: number;
  icon: string;
  color: string;
  urgent?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon, color, urgent }) => (
  <Card className={`p-6 ${urgent ? 'ring-2 ring-red-500 animate-pulse' : ''}`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-600 mb-1">{title}</p>
        <p className="text-3xl font-bold text-[#003865]">{value}</p>
      </div>
      <div className={`text-4xl ${color} bg-opacity-10 p-3 rounded-lg`}>
        {icon}
      </div>
    </div>
  </Card>
);

// ============================================================================
// RISK CARD
// ============================================================================

interface RiskCardProps {
  level: RiskLevel;
  count: number;
}

const RiskCard: React.FC<RiskCardProps> = ({ level, count }) => (
  <div
    className="p-4 rounded-lg border-2"
    style={{
      backgroundColor: RISK_LEVEL_BG_COLORS[level],
      borderColor: RISK_LEVEL_COLORS[level],
    }}
  >
    <div className="flex items-center justify-between mb-2">
      <span className="text-2xl">{RISK_LEVEL_ICONS[level]}</span>
      <span className="text-3xl font-bold" style={{ color: RISK_LEVEL_COLORS[level] }}>
        {count}
      </span>
    </div>
    <div className="text-sm font-semibold" style={{ color: RISK_LEVEL_COLORS[level] }}>
      {RISK_LEVEL_DISPLAY[level]}
    </div>
  </div>
);

// ============================================================================
// TAB BUTTON
// ============================================================================

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  urgent?: boolean;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, label, count, urgent }) => (
  <button
    onClick={onClick}
    className={`px-6 py-3 font-semibold transition relative ${
      active
        ? 'text-[#003865] border-b-2 border-[#8cc63f]'
        : 'text-gray-600 hover:text-[#003865]'
    }`}
  >
    {label}
    {count > 0 && (
      <span
        className={`ml-2 px-2 py-1 text-xs rounded-full ${
          urgent
            ? 'bg-red-500 text-white animate-pulse'
            : 'bg-gray-200 text-gray-700'
        }`}
      >
        {count}
      </span>
    )}
  </button>
);

// ============================================================================
// ACTIVE PATIENTS TABLE
// ============================================================================

interface ActivePatientsTableProps {
  patients: ActiveMentalHealthPatient[];
}

const ActivePatientsTable: React.FC<ActivePatientsTableProps> = ({ patients }) => {
  if (patients.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="text-4xl mb-4">✅</div>
        <p className="text-xl font-semibold text-gray-700">No Active Mental Health Patients</p>
        <p className="text-gray-500 mt-2">All patients have completed required interventions</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Patient
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Room
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Risk Level
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Priority
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Session Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {patients.map((patient) => (
              <tr
                key={patient.patient_id}
                className={`hover:bg-gray-50 ${
                  patient.discharge_blocker_active ? 'bg-yellow-50' : ''
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">
                    {patient.first_name} {patient.last_name}
                  </div>
                  <div className="text-sm text-gray-500">MRN: {patient.mrn}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {patient.room_number || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {patient.risk_level ? (
                    <span
                      className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full"
                      style={{
                        backgroundColor: RISK_LEVEL_BG_COLORS[patient.risk_level],
                        color: RISK_LEVEL_COLORS[patient.risk_level],
                      }}
                    >
                      {RISK_LEVEL_ICONS[patient.risk_level]} {patient.risk_level.toUpperCase()}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-sm">Not assessed</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full"
                    style={{
                      backgroundColor: PRIORITY_COLORS[patient.priority],
                      color: 'white',
                    }}
                  >
                    {PRIORITY_DISPLAY[patient.priority]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {patient.session_type}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">
                      {patient.service_request_status}
                    </div>
                    {patient.discharge_blocker_active && (
                      <div className="text-orange-600 font-semibold">
                        🚫 Discharge Hold
                      </div>
                    )}
                    {patient.active_flag && (
                      <div className="text-red-600 text-xs mt-1">
                        {patient.active_flag}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => window.location.href = `/mental-health/patient/${patient.patient_id}`}
                    className="text-[#8cc63f] hover:text-[#003865] font-semibold"
                  >
                    View Details →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

// ============================================================================
// PENDING SESSIONS TABLE
// ============================================================================

interface PendingSessionsTableProps {
  sessions: PendingMentalHealthSession[];
}

const PendingSessionsTable: React.FC<PendingSessionsTableProps> = ({ sessions }) => {
  if (sessions.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="text-4xl mb-4">✅</div>
        <p className="text-xl font-semibold text-gray-700">No Pending Sessions</p>
        <p className="text-gray-500 mt-2">All sessions are completed or scheduled for later</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Patient
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Scheduled
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Session #
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Therapist
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sessions.map((session) => (
              <tr
                key={session.session_id}
                className={`hover:bg-gray-50 ${
                  session.is_discharge_required_session ? 'bg-blue-50' : ''
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">
                    {session.first_name} {session.last_name}
                  </div>
                  <div className="text-sm text-gray-500">Room: {session.room_number}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {session.scheduled_start
                    ? new Date(session.scheduled_start).toLocaleString()
                    : 'Not scheduled'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    Session {session.session_number}
                  </div>
                  {session.is_discharge_required_session && (
                    <div className="text-xs text-blue-600 font-semibold">
                      ⚠️ Required for discharge
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {session.therapist || 'Unassigned'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    {SESSION_STATUS_DISPLAY[session.status]}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => window.location.href = `/mental-health/session/${session.session_id}`}
                    className="text-[#8cc63f] hover:text-[#003865] font-semibold"
                  >
                    Start Session →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

// ============================================================================
// DISCHARGE BLOCKERS TABLE
// ============================================================================

interface DischargeBlockersTableProps {
  blockers: DischargeBlocker[];
}

const DischargeBlockersTable: React.FC<DischargeBlockersTableProps> = ({ blockers }) => {
  if (blockers.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="text-4xl mb-4">✅</div>
        <p className="text-xl font-semibold text-gray-700">No Discharge Blockers</p>
        <p className="text-gray-500 mt-2">All patients have completed discharge requirements</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Patient
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Requirements Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Active Flags
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {blockers.map((blocker) => (
              <tr key={blocker.patient_id} className="hover:bg-gray-50 bg-orange-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">
                    {blocker.first_name} {blocker.last_name}
                  </div>
                  <div className="text-sm text-gray-500">
                    MRN: {blocker.mrn} | Room: {blocker.room_number}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1 text-sm">
                    <ChecklistItem
                      label="Initial Session"
                      completed={blocker.initial_therapy_session_completed}
                    />
                    <ChecklistItem
                      label="Risk Assessment"
                      completed={blocker.risk_assessment_completed}
                    />
                    <ChecklistItem
                      label="Safety Plan"
                      completed={blocker.safety_plan_created}
                    />
                    <ChecklistItem
                      label="Outpatient Scheduled"
                      completed={blocker.outpatient_therapy_scheduled}
                    />
                  </div>
                </td>
                <td className="px-6 py-4">
                  {blocker.active_flags && blocker.active_flags.length > 0 ? (
                    <div className="space-y-1">
                      {blocker.active_flags.map((flag, idx) => (
                        <div key={idx} className="text-xs text-red-600 font-semibold">
                          🚩 {flag}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">None</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => window.location.href = `/mental-health/patient/${blocker.patient_id}`}
                    className="text-orange-600 hover:text-orange-800 font-semibold"
                  >
                    Resolve →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

// ============================================================================
// CHECKLIST ITEM
// ============================================================================

interface ChecklistItemProps {
  label: string;
  completed: boolean;
}

const ChecklistItem: React.FC<ChecklistItemProps> = ({ label, completed }) => (
  <div className="flex items-center gap-2">
    {completed ? (
      <span className="text-green-500 font-bold">✓</span>
    ) : (
      <span className="text-red-500 font-bold">✗</span>
    )}
    <span className={completed ? 'text-gray-600' : 'text-red-600 font-semibold'}>
      {label}
    </span>
  </div>
);

export default MentalHealthDashboard;
