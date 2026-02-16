/**
 * Patient Priority Board
 *
 * AI-powered patient prioritization for physicians.
 * Shows ONLY patients assigned to the current physician (via care_team_members).
 * Each patient card includes the Patient Avatar thumbnail.
 * Click any patient to open their full chart with all information.
 *
 * Scoring: Location (30) + Alerts (40) + Readmission (25) + Fall Risk (15) + Engagement (10) + Vitals (10)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Activity, Heart, Thermometer,
  ChevronDown, ChevronUp, RefreshCw, ExternalLink,
} from 'lucide-react';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';
import { usePatientContext, SelectedPatient } from '../../contexts/PatientContext';
import { PatientAvatar } from '../patient-avatar/PatientAvatar';
import { auditLogger } from '../../services/auditLogger';
import {
  type PriorityPatient, type PriorityLevel,
  type EncounterRow, type AlertRow, type RiskRow, type FallRiskRow,
  type EngagementRow, type CheckInRow, type CareTeamRow, type ProfileRow,
  getLocationScore, getLocationLabel, calculatePriorityScore,
  getPriorityLevel, isAbnormalVitals, buildRiskFlags, PRIORITY_STYLES,
} from './priorityScoring';

// ============================================================================
// PRIORITY CARD — Each patient with avatar, vitals, risk flags
// ============================================================================

interface PriorityCardProps {
  patient: PriorityPatient;
  rank: number;
  onSelect: (patientId: string) => void;
}

const PriorityCard: React.FC<PriorityCardProps> = ({ patient, rank, onSelect }) => {
  const styles = PRIORITY_STYLES[patient.priority_level];

  return (
    <button
      onClick={() => onSelect(patient.patient_id)}
      className={`w-full text-left rounded-xl border-2 ${styles.border} ${styles.bg} p-4 hover:shadow-lg transition-all group`}
      aria-label={`Open chart for ${patient.first_name} ${patient.last_name} — priority ${patient.priority_level}`}
    >
      <div className="flex items-start gap-4">
        {/* Avatar thumbnail */}
        <div className="flex-shrink-0">
          <PatientAvatar
            patientId={patient.patient_id}
            patientName={`${patient.first_name} ${patient.last_name}`}
            initialMode="compact"
            editable={false}
          />
        </div>

        {/* Patient info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full ${styles.badge} flex items-center justify-center text-sm font-bold`}>
                {rank}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-lg text-gray-900 truncate">
                  {patient.last_name}, {patient.first_name}
                </div>
                <div className="text-sm text-gray-500 mt-0.5">
                  DOB: {patient.dob ? new Date(patient.dob).toLocaleDateString() : 'N/A'}
                </div>
              </div>
            </div>

            {/* Location + score */}
            <div className="flex-shrink-0 text-right">
              <span className={`inline-block px-3 py-1 rounded-lg text-xs font-bold ${styles.badge}`}>
                {patient.location}
              </span>
              <div className={`text-sm font-bold mt-1 ${styles.text}`}>
                Score: {patient.priority_score}
              </div>
            </div>
          </div>

          {/* Vitals row */}
          <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
            {patient.latest_bp && (
              <span className="flex items-center gap-1">
                <Heart className="w-3.5 h-3.5" /> BP {patient.latest_bp}
              </span>
            )}
            {patient.latest_hr !== null && (
              <span className={`flex items-center gap-1 ${patient.latest_hr > 120 || patient.latest_hr < 50 ? 'text-red-600 font-bold' : ''}`}>
                <Activity className="w-3.5 h-3.5" /> HR {patient.latest_hr}
              </span>
            )}
            {patient.latest_spo2 !== null && (
              <span className={`flex items-center gap-1 ${patient.latest_spo2 < 92 ? 'text-red-600 font-bold' : ''}`}>
                <Thermometer className="w-3.5 h-3.5" /> SpO2 {patient.latest_spo2}%
              </span>
            )}
            {patient.readmission_risk !== null && (
              <span className={`flex items-center gap-1 ${patient.readmission_risk >= 0.6 ? 'text-red-600 font-bold' : ''}`}>
                Readmit: {Math.round(patient.readmission_risk * 100)}%
              </span>
            )}
          </div>

          {/* Risk flags */}
          {patient.risk_flags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {patient.risk_flags.map((flag, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  {flag}
                </span>
              ))}
            </div>
          )}

          {/* Open chart CTA */}
          <div className="flex justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-sm text-blue-600 font-medium flex items-center gap-1">
              Open Full Chart <ExternalLink className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>
    </button>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const PatientPriorityBoard: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();
  const navigate = useNavigate();
  const { selectPatient: setGlobalPatient } = usePatientContext();
  const [patients, setPatients] = useState<PriorityPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [filterLevel, setFilterLevel] = useState<PriorityLevel | 'all'>('all');

  const physicianId = user?.id;

  const loadPriorityBoard = useCallback(async () => {
    if (!physicianId) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Get this physician's assigned patients from care_team_members
      const { data: assignments, error: assignErr } = await supabase
        .from('care_team_members')
        .select('patient_id, member_role, is_primary')
        .eq('member_id', physicianId)
        .is('end_date', null);

      if (assignErr) throw assignErr;

      const assignedPatientIds = [...new Set(
        ((assignments || []) as CareTeamRow[]).map(a => a.patient_id)
      )];

      if (assignedPatientIds.length === 0) {
        setPatients([]);
        setLoading(false);
        return;
      }

      // 2. Query all data sources in parallel for assigned patients
      const [profilesRes, encountersRes, alertsRes, risksRes, fallRisksRes, engagementRes, checkInsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('user_id, first_name, last_name, dob')
          .in('user_id', assignedPatientIds),
        supabase
          .from('encounters')
          .select('id, patient_id, status, encounter_type')
          .in('patient_id', assignedPatientIds)
          .in('status', ['arrived', 'triaged', 'in_progress', 'scheduled', 'ready_for_sign']),
        supabase
          .from('care_team_alerts')
          .select('patient_id, severity')
          .in('patient_id', assignedPatientIds)
          .in('status', ['active', 'in_progress']),
        supabase
          .from('readmission_risk_predictions')
          .select('patient_id, readmission_risk_30_day, risk_category')
          .in('patient_id', assignedPatientIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('ai_fall_risk_assessments')
          .select('patient_id, overall_risk_score')
          .in('patient_id', assignedPatientIds)
          .eq('status', 'approved')
          .order('created_at', { ascending: false }),
        supabase
          .from('patient_engagement_scores')
          .select('user_id, engagement_score, negative_moods_30d')
          .in('user_id', assignedPatientIds),
        supabase
          .from('check_ins')
          .select('user_id, bp_systolic, bp_diastolic, heart_rate, pulse_oximeter')
          .in('user_id', assignedPatientIds)
          .order('created_at', { ascending: false })
          .limit(500),
      ]);

      // Build lookup maps
      const encounters = (encountersRes.data || []) as EncounterRow[];
      const profiles = (profilesRes.data || []) as ProfileRow[];
      const alerts = (alertsRes.data || []) as AlertRow[];
      const risks = (risksRes.data || []) as RiskRow[];
      const fallRisks = (fallRisksRes.data || []) as FallRiskRow[];
      const engagement = (engagementRes.data || []) as EngagementRow[];
      const checkIns = (checkInsRes.data || []) as CheckInRow[];

      const encounterMap = new Map<string, EncounterRow>();
      for (const e of encounters) {
        if (!encounterMap.has(e.patient_id)) encounterMap.set(e.patient_id, e);
      }

      const alertCounts = new Map<string, { total: number; critical: number }>();
      for (const a of alerts) {
        const existing = alertCounts.get(a.patient_id) || { total: 0, critical: 0 };
        existing.total++;
        if (a.severity === 'critical' || a.severity === 'high') existing.critical++;
        alertCounts.set(a.patient_id, existing);
      }

      const riskMap = new Map<string, RiskRow>();
      for (const r of risks) { if (!riskMap.has(r.patient_id)) riskMap.set(r.patient_id, r); }

      const fallRiskMap = new Map<string, FallRiskRow>();
      for (const f of fallRisks) { if (!fallRiskMap.has(f.patient_id)) fallRiskMap.set(f.patient_id, f); }

      const engagementMap = new Map<string, EngagementRow>();
      for (const e of engagement) { engagementMap.set(e.user_id, e); }

      const checkInMap = new Map<string, CheckInRow>();
      for (const c of checkIns) { if (!checkInMap.has(c.user_id)) checkInMap.set(c.user_id, c); }

      // Build priority patients
      const priorityPatients: PriorityPatient[] = profiles.map((p) => {
        const enc = encounterMap.get(p.user_id);
        const alertData = alertCounts.get(p.user_id) || { total: 0, critical: 0 };
        const risk = riskMap.get(p.user_id);
        const fall = fallRiskMap.get(p.user_id);
        const eng = engagementMap.get(p.user_id);
        const vitals = checkInMap.get(p.user_id);

        const bpSys = vitals?.bp_systolic ?? null;
        const bpDia = vitals?.bp_diastolic ?? null;
        const hr = vitals?.heart_rate ?? null;
        const spo2 = vitals?.pulse_oximeter ?? null;

        const locationScore = getLocationScore(enc?.encounter_type ?? null, enc?.status ?? null);
        const abnormal = isAbnormalVitals(bpSys, bpDia, hr, spo2);
        const priorityScore = calculatePriorityScore(
          locationScore, risk?.readmission_risk_30_day ?? null,
          fall?.overall_risk_score ?? null, eng?.engagement_score ?? null,
          alertData.critical, alertData.total, abnormal,
        );

        const patient: PriorityPatient = {
          patient_id: p.user_id,
          first_name: p.first_name || 'Unknown',
          last_name: p.last_name || 'Unknown',
          dob: p.dob || '',
          location: getLocationLabel(enc?.encounter_type ?? null, enc?.status ?? null),
          encounter_status: enc?.status ?? null,
          encounter_type: enc?.encounter_type ?? null,
          encounter_id: enc?.id ?? null,
          priority_score: priorityScore,
          priority_level: getPriorityLevel(priorityScore),
          readmission_risk: risk?.readmission_risk_30_day ?? null,
          fall_risk: fall?.overall_risk_score ?? null,
          engagement_score: eng?.engagement_score ?? null,
          active_alerts: alertData.total,
          critical_alerts: alertData.critical,
          latest_bp: bpSys !== null && bpDia !== null ? `${bpSys}/${bpDia}` : null,
          latest_hr: hr,
          latest_spo2: spo2,
          risk_flags: [],
        };
        patient.risk_flags = buildRiskFlags(patient);
        return patient;
      });

      priorityPatients.sort((a, b) => b.priority_score - a.priority_score);
      setPatients(priorityPatients);

      await auditLogger.info('PHYSICIAN_PRIORITY_BOARD_LOADED', {
        physicianId,
        totalPatients: priorityPatients.length,
        critical: priorityPatients.filter(p => p.priority_level === 'critical').length,
        high: priorityPatients.filter(p => p.priority_level === 'high').length,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load priority board';
      setError(message);
      await auditLogger.error(
        'PHYSICIAN_PRIORITY_BOARD_FAILED',
        err instanceof Error ? err : new Error(String(err)),
        { physicianId, component: 'PatientPriorityBoard' },
      );
    } finally {
      setLoading(false);
    }
  }, [supabase, physicianId]);

  useEffect(() => {
    loadPriorityBoard();
  }, [loadPriorityBoard]);

  // Select patient → set global context → navigate to full chart
  const handleSelect = useCallback((patientId: string) => {
    const patient = patients.find(p => p.patient_id === patientId);
    if (patient) {
      const riskLevel = patient.priority_level === 'critical' ? 'critical'
        : patient.priority_level === 'high' ? 'high'
        : patient.priority_level === 'moderate' ? 'medium'
        : 'low' as const;

      const globalPatient: SelectedPatient = {
        id: patientId,
        firstName: patient.first_name,
        lastName: patient.last_name,
        riskLevel,
        snapshot: { unit: patient.location },
      };
      setGlobalPatient(globalPatient);
    }
    navigate(`/patient-chart/${patientId}?tab=overview`);
  }, [patients, navigate, setGlobalPatient]);

  // Filter + limit
  const filteredPatients = useMemo(() => {
    let list = patients;
    if (filterLevel !== 'all') list = list.filter(p => p.priority_level === filterLevel);
    return showAll ? list : list.slice(0, 10);
  }, [patients, filterLevel, showAll]);

  const counts = useMemo(() => ({
    critical: patients.filter(p => p.priority_level === 'critical').length,
    high: patients.filter(p => p.priority_level === 'high').length,
    moderate: patients.filter(p => p.priority_level === 'moderate').length,
    low: patients.filter(p => p.priority_level === 'low').length,
    total: patients.length,
  }), [patients]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border-2 border-gray-200 p-8">
        <div className="flex items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600" />
          <span className="text-gray-600 font-medium">AI analyzing your patient priorities...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-xl border-2 border-red-200 p-6">
        <p className="text-red-700 font-medium">Failed to load priority board</p>
        <p className="text-sm text-red-500 mt-1">{error}</p>
        <button onClick={loadPriorityBoard} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
          Retry
        </button>
      </div>
    );
  }

  if (counts.total === 0) {
    return (
      <div className="bg-gray-50 rounded-xl border-2 border-gray-200 p-8 text-center">
        <p className="text-gray-600 font-medium">No patients assigned to you</p>
        <p className="text-sm text-gray-500 mt-1">Patients will appear here when assigned via Care Team</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-linear-to-r from-slate-800 to-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
              My Patients — Priority Board
            </h2>
            <p className="text-sm text-slate-300 mt-1">
              {counts.total} patient{counts.total !== 1 ? 's' : ''} ranked by clinical criticality
            </p>
          </div>
          <button
            onClick={loadPriorityBoard}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Refresh priority scores"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* Filter badges */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {([
            { level: 'all' as const, label: `All (${counts.total})`, inactive: 'bg-white/10 text-white hover:bg-white/20', active: 'bg-white text-slate-800' },
            { level: 'critical' as const, label: `Critical (${counts.critical})`, inactive: 'bg-red-500/20 text-red-200 hover:bg-red-500/40', active: 'bg-red-500 text-white' },
            { level: 'high' as const, label: `High (${counts.high})`, inactive: 'bg-orange-500/20 text-orange-200 hover:bg-orange-500/40', active: 'bg-orange-500 text-white' },
            { level: 'moderate' as const, label: `Moderate (${counts.moderate})`, inactive: 'bg-yellow-500/20 text-yellow-200 hover:bg-yellow-500/40', active: 'bg-yellow-500 text-white' },
            { level: 'low' as const, label: `Low (${counts.low})`, inactive: 'bg-green-500/20 text-green-200 hover:bg-green-500/40', active: 'bg-green-500 text-white' },
          ]).map(({ level, label, inactive, active }) => (
            <button
              key={level}
              onClick={() => setFilterLevel(level)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filterLevel === level ? active : inactive}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Patient list */}
      <div className="p-4 space-y-3 max-h-[700px] overflow-y-auto">
        {filteredPatients.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No patients match this filter.</div>
        ) : (
          filteredPatients.map((patient, index) => (
            <PriorityCard key={patient.patient_id} patient={patient} rank={index + 1} onSelect={handleSelect} />
          ))
        )}
      </div>

      {/* Show more/less */}
      {patients.length > 10 && (
        <div className="px-4 pb-4">
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full py-2 text-sm text-gray-600 hover:text-gray-900 flex items-center justify-center gap-1"
          >
            {showAll ? (
              <>Show Top 10 Only <ChevronUp className="w-4 h-4" /></>
            ) : (
              <>Show All {patients.length} Patients <ChevronDown className="w-4 h-4" /></>
            )}
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="px-6 py-3 bg-gray-50 border-t text-xs text-gray-500">
        <strong>AI Scoring:</strong> Location (30%) + Alerts (40%) + Readmission (25%) + Fall Risk (15%) + Engagement (10%) + Vitals (10%)
        {' | '}Click any patient to open their full chart with avatar and all clinical data.
      </div>
    </div>
  );
};

export default PatientPriorityBoard;
